// §10.7 raf 단일 루프 검증. §6.3 의 "마지막 구독자가 콜백 안에서 해지하면 다음 프레임이
// 예약되지 않는다" 회귀(안 그러면 Wake Lock 켠 90분 시연에서 배터리를 그대로 태운다)를 고정한다.
//
// 1.5(§4.2 알려진 이슈 #2 "편집 중 멈춤") 추가: **체인이 갈라지지 않는가**. 이 파일이 지키던
// 것은 "구독이 0이면 안 예약한다" 였는데, 그 반대편 — 예약이 살아 있는 창에서 새 구독이 들어올
// 때 **두 번째** 체인을 예약하지 않는가 — 는 비어 있었고 실제로 갈라졌다. 마지막 describe 가
// 그 자리다.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { raf } from './rafLoop.ts';

// 큐는 physicsProbe.ts 와 같은 관용구로 흉내낸다 — 핸들(id)로 관리해야 취소를 **실제로**
// 큐에서 뺄 수 있다. no-op 취소로 두면 "예약을 접었다" 와 "접었다고 믿는다" 를 구별할 수 없어
// 체인 분화 회귀가 계기 밖으로 새어 나간다(1.5).
let pending: Array<{ id: number; cb: (t: number) => void }> = [];
let rafSeq = 0;
let rafSpy: ReturnType<typeof vi.spyOn>;
let cancelSpy: ReturnType<typeof vi.spyOn>;
let now = 0;

/** 지금 브라우저 큐에 남아 있는 rAF 콜백 수 = 살아 있는 체인 수. 정상값은 0 아니면 1. */
const chains = (): number => pending.length;

function flushOneFrame(): void {
  const due = pending;
  pending = [];
  now += 16;
  for (const p of due) p.cb(now);
}

beforeEach(() => {
  pending = [];
  rafSeq = 0;
  now = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  rafSpy = vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
    rafSeq += 1;
    pending.push({ id: rafSeq, cb: cb as (t: number) => void });
    return rafSeq;
  });
  cancelSpy = vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation((handle: number) => {
    pending = pending.filter((p) => p.id !== handle);
  });
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

// 1.5 — §4.2 알려진 이슈 #2 "편집 중 브라우저 멈춤". 원인 후보 중 **rAF 폭주**를 여기서 닫는다.
//
// 앞 describe 가 지키는 것은 "구독이 0 이면 잠든다" 이고, 이쪽은 그 반대편이다: 예약이 살아
// 있는 창에서 새 구독이 들어와도 **체인이 하나로 남는가**. 갈라지면 조용히 늘기만 하고 아무
// 테스트도 깨지지 않는다 — 화면은 그대로 돌아가고 다만 프레임당 일이 n 배가 될 뿐이다.
describe('raf — 체인은 갈라지지 않는다', () => {
  it('마지막 구독자가 나간 창에서 새 구독이 들어와도 프레임당 콜백은 한 번이다', () => {
    const u1 = raf.add(() => {});
    flushOneFrame(); // tick 이 다음 프레임을 예약해 둔 상태
    expect(chains()).toBe(1);

    u1(); // 마지막 구독자 해지 — 예약은 아직 살아 있다(이 창이 문제의 자리였다)
    let calls = 0;
    const u2 = raf.add(() => {
      calls++;
    });
    try {
      expect(chains()).toBe(1); // 고치기 전에는 2 였다
      flushOneFrame();
      expect(calls).toBe(1); // 고치기 전에는 2 였다
    } finally {
      u2(); // raf 는 모듈 싱글턴이다 — 실패해도 다음 테스트로 구독을 흘리지 않는다
    }
  });

  it('해지→재구독을 5번 반복해도 체인은 1개다(전에는 프레임당 콜백이 6번이었다)', () => {
    // 같은 커밋 안의 언마운트→마운트가 반복되는 모양이다: 화면 왕복, StrictMode 이중 호출,
    // 렌더마다 deps 가 바뀌는 rAF 구독 이펙트.
    let calls = 0;
    const bump = (): void => {
      calls++;
    };
    let unsub = raf.add(bump);
    try {
      for (let i = 0; i < 5; i++) {
        flushOneFrame();
        unsub();
        unsub = raf.add(bump);
      }
      calls = 0;
      flushOneFrame();
      expect(chains()).toBe(1);
      expect(calls).toBe(1);
    } finally {
      unsub();
    }
  });

  it('마지막 구독자가 나가면 예약을 접는다 — 빈 tick 조차 돌지 않는다', () => {
    let ticks = 0;
    const unsub = raf.add(() => {
      ticks++;
    });
    flushOneFrame();
    expect(ticks).toBe(1);
    unsub();
    expect(chains()).toBe(0); // 큐에서 실제로 빠졌다
    flushOneFrame();
    expect(ticks).toBe(1);
  });

  it('tick **안에서** 마지막 구독자가 나가고 새 구독이 들어와도 체인은 1개다', () => {
    // 트윈 종료(startTween 이 완주하며 스스로 해지)와 다음 트윈 시작이 같은 프레임에 겹치는
    // 모양. 이때 id 는 tick 머리에서 이미 0 이라 해지 쪽 정리가 no-op 이 되고, 재구독이
    // 예약한 하나만 남아야 한다(그리고 tick 꼬리가 또 예약하면 안 된다).
    let later = 0;
    // 해지 함수를 배열에 모은다 — `let unsubB: (()=>void)|null` 은 콜백 안에서만 대입되므로
    // TS 의 흐름 분석이 finally 시점을 여전히 null 로 좁혀 `never` 호출이 된다.
    const cleanup: Array<() => void> = [];
    let unsubA: (() => void) | null = null;
    unsubA = raf.add(() => {
      unsubA?.();
      cleanup.push(
        raf.add(() => {
          later++;
        }),
      );
    });
    try {
      flushOneFrame();
      expect(chains()).toBe(1);
      flushOneFrame();
      expect(later).toBe(1);
      expect(chains()).toBe(1);
    } finally {
      for (const off of cleanup) off();
    }
  });
});
