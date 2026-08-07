// 4존 순수 운동학. §5.5. matter 의존 0 — 이 파일은 순수 함수만 담는다.
import type { Vec2 } from '../core/units.ts';
import { wrapPi, lerpAngle } from '../core/angle.ts';
import { SPIN_RADIUS_MIN_PX } from '../core/constants.ts';
import type { ChairPose, DragZone, ZoneConfig } from '../model/chair.ts';
import type { DragLimits, GrabLatch, KinInput, ZoneState } from './types.ts';

export const unitFwd = (theta: number): Vec2 => ({ x: Math.cos(theta), y: Math.sin(theta) });

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** Vec2 버전 클램프. §5.5 가 명시적으로 kinematics.ts 소유로 못박은 로컬 구현이다
 *  (core 의 스칼라 clamp 와는 별개 — 이 파일은 core 의 geom.ts 에 의존하지 않는다). */
export const clampMag = (v: Vec2, m: number): Vec2 => {
  const len = Math.hypot(v.x, v.y);
  if (len <= m) return v;
  const k = m / len;
  return { x: v.x * k, y: v.y * k };
};

export const lerpPose = (a: ChairPose, b: ChairPose, t: number): ChairPose => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
  theta: lerpAngle(a.theta, b.theta, t),
});

/** §5.2 잡은 점의 완전 래치. rho·beta 극좌표만 상태로 남긴다(부호 있는 레버 금지 — blocker). */
export function grabFrom(pose: ChairPose, target: Vec2): GrabLatch {
  const e = unitFwd(pose.theta);
  const relX = target.x - pose.x;
  const relY = target.y - pose.y;
  const ax = e.x * relX + e.y * relY;
  const lat = e.x * relY - e.y * relX;
  const rho = Math.hypot(ax, lat);
  const beta = Math.atan2(lat, ax);
  return { ax, lat, rho, beta };
}

/** 매 substep: G = P + rho·u(θ+beta). */
export function grabPoint(pose: ChairPose, g: GrabLatch): Vec2 {
  const eB = unitFwd(pose.theta + g.beta);
  return { x: pose.x + g.rho * eB.x, y: pose.y + g.rho * eB.y };
}

/** 존 핸들용: lat = 0 인 래치. 렌더 위치(pointAtLever)와 같은 식에서 나와야 스냅이 없다. */
export function grabFromLever(leverPx: number): GrabLatch {
  return { ax: leverPx, lat: 0, rho: Math.abs(leverPx), beta: Math.atan2(0, leverPx) };
}

export function classifyZone(s: number, z: ZoneConfig): DragZone {
  if (s <= z.sTowRearMax) return 'towRear';
  if (s < z.sSpinMin) return 'translate';
  if (s < z.sTowFrontMin) return 'spin';
  return 'towFront';
}

/** (A) translate — 평행 이동. θ 불변. */
export function stepTranslate(i: KinInput, lim: DragLimits): ChairPose {
  const G = grabPoint(i.pose, i.grab);
  const d = clampMag({ x: i.target.x - G.x, y: i.target.y - G.y }, lim.vLinPxPerS * i.dt);
  return { x: i.pose.x + d.x, y: i.pose.y + d.y, theta: i.pose.theta };
}

/** (B) spin — 피벗 고정 제자리 회전. 증분 각변위 + 반경 게인(SPIN_RADIUS_MIN_PX).
 *  절대 방향 추종(φ_tgt = atan2(T−P))은 폐기됐다 — 피벗 근처에서 게인이 발산해
 *  작은 손떨림이 ±178° 반전을 냈다(실측, §5.5 (B)). */
export function stepSpin(i: KinInput, lim: DragLimits, st: ZoneState): ChairPose {
  const dx = i.target.x - i.pose.x;
  const dy = i.target.y - i.pose.y;
  const r = Math.hypot(dx, dy);
  if (r < 1e-9) return { x: i.pose.x, y: i.pose.y, theta: i.pose.theta };
  const phi = Math.atan2(dy, dx);
  if (st.phiPrev === undefined) st.phiPrev = phi; // pointerdown 첫 호출 → Δ = 0
  const gain = Math.min(1, r / SPIN_RADIUS_MIN_PX);
  let delta = wrapPi(phi - st.phiPrev) * gain;
  st.phiPrev = phi;
  delta = clamp(delta, -lim.omegaRadPerS * i.dt, lim.omegaRadPerS * i.dt);
  return { x: i.pose.x, y: i.pose.y, theta: i.pose.theta + delta };
}

/** (C) tow — 견인. 단방향 로프 가드(err·eB < 0 → 회전 없이 평행 이동만) 필수.
 *  가드가 없으면 되밀 때 ∓167°/∓153° 잭나이프가 난다(실측, §5.5 (C) / §10.9 G5). */
export function stepTow(i: KinInput, lim: DragLimits): ChairPose {
  const { pose, grab, target, dt } = i;
  const { rho, beta } = grab;
  const eB = unitFwd(pose.theta + beta);
  const G = { x: pose.x + rho * eB.x, y: pose.y + rho * eB.y };
  const err = { x: target.x - G.x, y: target.y - G.y };
  const vLin = lim.vLinPxPerS;
  const omega = lim.omegaRadPerS;

  if (err.x * eB.x + err.y * eB.y < 0) {
    // ★ 로프 이완 — 밀 수 없다. 회전 없이 평행 이동만.
    const d = clampMag(err, vLin * dt);
    return { x: pose.x + d.x, y: pose.y + d.y, theta: pose.theta };
  }

  const vGrab = vLin + omega * rho;
  const dG = clampMag(err, vGrab * dt);
  const Gt = { x: G.x + dG.x, y: G.y + dG.y };

  let r = { x: pose.x - Gt.x, y: pose.y - Gt.y };
  let rLen = Math.hypot(r.x, r.y);
  if (rLen < 1e-9) {
    r = { x: -rho * eB.x, y: -rho * eB.y };
    rLen = Math.hypot(r.x, r.y);
  }
  // rho ≈ 0 (핸들 특이점)이면 n 이 무엇이든 rho·n = 0 이므로 임의 단위벡터로 안전하게 대체
  const n = rLen < 1e-9 ? { x: 1, y: 0 } : { x: r.x / rLen, y: r.y / rLen };
  const Pr = { x: Gt.x + rho * n.x, y: Gt.y + rho * n.y };
  const d = { x: Gt.x - Pr.x, y: Gt.y - Pr.y };
  const thetaR = Math.atan2(d.y, d.x) - beta;
  const maxDelta = omega * dt;
  const delta = clamp(wrapPi(thetaR - pose.theta), -maxDelta, maxDelta);
  const thetaNext = pose.theta + delta;

  const eB2 = unitFwd(thetaNext + beta);
  const Pr2 = { x: Gt.x - rho * eB2.x, y: Gt.y - rho * eB2.y };
  const dP = clampMag({ x: Pr2.x - pose.x, y: Pr2.y - pose.y }, vLin * dt);
  return { x: pose.x + dP.x, y: pose.y + dP.y, theta: thetaNext };
}

export function stepZone(z: DragZone, i: KinInput, lim: DragLimits, st: ZoneState): ChairPose {
  switch (z) {
    case 'translate':
      return stepTranslate(i, lim);
    case 'spin':
      return stepSpin(i, lim, st);
    case 'towRear':
    case 'towFront':
      return stepTow(i, lim);
  }
}
