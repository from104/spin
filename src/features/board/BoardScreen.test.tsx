// §10.8 화면 스모크 — 자유 전술판(대문)이 뜨고, 도구·코트·속성 3영역과 드래그 존·물리가
// 드릴 편집과 **같은 컴포넌트**(EditorWorkspace)로 동작하는지 실제 경로로 확인한다.
//
// 2026-08-09 재편 전에는 이 파일이 EditorScreen(CourtPicker → 드릴 생성)을 마운트했다. 지금은
// 새 드릴이 전술판에서 태어나므로 코트 고르기 단계가 없다 — 전술판의 시작 코트는
// `prefs.defaultCourtMode` 다(옛 minor #4 가드의 후신).
//
// 헤더까지 함께 렌더한다: 코트 전환 세그먼트가 헤더에 있어서, "리셋 상태에서만 전환"
// 게이트를 화면 끝에서 확인하려면 AppHeader 가 트리에 있어야 한다.
import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
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
import { BOARD_KEY } from '../../storage/board.ts';
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

function Wrapper({ children }: { children: ReactNode }) {
  const nav: AppHistoryApi = { screen: 'home', go: () => {}, back: () => {} };
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

/** 전술판을 지정한 코트로 연다. 코트는 prefs 로 정해지므로 render 전에 심는다. */
async function openBoard(court: 'full' | 'half' | 'flat' = 'full') {
  localStorage.setItem(PREFS_KEY, JSON.stringify({ ...makeDefaultPrefs(), defaultCourtMode: court }));
  const user = userEvent.setup();
  const { unmount } = render(<BoardScreen />, { wrapper: Wrapper });
  await waitFor(() => expect(screen.getByRole('navigation', { name: '도구' })).toBeInTheDocument());
  return { user, unmount, stage: screen.getByRole('application', { name: '코트 편집 영역' }) };
}

beforeEach(() => {
  localStorage.clear(); // prefs + 전술판 스냅샷(BOARD_KEY) 둘 다 비운다
});

describe('자유 전술판 (대문)', () => {
  it('코트 고르기 단계 없이 도구·코트·속성 3영역이 바로 뜬다', async () => {
    // 재편의 핵심 요구 — 대문에 판이 "상시 떠 있다". 진입 장벽(CourtPicker)이 없어야 한다.
    const { stage } = await openBoard();
    expect(stage).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: '드릴 속성' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^선택/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('heading', { name: '어떤 코트로 진행하십니까?' })).toBeNull();
  });

  it('전술판은 1장짜리다 — 스텝 UI 가 없다', async () => {
    // 하단 트랜스포트만 감추고 인스펙터의 스텝 섹션을 놔두면 화면에 없는 2번째 스텝을
    // 만들 수 있다(눈으로는 알 수 없다). 둘 다 없어야 한다.
    await openBoard();
    expect(screen.queryByRole('button', { name: '스텝 추가' })).toBeNull();
    expect(screen.queryByText(/^스텝 1 ·/)).toBeNull();
  });

  it('편집기 격자·규칙존 토글이 prefs 에 반영된다(다른 화면 갔다 와도 유지, minor #6)', async () => {
    const { user } = await openBoard();

    expect(loadPrefs().showGrid).toBe(true);
    expect(loadPrefs().showRuleZones).toBe(true);

    await user.click(screen.getByRole('button', { name: '격자 표시 전환' }));
    expect(loadPrefs().showGrid).toBe(false);

    await user.click(screen.getByRole('button', { name: '골 지역 가이드 전환' }));
    expect(loadPrefs().showRuleZones).toBe(false);
  });

  // 감사 2026-08-08 minor #4 회귀 — prefs.defaultCourtMode 가 완전히 죽은 필드였다. 이제
  // CourtPicker 가 그 값을 "기본값" 배지로 강조한다(§6.8 "1회 선택" 원칙은 유지 — 클릭은 여전히
  // 필요하다).
  it('전술판은 prefs.defaultCourtMode 코트로 열린다 (옛 minor #4 의 후신)', async () => {
    // CourtPicker 가 은퇴하면서 defaultCourtMode 의 유일한 소비처가 전술판이 됐다. 이 가드가
    // 없으면 그 설정은 다시 아무도 읽지 않는 죽은 필드가 된다(감사에서 실제로 그랬다).
    await openBoard('half');
    const seg = screen.getByRole('radiogroup', { name: /코트 형태/ });
    expect(within(seg).getByRole('radio', { name: /하프/ })).toHaveAttribute('aria-checked', 'true');
  });
});

describe('격자 칸 라벨 배선 사슬 (major 회귀: prefs → EditorWorkspace → EditorStage → CourtStage → GridOverlay)', () => {
  // 재감사가 지적한 커버리지 공백을 메운다: GridOverlay 단위 테스트와 SettingsScreen 쓰기
  // 테스트는 있었지만 사슬 중간이 끊겨도 둘 다 통과했다(CourtStage.test 는 false 를 하드코딩).
  // 여기서는 prefs 를 심고 실제 EditorScreen 을 띄워 화면 끝에서 라벨 개수를 센다.
  async function mountWithGridLabels(showGridLabels: boolean) {
    localStorage.setItem(
      PREFS_KEY,
      JSON.stringify({ ...makeDefaultPrefs(), defaultCourtMode: 'full', showGrid: true, showGridLabels }),
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

  it('키보드로 옮긴 개체를 마우스로 잡아도 옛 자리로 되돌아가지 않는다', async () => {
    // 회귀: OBJECT_NUDGE 가 리듀서만 갱신하고 물리 바디는 그대로였다. 그래서 키보드로 옮긴
    // 개체를 잡는 순간 beginDrag 가 world.chairPose() 로 낡은 자세를 읽어와 개체가 튀었다.
    // 키보드 조작은 §7.5 접근성 요건이라 이 경로가 특히 중요하다.
    const { user, stage } = await openBoard();
    const toClient = stubStageRect(stage);
    const chair = stage.querySelectorAll('.court-obj')[0] as SVGGElement;
    const holder = chair.closest('g[transform]') as SVGGElement;
    const start = poseOf(holder);

    // 키보드로 오른쪽으로 크게(Shift = 25px) 두 번 민다
    chair.focus();
    await user.keyboard('{Shift>}{ArrowRight}{ArrowRight}{/Shift}');
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

describe('선택 표시와 4개 드래그 존', () => {
  it('선택 전에는 선택 링·존 커서·핸들이 하나도 없다', async () => {
    const { stage } = await openBoard();
    expect(stage.querySelectorAll('.sel-ring')).toHaveLength(0);
    expect(stage.querySelectorAll('.court-obj rect[style*="cursor"]')).toHaveLength(0);
  });

  it('휠체어를 고르면 선택 링 1개와 존 커서 4개(=4존)가 그 칩에만 생긴다', async () => {
    // 코트에 9대가 있으므로 "선택된 것에만" 이 지켜지는지가 핵심이다 —
    // 전부에 붙으면 어느 칩이 조작 대상인지 흐려진다.
    const { user, stage } = await openBoard();
    // jsdom 은 getBoundingClientRect 가 0 이라 포인터→월드 변환이 성립하지 않는다.
    // 선택 자체는 키보드 경로(§7.5)로 하고, 그 결과 렌더만 본다.
    const chair = stage.querySelectorAll('.court-obj')[0] as SVGGElement;
    chair.focus();
    await user.keyboard('{Enter}');

    expect(stage.querySelectorAll('.sel-ring')).toHaveLength(1);
    const zoneRects = stage.querySelectorAll('.court-obj rect[style*="cursor"]');
    expect(zoneRects).toHaveLength(4); // towRear · translate · spin · towFront
    const cursors = Array.from(zoneRects).map((r) => decodeURIComponent(r.getAttribute('style') ?? ''));

    // 앞뒤 견인은 **일부러 같은 커서**(줄 쥔 손)다 — 마우스 커서는 회전시킬 수 없어서
    // 방향을 그리면 차체가 도는 순간 엉뚱한 쪽을 가리킨다. 방향은 리시와 핸들이 보여 준다.
    expect(cursors[0]).toBe(cursors[3]);
    // 가운데 둘은 서로도, 견인과도 달라야 한다
    expect(new Set(cursors).size).toBe(3);
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

  it('막 열린 판은 전환이 열려 있다', async () => {
    await openBoard('full');
    expect(screen.getByRole('radiogroup', { name: UNLOCKED })).toBeInTheDocument();
    expect(screen.queryByRole('radiogroup', { name: LOCKED })).toBeNull();
  });

  it('한 번이라도 편집하면 잠긴다', async () => {
    const { user, stage } = await openBoard('full');
    await nudgeSomething(user, stage);
    await waitFor(() => expect(screen.getByRole('radiogroup', { name: LOCKED })).toBeInTheDocument());
  });

  it('잠긴 상태에서 눌러도 코트가 바뀌지 않고, 이유를 알려준다', async () => {
    // §6.10 공 도구 제한과 같은 패턴 — 네이티브 disabled 가 아니라 aria-disabled + 토스트라
    // 키보드·스크린리더 사용자도 "왜 안 되는지" 를 들을 수 있어야 한다.
    const { user, stage } = await openBoard('full');
    await nudgeSomething(user, stage);
    const locked = await screen.findByRole('radiogroup', { name: LOCKED });

    await user.click(within(locked).getByRole('radio', { name: /하프/ }));

    expect(within(locked).getByRole('radio', { name: /풀/ })).toHaveAttribute('aria-checked', 'true');
    expect(await screen.findByText(/초기화하면 코트 형태를 바꿀 수 있습니다/)).toBeInTheDocument();
  });

  it('초기화하면 다시 열린다', async () => {
    const { user, stage } = await openBoard('full');
    await nudgeSomething(user, stage);
    await screen.findByRole('radiogroup', { name: LOCKED });

    await user.click(screen.getByRole('button', { name: '전술판 초기화' }));

    await waitFor(() => expect(screen.getByRole('radiogroup', { name: UNLOCKED })).toBeInTheDocument());
  });

  it('열려 있을 때 누르면 실제로 그 코트로 바뀐다', async () => {
    const { user } = await openBoard('full');
    const seg = screen.getByRole('radiogroup', { name: UNLOCKED });
    await user.click(within(seg).getByRole('radio', { name: /하프/ }));

    await waitFor(() => {
      const now = screen.getByRole('radiogroup', { name: UNLOCKED });
      expect(within(now).getByRole('radio', { name: /하프/ })).toHaveAttribute('aria-checked', 'true');
    });
  });

  it('연달아 두 번 바꿀 수 있다 (BOARD_SET 이 히스토리를 쌓지 않는다는 계약의 화면 끝 확인)', async () => {
    // DRILL_LOAD 로 구현했다면 첫 전환이 past 에 한 칸 쌓여 두 번째 전환이 잠긴다.
    // 리듀서 단위 테스트가 있지만, 게이트가 화면에서도 열린 채인지는 여기서만 보인다.
    const { user } = await openBoard('full');
    await user.click(within(screen.getByRole('radiogroup', { name: UNLOCKED })).getByRole('radio', { name: /하프/ }));
    await waitFor(() =>
      expect(within(screen.getByRole('radiogroup', { name: UNLOCKED })).getByRole('radio', { name: /하프/ })).toHaveAttribute(
        'aria-checked',
        'true',
      ),
    );

    await user.click(within(screen.getByRole('radiogroup', { name: UNLOCKED })).getByRole('radio', { name: /플랫/ }));
    await waitFor(() =>
      expect(within(screen.getByRole('radiogroup', { name: UNLOCKED })).getByRole('radio', { name: /플랫/ })).toHaveAttribute(
        'aria-checked',
        'true',
      ),
    );
  });
});

describe('전술판 스냅샷이 게이트를 끌고 간다 (핵심 회귀)', () => {
  it('편집한 판을 저장하고 다시 열면 잠겨 있다', async () => {
    // ⚠️ 런타임의 past.length 만으로 판정하면 여기서 무너진다 — 다시 열린 판이 새 "초기
    // 상태" 가 되어 past 가 비므로, dirty 인데도 전환이 열려 배치가 소리 없이 날아간다.
    // 그래서 pristine 을 스냅샷에 함께 저장한다(storage/board.ts).
    const { user, stage, unmount } = await openBoard('full');
    const chair = stage.querySelectorAll('.court-obj')[0] as SVGGElement;
    chair.focus();
    await user.keyboard('{Shift>}{ArrowRight}{/Shift}');

    // 디바운스(500ms) 뒤 스냅샷에 pristine:false 가 적히기를 기다린다.
    await waitFor(
      () => {
        const raw = localStorage.getItem(BOARD_KEY);
        expect(raw).not.toBeNull();
        expect(JSON.parse(raw!).pristine).toBe(false);
      },
      { timeout: 5000 },
    );

    // ★ 반드시 완전히 걷어낸다. 남겨두면 아래 단언이 "방금 편집해서 잠긴 첫 번째 판"을
    //   다시 읽을 뿐이라, 스냅샷 판정이 통째로 죽어도 초록불이 뜬다.
    unmount();
    expect(screen.queryByRole('application', { name: '코트 편집 영역' })).toBeNull();

    // 새로 마운트 = 새로고침 후 다시 방문. prefs 는 그대로, 스냅샷만 살아 있다.
    render(<BoardScreen />, { wrapper: Wrapper });
    await waitFor(() => expect(screen.getByRole('navigation', { name: '도구' })).toBeInTheDocument());
    expect(screen.getByRole('radiogroup', { name: '코트 형태(변경 불가)' })).toBeInTheDocument();
    expect(screen.queryByRole('radiogroup', { name: '코트 형태' })).toBeNull();
  }, 20000);

  it('리셋 상태로 저장된 판을 다시 열면 여전히 열려 있다 (게이트가 무조건 잠그는 것은 아니다)', async () => {
    const { unmount } = await openBoard('full');
    await waitFor(
      () => {
        const raw = localStorage.getItem(BOARD_KEY);
        expect(raw).not.toBeNull();
        expect(JSON.parse(raw!).pristine).toBe(true);
      },
      { timeout: 5000 },
    );
    unmount();

    render(<BoardScreen />, { wrapper: Wrapper });
    await waitFor(() => expect(screen.getByRole('navigation', { name: '도구' })).toBeInTheDocument());
    expect(screen.getByRole('radiogroup', { name: '코트 형태' })).toBeInTheDocument();
  }, 20000);
});

describe('[드릴로 저장] — 전술판을 정식 드릴로 승격', () => {
  it('저장소에 드릴이 생기고, 전술판은 그대로 남는다', async () => {
    const { repo } = await resolveDrillRepo();
    const before = await repo.countDrills();

    const { user } = await openBoard('half');
    await user.click(screen.getByRole('button', { name: '드릴로 저장' }));

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
});
