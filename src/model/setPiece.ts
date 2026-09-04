// §5.4 C-2 — **세트피스 시작 배치 프리셋**(킥인 · 코너킥 · 골 클리어런스).
//
// ── 프리셋이 정하는 것과 정하지 않는 것 ─────────────────────────────────────────────────
// 이 프리셋은 **규정이 정하는 것만** 놓는다: 공의 자리 · 키커 · 상대의 최소 이격선(5 m).
// 공격 배치는 규정이 아니라 전술이므로 **기본 포메이션 그대로 둔다**(코치가 끌어서 만든다).
// 규칙을 잘못 가르치지 않는 것이 이 판의 목적이라는 rules.ts 머리말과 같은 기준이다.
//
// ── 이격 거리의 **기준점이 상황마다 다르다** (FIPFA Laws 2025) ────────────────────────────
// 2ndBrain『FIPFA 공식 규격 (2025) — SPIN 대조』§4 표를 그대로 옮긴다:
//
//   | 상황        | 조항    | 기준점        |
//   | 킥오프      | Law 8  | 공            |
//   | 프리킥      | Law 13 | 공            |
//   | 페널티킥    | Law 14 | **페널티 마크** |
//   | 킥인        | Law 15 | 공            |
//   | 골킥(클리어)| Law 16 | 공            |
//   | 코너킥      | Law 17 | **코너 삼각형** (골 지역 안 수비수는 예외 — 1 m 마크 뒤)
//
// ⚠️ *"5 m 원 하나"* 로 뭉치면 **코너킥과 페널티킥에서 틀린다**(대조 노트가 이것을 콕 집어
//    경고한다). 그래서 `SET_PIECE_DEFS[kind].ref` 가 기준점의 **종류**를 들고 다니고,
//    코너킥은 공이 아니라 **코너 꼭짓점**에서 5 m 를 잰다. 코너 삼각형의 무게중심에 놓인 공은
//    꼭짓점에서 0.47 m 떨어져 있으므로 두 기준은 실제로 **다른 답**을 낸다 —
//    setPiece.test.ts 의 '코너킥의 5 m 는 공이 아니라 코너에서 잰다' 가 그 차이를 잰다
//    (공 기준으로 재면 통과하지 못하는 수비수가 실재한다).
//
// 세트볼(Law 8): 관여 선수 외 **모든** 선수는 공에서 3 m 이상. 그래서 키커가 아닌 우리 팀도
// 공에서 3 m 밖으로 민다 — 이 값은 rules.ts 의 `RING_R_PX`(2-on-1 판정 반경)와 같은 3 m 라
// 그 상수를 그대로 쓴다. 두 곳에 3 m 를 적으면 한쪽만 고쳐지는 날이 온다.
//
// ── 좌표의 출처 (규칙 10) ────────────────────────────────────────────────────────────────
// 새 좌표 리터럴이 **0개**다. 공 자리는 `surface`(킥인) · `cornerCuts`+surface 꼭짓점(코너킥) ·
// `spotMarks`(골 클리어런스)에서, 골대·골 지역은 `goalPosts`·`ruleZones` 에서 파생한다.
// 그래서 코트 크기 3단(5.1)이 저절로 따라온다 — 세 크기에서 전수로 잰다.
import { BALL, CHAIR } from '../core/constants.ts';
import { mToPx, type Vec2 } from '../core/units.ts';
import { RAD, radToStoredDeg } from '../core/angle.ts';
import type { ChairId } from '../core/ids.ts';
import type { Locale } from '../i18n/locale.ts';
import { courtDefFor, type CourtDef, type CourtMode, type Rect } from './court.ts';
import { defaultStep } from './defaults.ts';
import { inRect, RING_R_PX } from './rules.ts';
import { chairsOverlap } from '../physics/obb.ts';
import type { Drill, PoseMap, TeamSide } from './drill.ts';
import { poseFromStored, type ChairPose, type StoredChairPose } from './chair.ts';
import type { PlacementPlan } from './fillPreset.ts';

export type SetPieceKind = 'kickIn' | 'corner' | 'goalClearance';
export const SET_PIECE_KINDS = ['kickIn', 'corner', 'goalClearance'] as const;

/** 5 m 이격을 **어디서 재는가**. 값이 두 종류라는 것 자체가 이 파일의 요점이다. */
export type SetPieceRef = 'ball' | 'cornerTriangle';

export interface SetPieceDef {
  label: Record<Locale, string>;
  /** 근거 조항. 화면 문구가 이 값을 그대로 읽는다 — 코치가 규정을 되짚을 수 있어야 한다.
   *  'Law 15' 형태의 조항 번호라 언어를 안 탄다(로케일별 번역이 없다). */
  law: string;
  ref: SetPieceRef;
  /** 한 줄 설명(무엇이 어디에 서는가). */
  desc: Record<Locale, string>;
}

export const SET_PIECE_DEFS: Record<SetPieceKind, SetPieceDef> = {
  kickIn: {
    label: { ko: '킥인', en: 'Kick-in', ja: 'キックイン' },
    law: 'Law 15',
    ref: 'ball',
    desc: {
      ko: '터치라인 위의 공에서 상대가 5 m 물러섭니다.',
      en: 'The opponent retreats 5m from the ball on the touchline.',
      ja: 'タッチライン上のボールから相手は5m下がります。',
    },
  },
  corner: {
    label: { ko: '코너킥', en: 'Corner kick', ja: 'コーナーキック' },
    law: 'Law 17',
    ref: 'cornerTriangle',
    // ⚠️ 'ball' 로 바꾸면 코너 삼각형이 아니라 공에서 재게 된다 — 규정이 아니다.
    desc: {
      ko: '코너 삼각형에서 상대가 5 m 물러섭니다(공 기준이 아닙니다).',
      en: 'The opponent retreats 5m from the corner triangle (not measured from the ball).',
      ja: 'コーナートライアングルから相手は5m下がります(ボール基準ではありません)。',
    },
  },
  goalClearance: {
    label: { ko: '골 클리어런스', en: 'Goal clearance', ja: 'ゴールクリアランス' },
    law: 'Law 16',
    ref: 'ball',
    desc: {
      ko: '골 지역 안의 공에서 상대가 5 m 물러섭니다.',
      en: 'The opponent retreats 5m from the ball inside the goal area.',
      ja: 'ゴールエリア内のボールから相手は5m下がります。',
    },
  },
};

/** 세트피스 이격 거리 5 m. 킥오프·프리킥·킥인·골킥·페널티킥·코너킥이 전부 5 m 다 —
 *  다른 것은 거리가 아니라 **어디서 재는가** 다(머리말 표). */
export const CLEAR_PX = mToPx(5);

/** 저장 반올림(0.1 px) 보정. 좌표를 0.1 로 접으면 두 점 사이 거리가 최대 0.0707 px 줄어드는데,
 *  규정 거리에 **정확히** 세우면 저장된 값이 미달이 된다 — 실측(2026-08-13): 25×14 킥인에서
 *  5 m 자리 2명이 4.997 m 로, 키커의 공-가드 간격이 2.000 → 1.975 px 로 떨어졌다.
 *  그래서 규정에서 파생한 반지름·거리는 전부 이만큼 **바깥으로** 민다. */
const ROUND_EPS_PX = 0.1;

/** 공을 마주 본 휠체어의 피벗 거리. 가드 앞면(pivotToFrontPx 30) + 공 반지름(4.125) + 2 px 여유
 *  — 2 px 는 defaults.test.ts 가 기본 배치에 요구하는 '공 표면 ↔ 가드 ≥ 2px' 와 같은 값이다.
 *
 *  ⚠️ **키커는 라인 밖이 아니라 코트 안에 세운다.** court.ts 머리말은 마진을 1.5 m 로 넓힌
 *  이유를 *"라인 밖 배치에 휠체어(1.5 m)가 온전히 서려면"* 이라고 적는데, 실측하면 그것은
 *  **딱 맞아떨어질 뿐 공까지 물릴 여유는 없다**: 라인 밖에 세우려면 피벗이 라인에서 최대
 *  30 px(=마진 37.5 − 뒤축 7.5)여야 하는데, 공을 가드 앞에 두려면 36.225 px 이 필요하다.
 *  둘이 6.2 px 어긋나므로 '라인 밖 + 공을 가드 앞에' 는 이 코트에서 성립하지 않는다.
 *  라인 밖에 세우면 뒤축이 viewBox 를 넘고, 물리가 경계 안으로 밀어 넣으면서 공을 걷어찬다. */
const KICKER_GAP_PX = CHAIR.pivotToFrontPx + BALL.radiusPx + 2 + ROUND_EPS_PX;

const ARC_STEP_DEG = 3;
/** 원호 탐색 상한 — ±360°. **무한 while 금지**(반증이 행으로 죽으면 안 된다). */
const ARC_MAX_STEPS = 120;
/** 겹침 판정 여유. defaults.test.ts 가 기본 배치에 요구하는 값과 같은 4 px 다.
 *
 *  ⚠️ **피벗 사이 거리로 대신하면 안 된다.** 실측(2026-08-13): 마주 보는 두 대는 피벗이
 *  41.5 px 떨어져 있어도 가드가 18.5 px 파고든다(앞 30 + 앞 30 = 60 이 필요하다). 그래서
 *  후보 자리는 물리의 OBB 판정(`chairsOverlap`)으로 거른다 — 원호에 선 사람끼리만이 아니라
 *  **판에 이미 서 있는 전원**과 대조한다(하프 골클리어런스에서 실제로 2쌍이 겹쳤다). */
const OVERLAP_MARGIN_PX = 4;
/** 수비 원호의 벌림 폭(중심 방향 ±). 3대가 90° 에 서면 현(chord)이 95.7 px 다. */
const ARC_SPREAD_DEG = 45;

const round1 = (v: number): number => Math.round(v * 10) / 10;
const dist = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y);
const unit = (from: Vec2, to: Vec2): Vec2 => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  return len < 1e-9 ? { x: 1, y: 0 } : { x: dx / len, y: dy / len };
};
const faceDeg = (from: Vec2, to: Vec2): number => radToStoredDeg(Math.atan2(to.y - from.y, to.x - from.x));
const centerOf = (r: Rect): Vec2 => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

/** path `d` 의 좌표쌍. snapOnSettle.ts 와 같은 규약의 파서다 — `cornerCuts` 는 문자열이므로
 *  점이 필요하면 여기를 지난다. 좌표를 이 파일에 다시 적지 않기 위한 유일한 길이다. */
function pathPoints(d: string): Vec2[] {
  const nums = d.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  const out: Vec2[] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) out.push({ x: nums[i]!, y: nums[i + 1]! });
  return out;
}

interface GoalInfo {
  /** 골대 중점(골라인 위). */
  center: Vec2;
  /** 골라인 **밖** 단위벡터(±x 또는 ±y). */
  outward: Vec2;
  /** 이 골대의 골 지역. */
  area: Rect | null;
  /** 이 골대를 지키는 팀 — **기본 배치의 GK 자리**로 정한다(지금 판이 어떻든 상관없다). */
  defender: TeamSide | null;
}

/** 골포스트 배열을 골대 단위로 묶는다. court.ts 가 좌·우(또는 하나) 골대의 포스트를
 *  **2개씩 이어서** 담으므로 그 규약을 그대로 읽는다. */
function goalsOf(def: CourtDef, gkSlots: Partial<Record<TeamSide, Vec2>>): GoalInfo[] {
  const s = def.surface;
  const mid = centerOf(s);
  const out: GoalInfo[] = [];
  for (let i = 0; i + 1 < def.goalPosts.length; i += 2) {
    const a = def.goalPosts[i]!;
    const b = def.goalPosts[i + 1]!;
    const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    // 포스트 둘은 골라인 **위**에 있다 — 둘이 벌어진 축이 골라인의 방향이고, 골라인 밖은
    // 그 수직 방향이다. 좌표 리터럴 없이 코트 크기 3단·하프 코트를 한 식으로 덮는다.
    const alongY = Math.abs(a.y - b.y) > Math.abs(a.x - b.x);
    const outward: Vec2 = alongY
      ? { x: Math.sign(center.x - mid.x) || 1, y: 0 }
      : { x: 0, y: Math.sign(center.y - mid.y) || 1 };
    let area: Rect | null = null;
    let best = Infinity;
    for (const z of def.ruleZones) {
      const d = dist(centerOf(z), center);
      if (d < best) {
        best = d;
        area = z;
      }
    }
    let defender: TeamSide | null = null;
    let bestGk = Infinity;
    for (const team of ['home', 'away'] as const) {
      const p = gkSlots[team];
      if (!p) continue;
      const d = dist(p, center);
      if (d < bestGk) {
        bestGk = d;
        defender = team;
      }
    }
    out.push({ center, outward, area, defender });
  }
  return out;
}

/** 세트피스 한 벌의 **기하**. 배치를 만들기 전에 이것만 따로 볼 수 있어야 단언이 닿는다. */
export interface SetPieceGeometry {
  kind: SetPieceKind;
  /** 5 m 를 재는 기준점. 코너킥만 공과 다르다. */
  ref: Vec2;
  ball: Vec2;
  /** 재개하는 팀(키커 쪽). */
  restart: TeamSide;
  /** 물러서는 팀. */
  guard: TeamSide;
  /** 수비가 늘어설 원호의 중심 방향(ref 기준). 자기 골대 쪽 — 없으면 경기면 중앙 쪽. */
  guardDir: Vec2;
  /** 키커 피벗. */
  kick: Vec2;
}

const other = (t: TeamSide): TeamSide => (t === 'home' ? 'away' : 'home');

/** 기본 배치의 GK 자리(팀별). 골대의 주인을 정하는 유일한 근거다. */
function gkSlotsOf(d: Drill): Partial<Record<TeamSide, Vec2>> {
  const base = defaultStep(d.courtMode, d.formation, d.cast, d.courtSize);
  const out: Partial<Record<TeamSide, Vec2>> = {};
  for (const c of d.cast.chairs) {
    if (!c.isGk) continue;
    const p = base.chairs[c.id];
    if (p) out[c.team] = { x: p.x, y: p.y };
  }
  return out;
}

/** 이 코트에서 세울 수 있는 세트피스. **플랫 코트는 0개다** — 라인이 하나도 없는 자유판이라
 *  터치라인·코너 삼각형·골 지역이 전부 없고, 기준점이 없는 이격 거리는 그릴 수 없다. */
export function setPieceKindsFor(mode: CourtMode): SetPieceKind[] {
  // 크기 인자가 없다 — 세 크기는 같은 라인을 갖고 있고 **개수만 코트 모드가 정한다**
  // (골대 4/2/0 · 코너컷 4/2/0 · 골 지역 2/1/0). 크기를 넣어도 답이 같다.
  const def = courtDefFor(mode);
  return SET_PIECE_KINDS.filter((k) => {
    if (k === 'corner') return def.cornerCuts.length > 0 && def.goalPosts.length > 0;
    if (k === 'goalClearance') return def.spotMarks.length > 0 && def.ruleZones.length > 0 && def.goalPosts.length > 0;
    return def.goalPosts.length > 0; // 킥인 — 터치라인이 어느 변인지는 골라인이 정한다
  });
}

/** 세트피스 기하. 코트가 그 세트피스를 갖고 있지 않으면 null(플랫 코트). */
export function setPieceGeometry(d: Drill, kind: SetPieceKind): SetPieceGeometry | null {
  if (!setPieceKindsFor(d.courtMode).includes(kind)) return null;
  const def = courtDefFor(d.courtMode, d.courtSize);
  const s = def.surface;
  const mid = centerOf(s);
  const goals = goalsOf(def, gkSlotsOf(d));
  if (goals.length === 0) return null;

  // 홈이 지키는 골대 / 홈이 공격하는 골대. 하프 코트는 골대가 하나뿐이고 그 주인은 상대다
  // (HALF_POSITIONS 가 away GK 만 골문에 세운다) — 그래서 홈은 언제나 '공격하는 쪽' 이 된다.
  const homeGoal = goals.find((g) => g.defender === 'home') ?? null;
  const attacked = goals.find((g) => g.defender !== 'home') ?? goals[0]!;

  if (kind === 'goalClearance') {
    // 골 클리어런스는 **그 골대를 지키는 팀**이 찬다. 홈이 지키는 골대가 있으면 그것(풀 코트),
    // 없으면 판에 있는 골대(하프 코트 → 상대가 찬다). 규칙 하나로 두 코트를 덮는다.
    const goal = homeGoal ?? goals[0]!;
    const restart = goal.defender ?? 'home';
    // 공은 골 지역 **안**이면 어디든 되지만(Law 16), 판에 이미 있는 점을 쓴다: 페널티 마크는
    // 골라인에서 3.5 m 이고 골 지역 깊이는 5 m 라 **골 지역 안**이다(대조 노트 §1 표).
    const ball = nearestSpot(def, goal.center);
    const kick = { x: ball.x + goal.outward.x * KICKER_GAP_PX, y: ball.y + goal.outward.y * KICKER_GAP_PX };
    const guard = other(restart);
    const guardGoal = goals.find((g) => g.defender === guard) ?? null;
    return { kind, ref: ball, ball, restart, guard, guardDir: unit(ball, guardGoal?.center ?? mid), kick };
  }

  if (kind === 'corner') {
    const restart = other(attacked.defender ?? 'away');
    const { vertex, ball } = cornerAt(def, attacked);
    // 키커는 코너 대각선을 따라 **코트 안쪽**에서 공을 마주 본다(라인 밖이 안 되는 이유는
    // KICKER_GAP_PX 주석 참고).
    const inward = unit(vertex, mid);
    const kick = { x: ball.x + inward.x * KICKER_GAP_PX, y: ball.y + inward.y * KICKER_GAP_PX };
    const guard = other(restart);
    const guardGoal = goals.find((g) => g.defender === guard) ?? attacked;
    // ⚠️ ref 는 **공이 아니라 꼭짓점**이다(Law 17). 두 점은 0.47 m 다르고, 그 차이가 실제로
    //    수비 한 명의 합법/불법을 가른다 — setPiece.test.ts 가 그 사람을 지목한다.
    return { kind, ref: vertex, ball, restart, guard, guardDir: unit(vertex, guardGoal.center), kick };
  }

  // 킥인 — 공은 터치라인 위. 터치라인은 골라인과 **수직인** 두 변이다(풀: 위·아래, 하프: 좌·우).
  // 어느 쪽인지는 대칭이라 아무 쪽이나 같은 그림이므로 좌표가 작은 변으로 고정한다.
  //
  // 차는 팀은 **우리 팀**이다. 킥인은 코너킥·골 클리어런스와 달리 골대가 정해 주는 것이 없어
  // (공이 나간 쪽이 정한다) 판이 스스로 고를 근거가 없다 — 그래서 판을 짜는 사람 쪽으로
  // 고정하고, 상대 킥인을 세우려면 코치가 두 팀을 바꿔 끌면 된다.
  const restart: TeamSide = 'home';
  const guard = other(restart);
  const vertical = attacked.outward.x !== 0; // 골라인이 세로 → 터치라인은 가로
  const ball = vertical ? { x: mid.x, y: s.y } : { x: s.x, y: mid.y };
  const inward = unit(ball, mid);
  const kick = { x: ball.x + inward.x * KICKER_GAP_PX, y: ball.y + inward.y * KICKER_GAP_PX };
  const guardGoal = goals.find((g) => g.defender === guard) ?? attacked;
  return { kind, ref: ball, ball, restart, guard, guardDir: unit(ball, guardGoal.center), kick };
}

/** 이 골대 쪽 페널티 마크. `spotMarks` 가 유일한 출처다(3.5 m 를 여기서 다시 적지 않는다). */
function nearestSpot(def: CourtDef, goalCenter: Vec2): Vec2 {
  let best = def.spotMarks[0]!;
  for (const p of def.spotMarks) if (dist(p, goalCenter) < dist(best, goalCenter)) best = p;
  return best;
}

/** 공격하는 골대 쪽 코너 하나. 꼭짓점은 경기면 모서리, 공은 **코너 삼각형의 무게중심**이다
 *  (삼각형 = 꼭짓점 + `cornerCuts` 의 두 끝점). 공을 꼭짓점에 딱 올려 두면 '코너 기준' 과
 *  '공 기준' 이 같은 점이 되어 Law 17 의 요점이 테스트로 확인 불가능해진다. */
function cornerAt(def: CourtDef, goal: GoalInfo): { vertex: Vec2; ball: Vec2 } {
  const s = def.surface;
  const corners: Vec2[] = [
    { x: s.x, y: s.y },
    { x: s.x + s.w, y: s.y },
    { x: s.x + s.w, y: s.y + s.h },
    { x: s.x, y: s.y + s.h },
  ];
  // 공격하는 골대의 골라인 위에 있는 두 모서리 중 좌표가 작은 쪽(위 → 왼쪽). 대칭이라
  // 어느 쪽이든 같은 그림이고, 코치는 끌어서 반대쪽으로 옮긴다.
  const onGoalLine = corners.filter((c) =>
    goal.outward.x !== 0 ? Math.abs(c.x - goal.center.x) < 1e-6 : Math.abs(c.y - goal.center.y) < 1e-6,
  );
  const pool = onGoalLine.length > 0 ? onGoalLine : corners;
  const vertex = pool.reduce((a, b) => (a.y !== b.y ? (a.y < b.y ? a : b) : a.x <= b.x ? a : b));
  // 이 꼭짓점에 붙은 코너컷(끝점 둘이 모두 1 m 이내).
  let ends: Vec2[] = [];
  let best = Infinity;
  for (const d of def.cornerCuts) {
    const pts = pathPoints(d);
    if (pts.length < 2) continue;
    const far = Math.max(...pts.map((p) => dist(p, vertex)));
    if (far < best) {
      best = far;
      ends = pts;
    }
  }
  if (ends.length < 2) return { vertex, ball: vertex };
  const tri = [vertex, ...ends];
  return {
    vertex,
    ball: { x: tri.reduce((a, p) => a + p.x, 0) / tri.length, y: tri.reduce((a, p) => a + p.y, 0) / tri.length },
  };
}

/** 원호 위에서 **경기면 안**이면서 이미 선 사람과 겹치지 않는 가장 가까운 각을 찾는다.
 *  못 찾으면 null — 호출자가 기존 자리를 지킨다(강제로 밀어 넣어 코트 밖에 세우지 않는다).
 *
 *  경기면 안을 요구하는 것으로 **viewBox 안**이 공짜로 따라온다: 마진 1.5 m(37.5 px)가
 *  차체 hull 반지름(27.86 px)보다 크기 때문이다. 그 부등식이 깨지면 setPiece.test.ts 의
 *  'hull 이 viewBox 안' 이 먼저 빨개진다. */
function placeOnArc(
  ref: Vec2,
  r: number,
  desiredRad: number,
  surface: Rect,
  face: Vec2,
  occupied: readonly ChairPose[],
): Vec2 | null {
  for (let k = 0; k <= ARC_MAX_STEPS; k++) {
    for (const sign of k === 0 ? [1] : [1, -1]) {
      const a = desiredRad + sign * k * ARC_STEP_DEG * RAD;
      const p = { x: ref.x + r * Math.cos(a), y: ref.y + r * Math.sin(a) };
      if (!inRect(surface, p.x, p.y)) continue;
      const pose: ChairPose = { x: p.x, y: p.y, theta: Math.atan2(face.y - p.y, face.x - p.x) };
      if (occupied.some((q) => chairsOverlap(pose, q, OVERLAP_MARGIN_PX))) continue;
      return p;
    }
  }
  return null;
}

/**
 * 세트피스 시작 배치. 코트가 그 세트피스를 갖고 있지 않으면 null(플랫 코트).
 *
 * 놓는 규칙 — **규정이 정하는 것만**:
 *  1. 공을 규정 자리에 놓는다(터치라인 / 코너 삼각형 / 골 지역).
 *  2. 재개하는 팀에서 **공에 가장 가까운 필드 플레이어**(골 클리어런스는 GK)를 키커로 삼아
 *     공을 마주 보게 세운다.
 *  3. 상대 필드 플레이어는 기준점에서 **정확히 5 m** 인 원호에 세운다 — 이 프리셋의 목적이
 *     *"어디서부터 시작할 수 있는가"* 를 보여주는 것이기 때문이다. 더 물러선 배치는 코치가
 *     끌어서 만든다. 상대 **GK 는 골문에 남긴다**(기본 배치의 GK 는 세 크기 전부에서 이미
 *     5 m 밖이다 — setPiece.test.ts 가 그 실측을 붙잡는다).
 *  4. 키커가 아닌 우리 팀은 공에서 3 m 밖으로 민다(Law 8 세트볼).
 *  5. 나머지는 기본 포메이션 그대로 — 공격 배치는 규정이 아니라 전술이다.
 */
export function setPiecePlan(d: Drill, kind: SetPieceKind): PlacementPlan | null {
  const geom = setPieceGeometry(d, kind);
  if (!geom) return null;
  const def = courtDefFor(d.courtMode, d.courtSize);
  const base = defaultStep(d.courtMode, d.formation, d.cast, d.courtSize);
  const chairs: PoseMap<ChairId, StoredChairPose> = {};
  for (const [id, p] of Object.entries(base.chairs)) if (p) chairs[id as ChairId] = { ...p };

  // ── 2. 키커 ──────────────────────────────────────────────────────────────────────
  const placedOf = (team: TeamSide, gk: boolean | null) =>
    d.cast.chairs.filter((c) => c.team === team && (gk === null || c.isGk === gk) && chairs[c.id] !== undefined);
  const kickerPool = kind === 'goalClearance' ? placedOf(geom.restart, true) : placedOf(geom.restart, false);
  const fallbackPool = kickerPool.length > 0 ? kickerPool : placedOf(geom.restart, null);
  let kickerId: ChairId | null = null;
  let bestD = Infinity;
  for (const c of fallbackPool) {
    const p = chairs[c.id]!;
    const dd = dist(p, geom.ball);
    if (dd < bestD) {
      bestD = dd;
      kickerId = c.id;
    }
  }
  // ⚠️ `geom.kick` 은 이미 반올림 보정을 포함한다(KICKER_GAP_PX) — 0.1 px 로 접으면 공-가드
  //    간격이 2.000 → 1.975 로 떨어져 defaults 의 불변식(≥2 px)을 깬다(2026-08-13 실측).
  if (kickerId) chairs[kickerId] = { x: round1(geom.kick.x), y: round1(geom.kick.y), angleDeg: faceDeg(geom.kick, geom.ball) };

  // ── 3. 우리 팀(키커 제외)은 공에서 3 m 밖 (Law 8 세트볼) ────────────────────────
  //     ⚠️ **원호보다 먼저** 민다. 순서를 뒤집으면 원호에 세운 수비가 '아직 안 밀린' 우리
  //     선수 자리를 피해 서고, 그 뒤 그 선수가 밀려 나오며 겹친다(하프 골클리어런스에서
  //     실제로 2쌍이 겹쳤다 — 2026-08-13 실측).
  for (const c of d.cast.chairs) {
    if (c.team !== geom.restart || c.id === kickerId) continue;
    const p = chairs[c.id];
    if (!p) continue;
    if (dist(p, geom.ball) >= RING_R_PX) continue;
    const u = unit(geom.ball, p);
    const q = { x: geom.ball.x + u.x * (RING_R_PX + ROUND_EPS_PX), y: geom.ball.y + u.y * (RING_R_PX + ROUND_EPS_PX) };
    chairs[c.id] = { x: round1(q.x), y: round1(q.y), angleDeg: p.angleDeg };
  }

  // ── 4. 상대는 5 m 원호에 ────────────────────────────────────────────────────────
  const guards = d.cast.chairs.filter((c) => c.team === geom.guard && chairs[c.id] !== undefined);
  const outfield = guards.filter((c) => !c.isGk);
  const movingIds = new Set<string>(outfield.map((c) => c.id));
  // 아직 안 옮긴 원호 대상은 피할 필요가 없다(어차피 자리를 뜬다). 나머지 전원은 피한다.
  const occupied = (): ChairPose[] =>
    d.cast.chairs
      .filter((c) => !movingIds.has(c.id) && chairs[c.id] !== undefined)
      .map((c) => poseFromStored(chairs[c.id]!));

  const centerRad = Math.atan2(geom.guardDir.y, geom.guardDir.x);
  const spread = outfield.length > 1 ? (ARC_SPREAD_DEG * 2) / (outfield.length - 1) : 0;
  outfield.forEach((c, i) => {
    const desired = centerRad + (outfield.length > 1 ? (-ARC_SPREAD_DEG + spread * i) * RAD : 0);
    const p = placeOnArc(geom.ref, CLEAR_PX + ROUND_EPS_PX, desired, def.surface, geom.ball, occupied());
    // 자리를 잡았든 못 잡았든(=기본 배치에 남든) 이 사람의 위치는 여기서 확정이다 —
    // 다음 사람이 피해야 할 대상 목록에 반드시 들어가야 한다.
    movingIds.delete(c.id);
    if (!p) return; // 자리를 못 찾으면 기본 배치 그대로 둔다(코트 밖에 세우지 않는다)
    chairs[c.id] = { x: round1(p.x), y: round1(p.y), angleDeg: faceDeg(p, geom.ball) };
  });
  // 상대 GK: 이미 5 m 밖이면 골문에 남긴다(세 크기 전부에서 실제로 그렇다 — 실측 7.11~25.00 m).
  // 안쪽이면 제자리에서 가장 가까운 원호 자리로 민다.
  for (const c of guards) {
    if (!c.isGk) continue;
    const p = chairs[c.id]!;
    if (dist(p, geom.ref) >= CLEAR_PX) continue;
    movingIds.add(c.id);
    const pushed = placeOnArc(
      geom.ref,
      CLEAR_PX + ROUND_EPS_PX,
      Math.atan2(p.y - geom.ref.y, p.x - geom.ref.x),
      def.surface,
      geom.ball,
      occupied(),
    );
    movingIds.delete(c.id);
    if (!pushed) continue;
    chairs[c.id] = { x: round1(pushed.x), y: round1(pushed.y), angleDeg: faceDeg(pushed, geom.ball) };
  }

  return { chairs, ball: { x: round1(geom.ball.x), y: round1(geom.ball.y) } };
}
