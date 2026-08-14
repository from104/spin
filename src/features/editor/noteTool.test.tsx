// §4.3 P1-5 — "메모 도구 무반응" 의 나머지 두 겹을 **실제 경로**에서 잰다.
//
//  ① 놓인 쪽지가 **탭한 자리에** 그려지는가. `NoteLabel` 은 다른 개체와 똑같이
//     `writer.register` 로만 자리를 받는데, 메모는 물리 바디가 없어 `world.read()` 에도 없고
//     `poseFrame` 에도 빠져 있었다 — **아무도 메모의 transform 을 쓰지 않았다.** 결과: 코트
//     어디를 탭하든 쪽지는 viewBox 원점(판 왼쪽 위 마진)에 그려졌다.
//  ② `SelectionOverlay.setRing` 이 실제로 불리는가. 저장소 전체에 호출자가 **0** 이었다
//     (테스트 4곳 + 정의 2곳이 전부).
//
// 포인터 사건을 DOM 에 쏘지 않고 `controller` 를 직접 부르는 이유는 twoPassHit·settle 테스트
// 머리말과 같다(jsdom 의 getBoundingClientRect 가 전부 0 이라 client→world 가 NaN 이 된다).
// 무대 핸들이 없어 pxPerUnit 은 1 로 남는다 — 월드 1px = 화면 1px.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, renderHook } from '@testing-library/react';
import { useRef } from 'react';
import type { ReactNode } from 'react';
import { BALL, DEFAULT_ZONES } from '../../core/constants.ts';
import { newId } from '../../core/ids.ts';
import type { BallId, NoteId } from '../../core/ids.ts';
import { createDrill } from '../../model/defaults.ts';
import type { Drill } from '../../model/drill.ts';
import type { ToolId } from '../../physics/index.ts';
import type { CourtStageHandle, PointerMeta } from '../../render/CourtStage.tsx';
import type { SelectionOverlayHandle } from '../../render/SelectionOverlay.tsx';
import { ObjectLayer } from '../../render/ObjectLayer.tsx';
import { createTransformWriter } from '../../render/transformWriter.ts';
import { SettingsProvider } from '../../store/settings/SettingsProvider.tsx';
import { poseFrame } from '../../store/editor/tween.ts';
import { EditorProvider, useEditorDispatch, useEditorState, useEditorWorld, useEditorWriter } from '../../store/editor/EditorProvider.tsx';
import { useEditorPointer } from './useEditorPointer.ts';

const META: PointerMeta = { pointerType: 'mouse', button: 0, shiftKey: false, metaKey: false, ctrlKey: false, altKey: false };

/** 코트 한복판. viewBox 원점(0,0)에서 충분히 멀어야 "원점에 그려졌다" 와 구분된다. */
const TAP_AT = { x: 300, y: 200 };
const BALL_AT = { x: 120, y: 120 };

function makeDrill(notes: Array<{ id: NoteId; x: number; y: number; text: string }> = []): { drill: Drill; ball: BallId } {
  const base = createDrill({ courtMode: 'full', formation: '1-2-1' });
  const ball = base.cast.balls[0]!.id;
  const step0 = base.steps[0]!;
  return {
    ball,
    drill: { ...base, steps: [{ ...step0, chairs: {}, balls: { [ball]: BALL_AT }, cones: {}, arrows: [], notes }] },
  };
}

function useHarness(tool: ToolId) {
  const state = useEditorState();
  const dispatch = useEditorDispatch();
  const worldRef = useEditorWorld();
  const writer = useEditorWriter();
  const stageRef = useRef<CourtStageHandle | null>(null);
  const drill = state.present;
  const pointer = useEditorPointer({
    drill,
    stepIndex: 0,
    step: drill.steps[0]!,
    tool,
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

function mount(drill: Drill, tool: ToolId) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <SettingsProvider>
      <EditorProvider drill={drill}>{children}</EditorProvider>
    </SettingsProvider>
  );
  return renderHook(() => useHarness(tool), { wrapper });
}

/** 오버레이 전체를 스파이로 갈아 끼운다 — `setRing` 뿐 아니라 `setLeash`/`setGhost` 가
 *  **안 불리는 것**까지 봐야 "메모에는 링이 유일한 신호" 가 증명된다. */
function spyOverlay() {
  return {
    setRing: vi.fn<SelectionOverlayHandle['setRing']>(),
    setRubberBand: vi.fn<SelectionOverlayHandle['setRubberBand']>(),
    setLeash: vi.fn<SelectionOverlayHandle['setLeash']>(),
    setGhost: vi.fn<SelectionOverlayHandle['setGhost']>(),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('메모 도구 — 탭한 자리에 쪽지가 놓인다', () => {
  it('탭하면 그 좌표에 빈 메모가 생기고 곧바로 선택된다', () => {
    const { drill } = makeDrill();
    const { result } = mount(drill, 'note');
    act(() => void result.current.pointer.controller.onPointerDown(TAP_AT, META));

    const notes = result.current.state.present.steps[0]!.notes;
    expect(notes).toHaveLength(1);
    expect({ x: notes[0]!.x, y: notes[0]!.y }).toEqual(TAP_AT);
    expect(notes[0]!.text).toBe('');
    expect(Array.from(result.current.state.selection)).toEqual([notes[0]!.id]);
  });

  it('그 쪽지가 **탭한 좌표에** 그려진다 — poseFrame 이 메모를 흘려보낸다', () => {
    const { drill } = makeDrill();
    const { result } = mount(drill, 'note');
    act(() => void result.current.pointer.controller.onPointerDown(TAP_AT, META));
    const step = result.current.state.present.steps[0]!;
    const noteId = step.notes[0]!.id;

    // ① EditorStage 가 ObjectLayer 에 넘기는 initialFrame 이 곧 poseFrame(step) 이다.
    //    메모가 여기 없으면 아래 transform 이 통째로 null 이 되어 판 왼쪽 위 원점에 그려진다.
    const frame = poseFrame(step);
    expect(frame[noteId]).toEqual({ x: TAP_AT.x, y: TAP_AT.y, theta: 0 });

    // ② 같은 조합을 실제로 그려 본다.
    const writer = createTransformWriter();
    const { container } = render(
      <svg>
        <ObjectLayer
          writer={writer}
          chairs={[]}
          balls={[]}
          cones={[]}
          notes={step.notes}
          arrows={[]}
          markerUid="uid"
          selection={new Set([noteId])}
          activeId={null}
          initialFrame={frame}
        />
      </svg>,
    );
    const g = container.querySelector(`#obj-${noteId}`)!;
    expect(g.getAttribute('transform')).toBe(`translate(${TAP_AT.x.toFixed(2)} ${TAP_AT.y.toFixed(2)}) rotate(0.00)`);
    // 쪽지 배경과 선택 링이 둘 다 그 자리에 있다 — (a)·(b) 가 배치 경로 끝에서도 참이다.
    expect(g.querySelector('.note-chip')).not.toBeNull();
    expect(g.querySelector('.sel-ring')).not.toBeNull();
  });
});

describe('SelectionOverlay.setRing — 호출자가 생겼다', () => {
  it('메모를 잡으면 링이 뜨고, 끌면 따라오고, 놓으면 사라진다', () => {
    const noteId = newId('nt');
    const { drill } = makeDrill([{ id: noteId, x: TAP_AT.x, y: TAP_AT.y, text: '' }]);
    const { result } = mount(drill, 'select');
    const overlay = spyOverlay();
    result.current.pointer.selectionOverlayRef.current = overlay;
    const ctrl = () => result.current.pointer.controller;

    act(() => void ctrl().onPointerDown(TAP_AT, META));
    expect(overlay.setRing).toHaveBeenCalledWith('note', TAP_AT.x, TAP_AT.y, 0);

    act(() => ctrl().onPointerMove({ x: TAP_AT.x + 30, y: TAP_AT.y + 10 }, 0));
    expect(overlay.setRing).toHaveBeenLastCalledWith('note', TAP_AT.x + 30, TAP_AT.y + 10, 0);
    // 메모는 물리 바디가 없어 리시도 고스트도 안 뜬다 — 링이 유일한 '잡았다' 신호라는 근거.
    expect(overlay.setLeash).not.toHaveBeenCalled();
    expect(overlay.setGhost).not.toHaveBeenCalled();

    act(() => ctrl().onPointerUp({ x: 0, y: 0 }));
    expect(overlay.setRing).toHaveBeenLastCalledWith(null, 0, 0, 0);
  });

  it('메모만이 아니다 — 물리 드래그(공)에서도 잡은 것의 링을 오버레이가 그린다', () => {
    const { drill } = makeDrill();
    const { result } = mount(drill, 'select');
    const overlay = spyOverlay();
    result.current.pointer.selectionOverlayRef.current = overlay;
    const ctrl = () => result.current.pointer.controller;

    act(() => void ctrl().onPointerDown(BALL_AT, META));
    expect(overlay.setRing).toHaveBeenCalledWith('ball', BALL_AT.x, BALL_AT.y, 0);

    act(() => ctrl().onPointerUp(null)); // pointercancel 경로도 같은 정리를 탄다
    expect(overlay.setRing).toHaveBeenLastCalledWith(null, 0, 0, 0);
  });

  it('빈 코트 탭(=러버밴드)은 링을 켜지 않는다 — 링은 "잡은 것" 의 표시다', () => {
    const { drill } = makeDrill();
    const { result } = mount(drill, 'select');
    const overlay = spyOverlay();
    result.current.pointer.selectionOverlayRef.current = overlay;
    const ctrl = () => result.current.pointer.controller;

    act(() => void ctrl().onPointerDown({ x: 700, y: 480 }, META)); // 개체에서 멀리(2차 반경 22 밖)
    act(() => ctrl().onPointerUp({ x: 0, y: 0 }));
    expect(overlay.setRing).not.toHaveBeenCalled();
    expect(overlay.setRubberBand).toHaveBeenCalled();
  });
});
