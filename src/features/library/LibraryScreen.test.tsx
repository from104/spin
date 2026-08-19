// §6.11 목록 화면(드릴 전용 — C5 에서 세션 탭이 SessionsScreen 으로 승격해 나갔다).
// 빈 상태(§작업지시)·카드 액션(복제·삭제·되돌리기)·필터를 확인한다. ToastProvider 를 함께
// 마운트해 실제 토스트 표시까지 검증한다. 세션 쪽은 sessions/SessionsScreen.test.tsx.
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
import { SUMMARY_BUILD } from '../../model/summary.ts';
import { deleteSession, listSessions } from '../../storage/sessionRepo.ts';
import { createDrill } from '../../model/defaults.ts';
import { exportLibraryFile } from '../../storage/transfer.ts';
import { SettingsProvider } from '../../store/settings/SettingsProvider.tsx';

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
  <SettingsProvider>
    <LibraryProvider>
      <ToastProvider>
        {children}
        <ToastHostBridge />
      </ToastProvider>
    </LibraryProvider>
  </SettingsProvider>
);

/** 본문 컨테이너. C5 — 탭이 사라져 tabpanel role 도 은퇴했다. 화면의 <main> 으로 좁힌다. */
const panel = () => screen.getByRole('main');

// fake-indexeddb 는 파일 하나가 끝날 때까지 살아 있어 앞 테스트가 만든 드릴·세션이 뒤 테스트로
// 샌다.
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

  it('경기 상황 필터·정렬 UI 가 동작한다 (C10 — 정렬은 저장소 구현의 UI 노출)', async () => {
    const a = await idbDrillRepo.createDrill({ courtMode: 'full', title: '나중 드릴' });
    await idbDrillRepo.putDrill({ ...a, situation: 'kick-in' });
    await idbDrillRepo.createDrill({ courtMode: 'full', title: '가나다 드릴' });
    const nav = makeNav();
    render(<LibraryScreen nav={nav} />, { wrapper });
    await waitFor(() => expect(within(panel()).getByText('나중 드릴')).toBeInTheDocument());

    const user = userEvent.setup();
    // 상황 필터 — 킥인만 남는다.
    await user.selectOptions(screen.getByLabelText('경기 상황 필터'), 'kick-in');
    await waitFor(() => expect(within(panel()).queryByText('가나다 드릴')).not.toBeInTheDocument());
    expect(within(panel()).getByText('나중 드릴')).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('경기 상황 필터'), '');

    // 정렬 — 이름순이면 '가나다' 가 먼저 온다(기본 최근 수정순에서는 '나중' 이 먼저였다).
    await waitFor(() => expect(within(panel()).getByText('가나다 드릴')).toBeInTheDocument());
    await user.selectOptions(screen.getByLabelText('정렬'), 'title');
    await waitFor(() => {
      const titles = within(panel())
        .getAllByText(/드릴$/)
        .map((el) => el.textContent);
      expect(titles.indexOf('가나다 드릴')).toBeLessThan(titles.indexOf('나중 드릴'));
    });
  });

  it('목록 보기로 바꾸면 썸네일 없는 행으로 그려지고, 행에서도 열기·시연이 산다 (C11)', async () => {
    const d = await idbDrillRepo.createDrill({ courtMode: 'full', title: '행 보기 드릴' });
    const nav = makeNav();
    render(<LibraryScreen nav={nav} />, { wrapper });
    await waitFor(() => expect(within(panel()).getByText('행 보기 드릴')).toBeInTheDocument());
    // 카드 보기 — 썸네일 svg 가 있다(대조군).
    expect(panel().querySelector('svg.drill-card-thumb')).not.toBeNull();

    const user = userEvent.setup();
    await user.click(screen.getByRole('radio', { name: '목록' }));
    await waitFor(() => expect(panel().querySelector('svg.drill-card-thumb')).toBeNull());
    // 행에서도 같은 행동 집합이다.
    await user.click(screen.getByRole('button', { name: '행 보기 드릴 시연 시작' }));
    expect(nav.presentDrill).toHaveBeenCalledWith(d.id);
    await user.click(screen.getByRole('button', { name: '행 보기 드릴 열기' }));
    expect(nav.openDrill).toHaveBeenCalledWith(d.id);
    // 케밥 메뉴(카드와 같은 컴포넌트)도 선다.
    await user.click(screen.getByRole('button', { name: '행 보기 드릴 더보기' }));
    expect(screen.getByRole('menuitem', { name: '복제' })).toBeInTheDocument();
  });

  it('유형 필터로 목록을 좁힌다 (v8 — 옛 카테고리 필터의 후계)', async () => {
    await idbDrillRepo.createDrill({ courtMode: 'full', title: '기술 드릴', drillType: 'technical' });
    await idbDrillRepo.createDrill({ courtMode: 'full', title: '전술 드릴', drillType: 'tactical' });
    const nav = makeNav();
    render(<LibraryScreen nav={nav} />, { wrapper });
    await waitFor(() => expect(within(panel()).getByText('기술 드릴')).toBeInTheDocument());
    expect(within(panel()).getByText('전술 드릴')).toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole('radio', { name: '전술' }));
    await waitFor(() => expect(within(panel()).queryByText('기술 드릴')).not.toBeInTheDocument());
    expect(within(panel()).getByText('전술 드릴')).toBeInTheDocument();
  });
});

describe('LibraryScreen — 난이도 그룹 정렬의 성능 계약 (로드맵 3.6)', () => {
  it('세 난이도가 다 있으면 헤더가 초급 → 중급 → 고급 — 저장 순서와도 수정 최신순과도 다르다', async () => {
    // 위의 기존 it 은 중급이 **빈** 그룹이라 중급의 자리가 안 박혀 있었다 — DRILL_LEVELS 가
    // ['초급','고급','중급'] 으로 어긋나도 초록불이었다. 생성을 중→고→초 순으로 해서 저장 순서
    // (중·고·초)와도 store 의 수정 최신순(초·고·중)과도 다른 표시 순서를 단언한다.
    await idbDrillRepo.createDrill({ courtMode: 'full', title: '중급 압박', level: '중급' });
    await idbDrillRepo.createDrill({ courtMode: 'full', title: '고급 슈팅', level: '고급' });
    await idbDrillRepo.createDrill({ courtMode: 'full', title: '초급 드리블', level: '초급' });
    const nav = makeNav();
    render(<LibraryScreen nav={nav} />, { wrapper });
    await waitFor(() => expect(within(panel()).getByText('중급 압박')).toBeInTheDocument());

    const headings = within(panel()).getAllByRole('heading', { level: 2 });
    expect(headings.map((h) => h.textContent)).toEqual(['초급', '중급', '고급']);
    expect(within(within(panel()).getByRole('region', { name: '중급 드릴' })).getByText('중급 압박')).toBeInTheDocument();
  });

  it('그룹은 요약 필드 비교만으로 만들어진다 — 본문 로드 0회 · rebuildAllSummaries 0회', async () => {
    // 3.6 완료 판정의 성능 계약을 스파이로 못박는다. "0회" 단언에는 대조군이 둘 붙는다 —
    // (a) 같은 객체의 listDrillSummaries 는 걸렸다(스파이가 안 붙어서 0회인 게 아니다)
    // (b) 삭제(되돌리기 원본 보관)는 getDrill 을 실제로 1회 연다(그 스파이도 산 스파이다).
    await idbDrillRepo.createDrill({ courtMode: 'full', title: '초급 드리블', level: '초급' });
    await idbDrillRepo.createDrill({ courtMode: 'full', title: '고급 슈팅', level: '고급' });
    const rebuild = vi.spyOn(idbDrillRepo, 'rebuildAllSummaries');
    const getDrill = vi.spyOn(idbDrillRepo, 'getDrill');
    const loadDrill = vi.spyOn(idbDrillRepo, 'loadDrill');
    const list = vi.spyOn(idbDrillRepo, 'listDrillSummaries');
    try {
      const nav = makeNav();
      render(<LibraryScreen nav={nav} />, { wrapper });
      await waitFor(() => expect(within(panel()).getByText('고급 슈팅')).toBeInTheDocument());
      expect(within(panel()).getByRole('region', { name: '초급 드릴' })).toBeInTheDocument(); // 그룹이 실제로 섰다

      expect(list.mock.calls.length).toBeGreaterThanOrEqual(1); // 대조군 (a)
      expect(rebuild).not.toHaveBeenCalled();
      expect(getDrill).not.toHaveBeenCalled();
      expect(loadDrill).not.toHaveBeenCalled();

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: '고급 슈팅 더보기' }));
      await user.click(screen.getByRole('menuitem', { name: '삭제' }));
      await waitFor(() => expect(getDrill).toHaveBeenCalledTimes(1)); // 대조군 (b)
      expect(rebuild).not.toHaveBeenCalled(); // 삭제 후 재조회에서도 전역 재구축은 없다

      // 계약의 나머지 반쪽 — 그룹핑은 요약 필드만으로 성립한다. build 는 2026-08-17 에 2 로
      // 올랐다(썸네일 도형·메모). 그때 요구대로 **상승과 재구축 경로를 같은 커밋에** 실었고,
      // 위 `rebuild` 단언은 그래도 유효하다: 재구축은 **stale 레코드를 봤을 때만** 부르고
      // 이 테스트의 드릴은 방금 저장한 것이라 build 가 이미 최신이다.
      // 같은 날 다시 3 으로, 이후 v8(유형·상황, 4)·i18n C4(검색키 세 언어, 5)로 계속 올랐다.
      // 재구축 호출자는 LibraryProvider 하나뿐이고 그 비교(`s.build < SUMMARY_BUILD`)는
      // 제네릭해서 이번 범프도 새 경로 없이 그대로 얹힌다 — 위 `rebuild` 단언의 근거가
      // 이번에도 무너지지 않는다.
      expect(SUMMARY_BUILD).toBe(5);
    } finally {
      vi.restoreAllMocks();
    }
  });

  it('난이도를 고쳐 저장하면 카드가 새 그룹으로 옮겨 간다 — putDrill 이 요약을 같은 트랜잭션에서 다시 쓴다', async () => {
    // 전역 재구축 없이도 그룹이 낡지 않는 이유가 바로 이 경로다. putDrill 이 본문만 쓰고 요약을
    // 안 다시 쓰면(낡은 요약) 카드는 초급 그룹에 남는다 — 그 회귀를 여기서 잡는다.
    const d = await idbDrillRepo.createDrill({ courtMode: 'full', title: '승급 드릴', level: '초급' });
    await idbDrillRepo.putDrill({ ...d, level: '고급' });
    const nav = makeNav();
    render(<LibraryScreen nav={nav} />, { wrapper });
    await waitFor(() => expect(within(panel()).getByText('승급 드릴')).toBeInTheDocument());

    expect(within(within(panel()).getByRole('region', { name: '고급 드릴' })).getByText('승급 드릴')).toBeInTheDocument();
    // 대조군 — 초급 그룹 자체가 사라졌다. 옛 요약이 살아남아 카드가 두 그룹에 걸치거나
    // 초급에 남으면 여기서 잡힌다.
    expect(within(panel()).queryByRole('region', { name: '초급 드릴' })).toBeNull();
  });
});

describe('LibraryScreen — 이동 통로는 HomeNav prop 하나뿐이다 (계획서 2.8)', () => {
  // C5 — 탭 전환 테스트 둘은 탭과 함께 은퇴했다(세션은 레일의 1급 화면).
  it('탭 UI 가 없다 — 세션은 레일에서 간다', async () => {
    const nav = makeNav();
    render(<LibraryScreen nav={nav} />, { wrapper });
    await waitFor(() => expect(panel()).toBeInTheDocument());
    expect(screen.queryByRole('tab')).toBeNull();
    expect(screen.queryByRole('tablist')).toBeNull();
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

// §6.1c / 로드맵 4.2 — 가져오기 보고. 산식 자체는 transfer.test.ts 가 검증하므로, 여기서는
// "그 세 숫자가 실제 토스트까지 도달하는가" 와 "보고를 위해 다이얼로그가 늘지 않는가"(컨트롤
// 예산 §3)만 붙잡는다.
describe('LibraryScreen — 가져오기 보고 토스트 (로드맵 4.2)', () => {
  it('깨진 3 + 성한 7 파일 → 토스트에 세 숫자가 전부 뜨고, 다이얼로그는 열리지 않는다', async () => {
    const good = Array.from({ length: 7 }, (_, i) => createDrill({ courtMode: 'full', title: `보고 성한 ${i}` }));
    const envelope = JSON.parse(await exportLibraryFile(good).text()) as { payload: unknown[] };
    envelope.payload.push(null, '깨진 문자열', { schemaVersion: 9999 });
    const file = new File([JSON.stringify(envelope)], 'SPIN_보고.spin.json', { type: 'application/json' });

    const nav = makeNav();
    render(<LibraryScreen nav={nav} />, { wrapper });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.setup().upload(input, file);

    // 세 숫자 "전부" — 0(건너뜀)도 숨기지 않는다. 부분 문자열이 아니라 전문이 계약이다.
    const toast = await screen.findByRole('status');
    expect(toast).toHaveTextContent('7개 가져옴 · 3개 실패 · 0개 건너뜀');
    // 컨트롤 예산(§3): 보고는 자동으로 사라지는 토스트뿐 — 충돌 없는 가져오기에 다이얼로그가
    // 새로 생기면 여기서 잡힌다.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    // 대조군: "실패 3" 이 성한 것까지 버린 결과가 아니다 — 성한 카드가 실제로 그려진다.
    await waitFor(() => expect(within(panel()).getByText('보고 성한 0')).toBeInTheDocument());
  });
});
