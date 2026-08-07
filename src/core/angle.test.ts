import { describe, expect, it } from 'vitest';
import { arcTangentK, lerpAngle, radToStoredDeg, storedDegToRad, wrapPi } from './angle.ts';

describe('wrapPi', () => {
  it('치역은 [-π, π) — 상한 경계는 -π 로 접힌다', () => {
    expect(wrapPi(Math.PI)).toBe(-Math.PI);
    expect(wrapPi(-Math.PI)).toBe(-Math.PI);
  });
  it('범위 안 값은 그대로', () => {
    expect(wrapPi(3.0)).toBeCloseTo(3.0, 12);
  });
  it('음수 wrap', () => {
    expect(wrapPi(-3.5)).toBeCloseTo(2.783185307, 9);
  });
});

describe('lerpAngle', () => {
  const cases: Array<[number, number]> = [
    [0, Math.PI / 2],
    [3, -3],
    [-2.9, 2.9],
    [0.1, 6.1],
  ];
  it.each(cases)('t=0 이면 a, t=1 은 wrapPi(b) 와 일치', (a, b) => {
    expect(lerpAngle(a, b, 0)).toBe(a);
    expect(Math.abs(wrapPi(lerpAngle(a, b, 1)) - wrapPi(b))).toBeLessThan(1e-12);
  });
});

describe('arcTangentK', () => {
  const RAD = Math.PI / 180;
  it.each([
    [0, 1],
    [30, 1.017332],
    [60, 1.071797],
    [90, 1.171573],
    [120, 1.333333],
    [180, 2],
  ])('%s° → %s', (deg, expected) => {
    expect(arcTangentK(deg * RAD)).toBeCloseTo(expected, 6);
  });
});

describe('radToStoredDeg / storedDegToRad 왕복', () => {
  const angles = Array.from({ length: 20 }, (_, i) => (i / 19) * 4 * Math.PI - 2 * Math.PI);
  it.each(angles)('%f rad 왕복 오차 < 0.001 rad', (t) => {
    const roundTripped = storedDegToRad(radToStoredDeg(t));
    expect(Math.abs(wrapPi(roundTripped) - wrapPi(t))).toBeLessThan(0.001);
  });
});

describe('Hermite 원호 근사 (arcTangentK 회귀 가드)', () => {
  // §3.6 Hermite 공식을 그대로 재현해 R=100, 90° 전환의 최대 반경오차를 측정한다.
  // K(90°)=1.171573 이면 오차 < 0.05 px, K=0.55 였다면 15.54 px 였다(문서 §2.3 실측).
  const R = 100;
  const C = { x: 0, y: R };
  const theta0 = 0;
  const theta1 = Math.PI / 2;
  const u = (t: number) => ({ x: Math.cos(t), y: Math.sin(t) });
  const P0 = { x: C.x + R * Math.sin(theta0), y: C.y - R * Math.cos(theta0) };
  const P1 = { x: C.x + R * Math.sin(theta1), y: C.y - R * Math.cos(theta1) };

  function maxRadiusError(K: number): number {
    const d = Math.hypot(P1.x - P0.x, P1.y - P0.y);
    const u0 = u(theta0);
    const u1 = u(theta1);
    const dot = (P1.x - P0.x) * u0.x + (P1.y - P0.y) * u0.y;
    const sg = dot < 0 ? -1 : 1;
    const m0 = { x: sg * K * d * u0.x, y: sg * K * d * u0.y };
    const m1 = { x: sg * K * d * u1.x, y: sg * K * d * u1.y };
    let max = 0;
    for (let i = 0; i <= 200; i++) {
      const e = i / 200;
      const h00 = 2 * e ** 3 - 3 * e ** 2 + 1;
      const h10 = e ** 3 - 2 * e ** 2 + e;
      const h01 = -2 * e ** 3 + 3 * e ** 2;
      const h11 = e ** 3 - e ** 2;
      const px = h00 * P0.x + h10 * m0.x + h01 * P1.x + h11 * m1.x;
      const py = h00 * P0.y + h10 * m0.y + h01 * P1.y + h11 * m1.y;
      const r = Math.hypot(px - C.x, py - C.y);
      max = Math.max(max, Math.abs(r - R));
    }
    return max;
  }

  it('K=arcTangentK(90°) 이면 201점 샘플 최대 반경오차 < 0.05 px', () => {
    const K = arcTangentK(theta1 - theta0);
    expect(maxRadiusError(K)).toBeLessThan(0.05);
  });

  it('회귀 가드: K=0.55 로 잘못 고정하면 오차가 15 px 대로 커진다', () => {
    expect(maxRadiusError(0.55)).toBeGreaterThan(15);
  });
});
