// 오른쪽 기능 바의 순수 치수 (2026-08-14 기현님 재설계).
//
// 화면(FunctionBar.tsx)과 크롬 예산(chromeBudget.ts)이 **같은 상수에서** 조립되게 하려고 뺐다.
// 저쪽에 리터럴을 다시 적으면 예산표와 화면이 조용히 갈라지고, 그때 거짓말을 하는 것은
// 화면이 아니라 표다(트레이가 trayMetrics 로 간 길과 같다).
//
// ── 왜 "1열에 들어가는가" 가 계약인가 ────────────────────────────────────────────────
// 바는 `flexWrap:'wrap'` 이라 안 들어가면 둘째 열로 흐른다 — 잘리지는 않는다. 그래도 1열을
// 지키려는 이유는 **예산표**다: 예산의 `functionBar` 행은 1열 폭(hit+12)으로 잡혀 있고, 실제로
// 2열이 되면 코트 상자가 그 열 폭만큼 실제보다 크게 계산된다. 그 오차가 판 회전(rot) 판정을
// 뒤집을 수 있다.
//
// ⚠️ 2026-08-14 — 이제 **예산이 열 수를 직접 센다**(`courtBoxPx` 가 창 높이로 이 함수를 부른다).
// 칸이 12로 늘면서 1열 요구가 599px 이 됐고, 800×480 같은 짧은 창은 어떻게 맞춰도 2열이기
// 때문이다. 맞춰 놓는 대신 **재는 쪽으로** 바꾼 것이고, 그래서 gap 1 · 패딩 10 은 이제
// "1열을 지키려는 값" 이 아니라 그냥 촘촘한 리듬이다. 1024×600 은 여전히 1열이다(599 ≤ 600).

/** 바에 상시 서는 칸 수 — 확대·축소·초기화 · 되돌·다시 · 코트·골대·**진영**·비우기 ·
 *  내보내기·속도·보기 · **저장**. 팝오버 안(코트 6 · 보기 3)은 닫히면 DOM 에 없으므로 여기에도
 *  §3 표적 예산에도 안 센다.
 *  2026-08-14 에 [드릴로 저장]이 헤더에서 내려오며 11 → 12, 2026-08-15 에 [진영]이 붙어 13.
 *
 *  ⚠️ **화면과 이 숫자가 어긋나면 아무도 안 잡던 자리였다.** 2026-08-15 에 [진영]을 더하고도
 *  이 상수가 12 로 남아 전체 테스트가 초록이었다 — 그 어긋남은 열 수 계산(functionBarColumnsAt)
 *  을 통해 **코트 상자 폭**을 틀리게 만들고, 그 오차가 판 회전 판정을 뒤집을 수 있다.
 *  그래서 FunctionBar.items.test.tsx 가 이제 화면의 칸을 실제로 세어 이 값과 대조한다. */
export const FUNCTION_BAR_ITEMS = 13;
/** 구역을 가르는 선 — 줌 | 이력 | 판 | 앱 | 저장. */
export const FUNCTION_BAR_DIVIDERS = 4;

export const FUNCTION_BAR_GAP = 1;
export const FUNCTION_BAR_PAD_Y = 10;
export const FUNCTION_BAR_PAD_X = 6;
/** 구분선 한 줄이 먹는 세로 = 선 1 + 상하 margin 4씩. */
export const FUNCTION_BAR_DIVIDER_H = 9;

/** 한 칸의 높이. 아이콘 18 + gap 1 + 이름 10 + 패딩 6 = 35 이므로 `--hit` 의 min 이 언제나 이긴다.
 *  즉 칸 높이는 곧 `--hit` 다 — 이름 줄을 더해도 칸이 안 커진다는 것이 이 식의 요점이다. */
export const functionBarItemHeightPx = (hitPx: number): number => hitPx;

/** 1열일 때 바가 요구하는 세로. 이 값이 `<main>` 높이를 넘으면 화면은 2열로 흐른다. */
export function functionBarContentHeightPx(hitPx: number): number {
  return (
    FUNCTION_BAR_PAD_Y * 2 +
    FUNCTION_BAR_ITEMS * functionBarItemHeightPx(hitPx) +
    (FUNCTION_BAR_ITEMS + FUNCTION_BAR_DIVIDERS - 1) * FUNCTION_BAR_GAP +
    FUNCTION_BAR_DIVIDERS * FUNCTION_BAR_DIVIDER_H
  );
}

/** 열 `cols` 개일 때의 바 폭. 예산표가 쓰는 것은 `cols = 1` 이다. */
export function functionBarWidthPx(hitPx: number, cols = 1): number {
  return cols * hitPx + FUNCTION_BAR_PAD_X * 2;
}

/** 높이 `availPx` 에서 실제로 몇 열이 되는가. 화면의 `flexWrap` 이 하는 계산과 같은 식이다. */
export function functionBarColumnsAt(hitPx: number, availPx: number): number {
  const need = functionBarContentHeightPx(hitPx);
  if (availPx <= 0) return 1;
  return Math.max(1, Math.ceil(need / Math.max(1, availPx)));
}
