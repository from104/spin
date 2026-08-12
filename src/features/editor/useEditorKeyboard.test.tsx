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
    onPanView: vi.fn(),
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

// §4.4 P2-1 — Ctrl/Cmd + 방향키 = 판 이동. 방향키 소비자 셋(전역 스텝 이동 ←→ · 개체 이동 ·
// 배치 커서)과 Shift(화살표 끝점 §4.3 1.11) · Alt(개체 순회) 가 이미 차 있어 **Ctrl 만 비어
// 있었다**. 이 파일은 전역 층만 잰다 — 개체·커서 층이 수식키를 흘려보내는지는 EditorStage
// 쪽(BoardScreen.test.tsx)이 따로 문다.
describe('useEditorKeyboard — Ctrl/Cmd + 방향키는 판을 민다', () => {
  const STEP = 64; // INTERACT.keyPanStepCssPx

  it('네 방향이 각각 화면 델타로 나간다 — 창이 키 방향으로 간다', () => {
    const deps = baseDeps({});
    renderHook(() => useEditorKeyboard(deps));

    press('ArrowRight', { ctrlKey: true });
    expect(deps.onPanView).toHaveBeenLastCalledWith(STEP, 0);
    press('ArrowLeft', { ctrlKey: true });
    expect(deps.onPanView).toHaveBeenLastCalledWith(-STEP, 0);
    press('ArrowDown', { ctrlKey: true });
    expect(deps.onPanView).toHaveBeenLastCalledWith(0, STEP);
    press('ArrowUp', { ctrlKey: true });
    expect(deps.onPanView).toHaveBeenLastCalledWith(0, -STEP);
    expect(deps.onPanView).toHaveBeenCalledTimes(4);
  });

  it('Cmd(meta) 도 같다 — 이 저장소는 Ctrl 과 Cmd 를 한 몸으로 다룬다', () => {
    const deps = baseDeps({});
    renderHook(() => useEditorKeyboard(deps));
    press('ArrowRight', { metaKey: true });
    expect(deps.onPanView).toHaveBeenCalledWith(STEP, 0);
  });

  it('기본 동작을 막는다 — macOS 의 Cmd+←/→ 는 브라우저 뒤로/앞으로다', () => {
    // 막지 않으면 판을 밀려던 손짓이 화면을 통째로 떠난다.
    const deps = baseDeps({});
    renderHook(() => useEditorKeyboard(deps));
    const e = new KeyboardEvent('keydown', { key: 'ArrowLeft', metaKey: true, bubbles: true, cancelable: true });
    document.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(true);
  });

  it('수식키 없는 방향키는 그대로 스텝 이동이다 (대조군)', () => {
    // 이 대조군이 없으면 "Ctrl 에서 팬이 돈다" 가 '방향키가 전부 팬이 됐다' 로도 통과한다.
    const deps = baseDeps({ selectionSize: 0 });
    renderHook(() => useEditorKeyboard(deps));
    press('ArrowRight');
    press('ArrowLeft');
    expect(deps.onNextStep).toHaveBeenCalledTimes(1);
    expect(deps.onPrevStep).toHaveBeenCalledTimes(1);
    expect(deps.onPanView).not.toHaveBeenCalled();
  });

  it('Alt+방향키도 팬이 아니다 — 그 자리는 개체 순회(§7.5b)가 쓴다', () => {
    const deps = baseDeps({});
    renderHook(() => useEditorKeyboard(deps));
    press('ArrowRight', { altKey: true });
    expect(deps.onPanView).not.toHaveBeenCalled();
  });

  it('텍스트 입력 중에는 팬하지 않는다 — Ctrl+←/→ 는 필드의 단어 점프다', () => {
    const deps = baseDeps({});
    renderHook(() => useEditorKeyboard(deps));
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', ctrlKey: true, bubbles: true, cancelable: true }));
    expect(deps.onPanView).not.toHaveBeenCalled();
    input.remove();
  });

  it('singleKeyMode=off 여도 팬은 살아 있다 — 수식키 조합은 WCAG 2.1.4 대상이 아니다', () => {
    // Ctrl+Z(되돌리기)와 같은 층이다. 여기서 막히면 단일키를 끈 사용자가 판을 못 민다.
    const deps = baseDeps({ singleKeyMode: 'off' as SingleKeyMode });
    renderHook(() => useEditorKeyboard(deps));
    press('ArrowRight', { ctrlKey: true });
    expect(deps.onPanView).toHaveBeenCalledWith(STEP, 0);
  });

  it('같은 mod 분기의 이웃들을 가리지 않는다 — Ctrl+Z·Ctrl+Delete 는 그대로다 (대조군)', () => {
    const deps = baseDeps({});
    renderHook(() => useEditorKeyboard(deps));
    press('z', { ctrlKey: true });
    press('Delete', { ctrlKey: true });
    expect(deps.onUndo).toHaveBeenCalledTimes(1);
    expect(deps.onEraseSelection).toHaveBeenCalledTimes(1);
    expect(deps.onPanView).not.toHaveBeenCalled();
  });
});
