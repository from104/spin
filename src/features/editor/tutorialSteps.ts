// 드릴 편집 튜토리얼 12단계 · 자유 전술판 튜토리얼 7단계 — 정본은
// docs/PLAN-HELP-OVERHAUL.md §2.2(2026-09-08 증설). 그 이전 정본이던
// docs/PLAN-HELP-TUTORIAL.md §D 는 8단계·5단계였다. 이 화면이 엔진의 실기 검증대다
// (가장 복잡한 화면 — 코트·트레이·사이드바·기능바가 한 화면에 다 있다).
//
// ⚠️ **키 번호는 순서가 아니라 이름이다.** 아래 배열은 step3 → step9 → step4 … 로 흐른다.
// 사이에 단계를 끼울 때 번호를 다시 매기지 않고 새 단계에 다음 빈 번호를 준다 — 밀면 세
// 로케일의 본문이 통째로 한 칸씩 옮겨 앉아야 하고, 그 작업은 조용히 어긋난다(아래 2026-08-30
// 주석이 앵커 이름에 대해 적어 둔 것과 같은 근거다).
import type { TutorialStep } from '../../ui/tutorial/types.ts';

export const EDITOR_TUTORIAL_STEPS: TutorialStep[] = [
  { target: 'editor-step-sidebar', titleKey: 'tutorial.editor.step1.title', bodyKey: 'tutorial.editor.step1.body' },
  // ⚠️ 앵커 이름은 그대로지만 **가리키는 것이 바뀌었다**(2026-08-30). [한 장 더 찍기]
  //    버튼이 없어져(기현 지시) 이 앵커가 StepSidebar 의 **맨 뒤 틈 [+]** 로 옮겨 갔다.
  //    이름을 안 바꾼 이유: 가리키는 뜻('스텝을 늘리는 자리')이 같고, 이름을 바꾸면 문구
  //    키 8개의 번호까지 흔들린다. 본문(step2.body)은 [+] 를 설명하도록 3언어 고쳤다.
  // ★ 실습형 — 스텝 하나가 실제로 늘어난다. 되돌리기(Ctrl+Z)로 되돌아간다(결정 12).
  { target: 'editor-add-step', titleKey: 'tutorial.editor.step2.title', bodyKey: 'tutorial.editor.step2.body', advanceOnClick: true },
  { target: 'editor-tray', titleKey: 'tutorial.editor.step3.title', bodyKey: 'tutorial.editor.step3.body' },
  { target: 'editor-tool-select', titleKey: 'tutorial.editor.step9.title', bodyKey: 'tutorial.editor.step9.body' },
  { target: 'editor-court', titleKey: 'tutorial.editor.step4.title', bodyKey: 'tutorial.editor.step4.body' },
  // ★ 실습형 — 재생은 판을 바꾸지 않는다. 가장 안전한 실습이다.
  { target: 'editor-playback', titleKey: 'tutorial.editor.step5.title', bodyKey: 'tutorial.editor.step5.body', advanceOnClick: true },
  { target: 'editor-note', titleKey: 'tutorial.editor.step6.title', bodyKey: 'tutorial.editor.step6.body' },
  { target: 'editor-functionbar', titleKey: 'tutorial.editor.step10.title', bodyKey: 'tutorial.editor.step10.body' },
  // 스텝이 하나뿐인 드릴에는 내부 틈이 없다 — 그때는 이 단계만 빈 화면 가드로 빠진다.
  { target: 'editor-gap', titleKey: 'tutorial.editor.step11.title', bodyKey: 'tutorial.editor.step11.body' },
  { target: 'drill-info', titleKey: 'tutorial.editor.step7.title', bodyKey: 'tutorial.editor.step7.body' },
  { target: 'editor-export', titleKey: 'tutorial.editor.step12.title', bodyKey: 'tutorial.editor.step12.body' },
  { target: 'header-primary', titleKey: 'tutorial.editor.step8.title', bodyKey: 'tutorial.editor.step8.body' },
];

// 자유 전술판 튜토리얼 7단계. 트레이·코트·도구·[내보내기]는 드릴 편집과 같은 컴포넌트
// (ToolRail·코트 래퍼·FunctionBar)라 data-tut 를 그대로 재사용한다. 기능바만 이름이 갈린다 —
// 같은 nav 가 화면에 따라 `board-functionbar` / `editor-functionbar` 로 뜬다(FunctionBar.tsx 근거).
export const BOARD_TUTORIAL_STEPS: TutorialStep[] = [
  { target: 'editor-tray', titleKey: 'tutorial.board.step1.title', bodyKey: 'tutorial.board.step1.body' },
  { target: 'editor-tool-select', titleKey: 'tutorial.board.step6.title', bodyKey: 'tutorial.board.step6.body' },
  { target: 'editor-court', titleKey: 'tutorial.board.step2.title', bodyKey: 'tutorial.board.step2.body' },
  { target: 'board-draw', titleKey: 'tutorial.board.step3.title', bodyKey: 'tutorial.board.step3.body' },
  { target: 'board-functionbar', titleKey: 'tutorial.board.step4.title', bodyKey: 'tutorial.board.step4.body' },
  { target: 'editor-export', titleKey: 'tutorial.board.step7.title', bodyKey: 'tutorial.board.step7.body' },
  { target: 'header-primary', titleKey: 'tutorial.board.step5.title', bodyKey: 'tutorial.board.step5.body' },
];
