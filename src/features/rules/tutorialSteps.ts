// 규칙 화면 튜토리얼 3단계 — docs/PLAN-RULES-REDESIGN.md §6(2026-08-22 주제별 재설계).
// 세 앵커 전부 카드 홈(RulesHome)에 있다 — 이 화면은 항상 홈으로 마운트되므로 첫 진입에서
// 3단계가 전부 살아남는다(useTutorial 의 빈 화면 가드). 상세 뷰에서 재시작하면 RulesScreen 이
// 먼저 홈으로 돌아온 뒤 재시도 루프로 start() 를 부른다(홈 앵커가 그려질 때까지 기다려야 하는
// 이유는 RulesScreen.tsx 의 RESTART_RETRY_MAX_FRAMES 주석 참고).
import type { TutorialStep } from '../../ui/tutorial/types.ts';

export const RULES_TUTORIAL_STEPS: TutorialStep[] = [
  { target: 'rules-home', titleKey: 'tutorial.rules.step1.title', bodyKey: 'tutorial.rules.step1.body' },
  { target: 'rules-card', titleKey: 'tutorial.rules.step2.title', bodyKey: 'tutorial.rules.step2.body' },
  { target: 'rules-appendix', titleKey: 'tutorial.rules.step3.title', bodyKey: 'tutorial.rules.step3.body' },
];
