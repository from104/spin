// 코트 정의. §3.2. 좌표는 검산된 확정값 — 표와 다르게 고치지 않는다.
//
// 2026-08-10 기현 지시로 **코트 외곽 마진을 1.0 → 1.5 m** 로 넓혔다. 경기면(surface)의 실치수는
// 그대로이고 viewBox 가 사방 12.5 px 씩 커졌다 — 마진은 코트를 줄이는 것이 아니라 판을 넓히는
// 것이다. 라인 밖 배치(킥인·코너 세트피스, D26)에 휠체어(길이 1.5 m)가 온전히 서려면 1.0 m
// 로는 모자랐다. 그래서 아래 좌표는 전부 옛 표에서 +12.5 씩 옮겨진 값이다.
// court.test.ts 의 '코트 외곽 마진' 불변식이 네 변을 모두 붙잡고 있다.
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
    vbW: 825,
    vbH: 525,
    surface: { x: 37.5, y: 37.5, w: 750, h: 450 },
    ruleZones: [
      { x: 37.5, y: 162.5, w: 125, h: 200 },
      { x: 662.5, y: 162.5, w: 125, h: 200 },
    ],
    goalPosts: [
      { x: 37.5, y: 187.5 },
      { x: 37.5, y: 337.5 },
      { x: 787.5, y: 187.5 },
      { x: 787.5, y: 337.5 },
    ],
    cornerCuts: ['M37.5,62.5 L62.5,37.5', 'M762.5,37.5 L787.5,62.5', 'M787.5,462.5 L762.5,487.5', 'M62.5,487.5 L37.5,462.5'],
    spotMarks: [
      { x: 125, y: 262.5 },
      { x: 700, y: 262.5 },
    ],
    grid: { cols: 6, rows: 5, cellW: 125, cellH: 90, origin: { x: 37.5, y: 37.5 } },
    // 처음 놓을 때는 **세로로 세워 둔다**(기현 지시 2026-08-11). 골대가 좌우에 있으니
    // 공격 축을 따르면 0°/180°(가로)가 맞지만, 판을 짤 때 필요한 것은 "지금 어디를
    // 보고 있는가" 가 아니라 "누가 어디에 있는가" 다 — 방향은 그 다음에 돌려 잡는다.
    // 하프·플랫과 같은 값이라 코트를 바꿔도 말이 서 있는 모습이 달라지지 않는다.
    homeHeadingDeg: 90,
    awayHeadingDeg: 270,
  },
  half: {
    mode: 'half',
    label: '하프 코트',
    dims: '18 × 15 m · 90° 회전',
    desc: '공격 진영만 세로로 확대. 마무리·세트피스 훈련에 적합합니다.',
    vbW: 525,
    vbH: 450,
    surface: { x: 37.5, y: 37.5, w: 450, h: 375 },
    ruleZones: [{ x: 162.5, y: 287.5, w: 200, h: 125 }],
    goalPosts: [
      { x: 187.5, y: 412.5 },
      { x: 337.5, y: 412.5 },
    ],
    cornerCuts: ['M37.5,387.5 L62.5,412.5', 'M462.5,412.5 L487.5,387.5'],
    spotMarks: [{ x: 262.5, y: 325 }],
    grid: { cols: 5, rows: 3, cellW: 90, cellH: 125, origin: { x: 37.5, y: 37.5 } },
    homeHeadingDeg: 90,
    awayHeadingDeg: 270,
  },
  flat: {
    mode: 'flat',
    label: '플랫 코트',
    dims: '라인 없음',
    desc: '하프 코트에서 라인을 제거한 자유 배치용. 위치 개념 설명에 적합합니다.',
    // ⚠️ viewBox 는 half 와 **정확히 같아야** 한다(D12) — half↔flat 이 좌표를 보존하는
    // 무손실 전환인 근거가 그것이다. half 가 마진 1.5 m 로 커지면 여기도 같이 커진다.
    vbW: 525,
    vbH: 450,
    surface: { x: 0, y: 0, w: 525, h: 450 },
    ruleZones: [],
    goalPosts: [],
    cornerCuts: [],
    spotMarks: [],
    grid: { cols: 21, rows: 18, cellW: 25, cellH: 25, origin: { x: 0, y: 0 } },
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

/** 경기면(라인 안쪽) 위인가. §4.4 P2-1 — **판의 프레임이 어디서부터인가**를 정하는 유일한 출처다.
 *
 *  마진 1.5 m(37.5 px, 2026-08-10 확장)은 코트가 아니라 판의 테두리다. 그래서 그 위에서 시작한
 *  드래그는 고무줄 선택이 아니라 판 이동이 된다(useEditorPointer). 경계를 코트 정의 옆에 두는
 *  이유는 마진이 또 바뀌었을 때 규칙이 저절로 따라오게 하기 위해서다 — 편집기에 37.5 를 다시
 *  적으면 그날부터 두 곳이 갈라진다.
 *
 *  **라인 위는 경기면으로 친다**(경계 포함). 라인 위에 세운 개체를 고무줄로 걸 수 없으면
 *  "선 위에 놓지 마라" 라는 규칙을 판이 몰래 만드는 셈이다.
 *
 *  `flat` 은 surface 가 viewBox 전체라 마진이 0 이다 — 라인이 없는 판에는 테두리도 없고,
 *  viewBox 밖(판 바깥 여백)만 프레임이다. */
export function isOnSurface(mode: CourtMode, p: Vec2): boolean {
  const { x, y, w, h } = COURT_DEFS[mode].surface;
  return p.x >= x && p.x <= x + w && p.y >= y && p.y <= y + h;
}

/** 개체 좌표는 viewBox 안으로만 클램프한다 (경기면 밖 대기 배치 허용) */
export function clampToViewBox(mode: CourtMode, p: Vec2): Vec2 {
  const { vbW, vbH } = COURT_DEFS[mode];
  return {
    x: Math.min(Math.max(p.x, 0), vbW),
    y: Math.min(Math.max(p.y, 0), vbH),
  };
}
