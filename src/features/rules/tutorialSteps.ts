// 규칙 화면 튜토리얼 3단계 — docs/PLAN-HELP-TUTORIAL.md §D.
// 기본 선택(제1조 — 필드)이 늘 목록·보드·노트 셋을 동시에 그리므로 첫 진입에서 3단계 전부
// 살아남는다(useTutorial 의 빈 화면 가드 — 목록에 없는 세 번째 대상만 고르면 자동 시작이
// 조용히 짧아진다).
import type { TutorialStep } from '../../ui/tutorial/types.ts';

export const RULES_TUTORIAL_STEPS: TutorialStep[] = [
  { target: 'rules-list', titleKey: 'tutorial.rules.step1.title', bodyKey: 'tutorial.rules.step1.body' },
  { target: 'rules-board', titleKey: 'tutorial.rules.step2.title', bodyKey: 'tutorial.rules.step2.body' },
  { target: 'rules-note', titleKey: 'tutorial.rules.step3.title', bodyKey: 'tutorial.rules.step3.body' },
];
