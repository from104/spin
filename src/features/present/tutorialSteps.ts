// 시연 튜토리얼 4단계 — docs/PLAN-HELP-TUTORIAL.md §D. [편집으로]/[세션으로]는 useAppHeader 의
// primary 라 드릴 편집과 같은 data-tut="header-primary" 를 재사용한다.
import type { TutorialStep } from '../../ui/tutorial/types.ts';

export const PRESENT_TUTORIAL_STEPS: TutorialStep[] = [
  { target: 'present-playback', titleKey: 'tutorial.present.step1.title', bodyKey: 'tutorial.present.step1.body' },
  { target: 'present-progress', titleKey: 'tutorial.present.step2.title', bodyKey: 'tutorial.present.step2.body' },
  { target: 'present-sidebar', titleKey: 'tutorial.present.step3.title', bodyKey: 'tutorial.present.step3.body' },
  { target: 'header-primary', titleKey: 'tutorial.present.step4.title', bodyKey: 'tutorial.present.step4.body' },
];
