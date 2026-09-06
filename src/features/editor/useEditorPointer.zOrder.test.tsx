// 표시 순서(z-order) ↔ 히트테스트의 **배선** — 2026-09-06, `docs/PLAN-Z-ORDER.md` 결정 9.
//
// 여기서 재는 것은 판정 규칙이 아니라 **한 줄의 배선**이다: `useEditorPointer.buildScene` 이
// `sceneOrder(step, cast)` 를 스냅샷에 싣는가. 규칙 자체는 `render/hitTest.contract.test.ts` 가
// 순수 함수로 잰다.
//
// ⚠️ 이 파일이 없으면 새는 실기 버그: `order:` 한 줄이 빠져도 순수 함수 테스트는 전부 초록인
// 채로, 앱에서는 [표시순서]로 개체를 앞으로 보내 놓고 눌러도 **뒤의 것이 잡힌다**. 이 저장소가
// 여러 번 만난 "계산은 되는데 아무도 안 읽는 배선" 의 그 자리다(hitTest.ts 의 `handlesVisible`
// 주석이 같은 사고의 기록이다).
//
// 포인터 사건을 DOM 에 쏘지 않고 controller 를 직접 부른다 — jsdom 은 getBoundingClientRect 가
// 전부 0 이라 client→world 변환이 NaN 이 된다(tapDeselect.test.tsx 머리말과 같은 이유).
import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useRef } from 'react';
import type { ReactNode } from 'react';
import { BALL, DEFAULT_ZONES } from '../../core/constants.ts';
import { newId } from '../../core/ids.ts';
import type { BallId, ChairId } from '../../core/ids.ts';
import { createDrill } from '../../model/defaults.ts';
import type { Drill, DrillStep } from '../../model/drill.ts';
import type { CourtStageHandle, PointerMeta } from '../../render/CourtStage.tsx';
import { SettingsProvider } from '../../store/settings/SettingsProvider.tsx';
import {
  EditorProvider,
  useEditorDispatch,
  useEditorState,
  useEditorWorld,
  useEditorWriter,
} from '../../store/editor/EditorProvider.tsx';
import { useEditorPointer } from './useEditorPointer.ts';

const META: PointerMeta = { pointerType: 'touch', button: 0, shiftKey: false, metaKey: false, ctrlKey: false, altKey: false };
const CLIENT = { x: 10, y: 10 };

/** 휠체어는 (200,240) 정면 — 차체는 x∈[193.5, 226](pivotToRear 6.5 · pivotToFront 26).
 *  공은 앞끝에서 8px 바깥(234,240)에 둔다: 물리적으로는 **안 닿는다**(공 반지름 4.125 →
 *  가장자리 229.875, 차체 앞끝 226). 겹쳐 놓으면 물리가 밀어내 좌표가 흔들린다.
 *  그런데 탭 지점 (225,240)은 차체 **안**이면서 공의 픽 반지름(min(4.125 + 6, 11.25) = 10.125)
 *  **안**(거리 9)이기도 하다 — 한 점이 둘 다에 걸리는 자리이고, 그래서 순서가 답을 정한다. */
const CHAIR_AT = { x: 200, y: 240, angleDeg: 0 };
const BALL_AT = { x: 234, y: 240 };
const TAP = { x: 225, y: 240 };

function makeDrill(zOrderOf?: (ids: { chairId: ChairId; ballId: BallId }) => string[]): {
  drill: Drill;
  chairId: ChairId;
  ballId: BallId;
} {
  const base = createDrill({ courtMode: 'full', formation: '1-2-1', empty: true });
  const chairId = newId('ch');
  const ballId = newId('bl');
  const zOrder = zOrderOf?.({ chairId, ballId });
  const step0 = base.steps[0]!;
  const step: DrillStep = {
    ...step0,
    chairs: { [chairId]: { ...CHAIR_AT } },
    balls: { [ballId]: { ...BALL_AT } },
    cones: {},
    ...(zOrder ? { zOrder } : {}),
  };
  return {
    chairId,
    ballId,
    drill: {
      ...base,
      cast: {
        ...base.cast,
        chairs: [{ id: chairId, team: 'home', number: '2', isGk: false }],
        balls: [{ id: ballId }],
      },
      steps: [step],
    },
  };
}

function useHarness() {
  const state = useEditorState();
  const dispatch = useEditorDispatch();
  const worldRef = useEditorWorld();
  const writer = useEditorWriter();
  // 무대 핸들 없음 → pxPerUnit = 1 (탭 임계 6 CSS px = 6 월드 px).
  const stageRef = useRef<CourtStageHandle | null>(null);
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
    onPlayerPlaced: () => {},
    showToast: () => {},
    forceHandlesVisible: false,
    largeTargets: false,
  });
  return { state, pointer };
}

function mount(drill: Drill) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <SettingsProvider>
      <EditorProvider drill={drill}>{children}</EditorProvider>
    </SettingsProvider>
  );
  return renderHook(() => useHarness(), { wrapper });
}

function tapAt(result: ReturnType<typeof mount>['result'], p: { x: number; y: number }) {
  act(() => void result.current.pointer.controller.onPointerDown(p, META));
  act(() => result.current.pointer.controller.onPointerUp(CLIENT));
}

describe('편집기 포인터가 스텝의 표시 순서를 판정에 싣는다(PLAN-Z-ORDER 결정 9)', () => {
  it('zOrder 가 없으면 기본층 — 공이 휠체어 위라 겹친 자리는 공이 잡힌다', () => {
    const { drill, ballId } = makeDrill();
    const { result } = mount(drill);
    tapAt(result, TAP);
    expect(Array.from(result.current.state.selection)).toEqual([ballId]);
  });

  it('★ zOrder 로 공을 휠체어 아래로 보내면 **같은 자리를 눌러 휠체어**가 잡힌다', () => {
    // 아래→위: 공, 휠체어.
    const { drill, chairId, ballId } = makeDrill((ids) => [ids.ballId, ids.chairId]);
    expect(drill.steps[0]!.zOrder).toEqual([ballId, chairId]); // 픽스처 검산
    const { result } = mount(drill);
    tapAt(result, TAP);
    expect(Array.from(result.current.state.selection)).toEqual([chairId]);
  });
});
