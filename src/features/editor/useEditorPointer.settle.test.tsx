// §4.2 P0-2 + §4.3 P1-3 — **정착 후 재커밋**과 그 안에 얹힌 정착 스냅.
//
// 무엇을 재는가: `handle.end()` 는 릴리스 체이스(최대 4초)를 **시작만** 한다. 그래서 손을 뗀
// 그 순간 읽은 좌표는 "칩이 실제로 선 자리" 가 아니다 — 속도 제한이 켜져 있으면 선속
// 69.4 px/s 라 코트를 가로지르는 데 10초가 걸린다. 재커밋이 없으면 화면과 모델이 영구히
// 어긋나고, 스텝을 넘겼다 돌아오는 순간(world.load 가 모델 좌표로 바디를 재생성) 칩이
// 손 떼던 자리로 되돌아간다.
//
// 포인터 사건을 DOM 에 쏘지 않고 `controller` 를 직접 부른다: jsdom 은 getBoundingClientRect
// 가 전부 0 이라 client→world 변환이 NaN 이 되어(BoardScreen.test.tsx stubStageRect 주석)
// 좌표를 만들 수 없다. 여기서 재려는 것은 좌표 변환이 아니라 커밋 시점이므로 월드 좌표를
// 그대로 넣는 편이 정확하다.
//
// ⏱ 물리는 rAF tick 에서만 전진한다. 101개 파일을 병렬로 돌리면 jsdom 타이머가 굶으므로
// 대기 예산을 넉넉히 준다(파일 단독으로는 1초 안에 끝난다).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useRef } from 'react';
import type { ReactNode } from 'react';
import { BALL, DEFAULT_ZONES, INTERACT, PHYS } from '../../core/constants.ts';
import type { ChairId } from '../../core/ids.ts';
import { poseToStored } from '../../model/chair.ts';
import { createDrill } from '../../model/defaults.ts';
import type { Drill } from '../../model/drill.ts';
import type { CourtStageHandle, PointerMeta } from '../../render/CourtStage.tsx';
import { SettingsProvider } from '../../store/settings/SettingsProvider.tsx';
import {
  EditorProvider,
  useEditorDispatch,
  useEditorState,
  useEditorWorld,
  useEditorWriter,
} from '../../store/editor/EditorProvider.tsx';
import * as snapModule from './snapOnSettle.ts';
import { useEditorPointer } from './useEditorPointer.ts';

const META: PointerMeta = { pointerType: 'mouse', button: 0, shiftKey: false, metaKey: false, ctrlKey: false, altKey: false };

/** 출발점. y=240 은 격자선·코트 라인·골 십자(y=262.5)에서 전부 6px 밖이라, 스냅이
 *  "붙었나 안 붙었나" 로 이 파일의 좌표 단언을 흔들지 않는다. */
const START = { x: 200, y: 240, angleDeg: 0 };
/** 코트 횡단에 준하는 거리. 속도 제한 ON(69.4 px/s)에서 2.16초짜리 체이스다 — 손 떼는
 *  시점에는 절대 도착해 있을 수 없는 거리라는 것이 이 테스트의 전제다. */
const DRAG_DX = 150;

/** 휠체어 **한 대만** 놓인 판. 이웃이 없어야 체이스가 다른 칩에 막히지 않는다. */
function makeDrill(): { drill: Drill; chairId: ChairId } {
  const base = createDrill({ courtMode: 'full', formation: '1-2-1' });
  const chairId = base.cast.chairs[0]!.id;
  const step0 = base.steps[0]!;
  return {
    chairId,
    drill: { ...base, steps: [{ ...step0, chairs: { [chairId]: { ...START } }, balls: {}, cones: {} }] },
  };
}

function useHarness() {
  const state = useEditorState();
  const dispatch = useEditorDispatch();
  const worldRef = useEditorWorld();
  const writer = useEditorWriter();
  // 무대 핸들은 없다 — refreshMetrics() 가 없으면 pxPerUnit 은 기본값 1 로 남는다(= 월드
  // 1px 이 화면 1px). 스냅 문턱 6 CSS px 이 곧 6 월드 px 이 되어 산수가 읽힌다.
  const stageRef = useRef<CourtStageHandle | null>(null);
  const drill = state.present;
  const step = drill.steps[0]!;
  const pointer = useEditorPointer({
    drill,
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
    onPlayerPlaced: () => {},
    showToast: () => {},
    forceHandlesVisible: false,
    largeTargets: false,
  });
  return { state, dispatch, worldRef, pointer };
}

function mount(drill: Drill) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <SettingsProvider>
      <EditorProvider drill={drill}>{children}</EditorProvider>
    </SettingsProvider>
  );
  return renderHook(() => useHarness(), { wrapper });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('정착 후 재커밋 (P0-2)', () => {
  it(
    '손 떼던 자리가 아니라 **물리가 다 선 자리**가 모델에 남는다',
    async () => {
      const { drill, chairId } = makeDrill();
      const { result } = mount(drill);
      const poseOf = () => result.current.state.present.steps[0]!.chairs[chairId]!;
      const epoch0 = result.current.state.epoch;

      const ctrl = () => result.current.pointer.controller;
      act(() => void ctrl().onPointerDown({ x: START.x, y: START.y }, META));
      act(() => ctrl().onPointerMove({ x: START.x + DRAG_DX, y: START.y }, 0));
      // 물리를 몇 프레임 굴린다 — 손을 뗄 때 칩이 목표까지 한참 못 간 상태를 만든다.
      await act(async () => await sleep(60));
      act(() => ctrl().onPointerUp(null));

      // ① 손 떼는 순간의 커밋은 "가다 만 자리" 다. 목표까지는 아직 멀다.
      const xAtRelease = poseOf().x;
      expect(xAtRelease).toBeLessThan(START.x + DRAG_DX - 60);

      // ② 정착이 끝나면 모델이 스스로 따라잡는다. 이 재커밋이 없으면 여기서 영원히 멈춘다.
      await waitFor(() => expect(poseOf().x).toBeGreaterThan(xAtRelease + 40), { timeout: 20000, interval: 40 });

      // ③ 모델 == 물리. 겉보기만 맞추는 게 아니라 저장되는 값이 정착 좌표여야 한다.
      const w = result.current.worldRef.current!.read()[chairId]!;
      expect(poseOf()).toEqual(poseToStored({ x: w.x, y: w.y, theta: w.theta }));
      expect(w.x).toBeGreaterThan(xAtRelease + 40);

      // ④ 드래그 1회 = undo 1회. 재커밋이 경계를 다시 열면 여기가 2가 된다.
      expect(result.current.state.past).toHaveLength(1);
      expect(result.current.state.future).toHaveLength(0);

      // ⑤ [A-4] epoch 불변. 올라가면 EditorProvider 가 world.load 로 바디를 전량 재생성하고
      //    → 다시 정착 → 다시 재커밋으로 **무한 루프**가 된다.
      expect(result.current.state.epoch).toBe(epoch0);
    },
    30000,
  );

  // 2026-08-12 검증관 지적(FV-4): 억제 창의 **리듀서 계약**(SETTLE_ARM → settleHoldUntil)과
  // **소비자 계약**(창이 열려 있으면 putDrill 1회)은 각각 단언돼 있었는데, 둘을 잇는 생산자
  // 배선은 아무도 안 봤다 — useEditorPointer 의 dispatch 를 지워도 전체 스위트가 초록불이었다.
  // 회귀하면 드래그당 IDB 쓰기가 2회로 돌아가고, useAutosave.flush() 의 savingRef 경로 때문에
  // **정작 저장돼야 할 정착 좌표를 실은 두 번째 쓰기가 조용히 사라진다.** 조용한 데이터 유실이다.
  it(
    '손을 떼면 자동저장 억제 창이 열리고, 정착 재커밋이 그것을 닫는다 (A-5 생산자 배선)',
    async () => {
      const { drill, chairId } = makeDrill();
      const { result } = mount(drill);
      const poseOf = () => result.current.state.present.steps[0]!.chairs[chairId]!;
      expect(result.current.state.settleHoldUntil).toBe(0);

      const ctrl = () => result.current.pointer.controller;
      act(() => void ctrl().onPointerDown({ x: START.x, y: START.y }, META));
      act(() => ctrl().onPointerMove({ x: START.x + DRAG_DX, y: START.y }, 0));

      const before = Date.now();
      act(() => ctrl().onPointerUp(null));

      // ① 창이 열린다. 마감은 체이스 상한 + 정착 상한 — 통지가 영영 안 와도 스스로 풀리도록
      //    불리언이 아니라 **절대 시각**이어야 한다.
      const until = result.current.state.settleHoldUntil;
      expect(until).toBeGreaterThan(before);
      expect(until).toBeLessThanOrEqual(Date.now() + INTERACT.releaseChaseMs + PHYS.settleMaxMs);

      // ② 정착 재커밋이 닫는다. 안 닫히면 자동저장이 최대 12초 동안 잠긴 채로 남는다.
      await waitFor(() => expect(poseOf().x).toBeGreaterThan(START.x + 40), { timeout: 20000, interval: 40 });
      expect(result.current.state.settleHoldUntil).toBe(0);
    },
    30000,
  );

  it(
    '되돌리기 한 번이면 드래그 전 자리로 돌아간다 (정착 재커밋이 present 만 교체했다는 증거)',
    async () => {
      const { drill, chairId } = makeDrill();
      const { result } = mount(drill);
      const poseOf = () => result.current.state.present.steps[0]!.chairs[chairId]!;

      const ctrl = () => result.current.pointer.controller;
      act(() => void ctrl().onPointerDown({ x: START.x, y: START.y }, META));
      act(() => ctrl().onPointerMove({ x: START.x + DRAG_DX, y: START.y }, 0));
      act(() => ctrl().onPointerUp(null));
      await waitFor(() => expect(poseOf().x).toBeGreaterThan(START.x + 40), { timeout: 20000, interval: 40 });

      act(() => result.current.dispatch({ type: 'UNDO' }));
      expect(poseOf().x).toBeCloseTo(START.x, 6);
      expect(result.current.state.past).toHaveLength(0);
    },
    30000,
  );
});

describe('정착 스냅 (P1-3)', () => {
  it(
    '드래그 **중에는** snapOnSettle 이 한 번도 불리지 않는다',
    async () => {
      const spy = vi.spyOn(snapModule, 'snapOnSettle');
      const { drill, chairId } = makeDrill();
      const { result } = mount(drill);
      const poseOf = () => result.current.state.present.steps[0]!.chairs[chairId]!;

      const ctrl = () => result.current.pointer.controller;
      act(() => void ctrl().onPointerDown({ x: START.x, y: START.y }, META));
      for (let i = 1; i <= 8; i++) {
        act(() => ctrl().onPointerMove({ x: START.x + i * 12, y: START.y }, i * 16));
      }
      await act(async () => await sleep(80));
      // 체이스·속도 제한 위에 스냅을 얹으면 "따라오다 갑자기 튄다" 가 된다 — 그래서 0 이다.
      expect(spy).not.toHaveBeenCalled();

      act(() => ctrl().onPointerUp(null));
      expect(spy).not.toHaveBeenCalled(); // 손 뗀 시점 커밋에서도 아직 아니다(A-6/E-1)

      await waitFor(() => expect(poseOf().x).toBeGreaterThan(START.x + 40), { timeout: 20000, interval: 40 });
      // 정착 시점에 **끌던 개체 하나에만** 한 번. 이 단언이 없으면 위의 0 이 "스파이가 아예
      // 안 걸렸다" 로도 통과한다.
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0]![1].pxPerUnit).toBe(1);
    },
    30000,
  );
});
