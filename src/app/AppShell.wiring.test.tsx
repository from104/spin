// §6.8 AppShell 배선 — 얇게. 화면 컴포넌트를 전부 vi.mock 으로 갈아끼우고 "무엇이 어디에 꽂혀
// 있는가" 만 본다: renderScreen 스위치 · 레일 활성 매핑(SCREEN_TO_RAIL) · NavEntry 직렬화 왕복 ·
// 정적/Context 헤더 분기. 화면 안에서 벌어지는 일은 각 화면의 스모크 테스트 소관이다.
//
// ⚠️ 화면을 목으로 갈아끼우는 것은 취향이 아니라 요건이다. 진짜 화면들을 그대로 끌면
// EditorWorkspace → matter-js 와 storage/IDB 가 통째로 딸려 들어와 워커가 힙을 다 쓰고 죽는다
// (EditorScreen.test.tsx 상단 주석의 그 사고). "메모리 상한 안에서 돈다" 까지가 이 파일의
// 통과 조건이다.
//
// ⚠️ 목 컴포넌트는 팩토리 안에서 딱 한 번 정의해 참조를 고정한다 — 렌더마다 새 함수를 돌려주면
// React 가 매 렌더 언마운트/재마운트로 보고 useAppHeader 의 발행·정리가 끝없이 겹친다(같은
// 주석의 무한 루프 전례).
//
// ⚠️ 시연만은 `PresentScreen.tsx` 가 아니라 그 **안쪽** `PresentRunner.tsx` 를 목으로 바꾼다.
// PresentScreen 은 `usePresentTarget()` 배선만 하는 얇은 래퍼라, 그걸 목으로 덮으면 정작 이
// 파일이 보려는 배선(대상이 화면까지 실제로 닿는가)이 사라진다. 그리고 목 팩토리 안에서
// `./AppShell.tsx` 를 되import 하는 순환도 이렇게 피한다.
//
// 이 파일은 **2.1 재편 후**의 배선을 못박는다. 화면 키('board'/'drills'/'present'/'settings')와
// 레일 라벨을 상수 참조가 아니라 리터럴로 적는다 — 상수를 읽어 쓰면 키를 잘못 바꿔도 테스트가
// 함께 따라 움직여 아무것도 못 잡는다.
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { DrillId, SessionId } from '../core/ids.ts';
import type { HomeNav, LibraryTab } from '../features/home/nav.ts';

// vi.mock 팩토리는 import 보다 위로 끌어올려지므로 이 파일 상단의 const 를 볼 수 없다.
// vi.hoisted 로 같이 끌어올린 값만 목과 단언이 함께 쓸 수 있다.
const FIXTURE = vi.hoisted(() => ({ drillId: 'dr_wiring', sessionId: 'se_wiring' }));

/** 화면이 **몇 번 마운트됐는지**, 그리고 시연이 **어떤 대상으로 그려졌는지의 순서**.
 *  "결국 옳은 화면이 떴다" 로는 안 보이는 것을 본다 — 자유판을 한 프레임 띄웠다 버리면
 *  진짜 앱에서는 EditorProvider·loadBoard 가 통째로 세워졌다 버려지고, 시연은 그 프레임에
 *  "시연할 드릴을 목록에서 선택하세요" 빈 상태를 실제로 그린다. 시연 쪽은 컴포넌트가
 *  재마운트되지 않고 prop 만 바뀌므로 **횟수로는 안 잡힌다** — 커밋된 값을 순서대로 남긴다. */
const MOUNTS = vi.hoisted(() => ({ board: 0, editor: 0 }));
const PRESENT_FRAMES = vi.hoisted(() => ({ kinds: [] as string[] }));

// ── 화면 목 5개 ────────────────────────────────────────────────────────────
// 목록/설정 목도 일부러 useAppHeader 로 헤더를 선언한다(진짜 화면은 선언하지 않는다) —
// AppShell 의 정적 config 가 그 선언을 실제로 덮어쓰는지 보려는 것이다.
vi.mock('../features/library/LibraryScreen.tsx', async () => {
  const { useAppHeader } = await import('./AppHeader.tsx');
  // 라이브 리전 발표문의 제목은 이 목록 데이터에서 나온다(AppShell.titleOf) — 아직 안 읽힌
  // 동안 눌러 버리면 제목 없는 문장이 나가므로, 로드 완료를 셀 수 있게 개수를 노출한다.
  const { useLibraryState } = await import('../store/library/LibraryProvider.tsx');
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
    const { drills } = useLibraryState();
    return (
      <div
        data-testid="screen-library"
        data-initial-tab={initialTab ?? ''}
        data-open-session={initialOpenSessionId ?? ''}
        data-drill-count={drills.length}
      >
        <button type="button" onClick={() => nav.openDrill(FIXTURE.drillId as DrillId)}>
          드릴 열기
        </button>
        <button type="button" onClick={() => nav.presentDrill(FIXTURE.drillId as DrillId)}>
          드릴 시연
        </button>
        <button type="button" onClick={() => nav.presentSession(FIXTURE.sessionId as SessionId)}>
          세션 시연
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
  const { useEffect } = await import('react');
  function BoardScreen() {
    useAppHeader({ title: '보드가 선언한 헤더' });
    useEffect(() => {
      MOUNTS.board += 1;
    }, []);
    return <div data-testid="screen-board" />;
  }
  return { BoardScreen };
});

vi.mock('../features/editor/EditorScreen.tsx', async () => {
  const { useAppHeader } = await import('./AppHeader.tsx');
  const { useEffect } = await import('react');
  function EditorScreen() {
    useAppHeader({ title: '편집기가 선언한 헤더' });
    useEffect(() => {
      MOUNTS.editor += 1;
    }, []);
    return <div data-testid="screen-editor" />;
  }
  return { EditorScreen };
});

vi.mock('../features/present/PresentRunner.tsx', async () => {
  const { useAppHeader } = await import('./AppHeader.tsx');
  const { useEffect } = await import('react');
  // target 은 진짜 PresentScreen 이 usePresentTarget() 로 읽어 내려준 값이다 — 이 프로퍼티가
  // 곧 "시연 대상이 화면까지 닿았는가" 의 관측점이다.
  function PresentRunner({ target }: { target: { kind: string; drillId?: string; sessionId?: string } | null }) {
    useAppHeader({ title: '시연이 선언한 헤더' });
    // 의존성 배열이 없다 = 커밋될 때마다. 마운트 횟수가 아니라 **그려진 프레임의 순서**다.
    useEffect(() => {
      PRESENT_FRAMES.kinds.push(target?.kind ?? '');
    });
    return (
      <div
        data-testid="screen-present"
        data-present-kind={target?.kind ?? ''}
        data-present-id={target?.drillId ?? target?.sessionId ?? ''}
      />
    );
  }
  return { PresentRunner };
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

// 2.1 재편: 레일은 3단이다. '시연' 은 화면 키로 살아 있지만 레일에는 없다.
const RAIL_LABELS = ['보드', '드릴', '설정'] as const;

/** 레일에서 정확히 하나만 aria-current="page" 인지. */
function expectRailActive(label: (typeof RAIL_LABELS)[number]) {
  for (const l of RAIL_LABELS) {
    const btn = screen.getByRole('button', { name: l });
    if (l === label) expect(btn).toHaveAttribute('aria-current', 'page');
    else expect(btn).not.toHaveAttribute('aria-current');
  }
}

const DRILL_TITLE = '측면 돌파 2대1';

// 라이브 리전 발표문이 제목을 실제로 찾아 오는지 보려면 저장소에 그 제목의 드릴이 하나
// 있어야 한다. matter-js 를 끌지 않는 순수 모델 + IDB 한 건이라 이 파일의 메모리 상한을
// 건드리지 않는다(파일 머리말 참고).
beforeAll(async () => {
  const { idbDrillRepo } = await import('../storage/drillRepo.ts');
  const { createDrill } = await import('../model/defaults.ts');
  const d = createDrill({ courtMode: 'full', formation: '1-2-1', title: DRILL_TITLE, empty: true });
  await idbDrillRepo.putDrill({ ...d, id: FIXTURE.drillId as DrillId }, { touch: false });
});

beforeEach(() => {
  // useAppHistory 는 window.history.state 를 seed 로 쓴다 — 끊어두지 않으면 앞 테스트의
  // 화면·depth 가 그대로 새 테스트로 새어 들어온다(AppRail.test.tsx 와 같은 위생 규칙).
  window.history.replaceState(null, '');
  window.localStorage.clear();
  MOUNTS.board = 0;
  MOUNTS.editor = 0;
  PRESENT_FRAMES.kinds.length = 0;
});

describe('AppShell 배선 — renderScreen 스위치', () => {
  it('화면 키마다 대응 화면 하나만 렌더한다', async () => {
    await renderShell();
    const user = userEvent.setup();

    expectOnlyScreen('screen-board'); // 초기값: screen='board' + stage={kind:'board'}

    await user.click(screen.getByRole('button', { name: '드릴' }));
    expectOnlyScreen('screen-library');

    // 'present' 는 레일에 없다 — 목록의 [시연]으로만 들어간다(계획서 2.1).
    await user.click(screen.getByRole('button', { name: '드릴 시연' }));
    expectOnlyScreen('screen-present');

    await user.click(screen.getByRole('button', { name: '설정' }));
    expectOnlyScreen('screen-settings');

    await user.click(screen.getByRole('button', { name: '보드' }));
    expectOnlyScreen('screen-board');
  });

  it('board 자리는 화면 키가 아니라 StageTarget 이 가른다 — board 면 BoardScreen, drill 이면 EditorScreen', async () => {
    await renderShell();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: '드릴' }));
    // nav.openDrill = setStageTarget({kind:'drill'}) + go('board', {kind:'drill'})
    await user.click(screen.getByRole('button', { name: '드릴 열기' }));
    expectOnlyScreen('screen-editor');
    expect(window.history.state).toMatchObject({ screen: 'board' });

    // 화면 키는 계속 'board' 이므로 다른 화면을 들렀다 와도 stage 는 drill 그대로다.
    await user.click(screen.getByRole('button', { name: '설정' }));
    await user.click(screen.getByRole('button', { name: '보드' }));
    expectOnlyScreen('screen-editor');

    // nav.newDrill = setStageTarget({kind:'board'}) + go('board', {kind:'board'}) — 같은 자리를 판으로 되돌린다.
    await user.click(screen.getByRole('button', { name: '드릴' }));
    await user.click(screen.getByRole('button', { name: '빈 판으로' }));
    expectOnlyScreen('screen-board');
  });

  it('libraryIntent 를 LibraryScreen 의 initialTab/initialOpenSessionId prop 으로 실어 보낸다', async () => {
    await renderShell();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: '드릴' }));
    expect(screen.getByTestId('screen-library')).toHaveAttribute('data-initial-tab', '');

    // nav.openSession = setLibraryIntent({tab:'sessions', openSessionId}) + go('drills', {kind:'session'})
    await user.click(screen.getByRole('button', { name: '세션 열기' }));
    const lib = screen.getByTestId('screen-library');
    expect(lib).toHaveAttribute('data-initial-tab', 'sessions');
    expect(lib).toHaveAttribute('data-open-session', FIXTURE.sessionId);
  });
});

describe('AppShell 배선 — 레일 활성 매핑(SCREEN_TO_RAIL)', () => {
  it('화면 키마다 대응 레일 항목 하나에만 aria-current="page" 가 붙는다', async () => {
    await renderShell();
    const user = userEvent.setup();

    expectRailActive('보드'); // board
    await user.click(screen.getByRole('button', { name: '드릴' }));
    expectRailActive('드릴'); // drills
    await user.click(screen.getByRole('button', { name: '설정' }));
    expectRailActive('설정'); // settings
  });

  it('드릴 편집 중에도 활성은 [보드] 다 — 편집이 board 자리를 함께 쓰기 때문', async () => {
    await renderShell();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: '드릴' }));
    await user.click(screen.getByRole('button', { name: '드릴 열기' }));
    expectOnlyScreen('screen-editor');
    expectRailActive('보드');
  });

  it('시연 중 활성은 [드릴] 이다 — 레일에서 빠진 화면이 남의 자리를 빌린다', async () => {
    await renderShell();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: '드릴' }));
    // nav.presentDrill = setPresentTarget({kind:'drill'}) + go('present', {kind:'drill'})
    await user.click(screen.getByRole('button', { name: '드릴 시연' }));
    expectOnlyScreen('screen-present');
    expectRailActive('드릴');
  });

  it('레일에는 [시연] 항목이 없다', async () => {
    await renderShell();
    expect(screen.queryByRole('button', { name: '시연' })).toBeNull();
    // 대조군 — 3단은 실제로 서 있다(전부 사라져서 통과하는 것이 아니다).
    for (const l of RAIL_LABELS) expect(screen.getByRole('button', { name: l })).toBeInTheDocument();
  });
});

describe('AppShell 배선 — NavEntry 직렬화 왕복', () => {
  it('빈 history 로 들어오면 depth 0 을 심는다(replaceState — 엔트리를 쌓지 않는다)', async () => {
    await renderShell();
    expect(window.history.state).toEqual({ screen: 'board', depth: 0 });
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
    await user.click(screen.getByRole('button', { name: '드릴' }));
    expect(window.history.state).toEqual({ screen: 'drills', depth: 2 });
  });

  it('시연 중 리로드해도 빈 화면이 아니라 그 대상이 복원된다 (계획서 2.3)', async () => {
    const { unmount } = await renderShell();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: '드릴' }));
    await user.click(screen.getByRole('button', { name: '드릴 시연' }));
    expect(screen.getByTestId('screen-present')).toHaveAttribute('data-present-id', FIXTURE.drillId);
    expect(window.history.state).toMatchObject({ screen: 'present', target: { kind: 'drill', id: FIXTURE.drillId } });

    // 체육관 태블릿이 시연 도중 리로드된 상황. 개명 전에는 화면만 'present' 로 돌아오고
    // presentTarget 은 null 이라 *"시연할 드릴을 목록에서 선택하세요"* 만 떴다.
    unmount();
    await renderShell();
    expectOnlyScreen('screen-present');
    expect(screen.getByTestId('screen-present')).toHaveAttribute('data-present-kind', 'drill');
    expect(screen.getByTestId('screen-present')).toHaveAttribute('data-present-id', FIXTURE.drillId);
    expectRailActive('드릴');
  });

  it('세션 시연도 같은 통로로 복원된다', async () => {
    const { unmount } = await renderShell();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: '드릴' }));
    await user.click(screen.getByRole('button', { name: '세션 시연' }));
    expect(window.history.state).toMatchObject({ screen: 'present', target: { kind: 'session', id: FIXTURE.sessionId } });

    unmount();
    await renderShell();
    expect(screen.getByTestId('screen-present')).toHaveAttribute('data-present-kind', 'session');
    expect(screen.getByTestId('screen-present')).toHaveAttribute('data-present-id', FIXTURE.sessionId);
  });

  it('대상 없는 시연 엔트리는 그대로 빈 시연이다 — 복원이 아무 대상이나 만들어내지 않는다', async () => {
    // 위 두 테스트의 대조군. 대상이 실려 있을 때만 복원돼야 한다.
    window.history.replaceState({ screen: 'present', depth: 1 }, '');
    await renderShell();
    expectOnlyScreen('screen-present');
    expect(screen.getByTestId('screen-present')).toHaveAttribute('data-present-kind', '');
  });

  it('드릴 편집 중 리로드도 그 드릴로 돌아온다', async () => {
    const { unmount } = await renderShell();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: '드릴' }));
    await user.click(screen.getByRole('button', { name: '드릴 열기' }));
    expectOnlyScreen('screen-editor');

    unmount();
    await renderShell();
    // stage 가 복원되지 않으면 같은 'board' 화면인데 BoardScreen(자유판)이 뜬다.
    expectOnlyScreen('screen-editor');
  });

  it('리로드 복원은 자유판을 한 번도 거치지 않는다 — 마운트 뒤에 고치면 판을 헛 세운다', async () => {
    // 위 테스트는 "결국 편집기가 떴다" 까지만 본다. 대상을 **마운트 뒤 이펙트에서** 세우면
    // 그것도 통과하지만, 진짜 앱에서는 자유판이 한 프레임 서면서 EditorProvider 와
    // loadBoard() 스냅샷 복원이 통째로 돌았다 버려진다. 그래서 횟수로 못박는다.
    const { unmount } = await renderShell();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '드릴' }));
    await user.click(screen.getByRole('button', { name: '드릴 열기' }));

    unmount();
    MOUNTS.board = 0;
    MOUNTS.editor = 0;
    await renderShell();
    expect(MOUNTS.editor).toBe(1);
    expect(MOUNTS.board).toBe(0);
  });

  it('시연 리로드는 대상 없는 프레임을 한 번도 그리지 않는다', async () => {
    // 같은 이유인데 시연은 재마운트가 아니라 prop 갱신이라 횟수로는 안 보인다 —
    // 대상을 마운트 뒤 이펙트에서 세우면 **첫 프레임**이 빈 시연이 된다.
    const { unmount } = await renderShell();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '드릴' }));
    await user.click(screen.getByRole('button', { name: '드릴 시연' }));

    unmount();
    PRESENT_FRAMES.kinds.length = 0;
    await renderShell();
    expect(PRESENT_FRAMES.kinds.length).toBeGreaterThan(0); // 대조군 — 기록이 실제로 돌았다
    expect(PRESENT_FRAMES.kinds[0]).toBe('drill');
    expect(PRESENT_FRAMES.kinds).not.toContain('');
    expect(screen.getByTestId('screen-present')).toHaveAttribute('data-present-id', FIXTURE.drillId);
  });

  it('개명 전에 열어 둔 탭의 구 키 엔트리도 신 키로 접혀 복원된다 (계획서 2.3)', async () => {
    // 이 관용 경로가 없으면 기존 사용자의 history.state 가 전부 무효로 판정돼
    // 뒤로가기 이력이 초기화되고 초기 화면으로 떨어진다.
    window.history.replaceState({ screen: 'library', depth: 3 }, '');
    await renderShell();
    expectOnlyScreen('screen-library');
    expectRailActive('드릴');
    // 접은 결과를 되써서 옛 키가 그 탭에 계속 굴러다니지 않게 한다.
    expect(window.history.state).toEqual({ screen: 'drills', depth: 3 });
  });

  it('popstate 로 돌아온 state 가 NavEntry 면 그대로 쓰고, 아니면 초기 화면으로 떨어진다', async () => {
    await renderShell();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '설정' }));
    expectOnlyScreen('screen-settings');

    // 브라우저 뒤로가기가 돌려주는 것과 같은 모양의 엔트리.
    await act(async () => {
      window.dispatchEvent(new PopStateEvent('popstate', { state: { screen: 'drills', depth: 0 } }));
    });
    expectOnlyScreen('screen-library');

    // 남의 state(다른 앱·확장이 심은 것)는 NavEntry 가 아니다 → initial 'board' 로.
    // 두 판정(화면 키 화이트리스트 · depth 가 숫자)을 따로 찔러야 한다 — 한쪽만 틀린 값으로
    // 찌르면 다른 쪽 판정이 대신 걸러줘서, 정작 그 판정을 지워도 초록불이 유지된다(실측).
    await user.click(screen.getByRole('button', { name: '드릴' }));
    await act(async () => {
      window.dispatchEvent(new PopStateEvent('popstate', { state: { screen: 'nowhere', depth: 2 } }));
    });
    expectOnlyScreen('screen-board');

    await user.click(screen.getByRole('button', { name: '드릴' }));
    await act(async () => {
      window.dispatchEvent(new PopStateEvent('popstate', { state: { screen: 'settings', depth: '2' } }));
    });
    expectOnlyScreen('screen-board');
  });

  it('popstate 로 돌아온 엔트리의 대상까지 되돌린다 — 드릴 A → B 뒤 뒤로가기', async () => {
    await renderShell();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: '드릴' }));
    await user.click(screen.getByRole('button', { name: '드릴 시연' }));
    expect(screen.getByTestId('screen-present')).toHaveAttribute('data-present-id', FIXTURE.drillId);

    await act(async () => {
      window.dispatchEvent(new PopStateEvent('popstate', { state: { screen: 'present', depth: 2, target: { kind: 'drill', id: 'dr_other' } } }));
    });
    expect(screen.getByTestId('screen-present')).toHaveAttribute('data-present-id', 'dr_other');
  });
});

describe('AppShell 배선 — 라이브 리전 발표 (§7.6 / 계획서 2.4)', () => {
  /** liveRegion.say 는 중복 문구 재낭독을 위해 널 폭 공백을 토글한다(LiveRegion.tsx) — 지운다. */
  function announced(): string {
    return (document.querySelector('[aria-live="polite"]')?.textContent ?? '').replace(/​/g, '');
  }

  /** 발표문의 제목은 LibraryProvider 가 읽어 온 목록에서 나온다 — 로드 전에 눌러 버리면
   *  제목 없는 문장이 나가고, 발표는 한 번뿐이라 나중에 고쳐지지 않는다. */
  async function gotoLoadedLibrary(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: '드릴' }));
    await waitFor(() => expect(screen.getByTestId('screen-library')).toHaveAttribute('data-drill-count', '1'));
  }

  it('최초 마운트에서는 발표하지 않는다 — 브라우저가 이미 로드 시점을 다뤘다', async () => {
    await renderShell();
    expect(announced()).toBe('');
  });

  it('같은 board 화면이라도 자유판과 드릴 편집을 다르게 발표한다', async () => {
    // 개명 전 결함의 본체: 화면 키 하나로 문장을 만들어 둘 다 "전술판 화면" 이라고만 읽혔다.
    await renderShell();
    const user = userEvent.setup();
    await gotoLoadedLibrary(user);

    await user.click(screen.getByRole('button', { name: '드릴 열기' }));
    const editing = announced();
    await user.click(screen.getByRole('button', { name: '드릴' }));
    await user.click(screen.getByRole('button', { name: '빈 판으로' }));
    const free = announced();

    expect(free).toBe('자유 전술판');
    expect(editing).not.toBe(free);
    expect(editing).not.toContain('화면'); // 옛 "{화면명} 화면" 문장이 되살아나면 빨간불
  });

  it('드릴을 열면 그 드릴 제목이 발표문에 들어간다 (완료 판정)', async () => {
    await renderShell();
    const user = userEvent.setup();
    await gotoLoadedLibrary(user);
    await user.click(screen.getByRole('button', { name: '드릴 열기' }));
    expect(announced()).toBe(`드릴 편집: ${DRILL_TITLE}`);
  });

  it('시연에 들어가면 시연이라는 사실과 대상 제목을 함께 발표한다', async () => {
    await renderShell();
    const user = userEvent.setup();
    await gotoLoadedLibrary(user);
    await user.click(screen.getByRole('button', { name: '드릴 시연' }));
    expect(announced()).toBe(`시연: ${DRILL_TITLE}`);
  });

  it('목록·설정도 각자의 문장을 발표한다', async () => {
    await renderShell();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '드릴' }));
    expect(announced()).toBe('드릴 목록');
    await user.click(screen.getByRole('button', { name: '설정' }));
    expect(announced()).toBe('설정');
  });
});

describe('AppShell 배선 — 정적 헤더 대 Context 헤더', () => {
  it('정적 config 를 계산하는 화면(drills·settings)에서는 화면의 useAppHeader 선언이 무시된다', async () => {
    await renderShell();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: '드릴' }));
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

  it('정적 config 가 undefined 인 화면(board·present)에서는 화면의 선언이 그대로 헤더가 된다', async () => {
    // ★ board 가 정적 config 를 돌려주면 config prop 이 Context 를 덮어써 헤더가 통째로 사라진다
    // (AppShell.tsx 의 그 사고 주석). AppHeader 단독 테스트로는 못 잡혔던 자리라 여기서 못박는다.
    await renderShell();
    const user = userEvent.setup();
    expect(within(header()).getByText('보드가 선언한 헤더')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '드릴' }));
    await user.click(screen.getByRole('button', { name: '드릴 시연' }));
    expect(within(header()).getByText('시연이 선언한 헤더')).toBeInTheDocument();

    // 같은 board 자리라도 stage 가 바뀌면 헤더 주인도 바뀐다.
    await user.click(screen.getByRole('button', { name: '드릴' }));
    await user.click(screen.getByRole('button', { name: '드릴 열기' }));
    expect(within(header()).getByText('편집기가 선언한 헤더')).toBeInTheDocument();
    expect(within(header()).queryByText('보드가 선언한 헤더')).toBeNull();
  });
});
