// [팀] 화면의 **경로 하나**를 끝까지 돈다: 빈 상태 → [새 팀] → 상세 → 선수 추가 → 회색 PF 칩 →
// 팀 삭제 확인 → [되돌리기]. 화면을 나눠 잰 것이 아니라 한 줄로 이은 이유는, 이 화면의 실기
// 버그가 대부분 **이음매**에서 나기 때문이다(만들었는데 상세가 안 열린다 / 저장은 됐는데 목록이
// 옛 값이다 / undo 가 톰스톤을 안 걷어 다음 동기화가 다시 지운다).
//
// 이 파일을 지우면 새는 것:
//  ① [새 팀]이 저장소에 팀을 **안 만들거나**, 만들고도 상세로 안 데려간다 — 이름부터 고치는
//     흐름이 통째로 끊긴다(새 세션이 같은 계약을 갖는다).
//  ② 상세에서 더한 선수가 **IDB 에 안 남는다**. 낙관적 반영만 하고 putTeam 을 빠뜨리면 화면은
//     초록인데 새로고침에서 사라진다 — 이 앱에서 가장 조용한 종류의 사고다.
//  ③ 팀 삭제가 **명단이 함께 지워진다는 사실을 안 알린다**(결정 15), 또는 [되돌리기] 가 팀을
//     못 되살린다.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { TeamScreen } from './TeamScreen.tsx';
import { TEAM_TUTORIAL_STEPS } from './tutorialSteps.ts';
import type { HomeNav } from '../home/nav.ts';
import type { TeamId } from '../../core/ids.ts';
import { deleteTeam, getTeam, listTeams } from '../../storage/teamRepo.ts';
import { LibraryProvider } from '../../store/library/LibraryProvider.tsx';
import { SettingsProvider } from '../../store/settings/SettingsProvider.tsx';
import { ToastProvider, useToast } from '../../store/toast/ToastProvider.tsx';
import { ToastHost } from '../../ui/ToastHost.tsx';
import { makeDefaultPrefs, PREFS_KEY } from '../../storage/prefs.ts';

function ToastHostBridge() {
  const { toasts, dismiss } = useToast();
  return <ToastHost toasts={toasts} onDismiss={dismiss} />;
}

// undo 토스트를 실제로 누르려면 ToastHost 도 함께 서야 한다(SessionsScreen.test 와 같은 이유).
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

const navSpy = { openTeam: vi.fn() };

/** 라우터 대신 `teamId` 를 쥔다 — 실제 앱에서 그 값의 저장소는 URL 이고(routes.ts), 여기서는
 *  `openTeam` 이 그 URL 을 바꾸는 것과 같은 일을 한다. 이 껍데기가 없으면 [새 팀]을 눌러도
 *  상세가 안 열려 아래 절반을 못 잰다. */
function Harness() {
  const [teamId, setTeamId] = useState<TeamId | undefined>(undefined);
  const nav: HomeNav = {
    newDrill: vi.fn(),
    openDrill: vi.fn(),
    goLibrary: vi.fn(),
    openSession: vi.fn(),
    presentDrill: vi.fn(),
    presentSession: vi.fn(),
    openRuleTopic: vi.fn(),
    openLegal: vi.fn(),
    openTeam: (id) => {
      navSpy.openTeam(id);
      setTeamId(id);
    },
  };
  return <TeamScreen nav={nav} teamId={teamId} />;
}

beforeEach(async () => {
  for (const t of await listTeams()) await deleteTeam(t.id);
  // 팀 투어가 자동 시작하면 스포트라이트 다이얼로그가 표적을 가린다 — "이미 봤다" 로 시작한다.
  localStorage.setItem(PREFS_KEY, JSON.stringify({ ...makeDefaultPrefs(), tutorialsSeen: { team: true } }));
  navSpy.openTeam.mockReset();
});

describe('TeamScreen — 빈 상태에서 첫 팀까지', () => {
  it('[새 팀]이 저장소에 팀을 만들고 그대로 상세를 연다', async () => {
    render(<Harness />, { wrapper });
    await screen.findByText('아직 팀이 없습니다');
    for (const step of TEAM_TUTORIAL_STEPS.slice(0, 2)) {
      expect(document.querySelector(`[data-tut="${step.target}"]`), step.target).not.toBeNull();
    }

    await userEvent.setup().click(screen.getByRole('button', { name: '새 팀' }));

    // ① 저장소에 실제로 생겼다 — 화면만 바뀌고 팀이 없으면 상세가 «찾을 수 없습니다» 가 된다.
    await waitFor(async () => expect(await listTeams()).toHaveLength(1));
    const [team] = await listTeams();
    expect(navSpy.openTeam).toHaveBeenCalledWith(team!.id);
    // ② 상세가 실제로 떴다(목록의 빈 상태가 아니다).
    expect(await screen.findByRole('button', { name: '← 팀 목록으로' })).toBeInTheDocument();
    expect(screen.queryByText('아직 팀이 없습니다')).toBeNull();
    await screen.findByLabelText('새 선수 이름'); // 상세 본문(getTeam 뒤)이 실제로 섰다
    // 투어 앵커가 실제 DOM 에 붙는다 — `data-tut` 은 컴파일러가 못 잡고, 빠지면 투어가 그 단계를
    // **조용히 건너뛴다**(useTutorial 의 계약). ★ 재는 것은 `TEAM_TUTORIAL_STEPS` 자체다 —
    // 손으로 적은 목록은 단계가 바뀌면 조용히 어긋난다(2026-09-09 검수: 옛 목록은 투어 단계가
    // 아닌 둘을 재고 실제 단계 둘을 안 쟀다). 목록 쪽 앵커(team-list·team-new)는 클릭 전에
    // 이미 지났고, 여기서는 상세가 열린 뒤 서는 나머지를 본다.
    for (const step of TEAM_TUTORIAL_STEPS.slice(2)) {
      expect(document.querySelector(`[data-tut="${step.target}"]`), step.target).not.toBeNull();
    }
  });

  it('상세에서 더한 선수가 IDB 에 남고, 명단 머리에 회색 PF 칩이 선다', async () => {
    const user = userEvent.setup();
    render(<Harness />, { wrapper });
    await screen.findByText('아직 팀이 없습니다');
    await user.click(screen.getByRole('button', { name: '새 팀' }));
    // [← 팀 목록으로] 는 TeamScreen 이 즉시 그리지만 상세 본문은 getTeam 뒤에 온다 — 여기서
    // find 를 쓰지 않으면 아직 없는 입력칸을 잡으려다 실패한다.
    await user.type(await screen.findByLabelText('새 선수 이름'), '김선수');
    await user.selectOptions(screen.getByLabelText('새 선수 등급'), 'PF2');
    await user.click(screen.getByRole('button', { name: '선수 추가' }));

    // ① 저장까지 갔다 — 낙관적 반영만 하고 putTeam 을 빠뜨리면 여기서 잡힌다.
    await waitFor(async () => {
      const [team] = await listTeams();
      const saved = await getTeam(team!.id);
      expect(saved!.players.map((p) => [p.name, p.klass])).toEqual([['김선수', 'PF2']]);
    });
    // ② 칩은 «PF2 1» 이고, 0 인 칸(PF1·미분류)은 그리지 않는다.
    expect(await screen.findByText('PF2 1')).toBeInTheDocument();
    expect(screen.queryByText('PF1 0')).toBeNull();
    // ③ 개인정보 울타리(결정 6) — **그 선수 행 안**에 있어야 한다. 팀 메모 아래에도 같은 문장이
    //    있으므로 화면 전체에서 찾으면 선수 칸에서 빠져도 통과한다.
    const toggle = screen.getByRole('button', { name: '김선수 편집' });
    await user.click(toggle);
    const row = toggle.parentElement!;
    expect(within(row).getByLabelText('메모')).toBeInTheDocument();
    expect(within(row).getByText('의료·연락처 등 개인정보는 적지 마세요.')).toBeInTheDocument();
  });
});

describe('TeamScreen — 삭제 안전망 (결정 15)', () => {
  it('확인 모달이 함께 지워지는 선수·스태프 수를 말하고, [되돌리기] 가 팀을 되살린다', async () => {
    const user = userEvent.setup();
    render(<Harness />, { wrapper });
    await screen.findByText('아직 팀이 없습니다');
    await user.click(screen.getByRole('button', { name: '새 팀' }));
    await user.type(await screen.findByLabelText('새 선수 이름'), '김선수');
    await user.click(screen.getByRole('button', { name: '선수 추가' }));
    await waitFor(async () => expect((await listTeams())[0]!.players).toHaveLength(1));
    const [team] = await listTeams();

    await user.click(screen.getByRole('button', { name: '← 팀 목록으로' }));
    await user.click(await screen.findByRole('button', { name: `${team!.name} 추가 메뉴` }));
    await user.click(screen.getByRole('menuitem', { name: '삭제' }));

    // ① 숫자로 말한다 — "팀을 지운다" 만으로는 명단이 같이 간다는 사실이 안 읽힌다.
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('선수 1명과 스태프 0명이 함께 지워집니다');

    await user.click(within(dialog).getByRole('button', { name: '삭제' }));
    await waitFor(async () => expect(await listTeams()).toHaveLength(0));

    // ② [되돌리기] 는 톰스톤까지 걷는 restoreTeam 이어야 한다 — 명단도 함께 돌아온다.
    await user.click(await screen.findByRole('button', { name: '되돌리기' }));
    await waitFor(async () => {
      const back = await getTeam(team!.id);
      expect(back?.players.map((p) => p.name)).toEqual(['김선수']);
    });
  });
});

// 결정 18 «인쇄 대화상자 전에 [등급 정보 제외] 토글». 이 파일을 지우면 새는 것: 인쇄 경로가
// 토글을 **안 물어보거나**, 물어보고도 그 값을 종이까지 안 내려 팀시트가 언제나 등급을 찍는다
// (첫 배송에서 실제로 그랬다 — `printDoc.stripClass` 에 값을 넣는 호출자가 0곳이었다).
// 등급은 분류 심사 결과라, 앱이 «뺐다» 고 안내한 정보가 종이로 나가면 개인정보 사고다.
describe('TeamScreen — 인쇄의 [등급 정보 제외] (결정 18)', () => {
  /** 인쇄 트리는 `printWhenReady()` 직후 `setPrintDoc(null)` 로 곧바로 걷힌다 — 그래서 인쇄된
   *  내용은 **print() 가 불린 그 순간**에 붙잡아야 한다. 나중에 DOM 을 뒤지면 늘 비어 있다. */
  function capturePrint(): { text(): string } {
    let captured = '';
    window.print = vi.fn(() => {
      captured = document.querySelector('[data-print-root]')?.textContent ?? '';
    });
    return { text: () => captured };
  }

  async function makeTeamWithPf2(user: ReturnType<typeof userEvent.setup>) {
    render(<Harness />, { wrapper });
    await screen.findByText('아직 팀이 없습니다');
    await user.click(screen.getByRole('button', { name: '새 팀' }));
    await user.type(await screen.findByLabelText('새 선수 이름'), '김선수');
    await user.selectOptions(screen.getByLabelText('새 선수 등급'), 'PF2');
    await user.click(screen.getByRole('button', { name: '선수 추가' }));
    await waitFor(async () => expect((await listTeams())[0]!.players).toHaveLength(1));
  }

  it('체크를 켜고 인쇄하면 팀시트에 등급 열이 없고, 끄면 있다', async () => {
    const user = userEvent.setup();
    const printed = capturePrint();
    await makeTeamWithPf2(user);

    // ① 기본(꺼짐) — 등급 열이 찍힌다. 이 절반이 없으면 아래 «없다» 가 «인쇄 자체가 비었다»
    //    와 구별되지 않는다.
    await user.click(screen.getByRole('button', { name: '인쇄' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '인쇄' }));
    await waitFor(() => expect(printed.text()).toContain('김선수'));
    expect(printed.text()).toContain('등급');
    expect(printed.text()).toContain('PF2');

    // ② 체크를 켜면 등급 열·값이 통째로 빠진다.
    await user.click(screen.getByRole('button', { name: '인쇄' }));
    const sheet = screen.getByRole('dialog');
    await user.click(within(sheet).getByRole('checkbox'));
    await user.click(within(sheet).getByRole('button', { name: '인쇄' }));
    await waitFor(() => expect(printed.text()).toContain('김선수'));
    expect(printed.text()).not.toContain('등급');
    expect(printed.text()).not.toContain('PF2');
  });

  it('체크는 시트를 다시 열 때 기본값(꺼짐)으로 돌아온다 — 결정 13 의 기본값 계약', async () => {
    const user = userEvent.setup();
    capturePrint();
    await makeTeamWithPf2(user);

    await user.click(screen.getByRole('button', { name: '인쇄' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('checkbox'));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '취소' }));

    await user.click(screen.getByRole('button', { name: '내보내기' }));
    expect(within(screen.getByRole('dialog')).getByRole('checkbox')).not.toBeChecked();
  });
});

// 2026-09-09(검수) — 색 선택기는 드래그하는 동안 네이티브 `input` 을 매 프레임 흘린다. 이
// 케이스를 지우면 새는 것: 색 한 번 고르는 데 IDB 쓰기와 `postSyncEvent` 가 수십~수백 건 나가
// 드라이브 푸시 큐가 부풀고, 늦게 도착한 저장이 더 최신 값을 옛 색으로 되돌린다(색이 튄다).
describe('TeamDetail — 색은 blur 에 한 번만 저장한다', () => {
  it('드래그 중(입력 3회)에는 저장이 없고, 초점을 뗄 때 마지막 값 하나만 남는다', async () => {
    const user = userEvent.setup();
    render(<Harness />, { wrapper });
    await screen.findByText('아직 팀이 없습니다');
    await user.click(screen.getByRole('button', { name: '새 팀' }));
    await screen.findByLabelText('새 선수 이름');
    const [team] = await listTeams();
    const before = (await getTeam(team!.id))!;

    const input = screen.getByLabelText('1번 색') as HTMLInputElement;
    for (const v of ['#111111', '#222222', '#333333']) fireEvent.change(input, { target: { value: v } });
    // 화면은 즉시 따라간다(초안) — 그래야 색을 고르는 손이 멈추지 않는다.
    expect(input.value).toBe('#333333');
    // ★ 저장은 비동기다 — 한 틱 흘려보내야 «안 갔다» 가 «아직 안 왔다» 와 구별된다.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    // 저장은 아직 한 건도 없다. updatedAt 까지 보는 이유: 같은 색을 다시 써도 도장은 새로 찍힌다.
    const mid = (await getTeam(team!.id))!;
    expect(mid.palette[0]).toBe(before.palette[0]);
    expect(mid.updatedAt).toBe(before.updatedAt);

    fireEvent.blur(input);
    await waitFor(async () => expect((await getTeam(team!.id))!.palette[0]).toBe('#333333'));
  });
});

// 킷 배치(2026-09-09 기현 지시: *"팀 색은 홈, 어웨이, 중립 세트 정할 수 있고"* + *"색 선택을 가로로
// 늘어놓는 대신 세로 팝업으로"*). 여기서 재는 것은 라벨이 아니라 **저장본과 초점**이다 — 목록에서
// 골랐는데 IDB 의 `kits.away` 가 안 바뀌면 새로고침 한 번에 배치가 사라지고(이 화면에서 가장 조용한
// 종류의 사고다), Esc 가 초점을 안 돌려주면 키보드로는 목록을 닫는 순간 자리를 잃는다.
describe('TeamDetail — 킷 배치', () => {
  it('[사용]을 켜고 팝업에서 색을 고르면 저장본의 어웨이 킷이 그 번호를 가리킨다', async () => {
    const user = userEvent.setup();
    render(<Harness />, { wrapper });
    await screen.findByText('아직 팀이 없습니다');
    await user.click(screen.getByRole('button', { name: '새 팀' }));
    await screen.findByLabelText('새 선수 이름');
    const [team] = await listTeams();

    // 켜기 전에는 어웨이 킷 자체가 없다 — «안 만든 벌» 과 «홈과 같은 벌» 은 다른 상태다.
    expect((await getTeam(team!.id))!.kits.away).toBeUndefined();
    await user.click(screen.getByLabelText('어웨이 킷 사용'));
    await waitFor(async () => expect((await getTeam(team!.id))!.kits.away).toEqual({ field: 0, gk: 1 }));

    // 팔레트를 가로로 펼치지 않는다 — 슬롯마다 «현재 색» 버튼 하나가 서고 목록은 눌러야 열린다.
    const trigger = screen.getByLabelText('어웨이 필드 색: 1번 색');
    expect(screen.queryByRole('listbox')).toBeNull();
    await user.click(trigger);
    const list = screen.getByRole('listbox', { name: '어웨이 필드 색' });
    await user.click(within(list).getByRole('option', { name: '2번 색' }));
    await waitFor(async () => expect((await getTeam(team!.id))!.kits.away).toEqual({ field: 1, gk: 1 }));
    expect(screen.queryByRole('listbox')).toBeNull(); // 고르면 닫힌다
    // 홈은 건드리지 않았다 — 한 벌을 고치는 조작이 다른 벌을 따라 움직이면 배치가 뜻을 잃는다.
    expect((await getTeam(team!.id))!.kits.home).toEqual({ field: 0, gk: 1 });

    // Esc 는 고르지 않고 닫고, 초점을 **연 버튼으로** 돌려준다 — 안 돌려주면 키보드 사용자는
    // 목록을 닫는 순간 문서 처음으로 떨어진다.
    const reopened = screen.getByLabelText('어웨이 필드 색: 2번 색');
    await user.click(reopened);
    await screen.findByRole('listbox', { name: '어웨이 필드 색' });
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(document.activeElement).toBe(reopened);
    expect((await getTeam(team!.id))!.kits.away).toEqual({ field: 1, gk: 1 });
  });
});
