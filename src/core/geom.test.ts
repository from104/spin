import { describe, expect, it } from 'vitest';
import { clamp, clampMag, dist2, easeStandard } from './geom.ts';

describe('clamp', () => {
  it('범위 안이면 그대로, 벗어나면 경계로', () => {
    expect(clamp(0.5, 0, 1)).toBe(0.5);
    expect(clamp(-1, 0, 1)).toBe(0);
    expect(clamp(2, 0, 1)).toBe(1);
  });
});

describe('clampMag', () => {
  it('크기가 상한 이하면 그대로 반환', () => {
    expect(clampMag({ x: 3, y: 4 }, 10)).toEqual({ x: 3, y: 4 });
  });
  it('크기가 상한을 넘으면 방향 유지한 채 잘린다', () => {
    const v = clampMag({ x: 3, y: 4 }, 2.5); // |v|=5
    expect(v.x).toBeCloseTo(1.5, 9);
    expect(v.y).toBeCloseTo(2.0, 9);
    expect(Math.hypot(v.x, v.y)).toBeCloseTo(2.5, 9);
  });
});

describe('dist2', () => {
  it('거리 제곱을 돌려준다', () => {
    expect(dist2({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(25);
  });
});

describe('easeStandard', () => {
  it('경계값 (0)===0, (1)===1', () => {
    expect(easeStandard(0)).toBe(0);
    expect(easeStandard(1)).toBe(1);
  });

  it('단조증가', () => {
    let prev = -Infinity;
    for (let i = 0; i <= 200; i++) {
      const v = easeStandard(i / 200);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });

  // NOTE(계약서와 다른 점): §10.1 체크리스트는 "(0.5) ≈ 0.5 ±0.02" 를 요구하지만, 곡선이
  // cubic-bezier(.4,0,.2,1) 라면 이는 성립하지 않는다 — 이 곡선은 P1+P2=(0.6,1) 로
  // (0.5,0.5) 점대칭 조건(P1+P2=(1,1))을 만족하지 않는다. 실제 y(0.5) ≈ 0.7756
  // (WebKit UnitBezier 알고리즘으로 독립 재계산해 확인, 오차 <1e-6). 곡선 자체(§3.6 "cubic-bezier(.4,0,.2,1)")를
  // 문서 표기대로 구현하고, 이 대비 수치는 실측값으로 교체했다. 다른 모듈에 보고 필요.
  it('(0.5) ≈ 0.7756 (cubic-bezier(.4,0,.2,1) 의 실제 값)', () => {
    expect(easeStandard(0.5)).toBeCloseTo(0.7756, 3);
  });

  it('1000회 샘플 비트 동일 (결정성)', () => {
    const a = Array.from({ length: 1000 }, (_, i) => easeStandard(i / 999));
    const b = Array.from({ length: 1000 }, (_, i) => easeStandard(i / 999));
    expect(a).toEqual(b);
  });
});
