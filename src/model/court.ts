// 코트 정의. §3.2. 좌표는 검산된 확정값 — 표와 다르게 고치지 않는다.
//
// 2026-08-10 기현 지시로 **코트 외곽 마진을 1.0 → 1.5 m** 로 넓혔다. 경기면(surface)의 실치수는
// 그대로이고 viewBox 가 사방 12.5 px 씩 커졌다 — 마진은 코트를 줄이는 것이 아니라 판을 넓히는
// 것이다. 라인 밖 배치(킥인·코너 세트피스, D26)에 휠체어(길이 1.5 m)가 온전히 서려면 1.0 m
// 로는 모자랐다. 그래서 아래 좌표는 전부 옛 표에서 +12.5 씩 옮겨진 값이다.
// court.test.ts 의 '코트 외곽 마진' 불변식이 네 변을 모두 붙잡고 있다.
import type { Vec2 } from '../core/units.ts';
import { PX_PER_M } from '../core/units.ts';
import type { Locale } from '../i18n/locale.ts';

export type CourtMode = 'full' | 'half' | 'flat';
export const COURT_MODES = ['full', 'half', 'flat'] as const;

/** 코트 형태 짧은 표기 — 헤더 코트 스위치·설정 화면 양쪽이 같은 값을 썼다(각자 로컬 사본으로
 *  중복 정의돼 있었다). i18n C2 에서 로케일 차원을 붙이며 여기 하나로 합쳤다. */
export const COURT_MODE_SHORT_LABELS: Record<Locale, Record<CourtMode, string>> = {
  ko: { full: '풀', half: '하프', flat: '플랫' },
  en: { full: 'Full', half: 'Half', flat: 'Flat' },
  ja: { full: 'フル', half: 'ハーフ', flat: 'フラット' },
};

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
  /** **코너킥 인크로치먼트 마크**(Laws 2025 신설, §5.2). SVG path `d` 문자열 — `cornerCuts` 와
   *  같은 규약이다. 골대마다 2개이므로 풀 **4개** · 하프 2개 · 플랫 0개다.
   *  기준점은 코너가 아니라 **골포스트**다 — 근거는 `goalEncroachMarks` 머리말 ⚠️. */
  encroachMarks: string[];
  /** **센터 마크**("X", §5.3). 하프라인 중점에 하나.
   *
   *  ⚠️ 2026-08-12 까지는 *"하프라인을 그리지 않는 판은 null — 하프·플랫이 그렇다"* 였다.
   *  2026-08-13 기현님 실기 지시로 **하프도 값을 갖는다**(하프 코트의 위쪽 변이 곧 하프라인이다).
   *  `null` 은 이제 `flat` 하나뿐이다 — 근거는 아래 `COURT_DEFS.flat.centerMark` 주석.
   *
   *  크기는 규격 15 cm 가 아니라 **페널티 스팟 십자와 같은 반폭 3.5 px** 다
   *  (`CENTER_MARK_HALF_PX` 머리말에 근거·실측). */
  centerMark: string | null;
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
/** 골대 폭 6 m 의 반. **코트 3단과 무관하게 고정**이다 — 위 문단이 적어 둔 "코트가 작아져도
 *  골대는 작아지지 않는다" 가 이 상수다. 세트피스 5 m 면제 구역의 폭도 여기서 온다
 *  (기현 지시 2026-08-17: *"6미터 고정!"*). export 인 이유는 그 구역이 골포스트가 아니라
 *  **골라인**에서 유도되기 때문이다 — `goalMouths` 머리말. */
export const GOAL_HALF_PX = 3 * PX_PER_M;
const AREA_DEPTH_PX = 5 * PX_PER_M; // 골 지역 깊이 5 m
const AREA_HALF_PX = 4 * PX_PER_M; // 골 지역 폭 8 m 의 반
const PENALTY_PX = 3.5 * PX_PER_M; // 페널티 마크 — 골라인에서 3.5 m
const CORNER_PX = 1 * PX_PER_M; // 코너 삼각형 — 각 코너에서 1 m, 필드 안쪽
// ── §5.2 코너킥 인크로치먼트 마크 (Laws 2025 신설) ───────────────────────────────────────────
const ENCROACH_INSET_PX = 1 * PX_PER_M; // 골포스트에서 **골 안쪽으로** 1 m
/** 마크가 골라인 밖으로 뻗는 길이. **Laws 는 이 길이를 적지 않는다** — 규정이 정하는 것은
 *  "어디서 시작하는가"(포스트 안쪽 1 m)와 "어느 쪽으로 긋는가"(골라인에 수직, 필드 밖)뿐이다.
 *  그래서 0.5 m 는 규격이 아니라 **그리기 선택**이고, 근거는 심판 구역 1.5 m 의 1/3 이라는 것이다
 *  — 마크가 판 가장자리(viewBox)에 닿지 않고, 세 코트 크기에서 마진이 같으므로 셋 다 같은 여유를
 *  갖는다. courtMarks.test.ts 가 '끝점이 viewBox 안' 을 세 크기 전부에서 잰다. */
const ENCROACH_LEN_PX = 0.5 * PX_PER_M;
/** **페널티 스팟 십자의 반폭**(px). 십자를 그리는 곳은 셋이다 — `FullCourtLines`(dx),
 *  `HalfCourtLines`(dx=dy), `buildStaticSvg.goalCrossD`. 2026-08-13 이전에는 그 셋에 리터럴
 *  `3.5` 가 각각 박혀 있었다.
 *
 *  ⚠️ **센터 마크의 표시 크기가 이 값에서 파생된다**(바로 아래 `CENTER_MARK_HALF_PX`).
 *  기현님의 지시는 "센터 X 를 페널티 스팟과 **같은 크기로**" 이므로, 두 값이 각각 리터럴이면
 *  다음에 스팟 십자만 손대는 순간 그 '같음' 이 소리 없이 깨진다. 여기 한 곳에서만 정한다.
 *
 *  이 3.5 는 좌표가 아니라 **그리기 치수**다(0.14 m — Laws 에 없는 값이고, 프로토타입
 *  마크업에서 그대로 옮겨온 화면 크기다). 그래서 `PX_PER_M` 파생이 아니다. */
export const SPOT_CROSS_HALF_PX = 3.5;

/** §5.3 센터 마크 — 하프라인 중점의 "X". Laws 2025 전문(50쪽)에 *"circle"* 이 0회 나온다:
 *  파워체어 풋볼에는 센터 서클이 없고 이 X 만 있다(§9 결정 ⑧).
 *
 *  ⚠️ **규격값이다. 그리기에는 쓰지 않는다** — 화면 크기는 `CENTER_MARK_HALF_PX` 다.
 *  15 cm × 25 px/m = 3.75 px, 즉 반폭 1.875 px. */
export const CENTER_MARK_SPEC_PX = 0.15 * PX_PER_M;

/** 센터 마크의 **표시** 반폭.
 *
 *  ⚠️ **규격에서 벗어난 값이고, 그것을 알고 고른 가독성 결정이다.** 규격 반폭은 1.875 px 인데
 *  페널티 스팟 십자는 반폭 3.5 px 로 그려진다 — 규격대로 그린 센터 X 는 화면에서 스팟 십자의
 *  **53%**(1.875 / 3.5)여서 같은 판 위의 두 X 가 눈에 띄게 다른 표시로 읽혔다.
 *  **2026-08-13 기현님 실기 지시**: *"센터 중앙 x자를 패널티스팟과 같은 크기로"*.
 *  그래서 표시 반폭 = 3.5 px → 전체 7 px = **0.28 m ≈ 28 cm** 다(규격 15 cm 의 1.87배).
 *
 *  규격값(`CENTER_MARK_SPEC_PX`)을 **지우지 않은** 이유가 이것이다: 이 파일만 보고 7 px 을
 *  FIPFA 규격으로 착각하면 다음 사람이 규정 문서를 잘못 고친다. courtMarks.test.ts 가 규격값과
 *  표시값을 **각각** 붙잡고 있고, 둘이 다르다는 것 자체를 단언한다. */
export const CENTER_MARK_HALF_PX = SPOT_CROSS_HALF_PX;
// 격자는 **상대 좌표계**다. 코트가 작아져도 6×5 를 유지한다 — 코치가 쓰는 말은 "a1 쪽" 이지
// "5 m 칸" 이 아니고, 칸 수가 크기마다 달라지면 같은 드릴을 다른 코트에서 설명할 수 없다.
// (그 대신 칸의 미터 치수는 크기마다 달라진다: 30×18 은 5.0×3.6 m, 25×14 는 4.17×2.8 m.)
const GRID_COLS = 6;
const GRID_ROWS = 5;

/** 한 골대(포스트 두 개)의 코너킥 인크로치먼트 마크 2개를 만든다.
 *
 *  ⚠️ **코너에서 재는 거리가 아니다.** Laws 2025 Law 17 은 *"각 골포스트 안쪽 1 m"* 라고 적는다 —
 *  기준점은 코너가 아니라 **포스트**다. 코너 삼각형도 마침 1 m 라(위 `CORNER_PX`) 둘을 헷갈리기
 *  딱 좋은데, 코너 기준으로 그리면 코트가 커질수록 마크가 골대에서 멀어져 **코치가 규칙을 잘못
 *  배운다**(코너킥 때 골 지역 수비수가 서야 하는 자리가 바로 이 마크 뒤다).
 *
 *  `a`·`b` 는 **같은 골대**의 두 포스트(순서 무관), `out` 은 골라인에 수직인 **필드 밖** 단위벡터다.
 *  포스트 좌표를 그대로 받으므로 코트 크기가 바뀌어도 저절로 따라온다(규칙 10 — 리터럴 금지). */
function goalEncroachMarks(a: Vec2, b: Vec2, out: Vec2): string[] {
  const len = Math.hypot(b.x - a.x, b.y - a.y); // 골대 폭 6 m — 크기 3단에서 변하지 않는다
  const ux = (b.x - a.x) / len;
  const uy = (b.y - a.y) / len;
  const mark = (p: Vec2): string =>
    `M${p.x},${p.y} L${p.x + out.x * ENCROACH_LEN_PX},${p.y + out.y * ENCROACH_LEN_PX}`;
  return [
    mark({ x: a.x + ux * ENCROACH_INSET_PX, y: a.y + uy * ENCROACH_INSET_PX }),
    mark({ x: b.x - ux * ENCROACH_INSET_PX, y: b.y - uy * ENCROACH_INSET_PX }),
  ];
}

/** 센터 마크 — 중점 `c` 를 중심으로 반폭 `CENTER_MARK_HALF_PX` 인 "X" 두 획.
 *  ⚠️ 2026-08-13 이전에는 `CENTER_MARK_PX / 2`(= 1.875, 규격 15 cm)였다. 기현님 실기 지시로
 *  페널티 스팟 십자와 같은 3.5 로 올렸다 — 근거는 `CENTER_MARK_HALF_PX` 머리말. */
function centerMarkD(c: Vec2): string {
  const r = CENTER_MARK_HALF_PX;
  return `M${c.x - r},${c.y - r} L${c.x + r},${c.y + r} M${c.x + r},${c.y - r} L${c.x - r},${c.y + r}`;
}

function buildFullCourt(lengthM: number, widthM: number, desc: string): CourtDef {
  const w = lengthM * PX_PER_M;
  const h = widthM * PX_PER_M;
  const x0 = MARGIN_PX;
  const y0 = MARGIN_PX;
  const x1 = x0 + w;
  const y1 = y0 + h;
  const cy = y0 + h / 2;
  // 골포스트 4개. 인크로치먼트 마크가 **이 배열을 그대로 받아** 파생되므로, 골대가 움직이면
  // 마크도 같이 움직인다(둘이 갈라질 자리 자체가 없다).
  const posts: Vec2[] = [
    { x: x0, y: cy - GOAL_HALF_PX },
    { x: x0, y: cy + GOAL_HALF_PX },
    { x: x1, y: cy - GOAL_HALF_PX },
    { x: x1, y: cy + GOAL_HALF_PX },
  ];
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
    goalPosts: posts,
    // 좌우 골대 각각 2개 → 4개. 필드 밖 방향은 좌골대가 −x, 우골대가 +x 다.
    encroachMarks: [
      ...goalEncroachMarks(posts[0]!, posts[1]!, { x: -1, y: 0 }),
      ...goalEncroachMarks(posts[2]!, posts[3]!, { x: 1, y: 0 }),
    ],
    // 하프라인의 중점 = 경기면 중심. 풀 코트에만 하프라인이 있으므로 센터 마크도 여기뿐이다.
    centerMark: centerMarkD({ x: x0 + w / 2, y: cy }),
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

/** 하프 코트의 골포스트. 인크로치먼트 마크가 이 배열에서 파생되도록 이름을 준 것뿐이다
 *  (풀 코트의 `posts` 와 같은 이유 — 골대와 마크가 갈라질 자리를 없앤다). */
const HALF_GOAL_POSTS: Vec2[] = [
  { x: 187.5, y: 412.5 },
  { x: 337.5, y: 412.5 },
];

/** 하프 코트의 경기면. `centerMark` 가 이 사각형에서 파생되도록 이름을 준 것뿐이다 —
 *  아래 리터럴 객체 안에서는 `surface` 를 자기 자신이 참조할 수 없다(규칙 10: 좌표 리터럴
 *  금지. 262.5 를 손으로 적으면 경기면이 움직였을 때 X 만 옛 자리에 남는다). */
const HALF_SURFACE: Rect = { x: 37.5, y: 37.5, w: 450, h: 375 };

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
    surface: HALF_SURFACE,
    ruleZones: [{ x: 162.5, y: 287.5, w: 200, h: 125 }],
    goalPosts: HALF_GOAL_POSTS,
    // 골대가 하나뿐이라 마크는 2개. 하프 코트의 골라인은 아래쪽 변이므로 필드 밖은 +y 다.
    encroachMarks: goalEncroachMarks(HALF_GOAL_POSTS[0]!, HALF_GOAL_POSTS[1]!, { x: 0, y: 1 }),
    // ── 옛 결정(2026-08-12까지) — 지우지 않는다. 기록이다 ────────────────────────────────
    // ⚠️ **센터 마크는 없다**(§5.3, 계획서가 못박은 자리다). 이 판에는 하프라인이 그려지지
    //    않는다 — 위쪽 변은 경기면의 끝이지 "중앙" 이 아니고, 그 선 위에 X 를 찍으면 코치가
    //    코트 바깥 가장자리를 센터로 읽는다. 파일 머리말의 "센터점은 하프 마크업에 없다 —
    //    추가하지 않는다"(HalfCourtLines.tsx:2)와 같은 판단이고, 그 주석은 뒤집지 않는다.
    //
    // ── 2026-08-13 기현님 실기 지시로 **뒤집었다** ────────────────────────────────────────
    // *"센터 중앙 x자를 … 하프코트에서도 표시"*. 위 오독 우려는 판을 만든 사람의 추측이었고,
    // 실제로 판을 쓰는 코치(기현님)가 화면을 보고 반대로 판단하셨다.
    //
    // **어디에 찍는가 — 열린 위쪽 변의 중점**(x = surface 중앙, y = surface.y). 근거:
    //  ① `HalfCourtLines` 의 외곽선 path 는 왼쪽·아래·오른쪽 **세 변만** 긋는다
    //     (`M x,y L x,y+h L x+w,y+h L x+w,y`). 위쪽 변은 그 path 에 없고 별도 `<line>` 으로
    //     그어진다 — 그 선이 곧 **하프라인**이다. 즉 이 판에도 하프라인은 있다(위 옛 주석의
    //     "하프라인이 그려지지 않는다" 는 사실이 아니었다).
    //  ② 실제 경기장에서 하프라인의 중점이 오는 자리가 바로 거기다. 골대는 아래쪽(y+h)이므로
    //     반대편 변이 중앙선이다.
    //  ③ 아래 붙은 `<line>` 과 X 가 같은 선 위에 있어야 "이 선이 중앙선" 이라는 뜻이 선다.
    //     경기면 한가운데(y + h/2)에 찍으면 그것은 하프 코트에는 없는 지점이 된다.
    // 되돌리면(= null 로) 하프 코트에서 중앙선 표시가 사라진다. CourtSurface.test.tsx 의
    // '하프에도 센터 마크가 있다' 와 courtMarks.test.ts 가 그 가드다.
    centerMark: centerMarkD({ x: HALF_SURFACE.x + HALF_SURFACE.w / 2, y: HALF_SURFACE.y }),
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
    // 라인이 하나도 없는 자유판이다 — 골대가 없으니 인크로치먼트 마크도, 하프라인이 없으니
    // 센터 마크도 없다.
    encroachMarks: [],
    // ⚠️ 2026-08-13 하프에 센터 마크를 넣을 때 **flat 은 일부러 null 로 두었다**(기현님 지시는
    //    "하프코트에서도" 였다). 근거: 이 판에는 선이 **하나도** 없다 — 외곽선도, 골 지역도,
    //    골대도 없다. 그 위에 X 하나만 뜨면 그것이 코트의 중앙인지 누가 놓은 표식인지 알 수
    //    없고, 자유 배치판의 뜻(위치 개념 설명용 빈 판) 자체가 흐려진다.
    //    되돌리려면(= flat 에도 X) "선 없는 판에서 그 X 가 무엇으로 읽히는가" 를 먼저 답해야 한다.
    centerMark: null,
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

/** 골대 뒤 **면제 구역** — 골라인 바깥 반평면 ∩ 골라인 위 6 m 구간.
 *
 *  ⚠️ 사각형(`Rect`)이 아니라 **경계값**인 이유: 바깥쪽에는 끝이 없다. 세트피스 5 m 면제는
 *  *"완전히 나가야"* 성립하는데(기현 지시 2026-08-17), 바깥을 viewBox 로 막으면 그 구역의
 *  깊이가 마진과 같은 **1.5 m** 이고 차체 길이도 **정확히 1.5 m** 라, 차체가 자로 잰 듯
 *  들어가야만 면제가 된다 — 사실상 아무도 못 받는 규칙이 된다. 골라인은 선이지 상자가 아니다. */
export interface GoalMouth {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/** 골대 뒤 면제 구역들. 세트피스 5 m 제한의 골키퍼 면제가 이 자리로 정의된다
 *  (기현 지시 2026-08-17: *"수비측 골대 사이 골라인 뒤"* → *"골대 기준이 아니라 골라인
 *  기준(6미터 고정!)"*).
 *
 *  ── 두 가지를 골라인에서 뽑는다 ────────────────────────────────────────────────────
 *  ① **깊이** — 기준은 골라인 하나다. 차체가 그 선을 **완전히 넘어가 있으면** 뒤에 있는 것이고,
 *     한 귀퉁이라도 경기면에 남아 있으면 아니다. 바깥으로 얼마나 멀리 가 있는지는 안 본다.
 *  ② **폭** — 골라인 중점 ± `GOAL_HALF_PX`(3 m), 즉 **6 m 고정**이다. 골포스트 좌표에서 재지
 *     않는다: 지시가 *"골대 기준이 아니라 골라인 기준"* 이고, 포스트는 그리는 표식이라
 *     언젠가 굵기·자리가 달라질 수 있다. 폭은 코트 3단과도 무관하다(`GOAL_HALF_PX` 머리말).
 *
 *  골포스트 배열은 **골대가 몇 개이고 어느 변에 있는가**를 아는 데만 쓴다. 모드 이름으로
 *  분기하지 않는 이유는 `goalEncroachMarks` 와 같다 — 골라인이 세로냐 가로냐는 두 포스트의
 *  좌표가 이미 말해 준다(`render/sideFlags.ts` 의 `markPlacement` 가 존을 두고 같은 판단).
 *
 *  ⚠️ 배열 순서는 `ruleZones` 와 **같다**(풀: 왼쪽·오른쪽, 하프: 하나). 진영을 입히는 규약이
 *  둘 다 같으므로, 순서가 갈리면 면제가 **상대 골대**에서 붙는다.
 *  플랫 코트는 골대가 없어 빈 배열이다. */
export function goalMouths(def: CourtDef): GoalMouth[] {
  const s = def.surface;
  const cx = s.x + s.w / 2;
  const cy = s.y + s.h / 2;
  const out: GoalMouth[] = [];
  for (let i = 0; i + 1 < def.goalPosts.length; i += 2) {
    const a = def.goalPosts[i]!;
    const b = def.goalPosts[i + 1]!;
    if (a.x === b.x) {
      // 골라인이 세로다(풀 코트의 좌·우 골대). 바깥은 경기면 중심의 반대쪽.
      const left = a.x < cx;
      out.push({
        minX: left ? -Infinity : a.x,
        maxX: left ? a.x : Infinity,
        minY: cy - GOAL_HALF_PX,
        maxY: cy + GOAL_HALF_PX,
      });
    } else {
      // 골라인이 가로다(하프 코트의 아래 골대).
      const top = a.y < cy;
      out.push({
        minX: cx - GOAL_HALF_PX,
        maxX: cx + GOAL_HALF_PX,
        minY: top ? -Infinity : a.y,
        maxY: top ? a.y : Infinity,
      });
    }
  }
  return out;
}
