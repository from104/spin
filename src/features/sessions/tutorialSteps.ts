// 세션 목록 튜토리얼 3단계 · 세션 편집 튜토리얼 6단계 — 정본은
// docs/PLAN-HELP-OVERHAUL.md §2.2(2026-09-08 증설). 그 이전 정본이던
// docs/PLAN-HELP-TUTORIAL.md §D 는 2단계·5단계였다.
// [새 세션]도 AppShell 이 정적으로 꽂는 헤더 주 액션이라 header-primary 를 재사용한다
// (드릴 목록과 같은 자리, 다른 라벨).
//
// ⚠️ 키 번호는 순서가 아니라 이름이다 — 근거는 library/tutorialSteps.ts 머리말.
import type { TutorialStep } from '../../ui/tutorial/types.ts';

export const SESSIONS_TUTORIAL_STEPS: TutorialStep[] = [
  { target: 'header-primary', titleKey: 'tutorial.sessions.step1.title', bodyKey: 'tutorial.sessions.step1.body' },
  { target: 'sessions-card', titleKey: 'tutorial.sessions.step2.title', bodyKey: 'tutorial.sessions.step2.body' },
  { target: 'sessions-card-menu', titleKey: 'tutorial.sessions.step3.title', bodyKey: 'tutorial.sessions.step3.body' },
];

// 세션 편집 튜토리얼 6단계.
export const SESSION_EDITOR_TUTORIAL_STEPS: TutorialStep[] = [
  { target: 'sessionEditor-info', titleKey: 'tutorial.sessionEditor.step1.title', bodyKey: 'tutorial.sessionEditor.step1.body' },
  // ★ 실습형 — 구획 하나를 실제로 더한다. 더한 구획은 그 자리에서 지울 수 있어 되돌릴 수 있다(결정 12).
  {
    target: 'sessionEditor-addphase',
    titleKey: 'tutorial.sessionEditor.step2.title',
    bodyKey: 'tutorial.sessionEditor.step2.body',
    advanceOnClick: true,
  },
  { target: 'sessionEditor-adddrill', titleKey: 'tutorial.sessionEditor.step3.title', bodyKey: 'tutorial.sessionEditor.step3.body' },
  { target: 'sessionEditor-allocation', titleKey: 'tutorial.sessionEditor.step4.title', bodyKey: 'tutorial.sessionEditor.step4.body' },
  { target: 'sessionEditor-participants', titleKey: 'tutorial.sessionEditor.step5.title', bodyKey: 'tutorial.sessionEditor.step5.body' },
  // ⚠️ 계획서 §2.2 는 이 단계를 `header-primary` 로 적었지만 그것은 이 화면에서 **[새 세션]**
  // 이다(세션 편집은 screen==='sessions' 아래에 그려진다) — 근거는 SessionEditorScreen.tsx 의
  // 앵커 주석. 실제 [세션 시연] 버튼을 가리킨다.
  { target: 'sessionEditor-present', titleKey: 'tutorial.sessionEditor.step6.title', bodyKey: 'tutorial.sessionEditor.step6.body' },
];
