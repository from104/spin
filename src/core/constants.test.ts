import { describe, expect, it } from 'vitest';
import { DEG } from './angle.ts';
import { BALL, CHAIR, CONE, DEFAULT_LIMITS, DEFAULT_ZONES, INTERACT, PHYS, WALL } from './constants.ts';
import { kmhToPxPerS } from './units.ts';

// §2.6 유도값 표 — 실제 상수·함수에서 그대로 나오는지 확인 (오케스트레이터 지시사항).
describe('§2.6 유도값', () => {
  const vLinPxPerS = kmhToPxPerS(DEFAULT_LIMITS.linearKmh);
  // 2026-08-29 실측(차체 1.3 m)으로 레버가 30 → 26 px 이 됐다. **하드코딩된 30 이 여기
  // 남아 있었다** — 그러면 이 표가 제품과 다른 ω 를 검산하게 되므로 상수를 그대로 읽는다
  // (제품 쪽은 physics/index.ts·EditorProvider 가 이미 CHAIR.pivotToFrontPx 를 쓴다).
  // 같은 범퍼 속도라도 레버가 짧으면 더 빨리 돈다 — 그것이 실측이 부른 거동 변화다.
  const omegaRadPerS = kmhToPxPerS(DEFAULT_LIMITS.bumperKmh) / CHAIR.pivotToFrontPx;

  it('vLinPxPerS = kmhToPxPerS(10) ≈ 69.4444444', () => {
    expect(vLinPxPerS).toBeCloseTo(69.4444444, 6);
  });
  it('substep 선형 변위 = vLin/120 ≈ 0.5787037', () => {
    expect(vLinPxPerS / 120).toBeCloseTo(0.5787037, 6);
  });
  it('omegaRadPerS = kmhToPxPerS(30)/26 ≈ 8.0128205 rad/s = 459.100797 °/s', () => {
    expect(omegaRadPerS).toBeCloseTo(8.0128205, 6);
    expect(omegaRadPerS * DEG).toBeCloseTo(459.100797, 5);
  });
  it('substep 각변위 = ω/120 ≈ 0.06677350 rad = 3.82584 °', () => {
    expect(omegaRadPerS / 120).toBeCloseTo(0.0667735, 7);
    expect((omegaRadPerS / 120) * DEG).toBeCloseTo(3.82584, 4);
  });
  it('180° 선회 = π/ω ≈ 0.39207 s', () => {
    expect(Math.PI / omegaRadPerS).toBeCloseTo(0.39207, 4);
  });
  it('360° 선회 = 2π/ω ≈ 0.78414 s', () => {
    expect((2 * Math.PI) / omegaRadPerS).toBeCloseTo(0.78414, 4);
  });
  it('hull 정점 회전 변위/substep = ω/120 × 27.8567766 ≈ 1.860095 px', () => {
    expect((omegaRadPerS / 120) * CHAIR.hullRadiusPx).toBeCloseTo(1.860095, 5);
  });
  it('tow 최악 substep 변위 = hull회전변위 + vLin/120 ≈ 2.438798 px', () => {
    const worst = (omegaRadPerS / 120) * CHAIR.hullRadiusPx + vLinPxPerS / 120;
    expect(worst).toBeCloseTo(2.438798, 5);
  });
  // 2026-08-29 — 트랙이 0.65 → 0.45 로 좁아져 천장이 8.55 → 12.35 rad/s 로 **올라갔고**,
  // ω 는 6.94 → 8.01 로 올랐다. 둘이 같은 방향이 아니라 여유가 81.2% → 64.9% 로 늘었다
  // (좁은 트랙은 같은 바퀴 속도로 더 빨리 돌 수 있다는 뜻이다).
  it('ω 물리 천장 = (linearKmh/3.6)/(트랙/2) ≈ 12.345679 rad/s, 여유 64.9%', () => {
    const ceiling = DEFAULT_LIMITS.linearKmh / 3.6 / (CHAIR.trackM / 2);
    expect(ceiling).toBeCloseTo(12.345679, 5);
    expect(omegaRadPerS / ceiling).toBeCloseTo(0.649, 3);
  });
  it('bumperKmh 동적 상한 @linear=10 ≈ 36.0 km/h (천장 53.33 미만)', () => {
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
  it('터치 직접 잡기 문턱이 가장 좁은 밴드에서 유도된다 (WCAG 2.5.8 · 24 CSS px)', () => {
    // 주석이 유도식을 적어 놓았는데 값만 낡는 일을 막는다(2026-08-10 코트 외곽선 사고와 같은 부류).
    const narrowestBandPx = (DEFAULT_ZONES.sSpinMin - DEFAULT_ZONES.sTowRearMax) * CHAIR.lengthPx;
    expect(INTERACT.zoneDirectMinPxPerUnit).toBeCloseTo(24 / narrowestBandPx, 2);
  });
  // 2026-08-11 재편: 차체는 뒤 1/2(그대로 이동) + 앞 1/2(제자리 회전) 둘뿐이고, 견인은
  // 차체 밖 가이드 전용이다. 그래서 견인 경계 레버가 차체 양끝과 **정확히** 일치해야 한다.
  it('견인 경계가 차체 양끝에 딱 붙는다 — 차체 안에 견인 띠가 없다', () => {
    const rearLever = (DEFAULT_ZONES.sTowRearMax - CHAIR.sPivot) * CHAIR.lengthPx;
    const frontLever = (DEFAULT_ZONES.sTowFrontMin - CHAIR.sPivot) * CHAIR.lengthPx;
    expect(rearLever).toBeCloseTo(-CHAIR.pivotToRearPx, 6); // −6.5 px
    expect(frontLever).toBeCloseTo(CHAIR.pivotToFrontPx, 6); // +26 px
  });
  it('그대로 이동 ↔ 제자리 회전 경계 레버 = 9.75 px (차체 한가운데)', () => {
    const lever = (DEFAULT_ZONES.sSpinMin - CHAIR.sPivot) * CHAIR.lengthPx;
    expect(lever).toBeCloseTo(9.75, 6);
    // 뒤끝(−6.5)에서 9.75 까지가 16.25 px = 차체 길이의 정확히 1/2
    expect(lever + CHAIR.pivotToRearPx).toBeCloseTo(CHAIR.lengthPx / 2, 6);
  });
  it('존 폭(px) rear/trans/spin/front = 0 / 16.25 / 16.25 / 0', () => {
    const rear = DEFAULT_ZONES.sTowRearMax * CHAIR.lengthPx;
    const trans = (DEFAULT_ZONES.sSpinMin - DEFAULT_ZONES.sTowRearMax) * CHAIR.lengthPx;
    const spin = (DEFAULT_ZONES.sTowFrontMin - DEFAULT_ZONES.sSpinMin) * CHAIR.lengthPx;
    const front = (1 - DEFAULT_ZONES.sTowFrontMin) * CHAIR.lengthPx;
    expect(rear).toBeCloseTo(0, 6);
    expect(trans).toBeCloseTo(16.25, 6);
    expect(spin).toBeCloseTo(16.25, 6);
    expect(front).toBeCloseTo(0, 6);
    // 뒤 1/2 : 앞 1/2 — 반반
    expect(spin / trans).toBeCloseTo(1, 6);
    expect(trans + spin).toBeCloseTo(CHAIR.lengthPx, 6);
  });
});

describe('공·콘 드래그 상한은 터널링 방지선이다', () => {
  it('벽 두께보다 작다 — 한 substep 에 벽을 뛰어넘지 않는다', () => {
    // 값 자체가 아니라 "왜 상한이 있는가" 를 못박는다. 이 관계가 깨지면 빠르게 끌 때
    // 공이 벽을 통과한다.
    expect(INTERACT.pointDragMaxPxPerSubstep).toBeLessThan(WALL.thicknessPx);
  });

  it('손으로 끄는 속도에서 뒤처지지 않을 만큼은 크다', () => {
    // 기현 지시: 공·콘은 이동 배치 시 속도 제한 없음. 상한이 낮으면 "제한 없음" 이 아니라
    // 그냥 느린 것이 된다 — 풀 코트(800px)를 0.5초 안에 가로지를 수 있어야 한다.
    const pxPerSecond = INTERACT.pointDragMaxPxPerSubstep / PHYS.dtS;
    expect(800 / pxPerSecond).toBeLessThan(0.5);
  });
});
