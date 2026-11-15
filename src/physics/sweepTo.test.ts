// sweepTo — 키보드·[미세 조정] 이동도 [물리·상호작용]이 켜져 있으면 이웃과 부딪힌다(2026-11-16 기현님 지시).
// 순간이동 뒤 겹침만 풀면 큰 걸음이 공을 건너뛰어 공이 **뒤로** 튕겼다(e2e S17b 실측) — 그래서 쓸고 간다.
import { afterEach, describe, expect, it } from 'vitest';
import { createPhysicsProbe } from '../test/helpers/physicsProbe.ts';
import { CHAIR } from '../core/constants.ts';
import type { BallId, ChairId } from '../core/ids.ts';

const chA = 'ch_a' as ChairId;
const chB = 'ch_b' as ChairId;
const bl = 'bl_a' as BallId;
const Y = 262.5; // full 코트 세로 중앙

// 단언이 실패해도 프로브는 반드시 치운다 — 남은 프로브의 루프가 다음 시험까지 번져 엉뚱한 곳에서 터진다
const probes: Array<ReturnType<typeof createPhysicsProbe>> = [];
const probeOf = (...a: Parameters<typeof createPhysicsProbe>) => {
  const p = createPhysicsProbe(...a);
  probes.push(p);
  return p;
};
afterEach(() => {
  for (const p of probes.splice(0)) p.dispose();
});

describe('sweepTo — 키보드 이동도 이웃과 상호작용', () => {
  it('켜져 있으면 길 위의 공을 **미는 방향으로 굴려 보내고**, 휠체어는 목표에 서며, 다 서면 한 번 알린다', () => {
    const probe = probeOf({ chairs: [{ id: chA, x: 300, y: Y }], balls: [{ id: bl, x: 360, y: Y }] });
    let seen = 0;
    probe.api.onSettled(() => {
      seen += 1;
    });
    expect(probe.api.sweepTo([{ id: chA, pose: { x: 420, y: Y, theta: 0 } }])).toBe(true); // 120 px — 공을 지나는 큰 걸음
    probe.runUntilLoopStops({ maxFrames: 900 });
    const s = probe.api.read();
    expect(seen).toBe(1);
    expect(s[chA]!.x).toBeCloseTo(420, 1); // 손의 권위 — 공에 밀려 되돌아가지 않는다
    // 공은 앞범퍼 **앞**으로, 부딪힌 방향(곧게)으로 **굴러갔다** — 비켜 세우기만 했다면 범퍼에 붙어 멈춘다(≈ +20 px 안쪽).
    // 2026-11-16 기현님 "부딛힌 방향과 속도로 안 굴러간다" — 걸음이 driven 이라 10 km/h 로 맞은 만큼 간다(실측 ≈ +127 px)
    expect(s[bl]!.x).toBeGreaterThan(420 + CHAIR.lengthPx / 2 + 40);
    expect(s[bl]!.y).toBeCloseTo(Y, 0);
  });

  it('꺼져 있으면 false — 아무것도 안 옮긴다(부르는 쪽이 순간이동한다)', () => {
    const probe = probeOf({ chairs: [{ id: chA, x: 300, y: Y }], balls: [{ id: bl, x: 360, y: Y }] });
    probe.api.setInteract(false);
    expect(probe.api.sweepTo([{ id: chA, pose: { x: 420, y: Y, theta: 0 } }])).toBe(false);
    probe.stepFrames(60);
    const s = probe.api.read();
    expect(s[chA]!.x).toBeCloseTo(300, 3);
    expect(s[bl]!.x).toBeCloseTo(360, 3);
  });

  it('잠긴 휠체어는 옮기지 않는다', () => {
    const probe = probeOf({ chairs: [{ id: chA, x: 300, y: Y }], locked: [chA] });
    probe.api.sweepTo([{ id: chA, pose: { x: 420, y: Y, theta: 0 } }]);
    probe.runUntilLoopStops({ maxFrames: 900 });
    expect(probe.api.read()[chA]!.x).toBeCloseTo(300, 3);
  });

  it('다 선 뒤에는 static 이 풀린다 — 다른 휠체어로 밀면 이번엔 그쪽이 밀린다', () => {
    const probe = probeOf({ chairs: [{ id: chA, x: 300, y: Y }, { id: chB, x: 500, y: Y }] });
    expect(probe.api.sweepTo([{ id: chA, pose: { x: 320, y: Y, theta: 0 } }])).toBe(true);
    probe.runUntilLoopStops({ maxFrames: 900 });
    // chB 를 chA 쪽으로 — chA 가 여전히 static 이면 chB 가 막히고 chA 는 꼼짝 않는다
    expect(probe.api.sweepTo([{ id: chB, pose: { x: 340, y: Y, theta: 0 } }])).toBe(true);
    probe.runUntilLoopStops({ maxFrames: 900 });
    const s = probe.api.read();
    expect(s[chB]!.x).toBeCloseTo(340, 1); // 이번 손의 권위
    expect(s[chA]!.x).toBeLessThan(320 - 1); // chA 는 밀려났다
  });
});
