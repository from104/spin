// §3.9 기본값 — 포메이션·기본 캐스트·기본 배치·드릴 생성.
import type { Vec2 } from '../core/units.ts';
import { newId } from '../core/ids.ts';
import { radToStoredDeg, RAD } from '../core/angle.ts';
import { KNOWN_CATEGORIES } from '../core/colors.ts';
import { CHAIR_SEP_PX } from '../core/constants.ts';
import { COURT_DEFS, type CourtMode } from './court.ts';
import { poseFromStored, type StoredChairPose } from './chair.ts';
import type { ChairId, BallId } from '../core/ids.ts';
import type { ChairDef, DrillCast, DrillStep, DrillLevel, TeamSide, TeamStyle, Drill, PoseMap } from './drill.ts';
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

// 하프 코트 기본 배치 — 포메이션 무관 단일 배치. 홈 GK 는 배치하지 않는다(D7 실사용례).
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

function posFor(mode: CourtMode, formation: FormationName, team: TeamSide, number: string): Vec2 | undefined {
  const slot = (SLOTS as string[]).includes(number) ? (number as Slot) : undefined;
  if (!slot) return undefined;
  if (mode === 'full') return FULL_POSITIONS[formation][team][slot];
  if (mode === 'half') return HALF_POSITIONS[team][slot];
  return FLAT_POSITIONS[team][slot];
}

/** 기본 배치가 쓰는 슬롯 좌표 전부(§4.3 P1-3 정착 스냅 후보 ④). 팀·번호는 상관없고 **자리**만
 *  필요하므로 좌표만 모아 돌려준다. 위 표를 유일한 출처로 두기 위한 통로다 — 스냅 쪽에서
 *  좌표를 다시 적으면 포메이션을 손볼 때마다 둘이 어긋난다. */
export function formationSlots(mode: CourtMode, f: string): Vec2[] {
  const formation: FormationName = (FORMATIONS as readonly string[]).includes(f) ? (f as FormationName) : '1-2-1';
  const out: Vec2[] = [];
  for (const team of ['home', 'away'] as const) {
    for (const slot of SLOTS) {
      const p = posFor(mode, formation, team, slot);
      if (p) out.push(p);
    }
  }
  return out;
}

function ballPosFor(mode: CourtMode): Vec2 {
  if (mode === 'full') return FULL_BALL;
  if (mode === 'half') return HALF_BALL;
  return FLAT_BALL;
}

/** 아무것도 배치되지 않은 스텝. 휠체어·공·콘 전부 미배치이므로 코트가 비어 있다. */
export function emptyStep(_mode: CourtMode): DrillStep {
  return { id: newId('st'), name: '스텝 1', note: '', chairs: {}, balls: {}, cones: {}, arrows: [], notes: [] };
}

/** 시그니처를 string 으로 넓히고 내부에서 FORMATIONS 폴백한다(validate.ts 의 이중 방어와 합치). */
export function defaultStep(mode: CourtMode, f: string, cast: DrillCast): DrillStep {
  const formation: FormationName = (FORMATIONS as readonly string[]).includes(f) ? (f as FormationName) : '1-2-1';
  const { homeHeadingDeg, awayHeadingDeg } = COURT_DEFS[mode];

  const chairs: PoseMap<ChairId, StoredChairPose> = {};
  for (const def of cast.chairs) {
    const p = posFor(mode, formation, def.team, def.number);
    if (!p) continue; // 예: half 코트 홈 GK — cast 에는 있고 pose 는 없다
    const headingDeg = def.team === 'home' ? homeHeadingDeg : awayHeadingDeg;
    chairs[def.id] = { x: p.x, y: p.y, angleDeg: radToStoredDeg(headingDeg * RAD) };
  }

  const balls: PoseMap<BallId, Vec2> = {};
  const ballPos = ballPosFor(mode);
  for (const b of cast.balls) balls[b.id] = { x: ballPos.x, y: ballPos.y };

  return {
    id: newId('st'),
    name: '스텝 1',
    note: '',
    chairs,
    balls,
    cones: {},
    arrows: [],
    notes: [],
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
  category?: string;
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
  const teams = structuredClone(init.teams ?? DEFAULT_TEAMS);
  const step = init.empty ? emptyStep(init.courtMode) : defaultStep(init.courtMode, formation, cast);
  assertNoOverlap(init.courtMode, step);
  return {
    schemaVersion: CURRENT_DRILL_SCHEMA,
    id: newId('dr'),
    title: init.title ?? '새 드릴',
    category: init.category ?? KNOWN_CATEGORIES[0],
    level: init.level ?? '초급',
    durationMin: init.durationMin ?? 10,
    tags: [],
    courtMode: init.courtMode,
    formation,
    teams,
    cast,
    steps: [step],
    createdAt: now,
    updatedAt: now,
  };
}

/** §3.10 코트 전환. half↔flat 은 viewBox 동일(500×425)이므로 항등 변환. full↔(half|flat) 은
 *  규격·종횡비가 달라 배치를 보존할 수 없으므로 defaultStep 으로 명시적으로 리셋한다. */
export function cloneToCourt(d: Drill, mode: CourtMode): Drill {
  if (d.courtMode === mode) return d;
  const now = Date.now();
  const isHalfFlat = (m: CourtMode): boolean => m === 'half' || m === 'flat';

  if (isHalfFlat(d.courtMode) && isHalfFlat(mode)) {
    return { ...structuredClone(d), id: newId('dr'), courtMode: mode, createdAt: now, updatedAt: now };
  }

  const cast = structuredClone(d.cast);
  const teams = structuredClone(d.teams);
  const step = defaultStep(mode, d.formation, cast);
  const suffix = mode === 'full' ? ' (풀)' : mode === 'half' ? ' (하프)' : ' (플랫)';
  const prefix = '[코트 전환 — 배치를 다시 만들어야 합니다] ';
  return {
    ...d,
    id: newId('dr'),
    title: `${d.title}${suffix}`,
    description: `${prefix}${d.description ?? ''}`.trim(),
    courtMode: mode,
    teams,
    cast,
    steps: [step],
    createdAt: now,
    updatedAt: now,
  };
}
