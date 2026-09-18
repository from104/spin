// PLAN-UI-SCALE 결정 3 — 「자동」이 고르는 배율.
//
// ── 2026-09-19 기현님 재정의 ───────────────────────────────────────────────────────────
// > "자동"의 비율 기준은 "보드" 화면에서 풀코트 판이 상하좌우 꽉 차 있으면서 왼쪽(위) 레일,
// > 아래쪽(오른쪽) 트레이가 최대 크기면서 둘다 스크롤이 안 되는 상태
//
// **옛 기준(표적의 물리 크기, 9mm)은 폐기됐다.** 근거를 지우지 않고 남긴다: 그 기준은 «누를 수
// 있는 가장 작은 배율» 을 골랐는데, 안드로이드에서 44 CSS px = 7.0mm 라 어떤 가이드라인에도
// 미달이어서 자동이 **100% 아래로 내려갈 수 없었다** — 즉 지시문의 «보드가 최대로 커지는 쪽» 과
// 늘 반대로 움직였다. 새 기준은 화면을 직접 본다: 레일과 트레이가 제 크기로 다 들어가는
// **가장 큰** 배율이면, 그보다 한 눈금 큰 배율은 무언가를 스크롤시킨다.
//
// ── 왜 «판이 꽉 찬다» 는 조건이 식에 안 보이는가 ────────────────────────────────────────
// 보드 화면은 `boardSplitPx` 가 코트에 `높이 × (825/525)` 를 주고 **남는 폭을 전부 트레이에**
// 주도록 짜여 있다. 그래서 판은 어느 배율에서도 상하좌우가 꽉 찬다(에뮬레이터 실측: 배율 7단
// 전부에서 코트 종횡비가 1.571 = 825:525 로 일정). 조건이 이미 참이라 식에 남는 것은 스크롤
// 둘뿐이다 — 이것은 생략이 아니라 **그 조건이 레이아웃에 의해 항상 만족된다는 사실**이다.
import { RAIL_W, railContentHeightPx } from './railMetrics.ts';
import { COURT_PAD_PX } from './chromeBudget.ts';
import { UI_SCALE_STEPS } from '../core/uiScale.ts';
import type { UiScaleSetting, UiScaleStep } from '../core/uiScale.ts';
import { functionBarWidthPx } from '../features/editor/functionBarMetrics.ts';
import { TRAY_BAND_BOARD_PARTS, trayBandContentWidthPx, trayFixedHeightPx, trayBenchHeightPx, TRAY_MIN_COLS } from '../features/editor/trayMetrics.ts';

/** 자동이 보는 화면 — 배율 래퍼가 실제로 받는 상자(= `#root` 의 내용 상자, safe-area 를 뺀 값)와
 *  창 방향. 배율은 **이 상자를 나누는 수**이므로 여기 들어오는 값은 배율과 무관해야 한다. */
export interface AutoUiScaleInput {
  /** 배율 1 일 때의 레이아웃 폭·높이(CSS px). */
  availW: number;
  availH: number;
  landscape: boolean;
  /** `--hit`(기본 44, 큰 표적 56). */
  hitPx: number;
  /** 웹 배포본에서만 서는 [데스크톱 앱 받기] 칸 — 레일이 한 칸 길어진다. */
  railDownloadBtn?: boolean;
}

/** 가로 화면에서 띠가 쓸 수 있는 폭을 코트 열에서 빼는 것들 — 레일 · 오른쪽 기능 바 · 코트 래퍼 좌우 패딩.
 *  숫자를 여기 다시 적지 않는다: 셋 다 자기 모듈이 답한다(그래야 한 쪽만 바뀌는 일이 없다). */
function bandChromeWidthPx(hitPx: number): number {
  return RAIL_W + functionBarWidthPx(hitPx) + COURT_PAD_PX.narrow.x * 2;
}

/** 그 방향에서 **스크롤이 시작되지 않는 최대 배율**(연속값). 눈금으로 내리는 것은 아래가 한다.
 *
 *  배율 s 에서 레이아웃 크기는 `avail / s` 다(래퍼가 `transform: scale(s)`). 그래서
 *  «내용이 들어간다» 는 `내용 ≤ avail / s`, 즉 `s ≤ avail / 내용` 이다 — 두 제약의 **최솟값**이 답. */
export function maxFittingScale(input: AutoUiScaleInput): number {
  const { availW, availH, landscape, hitPx } = input;
  if (availW <= 0 || availH <= 0) return 1;

  if (landscape) {
    // ① 왼쪽 레일이 세로로 다 들어간다 — 레일은 앱 높이를 통째로 쓴다.
    const byRail = availH / railContentHeightPx({ downloadBtn: input.railDownloadBtn });
    // ② 아래 띠가 가로로 다 들어간다 — 띠는 코트 열의 폭을 쓴다(레일·기능 바·패딩을 뺀 나머지).
    const byBand = availW / (trayBandContentWidthPx(hitPx, TRAY_BAND_BOARD_PARTS) + bandChromeWidthPx(hitPx));
    return Math.min(byRail, byBand);
  }

  // 세로 화면: 레일이 없고 내비는 헤더 위 **아이콘 줄**이라 6칸이 어느 폭에서도 들어간다
  // (6 × --hit ≈ 264). 대신 트레이가 **오른쪽 기둥**이 되어 세로로 스크롤할 수 있다 —
  // 그쪽이 유일한 문턱이다. 기둥의 안 스크롤되는 세로 합은 trayMetrics 가 답한다.
  const column = trayFixedHeightPx(hitPx, TRAY_MIN_COLS) + trayBenchHeightPx(hitPx, TRAY_MIN_COLS, TRAY_BAND_BOARD_PARTS.chips);
  return availH / column;
}

/** 「자동」의 답 — `maxFittingScale` 을 **넘지 않는 가장 큰 눈금**.
 *
 *  어느 눈금도 못 넘으면 **가장 작은 눈금**을 준다: 그 화면은 무엇을 해도 비좁으므로, 스크롤을
 *  감수하더라도 판이 가장 큰 쪽이 낫다(지시문의 "보드가 최대로 커지는 쪽"). */
export function autoUiScale(input: AutoUiScaleInput): UiScaleStep {
  const max = maxFittingScale(input);
  let picked: UiScaleStep = UI_SCALE_STEPS[0];
  for (const s of UI_SCALE_STEPS) {
    if (s <= max) picked = s;
  }
  return picked;
}

/** 설정값 → 실제로 화면에 거는 배율. 화면·이펙트는 **이 함수만** 부른다. */
export function resolveUiScale(setting: UiScaleSetting, input: AutoUiScaleInput): UiScaleStep {
  return setting === 'auto' ? autoUiScale(input) : setting;
}
