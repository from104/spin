// §6.11 목록 화면. 탭 전환, 빈 상태(§작업지시), 카드 액션(복제·삭제·되돌리기), 세션 드로어
// 진입을 확인한다. ToastProvider 를 함께 마운트해 실제 토스트 표시까지 검증한다.
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { LibraryScreen } from './LibraryScreen.tsx';
import type { HomeNav } from '../home/nav.ts';
import { LibraryProvider } from '../../store/library/LibraryProvider.tsx';
import { ToastProvider, useToast } from '../../store/toast/ToastProvider.tsx';
import { ToastHost } from '../../ui/ToastHost.tsx';
import { idbDrillRepo } from '../../storage/drillRepo.ts';
import { createSession } from '../../storage/sessionRepo.ts';

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

function ToastHostBridge() {
  const { toasts, dismiss } = useToast();
  return <ToastHost toasts={toasts} onDismiss={dismiss} />;
}

const wrapper = ({ children }: { children: ReactNode }) => (
  <LibraryProvider>
    <ToastProvider>
      {children}
      <ToastHostBridge />
    </ToastProvider>
  </LibraryProvider>
);

/** 2026-08-09 재편으로 목록 화면 상단에 훈련 현황 대시보드가 얹혔다(HomeDashboard). 그 안의
 *  "최근 작업한 드릴" 목록이 아래 드릴 그리드와 같은 제목을 갖기 때문에, 전역 getByText 는
 *  이제 두 개를 찾아 모호해진다 — 탭 패널로 좁혀서 "그리드에 있는가" 를 묻는다. */
const panel = () => screen.getByRole('tabpanel');

describe('LibraryScreen — 드릴 탭', () => {
  it('드릴이 없으면 빈 상태를 보여주고 새 드릴 만들기가 nav.newDrill 을 호출한다', async () => {
    const nav = makeNav();
    render(<LibraryScreen nav={nav} />, { wrapper });
    await waitFor(() => expect(within(panel()).getByText(/아직 만든 드릴이 없습니다/)).toBeInTheDocument());
    await userEvent.setup().click(within(panel()).getByRole('button', { name: '새 드릴 만들기' }));
    expect(nav.newDrill).toHaveBeenCalledTimes(1);
  });

  it('카드를 열면 nav.openDrill 이 호출된다', async () => {
    await idbDrillRepo.createDrill({ courtMode: 'full', title: '카드 열기 테스트' });
    const nav = makeNav();
    render(<LibraryScreen nav={nav} />, { wrapper });
    await waitFor(() => expect(within(panel()).getByText('카드 열기 테스트')).toBeInTheDocument());
    await userEvent.setup().click(screen.getByRole('button', { name: '카드 열기 테스트 열기' }));
    expect(nav.openDrill).toHaveBeenCalledTimes(1);
  });

  it('복제하면 카드가 하나 늘고 토스트가 뜬다', async () => {
    await idbDrillRepo.createDrill({ courtMode: 'full', title: '복제 대상' });
    const nav = makeNav();
    render(<LibraryScreen nav={nav} />, { wrapper });
    await waitFor(() => expect(within(panel()).getByText('복제 대상')).toBeInTheDocument());

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '복제 대상 더보기' }));
    await user.click(screen.getByRole('menuitem', { name: '복제' }));

    await waitFor(() => expect(within(panel()).getByText('복제 대상 (사본)')).toBeInTheDocument());
    expect(await screen.findByRole('status')).toHaveTextContent('복제했습니다');
  });

  it('삭제하면 카드가 사라지고 되돌리기로 복구된다', async () => {
    await idbDrillRepo.createDrill({ courtMode: 'full', title: '삭제 대상' });
    const nav = makeNav();
    render(<LibraryScreen nav={nav} />, { wrapper });
    await waitFor(() => expect(within(panel()).getByText('삭제 대상')).toBeInTheDocument());

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '삭제 대상 더보기' }));
    await user.click(screen.getByRole('menuitem', { name: '삭제' }));
    await waitFor(() => expect(within(panel()).queryByText('삭제 대상')).not.toBeInTheDocument());

    const toast = await screen.findByRole('status');
    await user.click(within(toast).getByRole('button', { name: '되돌리기' }));
    await waitFor(() => expect(within(panel()).getByText('삭제 대상')).toBeInTheDocument());
  });

  it('카드의 [시연] 1클릭이 nav.presentDrill 을 그 드릴 id 로 호출한다 — openDrill 은 안 불린다', async () => {
    // 판 걸이(로드맵 2.7) 완료 판정의 절반: 목록 → 시연 직행 경로. 나머지 절반(presentDrill →
    // presentTarget 세움)은 AppShell.wiring.test.tsx 가 어댑터 층에서 붙잡는다.
    const d = await idbDrillRepo.createDrill({ courtMode: 'full', title: '시연 직행 드릴' });
    const nav = makeNav();
    render(<LibraryScreen nav={nav} />, { wrapper });
    await waitFor(() => expect(within(panel()).getByText('시연 직행 드릴')).toBeInTheDocument());

    await userEvent.setup().click(screen.getByRole('button', { name: '시연 직행 드릴 시연 시작' }));
    expect(nav.presentDrill).toHaveBeenCalledTimes(1);
    expect(nav.presentDrill).toHaveBeenCalledWith(d.id);
    expect(nav.openDrill).not.toHaveBeenCalled(); // 대조군: [시연] 이 열기를 겸하면 여기서 잡힌다
  });

  it('난이도 그룹 헤더로 초급 → 고급 순서로 나뉘고, 빈 그룹(중급)은 헤더가 없다', async () => {
    // 판 걸이(계획서 2.2): 필터가 아니라 0클릭 그룹 **정렬**. 생성은 고급을 먼저 해서
    // "저장 순서가 우연히 초급→고급" 으로 통과하는 가짜 초록불을 막는다.
    await idbDrillRepo.createDrill({ courtMode: 'full', title: '고급 슈팅', level: '고급' });
    await idbDrillRepo.createDrill({ courtMode: 'full', title: '초급 드리블', level: '초급' });
    const nav = makeNav();
    render(<LibraryScreen nav={nav} />, { wrapper });
    await waitFor(() => expect(within(panel()).getByText('고급 슈팅')).toBeInTheDocument());

    const headings = within(panel()).getAllByRole('heading', { level: 2 });
    expect(headings.map((h) => h.textContent)).toEqual(['초급', '고급']);
    expect(within(panel()).queryByText('중급')).not.toBeInTheDocument();
    // 카드가 자기 난이도 섹션 안에 들어 있는지까지 — 헤더만 있고 배속이 틀리는 회귀를 막는다.
    expect(within(within(panel()).getByRole('region', { name: '초급 드릴' })).getByText('초급 드리블')).toBeInTheDocument();
    expect(within(within(panel()).getByRole('region', { name: '고급 드릴' })).getByText('고급 슈팅')).toBeInTheDocument();
  });

  it('카테고리 필터로 목록을 좁힌다', async () => {
    await idbDrillRepo.createDrill({ courtMode: 'full', title: '공격 드릴', category: '공격' });
    await idbDrillRepo.createDrill({ courtMode: 'full', title: '수비 드릴', category: '수비' });
    const nav = makeNav();
    render(<LibraryScreen nav={nav} />, { wrapper });
    await waitFor(() => expect(within(panel()).getByText('공격 드릴')).toBeInTheDocument());
    expect(within(panel()).getByText('수비 드릴')).toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole('radio', { name: '수비' }));
    await waitFor(() => expect(within(panel()).queryByText('공격 드릴')).not.toBeInTheDocument());
    expect(within(panel()).getByText('수비 드릴')).toBeInTheDocument();
  });
});

describe('LibraryScreen — 세션 탭', () => {
  it('initialTab="sessions" 로 열면 세션 탭이 활성화된다', async () => {
    const nav = makeNav();
    render(<LibraryScreen nav={nav} initialTab="sessions" />, { wrapper });
    await waitFor(() => expect(screen.getByRole('tab', { name: '세션' })).toHaveAttribute('aria-selected', 'true'));
    expect(screen.getByText(/아직 만든 세션이 없습니다/)).toBeInTheDocument();
  });

  it('세션이 있으면 [시연] 버튼이 nav.presentSession 을 호출한다', async () => {
    const s = await createSession({ title: '목요 세션' });
    const nav = makeNav();
    render(<LibraryScreen nav={nav} initialTab="sessions" />, { wrapper });
    await waitFor(() => expect(screen.getByText('목요 세션')).toBeInTheDocument());

    await userEvent.setup().click(screen.getByRole('button', { name: '목요 세션 시연 시작' }));
    expect(nav.presentSession).toHaveBeenCalledWith(s.id);
  });

  it('initialOpenSessionId 로 열면 드로어가 자동으로 열리고 제목에 포커스된다', async () => {
    const s = await createSession({ title: '자동 오픈 세션' });
    const nav = makeNav();
    render(<LibraryScreen nav={nav} initialTab="sessions" initialOpenSessionId={s.id} />, { wrapper });
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole('heading', { name: '자동 오픈 세션' })).toHaveFocus());
  });
});
