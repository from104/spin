// C5/C6 — 세션 1급 화면(목록). 옛 LibraryScreen '세션 탭' 스위트의 후계다: 빈 상태·시연·
// '다음 세션' 스트립을 화면 승격 후의 계약으로 다시 못박는다. 편집은 SessionEditorScreen.test.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { SessionsScreen } from './SessionsScreen.tsx';
import type { HomeNav } from '../home/nav.ts';
import { LibraryProvider } from '../../store/library/LibraryProvider.tsx';
import { ToastProvider, useToast } from '../../store/toast/ToastProvider.tsx';
import { ToastHost } from '../../ui/ToastHost.tsx';
import { idbDrillRepo } from '../../storage/drillRepo.ts';
import { createSession, deleteSession, listSessions, putSession } from '../../storage/sessionRepo.ts';
import { addSessionItem } from '../../model/session.ts';
import { createDrill } from '../../model/defaults.ts';
import type { Drill } from '../../model/drill.ts';
import { formatSessionWhen } from '../../model/session.ts';
import { SettingsProvider } from '../../store/settings/SettingsProvider.tsx';
import { makeDefaultPrefs, PREFS_KEY } from '../../storage/prefs.ts';

// 세션 [링크로 공유](S4)의 목은 **접기·잠그기·올리기 전체**다. 이 파일이 재는 것은 그 사슬이
// 아니라 **케밥이 무엇을 넘기는가** 하나뿐이라서다 — 사슬 자체는 share/*(코덱·암호)와
// ShareLinkModal.test 가 진짜로 돌려 잰다. 여기서까지 진짜로 돌리면 같은 시나리오가 두 번 돈다.
const createShareLinkSpy = vi.fn();
vi.mock('../../share/index.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../share/index.ts')>();
  return { ...actual, createShareLink: (...args: unknown[]) => createShareLinkSpy(...args) };
});

function makeNav(): HomeNav {
  return {
    newDrill: vi.fn(),
    openDrill: vi.fn(),
    goLibrary: vi.fn(),
    openSession: vi.fn(),
    presentDrill: vi.fn(),
    presentSession: vi.fn(),
    openRuleTopic: vi.fn(),
    openLegal: vi.fn(),
    openTeam: vi.fn(),
  };
}

function ToastHostBridge() {
  const { toasts, dismiss } = useToast();
  return <ToastHost toasts={toasts} onDismiss={dismiss} />;
}

// §C-4(2026-08-20) 삭제 undo 토스트를 실제로 검증하려면 ToastHost 도 함께 마운트해야 한다
// (LibraryScreen.test.tsx 와 같은 이유 — ToastProvider 는 상태만, 표시는 ToastHost 몫).
const wrapper = ({ children }: { children: ReactNode }) => (
  <SettingsProvider>
    <LibraryProvider>
      <ToastProvider>
        {children}
        <ToastHostBridge />
      </ToastProvider>
    </LibraryProvider>
  </SettingsProvider>
);

beforeEach(async () => {
  for (const d of await idbDrillRepo.listDrillSummaries()) await idbDrillRepo.deleteDrill(d.id);
  for (const s of await listSessions()) await deleteSession(s.session.id);
  const { getDB } = await import('../../storage/db.ts');
  await (await getDB()).clear('teams'); // 팀 위생(2026-09-09) — 앞 테스트의 팀이 칩으로 새어 들지 않게
  // 세션 목록 튜토리얼이 자동 시작하면(§0.5, tutorialsSeen 미지정) 스포트라이트 다이얼로그가
  // 떠서 "다이얼로그 없음" 을 잰 아래 테스트들이 깨진다 — "이미 봤다" 상태로 시작한다.
  localStorage.setItem(PREFS_KEY, JSON.stringify({ ...makeDefaultPrefs(), tutorialsSeen: { sessions: true } }));
  createShareLinkSpy.mockReset();
  createShareLinkSpy.mockResolvedValue({ link: `https://spin.example/s/Ab3dEf9hIj#${'k'.repeat(43)}`, id: 'Ab3dEf9hIj', deleteToken: 'tok', expiresAt: 0 });
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

  // PLAN-TEAM 결정 11 — 카드의 팀 칩. 약칭이 있으면 약칭(카드 한 줄에 팀 이름 전체는 안 들어간다).
  it('팀을 지목한 세션 카드에만 팀 칩이 뜨고, 지워진 팀은 칩 없이 카드만 뜬다', async () => {
    const { createTeam, putTeam } = await import('../../storage/teamRepo.ts');
    const team = await putTeam({ ...(await createTeam({ name: '가치이룸 클럽' })), shortName: '가치' });
    const withTeam = await createSession({ title: '소속 세션' });
    await putSession({ ...withTeam, teamId: team.id });
    const orphan = await createSession({ title: '고아 세션' });
    await putSession({ ...orphan, teamId: 'tm_ghost' as never });
    await createSession({ title: '무소속 세션' });

    render(<SessionsScreen nav={makeNav()} />, { wrapper });
    await waitFor(() => expect(screen.getByText('무소속 세션')).toBeInTheDocument());
    // 약칭이 뜬다 — 팀 이름 전체가 뜨면 이 단언이 깨진다.
    // ⚠️ 2026-09-09(검수) — «무엇의 이름인지» 는 `aria-label` 이 아니라 **sr-only 한 줄**로 읽어
    // 준다(SessionTab.tsx 의 그 주석: role 이 generic 인 span 에는 author 가 이름을 못 붙인다).
    // 그래서 여기서도 label 이 아니라 **읽히는 글자**로 찾는다 — 보조기술이 실제로 받는 것이다.
    expect(await screen.findByText('팀 가치')).toBeInTheDocument();
    expect(screen.getByText('가치')).toBeInTheDocument(); // 눈에 보이는 칩은 약칭만
    expect(screen.queryByText('가치이룸 클럽')).toBeNull();
    // 지워진 팀·팀 미지정 세션은 칩 없이 그대로 뜬다(참가자 유령 id 와 같은 교리).
    expect(screen.getByText('고아 세션')).toBeInTheDocument();
    expect(screen.getAllByText(/^팀 /)).toHaveLength(1); // 칩은 하나뿐
  });

  it("예정 시각이 없는 세션뿐이면 '다음 세션' 스트립을 아예 안 그린다", async () => {
    await createSession({ title: '미정 세션' });
    const nav = makeNav();
    render(<SessionsScreen nav={nav} />, { wrapper });
    await waitFor(() => expect(screen.getByText('미정 세션')).toBeInTheDocument());
    expect(screen.queryByRole('region', { name: '다음 세션' })).toBeNull();
  });
});

// PLAN-DELETE-SAFETY.md §C-4(2026-08-20) — 착수 전까지 이 화면엔 삭제 테스트가 하나도 없었다
// (조사에서 "완전 무방비" 로 지목된 지점). 드릴(LibraryScreen)과 대칭인 확인·되돌리기를 잰다.
describe('SessionsScreen — 삭제 안전망(§C-4)', () => {
  it('삭제하면 확인 모달을 거쳐 카드가 사라지고 되돌리기로 복구된다', async () => {
    await createSession({ title: '삭제 대상 세션' });
    const nav = makeNav();
    render(<SessionsScreen nav={nav} />, { wrapper });
    await waitFor(() => expect(screen.getByText('삭제 대상 세션')).toBeInTheDocument());

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '삭제 대상 세션 더보기' }));
    await user.click(screen.getByRole('menuitem', { name: '삭제' }));

    const dialog = await screen.findByRole('dialog', { name: '세션 삭제' });
    expect(within(dialog).getByText(/삭제 대상 세션/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: '삭제' }));

    await waitFor(() => expect(screen.queryByText('삭제 대상 세션')).not.toBeInTheDocument());
    expect(await listSessions()).toHaveLength(0);

    const toast = await screen.findByRole('status');
    expect(toast).toHaveTextContent('삭제 대상 세션');
    await user.click(within(toast).getByRole('button', { name: '되돌리기' }));
    await waitFor(() => expect(screen.getByText('삭제 대상 세션')).toBeInTheDocument());
    expect(await listSessions()).toHaveLength(1);
  });

  it('확인 모달에서 [취소]를 누르면 안 지워진다', async () => {
    await createSession({ title: '취소할 세션' });
    const nav = makeNav();
    render(<SessionsScreen nav={nav} />, { wrapper });
    await waitFor(() => expect(screen.getByText('취소할 세션')).toBeInTheDocument());

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '취소할 세션 더보기' }));
    await user.click(screen.getByRole('menuitem', { name: '삭제' }));
    const dialog = await screen.findByRole('dialog', { name: '세션 삭제' });
    await user.click(within(dialog).getByRole('button', { name: '취소' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByText('취소할 세션')).toBeInTheDocument();
    expect(await listSessions()).toHaveLength(1);
  });
});

describe('세션 목록 튜토리얼(§0.5)', () => {
  it('처음 여는 화면에서 자동으로 뜬다 — [새 세션] 은 AppShell 헤더 몫이라 이 컴포넌트 단위 테스트엔 없다', async () => {
    // 이 파일의 공용 beforeEach 가 seen=true 로 채워 둔 것을 되돌려 "처음 방문" 을 재현한다.
    localStorage.setItem(PREFS_KEY, JSON.stringify(makeDefaultPrefs()));
    await createSession({ title: '튜토리얼용 세션' });
    const nav = makeNav();
    render(<SessionsScreen nav={nav} />, { wrapper });
    const dialog = await screen.findByRole('dialog', { name: '화면 안내' });
    expect(dialog).toBeInTheDocument();
    // 헤더가 없는 하네스라 `header-primary` 는 빠지고 카드에 딸린 둘이 남는다.
    expect(screen.getByText('1/2 단계')).toBeInTheDocument();
    expect(screen.getByText('세션 카드')).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '다음' }));
    await waitFor(() => expect(screen.getByText('2/2 단계')).toBeInTheDocument());
    expect(screen.getByText('카드 ⋮ 메뉴')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '완료' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '화면 안내' })).toBeNull());
  });
});


// PLAN-SHARE-LINK §6 S4(2026-09-08) — 세션 케밥의 [링크로 공유].
//
// 지우면 새는 것: 세션 봉투는 세션 **혼자 오지 않는다**(S1 — 드릴 본문을 데리고 간다). 목록이
// 들고 있는 ResolvedSession 은 제목·시간 캐시뿐이라, 화면이 저장소를 읽어 본문을 채우는 이 한
// 걸음을 빠뜨리면 링크는 만들어지되 **드릴 0개짜리 세션**이 건너간다 — 받는 쪽 화면에는 편성이
// 통째로 '삭제됨' 으로 뜨고, 보낸 사람은 그것을 볼 길이 없다.
describe('SessionsScreen — 링크로 공유(S4)', () => {
  it('케밥 [링크로 공유]가 세션과 편성된 드릴 본문을 함께 넘긴다', async () => {
    const d1 = createDrill({ courtMode: 'full', title: '슛 연습' });
    const d2 = createDrill({ courtMode: 'full', title: '패스 연습' });
    for (const d of [d1, d2] as Drill[]) await idbDrillRepo.putDrill(d, { touch: false });
    const base = await createSession({ title: '공유할 세션' });
    const withItems = [d1, d2].reduce(
      (acc, d) => addSessionItem(acc, { id: `it_${d.title}` as never, drillId: d.id, titleCache: d.title, durationMinCache: d.durationMin, categoryCache: d.drillType }),
      base,
    );
    const saved = await putSession(withItems);

    render(<SessionsScreen nav={makeNav()} />, { wrapper });
    await waitFor(() => expect(screen.getByText('공유할 세션')).toBeInTheDocument());

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '공유할 세션 더보기' }));
    await user.click(screen.getByRole('menuitem', { name: '링크로 공유' }));

    await waitFor(() => expect(createShareLinkSpy).toHaveBeenCalledTimes(1));
    const [doc, origin] = createShareLinkSpy.mock.calls[0] as [{ kind: string; session: { id: string }; drills: Drill[] }, string];
    expect(doc.kind).toBe('session');
    expect(doc.session.id).toBe(saved.id);
    // 편성 순서 그대로의 **본문**이다(id 만이 아니라 문서 자체) — 제목까지 재는 이유는, 요약을
    // 넘기면 여기서는 id 가 맞아도 받는 쪽 봉투에 스텝이 하나도 안 실리기 때문이다.
    expect(doc.drills.map((d) => d.id)).toEqual([d1.id, d2.id]);
    expect(doc.drills.map((d) => d.title)).toEqual(['슛 연습', '패스 연습']);
    // 링크는 **이 앱이 서 있는 출처**로 만든다(결정 3 도메인 독립).
    expect(origin).toBe(window.location.origin);

    // 만들어진 링크가 사람 앞에 뜬다 — 모달까지 안 뜨면 사용자는 아무것도 복사할 수 없다.
    expect(await screen.findByRole('textbox', { name: '공유 링크' })).toBeInTheDocument();
  });
});
