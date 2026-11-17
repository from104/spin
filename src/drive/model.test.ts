// 조정 모드 운동학(model.ts)을 고정 dt 로 잰다 — docs/PLAN-SIMPLE-DRIVE.md C2.
// 지우면 새는 실기 버그: 램프가 0.7 s 가 아니라 프레임 수에 묶여 화면 주사율마다 다르게 붙는 것, 낮은 단계가 최고 단계와
// 같은 빠르기로 도는 것, 후진이 보는 쪽으로 가는 것, 호가 반지름을 잃고 나선이 되는 것, 데드존이 손떨림을 흘리는 것.
// 기대값은 DRIVE 상수에서 계산한다(값을 베끼지 않는다) — 여기서 보는 것은 적분·램프의 **동작**이다.
import { describe, expect, it } from 'vitest';
import { DRIVE } from '../core/constants.ts';
import { initialDriveState, stepDrive, type DriveInput, type DriveState } from './model.ts';

const DT = 1 / 60;
function run(s: DriveState, input: DriveInput, level: number, seconds: number, dt = DT): DriveState {
  const n = Math.round(seconds / dt);
  for (let i = 0; i < n; i++) s = stepDrive(s, input, level, dt);
  return s;
}
const origin = (theta = 0): DriveState => initialDriveState({ x: 0, y: 0, theta });

describe('조정 모드 운동학', () => {
  it('직진: 보는 쪽으로, 0.7 s 램프를 뺀 거리만큼 — 주사율이 달라도 같다', () => {
    const vMax = DRIVE.vMaxPxPerS;
    for (const dt of [1 / 60, 1 / 144]) {
      const s = run(origin(Math.PI / 2), { fwd: 1, turn: 0 }, 5, 2, dt);
      // 보는 쪽 = +y(θ = 90°). 램프 구간 평균 속도는 절반이라 거리 = v·(T − rampS/2)
      expect(s.x).toBeCloseTo(0, 6);
      expect(Math.abs(s.y - vMax * (2 - DRIVE.rampS / 2))).toBeLessThan(1); // 1 px = 4 cm — 이산 적분의 반 걸음 몫
      expect(s.v).toBe(vMax);
    }
  });

  it('램프: 최고 단계는 0.7 s 에 최고속, 3단은 같은 가속도로 더 일찍 · 손을 떼면 같은 비율로 선다', () => {
    let s = origin();
    let t = 0;
    while (s.v < DRIVE.vMaxPxPerS) {
      s = stepDrive(s, { fwd: 1, turn: 0 }, 5, DT);
      t += DT;
    }
    expect(t).toBeCloseTo(DRIVE.rampS, 1);
    s = run(origin(), { fwd: 1, turn: 0 }, 3, DRIVE.rampS * 0.6 + DT);
    expect(s.v).toBeCloseTo(DRIVE.vMaxPxPerS * 0.6, 6);
    // 최고속에서 손을 떼면 rampS 안에 0
    s = run(run(origin(), { fwd: 1, turn: 0 }, 5, 1), { fwd: 0, turn: 0 }, 5, DRIVE.rampS + DT);
    expect(s.v).toBe(0);
  });

  it('회전: 단계 n 의 각속도는 최고값의 n/5 — 피벗(자세 x,y)은 제자리', () => {
    for (const level of [1, 3, 5]) {
      const s = run(origin(), { fwd: 0, turn: 1 }, level, 1);
      expect(s.omega).toBeCloseTo((DRIVE.omegaMaxRadPerS * level) / DRIVE.levels, 6);
      expect(Math.hypot(s.x, s.y)).toBe(0);
    }
    // 오른쪽 = 시계 = θ 증가
    expect(run(origin(), { fwd: 0, turn: 1 }, 3, 0.2).theta).toBeGreaterThan(0);
  });

  it('호: 전진 + 회전은 반지름 v/ω 의 원 — 한 바퀴 돌면 출발점 근처로 돌아온다', () => {
    const level = 2;
    let s = run(origin(), { fwd: 1, turn: 1 }, level, 1); // 램프를 끝낸다
    const r = s.v / s.omega;
    const start = { x: s.x, y: s.y };
    const lap = (2 * Math.PI) / s.omega;
    let far = 0;
    for (let i = 0; i < Math.round(lap / DT); i++) {
      s = stepDrive(s, { fwd: 1, turn: 1 }, level, DT);
      far = Math.max(far, Math.hypot(s.x - start.x, s.y - start.y));
    }
    expect(far).toBeCloseTo(2 * r, 0); // 지름만큼 멀어졌다가
    expect(Math.hypot(s.x - start.x, s.y - start.y)).toBeLessThan(r * 0.15); // 돌아온다(나선이 아니다)
  });

  it('후진: 보는 쪽 반대로 가고, 회전은 전진과 같다 — 오른쪽 = 시계, 왼쪽 = 반시계', () => {
    const back = run(origin(0), { fwd: -1, turn: 0 }, 3, 1);
    expect(back.x).toBeLessThan(-10);
    expect(run(origin(0), { fwd: -1, turn: 1 }, 3, 0.3).theta).toBeGreaterThan(0);
    expect(run(origin(0), { fwd: -1, turn: -1 }, 3, 0.3).theta).toBeLessThan(0);
  });
});
