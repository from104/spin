// 전역(document) 키다운 — 개체가 아니라 화면 전체를 대상으로 하는 단축키.
//
// 2026-08-16 전면 개편. **이 파일은 키를 정하지 않는다** — `core/keymap.ts` 가 정본이고
// 여기는 표가 돌려준 동작 id 로 분기만 한다. 개편 전에는 키 문자열이 이 파일·EditorStage·
// PresentRunner·toolDefs 에 흩어져 있어 도움말과 배선이 따로 놀 수 있었다.
//
// WCAG 2.1.4 (Character Key Shortcuts, Level A) — DESIGN §7.5f. 게이트는 **전역 단일
// 문자키에만** 건다(`letterKey`). 개체 조작(W A S D · Q E · [ ] · Delete)은 개체에 포커스가
// 있을 때만 살아 2.1.4 의 "Active only on focus" 예외에 해당하므로 게이트를 타지 않는다 —
// 게이트를 태우면 설정을 끈 사용자는 개체를 **키보드로 움직일 방법이 통째로 없어진다**.
import { useEffect, useRef } from 'react';
import { INTERACT } from '../../core/constants.ts';
import { lookupDef, type KeyDef } from '../../core/keymap.ts';
import { isEditableTarget, isInteractiveTarget } from '../../ui/keyboard.ts';
import type { ToolId } from '../../physics/index.ts';
import { toolForAction } from './toolDefs.ts';

export type SingleKeyMode = 'on' | 'modifier' | 'off';

export interface EditorKeyboardDeps {
  tool: ToolId;
  singleKeyMode: SingleKeyMode;
  onSelectTool(t: ToolId): void;
  onConeToggle(): void;
  onUndo(): void;
  onRedo(): void;
  onSave(): void;
  onDuplicateStep(): void;
  /** Ctrl/⌘+D 의 1층(2026-08-18) — 복제 가능한 선택(도형·메모·화살표)이 있으면 그것을
   *  복제하고 true. false 면 디스패처가 2층(스텝 복제)으로 내려간다. */
  onDuplicateObjects(): boolean;
  onPrevStep(): void;
  onNextStep(): void;
  onTogglePlay(): void;
  onToggleGrid(): void;
  onToggleRuleZones(): void;
  onZoomIn(): void;
  onZoomOut(): void;
  onZoomReset(): void;
  onEraseSelection(): void;
  /** §4.4 P2-1 Ctrl/Cmd + 방향키 — **화면** CSS px 델타만큼 창을 민다. 회전 환산은 받는 쪽
   *  (`CourtStageHandle.panByScreen`)의 몫이라 여기서는 화면에서 본 방향만 정한다. */
  onPanView(dxCssPx: number, dyCssPx: number): void;
  onShowHelp(): void;
  /** §4.3 P1-2 [A-3] Esc = 선택 해제. 2단 히트가 켜지면 붐비는 코트에서 "빈 곳 탭 → 해제"
   *  가 사라지므로, 포인터와 무관한 이 전역 경로가 해제를 보장한다. */
  onSelectionClear(): void;
  /** Ctrl/⌘+A — 판 위의 개체를 전부 고른다(§6.10b). 명단은 워크스페이스가 만든다: 무엇이
   *  '판 위' 인가(이 스텝에 놓인 것)와 무엇을 뺄 것인가(잠긴 것)를 아는 곳이 거기다. */
  onSelectAll(): void;
}

/** 판을 미는 방향. **창이 키 방향으로 간다** — 오른쪽 키를 누르면 판의 오른쪽이 보인다.
 *  포인터로 테두리를 잡아 끄는 쪽은 반대(판이 손을 따라온다)인데, 그 반전은 손이 판을 쥐고
 *  있다는 감각에서 나오고 키에는 쥘 것이 없다. 가장자리 자동 밀기가 이미 "창이 손을 따라간다"
 *  로 같은 편에 서 있다(`edgePanVelocity` 주석). */
const PAN_DIR: Record<string, readonly [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

/** WCAG 2.1.4 게이트를 통과한 정의. 설정이 `modifier` 면 전역 문자키는 Alt 를 요구하고,
 *  `off` 면 아예 안 잡힌다. 문자키가 **아닌** 정의는 설정과 무관하다. */
function gatedLookup(
  e: KeyboardEvent,
  mode: SingleKeyMode,
): KeyDef | undefined {
  const direct = lookupDef('global', e);
  if (direct) return direct.letterKey && mode !== 'on' ? undefined : direct;
  // `modifier` 에서는 Alt+글자가 문자키의 자리다. Alt 를 벗겨 다시 찾되, 원래 문자키였던
  // 것만 받는다 — 안 그러면 Alt+S 가 저장(Ctrl+S)으로 새는 식의 통로가 열린다.
  if (mode === 'modifier' && e.altKey) {
    const bare = lookupDef('global', {
      code: e.code,
      ctrlKey: e.ctrlKey,
      metaKey: e.metaKey,
      altKey: false,
      shiftKey: e.shiftKey,
    });
    if (bare?.letterKey) return bare;
  }
  return undefined;
}

/** 전역(document) 키다운 — 개체가 아니라 화면 전체를 대상으로 하는 단축키. */
export function useEditorKeyboard(deps: EditorKeyboardDeps): void {
  const ref = useRef(deps);
  ref.current = deps;

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const d = ref.current;
      const editable = isEditableTarget(e.target);

      const def = gatedLookup(e, d.singleKeyMode);
      if (!def) return;

      // 텍스트 입력 중에는 저장만 가로챈다. 나머지는 네이티브 동작(글자·되돌리기·커서)에
      // 맡긴다 — 메모를 쓰는 중에 B 가 공 도구를 켜면 안 된다.
      if (editable && def.id !== 'edit.save') return;

      // §7.5f Space/Enter 는 브라우저가 활성화 키로 쓴다. 트랜스포트 '재생' 버튼에 포커스한
      // 채 Space 를 누르면 네이티브 클릭과 여기가 이중 발화해 **아무 일도 안 일어난다**.
      if (def.id === 'play.toggle' && isInteractiveTarget(e.target)) return;

      const tool = toolForAction(def.id);
      if (tool) {
        e.preventDefault();
        // §6.10a — **같은 도구를 한 번 더 = 연속 배치 고정.** 그 판정은 리듀서가 하므로
        // 여기서는 갈래 없이 그냥 보낸다. 개편 전에는 이 자리에 콘만의 예외가 있었다
        // ("C 두 번 = 색 토글") — 지금 색은 `Shift+C` 다(keymap `tool.coneColor`).
        d.onSelectTool(tool);
        return;
      }

      switch (def.id) {
        case 'tool.coneColor':
          e.preventDefault();
          // 콘 도구가 아닐 때도 색은 바꿔 둘 수 있다 — 다음에 콘을 들면 그 색으로 놓인다.
          d.onConeToggle();
          return;
        case 'edit.undo':
          e.preventDefault();
          d.onUndo();
          return;
        case 'edit.redo':
          e.preventDefault();
          d.onRedo();
          return;
        case 'edit.save':
          e.preventDefault();
          d.onSave();
          return;
        // Ctrl/⌘+D 는 keymap 에 같은 id 로 두 정의가 있다(둘째는 도움말 행 전용 별칭) —
        // 디스패치 분기는 이 한 케이스다. 층 갈림(개체 우선, 없으면 스텝)은 아래 한 줄.
        case 'edit.duplicate':
          e.preventDefault();
          if (!d.onDuplicateObjects()) d.onDuplicateStep();
          return;
        case 'step.prev':
          e.preventDefault();
          d.onPrevStep();
          return;
        case 'step.next':
          e.preventDefault();
          d.onNextStep();
          return;
        case 'play.toggle':
          e.preventDefault();
          d.onTogglePlay();
          return;
        case 'view.grid':
          e.preventDefault();
          d.onToggleGrid();
          return;
        case 'view.ruleZones':
          e.preventDefault();
          d.onToggleRuleZones();
          return;
        case 'view.zoomIn':
          e.preventDefault();
          d.onZoomIn();
          return;
        case 'view.zoomOut':
          e.preventDefault();
          d.onZoomOut();
          return;
        case 'view.zoomReset':
          e.preventDefault();
          d.onZoomReset();
          return;
        case 'view.pan': {
          // macOS 의 ⌘+←/→ 는 브라우저 뒤로/앞으로다 — 막지 않으면 판을 밀려던 손짓이
          // 화면을 통째로 떠난다.
          const dir = PAN_DIR[e.code];
          if (!dir) return;
          e.preventDefault();
          d.onPanView(dir[0] * INTERACT.keyPanStepCssPx, dir[1] * INTERACT.keyPanStepCssPx);
          return;
        }
        case 'erase.selection':
          e.preventDefault();
          d.onEraseSelection();
          return;
        case 'select.all':
          // 글자 입력 칸의 Ctrl+A(전체 선택)는 여기까지 오지 않는다 — 위쪽 `isEditableTarget`
          // 관문이 이미 되돌려보낸다. 그 관문이 없으면 제목을 고치다 판 전체가 선택된다.
          e.preventDefault();
          d.onSelectAll();
          return;
        case 'select.clear':
          // stopPropagation 을 걸지 않는다 — CourtStage 의 팬 무장 해제(window 리스너)도
          // 같은 Esc 로 풀려야 하고, 둘 다 "일시 상태를 물린다" 라 충돌이 아니다.
          // 모달이 열려 있으면 여기까지 오지 않는다(Modal 이 **캡처** 단계에서 멈춘다).
          //
          // 2026-09-03 — **지우기 도구의 세 출구 중 Esc 가 여기다**(나머지: 빈 곳 클릭 ·
          // 버튼 재클릭). Esc 의 뜻은 "지금 걸린 것을 물린다" 하나이고, 파괴 모드가 걸려
          // 있으면 그것이 가장 먼저 물릴 것이다 — 선택 해제는 그대로 이어서 한다.
          //
          // ⚠️ **EditorStage 의 Escape 분기가 아니라 여기인 이유가 둘이다.**
          //   ① 포커스가 코트 밖(사이드바·기능 바)일 때도 물려야 한다. 저쪽은 무대 svg 의
          //      onKeyDown 이라 그때는 아예 안 불린다.
          //   ② **두 곳에 두면 한 번의 Esc 가 `TOOL_SET` 을 두 번 쏜다.** 저쪽은
          //      stopPropagation 을 걸지 않으므로(위 문단의 이유로 걸어서도 안 된다) 같은
          //      사건이 여기까지 온다. 그리고 `TOOL_SET` 은 **멱등이 아니다**: 첫 번째가
          //      eraser → select 로 바꾸고 나면, 두 번째는 "같은 도구를 한 번 더" 가 되어
          //      `select` 의 고정(모아 고르기 §6.10b)을 **켜 버린다** — Esc 를 눌렀더니
          //      켠 적 없는 모드가 켜지는, 조용해서 더 나쁜 종류의 사고다.
          if (d.tool === 'eraser') d.onSelectTool('select');
          d.onSelectionClear();
          return;
        case 'help':
          e.preventDefault();
          d.onShowHelp();
          return;
        default:
          return;
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);
}
