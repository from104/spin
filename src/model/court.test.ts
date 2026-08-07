// §3.2 검산 — COURT_DEFS 확정 좌표 하드코딩 검증
import { describe, it, expect } from 'vitest';
import { COURT_DEFS, gridLabel, gridCellCenter, cellLabelAt, clampToViewBox } from './court.ts';

describe('COURT_DEFS', () => {
  it('full', () => {
    const d = COURT_DEFS.full;
    expect(d.label).toBe('풀 코트');
    expect(d.dims).toBe('30 × 18 m');
    expect(d.vbW).toBe(800);
    expect(d.vbH).toBe(500);
    expect(d.surface).toEqual({ x: 25, y: 25, w: 750, h: 450 });
    expect(d.ruleZones).toEqual([
      { x: 25, y: 150, w: 125, h: 200 },
      { x: 650, y: 150, w: 125, h: 200 },
    ]);
    expect(d.goalPosts).toEqual([
      { x: 25, y: 175 },
      { x: 25, y: 325 },
      { x: 775, y: 175 },
      { x: 775, y: 325 },
    ]);
    expect(d.cornerCuts).toEqual([
      'M25,50 L50,25',
      'M750,25 L775,50',
      'M775,450 L750,475',
      'M50,475 L25,450',
    ]);
    expect(d.spotMarks).toEqual([
      { x: 112.5, y: 250 },
      { x: 687.5, y: 250 },
    ]);
    expect(d.grid).toEqual({ cols: 6, rows: 5, cellW: 125, cellH: 90, origin: { x: 25, y: 25 } });
    expect(d.homeHeadingDeg).toBe(0);
    expect(d.awayHeadingDeg).toBe(180);
    // 검증: 750/30 = 450/18 = 25 px/m, 골 폭 150 px = 6 m, 골 지역 125×200 px = 5×8 m
    expect(d.surface.w / 30).toBe(25);
    expect(d.surface.h / 18).toBe(25);
    expect(d.goalPosts[1].y - d.goalPosts[0].y).toBe(150);
    expect(d.ruleZones[0].w).toBe(125);
    expect(d.ruleZones[0].h).toBe(200);
  });

  it('half', () => {
    const d = COURT_DEFS.half;
    expect(d.label).toBe('하프 코트');
    expect(d.dims).toBe('18 × 15 m · 90° 회전');
    expect(d.vbW).toBe(500);
    expect(d.vbH).toBe(425);
    expect(d.surface).toEqual({ x: 25, y: 25, w: 450, h: 375 });
    expect(d.ruleZones).toEqual([{ x: 150, y: 275, w: 200, h: 125 }]);
    expect(d.goalPosts).toEqual([
      { x: 175, y: 400 },
      { x: 325, y: 400 },
    ]);
    expect(d.cornerCuts).toEqual(['M25,375 L50,400', 'M450,400 L475,375']);
    expect(d.spotMarks).toEqual([{ x: 250, y: 312.5 }]);
    expect(d.grid).toEqual({ cols: 5, rows: 3, cellW: 90, cellH: 125, origin: { x: 25, y: 25 } });
    expect(d.homeHeadingDeg).toBe(90);
    expect(d.awayHeadingDeg).toBe(270);
  });

  it('flat', () => {
    const d = COURT_DEFS.flat;
    expect(d.label).toBe('플랫 코트');
    expect(d.dims).toBe('라인 없음');
    expect(d.vbW).toBe(500);
    expect(d.vbH).toBe(425);
    expect(d.surface).toEqual({ x: 0, y: 0, w: 500, h: 425 });
    expect(d.ruleZones).toEqual([]);
    expect(d.goalPosts).toEqual([]);
    expect(d.cornerCuts).toEqual([]);
    expect(d.spotMarks).toEqual([]);
    expect(d.grid).toEqual({ cols: 20, rows: 17, cellW: 25, cellH: 25, origin: { x: 0, y: 0 } });
    expect(d.homeHeadingDeg).toBe(90);
    expect(d.awayHeadingDeg).toBe(270);
    // flat 500/25 = 20, 425/25 = 17 (나머지 0)
    expect(d.vbW / 25).toBe(20);
    expect(d.vbH / 25).toBe(17);
  });
});

describe('gridLabel', () => {
  it('열=알파벳 소문자, 행=숫자', () => {
    expect(gridLabel(0, 0)).toBe('a1');
    expect(gridLabel(1, 3)).toBe('b4');
    expect(gridLabel(5, 4)).toBe('f5');
    expect(gridLabel(19, 16)).toBe('t17');
  });
});

describe('gridCellCenter', () => {
  it('full 셀 중심 x=87.5..712.5, y=70..430', () => {
    const xs = [87.5, 212.5, 337.5, 462.5, 587.5, 712.5];
    const ys = [70, 160, 250, 340, 430];
    for (let c = 0; c < 6; c++) {
      for (let r = 0; r < 5; r++) {
        expect(gridCellCenter('full', c, r)).toEqual({ x: xs[c], y: ys[r] });
      }
    }
  });

  it('half 셀 중심 x=70..430, y=87.5..337.5', () => {
    const xs = [70, 160, 250, 340, 430];
    const ys = [87.5, 212.5, 337.5];
    for (let c = 0; c < 5; c++) {
      for (let r = 0; r < 3; r++) {
        expect(gridCellCenter('half', c, r)).toEqual({ x: xs[c], y: ys[r] });
      }
    }
  });

  it('flat 셀 중심 x=12.5+25i, y=12.5+25j', () => {
    for (let i = 0; i < 20; i++) {
      for (let j = 0; j < 17; j++) {
        expect(gridCellCenter('flat', i, j)).toEqual({ x: 12.5 + 25 * i, y: 12.5 + 25 * j });
      }
    }
  });
});

describe('cellLabelAt 왕복', () => {
  it('full/half/flat 전 셀에서 gridCellCenter -> cellLabelAt = gridLabel', () => {
    const cases: [import('./court.ts').CourtMode, number, number][] = [
      ['full', 6, 5],
      ['half', 5, 3],
      ['flat', 20, 17],
    ];
    for (const [mode, cols, rows] of cases) {
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          const center = gridCellCenter(mode, c, r);
          expect(cellLabelAt(mode, center)).toBe(gridLabel(c, r));
        }
      }
    }
  });

  it('경기면 밖은 null', () => {
    expect(cellLabelAt('full', { x: -10, y: -10 })).toBeNull();
    expect(cellLabelAt('full', { x: 10, y: 10 })).toBeNull(); // 라인 밖 (grid origin 25,25)
    expect(cellLabelAt('half', { x: 900, y: 900 })).toBeNull();
  });
});

describe('clampToViewBox', () => {
  it('viewBox 안으로만 클램프 (경기면 밖 대기 배치 허용)', () => {
    expect(clampToViewBox('full', { x: -50, y: -50 })).toEqual({ x: 0, y: 0 });
    expect(clampToViewBox('full', { x: 900, y: 600 })).toEqual({ x: 800, y: 500 });
    expect(clampToViewBox('full', { x: 5, y: 5 })).toEqual({ x: 5, y: 5 }); // surface 밖이지만 vb 안
    expect(clampToViewBox('flat', { x: 600, y: 500 })).toEqual({ x: 500, y: 425 });
  });
});
