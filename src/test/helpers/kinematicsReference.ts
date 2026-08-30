// §10.9 골든값 재생성 참조 구현.
//
// src/physics/kinematics.ts (검증 대상)를 절대 import 하지 않는다 — 검증 대상을 검증에
// 쓰면 골든 테스트가 자기 자신과 비교하는 꼴이 되어 회귀를 못 잡는다. 이 파일은 §5.2/§5.5의
// 수식을 DESIGN.md §10.9 의사코드에서 독립적으로 다시 옮겨 적은 것이며, 타입도 자체 정의라
// core/model/physics 어떤 모듈도 import 하지 않는다.
//
// 검산: G2(직선 후진) · G3/G4(견인 부호) · G5(로프 반전) · G6(ε=±2, 피벗 통과) · G7(spin 추종)
// 전부 이 구현으로 재현한 값이 §10.9 표와 소수점 4자리까지 일치한다. G6 ε=±2 는 DESIGN.md
// §10.2 각주가 2026-08-08 에 43.4855°로 정정한 값이며(원래 적혀 있던 42.9838°는 서로 독립인
// 세 구현이 전부 재현 실패했던 오기), src/physics/kinematics.test.ts 의 G6 테스트도 같은 값을
// 독립적으로 재현한다 — 이 파일이 그 교차검증 배선에 실제로 쓰인다(아래 참조).

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

/** §10.9 이 못박은 파라미터. 값을 바꾸지 마라 — 골든값은 이 상수들로 생성됐다.
 *
 *  ⚠️ **차체 기하 셋(L·W·spinRadiusMinPx)만은 제품 상수와 같아야 한다**(2026-08-29 실측).
 *  이 파일의 값어치는 같은 입력에 두 독립 구현이 같은 답을 내는지 보는 데 있는데, 한쪽이
 *  `core/constants.ts` 를 읽고 다른 쪽이 숫자를 손에 들고 있으면 차체가 바뀐 날 **비교 자체가
 *  무의미해진다** — 실측 당일 실제로 그랬다(actual 45.80° vs golden 43.49°, 둘 다 옳고 둘 다
 *  다른 차를 굴리고 있었다).
 *
 *  그런데 여기서 그 상수를 import 하면 이 파일 머리말의 독립성 규율이 깨진다. 그래서 값은
 *  **손으로 옮겨 적고**, 어긋남은 `kinematicsReference.test.ts` 첫 단언이 잡는다 — 거기서는
 *  양쪽을 다 import 해도 되기 때문이다. 차체를 다시 만지면 여기 셋도 함께 옮길 것.
 *
 *  `vLin`·`omega`·`dt` 는 계속 언 값이다 — 그 셋은 시나리오 **입력**이고 테스트가 두 구현에
 *  똑같이 먹여 준다. 사용자 설정(속도 제한)으로 바뀌는 값이라 제품 상수에 매어 두면 안 된다. */
export const GOLDEN_PARAMS = {
  L: 32.5,
  W: 20,
  sPivot: 0.2,
  vLin: 69.44444444,
  omega: 6.944444444,
  dt: 1 / 120,
  spinRadiusMinPx: 8.125,
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

/** (C) tow — §5.5. 단방향 로프(밀 수 없음) + 로프 길이 정확 유지 + 피벗 통과 반경 게인.
 *  이완 판정은 "목표점이 로프 원 안인가"(|T−P| < rho) 다 — 링크 길이가 rho 로 고정이므로
 *  원 안쪽 점은 압축 없이는 닿을 수 없다. 로프 방향과의 각도로 판정하면 옆으로 비스듬히 끄는
 *  정상 제스처까지 회전이 죽는다(2026-08-09 정정).
 *  이완 갈래는 **제자리 회전**이다(2026-08-30 기현 지시로 평행 이동에서 바뀌었다) — 그쪽
 *  주석(physics/kinematics.ts stepTow)이 근거를 쥔다. 여기서는 같은 규칙을 독립적으로 옮겨
 *  적는다: 이 파일의 값어치는 두 구현이 같은 답을 내는지 보는 것이므로 규칙이 갈리면 안 된다. */
export function stepTowGolden(
  pose: ChairPoseGolden,
  grab: GrabLatchGolden,
  target: Vec2Golden,
  dt: number,
): ChairPoseGolden {
  const eB = unitFwdGolden(pose.theta + grab.beta);
  const g = grabPointGolden(pose, grab);
  const err = { x: target.x - g.x, y: target.y - g.y };
  const toPivotX = target.x - pose.x;
  const toPivotY = target.y - pose.y;
  const dPivot = Math.hypot(toPivotX, toPivotY);
  if (dPivot < grab.rho) {
    // 로프 이완 — 밀 수 없다. **제자리에서 손끝 쪽으로만** 돈다(이동 0).
    const thetaSlack = Math.atan2(toPivotY, toPivotX) - grab.beta;
    const gainSlack = Math.min(1, dPivot / Math.max(grab.rho * 0.5, 1e-6));
    const maxD = GOLDEN_PARAMS.omega * dt;
    const dSlack = Math.max(-maxD, Math.min(maxD, wrapPiGolden(thetaSlack - pose.theta) * gainSlack));
    return { x: pose.x, y: pose.y, theta: pose.theta + dSlack };
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
  // 반경 게인 — 잡은 점이 피벗 위를 지날 때 헤딩이 정의되지 않는 특이점을 감쇠한다.
  const turnGain = Math.min(1, rLen / Math.max(grab.rho * 0.5, 1e-6));
  const delta = Math.max(-maxDelta, Math.min(maxDelta, wrapPiGolden(thetaR - pose.theta) * turnGain));
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
