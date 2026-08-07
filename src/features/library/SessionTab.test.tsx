// §6.11 세션 탭 목록. 빈 상태, 행 클릭(편집), [시연], 더보기(내보내기/삭제)를 확인한다.
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SessionTab } from './SessionTab.tsx';
import type { ResolvedSession } from '../../model/session.ts';

function makeResolved(over: Partial<ResolvedSession['session']> = {}): ResolvedSession {
  const session: ResolvedSession['session'] = {
    schemaVersion: 1,
    id: 'se_x' as ResolvedSession['session']['id'],
    title: '금요 훈련',
    items: [],
    drillIds: [],
    createdAt: 0,
    updatedAt: 0,
    ...over,
  };
  return { session, items: [], totalMin: 0, missingCount: 0 };
}

describe('SessionTab', () => {
  it('세션이 없으면 빈 상태와 새 세션 CTA 를 보여준다', async () => {
    const onCreate = vi.fn();
    render(<SessionTab sessions={[]} onOpen={() => {}} onPresent={() => {}} onDelete={() => {}} onExport={() => {}} onCreate={onCreate} />);
    expect(screen.getByText(/아직 만든 세션이 없습니다/)).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: '새 세션' }));
    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it('행을 클릭하면 onOpen, [시연] 버튼은 onPresent 를 호출한다', async () => {
    const resolved = makeResolved();
    const onOpen = vi.fn();
    const onPresent = vi.fn();
    render(<SessionTab sessions={[resolved]} onOpen={onOpen} onPresent={onPresent} onDelete={() => {}} onExport={() => {}} onCreate={() => {}} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '금요 훈련 시연 시작' }));
    expect(onPresent).toHaveBeenCalledWith(resolved.session.id);

    await user.click(screen.getByText('금요 훈련'));
    expect(onOpen).toHaveBeenCalledWith(resolved.session.id);
  });

  it('더보기 메뉴에서 내보내기·삭제를 호출한다', async () => {
    const resolved = makeResolved();
    const onExport = vi.fn();
    const onDelete = vi.fn();
    render(<SessionTab sessions={[resolved]} onOpen={() => {}} onPresent={() => {}} onDelete={onDelete} onExport={onExport} onCreate={() => {}} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '금요 훈련 더보기' }));
    await user.click(screen.getByRole('menuitem', { name: '내보내기' }));
    expect(onExport).toHaveBeenCalledWith(resolved.session.id);

    await user.click(screen.getByRole('button', { name: '금요 훈련 더보기' }));
    await user.click(screen.getByRole('menuitem', { name: '삭제' }));
    expect(onDelete).toHaveBeenCalledWith(resolved.session.id);
  });
});
