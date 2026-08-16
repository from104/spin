// §6.10c 트레이로 끌어다 놓기 — **어떤 손짓이 무엇을 치우는가**.
//
// > 2026-08-16 기현 지시: *"객체 선택 후 트레이로 끌고가면 빠지거나 지울 수 있는데 시각적
// > 효과를 직관적으로 만들어줘. 적절한 소리도 나게해줘."*
//
// 그 지시를 받고 보니 **그 문장이 절반만 참이었다**: 트레이 드롭은 물리로 끌리는 셋(칩·공·콘)
// 에만 붙어 있었고, 여럿을 골라 끌거나 메모·화살표를 끌면 트레이 위에서 손을 떼도 아무 일도
// 안 났다. 같은 손짓이 개체 종류와 개수에 따라 되기도 하고 안 되기도 하면 배울 수 없는
// 규칙이 된다 — 예고를 붙이면 그 어긋남이 **눈에 보이는 거짓말**이 되므로(트레이가 빛나는데
// 놓으면 아무 일도 안 난다) 함께 닫았다. 이 파일이 그 목록을 못 박는다.
//
// 포인터 사건을 DOM 에 쏘지 않고 `controller` 를 직접 부르는 이유는 rubberBand 테스트와 같다.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useRef } from 'react';
import type { ReactNode } from 'react';
import { BALL, DEFAULT_ZONES } from '../../core/constants.ts';
import type { ArrowId, ChairId, NoteId } from '../../core/ids.ts';
import { createDrill } from '../../model/defaults.ts';
import type { Drill } from '../../model/drill.ts';
import type { CourtStageHandle, PointerMeta } from '../../render/CourtStage.tsx';
import { SettingsProvider } from '../../store/settings/SettingsProvider.tsx';
import { EditorProvider, useEditorDispatch, useEditorState, useEditorWorld, useEditorWriter } from '../../store/editor/EditorProvider.tsx';
import { useEditorPointer } from './useEditorPointer.ts';

const META: PointerMeta = { pointerType: 'mouse', button: 0, shiftKey: false, metaKey: false, ctrlKey: false, altKey: false };
/** 손을 뗀 화면 좌표. 값 자체는 안 쓰이고 **null 이 아님**이 중요하다(null = pointercancel). */
const CLIENT = { x: 10, y: 10 };

const NT = 'nt_t1' as NoteId;
const AR = 'ar_t1' as ArrowId;

const CHAIR_AT = { x: 200, y: 150 };
const NOTE_AT = { x: 400, y: 150 };
/** 가로로 긴 화살표. 몸통을 잡을 자리(250,400)가 세 점 어디에서도 멀어야 한다. */
const ARROW = { from: { x: 150, y: 400 }, ctrl: { x: 300, y: 400 }, to: { x: 450, y: 400 } };

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
          notes: [{ id: NT, x: NOTE_AT.x, y: NOTE_AT.y, text: '메모' }],
          arrows: [{ id: AR, ...ARROW }],
          shapes: [],
          locked: over.lockedIds,
        },
      ],
    },
  };
}

let erased: string[][] = [];

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
    // 실제 치우기는 EditorWorkspace.eraseIds 다 — 여기서는 **위임이 일어났는지**만 본다.
    // 일부러 모델을 안 건드린다: 그래야 "치우기 직전에 이동이 물려 있었는가" 를 잴 수 있다.
    onEraseIds: (ids) => erased.push(ids),
    showToast: () => {},
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

let tray: HTMLElement;

beforeEach(() => {
  erased = [];
  tray = document.createElement('nav');
  tray.setAttribute('data-tray', '');
  tray.innerHTML = '<div data-tray-hint=""></div>';
  document.body.appendChild(tray);
  // jsdom 에는 레이아웃이 없다 — 이 스텁이 곧 "손이 트레이 위" 다(test/setup.ts 의 그것을 덮는다).
  document.elementFromPoint = () => tray;
});

afterEach(() => {
  document.elementFromPoint = () => null;
  tray.remove();
  localStorage.clear();
});

/** 잡고 → 끌고 → 트레이 위에서 뗀다. 화면 좌표를 함께 넘겨 예고 경로까지 태운다. */
function dragToTray(r: ReturnType<typeof mount>['result'], from: { x: number; y: number }, to: { x: number; y: number }): void {
  act(() => {
    r.current.pointer.controller.onPointerDown(from, META);
  });
  act(() => {
    r.current.pointer.controller.onPointerMove(to, 16, CLIENT);
  });
  act(() => {
    r.current.pointer.controller.onPointerUp(CLIENT);
  });
}

describe('트레이 드롭 — 무엇이 실려 가는가', () => {
  it('여럿 고른 뒤 하나를 끌면 **고른 것 전부**가 치우기로 간다', () => {
    const { drill, chairId } = makeDrill();
    const { result } = mount(drill);
    act(() => result.current.dispatch({ type: 'SELECT_SET', ids: [chairId, NT] }));
    dragToTray(result, CHAIR_AT, { x: 260, y: 200 });
    expect(erased).toHaveLength(1);
    expect([...erased[0]!].sort()).toEqual([chairId, NT].sort());
  });

  // ★ 회귀 못 ①. 메모는 물리 바디가 없어 다른 갈래로 끌린다 — 그 갈래에 트레이 판정이
  //   아예 없었다. 하나만 끌면 아무 일도 안 나는데 둘 이상 고르면 치워지는 상태였다.
  it('메모 하나만 끌어다 놓아도 치워진다', () => {
    const { result } = mount(makeDrill().drill);
    dragToTray(result, NOTE_AT, { x: 440, y: 200 });
    expect(erased).toEqual([[NT]]);
  });

  // ★ 회귀 못 ②. 화살표 몸통도 같다.
  it('화살표 몸통을 끌어다 놓아도 치워진다', () => {
    const { result } = mount(makeDrill().drill);
    dragToTray(result, { x: 250, y: 400 }, { x: 290, y: 430 });
    expect(erased).toEqual([[AR]]);
  });

  // 잠긴 것은 덩어리로 집는 모든 길에서 빠진다(§6.10b) — 끌어서 치우는 길도 예외가 아니다.
  // 안 그러면 "못 움직이는데 치워지는" 개체가 생긴다.
  it('잠긴 것은 짐에 안 실린다', () => {
    const { drill, chairId } = makeDrill({ lockedIds: [NT] });
    const { result } = mount(drill);
    act(() => result.current.dispatch({ type: 'SELECT_SET', ids: [chairId, NT] }));
    dragToTray(result, CHAIR_AT, { x: 260, y: 200 });
    expect(erased).toEqual([[chairId]]);
  });

  // 모양을 고치는 손짓은 개체를 **든 것이 아니다**. 트레이 위에서 손을 떼도 아무 일이 없어야
  // 하고, 그래서 예고도 안 뜬다 — 뜨는데 아무 일도 안 나는 것이 안 뜨는 것보다 나쁘다.
  it('빈 코트를 훑는 손짓(고무줄)은 트레이 위에서 떼도 아무것도 안 치운다', () => {
    const { result } = mount(makeDrill().drill);
    dragToTray(result, { x: 600, y: 250 }, { x: 700, y: 330 });
    expect(erased).toEqual([]);
    expect(tray.hasAttribute('data-drop')).toBe(false);
  });
});

describe('치우기 직전에 이동을 물린다 — 되돌리기가 **원래 자리**로 돌려놔야 한다', () => {
  // 덩어리 이동·메모·화살표는 끄는 동안 매 프레임 모델을 옮긴다. 그대로 치우면 되돌리기 한
  // 번은 개체를 **트레이 문턱에** 되살린다 — 코치가 방금 되돌린 것은 그 자리가 아니다.
  it('덩어리로 끌어다 놓으면 모델 좌표가 출발점 그대로다', () => {
    const { drill, chairId } = makeDrill();
    const { result } = mount(drill);
    act(() => result.current.dispatch({ type: 'SELECT_SET', ids: [chairId, NT] }));
    dragToTray(result, CHAIR_AT, { x: 260, y: 200 });
    const step = result.current.state.present.steps[0]!;
    expect(step.notes.find((n) => n.id === NT)).toMatchObject({ x: NOTE_AT.x, y: NOTE_AT.y });
    expect(step.chairs[chairId as ChairId]).toMatchObject({ x: CHAIR_AT.x, y: CHAIR_AT.y });
  });

  it('메모를 끌어다 놓으면 메모가 출발점 그대로다', () => {
    const { result } = mount(makeDrill().drill);
    dragToTray(result, NOTE_AT, { x: 440, y: 200 });
    expect(result.current.state.present.steps[0]!.notes.find((n) => n.id === NT)).toMatchObject({ x: NOTE_AT.x, y: NOTE_AT.y });
  });

  it('화살표를 끌어다 놓으면 세 점이 출발점 그대로다', () => {
    const { result } = mount(makeDrill().drill);
    dragToTray(result, { x: 250, y: 400 }, { x: 290, y: 430 });
    expect(result.current.state.present.steps[0]!.arrows.find((a) => a.id === AR)).toMatchObject(ARROW);
  });
});

describe('예고 덮개 — 반드시 꺼진다', () => {
  it('끄는 동안 켜지고, 손을 떼면 꺼진다', () => {
    const { result } = mount(makeDrill().drill);
    act(() => {
      result.current.pointer.controller.onPointerDown(NOTE_AT, META);
    });
    act(() => {
      result.current.pointer.controller.onPointerMove({ x: 440, y: 200 }, 16, CLIENT);
    });
    expect(tray.getAttribute('data-drop')).toBe('erase'); // 메모는 돌아갈 상자가 없다
    expect(tray.querySelector('[data-tray-hint]')!.textContent).toBe('놓으면 삭제');
    act(() => {
      result.current.pointer.controller.onPointerUp(CLIENT);
    });
    expect(tray.hasAttribute('data-drop')).toBe(false);
  });

  // pointercancel 은 놓은 것이 아니라 **뺏긴 것**이다 — 개체도 안 치우고 덮개도 걷는다.
  it('시스템 제스처에 뺏겨도 덮개가 걷히고 아무것도 안 치운다', () => {
    const { result } = mount(makeDrill().drill);
    act(() => {
      result.current.pointer.controller.onPointerDown(NOTE_AT, META);
    });
    act(() => {
      result.current.pointer.controller.onPointerMove({ x: 440, y: 200 }, 16, CLIENT);
    });
    act(() => {
      result.current.pointer.controller.onPointerUp(null);
    });
    expect(erased).toEqual([]);
    expect(tray.hasAttribute('data-drop')).toBe(false);
  });
});
