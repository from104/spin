// §4.7 가져오기 충돌 모달. conflict:'exists' 항목만 노출되고, 선택한 해상도가 onConfirm 에
// 인덱스 기준으로 그대로 전달되는지 확인한다.
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ImportDialog } from './ImportDialog.tsx';
import type { ImportCandidate } from '../../storage/transfer.ts';
import type { Drill } from '../../model/drill.ts';
import { SettingsProvider } from '../../store/settings/SettingsProvider.tsx';

function candidate(over: Partial<ImportCandidate<Drill>>): ImportCandidate<Drill> {
  return {
    doc: { title: '더미' } as Drill,
    repairs: [],
    conflict: 'none',
    ...over,
  };
}

describe('ImportDialog', () => {
  it('conflict:exists 항목만 노출하고 기본값은 사본으로 추가다', async () => {
    // 후보 셋(none·identical·exists)을 한 번에 렌더해 exists 만 노출되는지와 기본 해상도를
    // 같은 케이스에서 잰다.
    const drills = [
      candidate({ doc: { title: '새 드릴' } as Drill, conflict: 'none' }),
      candidate({ doc: { title: '동일 드릴' } as Drill, conflict: 'identical' }),
      candidate({ doc: { title: '충돌 드릴' } as Drill, conflict: 'exists', existing: { title: '기존 드릴', updatedAt: 0 } }),
    ];
    const onConfirm = vi.fn();
    render(<ImportDialog open drills={drills} onCancel={() => {}} onConfirm={onConfirm} />, { wrapper: SettingsProvider });

    expect(screen.queryByText('새 드릴')).not.toBeInTheDocument();
    expect(screen.queryByText('동일 드릴')).not.toBeInTheDocument();
    expect(screen.getByText('충돌 드릴')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '사본으로 추가' })).toHaveAttribute('aria-checked', 'true');

    await userEvent.setup().click(screen.getByRole('button', { name: '가져오기' }));
    expect(onConfirm).toHaveBeenCalledWith(new Map());
  });

  it('덮어쓰기를 고르면 해당 인덱스로 전달된다', async () => {
    const drills = [
      candidate({ doc: { title: 'A' } as Drill, conflict: 'exists' }),
      candidate({ doc: { title: 'B' } as Drill, conflict: 'exists' }),
    ];
    const onConfirm = vi.fn();
    render(<ImportDialog open drills={drills} onCancel={() => {}} onConfirm={onConfirm} />, { wrapper: SettingsProvider });

    // 두 후보(A, B) 모두 "건너뛰기" 라벨을 쓰므로 문서 순서상 두 번째(=B) 라디오를 고른다.
    const user = userEvent.setup();
    await user.click(screen.getAllByRole('radio', { name: '건너뛰기' })[1]!);
    await user.click(screen.getByRole('button', { name: '가져오기' }));

    const resolutions = onConfirm.mock.calls[0]![0] as Map<number, string>;
    expect(resolutions.get(1)).toBe('skip');
    expect(resolutions.has(0)).toBe(false);
  });

  it('취소를 누르면 onCancel 이 호출된다', async () => {
    const onCancel = vi.fn();
    render(<ImportDialog open drills={[candidate({ conflict: 'exists' })]} onCancel={onCancel} onConfirm={() => {}} />, { wrapper: SettingsProvider });
    await userEvent.setup().click(screen.getByRole('button', { name: '취소' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
