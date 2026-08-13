// §5.4 — 트레이 칩·트레이 폭의 **치수 식**. ToolRail.tsx(화면)와 크롬 예산 테스트가 같은 식을
// 쓰도록 컴포넌트 밖으로 뺀 파일이다(react-refresh 규칙상 컴포넌트 파일은 함수를 내보내지
// 않는다). 여기의 픽셀 함수와 calc 문자열은 **같은 상수로 조립된다** — 둘 중 하나만 고치면
// ToolRail.hit.test.tsx 의 리터럴 대조가 빨간불이 된다.
//
// ── 2026-08-14 P3(유동 트레이) 추가분 ────────────────────────────────────────────────
// 트레이 폭이 **못박힌 값에서 구간**이 됐다(설계서 §4.1). 칩 2열은 이제 폭이 아니라 **하한**이고
// 상한은 5열이다 — 그 사이를 코트 칸이 자기 종횡비만큼만 쓰고 남긴 폭이 채운다.
// 그래서 이 파일에는 "몇 열이 들어가나"(trayColumnsAt)와 "안 스크롤되는 세로 합이
// 얼마인가"(trayFixedHeightPx)가 함께 들어온다 — 둘 다 jsdom 없이 도는 순수 함수다.
import { CHAIR } from '../../core/constants.ts';

/** 상자−칩 가로 여백(선택 테두리·drop-shadow 자리). 상자 가로 = 정확히 `--hit`. */
export const CHIP_BOX_PAD_X = 8;
export const CHIP_BOX_PAD_Y = 6;
/** 칩 줄 간격이자 트레이 폭 식의 상수항. */
export const CHIP_ROW_GAP = 5;
/** 칩 세로/가로 비 = 37.5/25 = 1.5. 코트 칩과 어긋나면 같은 말로 안 읽힌다. */
export const CHIP_RATIO = CHAIR.lengthPx / CHAIR.widthPx;

/** 칩 열 수의 하한·상한(§4.1).
 *  - 하한 2 — 지금까지의 **고정** 폭이다. 크롬 예산의 `toolRail` 행(93)이 이 값이고, 폭 제약
 *    기기(1280·1920 핀)에서 트레이는 정확히 여기서 멈춘다 = 오늘과 같은 배치.
 *  - 상한 5 — half/flat 은 남는 폭이 커서(1024×600 에서 454px) 그대로 주면 9열 슬래브가 된다.
 *    상한 초과분은 **판 덩어리 바깥의 대칭 여백**이라 코트↔트레이 사이가 아니다. */
export const TRAY_MIN_COLS = 2;
export const TRAY_MAX_COLS = 5;

/** 칩 SVG 의 CSS 크기. jsdom 은 calc(var()) 를 계산하지 못하므로 픽셀 검증은 아래 함수가 맡는다. */
export const CHIP_W_CSS = `calc(var(--hit) - ${CHIP_BOX_PAD_X}px)`;
export const CHIP_H_CSS = `calc((var(--hit) - ${CHIP_BOX_PAD_X}px) * ${CHIP_RATIO})`;
export const CHIP_BOX_H_CSS = `calc((var(--hit) - ${CHIP_BOX_PAD_X}px) * ${CHIP_RATIO} + ${CHIP_BOX_PAD_Y}px)`;
/** 트레이 **하한** 폭(칩 2열). 2026-08-14 P3 전에는 이것이 `width` 이기도 했다 — 지금은
 *  `minWidth` 뿐이고, 이름을 그대로 둔 이유는 크롬 예산 행이 이 식으로 계산돼 있기 때문이다. */
export const TRAY_ROW_MAX_CSS = `calc(var(--hit) * ${TRAY_MIN_COLS} + ${CHIP_ROW_GAP * (TRAY_MIN_COLS - 1)}px)`;
/** 트레이 **상한** 폭(칩 5열) — 44 → 240, 56 → 300. 설계서 §4.1 의 `calc(var(--hit)*5 + 20px)`. */
export const TRAY_ROW_CAP_CSS = `calc(var(--hit) * ${TRAY_MAX_COLS} + ${CHIP_ROW_GAP * (TRAY_MAX_COLS - 1)}px)`;

/** 칩 상자 크기를 **픽셀로** 계산한다 — 위 calc 문자열과 같은 식이다(상수를 공유한다).
 *  크롬 예산·완료 판정 테스트가 이 함수로 §5.4 의 표(44→44×60·93, 56→56×78·117)를 재현한다. */
export const trayChipBoxPx = (hitPx: number): { w: number; h: number } => ({
  w: hitPx,
  h: (hitPx - CHIP_BOX_PAD_X) * CHIP_RATIO + CHIP_BOX_PAD_Y,
});

/** 칩 `cols` 열이 딱 들어가는 안쪽 폭. 트레이는 좌우 패딩이 0 이라(RAIL_STYLE) 이 값이 곧 트레이 폭이다. */
export const trayRowWidthPx = (hitPx: number, cols: number): number => hitPx * cols + CHIP_ROW_GAP * (cols - 1);

/** 세로 트레이의 **최소** 폭 = 칩 상자 두 개 + 간격. 44 → 93(예산표 wide/narrow), 56 → 117.
 *
 *  ⚠️ 2026-08-14 이전에는 이것이 트레이의 **폭**이었다. 지금은 하한이다 — 이름을 안 바꾼 이유는
 *  chromeBudget.test.ts 가 이 함수로 `toolRail` 행을 대조하고 있고, 그 행의 값(93)이 여전히
 *  참이기 때문이다(예산표는 "코트가 **최대로** 쓸 수 있는 상자" 를 재므로 트레이가 최소일 때의
 *  값을 써야 맞다 — chromeBudget.ts 의 그 행 주석에 논지를 적어 뒀다). */
export const trayRailWidthPx = (hitPx: number): number => trayRowWidthPx(hitPx, TRAY_MIN_COLS);

/** 세로 트레이의 **최대** 폭 = 칩 5열. 44 → 240, 56 → 300. `TRAY_ROW_CAP_CSS` 와 같은 식이다. */
export const trayRailMaxWidthPx = (hitPx: number): number => trayRowWidthPx(hitPx, TRAY_MAX_COLS);

/** 그 폭에 칩이 몇 열 들어가나. 상한(5)에서 멈춘다 — 트레이 자신이 maxWidth 로 거기서 멈추므로
 *  이 clamp 는 계산이 화면보다 앞서 나가지 않게 하는 이중 보증이다. */
export const trayColumnsAt = (widthPx: number, hitPx: number): number =>
  Math.max(1, Math.min(TRAY_MAX_COLS, Math.floor((widthPx + CHIP_ROW_GAP) / (hitPx + CHIP_ROW_GAP))));

// ── 트레이 세로 치수 — ToolRail 의 인라인 style 과 **같은 상수로 조립된다** ────────────────
/** nav 의 상하 패딩(RAIL_STYLE `padding: '13px 0'`). */
export const TRAY_PAD_Y = 13;
/** nav 가 자기 구역들 사이에 두는 간격(RAIL_BASE `gap`). */
export const TRAY_GAP = 6;
/** 구역 안 손잡이 사이 간격(줌·도구·칩 줄이 모두 같은 리듬을 쓴다). */
export const TRAY_ITEM_GAP = 5;
/** 구분선 한 줄이 먹는 세로 = 선 1 + 상하 margin 4씩. */
export const TRAY_DIVIDER_H = 1;
export const TRAY_DIVIDER_MARGIN_Y = 4;
/** 모드 버튼 기본 크기. `--hit` 이 더 크면(56) min 이 이긴다 — BTN_STYLE 의 minWidth/minHeight. */
export const TOOL_BTN_W = 52;
export const TOOL_BTN_H = 50;
/** 코트 이름 한 줄(0.5625rem = 9px × line-height 1.5 = 13.5 → 올림). 세로 트레이에만 있다. */
export const COURT_LABEL_H = 14;
/** nav 의 직계 구역 수 — 줌 · 구분선 · 벤치 · 구분선 · 도구 · 코트 라벨. gap 은 그 사이 5곳. */
export const TRAY_SECTIONS = 6;

// ── 세로 배치의 띠(가로 트레이) — 2026-08-14 P5 (설계서 §4.7) ─────────────────────────
/** 띠의 상하·좌우 패딩. RAIL_STYLE_H 의 `padding` 이 **이 상수로 조립된다** — 저쪽에 리터럴을
 *  다시 적으면 아래 높이 식과 화면이 조용히 갈라진다(옛 값 '8px 13px' 와 바이트 동일). */
export const TRAY_BAND_PAD_Y = 8;
export const TRAY_BAND_PAD_X = 13;
/** 띠 안 구분선의 좌우 여백(세로 기둥의 `4px 12px` 와 축이 반대다 — 저쪽은 12 가 좌우다). */
export const TRAY_BAND_DIVIDER_MARGIN_X = 4;
export const TRAY_BAND_DIVIDER_MARGIN_Y = 6;

/** ★ **띠 높이 상한 175px.** 넘기면 `rotForFit` 이 90 → 0 으로 뒤집혀 축척이 절벽으로 떨어진다.
 *
 *  실측(480×800 세로 · full 30×18 · 코트 상자 = 창 − 크롬. 계산은 trayBand.test.ts 가 재현한다):
 *  | 띠 | 가용 | rot | px/u |
 *  | 76 (재설계 전 1행) | 456×592 | 90 | 0.7176 |
 *  | **132 (2행, hit 44)** | 456×536 | 90 | **0.6497** |
 *  | **156 (2행, hit 56)** | 456×512 | 90 | **0.6206** |
 *  | 175 | 456×493 | 90 | 0.5976 |
 *  | **176** | 456×492 | **0** | **0.5527** ← 절벽. 띠 1px 을 더 준 대가가 축척 −7.5% 다 |
 *
 *  절벽의 정체: `rotForFit` 은 `turned > flat × 1.08` 일 때만 돌린다. 492 = 456 × 1.0789 이라
 *  1.08 문턱을 **1px 차이로** 못 넘는다. 그래서 상한은 "적당히 이쯤" 이 아니라 **175 로 딱 떨어진다.**
 *  3행(≈182~232)은 이 상한 밖이라 원천 배제 — **2행이 물리적 최대다.** */
export const TRAY_BAND_MAX_PX = 175;

/** 2행 띠의 높이 — 칩 줄(60/78) + 도구 줄(50/56) + nav gap(6) + 상하 패딩(16). 44 → **132**,
 *  56 → **156**. 둘 다 `TRAY_BAND_MAX_PX` 미만이라는 것을 trayBand.test.ts 가 상수로 대조한다.
 *
 *  ⚠️ 설계서 §4.7·§5-P5 는 이 식을 `calc((var(--hit) - 8px) * 1.5 + 6px + var(--hit) + 22px)`
 *  으로 적었지만 **hit 44 에서 126 이 나온다**(132 가 아니다). 둘째 줄은 도구 버튼 줄이고 그
 *  높이는 `var(--hit)` 이 아니라 `max(TOOL_BTN_H, --hit)` 이다 — BTN_STYLE 이 `height:50px`
 *  + `minHeight:var(--hit)` 이라 56 에서만 `--hit` 이 이긴다. 설계서의 상수항 22(= gap 6 +
 *  패딩 16)는 맞고, 틀린 것은 둘째 줄 항 하나뿐이라 그 항만 고쳤다. 목표값 132/156 은
 *  설계서 §4.7 의 가용 상자(456×536 · 456×512)와 정확히 짝이므로 **목표가 아니라 식이 오타다.** */
export const trayBandHeightPx = (hitPx: number): number =>
  trayChipBoxPx(hitPx).h + Math.max(TOOL_BTN_H, hitPx) + TRAY_GAP + TRAY_BAND_PAD_Y * 2;

/** 재설계 **전**(1행) 띠 높이 — 44 → 76, 56 → 94. 대조군이자 §4.6 축척표의 '지금' 열이다. */
export const trayBand1RowHeightPx = (hitPx: number): number => trayChipBoxPx(hitPx).h + TRAY_BAND_PAD_Y * 2;

/** 위 픽셀 식과 **같은 상수로 조립한** calc 문자열. jsdom 은 calc(var()) 를 계산하지 못하므로
 *  화면에는 이 문자열이 걸리고 픽셀 검증은 `trayBandHeightPx` 가 맡는다(트레이 폭이 간 길과 같다). */
export const TRAY_BAND_2ROW_CSS = `calc((var(--hit) - ${CHIP_BOX_PAD_X}px) * ${CHIP_RATIO} + ${CHIP_BOX_PAD_Y}px + max(${TOOL_BTN_H}px, var(--hit)) + ${TRAY_GAP + TRAY_BAND_PAD_Y * 2}px)`;

/** 폭 `w` 에 `itemW` 짜리가 한 줄에 몇 개 들어가나(gap 은 `TRAY_ITEM_GAP`). */
const perRow = (w: number, itemW: number): number =>
  Math.max(1, Math.floor((w + TRAY_ITEM_GAP) / (itemW + TRAY_ITEM_GAP)));

/** `n` 개를 `perLine` 씩 쌓았을 때의 세로 합. */
const stack = (n: number, perLine: number, itemH: number): number => {
  const lines = Math.max(1, Math.ceil(n / perLine));
  return lines * itemH + (lines - 1) * TRAY_ITEM_GAP;
};

/** 위험 3 — 트레이에서 **안 스크롤되는** 세로 합. 벤치(개체 구역)만 스크롤러이므로
 *  줌 3 · 구분선 2 · 도구 4(서랍 닫힘) · 코트 라벨 · 패딩 · nav gap 이 여기 들어간다.
 *
 *  이 합이 판 높이를 넘으면 **서랍 손잡이가 화면 밖으로 나가 작도·설명에 영영 못 닿는다**
 *  (RAIL_STYLE_H:156-164 이 기록한 *"1번 선수를 영영 못 잡는다"* 사고의 세로판). 그래서 이 값은
 *  "보기 좋은가" 가 아니라 **도달 가능성**의 문제다.
 *
 *  실측(hit 44, 5열 = 폭 240): 26(패딩) + 30(gap 5칸) + 44(줌 1줄) + 18(구분선 2) + 50(도구 1줄)
 *  + 14(코트 이름) = **182**. 1024×600 의 판 높이 468 에 견주면 벤치에 286 이 남는다 —
 *  P2 종료 시점(고정 396 · 벤치 72)에서 뒤집힌 값이고, 뒤집은 것은 폭이다(2열 93 → 5열 240). */
export function trayFixedHeightPx(hitPx: number, cols: number): number {
  const w = trayRowWidthPx(hitPx, cols);
  const toolW = Math.max(TOOL_BTN_W, hitPx);
  const toolH = Math.max(TOOL_BTN_H, hitPx);
  return (
    TRAY_PAD_Y * 2 +
    TRAY_GAP * (TRAY_SECTIONS - 1) +
    stack(3, perRow(w, hitPx), hitPx) +
    (TRAY_DIVIDER_H + TRAY_DIVIDER_MARGIN_Y * 2) * 2 +
    stack(4, perRow(w, toolW), toolH) +
    COURT_LABEL_H
  );
}

/** 벤치(개체 구역)가 스크롤 없이 담기는 세로. 칩 줄 하나 + 공·콘 상자 줄 하나다 —
 *  둘 다 `flexWrap` 이라 열 수에 따라 줄 수가 변한다.
 *
 *  ⚠️ 공·콘 상자 3개가 **칩과 같은 wrap 흐름의 다음 줄**에 놓인다는 것이 P3 의 재편이다
 *  (전에는 세로로 하나씩 쌓여 150px 을 먹었다). 1024×600·5열에서 293 → 181 로 줄어
 *  스크롤이 사라졌다 — 그 112px 이 이 재편의 값이다. */
// ── 띠가 정말 **2행**인가 — flex wrap 줄나눔의 순수 모형 (2026-08-14 P5) ─────────────────
//
// ⚠️ **하네스도 검증 대상이다.** `trayBandHeightPx` 는 "칩 줄 하나 + 도구 줄 하나" 를 **전제로**
// 132 를 답한다. 화면이 그 전제를 안 지키면(구역이 3줄로 흐르면) 함수는 여전히 132 를 답하고
// 테스트는 초록인 채 실제 띠 내용은 182 가 된다 — 계기가 거짓말하는 정확히 그 형태다.
// 그래서 줄나눔을 여기서 한 번 더, **폭에서** 계산해 두 값을 맞대 본다.
//
// flex 는 각 항목의 **flex base size**(여기서는 전부 `flex:'none'` 이라 max-content)로 줄을
// 나눈 뒤 그 줄 안에서만 grow/shrink 를 적용한다 — 그래서 줄 수는 폭만으로 정해진다.

/** 띠에 놓이는 nav 직계 구역 하나. `h` 가 0 인 것은 구분선(alignSelf:stretch — 줄 높이를
 *  스스로 정하지 못한다). */
export interface TrayBandSection {
  name: string;
  w: number;
  h: number;
}

/** 띠의 구역 다섯. **DOM 순서 그대로다**(줌 · 구분선 · 벤치 · 구분선 · 기능) — 순서를 바꾸면
 *  줄나눔이 달라지므로 이 배열의 순서 자체가 계약이다. 코트 라벨은 세로 기둥 전용이라 없다. */
export function trayBandSectionsPx(hitPx: number, chips: number): TrayBandSection[] {
  const toolW = Math.max(TOOL_BTN_W, hitPx);
  const toolH = Math.max(TOOL_BTN_H, hitPx);
  const divW = TRAY_DIVIDER_H + TRAY_BAND_DIVIDER_MARGIN_X * 2;
  // 벤치 = 칩 줄(nowrap) + 공 + 콘 2개, 사이 gap 3칸.
  const chipRow = chips * hitPx + Math.max(0, chips - 1) * CHIP_ROW_GAP;
  return [
    { name: '확대', w: hitPx * 3 + TRAY_ITEM_GAP * 2, h: hitPx },
    { name: '구분선', w: divW, h: 0 },
    { name: '개체', w: chipRow + toolW * 3 + TRAY_GAP * 3, h: Math.max(trayChipBoxPx(hitPx).h, toolH) },
    { name: '구분선', w: divW, h: 0 },
    // 기능 = 선택 · 지우개 · 작도 손잡이 · 설명 손잡이(서랍은 닫힘).
    { name: '기능', w: toolW * 4 + TRAY_ITEM_GAP * 3, h: toolH },
  ];
}

export interface TrayBandLayout {
  rows: number;
  /** 내용이 실제로 요구하는 띠 높이(패딩 포함). `trayBandHeightPx` 와 같으면 2행이 성립한 것이다. */
  heightPx: number;
}

/** 띠 폭 `navWidthPx` 에서 구역들이 몇 줄로 흐르고 그 내용이 세로로 얼마를 요구하는가.
 *
 *  실측(hit 44 · 선수 8명 — 기본 캐스트):
 *   · 480×800 세로 → 띠 폭 456 → **3행 182px**. 벤치 하나가 561px 이라 줌·구분선(157) 뒤에
 *     못 들어가 자기 줄로 내려가고, 기능 구역이 셋째 줄이 된다. 띠는 132 에 고정돼 있으므로
 *     `overflowY:'auto'` 로 **세로 스크롤**이 생긴다 — 도달은 되지만 설계서가 그린 2행은 아니다.
 *   · 띠 폭 750 이상(창 774+) → **2행 132px** = `trayBandHeightPx(44)` 와 정확히 일치.
 *  이 갈림을 trayBand.test.ts 가 문턱까지 못박는다. */
export function trayBandLayoutAt(hitPx: number, navWidthPx: number, chips: number): TrayBandLayout {
  const inner = Math.max(0, navWidthPx - TRAY_BAND_PAD_X * 2);
  let rows = 0;
  let cx = 0;
  let lineH = 0;
  let sum = 0;
  for (const s of trayBandSectionsPx(hitPx, chips)) {
    if (rows === 0) {
      rows = 1;
      cx = s.w;
      lineH = s.h;
      continue;
    }
    if (cx + TRAY_GAP + s.w > inner) {
      sum += lineH;
      rows += 1;
      cx = s.w;
      lineH = s.h;
    } else {
      cx += TRAY_GAP + s.w;
      lineH = Math.max(lineH, s.h);
    }
  }
  sum += lineH;
  return { rows, heightPx: sum + TRAY_GAP * (rows - 1) + TRAY_BAND_PAD_Y * 2 };
}

export function trayBenchHeightPx(hitPx: number, cols: number, chips: number): number {
  const chip = trayChipBoxPx(hitPx);
  const boxW = Math.max(TOOL_BTN_W, hitPx);
  const boxH = Math.max(TOOL_BTN_H, hitPx);
  const w = trayRowWidthPx(hitPx, cols);
  const chipRows = Math.max(1, Math.ceil(chips / cols));
  const chipBlock = chipRows * chip.h + (chipRows - 1) * CHIP_ROW_GAP;
  return chipBlock + TRAY_GAP + stack(3, perRow(w, boxW), boxH);
}
