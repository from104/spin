// §6.2 PNG — **글자의 자리**와 **출력 크기**. 순수 계산만 있다(DOM·캔버스·React 없음).
//
// ★ [A-9] 이 파일이 존재하는 이유: 내보낸 SVG 에는 `<text>` 를 **한 개도** 넣지 않는다.
//   img 컨텍스트 안 SVG 의 `@font-face` 로드는 비동기라 `img.onload` 직후 `drawImage` 해도
//   폰트가 안 실린 채 래스터되는 형태가 알려져 있고, 그러면 **등번호가 빠진 PNG** 가 나온다 —
//   코치는 그게 실패인지 알 수 없다. 한글(제목·메모)은 더 나쁘다: 저장소의 Space Grotesk
//   서브셋은 U+0000-00FF 뿐이라(fonts.css:43-61) 글리프가 통째로 빈다.
//   그래서 텍스트는 전부 **문서 컨텍스트의 캔버스**(이미 Pretendard·Space Grotesk 가 로드돼
//   있다)에서 그린다. 이 파일은 그때 필요한 것 — 문자열·중심좌표·크기·색·정렬 — 을
//   `TextPlacement[]` 로 돌려주고, 어댑터(rasterize.ts)는 그걸 그대로 `fillText` 한다.
//
//   ⚠️ 2026-09-06 — **격자 칸 번호도 이 어댑터로 그린다**(기현 지시: *"png 에 격자는 나오는데
//   격자 번호는 안 나옴"*). 위 ★[A-9]("SVG 에 <text> 0개")는 그대로 살아 있는 계약이고,
//   바뀐 것은 격자 번호가 그 계약의 **예외가 아니라 통로를 탄다**는 것뿐이다 — 등번호·메모가
//   이미 지나던 길이다. 라벨 문자열은 전부 라틴(a1… / a~t / 1~17)이라 저장소의 Space Grotesk
//   서브셋(U+0000-00FF) 안이고, 값은 화면(`render/gridInk.ts`)에서 그대로 읽는다.
//   ⚠️ 남는 차이 하나: 캔버스 글자는 `drawImage` **뒤에** 찍히므로(rasterize.ts) 격자 번호가
//   개체 위로 온다(편집 화면은 개체 아래다). 불투명도 0.2 라 판독을 해치지 않아 두 장으로
//   갈라 굽는 대가(img 로드 2회)를 치르지 않는다.
//
// ★ [A-10] `width`/`height` 를 반드시 명시한다. viewBox 만 있는 SVG 는 `<img>` 에서 내재
//   크기가 불확정이라 브라우저 기본 300×150 으로 그려져 **PNG 가 뭉개진다.**
import { courtDefFor, type CourtMode, type CourtSize } from '../../model/court.ts';
import { gridGeom } from '../../model/grid.ts';
import { GRID_INK, GRID_LABEL_FILL, GRID_LABEL_SIZE_PX, GRID_LABEL_WEIGHT } from '../../render/gridInk.ts';
import type { TeamSide, TeamStyle } from '../../model/drill.ts';
import type { RenderFrame } from '../../model/playback.ts';
import type { Shape } from '../../model/shape.ts';
import { CHAIR, COURT_SURFACE_RX, NOTE } from '../../core/constants.ts';
import { pointAtLever } from '../../model/chair.ts';
// 쪽지 칩 폭의 유일한 출처. 칩을 그리는 쪽(buildStaticSvg)과 글자를 얹는 쪽(이 파일)이
// 같은 폭을 봐야 글이 칩 밖으로 새지 않는다 — render 쪽 순수 함수를 **읽기만** 한다.
import { NOTE_DEFAULT_SIZE_PX, noteChipWidthPx, noteLineDy, noteLines } from '../../render/objects/noteChip.ts';
import { safeColor } from './svgSafe.ts';
import { teamMarkFor } from './teamMark.ts';

/** 그림 아래에 붙는 한 줄 캡션. 없으면(`null`) 캡션 띠 자체를 만들지 않는다. */
export interface SceneCaption {
  /** 드릴 제목. 자유 전술판이면 '자유 전술판' 같은 화면 제목을 넣는다. */
  title: string;
  /** 0-based. 화면에는 +1 해서 찍는다. */
  stepIndex: number;
  stepCount: number;
  stepName: string;
  /** §7 3.4 선수 실명(§0.5 미배송 빚, 2026-08-20) — 시연 범례와 같은 값을 이미 ' · ' 로
   *  이은 한 줄 텍스트(model/chairLabel.ts namedRosterOf 를 호출부가 join+자름). 없으면
   *  캡션 띠가 기존 두 줄 그대로다 — 밴드가 늘어나는 것은 실명을 적은 선수가 있을 때뿐이다. */
  roster?: string;
}

export interface StaticSceneOpts {
  mode: CourtMode;
  /** §5.1/§6.4 코트 크기 3단. **출력 픽셀 크기와 캡션 띠 위치가 여기서 나온다** — 빼먹으면
   *  25×14 드릴의 PNG 가 825×525 캔버스에 그려져 오른쪽·아래에 빈 띠가 생기고, 캡션은
   *  코트 위로 100 px 올라와 개체를 덮는다. */
  size?: CourtSize;
  teams: Record<TeamSide, TeamStyle>;
  /** 진영 — `ruleZones[0]` 을 지키는 팀(`Drill.defense`). 골 지역 3인 반칙이 **수비 팀만**
   *  세므로(2026-08-15), 이 값을 안 넘기면 PNG 만 다른 팀을 붉게 칠한다. 생략하면
   *  `defaultDefense(mode)` 다 — 화면과 같은 폴백이라야 두 그림이 갈라지지 않는다. */
  defense?: TeamSide;
  /** **긴 변 = 1024 × resolution**(px). 1x = 1024, 2x = 2048(계획서 §6.2 [A-10] 목표 해상도).
   *  기본 2x — 인쇄물로 옮기는 것이 목적이라 화면 devicePixelRatio 가 아니라 출력 해상도를 기준으로 잡는다.
   *
   *  ⚠️ 2026-09-08 — 타입이 `1 | 2` 였다(PNG 는 1x·2x 두 배율만 골랐다). 영상(MP4)이 긴 변을
   *  **1280(720p)·1920(1080p)** 으로 요구하면서 정수배가 아닌 배율이 필요해져 `number` 로 넓힌다
   *  (PLAN-VIDEO-EXPORT 결정 5). PNG 쪽 두 배율은 그대로 살아 있다 — 넓힌 것뿐 뒤집은 것이 아니다.
   *  값은 `videoResolution()`(video/videoMetrics.ts)이 긴 변에서 되계산한다. */
  resolution?: number;
  /** 'black' = 카톡·밴드에 붙였을 때 둥근 모서리 바깥과 캡션 띠가 검정(기현 지시 2026-08-17,
   *  그 전에는 흰색이었다). 'transparent' = 문서에 겹치기용. 어느 쪽이든 캡션 글자는 흰색이다. */
  background?: 'black' | 'transparent';
  /** 작도 도형 — **지금 스텝의 것 그대로**다.
   *
   *  왜 `RenderFrame` 이 아니라 여기인가(2026-08-17): 도형은 움직이는 개체가 아니라 **표시**라
   *  스텝 사이를 보간하지 않는다. 시연(PresentStage)도 프레임이 아니라 `steps[i].shapes` 를
   *  그대로 읽는다 — 그 판단을 그림 쪽에서 뒤집으면 두 그림이 갈라진다.
   *  안 넘기면 그림에만 도형이 통째로 빠진다(2026-08-17 기현님 신고). */
  shapes?: readonly Shape[];
  /** 격자 **선**. 화면의 `prefs.showGrid` 와 같은 스위치다. */
  showGrid?: boolean;
  /** 격자 **칸 번호**(a1… / 축 헤더). 화면의 `prefs.showGridLabels` 와 같은 스위치다.
   *
   *  ⚠️ 2026-09-06 — 그 전에는 이 옵션 자체가 없었고 *"칸 라벨은 §6.2 표가 '안 담긴다' 로
   *  못박았다"* 가 근거로 적혀 있었다. 그 근거는 죽었다(기현 지시: *"png 에 격자는 나오는데
   *  격자 번호는 안 나옴"*) — 옛 문장을 기록으로 남기고 뒤집는다. `showGrid` 와 마찬가지로
   *  **선택 필드**다: 격자 자체가 꺼져 있으면 번호도 안 나오므로 두 스위치는 짝이고,
   *  안 넘긴 경로는 화면의 "격자만 켠" 상태와 같다. */
  showGridLabels?: boolean;
  /** 규칙 존 + 3 m 링. 화면의 `prefs.showRuleZones` 와 **같은 스위치**를 넘긴다. */
  showRuleZones?: boolean;
  caption?: SceneCaption | null;
}

/** 월드 px 단위 레이아웃 상수. 코트 좌표는 여기 없다 — 전부 `COURT_DEFS` 에서 온다. */
export const EXPORT_LAYOUT = {
  /** 1x 출력의 긴 변(px). 2x 가 계획서의 목표 2048 이다. */
  baseLongEdgePx: 1024,
  /** 캡션 띠 높이(월드 px). 두 줄(제목 20 + 부제 14)에 위아래 여백. */
  captionBandPx: 46,
  /** 선수 실명 줄이 붙을 때 띠에 더하는 높이(§0.5 미배송 빚, 2026-08-20). 부제 14px 보다
   *  작은 참고용 글자(11px)라 여백을 줄여도 된다 — 그래도 셋째 줄 자체는 위아래 여백을
   *  요구하므로 부제 한 줄(14)보다는 넉넉히 20을 더한다. */
  captionRosterExtraPx: 20,
  captionPadXPx: 14,
  captionTitleSizePx: 20,
  captionSubSizePx: 14,
  captionRosterSizePx: 11,
  /** 제목·부제의 **세로 중심**(띠 위 기준). */
  captionTitleCy: 16,
  captionSubCy: 34,
  /** 실명 줄의 세로 중심 — captionSubCy(34) 다음 줄. captionRosterExtraPx 와 같은 계열의
   *  값이라 밴드가 안 늘어나면(roster 없음) 이 좌표 자체가 안 쓰인다. */
  captionRosterCy: 50,
  /** 코트 배경 사각형의 둥근 모서리.
   *  ⚠️ 2026-09-06 — 여기 있던 리터럴 16 과 그 근거(*"PresentStage 와 같은 값(썸네일 14 가
   *  아니다)"*)를 뒤집는다. 그 문장은 시연만 기준으로 삼았고 **편집 화면(14)은 아예 보지
   *  않았다.** 정본은 편집 화면이므로 네 경로가 `COURT_SURFACE_RX` 하나를 읽는다. */
  courtRx: COURT_SURFACE_RX,
  /** 칩에 찍는 글자 크기. ChairChip.tsx 의 `LABEL_FONT_PX` 와 같은 유도식이다
   *  (원래 20, 2026-08-11 기현 지시로 2/3). 다르면 내보낸 그림의 등번호만 화면과 크기가 다르다. */
  chipLabelSizePx: (20 * 2) / 3,
  chipLabelWeight: 700,
  noteTextWeight: 600,
} as const;

/** 캡션 글자색 — **어느 배경에서든 흰색이다**(기현 지시 2026-08-17: *"아래 글씨 흰색으로"*).
 *
 *  ⚠️ 2026-08-17 이전에는 배경에 따라 두 벌이었다(흰 배경용 먹색 · 어두운 배경용 흰색).
 *  배경이 검정으로 바뀌면서 먹색 쪽은 **쓸 자리가 사라졌다** — 남겨 두면 "언젠가 흰 배경이
 *  돌아오면" 이라는 이유로 죽은 분기가 계속 산다. 되살릴 일이 생기면 그때 다시 적는다. */
const CAPTION_INK = { title: '#ffffff', sub: 'rgba(255,255,255,.72)' } as const;
/** 투명 배경에서 캡션 띠에 까는 색. 메모 쪽지와 같은 먹색(colors.ts `NOTE_FILL` 근거 공유).
 *  검정 배경에서는 전면 검정 사각형이 이미 깔려 있어 띠를 따로 칠하지 않는다(buildStaticSvg). */
export const CAPTION_BAND_FILL = '#0f1a14';

/** 장면 **뒤에 깔리는 색**. 영상(MP4)은 알파가 없어 캔버스를 먼저 이 색으로 칠하고 그 위에 장면을
 *  그린다 — 짝수 올림으로 남는 1px 줄도 이 색이다(PLAN-VIDEO-EXPORT 결정 5, `videoCanvasSize`).
 *
 *  'black' 은 buildStaticSvg 가 전면에 까는 검정과 같은 값이고, 'transparent' 는 영상에서
 *  투명이 될 수 없으므로 캡션 띠와 같은 먹색으로 접는다 — 그래야 흰 캡션 글자가 읽힌다.
 *  ⚠️ 검정 리터럴은 `buildStaticSvg.ts` 의 배경 사각형에도 있다(그 파일 소유). 둘이 갈라지면
 *  1px 여백만 다른 색으로 남으므로, 그 값을 바꾸는 사람은 여기도 같이 바꾼다. */
export function sceneBackdropFill(background: StaticSceneOpts['background']): string {
  return (background ?? 'black') === 'black' ? '#000000' : CAPTION_BAND_FILL;
}

export interface SceneMetrics {
  /** 코트 viewBox. */
  vbW: number;
  vbH: number;
  /** 캡션 띠를 더한 전체 높이(= SVG viewBox 높이). */
  totalH: number;
  /** `<svg width/height>` 에 그대로 찍는 출력 픽셀. 이것이 PNG 픽셀 크기다. */
  widthPx: number;
  heightPx: number;
  /** 월드 px → 출력 px 배율. 어댑터가 텍스트 좌표·크기에 곱한다. */
  scale: number;
  /** 캡션 띠 높이(0 이면 캡션 없음). */
  captionH: number;
}

export function staticSceneMetrics(opts: StaticSceneOpts): SceneMetrics {
  const def = courtDefFor(opts.mode, opts.size);
  const hasRoster = !!opts.caption?.roster && opts.caption.roster.length > 0;
  const captionH = opts.caption ? EXPORT_LAYOUT.captionBandPx + (hasRoster ? EXPORT_LAYOUT.captionRosterExtraPx : 0) : 0;
  const totalH = def.vbH + captionH;
  const longEdge = EXPORT_LAYOUT.baseLongEdgePx * (opts.resolution ?? 2);
  const scale = longEdge / Math.max(def.vbW, totalH);
  return {
    vbW: def.vbW,
    vbH: def.vbH,
    totalH,
    widthPx: Math.round(def.vbW * scale),
    heightPx: Math.round(totalH * scale),
    scale,
    captionH,
  };
}

/** 어댑터가 캔버스에 그릴 글자 하나. **좌표는 월드 px** 이고 세로는 언제나 **중심**이다
 *  (어댑터가 `textBaseline='middle'` 로 고정한다 — 기준선을 섞으면 어긋난다).
 *
 *  `font` 는 글꼴 **선택**이지 글꼴 이름이 아니다: 등번호는 Space Grotesk(라틴 서브셋으로
 *  충분하다), 한글이 들어갈 수 있는 것은 전부 Pretendard 다. */
export interface TextPlacement {
  text: string;
  x: number;
  y: number;
  sizePx: number;
  weight: number;
  color: string;
  align: 'start' | 'middle' | 'end';
  font: 'number' | 'body';
  opacity: number;
}

export const FONT_STACKS = {
  number: "'Space Grotesk', sans-serif",
  body: "'Pretendard', sans-serif",
} as const;

/** 캔버스 `ctx.font` 문자열. 크기는 **출력 px**(월드 px × scale)이다. */
export function fontCssFor(p: TextPlacement, scale: number): string {
  return `${p.weight} ${Math.round(p.sizePx * scale * 100) / 100}px ${FONT_STACKS[p.font]}`;
}

/** SVG `text-anchor` → 캔버스 `textAlign`. LTR 만 쓰므로 start=left 로 굳힌다. */
export function canvasAlignFor(align: TextPlacement['align']): 'left' | 'center' | 'right' {
  return align === 'start' ? 'left' : align === 'end' ? 'right' : 'center';
}

/** 월드 좌표 → 출력(캔버스) 좌표. */
export function textToOutputPx(p: TextPlacement, scale: number): { x: number; y: number } {
  return { x: p.x * scale, y: p.y * scale };
}

/** 프레임 + 옵션 → 캔버스가 그릴 글자 전량.
 *
 *  **빈 메모의 플레이스홀더('메모')는 넣지 않는다.** 그건 "여기 글을 쓰세요" 라는 앱의 말이지
 *  코치가 팀에 보내려는 내용이 아니다 — 내보낸 그림에 앱의 안내문이 찍히면 그게 곧 오독이다.
 *  쪽지 자체는 그려지므로 "메모를 놓은 자리" 는 그림에 남는다. */
export function buildTextPlacements(frame: RenderFrame, opts: StaticSceneOpts): TextPlacement[] {
  const out: TextPlacement[] = [];

  // 격자 칸 번호·축 헤더 — **맨 먼저** 담는다. 어댑터가 배열 순서대로 칠하므로 이것이 곧
  // "가장 아래 글자" 다(등번호·메모가 그 위에 온다). 조건·크기·색·불투명도는 화면
  // (`render/GridOverlay.tsx` + `render/gridInk.ts`)과 **같은 출처**를 읽는다 — 여기 숫자를
  // 다시 적으면 격자를 손본 날 PNG 만 옛 값으로 남는다.
  if (opts.showGrid && opts.showGridLabels) {
    const g = gridGeom(opts.mode, opts.size);
    const label = (text: string, x: number, y: number, sizePx: number, opacity: number): TextPlacement => ({
      text,
      x,
      y,
      sizePx,
      weight: GRID_LABEL_WEIGHT,
      color: GRID_LABEL_FILL,
      align: 'middle',
      // 'number' = Space Grotesk. 화면의 격자 글꼴과 같은 스택이다(gridInk.GRID_FONT).
      font: 'number',
      opacity,
    });
    // 칸 번호는 full·half 만(flat 은 1 m 격자라 340칸 — GridOverlay 의 같은 조건).
    if (opts.mode !== 'flat') {
      for (const c of g.cells) out.push(label(c.text, c.x, c.y, GRID_LABEL_SIZE_PX.cell, GRID_INK.screen.cell));
    }
    // 축 헤더는 flat 에만 있다(gridGeom 이 그렇게 준다) — 조건도 화면과 같이 `g.axis` 유무다.
    for (const a of g.axis ?? []) out.push(label(a.text, a.x, a.y, GRID_LABEL_SIZE_PX.axis, GRID_INK.screen.axis));
  }

  // 등번호·골키퍼 'G'. 위치는 ChairChip 과 같은 식이어야 한다 — 피벗에서 centroidOffsetPx
  // 만큼 앞(§3.4 피벗 원점 규약). `pointAtLever` 가 그 식의 유일한 출처다(model/chair.ts).
  // 글자는 차체가 돌아도 **절대 회전하지 않는다**(§3.4) — 그래서 회전 정보를 싣지 않는다.
  for (const c of frame.chairs) {
    if (c.opacity <= 0) continue;
    const mark = teamMarkFor(c.def, opts.teams);
    if (mark.label.length === 0) continue;
    const p = pointAtLever({ x: c.x, y: c.y, theta: c.theta }, CHAIR.centroidOffsetPx);
    out.push({
      text: mark.label,
      x: p.x,
      y: p.y,
      sizePx: EXPORT_LAYOUT.chipLabelSizePx,
      weight: EXPORT_LAYOUT.chipLabelWeight,
      color: mark.ink,
      align: 'middle',
      font: 'number',
      opacity: c.opacity,
    });
  }

  // 메모 글자. x 오프셋 규칙은 NoteLabel.tsx 와 같다 — align 은 글의 정렬이자 **앵커 기준
  // 칩의 위치**이기도 하다(start 면 앵커가 왼쪽 끝).
  for (const n of frame.notes) {
    if (n.opacity <= 0 || n.text.length === 0) continue;
    const size = n.size ?? NOTE_DEFAULT_SIZE_PX;
    const align = n.align ?? 'middle';
    const halfW = noteHalfWidth(n.text, size);
    const dx = align === 'start' ? -halfW + NOTE.chipPadXPx : align === 'end' ? halfW - NOTE.chipPadXPx : 0;
    // 줄바꿈(2026-08-17)은 여기서 **줄마다 한 배치**가 된다. TextPlacement 는 한 줄짜리
    // 자료라(캔버스의 fillText 하나가 곧 하나다) tspan 같은 것이 없다 — 대신 y 를 옮긴다.
    // 줄 나눔은 화면과 같은 `noteLines` 다: 그림(칩)과 글이 다른 줄 수를 보면 글이 쪽지 밖으로 샌다.
    const lines = noteLines(n.text, size);
    for (const [i, line] of lines.entries()) {
      out.push({
        text: line,
        x: n.x + dx,
        y: n.y + noteLineDy(i, lines.length, size),
        sizePx: size,
        weight: EXPORT_LAYOUT.noteTextWeight,
        color: safeColor(n.color, '#ffffff'),
        align,
        font: 'body',
        opacity: n.opacity,
      });
    }
  }

  const cap = opts.caption;
  if (cap) {
    const def = courtDefFor(opts.mode, opts.size);
    const ink = CAPTION_INK;
    out.push({
      text: cap.title,
      x: EXPORT_LAYOUT.captionPadXPx,
      y: def.vbH + EXPORT_LAYOUT.captionTitleCy,
      sizePx: EXPORT_LAYOUT.captionTitleSizePx,
      weight: 700,
      color: ink.title,
      align: 'start',
      font: 'body',
      opacity: 1,
    });
    out.push({
      text: captionSubText(cap),
      x: EXPORT_LAYOUT.captionPadXPx,
      y: def.vbH + EXPORT_LAYOUT.captionSubCy,
      sizePx: EXPORT_LAYOUT.captionSubSizePx,
      weight: 500,
      color: ink.sub,
      align: 'start',
      font: 'body',
      opacity: 1,
    });
    if (cap.roster && cap.roster.length > 0) {
      out.push({
        text: cap.roster,
        x: EXPORT_LAYOUT.captionPadXPx,
        y: def.vbH + EXPORT_LAYOUT.captionRosterCy,
        sizePx: EXPORT_LAYOUT.captionRosterSizePx,
        weight: 500,
        color: ink.sub,
        align: 'start',
        font: 'body',
        opacity: 1,
      });
    }
  }

  return out;
}

/** '3/7 · 왼쪽 전환' — 스텝 이름이 비어 있으면 번호만. */
export function captionSubText(cap: SceneCaption): string {
  const no = `${cap.stepIndex + 1}/${cap.stepCount}`;
  return cap.stepName.length > 0 ? `${no} · ${cap.stepName}` : no;
}

/** 쪽지 칩 폭의 절반. */
export function noteHalfWidth(text: string, size: number): number {
  return noteChipWidthPx(text, size) / 2;
}
