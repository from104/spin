// §10.9 교차검증 배선 — kinematicsReference.ts(독립 참조 구현)를 실제 구현(src/physics/kinematics.ts)
// 과 나란히 돌려 결과가 일치하는지 확인한다. 감사 minor #6: 이 참조 구현은 커밋만 되고 어떤
// 테스트도 import 하지 않아, 골든 테스트가 하드코딩 숫자와만 대조하고 계약이 요구한 교차검증이
// 배선되지 않았다는 지적을 받았다. src/physics/kinematics.test.ts(§10.2 골든값 자체)는 물리
// 팀 소유라 이 파일에서 건드리지 않고, 대신 여기(src/test/*)에 별도로 교차검증을 붙인다.
//
// 검증 대상(kinematics.ts)과 참조 구현(kinematicsReference.ts)은 서로 완전히 독립적으로
// DESIGN.md §5.2/§5.5 수식을 옮겨 적은 것이다 — 한쪽이 다른 쪽을 import 하지 않는다.
import { describe, expect, it } from 'vitest';
import {
  classifyZone,
  grabFrom,
  grabPoint,
  stepZone,
  unitFwd,
} from '../../physics/kinematics.ts';
import type { DragZone } from '../../model/chair.ts';
import type { DragLimits, GrabLatch, KinInput, ZoneState } from '../../physics/types.ts';
import {
  GOLDEN_PARAMS,
  classifyZoneGolden,
  grabOfGolden,
  grabPointGolden,
  stepZoneGolden,
  unitFwdGolden,
  type ChairPoseGolden,
  type DragZoneGolden,
  type GrabLatchGolden,
  type ZoneStateGolden,
} from './kinematicsReference.ts';

// §10.9 파라미터 — kinematics.test.ts 와 동일 값(둘 다 GOLDEN_PARAMS 에서 나온 상수라 반드시
// 같아야 한다. 값을 바꾸면 두 구현이 서로 다른 계약을 검증하게 된다).
const L = GOLDEN_PARAMS.L;
const S_PIVOT = GOLDEN_PARAMS.sPivot;
const DT = GOLDEN_PARAMS.dt;
const LIM: DragLimits = { vLinPxPerS: GOLDEN_PARAMS.vLin, omegaRadPerS: GOLDEN_PARAMS.omega };
const ZONE = {
  sTowRearMax: GOLDEN_PARAMS.sTowRearMax,
  sSpinMin: GOLDEN_PARAMS.sSpinMin,
  sTowFrontMin: GOLDEN_PARAMS.sTowFrontMin,
  grabPadPx: 10,
};

interface Pose {
  x: number;
  y: number;
  theta: number;
}

function latchFromSLat(s: number, lat: number): GrabLatch {
  const ax = (s - S_PIVOT) * L;
  const rho = Math.hypot(ax, lat);
  const beta = Math.atan2(lat, ax);
  return { ax, lat, rho, beta };
}

// mulberry32 — 결정적 PRNG(테스트 재현성을 위해 Math.random 대신 씀).
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('§10.9 kinematicsReference.ts 교차검증', () => {
  it('unitFwd/classifyZone/grabFrom/grabPoint — 무작위 100 샘플에서 완전 일치(1e-12)', () => {
    const rng = mulberry32(42);
    for (let i = 0; i < 100; i++) {
      const theta = (rng() - 0.5) * 20; // 여러 바퀴 감긴 각도도 포함
      const u = unitFwd(theta);
      const uG = unitFwdGolden(theta);
      expect(u.x).toBeCloseTo(uG.x, 12);
      expect(u.y).toBeCloseTo(uG.y, 12);

      const s = -0.5 + rng() * 2; // [-0.5, 1.5) — 4존 경계를 다 걸침
      expect(classifyZone(s, ZONE)).toBe(classifyZoneGolden(s) as DragZone);

      const pose: Pose = { x: (rng() - 0.5) * 200, y: (rng() - 0.5) * 200, theta };
      const target = { x: (rng() - 0.5) * 200, y: (rng() - 0.5) * 200 };
      const grab = grabFrom(pose as never, target);
      const grabG = grabOfGolden(pose as ChairPoseGolden, target);
      expect(grab.ax).toBeCloseTo(grabG.ax, 9);
      expect(grab.lat).toBeCloseTo(grabG.lat, 9);
      expect(grab.rho).toBeCloseTo(grabG.rho, 9);
      expect(grab.beta).toBeCloseTo(grabG.beta, 9);

      const g = grabPoint(pose as never, grab);
      const gG = grabPointGolden(pose as ChairPoseGolden, grabG);
      expect(g.x).toBeCloseTo(gG.x, 9);
      expect(g.y).toBeCloseTo(gG.y, 9);
    }
  });

  it('4존 전부 — 무작위 이동 목표를 60스텝 따라가도 실제 구현과 참조 구현의 궤적이 매 스텝 일치(1e-6)', () => {
    const zones: DragZone[] = ['translate', 'spin', 'towRear', 'towFront'];
    const sByZone: Record<DragZone, number> = { towRear: 0.06, translate: 0.2, spin: 0.5, towFront: 0.9 };
    for (const zone of zones) {
      const rng = mulberry32(zone.length * 1000 + 7); // 존마다 다른 결정적 시드
      const pose0: Pose = { x: 3, y: -4, theta: 0.15 };
      const grab = latchFromSLat(sByZone[zone], 6);
      const grabG: GrabLatchGolden = { ax: grab.ax, lat: grab.lat, rho: grab.rho, beta: grab.beta };

      let pose: Pose = pose0;
      let poseG: ChairPoseGolden = { ...pose0 };
      const st: ZoneState = {};
      const stG: ZoneStateGolden = {};

      for (let k = 0; k < 60; k++) {
        const target = { x: 60 * Math.sin(k * 0.11 + rng() * 0.01), y: 40 * Math.cos(k * 0.07) };
        const input: KinInput = { pose: pose as never, grab, target, dt: DT };
        pose = stepZone(zone, input, LIM, st) as unknown as Pose;
        poseG = stepZoneGolden(zone as DragZoneGolden, poseG, grabG, target, DT, stG);

        expect(pose.x).toBeCloseTo(poseG.x, 6);
        expect(pose.y).toBeCloseTo(poseG.y, 6);
        expect(pose.theta).toBeCloseTo(poseG.theta, 6);
      }
    }
  });

  it('G6 피벗 통과 ε=±2 — 참조 구현도 실제 구현과 같은 43.4855°(§10.2 각주 2026-08-08 정정값)를 낸다', () => {
    function runPassActual(eps: number): Pose {
      const pose0: Pose = { x: 0, y: 0, theta: 0 };
      let pose: Pose = pose0;
      const st: ZoneState = {};
      const dummyGrab: GrabLatch = { ax: 0, lat: 0, rho: 0, beta: 0 };
      for (let k = 1; k <= 18; k++) {
        const offset = 11.25 - 22.5 * (k / 18);
        const target = { x: pose0.x + offset, y: pose0.y + eps };
        const input: KinInput = { pose: pose as never, grab: dummyGrab, target, dt: DT };
        pose = stepZone('spin', input, LIM, st) as unknown as Pose;
      }
      for (let k = 0; k < 60; k++) {
        const target = { x: pose0.x - 11.25, y: pose0.y + eps };
        const input: KinInput = { pose: pose as never, grab: dummyGrab, target, dt: DT };
        pose = stepZone('spin', input, LIM, st) as unknown as Pose;
      }
      return pose;
    }
    function runPassGolden(eps: number): ChairPoseGolden {
      const pose0: ChairPoseGolden = { x: 0, y: 0, theta: 0 };
      let pose = pose0;
      const st: ZoneStateGolden = {};
      const dummyGrab: GrabLatchGolden = { ax: 0, lat: 0, rho: 0, beta: 0 };
      for (let k = 1; k <= 18; k++) {
        const offset = 11.25 - 22.5 * (k / 18);
        const target = { x: pose0.x + offset, y: pose0.y + eps };
        pose = stepZoneGolden('spin', pose, dummyGrab, target, DT, st);
      }
      for (let k = 0; k < 60; k++) {
        const target = { x: pose0.x - 11.25, y: pose0.y + eps };
        pose = stepZoneGolden('spin', pose, dummyGrab, target, DT, st);
      }
      return pose;
    }

    for (const eps of [2, -2]) {
      const actual = runPassActual(eps);
      const golden = runPassGolden(eps);
      expect(actual.theta * (180 / Math.PI)).toBeCloseTo(golden.theta * (180 / Math.PI), 3);
      expect(Math.abs(actual.theta * (180 / Math.PI))).toBeCloseTo(43.4855, 3);
    }
  });
});
