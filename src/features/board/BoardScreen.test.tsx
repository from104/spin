// §10.8 화면 스모크 — 자유 전술판(대문)이 뜨고, 도구·코트·속성 3영역과 드래그 존·물리가
// 드릴 편집과 **같은 컴포넌트**(EditorWorkspace)로 동작하는지 실제 경로로 확인한다.
//
// 2026-08-09 재편 전에는 이 파일이 EditorScreen(CourtPicker → 드릴 생성)을 마운트했다. 지금은
// 새 드릴이 전술판에서 태어나므로 코트 고르기 단계가 없다 — 전술판은 'full' 로 열고
// 스냅샷이 코트를 기억한다(`prefs.defaultCourtMode` 는 2026-08-21 폐기).
//
// 헤더까지 함께 렌더한다: 코트 전환 세그먼트가 헤더에 있어서, "리셋 상태에서만 전환"
// 게이트를 화면 끝에서 확인하려면 AppHeader 가 트리에 있어야 한다.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CHAIR } from '../../core/constants.ts';
import { Profiler } from 'react';
import type { ProfilerOnRenderCallback, ReactNode } from 'react';
import { SettingsProvider } from '../../store/settings/SettingsProvider.tsx';
import { LibraryProvider, useLibraryState } from '../../store/library/LibraryProvider.tsx';
import { ToastProvider } from '../../store/toast/ToastProvider.tsx';
import { AppNavProvider } from '../../app/useAppHistory.ts';
import type { AppHistoryApi } from '../../app/useAppHistory.ts';
import { AppHeader, HeaderProvider } from '../../app/AppHeader.tsx';
import { LiveRegion } from '../../ui/LiveRegion.tsx';
import { ToastHost } from '../../ui/ToastHost.tsx';
import { useToast } from '../../store/toast/ToastProvider.tsx';
import { loadPrefs, makeDefaultPrefs, PREFS_KEY } from '../../storage/prefs.ts';
import { BOARD_KEY, saveBoard } from '../../storage/board.ts';
import { clearBoardSession } from './boardSession.ts';
import { createDrill } from '../../model/defaults.ts';
import { isStepEmpty } from '../../model/drill.ts';
import type { Drill } from '../../model/drill.ts';
import { setArrow } from '../../model/edits.ts';
import { newId } from '../../core/ids.ts';
import { resolveDrillRepo } from '../../storage/drillRepo.ts';
import { BoardScreen } from './BoardScreen.tsx';

/** LibraryProvider 가 들고 있는 드릴 수를 화면에 낸다. "저장 직후 목록이 갱신됐는가" 는
 *  이 값으로만 보인다 — IDB 를 직접 읽으면 refresh() 를 빼도 통과해버린다. */
function LibraryProbe() {
  const { drills } = useLibraryState();
  return <span data-testid="library-drill-count">{drills.length}</span>;
}

/** 토스트는 ToastProvider 상태에만 있고 호스트가 없으면 화면에 안 뜬다 — 잠금 사유 확인용. */
function Toasts() {
  const { toasts, dismiss } = useToast();
  return <ToastHost toasts={toasts} onDismiss={dismiss} />;
}

/** `Wrapper` 는 render 의 wrapper 라 prop 을 못 받는다 — 화면 전환을 보고 싶은 테스트만
 *  `openBoard({ onGo })` 로 이 자리에 귀를 꽂는다. 테스트마다 초기화한다(아래 beforeEach). */
let navGo: (...args: Parameters<AppHistoryApi['go']>) => void = () => {};

function Wrapper({ children }: { children: ReactNode }) {
  const nav: AppHistoryApi = { screen: 'board', go: (...args) => navGo(...args), back: () => {} };
  return (
    <SettingsProvider>
      <LibraryProvider>
      <ToastProvider>
        <HeaderProvider>
          <AppNavProvider value={nav}>
            <AppHeader />
            {children}
          </AppNavProvider>
        </HeaderProvider>
        <Toasts />
        <LibraryProbe />
        <LiveRegion />
      </ToastProvider>
      </LibraryProvider>
    </SettingsProvider>
  );
}

/** 전술판을 지정한 코트로 연다. full 아닌 코트는 render 전에 스냅샷으로 심는다.
 *
 *  `placed: true` 면 **개체가 놓인 판**을 스냅샷으로 심어서 연다. 전술판은 2026-08-10 부터
 *  **빈 코트로 시작**하므로(기현 지시), 칩을 만지는 테스트는 판을 채운 상태에서 열어야 한다.
 *  스냅샷 경로를 그대로 타므로 "저장된 판 되살리기" 도 겸사겸사 검증된다.
 *
 *  `onRender` 를 주면 판 서브트리를 `<Profiler>` 로 감싼다 — "드래그 중 React 리렌더 0회"
 *  (§6.1 규칙 1)를 화면 끝에서 세는 유일한 방법이다. */
async function openBoard(
  court: 'full' | 'half' | 'flat' = 'full',
  opts: { placed?: boolean; onRender?: ProfilerOnRenderCallback; onGo?: (...args: Parameters<AppHistoryApi['go']>) => void } = {},
) {
  navGo = opts.onGo ?? (() => {});
  // 자유 전술판 튜토리얼이 자동 시작하면(§0.5, tutorialsSeen 미지정) 스포트라이트가 Esc·
  // 화살표·liveRegion 발표문을 가로채 아래 배선 테스트가 깨진다 — "이미 봤다" 로 시작한다.
  localStorage.setItem(
    PREFS_KEY,
    JSON.stringify({ ...makeDefaultPrefs(), tutorialsSeen: { board: true } }),
  );
  // 코트는 스냅샷(부팅 ②)으로 심는다 — prefs.defaultCourtMode 는 2026-08-21 폐기됐고,
  // 새 판(부팅 ③)은 'full' 고정이라 half/flat 은 저장본으로만 전달할 수 있다.
  if (opts.placed) saveBoard(createDrill({ courtMode: court, formation: '1-2-1' }));
  else if (court !== 'full') saveBoard(createDrill({ title: '자유 전술판', courtMode: court, empty: true }));
  const user = userEvent.setup();
  const tree = opts.onRender ? (
    <Profiler id="board" onRender={opts.onRender}>
      <BoardScreen />
    </Profiler>
  ) : (
    <BoardScreen />
  );
  const { unmount } = render(tree, { wrapper: Wrapper });
  await waitFor(() => expect(screen.getByRole('navigation', { name: '도구' })).toBeInTheDocument());
  return { user, unmount, stage: screen.getByRole('application', { name: '코트 편집 영역' }) };
}

/** 코트 팝오버를 편다. 2026-08-14 재설계로 코트 형태·크기가 오른쪽 기능 바의 [코트] 안으로
 *  들어갔다 — 그 전에는 DOM 에 아예 없다(닫힌 오버레이는 표적 예산 밖이라는 그 규칙 그대로).
 *  ⚠️ 자유 전술판에는 **인스펙터가 없다.** 옛 `openInspector` 는 그래서 사라졌다. */
async function openCourt(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: '보드 설정' }));
  return screen.getByRole('dialog', { name: '보드 설정' });
}

/** 코트 위 개체의 translate 좌표를 읽는다. */
function poseOf(el: Element): { x: number; y: number } {
  const m = /translate\(([-\d.]+) ([-\d.]+)\)/.exec(el.getAttribute('transform') ?? '');
  return { x: Number(m?.[1] ?? NaN), y: Number(m?.[2] ?? NaN) };
}

/** 무대에 viewBox 와 1:1 인 실측 rect 를 물린다.
 *
 *  jsdom 의 getBoundingClientRect 는 전부 0 이라 computeMetrics 의 pxPerUnit 이 0 이 되고,
 *  clientToWorld 가 0 으로 나눠 월드 좌표가 통째로 NaN 이 된다. 그러면 포인터가 어디를
 *  찍든 히트테스트가 성립하지 않아 "마우스로 잡는" 경로가 조용히 아무 일도 안 한다.
 *  rect 를 viewBox 와 같은 크기·원점 0 으로 주면 pxPerUnit=1, offX=offY=0 이 되어
 *  client = world − viewBox원점 이라는 1:1 대응이 성립한다(→ toClient). */
function stubStageRect(stage: Element): (w: { x: number; y: number }) => { clientX: number; clientY: number } {
  const [vx, vy, vw, vh] = (stage.getAttribute('viewBox') ?? '0 0 0 0').split(/\s+/).map(Number) as [number, number, number, number];
  stage.getBoundingClientRect = () =>
    ({ x: 0, y: 0, left: 0, top: 0, right: vw, bottom: vh, width: vw, height: vh, toJSON: () => ({}) }) as DOMRect;
  return (w) => ({ clientX: w.x - vx, clientY: w.y - vy });
}

beforeEach(() => {
  localStorage.clear(); // prefs + 전술판 스냅샷(BOARD_KEY) 둘 다 비운다
  // 세션 캐시는 모듈 전역이라 **테스트 사이에 새어 나간다** — 안 끊으면 앞 테스트가 놓은
  // 배치와 이력을 다음 테스트가 이어받아 연다(boardSession.ts 머리말).
  clearBoardSession();
});

describe('자유 전술판 (대문)', () => {
  it('코트 고르기 단계 없이 도구·코트가 바로 뜨고, 속성은 한 번의 탭으로 붙는다', async () => {
    // 재편의 핵심 요구 — 대문에 판이 "상시 떠 있다". 진입 장벽(CourtPicker)이 없어야 한다.
    // 2026-08-12 결정 ③A: 속성은 3영역 중 하나가 아니라 **기본 접힘 오버레이**다.
    const { stage, user } = await openBoard('full', { placed: true });
    expect(stage).toBeInTheDocument();
    expect(screen.queryByRole('complementary', { name: '드릴 속성' })).toBeNull();
    expect(screen.getByRole('button', { name: /^선택/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('heading', { name: '어떤 코트로 진행하십니까?' })).toBeNull();

    expect(await openCourt(user)).toBeInTheDocument();
  });

  it('전술판은 1장짜리다 — 스텝 UI 가 없다', async () => {
    // 인스펙터의 스텝 섹션과 왼쪽 스텝 사이드바를 놔두면 화면에 없는 2번째 스텝을
    // 만들 수 있다(눈으로는 알 수 없다). 셋 다 없어야 한다.
    // **인스펙터를 펴 놓고** 확인한다 — 접혀 있으면 아무것도 없는 게 당연해서 통과가 공짜다.
    const { user } = await openBoard();
    await openCourt(user);
    expect(screen.queryByRole('button', { name: '스텝 추가' })).toBeNull();
    expect(screen.queryByRole('button', { name: '한 장 더 찍기' })).toBeNull();
    // 2026-08-17 재편(구현 순서 ②) — 스텝 목록은 왼쪽 세로 사이드바(StepSidebar.tsx)다.
    // 자유 전술판(isBoard)은 스텝이 없으니 **완전 무변**이어야 한다 — 고정 자리도, 접힘
    // 모드의 여는 버튼도 있으면 안 된다.
    expect(screen.queryByRole('navigation', { name: '스텝 목록' })).toBeNull();
    expect(screen.queryByRole('button', { name: '스텝 목록 열기' })).toBeNull();
  });

  it('편집기 격자·규칙존 토글이 prefs 에 반영된다(다른 화면 갔다 와도 유지, minor #6)', async () => {
    const { user } = await openBoard();

    expect(loadPrefs().showGrid).toBe(true);
    expect(loadPrefs().showRuleZones).toBe(true);

    // 2026-08-14(설계서 §5-P2): 두 토글은 코트 위 묶음에서 하단 바 [보기▾] 팝오버 안으로
    // 들어갔다. 2026-08-16 에 서랍이 됐고, 2026-08-27 에 [보드 설정] 모달로 들어갔다.
    // **묻는 것은 세 번 다 그대로다** — 이름도 그대로고, 바뀐 것은 여는 문뿐이다.
    await user.click(screen.getByRole('button', { name: '보드 설정' }));

    await user.click(screen.getByRole('button', { name: '격자 표시 전환' }));
    expect(loadPrefs().showGrid).toBe(false);

    await user.click(screen.getByRole('button', { name: '골 지역 가이드 전환' }));
    expect(loadPrefs().showRuleZones).toBe(false);
  });

  // prefs.defaultCourtMode 는 2026-08-21 폐기 — 옛 minor #4 가드(설정 코트로 열린다)도 함께
  // 은퇴한다. 스냅샷이 코트를 기억한다는 사실은 저장/부팅 테스트와 아래 [드릴로 저장]
  // 테스트(openBoard('half') 가 스냅샷으로 하프를 심는다)가 이어서 지킨다.
  it('전술판은 스냅샷이 없으면 풀 코트로 열린다 (폐기 후 고정 기본값)', async () => {
    const { user } = await openBoard();
    await openCourt(user);
    const seg = screen.getByRole('radiogroup', { name: /코트 형태/ });
    expect(within(seg).getByRole('radio', { name: new RegExp('풀') })).toHaveAttribute('aria-checked', 'true');
  });
});

describe('격자 칸 라벨 배선 사슬 (major 회귀: prefs → EditorWorkspace → EditorStage → CourtStage → GridOverlay)', () => {
  // 재감사가 지적한 커버리지 공백을 메운다: GridOverlay 단위 테스트와 SettingsScreen 쓰기
  // 테스트는 있었지만 사슬 중간이 끊겨도 둘 다 통과했다(CourtStage.test 는 false 를 하드코딩).
  // 여기서는 prefs 를 심고 실제 EditorScreen 을 띄워 화면 끝에서 라벨 개수를 센다.
  async function mountWithGridLabels(showGridLabels: boolean) {
    localStorage.setItem(
      PREFS_KEY,
      JSON.stringify({ ...makeDefaultPrefs(), showGrid: true, showGridLabels, tutorialsSeen: { board: true } }),
    );
    const { container } = render(<BoardScreen />, { wrapper: Wrapper });
    await waitFor(() => expect(screen.getByRole('navigation', { name: '도구' })).toBeInTheDocument());
    return container;
  }

  it('prefs.showGridLabels 가 켜져 있으면 풀 코트에 칸 라벨 30개가 렌더된다', async () => {
    const container = await mountWithGridLabels(true);
    const labels = container.querySelectorAll('.grid-cell-label');
    expect(labels.length).toBe(30); // 6열 × 5행
  });

  it('꺼져 있으면 칸 라벨은 0개이되 격자선은 그대로 남는다', async () => {
    const container = await mountWithGridLabels(false);
    expect(container.querySelectorAll('.grid-cell-label').length).toBe(0);
    // 격자선까지 사라지면 토글의 의미가 달라진다 — 라벨만 꺼져야 한다
    expect(container.querySelectorAll('.grid-line').length).toBeGreaterThan(0);
  });
});

describe('키보드 이동 후 물리 동기화 (회귀)', () => {
  it('키보드로 옮긴 개체를 마우스로 잡아도 옛 자리로 되돌아가지 않는다', async () => {
    // 회귀: OBJECT_NUDGE 가 리듀서만 갱신하고 물리 바디는 그대로였다. 그래서 키보드로 옮긴
    // 개체를 잡는 순간 beginDrag 가 world.chairPose() 로 낡은 자세를 읽어와 개체가 튀었다.
    // 키보드 조작은 §7.5 접근성 요건이라 이 경로가 특히 중요하다.
    const { user, stage } = await openBoard('full', { placed: true });
    const toClient = stubStageRect(stage);
    const chair = stage.querySelectorAll('.court-obj')[0] as SVGGElement;
    const holder = chair.closest('g[transform]') as SVGGElement;
    const start = poseOf(holder);

    // 키보드로 오른쪽으로 크게 두 번 민다. 2026-08-16 부터 **기본이 큰 걸음(25px)** 이고
    // Shift 가 정밀(2.5px)이다 — 예전과 반대라 여기서 Shift 를 쓰면 두 번 밀어도 5px 다.
    chair.focus();
    await user.keyboard('{ArrowRight}{ArrowRight}');
    const nudged = poseOf(holder);
    expect(nudged.x).toBeGreaterThan(start.x + 40); // 25 × 2 만큼 이동

    // 이제 밀린 자리를 마우스로 정확히 집었다 놓는다 — 낡은 물리 자세를 읽으면 여기서 start 로 튄다.
    // ⚠️ 포인터 사건은 반드시 무대 안쪽 엘리먼트에 쏜다. CourtStage 는 네 핸들러를 전부
    // <svg role="application"> 의 React prop 으로 달아두므로(§6.4), window 에 디스패치하면
    // 버블링이 무대까지 닿지 않아 잡는 동작이 통째로 일어나지 않는다.
    const grab = toClient(nudged);
    chair.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, ...grab, pointerId: 1 }));
    // 잡기가 진짜로 성립했는지 못을 박는다. 무대에 드래그 커서가 붙는 것이 유일하게 믿을 만한
    // 증거다 — 이건 controller.onPointerDown(=beginDrag)까지 갔어야만 생긴다. (선택 링은
    // 증거가 못 된다: 선택은 개체별 DOM 핸들러가 하므로 드래그가 죽어 있어도 1개가 된다.)
    // 이 단언이 없으면, 잡기 경로가 통째로 죽어도 아래 위치 단언은 키보드 결과를 다시 읽을
    // 뿐이라 초록불이 뜬다 — 실제로 setPointerCapture 예외로 그렇게 죽어 있었다.
    await waitFor(() => expect(stage.getAttribute('style') ?? '').toContain('cursor:'));
    // 오른쪽으로 확실히 끈다. 여기서 개체가 실제로 따라와야 rect 스텁(=유한한 월드 좌표)이
    // 제 일을 한 것이다 — rect 가 0 이면 월드가 NaN 이라 끌어도 제자리에 머문다.
    // ⏱ 물리는 rAF tick 에서만 전진한다(§6.4). 89개 파일을 병렬로 돌리면 jsdom 의 타이머가
    // 굶어 기본 1000ms 안에 몇 틱 못 돈다 — 파일 단독으로는 통과하는데 전체 실행에서만
    // 깨지는 형태가 된다. 넉넉히 준다(테스트 자체 예산 30s).
    const DRAG = 30;
    const SETTLE = { timeout: 10_000 };
    chair.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: grab.clientX + DRAG, clientY: grab.clientY, pointerId: 1 }));
    await waitFor(() => expect(poseOf(holder).x).toBeGreaterThan(nudged.x + DRAG / 2), SETTLE);
    chair.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: grab.clientX + DRAG, clientY: grab.clientY, pointerId: 1 }));
    // 그리고 start 로 튀지 않았다 — 끈 방향(오른쪽)으로 갔지, 옛 자리로 돌아가지 않았다.
    await waitFor(() => expect(poseOf(holder).x).toBeGreaterThan(nudged.x), SETTLE);
  }, 30000);
});

describe('§4.3 P1-1 잡히면 칩이 판에서 뜬다', () => {
  // 지금 "잡혔다" 신호는 마우스 커서와 리시선뿐인데 **터치에는 커서가 없다** — 1순위 대상이
  // 무릎 위 태블릿이므로 그 신호는 손가락 사용자에게 존재하지 않는 것과 같다.
  it('드래그 시작에 chip--held 가 붙고, 끄는 동안 React 리렌더가 0 이며, 놓으면 떨어진다', async () => {
    let renders = 0;
    const { stage } = await openBoard('full', {
      placed: true,
      onRender: () => {
        renders += 1;
      },
    });
    const toClient = stubStageRect(stage);
    const chair = stage.querySelectorAll('.court-obj')[0] as SVGGElement;
    const grab = toClient(poseOf(chair));

    // 잡기 전에는 아무 칩도 떠 있지 않다
    expect(stage.querySelectorAll('.chip--held')).toHaveLength(0);

    chair.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, ...grab, pointerId: 1 }));
    // 잡기가 진짜로 성립했는지 못을 박는다(위 회귀 테스트와 같은 근거 — 무대 드래그 커서).
    await waitFor(() => expect(stage.getAttribute('style') ?? '').toContain('cursor:'));

    expect(chair.classList.contains('chip--held'), '잡은 칩에 chip--held 가 붙어야 한다').toBe(true);
    expect(stage.querySelectorAll('.chip--held'), '잡은 칩 하나에만 붙는다').toHaveLength(1);
    // 배율은 transform 뒤에 곱해 쓴다 — CSS 로 쓰면 표현 속성을 덮어 칩이 원점으로 튄다.
    expect(chair.getAttribute('transform')).toContain('scale(1.06)');

    // ── 여기부터가 §6.1 규칙 1 의 판정: 끄는 동안 React 는 한 번도 렌더하지 않는다.
    // props 로 selection·잡힘을 내리면 이 단언이 곧바로 빨간불이 된다.
    const before = renders;
    // 계수기가 실제로 도는지 먼저 확인한다 — Profiler 배선이 끊기면 "0회" 는 공허한 참이다.
    expect(before, 'Profiler 가 마운트 렌더조차 못 세고 있다').toBeGreaterThan(0);
    act(() => {
      for (let i = 1; i <= 6; i += 1) {
        chair.dispatchEvent(
          new PointerEvent('pointermove', { bubbles: true, clientX: grab.clientX + i * 4, clientY: grab.clientY, pointerId: 1 }),
        );
      }
    });
    expect(renders - before, '드래그 중 React 리렌더가 일어났다').toBe(0);
    expect(chair.classList.contains('chip--held'), '끄는 동안 표시가 유지돼야 한다').toBe(true);
    expect(chair.getAttribute('transform')).toContain('scale(1.06)');

    chair.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: grab.clientX + 24, clientY: grab.clientY, pointerId: 1 }));
    await waitFor(() => expect(chair.classList.contains('chip--held')).toBe(false));
    // 놓은 뒤에는 배율도 함께 떨어진다 — 릴리스 체이스가 매 프레임 다시 써도 그대로다.
    expect(chair.getAttribute('transform')).not.toContain('scale');
  }, 20000);
});

describe('선택 표시와 4개 드래그 존', () => {
  it('선택 전에는 선택 링·존 커서·핸들이 하나도 없다', async () => {
    const { stage } = await openBoard('full', { placed: true });
    expect(stage.querySelectorAll('.sel-ring')).toHaveLength(0);
    expect(stage.querySelectorAll('.court-obj rect.zone-cursor')).toHaveLength(0);
    expect(stage.querySelectorAll('.court-obj rect.zone-tint')).toHaveLength(0);
  });

  it('휠체어를 고르면 선택 링 1개와 차체 두 구역이 그 칩에만 생긴다', async () => {
    // 코트에 9대가 있으므로 "선택된 것에만" 이 지켜지는지가 핵심이다 —
    // 전부에 붙으면 어느 칩이 조작 대상인지 흐려진다.
    const { user, stage } = await openBoard('full', { placed: true });
    // jsdom 은 getBoundingClientRect 가 0 이라 포인터→월드 변환이 성립하지 않는다.
    // 선택 자체는 키보드 경로(§7.5)로 하고, 그 결과 렌더만 본다.
    const chair = stage.querySelectorAll('.court-obj')[0] as SVGGElement;
    chair.focus();
    await user.keyboard('{Enter}');

    expect(stage.querySelectorAll('.sel-ring')).toHaveLength(1);
    // 2026-08-11 재편: 차체는 **둘**로만 나뉜다(뒤 1/2 그대로 이동 · 앞 1/2 제자리 회전).
    // 견인은 차체 밖 가이드 핸들 전용이라 차체 위에 견인 구역이 없다.
    const zoneRects = stage.querySelectorAll('.court-obj rect.zone-cursor');
    expect(zoneRects).toHaveLength(2);
    const cursors = Array.from(zoneRects).map((r) => decodeURIComponent(r.getAttribute('style') ?? ''));
    expect(new Set(cursors).size, '두 구역이 같은 커서를 쓰면 구분이 안 된다').toBe(2);
  });

  it('존 커서 레이어가 차체의 마지막 자식이라 등번호·머리 위에서도 커서가 바뀐다', async () => {
    // 회귀: 예전에는 음영 사각형이 커서까지 맡았는데 그 위에 등번호·머리·포커스 링이 얹혀,
    // 정작 눈이 가는 한가운데에서 커서가 기본 화살표로 돌아갔다. SVG 는 뒤에 온 형제가
    // 위에 그려지므로 커서 레이어는 마지막이어야 한다.
    const { user, stage } = await openBoard('full', { placed: true });
    const chair = stage.querySelectorAll('.court-obj')[0] as SVGGElement;
    chair.focus();
    await user.keyboard('{Enter}');

    const kids = Array.from(chair.children);
    const cursorRects = kids.filter((el) => el.classList.contains('zone-cursor'));
    expect(cursorRects).toHaveLength(2);
    // 커서 레이어 뒤에는 아무것도 없어야 한다
    const lastNonCursor = kids.findLastIndex((el) => !el.classList.contains('zone-cursor'));
    const firstCursor = kids.findIndex((el) => el.classList.contains('zone-cursor'));
    expect(firstCursor, '커서 레이어보다 뒤에 그려지는 요소가 있다').toBeGreaterThan(lastNonCursor);
    // 세로로는 차체 폭 전체를 덮는다
    for (const r of cursorRects) {
      expect(Number(r.getAttribute('height'))).toBeCloseTo(CHAIR.widthPx, 6);
      expect(Number(r.getAttribute('y'))).toBeCloseTo(-CHAIR.widthPx / 2, 6);
    }
    // 가로로는 둘이 합쳐 차체 길이를 빈틈없이 덮는다
    const total = cursorRects.reduce((a, r) => a + Number(r.getAttribute('width')), 0);
    expect(total).toBeCloseTo(CHAIR.lengthPx, 6);
  });

  it('차체 뒤 절반(그대로 이동)이 앞 절반(제자리 회전)보다 진하다', async () => {
    // 기현 지시: "뒤 진하게 흐리게 · 앞 약하게 흐리게". 터치에는 커서가 없으므로
    // 어디를 잡으면 어떻게 되는지 **눈으로** 보이는 것이 태블릿에서는 유일한 단서다.
    const { user, stage } = await openBoard('full', { placed: true });
    const chair = stage.querySelectorAll('.court-obj')[0] as SVGGElement;
    chair.focus();
    await user.keyboard('{Enter}');

    // 음영(zone-tint)과 커서(zone-cursor)는 별개 레이어다 — 커서 레이어가 등번호·머리 위에서도
    // 동작하려면 차체의 마지막 자식이어야 하는데, 그 자리에 색을 칠하면 등번호가 흐려진다.
    const rects = Array.from(stage.querySelectorAll('.court-obj rect.zone-tint'));
    expect(rects).toHaveLength(2);
    const alphaOf = (el: Element): number => Number(/rgba\([^)]*,\s*([\d.]+)\)/.exec(el.getAttribute('fill') ?? '')?.[1] ?? 0);
    const widthOf = (el: Element): number => Number(el.getAttribute('width') ?? 0);
    const xOf = (el: Element): number => Number(el.getAttribute('x') ?? 0);
    // 반반이라 폭으로는 앞뒤를 못 가른다 — 차체 로컬 x 가 작은 쪽이 뒤(그대로 이동)다.
    const [rear, front] = rects.slice().sort((a, b) => xOf(a) - xOf(b));
    expect(widthOf(rear!) / widthOf(front!), '앞뒤가 반반이 아니다').toBeCloseTo(1, 3);
    expect(alphaOf(rear!), '그대로 이동 구역이 더 진해야 한다').toBeGreaterThan(alphaOf(front!));
  });
});

describe('코트 자유 전환 게이트 — "리셋 상태일 때만" (§6.8 재편, 기현 결정)', () => {
  const UNLOCKED = '코트 형태';
  const LOCKED = '코트 형태(변경 불가)';

  /** 판을 편집해 dirty 로 만든다 — 키보드 경로(§7.5)를 쓴다(jsdom 에서 가장 확실하다). */
  async function nudgeSomething(user: ReturnType<typeof userEvent.setup>, stage: HTMLElement) {
    const chair = stage.querySelectorAll('.court-obj')[0] as SVGGElement;
    chair.focus();
    await user.keyboard('{Shift>}{ArrowRight}{/Shift}');
  }

  /** 팝오버가 닫혀 있으면 열고 세그먼트를 돌려준다. 2026-08-14 재설계로 코트 전환이 헤더에서
   *  기능 바의 [코트] **안**으로 들어갔다 — 닫혀 있으면 DOM 에 아예 없다(표적 예산 밖). */
  async function seg(user: ReturnType<typeof userEvent.setup>, name: string) {
    if (!screen.queryByRole('dialog', { name: '보드 설정' })) await openCourt(user);
    return screen.findByRole('radiogroup', { name });
  }
  /** 팝오버를 닫는다 — 고르지 않고 빠져나오는 유일한 길이다. */
  const closeCourt = (user: ReturnType<typeof userEvent.setup>) => user.keyboard('{Escape}');

  it('막 열린 판은 전환이 열려 있다', async () => {
    const { user } = await openBoard('full');
    expect(await seg(user, UNLOCKED)).toBeInTheDocument();
    expect(screen.queryByRole('radiogroup', { name: LOCKED })).toBeNull();
  });

  it('한 번이라도 편집하면 잠긴다', async () => {
    const { user, stage } = await openBoard('full', { placed: true });
    await nudgeSomething(user, stage);
    expect(await seg(user, LOCKED)).toBeInTheDocument();
  });

  it('잠긴 상태에서 눌러도 코트가 바뀌지 않고, 이유를 알려준다', async () => {
    // §6.10 공 도구 제한과 같은 패턴 — 네이티브 disabled 가 아니라 aria-disabled + 토스트라
    // 키보드·스크린리더 사용자도 "왜 안 되는지" 를 들을 수 있어야 한다.
    const { user, stage } = await openBoard('full', { placed: true });
    await nudgeSomething(user, stage);
    const locked = await seg(user, LOCKED);

    await user.click(within(locked).getByRole('radio', { name: new RegExp('하프') }));

    expect(within(await seg(user, LOCKED)).getByRole('radio', { name: new RegExp('풀') })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(await screen.findByText(/초기화하면 코트 형태와 크기를 바꿀 수 있습니다/)).toBeInTheDocument();
  });

  it('코트를 비우면 다시 열린다', async () => {
    const { user, stage } = await openBoard('full', { placed: true });
    await nudgeSomething(user, stage);
    await seg(user, LOCKED);
    await closeCourt(user);

    await user.click(screen.getByRole('button', { name: '코트 비우기' }));
    await user.click(await screen.findByRole('button', { name: '비우기' })); // 확인 다이얼로그

    expect(await seg(user, UNLOCKED)).toBeInTheDocument();
  });

  it('열려 있을 때 누르면 실제로 그 코트로 바뀐다', async () => {
    const { user } = await openBoard('full');
    await user.click(within(await seg(user, UNLOCKED)).getByRole('radio', { name: new RegExp('하프') }));

    await waitFor(async () => {
      expect(within(await seg(user, UNLOCKED)).getByRole('radio', { name: new RegExp('하프') })).toHaveAttribute(
        'aria-checked',
        'true',
      );
    });
  });

  it('연달아 두 번 바꿀 수 있다 (BOARD_SET 이 히스토리를 쌓지 않는다는 계약의 화면 끝 확인)', async () => {
    // DRILL_LOAD 로 구현했다면 첫 전환이 past 에 한 칸 쌓여 두 번째 전환이 잠긴다.
    // 리듀서 단위 테스트가 있지만, 게이트가 화면에서도 열린 채인지는 여기서만 보인다.
    const { user } = await openBoard('full');
    await user.click(within(await seg(user, UNLOCKED)).getByRole('radio', { name: new RegExp('하프') }));
    expect(within(await seg(user, UNLOCKED)).getByRole('radio', { name: new RegExp('하프') })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await closeCourt(user);

    await user.click(within(await seg(user, UNLOCKED)).getByRole('radio', { name: new RegExp('플랫') }));
    expect(within(await seg(user, UNLOCKED)).getByRole('radio', { name: new RegExp('플랫') })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });
});

describe('저장·재로딩을 건너도 코트 전환 게이트가 정확하다 (핵심 회귀)', () => {
  it('개체가 놓인 판을 저장하고 다시 열면 잠겨 있다', async () => {
    // ⚠️ 이 회귀는 옛 구현에서 `past.length === 0` 만으로 판정하면 무너졌다 — 다시 열린 판이
    // 새 "초기 상태" 가 되어 past 가 비므로, dirty 인데도 전환이 열려 배치가 날아갔다.
    // 그때 해법은 pristine 을 스냅샷에 함께 저장하는 것이었다. 2026-08-28 부터는 게이트가
    // **판 위 개체**를 직접 세므로 저장·재로딩과 무관하게 참이다 — 이 테스트가 그 대조군이다.
    const { user, stage, unmount } = await openBoard('full', { placed: true });
    const chair = stage.querySelectorAll('.court-obj')[0] as SVGGElement;
    chair.focus();
    await user.keyboard('{Shift>}{ArrowRight}{/Shift}');

    // 디바운스(500ms) 뒤 스냅샷에 개체가 놓인 판이 적히기를 기다린다.
    await waitFor(
      () => {
        const raw = localStorage.getItem(BOARD_KEY);
        expect(raw).not.toBeNull();
        expect((JSON.parse(raw!) as { drill: Drill }).drill.steps.every(isStepEmpty)).toBe(false);
      },
      { timeout: 5000 },
    );

    // ★ 반드시 완전히 걷어낸다. 남겨두면 아래 단언이 "방금 편집해서 잠긴 첫 번째 판"을
    //   다시 읽을 뿐이라, 스냅샷 판정이 통째로 죽어도 초록불이 뜬다.
    unmount();
    expect(screen.queryByRole('application', { name: '코트 편집 영역' })).toBeNull();

    // ★ 2026-08-14 부터 **언마운트만으로는 새로고침이 아니다** — 세션 캐시가 상태를 들고 있어
    //   다시 render 하면 그쪽이 먼저 읽힌다(BoardScreen 부팅 순서 ①). 안 끊으면 이 테스트가
    //   보려는 스냅샷 경로가 한 줄도 안 돌고 초록불이 된다.
    clearBoardSession();

    // 새로 마운트 = 새로고침 후 다시 방문. prefs 는 그대로, 스냅샷만 살아 있다.
    render(<BoardScreen />, { wrapper: Wrapper });
    await waitFor(() => expect(screen.getByRole('navigation', { name: '도구' })).toBeInTheDocument());
    await userEvent.setup().click(screen.getByRole('button', { name: '보드 설정' }));
    expect(screen.getByRole('radiogroup', { name: '코트 형태(변경 불가)' })).toBeInTheDocument();
    expect(screen.queryByRole('radiogroup', { name: '코트 형태' })).toBeNull();
  }, 20000);

  it('디바운스가 터지기 전에 화면을 떠나도 마지막 편집이 남는다 (언마운트 플러시)', async () => {
    // 2026-08-14 레일 [보드] 분리로 판↔드릴 왕복이 일상 조작이 되면서 열린 창이다. 저장
    // 이펙트의 정리 함수는 타이머를 **저장 없이** 걷으므로, 마지막 편집 뒤 500ms 안에 떠나면
    // 그 편집이 조용히 사라진다. 드릴 자동저장에는 처음부터 있던 이펙트가 전술판에만 없었다.
    const { user, stage, unmount } = await openBoard('full', { placed: true });
    await waitFor(() => expect(localStorage.getItem(BOARD_KEY)).not.toBeNull(), { timeout: 5000 });
    const before = localStorage.getItem(BOARD_KEY)!;

    const chair = stage.querySelectorAll('.court-obj')[0] as SVGGElement;
    chair.focus();
    await user.keyboard('{Shift>}{ArrowRight}{/Shift}');

    // ★ 기다리지 않는다. 기다리면 디바운스가 제 힘으로 터져 이 테스트가 아무것도 안 본다.
    unmount();

    const after = localStorage.getItem(BOARD_KEY)!;
    expect(after).not.toEqual(before);
    expect((JSON.parse(after) as { drill: Drill }).drill.steps.every(isStepEmpty)).toBe(false);
  }, 20000);

  it('빈 판으로 저장된 판을 다시 열면 여전히 열려 있다 (게이트가 무조건 잠그는 것은 아니다)', async () => {
    const { unmount } = await openBoard('full');
    await waitFor(
      () => {
        const raw = localStorage.getItem(BOARD_KEY);
        expect(raw).not.toBeNull();
        expect((JSON.parse(raw!) as { drill: Drill }).drill.steps.every(isStepEmpty)).toBe(true);
      },
      { timeout: 5000 },
    );
    unmount();
    clearBoardSession(); // 위와 같은 이유 — 새로고침을 흉내내려면 세션을 끊어야 한다

    render(<BoardScreen />, { wrapper: Wrapper });
    await waitFor(() => expect(screen.getByRole('navigation', { name: '도구' })).toBeInTheDocument());
    await userEvent.setup().click(screen.getByRole('button', { name: '보드 설정' }));
    expect(screen.getByRole('radiogroup', { name: '코트 형태' })).toBeInTheDocument();
  }, 20000);
});

// ── 판을 떠났다 돌아오면 같은 판이다 (2026-08-14 기현님 지시) ────────────────────────────
// *"보드는 누를 때마다 새 화면이 아니라 항상 상태나 배치를 저장하고 불러와야 한다."*
// 배치는 원래도 돌아왔다(위 describe). 안 돌아오던 것은 이력·선택·도구다 — 되돌리기가 죽은
// 채로 열리니 배치가 같아도 **다른 판을 새로 연 것처럼** 읽혔다.
describe('세션 왕복 — 떠났다 오면 새 판이 아니다', () => {
  it('되돌리기 이력이 이어진다 — 돌아와서 곧바로 되돌릴 수 있다', async () => {
    const { user, stage, unmount } = await openBoard('full', { placed: true });
    const chair = stage.querySelectorAll('.court-obj')[0] as SVGGElement;
    const before = poseOf(chair);
    chair.focus();
    await user.keyboard('{Shift>}{ArrowRight}{/Shift}');
    const moved = poseOf(stage.querySelectorAll('.court-obj')[0]!);
    expect(moved.x).not.toBe(before.x);

    // 판을 떠난다(= 레일 [드릴]·[설정]). 캐시는 언마운트 정리에서 채워진다.
    unmount();
    render(<BoardScreen />, { wrapper: Wrapper });
    await waitFor(() => expect(screen.getByRole('navigation', { name: '도구' })).toBeInTheDocument());

    // ① 배치가 그대로다
    const back = screen.getByRole('application', { name: '코트 편집 영역' });
    expect(poseOf(back.querySelectorAll('.court-obj')[0]!).x).toBe(moved.x);
    // ② 그리고 되돌리기가 **살아 있다** — 이것이 이 커밋 전에는 죽어 있던 자리다.
    const undo = screen.getByRole('button', { name: '되돌리기' });
    expect(undo).toBeEnabled();
    await user.click(undo);
    await waitFor(() =>
      expect(poseOf(screen.getByRole('application', { name: '코트 편집 영역' }).querySelectorAll('.court-obj')[0]!).x).toBe(before.x),
    );
  }, 20000);

  it('코트 전환 게이트의 기준선도 이어진다 — 편집한 판은 돌아와도 잠겨 있다', async () => {
    // 파생값(pristine)이 아니라 기준선(pristineBase)을 실어야 하는 이유의 화면 끝 확인.
    const { user, stage, unmount } = await openBoard('full', { placed: true });
    (stage.querySelectorAll('.court-obj')[0] as SVGGElement).focus();
    await user.keyboard('{Shift>}{ArrowRight}{/Shift}');

    unmount();
    render(<BoardScreen />, { wrapper: Wrapper });
    await waitFor(() => expect(screen.getByRole('navigation', { name: '도구' })).toBeInTheDocument());
    await userEvent.setup().click(screen.getByRole('button', { name: '보드 설정' }));
    expect(screen.getByRole('radiogroup', { name: '코트 형태(변경 불가)' })).toBeInTheDocument();
  }, 20000);
});

describe('[드릴로 저장] — 전술판을 정식 드릴로 승격', () => {
  it('저장소에 드릴이 생기고, 전술판은 그대로 남는다', async () => {
    const { repo } = await resolveDrillRepo();
    const before = await repo.countDrills();

    const { user } = await openBoard('half');
    // 2026-08-28 — [저장]은 곧바로 저장하지 않는다. 이름을 묻고, 판의 제목이 실려 있다.
    await user.click(screen.getByRole('button', { name: '드릴로 저장' }));
    expect(screen.getByLabelText('드릴 이름')).toHaveValue('자유 전술판');
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '저장' }));

    await waitFor(async () => {
      expect(await repo.countDrills()).toBe(before + 1);
      const all = await repo.listDrillSummaries();
      const mine = all.find((d) => d.courtMode === 'half');
      expect(mine).toBeDefined();
      expect(mine!.title).toBe('자유 전술판');
    });

    // 승격은 복사다 — 판이 사라지면 "방금 그리던 것" 을 잃은 것처럼 보인다.
    expect(screen.getByRole('application', { name: '코트 편집 영역' })).toBeInTheDocument();
    expect(await screen.findByText(/드릴로 저장했습니다/)).toBeInTheDocument();
  }, 20000);

  it('저장 직후 목록 데이터가 갱신된다 (새로고침 없이 보여야 한다)', async () => {
    // ⚠️ LibraryProvider 는 앱 최상단에서 한 번만 로드한다. refresh() 를 빼면 IDB 에는
    // 저장됐는데 목록·대문 통계에는 새로고침 전까지 안 떠서, 사용자에겐 "저장이 안 된 것"
    // 으로 보인다 — 브라우저에서 실제로 그렇게 보였다.
    const { repo } = await resolveDrillRepo();
    const { user } = await openBoard('full');
    await user.click(screen.getByRole('button', { name: '드릴로 저장' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '저장' }));
    await screen.findByText(/드릴로 저장했습니다/);

    // 화면이 들고 있는 목록이 저장소와 **같아야** 한다. refresh() 를 빼면 화면 쪽이 저장 전
    // 개수에 머물러 여기서 벌어진다. (절대 개수로 쓰면 fake-indexeddb 가 앞선 테스트의
    // 드릴을 들고 있어 매번 어긋난다.)
    await waitFor(async () => {
      const inStorage = await repo.countDrills();
      expect(inStorage).toBeGreaterThan(0);
      expect(Number(screen.getByTestId('library-drill-count').textContent)).toBe(inStorage);
    });
  }, 20000);

  it('다이얼로그에서 고친 이름으로 저장되고, 곧장 그 드릴의 편집기로 넘어간다', async () => {
    const goes: unknown[][] = [];
    const { repo } = await resolveDrillRepo();
    const { user } = await openBoard('full', { onGo: (...args) => goes.push(args) });

    await user.click(screen.getByRole('button', { name: '드릴로 저장' }));
    const dialog = screen.getByRole('dialog');
    await user.clear(within(dialog).getByLabelText('드릴 이름'));
    await user.type(within(dialog).getByLabelText('드릴 이름'), '2-4 골킥');
    await user.click(within(dialog).getByRole('button', { name: '저장' }));

    await screen.findByText(/드릴로 저장했습니다/);
    const saved = (await repo.listDrillSummaries()).find((d) => d.title === '2-4 골킥');
    expect(saved).toBeDefined();
    // 목록을 거치지 않는다 — 만들어진 그 드릴을 board 자리에 연다.
    expect(goes).toContainEqual(['board', { kind: 'drill', id: saved!.id }]);
    // 저장에 성공했으므로 모달은 닫힌다.
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  }, 20000);

  it('[취소] 하면 아무것도 저장되지 않는다', async () => {
    const { repo } = await resolveDrillRepo();
    const before = await repo.countDrills();
    const { user } = await openBoard('full');

    await user.click(screen.getByRole('button', { name: '드릴로 저장' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '취소' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(await repo.countDrills()).toBe(before);
  }, 20000);
});

describe('태블릿 세로 레이아웃 (§6.4)', () => {
  /** jsdom 에는 matchMedia 가 없다. 스텁을 안 깔면 useIsPortrait 이 항상 false 를 돌려주고
   *  세로 경로는 **한 줄도 실행되지 않은 채** 스위트가 초록불이 된다. */
  function stubOrientation(portrait: boolean) {
    const listeners = new Set<() => void>();
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: (q: string) => ({
        matches: q.includes('portrait') ? portrait : !portrait,
        media: q,
        addEventListener: (_: string, fn: () => void) => listeners.add(fn),
        removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
        addListener: (fn: () => void) => listeners.add(fn),
        removeListener: (fn: () => void) => listeners.delete(fn),
        dispatchEvent: () => true,
      }),
    });
  }

  // 스텁이 다른 describe 로 새면(파일 순서가 바뀌면) 엉뚱한 테스트가 세로로 돌아간다.
  afterEach(() => {
    delete (window as unknown as { matchMedia?: unknown }).matchMedia;
  });

  // ⚠️ 2026-08-14 기현님 재설계로 이 describe 의 전제가 **또** 뒤집혔다.
  // 옛 기록(지우지 않는다): 2026-08-12 결정 ③A 로 "가로에서도 속성은 자리를 차지하지 않는다.
  // 방향이 가르는 것은 어느 변에서 시트가 올라오는가 뿐이다" 였다.
  // 지금은 **자유 전술판에 속성이 아예 없다**(기현님: *"속성 탭은 정말 무용지물"*). 방향이
  // 가르는 것은 이제 **트레이가 판의 어느 변에 붙는가** 다 — 코트 긴 변이므로 가로 창이면
  // 아래 띠, 세로 창이면 오른쪽 기둥이다. 기능 바는 방향과 무관하게 언제나 오른쪽이다.
  it('가로 창 — 코트가 눕고 트레이가 판 **아래 띠**가 된다', async () => {
    stubOrientation(false);
    await openBoard('full');
    const board = document.querySelector<HTMLElement>('[data-board]')!;
    expect(board.style.flexDirection, '가로 코트의 긴 변은 아래다').toBe('column');
    const tray = document.querySelector<HTMLElement>('nav[data-tray]')!;
    expect(tray.style.flexDirection).toBe('row');
  });

  it('세로 창 — 코트가 서고 트레이가 판 **오른쪽 기둥**이 된다 (반대 방향 대조군)', async () => {
    stubOrientation(true);
    await openBoard('full');
    const board = document.querySelector<HTMLElement>('[data-board]')!;
    expect(board.style.flexDirection, '세로 코트의 긴 변은 오른쪽이다').toBe('row');
    const tray = document.querySelector<HTMLElement>('nav[data-tray]')!;
    expect(tray.style.flexDirection).toBe('column');
  });

  it('기능 바는 두 방향 모두 **오른쪽**이다 — 판이 돌아도 앱 조작은 자리를 안 옮긴다', async () => {
    for (const portrait of [false, true]) {
      stubOrientation(portrait);
      const { unmount } = await openBoard('full');
      const main = document.getElementById('main')!;
      expect(main.style.flexDirection, `portrait=${portrait}`).toBe('row');
      const kids = [...main.children] as HTMLElement[];
      const bar = document.querySelector<HTMLElement>('nav[data-function-bar]')!;
      // main 의 **마지막** 흐름 자식이라야 오른쪽에 선다.
      const inflow = kids.filter((c) => c.style.position !== 'absolute' && c.tagName !== 'SPAN');
      expect(inflow[inflow.length - 1], `portrait=${portrait}`).toBe(bar);
      unmount();
    }
  });

  it('전술판에는 속성이 **없다** — 인스펙터도 그 손잡이도 DOM 에 아예 없다', async () => {
    stubOrientation(false);
    await openBoard('full');
    expect(screen.queryByRole('complementary', { name: '드릴 속성' })).toBeNull();
    expect(screen.queryByRole('button', { name: '속성' })).toBeNull();
  });
});

describe('전술판은 빈 코트로 시작한다 (2026-08-10 기현 지시)', () => {
  it('처음 열면 코트에 개체가 하나도 없다', () => {
    // "전술판에서 기본 배치는 의미가 없다" — 무엇을 그릴지 모르는 판에 8대가 깔려 있으면
    // 매번 치우는 일부터 해야 한다.
    localStorage.setItem(
      PREFS_KEY,
      JSON.stringify({ ...makeDefaultPrefs(), tutorialsSeen: { board: true } }),
    );
    render(<BoardScreen />, { wrapper: Wrapper });
    const stage = screen.getByRole('application', { name: '코트 편집 영역' });
    expect(stage.querySelectorAll('.court-obj')).toHaveLength(0);
  });

  it('선수는 명단에 남아 있어 하나씩 놓을 수 있다', async () => {
    // 비었다고 선수까지 없어지면 안 된다 — 8대가 인스펙터 명단에 '미배치' 로 있어야 한다.
    localStorage.setItem(
      PREFS_KEY,
      JSON.stringify({ ...makeDefaultPrefs(), tutorialsSeen: { board: true } }),
    );
    const user = userEvent.setup();
    render(<BoardScreen />, { wrapper: Wrapper });
    await waitFor(() => expect(screen.getByRole('navigation', { name: '도구' })).toBeInTheDocument());
    await openCourt(user);
    // 2026-08-14 — 선수 명단(인스펙터)이 없어졌다. 미배치 선수는 **트레이 칩**으로 남는다.
    expect(screen.getAllByRole('button', { name: /선수 배치$/ }).length).toBe(8);
  });

});

// 2026-08-28 — 옛 제목은 *"되돌릴 수 없으므로 반드시 확인을 받는다"* 였다. 되돌리기가 생긴
// 지금도 확인은 남긴다: 한 번에 여덟 대를 걷어내는 조작이라 확인 자체의 값은 그대로다.
describe('코트 비우기 — 덩어리가 크므로 확인을 받고, 되돌릴 수 있다', () => {
  async function openAndClickClear() {
    const r = await openBoard('full', { placed: true });
    await r.user.click(screen.getByRole('button', { name: '코트 비우기' }));
    return r;
  }

  const objs = () => screen.getByRole('application', { name: '코트 편집 영역' }).querySelectorAll('.court-obj').length;

  it('버튼만 눌러서는 지워지지 않는다 — 확인 다이얼로그가 뜬다', async () => {
    const before = (await openBoard('full', { placed: true })) && objs();
    expect(before).toBeGreaterThan(0);
    await userEvent.setup().click(screen.getByRole('button', { name: '코트 비우기' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(objs()).toBe(before); // 아직 그대로다
  });

  it('취소하면 아무것도 사라지지 않는다', async () => {
    const { user } = await openAndClickClear();
    const before = objs();
    await user.click(screen.getByRole('button', { name: '취소' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(objs()).toBe(before);
  });

  it('비우기를 누르면 코트가 빈다', async () => {
    const { user } = await openAndClickClear();
    expect(objs()).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: '비우기' }));
    await waitFor(() => expect(objs()).toBe(0));
  });

  it('비운 뒤에도 선수는 명단에 남는다 — 다시 놓을 수 있어야 한다', async () => {
    const { user } = await openAndClickClear();
    await user.click(screen.getByRole('button', { name: '비우기' }));
    await openCourt(user);
    await waitFor(() => expect(screen.getAllByRole('button', { name: /선수 배치$/ }).length).toBe(8));
  });

  it('비우면 코트 전환 잠금이 풀린다', async () => {
    const { user } = await openAndClickClear();
    await user.click(screen.getByRole('button', { name: '비우기' }));
    await user.click(screen.getByRole('button', { name: '보드 설정' }));
    expect(await screen.findByRole('radiogroup', { name: '코트 형태' })).toBeInTheDocument();
  });

  // ★ 2026-08-28 기현님 지적: *"비우기가 왜 되돌리기를 안 되게 했어? 기술적으로 안 되는 거야?"*
  //   — 아니었다. 게이트가 `past.length === 0` 를 "판이 비었다" 의 대용으로 쓰는 바람에
  //   비우기가 히스토리를 **비우는** 액션(BOARD_SET)으로 갈 수밖에 없었던 것뿐이다.
  it('비운 것을 되돌리면 개체가 그대로 돌아온다', async () => {
    const { user } = await openAndClickClear();
    const before = objs();
    expect(before).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: '비우기' }));
    await waitFor(() => expect(objs()).toBe(0));

    await user.click(screen.getByRole('button', { name: '되돌리기' }));
    await waitFor(() => expect(objs()).toBe(before));
  });

  // 되돌린 뒤에는 판에 잃을 것이 다시 생겼다 — 게이트도 따라 닫혀야 앞뒤가 맞는다.
  it('되돌리면 코트 전환이 다시 잠긴다 — 게이트가 판을 따라간다', async () => {
    const { user } = await openAndClickClear();
    await user.click(screen.getByRole('button', { name: '비우기' }));
    await waitFor(() => expect(objs()).toBe(0));
    await user.click(screen.getByRole('button', { name: '되돌리기' }));
    await waitFor(() => expect(objs()).toBeGreaterThan(0));

    await user.click(screen.getByRole('button', { name: '보드 설정' }));
    expect(await screen.findByRole('radiogroup', { name: '코트 형태(변경 불가)' })).toBeInTheDocument();
  });
});

describe('개체의 키보드 조작 — 2026-08-16 전면 개편', () => {
  // 화살표는 전술 드릴에서 '누가 **어디로**'의 본체인데, 키보드 경로가 없던 시절에는 유일한
  // 조작 수단이 12px 이상 드래그 + 반경 22 CSS px 핸들 3개의 정밀 드래그였다. 정밀 포인팅을
  // 전제하는 조작은 그것이 어려운 사용자에게 **없는 기능**과 같다. 화면 끝(실제 BoardScreen)
  // 에서 확인한다.
  const FROM = { x: 100, y: 100 };
  const CTRL = { x: 150, y: 80 };
  const TO = { x: 200, y: 100 };

  /** 화살표 하나를 심은 전술판을 연다. */
  async function openWithArrow() {
    const id = newId('ar');
    const drill = setArrow(createDrill({ courtMode: 'full', formation: '1-2-1' }), 0, {
      id,
      from: { ...FROM },
      ctrl: { ...CTRL },
      to: { ...TO },
    });
    saveBoard(drill);
    const opened = await openBoard('full');
    const el = opened.stage.querySelector(`#obj-${id}`) as SVGGElement | null;
    expect(el).not.toBeNull(); // 심은 화살표가 실제로 그려졌다 — 아래 단언들의 전제
    return { ...opened, arrow: el! };
  }

  /** 그려진 `d`("M… Q… …")를 세 점으로 되읽는다. 모델이 아니라 **화면**을 읽는 것이 요점이다. */
  function pointsOf(el: Element): { from: { x: number; y: number }; ctrl: { x: number; y: number }; to: { x: number; y: number } } {
    const d = el.querySelector('path')?.getAttribute('d') ?? '';
    const m = /^M(-?[\d.]+),(-?[\d.]+) Q(-?[\d.]+),(-?[\d.]+) (-?[\d.]+),(-?[\d.]+)$/.exec(d);
    if (!m) throw new Error(`화살표 경로를 읽지 못했다: ${d}`);
    const n = m.slice(1).map(Number) as [number, number, number, number, number, number];
    return { from: { x: n[0], y: n[1] }, ctrl: { x: n[2], y: n[3] }, to: { x: n[4], y: n[5] } };
  }

  it('방향키로 화살표 전체가 25px 움직인다 (모양은 그대로)', async () => {
    const { user, arrow } = await openWithArrow();
    expect(pointsOf(arrow)).toEqual({ from: FROM, ctrl: CTRL, to: TO });

    arrow.focus();
    await user.keyboard('{ArrowRight}');
    await waitFor(() => expect(pointsOf(arrow).from.x).toBe(FROM.x + 25));
    const p = pointsOf(arrow);
    expect(p.ctrl.x).toBe(CTRL.x + 25);
    expect(p.to.x).toBe(TO.x + 25);
    expect([p.from.y, p.ctrl.y, p.to.y]).toEqual([FROM.y, CTRL.y, TO.y]); // 세로는 안 움직였다
  });

  it('W A S D 가 방향키와 **같은 일**을 한다', async () => {
    // 개편의 뼈대. 이 여섯 자리를 개체에 내주었기 때문에 도구가 V L O T R B C P N 으로 밀렸다.
    const { user, arrow } = await openWithArrow();
    arrow.focus();
    await user.keyboard('d');
    await waitFor(() => expect(pointsOf(arrow).from.x).toBe(FROM.x + 25));
    await user.keyboard('s');
    await waitFor(() => expect(pointsOf(arrow).from.y).toBe(FROM.y + 25));
    await user.keyboard('a');
    await waitFor(() => expect(pointsOf(arrow).from.x).toBe(FROM.x));
    await user.keyboard('w');
    await waitFor(() => expect(pointsOf(arrow).from.y).toBe(FROM.y));
  });

  it('Shift 는 **정밀**이다 — 개체 종류와 무관하게 2.5px', async () => {
    // 개편 전에는 Shift 가 개체마다 다른 뜻이었다: 보통은 '25px 큰 걸음', 화살표에서만
    // '조준점 하나만 옮기기'. 같은 수식키가 개체 종류마다 다른 일을 하면 손이 배울 것이
    // 개체 수만큼 늘어난다. 이제 어디서나 "정밀" 하나다.
    const { user, arrow } = await openWithArrow();
    arrow.focus();
    await user.keyboard('{Shift>}{ArrowRight}{ArrowRight}{/Shift}');
    await waitFor(() => expect(pointsOf(arrow).to.x).toBe(TO.x + 5));
    const p = pointsOf(arrow);
    // **전체가** 움직인다 — 끝점만 옮기던 옛 동작이 아니다.
    expect(p.from.x).toBe(FROM.x + 5);
    expect(p.ctrl.x).toBe(CTRL.x + 5);
  });

  it('휠체어도 같은 규칙이다 — 기본 큰 걸음, Shift 가 정밀 (대조군)', async () => {
    const { user, stage } = await openWithArrow();
    const chair = stage.querySelector('g[id^="obj-ch_"]') as SVGGElement;
    const holder = chair.closest('g[transform]') as SVGGElement;
    const start = poseOf(holder);
    chair.focus();
    await user.keyboard('{ArrowRight}');
    await waitFor(() => expect(poseOf(holder).x).toBeGreaterThan(start.x + 20));
  });

  it('[ / ] 는 개체 순회다 — 조준점 전환이 아니다', async () => {
    // 조준점(끝점·시작점·굽힘점) 개념이 사라지면서 이 두 키가 통째로 비었고, 개체 순회가
    // Alt+←/→ 에서 여기로 옮겨 왔다(Alt 는 보기 토글 전용 채널이 됐다).
    const { user, arrow, stage } = await openWithArrow();
    arrow.focus();
    expect(document.activeElement).toBe(arrow);

    await user.keyboard(']');
    // 포커스가 **다른 개체**로 옮겨 갔다. 어느 개체인지는 그리기 순서에 달렸으므로 묻지 않고,
    // "화살표를 떠나 코트 위 다른 개체로 갔다" 만 못박는다.
    await waitFor(() => expect(document.activeElement).not.toBe(arrow));
    expect((document.activeElement as Element).id.startsWith('obj-')).toBe(true);
    expect(stage.contains(document.activeElement)).toBe(true);

    // 그리고 화살표는 한 톨도 안 움직였다 — 옛 조준점 전환은 좌표를 안 건드렸지만,
    // 순회로 바뀐 지금은 "이동으로 새는" 회귀가 새로 가능해졌다.
    expect(pointsOf(arrow)).toEqual({ from: FROM, ctrl: CTRL, to: TO });
  });
});

// §4.4 P2-1 — Ctrl/Cmd + 방향키는 **판의 것**이다. 방향키를 먼저 먹는 두 층(개체 이동 ·
// 배치 커서)이 전부 stopPropagation 을 걸어 전역(document)까지 못 가게 하므로, 그 두 층이
// 수식키를 흘려보내지 않으면 "개체를 고르거나 공 도구를 든 순간 판을 밀 수 없는" 상태가
// 된다. 전역 층의 판정 자체는 useEditorKeyboard.test.tsx 가 따로 잰다 — 여기서 재는 것은
// **키가 거기까지 도달하는가** 다.
describe('Ctrl+방향키는 개체·배치 커서를 지나 전역까지 간다 (§4.4 P2-1)', () => {
  /** document 까지 올라온 keydown 을 받아 적는다. 중간에서 stopPropagation 이 걸리면 비어 있다. */
  function watchDocument(): { keys: string[]; stop(): void } {
    const keys: string[] = [];
    const on = (e: Event): void => void keys.push((e as KeyboardEvent).key);
    document.addEventListener('keydown', on);
    return { keys, stop: () => document.removeEventListener('keydown', on) };
  }

  const FROM = { x: 100, y: 100 };
  const CTRL = { x: 150, y: 80 };
  const TO = { x: 200, y: 100 };

  function arrowPoints(el: Element): { x: number; y: number } {
    const d = el.querySelector('path')?.getAttribute('d') ?? '';
    const m = /^M(-?[\d.]+),(-?[\d.]+)/.exec(d);
    return { x: Number(m?.[1] ?? NaN), y: Number(m?.[2] ?? NaN) };
  }

  it('개체에 포커스가 있어도 화살표는 꿈쩍 않고 키는 전역까지 간다', async () => {
    // 화살표를 쓰는 이유: 물리 바디가 없어 좌표가 리듀서 산출물 그대로다(정착으로 흔들리지 않는다).
    const id = newId('ar');
    saveBoard(setArrow(createDrill({ courtMode: 'full', formation: '1-2-1' }), 0, { id, from: { ...FROM }, ctrl: { ...CTRL }, to: { ...TO } }));
    const { user, stage } = await openBoard('full');
    const arrow = stage.querySelector(`#obj-${id}`) as SVGGElement;
    expect(arrow).not.toBeNull();

    const w = watchDocument();
    try {
      arrow.focus();
      await user.keyboard('{Control>}{ArrowRight}{/Control}');
      expect(arrowPoints(arrow)).toEqual(FROM); // 개체는 한 톨도 안 움직였다
      expect(w.keys).toContain('ArrowRight'); // 그리고 전역까지 갔다

      // 대조군 — 수식키가 없으면 개체가 먹고(기본 걸음 25px) 전역까지 **가지 않는다**.
      // 이 짝이 없으면 위 단언이 '리스너가 아예 안 걸렸다' 로도 통과한다.
      w.keys.length = 0;
      await user.keyboard('{ArrowRight}');
      await waitFor(() => expect(arrowPoints(arrow).x).toBe(FROM.x + 25));
      expect(w.keys).toEqual([]);
    } finally {
      w.stop();
    }
  });

  it('배치 도구 + 코트 포커스에서도 배치 커서가 아니라 판의 것이다 (§7.5d 와 충돌하지 않는다)', async () => {
    const { user, stage } = await openBoard('full', { placed: true });
    const toolRail = screen.getByRole('navigation', { name: '도구' });
    await user.click(within(toolRail).getByRole('button', { name: '공' }));
    stage.focus();
    const live = document.querySelector('[aria-live="polite"]');

    const w = watchDocument();
    try {
      await user.keyboard('{Control>}{ArrowRight}{/Control}');
      expect(live?.textContent ?? '').not.toContain('칸'); // 커서는 뜨지 않았다
      expect(w.keys).toContain('ArrowRight');

      // 대조군 — 수식키 없는 방향키는 여전히 배치 커서 몫이고 전역까지 가지 않는다(§7.5d).
      w.keys.length = 0;
      await user.keyboard('{ArrowRight}');
      await waitFor(() => expect(live?.textContent ?? '').toContain('칸'));
      expect(w.keys).toEqual([]);
    } finally {
      w.stop();
    }
  });
});
