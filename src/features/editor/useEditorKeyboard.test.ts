// §7.5f/WCAG 2.1.4 회귀 — 단일 문자키 g/z 도 다른 단일 문자키(V/B 등)와 동일하게
// a11y.singleKeyShortcuts(off/modifier) 게이트를 통과해야 한다. 감사 evidence: 과거엔
// 118-125행 g/z 처리가 127행 `singleKeyMode==='off'` 검사보다 앞에 있어 게이트를 우회했다.
import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
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
