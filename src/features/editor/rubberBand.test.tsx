// 고무줄 선택이 **무엇을 담는가**(§6.10b).
//
// > 2026-08-16 기현 신고: *"고무줄 선택이 작도 개체를 왜 선택 안 되게 했나?"*
//
// 결정이 아니라 **빠뜨림**이었다. 그 루프는 앱 조립 첫 커밋 때 그때 있던 넷(휠체어·공·콘·
// 메모)을 돌게 쓰였고, 화살표·도형은 나중에 들어오면서 아무도 이 줄을 다시 안 봤다. 그래서
// "빈 코트를 훑는다" 는 한 가지 손짓이 **개체 종류에 따라 되기도 하고 안 되기도 했다.**
// 이 파일이 그 목록을 못 박는다 — 새 개체 종류가 생기면 여기가 먼저 빨개진다.
//
// 포인터 사건을 DOM 에 쏘지 않고 `controller` 를 직접 부르는 이유는 framePan 테스트 머리말과
// 같다(jsdom 은 getBoundingClientRect 가 전부 0 이라 client→world 가 NaN 이 된다).
import { afterEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useRef } from 'react';
import type { ReactNode } from 'react';
import { BALL, DEFAULT_ZONES } from '../../core/constants.ts';
import type { ArrowId, ShapeId } from '../../core/ids.ts';
import { createDrill } from '../../model/defaults.ts';
import type { Drill } from '../../model/drill.ts';
import type { CourtStageHandle, PointerMeta } from '../../render/CourtStage.tsx';
import { SettingsProvider } from '../../store/settings/SettingsProvider.tsx';
import { EditorProvider, useEditorDispatch, useEditorState, useEditorWorld, useEditorWriter } from '../../store/editor/EditorProvider.tsx';
import { useEditorPointer } from './useEditorPointer.ts';

const META: PointerMeta = { pointerType: 'mouse', button: 0, shiftKey: false, metaKey: false, ctrlKey: false, altKey: false };

const AR = 'ar_r1' as ArrowId;
const SH = 'sh_r1' as ShapeId;

// 풀 코트 경기면은 x 37.5..787.5 · y 37.5..487.5 (750×450 + 마진 37.5). 아래 좌표는 전부
// 그 안이다 — 밖에서 시작하면 고무줄이 아니라 판 이동이 된다(§4.4 P2-1).
//
// ⚠️ 사각형을 **시작하는 점**은 어느 개체에서도 멀어야 한다. 선택 도구의 히트는 관용 반경
//    44 를 갖고(2단 히트), 이 하네스는 stage metrics 가 없어 pxPerUnit=1 이라 그 44 가 곧
//    월드 44 다 — 가까이서 시작하면 고무줄 대신 그 개체를 집는다.
const CHAIR_AT = { x: 200, y: 150 };
/** 가로로 긴 화살표. 끝점과 한가운데가 멀어야 "무엇으로 판정하는가" 를 가를 수 있다. */
const ARROW = { from: { x: 150, y: 400 }, ctrl: { x: 300, y: 400 }, to: { x: 450, y: 400 } };
/** 곡선의 t=0.5 점 = (from + 2·ctrl + to)/4. */
const ARROW_MID = { x: 300, y: 400 };
const SHAPE_AT = { x: 600, y: 150 };

function makeDrill(over: { lockedIds?: string[] } = {}): { drill: Drill; chairId: string } {
  const base = createDrill({ courtMode: 'full', formation: '1-2-1' });
  const chairId = base.cast.chairs[0]!.id;
  const step0 = base.steps[0]!;
  return {
    chairId,
    drill: {
      ...base,
      steps: [
        {
          ...step0,
          chairs: { [chairId]: { x: CHAIR_AT.x, y: CHAIR_AT.y, angleDeg: 90 } },
          balls: {},
          cones: {},
          notes: [],
          arrows: [{ id: AR, ...ARROW }],
          shapes: [{ id: SH, kind: 'rect', x: SHAPE_AT.x, y: SHAPE_AT.y, w: 60, h: 40, rot: 0 }],
          locked: over.lockedIds,
        },
      ],
    },
  };
}

function useHarness() {
  const state = useEditorState();
  const dispatch = useEditorDispatch();
  const worldRef = useEditorWorld();
  const writer = useEditorWriter();
  const stageRef = useRef<CourtStageHandle | null>(null);
  const drill = state.present;
  const step = drill.steps[0]!;
  const pointer = useEditorPointer({
    drill,
    stepIndex: 0,
    step,
    tool: 'select',
    locked: new Set(step.locked ?? []),
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

/** 빈 곳에서 시작해 사각형을 치고 손을 뗀다 — 실제 손짓 한 벌 그대로. */
function sweep(r: ReturnType<typeof mount>['result'], a: { x: number; y: number }, b: { x: number; y: number }): void {
  act(() => {
    r.current.pointer.controller.onPointerDown(a, META);
  });
  act(() => {
    r.current.pointer.controller.onPointerMove(b, 0);
  });
  act(() => {
    r.current.pointer.controller.onPointerUp({ x: 0, y: 0 });
  });
}

const picked = (r: ReturnType<typeof mount>['result']): string[] => [...r.current.state.selection].sort();

afterEach(() => localStorage.clear());

describe('고무줄이 담는 것 — 종류를 가리지 않는다', () => {
  it('휠체어·화살표·도형을 **한 번에** 담는다', () => {
    const { drill, chairId } = makeDrill();
    const { result } = mount(drill);
    sweep(result, { x: 100, y: 60 }, { x: 700, y: 450 });
    expect(picked(result)).toEqual([AR, SH, chairId].sort());
  });

  // ★ 회귀 못. 이 둘이 빠져 있던 것이 기현님이 신고한 그 증상이다.
  it('화살표만 훑어도 잡힌다', () => {
    const { result } = mount(makeDrill().drill);
    sweep(result, { x: 250, y: 300 }, { x: 350, y: 440 });
    expect(picked(result)).toEqual([AR]);
  });

  it('도형만 훑어도 잡힌다', () => {
    const { result } = mount(makeDrill().drill);
    sweep(result, { x: 520, y: 60 }, { x: 680, y: 240 });
    expect(picked(result)).toEqual([SH]);
  });

  // 화살표의 대표점은 **곡선 위**(t=0.5)다. 세 점을 다 덮어야 잡히는 것도 아니고, 세 점의
  // 무게중심처럼 곡선 밖 아무 데나도 아니다 — 보이는 선의 한가운데다.
  it('화살표는 **한가운데**로 판정한다 — 시작점만 덮으면 안 잡힌다', () => {
    const { result } = mount(makeDrill().drill);
    sweep(result, { x: 100, y: 300 }, { x: 200, y: 440 }); // from(150,400)만 덮는 사각형
    expect(picked(result)).toEqual([]);
    sweep(result, { x: ARROW_MID.x - 50, y: ARROW_MID.y - 100 }, { x: ARROW_MID.x + 50, y: ARROW_MID.y + 40 });
    expect(picked(result)).toEqual([AR]);
  });

  // 덩어리로 집는 세 길(고무줄·Ctrl+A·같은 것 전부)이 모두 지키는 규칙(§6.10b).
  it('잠긴 것은 안 담긴다 — 작도 개체도 예외가 아니다', () => {
    const { drill, chairId } = makeDrill({ lockedIds: [AR, SH] });
    const { result } = mount(drill);
    sweep(result, { x: 100, y: 60 }, { x: 700, y: 450 });
    expect(picked(result)).toEqual([chairId]);
  });
});
