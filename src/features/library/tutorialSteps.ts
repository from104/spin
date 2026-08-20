// 드릴 목록 튜토리얼 3단계 — docs/PLAN-HELP-TUTORIAL.md §D. [새 드릴]은 AppShell 이 정적으로
// 꽂는 헤더 주 액션이라 드릴 편집과 같은 data-tut="header-primary" 를 그대로 재사용한다.
import type { TutorialStep } from '../../ui/tutorial/types.ts';

export const LIBRARY_TUTORIAL_STEPS: TutorialStep[] = [
  { target: 'header-primary', titleKey: 'tutorial.library.step1.title', bodyKey: 'tutorial.library.step1.body' },
  { target: 'library-card', titleKey: 'tutorial.library.step2.title', bodyKey: 'tutorial.library.step2.body' },
  { target: 'library-filters', titleKey: 'tutorial.library.step3.title', bodyKey: 'tutorial.library.step3.body' },
];
