// §3.3 검산 — gridGeom 좌표 하드코딩 검증. 표와 정확히 일치해야 한다.
import { describe, it, expect } from 'vitest';
import { gridGeom } from './grid.ts';

describe('gridGeom full — 6열×5행, 5 m × 3.6 m', () => {
  const g = gridGeom('full');

  it('vx / inner.vx', () => {
    expect(g.vx).toEqual([37.5, 162.5, 287.5, 412.5, 537.5, 662.5, 787.5]);
    expect(g.inner.vx).toEqual([162.5, 287.5, 412.5, 537.5, 662.5]);
  });

  it('hy / inner.hy', () => {
    expect(g.hy).toEqual([37.5, 127.5, 217.5, 307.5, 397.5, 487.5]);
    expect(g.inner.hy).toEqual([127.5, 217.5, 307.5, 397.5]);
  });

  it('셀 중심 · 라벨 a1…f5', () => {
    expect(g.cells).toHaveLength(30);
    const xs = [100, 225, 350, 475, 600, 725];
    const ys = [82.5, 172.5, 262.5, 352.5, 442.5];
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

  it('내부선이 코트 라인과 겹친다 (x=162.5·662.5 골 지역, x=412.5 하프라인)', () => {
    expect(g.inner.vx).toContain(162.5);
    expect(g.inner.vx).toContain(662.5);
    expect(g.inner.vx).toContain(412.5);
  });
});

describe('gridGeom half — 5열×3행, 3.6 m × 5 m', () => {
  const g = gridGeom('half');

  it('vx / inner.vx', () => {
    expect(g.vx).toEqual([37.5, 127.5, 217.5, 307.5, 397.5, 487.5]);
    expect(g.inner.vx).toEqual([127.5, 217.5, 307.5, 397.5]);
  });

  it('hy / inner.hy', () => {
    expect(g.hy).toEqual([37.5, 162.5, 287.5, 412.5]);
    expect(g.inner.hy).toEqual([162.5, 287.5]);
  });

  it('셀 중심 · 라벨 a1…e3', () => {
    expect(g.cells).toHaveLength(15);
    const xs = [82.5, 172.5, 262.5, 352.5, 442.5];
    const ys = [100, 225, 350];
    const first = g.cells.find((c) => c.col === 0 && c.row === 0)!;
    expect(first).toMatchObject({ text: 'a1', x: xs[0], y: ys[0] });
    const last = g.cells.find((c) => c.col === 4 && c.row === 2)!;
    expect(last).toMatchObject({ text: 'e3', x: xs[4], y: ys[2] });
    for (const cell of g.cells) {
      expect(cell.x).toBe(xs[cell.col]);
      expect(cell.y).toBe(ys[cell.row]);
    }
  });

  it('y=287.5 는 하프 코트 골 지역 상단 라인과 일치', () => {
    expect(g.inner.hy).toContain(287.5);
  });
});

describe('gridGeom flat — 1 m 격자, 21열×18행', () => {
  const g = gridGeom('flat');

  it('vx: 0,25,…,525 (22개) / inner: 양끝 제외', () => {
    expect(g.vx).toHaveLength(22);
    expect(g.vx[0]).toBe(0);
    expect(g.vx[21]).toBe(525);
    expect(g.vx).toEqual(Array.from({ length: 22 }, (_, i) => i * 25));
    expect(g.inner.vx).toEqual(g.vx.slice(1, -1));
    expect(g.inner.vx).toHaveLength(20);
  });

  it('hy: 0,25,…,450 (19개) / inner: 양끝 제외', () => {
    expect(g.hy).toHaveLength(19);
    expect(g.hy[0]).toBe(0);
    expect(g.hy[18]).toBe(450);
    expect(g.hy).toEqual(Array.from({ length: 19 }, (_, i) => i * 25));
    expect(g.inner.hy).toEqual(g.hy.slice(1, -1));
    expect(g.inner.hy).toHaveLength(17);
  });

  it('major.vx = 0,125,250,375,500 / major.hy = 0,125,250,375', () => {
    expect(g.major).toEqual({
      vx: [0, 125, 250, 375, 500],
      hy: [0, 125, 250, 375],
    });
  });

  it('셀 중심 x = 12.5+25i, y = 12.5+25j (a1…u18)', () => {
    expect(g.cells).toHaveLength(378);
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
    expect(axis).toHaveLength(21 + 18);
    const colA = axis.find((a) => a.text === 'a')!;
    expect(colA).toEqual({ text: 'a', x: 12.5, y: 9 });
    const colU = axis.find((a) => a.text === 'u')!;
    expect(colU).toEqual({ text: 'u', x: 12.5 + 25 * 20, y: 9 });
    const row1 = axis.find((a) => a.text === '1')!;
    expect(row1).toEqual({ text: '1', x: 8, y: 12.5 });
    const row18 = axis.find((a) => a.text === '18')!;
    expect(row18).toEqual({ text: '18', x: 8, y: 12.5 + 25 * 17 });
  });
});

describe('모듈 레벨 캐시', () => {
  it('같은 mode 로 두 번 호출하면 동일 참조를 반환한다', () => {
    expect(gridGeom('full')).toBe(gridGeom('full'));
    expect(gridGeom('half')).toBe(gridGeom('half'));
    expect(gridGeom('flat')).toBe(gridGeom('flat'));
  });
});
