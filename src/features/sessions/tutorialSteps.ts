// 세션 목록 튜토리얼 2단계 — docs/PLAN-HELP-TUTORIAL.md §D. [새 세션]도 AppShell 이 정적으로
// 꽂는 헤더 주 액션이라 header-primary 를 재사용한다(드릴 목록과 같은 자리, 다른 라벨).
import type { TutorialStep } from '../../ui/tutorial/types.ts';

export const SESSIONS_TUTORIAL_STEPS: TutorialStep[] = [
  { target: 'header-primary', titleKey: 'tutorial.sessions.step1.title', bodyKey: 'tutorial.sessions.step1.body' },
  { target: 'sessions-card', titleKey: 'tutorial.sessions.step2.title', bodyKey: 'tutorial.sessions.step2.body' },
];
