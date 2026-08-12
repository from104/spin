// §5.8 PhysicsLoop 회귀. blocker: 정착(settle) 대기 중 새 드래그가 시작되면 이전
// settleDeadline 이 살아남아 드래그 도중 공이 잠깐 멎는 순간 루프가 스스로 stop 된다.
// rafLoop.test.ts 와 같은 방식으로 requestAnimationFrame/performance.now 를 결정적으로 흉내낸다.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLoop } from './loop.ts';
import { PHYS } from '../core/constants.ts';

let rafCallbacks: Array<(t: number) => void> = [];
let now = 0;

function flushOneFrame(dtMs = PHYS.dtMs): void {
  const cbs = rafCallbacks;
  rafCallbacks = [];
  now += dtMs;
  for (const cb of cbs) cb(now);
}

/** 멎을 때까지 프레임을 흘리되 **반드시 유한하다.** 무한 while 로 쓰면 하드컷이 사라졌을 때
 *  테스트가 단언 실패가 아니라 행(hang)으로 죽어, 반증이 무엇을 잡았는지 읽을 수 없다. */
function runUntilStopped(loop: { isRunning(): boolean }, maxFrames = 240): void {
  for (let i = 0; i < maxFrames && loop.isRunning(); i++) flushOneFrame();
}

beforeEach(() => {
  rafCallbacks = [];
  now = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
    rafCallbacks.push(cb as (t: number) => void);
    return rafCallbacks.length;
  });
  vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('PhysicsLoop.cancelSettle (blocker 회귀: §5.8 정착 대기 중 새 드래그가 루프를 멈춤)', () => {
  it('cancelSettle 없이: requestSettle 후 atRest 가 되면 루프가 (드래그 중이라도) 멎는다', () => {
    let atRest = false;
    const loop = createLoop({ step: () => {}, render: () => {}, atRest: () => atRest });
    loop.requestSettle(4000);
    expect(loop.isRunning()).toBe(true);

    atRest = true; // 예: 새 드래그의 첫 프레임에 공이 마침 멈춰 있는 상태
    flushOneFrame();
    expect(loop.isRunning()).toBe(false); // ★ 버그: 드래그 도중인데 멎는다
  });

  it('cancelSettle 을 부르면: 이후 atRest 가 참이어도 루프가 계속 돈다', () => {
    let atRest = false;
    const loop = createLoop({ step: () => {}, render: () => {}, atRest: () => atRest });
    loop.requestSettle(4000);
    loop.cancelSettle(); // 새 드래그 시작 시 index.ts 가 호출하는 것과 동일한 지점

    atRest = true;
    flushOneFrame();
    expect(loop.isRunning()).toBe(true);
  });

  it('cancelSettle 은 running 상태 자체는 건드리지 않는다(정지 중이면 정지 유지)', () => {
    const loop = createLoop({ step: () => {}, render: () => {}, atRest: () => false });
    expect(loop.isRunning()).toBe(false);
    loop.cancelSettle();
    expect(loop.isRunning()).toBe(false);
  });
});

// 2026-08-12 검증관 지적(FV-2): loop.ts 의 하드컷 `now >= settleDeadline` 을 지워도 전체
// 스위트가 초록불이었다 — 지금은 index.ts 의 정착 술어가 상한 도달 시 무조건 true 를 돌려주어
// 같은 일을 먼저 하므로 관측되지 않는다. 의도된 이중 안전망이지만 커버리지가 0 이면, 나중에
// 술어가 바뀌어 하드컷만 남는 경로가 생겼을 때 **이미 깨져 있어도 알 수 없다.**
// 그래서 loop 를 단독으로 재는 자리를 여기에 만든다: atRest 가 영영 거짓인 술어를 주입한다.
describe('PhysicsLoop 정착 하드컷 (atRest 가 영영 거짓이어도 상한에서 멎는다)', () => {
  it('atRest 가 계속 false 여도 settleDeadline 을 넘기면 루프가 멎는다', () => {
    const loop = createLoop({ step: () => {}, render: () => {}, atRest: () => false });
    loop.requestSettle(100);
    expect(loop.isRunning()).toBe(true);

    // 상한 직전까지는 계속 돈다 — 하드컷이 조급하게 끊지 않는다는 것도 같이 잰다.
    while (now + PHYS.dtMs < 100) {
      flushOneFrame();
      expect(loop.isRunning()).toBe(true);
    }
    flushOneFrame(); // 이 프레임에서 now >= 100
    expect(loop.isRunning()).toBe(false);
  });

  it('상한이 지나 멎을 때도 onSettle 통지는 온다 (기하 분리 폴백이 실린 좌표를 놓치지 않게)', () => {
    const onSettle = vi.fn();
    const loop = createLoop({ step: () => {}, render: () => {}, atRest: () => false, onSettle });
    loop.requestSettle(50);
    runUntilStopped(loop);
    expect(loop.isRunning()).toBe(false);
    expect(onSettle).toHaveBeenCalledTimes(1);
  });

  it('무한정 도는 일이 없다: 상한을 넘긴 뒤로는 rAF 를 다시 걸지 않는다', () => {
    const loop = createLoop({ step: () => {}, render: () => {}, atRest: () => false });
    loop.requestSettle(50);
    runUntilStopped(loop);
    expect(loop.isRunning()).toBe(false);
    rafCallbacks = [];
    flushOneFrame();
    expect(rafCallbacks).toHaveLength(0);
  });
});
