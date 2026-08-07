// §6.11 대문 화면. 빈 상태(§작업지시 "드릴 0개일 때 빈 상태를 반드시 만들어라")와 실데이터 렌더
// 둘 다 확인한다. LibraryProvider 를 실제로 마운트해 fake-indexeddb 를 통해 데이터를 채운다.
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { HomeScreen } from './HomeScreen.tsx';
import type { HomeNav } from './nav.ts';
import { LibraryProvider } from '../../store/library/LibraryProvider.tsx';
import { idbDrillRepo } from '../../storage/drillRepo.ts';
import { createSession } from '../../storage/sessionRepo.ts';
import { formatSessionWhen } from '../../model/session.ts';

function makeNav(): HomeNav {
  return {
    newDrill: vi.fn(),
    openDrill: vi.fn(),
    goLibrary: vi.fn(),
    openSession: vi.fn(),
    presentDrill: vi.fn(),
    presentSession: vi.fn(),
  };
}

const wrapper = ({ children }: { children: ReactNode }) => <LibraryProvider>{children}</LibraryProvider>;

describe('HomeScreen', () => {
  it('드릴이 없으면 빈 상태와 새 드릴 만들기 CTA 를 보여준다', async () => {
    const nav = makeNav();
    render(<HomeScreen nav={nav} />, { wrapper });
    await waitFor(() => expect(screen.getByText('아직 만든 드릴이 없습니다.')).toBeInTheDocument());
    expect(screen.getByText('예정된 세션이 없습니다.')).toBeInTheDocument();

    await userEvent.setup().click(screen.getAllByRole('button', { name: '새 드릴 만들기' })[0]!);
    expect(nav.newDrill).toHaveBeenCalledTimes(1);
  });

  it('최근 드릴과 통계를 실데이터로 렌더한다', async () => {
    await idbDrillRepo.createDrill({ courtMode: 'full', title: '측면 돌파', category: '공격' });
    const nav = makeNav();
    render(<HomeScreen nav={nav} />, { wrapper });

    await waitFor(() => expect(screen.getByText('측면 돌파')).toBeInTheDocument());
    expect(screen.getByText('전체 드릴')).toBeInTheDocument();

    await userEvent.setup().click(screen.getByText('측면 돌파'));
    expect(nav.openDrill).toHaveBeenCalledTimes(1);
  });

  it('예정된 세션이 있으면 카드를 클릭해 openSession 을 호출한다', async () => {
    const scheduledAt = Date.now() + 3600_000;
    const s = await createSession({ title: '수요 훈련', scheduledAt });
    const nav = makeNav();
    render(<HomeScreen nav={nav} />, { wrapper });

    const whenText = formatSessionWhen(scheduledAt);
    await waitFor(() => expect(screen.getByText(whenText)).toBeInTheDocument());
    // 카드 전체가 버튼이다(§6.11) — 시각이 적힌 텍스트를 감싸는 버튼을 클릭한다.
    const card = screen.getByText(whenText).closest('button')!;
    await userEvent.setup().click(card);
    expect(nav.openSession).toHaveBeenCalledWith(s.id);
  });
});
