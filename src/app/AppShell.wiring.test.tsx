// §6.8 AppShell 배선 — 얇게. 화면 5개를 전부 vi.mock 으로 갈아끼우고 "무엇이 어디에 꽂혀
// 있는가" 만 본다: renderScreen 스위치 · 레일 활성 매핑 · NavEntry 직렬화 왕복 · 정적/Context
// 헤더 분기. 화면 안에서 벌어지는 일은 각 화면의 스모크 테스트 소관이다.
//
// ⚠️ 화면을 목으로 갈아끼우는 것은 취향이 아니라 요건이다. 진짜 화면 5개를 그대로 끌면
// EditorWorkspace → matter-js 와 storage/IDB 가 통째로 딸려 들어와 워커가 힙을 다 쓰고 죽는다
// (EditorScreen.test.tsx 상단 주석의 그 사고). "메모리 상한 안에서 돈다" 까지가 이 파일의
// 통과 조건이다.
//
// ⚠️ 목 컴포넌트는 팩토리 안에서 딱 한 번 정의해 참조를 고정한다 — 렌더마다 새 함수를 돌려주면
// React 가 매 렌더 언마운트/재마운트로 보고 useAppHeader 의 발행·정리가 끝없이 겹친다(같은
// 주석의 무한 루프 전례).
//
// 이 파일은 **개명 전(2.1 이전)** 의 배선을 못박는다. 화면 키는 현재값('home'/'library'/
// 'present'/'settings'), 레일 라벨도 현재 문구 그대로 리터럴로 적는다 — 2.1 이 배선을 건드리는
// 순간 여기가 먼저 빨간불이 되는 것이 목적이기 때문이다(상수를 참조하면 같이 따라 움직여
// 아무것도 못 잡는다).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { DrillId, SessionId } from '../core/ids.ts';
import type { HomeNav, LibraryTab } from '../features/home/nav.ts';

// vi.mock 팩토리는 import 보다 위로 끌어올려지므로 이 파일 상단의 const 를 볼 수 없다.
// vi.hoisted 로 같이 끌어올린 값만 목과 단언이 함께 쓸 수 있다.
const FIXTURE = vi.hoisted(() => ({ drillId: 'dr_wiring', sessionId: 'se_wiring' }));

// ── 화면 목 5개 ────────────────────────────────────────────────────────────
// 목록/설정 목도 일부러 useAppHeader 로 헤더를 선언한다(진짜 화면은 선언하지 않는다) —
// AppShell 의 정적 config 가 그 선언을 실제로 덮어쓰는지 보려는 것이다.
vi.mock('../features/library/LibraryScreen.tsx', async () => {
  const { useAppHeader } = await import('./AppHeader.tsx');
  function LibraryScreen({
    nav,
    initialTab,
    initialOpenSessionId,
  }: {
    nav: HomeNav;
    initialTab?: LibraryTab;
    initialOpenSessionId?: SessionId;
  }) {
    useAppHeader({ title: '목록이 선언한 헤더(무시돼야 한다)' });
    return (
      <div data-testid="screen-library" data-initial-tab={initialTab ?? ''} data-open-session={initialOpenSessionId ?? ''}>
        <button type="button" onClick={() => nav.openDrill(FIXTURE.drillId as DrillId)}>
          드릴 열기
        </button>
        <button type="button" onClick={() => nav.presentDrill(FIXTURE.drillId as DrillId)}>
          드릴 시연
        </button>
        <button type="button" onClick={() => nav.openSession(FIXTURE.sessionId as SessionId)}>
          세션 열기
        </button>
        <button type="button" onClick={() => nav.newDrill()}>
          빈 판으로
        </button>
      </div>
    );
  }
  return { LibraryScreen };
});

vi.mock('../features/board/BoardScreen.tsx', async () => {
  const { useAppHeader } = await import('./AppHeader.tsx');
  function BoardScreen() {
    useAppHeader({ title: '보드가 선언한 헤더' });
    return <div data-testid="screen-board" />;
  }
  return { BoardScreen };
});

vi.mock('../features/editor/EditorScreen.tsx', async () => {
  const { useAppHeader } = await import('./AppHeader.tsx');
  function EditorScreen() {
    useAppHeader({ title: '편집기가 선언한 헤더' });
    return <div data-testid="screen-editor" />;
  }
  return { EditorScreen };
});

vi.mock('../features/present/PresentScreen.tsx', async () => {
  const { useAppHeader } = await import('./AppHeader.tsx');
  function PresentScreen() {
    useAppHeader({ title: '시연이 선언한 헤더' });
    return <div data-testid="screen-present" />;
  }
  return { PresentScreen };
});

vi.mock('../features/settings/SettingsScreen.tsx', async () => {
  const { useAppHeader } = await import('./AppHeader.tsx');
  function SettingsScreen() {
    useAppHeader({ title: '설정이 선언한 헤더(무시돼야 한다)' });
    return <div data-testid="screen-settings" />;
  }
  return { SettingsScreen };
});

const { AppShell } = await import('./AppShell.tsx');
const { SettingsProvider } = await import('../store/settings/SettingsProvider.tsx');
const { LibraryProvider } = await import('../store/library/LibraryProvider.tsx');
const { ToastProvider } = await import('../store/toast/ToastProvider.tsx');

// ── 하네스 ────────────────────────────────────────────────────────────────
// AppShell 은 props 를 하나도 받지 않는다 — 바깥에서 필요한 건 App.tsx 와 같은 Provider 3개뿐
// (AppNavProvider·HeaderProvider·두 Target Context 는 AppShell 이 스스로 감싸므로 여기서
// 덧씌우면 안 된다).
function Harness() {
  return (
    <SettingsProvider>
      <LibraryProvider>
        <ToastProvider>
          <AppShell />
        </ToastProvider>
      </LibraryProvider>
    </SettingsProvider>
  );
}

/** 마운트하면 LibraryProvider 가 IDB 를 비동기로 읽는다(useStaticHeaderConfig 가 화면과 무관하게
 *  useLibrary() 를 부르므로 항상 딸려온다). 그 setState 가 act() 밖에서 떨어지면 경고가 나므로
 *  한 틱 흘려보낸 뒤에 단언한다. */
async function renderShell() {
  const utils = render(<Harness />);
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  return utils;
}

const SCREEN_TESTIDS = ['screen-board', 'screen-editor', 'screen-library', 'screen-present', 'screen-settings'] as const;

/** renderScreen 은 switch 라 한 번에 하나만 나와야 한다 — "A 가 떴다" 뿐 아니라 "나머지는 없다"
 *  까지 봐야 스위치가 정말 갈렸는지 알 수 있다. */
function expectOnlyScreen(testId: (typeof SCREEN_TESTIDS)[number]) {
  for (const id of SCREEN_TESTIDS) {
    if (id === testId) expect(screen.getByTestId(id)).toBeInTheDocument();
    else expect(screen.queryByTestId(id)).toBeNull();
  }
}

/** 헤더는 role 이 없다(AppHeader.tsx) — AppHeader.test.tsx 와 같은 방식으로 잡는다. */
function header(): HTMLElement {
  const el = document.querySelector('header');
  if (!el) throw new Error('AppHeader 가 렌더되지 않았다');
  return el;
}

const RAIL_LABELS = ['전술판', '목록', '시연', '설정'] as const;

/** 레일에서 정확히 하나만 aria-current="page" 인지. */
function expectRailActive(label: (typeof RAIL_LABELS)[number]) {
  for (const l of RAIL_LABELS) {
    const btn = screen.getByRole('button', { name: l });
    if (l === label) expect(btn).toHaveAttribute('aria-current', 'page');
    else expect(btn).not.toHaveAttribute('aria-current');
  }
}

beforeEach(() => {
  // useAppHistory 는 window.history.state 를 seed 로 쓴다 — 끊어두지 않으면 앞 테스트의
  // 화면·depth 가 그대로 새 테스트로 새어 들어온다(AppRail.test.tsx 와 같은 위생 규칙).
  window.history.replaceState(null, '');
  window.localStorage.clear();
});

describe('AppShell 배선 — renderScreen 스위치', () => {
  it('레일로 옮긴 화면 키마다 대응 화면 하나만 렌더한다', async () => {
    await renderShell();
    const user = userEvent.setup();

    expectOnlyScreen('screen-board'); // 초기값: screen='home' + stage={kind:'board'}

    await user.click(screen.getByRole('button', { name: '목록' }));
    expectOnlyScreen('screen-library');

    await user.click(screen.getByRole('button', { name: '시연' }));
    expectOnlyScreen('screen-present');

    await user.click(screen.getByRole('button', { name: '설정' }));
    expectOnlyScreen('screen-settings');

    await user.click(screen.getByRole('button', { name: '전술판' }));
    expectOnlyScreen('screen-board');
  });

  it("home 자리는 화면 키가 아니라 StageTarget 이 가른다 — board 면 BoardScreen, drill 이면 EditorScreen", async () => {
    await renderShell();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: '목록' }));
    // nav.openDrill = setStageTarget({kind:'drill'}) + go('home')
    await user.click(screen.getByRole('button', { name: '드릴 열기' }));
    expectOnlyScreen('screen-editor');
    expect(window.history.state).toMatchObject({ screen: 'home' });

    // 화면 키는 계속 'home' 이므로 다른 화면을 들렀다 와도 stage 는 drill 그대로다.
    await user.click(screen.getByRole('button', { name: '설정' }));
    await user.click(screen.getByRole('button', { name: '전술판' }));
    expectOnlyScreen('screen-editor');

    // nav.newDrill = setStageTarget({kind:'board'}) + go('home') — 같은 자리를 판으로 되돌린다.
    await user.click(screen.getByRole('button', { name: '목록' }));
    await user.click(screen.getByRole('button', { name: '빈 판으로' }));
    expectOnlyScreen('screen-board');
  });

  it('libraryIntent 를 LibraryScreen 의 initialTab/initialOpenSessionId prop 으로 실어 보낸다', async () => {
    await renderShell();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: '목록' }));
    expect(screen.getByTestId('screen-library')).toHaveAttribute('data-initial-tab', '');

    // nav.openSession = setLibraryIntent({tab:'sessions', openSessionId}) + go('library')
    await user.click(screen.getByRole('button', { name: '세션 열기' }));
    const lib = screen.getByTestId('screen-library');
    expect(lib).toHaveAttribute('data-initial-tab', 'sessions');
    expect(lib).toHaveAttribute('data-open-session', FIXTURE.sessionId);
  });
});

describe('AppShell 배선 — 레일 활성 매핑', () => {
  it('화면 키마다 대응 레일 항목 하나에만 aria-current="page" 가 붙는다', async () => {
    await renderShell();
    const user = userEvent.setup();

    expectRailActive('전술판'); // home
    await user.click(screen.getByRole('button', { name: '목록' }));
    expectRailActive('목록'); // library
    await user.click(screen.getByRole('button', { name: '시연' }));
    expectRailActive('시연'); // present
    await user.click(screen.getByRole('button', { name: '설정' }));
    expectRailActive('설정'); // settings
  });

  it('드릴 편집 중에도 활성은 전술판이다 — 편집이 home 자리를 함께 쓰기 때문', async () => {
    await renderShell();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: '목록' }));
    await user.click(screen.getByRole('button', { name: '드릴 열기' }));
    expectOnlyScreen('screen-editor');
    expectRailActive('전술판');
  });

  it('레일에 드릴 시연으로 들어와도 활성은 시연이다', async () => {
    await renderShell();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: '목록' }));
    // nav.presentDrill = setPresentTarget({kind:'drill'}) + go('present')
    await user.click(screen.getByRole('button', { name: '드릴 시연' }));
    expectOnlyScreen('screen-present');
    expectRailActive('시연');
  });
});

describe('AppShell 배선 — NavEntry 직렬화 왕복', () => {
  it('빈 history 로 들어오면 depth 0 을 심는다(replaceState — 엔트리를 쌓지 않는다)', async () => {
    await renderShell();
    expect(window.history.state).toEqual({ screen: 'home', depth: 0 });
  });

  it('go 가 실은 {screen, depth} 로 재마운트(새로고침)해도 같은 화면·depth 로 복원된다', async () => {
    const { unmount } = await renderShell();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: '설정' }));
    expect(window.history.state).toEqual({ screen: 'settings', depth: 1 });

    // 새로고침 시뮬레이션 — 트리를 버리고 history.state 만 남긴 채 다시 마운트한다.
    unmount();
    await renderShell();
    expectOnlyScreen('screen-settings');
    expect(within(header()).getByText('설정')).toBeInTheDocument();

    // depth 도 살아 돌아왔다 — 0 으로 리셋됐다면 다음 go 가 1 이 됐을 것이다.
    await user.click(screen.getByRole('button', { name: '목록' }));
    expect(window.history.state).toEqual({ screen: 'library', depth: 2 });
  });

  it('popstate 로 돌아온 state 가 NavEntry 면 그대로 쓰고, 아니면 초기 화면으로 떨어진다', async () => {
    await renderShell();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '설정' }));
    expectOnlyScreen('screen-settings');

    // 브라우저 뒤로가기가 돌려주는 것과 같은 모양의 엔트리.
    await act(async () => {
      window.dispatchEvent(new PopStateEvent('popstate', { state: { screen: 'library', depth: 0 } }));
    });
    expectOnlyScreen('screen-library');

    // 남의 state(다른 앱·확장이 심은 것)는 NavEntry 가 아니다 → initial 'home' 으로.
    // 두 판정(화면 키 화이트리스트 · depth 가 숫자)을 따로 찔러야 한다 — 한쪽만 틀린 값으로
    // 찌르면 다른 쪽 판정이 대신 걸러줘서, 정작 그 판정을 지워도 초록불이 유지된다(실측).
    await user.click(screen.getByRole('button', { name: '목록' }));
    await act(async () => {
      window.dispatchEvent(new PopStateEvent('popstate', { state: { screen: 'nowhere', depth: 2 } }));
    });
    expectOnlyScreen('screen-board');

    await user.click(screen.getByRole('button', { name: '목록' }));
    await act(async () => {
      window.dispatchEvent(new PopStateEvent('popstate', { state: { screen: 'settings', depth: '2' } }));
    });
    expectOnlyScreen('screen-board');
  });
});

describe('AppShell 배선 — 정적 헤더 대 Context 헤더', () => {
  it('정적 config 를 계산하는 화면(library·settings)에서는 화면의 useAppHeader 선언이 무시된다', async () => {
    await renderShell();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: '목록' }));
    expect(within(header()).getByText('드릴 라이브러리')).toBeInTheDocument();
    expect(within(header()).getByText('저장된 드릴을 열어 편집하거나 시연하세요')).toBeInTheDocument();
    expect(within(header()).queryByText('목록이 선언한 헤더(무시돼야 한다)')).toBeNull();
    // 정적 config 에만 있는 것들 — 검색창과 주 액션이 실제로 꽂혔는지.
    expect(within(header()).getByRole('searchbox', { name: '드릴 검색' })).toBeInTheDocument();
    expect(within(header()).getByRole('button', { name: '새 드릴' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '설정' }));
    expect(within(header()).getByText('설정')).toBeInTheDocument();
    expect(within(header()).queryByText('설정이 선언한 헤더(무시돼야 한다)')).toBeNull();
  });

  it('정적 config 가 undefined 인 화면(home·present)에서는 화면의 선언이 그대로 헤더가 된다', async () => {
    // ★ home 이 정적 config 를 돌려주면 config prop 이 Context 를 덮어써 헤더가 통째로 사라진다
    // (AppShell.tsx 의 그 사고 주석). AppHeader 단독 테스트로는 못 잡혔던 자리라 여기서 못박는다.
    await renderShell();
    const user = userEvent.setup();
    expect(within(header()).getByText('보드가 선언한 헤더')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '시연' }));
    expect(within(header()).getByText('시연이 선언한 헤더')).toBeInTheDocument();

    // 같은 home 자리라도 stage 가 바뀌면 헤더 주인도 바뀐다.
    await user.click(screen.getByRole('button', { name: '목록' }));
    await user.click(screen.getByRole('button', { name: '드릴 열기' }));
    expect(within(header()).getByText('편집기가 선언한 헤더')).toBeInTheDocument();
    expect(within(header()).queryByText('보드가 선언한 헤더')).toBeNull();
  });
});
