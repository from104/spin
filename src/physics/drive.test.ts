// 휠체어 조정 모드(`driveStep`/`driveEnd`)와 쓸기(`sweepTo`)의 물리 규칙 — docs/PLAN-SIMPLE-DRIVE.md 결정 B6.
//
// 지우면 새는 실기 버그:
//  · 시간의 주인이 둘 — sweepTo 는 자기 안에서 substep 을 돌고 정착 루프(rAF)를 켠다. 조정 모드가 매 프레임 그 길을 타면
//    같은 프레임에 월드가 두 번 걷고, 밀린 공이 휠체어보다 두 배 빨리 달아난다(구현 전 확인 1).
//  · 잠긴 개체를 뚫음 — 쥔 휠체어도 잠긴 개체도 static 이라 matter 가 그 쌍을 아예 안 만든다(drag.ts DragBlockers 머리말).
//    끌기는 lockedBlockers 로 막았지만 sweepTo(0.6.14 키보드 밀기)에는 없었다(구현 전 확인 2).
//  · 무시한 휠체어에 막힘 — 바디가 없어야 통과한다(구현 전 확인 3).
//  · 최고 단계 회전(≈ 430 °/s)이 콘을 건너뜀 — 걸음을 시간으로만 나누므로 한 substep 의 앞 모서리 이동이 콘보다 작아야 한다.
import { afterEach, describe, expect, it } from 'vitest';
import { createPhysicsProbe } from '../test/helpers/physicsProbe.ts';
import { BALL, CHAIR, CONE, DRIVE } from '../core/constants.ts';
import type { BallId, ChairId, ConeId } from '../core/ids.ts';

const chA = 'ch_a' as ChairId;
const chB = 'ch_b' as ChairId;
const bl = 'bl_a' as BallId;
const cn = 'cn_a' as ConeId;
const Y = 262.5;
const DT = 1 / 60;

const probes: Array<ReturnType<typeof createPhysicsProbe>> = [];
const probeOf = (...a: Parameters<typeof createPhysicsProbe>) => {
  const p = createPhysicsProbe(...a);
  probes.push(p);
  return p;
};
afterEach(() => {
  for (const p of probes.splice(0)) p.dispose();
});

/** 피벗을 보는 쪽(+x)으로 v px/s 로 frames 프레임 몬다 — 조정 모드 컨트롤러가 하는 일의 최소판(목표 자세를 매 프레임 넘긴다). */
function driveStraight(probe: ReturnType<typeof createPhysicsProbe>, id: ChairId, v: number, frames: number): void {
  for (let i = 0; i < frames; i++) {
    const p = probe.api.read()[id]!;
    probe.api.driveStep([{ id, pose: { x: p.x + v * DT, y: p.y, theta: p.theta } }], DT);
  }
}

/** 점이 휠체어 차체(사각형) 안인가 — 피벗 기준 앞 pivotToFront, 뒤 pivotToRear, 옆 폭/2. */
function insideChair(pose: { x: number; y: number; theta: number }, p: { x: number; y: number }): boolean {
  const dx = p.x - pose.x;
  const dy = p.y - pose.y;
  const lx = dx * Math.cos(pose.theta) + dy * Math.sin(pose.theta);
  const ly = -dx * Math.sin(pose.theta) + dy * Math.cos(pose.theta);
  return lx > -CHAIR.pivotToRearPx && lx < CHAIR.pivotToFrontPx && Math.abs(ly) < CHAIR.widthPx / 2;
}

describe('잠긴 개체는 쓸고 가는 휠체어를 막는다', () => {
  // 잠긴 휠체어 B 의 뒤끝은 360 − pivotToRear. A 의 앞범퍼(x + pivotToFront)가 거기서 선다.
  const stopX = 360 - CHAIR.pivotToRearPx - CHAIR.pivotToFrontPx;

  it('sweepTo(키보드 밀기): 잠긴 휠체어·잠긴 콘 앞에서 선다', () => {
    const p1 = probeOf({ chairs: [{ id: chA, x: 300, y: Y }, { id: chB, x: 360, y: Y }], locked: [chB] });
    p1.api.sweepTo([{ id: chA, pose: { x: 420, y: Y, theta: 0 } }], 0.5);
    expect(p1.api.read()[chA]!.x).toBeLessThan(stopX + 1);
    expect(p1.api.read()[chB]!.x).toBe(360);
    p1.dispose();
    const p2 = probeOf({ chairs: [{ id: chA, x: 300, y: Y }], cones: [{ id: cn, x: 360, y: Y }], locked: [cn] });
    p2.api.sweepTo([{ id: chA, pose: { x: 420, y: Y, theta: 0 } }], 0.5);
    expect(p2.api.read()[chA]!.x).toBeLessThan(360 - CONE.radiusPx - CHAIR.pivotToFrontPx + 1);
  });

  it('driveStep(조정 모드): 잠긴 휠체어 앞에서 서고, 무시한 휠체어는 통과한다', () => {
    const p1 = probeOf({ chairs: [{ id: chA, x: 300, y: Y }, { id: chB, x: 360, y: Y }], locked: [chB] });
    driveStraight(p1, chA, DRIVE.vMaxPxPerS, 120);
    expect(p1.api.read()[chA]!.x).toBeLessThan(stopX + 1);
    expect(p1.api.read()[chA]!.x).toBeGreaterThan(stopX - 2); // 멀찍이 선 것이 아니라 닿아서 섰다
    p1.dispose();
    const p2 = probeOf({ chairs: [{ id: chA, x: 300, y: Y }, { id: chB, x: 360, y: Y }], ignored: [chB] });
    driveStraight(p2, chA, DRIVE.vMaxPxPerS, 120);
    expect(p2.api.read()[chA]!.x).toBeGreaterThan(360);
    expect(p2.api.read()[chB]?.x ?? 360, '무시한 휠체어는 밀리지도 않는다(월드에 없다)').toBe(360);
  });
});

describe('무리는 잠긴 개체 앞에서 한 덩어리로 선다', () => {
  // 키보드 무리 이동(sweepTo 에 여럿) — 칩마다 따로 막으면 막힌 칩만 서고 뒤따르던 칩이 그 속으로 겹쳐 들어온다(쥔 칩끼리는
  // static–static 이라 서로 안 막는다). 벽에서 groupDelta 가 고친 것과 같은 고장이다.
  const chL = 'ch_l' as ChairId;
  const stopX = 350 - CHAIR.pivotToRearPx - CHAIR.pivotToFrontPx; // 잠긴 L(350) 의 뒤끝에 A 의 앞범퍼가 닿는 자리
  /** 무리를 (dx, dy) 씩 `presses` 번 민다 — 방향키를 그만큼 누른 것. */
  function pushGroup(probe: ReturnType<typeof createPhysicsProbe>, ids: readonly string[], dx: number, dy: number, presses: number): void {
    for (let k = 0; k < presses; k++) {
      const s = probe.api.read();
      probe.api.sweepTo(ids.map((id) => ({ id: id as ChairId, pose: { x: s[id]!.x + dx, y: s[id]!.y + dy, theta: s[id]!.theta } })), 0.1);
    }
  }

  it('앞 칩이 막히면 뒤 칩·공도 같이 서고 간격이 그대로다', () => {
    const probe = probeOf({ chairs: [{ id: chA, x: 300, y: Y }, { id: chB, x: 255, y: Y }, { id: chL, x: 350, y: Y }], balls: [{ id: bl, x: 300, y: Y + 40 }], locked: [chL] });
    pushGroup(probe, [chA, chB, bl], 10, 0, 6);
    const s = probe.api.read();
    expect(s[chA]!.x).toBeGreaterThan(stopX - 2); // 닿을 때까지는 갔다(대조군)
    expect(s[chA]!.x).toBeLessThan(stopX + 1);
    expect(s[chA]!.x - s[chB]!.x).toBeCloseTo(45, 6);
    expect(s[bl]!.x - s[chA]!.x).toBeCloseTo(0, 1);
  });

  it('공·콘도 잠긴 개체에 막힌다 — 혼자 밀어도, 무리 맨 앞이어도', () => {
    // 혼자: 잠긴 휠체어 L 의 뒤끝(350 − pivotToRear)에 공이 닿는 자리에서 선다(전에는 L 을 뚫고 420 에 섰다)
    const ballStop = 350 - CHAIR.pivotToRearPx - BALL.radiusPx;
    const p1 = probeOf({ chairs: [{ id: chL, x: 350, y: Y }], balls: [{ id: bl, x: 280, y: Y }], locked: [chL] });
    p1.api.sweepTo([{ id: bl, pose: { x: 420, y: Y, theta: 0 } }], 0.5);
    expect(p1.api.read()[bl]!.x).toBeGreaterThan(ballStop - 2);
    expect(p1.api.read()[bl]!.x).toBeLessThan(ballStop + 1);
    p1.dispose();
    // 무리 맨 앞의 콘이 잠긴 콘에 닿으면 뒤 휠체어도 같이 선다
    const cn2 = 'cn_b' as ConeId;
    const p2 = probeOf({ chairs: [{ id: chA, x: 200, y: Y }], cones: [{ id: cn, x: 300, y: Y }, { id: cn2, x: 330, y: Y }], locked: [cn2] });
    pushGroup(p2, [chA, cn], 10, 0, 6);
    const s = p2.api.read();
    expect(s[cn]!.x).toBeLessThan(330 - 2 * CONE.radiusPx + 1);
    expect(s[cn]!.x - s[chA]!.x).toBeCloseTo(100, 6);
  });

  it('덩어리 끌기(groupDelta): 잠긴 개체 앞에서 무리 전체가 선다 — 손이 한 번에 크게 움직여도 건너뛰지 않는다', () => {
    const probe = probeOf({ chairs: [{ id: chA, x: 300, y: Y }, { id: chB, x: 255, y: Y }, { id: chL, x: 350, y: Y }], cones: [{ id: cn, x: 250, y: Y - 60 }], locked: [chL] });
    const d = probe.api.groupDelta([chA, chB], { x: 200, y: 0 }); // 한 번의 포인터 이동으로 L 너머까지
    expect(d.x).toBeGreaterThan(stopX - 300 - 2);
    expect(d.x).toBeLessThan(stopX - 300 + 1);
    // 상호작용이 꺼져 있으면 막지 않는다(막는 것도 상호작용이다)
    probe.api.setInteract(false);
    expect(probe.api.groupDelta([chA, chB], { x: 200, y: 0 }).x).toBe(200);
  });
});

describe('갈아탄 휠체어는 놓인다', () => {
  // 쥔 칩은 static 이고 static–static 은 쌍이 안 생긴다 — 앞서 몰던(또는 키보드로 밀던) 칩을 안 놓으면 새로 모는 칩이 그것을 뚫는다.
  it('A 를 몰다가 B 로 갈아타면 A 는 다시 밀린다', () => {
    const probe = probeOf({ chairs: [{ id: chA, x: 360, y: Y }, { id: chB, x: 300, y: Y }] });
    driveStraight(probe, chA, 0, 5); // A 를 잡았다가
    const a0 = probe.api.read()[chA]!.x;
    driveStraight(probe, chB, DRIVE.vMaxPxPerS, 90); // B 만 A 쪽으로
    expect(probe.api.read()[chA]!.x).toBeGreaterThan(a0 + 5);
  });
});

describe('driveStep 의 시간 — 한 프레임에 정확히 dt 만큼만 걷는다', () => {
  it('정착 루프가 돌고 있으면 세운다 — 루프와 조정 모드가 같은 프레임에 두 번 걷지 않게', () => {
    const probe = probeOf({ chairs: [{ id: chA, x: 300, y: Y }], balls: [{ id: bl, x: 400, y: Y }] });
    probe.api.sweepTo([{ id: chA, pose: { x: 310, y: Y, theta: 0 } }], 0.1); // 키보드 밀기 — 정착 루프를 켠다
    expect(probe.isRunning()).toBe(true);
    probe.api.driveStep([{ id: chA, pose: { x: 311, y: Y, theta: 0 } }], DT);
    expect(probe.isRunning()).toBe(false);
  });

  it('밀린 공은 driveStep 만으로도 step(dt) 와 같은 빠르기로 구른다(두 배가 아니다)', () => {
    const roll = (holdWith: 'drive' | 'step'): number => {
      const probe = createPhysicsProbe({ chairs: [{ id: chA, x: 300, y: Y }], balls: [{ id: bl, x: 340, y: Y }] });
      try {
        driveStraight(probe, chA, DRIVE.vMaxPxPerS, 30); // 공을 친다
        const hold = probe.api.read()[chA]!;
        for (let i = 0; i < 60; i++) {
          if (holdWith === 'drive') probe.api.driveStep([{ id: chA, pose: hold }], DT);
          else probe.api.step(DT);
        }
        return probe.api.read()[bl]!.x;
      } finally {
        probe.dispose();
      }
    };
    const viaDrive = roll('drive');
    expect(viaDrive).toBeGreaterThan(340 + 5); // 실제로 밀렸다(대조군)
    expect(viaDrive).toBeCloseTo(roll('step'), 6);
  });

  // 주사율이 120 Hz 의 약수가 아닌 화면(144 Hz = 6.9 ms, 90 Hz = 11.1 ms, 느린 기기 33 ms). 한 프레임의 변위를 정수 개의 substep 에
  // 나눠 놓으므로 걸음에 실린 시간이 dt 와 다르다 — 그 변위가 그대로 접촉 속도로 읽히면 찬 공이 주사율에 따라 달리 나간다.
  describe.each([6.9, 11.1, 33])('프레임 %s ms', (dtMs) => {
    const dt = dtMs / 1000;
    const V = DRIVE.vMaxPxPerS;
    const PHASES = 12;
    /** 0.5 s 몰아 공을 치고(직진으로 밀기 / 제자리 회전으로 차기) 그 자리에 선 뒤 공이 굴러간 거리 — 닿는 순간의 위상 PHASES 개의 평균. */
    function kick(mode: 'push' | 'spin', frameS: number): { roll: number; chair: number } {
      let roll = 0;
      let chair = 0;
      for (let k = 0; k < PHASES; k++) {
        const probe = createPhysicsProbe(
          mode === 'push'
            ? { chairs: [{ id: chA, x: 200 + k * 0.3, y: Y }], balls: [{ id: bl, x: 250, y: Y }] }
            : { chairs: [{ id: chA, x: 200, y: Y, angleDeg: -40 - k * 2.6 }], balls: [{ id: bl, x: 222, y: Y + 8 }] },
        );
        try {
          const x0 = probe.api.read()[chA]!.x;
          const n = Math.round(0.5 / frameS);
          for (let i = 0; i < n; i++) {
            const p = probe.api.read()[chA]!;
            const pose = mode === 'push' ? { x: p.x + V * frameS, y: p.y, theta: p.theta } : { ...p, theta: p.theta + DRIVE.omegaMaxRadPerS * frameS };
            probe.api.driveStep([{ id: chA, pose }], frameS);
          }
          const hold = probe.api.read()[chA]!;
          chair += (hold.x - x0 - V * n * frameS) / PHASES;
          for (let i = 0; i < Math.round(4 / frameS); i++) probe.api.driveStep([{ id: chA, pose: hold }], frameS);
          const b = probe.api.read()[bl]!;
          roll += (mode === 'push' ? b.x - hold.x : Math.hypot(b.x - 222, b.y - Y - 8)) / PHASES;
        } finally {
          probe.dispose();
        }
      }
      return { roll, chair };
    }

    it('휠체어는 운동학이 말한 거리만큼 간다(걸음이 없는 프레임에도)', () => {
      expect(kick('push', dt).chair).toBeCloseTo(0, 6);
    });

    it('밀다 선 뒤·돌며 찬 뒤 공이 굴러간 거리가 60 Hz 와 같다(± 8 %)', () => {
      for (const mode of ['push', 'spin'] as const) {
        const ref = kick(mode, DT).roll;
        expect(ref).toBeGreaterThan(80); // 대조군 — 실제로 찼다
        expect(kick(mode, dt).roll / ref, mode).toBeGreaterThan(0.92);
        expect(kick(mode, dt).roll / ref, mode).toBeLessThan(1.08);
      }
    });
  });

  it('최고 단계 제자리 회전이 앞 모서리 옆의 콘을 건너뛰지 않는다', () => {
    // 앞 모서리(26, 10)가 시계 방향으로 쓸고 가는 길 위 — 모서리에서 조금 앞, 조금 아래
    const probe = probeOf({ chairs: [{ id: chA, x: 300, y: Y }], cones: [{ id: cn, x: 300 + 20, y: Y + 18 }] });
    const c0 = probe.api.read()[cn]!;
    for (let i = 0; i < 30; i++) {
      const p = probe.api.read()[chA]!;
      probe.api.driveStep([{ id: chA, pose: { x: p.x, y: p.y, theta: p.theta + DRIVE.omegaMaxRadPerS * DT } }], DT);
    }
    const s = probe.api.read();
    expect(Math.hypot(s[cn]!.x - c0.x, s[cn]!.y - c0.y)).toBeGreaterThan(1); // 밀렸다
    expect(insideChair(s[chA]!, s[cn]!)).toBe(false); // 차체 안에 갇히지 않았다
  });
});
