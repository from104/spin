import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, useState } from 'react';
import { Modal } from './Modal.tsx';

function Harness() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  return (
    <div>
      <button ref={triggerRef} onClick={() => setOpen(true)}>
        도움말 열기
      </button>
      <Modal open={open} onClose={() => setOpen(false)} titleId="help-title" title="도움말" returnFocusRef={triggerRef}>
        <button>첫 버튼</button>
        <button>마지막 버튼</button>
      </Modal>
    </div>
  );
}

describe('Modal', () => {
  it('role="dialog" aria-modal="true" + aria-labelledby 로 제목을 연결한다', () => {
    render(
      <Modal open={true} onClose={() => {}} titleId="t1" title="도움말">
        내용
      </Modal>,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 't1');
  });

  it('열리면 패널 안쪽으로 포커스가 들어간다', async () => {
    render(<Harness />);
    await userEvent.setup().click(screen.getByRole('button', { name: '도움말 열기' }));
    await waitFor(() => expect(screen.getByRole('dialog')).toContainElement(document.activeElement as HTMLElement));
  });

  it('Esc 를 누르면 onClose 가 호출되고 트리거로 포커스가 돌아온다', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: '도움말 열기' });
    await user.click(trigger);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();

    // 닫기 ✕ 경로도 같은 복귀를 보장한다 — 가드가 복귀 focus() 를 방해하지 않는다.
    await user.click(trigger);
    await user.click(screen.getByRole('button', { name: '닫기' }));
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('IME 조합 중의 Esc(isComposing·keyCode 229)는 닫지 않는다 — 조합 취소를 빼앗으면 안 된다', () => {
    const onClose = vi.fn();
    render(
      <Modal open={true} onClose={onClose} titleId="t-ime" title="도움말">
        내용
      </Modal>,
    );
    // 한글 조합을 Esc 로 취소하는 순간의 keydown — InspectorHost 머리말과 같은 규율.
    fireEvent.keyDown(document, { key: 'Escape', isComposing: true });
    // 구형 IME 경로: isComposing 이 아직 서지 않고 keyCode 229 만 오는 keydown.
    fireEvent.keyDown(document, { key: 'Escape', keyCode: 229 });
    expect(onClose).not.toHaveBeenCalled();
    // 대조군: 조합 중이 아닌 Esc 는 여전히 닫는다 — 가드가 과하게 막고 있지 않음을 증명.
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('트리거가 DOM 에서 떼어진 채 닫히면 떼어진 노드에 focus 를 걸지 않는다 (isConnected 가드)', async () => {
    // 시나리오 = InspectorHost.tsx:85 주석의 사고 재현: 화면 전환이 트리거를 떼고 새 포커스를
    // 잡아 둔 뒤 모달이 닫힌다. jsdom 은 떼어진 노드 focus() 를 조용히 무시하지만(직접 실측),
    // 사고가 났던 브라우저 계열은 그 호출이 기존 포커스를 <body> 로 떨어뜨린다 — 그 동작을
    // 스텁으로 깔아 경로를 실제로 실행시킨다("없는 API 는 스텁을 깔아라" 관례).
    function DetachHarness() {
      const [open, setOpen] = useState(false);
      const [triggerAlive, setTriggerAlive] = useState(true);
      const triggerRef = useRef<HTMLButtonElement>(null);
      return (
        <div>
          {triggerAlive && (
            <button ref={triggerRef} onClick={() => setOpen(true)}>
              모달 열기
            </button>
          )}
          <button onClick={() => setTriggerAlive(false)}>트리거 제거</button>
          <button>다음 화면</button>
          <Modal open={open} onClose={() => setOpen(false)} titleId="t-detach" title="테스트" returnFocusRef={triggerRef}>
            내용
          </Modal>
        </div>
      );
    }
    render(<DetachHarness />);
    const trigger = screen.getByRole('button', { name: '모달 열기' });
    trigger.focus(); // openedByRef 가 트리거를 잡도록 — 실제 클릭 열기와 같은 상태.
    fireEvent.click(trigger);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // 화면 전환: 트리거가 DOM 에서 떨어지고, 새 화면이 포커스를 잡는다.
    fireEvent.click(screen.getByRole('button', { name: '트리거 제거' }));
    expect(trigger.isConnected).toBe(false);
    const nextScreen = screen.getByRole('button', { name: '다음 화면' });
    nextScreen.focus();

    // 떼어진 노드 focus 가 포커스를 body 로 떨어뜨리는 브라우저 계열의 동작을 스텁.
    const detachedFocus = vi.fn(() => {
      (document.activeElement as HTMLElement | null)?.blur();
    });
    trigger.focus = detachedFocus;

    // ⚠️ 2026-08-17 계약 변경 — 모달이 열려 있는 동안 배경은 포커스를 **못 가져간다**
    // (아래 '배경이 포커스를 가져가면…' 참조). 그래서 위 `nextScreen.focus()` 는 되돌려졌고,
    // 이 테스트가 원래 재려던 것만 남는다: **떼어진 트리거에 focus() 를 걸지 않는다**.
    // 배경이 미리 포커스를 잡아 두는 것으로 §7.6 을 지키던 옛 경로는 이제 성립하지 않는다 —
    // 지금 그 자리를 지키는 것은 '닫힐 때의 복귀는 가드가 방해하지 않는다' 쪽이다.
    expect(nextScreen).not.toHaveFocus();

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    // 가드가 없으면: detachedFocus 가 불려 떼어진 노드에 focus 가 걸린다(§7.6 위반).
    expect(detachedFocus).not.toHaveBeenCalled();
  });

  it('Tab 은 패널 안의 마지막 포커스 가능 요소에서 첫 요소로 순환한다(포커스 트랩)', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: '도움말 열기' }));

    const closeBtn = screen.getByRole('button', { name: '닫기' });
    const last = screen.getByRole('button', { name: '마지막 버튼' });

    last.focus();
    expect(last).toHaveFocus();
    // 마지막 요소에서 Tab → 첫 포커스 가능 요소(닫기 버튼)로 순환.
    await user.tab();
    expect(closeBtn).toHaveFocus();

    // 첫 포커스 가능 요소에서 Shift+Tab → 마지막 요소로 역순환.
    await user.tab({ shift: true });
    expect(last).toHaveFocus();
  });

  // ── 포커스 강탈 ────────────────────────────────────────────────────────────────────
  // 기현 신고 2026-08-17: *"첫 배치 시 모달의 텍스트박스에 포커스가 안 간다"*. 모달을 여는
  // 그 손짓이 아직 안 끝나서, 모달이 뜬 **뒤에** 도착한 mousedown 이 tabIndex 를 가진 코트로
  // 포커스를 도로 가져갔다. Tab 트랩은 Tab 키만 보므로 이 경로를 통째로 놓친다.
  it('배경이 포커스를 가져가면 패널 안 **마지막으로 서 있던 자리**로 되돌린다', async () => {
    const user = userEvent.setup();
    const outside = document.createElement('div');
    outside.tabIndex = 0;
    document.body.append(outside);

    render(<Harness />);
    await user.click(screen.getByRole('button', { name: '도움말 열기' }));

    const last = screen.getByRole('button', { name: '마지막 버튼' });
    last.focus();
    expect(last).toHaveFocus();

    // 배경이 스스로 포커스를 집어간다(코트의 tabIndex=0 <svg> 가 하던 일).
    outside.focus();

    // 닫기 ✕ 가 아니라 **마지막으로 서 있던 자리**로 돌아와야 한다 — 글 칸에 섰던 사람을
    // ✕ 로 끌고 가면 되돌린 것이 아니다.
    await waitFor(() => expect(last).toHaveFocus());
    outside.remove();
  });
});
