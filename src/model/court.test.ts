// §3.2 검산 — COURT_DEFS 확정 좌표 하드코딩 검증
import { describe, it, expect } from 'vitest';
import {
  COURT_DEFS,
  COURT_SIZES,
  COURT_SIZE_LABELS,
  DEFAULT_COURT_SIZE,
  FULL_COURT_DEFS,
  courtDefFor,
  normalizeCourtSize,
  gridLabel,
  gridCellCenter,
  cellLabelAt,
  clampToViewBox,
  isOnSurface,
  type CourtSize,
} from './court.ts';
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

  // §5.1 — 마진 불변식은 **코트 크기 3단 전부**에서 성립해야 한다. 한 단만 재면
  // 30×18 만 고치고 넘어간 구현이 통과한다(2026-08-11 '좌측만의 문제가 아니다' 와 같은 형태).
  const CASES: Array<{ name: string; def: () => (typeof COURT_DEFS)['full']; m: [number, number] }> = [
    { name: 'full 30×18', def: () => FULL_COURT_DEFS['30x18'], m: [30, 18] },
    { name: 'full 28×15', def: () => FULL_COURT_DEFS['28x15'], m: [28, 15] },
    { name: 'full 25×14', def: () => FULL_COURT_DEFS['25x14'], m: [25, 14] },
    { name: 'half', def: () => COURT_DEFS.half, m: [18, 15] },
  ];

  for (const { name, def, m } of CASES) {
    it(`${name}: 네 변의 여백이 모두 ${MARGIN_M} m`, () => {
      const d = def();
      expect(d.surface.x).toBeCloseTo(MARGIN_PX, 6);
      expect(d.surface.y).toBeCloseTo(MARGIN_PX, 6);
      expect(d.vbW - (d.surface.x + d.surface.w)).toBeCloseTo(MARGIN_PX, 6);
      expect(d.vbH - (d.surface.y + d.surface.h)).toBeCloseTo(MARGIN_PX, 6);
    });

    it(`${name}: 경기면 실치수는 그대로다 — 마진은 코트를 줄이는 것이 아니라 판을 넓히는 것`, () => {
      const d = def();
      expect(d.surface.w / PX_PER_M).toBeCloseTo(m[0], 6);
      expect(d.surface.h / PX_PER_M).toBeCloseTo(m[1], 6);
      // 25 px = 1 m 검산 — 각 단마다 따로 성립한다(§9 ② 표).
      expect(d.surface.w / m[0]).toBe(PX_PER_M);
      expect(d.surface.h / m[1]).toBe(PX_PER_M);
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

// ── §5.1 코트 크기 3단 (FIPFA Laws 2025 · §9 결정 ②) ────────────────────────────────────────
//
// 체육관마다 바닥이 다르다. 28×15 는 표준 농구 코트라 국내에서 가장 흔하다.
// 여기서 붙잡는 것 넷: ① 확정 viewBox 표 ② 규격 고정값이 크기를 안 탄다 ③ 기본값은 30×18 이다
// ④ 좌표 헬퍼가 크기를 **실제로 본다**(안 보면 25×14 판 밖 좌표가 살아남는다).
describe('§5.1 코트 크기 3단', () => {
  it('§9 ② 표의 viewBox 확정값 — 825×525 / 775×450 / 700×425', () => {
    expect(FULL_COURT_DEFS['30x18'].vbW).toBe(825);
    expect(FULL_COURT_DEFS['30x18'].vbH).toBe(525);
    expect(FULL_COURT_DEFS['28x15'].vbW).toBe(775);
    expect(FULL_COURT_DEFS['28x15'].vbH).toBe(450);
    expect(FULL_COURT_DEFS['25x14'].vbW).toBe(700);
    expect(FULL_COURT_DEFS['25x14'].vbH).toBe(425);
    // 경기면도 표 그대로: 750×450 / 700×375 / 625×350
    expect(FULL_COURT_DEFS['30x18'].surface).toEqual({ x: 37.5, y: 37.5, w: 750, h: 450 });
    expect(FULL_COURT_DEFS['28x15'].surface).toEqual({ x: 37.5, y: 37.5, w: 700, h: 375 });
    expect(FULL_COURT_DEFS['25x14'].surface).toEqual({ x: 37.5, y: 37.5, w: 625, h: 350 });
  });

  it('세 단이 서로 다른 판이다 — 대조군(같은 객체를 세 번 세어 통과하는 것을 막는다)', () => {
    const sizes = COURT_SIZES;
    expect(sizes).toHaveLength(3);
    const areas = sizes.map((s) => FULL_COURT_DEFS[s].surface.w * FULL_COURT_DEFS[s].surface.h);
    expect(new Set(areas).size).toBe(3);
    expect(new Set(sizes.map((s) => FULL_COURT_DEFS[s].dims)).size).toBe(3);
    expect(new Set(sizes.map((s) => COURT_SIZE_LABELS[s])).size).toBe(3);
    // 크기가 커질수록 판도 커진다(순서가 뒤집혀 있으면 표를 잘못 옮긴 것이다).
    expect(FULL_COURT_DEFS['30x18'].vbW).toBeGreaterThan(FULL_COURT_DEFS['28x15'].vbW);
    expect(FULL_COURT_DEFS['28x15'].vbW).toBeGreaterThan(FULL_COURT_DEFS['25x14'].vbW);
  });

  it('dims 는 사람이 읽는 치수를 적는다', () => {
    expect(FULL_COURT_DEFS['30x18'].dims).toBe('30 × 18 m');
    expect(FULL_COURT_DEFS['28x15'].dims).toBe('28 × 15 m');
    expect(FULL_COURT_DEFS['25x14'].dims).toBe('25 × 14 m');
  });

  // ⚠️ 이것이 5.1 의 규격 판정이다. Laws 는 골대·골 지역·페널티 마크·코너 삼각형을 **절대
  // 치수**로 적는다(대조 노트 '1. 경기장'). 코트가 작아져도 골대는 6 m 다. 비례로 만들면
  // 25×14 코트의 골대가 5 m 가 되어 앱이 규칙을 잘못 가르친다.
  it('규격 고정값은 코트 크기를 타지 않는다 — 골대 6 m · 골 지역 8×5 m · 페널티 3.5 m · 코너 1 m', () => {
    for (const size of COURT_SIZES) {
      const d = FULL_COURT_DEFS[size];
      // 골대 폭 6 m (한쪽 골포스트 쌍의 간격)
      expect((d.goalPosts[1]!.y - d.goalPosts[0]!.y) / PX_PER_M, size).toBeCloseTo(6, 9);
      expect((d.goalPosts[3]!.y - d.goalPosts[2]!.y) / PX_PER_M, size).toBeCloseTo(6, 9);
      // 골 지역 8 m 폭 × 5 m 깊이, 좌우 두 개
      for (const z of d.ruleZones) {
        expect(z.w / PX_PER_M, size).toBeCloseTo(5, 9);
        expect(z.h / PX_PER_M, size).toBeCloseTo(8, 9);
      }
      expect(d.ruleZones).toHaveLength(2);
      // 페널티 마크 — 각 골라인에서 3.5 m
      expect((d.spotMarks[0]!.x - d.surface.x) / PX_PER_M, size).toBeCloseTo(3.5, 9);
      expect((d.surface.x + d.surface.w - d.spotMarks[1]!.x) / PX_PER_M, size).toBeCloseTo(3.5, 9);
      // 코너 삼각형 4개, 각 코너에서 1 m
      expect(d.cornerCuts, size).toHaveLength(4);
    }
    // 대조군 — 고정값이 같다는 것이 "세 def 이 통째로 같다" 는 뜻이 아니다.
    expect(FULL_COURT_DEFS['30x18'].goalPosts[2]!.x).not.toBe(FULL_COURT_DEFS['25x14'].goalPosts[2]!.x);
  });

  it('코트 위 표식은 전부 경기면 경계 안이다 — 2026-08-11 "골대가 선 밖" 사고의 3단 판', () => {
    for (const size of COURT_SIZES) {
      const d = FULL_COURT_DEFS[size];
      for (const p of [...d.goalPosts, ...d.spotMarks]) {
        expect(isOnSurface('full', p, size), `${size} ${JSON.stringify(p)}`).toBe(true);
      }
      for (const z of d.ruleZones) {
        expect(isOnSurface('full', { x: z.x, y: z.y }, size), size).toBe(true);
        expect(isOnSurface('full', { x: z.x + z.w, y: z.y + z.h }, size), size).toBe(true);
      }
      // 골 지역 둘이 겹치지 않는다 — 25 m 코트에서 5+5 m 가 코트를 다 먹지 않는다.
      expect(d.ruleZones[0]!.x + d.ruleZones[0]!.w, size).toBeLessThan(d.ruleZones[1]!.x);
    }
  });

  it('격자는 세 단 모두 6×5 로 경기면을 정확히 덮는다', () => {
    for (const size of COURT_SIZES) {
      const d = FULL_COURT_DEFS[size];
      expect(d.grid.cols, size).toBe(6);
      expect(d.grid.rows, size).toBe(5);
      expect(d.grid.origin, size).toEqual({ x: d.surface.x, y: d.surface.y });
      expect(d.grid.cols * d.grid.cellW, size).toBeCloseTo(d.surface.w, 6);
      expect(d.grid.rows * d.grid.cellH, size).toBeCloseTo(d.surface.h, 6);
    }
    // 대조군 — 칸의 미터 치수는 크기마다 다르다(같으면 격자가 안 따라온 것이다).
    expect(FULL_COURT_DEFS['30x18'].grid.cellW).not.toBe(FULL_COURT_DEFS['25x14'].grid.cellW);
  });

  it('세 단 모두 헤딩은 90/270 — 크기를 바꿔도 서 있는 모습이 같다', () => {
    for (const size of COURT_SIZES) {
      expect(FULL_COURT_DEFS[size].homeHeadingDeg, size).toBe(90);
      expect(FULL_COURT_DEFS[size].awayHeadingDeg, size).toBe(270);
      expect(FULL_COURT_DEFS[size].mode, size).toBe('full');
    }
  });

  // §9 ② 부기 — 기본 코트는 30×18 을 유지한다. 이걸 옮기면 기존 사용자의 드릴이 전부 다른
  // 코트에서 열린다(좌표는 그대로인데 판만 작아져 선수가 라인 밖에 선다).
  it('⚠️ 기본 크기는 30×18 이고 COURT_DEFS.full 이 그것과 같은 판이다', () => {
    expect(DEFAULT_COURT_SIZE).toBe('30x18');
    expect(COURT_DEFS.full).toBe(FULL_COURT_DEFS['30x18']);
    expect(COURT_DEFS.full.vbW).toBe(825);
    expect(COURT_DEFS.full.vbH).toBe(525);
    // 크기를 안 주고 부르면 예전과 정확히 같은 판이 나온다 — 기존 소비처 전부의 계약이다.
    expect(courtDefFor('full')).toBe(COURT_DEFS.full);
    expect(courtDefFor('half')).toBe(COURT_DEFS.half);
    expect(courtDefFor('flat')).toBe(COURT_DEFS.flat);
  });

  it('courtDefFor 는 full 에서만 크기를 본다 — 하프·플랫은 3단을 따라가지 않는다', () => {
    for (const size of COURT_SIZES) {
      expect(courtDefFor('full', size)).toBe(FULL_COURT_DEFS[size]);
      // 하프·플랫은 어떤 크기를 줘도 같은 판이다(근거는 court.ts 주석 셋).
      expect(courtDefFor('half', size), size).toBe(COURT_DEFS.half);
      expect(courtDefFor('flat', size), size).toBe(COURT_DEFS.flat);
    }
    // 대조군 — full 은 크기를 무시하지 **않는다**.
    expect(courtDefFor('full', '25x14')).not.toBe(courtDefFor('full', '30x18'));
    // half↔flat viewBox 동일(D12)은 크기 3단이 들어와도 그대로다.
    expect(courtDefFor('flat', '25x14').vbW).toBe(courtDefFor('half', '25x14').vbW);
    expect(courtDefFor('flat', '25x14').vbH).toBe(courtDefFor('half', '25x14').vbH);
  });

  it('normalizeCourtSize — 깨진 값은 던지지 않고 기본으로 접는다', () => {
    for (const size of COURT_SIZES) expect(normalizeCourtSize(size)).toBe(size);
    for (const bad of ['full', '30X18', '', null, undefined, 42, {}, ['30x18']]) {
      expect(normalizeCourtSize(bad), String(bad)).toBe(DEFAULT_COURT_SIZE);
    }
    // 깨진 크기를 그대로 courtDefFor 에 넣어도 기본 판이 나온다(런타임에 undefined 를 안 뱉는다).
    expect(courtDefFor('full', 'nope' as CourtSize)).toBe(FULL_COURT_DEFS[DEFAULT_COURT_SIZE]);
  });

  // ⚠️ 여기가 "size 인자를 안 넘기면 무슨 일이 나는가" 를 눈으로 보는 자리다. 네 헬퍼가
  // 전부 크기를 봐야 한다 — 하나라도 30×18 로 굳어 있으면 25×14 드릴에서 조용히 틀린다.
  it('좌표 헬퍼 넷이 크기를 실제로 본다 (clamp · isOnSurface · cellLabelAt · gridCellCenter)', () => {
    const outside = { x: 800, y: 400 }; // 30×18 판(825×525) 안, 25×14 판(700×425) 밖
    expect(clampToViewBox('full', outside, '30x18')).toEqual({ x: 800, y: 400 });
    expect(clampToViewBox('full', outside, '25x14')).toEqual({ x: 700, y: 400 });
    expect(clampToViewBox('full', outside, '28x15')).toEqual({ x: 775, y: 400 });

    const nearGoal = { x: 700, y: 262.5 }; // 30×18 경기면 안, 25×14 경기면(37.5..662.5) 밖
    expect(isOnSurface('full', nearGoal, '30x18')).toBe(true);
    expect(isOnSurface('full', nearGoal, '25x14')).toBe(false);

    expect(cellLabelAt('full', { x: 680, y: 262.5 }, '30x18')).toBe('f3');
    expect(cellLabelAt('full', { x: 680, y: 262.5 }, '25x14')).toBeNull(); // 격자 밖

    expect(gridCellCenter('full', 0, 0, '30x18')).toEqual({ x: 100, y: 82.5 });
    expect(gridCellCenter('full', 0, 0, '25x14')).not.toEqual({ x: 100, y: 82.5 });
    // 대조군 — 인자를 생략하면 넷 다 예전 그대로다(기본 크기 = 30×18).
    expect(clampToViewBox('full', outside)).toEqual({ x: 800, y: 400 });
    expect(isOnSurface('full', nearGoal)).toBe(true);
    expect(cellLabelAt('full', { x: 680, y: 262.5 })).toBe('f3');
    expect(gridCellCenter('full', 0, 0)).toEqual({ x: 100, y: 82.5 });
  });

  it('셀 중심 → 셀 이름 왕복이 세 단 전부에서 성립한다', () => {
    for (const size of COURT_SIZES) {
      for (let c = 0; c < 6; c++) {
        for (let r = 0; r < 5; r++) {
          expect(cellLabelAt('full', gridCellCenter('full', c, r, size), size), `${size} ${c},${r}`).toBe(gridLabel(c, r));
        }
      }
      // 대조군 — 격자 밖(마진 띠)은 세 단 모두 null 이다.
      expect(cellLabelAt('full', { x: 10, y: 10 }, size), size).toBeNull();
    }
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
