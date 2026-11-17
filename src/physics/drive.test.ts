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
import { CHAIR, CONE, DRIVE } from '../core/constants.ts';
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
