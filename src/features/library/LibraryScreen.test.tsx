// §6.11 목록 화면. 탭 전환, 빈 상태(§작업지시), 카드 액션(복제·삭제·되돌리기), 세션 드로어
// 진입을 확인한다. ToastProvider 를 함께 마운트해 실제 토스트 표시까지 검증한다.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { LibraryScreen } from './LibraryScreen.tsx';
import type { HomeNav } from '../home/nav.ts';
// ⚠️ 이 import 는 대조군 전용이다 — 화면이 아니라 **테스트**가 app-shell 을 부른다. 화면 쪽
// 소스가 이걸 import 하지 않는다는 것이 계획서 2.8 의 계약이고, nav.test.ts 가 정적 검사로
// 못박는다(테스트 파일은 그 스캔에서 제외된다).
import { useAppNav } from '../../app/useAppHistory.ts';
import { LibraryProvider } from '../../store/library/LibraryProvider.tsx';
import { ToastProvider, useToast } from '../../store/toast/ToastProvider.tsx';
import { ToastHost } from '../../ui/ToastHost.tsx';
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

/** 활성 탭 패널. 2026-08-12(계획서 2.8)에 상단 HomeDashboard 를 지웠지만 좁히기는 유지한다 —
 *  세션 탭 머리의 '다음 세션' 스트립이 아래 행과 같은 제목을 한 번 더 싣기 때문에, 전역
 *  getByText 는 여전히 "어느 자리에 있는가" 를 못 가른다. */
const panel = () => screen.getByRole('tabpanel');

// fake-indexeddb 는 파일 하나가 끝날 때까지 살아 있어 앞 테스트가 만든 드릴·세션이 뒤 테스트로
// 샌다. 2.9 부터 **기본 탭을 세션 개수가 정하므로**, 새어 든 세션 하나가 그대로 판정을 뒤집는다
// (실측: 이 초기화가 없으면 '탭 전환' it 이 "이미 세션 탭이라 클릭이 no-op" 으로 빨간불이 된다).
beforeEach(async () => {
  for (const d of await idbDrillRepo.listDrillSummaries()) await idbDrillRepo.deleteDrill(d.id);
  for (const s of await listSessions()) await deleteSession(s.session.id);
});

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

  it("세션 탭 머리에 '다음 세션' 스트립이 서고, 눌러 그 세션의 편성을 연다 (계획서 2.8)", async () => {
    // HomeDashboard 에서 살아남은 유일한 조각. 스트립은 아래 행에 없는 것 — 편성된 드릴 이름 —
    // 을 싣는다. 여기서는 '드릴 0개'라 제목·시각·총시간까지만 본다.
    const soon = Date.now() + 3600_000;
    const later = await createSession({ title: '다음 주 세션', scheduledAt: soon + 7 * 86_400_000 });
    const s = await createSession({ title: '가까운 세션', scheduledAt: soon });
    const nav = makeNav();
    render(<LibraryScreen nav={nav} initialTab="sessions" />, { wrapper });

    const strip = await screen.findByRole('region', { name: '다음 세션' });
    expect(within(strip).getByText('가까운 세션')).toBeInTheDocument();
    expect(within(strip).getByText(formatSessionWhen(soon))).toBeInTheDocument();
    // 대조군 둘 — 스트립은 **가장 가까운 하나**다. 더 먼 세션이 뽑히거나 전부 나열되면 잡힌다.
    expect(within(strip).queryByText('다음 주 세션')).toBeNull();
    expect(within(panel()).getByText('다음 주 세션')).toBeInTheDocument(); // 행으로는 둘 다 서 있다

    await userEvent.setup().click(within(strip).getByRole('button', { name: '다음 세션 가까운 세션 편성 열기' }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    expect(within(screen.getByRole('dialog')).getByRole('heading', { name: '가까운 세션' })).toBeInTheDocument();
    expect(s.id).not.toBe(later.id);
  });

  it("예정 시각이 없는 세션뿐이면 '다음 세션' 스트립을 아예 안 그린다", async () => {
    // 없는 것을 "없습니다" 라고 알리는 빈 카드는 대시보드에서 자리만 먹던 그것이다.
    await createSession({ title: '미정 세션' });
    const nav = makeNav();
    render(<LibraryScreen nav={nav} initialTab="sessions" />, { wrapper });
    await waitFor(() => expect(within(panel()).getByText('미정 세션')).toBeInTheDocument());
    expect(screen.queryByRole('region', { name: '다음 세션' })).toBeNull();
  });
});

describe('LibraryScreen — 기본 탭은 세션 개수가 정한다 (계획서 2.9)', () => {
  const tabOf = (name: '드릴' | '세션') => screen.getByRole('tab', { name });

  it('세션이 0개면 [드릴] 탭이 기본이다', async () => {
    const nav = makeNav();
    render(<LibraryScreen nav={nav} />, { wrapper });
    await waitFor(() => expect(within(panel()).getByText(/아직 만든 드릴이 없습니다/)).toBeInTheDocument());
    expect(tabOf('드릴')).toHaveAttribute('aria-selected', 'true');
    expect(tabOf('세션')).toHaveAttribute('aria-selected', 'false');
  });

  it('세션이 하나라도 있으면 [세션] 탭이 기본이다 — 목록이 비동기로 읽힌 뒤에도', async () => {
    // 첫 렌더에는 sessions 가 아직 빈 배열이다(IDB 를 비동기로 읽는다). 개수가 확정된 뒤에
    // 다시 맞추지 않으면 여기가 영원히 [드릴] 로 남는다 — 그 미끄러짐을 잡는 자리다.
    await createSession({ title: '금요 훈련' });
    const nav = makeNav();
    render(<LibraryScreen nav={nav} />, { wrapper });
    await waitFor(() => expect(tabOf('세션')).toHaveAttribute('aria-selected', 'true'));
    expect(tabOf('드릴')).toHaveAttribute('aria-selected', 'false');
    expect(within(panel()).getByText('금요 훈련')).toBeInTheDocument();
  });

  it('NavEntry 가 실어 온 탭은 세션 개수를 이긴다 — 기본값이 사용자의 선택을 덮지 않는다', async () => {
    await createSession({ title: '금요 훈련' });
    const nav = makeNav();
    render(<LibraryScreen nav={nav} initialTab="drills" />, { wrapper });
    await waitFor(() => expect(within(panel()).getByText(/아직 만든 드릴이 없습니다/)).toBeInTheDocument());
    expect(tabOf('드릴')).toHaveAttribute('aria-selected', 'true');
  });
});

describe('LibraryScreen — 이동 통로는 HomeNav prop 하나뿐이다 (계획서 2.8)', () => {
  it('탭 전환이 nav.goLibrary 로 나간다 — 같은 탭을 다시 눌러 히스토리를 쌓지는 않는다', async () => {
    const nav = makeNav();
    render(<LibraryScreen nav={nav} />, { wrapper });
    await waitFor(() => expect(screen.getByRole('tab', { name: '드릴' })).toHaveAttribute('aria-selected', 'true'));

    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: '세션' }));
    expect(nav.goLibrary).toHaveBeenCalledTimes(1);
    expect(nav.goLibrary).toHaveBeenCalledWith({ tab: 'sessions' });
    expect(screen.getByRole('tab', { name: '세션' })).toHaveAttribute('aria-selected', 'true'); // 낙관 갱신
    // 대조군 — 탭 전환이 화면 전환 콜백으로 새지 않았다.
    expect(nav.openDrill).not.toHaveBeenCalled();
    expect(nav.newDrill).not.toHaveBeenCalled();

    await user.click(screen.getByRole('tab', { name: '세션' }));
    expect(nav.goLibrary).toHaveBeenCalledTimes(1);
  });

  it('뒤로가기로 돌아온 initialTab 이 탭을 되돌린다 — 탭이 없는 엔트리면 기본 탭으로', async () => {
    const nav = makeNav();
    const { rerender } = render(<LibraryScreen nav={nav} />, { wrapper });
    await waitFor(() => expect(screen.getByRole('tab', { name: '드릴' })).toHaveAttribute('aria-selected', 'true'));

    await userEvent.setup().click(screen.getByRole('tab', { name: '세션' }));
    expect(screen.getByRole('tab', { name: '세션' })).toHaveAttribute('aria-selected', 'true');

    // app-shell 이 NavEntry {kind:'tab'} 을 풀어 내려주는 자리 = initialTab prop.
    rerender(<LibraryScreen nav={nav} initialTab="sessions" />);
    expect(screen.getByRole('tab', { name: '세션' })).toHaveAttribute('aria-selected', 'true');

    // 탭을 안 실은 이전 엔트리로 돌아왔다 → 기본 탭(세션 0개이므로 [드릴])으로 되돌아야 한다.
    rerender(<LibraryScreen nav={nav} />);
    await waitFor(() => expect(screen.getByRole('tab', { name: '드릴' })).toHaveAttribute('aria-selected', 'true'));
  });

  it('대조군 — 같은 트리에서 useAppNav 를 부르면 실제로 던진다', () => {
    // 이게 없으면 위 두 it 은 "AppNavProvider 없이 렌더돼도 멀쩡하다" 를 공짜로 통과한다:
    // 직접 통로가 관측 가능한 조건이라는 것을 여기서 보인다.
    function Probe() {
      useAppNav();
      return null;
    }
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(() => render(<Probe />, { wrapper })).toThrow(/AppShell/);
    } finally {
      quiet.mockRestore();
    }
  });
});
