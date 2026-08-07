import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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
});
