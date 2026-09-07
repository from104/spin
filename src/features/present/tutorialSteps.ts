// 시연 튜토리얼 6단계 — 정본은 docs/PLAN-HELP-OVERHAUL.md §2.2(2026-09-08 증설).
// 그 이전 정본이던 docs/PLAN-HELP-TUTORIAL.md §D 는 4단계였다.
// [편집으로]/[세션으로]는 useAppHeader 의 primary 라 드릴 편집과 같은
// data-tut="header-primary" 를 재사용한다.
//
// ⚠️ 키 번호는 순서가 아니라 이름이다 — 근거는 library/tutorialSteps.ts 머리말.
import type { TutorialStep } from '../../ui/tutorial/types.ts';

export const PRESENT_TUTORIAL_STEPS: TutorialStep[] = [
  // ★ 실습형 — 재생/정지는 판을 바꾸지 않는다.
  { target: 'present-playback', titleKey: 'tutorial.present.step1.title', bodyKey: 'tutorial.present.step1.body', advanceOnClick: true },
  { target: 'present-progress', titleKey: 'tutorial.present.step2.title', bodyKey: 'tutorial.present.step2.body' },
  { target: 'present-sidebar', titleKey: 'tutorial.present.step3.title', bodyKey: 'tutorial.present.step3.body' },
  // 세로바 안의 두 칸을 각각 가리킨다. [정보]는 드릴이 있을 때만 그려지므로(onDrillInfo 가
  // 없으면 칸 자체가 없다) 없는 화면에서는 이 단계만 빈 화면 가드로 빠진다.
  { target: 'present-info', titleKey: 'tutorial.present.step5.title', bodyKey: 'tutorial.present.step5.body' },
  { target: 'present-fullscreen', titleKey: 'tutorial.present.step6.title', bodyKey: 'tutorial.present.step6.body' },
  { target: 'header-primary', titleKey: 'tutorial.present.step4.title', bodyKey: 'tutorial.present.step4.body' },
];
