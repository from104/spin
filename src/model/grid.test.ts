// §3.3 검산 — gridGeom 좌표 하드코딩 검증. 표와 정확히 일치해야 한다.
import { describe, it, expect } from 'vitest';
import { gridGeom } from './grid.ts';

describe('gridGeom full — 6열×5행, 5 m × 3.6 m', () => {
  const g = gridGeom('full');

  it('vx / inner.vx', () => {
    expect(g.vx).toEqual([25, 150, 275, 400, 525, 650, 775]);
    expect(g.inner.vx).toEqual([150, 275, 400, 525, 650]);
  });

  it('hy / inner.hy', () => {
    expect(g.hy).toEqual([25, 115, 205, 295, 385, 475]);
    expect(g.inner.hy).toEqual([115, 205, 295, 385]);
  });

  it('셀 중심 · 라벨 a1…f5', () => {
    expect(g.cells).toHaveLength(30);
    const xs = [87.5, 212.5, 337.5, 462.5, 587.5, 712.5];
    const ys = [70, 160, 250, 340, 430];
    const first = g.cells.find((c) => c.col === 0 && c.row === 0)!;
    expect(first).toMatchObject({ text: 'a1', x: xs[0], y: ys[0] });
    const last = g.cells.find((c) => c.col === 5 && c.row === 4)!;
    expect(last).toMatchObject({ text: 'f5', x: xs[5], y: ys[4] });
    for (const cell of g.cells) {
      expect(cell.x).toBe(xs[cell.col]);
      expect(cell.y).toBe(ys[cell.row]);
    }
  });

  it('major/axis 없음', () => {
    expect(g.major).toBeUndefined();
    expect(g.axis).toBeUndefined();
  });

  it('내부선이 코트 라인과 겹친다 (x=150·650 골 지역, x=400 하프라인)', () => {
    expect(g.inner.vx).toContain(150);
    expect(g.inner.vx).toContain(650);
    expect(g.inner.vx).toContain(400);
  });
});

describe('gridGeom half — 5열×3행, 3.6 m × 5 m', () => {
  const g = gridGeom('half');

  it('vx / inner.vx', () => {
    expect(g.vx).toEqual([25, 115, 205, 295, 385, 475]);
    expect(g.inner.vx).toEqual([115, 205, 295, 385]);
  });

  it('hy / inner.hy', () => {
    expect(g.hy).toEqual([25, 150, 275, 400]);
    expect(g.inner.hy).toEqual([150, 275]);
  });

  it('셀 중심 · 라벨 a1…e3', () => {
    expect(g.cells).toHaveLength(15);
    const xs = [70, 160, 250, 340, 430];
    const ys = [87.5, 212.5, 337.5];
    const first = g.cells.find((c) => c.col === 0 && c.row === 0)!;
    expect(first).toMatchObject({ text: 'a1', x: xs[0], y: ys[0] });
    const last = g.cells.find((c) => c.col === 4 && c.row === 2)!;
    expect(last).toMatchObject({ text: 'e3', x: xs[4], y: ys[2] });
    for (const cell of g.cells) {
      expect(cell.x).toBe(xs[cell.col]);
      expect(cell.y).toBe(ys[cell.row]);
    }
  });

  it('y=275 는 하프 코트 골 지역 상단 라인과 일치', () => {
    expect(g.inner.hy).toContain(275);
  });
});

describe('gridGeom flat — 1 m 격자, 20열×17행', () => {
  const g = gridGeom('flat');

  it('vx: 0,25,…,500 (21개) / inner: 양끝 제외', () => {
    expect(g.vx).toHaveLength(21);
    expect(g.vx[0]).toBe(0);
    expect(g.vx[20]).toBe(500);
    expect(g.vx).toEqual(Array.from({ length: 21 }, (_, i) => i * 25));
    expect(g.inner.vx).toEqual(g.vx.slice(1, -1));
    expect(g.inner.vx).toHaveLength(19);
  });

  it('hy: 0,25,…,425 (18개) / inner: 양끝 제외', () => {
    expect(g.hy).toHaveLength(18);
    expect(g.hy[0]).toBe(0);
    expect(g.hy[17]).toBe(425);
    expect(g.hy).toEqual(Array.from({ length: 18 }, (_, i) => i * 25));
    expect(g.inner.hy).toEqual(g.hy.slice(1, -1));
    expect(g.inner.hy).toHaveLength(16);
  });

  it('major.vx = 0,125,250,375,500 / major.hy = 0,125,250,375', () => {
    expect(g.major).toEqual({
      vx: [0, 125, 250, 375, 500],
      hy: [0, 125, 250, 375],
    });
  });

  it('셀 중심 x = 12.5+25i, y = 12.5+25j (a1…t17)', () => {
    expect(g.cells).toHaveLength(340);
    const first = g.cells.find((c) => c.col === 0 && c.row === 0)!;
    expect(first).toMatchObject({ text: 'a1', x: 12.5, y: 12.5 });
    const last = g.cells.find((c) => c.col === 19 && c.row === 16)!;
    expect(last).toMatchObject({ text: 't17', x: 12.5 + 25 * 19, y: 12.5 + 25 * 16 });
    for (const cell of g.cells) {
      expect(cell.x).toBe(12.5 + 25 * cell.col);
      expect(cell.y).toBe(12.5 + 25 * cell.row);
    }
  });

  it('axis 헤더: 열 문자 x=12.5+25i,y=9 · 행 숫자 x=8,y=12.5+25j', () => {
    expect(g.axis).toBeDefined();
    const axis = g.axis!;
    expect(axis).toHaveLength(20 + 17);
    const colA = axis.find((a) => a.text === 'a')!;
    expect(colA).toEqual({ text: 'a', x: 12.5, y: 9 });
    const colT = axis.find((a) => a.text === 't')!;
    expect(colT).toEqual({ text: 't', x: 12.5 + 25 * 19, y: 9 });
    const row1 = axis.find((a) => a.text === '1')!;
    expect(row1).toEqual({ text: '1', x: 8, y: 12.5 });
    const row17 = axis.find((a) => a.text === '17')!;
    expect(row17).toEqual({ text: '17', x: 8, y: 12.5 + 25 * 16 });
  });
});

describe('모듈 레벨 캐시', () => {
  it('같은 mode 로 두 번 호출하면 동일 참조를 반환한다', () => {
    expect(gridGeom('full')).toBe(gridGeom('full'));
    expect(gridGeom('half')).toBe(gridGeom('half'));
    expect(gridGeom('flat')).toBe(gridGeom('flat'));
  });
});
