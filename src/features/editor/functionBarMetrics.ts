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

/** 바에 상시 서는 칸 수 — 확대·축소·**100%** · 되돌·다시 · 코트·골대·비우기 ·
 *  내보내기·속도·보기·**도움말** · **저장**. 접힌 것(코트 모달 · 보기 서랍 2)은 닫히면 DOM 에
 *  없으므로 여기에도 §3 표적 예산에도 안 센다.
 *  2026-08-14 에 [드릴로 저장]이 헤더에서 내려오며 11 → 12, 2026-08-15 에 [진영]이 붙어 13.
 *  2026-08-16 에 [진영]이 코트 모달로 들어가고 [도움말]이 [보기] 메뉴에서 나오며 **13 그대로**
 *  다 — 하나가 빠지고 하나가 들어왔다. 우연이 아니라 그 교환이 이번 지시의 내용이다.
 *
 *  ⚠️ **화면과 이 숫자가 어긋나면 아무도 안 잡던 자리였다.** 2026-08-15 에 [진영]을 더하고도
 *  이 상수가 12 로 남아 전체 테스트가 초록이었다 — 그 어긋남은 열 수 계산(functionBarColumnsAt)
 *  을 통해 **코트 상자 폭**을 틀리게 만들고, 그 오차가 판 회전 판정을 뒤집을 수 있다.
 *  그래서 FunctionBar.items.test.tsx 가 이제 화면의 칸을 실제로 세어 이 값과 대조한다. */
export const FUNCTION_BAR_ITEMS = 13;
/** 드릴 편집의 칸 수 — 전술판에서 **[비우기]·[저장] 둘이 빠진다.**
 *
 *  [비우기]가 빠지는 이유: 전술판의 [코트 비우기]는 *"되돌릴 수 없습니다"* 인 판 초기화다.
 *  드릴에는 되돌리기가 있고 스텝이라는 시간축이 있어 "비운다" 가 무엇을 뜻하는지(이 스텝만?
 *  이후 전부?) 가 한 가지로 정해지지 않는다. 뜻이 둘인 파괴적 조작을 한 칸에 욱여넣지 않는다 —
 *  스텝 단위로 지우는 길은 개체 메뉴와 선택 후 Delete 가 이미 갖고 있다.
 *
 *  [저장]이 빠지는 이유(2026-08-20, 옛 기록: 여기는 12 였다) — 드릴 편집의 [저장] 칸은
 *  "드릴로 저장"이 아니라 "자동저장을 지금 밀어넣기"였다. 자동저장이 이미 돌고 있는 마당에
 *  누를 이유가 없는 칸이라 기현님이 지워 달라 하셨다 — 단축키(Ctrl+S 상당, useEditorKeyboard
 *  onSave)는 그대로 있으니 "지금 바로" 가 필요하면 그 길로 간다. FunctionBar.tsx 는 이제
 *  [저장] 칸 자체를 `isBoard` 일 때만 그린다.
 *
 *  ⚠️ **이 값이 전술판과 다르다는 사실 자체가 예산에 실려야 한다**(아래 `functionBarItemsFor`).
 *  한 숫자로 뭉개면 드릴 편집에서 열 수 계산이 한 칸만큼 틀리고, 그 오차가 코트 상자 폭을
 *  거쳐 판 회전 판정을 뒤집을 수 있다. */
export const FUNCTION_BAR_ITEMS_DRILL = 11;

/** 이 화면의 칸 수. 예산(chromeBudget)과 화면(FunctionBar)이 **같은 함수**를 봐야 한다. */
export const functionBarItemsFor = (board: boolean): number => (board ? FUNCTION_BAR_ITEMS : FUNCTION_BAR_ITEMS_DRILL);
/** 구역을 가르는 선 — 줌 | 이력 | 판 | 앱 | 저장(전술판만). */
export const FUNCTION_BAR_DIVIDERS = 4;
/** 드릴 편집의 구분선 수 — [저장] 구역 자체가 없으니 그 앞 선도 함께 없다(2026-08-20).
 *  줌 | 이력 | 판 | 앱, 넷을 가르는 선 셋. */
export const FUNCTION_BAR_DIVIDERS_DRILL = 3;
/** 이 화면의 구분선 수 — `functionBarItemsFor` 와 짝이다. 예산이 칸 수만 board 로 가르고
 *  구분선은 그대로 4를 쓰면, 드릴 편집에서 1열 요구 높이가 실제 화면(구분선 3)보다 9px
 *  (DIVIDER_H) + 1px(GAP) 크게 계산돼 회전·상자 폭 판정이 조용히 틀어진다. */
export const functionBarDividersFor = (board: boolean): number => (board ? FUNCTION_BAR_DIVIDERS : FUNCTION_BAR_DIVIDERS_DRILL);

export const FUNCTION_BAR_GAP = 1;
export const FUNCTION_BAR_PAD_Y = 10;
export const FUNCTION_BAR_PAD_X = 6;
/** 구분선 한 줄이 먹는 세로 = 선 1 + 상하 margin 4씩. */
export const FUNCTION_BAR_DIVIDER_H = 9;

/** 한 칸의 높이. 아이콘 18 + gap 1 + 이름 10 + 패딩 6 = 35 이므로 `--hit` 의 min 이 언제나 이긴다.
 *  즉 칸 높이는 곧 `--hit` 다 — 이름 줄을 더해도 칸이 안 커진다는 것이 이 식의 요점이다. */
export const functionBarItemHeightPx = (hitPx: number): number => hitPx;

/** 1열일 때 바가 요구하는 세로. 이 값이 `<main>` 높이를 넘으면 화면은 2열로 흐른다.
 *  `dividers` 는 board 는 4, 드릴은 3 — 기본값은 board(호출부 대부분이 board 예산이던 옛
 *  시절의 관성이고, 드릴을 재는 곳(chromeBudget)은 반드시 명시로 넘긴다). */
export function functionBarContentHeightPx(hitPx: number, items: number = FUNCTION_BAR_ITEMS, dividers: number = FUNCTION_BAR_DIVIDERS): number {
  return (
    FUNCTION_BAR_PAD_Y * 2 +
    items * functionBarItemHeightPx(hitPx) +
    (items + dividers - 1) * FUNCTION_BAR_GAP +
    dividers * FUNCTION_BAR_DIVIDER_H
  );
}

/** 열 `cols` 개일 때의 바 폭. 예산표가 쓰는 것은 `cols = 1` 이다. */
export function functionBarWidthPx(hitPx: number, cols = 1): number {
  return cols * hitPx + FUNCTION_BAR_PAD_X * 2;
}

/** 높이 `availPx` 에서 실제로 몇 열이 되는가. 화면의 `flexWrap` 이 하는 계산과 같은 식이다. */
export function functionBarColumnsAt(hitPx: number, availPx: number, items: number = FUNCTION_BAR_ITEMS, dividers: number = FUNCTION_BAR_DIVIDERS): number {
  const need = functionBarContentHeightPx(hitPx, items, dividers);
  if (availPx <= 0) return 1;
  return Math.max(1, Math.ceil(need / Math.max(1, availPx)));
}
