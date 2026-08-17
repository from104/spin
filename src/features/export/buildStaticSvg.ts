// §6.2 PNG — **한 장면(frame) → 자립 SVG 문자열**. 순수 함수다(부작용 0, DOM 0, 캔버스 0, React 0).
//
// ── 왜 살아 있는 DOM 을 직렬화하지 않는가 (계획서 §6.2 기술경로 1) ──────────────────────
// `XMLSerializer` 로 화면의 `<svg>` 를 떼면 스타일시트가 따라오지 않는다. 그러면
//   · `focus-ind-outer/inner` 는 스타일이 `a11y.css:27-39`(`opacity:0; fill:none`)에만 있어서
//     SVG 기본값(fill:black, opacity:1)이 적용돼 **개체마다 검은 사각형**, **화살표마다 검은 띠**
//     가 덮인다.
//   · `var(--accent)`(선택 링·핸들)는 해석 불가라 통째로 무너진다.
// 그래서 좌표를 props 로 받는 **전용 정적 렌더러**를 따로 쓴다. 아래 다섯이 이 파일의
// 완료 판정이고, 테스트가 출력 문자열에 대해 직접 단언한다:
//   ① `class=` 0회  ② `var(--` 0회  ③ `focus-ind` 0회  ④ `<text>` 0개 ⑤ width/height 명시
//
// ── 좌표의 출처 ────────────────────────────────────────────────────────────────────
// **리터럴 좌표를 새로 박지 않는다.** 2026-08-11 에 외곽선·센터서클이 리터럴이라 코트 마진을
// 1.0→1.5 m 로 넓히자 골대가 선 밖으로 나간 사고가 있었다(기현님 실기 신고).
// 코트 라인은 `FullCourtLines`/`HalfCourtLines` 와 **같은 식**으로 `COURT_DEFS` 에서 파생하고,
// 굵기는 `COURT_LINE_WEIGHTS.present` 를 그대로 읽는다. 리터럴은 센터 서클 반지름 하나뿐이고
// 그것도 원본이 리터럴이라 그대로 옮긴 것이다(5.3 이 지우면 아래 대조 테스트가 먼저 빨개진다).
//
// ⚠️ 왜 `renderToStaticMarkup(<CourtSurface/>)` 로 컴포넌트를 그대로 굽지 않는가 —
//    한 번 그렇게 만들었다가 되돌렸다. **실측**: `react-dom/server` 를 앱 번들에 넣으면
//    프로덕션 gzip 이 66.82 kB → 130.18 kB 로 **+63.4 kB** 늘어난다(현재 앱 JS 전체가
//    162 kB gzip 이다. 체육관에서 오프라인으로 쓰는 앱에 40% 를 얹는 값이다).
//    대신 **동기화는 테스트로 보장한다**: `courtLines.contract.test.ts` 가 진짜 컴포넌트를
//    `renderToStaticMarkup` 으로 구워(테스트 코드는 번들에 안 실린다) 도형 집합이 이 파일의
//    출력과 **완전히 같은지** 대조한다. 5.1~5.3 이 코트 라인을 손대면 그 테스트가 빨개진다.
//    → 배포 바이트 0, 드리프트 0. 이 주석을 지우고 편하게 컴포넌트를 부르지 마라.
//
// 개체(칩·공·콘·화살표·쪽지)는 원본 컴포넌트가 class/var(--)/focus-ind 를 전부 달고 있어
// 애초에 재사용할 수 없다 — 크기는 `core/constants.ts`(CHAIR/BALL/CONE/NOTE), 색은
// `core/colors.ts`, 경로는 `model/arrow.ts` `arrowPath` 와 `noteChip.ts` 에서 가져온다.
//
// ── 글자 ──────────────────────────────────────────────────────────────────────────
// `<text>` 를 **한 개도** 넣지 않는다(★[A-9]). 배치 정보는 `buildTextPlacements`
// (staticSceneLayout.ts)가 따로 돌려주고 래스터 어댑터가 캔버스에서 그린다. 근거는 그 파일
// 머리말에 있다. 부수 이득: 사용자 문자열이 SVG 에 실리지 않아 이스케이프 사고가 원천 봉쇄된다.
import { DEG } from '../../core/angle.ts';
import { ARROW_CASING, BALL_FILL, CONE_COLORS, COURT_BG, NOTE_FILL, NOTE_FOLD_FILL, OBJ_STROKE } from '../../core/colors.ts';
import { BALL, CHAIR, CONE } from '../../core/constants.ts';
import { courtDefFor, SPOT_CROSS_HALF_PX } from '../../model/court.ts';
import { arrowPath, ARROW_STYLE, arrowColor } from '../../model/arrow.ts';
import { gridGeom } from '../../model/grid.ts';
import type { RenderFrame } from '../../model/playback.ts';
import type { Shape } from '../../model/shape.ts';
import { defaultDefense, defendedZones, ringRadiusPx, ringViolation, zoneViolation, type RuleActor } from '../../model/rules.ts';
import { COURT_LINE_WEIGHTS } from '../../render/CourtSurface.tsx';
import {
  RULE_ALERT_STROKE,
  RULE_DASH,
  RULE_OK_STROKE,
  RULE_ZONE_ALERT_FILL,
  RULE_ZONE_ALERT_FILL_OPACITY,
  RULE_ZONE_FILL,
  RULE_ZONE_FILL_OPACITY,
} from '../../render/ruleOverlay.ts';
import { NOTE_DEFAULT_SIZE_PX, noteChipHeightPx, noteChipPathD, noteFoldPathD } from '../../render/objects/noteChip.ts';
// 진영 깃발의 좌표는 **저쪽 함수 하나**에서 온다(render/sideFlags.ts 의 sideFlagGroups 머리말).
// 색·굵기도 같이 읽는다 — 여기 리터럴로 적으면 그림에서만 깃발이 어긋난다.
import { FLAG_STROKE, FLAG_STROKE_W, POLE_W, sideFlagGroups } from '../../render/sideFlags.ts';
import { pointsAttr, shapeSize, triPointsOf, SHAPE_COLOR, SHAPE_FILL_OPACITY, SHAPE_STROKE_OPACITY, SHAPE_STROKE_PX } from '../../model/shape.ts';
import { num, safeColor, safeId } from './svgSafe.ts';
import { teamMarkFor } from './teamMark.ts';
import {
  buildTextPlacements,
  CAPTION_BAND_FILL,
  EXPORT_LAYOUT,
  noteHalfWidth,
  staticSceneMetrics,
  type SceneMetrics,
  type StaticSceneOpts,
  type TextPlacement,
} from './staticSceneLayout.ts';

export type { SceneCaption, StaticSceneOpts, SceneMetrics, TextPlacement } from './staticSceneLayout.ts';

/** 이 SVG 안에서만 유일하면 되는 마커 접두사. 자립 문서라 `useId()` 가 필요 없다 —
 *  한 파일에 SVG 하나뿐이므로 §6.6 이 경계하는 '다중 인스턴스 url(#id) 충돌' 이 성립하지 않는다. */
export const MARKER_UID = 'spin-ah';

/** 콘 삼각형. ConeMark.tsx 의 `'M0,-5 L5,4 L-5,4 Z'` 와 **한 픽셀도 다르면 안 된다** —
 *  10×9(§6.6)를 정수 좌표에 앉힌 모양이라 밑변이 원점보다 0.5 아래다. 그 유도식 그대로 쓴다. */
const CONE_HALF_W = CONE.viewWidthPx / 2; // 5
const CONE_TRI_D = `M0,${-CONE_HALF_W} L${CONE_HALF_W},${CONE.viewHeightPx - CONE_HALF_W} L${-CONE_HALF_W},${CONE.viewHeightPx - CONE_HALF_W} Z`;
/** 슬롯 1 전용 밑변 사각 베이스(ConeMark.tsx 와 동일). 색이 아니라 실루엣으로 구분한다. */
const CONE_BASE_D = 'M-6,4.5 H6 V6.5 H-6 Z';
const CONE_STROKE_W = 1.6;

/** 규칙 오버레이 굵기·케이싱. RuleOverlay.tsx 와 같은 값이다. */
const RULE_CASING = '#000000';
/** ⚠️ 2026-08-13(②) 0.55 → 1. 알파 .55 검정은 코트 위 합성이 #0e371f 라 대비 2.48:1 로
 *  §7.1 하한(3:1) 미달이었다 — 화면(RuleOverlay.tsx)과 **같은 이유로 같이** 올린다. */
const RULE_CASING_OPACITY = 1;
const RING_MARK_W = 2.6;
const RING_CASING_W = 5.4;
const ZONE_MARK_W = 3;
const ZONE_CASING_W = 6.4;

const attrOpacity = (o: number): string => (o >= 1 ? '' : ` opacity="${num(o)}"`);

/** `translate(x y)` — 회전이 0 이면 붙이지 않는다(문자열이 짧을수록 data URI 가 짧다). */
function poseTransform(x: number, y: number, theta = 0): string {
  const t = `translate(${num(x)} ${num(y)})`;
  return theta === 0 ? t : `${t} rotate(${num(theta * DEG)})`;
}

// ── 코트 라인 ────────────────────────────────────────────────────────────────────────
// FullCourtLines.tsx / HalfCourtLines.tsx 와 **같은 식**이다. 좌표는 전부 COURT_DEFS 파생이고,
// 굵기는 COURT_LINE_WEIGHTS.present 를 읽는다. 동기화는 courtLines.contract.test.ts 가 보장한다
// (진짜 컴포넌트를 구워 도형 집합을 대조 — 파일 머리말의 ⚠️ 참고).
const W = COURT_LINE_WEIGHTS.present;

// ⚠️ 5.3 이 `const CENTER_CIRCLE_R = 75` 를 **지웠다**. 규정에 없는 원이었고(Laws 2025 전문에
//    "circle" 0회, §9 결정 ⑧), 화면 컴포넌트에서 지운 것을 여기에 남기면 **내보낸 그림에만**
//    센터 서클이 남는다 — courtLines.contract.test.ts 가 그 갈라짐을 잡는 자리다.
//    센터 마크(X)는 좌표가 `COURT_DEFS[mode].centerMark` 에 있으므로 상수가 필요 없다.
/** 골 십자 반폭. present 변형은 dx=dy=3.5(full 의 editor 만 dy=3 이다).
 *  ⚠️ 리터럴 3.5 로 되돌리지 마라 — 센터 마크가 이 상수에서 파생된다(court.ts 근거,
 *  2026-08-13 "센터 X 를 페널티 스팟과 같은 크기로"). */
const CROSS_HALF = SPOT_CROSS_HALF_PX;

function goalCrossD(marks: readonly { x: number; y: number }[]): string {
  return marks
    .map(({ x, y }) => {
      const d = `M${x - CROSS_HALF},${y - CROSS_HALF} L${x + CROSS_HALF},${y + CROSS_HALF} M${x + CROSS_HALF},${y - CROSS_HALF} L${x - CROSS_HALF},${y + CROSS_HALF}`;
      return `<path d="${d}"/>`;
    })
    .join('');
}

/** 골대 원. 편집기와 달리 여기는 물리 바디가 없으므로 `present` 처럼 정적 원을 그린다. */
function goalPostsMarkup(posts: readonly { x: number; y: number }[]): string {
  if (posts.length === 0) return '';
  return (
    `<g fill="#f5f5f5" stroke="#c2410c" stroke-width="${num(W.spotSw!)}">` +
    posts.map((p) => `<circle cx="${num(p.x)}" cy="${num(p.y)}" r="${num(W.spotR!)}"/>`).join('') +
    `</g>`
  );
}

function cornerCutsMarkup(cuts: readonly string[]): string {
  return cuts.map((d) => `<path d="${d}" stroke-width="${num(W.outline)}"/>`).join('');
}

/** 5.2 코너킥 인크로치먼트 마크 — 코너컷과 같은 굵기·같은 규약(둘 다 COURT_DEFS 의 path 목록). */
function encroachMarksMarkup(marks: readonly string[]): string {
  return marks.map((d) => `<path d="${d}" stroke-width="${num(W.outline)}"/>`).join('');
}

/** 5.3 센터 마크(X — 표시 크기는 페널티 스팟 십자와 같다, 2026-08-13). 하프라인이 없는 판은
 *  `centerMark === null` 이라 빈 문자열이다 — 이제 `flat` 하나뿐이다(하프는 2026-08-13 에 생겼다). */
function centerMarkMarkup(d: string | null): string {
  return d === null ? '' : `<path d="${d}" stroke-width="${num(W.centerMark)}"/>`;
}

export function courtLinesMarkup(mode: StaticSceneOpts['mode'], size?: StaticSceneOpts['size']): string {
  const def = courtDefFor(mode, size);
  const S = def.surface;
  if (mode === 'flat') return ''; // "라인 없음"(§3.2 dims) — FlatCourtLines 도 null 을 돌려준다

  if (mode === 'half') {
    const gz = def.ruleZones[0]!;
    return (
      `<g fill="none" stroke="#ffffff" stroke-linecap="butt">` +
      `<path d="M${num(S.x)},${num(S.y)} L${num(S.x)},${num(S.y + S.h)} L${num(S.x + S.w)},${num(S.y + S.h)} L${num(S.x + S.w)},${num(S.y)}" stroke-width="${num(W.outline)}"/>` +
      `<line x1="${num(S.x)}" y1="${num(S.y)}" x2="${num(S.x + S.w)}" y2="${num(S.y)}" stroke-width="${num(W.outline)}"/>` +
      cornerCutsMarkup(def.cornerCuts) +
      encroachMarksMarkup(def.encroachMarks) +
      // ── 옛 주석(2026-08-12까지) — 지우지 않는다. 기록이다 ──────────────────────────────
      // ⚠️ 여기에 `centerMarkMarkup` 을 부르면 안 된다. HalfCourtLines 가 센터 마크를 **아예
      //    그리지 않기** 때문이고(하프에는 하프라인이 없다 — 5.3), 이 함수는 그 컴포넌트의 손
      //    이식본이라 "모델이 주면 그린다" 로 앞서 나가면 두 그림이 갈라진다. 실제로 그렇게 두고
      //    half.centerMark 에 값을 넣어 보면 courtLines.contract.test.ts 의 half 가 빨개진다.
      // ── 2026-08-13 기현님 실기 지시로 뒤집혔다 ────────────────────────────────────────
      //    이제 HalfCourtLines 가 센터 마크를 그린다. 위 문장의 **논리는 그대로 유효하다** —
      //    "컴포넌트가 그리는 것만 여기서도 그린다". 바뀐 것은 컴포넌트 쪽이고, 그래서 여기도
      //    같이 부른다. 이 줄을 지우면 **PNG 에만 센터 마크가 없는** 갈라짐이 되고
      //    courtLines.contract.test.ts 의 half 가 그 자리에서 빨개진다 —
      //    반증 실측(2026-08-13): `AssertionError: expected [ …(10) ] to deeply equal [ …(11) ]`.
      //    ⚠️ 그 도형 대조는 **양쪽에서 같이 지우면 초록이다.** 그래서 같은 파일에
      //       '센터 마크가 실제로 있다' 는 **존재 단언**을 따로 뒀다(실측: 양쪽 삭제 시
      //       half 대조는 통과하고 그 존재 단언만 빨갰다).
      `<path d="M${num(gz.x)},${num(S.y + S.h)} L${num(gz.x)},${num(gz.y)} L${num(gz.x + gz.w)},${num(gz.y)} L${num(gz.x + gz.w)},${num(S.y + S.h)}" stroke-width="${num(W.goalArea)}"/>` +
      centerMarkMarkup(def.centerMark) +
      `</g>` +
      // 하프에는 센터 흰 점이 없다 — HalfCourtLines.tsx 머리말이 "추가하지 않는다" 로 못박았다.
      // (그 문장에서 살아남은 것은 **점**뿐이다. X 는 위에서 그린다 — 2026-08-13.)
      `<g fill="none" stroke="#ffffff" stroke-width="${num(W.goalCross!)}" stroke-linecap="round">${goalCrossD(def.spotMarks)}</g>` +
      goalPostsMarkup(def.goalPosts)
    );
  }

  const [gzL, gzR] = def.ruleZones;
  return (
    `<g fill="none" stroke="#ffffff" stroke-linecap="butt">` +
    `<rect x="${num(S.x)}" y="${num(S.y)}" width="${num(S.w)}" height="${num(S.h)}" stroke-width="${num(W.outline)}"/>` +
    `<line x1="${num(S.x + S.w / 2)}" y1="${num(S.y)}" x2="${num(S.x + S.w / 2)}" y2="${num(S.y + S.h)}" stroke-width="${num(W.outline)}"/>` +
    cornerCutsMarkup(def.cornerCuts) +
    encroachMarksMarkup(def.encroachMarks) +
    `<path d="M${num(S.x)},${num(gzL!.y)} L${num(gzL!.x + gzL!.w)},${num(gzL!.y)} L${num(gzL!.x + gzL!.w)},${num(gzL!.y + gzL!.h)} L${num(S.x)},${num(gzL!.y + gzL!.h)}" stroke-width="${num(W.goalArea)}"/>` +
    `<path d="M${num(S.x + S.w)},${num(gzR!.y)} L${num(gzR!.x)},${num(gzR!.y)} L${num(gzR!.x)},${num(gzR!.y + gzR!.h)} L${num(S.x + S.w)},${num(gzR!.y + gzR!.h)}" stroke-width="${num(W.goalArea)}"/>` +
    centerMarkMarkup(def.centerMark) +
    `</g>` +
    `<g fill="none" stroke="#ffffff" stroke-width="${num(W.goalCross!)}" stroke-linecap="round">${goalCrossD(def.spotMarks)}</g>` +
    goalPostsMarkup(def.goalPosts)
  );
}

/** 화살촉 마커. ArrowMarkers.tsx 와 **id 규약·모양이 같아야 한다** — 다르면 화살촉이 사라진다.
 *  케이싱을 먼저 그리는 이유도 그쪽과 같다(#38bdf8 는 코트 대비 2.49:1 로 WCAG 1.4.11 미달). */
/** 화살촉 둘 — **ArrowMarkers.tsx 의 HEADS 와 한 픽셀도 다르면 안 된다**(2026-08-16).
 *  courtLines.contract.test 가 두 구현을 도형 단위로 대조한다. */
const ARROW_HEADS = {
  thin: { d: 'M0.353,0.353 L6.853,3.553 L0.353,6.753 z', w: 7.21, h: 7.11, refY: 3.553 },
  wide: { d: 'M0.353,0.353 L6.853,5.853 L0.353,11.353 z', w: 7.21, h: 11.71, refY: 5.853 },
} as const;
/** 화살촉 테두리 두께 — ArrowMarkers 의 HEAD_CASING_W 와 **한 글자도 달라선 안 된다**. */
const ARROW_HEAD_CASING_W = 0.71;
type ExportHead = keyof typeof ARROW_HEADS;

/** 양 끝 화살촉 속성. 'none' 이면 그 속성 자체를 안 쓴다 — 빈 url(#…) 은 SVG 가 무시하지만
 *  문자열에 남으면 대조 테스트가 화면 컴포넌트와 어긋난다. */
function headAttr(a: { headFrom?: ExportHead | 'none'; headTo?: ExportHead | 'none' }, color: string): string {
  const f = a.headFrom ?? 'none';
  const t = a.headTo ?? 'thin';
  const k = markerKey(color);
  return (
    (f === 'none' ? '' : ` marker-start="url(#${MARKER_UID}-${k}-${f})"`) +
    (t === 'none' ? '' : ` marker-end="url(#${MARKER_UID}-${k}-${t})"`)
  );
}

export function arrowMarkersMarkup(colors: readonly string[]): string {
  const kinds: readonly ExportHead[] = ['thin', 'wide'];
  const marker = (id: string, fill: string, k: ExportHead): string => {
    const h = ARROW_HEADS[k];
    return (
      `<marker id="${id}" markerWidth="${h.w}" markerHeight="${h.h}" refX="5.353" refY="${h.refY}" orient="auto-start-reverse">` +
      `<path d="${h.d}" fill="${fill}" stroke="${ARROW_CASING}" stroke-width="${num(ARROW_HEAD_CASING_W)}" stroke-linejoin="round"/>` +
      `</marker>`
    );
  };
  // 케이싱 전용 마커는 없다 — 화살촉의 대비는 위 stroke 가 맡는다(ArrowMarkers 와 같은 근거).
  return colors.flatMap((c) => kinds.map((k) => marker(`${MARKER_UID}-${markerKey(c)}-${k}`, c, k))).join('');
}

/** 규칙 존(흰 파선 테두리 + **연한 붉은** 채움). RuleZones.tsx 와 같은 값 — 면이 아니라 파선이
 *  기능을 전한다. 색·농도는 ruleOverlay.ts 의 RULE_ZONE_* 하나에서 온다(6차에 render/teamMark.ts
 *  와 features/export/teamMark.ts 가 갈라질 뻔한 전례가 있다 — 값을 여기 손으로 적지 마라).
 *  ⚠️ `opacity` 가 아니라 `fill-opacity` 다: 요소 opacity 는 흰 파선까지 함께 깎아 그 채널을
 *  1.26:1 로 죽인다(RuleZones.tsx 머리말의 실측). courtLines.contract.test.ts 가 화면 컴포넌트와
 *  이 문자열을 도형 단위로 대조하므로, 한쪽만 고치면 그 테스트가 먼저 빨개진다. */
export function ruleZonesMarkup(mode: StaticSceneOpts['mode'], size?: StaticSceneOpts['size']): string {
  const zones = courtDefFor(mode, size).ruleZones;
  if (zones.length === 0) return '';
  return (
    `<g>` +
    zones
      .map(
        (z) =>
          `<rect x="${num(z.x)}" y="${num(z.y)}" width="${num(z.w)}" height="${num(z.h)}" fill="${RULE_ZONE_FILL}" fill-opacity="${RULE_ZONE_FILL_OPACITY}" stroke="${RULE_OK_STROKE}" stroke-width="2" stroke-dasharray="${RULE_DASH}"/>`,
      )
      .join('') +
    `</g>`
  );
}

/** 진영 표시(골라인 뒤 깃발 둘). **좌표는 화면과 같은 함수**(`sideFlagGroups`)에서 온다 —
 *  이 파일이 코트 라인·규칙 존에 요구하는 규율과 같다.
 *
 *  ⚠️ 숫자를 `num()` 으로 접지 마라. 화면 컴포넌트는 원값을 그대로 찍으므로 여기서 반올림하면
 *     `courtLines.contract.test.ts` 의 도형 대조가 갈라진다(값은 코트 정의와 상수에서만
 *     나오므로 NaN 이 들어올 자리가 없다 — `num()` 이 막으려던 위험이 여기엔 없다).
 *
 *  규칙 존 스위치와 **무관하게 언제나 그린다** — 화면(CourtStage)과 같은 판단이다.
 *  플랫 코트는 빈 문자열이다(`sideFlagGroups` 가 빈 배열을 준다). */
export function sideMarksMarkup(opts: StaticSceneOpts): string {
  const groups = sideFlagGroups({ mode: opts.mode, size: opts.size, teams: opts.teams, defense: opts.defense });
  if (groups.length === 0) return '';
  let out = '';
  for (const g of groups) {
    for (const f of g.flags) {
      out +=
        `<line x1="${f.poleX}" y1="${f.poleY1}" x2="${f.poleX}" y2="${f.poleY2}" stroke="${FLAG_STROKE}" stroke-width="${POLE_W}" stroke-linecap="round"/>` +
        `<polygon points="${f.pennant}" fill="${safeColor(f.fill, '#888888')}" stroke="${FLAG_STROKE}" stroke-width="${FLAG_STROKE_W}" stroke-linejoin="round"/>`;
    }
  }
  return `<g>${out}</g>`;
}

/** 작도 도형 — `ShapeLayer.tsx` 와 **같은 값·같은 층**이다(코트 위, 콘·화살표·칩 아래).
 *  선택·잠김 표시는 없다: 내보낸 그림에 '지금 고르고 있는 것' 이라는 개념이 없고, 선택 색은
 *  `var(--accent)` 라 이 파일의 완료 판정 ②(`var(--` 0회)를 어긴다.
 *
 *  ⚠️ 이 `<g>` 에 `opacity` 를 걸지 마라 — 겹치면 진해지는 성질이 통째로 사라진다
 *     (ShapeLayer.tsx 머리말 ①. 그림에서만 납작해지면 코트에서야 알게 된다).
 *  ⚠️ 숫자를 `num()` 으로 접지 마라 — `sideMarksMarkup` 과 같은 이유다. */
export function shapesMarkup(shapes: readonly Shape[]): string {
  if (shapes.length === 0) return '';
  let out = '';
  for (const s of shapes) {
    const { w, h } = shapeSize(s);
    const paint =
      `fill="${SHAPE_COLOR}" fill-opacity="${SHAPE_FILL_OPACITY}"` +
      ` stroke="${SHAPE_COLOR}" stroke-opacity="${SHAPE_STROKE_OPACITY}" stroke-width="${SHAPE_STROKE_PX}"`;
    // 삼각형의 모양은 w/h 가 아니라 꼭짓점이 진다(2026-08-15 자유 삼각형) — 그래서
    // `triPointsOf`/`pointsAttr` 을 화면과 **같이** 지난다. w/h 는 경계상자일 뿐이다.
    const body =
      s.kind === 'ellipse'
        ? `<ellipse rx="${w / 2}" ry="${h / 2}" ${paint}/>`
        : s.kind === 'rect'
          ? `<rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" ${paint}/>`
          : `<polygon points="${pointsAttr(triPointsOf(s))}" ${paint} stroke-linejoin="round"/>`;
    out += `<g id="obj-${safeId(s.id)}" transform="translate(${s.x} ${s.y}) rotate(${s.rot})">${body}</g>`;
  }
  return out;
}

/** 격자 — **선만** 그린다. 칸 라벨은 §6.2 표가 '안 담긴다' 로 못박았고, 글자라 어차피 못 넣는다.
 *  좌표는 `gridGeom` 하나에서 온다(GridOverlay 와 같은 출처). */
function gridMarkup(opts: StaticSceneOpts): string {
  if (!opts.showGrid) return '';
  const g = gridGeom(opts.mode, opts.size);
  const xMin = g.vx[0]!;
  const xMax = g.vx[g.vx.length - 1]!;
  const yMin = g.hy[0]!;
  const yMax = g.hy[g.hy.length - 1]!;
  const lines = (vx: number[], hy: number[]): string =>
    vx.map((x) => `<line x1="${num(x)}" y1="${num(yMin)}" x2="${num(x)}" y2="${num(yMax)}"/>`).join('') +
    hy.map((y) => `<line x1="${num(xMin)}" y1="${num(y)}" x2="${num(xMax)}" y2="${num(y)}"/>`).join('');
  let out = `<g stroke="#ffffff" stroke-width="1" opacity="0.22" shape-rendering="crispEdges">${lines(g.inner.vx, g.inner.hy)}</g>`;
  if (g.major) out += `<g stroke="#ffffff" stroke-width="1" opacity="0.34" shape-rendering="crispEdges">${lines(g.major.vx, g.major.hy)}</g>`;
  return out;
}

/** 프레임의 실제 좌표로 규칙을 판정한다 — 화면(RuleOverlay)과 **같은 순수 함수**를 쓴다.
 *  그래야 "화면에서는 붉었는데 내보낸 그림은 하얀" 일이 없다.
 *
 *  ⚠️ `theta` 를 빠뜨리면 **PNG 만 옛 판정으로 그려진다**(2026-08-13). 판정은 차체 사각형으로
 *  재므로(model/chairOverlap.ts) 방향이 없으면 사각형이 안 만들어진다 — 그런데 `RuleActor.theta`
 *  가 필수라 여기를 빠뜨리면 컴파일이 먼저 막는다. 그 배선을 실제로 재는 것은
 *  buildStaticSvg.test.ts 의 '차체 방향이 PNG 판정까지 온다' 다. */
function ruleActors(frame: RenderFrame): RuleActor[] {
  const out: RuleActor[] = [];
  for (const c of frame.chairs) {
    if (c.opacity <= 0) continue;
    out.push({ id: c.id, team: c.def.team, isGk: c.def.isGk, x: c.x, y: c.y, theta: c.theta });
  }
  return out;
}

/** 3 m 링 + 골 지역 위반 표시. 시각 언어는 RuleOverlay.tsx 그대로 — **깨끗하면 파선 흰색,
 *  걸리면 실선 붉은색**, 그 아래에 언제나 검정 케이싱(붉은색은 코트 위 1.75:1 로 혼자서는
 *  못 읽힌다). 색은 세 번째 채널이다. */
function ruleMarkup(frame: RenderFrame, opts: StaticSceneOpts): string {
  const def = courtDefFor(opts.mode, opts.size);
  const actors = ruleActors(frame);
  // 진영을 입힌 골 지역. 화면(RuleOverlay)과 **같은 함수**를 지나야 PNG 만 다른 팀을 칠하는 일이 없다.
  const zones = defendedZones(def.ruleZones, opts.defense ?? defaultDefense(opts.mode));
  // §7 5.2(2026-08-13) — **조기 반환을 여기서 뺐다.** 개별 공의 원은 사용자가 그 공을 눌러
  // 명시적으로 켠 것이라 규칙 존 스위치와 다른 축이다(화면 RuleOverlay.tsx 와 같은 판단) —
  // `showRuleZones` 가 꺼져 있어도 PNG 에 실린다. 존·존 위반 표시만 스위치에 매인다.
  let out = opts.showRuleZones ? ruleZonesMarkup(opts.mode, opts.size) : '';

  for (const dz of opts.showRuleZones ? zones : []) {
    if (zoneViolation(dz, actors) === 0) continue;
    const z = dz.rect;
    const box = `x="${num(z.x)}" y="${num(z.y)}" width="${num(z.w)}" height="${num(z.h)}"`;
    out +=
      `<g stroke="${RULE_ALERT_STROKE}">` +
      `<rect ${box} fill="none" stroke="${RULE_CASING}" stroke-width="${ZONE_CASING_W}" opacity="${RULE_CASING_OPACITY}"/>` +
      `<rect ${box} fill="${RULE_ZONE_ALERT_FILL}" fill-opacity="${RULE_ZONE_ALERT_FILL_OPACITY}" stroke-width="${ZONE_MARK_W}"/>` +
      `</g>`;
  }

  for (const b of frame.balls) {
    if (b.opacity <= 0) continue;
    // 5.2 — 반지름은 그 공의 상태에서 나온다. null = 원 없음(대부분의 공) → 아무것도 안 그린다.
    // ⚠️ `RING_R_PX` 를 여기 다시 박지 마라: 5 m 를 켠 공이 PNG 에서만 3 m 로 나간다.
    const r = ringRadiusPx(b.ring ?? 'none');
    if (r === null) continue;
    // 판정 반경은 언제나 3 m 다(ringViolation) — 켜 놓은 원이 5 m 라고 2-on-1 이 5 m 가 되지
    // 않는다. 스위치가 꺼져 있으면 화면과 같이 판정도 서지 않으므로 흰 파선 그대로 나간다.
    const bad = (opts.showRuleZones ?? false) && ringViolation(b, actors, zones) !== 0;
    const stroke = bad ? RULE_ALERT_STROKE : RULE_OK_STROKE;
    const dash = bad ? '' : ` stroke-dasharray="${RULE_DASH}"`;
    out +=
      `<g transform="${poseTransform(b.x, b.y)}"${attrOpacity(b.opacity)}>` +
      `<circle r="${num(r)}" fill="none" stroke="${RULE_CASING}" stroke-width="${RING_CASING_W}" opacity="${RULE_CASING_OPACITY}"/>` +
      `<circle r="${num(r)}" fill="none" stroke="${stroke}" stroke-width="${RING_MARK_W}"${dash}/>` +
      `</g>`;
  }
  return out;
}

/** 콘 — 슬롯 0 은 삼각형, 슬롯 1 은 삼각형 + 밑변 베이스(색이 아니라 실루엣으로 구분). */
function conesMarkup(frame: RenderFrame): string {
  let out = '';
  for (const c of frame.cones) {
    if (c.opacity <= 0) continue;
    const fill = CONE_COLORS[c.colorIndex];
    out +=
      `<g id="obj-${safeId(c.id)}" transform="${poseTransform(c.x, c.y)}"${attrOpacity(c.opacity)}>` +
      `<path d="${CONE_TRI_D}" fill="${fill}" stroke="${OBJ_STROKE}" stroke-width="${CONE_STROKE_W}"/>` +
      (c.colorIndex === 1 ? `<path d="${CONE_BASE_D}" fill="${fill}" stroke="${OBJ_STROKE}" stroke-width="${CONE_STROKE_W}"/>` : '') +
      `</g>`;
  }
  return out;
}

/** 화살표 — 케이싱(검정 halo)을 먼저, 본선을 뒤에. `#38bdf8` 는 코트 대비 2.49:1 로 WCAG
 *  1.4.11 미달이라 케이싱이 없으면 시각 대비 요건을 못 채운다(ArrowPath.tsx 와 같은 근거). */
function arrowsMarkup(frame: RenderFrame): string {
  let out = '';
  for (const a of frame.arrows) {
    if (a.opacity <= 0) continue;
    const d = arrowPath(a);
    const style = ARROW_STYLE;
    const color = safeColor(a.color, ARROW_STYLE.color);

    out +=
      `<g id="obj-${safeId(a.id)}"${attrOpacity(a.opacity)}>` +
      `<path d="${d}" fill="none" stroke="${ARROW_CASING}" stroke-width="${num(style.width + 2.4)}" stroke-linecap="round"/>` +
      `<path d="${d}" fill="none" stroke="${color}" stroke-width="${num(style.width)}" stroke-linecap="round"${headAttr(a, color)}/>` +
      `</g>`;
  }
  return out;
}

/** ArrowMarkers 가 만드는 id 규약(`${uid}-${color.slice(1)}`) 그대로. 색이 `#` 로 시작하지
 *  않으면(이름색) slice 가 앞 글자를 먹으므로 그때만 다르게 접는다 — 두 곳이 어긋나면
 *  화살촉이 통째로 사라진다. */
function markerKey(color: string): string {
  return safeId(color.startsWith('#') ? color.slice(1) : color);
}

/** 휠체어 — 차체 · 볼가드 · 머리(피벗). 등번호는 여기 없다(★[A-9] 캔버스가 그린다).
 *  팀을 구분하는 값은 전부 `teamMarkFor` 하나에서 온다(4.6 이 파선·가드 톤까지 거기 모았다).
 *  ⚠️ `stroke-dasharray` 와 볼가드 `fill` 을 여기서 리터럴로 되돌리면 흑백 인쇄에서 두 팀이
 *  다시 같아진다 — src/render/teamMark.ts 머리말의 근거 참고. */
function chairsMarkup(frame: RenderFrame, opts: StaticSceneOpts): string {
  const halfW = CHAIR.widthPx / 2;
  let out = '';
  for (const c of frame.chairs) {
    if (c.opacity <= 0) continue;
    const m = teamMarkFor(c.def, opts.teams);
    const dash = m.strokeDash ? ` stroke-dasharray="${m.strokeDash}"` : '';
    out +=
      `<g id="obj-${safeId(c.id)}" transform="${poseTransform(c.x, c.y, c.theta)}"${attrOpacity(c.opacity)}>` +
      `<rect x="${num(-CHAIR.pivotToRearPx)}" y="${num(-halfW)}" width="${num(CHAIR.lengthPx)}" height="${num(CHAIR.widthPx)}" rx="5"` +
      ` fill="${safeColor(m.fill, '#888888')}" stroke="${m.stroke}" stroke-width="${num(m.strokeWidth)}"${dash}/>` +
      `<rect x="${num(CHAIR.pivotToFrontPx - CHAIR.guardPx)}" y="${num(-halfW)}" width="${num(CHAIR.guardPx)}" height="${num(CHAIR.widthPx)}" rx="2"` +
      // ⚠️ 6.5 — 가드 테두리·머리 점도 차체 테두리와 **같은 선 색**이다(m.stroke). 여기만
      // OBJ_STROKE 로 되돌리면 밝은 차체에서 한 칩 안에 보이는 선과 안 보이는 선이 섞인다.
      ` fill="${m.guardFill}" stroke="${m.stroke}" stroke-width="1.4"/>` +
      `<circle cx="0" cy="0" r="4.2" fill="${m.stroke}"/>` +
      `</g>`;
  }
  return out;
}

function ballsMarkup(frame: RenderFrame): string {
  let out = '';
  for (const b of frame.balls) {
    if (b.opacity <= 0) continue;
    out +=
      `<g id="obj-${safeId(b.id)}" transform="${poseTransform(b.x, b.y)}"${attrOpacity(b.opacity)}>` +
      `<circle cx="0" cy="0" r="${num(BALL.viewRadiusPx)}" fill="${BALL_FILL}" stroke="#ffffff" stroke-width="2.4"/>` +
      `</g>`;
  }
  return out;
}

/** 메모 = 종이 쪽지(§4.3 P1-5, 1.9 에서 4겹으로 고쳤다). 글자는 캔버스가 얹지만 **쪽지 자체는
 *  그림에 남는다** — 빈 메모라도 "여기 쪽지를 놓았다" 는 판의 사실이기 때문이다. */
function notesMarkup(frame: RenderFrame): string {
  let out = '';
  for (const n of frame.notes) {
    if (n.opacity <= 0) continue;
    const size = n.size ?? NOTE_DEFAULT_SIZE_PX;
    const halfW = noteHalfWidth(n.text, size);
    const halfH = noteChipHeightPx(n.text, size) / 2;
    out +=
      `<g id="obj-${safeId(n.id)}" transform="${poseTransform(n.x, n.y)}"${attrOpacity(n.opacity)}>` +
      `<path d="${noteChipPathD(halfW, halfH)}" fill="${NOTE_FILL}" stroke="${OBJ_STROKE}" stroke-width="1.4" stroke-linejoin="round"/>` +
      `<path d="${noteFoldPathD(halfW, halfH)}" fill="${NOTE_FOLD_FILL}" stroke="${OBJ_STROKE}" stroke-width="1.4" stroke-linejoin="round"/>` +
      `</g>`;
  }
  return out;
}

/** 캡션 띠. 흰 배경일 때는 전면 흰 사각형이 이미 깔려 있으므로 띠를 따로 칠하지 않는다.
 *  투명 배경일 때만 먹색 띠를 깔아 흰 글자가 어떤 바탕에서도 읽히게 한다(staticSceneLayout 근거). */
function captionMarkup(opts: StaticSceneOpts, m: SceneMetrics): string {
  if (!opts.caption || m.captionH === 0) return '';
  if ((opts.background ?? 'white') === 'white') return '';
  return `<rect x="0" y="${num(m.vbH)}" width="${num(m.vbW)}" height="${num(m.captionH)}" fill="${CAPTION_BAND_FILL}"/>`;
}

/** 이 장면의 화살표에 실제로 쓰인 색만 마커로 만든다(§6.6) — 안 쓰는 마커를 굽지 않는다. */
function usedArrowColors(frame: RenderFrame): string[] {
  const set = new Set<string>();
  for (const a of frame.arrows) {
    if (a.opacity <= 0) continue;
    // arrowsMarkup 과 **한 글자도 다르지 않은** 식이어야 한다 — 여기서 만든 마커 id 를
    // 그쪽이 `marker-end` 로 참조하므로, 갈라지면 화살촉이 통째로 사라진다.
    set.add(safeColor(a.color, arrowColor(a)));
  }
  return Array.from(set);
}

/** ★ 이 항목의 본체. 프레임 하나를 **자립 SVG 문자열**로 굽는다.
 *
 *  자립(self-contained)의 뜻: 외부 CSS·폰트·이미지를 **하나도** 참조하지 않는다. 그래서
 *  파일로 따로 열어도, `<img>` 에 물려 캔버스에 그려도 화면과 같은 그림이 나온다. */
export function buildStaticSvg(frame: RenderFrame, opts: StaticSceneOpts): string {
  const m = staticSceneMetrics(opts);
  const bg = opts.background ?? 'white';
  const markers = arrowMarkersMarkup(usedArrowColors(frame));

  return (
    // ★[A-10] width/height 명시. viewBox 만 있으면 <img> 내재 크기가 불확정이라 브라우저마다
    //   기본 300×150 으로 그려져 PNG 가 뭉개진다.
    `<svg xmlns="http://www.w3.org/2000/svg" width="${m.widthPx}" height="${m.heightPx}" viewBox="0 0 ${num(m.vbW)} ${num(m.totalH)}">` +
    `<defs>${markers}</defs>` +
    (bg === 'white' ? `<rect x="0" y="0" width="${num(m.vbW)}" height="${num(m.totalH)}" fill="#ffffff"/>` : '') +
    `<rect x="0" y="0" width="${num(m.vbW)}" height="${num(m.vbH)}" rx="${EXPORT_LAYOUT.courtRx}" fill="${COURT_BG}"/>` +
    // §3.5 표준 z-order: 코트면 → 격자 → 진영 → 규칙존·링 → 도형 → 콘 → 화살표 → 휠체어 → 공 → 메모.
    //
    // 진영 깃발이 규칙 표시 **아래**인 것은 화면(CourtStage: RuleZones → SideMarks → RuleOverlay)
    // 을 따른 것이다. 존은 코트 안, 깃발은 골라인 밖이라 둘은 애초에 안 겹치고, 실제로 겹칠 수
    // 있는 것은 공의 3 m 링뿐인데 화면에서도 링이 깃발을 덮는다.
    // 도형은 **코트 위·개체 아래**다(기현 지시 2026-08-14, ShapeLayer.tsx 머리말).
    courtLinesMarkup(opts.mode, opts.size) +
    gridMarkup(opts) +
    sideMarksMarkup(opts) +
    ruleMarkup(frame, opts) +
    shapesMarkup(opts.shapes ?? []) +
    conesMarkup(frame) +
    arrowsMarkup(frame) +
    chairsMarkup(frame, opts) +
    ballsMarkup(frame) +
    notesMarkup(frame) +
    captionMarkup(opts, m) +
    `</svg>`
  );
}

/** SVG + 글자 배치 + 출력 크기를 한 번에. 래스터 어댑터(rasterize.ts)와 4.5/4.7 이 쓴다 —
 *  둘을 따로 부르면 옵션이 어긋나 **글자만 다른 자리에 찍히는** 사고가 열린다. */
export interface StaticScene {
  svg: string;
  texts: TextPlacement[];
  metrics: SceneMetrics;
}

export function buildStaticScene(frame: RenderFrame, opts: StaticSceneOpts): StaticScene {
  return {
    svg: buildStaticSvg(frame, opts),
    texts: buildTextPlacements(frame, opts),
    metrics: staticSceneMetrics(opts),
  };
}
