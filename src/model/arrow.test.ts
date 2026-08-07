// §3.5 화살표 — defaultCtrl 편차, arrowPath 형식·반올림.
import { describe, expect, it } from 'vitest';
import { newId } from '../core/ids.ts';
import { arrowPath, defaultCtrl, moveEndpoint, type Arrow } from './arrow.ts';

describe('defaultCtrl', () => {
  it('bow=30 일 때 t=0.5 편차가 30 ± 0.01 이다', () => {
    const from = { x: 0, y: 0 };
    const to = { x: 100, y: 0 };
    const ctrl = defaultCtrl(from, to, 30);
    // 2차 베지에 B(0.5) = 0.25·P0 + 0.5·C + 0.25·P1
    const bx = 0.25 * from.x + 0.5 * ctrl.x + 0.25 * to.x;
    const by = 0.25 * from.y + 0.5 * ctrl.y + 0.25 * to.y;
    const midX = (from.x + to.x) / 2;
    const midY = (from.y + to.y) / 2;
    const dev = Math.hypot(bx - midX, by - midY);
    expect(dev).toBeGreaterThanOrEqual(30 - 0.01);
    expect(dev).toBeLessThanOrEqual(30 + 0.01);
  });

  it('bow=0 또는 생략 시 직선 중점을 반환한다', () => {
    const from = { x: 10, y: 10 };
    const to = { x: 50, y: 90 };
    expect(defaultCtrl(from, to)).toEqual({ x: 30, y: 50 });
    expect(defaultCtrl(from, to, 0)).toEqual({ x: 30, y: 50 });
  });

  it('길이 0 구간에서도 안전하게 중점을 반환한다', () => {
    expect(defaultCtrl({ x: 5, y: 5 }, { x: 5, y: 5 }, 20)).toEqual({ x: 5, y: 5 });
  });
});

describe('arrowPath', () => {
  it('M… Q… 형식이고 좌표가 0.01 로 반올림된다', () => {
    const a: Arrow = {
      id: newId('ar'),
      kind: 'move',
      from: { x: 1.23456, y: 2.34567 },
      ctrl: { x: 3.456789, y: 4.567891 },
      to: { x: 5.678912, y: 6.789123 },
    };
    const d = arrowPath(a);
    expect(d).toMatch(/^M-?\d+(\.\d+)?,-?\d+(\.\d+)? Q-?\d+(\.\d+)?,-?\d+(\.\d+)? -?\d+(\.\d+)?,-?\d+(\.\d+)?$/);
    expect(d).toBe('M1.23,2.35 Q3.46,4.57 5.68,6.79');
  });
});

describe('moveEndpoint', () => {
  it('from/to 만 바꾸고 나머지는 유지한다', () => {
    const a: Arrow = { id: newId('ar'), kind: 'pass', from: { x: 0, y: 0 }, ctrl: { x: 1, y: 1 }, to: { x: 2, y: 2 } };
    const moved = moveEndpoint(a, 'to', { x: 9, y: 9 });
    expect(moved.to).toEqual({ x: 9, y: 9 });
    expect(moved.from).toEqual(a.from);
    expect(moved.id).toBe(a.id);
  });
});
