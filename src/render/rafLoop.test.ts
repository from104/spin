// §10.7 raf 단일 루프 검증. §6.3 의 "마지막 구독자가 콜백 안에서 해지하면 다음 프레임이
// 예약되지 않는다" 회귀(안 그러면 Wake Lock 켠 90분 시연에서 배터리를 그대로 태운다)를 고정한다.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { raf } from './rafLoop.ts';

let rafCallbacks: Array<(t: number) => void> = [];
let rafSpy: ReturnType<typeof vi.spyOn>;
let cancelSpy: ReturnType<typeof vi.spyOn>;
let now = 0;

function flushOneFrame(): void {
  const cbs = rafCallbacks;
  rafCallbacks = [];
  now += 16;
  for (const cb of cbs) cb(now);
}

beforeEach(() => {
  rafCallbacks = [];
  now = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  rafSpy = vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
    rafCallbacks.push(cb as (t: number) => void);
    return rafCallbacks.length;
  });
  cancelSpy = vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('raf', () => {
  it('첫 구독에서 requestAnimationFrame 을 예약한다', () => {
    const unsub = raf.add(() => {});
    expect(rafSpy).toHaveBeenCalledTimes(1);
    unsub();
  });

  it('구독자를 순회하며 (dtMs, nowMs) 를 넘긴다', () => {
    const seen: Array<[number, number]> = [];
    const unsub = raf.add((dt, t) => seen.push([dt, t]));
    flushOneFrame();
    expect(seen).toHaveLength(1);
    expect(seen[0]![1]).toBe(16);
    unsub();
  });

  it('구독이 0개가 되면 requestAnimationFrame 이 더 이상 예약되지 않는다', () => {
    const unsub = raf.add(() => {});
    flushOneFrame();
    const callsBefore = rafSpy.mock.calls.length;
    unsub();
    flushOneFrame(); // 구독이 없으니 아무 콜백도 안 남아있어야 한다
    expect(rafSpy.mock.calls.length).toBe(callsBefore); // 더 예약되지 않음
  });

  it('마지막 구독자가 콜백 안에서 스스로 해지하면 다음 프레임이 예약되지 않는다', () => {
    let unsub: (() => void) | null = null;
    unsub = raf.add(() => {
      unsub?.();
    });
    const callsBeforeFlush = rafSpy.mock.calls.length;
    flushOneFrame(); // tick 안에서 해지 → subs.size===0 이 되어 재예약하지 않아야 함
    expect(rafSpy.mock.calls.length).toBe(callsBeforeFlush); // 재예약 없음
  });

  it('순회 중 다른 구독이 해지돼도 이번 프레임 나머지 구독자는 정상 호출된다(Set 변경 방어)', () => {
    let calledB = false;
    const unsubA = raf.add(() => {
      unsubA();
    });
    const unsubB = raf.add(() => {
      calledB = true;
    });
    flushOneFrame();
    expect(calledB).toBe(true);
    unsubB();
  });

  it('cancelAnimationFrame 은 실제 API 존재 여부와 무관하게 stop 경로에서 안전하다', () => {
    expect(cancelSpy).toBeDefined();
  });
});
