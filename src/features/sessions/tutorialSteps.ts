// 세션 목록 튜토리얼 2단계 — docs/PLAN-HELP-TUTORIAL.md §D. [새 세션]도 AppShell 이 정적으로
// 꽂는 헤더 주 액션이라 header-primary 를 재사용한다(드릴 목록과 같은 자리, 다른 라벨).
import type { TutorialStep } from '../../ui/tutorial/types.ts';

export const SESSIONS_TUTORIAL_STEPS: TutorialStep[] = [
  { target: 'header-primary', titleKey: 'tutorial.sessions.step1.title', bodyKey: 'tutorial.sessions.step1.body' },
  { target: 'sessions-card', titleKey: 'tutorial.sessions.step2.title', bodyKey: 'tutorial.sessions.step2.body' },
];

// 세션 편집 튜토리얼 5단계 — docs/PLAN-HELP-TUTORIAL.md §D.
export const SESSION_EDITOR_TUTORIAL_STEPS: TutorialStep[] = [
  { target: 'sessionEditor-info', titleKey: 'tutorial.sessionEditor.step1.title', bodyKey: 'tutorial.sessionEditor.step1.body' },
  { target: 'sessionEditor-addphase', titleKey: 'tutorial.sessionEditor.step2.title', bodyKey: 'tutorial.sessionEditor.step2.body' },
  { target: 'sessionEditor-adddrill', titleKey: 'tutorial.sessionEditor.step3.title', bodyKey: 'tutorial.sessionEditor.step3.body' },
  { target: 'sessionEditor-allocation', titleKey: 'tutorial.sessionEditor.step4.title', bodyKey: 'tutorial.sessionEditor.step4.body' },
  { target: 'sessionEditor-participants', titleKey: 'tutorial.sessionEditor.step5.title', bodyKey: 'tutorial.sessionEditor.step5.body' },
];
