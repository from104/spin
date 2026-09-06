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
import { ARROW_CASING, BALL_FILL, CONE_COLORS, COURT_BG, GOAL_BASE_FILL, GOAL_POST_EDGE, GOAL_POST_FILL, NOTE_FILL, NOTE_FOLD_FILL, OBJ_STROKE } from '../../core/colors.ts';
import { BALL, CHAIR } from '../../core/constants.ts';
import { CONE_BASE_D, CONE_STROKE_W, CONE_TRIANGLE_D } from '../../render/objects/coneGeom.ts';
import { attackDir, courtDefFor, goalBaseRect, goalMouths, SPOT_CROSS_HALF_PX } from '../../model/court.ts';
import type { CourtDef } from '../../model/court.ts';
import { arrowPath, ARROW_STYLE, arrowColor } from '../../model/arrow.ts';
import { strokePath, strokeWidthOf } from '../../model/stroke.ts';
import { ARROW_HEAD_KINDS, STROKE_CASING_PAD, arrowHeadGeom, arrowMarkerColorKey, arrowMarkerId, type ArrowHeadKind } from '../../render/arrowHeadGeom.ts';
import { gridGeom } from '../../model/grid.ts';
import type { RenderFrame } from '../../model/playback.ts';
import { DEFAULT_TIERS, type SceneRef } from '../../model/zOrder.ts';
import type { TeamSide } from '../../model/drill.ts';
import type { Shape } from '../../model/shape.ts';
import { ballRingViolation, defaultDefense, defendedMouths, defendedZones, fiveMeterRetreat, isBallOutOfPlay, otherSide, ringRadiusPx, zoneViolation, type RuleActor } from '../../model/rules.ts';
import { COURT_LINE_WEIGHTS } from '../../render/CourtSurface.tsx';
import { GRID_INK } from '../../render/gridInk.ts';
import {
  ownerArrowPath,
  BALL_OUT_FILL,
  OWNER_ARROW_HEAD_PX,
  OWNER_ARROW_LEN_PX,
  OWNER_ARROW_OPACITY,
  OWNER_ARROW_W,
  RING_CASING_W,
  RING_MARK_W,
  RULE_ALERT_STROKE,
  RULE_CASING,
  RULE_CASING_OPACITY,
  RULE_DASH,
  RULE_OK_STROKE,
  RULE_ZONE_ALERT_FILL,
  RULE_ZONE_ALERT_FILL_OPACITY,
  RULE_ZONE_FILL,
  RULE_ZONE_FILL_OPACITY,
  ZONE_CASING_W,
  ZONE_MARK_W,
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

/** 콘 삼각형·베이스·굵기 — 화면(ConeMark)·인쇄(PrintCourt)와 **같은 파일 하나**에서 온다
 *  (`render/objects/coneGeom.ts`, 2026-09-06). 그 전에는 여기만 CONE 상수 파생이고 저 둘은
 *  리터럴이라, 콘 크기를 고치면 그림만 새 모양이 됐다. */
const CONE_TRI_D = CONE_TRIANGLE_D;

// ⚠️ 2026-09-06 — 규칙 표시의 굵기·케이싱 여섯 값이 여기 리터럴로 **두 번째** 적혀 있었다
// (*"RuleOverlay.tsx 와 같은 값이다"* 라는 주석이 동기화의 전부였다). 이제 `ruleOverlay.ts`
// 하나에서 import 한다 — 색·대시가 이미 거기 있었고, 굵기만 두 벌이던 것이 드리프트 자리였다.

const attrOpacity = (o: number): string => (o >= 1 ? '' : ` opacity="${num(o)}"`);

/** 세트피스 소유 화살표 — 화면(RuleOverlay.tsx)과 **같은 path 함수·같은 상수**를 쓴다.
 *  5 m 링이 아니거나 소유가 없거나 방향을 모르면(플랫) 빈 문자열이다. */
function ownerArrowMarkup(ring: string | undefined, owner: TeamSide | undefined, degs: Record<TeamSide, number> | null): string {
  if (ring !== '5m' || owner === undefined || degs === null) return '';
  const d = ownerArrowPath(OWNER_ARROW_LEN_PX, OWNER_ARROW_HEAD_PX);
  return (
    `<g transform="rotate(${num(degs[owner])})" opacity="${OWNER_ARROW_OPACITY}">` +
    `<path d="${d}" fill="none" stroke="${RULE_OK_STROKE}" stroke-width="${OWNER_ARROW_W}" stroke-linecap="round" stroke-linejoin="round"/>` +
    `</g>`
  );
}

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

/** 골대 받침판 + 기둥. 편집기와 달리 여기는 물리 바디가 없으므로 `present` 처럼 정적으로
 *  그린다. 받침판 기하는 `model/court.ts` 의 `goalBaseRect` 하나에서 온다 — 화면(GoalPostMarks)·
 *  편집기(GoalPost)와 같은 자를 쓰므로 내보낸 그림이 화면과 어긋날 자리가 없다.
 *  판이 **먼저**(아래 층), 기둥이 그 위, 흰 덧테가 맨 위다 — `GoalPostMarks` 와 같은 순서.
 *
 *  ⚠️ 2026-09-06 — 이 함수는 `courtLinesMarkup` **밖**에 있다. 코트 라인 안에 두면 골대가
 *  격자·규칙 존·깃발보다 아래로 깔려, 규칙 존의 흰 파선이 받침판 위를 가로지른다(기현 지시:
 *  *"골대 밑판 위에 코트 라인이 보임"*). 편집 화면은 골대를 개체 층에서 그려 규칙 표시보다
 *  위에 두므로, 조립도 그 자리(ruleMarkup 뒤)로 맞췄다 — `buildStaticSvg` 아래쪽 참고.
 *  ⚠️ 받침판에 `stroke="none"` 을 명시하는 이유도 같은 신고다: 그룹의 주황 stroke 는 기둥
 *  원의 것인데 상속으로 판까지 두르고 있었다(편집기의 판은 처음부터 테가 없다). */
export function goalPostsMarkup(def: CourtDef): string {
  const posts = def.goalPosts;
  if (posts.length === 0) return '';
  const bases = posts
    .map((_p, i) => goalBaseRect(def, i))
    .filter((b): b is NonNullable<typeof b> => b !== null)
    .map((b) => `<rect x="${num(b.x)}" y="${num(b.y)}" width="${num(b.w)}" height="${num(b.h)}" fill="${GOAL_BASE_FILL}" stroke="none"/>`)
    .join('');
  return (
    `<g fill="${GOAL_POST_FILL}" stroke="${GOAL_POST_EDGE}" stroke-width="${num(W.spotSw!)}">` +
    bases +
    posts.map((p) => `<circle cx="${num(p.x)}" cy="${num(p.y)}" r="${num(W.spotR!)}"/>`).join('') +
    // 흰 덧테 — 편집 화면의 골대가 달고 있던 후광(GoalPost.tsx). 정적 경로에만 짝이 없었다.
    posts.map((p) => `<circle cx="${num(p.x)}" cy="${num(p.y)}" r="${num(W.spotR!)}" fill="none" stroke="${OBJ_STROKE}" stroke-width="0.4"/>`).join('') +
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
      // ⚠️ 2026-09-06 — 여기 있던 `goalPostsMarkup(def)` 를 뺐다. 화면 컴포넌트
      // (Half/FullCourtLines)도 같은 커밋에서 뺐으므로 이 손 이식본은 여전히 그쪽과 같다 —
      // 골대는 규칙 표시 뒤(개체 앞)에서 그린다(goalPostsMarkup 머리말).
      `<g fill="none" stroke="#ffffff" stroke-width="${num(W.goalCross!)}" stroke-linecap="round">${goalCrossD(def.spotMarks)}</g>`
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
    `<g fill="none" stroke="#ffffff" stroke-width="${num(W.goalCross!)}" stroke-linecap="round">${goalCrossD(def.spotMarks)}</g>`
  );
}

/** 화살촉 마커. ArrowMarkers.tsx 와 **id 규약·모양이 같아야 한다** — 다르면 화살촉이 사라진다.
 *  케이싱을 먼저 그리는 이유도 그쪽과 같다(#38bdf8 는 코트 대비 2.49:1 로 WCAG 1.4.11 미달). */
/** 화살촉 기하는 **화면과 같은 함수**에서 온다(render/arrowHeadGeom.ts). 예전에는 리터럴을
 *  양쪽에 적어 두고 `courtLines.contract.test` 가 대조했는데, 획이 굵기 축을 들여오면서
 *  경우의 수가 (색 × 굵기 × 종류)로 늘었다 — 그 표를 손으로 두 벌 적는 것은 드리프트를
 *  기다리는 일이다. 대조 테스트는 그대로 남는다(이제 같은 함수를 부르는지까지 확인한다). */
type ExportHead = ArrowHeadKind;

/** 양 끝 화살촉 속성. 'none' 이면 그 속성 자체를 안 쓴다 — 빈 url(#…) 은 SVG 가 무시하지만
 *  문자열에 남으면 대조 테스트가 화면 컴포넌트와 어긋난다. */
function headAttr(
  a: { headFrom?: ExportHead | 'none'; headTo?: ExportHead | 'none' },
  color: string,
  lineWidth: number = ARROW_STYLE.width,
  /** 화살표는 끝 촉 기본이 'thin', 획은 'none' 이다(PLAN 결정 5) — 그 하나만 다르다. */
  headToDefault: ExportHead | 'none' = 'thin',
): string {
  const f = a.headFrom ?? 'none';
  const t = a.headTo ?? headToDefault;
  const id = (k: ExportHead): string => arrowMarkerId(MARKER_UID, markerKey(color), k, lineWidth);
  return (
    (f === 'none' ? '' : ` marker-start="url(#${id(f)})"`) +
    (t === 'none' ? '' : ` marker-end="url(#${id(t)})"`)
  );
}

export function arrowMarkersMarkup(colors: readonly string[], widths?: readonly number[]): string {
  // 화살표 굵기는 **언제나** 만든다 — ArrowMarkers 와 같은 이유(획이 없거나 전부 다른 굵기인
  // 스텝에서 화살표가 참조할 마커가 사라진다).
  const ws = Array.from(new Set([ARROW_STYLE.width, ...(widths ?? [])]));
  const marker = (fill: string, k: ExportHead, w: number): string => {
    const g = arrowHeadGeom(k, w);
    return (
      `<marker id="${arrowMarkerId(MARKER_UID, markerKey(fill), k, w)}" markerWidth="${g.markerWidth}" markerHeight="${g.markerHeight}" refX="${g.refX}" refY="${g.refY}" orient="auto-start-reverse">` +
      `<path d="${g.d}" fill="${fill}" stroke="${ARROW_CASING}" stroke-width="${num(g.casingWidth)}" stroke-linejoin="round"/>` +
      `</marker>`
    );
  };
  // 케이싱 전용 마커는 없다 — 화살촉의 대비는 위 stroke 가 맡는다(ArrowMarkers 와 같은 근거).
  return colors.flatMap((c) => ws.flatMap((w) => ARROW_HEAD_KINDS.map((k) => marker(c, k, w)))).join('');
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
  for (const s of shapes) out += shapeMarkup(s);
  return out;
}

/** 도형 **한 장**. z-order 가 도형을 다른 개체 사이에 끼울 수 있게 되면서(2026-09-06) 한 장씩
 *  굽는 자리가 필요해졌다 — 위 `shapesMarkup` 은 이것을 여러 번 부르는 껍데기다. */
function shapeMarkup(s: Shape): string {
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
  return `<g id="obj-${safeId(s.id)}" transform="translate(${s.x} ${s.y}) rotate(${s.rot})">${body}</g>`;
}

/** 격자 — 이 함수는 **선만** 굽는다. 칸 번호는 글자라 SVG 에 넣지 않고(★[A-9]) 래스터
 *  어댑터가 캔버스에 그린다(`staticSceneLayout.ts` 의 `buildTextPlacements`, 2026-09-06).
 *  좌표는 `gridGeom` 하나에서 온다(GridOverlay 와 같은 출처). */
/** 격자 선. ⚠️ 인쇄는 이 함수를 쓰지 않는다 — 종이에서는 잉크(대비)가 달라야 해서 화면
 *  컴포넌트(`GridOverlay`)를 인쇄 variant 로 쓴다. 좌표는 양쪽 다 `gridGeom` 파생이다. */
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
  // ⚠️ 2026-09-06 — 불투명도가 여기 리터럴(0.22/0.34)로 **두 번째** 적혀 있었다. 값은
  // `render/gridInk.ts` 하나에서 온다(화면 GridOverlay 와 같은 출처). PNG 는 종이가 아니라
  // 화면의 대체물이므로 `screen` 쪽을 읽는다 — 인쇄만 진한 잉크를 쓴다.
  let out = `<g stroke="#ffffff" stroke-width="1" opacity="${num(GRID_INK.screen.line)}" shape-rendering="crispEdges">${lines(g.inner.vx, g.inner.hy)}</g>`;
  if (g.major)
    out += `<g stroke="#ffffff" stroke-width="1" opacity="${num(GRID_INK.screen.major)}" shape-rendering="crispEdges">${lines(g.major.vx, g.major.hy)}</g>`;
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
/** 규칙 오버레이(골 지역 존·위반 표시·공 거리 링·세트피스 소유 화살표)를 한 번에 굽는다.
 *
 *  ⚠️ **PNG 전용이 아니다** — 인쇄(features/print/PrintCourt.tsx)도 이 함수를 지난다. 화면의
 *  `RuleOverlay` 는 좌표를 rAF writer 가 DOM 에 직접 쓰는 구조라 정적 렌더에서는 링이 전부
 *  원점에 겹친다(PrintCourt.tsx 머리말 ①). 그래서 "한 장면을 한 번 그리는" 경로는 전부
 *  이쪽으로 온다. 새 규칙 표시를 더할 때 **여기 하나만 고치면 두 경로가 같이 따라온다.** */
export function ruleMarkup(frame: RenderFrame, opts: StaticSceneOpts): string {
  const def = courtDefFor(opts.mode, opts.size);
  const actors = ruleActors(frame);
  // 진영을 입힌 골 지역. 화면(RuleOverlay)과 **같은 함수**를 지나야 PNG 만 다른 팀을 칠하는 일이 없다.
  const side = opts.defense ?? defaultDefense(opts.mode);
  const zones = defendedZones(def.ruleZones, side);
  // 세트피스 5 m 제한(2026-08-17) — 골키퍼 면제 자리와 제한받는 팀. 화면(RuleOverlay.tsx)이
  // 만드는 것과 **같은 두 값**이다. 플랫 코트는 골대가 없어 규칙 자체가 꺼진다.
  const mouths = defendedMouths(goalMouths(def), side);
  const fiveDefense = def.goalPosts.length === 0 ? null : side;
  // 소유 화살표 방향 — 코트당 한 번. `attackDir(def,0)` 은 진영 팀의 공격 방향이라 상대는 반대다.
  const ownerDegOf = ((): Record<TeamSide, number> | null => {
    const d = attackDir(def, 0);
    if (!d) return null;
    const deg = (Math.atan2(d.y, d.x) * 180) / Math.PI;
    return { [side]: deg, [otherSide(side)]: deg + 180 } as Record<TeamSide, number>;
  })();
  // §7 5.2(2026-08-13) — **조기 반환을 여기서 뺐다.** 개별 공의 원은 사용자가 그 공을 눌러
  // 명시적으로 켠 것이라 규칙 존 스위치와 다른 축이다(화면 RuleOverlay.tsx 와 같은 판단) —
  // `showRuleZones` 가 꺼져 있어도 PNG 에 실린다. 존 위반 표시만 스위치에 매인다.
  //
  // ⚠️ 2026-09-06 — 이 함수는 **연한 존 자체(`ruleZonesMarkup`)를 더 이상 굽지 않는다.**
  //    그 전에는 여기서도 굽고 인쇄(PrintCourt)가 `<RuleZones>` 로도 그려 **종이에만 두 겹**
  //    이었다(fill-opacity .22 두 겹 ≈ .39 — 화면보다 확연히 진했다). 게다가 존이 이 함수
  //    안에 있으면 존이 **규칙 표시와 같은 층**이 되어, 화면의 순서(격자 → 존 → 깃발 → 규칙
  //    표시)를 정적 경로가 흉내낼 수 없었다. 이제 존은 호출부가 깃발 **앞**에서 한 번 그린다:
  //    PNG 는 `buildStaticSvg` 의 조립, 인쇄는 `<RuleZones>` 컴포넌트다.
  let out = '';

  for (const [zi, dz] of (opts.showRuleZones ? zones : []).entries()) {
    // 화면(render/ruleOverlay.ts)과 **같은 인자**로 잰다 — 골 뒤로 완전히 나간 수비를 인원에
    // 세는 판정(2026-08-27)이 여기서 빠지면 판은 붉은데 그림만 깨끗해진다.
    if (zoneViolation(dz, actors, mouths[zi]) === 0) continue;
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
    // 어느 규칙으로 재는지는 **원이 정한다**(model/rules.ts 의 `ruleForRing`): 3 m·없음은
    // 2-on-1, 5 m 는 세트피스 5 m 제한이다. 화면(render/ruleOverlay.ts)과 **같은 함수**를
    // 지나므로 PNG 만 다른 규칙으로 붉어질 자리가 없다 — ⚠️ 여기서 `ringViolation` 을 직접
    // 부르면 5 m 원을 켠 공이 그림에서만 2-on-1 로 판정된다.
    // 스위치가 꺼져 있으면 화면과 같이 판정도 서지 않으므로 흰 파선 그대로 나간다.
    // 5 m 를 물러날 팀은 **공마다** 다르다 — 그 공을 차는 팀의 반대다. 화면
    // (render/ruleOverlay.ts)과 같은 함수를 지나므로 PNG 만 반대 팀을 붉히는 일이 없다.
    const retreat = fiveMeterRetreat(b.owner, fiveDefense);
    const bad = (opts.showRuleZones ?? false) && ballRingViolation(b.ring ?? 'none', b, actors, zones, mouths, retreat) !== 0;
    const stroke = bad ? RULE_ALERT_STROKE : RULE_OK_STROKE;
    const dash = bad ? '' : ` stroke-dasharray="${RULE_DASH}"`;
    out +=
      `<g transform="${poseTransform(b.x, b.y)}"${attrOpacity(b.opacity)}>` +
      `<circle r="${num(r)}" fill="none" stroke="${RULE_CASING}" stroke-width="${RING_CASING_W}" opacity="${RULE_CASING_OPACITY}"/>` +
      `<circle r="${num(r)}" fill="none" stroke="${stroke}" stroke-width="${RING_MARK_W}"${dash}/>` +
      // 세트피스 소유 화살표 — 화면(RuleOverlay.tsx)과 **같은 path 함수**를 쓴다. 모양을 여기
      // 다시 적으면 판 크기·화살촉을 고친 날 그림에서만 어긋난다(§sideFlags 와 같은 교훈).
      ownerArrowMarkup(b.ring, b.owner, ownerDegOf) +
      `</g>`;
  }
  return out;
}

/** 콘 — 슬롯 0 은 삼각형, 슬롯 1 은 삼각형 + 밑변 베이스(색이 아니라 실루엣으로 구분). */
function coneMarkup(c: RenderFrame['cones'][number]): string {
  if (c.opacity <= 0) return '';
  const fill = CONE_COLORS[c.colorIndex];
  return (
    `<g id="obj-${safeId(c.id)}" transform="${poseTransform(c.x, c.y)}"${attrOpacity(c.opacity)}>` +
    `<path d="${CONE_TRI_D}" fill="${fill}" stroke="${OBJ_STROKE}" stroke-width="${CONE_STROKE_W}"/>` +
    (c.colorIndex === 1 ? `<path d="${CONE_BASE_D}" fill="${fill}" stroke="${OBJ_STROKE}" stroke-width="${CONE_STROKE_W}"/>` : '') +
    `</g>`
  );
}

/** 자유 그리기 획 — 화살표와 **같은 층 구조**(케이싱 먼저, 본선 뒤에)이고, 굵기만 상수가
 *  아니라 획마다 다르다. 케이싱 여유는 굵기와 무관한 상수다(`STROKE_CASING_PAD`
 *  — 근거는 render/arrowHeadGeom.ts, 화살촉의 검은 테와 짝이 맞아야 한다).
 *
 *  ⚠️ 호출 순서가 곧 z-order 다 — 획은 기본층에서 화살표 **아래**다(근거는
 *     render/ObjectLayer.tsx 머리말). ⚠️ 2026-09-06: 그 순서는 이제 이 파일이 정하지 않고
 *     `sceneMarkup` 이 받은 `order`(= `model/zOrder.ts` 의 `sceneOrder`)가 정한다. */
function strokeMarkup(s: RenderFrame['strokes'][number]): string {
  if (s.opacity <= 0) return '';
  const d = strokePath(s);
  if (d === '') return ''; // 점이 없는 획은 그릴 것이 없다(validate 가 걸러도 방어)
  const w = strokeWidthOf(s);
  const color = safeColor(s.color, ARROW_STYLE.color);
  return (
    `<g id="obj-${safeId(s.id)}"${attrOpacity(s.opacity)}>` +
    `<path d="${d}" fill="none" stroke="${ARROW_CASING}" stroke-width="${num(w + STROKE_CASING_PAD)}" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="${d}" fill="none" stroke="${color}" stroke-width="${num(w)}" stroke-linecap="round" stroke-linejoin="round"${headAttr(s, color, w, 'none')}/>` +
    `</g>`
  );
}

/** 화살표 — 케이싱(검정 halo)을 먼저, 본선을 뒤에. `#38bdf8` 는 코트 대비 2.49:1 로 WCAG
 *  1.4.11 미달이라 케이싱이 없으면 시각 대비 요건을 못 채운다(ArrowPath.tsx 와 같은 근거). */
function arrowMarkup(a: RenderFrame['arrows'][number]): string {
  if (a.opacity <= 0) return '';
  const d = arrowPath(a);
  const style = ARROW_STYLE;
  const color = safeColor(a.color, ARROW_STYLE.color);
  return (
    `<g id="obj-${safeId(a.id)}"${attrOpacity(a.opacity)}>` +
    `<path d="${d}" fill="none" stroke="${ARROW_CASING}" stroke-width="${num(style.width + 2.4)}" stroke-linecap="round"/>` +
    `<path d="${d}" fill="none" stroke="${color}" stroke-width="${num(style.width)}" stroke-linecap="round"${headAttr(a, color)}/>` +
    `</g>`
  );
}

/** ArrowMarkers 가 만드는 id 규약(`${uid}-${color.slice(1)}`) 그대로. 색이 `#` 로 시작하지
 *  않으면(이름색) slice 가 앞 글자를 먹으므로 그때만 다르게 접는다 — 두 곳이 어긋나면
 *  화살촉이 통째로 사라진다. */
function markerKey(color: string): string {
  return safeId(arrowMarkerColorKey(color));
}

/** 휠체어 — 차체 · 볼가드 · 머리(피벗). 등번호는 여기 없다(★[A-9] 캔버스가 그린다).
 *  팀을 구분하는 값은 전부 `teamMarkFor` 하나에서 온다(4.6 이 파선·가드 톤까지 거기 모았다).
 *  ⚠️ `stroke-dasharray` 와 볼가드 `fill` 을 여기서 리터럴로 되돌리면 흑백 인쇄에서 두 팀이
 *  다시 같아진다 — src/render/teamMark.ts 머리말의 근거 참고. */
function chairMarkup(c: RenderFrame['chairs'][number], opts: StaticSceneOpts): string {
  if (c.opacity <= 0) return '';
  const halfW = CHAIR.widthPx / 2;
  const m = teamMarkFor(c.def, opts.teams);
  const dash = m.strokeDash ? ` stroke-dasharray="${m.strokeDash}"` : '';
  return (
    `<g id="obj-${safeId(c.id)}" transform="${poseTransform(c.x, c.y, c.theta)}"${attrOpacity(c.opacity)}>` +
    `<rect x="${num(-CHAIR.pivotToRearPx)}" y="${num(-halfW)}" width="${num(CHAIR.lengthPx)}" height="${num(CHAIR.widthPx)}" rx="5"` +
    ` fill="${safeColor(m.fill, '#888888')}" stroke="${m.stroke}" stroke-width="${num(m.strokeWidth)}"${dash}/>` +
    `<rect x="${num(CHAIR.pivotToFrontPx - CHAIR.guardPx)}" y="${num(-halfW)}" width="${num(CHAIR.guardPx)}" height="${num(CHAIR.widthPx)}" rx="2"` +
    // ⚠️ 6.5 — 가드 테두리·머리 점도 차체 테두리와 **같은 선 색**이다(m.stroke). 여기만
    // OBJ_STROKE 로 되돌리면 밝은 차체에서 한 칩 안에 보이는 선과 안 보이는 선이 섞인다.
    ` fill="${m.guardFill}" stroke="${m.stroke}" stroke-width="1.4"/>` +
    `<circle cx="0" cy="0" r="4.2" fill="${m.stroke}"/>` +
    `</g>`
  );
}

/** 공의 **채움색**. 아웃오브플레이(Law 9)면 붉다 — 화면(render/ruleOverlay.ts 의 `judge`)과
 *  **같은 판정 함수·같은 두 색**을 지난다.
 *
 *  ⚠️ 2026-09-06 — 그 전에는 PNG·인쇄가 언제나 `BALL_FILL` 이었다. 판에서 붉게 나간 공이
 *  종이·그림에서는 평범한 공이었다는 뜻이다(기현 지시로 시작한 경로 대조에서 나온 것).
 *  스위치(`showRuleZones`)에 매다는 것도 화면과 같다: 화면 writer 는 `ctx.enabled` 가 거짓이면
 *  판정을 아예 세우지 않으므로, 규칙 표시를 끈 판에서는 공이 노란색 그대로다.
 *  **인쇄도 이 함수를 부른다**(PrintCourt) — 두 정적 경로가 같은 한 줄을 지나야 한다. */
export function staticBallFill(opts: Pick<StaticSceneOpts, 'mode' | 'size' | 'showRuleZones'>, ball: { x: number; y: number }): string {
  if (opts.showRuleZones !== true) return BALL_FILL;
  const def = courtDefFor(opts.mode, opts.size);
  return isBallOutOfPlay(opts.mode, def.surface, ball, BALL.viewRadiusPx) ? BALL_OUT_FILL : BALL_FILL;
}

function ballMarkup(b: RenderFrame['balls'][number], opts: StaticSceneOpts): string {
  if (b.opacity <= 0) return '';
  return (
    `<g id="obj-${safeId(b.id)}" transform="${poseTransform(b.x, b.y)}"${attrOpacity(b.opacity)}>` +
    `<circle cx="0" cy="0" r="${num(BALL.viewRadiusPx)}" fill="${staticBallFill(opts, b)}" stroke="#ffffff" stroke-width="2.4"/>` +
    `</g>`
  );
}

/** 메모 = 종이 쪽지(§4.3 P1-5, 1.9 에서 4겹으로 고쳤다). 글자는 캔버스가 얹지만 **쪽지 자체는
 *  그림에 남는다** — 빈 메모라도 "여기 쪽지를 놓았다" 는 판의 사실이기 때문이다. */
function noteMarkup(n: RenderFrame['notes'][number]): string {
  if (n.opacity <= 0) return '';
  const size = n.size ?? NOTE_DEFAULT_SIZE_PX;
  const halfW = noteHalfWidth(n.text, size);
  const halfH = noteChipHeightPx(n.text, size) / 2;
  return (
    `<g id="obj-${safeId(n.id)}" transform="${poseTransform(n.x, n.y)}"${attrOpacity(n.opacity)}>` +
    `<path d="${noteChipPathD(halfW, halfH)}" fill="${NOTE_FILL}" stroke="${OBJ_STROKE}" stroke-width="1.4" stroke-linejoin="round"/>` +
    `<path d="${noteFoldPathD(halfW, halfH)}" fill="${NOTE_FOLD_FILL}" stroke="${OBJ_STROKE}" stroke-width="1.4" stroke-linejoin="round"/>` +
    `</g>`
  );
}

/** ★ 개체 7종을 **한 목록**으로 굽는다(아래→위). 판·시연·인쇄와 **같은 함수**(`sceneOrder`)가
 *  만든 순서를 그대로 받는다 — 여기서 정렬을 다시 짜면 그림만 다른 판이 된다.
 *
 *  ⚠️ `order` 를 안 넘기는 호출부(옛 배선·테스트)는 `DEFAULT_TIERS` 기본층으로 접힌다.
 *  ⚠️ 순서가 모르는 개체(스텝 전환 프레임이 실어 보낸 이전 스텝의 화살표·메모 등)는 버리지
 *     않고 기본층 순서대로 맨 위에 붙인다 — 떨어뜨리면 그림에서 통째로 사라진다. */
function sceneMarkup(frame: RenderFrame, opts: StaticSceneOpts, order?: readonly SceneRef[]): string {
  const shapes = opts.shapes ?? [];
  const shapeById = new Map(shapes.map((sh) => [sh.id as string, sh]));
  const coneById = new Map(frame.cones.map((c) => [c.id as string, c]));
  const strokeById = new Map(frame.strokes.map((st) => [st.id as string, st]));
  const arrowById = new Map(frame.arrows.map((a) => [a.id as string, a]));
  const chairById = new Map(frame.chairs.map((c) => [c.id as string, c]));
  const ballById = new Map(frame.balls.map((b) => [b.id as string, b]));
  const noteById = new Map(frame.notes.map((n) => [n.id as string, n]));

  const one = (r: SceneRef): string | null => {
    switch (r.kind) {
      case 'shape': {
        const sh = shapeById.get(r.id);
        return sh ? shapeMarkup(sh) : null;
      }
      case 'cone': {
        const c = coneById.get(r.id);
        return c ? coneMarkup(c) : null;
      }
      case 'stroke': {
        const st = strokeById.get(r.id);
        return st ? strokeMarkup(st) : null;
      }
      case 'arrow': {
        const a = arrowById.get(r.id);
        return a ? arrowMarkup(a) : null;
      }
      case 'chair': {
        const c = chairById.get(r.id);
        return c ? chairMarkup(c, opts) : null;
      }
      case 'ball': {
        const b = ballById.get(r.id);
        return b ? ballMarkup(b, opts) : null;
      }
      case 'note': {
        const n = noteById.get(r.id);
        return n ? noteMarkup(n) : null;
      }
    }
  };

  const placed = new Set<string>();
  let out = '';
  const push = (r: SceneRef): void => {
    if (placed.has(r.id)) return;
    const m = one(r);
    if (m === null) return;
    placed.add(r.id);
    out += m;
  };
  for (const r of order ?? []) push(r);
  for (const kind of DEFAULT_TIERS) {
    switch (kind) {
      case 'shape':
        for (const sh of shapes) push({ kind, id: sh.id });
        break;
      case 'cone':
        for (const c of frame.cones) push({ kind, id: c.id });
        break;
      case 'stroke':
        for (const st of frame.strokes) push({ kind, id: st.id });
        break;
      case 'arrow':
        for (const a of frame.arrows) push({ kind, id: a.id });
        break;
      case 'chair':
        for (const c of frame.chairs) push({ kind, id: c.id });
        break;
      case 'ball':
        for (const b of frame.balls) push({ kind, id: b.id });
        break;
      case 'note':
        for (const n of frame.notes) push({ kind, id: n.id });
        break;
    }
  }
  return out;
}

/** 캡션 띠. 검정 배경일 때는 전면 검정 사각형이 이미 깔려 있으므로 띠를 따로 칠하지 않는다.
 *  투명 배경일 때만 먹색 띠를 깔아 흰 글자가 어떤 바탕에서도 읽히게 한다(staticSceneLayout 근거). */
function captionMarkup(opts: StaticSceneOpts, m: SceneMetrics): string {
  if (!opts.caption || m.captionH === 0) return '';
  if ((opts.background ?? 'black') === 'black') return '';
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
  // 획도 같은 마커를 참조한다(strokesMarkup 의 `headAttr`) — 같은 식이어야 하는 이유도 같다.
  for (const s of frame.strokes) {
    if (s.opacity <= 0) continue;
    set.add(safeColor(s.color, ARROW_STYLE.color));
  }
  return Array.from(set);
}

/** 이 장면의 획이 실제로 쓴 굵기만 마커로 만든다 — 색과 같은 규율(안 쓰는 마커를 굽지 않는다). */
function usedStrokeWidths(frame: RenderFrame): number[] {
  const set = new Set<number>();
  for (const s of frame.strokes) {
    if (s.opacity <= 0) continue;
    set.add(strokeWidthOf(s));
  }
  return Array.from(set);
}

/** ★ 이 항목의 본체. 프레임 하나를 **자립 SVG 문자열**로 굽는다.
 *
 *  자립(self-contained)의 뜻: 외부 CSS·폰트·이미지를 **하나도** 참조하지 않는다. 그래서
 *  파일로 따로 열어도, `<img>` 에 물려 캔버스에 그려도 화면과 같은 그림이 나온다. */
export function buildStaticSvg(frame: RenderFrame, opts: StaticSceneOpts, order?: readonly SceneRef[]): string {
  const m = staticSceneMetrics(opts);
  const bg = opts.background ?? 'black';
  const markers = arrowMarkersMarkup(usedArrowColors(frame), usedStrokeWidths(frame));

  return (
    // ★[A-10] width/height 명시. viewBox 만 있으면 <img> 내재 크기가 불확정이라 브라우저마다
    //   기본 300×150 으로 그려져 PNG 가 뭉개진다.
    `<svg xmlns="http://www.w3.org/2000/svg" width="${m.widthPx}" height="${m.heightPx}" viewBox="0 0 ${num(m.vbW)} ${num(m.totalH)}">` +
    `<defs>${markers}</defs>` +
    // 배경 — 기현 지시 2026-08-17 로 흰색에서 **검정**이 됐다. 코트는 아래에서 둥근 모서리로
    // 그려지므로 이 사각형이 보이는 곳은 **네 모서리 바깥과 캡션 띠**다. 캡션 글자가 흰색인
    // 것도 같은 지시다(staticSceneLayout 의 CAPTION_INK).
    (bg === 'black' ? `<rect x="0" y="0" width="${num(m.vbW)}" height="${num(m.totalH)}" fill="#000000"/>` : '') +
    `<rect x="0" y="0" width="${num(m.vbW)}" height="${num(m.vbH)}" rx="${EXPORT_LAYOUT.courtRx}" fill="${COURT_BG}"/>` +
    // §3.5 표준 z-order: 코트면 → 격자 → **규칙 존** → 진영 깃발 → 규칙 표시 → **골대** →
    // 개체 목록. 편집 화면(CourtStage: CourtSurface → GridOverlay → RuleZones → SideMarks →
    // RuleOverlay → ObjectLayer[골대 → 개체])과 **한 칸도 다르지 않다.**
    //
    // ⚠️ 2026-09-06 — 그 전 주석은 *"진영 깃발이 규칙 표시 아래인 것은 화면을 따른 것"* 이라고
    //    적었지만 **코드는 그렇지 않았다**: 깃발이 `ruleMarkup`(존을 함께 굽던) 앞이라 화면의
    //    `RuleZones → SideMarks` 가 뒤집혀 있었다. 존을 `ruleMarkup` 에서 떼어 여기로 올리면서
    //    그 문장이 비로소 참이 된다. 골대도 같은 날 `courtLinesMarkup` 에서 떼어 규칙 표시
    //    뒤로 옮겼다(기현 지시: *"골대 밑판 위에 코트 라인이 보임"*).
    //    이 순서를 네 경로에서 함께 재는 것은 `render/courtFurniture.order.test.tsx` 다.
    //
    // ⚠️ 2026-09-06 — 개체 7종(도형 포함)의 순서는 더 이상 이 호출 순서가 아니라 `order`
    //    (= `model/zOrder.ts` 의 `sceneOrder(step, cast)`)가 정한다. 안 넘기면 기본층이고,
    //    기본층은 도형 → 콘 → 획 → 화살표 → 휠체어 → 공 → 메모다(2026-08-14 지시의 "도형은
    //    코트 위·개체 아래" 가 그 첫 칸으로 살아 있다).
    courtLinesMarkup(opts.mode, opts.size) +
    gridMarkup(opts) +
    (opts.showRuleZones ? ruleZonesMarkup(opts.mode, opts.size) : '') +
    sideMarksMarkup(opts) +
    ruleMarkup(frame, opts) +
    goalPostsMarkup(courtDefFor(opts.mode, opts.size)) +
    sceneMarkup(frame, opts, order) +
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

export function buildStaticScene(frame: RenderFrame, opts: StaticSceneOpts, order?: readonly SceneRef[]): StaticScene {
  return {
    svg: buildStaticSvg(frame, opts, order),
    texts: buildTextPlacements(frame, opts),
    metrics: staticSceneMetrics(opts),
  };
}
