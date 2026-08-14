// §4.3 P1-4 배선 — "놓으면 소리가 나고 손끝이 울린다" 가 실제 포인터 경로에 닿는가.
//
// 신호의 모양은 ui/cueSpec.test.ts 가, 게이트·수명은 ui/cues.test.ts 가, 막힘 판정은
// blockCue.test.ts 가 각각 잰다. 여기서 재는 것은 **어느 사건이 어느 신호를 부르는가** 뿐이다.
//
// [D-7] 이 파일의 절반은 **소리가 나지 않아야 할 자리**와 **말하지 않아야 할 자리**다:
//   · pointercancel 은 놓은 것이 아니다
//   · 배치가 상한에 막히면 토스트가 말하므로 소리는 침묵한다
//   · 놓임은 라이브 리전에 한 글자도 쓰지 않는다 — 같은 사건을 소리와 발화로 두 번 통보하면
//     스크린리더 사용자에게는 그냥 소음이다
//
// 포인터 사건을 DOM 에 쏘지 않고 controller 를 직접 부른다(tapDeselect.test.tsx 와 같은 이유:
// jsdom 은 getBoundingClientRect 가 전부 0 이라 client→world 변환이 NaN 이 된다).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useRef } from 'react';
import type { ReactNode } from 'react';
import { BALL, DEFAULT_ZONES } from '../../core/constants.ts';
import { newId } from '../../core/ids.ts';
import type { ChairId } from '../../core/ids.ts';
import { createDrill } from '../../model/defaults.ts';
import type { Drill, DrillStep } from '../../model/drill.ts';
import type { CourtStageHandle, PointerMeta } from '../../render/CourtStage.tsx';
import type { ToolId } from '../../physics/index.ts';
import { SettingsProvider } from '../../store/settings/SettingsProvider.tsx';
import { EditorProvider, useEditorDispatch, useEditorState, useEditorWorld, useEditorWriter } from '../../store/editor/EditorProvider.tsx';
import { liveRegion } from '../../ui/LiveRegion.tsx';
import { cues } from '../../ui/cues.ts';
import { useEditorPointer } from './useEditorPointer.ts';

const META: PointerMeta = { pointerType: 'touch', button: 0, shiftKey: false, metaKey: false, ctrlKey: false, altKey: false };
/** pointerup 의 화면 좌표. null 은 pointercancel 이라는 뜻이므로 값 자체보다 **null 이 아님**이 중요하다. */
const CLIENT = { x: 10, y: 10 };

const CHAIR_AT = { x: 200, y: 240, angleDeg: 0 };
/** 차체 밖 전방 45px = towFront 존 핸들 자리(INTERACT.handleLeverPx.towFront). 이 자리를 잡으면
 *  `liveRegion.say('전방 견인 잡음')` 이 나간다 — D-7 판정의 **대조군**이다. */
const TOW_FRONT_HANDLE = { x: CHAIR_AT.x + 45, y: CHAIR_AT.y };

const noop = () => {};

function makeDrill(): { drill: Drill; chairId: ChairId } {
  const base = createDrill({ courtMode: 'full', formation: '1-2-1' });
  const chairId = base.cast.chairs[0]!.id;
  const step0 = base.steps[0]!;
  const step: DrillStep = { ...step0, chairs: { [chairId]: { ...CHAIR_AT } }, balls: {}, cones: {}, notes: [], arrows: [] };
  return { chairId, drill: { ...base, steps: [step] } };
}

/** 공을 상한만큼 채운 판 — 배치 실패(토스트) 경로를 만든다. */
function makeBallFullDrill(): Drill {
  const base = createDrill({ courtMode: 'full', formation: '1-2-1', empty: true });
  const balls: Record<string, { x: number; y: number }> = {};
  const defs = [];
  for (let i = 0; i < BALL.maxCount; i++) {
    const id = newId('bl');
    defs.push({ id });
    balls[id] = { x: 400 + i, y: 400 };
  }
  const step0 = base.steps[0]!;
  return { ...base, cast: { ...base.cast, balls: defs }, steps: [{ ...step0, balls }] };
}

function useHarness(tool: ToolId, toasts: string[]) {
  const state = useEditorState();
  const dispatch = useEditorDispatch();
  const worldRef = useEditorWorld();
  const writer = useEditorWriter();
  // 무대 핸들 없음 → pxPerUnit = 1 (월드 px = CSS px).
  const stageRef = useRef<CourtStageHandle | null>(null);
  const drill = state.present;
  const step = drill.steps[0]!;
  const pointer = useEditorPointer({
    drill,
    stepIndex: 0,
    step,
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
    onPlayerPlaced: noop,
    showToast: (m) => toasts.push(m),
    forceHandlesVisible: false,
    largeTargets: false,
  });
  return { state, pointer };
}

function mount(drill: Drill, tool: ToolId = 'select') {
  const toasts: string[] = [];
  const wrapper = ({ children }: { children: ReactNode }) => (
    <SettingsProvider>
      <EditorProvider drill={drill}>{children}</EditorProvider>
    </SettingsProvider>
  );
  const r = renderHook(() => useHarness(tool, toasts), { wrapper });
  return { ...r, toasts };
}

let play: ReturnType<typeof vi.spyOn>;
let say: ReturnType<typeof vi.spyOn>;

/** 어느 신호가 몇 번 났는가. */
const kinds = (): string[] => play.mock.calls.map((c: unknown[]) => c[0] as string);

beforeEach(() => {
  // 실제 합성·진동은 이 층의 관심사가 아니다 — 어느 사건이 어느 신호를 부르는지만 본다.
  play = vi.spyOn(cues, 'play').mockImplementation(() => {});
  say = vi.spyOn(liveRegion, 'say').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("놓임 '탁'", () => {
  it('개체를 끌어다 놓으면 한 번 울린다', () => {
    const { result } = mount(makeDrill().drill);
    const ctrl = () => result.current.pointer.controller;

    act(() => void ctrl().onPointerDown(CHAIR_AT, META));
    act(() => ctrl().onPointerMove({ x: 260, y: 240 }, 16));
    expect(kinds()).not.toContain('drop'); // 아직 손을 떼지 않았다
    act(() => ctrl().onPointerUp(CLIENT));

    expect(kinds().filter((k) => k === 'drop')).toHaveLength(1);
  });

  it('pointercancel 에는 울리지 않는다 — 시스템 제스처에 뺏긴 것이지 놓은 것이 아니다', () => {
    const { result } = mount(makeDrill().drill);
    const ctrl = () => result.current.pointer.controller;

    act(() => void ctrl().onPointerDown(CHAIR_AT, META));
    act(() => ctrl().onPointerMove({ x: 260, y: 240 }, 16));
    act(() => ctrl().onPointerUp(null));

    expect(kinds()).not.toContain('drop');
    expect(kinds()).not.toContain('trayReturn');
  });

  it('배치 도구로 코트를 찍어 놓아도 울린다 — 경로가 달라도 같은 신호다', () => {
    const { result } = mount(createDrill({ courtMode: 'full', formation: '1-2-1', empty: true }), 'cone');
    act(() => void result.current.pointer.controller.onPointerDown({ x: 300, y: 300 }, META));
    expect(kinds()).toEqual(['drop']);
  });

  it('키보드 커서 배치도 같은 신호를 낸다(§7.5d)', () => {
    const { result } = mount(createDrill({ courtMode: 'full', formation: '1-2-1', empty: true }), 'ball');
    act(() => result.current.pointer.placeAtCursor({ x: 300, y: 300 }));
    expect(kinds()).toEqual(['drop']);
  });

  it('상한에 막혀 못 놓으면 침묵한다 — 토스트가 대신 말하므로 두 통보가 겹치지 않는다', () => {
    const { result, toasts } = mount(makeBallFullDrill(), 'ball');
    act(() => void result.current.pointer.controller.onPointerDown({ x: 300, y: 300 }, META));
    expect(kinds()).toEqual([]);
    expect(toasts).toHaveLength(1); // 대조군 — 아무 일도 안 일어난 것이 아니다
  });
});

describe('상자 빔 — 트레이 반환', () => {
  afterEach(() => {
    document.elementFromPoint = () => null;
  });

  it("트레이 위에서 놓으면 상자 빔이 나고 놓임 '탁' 은 나지 않는다", () => {
    const { drill, chairId } = makeDrill();
    const { result } = mount(drill);
    const ctrl = () => result.current.pointer.controller;
    const tray = document.createElement('div');
    tray.setAttribute('data-tray', '');
    document.body.appendChild(tray);
    document.elementFromPoint = () => tray;

    act(() => void ctrl().onPointerDown(CHAIR_AT, META));
    act(() => ctrl().onPointerMove({ x: 260, y: 240 }, 16));
    act(() => ctrl().onPointerUp(CLIENT));

    expect(kinds()).toEqual(['trayReturn']);
    // 대조군 — 실제로 개체가 판에서 빠졌다(신호만 다른 것이 아니다).
    expect(result.current.state.present.steps[0]!.chairs[chairId]).toBeUndefined();
    tray.remove();
  });

  it('트레이 밖에서 놓으면 상자 빔이 아니라 놓임이다', () => {
    const { result } = mount(makeDrill().drill);
    const ctrl = () => result.current.pointer.controller;

    act(() => void ctrl().onPointerDown(CHAIR_AT, META));
    act(() => ctrl().onPointerMove({ x: 260, y: 240 }, 16));
    act(() => ctrl().onPointerUp(CLIENT));

    expect(kinds()).toEqual(['drop']);
  });
});

describe("막힘 '툭'", () => {
  // 이 하네스에는 물리 루프가 돌지 않아 개체가 제자리에 서 있다 — 실제 앱에서 칩이 벽·다른
  // 칩에 막혀 멎은 상태와 판정 입력이 같다(개체는 안 움직이는데 포인터만 멀어진다).
  it('개체가 멎은 채 손이 빠르게 멀어지면 울린다', () => {
    const { result } = mount(makeDrill().drill);
    const ctrl = () => result.current.pointer.controller;

    act(() => void ctrl().onPointerDown(CHAIR_AT, META));
    act(() => ctrl().onPointerMove({ x: 210, y: 240 }, 1000));
    act(() => ctrl().onPointerMove({ x: 230, y: 240 }, 1016));

    expect(kinds()).toContain('blocked');
    const [, intensity] = play.mock.calls.find((c: unknown[]) => c[0] === 'blocked')! as unknown[];
    expect(intensity as number).toBeGreaterThan(0);
    expect(intensity as number).toBeLessThanOrEqual(1);
  });

  it('계속 밀어도 한 번만 울린다 — 매 프레임 나면 신호가 아니라 소음이다', () => {
    const { result } = mount(makeDrill().drill);
    const ctrl = () => result.current.pointer.controller;

    act(() => void ctrl().onPointerDown(CHAIR_AT, META));
    for (let i = 0; i < 8; i++) {
      const t = 1000 + 16 * i;
      act(() => ctrl().onPointerMove({ x: 210 + 20 * i, y: 240 }, t));
    }
    expect(kinds().filter((k) => k === 'blocked')).toHaveLength(1);
  });

  it('천천히 끌면 울리지 않는다 — 손떨림·속도 제한 지연과 구별되지 않는다', () => {
    const { result } = mount(makeDrill().drill);
    const ctrl = () => result.current.pointer.controller;

    act(() => void ctrl().onPointerDown(CHAIR_AT, META));
    for (let i = 0; i < 8; i++) {
      const t = 1000 + 16 * i;
      act(() => ctrl().onPointerMove({ x: 201 + i, y: 240 }, t));
    }
    expect(kinds()).not.toContain('blocked');
  });

  it('앞 드래그의 표본이 다음 드래그로 새지 않는다 — 첫 프레임 유령 툭 금지', () => {
    const { result } = mount(makeDrill().drill);
    const ctrl = () => result.current.pointer.controller;

    act(() => void ctrl().onPointerDown(CHAIR_AT, META));
    act(() => ctrl().onPointerMove({ x: 500, y: 240 }, 1000));
    act(() => ctrl().onPointerUp(CLIENT));
    play.mockClear();

    // 같은 자리를 다시 잡고 한 프레임만 크게 움직인다 — 짝이 없으므로 판정하지 않는다.
    act(() => void ctrl().onPointerDown(CHAIR_AT, META));
    act(() => ctrl().onPointerMove({ x: 700, y: 240 }, 1016));
    expect(kinds()).not.toContain('blocked');
  });
});

describe('[D-7] 소리와 발화가 같은 사건을 두 번 통보하지 않는다', () => {
  it('놓임은 라이브 리전에 한 글자도 쓰지 않는다 — 잡을 때 한 번 말한 것이 전부다', () => {
    const { drill, chairId } = makeDrill();
    const { result } = mount(drill);
    const ctrl = () => result.current.pointer.controller;

    // 존 핸들을 잡으려면 먼저 그 휠체어가 선택돼 있어야 한다(buildHitContext.handlesVisible).
    act(() => void ctrl().onPointerDown(CHAIR_AT, META));
    act(() => ctrl().onPointerUp(CLIENT));
    expect(result.current.state.selection.has(chairId)).toBe(true);
    say.mockClear();
    play.mockClear();

    // ★ 대조군 — 이 흐름 안에서 같은 스파이가 실제로 울린다(스파이가 안 걸린 것이 아니다).
    act(() => void ctrl().onPointerDown(TOW_FRONT_HANDLE, META));
    expect(say).toHaveBeenCalledTimes(1);
    expect(say.mock.calls[0]![0]).toContain('잡음');

    act(() => ctrl().onPointerMove({ x: TOW_FRONT_HANDLE.x + 30, y: 240 }, 16));
    act(() => ctrl().onPointerUp(CLIENT));

    // 놓임은 소리로만 통보된다.
    expect(kinds()).toContain('drop');
    expect(say).toHaveBeenCalledTimes(1);
  });

  it('트레이 반환도 발화하지 않는다 — 상자 빔이 그 통보다', () => {
    const { result } = mount(makeDrill().drill);
    const ctrl = () => result.current.pointer.controller;
    const tray = document.createElement('div');
    tray.setAttribute('data-tray', '');
    document.body.appendChild(tray);
    document.elementFromPoint = () => tray;

    act(() => void ctrl().onPointerDown(CHAIR_AT, META));
    act(() => ctrl().onPointerMove({ x: 260, y: 240 }, 16));
    say.mockClear();
    act(() => ctrl().onPointerUp(CLIENT));

    expect(kinds()).toEqual(['trayReturn']);
    expect(say).not.toHaveBeenCalled();
    document.elementFromPoint = () => null;
    tray.remove();
  });
});

describe('첫 사용자 제스처에서 무장한다', () => {
  it('pointerdown 이 arm() 을 부른다 — 놓는 순간에 처음 열면 첫 탁이 삼켜진다', () => {
    const arm = vi.spyOn(cues, 'arm').mockImplementation(() => {});
    const { result } = mount(makeDrill().drill);
    act(() => void result.current.pointer.controller.onPointerDown(CHAIR_AT, META));
    expect(arm).toHaveBeenCalled();
  });
});
