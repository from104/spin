// 자유 전술판의 **세션 상태** 캐시. 2026-08-14 기현님 지시:
// *"보드는 누를 때마다 새 화면이 아니라 항상 상태나 배치를 저장하고 불러와야 한다."*
//
// 배치(문서)는 원래도 돌아왔다 — `storage/board.ts` 스냅샷이 localStorage 에 있고, 다시 열면
// `loadBoard()` 가 읽는다. 돌아오지 않던 것은 **문서가 아닌 상태**다:
//
//   · 되돌리기·다시하기 이력 (past/future) — 판을 떠났다 오면 되돌리기 버튼이 죽어 있었다
//   · 선택 · 활성 도구 · 현재 스텝
//
// 그래서 배치는 그대로인데도 **다른 판을 새로 연 것처럼** 읽혔다.
//
// ⚠️ 왜 localStorage 가 아니라 메모리인가. 이력은 `Drill` 스냅샷 최대 50장이다(HISTORY_LIMIT).
// 그걸 디스크에 쓰면 편집할 때마다 판 전체를 50배로 직렬화하게 되고, 그 쓰기가 드래그 정착
// 경로에 얹힌다. 세션 안에서 "같은 판으로 돌아온다" 는 것이 요구사항이고, 새로고침 뒤에는
// 스냅샷(배치)만 살아나면 된다 — 이력까지 되살아나야 한다는 요구는 없었다.
//
// ⚠️ 그래서 **`unmount()` 후 다시 `render` 하는 것은 더 이상 "새로고침" 이 아니다.** 새로고침을
// 흉내내려면 `clearBoardSession()` 을 함께 불러야 한다. 안 부르면 스냅샷 경로를 검사하던
// 테스트가 캐시를 읽고 조용히 초록불이 된다.
import type { StageView } from '../../render/useStageMetrics.ts';
import type { EditorState } from '../../store/editor/reducer.ts';

export interface BoardSession {
  /** 리듀서 상태 통째로 — present 뿐 아니라 past/future/selection/tool/stepId 까지. */
  state: EditorState;
  // ⚠️ 2026-08-28 — `pristineBase` 가 여기 있었다. 코트 전환 게이트가 판 위 개체를 직접 세게
  //    되면서 리듀서 밖에 들고 다닐 기준선 자체가 없어졌다(EditorWorkspace 의 게이트 주석).
  /** 줌·패닝. 아직 배선 전이라 항상 undefined 다 — CourtStage 가 마운트마다 자기 view 를
   *  초기화하는 구조여서 별도 손질이 필요하다(그 이펙트를 건드리는 것은 다른 커밋의 일). */
  view?: StageView;
}

let cache: BoardSession | null = null;

export function readBoardSession(): BoardSession | null {
  return cache;
}

export function writeBoardSession(s: BoardSession): void {
  cache = s;
}

/** 세션을 끊는다. 테스트가 **새로고침을 흉내낼 때** 반드시 부른다(머리말 두 번째 경고). */
export function clearBoardSession(): void {
  cache = null;
}
