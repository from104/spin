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
