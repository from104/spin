// §4.3 P1-2 [A-3] — 선택 해제 대체 경로 (로드맵 1.7).
//
// 2단 히트(1.6)가 켜지면 붐비는 코트에서 "44 CSS px 밖 빈 곳"이 사라져, 기존의 유일한
// 포인터 해제 수단(빈 코트 탭 → SELECT_CLEAR)이 통째로 없어진다. 그래서 해제 경로를
// 두 개 따로 만든다:
//   ① **선택된 개체 재탭 = 해제** — additive(Shift/Meta) 아님 + 탭 임계(tapMaxMoveCssPx)
//      안에서 손을 뗌 + pointercancel 아님, 일 때만. 움직였으면 그건 드래그다.
//   ② **Esc = 해제(전역)** — useEditorKeyboard 의 onSelectionClear 배선.
// 350ms/12px 안의 빠른 재탭은 이 층에 도달하지 않는다 — CourtStage 가 더블클릭 팬 무장으로
// 먼저 삼킨다(P2-1 이 그 계약을 명시적으로 남긴다). 여기서는 컨트롤러를 직접 부르므로
// 그 층의 간섭 없이 ①②의 의미론만 잰다.
//
// 포인터 사건을 DOM 에 쏘지 않고 controller 를 직접 부른다 — jsdom 은 getBoundingClientRect
// 가 전부 0 이라 client→world 변환이 NaN 이 된다(settle.test.tsx 머리말과 같은 이유).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useRef } from 'react';
import type { ReactNode } from 'react';
import { BALL, DEFAULT_ZONES } from '../../core/constants.ts';
import { newId } from '../../core/ids.ts';
import type { ArrowId, BallId, ChairId, ConeId, NoteId } from '../../core/ids.ts';
import { createDrill } from '../../model/defaults.ts';
import type { BallRing, Drill, DrillStep } from '../../model/drill.ts';
import { ballRingOf } from '../../model/drill.ts';
import type { CourtStageHandle, PointerMeta } from '../../render/CourtStage.tsx';
import { SettingsProvider } from '../../store/settings/SettingsProvider.tsx';
import {
  EditorProvider,
  useEditorDispatch,
  useEditorState,
  useEditorWorld,
  useEditorWriter,
} from '../../store/editor/EditorProvider.tsx';
import { useEditorKeyboard } from './useEditorKeyboard.ts';
import { useEditorPointer } from './useEditorPointer.ts';

const META: PointerMeta = { pointerType: 'touch', button: 0, shiftKey: false, metaKey: false, ctrlKey: false, altKey: false };
/** pointerup 의 화면 좌표 — 값 자체는 트레이 판정(isOverTray)에만 쓰이고 jsdom 에서는 늘
 *  false 다. null 이 아니라는 것이 중요하다: null 은 pointercancel 이라 탭이 아니다. */
const CLIENT = { x: 10, y: 10 };

const CHAIR_AT = { x: 200, y: 240, angleDeg: 0 };
const NOTE_AT = { x: 500, y: 150 };
/** 화살표는 수평 직선 — 몸통 탭 지점(325,350)이 세 핸들(from·ctrl·to)에서 25px 씩 떨어져
 *  있어 handleHitRadiusCssPx(22) 밖이다. 재탭이 arrowHandle 로 새면 이 테스트가 무너진다. */
const ARROW = { from: { x: 300, y: 350 }, ctrl: { x: 350, y: 350 }, to: { x: 400, y: 350 } };
const ARROW_TAP = { x: 325, y: 350 };

/** 휠체어 1 + 메모 1 + 화살표 1. 서로 22 월드 px(2차 패스 반경, s=1) 밖에 두어 재탭이
 *  이웃을 잡는 사고가 없다. */
function makeDrill(): { drill: Drill; chairId: ChairId; noteId: NoteId; arrowId: ArrowId } {
  const base = createDrill({ courtMode: 'full', formation: '1-2-1' });
  const chairId = base.cast.chairs[0]!.id;
  const noteId = newId('nt');
  const arrowId = newId('ar');
  const step0 = base.steps[0]!;
  const step: DrillStep = {
    ...step0,
    chairs: { [chairId]: { ...CHAIR_AT } },
    balls: {},
    cones: {},
    notes: [{ id: noteId, x: NOTE_AT.x, y: NOTE_AT.y, text: '메모' }],
    arrows: [{ id: arrowId, ...ARROW }],
  };
  return { chairId, noteId, arrowId, drill: { ...base, steps: [step] } };
}

/** 붐비는 코트 — 콘 15개를 30px 격자로 깐다. 격자 셀 중심(콘들에서 21.2px)조차 2차 패스
 *  반경 22px 안이라, 이 영역에는 hitTest 가 null 을 돌려주는 "빈 곳"이 존재하지 않는다
 *  = 러버밴드 탭으로는 해제가 불가능하다. 콘 간격 30px 은 콘 반지름(3.125)의 4배가 넘어
 *  물리 접촉이 없고, 바디가 저절로 밀려 좌표가 흔들리는 일도 없다. */
function makeCrowdedDrill(): { drill: Drill; coneIds: ConeId[] } {
  const base = createDrill({ courtMode: 'full', formation: '1-2-1', empty: true });
  const coneIds: ConeId[] = [];
  const cones: Record<string, { x: number; y: number }> = {};
  const defs: Array<{ id: ConeId; colorIndex: 0 | 1 }> = [];
  for (const y of [210, 240, 270]) {
    for (const x of [160, 190, 220, 250, 280]) {
      const id = newId('cn');
      coneIds.push(id);
      defs.push({ id, colorIndex: 0 });
      cones[id] = { x, y };
    }
  }
  const step0 = base.steps[0]!;
  return {
    coneIds,
    drill: { ...base, cast: { ...base.cast, cones: defs }, steps: [{ ...step0, cones }] },
  };
}

const noop = () => {};

function useHarness() {
  const state = useEditorState();
  const dispatch = useEditorDispatch();
  const worldRef = useEditorWorld();
  const writer = useEditorWriter();
  // 무대 핸들 없음 → pxPerUnit=1 (settle.test.tsx 와 같은 산수: 탭 임계 6 CSS px = 6 월드 px).
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
  // ② Esc = 해제 — EditorWorkspace 의 배선(onSelectionClear → SELECT_CLEAR)을 그대로 재현.
  useEditorKeyboard({
    tool: 'select',
    singleKeyMode: 'on',
    onSelectTool: noop,
    onPanView: noop,
    onConeToggle: noop,
    onUndo: noop,
    onRedo: noop,
    onSave: noop,
    onDuplicateStep: noop,
    onDuplicateObjects: () => false,
    onPrevStep: noop,
    onNextStep: noop,
    onTogglePlay: noop,
    onToggleGrid: noop,
    onToggleRuleZones: noop,
    onZoomIn: noop,
    onZoomOut: noop,
    onZoomReset: noop,
    onEraseSelection: noop,
    onShowHelp: noop,
    onSelectionClear: () => dispatch({ type: 'SELECT_CLEAR' }),
    onSelectAll: noop,
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

type Harness = ReturnType<typeof mount>['result'];

/** 제자리 탭 — down 과 up 사이에 이동이 없다. */
function tap(result: Harness, p: { x: number; y: number }, meta: PointerMeta = META) {
  act(() => void result.current.pointer.controller.onPointerDown(p, meta));
  act(() => result.current.pointer.controller.onPointerUp(CLIENT));
}

function pressEscape() {
  act(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true }));
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('[A-3] ① 선택된 개체 재탭 = 해제', () => {
  it('휠체어: 탭 → 선택, 같은 자리 재탭 → 해제. undo 스택은 더럽히지 않는다', () => {
    const { drill, chairId } = makeDrill();
    const { result } = mount(drill);

    tap(result, CHAIR_AT);
    expect(result.current.state.selection.has(chairId)).toBe(true);

    tap(result, CHAIR_AT);
    expect(result.current.state.selection.size).toBe(0);
    // 이동 없는 탭 두 번은 커밋 no-op 가드로 걸러진다 — 해제가 undo 한 칸을 먹으면 안 된다.
    expect(result.current.state.past).toHaveLength(0);
  });

  it('탭 임계(6 CSS px) 안의 미세한 떨림은 여전히 탭이다 — 손이 떨려도 해제된다', () => {
    const { drill, chairId } = makeDrill();
    const { result } = mount(drill);
    const ctrl = () => result.current.pointer.controller;

    tap(result, CHAIR_AT);
    expect(result.current.state.selection.has(chairId)).toBe(true);

    act(() => void ctrl().onPointerDown(CHAIR_AT, META));
    act(() => ctrl().onPointerMove({ x: CHAIR_AT.x + 3, y: CHAIR_AT.y }, 16));
    act(() => ctrl().onPointerUp(CLIENT));
    expect(result.current.state.selection.size).toBe(0);
  });

  it('임계를 넘겨 움직였으면 드래그다 — 제자리로 돌아와 놓아도 선택은 그대로다', () => {
    const { drill, chairId } = makeDrill();
    const { result } = mount(drill);
    const ctrl = () => result.current.pointer.controller;

    tap(result, CHAIR_AT);
    expect(result.current.state.selection.has(chairId)).toBe(true);

    act(() => void ctrl().onPointerDown(CHAIR_AT, META));
    act(() => ctrl().onPointerMove({ x: CHAIR_AT.x + 30, y: CHAIR_AT.y }, 16));
    // 한 번 넘었으면 되돌아와도 드래그다 — moved 는 끈적하게 남는다.
    act(() => ctrl().onPointerMove(CHAIR_AT, 32));
    act(() => ctrl().onPointerUp(CLIENT));
    expect(result.current.state.selection.has(chairId)).toBe(true);
  });

  it('pointercancel(client=null) 은 탭이 아니다 — 시스템 제스처에 뺏겨도 선택이 살아 있다', () => {
    const { drill, chairId } = makeDrill();
    const { result } = mount(drill);
    const ctrl = () => result.current.pointer.controller;

    tap(result, CHAIR_AT);
    act(() => void ctrl().onPointerDown(CHAIR_AT, META));
    act(() => ctrl().onPointerUp(null));
    expect(result.current.state.selection.has(chairId)).toBe(true);
  });

  it('additive(Shift) 재탭은 이 경로가 아니다 — pointerdown 의 토글(기존 계약)이 처리한다', () => {
    const { drill, chairId } = makeDrill();
    const { result } = mount(drill);

    tap(result, CHAIR_AT);
    expect(result.current.state.selection.has(chairId)).toBe(true);

    tap(result, CHAIR_AT, { ...META, shiftKey: true });
    expect(result.current.state.selection.size).toBe(0);
  });

  it('메모: 재탭 → 해제, 끌면(NOTE_SET 경로) 선택 유지 — 개체 종류가 규칙을 바꾸지 않는다', () => {
    const { drill, noteId } = makeDrill();
    const { result } = mount(drill);
    const ctrl = () => result.current.pointer.controller;

    tap(result, NOTE_AT);
    expect(result.current.state.selection.has(noteId)).toBe(true);

    // 끌기 — 메모가 실제로 옮겨지고 선택은 남는다.
    act(() => void ctrl().onPointerDown(NOTE_AT, META));
    act(() => ctrl().onPointerMove({ x: NOTE_AT.x + 30, y: NOTE_AT.y }, 16));
    act(() => ctrl().onPointerUp(CLIENT));
    const moved = result.current.state.present.steps[0]!.notes.find((n) => n.id === noteId)!;
    expect(moved.x).toBeCloseTo(NOTE_AT.x + 30, 6);
    expect(result.current.state.selection.has(noteId)).toBe(true);

    // 옮겨진 자리에서 재탭 — 해제.
    tap(result, { x: moved.x, y: moved.y });
    expect(result.current.state.selection.size).toBe(0);
  });

  it('화살표: 몸통 재탭 → 해제 (핸들 22px 밖 지점 — arrowHandle 로 새지 않는다)', () => {
    const { drill, arrowId } = makeDrill();
    const { result } = mount(drill);

    tap(result, ARROW_TAP);
    expect(result.current.state.selection.has(arrowId)).toBe(true);

    tap(result, ARROW_TAP);
    expect(result.current.state.selection.size).toBe(0);
  });
});

// ── §7 5.2 — **공만 예외다**(2026-08-13 기현님 실기 ③) ─────────────────────────────────────
// 위 [A-3] 계약("선택된 개체 재탭 = 해제")을 **공에서만** 뒤집는다: 재탭이 거리 원을 돌린다.
//   탭① 선택(원 없음) → 탭② 3 m → 탭③ 5 m → 탭④ 원 없음 + 해제.
// 위 블록의 휠체어·메모·화살표·콘 테스트가 그대로 살아 있는 것이 이 예외의 **대조군**이다 —
// 저 넷이 함께 순환하기 시작하면 여기가 아니라 저기가 먼저 빨개진다.
describe('[A-3 예외 / 5.2] 선택된 **공** 재탭 = 원 순환', () => {
  const BALL_AT = { x: 400, y: 300 };

  /** 휠체어 1 + 공 1. 서로 100 px 떨어져 2차 패스 반경(22 px) 간섭이 없다. */
  function makeBallDrill(): { drill: Drill; ballId: BallId; chairId: ChairId } {
    const base = createDrill({ courtMode: 'full', formation: '1-2-1' });
    const chairId = base.cast.chairs[0]!.id;
    const ballId = base.cast.balls[0]!.id;
    const step0 = base.steps[0]!;
    const step: DrillStep = {
      ...step0,
      chairs: { [chairId]: { ...CHAIR_AT } },
      balls: { [ballId]: { ...BALL_AT } },
      cones: {},
      notes: [],
      arrows: [],
    };
    return { chairId, ballId, drill: { ...base, steps: [step] } };
  }

  const ringOf = (r: Harness, id: BallId): BallRing => ballRingOf(r.current.state.present.cast.balls.find((b) => b.id === id)!);

  it('탭 넷이 한 바퀴를 돈다 — 없음 → 3 m → 5 m → 없음 + 해제', () => {
    const { drill, ballId } = makeBallDrill();
    const { result } = mount(drill);

    tap(result, BALL_AT); // ① 선택만. 원은 아직 없다(초기 배치는 원 없음)
    expect(result.current.state.selection.has(ballId)).toBe(true);
    expect(ringOf(result, ballId)).toBe('none');

    tap(result, BALL_AT); // ②
    expect(ringOf(result, ballId)).toBe('3m');
    expect(result.current.state.selection.has(ballId)).toBe(true);

    tap(result, BALL_AT); // ③
    expect(ringOf(result, ballId)).toBe('5m');
    expect(result.current.state.selection.has(ballId)).toBe(true);

    tap(result, BALL_AT); // ④ 닫힌다
    expect(ringOf(result, ballId)).toBe('none');
    expect(result.current.state.selection.size).toBe(0);
  });

  it('★ 대조군: 같은 판의 **휠체어**는 여전히 재탭 = 즉시 해제이고, 공의 원을 건드리지 않는다', () => {
    const { drill, ballId, chairId } = makeBallDrill();
    const { result } = mount(drill);

    tap(result, BALL_AT);
    tap(result, BALL_AT); // 공을 3 m 로 켜 둔다
    expect(ringOf(result, ballId)).toBe('3m');

    tap(result, CHAIR_AT);
    expect(result.current.state.selection.has(chairId)).toBe(true);
    tap(result, CHAIR_AT); // 휠체어 재탭 — 순환이 아니라 해제다
    expect(result.current.state.selection.size).toBe(0);
    expect(ringOf(result, ballId)).toBe('3m'); // 남의 원은 그대로다
  });

  it('Esc 는 순환을 타지 않는다 — 어느 상태에서든 즉시 해제하고 원은 그대로 둔다', () => {
    const { drill, ballId } = makeBallDrill();
    const { result } = mount(drill);

    tap(result, BALL_AT);
    tap(result, BALL_AT); // 3 m
    pressEscape();
    expect(result.current.state.selection.size).toBe(0);
    expect(ringOf(result, ballId)).toBe('3m'); // **갇히는 길이 없다**: 5 m 를 남긴 채 빠져나올 수 있다

    // 다시 선택해도 원은 그 자리에서 이어진다 — 순환의 다음 칸은 5 m 다.
    tap(result, BALL_AT);
    expect(ringOf(result, ballId)).toBe('3m');
    tap(result, BALL_AT);
    expect(ringOf(result, ballId)).toBe('5m');
  });

  it('끌면 순환하지 않는다 — 드래그는 탭이 아니다', () => {
    const { drill, ballId } = makeBallDrill();
    const { result } = mount(drill);
    const ctrl = () => result.current.pointer.controller;

    tap(result, BALL_AT);
    act(() => void ctrl().onPointerDown(BALL_AT, META));
    act(() => ctrl().onPointerMove({ x: BALL_AT.x + 40, y: BALL_AT.y }, 16));
    act(() => ctrl().onPointerUp(CLIENT));
    expect(ringOf(result, ballId)).toBe('none');
    expect(result.current.state.selection.has(ballId)).toBe(true);
  });

  it('pointercancel 은 탭이 아니다 — 시스템 제스처에 뺏겼다고 원이 돌면 안 된다', () => {
    const { drill, ballId } = makeBallDrill();
    const { result } = mount(drill);
    const ctrl = () => result.current.pointer.controller;

    tap(result, BALL_AT);
    act(() => void ctrl().onPointerDown(BALL_AT, META));
    act(() => ctrl().onPointerUp(null));
    expect(ringOf(result, ballId)).toBe('none');
    expect(result.current.state.selection.has(ballId)).toBe(true);
  });

  it('additive(Shift) 재탭은 예전 그대로 토글 해제다 — 순환 경로가 아니다', () => {
    const { drill, ballId } = makeBallDrill();
    const { result } = mount(drill);

    tap(result, BALL_AT);
    tap(result, BALL_AT, { ...META, shiftKey: true });
    expect(result.current.state.selection.size).toBe(0);
    expect(ringOf(result, ballId)).toBe('none');
  });

  it('되돌리기가 순환을 한 칸씩 되돌린다', () => {
    const { drill, ballId } = makeBallDrill();
    const { result } = mount(drill);

    tap(result, BALL_AT);
    tap(result, BALL_AT); // 3m
    tap(result, BALL_AT); // 5m
    expect(ringOf(result, ballId)).toBe('5m');
    act(() => result.current.dispatch({ type: 'UNDO' }));
    expect(ringOf(result, ballId)).toBe('3m');
    act(() => result.current.dispatch({ type: 'UNDO' }));
    expect(ringOf(result, ballId)).toBe('none');
  });
});

describe('[A-3] ② 붐비는 코트 — 빈 곳이 없어도 해제가 가능하다 (완료 판정)', () => {
  /** 콘 격자의 셀 중심들 — 어느 콘에서도 21.2px 떨어진, 이 픽스처에서 가장 "빈" 자리들.
   *  전부 2차 패스 반경(22px) 안이라 탭하면 반드시 무언가 잡힌다. */
  const EMPTIEST = [
    { x: 235, y: 225 },
    { x: 205, y: 255 },
    { x: 265, y: 255 },
  ];

  it('가장 빈 자리를 탭해도 러버밴드 해제가 성립하지 않고, Esc 가 SELECT_CLEAR 한다', () => {
    const { drill } = makeCrowdedDrill();
    const { result } = mount(drill);

    // 코트 구석의 콘 하나를 선택해 둔다.
    tap(result, { x: 160, y: 210 });
    expect(result.current.state.selection.size).toBe(1);

    // "빈 곳 탭 → 해제" 시도 — 어디를 찍어도 2차 패스가 이웃 콘을 잡아 해제가 안 된다.
    for (const p of EMPTIEST) {
      tap(result, p);
      expect(result.current.state.selection.size, `(${p.x},${p.y}) 탭이 빈 코트로 떨어졌다`).toBe(1);
    }

    // Esc — 포인터와 무관한 전역 해제. 이것이 붐비는 코트의 유일한 "확실한" 해제 수단이다.
    pressEscape();
    expect(result.current.state.selection.size).toBe(0);
  });

  it('재탭 해제도 붐비는 코트에서 그대로 작동한다 — 두 대체 경로는 서로 독립이다', () => {
    const { drill, coneIds } = makeCrowdedDrill();
    const { result } = mount(drill);

    const corner = { x: 160, y: 210 };
    tap(result, corner);
    expect(result.current.state.selection.has(coneIds[0]!)).toBe(true);

    tap(result, corner);
    expect(result.current.state.selection.size).toBe(0);
  });
});
