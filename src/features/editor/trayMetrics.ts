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

/** 칩 SVG 의 CSS 크기. jsdom 은 calc(var()) 를 계산하지 못하므로 픽셀 검증은 아래 함수가 맡는다.
 *
 *  ── 2026-08-14 기현님 지시: *"트레이의 휠체어 칩은 너무 크다. 마우스(손가락)로 끌고 올
 *  정도면 된다"* ─────────────────────────────────────────────────────────────────────
 *  **상자를 정사각으로 만들었다**(44×60 → 44×44). 칩은 세로/가로 1.5 비율이라 폭을 기준으로
 *  키우면 세로가 1.5배로 길어지는데, 그 길쭉함이 "너무 크다" 의 정체였다.
 *
 *  ⚠️ **폭은 한 픽셀도 안 건드렸다** — 상자 가로는 여전히 정확히 `--hit` 다. 트레이 폭 식
 *  (trayRowWidthPx)·크롬 예산의 `toolRail` 행(93)·열 수 계산이 전부 그 위에 서 있어서,
 *  폭을 줄이면 이 파일 밖의 수십 개 숫자가 함께 움직인다. 줄어든 것은 **세로뿐**이고 그
 *  덕에 세로 띠(trayBand 행)도 132 → 116 으로 함께 작아진다.
 *
 *  이제 기준이 뒤집혔다: 예전에는 **가로**가 `--hit` 에서 나오고 세로가 비율로 따라왔는데,
 *  지금은 **세로**가 상자 높이에서 나오고 가로가 비율로 따라온다. 그래서 칩 SVG 는
 *  44 기준 25×38(옛 36×54)이다 — 끌어 잡기에는 충분하고 벤치는 훨씬 촘촘해진다. */
export const CHIP_H_CSS = `calc(var(--hit) - ${CHIP_BOX_PAD_Y}px)`;
export const CHIP_W_CSS = `calc((var(--hit) - ${CHIP_BOX_PAD_Y}px) / ${CHIP_RATIO})`;
export const CHIP_BOX_H_CSS = 'var(--hit)';
/** 트레이 **하한** 폭(칩 2열). 2026-08-14 P3 전에는 이것이 `width` 이기도 했다 — 지금은
 *  `minWidth` 뿐이고, 이름을 그대로 둔 이유는 크롬 예산 행이 이 식으로 계산돼 있기 때문이다. */
export const TRAY_ROW_MAX_CSS = `calc(var(--hit) * ${TRAY_MIN_COLS} + ${CHIP_ROW_GAP * (TRAY_MIN_COLS - 1)}px)`;
/** 트레이 **상한** 폭(칩 5열) — 44 → 240, 56 → 300. 설계서 §4.1 의 `calc(var(--hit)*5 + 20px)`. */
export const TRAY_ROW_CAP_CSS = `calc(var(--hit) * ${TRAY_MAX_COLS} + ${CHIP_ROW_GAP * (TRAY_MAX_COLS - 1)}px)`;

/** 칩 상자 크기를 **픽셀로** 계산한다 — 위 calc 문자열과 같은 식이다(상수를 공유한다).
 *  크롬 예산·완료 판정 테스트가 이 함수로 §5.4 의 표(44→44×60·93, 56→56×78·117)를 재현한다. */
export const trayChipBoxPx = (hitPx: number): { w: number; h: number } => ({ w: hitPx, h: hitPx });

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
/** nav 의 직계 구역 수 — 벤치 · 구분선 · 도구 · 코트 라벨. gap 은 그 사이 3곳.
 *
 *  ⚠️ **자유 전술판 기준이다.** 2026-08-14 재설계로 줌 3개와 편집 이력 2개가 트레이를 떠나
 *  오른쪽 기능 바로 갔다(7 → 4). 드릴 편집은 아직 옛 배치라 그쪽 트레이에는 줌·이력이
 *  남아 있고 구역이 7 이다 — 이 상수와 아래 세로 합 식은 그쪽을 **안 센다.** 드릴 편집
 *  재설계가 오면 그때 하나로 합친다. */
export const TRAY_SECTIONS = 4;

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
// ⚠️ 2026-08-14 — `TRAY_BAND_MAX_PX = 175`(축척 절벽 상한)를 **지웠다.** 위 표가 잰 절벽은
// **세로 창**의 것이다: 세로 창에서 띠를 키우면 가용 높이가 줄어 `rotForFit` 의 1.08 문턱을
// 못 넘고 판이 눕는다. 이제 띠는 가로 창의 것이고, 가로 창에서 띠를 키우면 코트가 **선형으로**
// 작아질 뿐 rot 은 0 에서 안 움직인다(trayBand.test 의 ② 가 그 단조성을 직접 스캔한다).
// 즉 지금 띠에는 "여기까지는 공짜" 라는 문턱이 없다 — **작을수록 좋다**, 그것이 1행의 근거다.


/** 가로 띠의 높이 — **1행**이다. 도구 줄(50/56) + 상하 패딩(16). 44 → **66**, 56 → **72**.
 *
 *  ── 2026-08-14 기현님 결정: 2행(132) → **1행(66)** ──────────────────────────────────
 *  P5 가 2행을 고른 것은 띠가 **세로 화면**에만 있었기 때문이다. 세로 창에서는 높이가 남고
 *  폭이 모자라니 띠를 두껍게 해서 한 줄에 다 담는 편이 나았다.
 *  이번 재설계로 띠는 **가로 화면**의 것이 됐고(트레이가 코트 긴 변에 붙는다 — 가로 코트면
 *  아래), 가로 화면에서 모자라는 것은 정확히 **높이**다. 띠 116px 은 800×480 에서 코트 축척을
 *  **−14.9%** 만들었다(실측). 1행으로 줄여 그 절반을 되찾는다.
 *
 *  대가는 **가로 스크롤**이다: 선수 8 + 공 + 콘 2 + 도구 4 가 한 줄이면 좁은 창에서 넘친다.
 *  세로 스크롤과 달리 이쪽은 **§3 불변식 1 을 안 깬다** — 띠 높이가 상수라 코트가 안 흔들리고,
 *  넘치는 것은 줄의 오른쪽 끝이지 위쪽 표적이 아니다. 그리고 서랍이 플라이아웃이 되면서
 *  "열면 줄이 하나 는다" 는 경우가 아예 사라져, 1행은 **언제나 1행**이다.
 *
 *  칩이 정사각(44×44)이 된 것이 이 결정을 가능하게 했다 — 옛 44×60 칩이면 1행이 76 이라
 *  줄여도 10px 밖에 못 벌었다. */
export const trayBandHeightPx = (hitPx: number): number => Math.max(TOOL_BTN_H, hitPx) + TRAY_BAND_PAD_Y * 2;

/** 위 픽셀 식과 **같은 상수로 조립한** calc 문자열. jsdom 은 calc(var()) 를 계산하지 못하므로
 *  화면에는 이 문자열이 걸리고 픽셀 검증은 `trayBandHeightPx` 가 맡는다(트레이 폭이 간 길과 같다). */
export const TRAY_BAND_1ROW_CSS = `calc(max(${TOOL_BTN_H}px, var(--hit)) + ${TRAY_BAND_PAD_Y * 2}px)`;

/** 폭 `w` 에 `itemW` 짜리가 한 줄에 몇 개 들어가나(gap 은 `TRAY_ITEM_GAP`). */
const perRow = (w: number, itemW: number): number =>
  Math.max(1, Math.floor((w + TRAY_ITEM_GAP) / (itemW + TRAY_ITEM_GAP)));

/** `n` 개를 `perLine` 씩 쌓았을 때의 세로 합. */
const stack = (n: number, perLine: number, itemH: number): number => {
  const lines = Math.max(1, Math.ceil(n / perLine));
  return lines * itemH + (lines - 1) * TRAY_ITEM_GAP;
};

/** 위험 3 — 트레이에서 **안 스크롤되는** 세로 합. 벤치(개체 구역)만 스크롤러이므로
 *  구분선 1 · 도구 4(서랍은 플라이아웃이라 흐름을 안 먹는다) · 코트 라벨 · 패딩 · nav gap 이다.
 *
 *  이 합이 판 높이를 넘으면 **서랍 손잡이가 화면 밖으로 나가 작도·설명에 영영 못 닿는다**
 *  (RAIL_STYLE_H:156-164 이 기록한 *"1번 선수를 영영 못 잡는다"* 사고의 세로판). 그래서 이 값은
 *  "보기 좋은가" 가 아니라 **도달 가능성**의 문제다.
 *
 *  실측(hit 44, 5열 = 폭 240): 26(패딩) + 36(gap 6칸) + 44(줌 1줄) + 44(이력 1줄) + 18(구분선 2)
 *  + 50(도구 1줄) + 14(코트 이름) = **232**. 1024×600 의 판 높이 468 에 견주면 벤치에 236 이
 *  남고 벤치가 요구하는 것은 181 이다 — 이력 둘이 들어와도 스크롤은 안 생긴다.
 *  P2 종료 시점(고정 396 · 벤치 72)에서 뒤집힌 값이고, 뒤집은 것은 폭이다(2열 93 → 5열 240). */
export function trayFixedHeightPx(hitPx: number, cols: number): number {
  const w = trayRowWidthPx(hitPx, cols);
  const toolW = Math.max(TOOL_BTN_W, hitPx);
  const toolH = Math.max(TOOL_BTN_H, hitPx);
  return (
    TRAY_PAD_Y * 2 +
    TRAY_GAP * (TRAY_SECTIONS - 1) +
    (TRAY_DIVIDER_H + TRAY_DIVIDER_MARGIN_Y * 2) +
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
// ⚠️ 2026-08-14 — 여기 있던 **띠 줄나눔 모형**(`TrayBandSection` · `trayBandSectionsPx` ·
// `TrayBandLayout` · `trayBandLayoutAt`)을 지웠다. 띠가 `nowrap` 1행이 되면서(기현님 결정,
// trayBandHeightPx 머리말) "몇 줄로 흐르는가" 라는 물음 자체가 사라졌기 때문이다.
// 그 모형은 화면이 정말 2행인지를 폭에서 다시 계산해 높이 식과 맞대는 **하네스 검증**이었다 —
// 지금 같은 자리를 지키는 것은 `overflowX:'auto'`(유일한 도달 경로)와 ToolRail.band.test 의
// nowrap 단언이다.

export function trayBenchHeightPx(hitPx: number, cols: number, chips: number): number {
  const chip = trayChipBoxPx(hitPx);
  const boxW = Math.max(TOOL_BTN_W, hitPx);
  const boxH = Math.max(TOOL_BTN_H, hitPx);
  const w = trayRowWidthPx(hitPx, cols);
  const chipRows = Math.max(1, Math.ceil(chips / cols));
  const chipBlock = chipRows * chip.h + (chipRows - 1) * CHIP_ROW_GAP;
  return chipBlock + TRAY_GAP + stack(3, perRow(w, boxW), boxH);
}
