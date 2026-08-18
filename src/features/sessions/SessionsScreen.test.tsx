// C5 — 세션 1급 화면. 옛 LibraryScreen '세션 탭' 스위트의 후계다: 빈 상태·시연·드로어(URL
// 파생)·'다음 세션' 스트립을 화면 승격 후의 계약으로 다시 못박는다.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { SessionsScreen } from './SessionsScreen.tsx';
import type { HomeNav } from '../home/nav.ts';
import { LibraryProvider } from '../../store/library/LibraryProvider.tsx';
import { ToastProvider } from '../../store/toast/ToastProvider.tsx';
import { idbDrillRepo } from '../../storage/drillRepo.ts';
import { createSession, deleteSession, listSessions } from '../../storage/sessionRepo.ts';
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

const wrapper = ({ children }: { children: ReactNode }) => (
  <LibraryProvider>
    <ToastProvider>{children}</ToastProvider>
  </LibraryProvider>
);

beforeEach(async () => {
  for (const d of await idbDrillRepo.listDrillSummaries()) await idbDrillRepo.deleteDrill(d.id);
  for (const s of await listSessions()) await deleteSession(s.session.id);
});

describe('SessionsScreen', () => {
  it('세션이 없으면 빈 상태 CTA 가 서고, [새 세션]이 만들자마자 nav.openSession 으로 드로어를 연다', async () => {
    const nav = makeNav();
    render(<SessionsScreen nav={nav} />, { wrapper });
    await waitFor(() => expect(screen.getByText(/아직 만든 세션이 없습니다/)).toBeInTheDocument());

    await userEvent.setup().click(screen.getByRole('button', { name: '새 세션' }));
    await waitFor(() => expect(nav.openSession).toHaveBeenCalledTimes(1));
    // 실제로 저장소에 만들어졌다 — 이동만 하고 세션이 없으면 드로어가 빈 화면이 된다.
    const all = await listSessions();
    expect(all).toHaveLength(1);
    expect(nav.openSession).toHaveBeenCalledWith(all[0]!.session.id);
  });

  it('[시연] 버튼이 nav.presentSession 을 그 세션 id 로 호출한다', async () => {
    const s = await createSession({ title: '목요 세션' });
    const nav = makeNav();
    render(<SessionsScreen nav={nav} />, { wrapper });
    await waitFor(() => expect(screen.getByText('목요 세션')).toBeInTheDocument());

    await userEvent.setup().click(screen.getByRole('button', { name: '목요 세션 시연 시작' }));
    expect(nav.presentSession).toHaveBeenCalledWith(s.id);
  });

  it('행을 열면 nav.openSession 으로 나간다 — 드로어 열림은 URL 이 저장소다', async () => {
    const s = await createSession({ title: '열기 세션' });
    const nav = makeNav();
    render(<SessionsScreen nav={nav} />, { wrapper });
    await waitFor(() => expect(screen.getByText('열기 세션')).toBeInTheDocument());

    // 행 본문 전체가 열기 버튼이다(SessionRow). [시연]·[더보기]도 제목을 이름에 품으므로
    // 그 둘을 제외한 나머지 하나가 행 버튼이다.
    const rowButton = screen
      .getAllByRole('button', { name: /열기 세션/ })
      .find((b) => !/시연|더보기|작업/.test(b.getAttribute('aria-label') ?? ''))!;
    await userEvent.setup().click(rowButton);
    expect(nav.openSession).toHaveBeenCalledWith(s.id);
    // 로컬 state 로 드로어를 직접 열지 않는다(주소가 진실) — nav 목이라 dialog 는 안 뜬다.
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('openSessionId(주소의 ?open=)로 열면 드로어가 자동으로 열리고 제목에 포커스된다', async () => {
    const s = await createSession({ title: '자동 오픈 세션' });
    const nav = makeNav();
    render(<SessionsScreen nav={nav} openSessionId={s.id} />, { wrapper });
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole('heading', { name: '자동 오픈 세션' })).toHaveFocus());
  });

  it("머리에 '다음 세션' 스트립이 서고, 가장 가까운 하나만 싣는다 (계획서 2.8)", async () => {
    const soon = Date.now() + 3600_000;
    const later = await createSession({ title: '다음 주 세션', scheduledAt: soon + 7 * 86_400_000 });
    const s = await createSession({ title: '가까운 세션', scheduledAt: soon });
    const nav = makeNav();
    render(<SessionsScreen nav={nav} />, { wrapper });

    const strip = await screen.findByRole('region', { name: '다음 세션' });
    expect(within(strip).getByText('가까운 세션')).toBeInTheDocument();
    expect(within(strip).getByText(formatSessionWhen(soon))).toBeInTheDocument();
    // 대조군 둘 — 더 먼 세션이 뽑히거나 전부 나열되면 잡힌다.
    expect(within(strip).queryByText('다음 주 세션')).toBeNull();
    expect(within(screen.getByRole('main')).getByText('다음 주 세션')).toBeInTheDocument();

    await userEvent.setup().click(within(strip).getByRole('button', { name: '다음 세션 가까운 세션 편성 열기' }));
    expect(nav.openSession).toHaveBeenCalledWith(s.id);
    expect(s.id).not.toBe(later.id);
  });

  it("예정 시각이 없는 세션뿐이면 '다음 세션' 스트립을 아예 안 그린다", async () => {
    await createSession({ title: '미정 세션' });
    const nav = makeNav();
    render(<SessionsScreen nav={nav} />, { wrapper });
    await waitFor(() => expect(screen.getByText('미정 세션')).toBeInTheDocument());
    expect(screen.queryByRole('region', { name: '다음 세션' })).toBeNull();
  });
});
