// 드릴 편집 튜토리얼 8단계 — docs/PLAN-HELP-TUTORIAL.md §D. 이 화면이 엔진의 실기 검증대다
// (가장 복잡한 화면 — 코트·트레이·사이드바·기능바가 한 화면에 다 있다).
import type { TutorialStep } from '../../ui/tutorial/types.ts';

export const EDITOR_TUTORIAL_STEPS: TutorialStep[] = [
  { target: 'editor-step-sidebar', titleKey: 'tutorial.editor.step1.title', bodyKey: 'tutorial.editor.step1.body' },
  // ⚠️ 앵커 이름은 그대로지만 **가리키는 것이 바뀌었다**(2026-08-30). [한 장 더 찍기]
  //    버튼이 없어져(기현 지시) 이 앵커가 StepSidebar 의 **맨 뒤 틈 [+]** 로 옮겨 갔다.
  //    이름을 안 바꾼 이유: 가리키는 뜻('스텝을 늘리는 자리')이 같고, 이름을 바꾸면 문구
  //    키 8개의 번호까지 흔들린다. 본문(step2.body)은 [+] 를 설명하도록 3언어 고쳤다.
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
  { target: 'header-primary', titleKey: 'tutorial.board.step5.title', bodyKey: 'tutorial.board.step5.body' },
];
