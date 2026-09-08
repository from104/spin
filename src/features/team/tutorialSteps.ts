// 팀 화면 튜토리얼 5단계 — 정본은 docs/PLAN-TEAM.md 결정 23(목록 → [새 팀] → 선수 추가 ★실습
// → 라인업 → 내보내기). 앵커 이름은 같은 계획서 §2 C 의 `data-tut` 목록 그대로다.
//
// ⚠️ 키 번호는 순서가 아니라 이름이다 — 근거는 library/tutorialSteps.ts 머리말.
//
// ⚠️ **이 투어는 목록과 상세를 가로지른다.** step1·step2 의 앵커는 목록에, step3~step5 의
// 앵커는 팀 상세에 있다. `useTutorial` 은 그 순간 DOM 에 없는 앵커를 **건너뛰므로**, 상세를
// 열지 않은 채 [다음]만 누르면 뒤 세 단계가 조용히 사라진다. 그래서 step2([새 팀])에도
// `advanceOnClick` 을 단다 — 누르면 팀이 만들어지며 상세가 열리고, 그때 비로소 뒤 단계의
// 앵커가 생긴다. 계획서가 ★실습으로 지목한 것은 step3 하나지만, 그 실습에 **도달할 수 있게
// 하는 것**이 step2 의 몫이다(2026-09-09).
//   → 이 때문에 `useTutorial('team', …)` 은 목록만 감싸는 자리가 아니라 **목록·상세를 함께
//     감싸는 화면 컨테이너**에 걸어야 한다. 목록 컴포넌트에만 걸면 상세로 가는 순간 투어
//     상태가 언마운트와 함께 사라진다.
//
// 두 실습형 모두 **되돌릴 수 있는 조작**이다(types.ts 의 계약): 만든 팀은 카드 ⋮ [삭제] 로,
// 더한 선수는 행의 삭제로 지울 수 있고 둘 다 8초 [되돌리기] 가 붙는다. 파괴적 단추
// (삭제·비우기)에는 절대 달지 않는다.
import type { TutorialStep } from '../../ui/tutorial/types.ts';

export const TEAM_TUTORIAL_STEPS: TutorialStep[] = [
  { target: 'team-list', titleKey: 'tutorial.team.step1.title', bodyKey: 'tutorial.team.step1.body' },
  // ★ 실습형 — 누르면 팀이 생기고 상세가 열린다(위 머리말).
  {
    target: 'team-new',
    titleKey: 'tutorial.team.step2.title',
    bodyKey: 'tutorial.team.step2.body',
    advanceOnClick: true,
  },
  // ★ 실습형 — 선수 한 명을 실제로 더한다. 계획서 결정 23 이 지목한 실습 단계다.
  {
    target: 'team-player-add',
    titleKey: 'tutorial.team.step3.title',
    bodyKey: 'tutorial.team.step3.body',
    advanceOnClick: true,
  },
  { target: 'team-lineup', titleKey: 'tutorial.team.step4.title', bodyKey: 'tutorial.team.step4.body' },
  { target: 'team-export', titleKey: 'tutorial.team.step5.title', bodyKey: 'tutorial.team.step5.body' },
];
