// §3.9 기본값 — 포메이션·기본 캐스트·기본 배치·드릴 생성.
import { defaultDefense } from './rules.ts';
import type { Vec2 } from '../core/units.ts';
import { newId } from '../core/ids.ts';
import { radToStoredDeg, RAD } from '../core/angle.ts';
import { CHAIR_SEP_PX } from '../core/constants.ts';
import { FULL_COURT_DEFS, DEFAULT_COURT_SIZE, courtDefFor, type CourtMode, type CourtSize, type Rect } from './court.ts';
import { poseFromStored, type StoredChairPose } from './chair.ts';
import type { ChairId, BallId } from '../core/ids.ts';
import type { ChairDef, DrillCast, DrillStep, DrillLevel, DrillType, TeamSide, TeamStyle, Drill, PoseMap } from './drill.ts';
import { CURRENT_DRILL_SCHEMA } from './drill.ts';
import { chairsOverlap } from '../physics/obb.ts';

export type FormationName = '1-2-1' | '2-1-1' | '1-1-2';
export const FORMATIONS = ['1-2-1', '2-1-1', '1-1-2'] as const;

export const DEFAULT_TEAMS: Readonly<Record<TeamSide, TeamStyle>> = Object.freeze({
  home: Object.freeze({ label: '우리 팀', color: '#d93a3a', gkColor: '#f2c811' }),
  away: Object.freeze({ label: '상대', color: '#1f6bb8', gkColor: '#22a95b' }),
});

type Slot = 'G' | '2' | '3' | '4';
const SLOTS: Slot[] = ['G', '2', '3', '4'];

export function defaultCast(): DrillCast {
  const chairs: ChairDef[] = [];
  for (const team of ['home', 'away'] as const) {
    for (const number of SLOTS) {
      chairs.push({ id: newId('ch'), team, number, isGk: number === 'G' });
    }
  }
  return { chairs, balls: [{ id: newId('bl') }], cones: [] };
}

// 풀 코트 기본 배치 — 피벗 좌표(px). §3.9 표에서 **사방 +12.5 px 이동**한 값이다:
// 2026-08-10 코트 외곽 마진을 1.0 → 1.5 m 로 넓히면서 viewBox 원점 대비 경기면이 그만큼
// 밀렸다. 이걸 안 옮기면 기본 포메이션이 코트에서 0.5 m 치우친다(§3.2 court.ts 주석 참고).
const FULL_POSITIONS: Record<FormationName, Record<TeamSide, Record<Slot, Vec2>>> = {
  '1-2-1': {
    home: { G: { x: 75, y: 262.5 }, '2': { x: 322.5, y: 127.5 }, '3': { x: 322.5, y: 397.5 }, '4': { x: 364.5, y: 262.5 } },
    away: { G: { x: 750, y: 262.5 }, '2': { x: 502.5, y: 397.5 }, '3': { x: 502.5, y: 127.5 }, '4': { x: 460.5, y: 262.5 } },
  },
  '2-1-1': {
    home: { G: { x: 75, y: 262.5 }, '2': { x: 202.5, y: 262.5 }, '3': { x: 307.5, y: 181.5 }, '4': { x: 364.5, y: 262.5 } },
    away: { G: { x: 750, y: 262.5 }, '2': { x: 622.5, y: 262.5 }, '3': { x: 517.5, y: 343.5 }, '4': { x: 460.5, y: 262.5 } },
  },
  '1-1-2': {
    home: { G: { x: 75, y: 262.5 }, '2': { x: 232.5, y: 262.5 }, '3': { x: 367.5, y: 145.5 }, '4': { x: 367.5, y: 379.5 } },
    away: { G: { x: 750, y: 262.5 }, '2': { x: 592.5, y: 262.5 }, '3': { x: 457.5, y: 379.5 }, '4': { x: 457.5, y: 145.5 } },
  },
};
const FULL_BALL: Vec2 = { x: 412.5, y: 262.5 };

// 하프 코트 기본 배치 — 포메이션 무관 단일 배치. **6자리뿐이다**: 홈 GK 는 배치하지 않고
// (D7 실사용례) 상대 4번도 자리가 없다 — 하프는 공격 진영 한쪽이라 8대가 설 자리가 아니다.
// 2026-08-13(5.4): 이 줄은 원래 홈 GK 만 적고 있었는데 실제로는 away '4' 도 빠져 있었다.
// 어느 자리가 비는지는 `COURT_FILL_SPECS.half.unplaced`(fillPreset.ts)가 표로 못박고 있고,
// 여기서 한 자리를 더하거나 빼면 그 표와 어긋나 fillPreset.test.ts 가 먼저 빨개진다.
const HALF_POSITIONS: Record<TeamSide, Partial<Record<Slot, Vec2>>> = {
  home: { '2': { x: 152.5, y: 176.25 }, '3': { x: 364.5, y: 176.25 }, '4': { x: 262.5, y: 96.25 } },
  away: { G: { x: 262.5, y: 400.75 }, '2': { x: 262.5, y: 293.75 }, '3': { x: 342.5, y: 252.75 } },
};
const HALF_BALL: Vec2 = { x: 262.5, y: 133.5 };

// 플랫 코트 기본 배치 — 포메이션 무관 단일 배치.
const FLAT_X: Record<Slot, number> = { G: 112.5, '2': 212.5, '3': 312.5, '4': 412.5 };
const FLAT_POSITIONS: Record<TeamSide, Record<Slot, Vec2>> = {
  home: { G: { x: FLAT_X.G, y: 132.5 }, '2': { x: FLAT_X['2'], y: 132.5 }, '3': { x: FLAT_X['3'], y: 132.5 }, '4': { x: FLAT_X['4'], y: 132.5 } },
  away: { G: { x: FLAT_X.G, y: 317.5 }, '2': { x: FLAT_X['2'], y: 317.5 }, '3': { x: FLAT_X['3'], y: 317.5 }, '4': { x: FLAT_X['4'], y: 317.5 } },
};
const FLAT_BALL: Vec2 = { x: 262.5, y: 225 };

// ── §5.1 코트 크기 3단 — 기본 배치를 함께 옮긴다 ────────────────────────────────────────────
//
// 위 `FULL_POSITIONS` 는 **30×18(825×525) 기준 표 하나뿐**이다. 그 좌표를 25×14(700×425) 코트에
// 그대로 놓으면 선수가 라인 밖 — 심하면 판 밖 — 에 선다: 예를 들어 away GK 는 x=750 인데
// 25×14 의 경기면 오른쪽 끝은 662.5 다(87.5 px = 3.5 m 밖).
//
// 그래서 표는 한 벌만 유지하고 **경기면 사각형 사이의 비례 사상**으로 옮긴다. 세 벌을 손으로
// 적으면 포메이션을 하나 손볼 때마다 세 곳을 고쳐야 하고, 그중 하나를 빠뜨린 날 그 코트에서만
// 배치가 어긋난다(규칙 10 이 막으려는 사고와 같은 형태다).
//
// **왜 비례인가** — 포메이션은 "골라인에서 몇 m" 가 아니라 "코트를 어떻게 나눠 서는가" 다.
// 절대 거리로 옮기면 25 m 코트에서 앞뒤 간격이 그대로라 두 팀이 서로의 진영으로 밀려든다.
// 비례 사상은 경기면 → 경기면의 전단사라 **"전부 surface 안" 이 크기와 무관하게 보존된다**
// (defaults.test.ts 가 3단 × 3포메이션 × 8대를 전부 찌른다).
function scaleIntoSurface(p: Vec2, from: Rect, to: Rect): Vec2 {
  const u = (p.x - from.x) / from.w;
  const v = (p.y - from.y) / from.h;
  // 0.1 px 로 접는다 — validateDrill 9단계가 어차피 같은 자리에서 반올림한다. 여기서 안 접으면
  // 저장 직후 값과 다시 읽은 값이 부동소수 끝자리에서 달라져 sameDrill 이 '다르다' 고 본다.
  return { x: Math.round((to.x + u * to.w) * 10) / 10, y: Math.round((to.y + v * to.h) * 10) / 10 };
}

function posFor(mode: CourtMode, formation: FormationName, team: TeamSide, number: string, size: CourtSize = DEFAULT_COURT_SIZE): Vec2 | undefined {
  const slot = (SLOTS as string[]).includes(number) ? (number as Slot) : undefined;
  if (!slot) return undefined;
  if (mode === 'half') return HALF_POSITIONS[team][slot];
  if (mode === 'flat') return FLAT_POSITIONS[team][slot];
  const base = FULL_POSITIONS[formation][team][slot];
  // 기본 크기는 **표를 그대로** 돌려준다. 항등 사상을 부동소수로 계산시키면 75 가 75.00000000000001
  // 이 되어, 크기 3단을 넣었다는 이유만으로 기존 드릴의 좌표가 전부 흔들린다.
  if (size === DEFAULT_COURT_SIZE) return base;
  return scaleIntoSurface(base, FULL_COURT_DEFS[DEFAULT_COURT_SIZE].surface, courtDefFor('full', size).surface);
}

/** 기본 배치가 쓰는 슬롯 좌표 전부(§4.3 P1-3 정착 스냅 후보 ④). 팀·번호는 상관없고 **자리**만
 *  필요하므로 좌표만 모아 돌려준다. 위 표를 유일한 출처로 두기 위한 통로다 — 스냅 쪽에서
 *  좌표를 다시 적으면 포메이션을 손볼 때마다 둘이 어긋난다. */
export function formationSlots(mode: CourtMode, f: string, size?: CourtSize): Vec2[] {
  const formation: FormationName = (FORMATIONS as readonly string[]).includes(f) ? (f as FormationName) : '1-2-1';
  const out: Vec2[] = [];
  for (const team of ['home', 'away'] as const) {
    for (const slot of SLOTS) {
      const p = posFor(mode, formation, team, slot, size);
      if (p) out.push(p);
    }
  }
  return out;
}

/** 기본 배치의 공 자리. §5.4 [포메이션으로 채우기] 가 **같은 좌표**를 써야 해서 export 했다 —
 *  채우기 쪽에서 공 자리를 다시 적으면 '새 드릴' 과 '채우기' 의 공이 다른 데 놓인다. */
export function ballPosFor(mode: CourtMode, size: CourtSize = DEFAULT_COURT_SIZE): Vec2 {
  if (mode === 'half') return HALF_BALL;
  if (mode === 'flat') return FLAT_BALL;
  if (size === DEFAULT_COURT_SIZE) return FULL_BALL;
  return scaleIntoSurface(FULL_BALL, FULL_COURT_DEFS[DEFAULT_COURT_SIZE].surface, courtDefFor('full', size).surface);
}

/** 아무것도 배치되지 않은 스텝. 휠체어·공·콘 전부 미배치이므로 코트가 비어 있다.
 *  name 은 ''(2026-08-17 확정, 과제⑦) — '스텝 N' 자동 생성은 UI 가 이름 필드를 폐기하며
 *  같이 끊었다. 자동 생성 패턴이던 문자열은 사용자 내용이 아니라서 남겨봐야 정화기가
 *  이관 없이 버릴 쓰레기일 뿐이다. */
export function emptyStep(_mode: CourtMode): DrillStep {
  return { id: newId('st'), name: '', note: '', chairs: {}, balls: {}, cones: {}, arrows: [], notes: [], shapes: [] };
}

/** 시그니처를 string 으로 넓히고 내부에서 FORMATIONS 폴백한다(validate.ts 의 이중 방어와 합치). */
export function defaultStep(mode: CourtMode, f: string, cast: DrillCast, size?: CourtSize): DrillStep {
  const formation: FormationName = (FORMATIONS as readonly string[]).includes(f) ? (f as FormationName) : '1-2-1';
  const { homeHeadingDeg, awayHeadingDeg } = courtDefFor(mode, size);

  const chairs: PoseMap<ChairId, StoredChairPose> = {};
  for (const def of cast.chairs) {
    const p = posFor(mode, formation, def.team, def.number, size);
    if (!p) continue; // 예: half 코트 홈 GK — cast 에는 있고 pose 는 없다
    const headingDeg = def.team === 'home' ? homeHeadingDeg : awayHeadingDeg;
    chairs[def.id] = { x: p.x, y: p.y, angleDeg: radToStoredDeg(headingDeg * RAD) };
  }

  const balls: PoseMap<BallId, Vec2> = {};
  const ballPos = ballPosFor(mode, size);
  for (const b of cast.balls) balls[b.id] = { x: ballPos.x, y: ballPos.y };

  // name 은 ''(2026-08-17 확정, 과제⑦) — emptyStep 과 같은 근거: 자동 생성 이름은
  // 사용자 내용이 아니다.
  return {
    id: newId('st'),
    name: '',
    note: '',
    chairs,
    balls,
    cones: {},
    arrows: [],
    notes: [],
    shapes: [],
  };
}

/** 개발 모드 전용 불변식 assert(§3.9) — 두 휠체어 OBB 가 겹치면 콘솔에만 경고한다.
 *  validate.ts 와 달리 여기는 우리 자신이 만든 데이터라 절대 발생해선 안 되는 내부 버그 신호이므로
 *  throw 대신 console.assert 로 개발 중에만 드러낸다(런타임 "절대 throw 하지 않는다" 원칙은 유지). */
function assertNoOverlap(mode: CourtMode, step: DrillStep): void {
  if (!import.meta.env.DEV) return;
  const poses = Object.values(step.chairs)
    .filter((p): p is StoredChairPose => p !== undefined)
    .map(poseFromStored);
  for (let i = 0; i < poses.length; i++) {
    for (let j = i + 1; j < poses.length; j++) {
      console.assert(!chairsOverlap(poses[i]!, poses[j]!, CHAIR_SEP_PX), `[defaults] ${mode} 기본 배치에서 휠체어 OBB 겹침 발견`);
    }
  }
}

export function createDrill(init: {
  title?: string;
  courtMode: CourtMode;
  /** §5.1 코트 크기 3단. **생략하면 30×18** — §9 ② 부기("기본 코트는 30×18 을 유지")를 지키는
   *  자리다. 새 드릴은 언제나 이 키를 갖고 태어난다(교육 필드와 같은 규약). */
  courtSize?: CourtSize;
  drillType?: DrillType;
  level?: DrillLevel;
  formation?: FormationName;
  durationMin?: number;
  teams?: Record<TeamSide, TeamStyle>;
  /** 코트를 **비운 채** 만든다(§6.8 자유 전술판, 2026-08-10 기현 지시).
   *
   *  전술판에서는 기본 포메이션이 의미가 없다 — 무엇을 그릴지 모르는 빈 판에 8대가 미리
   *  깔려 있으면 매번 치우는 일부터 해야 한다. 선수는 명단(인스펙터)에 남아 있어 하나씩
   *  놓을 수 있고, 공·콘은 도구로 새로 만든다.
   *
   *  ⚠️ 공은 cast 에서도 뺀다. 미배치인 채 cast 에만 남으면 어떤 UI 로도 놓을 수 없는데
   *  (공 도구는 addBall 로 **새** 공을 만든다) 공 10개 상한에는 계속 잡힌다 — 놓지도 못하는
   *  유령이 한 자리를 먹는다. */
  empty?: boolean;
}): Drill {
  const now = Date.now();
  const cast = defaultCast();
  if (init.empty) cast.balls = [];
  const formation = init.formation ?? '1-2-1';
  const courtSize = init.courtSize ?? DEFAULT_COURT_SIZE;
  const teams = structuredClone(init.teams ?? DEFAULT_TEAMS);
  const step = init.empty ? emptyStep(init.courtMode) : defaultStep(init.courtMode, formation, cast, courtSize);
  assertNoOverlap(init.courtMode, step);
  return {
    schemaVersion: CURRENT_DRILL_SCHEMA,
    id: newId('dr'),
    title: init.title ?? '새 드릴',
    // v8 — 기본 유형은 'technical'. 개인기부터 시작하는 새 드릴이 가장 흔하고, validate 의
    // 폴백과 같은 값이라야 "마이그레이션을 지난 드릴"과 "새 드릴"이 갈라지지 않는다.
    drillType: init.drillType ?? 'technical',
    level: init.level ?? '초급',
    durationMin: init.durationMin ?? 10,
    tags: [],
    // §3.2 교육 필드 — 새 드릴도 **키를 갖고 태어난다**(옛 파일은 DRILL_MIGRATIONS v1→v2 가
    // 같은 값으로 채운다). 숫자 0 은 '미지정' 이다 — drill.ts 주석 참고.
    // (훈련량 reps/sets/intervalSec 는 v8 폐기 — situation/variation 은 미지정 = 키 없음이라
    //  여기서 채우지 않는다)
    objective: '',
    coachingPoints: [],
    playersNeeded: 0,
    equipment: '',
    courtMode: init.courtMode,
    courtSize,
    // 진영(2026-08-15). 기본값은 **이 파일의 기본 배치 GK 자리**에서 나온다 — 풀은 홈 GK 가
    // 왼쪽 골(x=75 = ruleZones[0]), 하프는 원정 GK 만 놓인다. 즉 새 드릴의 진영은 놓여 있는
    // 골키퍼와 처음부터 일치한다(`defaultDefense` 가 그 근거를 갖는다).
    defense: defaultDefense(init.courtMode),
    formation,
    teams,
    cast,
    steps: [step],
    createdAt: now,
    updatedAt: now,
  };
}

/** §3.10 코트 전환. half↔flat 은 viewBox 동일(525×450)이므로 항등 변환. full↔(half|flat) 은
 *  규격·종횡비가 달라 배치를 보존할 수 없으므로 defaultStep 으로 명시적으로 리셋한다.
 *
 *  §5.1 이후 **크기 전환(30×18 ↔ 28×15 ↔ 25×14)도 같은 문 하나로 지나간다.** 크기를 바꾸면
 *  viewBox 가 통째로 달라지고(825×525 → 700×425) 종횡비까지 달라지므로(1.667 → 1.786),
 *  '풀 → 풀' 이라도 배치는 보존할 수 없다 — 모드 전환과 정확히 같은 이유다.
 *  ⚠️ 좌표를 비례로 늘려 옮기는 길은 **택하지 않았다**: 화살표·메모·콘까지 전부 같은 사상을
 *  받아야 하고, 그중 하나(예: 화살표 ctrl)를 빠뜨리면 궤적만 어긋난 판이 조용히 만들어진다.
 *  기본 배치(defaults)는 비례로 옮기지만 그것은 **우리가 만든 8개 좌표**라 전수 단언이 가능하다.
 *
 *  `size` 를 생략하면 드릴이 들고 있던 크기를 그대로 유지한다 — 하프로 갔다가 풀로 돌아와도
 *  고른 코트가 살아 있다. */
export function cloneToCourt(d: Drill, mode: CourtMode, size?: CourtSize): Drill {
  const nextSize = size ?? d.courtSize ?? DEFAULT_COURT_SIZE;
  const prevSize = d.courtSize ?? DEFAULT_COURT_SIZE;
  // full 이 아닌 코트에서는 크기가 판을 바꾸지 않으므로 '전환' 이 아니다(들고만 다닌다).
  const sizeChanged = nextSize !== prevSize && (mode === 'full' || d.courtMode === 'full');
  if (d.courtMode === mode && !sizeChanged) return d;
  const now = Date.now();
  const isHalfFlat = (m: CourtMode): boolean => m === 'half' || m === 'flat';

  if (isHalfFlat(d.courtMode) && isHalfFlat(mode)) {
    return { ...structuredClone(d), id: newId('dr'), courtMode: mode, courtSize: nextSize, createdAt: now, updatedAt: now };
  }

  const cast = structuredClone(d.cast);
  const teams = structuredClone(d.teams);
  const step = defaultStep(mode, d.formation, cast, nextSize);
  // ⚠️ 이 함수는 지금 실사용 호출부가 없다(BoardScreen 은 일부러 안 쓴다 — 그 파일의 ⚠️ 주석).
  //    UI 로케일에 닿을 길이 없으므로 defaultPhase() 와 같은 이유로 'ko' 고정만 해 둔다.
  const suffix = mode === 'full' ? ` (풀 ${courtDefFor('full', nextSize).dims.ko})` : mode === 'half' ? ' (하프)' : ' (플랫)';
  const prefix = '[코트 전환 — 배치를 다시 만들어야 합니다] ';
  return {
    ...d,
    id: newId('dr'),
    title: `${d.title}${suffix}`,
    description: `${prefix}${d.description ?? ''}`.trim(),
    courtMode: mode,
    courtSize: nextSize,
    teams,
    cast,
    steps: [step],
    createdAt: now,
    updatedAt: now,
  };
}
