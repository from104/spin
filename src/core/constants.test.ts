import { describe, expect, it } from 'vitest';
import { DEG } from './angle.ts';
import { BALL, CHAIR, CONE, DEFAULT_LIMITS, DEFAULT_ZONES } from './constants.ts';
import { kmhToPxPerS } from './units.ts';

// §2.6 유도값 표 — 실제 상수·함수에서 그대로 나오는지 확인 (오케스트레이터 지시사항).
describe('§2.6 유도값', () => {
  const vLinPxPerS = kmhToPxPerS(DEFAULT_LIMITS.linearKmh);
  const omegaRadPerS = kmhToPxPerS(DEFAULT_LIMITS.bumperKmh) / 30;

  it('vLinPxPerS = kmhToPxPerS(10) ≈ 69.4444444', () => {
    expect(vLinPxPerS).toBeCloseTo(69.4444444, 6);
  });
  it('substep 선형 변위 = vLin/120 ≈ 0.5787037', () => {
    expect(vLinPxPerS / 120).toBeCloseTo(0.5787037, 6);
  });
  it('omegaRadPerS = kmhToPxPerS(30)/30 ≈ 6.9444444 rad/s = 397.887358 °/s', () => {
    expect(omegaRadPerS).toBeCloseTo(6.9444444, 6);
    expect(omegaRadPerS * DEG).toBeCloseTo(397.887358, 5);
  });
  it('substep 각변위 = ω/120 ≈ 0.05787037 rad = 3.31573 °', () => {
    expect(omegaRadPerS / 120).toBeCloseTo(0.05787037, 7);
    expect((omegaRadPerS / 120) * DEG).toBeCloseTo(3.31573, 4);
  });
  it('180° 선회 = π/ω ≈ 0.45239 s', () => {
    expect(Math.PI / omegaRadPerS).toBeCloseTo(0.45239, 4);
  });
  it('360° 선회 = 2π/ω ≈ 0.90478 s', () => {
    expect((2 * Math.PI) / omegaRadPerS).toBeCloseTo(0.90478, 4);
  });
  it('hull 정점 회전 변위/substep = ω/120 × 32.5 ≈ 1.880787 px', () => {
    expect((omegaRadPerS / 120) * CHAIR.hullRadiusPx).toBeCloseTo(1.880787, 5);
  });
  it('tow 최악 substep 변위 = hull회전변위 + vLin/120 ≈ 2.459491 px', () => {
    const worst = (omegaRadPerS / 120) * CHAIR.hullRadiusPx + vLinPxPerS / 120;
    expect(worst).toBeCloseTo(2.459491, 5);
  });
  it('ω 물리 천장 = (linearKmh/3.6)/(트랙/2) ≈ 8.547009 rad/s, 여유 81.2%', () => {
    const ceiling = DEFAULT_LIMITS.linearKmh / 3.6 / (CHAIR.trackM / 2);
    expect(ceiling).toBeCloseTo(8.547009, 5);
    expect(omegaRadPerS / ceiling).toBeCloseTo(0.812, 3);
  });
  it('bumperKmh 동적 상한 @linear=10 ≈ 36.0 km/h (천장 36.92 미만)', () => {
    const ceiling = DEFAULT_LIMITS.linearKmh / 3.6 / (CHAIR.trackM / 2);
    const dynCap = Math.min(36, ceiling * 1.2 * 3.6);
    expect(dynCap).toBeCloseTo(36.0, 5);
  });
  it('공 substep 최대 변위 = maxSpeedPxPerS/120 = 3.5 px', () => {
    expect(BALL.maxSpeedPxPerS / 120).toBeCloseTo(3.5, 6);
  });
  it('콘 substep 최대 변위 = maxSpeedPxPerS/120 = 2.0 px', () => {
    expect(CONE.maxSpeedPxPerS / 120).toBeCloseTo(2.0, 6);
  });
  it('tow 최소 레버 = (sTowRearMax − sPivot)·lengthPx ≈ −3.0 px', () => {
    const lever = (DEFAULT_ZONES.sTowRearMax - CHAIR.sPivot) * CHAIR.lengthPx;
    expect(lever).toBeCloseTo(-3.0, 6);
  });
  it('spin 레버 범위 ≈ 4.5 … 24.375 px', () => {
    const lo = (DEFAULT_ZONES.sSpinMin - CHAIR.sPivot) * CHAIR.lengthPx;
    const hi = (DEFAULT_ZONES.sTowFrontMin - CHAIR.sPivot) * CHAIR.lengthPx;
    expect(lo).toBeCloseTo(4.5, 6);
    expect(hi).toBeCloseTo(24.375, 6);
  });
  it('towFront 최소 레버 = (sTowFrontMin − sPivot)·lengthPx ≈ 24.375 px', () => {
    const lever = (DEFAULT_ZONES.sTowFrontMin - CHAIR.sPivot) * CHAIR.lengthPx;
    expect(lever).toBeCloseTo(24.375, 6);
  });
  it('존 폭(px) rear/trans/spin/front ≈ 4.5 / 7.5 / 19.875 / 5.625', () => {
    const rear = DEFAULT_ZONES.sTowRearMax * CHAIR.lengthPx;
    const trans = (DEFAULT_ZONES.sSpinMin - DEFAULT_ZONES.sTowRearMax) * CHAIR.lengthPx;
    const spin = (DEFAULT_ZONES.sTowFrontMin - DEFAULT_ZONES.sSpinMin) * CHAIR.lengthPx;
    const front = (1 - DEFAULT_ZONES.sTowFrontMin) * CHAIR.lengthPx;
    expect(rear).toBeCloseTo(4.5, 6);
    expect(trans).toBeCloseTo(7.5, 6);
    expect(spin).toBeCloseTo(19.875, 6);
    expect(front).toBeCloseTo(5.625, 6);
  });
});
