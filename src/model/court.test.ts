// §3.2 검산 — COURT_DEFS 확정 좌표 하드코딩 검증
import { describe, it, expect } from 'vitest';
import { COURT_DEFS, gridLabel, gridCellCenter, cellLabelAt, clampToViewBox, isOnSurface } from './court.ts';
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
    // 골대는 좌우에 있지만 처음 놓을 때는 세로로 세운다(기현 지시 2026-08-11).
    expect(d.homeHeadingDeg).toBe(90);
    expect(d.awayHeadingDeg).toBe(270);
    // 검증: 750/30 = 450/18 = 25 px/m, 골 폭 150 px = 6 m, 골 지역 125×200 px = 5×8 m
    expect(d.surface.w / 30).toBe(25);
    expect(d.surface.h / 18).toBe(25);
    expect(d.goalPosts[1].y - d.goalPosts[0].y).toBe(150);
    expect(d.ruleZones[0].w).toBe(125);
    expect(d.ruleZones[0].h).toBe(200);
  });

  it('세 코트 모두 처음에는 세로로 세운다 — 코트를 바꿔도 서 있는 모습이 같다', () => {
    // 풀 코트만 공격 축(좌우)을 따라 0°/180° 였는데, 판을 짤 때 필요한 것은 "지금 어디를
    // 보고 있는가" 가 아니라 "누가 어디에 있는가" 다(기현 지시 2026-08-11). 방향은 그
    // 다음에 돌려 잡는다. 하나만 다르면 코트를 바꿀 때마다 말이 통째로 눕는다.
    for (const d of Object.values(COURT_DEFS)) {
      expect(d.homeHeadingDeg, d.mode).toBe(90);
      expect(d.awayHeadingDeg, d.mode).toBe(270);
      // 두 팀은 여전히 마주 본다 — 같으면 어느 쪽이 우리 편인지 한눈에 안 보인다.
      expect(Math.abs(d.homeHeadingDeg - d.awayHeadingDeg), d.mode).toBe(180);
    }
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

// §4.4 P2-1 — 마진 띠가 곧 판의 프레임이다. `isOnSurface` 는 그 경계의 **유일한 출처**이고,
// 편집기의 "여기서 시작한 드래그는 판 이동인가 고무줄인가" 판정 전체가 이 한 줄에 걸려 있다.
describe('isOnSurface — 경기면 안인가 (판의 프레임 경계)', () => {
  it('한가운데는 경기면이다', () => {
    expect(isOnSurface('full', { x: 412.5, y: 262.5 })).toBe(true);
    expect(isOnSurface('half', { x: 262.5, y: 225 })).toBe(true);
  });

  it('마진 띠(사방 37.5px)는 경기면이 아니다 — 네 변을 모두 본다', () => {
    // 한 변만 재면 좌측만 고치고 넘어간 구현이 통과한다(심사관이 "좌측만의 문제가 아니다"
    // 라고 짚은 그 자리다).
    const d = COURT_DEFS.full;
    expect(isOnSurface('full', { x: d.surface.x - 1, y: 262.5 })).toBe(false); // 왼쪽
    expect(isOnSurface('full', { x: d.surface.x + d.surface.w + 1, y: 262.5 })).toBe(false); // 오른쪽
    expect(isOnSurface('full', { x: 412.5, y: d.surface.y - 1 })).toBe(false); // 위
    expect(isOnSurface('full', { x: 412.5, y: d.surface.y + d.surface.h + 1 })).toBe(false); // 아래
  });

  it('라인 위(경계선)는 경기면으로 친다 — 선 위에 세운 개체를 고무줄로 걸 수 있어야 한다', () => {
    const d = COURT_DEFS.full;
    expect(isOnSurface('full', { x: d.surface.x, y: d.surface.y })).toBe(true);
    expect(isOnSurface('full', { x: d.surface.x + d.surface.w, y: d.surface.y + d.surface.h })).toBe(true);
    // 대조군 — 경계에서 아주 조금만 나가면 곧바로 프레임이다(경계가 '포함'이지 '느슨함'이 아니다).
    expect(isOnSurface('full', { x: d.surface.x - 0.001, y: d.surface.y })).toBe(false);
  });

  it('네 모서리도 프레임이다 — 두 축이 각각 걸린다', () => {
    expect(isOnSurface('full', { x: 10, y: 10 })).toBe(false);
    expect(isOnSurface('full', { x: 815, y: 515 })).toBe(false);
  });

  it('flat 은 마진이 없다 — 라인이 없는 판에는 테두리도 없다', () => {
    // 여기가 true 로 남아야 flat 에서 고무줄 선택이 판 전체에서 살아 있다.
    const d = COURT_DEFS.flat;
    expect(isOnSurface('flat', { x: 1, y: 1 })).toBe(true);
    expect(isOnSurface('flat', { x: d.vbW - 1, y: d.vbH - 1 })).toBe(true);
    // 판 바깥(viewBox 밖)은 flat 에서도 프레임이다 — 확대해서 밀면 도달할 수 있는 자리다.
    expect(isOnSurface('flat', { x: -5, y: 100 })).toBe(false);
  });

  it('경계는 COURT_DEFS.surface 를 그대로 읽는다 — 마진이 또 바뀌면 규칙이 따라온다', () => {
    // 편집기에 37.5 를 다시 적어 두면 이 대조가 성립하지 않는다. 세 코트 전부에서
    // "surface 안 = true / 한 픽셀 밖 = false" 가 정의로부터 유도된다.
    for (const mode of ['full', 'half', 'flat'] as const) {
      const s = COURT_DEFS[mode].surface;
      expect(isOnSurface(mode, { x: s.x + s.w / 2, y: s.y + s.h / 2 })).toBe(true);
      expect(isOnSurface(mode, { x: s.x - 1, y: s.y + s.h / 2 })).toBe(false);
      expect(isOnSurface(mode, { x: s.x + s.w / 2, y: s.y + s.h + 1 })).toBe(false);
    }
  });
});
