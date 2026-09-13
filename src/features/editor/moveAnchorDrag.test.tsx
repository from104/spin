// §6.10d 이동 앵커 — 누르면 **고른 것이 통째로 따라오는가**. 2026-09-13 기현님 지시에서 나왔다:
// *"도형, 메모, 다중 선택에서 객체가 겹쳐 있으면 집어 드래그로 옮기기가 쉽지 않더라."*
//
// 앵커의 자리(화면 위/아래)는 `moveAnchorPlacement.test.ts` 가, 언제 뜨는지는
// `moveAnchorIds.test.ts` 가 잰다. 여기서 재는 것은 **그 누름이 실제로 무엇을 하는가** 하나다.
// 지우면 새는 것: 앵커가 떠 있는데 눌러도 안 움직이는 회귀, 그리고 앵커가 히트테스트를 타서
// 밑에 깔린 남의 개체를 잡는 회귀 — 후자는 이 기능의 존재 이유 자체를 무너뜨린다.
//
// 포인터 사건을 DOM 에 쏘지 않고 controller 를 직접 부른다 — jsdom 은 getBoundingClientRect 가
// 전부 0 이라 client→world 변환이 NaN 이 된다(tapDeselect.test.tsx 머리말과 같은 이유).
// 무대 핸들이 없으므로 pxPerUnit=1 이고, 탭 임계는 6 CSS px = 6 월드 px 이다.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useRef } from 'react';
import type { ReactNode } from 'react';
import { BALL, DEFAULT_ZONES } from '../../core/constants.ts';
import { newId } from '../../core/ids.ts';
import type { NoteId, ShapeId } from '../../core/ids.ts';
import { createDrill } from '../../model/defaults.ts';
import type { Drill, DrillStep } from '../../model/drill.ts';
import type { CourtStageHandle, PointerMeta } from '../../render/CourtStage.tsx';
import { SettingsProvider } from '../../store/settings/SettingsProvider.tsx';
import { EditorProvider, useEditorDispatch, useEditorState, useEditorWorld, useEditorWriter } from '../../store/editor/EditorProvider.tsx';
import { useEditorPointer } from './useEditorPointer.ts';

const META: PointerMeta = { pointerType: 'touch', button: 0, shiftKey: false, metaKey: false, ctrlKey: false, altKey: false };
const ANCHOR_META: PointerMeta = { ...META, moveAnchor: true };
const CLIENT = { x: 10, y: 10 };

/** 앵커를 누르는 자리는 개체 **위쪽 허공**이다 — 실제 앵커가 뜨는 곳이고, 히트테스트를 타면
 *  아무것도 안 잡히는 곳이기도 하다. 그런데도 움직여야 한다는 것이 이 테스트의 요지다. */
const ANCHOR_AT = { x: 300, y: 160 };
const SHAPE_AT = { x: 300, y: 220 };
const NOTE_AT = { x: 320, y: 240 };

function makeDrill(): { drill: Drill; shapeId: ShapeId; underId: ShapeId; noteId: NoteId } {
  const base = createDrill({ courtMode: 'full', formation: '1-2-1', empty: true });
  const shapeId = newId('sh');
  const underId = newId('sh');
  const noteId = newId('nt');
  const step0 = base.steps[0]!;
  const step: DrillStep = {
    ...step0,
    // 두 도형을 **같은 자리에** 겹쳐 둔다 — 몸통을 집으면 위엣것이 손을 먹는 그 상황이다.
    shapes: [
      { id: underId, kind: 'rect', x: SHAPE_AT.x, y: SHAPE_AT.y, w: 80, h: 60, rot: 0 },
      { id: shapeId, kind: 'rect', x: SHAPE_AT.x, y: SHAPE_AT.y, w: 80, h: 60, rot: 0 },
    ],
    notes: [{ id: noteId, x: NOTE_AT.x, y: NOTE_AT.y, text: '메모' }],
  };
  return { drill: { ...base, steps: [step] }, shapeId, underId, noteId };
}

const noop = () => {};

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
    forceHandlesVisible: false,
    largeTargets: false,
  });
  return { state, dispatch, pointer };
}

function mount(drill: Drill) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <SettingsProvider>
      <EditorProvider drill={drill}>{children}</EditorProvider>
    </SettingsProvider>
  );
  return renderHook(() => useHarness(), { wrapper });
}

type Harness = ReturnType<typeof mount>['result'];

/** 앵커를 눌러 dx 만큼 끌고 손을 뗀다. 한 번의 이동이 탭 임계(6)를 넘어야 실제로 밀린다. */
function dragAnchor(result: Harness, dx: number, dy = 0) {
  const ctrl = () => result.current.pointer.controller;
  act(() => void ctrl().onPointerDown(ANCHOR_AT, ANCHOR_META));
  act(() => ctrl().onPointerMove({ x: ANCHOR_AT.x + dx, y: ANCHOR_AT.y + dy }, performance.now()));
  act(() => ctrl().onPointerUp(CLIENT));
}

const shapeOf = (result: Harness, id: string) => result.current.state.present.steps[0]!.shapes.find((s) => s.id === id)!;
const noteOf = (result: Harness, id: string) => result.current.state.present.steps[0]!.notes.find((n) => n.id === id)!;

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('이동 앵커 — 누르면 고른 것이 따라온다', () => {
  it('겹친 도형 중 **고른 것만** 옮긴다 — 앵커는 히트테스트를 타지 않으므로 밑에 깔린 것은 그대로다', () => {
    const { drill, shapeId, underId } = makeDrill();
    const { result } = mount(drill);
    act(() => void result.current.dispatch({ type: 'SELECT_SET', ids: [shapeId] }));

    dragAnchor(result, 40);

    expect(shapeOf(result, shapeId).x, '고른 도형은 40 만큼 갔다').toBe(SHAPE_AT.x + 40);
    expect(shapeOf(result, underId).x, '밑에 깔린 도형은 제자리다').toBe(SHAPE_AT.x);
  });

  it('메모 하나도 같은 길로 옮겨진다', () => {
    const { drill, noteId } = makeDrill();
    const { result } = mount(drill);
    act(() => void result.current.dispatch({ type: 'SELECT_SET', ids: [noteId] }));

    dragAnchor(result, 0, 30);

    expect(noteOf(result, noteId).y).toBe(NOTE_AT.y + 30);
  });

  it('여럿을 골랐으면 통째로 — 도형과 메모가 같은 거리만큼 간다', () => {
    const { drill, shapeId, noteId } = makeDrill();
    const { result } = mount(drill);
    act(() => void result.current.dispatch({ type: 'SELECT_SET', ids: [shapeId, noteId] }));

    dragAnchor(result, 25);

    expect(shapeOf(result, shapeId).x).toBe(SHAPE_AT.x + 25);
    expect(noteOf(result, noteId).x).toBe(NOTE_AT.x + 25);
  });

  it('탭 임계(6) 안의 떨림으로는 한 톨도 안 움직인다 — 누르기만 한 손이 판을 흔들면 안 된다', () => {
    const { drill, shapeId } = makeDrill();
    const { result } = mount(drill);
    act(() => void result.current.dispatch({ type: 'SELECT_SET', ids: [shapeId] }));

    dragAnchor(result, 4);

    expect(shapeOf(result, shapeId).x).toBe(SHAPE_AT.x);
  });

  it('앵커 누름은 선택을 바꾸지 않는다 — 허공을 눌렀다고 선택이 풀리면 옮길 것이 사라진다', () => {
    const { drill, shapeId, noteId } = makeDrill();
    const { result } = mount(drill);
    act(() => void result.current.dispatch({ type: 'SELECT_SET', ids: [shapeId, noteId] }));

    dragAnchor(result, 25);

    expect(result.current.state.selection.size).toBe(2);
  });
});
