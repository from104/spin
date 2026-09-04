import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { Segmented } from './Segmented.tsx';

const OPTIONS = [
  { value: 'full', label: '풀 코트' },
  { value: 'half', label: '하프 코트' },
  { value: 'flat', label: '플랫 코트' },
] as const;

function ControlledSegmented() {
  const [value, setValue] = useState<'full' | 'half' | 'flat'>('full');
  return <Segmented options={OPTIONS} value={value} onChange={setValue} ariaLabel="코트 형태" />;
}

describe('Segmented', () => {
  it('컨테이너는 role=radiogroup + aria-label, 항목은 role=radio + aria-checked (§7.7)', () => {
    render(<Segmented options={OPTIONS} value="half" onChange={() => {}} ariaLabel="코트 형태" />);
    const group = screen.getByRole('radiogroup', { name: '코트 형태' });
    expect(group).toBeInTheDocument();
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(3);
    expect(screen.getByRole('radio', { name: '하프 코트' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: '풀 코트' })).toHaveAttribute('aria-checked', 'false');
  });

  it('선택된 항목만 tabIndex=0 이고 나머지는 -1 이다(로빙 tabindex)', () => {
    render(<Segmented options={OPTIONS} value="half" onChange={() => {}} ariaLabel="코트 형태" />);
    expect(screen.getByRole('radio', { name: '하프 코트' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('radio', { name: '풀 코트' })).toHaveAttribute('tabindex', '-1');
    expect(screen.getByRole('radio', { name: '플랫 코트' })).toHaveAttribute('tabindex', '-1');
  });

  it('클릭으로 값이 바뀐다', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Segmented options={OPTIONS} value="full" onChange={onChange} ariaLabel="코트 형태" />);
    await user.click(screen.getByRole('radio', { name: '플랫 코트' }));
    expect(onChange).toHaveBeenCalledWith('flat');
  });

  it('오른쪽/왼쪽 방향키로 순회하며 즉시 선택이 바뀌고 포커스가 이동한다(§7.5-b 순회 패턴과 동일)', async () => {
    const user = userEvent.setup();
    render(<ControlledSegmented />);
    const full = screen.getByRole('radio', { name: '풀 코트' });
    full.focus();
    expect(full).toHaveFocus();

    await user.keyboard('{ArrowRight}');
    const half = screen.getByRole('radio', { name: '하프 코트' });
    expect(half).toHaveFocus();
    expect(half).toHaveAttribute('aria-checked', 'true');

    await user.keyboard('{ArrowRight}');
    const flat = screen.getByRole('radio', { name: '플랫 코트' });
    expect(flat).toHaveFocus();
    expect(flat).toHaveAttribute('aria-checked', 'true');

    // 마지막 항목에서 오른쪽 → 순환해서 첫 항목으로
    await user.keyboard('{ArrowRight}');
    expect(full).toHaveFocus();
    expect(full).toHaveAttribute('aria-checked', 'true');

    // 왼쪽 → 마지막 항목으로 역순환
    await user.keyboard('{ArrowLeft}');
    expect(flat).toHaveFocus();
  });

  it('Home/End 는 첫/마지막 항목으로 이동한다', async () => {
    const user = userEvent.setup();
    render(<ControlledSegmented />);
    screen.getByRole('radio', { name: '하프 코트' }).focus();

    await user.keyboard('{End}');
    expect(screen.getByRole('radio', { name: '플랫 코트' })).toHaveFocus();

    await user.keyboard('{Home}');
    expect(screen.getByRole('radio', { name: '풀 코트' })).toHaveFocus();
  });

  it('비활성 옵션은 방향키로 포커스는 이동하되 선택되지는 않는다(§7.8 aria-disabled 패턴)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const options = [
      { value: 'a', label: 'A' },
      { value: 'b', label: 'B', disabled: true },
      { value: 'c', label: 'C' },
    ] as const;
    render(<Segmented options={options} value="a" onChange={onChange} ariaLabel="테스트" />);
    screen.getByRole('radio', { name: 'A' }).focus();
    await user.keyboard('{ArrowRight}');
    const disabledItem = screen.getByRole('radio', { name: 'B' });
    expect(disabledItem).toHaveFocus();
    expect(disabledItem).toHaveAttribute('aria-disabled', 'true');
    expect(onChange).not.toHaveBeenCalled();
  });
});
