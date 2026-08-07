import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Toggle } from './Toggle.tsx';

describe('Toggle', () => {
  it('role="switch" + aria-checked 로 상태를 노출한다', () => {
    render(<Toggle checked={true} onChange={() => {}} ariaLabel="규칙 존" />);
    expect(screen.getByRole('switch', { name: '규칙 존' })).toHaveAttribute('aria-checked', 'true');
  });

  it('클릭하면 반전된 값으로 onChange 를 호출한다', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Toggle checked={false} onChange={onChange} ariaLabel="반복" />);
    await user.click(screen.getByRole('switch', { name: '반복' }));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('Space 키만으로 토글된다 (네이티브 button 클릭 위임 — 별도 핸들러 불필요)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Toggle checked={false} onChange={onChange} ariaLabel="반복" />);
    const el = screen.getByRole('switch', { name: '반복' });
    el.focus();
    await user.keyboard(' ');
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('래퍼(전체 버튼)가 §7.3 최소 터치 타깃 min-height:var(--hit) 을 갖는다', () => {
    render(<Toggle checked={false} onChange={() => {}} ariaLabel="반복" />);
    const el = screen.getByRole('switch', { name: '반복' });
    expect(el.style.minHeight).toBe('var(--hit)');
  });
});
