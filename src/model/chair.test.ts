// §3.4 검증 — projectGrab 4존 경계값을 θ = 0·90·180·270° 에서 검증.
import { describe, expect, it } from 'vitest';
import { DEFAULT_ZONES } from '../core/constants.ts';
import { classifyZone, pointAtLever, projectGrab, type ChairPose, type DragZone } from './chair.ts';

// s = sPivot + ax/L 이므로 ax = (s - sPivot) * L. 각 경계 바로 안쪽/바깥쪽 값을 만든다.
const L = 37.5;
const S_PIVOT = 0.2;
const axFor = (s: number): number => (s - S_PIVOT) * L;

describe('classifyZone — §2.5 경계값 (리터럴, 부동소수 잡음 없이)', () => {
  // s 를 기하 왕복 없이 리터럴로 직접 넣어 정확한 <=/< 경계를 확인한다.
  it('towRear ↔ translate 경계는 0.12 (포함)', () => {
    expect(classifyZone(0.12, DEFAULT_ZONES)).toBe('towRear');
    expect(classifyZone(0.120001, DEFAULT_ZONES)).toBe('translate');
  });
  it('translate ↔ spin 경계는 0.32 (spin 쪽 포함)', () => {
    expect(classifyZone(0.319999, DEFAULT_ZONES)).toBe('translate');
    expect(classifyZone(0.32, DEFAULT_ZONES)).toBe('spin');
  });
  it('spin ↔ towFront 경계는 0.85 (towFront 쪽 포함)', () => {
    expect(classifyZone(0.849999, DEFAULT_ZONES)).toBe('spin');
    expect(classifyZone(0.85, DEFAULT_ZONES)).toBe('towFront');
  });
});

describe('projectGrab · classifyZone — 4존 내부값 기하 왕복 (θ 무관)', () => {
  // 경계에서 살짝 떨어진 값만 쓴다 — 기하 왕복(dot product)의 부동소수 오차가
  // 정확히 경계에 걸린 리터럴을 반대쪽으로 밀어낼 수 있기 때문(경계 자체는 위에서 리터럴로 검증).
  const cases: Array<[number, DragZone]> = [
    [0.1, 'towRear'],
    [0.15, 'translate'],
    [0.31, 'translate'],
    [0.5, 'spin'],
    [0.84, 'spin'],
    [0.9, 'towFront'],
    [0.95, 'towFront'],
  ];

  for (const theta of [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) {
    it(`θ=${theta.toFixed(4)} 에서 내부값이 §2.5 표대로 분류된다`, () => {
      const pose: ChairPose = { x: 100, y: 200, theta };
      for (const [s, zone] of cases) {
        const p = pointAtLever(pose, axFor(s));
        const { s: sOut } = projectGrab(pose, p);
        expect(sOut).toBeCloseTo(s, 9);
        expect(classifyZone(sOut, DEFAULT_ZONES)).toBe(zone);
      }
    });

    it(`θ=${theta.toFixed(4)} 에서 측방(lat) 오프셋은 s 를 바꾸지 않는다`, () => {
      const pose: ChairPose = { x: 0, y: 0, theta };
      const onAxis = pointAtLever(pose, axFor(0.5));
      // 축에 수직인 방향으로 5px 옮긴 점 — ax(=s)는 그대로, lat 만 달라져야 한다.
      const perp = { x: -Math.sin(theta), y: Math.cos(theta) };
      const off = { x: onAxis.x + perp.x * 5, y: onAxis.y + perp.y * 5 };
      const a = projectGrab(pose, onAxis);
      const b = projectGrab(pose, off);
      expect(b.s).toBeCloseTo(a.s, 9);
      expect(Math.abs(b.lat - a.lat)).toBeCloseTo(5, 6);
    });
  }
});

describe('poseFromStored/poseToStored 왕복', () => {
  it('각도가 [-180,180) 로 랩되고 0.1° 로 반올림된다', async () => {
    const { poseFromStored, poseToStored } = await import('./chair.ts');
    const stored = poseToStored({ x: 12.34, y: 56.78, theta: (200 * Math.PI) / 180 });
    expect(stored.angleDeg).toBeCloseTo(-160, 5); // 200° → -160°
    expect(stored.x).toBeCloseTo(12.3, 5);
    expect(stored.y).toBeCloseTo(56.8, 5);
    const back = poseFromStored(stored);
    expect(back.theta).toBeCloseTo((-160 * Math.PI) / 180, 9);
  });
});
