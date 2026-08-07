// 코트 정의. §3.2. 좌표는 검산된 확정값 — 표와 다르게 고치지 않는다.
import type { Vec2 } from '../core/units.ts';

export type CourtMode = 'full' | 'half' | 'flat';
export const COURT_MODES = ['full', 'half', 'flat'] as const;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CourtDef {
  mode: CourtMode;
  label: string;
  dims: string;
  desc: string;
  vbW: number;
  vbH: number;
  surface: Rect; // 라인 안쪽 경기면. flat 은 viewBox 전체
  ruleZones: Rect[]; // 골 지역 2인 규칙 존
  goalPosts: Vec2[];
  cornerCuts: string[];
  spotMarks: Vec2[];
  grid: { cols: number; rows: number; cellW: number; cellH: number; origin: Vec2 };
  homeHeadingDeg: number;
  awayHeadingDeg: number;
}

export const COURT_DEFS: Record<CourtMode, CourtDef> = {
  full: {
    mode: 'full',
    label: '풀 코트',
    dims: '30 × 18 m',
    desc: '규격 최대 크기의 전체 코트. 4v4 전술 전개와 전환 훈련에 적합합니다.',
    vbW: 800,
    vbH: 500,
    surface: { x: 25, y: 25, w: 750, h: 450 },
    ruleZones: [
      { x: 25, y: 150, w: 125, h: 200 },
      { x: 650, y: 150, w: 125, h: 200 },
    ],
    goalPosts: [
      { x: 25, y: 175 },
      { x: 25, y: 325 },
      { x: 775, y: 175 },
      { x: 775, y: 325 },
    ],
    cornerCuts: ['M25,50 L50,25', 'M750,25 L775,50', 'M775,450 L750,475', 'M50,475 L25,450'],
    spotMarks: [
      { x: 112.5, y: 250 },
      { x: 687.5, y: 250 },
    ],
    grid: { cols: 6, rows: 5, cellW: 125, cellH: 90, origin: { x: 25, y: 25 } },
    homeHeadingDeg: 0,
    awayHeadingDeg: 180,
  },
  half: {
    mode: 'half',
    label: '하프 코트',
    dims: '18 × 15 m · 90° 회전',
    desc: '공격 진영만 세로로 확대. 마무리·세트피스 훈련에 적합합니다.',
    vbW: 500,
    vbH: 425,
    surface: { x: 25, y: 25, w: 450, h: 375 },
    ruleZones: [{ x: 150, y: 275, w: 200, h: 125 }],
    goalPosts: [
      { x: 175, y: 400 },
      { x: 325, y: 400 },
    ],
    cornerCuts: ['M25,375 L50,400', 'M450,400 L475,375'],
    spotMarks: [{ x: 250, y: 312.5 }],
    grid: { cols: 5, rows: 3, cellW: 90, cellH: 125, origin: { x: 25, y: 25 } },
    homeHeadingDeg: 90,
    awayHeadingDeg: 270,
  },
  flat: {
    mode: 'flat',
    label: '플랫 코트',
    dims: '라인 없음',
    desc: '하프 코트에서 라인을 제거한 자유 배치용. 위치 개념 설명에 적합합니다.',
    vbW: 500,
    vbH: 425,
    surface: { x: 0, y: 0, w: 500, h: 425 },
    ruleZones: [],
    goalPosts: [],
    cornerCuts: [],
    spotMarks: [],
    grid: { cols: 20, rows: 17, cellW: 25, cellH: 25, origin: { x: 0, y: 0 } },
    homeHeadingDeg: 90,
    awayHeadingDeg: 270,
  },
};

export const gridLabel = (col: number, row: number): string =>
  String.fromCharCode(97 + col) + String(row + 1); // a1, b4 …

export function gridCellCenter(mode: CourtMode, col: number, row: number): Vec2 {
  const { cellW, cellH, origin } = COURT_DEFS[mode].grid;
  return { x: origin.x + cellW * (col + 0.5), y: origin.y + cellH * (row + 0.5) };
}

export function cellLabelAt(mode: CourtMode, p: Vec2): string | null {
  const { cols, rows, cellW, cellH, origin } = COURT_DEFS[mode].grid;
  const col = Math.floor((p.x - origin.x) / cellW);
  const row = Math.floor((p.y - origin.y) / cellH);
  if (col < 0 || col >= cols || row < 0 || row >= rows) return null;
  return gridLabel(col, row);
}

/** 개체 좌표는 viewBox 안으로만 클램프한다 (경기면 밖 대기 배치 허용) */
export function clampToViewBox(mode: CourtMode, p: Vec2): Vec2 {
  const { vbW, vbH } = COURT_DEFS[mode];
  return {
    x: Math.min(Math.max(p.x, 0), vbW),
    y: Math.min(Math.max(p.y, 0), vbH),
  };
}
