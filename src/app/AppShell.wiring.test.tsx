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
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ruleTopicsFor } from '../features/rules/ruleTopics.ts';
import type { DrillId, SessionId } from '../core/ids.ts';
import type { HomeNav } from '../features/home/nav.ts';
import { CHROME_ROWS } from './chromeBudget.ts';

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
  function LibraryScreen({ nav, shareLanding }: { nav: HomeNav; shareLanding?: { id: string; keyB64: string | null } | null }) {
    useAppHeader({ title: '목록이 선언한 헤더(무시돼야 한다)' });
    const { drills } = useLibraryState();
    return (
      <div
        data-testid="screen-library"
        data-drill-count={drills.length}
        // 공유 착지(PLAN-SHARE-LINK 결정 9) — 진짜 화면은 이 값으로 가져오기 시트를 세운다.
        // 여기서는 **값이 화면까지 닿았는가**만 본다(시트 자체는 ShareImportSheet.test.tsx).
        data-share-id={shareLanding?.id ?? ''}
        data-share-key={shareLanding?.keyB64 ?? ''}
      >
        <button type="button" onClick={() => nav.openDrill(FIXTURE.drillId as DrillId)}>
          드릴 열기
        </button>
        <button type="button" onClick={() => nav.goLibrary()}>
          목록으로
        </button>
        <button type="button" onClick={() => nav.goLibrary({ tab: 'sessions' })}>
          세션 목록으로
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
          새 드릴
        </button>
      </div>
    );
  }
  return { LibraryScreen };
});

vi.mock('../features/sessions/SessionsScreen.tsx', () => {
  // C5/C6 — 세션 목록 화면. 편집 대상은 별도 화면(SessionEditorScreen)이다.
  function SessionsScreen({ nav }: { nav: HomeNav }) {
    return (
      <div data-testid="screen-sessions">
        <button type="button" onClick={() => nav.presentSession(FIXTURE.sessionId as SessionId)}>
          세션 시연(세션 화면)
        </button>
      </div>
    );
  }
  return { SessionsScreen };
});

vi.mock('../features/sessions/SessionEditorScreen.tsx', () => {
  // C6 — 세션 전용 편집 화면(/sessions/:id). 드릴의 EditorScreen 과 같은 지위.
  function SessionEditorScreen({ sessionId }: { nav: HomeNav; sessionId: SessionId }) {
    return <div data-testid="screen-session-editor" data-session-id={sessionId} />;
  }
  return { SessionEditorScreen };
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

vi.mock('../features/rules/RulesScreen.tsx', () => {
  // 2026-08-21 신설(헤더는 settings 와 같은 정적 헤더), 2026-08-22 딥링크로 topic prop 을 받기
  // 시작했다 — `data-rule-topic` 이 곧 "주제 대상이 화면까지 닿았는가" 의 관측점이다
  // (PresentRunner 목의 `data-present-kind` 와 같은 패턴).
  function RulesScreen({ topic }: { topic?: string }) {
    return <div data-testid="screen-rules" data-rule-topic={topic ?? ''} />;
  }
  return { RulesScreen };
});

vi.mock('../features/team/TeamScreen.tsx', () => {
  // 2026-09-09 신설. ★ 다른 화면 목과 달리 **진짜 `<main id="main" tabIndex={-1}>`** 을 낸다 —
  // 팀 목록↔상세 전환의 계약 절반이 «main 에 초점이 간다» 라서, div 로 대신하면 그 절반을 못 잰다
  // (§7.5a 대로 실제 TeamScreen 도 자기 main 을 직접 렌더한다).
  function TeamScreen({ teamId }: { teamId?: string }) {
    return <main id="main" tabIndex={-1} data-testid="screen-team" data-team-id={teamId ?? ''} />;
  }
  return { TeamScreen };
});

const { AppShell } = await import('./AppShell.tsx');
const { SettingsProvider } = await import('../store/settings/SettingsProvider.tsx');
const { LibraryProvider } = await import('../store/library/LibraryProvider.tsx');
const { ToastProvider } = await import('../store/toast/ToastProvider.tsx');
const { createMemoryRouter, RouterProvider } = await import('react-router');

// ── 하네스 ────────────────────────────────────────────────────────────────
// AppShell 은 props 를 하나도 받지 않는다 — 바깥에서 필요한 건 App.tsx 와 같은 Provider 3개뿐
// (AppNavProvider·HeaderProvider·두 Target Context 는 AppShell 이 스스로 감싸므로 여기서
// 덧씌우면 안 된다).
// C4(react-router) — 진실이 history.state 에서 URL 로 옮겨 갔다. 하네스는 메모리 라우터로
// AppShell 을 세우고, 테스트는 라우터 인스턴스(현재 주소·location.state)를 직접 단언한다.
// initialPath 로 "새로고침 복원"(같은 주소로 재마운트)을 흉내 낸다 — location 객체를 통째로
// 넘기면 depth(location.state)까지 살아난다(실제 해시 라우터도 state 를 history.state.usr 에
// 실어 리로드에서 보존한다).
type InitialPath = string | { pathname: string; search?: string; state?: unknown };
let initialPath: InitialPath = '/';
let router: ReturnType<typeof createMemoryRouter>;
function Harness() {
  router = createMemoryRouter([{ path: '*', element: <AppShell /> }], { initialEntries: [initialPath as never] });
  return (
    <SettingsProvider>
      <LibraryProvider>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </LibraryProvider>
    </SettingsProvider>
  );
}

/** 새로고침 시뮬레이션 재료 — 지금 주소·state 를 initialPath 로 만든다. */
function currentLocationAsInitial(): InitialPath {
  const { pathname, search, state } = router.state.location;
  return { pathname, search, state };
}

/** 브라우저 뒤로가기 — 메모리 라우터의 이력에서 실제로 한 칸 돌아간다. */
async function goBack() {
  await act(async () => {
    await router.navigate(-1);
  });
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

const SCREEN_TESTIDS = ['screen-board', 'screen-editor', 'screen-library', 'screen-sessions', 'screen-session-editor', 'screen-present', 'screen-rules', 'screen-team', 'screen-settings'] as const;

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

// 2.1 재편: 레일은 5단이다(2026-08-21 규칙 합류). '시연' 은 화면 키로 살아 있지만 레일에는 없다.
const RAIL_LABELS = ['보드', '드릴', '세션', '규칙', '설정'] as const;

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
  // 라우터는 테스트마다 새로 만들지만 initialPath 모듈 변수는 남는다 — 위생상 리셋한다.
  initialPath = '/';
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
    expect(router.state.location.pathname).toBe('/'); // 루트 진입은 자유 전술판이다 — 주소가 곧 초기 상태

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

  it('레일 [규칙]이 규칙 화면으로 가고 URL·레일 활성이 함께 맞는다 (2026-08-21 신설)', async () => {
    await renderShell();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: '규칙' }));
    expectOnlyScreen('screen-rules');
    expectRailActive('규칙');
    expect(router.state.location.pathname).toBe('/rules');
    expect(within(header()).getByText('경기 규칙')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '보드' }));
    expectOnlyScreen('screen-board');
  });

  it('규칙 딥링크(/rules/:topic)가 RulesScreen 까지 topic prop 으로 닿는다 (2026-08-22 재설계)', async () => {
    initialPath = '/rules/two-on-one';
    await renderShell();
    expectOnlyScreen('screen-rules');
    expect(screen.getByTestId('screen-rules')).toHaveAttribute('data-rule-topic', 'two-on-one');
  });

  it('규칙 카드 안에서는 헤더가 카드 제목·부제를 보이고 [목록으로]가 목록으로 되돌린다 (2026-09-03 신설)', async () => {
    // 기현 지시: 목록일 때는 화면 제목·부제 가운데, 카드로 들어가면 카드 주제목·부제목 가운데 +
    // 헤더 왼쪽 끝 [← 목록으로]. 문서 안에 있던 [← 홈으로] 는 이 버튼으로 옮겨 갔다.
    initialPath = '/rules/two-on-one';
    await renderShell();
    const user = userEvent.setup();
    const topic = ruleTopicsFor('ko').find((tp) => tp.key === 'two-on-one')!;
    expect(within(header()).getByText(topic.title)).toBeInTheDocument();
    expect(within(header()).getByText(topic.tagline)).toBeInTheDocument();

    await user.click(within(header()).getByRole('button', { name: '목록으로' }));
    expect(router.state.location.pathname).toBe('/rules');
    expect(within(header()).getByText('경기 규칙')).toBeInTheDocument();
    expect(within(header()).queryByRole('button', { name: '목록으로' })).toBeNull();
  });

  it('옛 /rules/law-N 딥링크는 부록 주제(rulebook)로 흡수돼 화면까지 닿는다', async () => {
    initialPath = '/rules/law-3';
    await renderShell();
    expectOnlyScreen('screen-rules');
    expect(screen.getByTestId('screen-rules')).toHaveAttribute('data-rule-topic', 'rulebook');
    expect(router.state.location.pathname).toBe('/rules/law-3'); // 흡수는 target 파싱만, 주소 자체를 재작성하진 않는다
  });

  it('board 자리는 화면 키가 아니라 StageTarget 이 가른다 — board 면 BoardScreen, drill 이면 EditorScreen', async () => {
    await renderShell();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: '드릴' }));
    // nav.openDrill = setStageTarget({kind:'drill'}) + go('board', {kind:'drill'})
    await user.click(screen.getByRole('button', { name: '드릴 열기' }));
    expectOnlyScreen('screen-editor');
    expect(router.state.location.pathname).toBe(`/drills/${FIXTURE.drillId}`);

    // ⚠️ 2026-08-14 뒤집힘. 여기는 원래 `expectOnlyScreen('screen-editor')` 였다 — 레일이
    // 대상을 안 실어서 stage 가 drill 그대로 남는 것을 "들렀다 와도 손에 든 판은 그대로"
    // 라고 못박고 있었다. 기현님 지시로 폐기: *"드릴 편집 하다가 보드를 누르면 드릴 내용이
    // 보드로 가는데 절대 금지다. 그 둘은 별개다 절대적으로."*
    await user.click(screen.getByRole('button', { name: '설정' }));
    await user.click(screen.getByRole('button', { name: '보드' }));
    expectOnlyScreen('screen-board');
    expect(router.state.location.pathname).toBe('/');

    // nav.newDrill 은 **화면을 안 옮긴다**(2026-08-28) — 이름·코트를 묻는 다이얼로그를 연다.
    // 옛 계약은 `go('board', {kind:'board'})` 였고 여기서 `expectOnlyScreen('screen-board')`
    // 를 봤다. 지금은 있던 화면이 그대로 서 있는 것이 계약이다.
    await user.click(screen.getByRole('button', { name: '드릴' }));
    // 헤더 주 액션도 이름이 '새 드릴' 이다 — 목록 안으로 좁혀 고른다(둘 다 같은 콜백이라
    // 어느 쪽을 눌러도 같은 다이얼로그가 떠야 하는 것이 계약이기도 하다).
    await user.click(within(screen.getByTestId('screen-library')).getByRole('button', { name: '새 드릴' }));
    expectOnlyScreen('screen-library');
    expect(screen.getByRole('dialog', { name: '새 드릴' })).toBeTruthy();
    expect(router.state.location.pathname).toBe('/drills');
  });

  it('세션 열기가 전용 편집 화면(/sessions/:id)으로 간다 (C6 — 드릴의 목록→편집 꼴)', async () => {
    await renderShell();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: '드릴' }));
    await user.click(screen.getByRole('button', { name: '세션 열기' }));
    expectOnlyScreen('screen-session-editor');
    expect(router.state.location.pathname).toBe(`/sessions/${FIXTURE.sessionId}`);
    expect(screen.getByTestId('screen-session-editor')).toHaveAttribute('data-session-id', FIXTURE.sessionId);
    expectRailActive('세션');
  });

  it('레일 [세션]과 [드릴]이 각각 제 화면으로 가고, 뒤로가기가 정확히 이전 화면으로 돌아온다', async () => {
    // 계획서 2.9 의 "뒤로가기는 정확히 이전 탭으로" 의 후계 — 탭이 화면으로 승격했다(C5).
    await renderShell();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: '드릴' }));
    expect(router.state.location.pathname).toBe('/drills');
    expectOnlyScreen('screen-library');

    await user.click(screen.getByRole('button', { name: '세션' }));
    expect(router.state.location.pathname).toBe('/sessions');
    expectOnlyScreen('screen-sessions');
    expectRailActive('세션');

    await goBack();
    expectOnlyScreen('screen-library');
    expectRailActive('드릴');
  });

  it('편집 대상은 주소가 정한다 — 레일 [세션]은 언제나 목록이다', async () => {
    await renderShell();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: '드릴' }));
    await user.click(screen.getByRole('button', { name: '세션 열기' }));
    expectOnlyScreen('screen-session-editor');

    await user.click(screen.getByRole('button', { name: '보드' }));
    await user.click(screen.getByRole('button', { name: '세션' }));
    expectOnlyScreen('screen-sessions');
    expect(router.state.location.pathname).toBe('/sessions');
  });
});

// ── [보드]와 드릴 편집은 별개다 (2026-08-14 기현님 지시) ──────────────────────────────
// *"드릴 편집 하다가 보드를 누르면 드릴 내용이 보드로 가는데 절대 금지다. 그 둘은 별개다
// 절대적으로."* — 원인은 레일이 `go('board')` 를 대상 없이 부른 것이었다(navChrome.ts 의
// RAIL_NAV_TARGETS 주석에 전말). **금지 사항은 테스트로 못박는다.**
describe('AppShell 배선 — 레일 [보드]는 언제나 자유 전술판이다', () => {
  it('드릴 편집 중에 눌러도 그 드릴이 board 자리에 남지 않는다', async () => {
    await renderShell();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: '드릴' }));
    await user.click(screen.getByRole('button', { name: '드릴 열기' }));
    expectOnlyScreen('screen-editor');

    // 다른 화면을 경유하지 않는다 — 편집기에서 곧장 누르는 것이 기현님이 실제로 한 조작이다.
    await user.click(screen.getByRole('button', { name: '보드' }));
    expectOnlyScreen('screen-board');
    expectRailActive('보드');
    // 원인 자체를 본다: 주소가 루트여야 stageFromNav 가 board 를 돌려준다.
    expect(router.state.location.pathname).toBe('/');
  });

  it('그래도 편집하던 드릴은 뒤로가기로 그대로 돌아온다 — 버리는 게 아니라 가르는 것이다', async () => {
    await renderShell();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: '드릴' }));
    await user.click(screen.getByRole('button', { name: '드릴 열기' }));
    expect(router.state.location.pathname).toBe(`/drills/${FIXTURE.drillId}`);

    await user.click(screen.getByRole('button', { name: '보드' }));
    expectOnlyScreen('screen-board');

    await goBack();
    expectOnlyScreen('screen-editor');
  });

  it('좁은 창의 헤더 세그먼트도 같다 — 한 표(RAIL_NAV_TARGETS)를 나눠 쓴다', async () => {
    // 이 계약이 컴포넌트마다 따로 적혀 있으면 **좁은 창에서만 드릴이 새는** 앱이 된다.
    // 여기서 stubMedia 를 쓰므로 아래 afterEach 대신 이 테스트가 직접 지운다.
    stubMedia(true);
    try {
      await renderShell();
      const user = userEvent.setup();
      const nav = () => screen.getByRole('navigation', { name: '주요 메뉴' });
      expect(header().contains(nav())).toBe(true); // 레일이 아니라 세그먼트를 누르고 있다

      await user.click(within(nav()).getByRole('button', { name: '드릴' }));
      await user.click(screen.getByRole('button', { name: '드릴 열기' }));
      expectOnlyScreen('screen-editor');

      await user.click(within(nav()).getByRole('button', { name: '보드' }));
      expectOnlyScreen('screen-board');
      expect(router.state.location.pathname).toBe('/');
    } finally {
      delete (window as unknown as { matchMedia?: unknown }).matchMedia;
    }
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

  it('드릴 편집 중 활성은 [드릴] 이다 — 같은 자리를 쓴다고 같은 항목은 아니다', async () => {
    // ⚠️ 2026-08-14 뒤집힘. 여기는 원래 `expectRailActive('보드')` 였고 제목도 *"드릴 편집
    // 중에도 활성은 [보드] 다 — 편집이 board 자리를 함께 쓰기 때문"* 이었다. 화면 키만 보고
    // 접은 결과를 그대로 계약이라고 적어 둔 것이다. 기현님 지시: *"드릴 편집 화면에서 좌측
    // 메뉴 아이콘이 보드가 활성화 되어 있는데 드릴이 활성화 되어야 한다."*
    await renderShell();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: '드릴' }));
    await user.click(screen.getByRole('button', { name: '드릴 열기' }));
    expectOnlyScreen('screen-editor');
    expectRailActive('드릴');

    // 대조군 — 같은 화면 키에서 자유 전술판으로 돌아오면 다시 [보드]다. 화면 키가 아니라
    // **무엇이 떠 있는가**가 판정한다는 것을 한 테스트 안에서 보인다.
    await user.click(screen.getByRole('button', { name: '보드' }));
    expectOnlyScreen('screen-board');
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
});

describe('AppShell 배선 — URL 직렬화 왕복 (C4: 진실은 주소다)', () => {
  it('같은 주소로 재마운트(새로고침)하면 같은 화면·depth 로 복원된다', async () => {
    const { unmount } = await renderShell();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: '설정' }));
    expect(router.state.location.pathname).toBe('/settings');
    expect(router.state.location.state).toEqual({ depth: 1 });

    // 새로고침 시뮬레이션 — 트리를 버리고 같은 주소(+state)로 다시 마운트한다.
    initialPath = currentLocationAsInitial();
    unmount();
    await renderShell();
    expectOnlyScreen('screen-settings');
    expect(within(header()).getByText('설정')).toBeInTheDocument();

    // depth 도 살아 돌아왔다 — 0 으로 리셋됐다면 다음 go 가 1 이 됐을 것이다.
    await user.click(screen.getByRole('button', { name: '드릴' }));
    expect(router.state.location.state).toEqual({ depth: 2 });
  });

  it('시연 중 리로드해도 빈 화면이 아니라 그 대상이 복원된다 (계획서 2.3)', async () => {
    const { unmount } = await renderShell();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: '드릴' }));
    await user.click(screen.getByRole('button', { name: '드릴 시연' }));
    expect(screen.getByTestId('screen-present')).toHaveAttribute('data-present-id', FIXTURE.drillId);
    expect(router.state.location.pathname).toBe(`/present/drill/${FIXTURE.drillId}`);

    // 체육관 태블릿이 시연 도중 리로드된 상황. 주소가 대상을 싣고 있으므로 복원이 공짜다.
    initialPath = currentLocationAsInitial();
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
    expect(router.state.location.pathname).toBe(`/present/session/${FIXTURE.sessionId}`);

    initialPath = currentLocationAsInitial();
    unmount();
    await renderShell();
    expect(screen.getByTestId('screen-present')).toHaveAttribute('data-present-kind', 'session');
    expect(screen.getByTestId('screen-present')).toHaveAttribute('data-present-id', FIXTURE.sessionId);
  });

  it('대상 없는 시연 주소는 그대로 빈 시연이다 — 복원이 아무 대상이나 만들어내지 않는다', async () => {
    // 위 두 테스트의 대조군. 대상이 실려 있을 때만 복원돼야 한다.
    initialPath = '/present';
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

    initialPath = currentLocationAsInitial();
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

    initialPath = currentLocationAsInitial();
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

    initialPath = currentLocationAsInitial();
    unmount();
    PRESENT_FRAMES.kinds.length = 0;
    await renderShell();
    expect(PRESENT_FRAMES.kinds.length).toBeGreaterThan(0); // 대조군 — 기록이 실제로 돌았다
    expect(PRESENT_FRAMES.kinds[0]).toBe('drill');
    expect(PRESENT_FRAMES.kinds).not.toContain('');
    expect(screen.getByTestId('screen-present')).toHaveAttribute('data-present-id', FIXTURE.drillId);
  });

  // 구 키(home/library) 관용 테스트는 C4 에서 은퇴 — 진실이 history.state 에서 URL 로 옮겨
  // 가면서 옛 state 엔트리는 아무도 읽지 않는다(screens.ts 의 은퇴 기록).

  it('브라우저 뒤로가기가 이전 화면을 되살리고, 모르는 주소는 전술판으로 접힌다', async () => {
    await renderShell();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '드릴' }));
    await user.click(screen.getByRole('button', { name: '설정' }));
    expectOnlyScreen('screen-settings');

    await goBack();
    expectOnlyScreen('screen-library');

    // 남의 주소(공유 링크 오타·확장이 만든 해시)는 전술판이다 — 404 화면을 만들지 않는다
    // (routes.ts parsePath 의 그 교리를 AppShell 배선까지 통과해 확인한다).
    await act(async () => {
      await router.navigate('/nowhere/at/all');
    });
    expectOnlyScreen('screen-board');
  });

  it('주소의 대상이 곧 시연 대상이다 — 드릴 A 주소에서 B 주소로 가면 B 가 뜬다', async () => {
    await renderShell();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: '드릴' }));
    await user.click(screen.getByRole('button', { name: '드릴 시연' }));
    expect(screen.getByTestId('screen-present')).toHaveAttribute('data-present-id', FIXTURE.drillId);

    await act(async () => {
      await router.navigate('/present/drill/dr_other');
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
    expect(editing).toBe(`드릴 편집: ${DRILL_TITLE}`); // 드릴 제목이 발표문에 들어간다
    // 자유판으로 돌아가는 길은 **레일 [보드]** 다. 2026-08-28 이전에는 목록의 [새 드릴]이
    // 같은 곳으로 데려갔지만(이 자리에 '빈 판으로' 목 버튼이 있었다), 지금 그 버튼은 화면을
    // 안 옮기고 다이얼로그를 연다 — 발표 대상이 아니다.
    await user.click(screen.getByRole('button', { name: '보드' }));
    const free = announced();

    expect(free).toBe('자유 전술판');
    expect(editing).not.toBe(free);
    expect(editing).not.toContain('화면'); // 옛 "{화면명} 화면" 문장이 되살아나면 빨간불
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

  // 2026-09-09(검수) — 팀 목록↔상세는 **같은 화면 키 안에서 본문이 통째로 바뀌는** 전환이다.
  // 이 케이스를 지우면 새는 것: 카드 [열기] 를 눌러도 아무것도 안 읽히고 초점이 <body> 로
  // 떨어져 Tab 이 «본문으로 건너뛰기» 부터 다시 시작한다(실기에서 실제로 그랬다).
  it('팀 목록 → 상세도 발표하고 main 에 초점을 준다 — 같은 화면 키 안의 전환', async () => {
    initialPath = '/team';
    await renderShell();
    expect(announced()).toBe(''); // 최초 마운트는 여전히 조용하다

    await act(async () => {
      await router.navigate('/team/tm_wiring0001');
    });
    expect(screen.getByTestId('screen-team')).toHaveAttribute('data-team-id', 'tm_wiring0001');
    expect(announced()).toBe('팀 상세');
    expect(document.activeElement).toBe(screen.getByTestId('screen-team'));

    // 되돌아오는 길도 같은 급이다 — [← 팀 목록] 이 조용하면 어디로 왔는지 알 수 없다.
    await act(async () => {
      await router.navigate('/team');
    });
    expect(announced()).toBe('팀');
    expect(document.activeElement).toBe(screen.getByTestId('screen-team'));
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
    //
    // ⚠️ **좁은 창에서 본다**(2026-08-14). 자유 전술판은 이제 넓은 창에서 헤더 자체가 없어
    // (기현 지시 *"상단 헤더 삭제"*) 넓게 두면 `header()` 가 던진다. 좁으면 남으므로 —
    // 거기서는 헤더의 3칸 세그먼트가 유일한 이동 수단이다 — 이 계약을 그대로 잴 수 있다.
    stubMedia(true);
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

// ── 3.-2 좁은 창: 레일이 헤더 좌측 세그먼트로 접힌다 ──────────────────────────────────
// §5.2 가 확정한 `AppRail 84 → 0`. 폭 예산 117 중 84 가 이 한 행이라, 여기가 안 걷히면
// §5.4 의 '남는 폭'이 172 가 아니라 88 이 되어 `--hit` 56 에서 트레이 117 을 못 댄다.
// 항목 자체의 계약(라벨·테마·버전·세로 예산)은 AppNavSegment.test.tsx 가 본다.

/** jsdom 에는 matchMedia 가 없다. 안 깔면 `useIsNarrow` 가 넓은 쪽으로 굳어(2.3 폴백) 좁은
 *  경로가 한 줄도 실행되지 않은 채 이 describe 가 통째로 초록불이 된다. */
function stubMedia(narrow: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (q: string) => ({
      matches: q.includes('max-width') ? narrow : false,
      media: q,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => true,
    }),
  });
}

/** 그 내비가 **폭 예산에 기여하는 픽셀**. 레일은 가로 흐름에서 자기 폭을 선언하고(84),
 *  헤더 안 세그먼트는 코트 상자를 옆으로 밀지 않으므로 0 이다 — 그 0/84 를 예산 행과 직접
 *  대조하는 것이 이 항목의 완료 판정이다. */
const navChromeWidthPx = (nav: HTMLElement, header: HTMLElement): number =>
  header.contains(nav) ? 0 : Number.parseInt(nav.style.width || '0', 10);

describe('AppShell 배선 — 좁은 창에서 레일이 헤더 좌측으로 접힌다 (3.-2)', () => {
  const railRow = CHROME_ROWS.find((r) => r.id === 'appRail')!;

  afterEach(() => {
    delete (window as unknown as { matchMedia?: unknown }).matchMedia;
  });

  it('좁으면 레일이 사라지고 같은 3항목이 헤더 안에 선다 — 폭 기여가 84 → 0', async () => {
    stubMedia(true);
    const { unmount } = await renderShell();
    // 이름은 그대로다(좁다고 다른 앱이 되면 안 된다). getByRole 은 둘이면 던지므로 이 한 줄이
    // "레일과 세그먼트가 동시에 서 있지 않다" 까지 함께 본다.
    const nav = screen.getByRole('navigation', { name: '주요 메뉴' });
    expect(header().contains(nav)).toBe(true);
    expect(navChromeWidthPx(nav, header())).toBe(railRow.narrow);
    expect(railRow.narrow).toBe(0);
    for (const l of RAIL_LABELS) expect(within(nav).getByRole('button', { name: l })).toBeInTheDocument();
    unmount();

    // 대조군: 넓으면 레일이 헤더 밖에 서고 폭은 예산의 wide 84 다.
    stubMedia(false);
    await renderShell();
    // ⚠️ 자유 전술판은 넓은 창에서 헤더가 없다(2026-08-14) — 헤더가 **있는** 화면으로 옮겨야
    // "레일이 헤더 밖" 을 잴 수 있다. 레일 자체는 두 화면 모두 같은 자리에 같은 폭으로 선다.
    await userEvent.setup().click(screen.getByRole('button', { name: '설정' }));
    const wideNav = screen.getByRole('navigation', { name: '주요 메뉴' });
    expect(header().contains(wideNav)).toBe(false);
    expect(navChromeWidthPx(wideNav, header())).toBe(railRow.wide);
    expect(railRow.wide).toBe(84);
  });

  it('★ 자유 전술판도 넓은 창에서 헤더가 선다 — 제목·부제·[드릴로 편집] (2026-09-03 뒤집음)', async () => {
    // 🔁 2026-08-14 *"상단 헤더 삭제. 공간 확보"* 로 넓은 창 전술판만 헤더가 없었다(그때 헤더는 빈
    // 줄뿐이었다 — 코트 전환·되돌리기·[드릴로 저장]이 기능 바로 내려간 뒤). 2026-09-03 기현 지시로
    // 헤더가 제목·부제·주 액션 [+ 드릴로 편집]을 지면서 되돌아왔다. [드릴로 저장] 칸은 기능 바에서
    // 빠졌다(같은 이름의 표적이 둘이 되지 않게).
    stubMedia(false);
    await renderShell();
    // BoardScreen 은 이 파일에서 목이라 실제 제목·[드릴로 편집]은 BoardScreen.test 가 잰다 — 여기서는
    // 넓은 창에서 헤더가 서고 그 화면이 선언한 내용을 보인다는 배선만 본다.
    expect(document.querySelector('header'), '넓은 창 전술판에 헤더가 없다').not.toBeNull();
    expect(within(header()).getByText('보드가 선언한 헤더')).toBeInTheDocument();
  });

  it('★ 드릴 편집은 넓은 창에서도 헤더가 선다 — 편집기가 선언한 컴팩트 헤더', async () => {
    // 기현 지시 2026-08-20: *"드릴 편집 화면과 시연 화면은 비슷한 레이아웃이어야 ux가
    // 좋아진다"* — 두 화면이 같은 컴팩트 헤더를 쓰도록 `showHeader` 판정에
    // `stageTarget.kind === 'drill'` 이 돌아왔다(AppShell.tsx 그 주석). 자유 전술판(위 it)
    // 만 여전히 예외다 — 같은 board 자리인데 무엇이 떠 있는지에 따라 갈린다.
    stubMedia(false);
    await renderShell();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '드릴' }));
    await user.click(screen.getByRole('button', { name: '드릴 열기' }));
    expect(within(header()).getByText('편집기가 선언한 헤더')).toBeInTheDocument();
  });

  it('좁아도 SCREEN_TO_RAIL 매핑이 그대로다 — 시연 중 활성은 [드릴]', async () => {
    stubMedia(true);
    await renderShell();
    const user = userEvent.setup();

    expectRailActive('보드');
    await user.click(screen.getByRole('button', { name: '드릴' }));
    expectRailActive('드릴');
    await user.click(screen.getByRole('button', { name: '드릴 시연' }));
    expectOnlyScreen('screen-present');
    expectRailActive('드릴');
  });

  it('키보드 순회가 헤더 → 판 순이다 — 내비가 화면보다 앞에 있다', async () => {
    // 좁은 창에서 내비가 헤더 **뒤**(주 액션 옆)로 가면 탭 순서가 판을 지나갔다가 돌아온다.
    stubMedia(true);
    await renderShell();
    const nav = screen.getByRole('navigation', { name: '주요 메뉴' });
    const board = screen.getByTestId('screen-board');
    expect(nav.compareDocumentPosition(board) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // 헤더 안에서도 좌측 첫 칸이다 — 제목·되돌리기보다 앞.
    expect(header().firstElementChild!.contains(nav)).toBe(true);
  });
});

// ── 공유 링크 착지 (PLAN-SHARE-LINK 결정 9) ──────────────────────────────────────────────
// 지우면 새는 것 둘:
//  ① 열쇠(`#` 뒤 43자)가 주소에 남으면, 화면을 지나가며 본 사람·브라우저 방문 기록·공유 시트가
//     그 드릴을 여는 권한을 그대로 갖는다(열쇠가 곧 권한인 모델이다).
//  ② 그 열쇠가 화면까지 안 닿으면 정상 링크가 "열쇠가 맞지 않음" 으로 떨어진다.
describe('/s/:id 착지', () => {
  const KEY = 'A'.repeat(43);

  afterEach(() => {
    window.history.replaceState(null, '', '/');
  });

  it('열쇠를 화면에 넘기고 주소에서는 지운다', async () => {
    window.history.replaceState(null, '', `/s/ShareIdAb1#${KEY}`);
    initialPath = '/s/ShareIdAb1';
    await renderShell();

    const lib = screen.getByTestId('screen-library');
    expect(lib.getAttribute('data-share-id')).toBe('ShareIdAb1');
    expect(lib.getAttribute('data-share-key')).toBe(KEY); // ②
    expect(window.location.hash).toBe(''); // ①
  });

  it('착지에서 목록으로 닫을 때는 push 가 아니라 교체다 — 뒤로가기가 열쇠 없는 /s/:id 로 되돌아가면 안 된다', async () => {
    // 2026-09-07 검수: goLibrary 가 push 였을 때 [닫기] 뒤 브라우저 뒤로가기가 `/s/:id`(열쇠는
    // 이미 주소에서 지워졌다)로 되돌아가 정상 링크였는데도 "열쇠가 맞지 않음" 을 띄웠다.
    window.history.replaceState(null, '', `/s/ShareIdAb1#${KEY}`);
    initialPath = '/s/ShareIdAb1';
    await renderShell();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '목록으로' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/drills'));
    expect(router.state.historyAction).toBe('REPLACE');
    expect(screen.getByTestId('screen-library').getAttribute('data-share-id')).toBe('');
  });

  it('세션 링크를 저장한 뒤 세션 화면으로 갈 때도 교체다 — 탭 목적지가 push 로 새면 같은 버그가 되살아난다', async () => {
    // 2026-09-08(S5): 세션 저장 뒤 `goLibrary({ tab: 'sessions' })`. 착지 분기가 «대상 없음» 에만
    // 걸리면 이 호출은 push 라, 뒤로가기가 열쇠 없는 `/s/:id` 로 돌아간다.
    window.history.replaceState(null, '', `/s/ShareIdAb1#${KEY}`);
    initialPath = '/s/ShareIdAb1';
    await renderShell();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '세션 목록으로' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/sessions'));
    expect(router.state.historyAction).toBe('REPLACE');
  });

  it('열쇠가 잘린 링크는 화면에 빈 열쇠로 닿는다 — 라이브러리 화면은 그대로 뜬다', async () => {
    window.history.replaceState(null, '', '/s/ShareIdAb1');
    initialPath = '/s/ShareIdAb1';
    await renderShell();

    expectOnlyScreen('screen-library');
    const lib = screen.getByTestId('screen-library');
    expect(lib.getAttribute('data-share-id')).toBe('ShareIdAb1');
    expect(lib.getAttribute('data-share-key')).toBe('');
  });
});
