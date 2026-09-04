// 전환 로더의 **열쇠** 계산 한 곳 (PLAN-0-6-3-LOADER-NOTICE 결정 10).
//
// 지시가 "왼쪽 레일 5개 간 전환" 이므로 열쇠는 이미 계산돼 있는 `activeRail` 하나다
// (`AppShell` 이 `railFor(...)` 로 뽑는 그 값). 같은 값에서 뽑아야 **표시(레일 활성)와
// 동작(로더)이 어긋날 수 없다** — 두 벌로 계산하면 레일은 [드릴]인데 로더는 안 뜨는 조합이
// 생긴다(`screens.ts railFor` 가 이미 지고 있는 규율이다).
//
// 부수 효과를 알고 넘긴다: 드릴 열기·시연 진입·규칙 주제 상세는 레일이 안 바뀌므로 로더가
// **안 뜬다.** 가장 무거운 마운트(EditorWorkspace + matter-js)가 맨몸으로 일어난다는 뜻이다.
// 넓히려면 이 함수 하나만 고친다 — 호출부(AppShell)와 상태기계(useAppLoader)는 열쇠가
// 무엇으로 만들어졌는지 모른다.
import type { RailKey } from '../screens.ts';

/** 로더를 다시 띄울지 가르는 문자열. 값이 바뀌면 전환 로더가 한 회 뜬다. */
export function loaderKeyFor(activeRail: RailKey): string {
  return activeRail;
}
