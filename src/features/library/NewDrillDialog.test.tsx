// §6.11 [새 드릴] 다이얼로그 — 2026-08-28 기현 지시로 [새 드릴]이 전술판 대신 이 모달을 연다.
// 여기서 못박는 것은 **태어난 드릴의 모양**이다: 고른 이름·코트가 실제로 저장소에 들어가고,
// 스텝이 하나로 시작하는가. 다이얼로그가 어디서 뜨는지(헤더/목록 두 진입점)는 AppShell.wiring
// 소관이고, 화면 이동은 onCreated 콜백으로 확인한다.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { NewDrillDialog } from './NewDrillDialog.tsx';
import { LibraryProvider } from '../../store/library/LibraryProvider.tsx';
import { SettingsProvider } from '../../store/settings/SettingsProvider.tsx';
import { idbDrillRepo } from '../../storage/drillRepo.ts';
import type { DrillId } from '../../core/ids.ts';

const wrapper = ({ children }: { children: ReactNode }) => (
  <SettingsProvider>
    <LibraryProvider>{children}</LibraryProvider>
  </SettingsProvider>
);

// fake-indexeddb 는 파일 하나가 끝날 때까지 살아 있다 — 앞 테스트가 만든 드릴이 뒤로 샌다.
beforeEach(async () => {
  for (const d of await idbDrillRepo.listDrillSummaries()) await idbDrillRepo.deleteDrill(d.id);
});

/** 만들어진 드릴을 저장소에서 되읽는다 — onCreated 가 준 id 가 진짜 저장된 것인지까지 본다. */
async function created(onCreated: ReturnType<typeof vi.fn>) {
  await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
  const id = onCreated.mock.calls[0]![0] as DrillId;
  const d = await idbDrillRepo.getDrill(id);
  expect(d).toBeTruthy();
  return d!;
}

function open(onCreated = vi.fn(), onClose = vi.fn()) {
  render(<NewDrillDialog open onClose={onClose} onCreated={onCreated} />, { wrapper });
  return { onCreated, onClose };
}

describe('새 드릴 다이얼로그', () => {
  it('열면 커서가 이름 칸에 선다 — ✕ 가 아니다', () => {
    open();
    expect(document.activeElement).toBe(screen.getByLabelText('드릴 이름'));
  });

  it('이름·코트를 골라 만들면 그대로 저장되고, 스텝 하나로 시작한다', async () => {
    const user = userEvent.setup();
    const { onCreated } = open();

    await user.type(screen.getByLabelText('드릴 이름'), '  2-3 코너킥  ');
    await user.click(screen.getByRole('radio', { name: '코트 크기 최소 25 × 14 m' }));
    await user.click(screen.getByRole('button', { name: '만들기' }));

    const d = await created(onCreated);
    expect(d.title).toBe('2-3 코너킥'); // 앞뒤 공백은 걷는다
    expect(d.courtMode).toBe('full');
    expect(d.courtSize).toBe('25x14');
    expect(d.steps).toHaveLength(1);
  });

  it('이름을 비워도 막지 않는다 — 기본 이름으로 태어나고 편집기에서 고친다', async () => {
    const user = userEvent.setup();
    const { onCreated } = open();
    await user.click(screen.getByRole('button', { name: '만들기' }));
    const d = await created(onCreated);
    expect(d.title).toBe('새 드릴');
    expect(d.courtSize).toBe('30x18'); // 기본 코트
  });

  it('하프·플랫에서는 크기 라디오 대신 사실을 적는다 — 골라도 안 변하는 컨트롤은 거짓말이다', async () => {
    const user = userEvent.setup();
    const { onCreated } = open();

    await user.click(screen.getByRole('radio', { name: '하프 코트' }));
    expect(screen.queryByRole('radio', { name: /코트 크기/ })).toBeNull();
    expect(screen.getByText(/풀 코트에만/)).toBeTruthy();

    await user.click(screen.getByRole('button', { name: '만들기' }));
    const d = await created(onCreated);
    expect(d.courtMode).toBe('half');
  });

  it('[취소] 는 아무것도 만들지 않는다', async () => {
    const user = userEvent.setup();
    const { onCreated, onClose } = open();
    await user.type(screen.getByLabelText('드릴 이름'), '버릴 것');
    await user.click(screen.getByRole('button', { name: '취소' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onCreated).not.toHaveBeenCalled();
    expect(await idbDrillRepo.listDrillSummaries()).toHaveLength(0);
  });

  it('다시 열면 새 종이다 — 지난번에 고른 이름·코트가 남지 않는다', async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn();
    const { rerender } = render(<NewDrillDialog open={false} onClose={vi.fn()} onCreated={onCreated} />, { wrapper });

    rerender(<NewDrillDialog open onClose={vi.fn()} onCreated={onCreated} />);
    await user.type(screen.getByLabelText('드릴 이름'), '지난번');
    await user.click(screen.getByRole('radio', { name: '플랫 코트' }));

    rerender(<NewDrillDialog open={false} onClose={vi.fn()} onCreated={onCreated} />);
    rerender(<NewDrillDialog open onClose={vi.fn()} onCreated={onCreated} />);

    expect(screen.getByLabelText('드릴 이름')).toHaveValue('');
    expect(screen.getByRole('radio', { name: '풀 코트' })).toHaveAttribute('aria-checked', 'true');
  });
});
