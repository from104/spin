// 휠체어 조정 모드 세션(useDriveSession)의 **나오는 길** — docs/PLAN-SIMPLE-DRIVE.md 결정 B2·B7.
//
// 진짜 EditorProvider(리듀서·히스토리) + 진짜 물리 월드 + 진짜 stepPosesFromSnapshot 으로 잰다. 프레임(rAF)과 시계만 손으로 돌린다 —
// 저장된 자세를 그대로 되읽어 주는 가짜 월드로는 "안 움직였으면 칸이 없다"·"마지막 자세가 남는다"가 저절로 참이 된다.
//
// 지우면 새는 실기 버그:
//  · 키를 쥔 채(또는 밀린 공이 구르는 동안) **마우스로** 나가면 — 화면을 떠남·다른 드릴 열기·스텝 복제 — 마지막 0.5 s 치 움직임이
//    저장에서 빠진다. 키로 나가면 keydown 이 먼저 커밋하지만 단추는 리듀서가 먼저 돌고 세션의 effect 가 뒤따른다. 언마운트면 그
//    뒤늦은 dispatch 는 버려지고(자동저장은 마지막으로 **그려진** 상태를 쓴다), 스텝 복제면 새 스텝이 0.5 s 낡은 자세를 베낀다.
//  · 한 번 들어가서 나올 때까지가 되돌리기 한 칸이 아니게 되는 것(갈아타기 포함), 안 움직였는데 칸이 생기는 것.
//  · 떼는 사건(keyup)을 못 받는 상황 — macOS 의 ⌘, 브라우저 메뉴, 창 초점 잃음, code 없는 keyup — 에서 휠체어가 혼자 달아나는 것.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { BallId, ChairId } from '../../core/ids.ts';
import { createDrill } from '../../model/defaults.ts';
import type { Drill } from '../../model/drill.ts';
import { SettingsProvider } from '../../store/settings/SettingsProvider.tsx';
import { EditorProvider, useEditorDispatch, useEditorState, useEditorWorld } from '../../store/editor/EditorProvider.tsx';
import { useDriveSession } from './useDriveSession.ts';

const Y = 262.5;
const FRAME_MS = 1000 / 60;

// ── 손으로 돌리는 프레임·시계 ──
let clock = 0;
let queue: Array<{ id: number; cb: FrameRequestCallback }> = [];
let nextId = 0;

beforeEach(() => {
  clock = 1000;
  queue = [];
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    queue.push({ id: ++nextId, cb });
    return nextId;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    queue = queue.filter((q) => q.id !== id);
  });
  vi.spyOn(performance, 'now').mockImplementation(() => clock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function frames(n: number): void {
  act(() => {
    for (let i = 0; i < n; i++) {
      clock += FRAME_MS;
      for (const q of queue.splice(0)) q.cb(clock);
    }
  });
}

const key = (type: 'keydown' | 'keyup', code: string, init: KeyboardEventInit = {}): void =>
  act(() => {
    window.dispatchEvent(new KeyboardEvent(type, { code, key: code.replace(/^Key/, '').toLowerCase(), bubbles: true, cancelable: true, ...init }));
  });

function makeDrill(): { drill: Drill; a: ChairId; b: ChairId; ball: BallId } {
  const base = createDrill({ courtMode: 'full', formation: '1-2-1' });
  const a = base.cast.chairs[0]!.id;
  const b = base.cast.chairs[1]!.id;
  const ball = base.cast.balls[0]!.id;
  const step0 = base.steps[0]!;
  return {
    a,
    b,
    ball,
    drill: {
      ...base,
      steps: [
        {
          ...step0,
          // A 는 +x 를 보고 그 앞에 공, B 는 멀찍이 따로
          chairs: { [a]: { x: 300, y: Y, angleDeg: 0 }, [b]: { x: 300, y: 420, angleDeg: 0 } },
          balls: { [ball]: { x: 345, y: Y } },
          cones: {},
          arrows: [],
          notes: [],
          shapes: [],
        },
      ],
    },
  };
}

function mount(drill: Drill) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <SettingsProvider>
      <EditorProvider drill={drill}>{children}</EditorProvider>
    </SettingsProvider>
  );
  const h = renderHook(
    () => {
      const state = useEditorState();
      const dispatch = useEditorDispatch();
      const worldRef = useEditorWorld();
      const step = state.present.steps.find((s) => s.id === state.stepId)!;
      const drive = useDriveSession({
        worldRef,
        dispatch,
        step,
        epoch: state.epoch,
        tool: state.tool,
        playing: false,
        simple: false,
        interact: true,
        locked: new Set(step.locked ?? []),
        ignored: new Set<string>(step.ignored ?? []),
        selection: state.selection,
        singleKeyMode: 'on',
        reduceMotion: false,
        speed: 5,
        onSpeedChange: () => {},
        chairName: (id) => id,
        t: (k) => k,
        showToast: () => {},
      });
      return { state, dispatch, worldRef, drive };
    },
    { wrapper },
  );
  // [물리·상호작용]은 기본이 꺼짐이다 — 조정 모드의 전제(B1)라 월드에 직접 켠다(화면에서는 설정이 켠다).
  act(() => h.result.current.worldRef.current!.setInteract(true));
  return h;
}

type Harness = ReturnType<typeof mount>;
const poseOf = (h: Harness, id: string) => h.result.current.worldRef.current!.read()[id]!;
const stored = (h: Harness, stepIndex: number, id: ChairId) => h.result.current.state.present.steps[stepIndex]!.chairs[id]!;
/** 정착 통지가 올 때까지 — 루프가 서면 큐가 빈다. */
const settle = (): void => frames(600);

describe('조정 모드 세션 — 되돌리기 한 칸', () => {
  it('들어갔다가 안 움직이고 나오면 칸도 변경도 없다', () => {
    const { drill, a } = makeDrill();
    const h = mount(drill);
    const present0 = h.result.current.state.present;
    act(() => h.result.current.drive.enter(a));
    frames(90); // 0.5 s 주기 커밋이 몇 번 지나간다
    key('keydown', 'Escape');
    settle();
    expect(h.result.current.drive.chairId).toBeNull();
    expect(h.result.current.state.past).toHaveLength(0);
    expect(h.result.current.state.present).toBe(present0);
  });

  it('몰아서 공을 밀고 갈아타 또 몰아도 한 칸 — 되돌리면 둘 다·공까지 제자리, 다시 하면 몬 자리', () => {
    const { drill, a, b, ball } = makeDrill();
    const h = mount(drill);
    act(() => h.result.current.drive.enter(a));
    key('keydown', 'KeyW');
    frames(60);
    key('keyup', 'KeyW');
    act(() => void h.result.current.drive.press(b)); // 판에서 B 를 눌러 갈아탄다
    expect(h.result.current.drive.chairId).toBe(b);
    key('keydown', 'KeyW');
    frames(60);
    key('keyup', 'KeyW');
    frames(60);
    key('keydown', 'Escape');
    settle();
    const s = h.result.current.state;
    expect(s.past).toHaveLength(1);
    const st = s.present.steps[0]!;
    expect(st.chairs[a]!.x).toBeGreaterThan(320); // 대조군 — 실제로 몰렸다
    expect(st.chairs[b]!.x).toBeGreaterThan(320);
    expect(st.balls[ball]!.x).toBeGreaterThan(350);
    expect(st.chairs[a]!.x).toBeCloseTo(poseOf(h, a).x, 1);
    expect(st.balls[ball]!.x).toBeCloseTo(poseOf(h, ball).x, 1);
    const driven = s.present;
    act(() => h.result.current.dispatch({ type: 'UNDO' }));
    const back = h.result.current.state.present.steps[0]!;
    expect([back.chairs[a]!.x, back.chairs[b]!.x, back.balls[ball]!.x]).toEqual([300, 300, 345]);
    act(() => h.result.current.dispatch({ type: 'REDO' }));
    expect(h.result.current.state.present).toBe(driven);
  });
});

describe('조정 모드 세션 — 키를 쥔 채 나가도 마지막 자세가 남는다', () => {
  /** A 에 들어가 W 를 쥐고 `n` 프레임 — 마지막 주기 커밋에서 0.5 s 가까이 지난 때에 멈춰 세운다(낡은 구간이 가장 길 때). */
  function drivingMidCommit(): { h: Harness; a: ChairId; ball: BallId } {
    const { drill, a, ball } = makeDrill();
    const h = mount(drill);
    act(() => h.result.current.drive.enter(a));
    key('keydown', 'KeyW');
    frames(85);
    // 대조군 — 지금 모델은 바디보다 눈에 띄게 뒤에 있다(주기 커밋이 0.5 s 마다라서). 이것이 0 이면 아래 단언들은 아무것도 안 잰다.
    expect(poseOf(h, a).x - stored(h, 0, a).x).toBeGreaterThan(5);
    return { h, a, ball };
  }

  it('Esc(키) — keydown 이 먼저 커밋한다', () => {
    const { h, a } = drivingMidCommit();
    const at = poseOf(h, a).x;
    key('keydown', 'Escape');
    expect(stored(h, 0, a).x).toBeCloseTo(at, 1);
    expect(h.result.current.state.past).toHaveLength(1);
  });

  it('도구를 단추로 바꿈 · 스텝을 단추로 넘김 — 몰던 스텝에 남는다', () => {
    {
      const { h, a } = drivingMidCommit();
      const at = poseOf(h, a).x;
      act(() => h.result.current.dispatch({ type: 'TOOL_SET', tool: 'cone' }));
      expect(h.result.current.drive.chairId).toBeNull();
      expect(stored(h, 0, a).x).toBeCloseTo(at, 1);
      h.unmount();
    }
    const { h, a } = drivingMidCommit();
    const first = h.result.current.state.stepId;
    act(() => h.result.current.dispatch({ type: 'STEP_DUPLICATE', id: first }));
    const second = h.result.current.state.present.steps[1]!.id;
    act(() => h.result.current.dispatch({ type: 'STEP_SELECT', id: first }));
    act(() => h.result.current.drive.enter(a)); // 스텝 복제가 모드를 끝냈다 — 다시 들어가 몬다
    key('keydown', 'KeyW');
    frames(85);
    const at = poseOf(h, a).x;
    act(() => h.result.current.dispatch({ type: 'STEP_SELECT', id: second }));
    expect(h.result.current.drive.chairId).toBeNull();
    expect(stored(h, 0, a).x).toBeCloseTo(at, 1);
  });

  // 단추는 리듀서가 먼저 돌고 세션의 effect 가 뒤따른다. pointerdown(click 보다 먼저 오는 별개 사건)에서 커밋해 두지 않으면 아래 둘이 샌다.
  const pressOutside = (): void => act(() => void window.dispatchEvent(new Event('pointerdown')));

  it('스텝 복제 단추 — 몰던 스텝도 새 스텝도 마지막 자세다(낡은 자세를 베끼지 않는다)', () => {
    const { h, a } = drivingMidCommit();
    const at = poseOf(h, a).x;
    pressOutside();
    act(() => h.result.current.dispatch({ type: 'STEP_DUPLICATE', id: h.result.current.state.stepId }));
    expect(stored(h, 0, a).x).toBeCloseTo(at, 1);
    expect(stored(h, 1, a).x).toBeCloseTo(at, 1);
  });

  it('화면을 떠남·다른 드릴 열기(언마운트) — 마지막으로 그려진 상태가 마지막 자세다', () => {
    const { h, a } = drivingMidCommit();
    const at = poseOf(h, a).x;
    pressOutside();
    // 자동저장의 언마운트 플러시는 마지막으로 **그려진** present 를 쓴다(useAutosave stateRef) — 그 값이 여기 result.current 다.
    h.unmount();
    expect(stored(h, 0, a).x).toBeCloseTo(at, 1);
  });

  it('되돌리기 단추(시점 점프) — 몬 것이 한 칸으로 물러나고, 다시 하면 몬 자리 근처로 온다', () => {
    const { h, a, ball } = drivingMidCommit();
    act(() => h.result.current.dispatch({ type: 'UNDO' }));
    expect(h.result.current.drive.chairId).toBeNull();
    const back = h.result.current.state.present.steps[0]!;
    expect([back.chairs[a]!.x, back.balls[ball]!.x]).toEqual([300, 345]);
    expect(h.result.current.state.past).toHaveLength(0);
    act(() => h.result.current.dispatch({ type: 'REDO' }));
    expect(stored(h, 0, a).x).toBeGreaterThan(320);
  });
});

describe('조정 모드 세션 — 떼는 사건을 못 받아도 휠체어가 혼자 달아나지 않는다', () => {
  /** W 를 쥔 채 `lose()` 가 일어나고 keyup 은 끝내 안 온다 — 그 뒤 1.5 s 에서 2 s 사이에 더 간 거리. */
  function creepAfter(lose: () => void): number {
    const { drill, a } = makeDrill();
    const h = mount(drill);
    act(() => h.result.current.drive.enter(a));
    key('keydown', 'KeyW');
    frames(20);
    lose();
    frames(90);
    const x1 = poseOf(h, a).x;
    frames(30);
    const d = poseOf(h, a).x - x1;
    h.unmount();
    return d;
  }

  it('⌘ 를 누름(macOS 는 그동안 keyup 을 안 보낸다) · 브라우저 메뉴 · 창이 초점을 잃음 · 어느 키인지 모르는 keyup', () => {
    expect(creepAfter(() => {})).toBeGreaterThan(10); // 대조군 — 아무 일도 없으면 계속 간다
    expect(creepAfter(() => key('keydown', 'MetaLeft', { key: 'Meta', metaKey: true }))).toBe(0);
    expect(creepAfter(() => act(() => void window.dispatchEvent(new Event('contextmenu'))))).toBe(0);
    expect(creepAfter(() => act(() => void window.dispatchEvent(new Event('blur'))))).toBe(0);
    expect(creepAfter(() => key('keyup', '', { key: 'Unidentified' }))).toBe(0);
    // 한글 입력기 상태 — code 는 그대로 오고 key 만 자모·Process 다. 물리 키로 짝지으므로 떼면 선다(Shift 를 그새 눌렀어도).
    expect(creepAfter(() => key('keyup', 'KeyW', { key: 'ㅈ', shiftKey: true }))).toBe(0);
    expect(creepAfter(() => key('keyup', '', { key: 'ㅈ' }))).toBe(0);
  });
});
