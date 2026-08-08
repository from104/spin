// 4존 순수 운동학. §5.5. matter 의존 0 — 이 파일은 순수 함수만 담는다.
import type { Vec2 } from '../core/units.ts';
import { wrapPi, lerpAngle } from '../core/angle.ts';
import { SPIN_RADIUS_MIN_PX } from '../core/constants.ts';
import type { ChairPose, DragZone, ZoneConfig } from '../model/chair.ts';
import type { DragLimits, GrabLatch, KinInput, ZoneState } from './types.ts';

export const unitFwd = (theta: number): Vec2 => ({ x: Math.cos(theta), y: Math.sin(theta) });

/** 견인 회전의 반경 게인 감쇠 구간(로프 길이 rho 대비). rLen 이 rho·이 값 아래로 떨어지면
 *  회전을 비례해 줄여 피벗 통과 특이점에서 방향이 손떨림으로 갈리는 것을 막는다. */
const ROPE_TURN_MIN_FRAC = 0.5;

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

/** (C) tow — 견인. 단방향 로프 가드(|T−P| < rho → 회전 없이 평행 이동만) + 반경 게인.
 *  가드가 없으면 되밀 때 ∓167°/∓153° 잭나이프가 난다(실측, §5.5 (C) / §10.9 G5).
 *  2026-08-09 정정: 판정을 err·eB<0 에서 |T−P|<rho 로 바꿨다 — 앞의 것은 옆으로 비스듬히
 *  끄는 정상 제스처까지 회전을 죽였다(전방 앵커 135° 1초 → θ=0.0°). */
export function stepTow(i: KinInput, lim: DragLimits): ChairPose {
  const { pose, grab, target, dt } = i;
  const { rho, beta } = grab;
  const eB = unitFwd(pose.theta + beta);
  const G = { x: pose.x + rho * eB.x, y: pose.y + rho * eB.y };
  const err = { x: target.x - G.x, y: target.y - G.y };
  const vLin = lim.vLinPxPerS;
  const omega = lim.omegaRadPerS;

  // ★ 로프 이완 판정 — 밀 수 없다. 회전 없이 평행 이동만.
  //
  // 기준은 "목표점이 로프 원 안에 있는가", 즉 |T−P| < rho 다. 링크 길이가 rho 로 고정돼
  // 있으므로 원 안쪽 점에 잡은 지점을 놓으려면 링크를 압축해야 한다 = 미는 것이다.
  //
  // 예전에는 err·eB < 0(= 로프 방향과 90°를 넘는가)으로 판정했는데, 그러면 **옆으로 비스듬히
  // 끄는 정상적인 제스처까지 회전이 죽었다**(실측: 전방 앵커를 135° 방향으로 1초 끌면 θ=0.0°,
  // 차체가 돌지 않고 미끄러지기만 함). 로프는 옆으로 당겨도 팽팽하다.
  // 원래 이 가드가 막으려던 것은 "끌어 놓고 손가락을 조금 되밀어 미세 조정" 인데,
  // 그 동작은 목표점이 로프 원 안으로 들어오므로 새 판정으로도 그대로 막힌다.
  const toPivot = { x: target.x - pose.x, y: target.y - pose.y };
  if (Math.hypot(toPivot.x, toPivot.y) < rho) {
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
  // 반경 게인 — 잡은 점이 피벗 위를 지날 때(rLen→0) 목표 헤딩이 정의되지 않아 방향이
  // 손떨림으로 갈린다(stepSpin 이 SPIN_RADIUS_MIN_PX 로 막는 것과 같은 특이점).
  // 평상시 rLen ≈ rho 라 게인은 1 이고, 포인터를 피벗 위로 밀어 넣을 때만 떨어진다.
  const gain = Math.min(1, rLen / Math.max(rho * ROPE_TURN_MIN_FRAC, 1e-6));
  const delta = clamp(wrapPi(thetaR - pose.theta) * gain, -maxDelta, maxDelta);
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
