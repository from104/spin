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

/** (C) tow — 견인. 단방향 로프(밀 수 없다) + 반경 게인.
 *  · 팽팽(|T−P| ≥ rho): 앵커가 손끝을 향하도록 돌면서 로프를 따라 끌려간다.
 *  · 이완(|T−P| < rho): **제자리에서 손끝 쪽으로만 돈다**(2026-08-30 기현 지시. 그 전에는
 *    회전 없이 평행 이동이었고, 그래서 앞 앵커를 정확히 뒤로 끄는 손짓이 후진이 됐다).
 *  2026-08-09 정정: 판정을 err·eB<0 에서 |T−P|<rho 로 바꿨다 — 앞의 것은 옆으로 비스듬히
 *  끄는 정상 제스처까지 회전을 죽였다(전방 앵커 135° 1초 → θ=0.0°).
 *  잭나이프(∓167°/∓153°, §5.5 (C) / §10.9 G5)는 회전량 상한 ω·dt 와 반경 게인이 막는다. */
export function stepTow(i: KinInput, lim: DragLimits): ChairPose {
  const { pose, grab, target, dt } = i;
  const { rho, beta } = grab;
  const eB = unitFwd(pose.theta + beta);
  const G = { x: pose.x + rho * eB.x, y: pose.y + rho * eB.y };
  const err = { x: target.x - G.x, y: target.y - G.y };
  const vLin = lim.vLinPxPerS;
  const omega = lim.omegaRadPerS;

  // ★ 로프 이완 갈래 — 링크를 압축해야 닿는 자리다(|T−P| < rho). 로프는 밀 수 없다.
  //
  // 기준은 "목표점이 로프 원 안에 있는가". 링크 길이가 rho 로 고정돼 있으므로 원 안쪽 점에
  // 잡은 지점을 놓으려면 링크를 압축해야 한다 = 미는 것이다.
  //
  // 옛 판정(2026-08-09 이전)은 err·eB < 0 이었는데 **옆으로 비스듬히 끄는 정상 제스처까지
  // 회전을 죽였다**(실측: 전방 앵커를 135° 방향으로 1초 끌면 θ=0.0°). 로프는 옆으로 당겨도
  // 팽팽하므로 판정을 |T−P| < rho 로 옮겼다.
  //
  // ── 여기서 하는 일 (2026-08-30 기현 지시) ──────────────────────────────────────────
  // *"앞뒤로 끌기 액션도 아무리 예각의 끌기여도 회전을 우선하여 움직이기 — 앞 앵커를 바로
  //  뒤로(180도) 끌면 휠체어는 제자리회전하여 끌려야 한다."*
  //
  // 예전에는 이 갈래가 **회전 없이 평행 이동**이었다. 그래서 전방 앵커를 정확히 뒤로 끄는
  // 손짓이 통째로 죽었다: 손가락이 피벗을 향해 들어오는 동안 내내 이 갈래에 갇혀 차체가
  // 돌지 않고 **뒷걸음질만** 쳤고, 피벗을 지나 반대편으로 나가야 비로소 팽팽 갈래가 받았다.
  // 즉 "180° 로 끌면 돈다" 가 실제로는 "180° 로 끌면 후진한다" 였다.
  //
  // 이제 **제자리에서 손가락 쪽으로 돈다** — 이동은 0 이다. 앵커가 손끝을 향할 때까지 돌고,
  // 다 돌면 목표가 로프 원 밖으로 나가 팽팽 갈래가 이어받아 끌려간다.
  //
  // ⚠️ 잭나이프(§10.9 G5 의 ∓167°/∓153° 한 프레임 뒤집힘)는 여기서 다시 나지 않는다. 회전량이
  //    `maxDelta = ω·dt`(≈3.83°/substep)로 잘려 있어 한 프레임에 뒤집을 수 없고, 아래 반경
  //    게인이 손가락이 피벗에 가까울 때(방향이 손떨림으로 갈리는 구간) 회전을 0 으로 끈다.
  //    옛 가드가 지키려던 것은 "한 프레임 폭주" 였지 "회전 자체" 가 아니었다.
  //
  // ⚠️ 잃는 것: 앵커를 안쪽으로 조금 당겨 **후진시키던** 미세 조정. 그 일은 차체를 잡는
  //    이동 존(2026-08-30 부터 뒤 2/3 로 넓어졌다)이 맡는다 — 문이 없어진 것이 아니라 옮겼다.
  const toPivot = { x: target.x - pose.x, y: target.y - pose.y };
  const dPivot = Math.hypot(toPivot.x, toPivot.y);
  if (dPivot < rho) {
    const thetaSlack = Math.atan2(toPivot.y, toPivot.x) - beta;
    // 팽팽 갈래와 **같은 식의** 게인이다(아래 주석 참고): 손가락이 피벗 위에 있으면 목표
    // 헤딩이 정의되지 않아 방향이 손떨림으로 갈린다.
    const gainSlack = Math.min(1, dPivot / Math.max(rho * ROPE_TURN_MIN_FRAC, 1e-6));
    const dSlack = clamp(wrapPi(thetaSlack - pose.theta) * gainSlack, -omega * dt, omega * dt);
    return { x: pose.x, y: pose.y, theta: pose.theta + dSlack };
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
