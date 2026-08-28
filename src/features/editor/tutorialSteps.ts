// 드릴 편집 튜토리얼 8단계 — docs/PLAN-HELP-TUTORIAL.md §D. 이 화면이 엔진의 실기 검증대다
// (가장 복잡한 화면 — 코트·트레이·사이드바·기능바가 한 화면에 다 있다).
import type { TutorialStep } from '../../ui/tutorial/types.ts';

export const EDITOR_TUTORIAL_STEPS: TutorialStep[] = [
  { target: 'editor-step-sidebar', titleKey: 'tutorial.editor.step1.title', bodyKey: 'tutorial.editor.step1.body' },
  { target: 'editor-add-step', titleKey: 'tutorial.editor.step2.title', bodyKey: 'tutorial.editor.step2.body' },
  { target: 'editor-tray', titleKey: 'tutorial.editor.step3.title', bodyKey: 'tutorial.editor.step3.body' },
  { target: 'editor-court', titleKey: 'tutorial.editor.step4.title', bodyKey: 'tutorial.editor.step4.body' },
  { target: 'editor-playback', titleKey: 'tutorial.editor.step5.title', bodyKey: 'tutorial.editor.step5.body' },
  { target: 'editor-note', titleKey: 'tutorial.editor.step6.title', bodyKey: 'tutorial.editor.step6.body' },
  { target: 'drill-info', titleKey: 'tutorial.editor.step7.title', bodyKey: 'tutorial.editor.step7.body' },
  { target: 'header-primary', titleKey: 'tutorial.editor.step8.title', bodyKey: 'tutorial.editor.step8.body' },
];

// 자유 전술판 튜토리얼 5단계 — docs/PLAN-HELP-TUTORIAL.md §D. 트레이·코트는 드릴 편집과
// 같은 컴포넌트(ToolRail·코트 래퍼)라 data-tut 를 그대로 재사용한다.
export const BOARD_TUTORIAL_STEPS: TutorialStep[] = [
  { target: 'editor-tray', titleKey: 'tutorial.board.step1.title', bodyKey: 'tutorial.board.step1.body' },
  { target: 'editor-court', titleKey: 'tutorial.board.step2.title', bodyKey: 'tutorial.board.step2.body' },
  { target: 'board-draw', titleKey: 'tutorial.board.step3.title', bodyKey: 'tutorial.board.step3.body' },
  { target: 'board-functionbar', titleKey: 'tutorial.board.step4.title', bodyKey: 'tutorial.board.step4.body' },
  { target: 'board-save', titleKey: 'tutorial.board.step5.title', bodyKey: 'tutorial.board.step5.body' },
];
