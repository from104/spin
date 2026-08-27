// 5.5 — 2존 모드가 **실제 포인터 경로**에 닿는가(§9 결정 ④ · §4.4 P2-2).
//
// 순수층(physics/twoZone.test.ts)이 재는 것은 "함수가 옳은가" 이고, 여기서 재는 것은
// "설정 토글이 그 함수까지 닿는가" 다. 배선이 끊어져 있으면 순수 테스트는 전건 초록인 채
// 판 위에서는 아무 일도 일어나지 않는다 — 5.5 이전이 정확히 그 상태였다.
//
// 축을 전부 편다: ON/OFF × 코트 3종(full/half/flat) × 마우스/터치 × largeTargets ON/OFF.
// **OFF 경로를 같은 밀도로 찌른다** — 토글을 더하다 기본 경로를 망가뜨리는 것이 가장 흔한 사고다.
//
// 포인터 사건을 DOM 에 쏘지 않고 controller 를 직접 부른다(cues·tapDeselect 테스트와 같은 이유:
// jsdom 은 getBoundingClientRect 가 전부 0 이라 client→world 변환이 NaN 이 된다).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef } from 'react';
import type { ReactNode } from 'react';
import { BALL, DEFAULT_ZONES, CHAIR, INTERACT } from '../../core/constants.ts';
import type { ChairId } from '../../core/ids.ts';
import { createDrill } from '../../model/defaults.ts';
import { COURT_DEFS, type CourtMode } from '../../model/court.ts';
import { classifyZone } from '../../model/chair.ts';
import type { Drill, DrillStep } from '../../model/drill.ts';
import type { CourtStageHandle, PointerMeta } from '../../render/CourtStage.tsx';
import { createTransformWriter } from '../../render/transformWriter.ts';
import { LibraryProvider } from '../../store/library/LibraryProvider.tsx';
import { ToastProvider } from '../../store/toast/ToastProvider.tsx';
import { AppNavProvider } from '../../app/useAppHistory.ts';
import type { AppHistoryApi } from '../../app/useAppHistory.ts';
import { HeaderProvider } from '../../app/AppHeader.tsx';
import { LiveRegion } from '../../ui/LiveRegion.tsx';
import { makeDefaultPrefs, PREFS_KEY } from '../../storage/prefs.ts';
import { saveBoard } from '../../storage/board.ts';
import { BoardScreen } from '../board/BoardScreen.tsx';
import { SettingsProvider } from '../../store/settings/SettingsProvider.tsx';
import { EditorProvider, useEditorDispatch, useEditorState, useEditorWorld, useEditorWriter } from '../../store/editor/EditorProvider.tsx';
import type { EditorWorldRef } from '../../store/editor/EditorProvider.tsx';
import { EditorStage } from './EditorStage.tsx';
import { useEditorPointer } from './useEditorPointer.ts';

const noop = () => {};
const CLIENT = { x: 10, y: 10 };
const meta = (pointerType: string): PointerMeta => ({ pointerType, button: 0, shiftKey: false, metaKey: false, ctrlKey: false, altKey: false });

/** s(축 방향 정규 위치) → θ=0 차체의 월드 x 오프셋. projectGrab 의 역: ax = (s − sPivot)·L. */
const axFor = (s: number): number => (s - CHAIR.sPivot) * CHAIR.lengthPx;

const COURTS: readonly CourtMode[] = ['full', 'half', 'flat'];

function makeDrill(mode: CourtMode): { drill: Drill; chairId: ChairId; at: { x: number; y: number } } {
  const base = createDrill({ courtMode: mode, formation: '1-2-1' });
  const chairId = base.cast.chairs[0]!.id;
  const def = COURT_DEFS[mode];
  // 판 한가운데 — 어느 코트에서도 경기면 안이고, 물리 경계 클램프에 걸리지 않는다.
  const at = { x: Math.round(def.vbW / 2), y: Math.round(def.vbH / 2) };
  const step0 = base.steps[0]!;
  const step: DrillStep = { ...step0, chairs: { [chairId]: { ...at, angleDeg: 0 } }, balls: {}, cones: {}, notes: [], arrows: [] };
  return { chairId, at, drill: { ...base, steps: [step] } };
}

function useHarness(twoZone: boolean, largeTargets: boolean, pxPerUnit: number | null) {
  const state = useEditorState();
  const dispatch = useEditorDispatch();
  const worldRef = useEditorWorld();
  const writer = useEditorWriter();
  // 무대 핸들 없음 → pxPerUnit = 1 (월드 px = CSS px). jsdom 은 레이아웃을 계산하지 않아
  // 진짜 CourtStage 를 붙여도 배율이 NaN 이 되므로, 배율 축을 찌를 때만 얇은 스텁을 심는다 —
  // 안 심으면 `handlesVisible(pxPerUnit, …)` 경로가 1 로만 실행돼 문턱 1.28 근처를 한 번도
  // 지나지 않는다(= 그 축이 한 줄도 실행 안 된 채 초록불).
  const stageRef = useRef<CourtStageHandle | null>(null);
  if (pxPerUnit !== null && stageRef.current === null) {
    stageRef.current = { refreshMetrics: () => ({ pxPerUnit, rot: 0 }) } as unknown as CourtStageHandle;
  }
  const drill = state.present;
  const step = drill.steps[0]!;
  const pointer = useEditorPointer({
    drill,
    stepIndex: 0,
    step,
    tool: 'select',
    coneSlot: 0,
    selection: state.selection,
    dispatch,
    worldRef,
    writer,
    stageRef,
    zones: DEFAULT_ZONES,
    ballMax: BALL.maxCount,
    pendingPlayerId: null,
    onPlayerPlaced: noop,
    showToast: noop,
    // ★ 여기가 배선이다 — EditorStage 는 `forceHandlesVisible={twoZone}` 로 같은 값을 넘긴다.
    forceHandlesVisible: twoZone,
    largeTargets,
  });
  return { state, pointer };
}

function mount(drill: Drill, twoZone: boolean, largeTargets = false, pxPerUnit: number | null = null) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <SettingsProvider>
      <EditorProvider drill={drill}>{children}</EditorProvider>
    </SettingsProvider>
  );
  return renderHook(() => useHarness(twoZone, largeTargets, pxPerUnit), { wrapper });
}

afterEach(() => {
  localStorage.clear();
});

/** 차체 위 한 점을 잡았을 때 래치된 존. 잡고 → 바로 놓는다(존은 pointerdown 에 래치된다). */
function zoneWhenGrabbing(
  r: ReturnType<typeof mount>,
  at: { x: number; y: number },
  s: number,
  pointerType: string,
): { zone: string | null; engaged: boolean } {
  const ctrl = () => r.result.current.pointer.controller;
  act(() => void ctrl().onPointerDown({ x: at.x + axFor(s), y: at.y }, meta(pointerType)));
  const zone = r.result.current.pointer.activeZone;
  const engaged = r.result.current.pointer.twoZoneEngaged;
  act(() => ctrl().onPointerUp(CLIENT));
  return { zone, engaged };
}

describe.each(COURTS)('코트 %s', (mode) => {
  describe.each(['mouse', 'touch'])('포인터 %s', (pointerType) => {
    describe.each([false, true])('큰 터치 타깃 %s', (largeTargets) => {
      it('OFF — 차체 앞 절반은 제자리 회전, 뒤 절반은 평행 이동 (기본 4존 그대로)', () => {
        const { drill, at } = makeDrill(mode);
        const r = mount(drill, false, largeTargets);

        const front = zoneWhenGrabbing(r, at, 0.8, pointerType);
        const rear = zoneWhenGrabbing(r, at, 0.3, pointerType);

        expect(front.zone).toBe('spin');
        expect(rear.zone).toBe('translate');
        expect(front.engaged).toBe(false);
        expect(rear.engaged).toBe(false);
        // 뜻은 "기본 경로가 classifyZone 과 같다" 이지 "spin/translate 리터럴" 이 아니다.
        expect(front.zone).toBe(classifyZone(0.8, DEFAULT_ZONES));
        expect(rear.zone).toBe(classifyZone(0.3, DEFAULT_ZONES));
      });

      it('ON — 차체 앞 절반도 평행 이동이 된다 (차체 전체가 한 덩어리)', () => {
        const { drill, at } = makeDrill(mode);
        const r = mount(drill, true, largeTargets);

        const front = zoneWhenGrabbing(r, at, 0.8, pointerType);
        const rear = zoneWhenGrabbing(r, at, 0.3, pointerType);

        expect(front.zone).toBe('translate');
        expect(rear.zone).toBe('translate');
        expect(front.engaged).toBe(true);
        // 대조군: OFF 에서는 같은 점이 spin 이었다(위 it). 여기서 그 사실을 다시 못박아
        // "원래부터 translate 였다" 로 통과하는 길을 막는다.
        expect(classifyZone(0.8, DEFAULT_ZONES)).toBe('spin');
      });
    });
  });
});

describe('2존 모드에서도 회전·견인이 남아 있다 — 차체 밖 앞뒤 가이드', () => {
  // 이것이 §4.4 P2-2 가 "핸들만 쓴다를 그대로 되살리면 안 된다" 고 경고한 바로 그 자리다:
  // 차체를 한 존으로 접으면서 핸들까지 접으면 사용자가 회전 수단을 통째로 잃는다.
  it.each(COURTS)('[%s] 전방 가이드를 잡으면 ON 에서도 전방 견인이다', (mode) => {
    const { drill, at } = makeDrill(mode);
    const r = mount(drill, true);
    const ctrl = () => r.result.current.pointer.controller;

    // 존 핸들은 **선택된 칩에만** 붙는다(buildHitContext.handlesVisible) — 먼저 차체를 눌러 고른다.
    act(() => void ctrl().onPointerDown({ x: at.x, y: at.y }, meta('touch')));
    act(() => ctrl().onPointerUp(CLIENT));

    const lever = INTERACT.handleLeverPx.towFront;
    act(() => void ctrl().onPointerDown({ x: at.x + lever, y: at.y }, meta('touch')));
    expect(r.result.current.pointer.activeZone).toBe('towFront');
    act(() => ctrl().onPointerUp(CLIENT));

    // 대조군 — 후방 가이드도 살아 있다(한쪽만 재면 "언제나 towFront" 구현이 통과한다).
    act(() => void ctrl().onPointerDown({ x: at.x + INTERACT.handleLeverPx.towRear, y: at.y }, meta('touch')));
    expect(r.result.current.pointer.activeZone).toBe('towRear');
    act(() => ctrl().onPointerUp(CLIENT));
  });
});

describe('판이 거짓말하지 않는다 — 차체 음영이 판정과 같은 말을 한다', () => {
  // 판정만 접고 그림을 안 접으면, 앞 2/3 에 '제자리 회전' 음영이 남은 채로 잡으면 통째로
  // 밀린다 — 화면이 조작 규칙을 잘못 가르친다. EditorStage 의 `zoneCursors` 한 줄이 그 자리다.
  function tints(twoZone: boolean, mode: CourtMode): { x: number; w: number }[] {
    const { drill, chairId } = makeDrill(mode);
    const { container } = render(
      <EditorStage
        rot={0}
        drill={drill}
        stepIndex={0}
        step={drill.steps[0]!}
        tool="select"
        coneSlot={0}
        selection={new Set([chairId])}
        dispatch={vi.fn()}
        worldRef={{ current: null } as EditorWorldRef}
        writer={createTransformWriter()}
        zones={DEFAULT_ZONES}
        ballMax={BALL.maxCount}
        pendingPlayerId={null}
        onPlayerPlaced={vi.fn()}
        showToast={vi.fn()}
        showGrid={false}
        showGridLabels={false}
        showRuleZones={false}
        largeTargets={false}
        twoZone={twoZone}
        onEraseIds={vi.fn()}
        onDuplicateIds={vi.fn()}
        onEditNote={() => {}}
      />,
      { wrapper: SettingsProvider },
    );
    return Array.from(container.querySelectorAll('.court-obj rect.zone-tint')).map((r) => ({
      x: Number(r.getAttribute('x')),
      w: Number(r.getAttribute('width')),
    }));
  }

  it.each(COURTS)('[%s] ON — 음영이 차체를 덮는 한 장으로 합쳐진다', (mode) => {
    const t = tints(true, mode);
    expect(t).toHaveLength(1);
    expect(t[0]!.x).toBeCloseTo(-CHAIR.pivotToRearPx, 6);
    expect(t[0]!.w).toBeCloseTo(CHAIR.lengthPx, 6);
  });

  it.each(COURTS)('[%s] 대조군 OFF — 음영이 둘로 갈리고 각각 차체의 절반이다', (mode) => {
    const t = tints(false, mode);
    expect(t).toHaveLength(2);
    expect(t[0]!.w).toBeCloseTo(CHAIR.lengthPx / 2, 6);
    expect(t[1]!.w).toBeCloseTo(CHAIR.lengthPx / 2, 6);
    // 합은 같아도 장수가 다르다 — 이 두 it 이 붙어 있어야 "언제나 한 장" 도 "언제나 두 장" 도 못 지난다.
    expect(t[0]!.w + t[1]!.w).toBeCloseTo(CHAIR.lengthPx, 6);
  });
});

describe('설정 → 판 (전 구간 배선)', () => {
  // 위 두 describe 는 EditorStage 에 prop 을 직접 꽂아 잰다 — 그러면 **EditorWorkspace 가
  // prefs 를 안 넘겨도** 전건 초록이다. 여기서만 그 마지막 한 줄이 하중을 받는다:
  // localStorage 의 prefs 하나만 심고, 실제 화면(BoardScreen → EditorWorkspace → EditorStage)
  // 을 열어 차체 음영을 센다.
  function Wrapper({ children }: { children: ReactNode }) {
    const nav: AppHistoryApi = { screen: 'board', go: () => {}, back: () => {} };
    return (
      <SettingsProvider>
        <LibraryProvider>
          <ToastProvider>
            <HeaderProvider>
              <AppNavProvider value={nav}>{children}</AppNavProvider>
            </HeaderProvider>
            <LiveRegion />
          </ToastProvider>
        </LibraryProvider>
      </SettingsProvider>
    );
  }

  /** 판을 열고 첫 휠체어를 **키보드로** 고른다 — jsdom 은 getBoundingClientRect 가 0 이라
   *  포인터→월드 변환이 성립하지 않는다(BoardScreen.test.tsx 가 쓰는 것과 같은 경로). */
  async function openBoardWith(twoZone: boolean): Promise<Element[]> {
    const d = makeDefaultPrefs();
    localStorage.setItem(PREFS_KEY, JSON.stringify({ ...d, a11y: { ...d.a11y, twoZone } }));
    saveBoard(createDrill({ courtMode: 'full', formation: '1-2-1' }));
    const user = userEvent.setup();
    render(<BoardScreen />, { wrapper: Wrapper });
    await waitFor(() => expect(screen.getByRole('navigation', { name: '도구' })).toBeInTheDocument());
    const stage = screen.getByRole('application', { name: '코트 편집 영역' });
    const chair = stage.querySelectorAll('.court-obj')[0] as SVGGElement;
    chair.focus();
    await user.keyboard('{Enter}');
    // 대조군: 선택이 실제로 걸렸는지 먼저 확인한다 — 안 걸리면 음영이 0개라 "1개가 아니다"
    // 라는 이유로 ON 테스트가 통과하는 길이 열린다.
    expect(stage.querySelectorAll('.sel-ring')).toHaveLength(1);
    return Array.from(stage.querySelectorAll('.court-obj rect.zone-tint'));
  }

  it('prefs.a11y.twoZone = true 만 심으면 판 위 음영이 한 장으로 합쳐진다', async () => {
    const rects = await openBoardWith(true);
    expect(rects).toHaveLength(1);
    expect(Number(rects[0]!.getAttribute('width'))).toBeCloseTo(CHAIR.lengthPx, 6);
  });

  it('대조군 — false 면 지금까지처럼 두 장이다', async () => {
    expect(await openBoardWith(false)).toHaveLength(2);
  });
});

describe('줌과 포인터 종류는 조작 규칙을 바꾸지 않는다 (§9-④ 자동 게이트 금지)', () => {
  // 옛 `handlesVisible` 식(forced || (touch && px < 1.28))이 살아 있으면, 토글 OFF 인 7인치
  // 터치(pxPerUnit 0.663)에서 2존이 **저절로** 켜진다 — '기본 OFF' 가 그 기기에서만 거짓말이 된다.
  it.each([0.663, 0.891, 1.151, 1.675])('OFF · 터치 · 배율 %s 에서 앞 절반은 여전히 제자리 회전', (pxPerUnit) => {
    const { drill, at } = makeDrill('full');
    const r = mount(drill, false, false, pxPerUnit);
    const ctrl = () => r.result.current.pointer.controller;

    act(() => void ctrl().onPointerDown({ x: at.x + axFor(0.8), y: at.y }, meta('touch')));
    expect(r.result.current.pointer.activeZone).toBe('spin');
    expect(r.result.current.pointer.twoZoneEngaged).toBe(false);
    act(() => ctrl().onPointerUp(CLIENT));
  });

  it.each([0.663, 1.675])('대조군 — 같은 배율에서 토글을 켜면 평행 이동으로 바뀐다 (배율 축이 죽어 있지 않다)', (pxPerUnit) => {
    const { drill, at } = makeDrill('full');
    const r = mount(drill, true, false, pxPerUnit);
    const ctrl = () => r.result.current.pointer.controller;

    act(() => void ctrl().onPointerDown({ x: at.x + axFor(0.8), y: at.y }, meta('touch')));
    expect(r.result.current.pointer.activeZone).toBe('translate');
    expect(r.result.current.pointer.twoZoneEngaged).toBe(true);
    act(() => ctrl().onPointerUp(CLIENT));
  });
});
