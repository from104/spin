// §3.2 검산 — COURT_DEFS 확정 좌표 하드코딩 검증
import { describe, it, expect } from 'vitest';
import { COURT_DEFS, gridLabel, gridCellCenter, cellLabelAt, clampToViewBox } from './court.ts';
import { PX_PER_M } from '../core/units.ts';

describe('COURT_DEFS', () => {
  it('full', () => {
    const d = COURT_DEFS.full;
    expect(d.label).toBe('풀 코트');
    expect(d.dims).toBe('30 × 18 m');
    expect(d.vbW).toBe(825);
    expect(d.vbH).toBe(525);
    expect(d.surface).toEqual({ x: 37.5, y: 37.5, w: 750, h: 450 });
    expect(d.ruleZones).toEqual([
      { x: 37.5, y: 162.5, w: 125, h: 200 },
      { x: 662.5, y: 162.5, w: 125, h: 200 },
    ]);
    expect(d.goalPosts).toEqual([
      { x: 37.5, y: 187.5 },
      { x: 37.5, y: 337.5 },
      { x: 787.5, y: 187.5 },
      { x: 787.5, y: 337.5 },
    ]);
    expect(d.cornerCuts).toEqual([
      'M37.5,62.5 L62.5,37.5',
      'M762.5,37.5 L787.5,62.5',
      'M787.5,462.5 L762.5,487.5',
      'M62.5,487.5 L37.5,462.5',
    ]);
    expect(d.spotMarks).toEqual([
      { x: 125, y: 262.5 },
      { x: 700, y: 262.5 },
    ]);
    expect(d.grid).toEqual({ cols: 6, rows: 5, cellW: 125, cellH: 90, origin: { x: 37.5, y: 37.5 } });
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
    expect(d.vbW).toBe(525);
    expect(d.vbH).toBe(450);
    expect(d.surface).toEqual({ x: 37.5, y: 37.5, w: 450, h: 375 });
    expect(d.ruleZones).toEqual([{ x: 162.5, y: 287.5, w: 200, h: 125 }]);
    expect(d.goalPosts).toEqual([
      { x: 187.5, y: 412.5 },
      { x: 337.5, y: 412.5 },
    ]);
    expect(d.cornerCuts).toEqual(['M37.5,387.5 L62.5,412.5', 'M462.5,412.5 L487.5,387.5']);
    expect(d.spotMarks).toEqual([{ x: 262.5, y: 325 }]);
    expect(d.grid).toEqual({ cols: 5, rows: 3, cellW: 90, cellH: 125, origin: { x: 37.5, y: 37.5 } });
    expect(d.homeHeadingDeg).toBe(90);
    expect(d.awayHeadingDeg).toBe(270);
  });

  it('flat', () => {
    const d = COURT_DEFS.flat;
    expect(d.label).toBe('플랫 코트');
    expect(d.dims).toBe('라인 없음');
    expect(d.vbW).toBe(525);
    expect(d.vbH).toBe(450);
    expect(d.surface).toEqual({ x: 0, y: 0, w: 525, h: 450 });
    expect(d.ruleZones).toEqual([]);
    expect(d.goalPosts).toEqual([]);
    expect(d.cornerCuts).toEqual([]);
    expect(d.spotMarks).toEqual([]);
    expect(d.grid).toEqual({ cols: 21, rows: 18, cellW: 25, cellH: 25, origin: { x: 0, y: 0 } });
    expect(d.homeHeadingDeg).toBe(90);
    expect(d.awayHeadingDeg).toBe(270);
    // flat 525/25 = 21, 450/25 = 18 (나머지 0) — 마진 1.5 m 로 넓힌 뒤의 값
    expect(d.vbW / 25).toBe(21);
    expect(d.vbH / 25).toBe(18);
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
  it('full 셀 중심 x=100..725, y=82.5..442.5', () => {
    const xs = [100, 225, 350, 475, 600, 725];
    const ys = [82.5, 172.5, 262.5, 352.5, 442.5];
    for (let c = 0; c < 6; c++) {
      for (let r = 0; r < 5; r++) {
        expect(gridCellCenter('full', c, r)).toEqual({ x: xs[c], y: ys[r] });
      }
    }
  });

  it('half 셀 중심 x=82.5..442.5, y=100..350', () => {
    const xs = [82.5, 172.5, 262.5, 352.5, 442.5];
    const ys = [100, 225, 350];
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
    expect(clampToViewBox('full', { x: 900, y: 600 })).toEqual({ x: 825, y: 525 });
    expect(clampToViewBox('full', { x: 5, y: 5 })).toEqual({ x: 5, y: 5 }); // surface 밖이지만 vb 안
    expect(clampToViewBox('flat', { x: 600, y: 500 })).toEqual({ x: 525, y: 450 });
  });
});

// ── 코트 외곽 마진 (2026-08-10 기현 지시) ─────────────────────────────────────────────────
// "코트 외곽의 마진이 1.5m가 되어야 배치를 자연스럽게 할 수 있다."
//
// 킥인·코너 세트피스는 라인 **밖** 배치가 필수이고(D26), 여분 공 10개도 놓을 곳이 필요하다.
// 1.0 m 로는 휠체어(길이 1.5 m)가 라인 밖에 온전히 서지 못한다.
describe('코트 외곽 마진은 사방 1.5 m 다', () => {
  const MARGIN_M = 1.5;
  const MARGIN_PX = MARGIN_M * PX_PER_M;

  for (const mode of ['full', 'half'] as const) {
    it(`${mode}: 네 변의 여백이 모두 ${MARGIN_M} m`, () => {
      const d = COURT_DEFS[mode];
      expect(d.surface.x).toBeCloseTo(MARGIN_PX, 6);
      expect(d.surface.y).toBeCloseTo(MARGIN_PX, 6);
      expect(d.vbW - (d.surface.x + d.surface.w)).toBeCloseTo(MARGIN_PX, 6);
      expect(d.vbH - (d.surface.y + d.surface.h)).toBeCloseTo(MARGIN_PX, 6);
    });

    it(`${mode}: 경기면 실치수는 그대로다 — 마진은 코트를 줄이는 것이 아니라 판을 넓히는 것`, () => {
      const d = COURT_DEFS[mode];
      const expectW = mode === 'full' ? 30 : 18;
      const expectH = mode === 'full' ? 18 : 15;
      expect(d.surface.w / PX_PER_M).toBeCloseTo(expectW, 6);
      expect(d.surface.h / PX_PER_M).toBeCloseTo(expectH, 6);
    });
  }

  it('격자는 경기면을 정확히 덮는다 — 마진에는 칸이 없다', () => {
    for (const mode of ['full', 'half'] as const) {
      const d = COURT_DEFS[mode];
      expect(d.grid.origin.x).toBeCloseTo(d.surface.x, 6);
      expect(d.grid.origin.y).toBeCloseTo(d.surface.y, 6);
      expect(d.grid.cols * d.grid.cellW).toBeCloseTo(d.surface.w, 6);
      expect(d.grid.rows * d.grid.cellH).toBeCloseTo(d.surface.h, 6);
    }
  });

  it('half 와 flat 의 viewBox 는 정확히 같다 (D12 — 무손실 전환의 전제)', () => {
    // 이게 깨지면 half↔flat 전환이 좌표를 보존하지 못하고, 표시 회전 판정도 갈라진다.
    expect(COURT_DEFS.flat.vbW).toBe(COURT_DEFS.half.vbW);
    expect(COURT_DEFS.flat.vbH).toBe(COURT_DEFS.half.vbH);
  });

  it('flat 은 라인이 없으므로 판 전체가 경기면이다', () => {
    const d = COURT_DEFS.flat;
    expect(d.surface).toEqual({ x: 0, y: 0, w: d.vbW, h: d.vbH });
    expect(d.grid.cols * d.grid.cellW).toBeCloseTo(d.vbW, 6);
    expect(d.grid.rows * d.grid.cellH).toBeCloseTo(d.vbH, 6);
  });
});
