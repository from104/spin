// 드래그 재정렬 순수 함수 모음. 이름의 '하단 바' 는 역사다 — 2026-08-18 하단 바(BoardBar·
// TransportBar)가 통째로 폐지되며 치수 상수·높이 식(BOTTOM_BAR_*·bottomBarPadCss·
// barHintStackPx·transportBarHeightPx·boardBarHeightPx)은 바와 함께 지웠다(예산표의
// 'transportBar' 행도 은퇴 — chromeBudget.ts 그 행 주석). 남은 것은 축과 무관한 재정렬
// 순수 함수 넷이고, StepSidebar 의 세로 카드 목록이 부른다.
//
// 컴포넌트 파일(.tsx)이 아니라 여기 두는 이유는 trayMetrics.ts 와 같다 — 컴포넌트 파일에서
// 함수를 내보내면 react-refresh 경고가 늘고, 테스트가 순수 함수를 화면 없이 대조할 수 없다.
//
// 2026-08-17 — 스텝 칩(가로 비율) 전용 함수 셋(stepChipAspect·stepChipBoxPx·stepChipWidthCss)은
// PLAN-STEP-EDITING.md 구현 순서 ②로 TransportBar 의 가로 칩 줄이 사라지며 함께 지웠다.

/** 끌고 있는 항목이 놓일 자리. `centers` 는 지금 화면에 보이는 순서대로의 항목 중심 좌표다.
 *  **자기 자신은 세지 않는다** — 세면 자기 중심을 지나는 순간 옆칸으로 튄다(손을 대자마자 이동).
 *
 *  ⚠️ 상한이 `centers.length - 1` 이지 `centers.length` 가 아니다 — **단일** 항목을 옮기는
 *  경우에만 맞는 값이다. `centers` 가 전체 N 개(자기 자신 포함)를 담고 있고, `moveStep` 의
 *  `to` 도메인이 `[0,N)`(N 개 값)이라 `centers.length-1` 이 그 상한과 정확히 일치한다.
 *  **묶음**을 옮길 때는 이 함수를 쓰지 마라 — `dropIndexInRest` 를 대신 써야 한다(그 함수
 *  머리말이 왜 상한이 다른지 설명한다). */
export function dropIndexAt(centers: readonly number[], x: number, from: number): number {
  let to = 0;
  for (let i = 0; i < centers.length; i++) {
    if (i === from) continue;
    if (centers[i]! < x) to++;
  }
  return Math.min(Math.max(to, 0), Math.max(centers.length - 1, 0));
}

/** ⑤ 다중 선택 일괄 이동(기현님 확정 2026-08-17) 전용 — `dropIndexAt` 과 **상한이 다르다**.
 *  `centers` 는 그룹을 **뺀 나머지** M 개 항목의 중심 좌표다(자기 자신을 스스로 빼는 skip 이
 *  필요 없다 — 애초에 그룹 전체가 목록에서 빠져 있다). 묶음을 M 개 항목 사이에 꽂을 자리는
 *  **M+1 군데**다(맨 앞·항목 사이 M-1 군데·맨 뒤) — 그래서 상한이 `centers.length`(=M) 다,
 *  `dropIndexAt` 처럼 `length-1` 이 아니다. `moveSteps`(edits.ts)의 `toIndex` 도메인이
 *  `[0, rest.length]`(M+1 개 값)인 것과 정확히 맞아야 "맨 뒤로 끌었는데 한 칸 앞에 떨어진다"
 *  가 안 생긴다. */
export function dropIndexInRest(centers: readonly number[], x: number): number {
  let to = 0;
  for (let i = 0; i < centers.length; i++) {
    if (centers[i]! < x) to++;
  }
  return Math.min(Math.max(to, 0), centers.length);
}

/** from 에서 to 로 옮긴 새 배열(원본 불변). 드래그 중 **미리보기 순서**를 만든다 — 실제 커밋은
 *  손을 뗄 때 한 번뿐이다(칸을 넘을 때마다 dispatch 하면 되돌리기 한 번에 한 칸씩 되감긴다).
 *  edits.ts 의 `moveStep` 과 **같은 splice 규칙**이어야 미리보기와 커밋 결과가 일치한다 —
 *  bottomBarMetrics.test.ts 가 두 함수의 결과를 직접 대조한다. */
export function movedOrder<T>(items: readonly T[], from: number, to: number): T[] {
  const out = items.slice();
  if (from === to || from < 0 || from >= out.length || to < 0 || to >= out.length) return out;
  const [item] = out.splice(from, 1);
  out.splice(to, 0, item!);
  return out;
}

/** ⑤ 다중 선택 일괄 이동(기현님 확정 2026-08-17)의 드래그 **미리보기**. `movedOrder`(단일
 *  드래그)와 짝을 이루지만 좌표계가 다르다 — `toIndex` 는 **선택되지 않은 나머지 항목들의
 *  순서 안에서의 삽입 자리**다(0..나머지 길이). model/edits.ts `moveSteps`(실제 커밋)가 같은
 *  좌표계·같은 "나머지 사이에 묶음을 통째로 꽂는다" 규칙을 쓴다 — 이 둘이 갈리면 드래그 중
 *  보이는 자리와 손을 뗀 뒤 실제로 꽂히는 자리가 어긋난다(bottomBarMetrics.test.ts 가 두 함수를
 *  직접 대조한다, movedOrder/moveStep 대조와 같은 이유). */
export function movedOrderGroup<T extends { id: string }>(items: readonly T[], groupIds: ReadonlySet<string>, toIndex: number): T[] {
  const moving = items.filter((it) => groupIds.has(it.id));
  if (moving.length === 0) return items.slice();
  const rest = items.filter((it) => !groupIds.has(it.id));
  const at = Math.min(Math.max(toIndex, 0), rest.length);
  return [...rest.slice(0, at), ...moving, ...rest.slice(at)];
}
