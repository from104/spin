// §10.2 physics-kin 순수 운동학 골든 테스트. 골든값은 §10.9 참조 구현으로 생성된 값이다.
// model/chair.ts (다른 모듈, 아직 없음) 대신 구조적으로 호환되는 로컬 Pose 타입만 쓴다.
import { describe, expect, it } from 'vitest';
import { DEG } from '../core/angle.ts';
import {
  classifyZone,
  clampMag,
  grabFrom,
  grabFromLever,
  grabPoint,
  stepSpin,
  stepTow,
  stepTranslate,
  stepZone,
  unitFwd,
} from './kinematics.ts';
import type { DragLimits, GrabLatch, KinInput, ZoneState } from './types.ts';

interface Pose {
  x: number;
  y: number;
  theta: number;
}

// §10.9: L=37.5, W=25, sPivot=0.20, vLin=69.44444444, ω=6.944444444, dt=1/120
const L = 37.5;
const S_PIVOT = 0.2;
const DT = 1 / 120;
const LIM: DragLimits = { vLinPxPerS: 69.44444444, omegaRadPerS: 6.944444444 };
const ZONE = { sTowRearMax: 0.12, sSpinMin: 0.32, sTowFrontMin: 0.85, grabPadPx: 10 };
const DUMMY_GRAB: GrabLatch = { ax: 0, lat: 0, rho: 0, beta: 0 };

// s, lat → GrabLatch. §10.9 grabOf 와 동일 식(ax = (s−sPivot)·L 로 역산).
function latchFromSLat(s: number, lat: number): GrabLatch {
  const ax = (s - S_PIVOT) * L;
  const rho = Math.hypot(ax, lat);
  const beta = Math.atan2(lat, ax);
  return { ax, lat, rho, beta };
}

describe('classifyZone', () => {
  it('경계값 10개', () => {
    const table: Array<[number, string]> = [
      [-0.3, 'towRear'],
      [0.05, 'towRear'],
      [0.12, 'towRear'],
      [0.13, 'translate'],
      [0.2, 'translate'],
      [0.31, 'translate'],
      [0.32, 'spin'],
      [0.84, 'spin'],
      [0.85, 'towFront'],
      [1.2, 'towFront'],
    ];
    for (const [s, expected] of table) {
      expect(classifyZone(s, ZONE)).toBe(expected);
    }
  });
});

describe('grabFromLever', () => {
  it('전방/후방 핸들 극좌표', () => {
    const rear = grabFromLever(-37.5);
    expect(rear.rho).toBeCloseTo(37.5, 9);
    expect(rear.beta).toBeCloseTo(Math.PI, 9);
    const front = grabFromLever(60);
    expect(front.rho).toBeCloseTo(60, 9);
    expect(front.beta).toBeCloseTo(0, 9);
  });
});

describe('pointAtLever 동치 (grabPoint ∘ grabFromLever)', () => {
  it('레버 −7.5 = 뒤끝, 30 = 앞범퍼 (임의 θ 5개)', () => {
    const thetas = [0, 0.7, 1.9, -2.3, 4.1];
    for (const theta of thetas) {
      const pose: Pose = { x: 10, y: -5, theta };
      const rear = grabPoint(pose as never, grabFromLever(-7.5));
      const front = grabPoint(pose as never, grabFromLever(30));
      const u = unitFwd(theta);
      expect(rear.x).toBeCloseTo(pose.x - 7.5 * u.x, 9);
      expect(rear.y).toBeCloseTo(pose.y - 7.5 * u.y, 9);
      expect(front.x).toBeCloseTo(pose.x + 30 * u.x, 9);
      expect(front.y).toBeCloseTo(pose.y + 30 * u.y, 9);
    }
  });
});

describe('G1 스냅 없음 (blocker 회귀)', () => {
  it('8조합 전부 첫 substep Δ = 0', () => {
    const pose0: Pose = { x: 100, y: 50, theta: 0.3 };
    const combos: Array<{ zone: 'towRear' | 'translate' | 'spin' | 'towFront'; s: number; lat: number }> = [
      { zone: 'translate', s: 0.25, lat: 12.5 },
      { zone: 'translate', s: 0.2, lat: -12.5 },
      { zone: 'spin', s: 0.32, lat: 12.5 },
      { zone: 'spin', s: 0.55, lat: 12.5 },
      { zone: 'spin', s: 0.85, lat: -12.5 },
      { zone: 'towFront', s: 0.9, lat: 12.5 },
      { zone: 'towRear', s: 0.06, lat: 12.5 },
      { zone: 'towRear', s: -0.2, lat: -12.5 },
    ];
    for (const { zone, s, lat } of combos) {
      const grab = latchFromSLat(s, lat);
      const T0 = grabPoint(pose0 as never, grab);
      const st: ZoneState = {};
      const input: KinInput = { pose: pose0 as never, grab, target: T0, dt: DT };
      const out = stepZone(zone, input, LIM, st);
      expect(Math.hypot(out.x - pose0.x, out.y - pose0.y)).toBeLessThan(1e-9);
      expect(Math.abs(out.theta - pose0.theta)).toBeLessThan(1e-9);
    }
  });
});

describe('translate 일반 성질', () => {
  it('θ 불변, 변위 상한, 상한 미만이면 G\' === T', () => {
    const pose: Pose = { x: 5, y: 5, theta: 0.4 };
    const grab = latchFromSLat(0.2, 0);
    // 상한 밖: 멀리 있는 목표
    const far: KinInput = { pose: pose as never, grab, target: { x: 500, y: 500 }, dt: DT };
    const outFar = stepTranslate(far, LIM);
    expect(outFar.theta).toBe(pose.theta);
    const disp = Math.hypot(outFar.x - pose.x, outFar.y - pose.y);
    expect(disp).toBeLessThanOrEqual(LIM.vLinPxPerS * DT + 1e-9);

    // 상한 안: 아주 가까운 목표 → G' === T
    const G = grabPoint(pose as never, grab);
    const near: KinInput = { pose: pose as never, grab, target: { x: G.x + 0.001, y: G.y }, dt: DT };
    const outNear = stepTranslate(near, LIM);
    const Gp = grabPoint(outNear, grab);
    expect(Gp.x).toBeCloseTo(near.target.x, 9);
    expect(Gp.y).toBeCloseTo(near.target.y, 9);
  });
});

describe('spin 일반 성질', () => {
  it("P' === P (완전 일치), |Δθ| ≤ ω·dt + 1e-12", () => {
    const pose: Pose = { x: 12, y: -7, theta: 1.1 };
    const st: ZoneState = { phiPrev: 0 };
    const input: KinInput = { pose: pose as never, grab: DUMMY_GRAB, target: { x: 400, y: 400 }, dt: DT };
    const out = stepSpin(input, LIM, st);
    expect(out.x).toBe(pose.x);
    expect(out.y).toBe(pose.y);
    expect(Math.abs(out.theta - pose.theta)).toBeLessThanOrEqual(LIM.omegaRadPerS * DT + 1e-12);
  });
});

describe('G2 직선 후진', () => {
  it('towRear s=0.06 lat=0, 84스텝(0.7s) → P=(−40.0000,−0.0000), θ=0.000000°', () => {
    const pose0: Pose = { x: 0, y: 0, theta: 0 };
    const grab = latchFromSLat(0.06, 0);
    const G0 = grabPoint(pose0 as never, grab);
    let pose: Pose = pose0;
    for (let k = 1; k <= 84; k++) {
      const t = k * DT;
      const target = { x: G0.x - 40 * Math.min(1, t / 0.6), y: G0.y };
      pose = stepTow({ pose: pose as never, grab, target, dt: DT }, LIM);
      // 로프 길이 불변식
      const G = grabPoint(pose as never, grab);
      expect(Math.abs(Math.hypot(G.x - pose.x, G.y - pose.y) - grab.rho)).toBeLessThan(1e-9);
    }
    expect(pose.x).toBeCloseTo(-40, 4);
    expect(pose.y).toBeCloseTo(0, 4);
    expect(pose.theta * DEG).toBeCloseTo(0, 4);
  });
});

describe('G3 전방 견인 부호', () => {
  it('towFront s=0.90 lat=0, 60스텝 → θ=+54.4538°, P=(10.9893,8.6418)', () => {
    const pose0: Pose = { x: 0, y: 0, theta: 0 };
    const grab = latchFromSLat(0.9, 0);
    const G0 = grabPoint(pose0 as never, grab);
    let pose: Pose = pose0;
    for (let k = 1; k <= 60; k++) {
      const t = k * DT;
      const target = { x: G0.x, y: G0.y + 30 * Math.min(1, t / 0.5) };
      pose = stepTow({ pose: pose as never, grab, target, dt: DT }, LIM);
    }
    expect(pose.theta * DEG).toBeCloseTo(54.4538, 2);
    expect(pose.x).toBeCloseTo(10.9893, 2);
    expect(pose.y).toBeCloseTo(8.6418, 2);
  });
});

describe('G4 후방 견인 부호', () => {
  it('towRear s=0.06 lat=0, 60스텝 → θ=−89.3035°, P=(−5.1862,24.7504)', () => {
    const pose0: Pose = { x: 0, y: 0, theta: 0 };
    const grab = latchFromSLat(0.06, 0);
    const G0 = grabPoint(pose0 as never, grab);
    let pose: Pose = pose0;
    for (let k = 1; k <= 60; k++) {
      const t = k * DT;
      const target = { x: G0.x, y: G0.y + 30 * Math.min(1, t / 0.5) };
      pose = stepTow({ pose: pose as never, grab, target, dt: DT }, LIM);
    }
    expect(pose.theta * DEG).toBeCloseTo(-89.3035, 2);
    expect(pose.x).toBeCloseTo(-5.1862, 2);
    expect(pose.y).toBeCloseTo(24.7504, 2);
  });
});

describe('G5 로프 이완 · 견인 회전 (blocker 회귀)', () => {
  // 2026-08-09 정정: 이완 판정을 "로프 방향과 90°를 넘는가"(err·eB<0)에서
  // "목표점이 로프 원 안인가"(|T−P| < rho)로 바꿨다. 앞의 것은 옆으로 비스듬히 끄는
  // 정상 제스처까지 회전을 죽였다(전방 앵커 135° 방향 1초 → θ=0.0°, 미끄러지기만 함).
  // 아래 세 성질이 동시에 성립해야 한다.

  it('끌어 놓고 살짝 되밀어 미세 조정하면 차체가 돌지 않는다 (원래 가드의 목적)', () => {
    // 매 드래그마다 일어나는 동작이라 여기서 방향이 흔들리면 못 쓴다.
    for (const s of [1.0, 0.0]) {
      const grab = latchFromSLat(s, 0);
      const dir = s >= 0.5 ? 1 : -1;
      for (const eps of [1, -1, 0.2, -0.2]) {
        let pose: Pose = { x: 300, y: 250, theta: 0 };
        const G0 = grabPoint(pose as never, grab);
        for (let k = 1; k <= 84; k++) {
          const t = k * DT;
          pose = stepTow({ pose: pose as never, grab, target: { x: G0.x + dir * 40 * Math.min(1, t / 0.6), y: G0.y }, dt: DT }, LIM);
        }
        const Gc = grabPoint(pose as never, grab);
        for (let k = 0; k < 84; k++) {
          pose = stepTow({ pose: pose as never, grab, target: { x: Gc.x - dir * 6, y: Gc.y + eps }, dt: DT }, LIM);
        }
        expect(Math.abs(pose.theta * DEG)).toBeLessThan(0.01);
      }
    }
  });

  it('로프 원 밖으로 크게 되밀면 회전하되, 그 양이 섭동에 연속이다', () => {
    // 반대편까지 끌고 가면 도는 게 물리적으로 맞다. 문제였던 것은 회전 여부가 아니라
    // 손떨림 0.2px 에 ∓167° 로 갈리던 것 — 반경 게인으로 연속이 됐는지를 본다.
    const grab = latchFromSLat(1.0, 0);
    const run = (eps: number): number => {
      let pose: Pose = { x: 300, y: 250, theta: 0 };
      const G0 = grabPoint(pose as never, grab);
      for (let k = 1; k <= 84; k++) {
        const t = k * DT;
        pose = stepTow({ pose: pose as never, grab, target: { x: G0.x + 40 * Math.min(1, t / 0.6), y: G0.y }, dt: DT }, LIM);
      }
      for (let k = 0; k < 84; k++) {
        pose = stepTow({ pose: pose as never, grab, target: { x: G0.x - 40, y: G0.y + eps }, dt: DT }, LIM);
      }
      return pose.theta * DEG;
    };
    const big = run(1);
    const small = run(0.2);
    // 부호는 섭동 부호를 따르고, 크기는 섭동에 비례한다(반전·폭주 없음)
    expect(Math.sign(big)).toBe(1);
    expect(Math.sign(run(-1))).toBe(-1);
    expect(Math.abs(run(-1) + big)).toBeLessThan(0.01); // 좌우 대칭
    expect(Math.abs(small)).toBeLessThan(Math.abs(big)); // 작은 섭동 → 작은 회전
    expect(Math.abs(big)).toBeLessThan(30); // 폭주하지 않는다(예전엔 167°)
  });

  it('앵커를 비스듬히 끌면 차체가 따라 돈다 (사용자 신고 회귀)', () => {
    // 신고: "앞뒤 앵커의 드래그 각도가 급하면 칩 회전이 안 된다. 자연스럽지 않다."
    for (const [s, label] of [
      [1.0, '전방 앵커'],
      [0.0, '후방 앵커'],
    ] as const) {
      const grab = latchFromSLat(s, 0);
      const start: Pose = { x: 300, y: 250, theta: 0 };
      const G0 = grabPoint(start as never, grab);
      // 로프 방향과 135° — 예전 가드(err·eB<0)가 회전을 완전히 죽이던 각도
      const target = { x: G0.x + (s >= 0.5 ? -90 : 90), y: G0.y + 90 };
      let pose: Pose = start;
      for (let k = 0; k < 120; k++) pose = stepTow({ pose: pose as never, grab, target, dt: DT }, LIM);
      expect(Math.abs(pose.theta * DEG), `${label} 가 돌지 않았다`).toBeGreaterThan(30);
    }
  });
});

describe('G6 spin 피벗 통과 안정성 (major 회귀)', () => {
  // 궤적 재구성 메모: 아래 궤적은 §10.9 표의 산문 설명만으로 재구성한 것이다(§10.9 참조 구현
  // src/test/helpers/kinematicsReference.ts 와는 독립적으로 재현한 값 — 둘 다 45.79575° 로 일치한다).
  // ⚠️ 스윕 폭 ±11.25 는 **시나리오 상수로 언 값이다**(옛 차체의 반몸통에서 왔지만 지금은
  //    그냥 고정 궤적이다). 차체를 따라 줄이면 골든이 또 움직이는데, 이 테스트가 지키는 것은
  //    치수가 아니라 *피벗을 통과할 때 폭주하지 않는다* 이므로 궤적은 얼려 두는 편이 낫다.
  // ε(측방 섭동)를 통과 스윕 18스텝 + 유지 60스텝 내내 y 오프셋으로 유지해야
  // 결과가 골든값 자릿수에 근접한다(유지 구간에만 적용하면 스윕이 피벗을 정확히 통과해
  // r<1e-9 특이점에 걸리며 전혀 다른 값이 나온다). phiPrev 는 루프 첫 호출(k=1)에서 스스로
  // 래치된다 — pointerdown 첫 호출이 Δ=0 을 내는 계약(§5.5 (B))이 여기서도 적용되어 t=0(오프셋
  // +11.25) 시점의 회전분은 첫 스텝에 묻혀 사라진다(G7 재현으로 이 재구성 방식 자체는 확인됨:
  // 아래와 동일한 방식으로 G7 을 재현하면 golden 과 소수점 4자리까지 일치한다).
  function runPass(eps: number): Pose {
    const pose0: Pose = { x: 0, y: 0, theta: 0 };
    let pose: Pose = pose0;
    const st: ZoneState = {};
    for (let k = 1; k <= 18; k++) {
      const offset = 11.25 - 22.5 * (k / 18);
      const target = { x: pose0.x + offset, y: pose0.y + eps };
      pose = stepSpin({ pose: pose as never, grab: DUMMY_GRAB, target, dt: DT }, LIM, st);
    }
    for (let k = 0; k < 60; k++) {
      const target = { x: pose0.x - 11.25, y: pose0.y + eps };
      pose = stepSpin({ pose: pose as never, grab: DUMMY_GRAB, target, dt: DT }, LIM, st);
    }
    return pose;
  }

  it('ε=±0.4 → θ ≈ ±18.7372°(재구성 궤적이 golden 과 0.001° 이내로 일치)', () => {
    expect(Math.abs(runPass(0.4).theta * DEG - 18.7372)).toBeLessThan(0.01);
    expect(Math.abs(runPass(-0.4).theta * DEG + 18.7372)).toBeLessThan(0.01);
  });

  it('ε=±2 → θ = ±45.79575°(세 구현 정합. 차체 1.3 m 재유도값)', () => {
    // 값의 내력(지우지 않는다):
    //   · §10.9 골든 표 원본 42.9838° — **오기**였다. 서로 독립인 세 구현이 전부 재현 실패했다.
    //   · 2026-08-08 DESIGN.md §10.2 각주가 43.4855° 로 정정. 차체 1.5 m 시절의 값이다.
    //   · 2026-08-29 실측(차체 1.3 m)으로 `SPIN_RADIUS_MIN_PX` 가 9.375 → 8.125 가 되면서
    //     **45.79575°** 가 됐다. 게인 감쇠 반경이 줄면 같은 궤적에서 더 많이 돈다.
    // 지금도 셋(physics-kin 본 구현 · §10.9 참조 구현 · 이 재구성 궤적)이 전부 일치한다 —
    // 바뀐 것은 답이 아니라 차다.
    expect(runPass(2).theta * DEG).toBeCloseTo(45.79575, 3);
    expect(runPass(-2).theta * DEG).toBeCloseTo(-45.79575, 3);
  });

  it('부호가 ε 부호와 항상 일치 (질적 회귀 방지)', () => {
    for (const eps of [0.4, -0.4, 2, -2]) {
      expect(Math.sign(runPass(eps).theta)).toBe(Math.sign(eps));
    }
  });
});

describe('G7 spin 추종', () => {
  it('2 rad/s·1.0s → 113.637°, 12 rad/s·0.5s → 195.628°(ω 상한 미포화)', () => {
    {
      const pose0: Pose = { x: 0, y: 0, theta: 0 };
      let pose: Pose = pose0;
      // phiPrev 를 미리 0으로 래치하지 않는다 — pointerdown 첫 호출(k=1)이 자연스럽게
      // phiPrev 를 phi(k=1)로 세팅하며 Δ=0 을 내는 것이 §5.5 (B) 계약이다.
      const st: ZoneState = {};
      const steps = Math.round(1.0 / DT);
      for (let k = 1; k <= steps; k++) {
        const phi = 2.0 * (k * DT);
        const target = { x: pose0.x + 30 * Math.cos(phi), y: pose0.y + 30 * Math.sin(phi) };
        pose = stepSpin({ pose: pose as never, grab: DUMMY_GRAB, target, dt: DT }, LIM, st);
      }
      // 계약 허용오차는 ±0.1(§10.9 G7) — toBeCloseTo(x, 0)은 ±0.5라 5배 느슨했다(감사 minor #9).
      // 실측 오차는 0.0004이므로 자릿수를 조여도 공짜다.
      expect(pose.theta * DEG).toBeCloseTo(113.637, 1);
    }
    {
      const pose0: Pose = { x: 0, y: 0, theta: 0 };
      let pose: Pose = pose0;
      const st: ZoneState = {};
      const steps = Math.round(0.5 / DT);
      for (let k = 1; k <= steps; k++) {
        const phi = 12.0 * (k * DT);
        const target = { x: pose0.x + 30 * Math.cos(phi), y: pose0.y + 30 * Math.sin(phi) };
        pose = stepSpin({ pose: pose as never, grab: DUMMY_GRAB, target, dt: DT }, LIM, st);
      }
      expect(pose.theta * DEG).toBeCloseTo(195.628, 1);
    }
  });
});

describe('G8 속도 상한', () => {
  it('먼 목표로 순간이동, 120스텝 — 3존 전부 최대 피벗 속력 69.444444 px/s', () => {
    const specs: Array<{ zone: 'translate' | 'towFront' | 'towRear'; s: number }> = [
      { zone: 'translate', s: 0.2 },
      { zone: 'towFront', s: 0.9 },
      { zone: 'towRear', s: 0.05 },
    ];
    for (const { zone, s } of specs) {
      const pose0: Pose = { x: 0, y: 0, theta: 0 };
      const grab = latchFromSLat(s, 0);
      const st: ZoneState = {};
      let pose: Pose = pose0;
      for (let k = 0; k < 120; k++) {
        const input: KinInput = { pose: pose as never, grab, target: { x: 500, y: 500 }, dt: DT };
        const next = stepZone(zone, input, LIM, st);
        const stepDisp = Math.hypot(next.x - pose.x, next.y - pose.y);
        expect(stepDisp).toBeCloseTo(LIM.vLinPxPerS * DT, 5);
        pose = next;
        if (zone !== 'translate') {
          const G = grabPoint(pose as never, grab);
          expect(Math.abs(Math.hypot(G.x - pose.x, G.y - pose.y) - grab.rho)).toBeLessThan(1e-9);
        }
      }
    }
  });
});

describe('특이점 — NaN/Infinity 없음', () => {
  it('T === P (spin)', () => {
    const pose: Pose = { x: 3, y: 4, theta: 0.2 };
    const st: ZoneState = {};
    const out = stepSpin({ pose: pose as never, grab: DUMMY_GRAB, target: { x: 3, y: 4 }, dt: DT }, LIM, st);
    expect(Number.isFinite(out.x)).toBe(true);
    expect(Number.isFinite(out.y)).toBe(true);
    expect(Number.isFinite(out.theta)).toBe(true);
    expect(out.theta).toBe(pose.theta);
  });

  it('Gt === P (tow)', () => {
    const pose: Pose = { x: 0, y: 0, theta: 0 };
    const grab = latchFromSLat(0.06, 0);
    const G = grabPoint(pose as never, grab); // G = (-5.25, 0)
    const out = stepTow({ pose: pose as never, grab, target: G, dt: DT }, LIM);
    expect(Number.isFinite(out.x)).toBe(true);
    expect(Number.isFinite(out.y)).toBe(true);
    expect(Number.isFinite(out.theta)).toBe(true);
  });

  it('rho === 0 (translate 핸들)', () => {
    const pose: Pose = { x: 0, y: 0, theta: 0.5 };
    const grab = grabFromLever(0);
    expect(grab.rho).toBe(0);
    const out = stepTow({ pose: pose as never, grab, target: { x: 20, y: 20 }, dt: DT }, LIM);
    expect(Number.isFinite(out.x)).toBe(true);
    expect(Number.isFinite(out.y)).toBe(true);
    expect(Number.isFinite(out.theta)).toBe(true);
  });
});

describe('clampMag', () => {
  it('상한 이하는 그대로, 초과는 방향 유지한 채 축소', () => {
    expect(clampMag({ x: 3, y: 4 }, 10)).toEqual({ x: 3, y: 4 });
    const c = clampMag({ x: 3, y: 4 }, 2);
    expect(Math.hypot(c.x, c.y)).toBeCloseTo(2, 9);
  });
});

describe('grabFrom', () => {
  it('축/측방 분해가 §5.2 식과 일치', () => {
    const pose: Pose = { x: 0, y: 0, theta: 0 };
    const g = grabFrom(pose as never, { x: 10, y: 5 });
    expect(g.ax).toBeCloseTo(10, 9);
    expect(g.lat).toBeCloseTo(5, 9);
    expect(g.rho).toBeCloseTo(Math.hypot(10, 5), 9);
  });
});
