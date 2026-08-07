// §10.9 골든값 재생성 참조 구현.
//
// src/physics/kinematics.ts (검증 대상)를 절대 import 하지 않는다 — 검증 대상을 검증에
// 쓰면 골든 테스트가 자기 자신과 비교하는 꼴이 되어 회귀를 못 잡는다. 이 파일은 §5.2/§5.5의
// 수식을 DESIGN.md §10.9 의사코드에서 독립적으로 다시 옮겨 적은 것이며, 타입도 자체 정의라
// core/model/physics 어떤 모듈도 import 하지 않는다.
//
// 검산: G2(직선 후진) · G3/G4(견인 부호) · G5(로프 반전) · G7(spin 추종)은 이 구현으로 재현한
// 값이 §10.9 표와 소수점 4자리까지 일치한다. G6(ε=±2, 피벗 통과)만 골든 표의 42.9838° 대신
// 43.4855°가 나온다 — 원 골든값을 만든 정확한 포인터 궤적(스윕 스텝 수·홀드 구간)이 문서
// 산문 설명만으로는 일의적으로 복원되지 않기 때문이다(§5.5 (B) 수식 자체는 아래에 있는 것이
// 전부이고, 이 차이는 궤적 재구성 문제이지 공식 문제가 아니다 — src/physics/kinematics.test.ts
// 의 G6 테스트가 같은 값(43.4855°)을 독립적으로 재현하며 이 사실을 이미 기록해 두었다).

export interface Vec2Golden {
  x: number;
  y: number;
}
export interface ChairPoseGolden {
  x: number;
  y: number;
  theta: number;
}
export interface GrabLatchGolden {
  ax: number;
  lat: number;
  rho: number;
  beta: number;
}
export interface ZoneStateGolden {
  phiPrev?: number;
}
export type DragZoneGolden = 'towRear' | 'translate' | 'spin' | 'towFront';

/** §10.9 이 못박은 파라미터. 값을 바꾸지 마라 — 골든값은 이 상수들로 생성됐다. */
export const GOLDEN_PARAMS = {
  L: 37.5,
  W: 25,
  sPivot: 0.2,
  vLin: 69.44444444,
  omega: 6.944444444,
  dt: 1 / 120,
  spinRadiusMinPx: 9.375,
  sTowRearMax: 0.12,
  sSpinMin: 0.32,
  sTowFrontMin: 0.85,
} as const;

const TAU = Math.PI * 2;

/** [-π, π) 로 정규화. src/core/angle.ts 의 wrapPi 와 동일 식을 독립적으로 다시 적은 것. */
export function wrapPiGolden(a: number): number {
  let x = (a + Math.PI) % TAU;
  if (x < 0) x += TAU;
  return x - Math.PI;
}

export const unitFwdGolden = (theta: number): Vec2Golden => ({ x: Math.cos(theta), y: Math.sin(theta) });

export function clampMagGolden(v: Vec2Golden, m: number): Vec2Golden {
  const len = Math.hypot(v.x, v.y);
  if (len <= m || len === 0) return v;
  const k = m / len;
  return { x: v.x * k, y: v.y * k };
}

/** §5.2 pointerdown 래치. s는 존 판정에만 쓴다(래치 자체는 rho·beta 극좌표만 보존). */
export function grabOfGolden(pose: ChairPoseGolden, target: Vec2Golden): GrabLatchGolden {
  const e = unitFwdGolden(pose.theta);
  const rx = target.x - pose.x;
  const ry = target.y - pose.y;
  const ax = rx * e.x + ry * e.y;
  const lat = e.x * ry - e.y * rx;
  const rho = Math.hypot(ax, lat);
  const beta = Math.atan2(lat, ax);
  return { ax, lat, rho, beta };
}

export const sOfGolden = (grab: GrabLatchGolden): number => GOLDEN_PARAMS.sPivot + grab.ax / GOLDEN_PARAMS.L;

/** §10.9 G(pose,g): 매 substep 재계산되는 잡은 점의 월드 좌표. */
export function grabPointGolden(pose: ChairPoseGolden, g: GrabLatchGolden): Vec2Golden {
  const e = unitFwdGolden(pose.theta + g.beta);
  return { x: pose.x + g.rho * e.x, y: pose.y + g.rho * e.y };
}

export function classifyZoneGolden(s: number): DragZoneGolden {
  if (s <= GOLDEN_PARAMS.sTowRearMax) return 'towRear';
  if (s < GOLDEN_PARAMS.sSpinMin) return 'translate';
  if (s < GOLDEN_PARAMS.sTowFrontMin) return 'spin';
  return 'towFront';
}

/** (A) translate — §5.5. θ 불변. */
export function stepTranslateGolden(
  pose: ChairPoseGolden,
  grab: GrabLatchGolden,
  target: Vec2Golden,
  dt: number,
): ChairPoseGolden {
  const g = grabPointGolden(pose, grab);
  const d = clampMagGolden({ x: target.x - g.x, y: target.y - g.y }, GOLDEN_PARAMS.vLin * dt);
  return { x: pose.x + d.x, y: pose.y + d.y, theta: pose.theta };
}

/** (B) spin — §5.5. 피벗 완전 고정, 증분 각변위 + 반경 게인. st 는 호출 간 공유해야 한다. */
export function stepSpinGolden(
  pose: ChairPoseGolden,
  target: Vec2Golden,
  dt: number,
  st: ZoneStateGolden,
): ChairPoseGolden {
  const dx = target.x - pose.x;
  const dy = target.y - pose.y;
  const r = Math.hypot(dx, dy);
  if (r < 1e-9) return { x: pose.x, y: pose.y, theta: pose.theta };
  const phi = Math.atan2(dy, dx);
  if (st.phiPrev === undefined) st.phiPrev = phi; // pointerdown 첫 호출 → Δ=0
  const gain = Math.min(1, r / GOLDEN_PARAMS.spinRadiusMinPx);
  let delta = wrapPiGolden(phi - st.phiPrev) * gain;
  st.phiPrev = phi;
  const maxDelta = GOLDEN_PARAMS.omega * dt;
  delta = Math.max(-maxDelta, Math.min(maxDelta, delta));
  return { x: pose.x, y: pose.y, theta: pose.theta + delta };
}

/** (C) tow — §5.5. 단방향 로프(밀 수 없음) + 로프 길이 정확 유지. */
export function stepTowGolden(
  pose: ChairPoseGolden,
  grab: GrabLatchGolden,
  target: Vec2Golden,
  dt: number,
): ChairPoseGolden {
  const eB = unitFwdGolden(pose.theta + grab.beta);
  const g = grabPointGolden(pose, grab);
  const err = { x: target.x - g.x, y: target.y - g.y };
  const alongB = err.x * eB.x + err.y * eB.y;
  if (alongB < 0) {
    // 로프 이완 — 밀 수 없다. 회전 없이 평행 이동만.
    const d = clampMagGolden(err, GOLDEN_PARAMS.vLin * dt);
    return { x: pose.x + d.x, y: pose.y + d.y, theta: pose.theta };
  }
  const vGrab = GOLDEN_PARAMS.vLin + GOLDEN_PARAMS.omega * grab.rho;
  const dG = clampMagGolden(err, vGrab * dt);
  const gt = { x: g.x + dG.x, y: g.y + dG.y };
  let r = { x: pose.x - gt.x, y: pose.y - gt.y };
  let rLen = Math.hypot(r.x, r.y);
  if (rLen < 1e-9) {
    r = { x: -grab.rho * eB.x, y: -grab.rho * eB.y };
    rLen = Math.hypot(r.x, r.y);
  }
  const n = { x: r.x / rLen, y: r.y / rLen };
  const pr = { x: gt.x + grab.rho * n.x, y: gt.y + grab.rho * n.y };
  const d = { x: gt.x - pr.x, y: gt.y - pr.y };
  const thetaR = Math.atan2(d.y, d.x) - grab.beta;
  const maxDelta = GOLDEN_PARAMS.omega * dt;
  const delta = Math.max(-maxDelta, Math.min(maxDelta, wrapPiGolden(thetaR - pose.theta)));
  const thetaP = pose.theta + delta;
  const eB2 = unitFwdGolden(thetaP + grab.beta);
  const pr2 = { x: gt.x - grab.rho * eB2.x, y: gt.y - grab.rho * eB2.y };
  const dP = clampMagGolden({ x: pr2.x - pose.x, y: pr2.y - pose.y }, GOLDEN_PARAMS.vLin * dt);
  return { x: pose.x + dP.x, y: pose.y + dP.y, theta: thetaP };
}

export function stepZoneGolden(
  zone: DragZoneGolden,
  pose: ChairPoseGolden,
  grab: GrabLatchGolden,
  target: Vec2Golden,
  dt: number,
  st: ZoneStateGolden,
): ChairPoseGolden {
  switch (zone) {
    case 'translate':
      return stepTranslateGolden(pose, grab, target, dt);
    case 'spin':
      return stepSpinGolden(pose, target, dt, st);
    case 'towRear':
    case 'towFront':
      return stepTowGolden(pose, grab, target, dt);
  }
}
