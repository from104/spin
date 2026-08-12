// §7.5f/WCAG 2.1.4 회귀 — 단일 문자키 g/z 도 다른 단일 문자키(V/B 등)와 동일하게
// a11y.singleKeyShortcuts(off/modifier) 게이트를 통과해야 한다. 감사 evidence: 과거엔
// 118-125행 g/z 처리가 127행 `singleKeyMode==='off'` 검사보다 앞에 있어 게이트를 우회했다.
import { describe, expect, it, vi } from 'vitest';
import { render, renderHook } from '@testing-library/react';
import { Modal } from '../../ui/Modal.tsx';
import { useEditorKeyboard, type EditorKeyboardDeps, type SingleKeyMode } from './useEditorKeyboard.ts';

function baseDeps(overrides: Partial<EditorKeyboardDeps>): EditorKeyboardDeps {
  return {
    tool: 'select',
    singleKeyMode: 'on',
    selectionSize: 0,
    onSelectTool: vi.fn(),
    onConeToggle: vi.fn(),
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    onSave: vi.fn(),
    onDuplicateStep: vi.fn(),
    onPrevStep: vi.fn(),
    onNextStep: vi.fn(),
    onTogglePlay: vi.fn(),
    onToggleGrid: vi.fn(),
    onToggleRuleZones: vi.fn(),
    onZoomIn: vi.fn(),
    onZoomOut: vi.fn(),
    onZoomReset: vi.fn(),
    onEraseSelection: vi.fn(),
    onShowHelp: vi.fn(),
    onSelectionClear: vi.fn(),
    ...overrides,
  };
}

function press(key: string, opts: Partial<KeyboardEventInit> = {}) {
  document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...opts }));
}

describe('useEditorKeyboard — g/z 는 singleKeyMode 게이트를 따른다', () => {
  it('singleKeyMode=off 이면 G/Z 도 도구키(V)와 함께 전부 차단된다', () => {
    const deps = baseDeps({ singleKeyMode: 'off' as SingleKeyMode });
    renderHook(() => useEditorKeyboard(deps));

    press('g');
    press('z');
    press('v'); // 도구키 대조군 — 원래도 차단됨

    expect(deps.onToggleGrid).not.toHaveBeenCalled();
    expect(deps.onToggleRuleZones).not.toHaveBeenCalled();
    expect(deps.onSelectTool).not.toHaveBeenCalled();
  });

  it('singleKeyMode=modifier 이면 수식키(Alt) 없는 G/Z 는 차단되고, Alt+G/Z 는 통과한다', () => {
    const deps = baseDeps({ singleKeyMode: 'modifier' as SingleKeyMode });
    renderHook(() => useEditorKeyboard(deps));

    press('g');
    press('z');
    expect(deps.onToggleGrid).not.toHaveBeenCalled();
    expect(deps.onToggleRuleZones).not.toHaveBeenCalled();

    press('g', { altKey: true });
    press('z', { altKey: true });
    expect(deps.onToggleGrid).toHaveBeenCalledTimes(1);
    expect(deps.onToggleRuleZones).toHaveBeenCalledTimes(1);
  });

  it('singleKeyMode=on 이면 수식키 없이도 정상 발화한다(대조군)', () => {
    const deps = baseDeps({ singleKeyMode: 'on' as SingleKeyMode });
    renderHook(() => useEditorKeyboard(deps));

    press('g');
    press('z');
    expect(deps.onToggleGrid).toHaveBeenCalledTimes(1);
    expect(deps.onToggleRuleZones).toHaveBeenCalledTimes(1);
  });
});

// §4.3 P1-2 [A-3] — Esc = 선택 해제(전역). 2단 히트가 켜지면 붐비는 코트에서 "빈 곳 탭 →
// 해제" 가 사라지므로 이 경로가 유일하게 확실한 해제 수단이다.
describe('useEditorKeyboard — [A-3] Esc = 선택 해제', () => {
  /** 실제 키 사건과 같은 경로 — 문서의 **자식**(body)에 쏜다. document 에 직접 쏘면
   *  at-target 이 되어 캡처/버블 우선순위(아래 모달 테스트의 판정 대상)가 사라진다. */
  function pressOnBody(key: string) {
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  }

  it('Esc 가 onSelectionClear 를 부른다 — singleKeyMode=off 여도(문자키가 아니라 취소 키다)', () => {
    const deps = baseDeps({ singleKeyMode: 'off' as SingleKeyMode, selectionSize: 3 });
    renderHook(() => useEditorKeyboard(deps));

    pressOnBody('Escape');
    expect(deps.onSelectionClear).toHaveBeenCalledTimes(1);
  });

  it('텍스트 입력 중에는 발화하지 않는다 — 필드의 Esc(IME 조합 취소)를 빼앗으면 안 된다', () => {
    const deps = baseDeps({});
    renderHook(() => useEditorKeyboard(deps));
    const input = document.createElement('input');
    document.body.appendChild(input);

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect(deps.onSelectionClear).not.toHaveBeenCalled();

    input.remove();
  });

  it('모달이 열려 있으면 모달 닫기가 이긴다 — 캡처 단계 stopPropagation 이 여기까지 막는다', () => {
    const deps = baseDeps({});
    renderHook(() => useEditorKeyboard(deps));
    const onClose = vi.fn();
    // 편집기의 실제 모달(도움말·전술판 초기화 확인)과 같은 ui/Modal — 흉내가 아니라 실물로
    // 우선순위를 판정한다.
    const modal = render(
      <Modal open onClose={onClose} titleId="esc-t" title="확인">
        내용
      </Modal>,
    );

    pressOnBody('Escape');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(deps.onSelectionClear).not.toHaveBeenCalled();

    // 모달이 닫히면(사라지면) 같은 Esc 가 다시 선택 해제로 돌아온다. ⚠ cleanup() 이 아니라
    // 이 모달만 내린다 — cleanup 은 renderHook(키보드 훅)까지 함께 내려 버린다.
    modal.unmount();
    pressOnBody('Escape');
    expect(deps.onSelectionClear).toHaveBeenCalledTimes(1);
  });
});
