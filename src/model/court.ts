// 코트 정의. §3.2. 좌표는 검산된 확정값 — 표와 다르게 고치지 않는다.
//
// 2026-08-10 기현 지시로 **코트 외곽 마진을 1.0 → 1.5 m** 로 넓혔다. 경기면(surface)의 실치수는
// 그대로이고 viewBox 가 사방 12.5 px 씩 커졌다 — 마진은 코트를 줄이는 것이 아니라 판을 넓히는
// 것이다. 라인 밖 배치(킥인·코너 세트피스, D26)에 휠체어(길이 1.5 m)가 온전히 서려면 1.0 m
// 로는 모자랐다. 그래서 아래 좌표는 전부 옛 표에서 +12.5 씩 옮겨진 값이다.
// court.test.ts 의 '코트 외곽 마진' 불변식이 네 변을 모두 붙잡고 있다.
import type { Vec2 } from '../core/units.ts';
import { PX_PER_M } from '../core/units.ts';

export type CourtMode = 'full' | 'half' | 'flat';
export const COURT_MODES = ['full', 'half', 'flat'] as const;

// ── §5.1 코트 크기 3단 (FIPFA Laws 2025, §9 결정 ②) ──────────────────────────────────────────
//
// Laws 는 경기장을 **30×18 m(최대) / 28×15 m(기본 = 표준 농구 코트) / 25×14 m(최소)** 로 적는다.
// 체육관마다 바닥이 다른데 앱이 30×18 하나만 알면, 코치가 그린 배치가 실제 코트와 안 맞는다.
//
// ⚠️ **기본값은 '30x18' 그대로 둔다**(§9 ② 부기). 기본을 28×15 로 옮기면 이미 저장된 드릴이
// 전부 다른 코트에서 열려 "내 판이 달라졌다" 가 된다. 28×15 는 **선택지로만** 추가한다.
export type CourtSize = '30x18' | '28x15' | '25x14';
export const COURT_SIZES = ['30x18', '28x15', '25x14'] as const;
/** ⚠️ 되돌리면 안 되는 한 줄. 이 값을 '28x15' 로 바꾸는 순간 `courtSize` 가 없는 옛 드릴(=지금
 *  저장돼 있는 전부)이 28×15 코트에서 열린다 — 좌표는 그대로인데 판만 작아지므로 선수가 라인
 *  밖에 선다. 기본 코트를 옮기고 싶으면 그것은 **마이그레이션으로 옛 문서에 '30x18' 을 새겨
 *  넣은 다음** 할 일이다. */
export const DEFAULT_COURT_SIZE: CourtSize = '30x18';

/** 크기 선택 UI 가 쓸 사람용 이름. `CourtDef.dims` 는 '30 × 18 m' 처럼 치수만 적으므로
 *  "최대/표준/최소" 라는 규정상의 자리는 여기서만 말한다. */
export const COURT_SIZE_LABELS: Record<CourtSize, string> = {
  '30x18': '최대 30 × 18 m',
  '28x15': '표준 28 × 15 m (농구 코트)',
  '25x14': '최소 25 × 14 m',
};

export function normalizeCourtSize(v: unknown): CourtSize {
  return typeof v === 'string' && (COURT_SIZES as readonly string[]).includes(v) ? (v as CourtSize) : DEFAULT_COURT_SIZE;
}

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

// ── 풀 코트 3단을 **파생으로** 만든다 (규칙 10: 좌표 리터럴 금지) ──────────────────────────────
//
// 2026-08-11 에 외곽선·센터서클이 리터럴이라 마진을 넓히자 골대가 선 밖으로 나간 사고가 있었다.
// 같은 표를 손으로 세 벌 적으면 그 사고가 세 배가 된다. 그래서 아래 `buildFullCourt` 하나가
// **30×18 의 확정 좌표를 그대로 재생산하면서** 28×15·25×14 를 같은 규칙으로 만들어 낸다
// (court.test.ts 의 `it('full')` 이 옛 표를 통째로 그대로 붙잡고 있으므로, 빌더가 한 자리라도
// 어긋나면 그 테스트가 먼저 빨개진다 — 빌더의 검산기다).
//
// **코트 크기에 따라 비례하는 것은 경기면 사각형뿐이다.** 골대 폭(6 m) · 골 지역(8×5 m) ·
// 페널티 마크(골라인에서 3.5 m) · 코너 삼각형(1 m) · 심판 구역(사방 1.5 m)은 Laws 가 **절대
// 치수**로 적는다 — 코트가 작아져도 골대는 작아지지 않는다(대조 노트 '1. 경기장' 표).
const MARGIN_PX = 1.5 * PX_PER_M; // 심판 구역. 규정 최소 1 m 인데 앱은 1.5 m (2026-08-10 지시)
const GOAL_HALF_PX = 3 * PX_PER_M; // 골대 폭 6 m 의 반
const AREA_DEPTH_PX = 5 * PX_PER_M; // 골 지역 깊이 5 m
const AREA_HALF_PX = 4 * PX_PER_M; // 골 지역 폭 8 m 의 반
const PENALTY_PX = 3.5 * PX_PER_M; // 페널티 마크 — 골라인에서 3.5 m
const CORNER_PX = 1 * PX_PER_M; // 코너 삼각형 — 각 코너에서 1 m, 필드 안쪽
// 격자는 **상대 좌표계**다. 코트가 작아져도 6×5 를 유지한다 — 코치가 쓰는 말은 "a1 쪽" 이지
// "5 m 칸" 이 아니고, 칸 수가 크기마다 달라지면 같은 드릴을 다른 코트에서 설명할 수 없다.
// (그 대신 칸의 미터 치수는 크기마다 달라진다: 30×18 은 5.0×3.6 m, 25×14 는 4.17×2.8 m.)
const GRID_COLS = 6;
const GRID_ROWS = 5;

function buildFullCourt(lengthM: number, widthM: number, desc: string): CourtDef {
  const w = lengthM * PX_PER_M;
  const h = widthM * PX_PER_M;
  const x0 = MARGIN_PX;
  const y0 = MARGIN_PX;
  const x1 = x0 + w;
  const y1 = y0 + h;
  const cy = y0 + h / 2;
  return {
    mode: 'full',
    label: '풀 코트',
    dims: `${lengthM} × ${widthM} m`,
    desc,
    vbW: w + 2 * MARGIN_PX,
    vbH: h + 2 * MARGIN_PX,
    surface: { x: x0, y: y0, w, h },
    ruleZones: [
      { x: x0, y: cy - AREA_HALF_PX, w: AREA_DEPTH_PX, h: 2 * AREA_HALF_PX },
      { x: x1 - AREA_DEPTH_PX, y: cy - AREA_HALF_PX, w: AREA_DEPTH_PX, h: 2 * AREA_HALF_PX },
    ],
    goalPosts: [
      { x: x0, y: cy - GOAL_HALF_PX },
      { x: x0, y: cy + GOAL_HALF_PX },
      { x: x1, y: cy - GOAL_HALF_PX },
      { x: x1, y: cy + GOAL_HALF_PX },
    ],
    cornerCuts: [
      `M${x0},${y0 + CORNER_PX} L${x0 + CORNER_PX},${y0}`,
      `M${x1 - CORNER_PX},${y0} L${x1},${y0 + CORNER_PX}`,
      `M${x1},${y1 - CORNER_PX} L${x1 - CORNER_PX},${y1}`,
      `M${x0 + CORNER_PX},${y1} L${x0},${y1 - CORNER_PX}`,
    ],
    spotMarks: [
      { x: x0 + PENALTY_PX, y: cy },
      { x: x1 - PENALTY_PX, y: cy },
    ],
    grid: { cols: GRID_COLS, rows: GRID_ROWS, cellW: w / GRID_COLS, cellH: h / GRID_ROWS, origin: { x: x0, y: y0 } },
    // 처음 놓을 때는 **세로로 세워 둔다**(기현 지시 2026-08-11). 골대가 좌우에 있으니
    // 공격 축을 따르면 0°/180°(가로)가 맞지만, 판을 짤 때 필요한 것은 "지금 어디를
    // 보고 있는가" 가 아니라 "누가 어디에 있는가" 다 — 방향은 그 다음에 돌려 잡는다.
    // 하프·플랫과 같은 값이라 코트를 바꿔도 말이 서 있는 모습이 달라지지 않는다.
    homeHeadingDeg: 90,
    awayHeadingDeg: 270,
  };
}

/** 풀 코트 3단. viewBox 는 각각 825×525 / 775×450 / 700×425 다(§9 ② 표). */
export const FULL_COURT_DEFS: Record<CourtSize, CourtDef> = {
  '30x18': buildFullCourt(30, 18, '규격 최대 크기의 전체 코트. 4v4 전술 전개와 전환 훈련에 적합합니다.'),
  '28x15': buildFullCourt(28, 15, '표준 농구 코트와 같은 크기. 국내 체육관에서 가장 흔한 바닥입니다.'),
  '25x14': buildFullCourt(25, 14, '규격 최소 크기. 좁은 체육관·소규모 훈련장에 맞춘 코트입니다.'),
};

export const COURT_DEFS: Record<CourtMode, CourtDef> = {
  // ⚠️ **같은 객체**를 가리킨다(사본이 아니다). `COURT_DEFS.full` 을 읽는 기존 소비처 전부가
  // 크기 3단 도입 뒤에도 정확히 예전 값을 본다는 것이 이 한 줄의 뜻이다 — 크기를 아는 코드는
  // `courtDefFor(mode, size)` 로 옮겨 가고, 모르는 코드는 아무것도 달라지지 않는다.
  full: FULL_COURT_DEFS[DEFAULT_COURT_SIZE],
  // ⚠️ **하프·플랫은 풀 코트 3단을 따라가지 않는다.** 근거 셋(2026-08-13, 5.1):
  //  ① Laws 2025 에 '하프 코트' 라는 규격이 없다 — 이것은 훈련용 구획이지 경기장이 아니다.
  //     따라올 규정값 자체가 없으므로 "규격에 맞춘다" 는 이유가 성립하지 않는다.
  //  ② 격자가 깨진다. 하프는 5×3 칸인데, 28×15 를 따라가면 경기면이 375×350 px 이 되어
  //     한 칸이 116.67 px(=4.67 m)·크기마다 다른 값이 된다. 25×14 는 350×312.5 px 이라 세로
  //     한 칸이 104.17 px 다. 코치가 "b2 로" 라고 말할 때 그 칸이 코트마다 다른 넓이가 된다.
  //  ③ flat 은 라인이 **하나도 없는** 자유 배치판이다(surface = viewBox 전체). 규격이 없는 판을
  //     규격 3단으로 쪼개면 D12(half↔flat viewBox 동일)를 지키려고 자유판까지 3벌이 된다.
  //  바꿔야 할 날이 오면 근거는 "코치가 하프에서도 실제 바닥 치수를 맞추고 싶어한다" 여야 하고,
  //  그때 ②의 격자 규칙(5×3 고정인가, 칸 크기 고정인가)을 **먼저** 정해야 한다.
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

/** **코트 정의의 유일한 조회구.** `COURT_DEFS[mode]` 를 직접 읽으면 크기 3단이 보이지 않는다
 *  (풀 코트는 언제나 30×18 로 읽힌다). 크기를 아는 코드는 전부 이 함수를 지난다.
 *
 *  `size` 는 **full 에서만** 의미가 있다 — 하프·플랫은 3단을 따라가지 않는다(위 주석 근거 셋).
 *  그래도 드릴은 하프에서도 courtSize 를 **들고 다닌다**: 하프로 갔다가 풀로 돌아왔을 때
 *  고른 코트가 사라지면, 코치가 크기를 다시 골라야 한다.
 *
 *  깨진 값(파일에서 온 임의 문자열)은 던지지 않고 기본 크기로 접는다 — 이 저장소의 규약이다. */
export function courtDefFor(mode: CourtMode, size: CourtSize = DEFAULT_COURT_SIZE): CourtDef {
  if (mode !== 'full') return COURT_DEFS[mode];
  return FULL_COURT_DEFS[size] ?? FULL_COURT_DEFS[DEFAULT_COURT_SIZE];
}

export const gridLabel = (col: number, row: number): string =>
  String.fromCharCode(97 + col) + String(row + 1); // a1, b4 …

export function gridCellCenter(mode: CourtMode, col: number, row: number, size?: CourtSize): Vec2 {
  const { cellW, cellH, origin } = courtDefFor(mode, size).grid;
  return { x: origin.x + cellW * (col + 0.5), y: origin.y + cellH * (row + 0.5) };
}

export function cellLabelAt(mode: CourtMode, p: Vec2, size?: CourtSize): string | null {
  const { cols, rows, cellW, cellH, origin } = courtDefFor(mode, size).grid;
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
export function isOnSurface(mode: CourtMode, p: Vec2, size?: CourtSize): boolean {
  const { x, y, w, h } = courtDefFor(mode, size).surface;
  return p.x >= x && p.x <= x + w && p.y >= y && p.y <= y + h;
}

/** 개체 좌표는 viewBox 안으로만 클램프한다 (경기면 밖 대기 배치 허용).
 *
 *  ⚠️ `size` 를 빼먹으면 25×14 드릴(vb 700×425)의 좌표가 825×525 로 클램프돼 **판 밖에 있는
 *  개체가 그대로 살아남는다.** validateDrill 이 드릴의 courtSize 를 여기까지 흘려보내는 이유다. */
export function clampToViewBox(mode: CourtMode, p: Vec2, size?: CourtSize): Vec2 {
  const { vbW, vbH } = courtDefFor(mode, size);
  return {
    x: Math.min(Math.max(p.x, 0), vbW),
    y: Math.min(Math.max(p.y, 0), vbH),
  };
}
