// §6.11/부록A 드릴 카드. 열기·더보기 메뉴(복제/내보내기/삭제) 동작을 확인한다.
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DrillCard } from './DrillCard.tsx';
import { buildSummary } from '../../model/summary.ts';
import { createDrill } from '../../model/defaults.ts';

function makeSummary(title = '카드 테스트 드릴') {
  return buildSummary(createDrill({ courtMode: 'full', title }));
}

describe('DrillCard', () => {
  it('카드를 클릭하면 onOpen 이 호출된다', async () => {
    const onOpen = vi.fn();
    const d = makeSummary();
    render(<DrillCard drill={d} onOpen={onOpen} onDuplicate={() => {}} onDelete={() => {}} onExport={() => {}} />);
    await userEvent.setup().click(screen.getByRole('button', { name: `${d.title} 열기` }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('더보기 메뉴에서 복제·내보내기·삭제를 각각 호출할 수 있다', async () => {
    const d = makeSummary();
    const onDuplicate = vi.fn();
    const onExport = vi.fn();
    const onDelete = vi.fn();
    render(<DrillCard drill={d} onOpen={() => {}} onDuplicate={onDuplicate} onDelete={onDelete} onExport={onExport} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: `${d.title} 더보기` }));
    await user.click(screen.getByRole('menuitem', { name: '복제' }));
    expect(onDuplicate).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: `${d.title} 더보기` }));
    await user.click(screen.getByRole('menuitem', { name: '내보내기' }));
    expect(onExport).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: `${d.title} 더보기` }));
    await user.click(screen.getByRole('menuitem', { name: '삭제' }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('Escape 를 누르면 메뉴가 닫힌다', async () => {
    const d = makeSummary();
    render(<DrillCard drill={d} onOpen={() => {}} onDuplicate={() => {}} onDelete={() => {}} onExport={() => {}} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: `${d.title} 더보기` }));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
