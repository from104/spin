// §7.5f/WCAG 2.1.4 — 전역 키 층. 이 파일이 재는 것은 **동작이 붙었는가**이고, 표 자체의
// 무모순(한 키가 두 뜻을 갖지 않는가)은 `core/keymap.contract.test.ts` 가 따로 문다.
//
// 2026-08-16 전면 개편 — 이 파일의 사건은 전부 `code` 로 쏜다. 개편 전에는 `key` 였고,
// 그래서 **한글 입력 상태의 고장을 한 번도 못 잡았다**: 테스트는 언제나 'v' 를 보냈지만
// 실제 사용자의 브라우저는 'ㅍ' 를 보내고 있었다. code 로 쏘면 그 층이 아예 사라진다.
import { describe, expect, it, vi } from 'vitest';
import { render, renderHook } from '@testing-library/react';
import { Modal } from '../../ui/Modal.tsx';
import { useEditorKeyboard, type EditorKeyboardDeps, type SingleKeyMode } from './useEditorKeyboard.ts';

function baseDeps(overrides: Partial<EditorKeyboardDeps>): EditorKeyboardDeps {
  return {
    tool: 'select',
    singleKeyMode: 'on',
    onSelectTool: vi.fn(),
    onPanView: vi.fn(),
    onConeToggle: vi.fn(),
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    onSave: vi.fn(),
    onDuplicateStep: vi.fn(),
    onDuplicateObjects: vi.fn(() => false),
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
    onSelectAll: vi.fn(),
    ...overrides,
  };
}

/** 실제 브라우저는 `code` 와 `key` 를 **둘 다** 싣는다. 우리 디스패처는 code 만 보지만,
 *  같은 사건을 받는 다른 소비자(ui/Modal 의 Esc 등)는 key 를 본다 — 한쪽만 실어 보내면
 *  테스트가 현실에 없는 사건을 만들어 우선순위 판정이 무의미해진다. */
const KEY_OF: Record<string, string> = { Space: ' ', Escape: 'Escape', Enter: 'Enter', Delete: 'Delete' };

function press(code: string, opts: Partial<KeyboardEventInit> = {}) {
  const key = KEY_OF[code] ?? (code.startsWith('Key') ? code.slice(3).toLowerCase() : code);
  document.dispatchEvent(new KeyboardEvent('keydown', { code, key, bubbles: true, cancelable: true, ...opts }));
}

describe('useEditorKeyboard — 도구 키', () => {
  it('영어 머릿글자로 도구가 열린다', () => {
    const deps = baseDeps({});
    renderHook(() => useEditorKeyboard(deps));
    press('KeyV');
    press('KeyL');
    press('KeyB');
    press('KeyO');
    expect(deps.onSelectTool).toHaveBeenNthCalledWith(1, 'select');
    expect(deps.onSelectTool).toHaveBeenNthCalledWith(2, 'line');
    expect(deps.onSelectTool).toHaveBeenNthCalledWith(3, 'ball');
    expect(deps.onSelectTool).toHaveBeenNthCalledWith(4, 'shapeEllipse');
  });

  it('⚠️ 한글 입력 상태에서도 열린다 — code 는 입력기를 안 탄다', () => {
    // 이것이 개편의 직접 동기다. 개편 전에는 `e.key` 를 봐서 한글 모드의 'ㅍ' 를 못 알아봤고,
    // 그래서 한글로 메모를 쓰다 돌아온 코치에게는 **문자 단축키가 전부 고장나 있었다**.
    const deps = baseDeps({});
    renderHook(() => useEditorKeyboard(deps));
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyV', key: 'ㅍ', bubbles: true, cancelable: true }));
    expect(deps.onSelectTool).toHaveBeenCalledWith('select');
  });

  it('W A S D · Q E 는 도구를 열지 않는다 — 개체 조작 자리다', () => {
    const deps = baseDeps({});
    renderHook(() => useEditorKeyboard(deps));
    for (const c of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE']) press(c);
    expect(deps.onSelectTool).not.toHaveBeenCalled();
  });

  it('숫자키는 도구를 열지 않는다 — 숫자 체계를 폐지했다', () => {
    const deps = baseDeps({});
    renderHook(() => useEditorKeyboard(deps));
    for (const c of ['Digit1', 'Digit2', 'Digit5', 'Digit8']) press(c);
    expect(deps.onSelectTool).not.toHaveBeenCalled();
  });

  // 2026-08-16 §6.10a — **옛 계약이 옮겨 갔다.** 여기 있던 것은 *"콘 도구를 든 채 C 를 다시
  // 누르면 색이 바뀐다"* 였다. 같은 날 *같은 도구를 한 번 더 = 연속 배치 고정* 이 모든 도구의
  // 규칙이 되면서, 콘만 그 자리에 다른 뜻이 앉아 있게 됐다 — 마우스로 콘 상자를 두 번 누르면
  // 고정, 키보드로 C 를 두 번 누르면 색. 도구마다 다른 규칙은 배울 수가 없어서 색을 옮겼다.
  it('콘 도구를 든 채 C 를 다시 눌러도 **색이 안 바뀐다** — 그 자리는 고정이다', () => {
    const deps = baseDeps({ tool: 'cone' });
    renderHook(() => useEditorKeyboard(deps));
    press('KeyC');
    expect(deps.onConeToggle).not.toHaveBeenCalled();
    // 갈래 없이 그대로 보낸다 — 같은 도구인지, 그래서 고정인지는 리듀서가 판정한다.
    expect(deps.onSelectTool).toHaveBeenCalledWith('cone');
  });

  it('콘 색은 Shift+C 다 — 콘 도구가 아닐 때도 미리 바꿔 둘 수 있다', () => {
    for (const tool of ['cone', 'select'] as const) {
      const deps = baseDeps({ tool });
      const { unmount } = renderHook(() => useEditorKeyboard(deps));
      press('KeyC', { shiftKey: true });
      expect(deps.onConeToggle, tool).toHaveBeenCalledTimes(1);
      expect(deps.onSelectTool, `${tool} — 색만 바꾼다. 도구를 건드리지 않는다`).not.toHaveBeenCalled();
      unmount();
    }
  });
});

describe('useEditorKeyboard — WCAG 2.1.4 게이트는 전역 문자키에만 걸린다', () => {
  it('singleKeyMode=off 이면 도구 문자키가 차단된다', () => {
    const deps = baseDeps({ singleKeyMode: 'off' as SingleKeyMode });
    renderHook(() => useEditorKeyboard(deps));
    press('KeyV');
    expect(deps.onSelectTool).not.toHaveBeenCalled();
  });

  it('singleKeyMode=modifier 이면 Alt+문자로 도구가 열린다', () => {
    const deps = baseDeps({ singleKeyMode: 'modifier' as SingleKeyMode });
    renderHook(() => useEditorKeyboard(deps));
    press('KeyV');
    expect(deps.onSelectTool).not.toHaveBeenCalled();
    press('KeyV', { altKey: true });
    expect(deps.onSelectTool).toHaveBeenCalledWith('select');
  });

  it('보기 토글(Alt+G·Alt+Z)은 설정과 무관하다 — 이미 수식키 조합이다', () => {
    // 개편 전에는 G·Z 가 단일 문자키라 게이트를 타야 했다. Alt 계열로 옮기면서 대상에서
    // 빠졌다 — 2.1.4 는 "문자·숫자·구두점 **단독**" 만 규제한다.
    const deps = baseDeps({ singleKeyMode: 'off' as SingleKeyMode });
    renderHook(() => useEditorKeyboard(deps));
    press('KeyG', { altKey: true });
    press('KeyZ', { altKey: true });
    expect(deps.onToggleGrid).toHaveBeenCalledTimes(1);
    expect(deps.onToggleRuleZones).toHaveBeenCalledTimes(1);
  });

  it('수식키 없는 G·Z 는 아무 일도 안 한다 — 토글은 Alt 계열로 옮겼다', () => {
    const deps = baseDeps({});
    renderHook(() => useEditorKeyboard(deps));
    press('KeyG');
    press('KeyZ');
    expect(deps.onToggleGrid).not.toHaveBeenCalled();
    expect(deps.onToggleRuleZones).not.toHaveBeenCalled();
  });
});

describe('useEditorKeyboard — 시간축', () => {
  it('PageUp/PageDown 이 스텝을 옮긴다 — 선택 상태와 무관하게', () => {
    // 개편 전에는 ←/→ 였고 "개체 미선택 시에만" 이라는 조건이 붙어 있었다. 같은 키가 상황에
    // 따라 다른 일을 하면 손이 결과를 예측할 수 없다.
    const deps = baseDeps({});
    renderHook(() => useEditorKeyboard(deps));
    press('PageDown');
    press('PageUp');
    expect(deps.onNextStep).toHaveBeenCalledTimes(1);
    expect(deps.onPrevStep).toHaveBeenCalledTimes(1);
  });

  it('수식키 없는 방향키는 전역에서 아무 일도 안 한다 — 개체 층의 것이다', () => {
    const deps = baseDeps({});
    renderHook(() => useEditorKeyboard(deps));
    press('ArrowLeft');
    press('ArrowRight');
    expect(deps.onPrevStep).not.toHaveBeenCalled();
    expect(deps.onNextStep).not.toHaveBeenCalled();
    expect(deps.onPanView).not.toHaveBeenCalled();
  });

  it('Space 가 재생/일시정지다', () => {
    const deps = baseDeps({});
    renderHook(() => useEditorKeyboard(deps));
    press('Space');
    expect(deps.onTogglePlay).toHaveBeenCalledTimes(1);
  });

  it('버튼에 포커스가 있으면 Space 를 양보한다 — 네이티브 클릭과 이중 발화 방지(§7.5f)', () => {
    const deps = baseDeps({});
    renderHook(() => useEditorKeyboard(deps));
    const btn = document.createElement('button');
    document.body.appendChild(btn);
    btn.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true, cancelable: true }));
    expect(deps.onTogglePlay).not.toHaveBeenCalled();
    btn.remove();
  });
});

// §4.3 P1-2 [A-3] — Esc = 선택 해제(전역). 2단 히트가 켜지면 붐비는 코트에서 "빈 곳 탭 →
// 해제" 가 사라지므로 이 경로가 유일하게 확실한 해제 수단이다.
describe('useEditorKeyboard — [A-3] Esc = 선택 해제', () => {
  /** 실제 키 사건과 같은 경로 — 문서의 **자식**(body)에 쏜다. document 에 직접 쏘면
   *  at-target 이 되어 캡처/버블 우선순위(아래 모달 테스트의 판정 대상)가 사라진다. */
  function pressOnBody(code: string) {
    document.body.dispatchEvent(
      new KeyboardEvent('keydown', { code, key: KEY_OF[code] ?? code, bubbles: true, cancelable: true }),
    );
  }

  it('Esc 가 onSelectionClear 를 부른다 — singleKeyMode=off 여도(문자키가 아니라 취소 키다)', () => {
    const deps = baseDeps({ singleKeyMode: 'off' as SingleKeyMode });
    renderHook(() => useEditorKeyboard(deps));

    pressOnBody('Escape');
    expect(deps.onSelectionClear).toHaveBeenCalledTimes(1);
  });

  it('텍스트 입력 중에는 발화하지 않는다 — 필드의 Esc(IME 조합 취소)를 빼앗으면 안 된다', () => {
    const deps = baseDeps({});
    renderHook(() => useEditorKeyboard(deps));
    const input = document.createElement('input');
    document.body.appendChild(input);

    input.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', bubbles: true, cancelable: true }));
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

// §4.4 P2-1 — Ctrl/Cmd + 방향키 = 판 이동.
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
    const e = new KeyboardEvent('keydown', { code: 'ArrowLeft', metaKey: true, bubbles: true, cancelable: true });
    document.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(true);
  });

  it('Alt+방향키는 팬이 아니다 — Alt 는 보기 토글 전용 채널이다', () => {
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
    input.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowLeft', ctrlKey: true, bubbles: true, cancelable: true }));
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

  it('같은 mod 분기의 이웃을 가리지 않는다 — Ctrl+Z 는 그대로다 (대조군)', () => {
    const deps = baseDeps({});
    renderHook(() => useEditorKeyboard(deps));
    press('KeyZ', { ctrlKey: true });
    expect(deps.onUndo).toHaveBeenCalledTimes(1);
    expect(deps.onPanView).not.toHaveBeenCalled();
  });
});

// ★ 2026-08-18 기현 지시: *"복제 단축키 ctrl-d 가능할까?"* — Ctrl/⌘+D 는 **두 층**이다:
//   복제 가능한 선택(도형·메모·화살표)이 있으면 그 개체들, 없으면 현재 스텝. 갈림을 선택이
//   정하는 것은 Delete 와 같은 결이다("무엇을" 이 선택에서 오는 편집 조작).
describe('useEditorKeyboard — Ctrl+D 는 개체 먼저, 없으면 스텝', () => {
  it('1층이 true 를 돌려주면(복제 가능한 선택 있음) 스텝 복제는 안 부른다', () => {
    const deps = baseDeps({ onDuplicateObjects: vi.fn(() => true) });
    renderHook(() => useEditorKeyboard(deps));
    press('KeyD', { ctrlKey: true });
    expect(deps.onDuplicateObjects).toHaveBeenCalledTimes(1);
    expect(deps.onDuplicateStep).not.toHaveBeenCalled();
  });

  it('1층이 false 면(선택 없음/복제 불가) 스텝 복제로 내려간다 — 종전 동작 보존', () => {
    const deps = baseDeps({});
    renderHook(() => useEditorKeyboard(deps));
    press('KeyD', { ctrlKey: true });
    expect(deps.onDuplicateObjects).toHaveBeenCalledTimes(1);
    expect(deps.onDuplicateStep).toHaveBeenCalledTimes(1);
  });

  it('맨 KeyD(수식키 없음)는 복제가 아니다 — 개체 이동(WASD)의 D 다', () => {
    const deps = baseDeps({});
    renderHook(() => useEditorKeyboard(deps));
    press('KeyD');
    expect(deps.onDuplicateObjects).not.toHaveBeenCalled();
    expect(deps.onDuplicateStep).not.toHaveBeenCalled();
  });
});

// ★ 2026-08-16 기현 지시: *"객체 지우기는 하나건 여러 개건 Delete 키로 무조건 지우게 해."*
//   개편 전에는 `Delete` 가 포커스 하나, `Ctrl+Delete` 가 선택 전체였다 — 사용자에게 그 둘은
//   같은 일이고, 규모는 이미 화면에 적혀 있다(무엇이 골라져 있는가). 손이 그것을 수식키로
//   다시 말할 이유가 없다.
describe('useEditorKeyboard — Delete 는 수식키 없이 지운다', () => {
  it('맨 Delete 가 고른 것을 지운다', () => {
    const deps = baseDeps({});
    renderHook(() => useEditorKeyboard(deps));
    press('Delete');
    expect(deps.onEraseSelection).toHaveBeenCalledTimes(1);
  });

  it('Backspace 도 같다 — 두 키가 같은 뜻인 것은 종전 그대로다', () => {
    const deps = baseDeps({});
    renderHook(() => useEditorKeyboard(deps));
    press('Backspace');
    expect(deps.onEraseSelection).toHaveBeenCalledTimes(1);
  });

  // 수식키를 붙인 쪽은 이제 **아무 일도 안 한다**. 규모를 수식키로 가르던 개념 자체가
  // 없어졌으므로, 남겨 두면 "Ctrl 을 붙이면 뭔가 다른 게 지워지나" 를 되묻게 만든다.
  it('Ctrl+Delete 는 더 이상 따로 있지 않다', () => {
    const deps = baseDeps({});
    renderHook(() => useEditorKeyboard(deps));
    press('Delete', { ctrlKey: true });
    expect(deps.onEraseSelection).not.toHaveBeenCalled();
  });
});

describe('useEditorKeyboard — 텍스트 입력 중에는 저장만 통과한다', () => {
  it('메모를 쓰는 중 B 가 공 도구를 켜지 않는다', () => {
    const deps = baseDeps({});
    renderHook(() => useEditorKeyboard(deps));
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyB', bubbles: true, cancelable: true }));
    expect(deps.onSelectTool).not.toHaveBeenCalled();
    input.remove();
  });

  it('Ctrl+S 는 입력 중에도 저장한다 — 쓰던 글을 잃지 않는 쪽이 언제나 옳다', () => {
    const deps = baseDeps({});
    renderHook(() => useEditorKeyboard(deps));
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyS', ctrlKey: true, bubbles: true, cancelable: true }));
    expect(deps.onSave).toHaveBeenCalledTimes(1);
    input.remove();
  });
});
