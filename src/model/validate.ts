// §3.8 검증·보정. zod 등 런타임 스키마 라이브러리 미사용(의존성 0). 절대 throw 하지 않는다 —
// 파일에서 온 임의 JSON 을 먹어도 된다. 11단계 고정 순서 파이프라인, 멱등.
import { isId, newId } from '../core/ids.ts';
import {
  SHAPE_DEFAULT_PX,
  SHAPE_KINDS,
  SHAPE_MAX_PX,
  SHAPE_MIN_PX,
  TRI_MIN_AREA_PX2,
  recenterTri,
  triBBox,
  triCross2,
  trianglePoints,
  type Shape,
  type TriPoints,
} from './shape.ts';
import type { ShapeId } from '../core/ids.ts';
import type { ChairId, BallId, ConeId, StepId, ArrowId, NoteId, DrillId, SessionId, ItemId, PlayerId, StrokeId, TeamId, StaffId } from '../core/ids.ts';
import type { Vec2 } from '../core/units.ts';
import { COURT_MODES, COURT_SIZES, DEFAULT_COURT_SIZE, clampToViewBox, type CourtMode, type CourtSize } from './court.ts';
import { FORMATIONS, defaultStep, DEFAULT_TEAMS } from './defaults.ts';
import { defaultDefense } from './rules.ts';
import { CURRENT_DRILL_SCHEMA, DRILL_LEVELS, DRILL_TYPES, DRILL_SITUATIONS } from './drill.ts';
import type { Drill, DrillCast, ChairDef, BallDef, ConeDef, TeamStyle, TeamSide, DrillLevel, DrillType, DrillSituation, PoseMap, NoteLabel, StoredBallRing } from './drill.ts';
import type { StoredChairPose } from './chair.ts';
import type { Arrow, ArrowHead } from './arrow.ts';
import { STROKE_WIDTHS, type Stroke, type StrokeWidthIndex } from './stroke.ts';
import { CURRENT_SESSION_SCHEMA, SESSION_PHASE_KINDS, flattenSessionItems } from './session.ts';
import type { TrainingSession, SessionItem, SessionPhase, SessionPhaseKind } from './session.ts';
import { refDrillIds } from './refs.ts';
import { CURRENT_ROSTER_SCHEMA, PF_CLASSES } from './roster.ts';
import type { Roster, Player, PFClass } from './roster.ts';
import { CURRENT_TEAM_SCHEMA, STAFF_ROLES, TEAM_KIT_KINDS, TEAM_PALETTE_MAX, defaultTeamName } from './team.ts';
import type { Team, Staff, StaffRole, Lineup, TeamKit, TeamKits } from './team.ts';

export interface ValidationIssue {
  path: string;
  message: string;
}
export interface Repair {
  path: string;
  message: string;
  destructive: boolean;
}
export type ValidateResult<T> =
  | { ok: true; value: T; repairs: Repair[] }
  | { ok: false; issues: ValidationIssue[] };

// 자동 생성 스텝 이름 패턴(과제⑦, 2026-08-17까지의 생성 규칙). addStepAfter(edits.ts, 지금은
// 폐기)·emptyStep·defaultStep(defaults.ts) 이 그 시점까지 정확히 이 모양('스텝' + 공백 +
// 숫자)의 이름을 붙였다 — 사용자가 타이핑한 적 없는 자리표시자다. 남은 둘은 이제 ''를 쓰지만, 그
// 전에 저장된 옛 드릴에는 이 패턴이 그대로 남아 있을 수 있어 정화기가 걸러낸다. 옛 생성
// 규칙과 **정확히** 일치하는 것만 버려야 한다 — "스텝 3: 킥오프" 처럼 패턴을 접두어로만
// 쓴 사용자 이름까지 버리면 진짜 유실이 된다. 그래서 전체 일치(`^…$`)다.
const AUTO_STEP_NAME_RE = /^스텝 \d+$/;

/** 스텝 이름 → 노트 병합 결과(과제⑦). validateDrill 의 정화 루프와 seedDrills.ts 의
 *  buildStep 이 **같은 규칙**을 써야 한다 — 씨앗이 미리 이관해 만든 note 를 정화기가
 *  다시 훑어도 그대로여야(멱등) '저장 왕복에서 한 글자도 안 바뀐다'는 seedDrills.test.ts
 *  의 불변식이 성립한다. 규칙을 두 곳에 따로 적으면 한쪽만 고쳐질 때 그 불변식이 조용히
 *  깨진다 — 그래서 함수 하나로 묶었다. */
export type StepNameMigration =
  | { kind: 'none' } // 이름이 애초에 비어 있다 — 할 일 없음
  | { kind: 'auto-discard' } // '스텝 N' 자동 생성 패턴 — 사용자 내용이 아니라 이관 없이 버림
  | { kind: 'redundant' } // note 가 이미 그 이름으로 시작 — 병합할 것이 없어 버림
  | { kind: 'merged'; note: string; truncated: boolean }; // note 로 합침(상한 초과 시 절단)

export function migrateStepName(name: string, note: string): StepNameMigration {
  if (name.length === 0) return { kind: 'none' };
  if (AUTO_STEP_NAME_RE.test(name)) return { kind: 'auto-discard' };
  if (note.startsWith(name)) return { kind: 'redundant' };
  const merged = note.length > 0 ? `${name}\n${note}` : name;
  if (merged.length > LIMITS.noteLen) return { kind: 'merged', note: merged.slice(0, LIMITS.noteLen), truncated: true };
  return { kind: 'merged', note: merged, truncated: false };
}

/** note 의 첫 줄만 뽑아 다듬는다 — name 필드가 폐기되며 짧은 이름표가 필요하던 자리(내보내기
 *  PNG 캡션, NotePanel 접힘 줄 미리보기)의 표준 후계 자리다. migrateStepName 이 옛 이름을
 *  note 첫 줄로 합쳐두므로, 옛 이름이 있던 드릴은 이 함수가 그 이름을 그대로 돌려준다 —
 *  "이름 있던 자리엔 이제 note 첫 줄" 이라는 같은 규칙을 함수 하나로 묶어 드리프트를 막는다. */
export function noteFirstLine(note: string): string {
  return (note.split('\n')[0] ?? '').trim();
}

export const LIMITS = {
  titleLen: 80,
  stepNameLen: 40,
  noteLen: 600,
  tagCount: 12,
  tagLen: 24,
  // §3.5 설명 · §3.4 선수 실명. 둘 다 **원래 상한이 없었다** — 문자열이면 그대로 통과했다.
  // 인스펙터에 입력 칸이 생기는 순간(3.4/3.5) 붙여넣기 한 번으로 IDB 에 수십 KB 가 들어가고,
  // 그 값이 목록 카드·계획서·트레이 손잡이 이름까지 밀고 들어간다.
  descriptionLen: 400,
  /** 변형(v8, USPSA Variation). 진행 방법(description)과 동급의 서술 필드라 같은 상한. */
  variationLen: 400,
  chairNameLen: 24, // 등번호 칩 옆에 붙는 이름이다. 길면 트레이 손잡이 이름이 문단이 된다
  // 팀 이름(§0.5 미배송 빚, 2026-08-20). chairNameLen 과 같은 규모 — FunctionBar 의 진영
  // 설명 문장·PresentObjects 의 aria-label 문장에 그대로 끼워지므로 길면 문장이 안 읽힌다.
  teamLabelLen: 24,
  // §3.2 교육 필드. 숫자 상한은 "깨진 파일 방어" 이자 인스펙터 입력의 min/max 단일 출처다.
  // (훈련량 repsMax/setsMax/intervalSecMax 는 v8 에서 필드와 함께 폐기 — migrate.ts v7→v8)
  objectiveLen: 200,
  equipmentLen: 120,
  coachingPointCount: 6,
  coachingPointLen: 80,
  playersNeededMax: 30, // 코트 위 8 + 교체·피더까지
  maxSteps: 60,
  maxBalls: 10,
  maxChairsPerTeam: 4,
  maxCones: 2000, // REQUIREMENTS 는 '제한 없음' — 이건 깨진 파일 방어용 상한
  maxArrowsPerStep: 40,
  /** 스텝당 작도 도형 상한. 화살표와 같은 수로 맞춘다 — 둘 다 '판에 덧그리는 것' 이고,
   *  이보다 많으면 반투명 겹침이 새하얘져 아래 코트가 안 보인다(면이 0.13 이라 40겹이면 1.0). */
  maxShapesPerStep: 40,
  maxNotesPerStep: 20,
  /** 스텝당 자유 그리기 획 상한(2026-09-03). 화살표·도형과 같은 수다 — 셋 다 '판에 덧그리는
   *  것' 이고, 한 스텝의 덧그림이 몇 개까지 읽히는가는 개체 종류가 아니라 판의 크기가 정한다. */
  strokesPerStep: 40,
  /** 획 하나의 점 상한. 단순화(`simplifyPoints`, RDP ε 1.5px)를 지난 획은 코트를 가로지르는
   *  긴 곡선도 100점을 잘 안 넘는다 — 400 은 그 네 배로 잡은 **깨진 파일 방어선**이지 UI
   *  상한이 아니다(위 `maxCones` 문단과 같은 성격). 넘으면 뒤에서 자른다: 앞부분을 남겨야
   *  그린 방향이 보존되고, 획은 앞에서부터 그려진 것이라 앞이 곧 시작이다. */
  pointsPerStroke: 400,
  maxSessionItems: 40, // 세션 전체(전 구획 합산) 항목 상한 — v2 에서도 합산 기준이다
  // ── Session v2 (2026-08-18 구조 개편) ─────────────────────────────────────────────
  sessionPhasesMax: 12, // 구획 수 상한. 표준 세션은 4~6 구획 — 12 는 깨진 파일 방어선
  phaseTitleLen: 40, // 구획 자유 이름. 스텝 이름과 같은 규모(한 줄 라벨)
  sessionGoalMinMax: 480, // 세션 목표 총 시간(분) 상한 = 8시간. 하루 훈련의 방어선
  // §0.5 미배송 빚(2026-08-20) — 세 필드 모두 검증은 통과하는데 입력 자리가 없어 인쇄된
  // 계획서 세 열이 영구히 빈칸이었다. 입력 UI를 만들며 상한도 함께 매긴다(위 teamLabelLen
  // 과 같은 관례).
  sessionNoteLen: 400, // 세션 전체 메모. description·variation 과 같은 규모
  itemNoteLen: 200, // 항목(구획 안 드릴 한 줄) 메모. 세션 메모보다 짧다 — 화면 한 줄 곁다리
  restAfterMinMax: 60, // 드릴 사이 휴식(분) 상한. 세션 목표 시간(480)보다 훨씬 작다 —
  // 휴식은 몇 분 단위지 시간 단위가 아니다
  // PNG 캡션 실명 줄(§0.5 미배송 빚, 2026-08-20) — staticSceneLayout 의 캡션 띠는 고정
  // 폭(vbW)이라 줄바꿈이 없다. stepNameLen(40)의 2배 — 실명은 여러 명을 이어 붙이므로.
  captionRosterLen: 80,
  // ── 로스터 (구조 개편 C3) ─────────────────────────────────────────────────────────
  rosterMax: 30, // playersNeededMax 와 같은 근거 — 코트 8 + 교체·피더까지
  // ⚠️ 2026-09-09: rosterMax 는 이제 **팀당** 상한이다([팀] 메뉴, PLAN-TEAM.md 결정 19).
  // 명단이 팀 문서 안으로 들어가며 "앱 전체에 선수 30명" 이 "팀마다 30명" 이 됐다 — 숫자는
  // 그대로지만 세는 단위가 바뀌었다. validateRoster(옛 단일 명단)와 validateTeam 이 같은 값을
  // 쓰는 것은 의도다: 이주(rosterMigration)가 옛 명단을 그대로 한 팀에 담을 수 있어야 한다.
  playerNameLen: 40, // chairNameLen(24)보다 넉넉한 이유: 여기는 트레이 손잡이로 안 흘러간다
  // ── 팀 ([팀] 메뉴, 2026-09-09 · PLAN-TEAM.md 결정 19) ──────────────────────────────
  /** 팀 문서 수 상한. 클럽·연령대·연도별 복제(결정 20)를 감안한 값이다 — 시즌을 별도 계층
   *  대신 [복제]로 푸는 이상 팀 수는 해마다 는다. 동기화 파일 20개는 Drive 왕복에 무리가 없다. */
  teamMax: 20,
  staffMax: 15, // 벤치 인원(코치·매니저·의무·활동지원·정비)과 예비까지. 깨진 파일 방어선이다
  teamNameLen: 40, // playerNameLen 과 같은 규모 — 목록 카드 한 줄 라벨이다
  /** 약칭. 등번호 칩 옆·세션 카드 칩에 들어가는 2~4글자용 자리라 짧다. */
  shortNameLen: 6,
  /** 선수 메모(결정 6). itemNoteLen 과 같은 규모 — 화면 한 줄 곁다리다.
   *  ⚠️ 이 칸은 개인정보를 **안 적게 하는 안내**가 함께 가야 한다(model/roster.ts Player 주석). */
  playerNoteLen: 200,
  chairModelLen: 40, // 축구용 파워체어 기종명("Strike Force 3", "Quickie Q300 M Mini")
  teamLeagueLen: 40, // 리그·소속 라벨. 팀 이름과 같은 규모
  teamSeasonLen: 24, // '2026', '2026 U19' 같은 라벨 — 이름보다 짧다
  teamNoteLen: 400, // 팀 전체 메모. sessionNoteLen·descriptionLen 과 같은 규모
} as const;

/** 등번호 상한(결정 6). 0 도 유효한 등번호다 — '미지정' 은 키가 없는 것으로 표현한다. */
const PLAYER_NUMBER_MAX = 99;
/** 출생 연도의 하한. 이보다 이른 값은 오타이거나 깨진 파일이다(연도만 받는다 — 결정 6). */
const BIRTH_YEAR_MIN = 1900;

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const pushRepair = (repairs: Repair[], path: string, message: string, destructive: boolean): void => {
  repairs.push({ path, message, destructive });
};

// ---- §3.8 단계 6/7/8/9 결합: 좌표 유한성 → 각도 보정 → 클램프 → 반올림 -----------------------

function sanitizeChairPose(raw: unknown, mode: CourtMode, size: CourtSize): StoredChairPose | null {
  if (!isRecord(raw)) return null;
  const x = typeof raw.x === 'number' ? raw.x : NaN;
  const y = typeof raw.y === 'number' ? raw.y : NaN;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null; // 6: 유한하지 않으면 제거
  let a = typeof raw.angleDeg === 'number' ? raw.angleDeg : NaN;
  if (!Number.isFinite(a)) a = 0; // 7
  else if (Math.abs(a) > 36000) a = ((a % 360) + 360) % 360; // 7
  const clamped = clampToViewBox(mode, { x, y }, size); // 8
  return {
    x: Math.round(clamped.x * 10) / 10, // 9
    y: Math.round(clamped.y * 10) / 10,
    angleDeg: Math.round(a * 10) / 10,
  };
}

function sanitizeVec(raw: unknown, mode: CourtMode, size: CourtSize): Vec2 | null {
  if (!isRecord(raw)) return null;
  const x = typeof raw.x === 'number' ? raw.x : NaN;
  const y = typeof raw.y === 'number' ? raw.y : NaN;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const clamped = clampToViewBox(mode, { x, y }, size);
  return { x: Math.round(clamped.x * 10) / 10, y: Math.round(clamped.y * 10) / 10 };
}

// 화살표·메모는 "개체"(cast) 가 아니라 자유 주석이므로 viewBox 클램프 대상이 아니다 —
// 유한성만 지킨다(코트 밖으로 나가는 이동 궤적을 그리는 것은 정상 사용례).
function sanitizeFreeVec(raw: unknown): Vec2 | null {
  if (!isRecord(raw)) return null;
  const x = typeof raw.x === 'number' ? raw.x : NaN;
  const y = typeof raw.y === 'number' ? raw.y : NaN;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

// ---- §3.2/3.3 교육 필드 -------------------------------------------------------------------------
// 셋 다 값이 없으면 **키를 만들지 않는다** — `{objective: undefined}` 는 structuredClone(IDB)이
// 보존하고 JSON 이 지우므로, 그 한 줄이 export 왕복으로 의미가 달라지는 문서를 만든다(edits.ts
// `omitKey` 주석의 함정과 같다). 그래서 반환 타입이 `T | undefined` 이고 조립부가 스프레드로 붙인다.

function sanitizeText(raw: unknown, max: number, path: string, label: string, repairs: Repair[]): string | undefined {
  if (typeof raw !== 'string') return undefined;
  if (raw.length <= max) return raw;
  pushRepair(repairs, path, `${label} 길이 상한(${max}) 초과 — 절단`, true);
  return raw.slice(0, max);
}

/** 0 = 미지정인 개수 필드(필요 인원·반복·세트·인터벌). 정수·0..max 로 접는다. */
function sanitizeCount(raw: unknown, max: number, path: string, label: string, repairs: Repair[]): number | undefined {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return undefined;
  const v = Math.min(Math.max(Math.round(raw), 0), max);
  if (v !== raw) pushRepair(repairs, path, `${label} 을(를) 0~${max} 정수로 보정`, true);
  return v;
}

/** 코칭 포인트는 **불릿 배열**이다(4차 PDF 가 줄마다 하나씩 찍는다). 빈 줄은 정보가 0 이므로
 *  버린다 — 인스펙터의 textarea 도 같은 규칙으로 접어 넣으므로 저장·재읽기가 항등이다. */
function sanitizeCoachingPoints(raw: unknown, repairs: Repair[]): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  let cut = false;
  let out = raw
    .filter((x): x is string => typeof x === 'string')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => {
      if (s.length <= LIMITS.coachingPointLen) return s;
      cut = true;
      return s.slice(0, LIMITS.coachingPointLen);
    });
  if (cut) pushRepair(repairs, 'coachingPoints', `코칭 포인트 길이 상한(${LIMITS.coachingPointLen}) 초과 — 절단`, true);
  if (out.length > LIMITS.coachingPointCount) {
    pushRepair(repairs, 'coachingPoints', `코칭 포인트 개수 상한(${LIMITS.coachingPointCount}) 초과 — 뒤에서 절단`, true);
    out = out.slice(0, LIMITS.coachingPointCount);
  }
  return out;
}

// ---- cast 파싱 (타입 체크 + 3: id 중복 제거) ------------------------------------------------

function parseChairs(raw: unknown, repairs: Repair[]): ChairDef[] {
  const arr = Array.isArray(raw) ? raw : [];
  const seen = new Set<string>();
  const out: ChairDef[] = [];
  for (const item of arr) {
    if (!isRecord(item)) continue;
    let id = typeof item.id === 'string' && item.id.length > 0 ? item.id : newId('ch');
    if (seen.has(id)) {
      id = newId('ch');
      pushRepair(repairs, 'cast.chairs.id', '중복된 휠체어 id 재발급', false);
    }
    seen.add(id);
    const team: TeamSide = item.team === 'away' ? 'away' : 'home';
    const number = typeof item.number === 'string' ? item.number.slice(0, 3) : '?';
    const isGk = typeof item.isGk === 'boolean' ? item.isGk : false;
    const def: ChairDef = { id: id as ChairId, team, number, isGk };
    if (typeof item.role === 'string') def.role = item.role;
    // §3.4 — 이름은 **길이만** 접는다. 공백 정리는 하지 않는다: 정상 파일마다 repairs 가
    // 붙으면 "일부 데이터를 자동으로 보정했습니다" 토스트가 열 때마다 뜬다. 공백뿐인 이름을
    // 이름으로 안 치는 판단은 화면 쪽(`hasChairName`)이 한다.
    const nm = sanitizeText(item.name, LIMITS.chairNameLen, 'cast.chairs.name', '선수 이름', repairs);
    if (nm !== undefined) def.name = nm;
    if (typeof item.color === 'string') def.color = item.color;
    out.push(def);
  }
  return out;
}

function capPerTeam(chairs: ChairDef[], repairs: Repair[]): ChairDef[] {
  const counts: Record<TeamSide, number> = { home: 0, away: 0 };
  const out: ChairDef[] = [];
  let cut = false;
  for (const c of chairs) {
    if (counts[c.team] < LIMITS.maxChairsPerTeam) {
      counts[c.team]++;
      out.push(c);
    } else {
      cut = true;
    }
  }
  if (cut) pushRepair(repairs, 'cast.chairs', '팀당 휠체어 상한(4) 초과 — 뒤에서 절단', true);
  return out;
}

function parseBalls(raw: unknown, repairs: Repair[]): BallDef[] {
  const arr = Array.isArray(raw) ? raw : [];
  const seen = new Set<string>();
  let out: BallDef[] = [];
  for (const item of arr) {
    if (!isRecord(item)) continue;
    let id = typeof item.id === 'string' && item.id.length > 0 ? item.id : newId('bl');
    if (seen.has(id)) {
      id = newId('bl');
      pushRepair(repairs, 'cast.balls.id', '중복된 공 id 재발급', false);
    }
    seen.add(id);
    // ★ 화이트리스트 — **여기 없는 필드는 IDB/파일 왕복에서 소리 없이 증발한다**(§3.8 규율).
    // 거리 원(`ring`)은 2026-08-27(v9)에 **여기서 스텝으로 떠났다** — `parseStepBallRings`.
    // 마이그레이션이 옮겨 적으므로 이 자리에 남은 옛 키는 그대로 증발시키는 것이 맞다.
    out.push({ id: id as BallId });
  }
  if (out.length > LIMITS.maxBalls) {
    pushRepair(repairs, 'cast.balls', '공 개수 상한(10) 초과 — 뒤에서 절단', true);
    out = out.slice(0, LIMITS.maxBalls);
  }
  return out;
}

function parseCones(raw: unknown, repairs: Repair[]): ConeDef[] {
  const arr = Array.isArray(raw) ? raw : [];
  const seen = new Set<string>();
  let out: ConeDef[] = [];
  for (const item of arr) {
    if (!isRecord(item)) continue;
    let id = typeof item.id === 'string' && item.id.length > 0 ? item.id : newId('cn');
    if (seen.has(id)) {
      id = newId('cn');
      pushRepair(repairs, 'cast.cones.id', '중복된 콘 id 재발급', false);
    }
    seen.add(id);
    const colorIndex: 0 | 1 = item.colorIndex === 1 ? 1 : 0;
    out.push({ id: id as ConeId, colorIndex });
  }
  if (out.length > LIMITS.maxCones) {
    pushRepair(repairs, 'cast.cones', '콘 개수 상한(2000) 초과 — 뒤에서 절단', true);
    out = out.slice(0, LIMITS.maxCones);
  }
  return out;
}

function sanitizeTeamStyle(raw: unknown, fallback: TeamStyle, path: string, repairs: Repair[]): TeamStyle {
  if (!isRecord(raw)) return { ...fallback };
  return {
    label: sanitizeText(raw.label, LIMITS.teamLabelLen, `${path}.label`, '팀 이름', repairs) ?? fallback.label,
    color: typeof raw.color === 'string' ? raw.color : fallback.color,
    gkColor: typeof raw.gkColor === 'string' ? raw.gkColor : fallback.gkColor,
  };
}

// ---- 화살표·메모 -----------------------------------------------------------------------------

const isHead = (v: unknown): v is ArrowHead => v === 'none' || v === 'thin' || v === 'wide';

function sanitizeArrow(raw: unknown): Arrow | null {
  if (!isRecord(raw)) return null;
  const id = typeof raw.id === 'string' && raw.id.length > 0 ? (raw.id as ArrowId) : newId('ar');
  // ⚠️ 2026-08-16 — `kind` 가 **사라졌다**(기현 지시 *"선으로 통일"*). 옛 문서의 그 필드는
  //    여기서 조용히 버려진다 — 마이그레이션 v6→v7 이 이미 지웠고, 그 길을 안 지난 객체
  //    (손편집·테스트 픽스처)도 같은 결과가 되게 한다.
  const from = sanitizeFreeVec(raw.from);
  const ctrl = sanitizeFreeVec(raw.ctrl);
  const to = sanitizeFreeVec(raw.to);
  if (!from || !ctrl || !to) return null;
  const arrow: Arrow = { id, from, ctrl, to };
  if (typeof raw.color === 'string') arrow.color = raw.color;
  // 화살촉 — 값이 없으면 키를 안 만든다(모델의 기본값이 곧 옛 모양이다).
  if (isHead(raw.headFrom)) arrow.headFrom = raw.headFrom;
  if (isHead(raw.headTo)) arrow.headTo = raw.headTo;
  return arrow;
}

function sanitizeArrows(raw: unknown, repairs: Repair[]): Arrow[] {
  const arr = Array.isArray(raw) ? raw : [];
  const seen = new Set<string>();
  let out: Arrow[] = [];
  for (const item of arr) {
    const a = sanitizeArrow(item);
    if (!a) continue;
    let id = a.id;
    if (seen.has(id)) {
      id = newId('ar');
      pushRepair(repairs, 'steps.arrows.id', '스텝 안 중복 화살표 id 재발급', false);
    }
    seen.add(id);
    out.push(id === a.id ? a : { ...a, id });
  }
  if (out.length > LIMITS.maxArrowsPerStep) {
    pushRepair(repairs, 'steps.arrows', '스텝당 화살표 상한(40) 초과 — 뒤에서 절단', true);
    out = out.slice(0, LIMITS.maxArrowsPerStep);
  }
  return out;
}

// ---- 자유 그리기 획 (2026-09-03) --------------------------------------------------------

/** 굵기는 값(px)이 아니라 **첨자**다(model/stroke.ts). 정의역 밖이면 키를 버린다 —
 *  조용히 0 이나 1 로 접으면 "굵게 그린 획이 어느 날 가늘어졌다" 가 되고, 키를 버리면
 *  기본 굵기로 열린다(= `width?` 의 뜻 그대로). */
const isStrokeWidth = (v: unknown): v is StrokeWidthIndex =>
  typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < STROKE_WIDTHS.length;

/** 획 하나를 신뢰 가능한 값으로 접는다.
 *
 *  좌표는 **코트 안으로 클램프하지 않는다** — 화살표와 같은 취급이다(`sanitizeFreeVec`).
 *  덧그림은 판 밖으로 조금 삐져나가도 뜻이 살아 있고, 클램프하면 코트 크기를 줄인 드릴의
 *  획이 가장자리에 눌려 붙어 모양이 뭉개진다.
 *
 *  점이 **둘 미만이면 획을 통째로 버린다**: 점 하나는 화면에 아무것도 아니면서 앵커 셋을
 *  달고 앉아, 보이지 않는데 잡히는 개체가 된다(도형 정화기가 0 폭을 막는 것과 같은 이유). */
function sanitizeStroke(raw: unknown, repairs: Repair[]): Stroke | null {
  if (!isRecord(raw)) return null;
  const id = typeof raw.id === 'string' && raw.id.length > 0 ? (raw.id as StrokeId) : newId('fh');
  if (!Array.isArray(raw.points)) return null;
  let points: Vec2[] = [];
  for (const p of raw.points) {
    const v = sanitizeFreeVec(p);
    if (v) points.push(v); // 유한수가 아닌 점만 조용히 빠진다 — 획 전체를 버리는 것보다 낫다
  }
  if (points.length > LIMITS.pointsPerStroke) {
    pushRepair(repairs, 'steps.strokes.points', `획당 점 상한(${LIMITS.pointsPerStroke}) 초과 — 뒤에서 절단`, true);
    points = points.slice(0, LIMITS.pointsPerStroke);
  }
  if (points.length < 2) return null;
  const stroke: Stroke = { id, points };
  if (typeof raw.color === 'string') stroke.color = raw.color;
  if (isStrokeWidth(raw.width)) stroke.width = raw.width;
  // 화살촉 — 값이 없으면 키를 안 만든다(모델 기본값 none/none 이 곧 "선").
  if (isHead(raw.headFrom)) stroke.headFrom = raw.headFrom;
  if (isHead(raw.headTo)) stroke.headTo = raw.headTo;
  return stroke;
}

function sanitizeStrokes(raw: unknown, repairs: Repair[]): Stroke[] {
  const arr = Array.isArray(raw) ? raw : [];
  const seen = new Set<string>();
  let out: Stroke[] = [];
  for (const item of arr) {
    const s = sanitizeStroke(item, repairs);
    if (!s) continue;
    let id = s.id;
    if (seen.has(id)) {
      id = newId('fh');
      pushRepair(repairs, 'steps.strokes.id', '스텝 안 중복 획 id 재발급', false);
    }
    seen.add(id);
    out.push(id === s.id ? s : { ...s, id });
  }
  if (out.length > LIMITS.strokesPerStep) {
    pushRepair(repairs, 'steps.strokes', `스텝당 획 상한(${LIMITS.strokesPerStep}) 초과 — 뒤에서 절단`, true);
    out = out.slice(0, LIMITS.strokesPerStep);
  }
  return out;
}

/** 도형 하나를 신뢰 가능한 값으로 접는다. 좌표는 코트 안으로 클램프하고(다른 개체와 같은
 *  규율), 크기·각도는 모델의 상·하한으로 가둔다 — 손편집·옛 파일·버그가 만든 0 폭이나
 *  NaN 각도가 들어오면 화면에서 **집을 수 없는 도형**이 되어 지울 방법이 사라진다. */
/** id 목록을 살아 있는 것만 남기고 중복을 접는다. 순서는 보존한다 — `locked`/`ignored` 에서는
 *  순서가 뜻을 갖지 않지만 왕복(내보내기→가져오기)에서 배열이 흔들리면 diff 가 매번
 *  시끄러워지고, `zOrder` 에서는 **순서가 곧 내용**이다(2026-09-06 v11).
 *
 *  `dropMsg` 를 인자로 받는 이유: 세 목록의 뜻이 달라 같은 문구로 뭉뚱그리면 사용자가 보는
 *  보정 사유가 거짓이 된다(순서 목록은 "상태 플래그" 가 아니다). */
function sanitizeIdList(
  raw: unknown,
  alive: ReadonlySet<string>,
  where: string,
  repairs: Repair[],
  dropMsg = '없는 개체를 가리키는 상태 플래그 제거',
): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  let dropped = false;
  for (const v of raw) {
    if (typeof v !== 'string' || seen.has(v)) continue;
    if (!alive.has(v)) {
      dropped = true;
      continue;
    }
    seen.add(v);
    out.push(v);
  }
  if (dropped) pushRepair(repairs, where, dropMsg, true);
  return out;
}

/** 표시 순서 목록(v11, 2026-09-06). `locked`/`ignored` 와 **같은 정화 규칙**을 쓴다 — 그
 *  스텝에 실제로 있는 id 만, 중복 제거, 순서 보존.
 *
 *  ⚠️ 고아 id 를 안 걷으면 저장본에 쌓인다(이 저장소의 반복 사고 — 계획서 결정 13).
 *  `sceneOrder` 가 읽을 때 무시하므로 화면은 멀쩡한데, 파일만 매 편집마다 부푼다.
 *
 *  상한을 따로 두지 않는 이유: `alive` 가 곧 상한이다(그 스텝의 개체 총수). 개체 수 자체는
 *  이미 `maxArrowsPerStep`·`maxShapesPerStep`·`strokesPerStep`·`maxNotesPerStep`·`maxCones` 가
 *  가둔다 — 여기에 숫자를 하나 더 두면 그 숫자가 다음 드리프트의 발원지가 된다. */
function sanitizeZOrder(raw: unknown, alive: ReadonlySet<string>, repairs: Repair[]): string[] {
  return sanitizeIdList(raw, alive, 'steps.zOrder', repairs, '없는 개체를 가리키는 표시 순서 항목 제거');
}

function sanitizeShape(raw: unknown, mode: CourtMode, size: CourtSize, repairs: Repair[]): Shape | null {
  if (!isRecord(raw)) return null;
  const kind = SHAPE_KINDS.find((k) => k === raw.kind);
  if (!kind) return null;
  const id = typeof raw.id === 'string' && raw.id.length > 0 ? (raw.id as ShapeId) : newId('sh');
  const p = sanitizeVec(raw, mode, size);
  if (!p) return null;
  const dim = (v: unknown): number => {
    const n = typeof v === 'number' && Number.isFinite(v) ? v : SHAPE_DEFAULT_PX;
    return Math.min(SHAPE_MAX_PX, Math.max(SHAPE_MIN_PX, n));
  };
  let w = dim(raw.w);
  let h = dim(raw.h);
  const rotRaw = typeof raw.rot === 'number' && Number.isFinite(raw.rot) ? raw.rot : 0;
  const rot = ((rotRaw % 360) + 360) % 360;
  if (kind !== 'triangle') return { id, kind, x: p.x, y: p.y, w, h, rot };

  // ── 삼각형(2026-08-15 자유 삼각형) ──────────────────────────────────────────────────
  // 모양의 출처는 `pts` 하나다. w/h 는 **받아 적는 값**이라 여기서 계산해 덮는다 — 저장본의
  // w/h 를 믿고 두면 손편집·옛 파일에서 표시 크기와 실제 도형이 갈라진다.
  //
  // ⚠️ 2026-08-14 의 '정삼각형 접기'(w!==h 면 짧은 변으로 맞춤) 는 여기서 **사라졌다.**
  // 그 규칙이 남아 있으면 자유롭게 끈 삼각형이 저장·재적재 한 번에 정삼각형으로 되돌아간다.
  let pts = sanitizeTriPoints(raw.pts);
  if (!pts) {
    // `pts` 가 없거나 망가졌다 — `w` 를 한 변으로 하는 정삼각형으로 읽는다(모델의 triPointsOf
    // 와 **같은 폴백**이라야 정화기를 지난 것과 안 지난 것이 같은 그림이 된다).
    if (raw.pts !== undefined) pushRepair(repairs, 'steps.shapes.pts', '삼각형 꼭짓점이 망가져 정삼각형으로 되돌림', false);
    pts = trianglePoints(w);
  }
  // 한 줄로 선 삼각형은 화면에서 사라진다. 넓이 하한을 못 넘으면 정삼각형으로 되돌린다.
  if (Math.abs(triCross2(pts)) < TRI_MIN_AREA_PX2 * 2) {
    pushRepair(repairs, 'steps.shapes.pts', '삼각형 세 꼭짓점이 한 줄에 서 있어 정삼각형으로 되돌림', false);
    pts = trianglePoints(w);
  }
  // 무게중심이 원점이라는 불변식(shape.ts TriPoints)을 여기서 되세운다. 어긋난 채로 두면
  // 회전축이 도형 밖으로 새어 나가 "제자리에서 도는" 성질이 깨진다.
  const centered = recenterTri(pts);
  if (centered.shift.x !== 0 || centered.shift.y !== 0) {
    const rad = (rot * Math.PI) / 180;
    p.x += centered.shift.x * Math.cos(rad) - centered.shift.y * Math.sin(rad);
    p.y += centered.shift.x * Math.sin(rad) + centered.shift.y * Math.cos(rad);
  }
  const bbox = triBBox(centered.pts);
  w = bbox.w;
  h = bbox.h;
  return { id, kind, x: p.x, y: p.y, w, h, rot, pts: centered.pts };
}

/** 꼭짓점 셋. 하나라도 어긋나면 통째로 버린다(부분 복구는 "반쯤 맞는 삼각형" 을 만든다). */
function sanitizeTriPoints(raw: unknown): TriPoints | null {
  if (!Array.isArray(raw) || raw.length !== 3) return null;
  const out: Vec2[] = [];
  for (const item of raw) {
    if (!isRecord(item)) return null;
    const { x, y } = item;
    if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) return null;
    // 중심에서의 거리만 가둔다 — 방향은 자유다(그것이 이 도형의 요점이다).
    const d = Math.hypot(x, y);
    if (d > SHAPE_MAX_PX) {
      const k = SHAPE_MAX_PX / d;
      out.push({ x: x * k, y: y * k });
    } else {
      out.push({ x, y });
    }
  }
  return [out[0]!, out[1]!, out[2]!];
}

function sanitizeShapes(arr: unknown, mode: CourtMode, size: CourtSize, repairs: Repair[]): Shape[] {
  if (!Array.isArray(arr)) return [];
  const seen = new Set<string>();
  let out: Shape[] = [];
  for (const item of arr) {
    const sh = sanitizeShape(item, mode, size, repairs);
    if (!sh) continue;
    let id = sh.id;
    if (seen.has(id)) {
      id = newId('sh');
      pushRepair(repairs, 'steps.shapes.id', '스텝 안 중복 도형 id 재발급', false);
    }
    seen.add(id);
    out.push(id === sh.id ? sh : { ...sh, id });
  }
  if (out.length > LIMITS.maxShapesPerStep) {
    pushRepair(repairs, 'steps.shapes', '스텝당 도형 상한(40) 초과 — 뒤에서 절단', true);
    out = out.slice(0, LIMITS.maxShapesPerStep);
  }
  return out;
}

function sanitizeNote(raw: unknown, mode: CourtMode, size: CourtSize, repairs: Repair[]): NoteLabel | null {
  if (!isRecord(raw)) return null;
  const id = typeof raw.id === 'string' && raw.id.length > 0 ? (raw.id as NoteId) : newId('nt');
  const p = sanitizeVec(raw, mode, size);
  if (!p) return null;
  let text = typeof raw.text === 'string' ? raw.text : '';
  if (text.length > LIMITS.noteLen) {
    pushRepair(repairs, 'steps.notes.text', '메모 길이 상한(600) 초과 — 절단', true);
    text = text.slice(0, LIMITS.noteLen);
  }
  const note: NoteLabel = { id, x: p.x, y: p.y, text };
  if (typeof raw.size === 'number' && Number.isFinite(raw.size)) note.size = raw.size;
  if (typeof raw.color === 'string') note.color = raw.color;
  if (raw.align === 'start' || raw.align === 'middle' || raw.align === 'end') note.align = raw.align;
  return note;
}

function sanitizeNotes(raw: unknown, mode: CourtMode, size: CourtSize, repairs: Repair[]): NoteLabel[] {
  const arr = Array.isArray(raw) ? raw : [];
  const seen = new Set<string>();
  let out: NoteLabel[] = [];
  for (const item of arr) {
    const n = sanitizeNote(item, mode, size, repairs);
    if (!n) continue;
    let id = n.id;
    if (seen.has(id)) {
      id = newId('nt');
      pushRepair(repairs, 'steps.notes.id', '스텝 안 중복 메모 id 재발급', false);
    }
    seen.add(id);
    out.push(id === n.id ? n : { ...n, id });
  }
  if (out.length > LIMITS.maxNotesPerStep) {
    pushRepair(repairs, 'steps.notes', '스텝당 메모 상한(20) 초과 — 뒤에서 절단', true);
    out = out.slice(0, LIMITS.maxNotesPerStep);
  }
  return out;
}

// ---- validateDrill ----------------------------------------------------------------------------

export function validateDrill(doc: unknown): ValidateResult<Drill> {
  if (!isRecord(doc)) {
    return { ok: false, issues: [{ path: '', message: '문서가 객체가 아님' }] };
  }

  // 1. 타입·필수 필드 — 실패하면 여기서 끝난다.
  const issues: ValidationIssue[] = [];
  if (typeof doc.id !== 'string' || doc.id.length === 0) {
    issues.push({ path: 'id', message: 'id 가 없거나 문자열이 아님' });
  }
  const courtModeOk = typeof doc.courtMode === 'string' && (COURT_MODES as readonly string[]).includes(doc.courtMode);
  if (!courtModeOk) issues.push({ path: 'courtMode', message: 'courtMode 가 full/half/flat 중 하나가 아님' });
  if (!Array.isArray(doc.steps)) issues.push({ path: 'steps', message: 'steps 가 배열이 아님' });
  const schemaVersionRaw = doc.schemaVersion;
  if (typeof schemaVersionRaw === 'number' && schemaVersionRaw > CURRENT_DRILL_SCHEMA) {
    issues.push({ path: 'schemaVersion', message: `schemaVersion(${schemaVersionRaw}) 이 지원 버전(${CURRENT_DRILL_SCHEMA})보다 큼` });
  }
  if (issues.length > 0) return { ok: false, issues };

  const repairs: Repair[] = [];
  const courtMode = doc.courtMode as CourtMode;

  // 1b. §5.1 코트 크기 3단. **courtMode 와 달리 없어도 실패가 아니다** — v2 이전 드릴에는 이
  //     필드가 없고, 없으면 30×18 이다(§9 ② "기본 코트는 30×18 을 유지"). 여기서 정한 값이
  //     아래 클램프(8단계)와 defaultStep(11단계)까지 그대로 흘러간다: 25×14 드릴의 좌표를
  //     825×525 로 클램프하면 판 밖에 있는 개체가 그대로 살아남는다.
  let courtSize: CourtSize = DEFAULT_COURT_SIZE;
  if (typeof doc.courtSize === 'string' && (COURT_SIZES as readonly string[]).includes(doc.courtSize)) {
    courtSize = doc.courtSize as CourtSize;
  } else if (doc.courtSize !== undefined) {
    pushRepair(repairs, 'courtSize', `알 수 없는 코트 크기 '${String(doc.courtSize)}' → '${DEFAULT_COURT_SIZE}'`, false);
  }

  // 1c. 진영(2026-08-15). courtSize 와 같은 규약이다 — 없어도 실패가 아니고, 없으면
  //     `defaultDefense(courtMode)` 다(풀=home, 하프=away — 기본 배치의 GK 자리와 같다).
  let defense: TeamSide = defaultDefense(courtMode);
  if (doc.defense === 'home' || doc.defense === 'away') {
    defense = doc.defense;
  } else if (doc.defense !== undefined) {
    pushRepair(repairs, 'defense', `알 수 없는 진영 '${String(doc.defense)}' → '${defense}'`, false);
  }

  // 2. formation 정규화 — defaultStep 호출(11)보다 반드시 먼저.
  let formation = typeof doc.formation === 'string' ? doc.formation : '1-2-1';
  if (!(FORMATIONS as readonly string[]).includes(formation)) {
    pushRepair(repairs, 'formation', `알 수 없는 포메이션 '${formation}' → '1-2-1'`, false);
    formation = '1-2-1';
  }

  // 3+4. cast id 중복 제거 + 상한 절단 (뒤에서 절단).
  const chairs = capPerTeam(parseChairs(doc.cast && isRecord(doc.cast) ? (doc.cast as Record<string, unknown>).chairs : undefined, repairs), repairs);
  const balls = parseBalls(doc.cast && isRecord(doc.cast) ? (doc.cast as Record<string, unknown>).balls : undefined, repairs);
  const cones = parseCones(doc.cast && isRecord(doc.cast) ? (doc.cast as Record<string, unknown>).cones : undefined, repairs);
  const cast: DrillCast = { chairs, balls, cones };
  const chairIds = new Set(chairs.map((c) => c.id as string));
  const ballIds = new Set(balls.map((b) => b.id as string));
  const coneIds = new Set(cones.map((c) => c.id as string));

  const teams: Record<TeamSide, TeamStyle> = {
    home: sanitizeTeamStyle(isRecord(doc.teams) ? doc.teams.home : undefined, DEFAULT_TEAMS.home, 'teams.home', repairs),
    away: sanitizeTeamStyle(isRecord(doc.teams) ? doc.teams.away : undefined, DEFAULT_TEAMS.away, 'teams.away', repairs),
  };

  let title = typeof doc.title === 'string' ? doc.title : '';
  if (title.length > LIMITS.titleLen) {
    pushRepair(repairs, 'title', '제목 길이 상한(80) 초과 — 절단', true);
    title = title.slice(0, LIMITS.titleLen);
  }
  // 분류 유형(v8). courtSize 와 같은 규약 — 없어도 실패가 아니고(마이그레이션이 새겨 넣지만,
  // 손편집·픽스처가 빼먹을 수 있다) 없으면 'technical', 있는데 목록 밖이면 repair 를 남긴다.
  let drillType: DrillType = 'technical';
  if (typeof doc.drillType === 'string' && (DRILL_TYPES as readonly string[]).includes(doc.drillType)) {
    drillType = doc.drillType as DrillType;
  } else if (doc.drillType !== undefined) {
    pushRepair(repairs, 'drillType', `알 수 없는 유형 '${String(doc.drillType)}' → 'technical'`, false);
  }
  // 경기 상황(v8, 선택). 목록 밖이면 **키를 버린다** — 미지정과 같은 뜻이라 안전하다.
  let situation: DrillSituation | undefined;
  if (typeof doc.situation === 'string' && (DRILL_SITUATIONS as readonly string[]).includes(doc.situation)) {
    situation = doc.situation as DrillSituation;
  } else if (doc.situation !== undefined) {
    pushRepair(repairs, 'situation', `알 수 없는 경기 상황 '${String(doc.situation)}' 폐기`, false);
  }
  const level: DrillLevel = (DRILL_LEVELS as readonly string[]).includes(doc.level as string)
    ? (doc.level as DrillLevel)
    : '초급';
  const durationMin = typeof doc.durationMin === 'number' && Number.isFinite(doc.durationMin) ? doc.durationMin : 10;
  // §3.5 — 3.4/3.5 로 입력 칸이 생기기 전까지 이 값은 아무도 못 적는 죽은 필드라 상한이 없었다.
  const description = sanitizeText(doc.description, LIMITS.descriptionLen, 'description', '설명', repairs);
  const variation = sanitizeText(doc.variation, LIMITS.variationLen, 'variation', '변형', repairs);
  // §3.2 — 조립부(아래 `const drill`)에도 **반드시** 같이 적어야 한다. 여기서 파싱만 하고
  // 조립부에 안 적으면 IDB 왕복에서 소리 없이 증발한다.
  const objective = sanitizeText(doc.objective, LIMITS.objectiveLen, 'objective', '목적', repairs);
  const coachingPoints = sanitizeCoachingPoints(doc.coachingPoints, repairs);
  const equipment = sanitizeText(doc.equipment, LIMITS.equipmentLen, 'equipment', '필요 장비', repairs);
  const playersNeeded = sanitizeCount(doc.playersNeeded, LIMITS.playersNeededMax, 'playersNeeded', '필요 인원', repairs);
  // 훈련량(reps/sets/intervalSec)은 v8 폐기 — 옛 키가 들어와도 여기서 조용히 떨어진다
  // (마이그레이션을 안 지난 손편집 문서도 화이트리스트 조립부가 같은 결과를 만든다).

  let tags = Array.isArray(doc.tags) ? doc.tags.filter((t): t is string => typeof t === 'string') : [];
  let tagTruncated = false;
  tags = tags.map((t) => {
    if (t.length > LIMITS.tagLen) {
      tagTruncated = true;
      return t.slice(0, LIMITS.tagLen);
    }
    return t;
  });
  if (tagTruncated) pushRepair(repairs, 'tags', '태그 길이 상한(24) 초과 — 절단', true);
  if (tags.length > LIMITS.tagCount) {
    pushRepair(repairs, 'tags', '태그 개수 상한(12) 초과 — 뒤에서 절단', true);
    tags = tags.slice(0, LIMITS.tagCount);
  }

  let schemaVersion = CURRENT_DRILL_SCHEMA;
  if (
    typeof schemaVersionRaw === 'number' &&
    Number.isInteger(schemaVersionRaw) &&
    schemaVersionRaw >= 1 &&
    schemaVersionRaw <= CURRENT_DRILL_SCHEMA
  ) {
    schemaVersion = schemaVersionRaw;
  }
  const createdAt = typeof doc.createdAt === 'number' && Number.isFinite(doc.createdAt) ? doc.createdAt : Date.now();
  const updatedAt = typeof doc.updatedAt === 'number' && Number.isFinite(doc.updatedAt) ? doc.updatedAt : Date.now();

  // 5~10. 스텝별: cast에 없는 pose 삭제 → 유한성 → 각도 → 클램프 → 반올림 → 길이/개수 상한.
  let stepsOut: Array<Drill['steps'][number]> = [];
  const stepIdsSeen = new Set<string>();
  const stepsRaw = doc.steps as unknown[];
  for (const rawStep of stepsRaw) {
    if (!isRecord(rawStep)) continue;
    let id = typeof rawStep.id === 'string' && rawStep.id.length > 0 ? (rawStep.id as StepId) : newId('st');
    if (stepIdsSeen.has(id)) {
      id = newId('st');
      pushRepair(repairs, 'steps.id', '중복 스텝 id 재발급', false);
    }
    stepIdsSeen.add(id);

    let name = typeof rawStep.name === 'string' ? rawStep.name : '';
    if (name.length > LIMITS.stepNameLen) {
      pushRepair(repairs, 'steps.name', '스텝 이름 길이 상한(40) 초과 — 절단', true);
      name = name.slice(0, LIMITS.stepNameLen);
    }
    let note = typeof rawStep.note === 'string' ? rawStep.note : '';
    if (note.length > LIMITS.noteLen) {
      pushRepair(repairs, 'steps.note', '스텝 메모 길이 상한(600) 초과 — 절단', true);
      note = note.slice(0, LIMITS.noteLen);
    }
    // 스텝 이름 → 노트 이관(기현님 확정 2026-08-17, 과제⑦): UI 는 이름 필드를 폐기했다 —
    // 이름은 이제 데이터로만(옛 드릴에서) 들어온다. 규칙 자체는 migrateStepName 하나가
    // 쥐고 있다(위 주석 참고) — 여기서는 그 판정에 맞춰 repair 만 남긴다.
    const nameMig = migrateStepName(name, note);
    if (nameMig.kind === 'auto-discard') {
      pushRepair(repairs, 'steps.name', '자동 생성 이름(스텝 N) 폐기 — 사용자 내용 아님', false);
      name = '';
    } else if (nameMig.kind === 'merged') {
      if (nameMig.truncated) pushRepair(repairs, 'steps.note', '이름 이관 병합이 노트 상한(600) 초과 — 뒤 절단', true);
      note = nameMig.note;
      pushRepair(repairs, 'steps.name', '스텝 이름을 노트로 이관 후 폐기', false);
      name = '';
    } else if (nameMig.kind === 'redundant') {
      // note 가 이미 그 이름으로 시작해 병합할 것이 없다 — 그래도 name 필드 자체는
      // 바뀌므로(비존→'') repairs 에 남겨야 한다. 안 남기면 "repairs 비어있음 = 문서
      // 불변" 불변식이 조용히 깨져(§3.8), opportunisticRewrite(drillRepo.ts) 게이트가
      // 안 열리고 매 로드마다 같은 계산을 다시 해야 하는 드리프트가 생긴다.
      pushRepair(repairs, 'steps.name', '스텝 이름이 노트와 중복되어 폐기(이미 노트에 있음)', false);
      name = '';
    }
    const durationMs =
      typeof rawStep.durationMs === 'number' && Number.isFinite(rawStep.durationMs) && rawStep.durationMs > 0
        ? rawStep.durationMs
        : undefined;

    let orphanDropped = false;
    const chairsMap: PoseMap<ChairId, StoredChairPose> = {};
    const chairsRaw = isRecord(rawStep.chairs) ? rawStep.chairs : {};
    for (const [key, val] of Object.entries(chairsRaw)) {
      if (!chairIds.has(key)) {
        orphanDropped = true;
        continue;
      }
      const pose = sanitizeChairPose(val, courtMode, courtSize);
      if (pose) chairsMap[key as ChairId] = pose;
    }
    const ballsMap: PoseMap<BallId, Vec2> = {};
    const ballsRaw = isRecord(rawStep.balls) ? rawStep.balls : {};
    for (const [key, val] of Object.entries(ballsRaw)) {
      if (!ballIds.has(key)) {
        orphanDropped = true;
        continue;
      }
      const p = sanitizeVec(val, courtMode, courtSize);
      if (p) ballsMap[key as BallId] = p;
    }
    // 거리 원(v9) — `balls` 와 **별도 맵**이다. 값 화이트리스트는 옛 `parseBalls` 의 그것을
    // 그대로 물려받는다: '3m'|'5m' 만 싣고 그 외(없음·'none'·쓰레기)는 **키를 만들지 않는다**
    // = 'none'. 'none' 을 값으로 적으면 `{ring:'none'}` 과 `{}` 라는 같은 뜻의 두 문서가 생겨
    // sameDrill(canonical 비교)이 둘을 다른 문서로 보고 백업 복원마다 (사본) 을 만든다.
    // 빈 맵도 키를 만들지 않는다(`locked`/`ignored` 가 빈 배열을 지우는 것과 같은 절약).
    const ringsMap: PoseMap<BallId, StoredBallRing> = {};
    const ringsRaw = isRecord(rawStep.ballRings) ? rawStep.ballRings : {};
    for (const [key, val] of Object.entries(ringsRaw)) {
      // 그 스텝의 판에 없는 공의 링은 뜻이 없다 — 좌표와 같은 기준으로 떨군다.
      if (!ballIds.has(key) || ballsMap[key as BallId] === undefined) {
        orphanDropped = true;
        continue;
      }
      if (val === '3m' || val === '5m') ringsMap[key as BallId] = val;
    }
    // 세트피스 소유(2026-08-27) — 링과 같은 규약이다. **5 m 가 아닌 공의 소유는 뜻이 없어
    // 버린다**: 3 m(2-on-1)는 누가 차는가와 무관한 규칙이라, 남겨 두면 "보이지도 판정되지도
    // 않는데 파일에는 있는" 값이 되어 sameDrill 비교만 흔든다.
    const ownerMap: PoseMap<BallId, TeamSide> = {};
    const ownerRaw = isRecord(rawStep.ballOwner) ? rawStep.ballOwner : {};
    for (const [key, val] of Object.entries(ownerRaw)) {
      if (!ballIds.has(key) || ballsMap[key as BallId] === undefined) {
        orphanDropped = true;
        continue;
      }
      if (ringsMap[key as BallId] !== '5m') continue;
      if (val === 'home' || val === 'away') ownerMap[key as BallId] = val;
    }
    const conesMap: PoseMap<ConeId, Vec2> = {};
    const conesRaw = isRecord(rawStep.cones) ? rawStep.cones : {};
    for (const [key, val] of Object.entries(conesRaw)) {
      if (!coneIds.has(key)) {
        orphanDropped = true;
        continue;
      }
      const p = sanitizeVec(val, courtMode, courtSize);
      if (p) conesMap[key as ConeId] = p;
    }
    if (orphanDropped) pushRepair(repairs, 'steps.pose', 'cast 에 없는 pose 제거', true);

    const arrows = sanitizeArrows(rawStep.arrows, repairs);
    const notes = sanitizeNotes(rawStep.notes, courtMode, courtSize, repairs);
    const shapes = sanitizeShapes(rawStep.shapes, courtMode, courtSize, repairs);
    const strokes = sanitizeStrokes(rawStep.strokes, repairs);
    // 개체 상태 플래그(2026-08-14). **살아 있는 id 만 남긴다** — 지워진 개체의 id 가 목록에
    // 남으면 그 스텝은 영영 "무언가 잠겨 있는데 화면에는 없는" 상태가 되고, 사람이 풀 방법이 없다.
    const alive = new Set<string>([
      ...Object.keys(chairsMap),
      ...Object.keys(ballsMap),
      ...Object.keys(conesMap),
      ...arrows.map((a) => a.id),
      ...notes.map((n) => n.id),
      ...shapes.map((sh) => sh.id),
      ...strokes.map((s) => s.id),
    ]);
    const locked = sanitizeIdList(rawStep.locked, alive, 'steps.locked', repairs);
    // 무시는 **휠체어에만** 있다 — 공·콘 id 가 섞여 들어오면 물리가 그것만 조용히 빼먹는다.
    const ignored = sanitizeIdList(rawStep.ignored, new Set(Object.keys(chairsMap)), 'steps.ignored', repairs) as ChairId[];
    // 사슬 끊긴 경계(2026-08-17). **`true` 만 유효하다** — 저장형이 리터럴 타입 `true` 이므로
    // `false`·`1`·`"true"` 등은 정의역 밖이다. 조용히 캐스트하면(Boolean(...)) "cut: false" 를
    // 실은 문서가 검증을 지나 "cut: true" 로 뒤바뀌는 사고가 난다 — 여기서는 버리는 것이
    // 유일하게 안전한 반응이고, 버려도 뜻은 그대로다(키 없음 = 연결, drill.ts 교리 주석).
    const cutRaw = rawStep.cut;
    if (cutRaw !== undefined && cutRaw !== true) {
      pushRepair(repairs, 'steps.cut', 'cut 값이 true 가 아니어서 폐기(키 없음 = 연결)', true);
    }
    const cut = cutRaw === true;
    // 딜레이 없는 연결(2026-09-08). `cut` 과 **완전히 같은 정의역 규칙**이다 — `true` 만
    // 살리고 나머지는 버린다(키 없음 = 딜레이 연결).
    const seamlessRaw = rawStep.seamless;
    if (seamlessRaw !== undefined && seamlessRaw !== true) {
      pushRepair(repairs, 'steps.seamless', 'seamless 값이 true 가 아니어서 폐기(키 없음 = 딜레이 연결)', true);
    }
    // 배타(drill.ts `seamless` 교리 주석): 둘 다 있으면 **cut 이 이긴다**. 끊긴 경계에는 트윈이
    // 없으므로 트윈 길이를 정하는 키가 함께 실릴 뜻이 없다 — 남겨 두면 "끊겼는데 이어진다" 는
    // 두 뜻의 문서가 저장 가능해지고, 재생·UI 가 매번 우선순위를 따로 정하게 된다.
    if (seamlessRaw === true && cut) {
      pushRepair(repairs, 'steps.seamless', 'cut 과 seamless 가 함께 있어 seamless 를 폐기(끊김이 이긴다)', true);
    }
    const seamless = seamlessRaw === true && !cut;
    // 표시 순서(v11) — `locked` 와 같은 `alive` 기준이다. 비면 키를 안 만든다: 빈 목록은
    // "순서를 안 정했다" 이고 그건 키 없음과 같은 뜻이라, 표현이 둘이면 sameDrill(canonical
    // 비교)이 같은 문서를 다르게 본다(`strokes`·`ballRings` 와 같은 절약).
    const zOrder = sanitizeZOrder(rawStep.zOrder, alive, repairs);

    stepsOut.push({
      id,
      name,
      note,
      ...(durationMs !== undefined ? { durationMs } : {}),
      chairs: chairsMap,
      balls: ballsMap,
      ...(Object.keys(ringsMap).length > 0 ? { ballRings: ringsMap } : {}),
      ...(Object.keys(ownerMap).length > 0 ? { ballOwner: ownerMap } : {}),
      cones: conesMap,
      arrows,
      notes,
      shapes,
      // ⚠️ 비어 있으면 **키를 안 만든다**(`shapes` 와 다르다 — drill.ts 의 `strokes?` 주석).
      // 획이 없는 스텝의 모양이 v9 저장본과 같아야 왕복(내보내기→가져오기) diff 가 조용하다.
      ...(strokes.length > 0 ? { strokes } : {}),
      ...(locked.length > 0 ? { locked } : {}),
      ...(ignored.length > 0 ? { ignored } : {}),
      ...(cut ? { cut } : {}),
      ...(seamless ? { seamless } : {}),
      ...(zOrder.length > 0 ? { zOrder } : {}),
    });
  }
  if (stepsOut.length > LIMITS.maxSteps) {
    pushRepair(repairs, 'steps', '스텝 개수 상한(60) 초과 — 뒤에서 절단', true);
    stepsOut = stepsOut.slice(0, LIMITS.maxSteps);
  }
  // 11. steps 빔 → defaultStep.
  if (stepsOut.length === 0) {
    pushRepair(repairs, 'steps', '스텝이 비어 있어 기본 스텝을 생성함', false);
    stepsOut = [defaultStep(courtMode, formation, cast, courtSize)];
  }

  const drill: Drill = {
    schemaVersion,
    id: doc.id as DrillId,
    title,
    // 유형(v8) — courtSize 와 같은 부류: **스프레드가 아니라 항상 쓴다.** 검증을 지난 드릴은
    // 언제나 자기 유형을 알고 있어야 한다(없음 = 미지정이 아니라 'technical').
    drillType,
    ...(situation !== undefined ? { situation } : {}),
    level,
    durationMin,
    tags,
    ...(description !== undefined ? { description } : {}),
    ...(variation !== undefined ? { variation } : {}),
    // ★ 화이트리스트 조립부 — **여기 없는 필드는 IDB 왕복에서 소리 없이 증발한다.**
    // (v8: category·reps·sets·intervalSec 는 여기서 빠지는 것으로 폐기가 완성된다)
    ...(objective !== undefined ? { objective } : {}),
    ...(coachingPoints !== undefined ? { coachingPoints } : {}),
    ...(playersNeeded !== undefined ? { playersNeeded } : {}),
    ...(equipment !== undefined ? { equipment } : {}),
    courtMode,
    // §5.1 — **스프레드가 아니라 항상 쓴다.** courtMode·level·formation 과 같은 부류다:
    // 값이 없다는 것이 "미지정" 이 아니라 "30×18" 이라는 뜻이므로, 검증을 지난 드릴은 언제나
    // 자기 코트 크기를 알고 있어야 한다. 이 한 줄을 빼면 28×15 로 만든 드릴이 IDB 왕복
    // 한 번에 30×18 로 되돌아간다(조립부에 안 적힌 필드는 소리 없이 증발한다).
    courtSize,
    // 진영(2026-08-15). 알 수 없는 값은 **조용히 기본값으로** 접는다 — 이 필드가 틀리면
    // 골 지역 3인이 엉뚱한 팀에 걸려 코치에게 없는 반칙을 가르친다.
    defense: defense,
    formation,
    teams,
    cast,
    steps: stepsOut,
    createdAt,
    updatedAt,
  };
  return { ok: true, value: drill, repairs };
}

// ---- validateSession ----------------------------------------------------------------------------

export function validateSession(doc: unknown): ValidateResult<TrainingSession> {
  if (!isRecord(doc)) {
    return { ok: false, issues: [{ path: '', message: '문서가 객체가 아님' }] };
  }
  const issues: ValidationIssue[] = [];
  if (typeof doc.id !== 'string' || doc.id.length === 0) {
    issues.push({ path: 'id', message: 'id 가 없거나 문자열이 아님' });
  }
  // v2 — 구획 배열이 필수다(v1 의 items 는 migrateDoc 이 단일 구획으로 감싼다. 그 길을 안
  // 지난 문서가 여기 오면 실패가 맞다 — drill 의 steps 와 같은 지위).
  if (!Array.isArray(doc.phases)) issues.push({ path: 'phases', message: 'phases 가 배열이 아님' });
  const schemaVersionRaw = doc.schemaVersion;
  if (typeof schemaVersionRaw === 'number' && schemaVersionRaw > CURRENT_SESSION_SCHEMA) {
    issues.push({ path: 'schemaVersion', message: `schemaVersion(${schemaVersionRaw}) 이 지원 버전보다 큼` });
  }
  if (issues.length > 0) return { ok: false, issues };

  const repairs: Repair[] = [];
  let schemaVersion = CURRENT_SESSION_SCHEMA;
  if (
    typeof schemaVersionRaw === 'number' &&
    Number.isInteger(schemaVersionRaw) &&
    schemaVersionRaw >= 1 &&
    schemaVersionRaw <= CURRENT_SESSION_SCHEMA
  ) {
    schemaVersion = schemaVersionRaw;
  }

  const title = typeof doc.title === 'string' ? doc.title : '';
  const note = sanitizeText(doc.note, LIMITS.sessionNoteLen, 'note', '세션 메모', repairs);
  const scheduledAt = typeof doc.scheduledAt === 'number' && Number.isFinite(doc.scheduledAt) ? doc.scheduledAt : undefined;
  const location = typeof doc.location === 'string' ? doc.location : undefined;
  // 목표 총 시간(v2) — 0..상한 정수. 0 이하·비유한수는 키를 버린다(미지정과 같은 뜻).
  let goalTotalMin: number | undefined;
  if (typeof doc.goalTotalMin === 'number' && Number.isFinite(doc.goalTotalMin) && doc.goalTotalMin > 0) {
    goalTotalMin = Math.min(Math.round(doc.goalTotalMin), LIMITS.sessionGoalMinMax);
    if (goalTotalMin !== doc.goalTotalMin) pushRepair(repairs, 'goalTotalMin', `목표 시간을 1~${LIMITS.sessionGoalMinMax} 정수로 보정`, true);
  } else if (doc.goalTotalMin !== undefined) {
    pushRepair(repairs, 'goalTotalMin', '목표 시간이 양수가 아니어서 폐기(미지정)', false);
  }
  // 참가자(v2, 로스터는 3차) — 문자열 id 만 걸러 중복 제거. 실존 검증은 로스터 소유자 몫.
  let participantIds: PlayerId[] | undefined;
  if (Array.isArray(doc.participantIds)) {
    const seen = new Set<string>();
    const out: PlayerId[] = [];
    for (const v of doc.participantIds) {
      if (typeof v !== 'string' || v.length === 0 || seen.has(v)) continue;
      seen.add(v);
      out.push(v as PlayerId);
    }
    if (out.length > 0) participantIds = out;
  }
  // 팀 지목(PLAN-TEAM 결정 4·11). **실존은 확인하지 않는다** — 팀이 지워져도 세션은 남고
  // 화면이 «지워진 팀» 으로 읽는다(참가자 유령 id 와 같은 교리). 접두만 보는 이유는
  // 화이트리스트라서다: 이 검사가 없으면 임의 문자열이 teamId 자리에 눌러앉는다.
  const teamId = isId(doc.teamId, 'tm') ? doc.teamId : undefined;
  if (doc.teamId !== undefined && teamId === undefined) pushRepair(repairs, 'teamId', '팀 id 꼴이 아니어서 폐기(미지정)', false);

  // ── 구획 파싱. 항목 상한(maxSessionItems)은 **전 구획 합산**으로 센다 ──────────────────
  const itemSeen = new Set<string>();
  let itemBudget = LIMITS.maxSessionItems;
  let itemsCut = false;
  const parseItems = (raw: unknown, where: string): SessionItem[] => {
    const arr = Array.isArray(raw) ? raw : [];
    const out: SessionItem[] = [];
    for (const rawItem of arr) {
      if (!isRecord(rawItem)) continue;
      let id = typeof rawItem.id === 'string' && rawItem.id.length > 0 ? (rawItem.id as ItemId) : newId('it');
      if (itemSeen.has(id)) {
        id = newId('it');
        pushRepair(repairs, `${where}.id`, '중복 항목 id 재발급', false);
      }
      itemSeen.add(id);
      if (typeof rawItem.drillId !== 'string' || rawItem.drillId.length === 0) continue; // drillId 없는 항목은 버림
      if (itemBudget <= 0) {
        itemsCut = true;
        continue;
      }
      itemBudget--;
      const drillId = rawItem.drillId as DrillId;
      const titleCache = typeof rawItem.titleCache === 'string' ? rawItem.titleCache : '';
      const durationMinCache =
        typeof rawItem.durationMinCache === 'number' && Number.isFinite(rawItem.durationMinCache) ? rawItem.durationMinCache : 0;
      const categoryCache = typeof rawItem.categoryCache === 'string' ? rawItem.categoryCache : '';
      const item: SessionItem = { id, drillId, titleCache, durationMinCache, categoryCache };
      if (typeof rawItem.durationOverrideMin === 'number' && Number.isFinite(rawItem.durationOverrideMin)) {
        item.durationOverrideMin = rawItem.durationOverrideMin;
      }
      const itemNote = sanitizeText(rawItem.note, LIMITS.itemNoteLen, `${where}.note`, '항목 메모', repairs);
      if (itemNote !== undefined) item.note = itemNote;
      if (typeof rawItem.restAfterMin === 'number' && Number.isFinite(rawItem.restAfterMin)) {
        const rest = Math.min(Math.max(Math.round(rawItem.restAfterMin), 0), LIMITS.restAfterMinMax);
        if (rest !== rawItem.restAfterMin) pushRepair(repairs, `${where}.restAfterMin`, `휴식 시간을 0~${LIMITS.restAfterMinMax} 정수로 보정`, true);
        if (rest > 0) item.restAfterMin = rest;
      }
      out.push(item);
    }
    return out;
  };

  const phaseSeen = new Set<string>();
  let phases: SessionPhase[] = [];
  for (const rawPhase of doc.phases as unknown[]) {
    if (!isRecord(rawPhase)) continue;
    let id = typeof rawPhase.id === 'string' && rawPhase.id.length > 0 ? (rawPhase.id as SessionPhase['id']) : newId('ph');
    if (phaseSeen.has(id)) {
      id = newId('ph');
      pushRepair(repairs, 'phases.id', '중복 구획 id 재발급', false);
    }
    phaseSeen.add(id);
    let kind: SessionPhaseKind = 'custom';
    if (typeof rawPhase.kind === 'string' && (SESSION_PHASE_KINDS as readonly string[]).includes(rawPhase.kind)) {
      kind = rawPhase.kind as SessionPhaseKind;
    } else if (rawPhase.kind !== undefined) {
      pushRepair(repairs, 'phases.kind', `알 수 없는 구획 종류 '${String(rawPhase.kind)}' → 'custom'`, false);
    }
    const phaseTitle = sanitizeText(rawPhase.title, LIMITS.phaseTitleLen, 'phases.title', '구획 이름', repairs);
    let plannedMin: number | undefined;
    if (typeof rawPhase.plannedMin === 'number' && Number.isFinite(rawPhase.plannedMin) && rawPhase.plannedMin > 0) {
      plannedMin = Math.min(Math.round(rawPhase.plannedMin), LIMITS.sessionGoalMinMax);
    }
    const phase: SessionPhase = {
      id,
      kind,
      ...(phaseTitle !== undefined ? { title: phaseTitle } : {}),
      ...(plannedMin !== undefined ? { plannedMin } : {}),
      items: parseItems(rawPhase.items, 'phases.items'),
    };
    phases.push(phase);
  }
  if (itemsCut) pushRepair(repairs, 'phases.items', `세션 항목 상한(${LIMITS.maxSessionItems}) 초과 — 뒤에서 절단`, true);
  if (phases.length > LIMITS.sessionPhasesMax) {
    // 잘리는 구획의 항목까지 버리면 이중 손실이다 — 항목 예산이 남아 있으면 마지막 구획에 접는다.
    const overflow = phases.slice(LIMITS.sessionPhasesMax).flatMap((p) => p.items);
    phases = phases.slice(0, LIMITS.sessionPhasesMax);
    const last = phases[phases.length - 1]!;
    phases[phases.length - 1] = { ...last, items: [...last.items, ...overflow] };
    pushRepair(repairs, 'phases', `구획 상한(${LIMITS.sessionPhasesMax}) 초과 — 넘친 구획의 항목을 마지막 구획에 병합`, true);
  }

  const drillIds = refDrillIds(flattenSessionItems({ phases }));
  const createdAt = typeof doc.createdAt === 'number' && Number.isFinite(doc.createdAt) ? doc.createdAt : Date.now();
  const updatedAt = typeof doc.updatedAt === 'number' && Number.isFinite(doc.updatedAt) ? doc.updatedAt : Date.now();

  const session: TrainingSession = {
    schemaVersion,
    id: doc.id as SessionId,
    title,
    ...(note !== undefined ? { note } : {}),
    ...(scheduledAt !== undefined ? { scheduledAt } : {}),
    ...(location !== undefined ? { location } : {}),
    ...(goalTotalMin !== undefined ? { goalTotalMin } : {}),
    phases,
    ...(participantIds !== undefined ? { participantIds } : {}),
    ...(teamId !== undefined ? { teamId } : {}),
    drillIds,
    createdAt,
    updatedAt,
  };
  return { ok: true, value: session, repairs };
}

// ---- validateRoster (구조 개편 C3) ---------------------------------------------------------------

export function validateRoster(doc: unknown): ValidateResult<Roster> {
  if (!isRecord(doc)) {
    return { ok: false, issues: [{ path: '', message: '문서가 객체가 아님' }] };
  }
  const schemaVersionRaw = doc.schemaVersion;
  if (typeof schemaVersionRaw === 'number' && schemaVersionRaw > CURRENT_ROSTER_SCHEMA) {
    return { ok: false, issues: [{ path: 'schemaVersion', message: `schemaVersion(${schemaVersionRaw}) 이 지원 버전(${CURRENT_ROSTER_SCHEMA})보다 큼` }] };
  }
  const repairs: Repair[] = [];
  const seen = new Set<string>();
  let players: Player[] = [];
  const arr = Array.isArray(doc.players) ? doc.players : [];
  for (const raw of arr) {
    if (!isRecord(raw)) continue;
    let id = typeof raw.id === 'string' && raw.id.length > 0 ? (raw.id as Player['id']) : newId('pl');
    if (seen.has(id)) {
      id = newId('pl');
      pushRepair(repairs, 'players.id', '중복 선수 id 재발급', false);
    }
    seen.add(id);
    // 이름 없는 선수는 버린다 — 명단의 존재 이유가 이름이다(공백뿐이어도 버린다).
    const nameRaw = typeof raw.name === 'string' ? raw.name.trim() : '';
    if (nameRaw.length === 0) continue;
    const name = nameRaw.length <= LIMITS.playerNameLen ? nameRaw : nameRaw.slice(0, LIMITS.playerNameLen);
    if (name !== nameRaw) pushRepair(repairs, 'players.name', `선수 이름 길이 상한(${LIMITS.playerNameLen}) 초과 — 절단`, true);
    let klass: PFClass | undefined;
    if (typeof raw.klass === 'string' && (PF_CLASSES as readonly string[]).includes(raw.klass)) {
      klass = raw.klass as PFClass;
    } else if (raw.klass !== undefined) {
      pushRepair(repairs, 'players.klass', `알 수 없는 클래스 '${String(raw.klass)}' 폐기(미분류)`, false);
    }
    const createdAt = typeof raw.createdAt === 'number' && Number.isFinite(raw.createdAt) ? raw.createdAt : Date.now();
    const updatedAt = typeof raw.updatedAt === 'number' && Number.isFinite(raw.updatedAt) ? raw.updatedAt : Date.now();
    players.push({ id, name, ...(klass !== undefined ? { klass } : {}), createdAt, updatedAt });
  }
  if (players.length > LIMITS.rosterMax) {
    pushRepair(repairs, 'players', `선수 상한(${LIMITS.rosterMax}) 초과 — 뒤에서 절단`, true);
    players = players.slice(0, LIMITS.rosterMax);
  }
  const updatedAt = typeof doc.updatedAt === 'number' && Number.isFinite(doc.updatedAt) ? doc.updatedAt : Date.now();
  return { ok: true, value: { schemaVersion: CURRENT_ROSTER_SCHEMA, players, updatedAt }, repairs };
}

// ---- validateTeam ([팀] 메뉴, 2026-09-09 · PLAN-TEAM.md 결정 4·5·6·7·19) --------------------
//
// 다른 validate 들과 같은 계약이다: **절대 throw 하지 않고**, 파일에서 온 임의 JSON 을 먹어도
// 되며, 멱등이다(같은 값을 두 번 태워도 결과가 같다). 못 고칠 것만 issues 로 거절한다.
//
// ⚠️ **여기서 만들지 않는 필드**(결정 6·10): 성별·생년월일·사진·연락처·진단명·보호자·등급
// 상태(N/R/C)·속도검사. 화이트리스트 정화기라, 파일에 그런 키가 들어 있어도 **조용히 사라진다**
// — 그것이 이 함수가 개인정보 보호선의 일부인 이유다.

/** 색은 인라인 style 과 인쇄물로 그대로 흘러가므로 형식을 실제로 잰다 —
 *  `typeof === 'string'` 만 보면 `"red; background:url(...)"` 같은 값이 통과한다.
 *
 *  ⚠️ 2026-09-09: 이 정규식을 감싸던 `sanitizeHexColor(raw, fallback, …)`(값 하나 → 기본값으로
 *  대체)는 팀 색이 팔레트(v2)가 되며 부르는 곳이 0 이 되어 지웠다. 팔레트는 «틀린 색 하나를
 *  기본값으로 갈아 끼우는» 것이 아니라 **그 항목을 버리는** 쪽이라(sanitizePalette) 폴백 인자가
 *  뜻을 잃었다. 잰다는 규율 자체는 그대로 살아 sanitizePalette 안으로 옮겨 갔다. */
const HEX_COLOR_RE = /^#[0-9a-f]{6}$/i;

/** 0..max 정수. 값이 없으면 **키를 만들지 않는다**(sanitizeText 와 같은 규율 — undefined 키가
 *  IDB 왕복에서는 살고 JSON 왕복에서는 죽어 같은 문서가 두 모양이 된다). */
function sanitizeIntField(raw: unknown, min: number, max: number, path: string, label: string, repairs: Repair[]): number | undefined {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    if (raw !== undefined) pushRepair(repairs, path, `${label} 이 숫자가 아님 — 폐기`, false);
    return undefined;
  }
  const v = Math.min(max, Math.max(min, Math.round(raw)));
  if (v !== raw) pushRepair(repairs, path, `${label} 을 ${min}~${max} 정수로 보정`, true);
  return v;
}

const sanitizeBool = (raw: unknown): boolean | undefined => (raw === true ? true : raw === false ? false : undefined);

function sanitizeTeamPlayer(raw: unknown, seen: Set<string>, repairs: Repair[]): Player | null {
  if (!isRecord(raw)) return null;
  let id = typeof raw.id === 'string' && raw.id.length > 0 ? (raw.id as PlayerId) : newId('pl');
  if (seen.has(id)) {
    id = newId('pl');
    pushRepair(repairs, 'players.id', '중복 선수 id 재발급', false);
  }
  seen.add(id);
  // 이름 없는 선수는 버린다 — validateRoster 와 같은 규칙이다(명단의 존재 이유가 이름이다).
  const nameRaw = typeof raw.name === 'string' ? raw.name.trim() : '';
  if (nameRaw.length === 0) return null;
  const name = nameRaw.length <= LIMITS.playerNameLen ? nameRaw : nameRaw.slice(0, LIMITS.playerNameLen);
  if (name !== nameRaw) pushRepair(repairs, 'players.name', `선수 이름 길이 상한(${LIMITS.playerNameLen}) 초과 — 절단`, true);

  let klass: PFClass | undefined;
  if (typeof raw.klass === 'string' && (PF_CLASSES as readonly string[]).includes(raw.klass)) {
    klass = raw.klass as PFClass;
  } else if (raw.klass !== undefined) {
    pushRepair(repairs, 'players.klass', `알 수 없는 클래스 '${String(raw.klass)}' 폐기(미분류)`, false);
  }

  const number = sanitizeIntField(raw.number, 0, PLAYER_NUMBER_MAX, 'players.number', '등번호', repairs);
  // 상한은 **고정 리터럴이 아니라 지금 연도**다 — 리터럴로 박으면 그 해가 지나는 순간
  // 갓 태어난 선수의 연도가 조용히 깎인다.
  const birthYear = sanitizeIntField(raw.birthYear, BIRTH_YEAR_MIN, new Date().getFullYear(), 'players.birthYear', '출생 연도', repairs);
  const isCaptain = sanitizeBool(raw.isCaptain);
  const preferredGk = sanitizeBool(raw.preferredGk);
  const active = sanitizeBool(raw.active);
  const chairModel = sanitizeText(raw.chairModel, LIMITS.chairModelLen, 'players.chairModel', '체어 기종', repairs);
  const note = sanitizeText(raw.note, LIMITS.playerNoteLen, 'players.note', '선수 메모', repairs);
  const createdAt = typeof raw.createdAt === 'number' && Number.isFinite(raw.createdAt) ? raw.createdAt : Date.now();
  const updatedAt = typeof raw.updatedAt === 'number' && Number.isFinite(raw.updatedAt) ? raw.updatedAt : Date.now();

  return {
    id,
    name,
    ...(klass !== undefined ? { klass } : {}),
    ...(number !== undefined ? { number } : {}),
    ...(isCaptain === true ? { isCaptain } : {}), // false 는 키를 만들지 않는다 = 기본값
    ...(preferredGk === true ? { preferredGk } : {}),
    ...(active === false ? { active } : {}), // 기본이 활성이라 false 만 기록한다
    ...(birthYear !== undefined ? { birthYear } : {}),
    ...(chairModel !== undefined ? { chairModel } : {}),
    ...(note !== undefined ? { note } : {}),
    createdAt,
    updatedAt,
  };
}

function sanitizeStaff(raw: unknown, seen: Set<string>, playerIds: Set<string>, repairs: Repair[]): Staff | null {
  if (!isRecord(raw)) return null;
  let id = typeof raw.id === 'string' && raw.id.length > 0 ? (raw.id as StaffId) : newId('sf');
  if (seen.has(id)) {
    id = newId('sf');
    pushRepair(repairs, 'staff.id', '중복 스태프 id 재발급', false);
  }
  seen.add(id);
  const nameRaw = typeof raw.name === 'string' ? raw.name.trim() : '';
  if (nameRaw.length === 0) return null;
  const name = nameRaw.length <= LIMITS.playerNameLen ? nameRaw : nameRaw.slice(0, LIMITS.playerNameLen);
  if (name !== nameRaw) pushRepair(repairs, 'staff.name', `스태프 이름 길이 상한(${LIMITS.playerNameLen}) 초과 — 절단`, true);

  const roles: StaffRole[] = [];
  const rawRoles = Array.isArray(raw.roles) ? raw.roles : [];
  for (const r of rawRoles) {
    if (typeof r === 'string' && (STAFF_ROLES as readonly string[]).includes(r)) {
      if (!roles.includes(r as StaffRole)) roles.push(r as StaffRole);
    } else {
      pushRepair(repairs, 'staff.roles', `알 수 없는 역할 '${String(r)}' 폐기`, false);
    }
  }
  // 겸직은 **같은 팀 선수만** 가리킬 수 있다 — 다른 팀 id 를 남기면 복제(id 재발급) 뒤에
  // 아무도 아닌 사람을 가리키는 유령 겸직이 된다.
  let playerId: PlayerId | undefined;
  if (typeof raw.playerId === 'string' && playerIds.has(raw.playerId)) playerId = raw.playerId as PlayerId;
  else if (raw.playerId !== undefined) pushRepair(repairs, 'staff.playerId', '명단에 없는 선수 겸직 참조 폐기', false);

  const note = sanitizeText(raw.note, LIMITS.playerNoteLen, 'staff.note', '스태프 메모', repairs);
  const createdAt = typeof raw.createdAt === 'number' && Number.isFinite(raw.createdAt) ? raw.createdAt : Date.now();
  const updatedAt = typeof raw.updatedAt === 'number' && Number.isFinite(raw.updatedAt) ? raw.updatedAt : Date.now();

  return {
    id,
    name,
    roles,
    ...(raw.isSeniorCoach === true ? { isSeniorCoach: true as const } : {}),
    ...(playerId !== undefined ? { playerId } : {}),
    ...(note !== undefined ? { note } : {}),
    createdAt,
    updatedAt,
  };
}

/** 라인업은 **명단의 부분집합**이어야 한다(조사 §4.2 R4 — 팀시트에 없는 선수는 출전 불가).
 *  화면은 입력을 막지 않지만(결정 8), 저장본이 명단에 없는 id 를 들고 있으면 그건 규정 위반이
 *  아니라 **깨진 문서**다 — 그 칸은 이름이 없어 그릴 수조차 없다. */
function sanitizeLineup(raw: unknown, playerIds: Set<string>, repairs: Repair[]): Lineup | undefined {
  if (!isRecord(raw)) return undefined;
  const pick = (v: unknown, path: string, budget: number): PlayerId[] => {
    const out: PlayerId[] = [];
    const arr = Array.isArray(v) ? v : [];
    for (const id of arr) {
      if (typeof id !== 'string' || !playerIds.has(id)) {
        pushRepair(repairs, path, '명단에 없는 선수 id 폐기', false);
        continue;
      }
      if (out.includes(id as PlayerId)) {
        pushRepair(repairs, path, '중복 선수 id 폐기', false);
        continue;
      }
      if (out.length >= budget) {
        pushRepair(repairs, path, `상한(${budget}) 초과 — 뒤에서 절단`, true);
        break;
      }
      out.push(id as PlayerId);
    }
    return out;
  };
  // 코트는 4칸(R1). 벤치는 잠그지 않는다(R3 — 교체는 합의로 늘릴 수 있다)지만 깨진 파일
  // 방어선으로 팀 명단 상한을 쓴다.
  const court = pick(raw.court, 'lineup.court', 4);
  const benchAll = pick(raw.bench, 'lineup.bench', LIMITS.rosterMax);
  const bench = benchAll.filter((id) => {
    if (!court.includes(id)) return true;
    pushRepair(repairs, 'lineup.bench', '코트와 벤치에 동시에 있는 선수 — 벤치에서 제거', true);
    return false;
  });
  // GK 는 **코트 안의 한 명**이어야 한다(R1). 벤치 선수를 GK 로 적은 문서는 값을 버린다 —
  // 코트로 옮겨 주면 사용자가 세운 적 없는 라인업을 앱이 지어내는 셈이 된다.
  let gk: PlayerId | undefined;
  if (typeof raw.gk === 'string' && court.includes(raw.gk as PlayerId)) gk = raw.gk as PlayerId;
  else if (raw.gk !== undefined) pushRepair(repairs, 'lineup.gk', '코트에 없는 선수의 GK 지정 폐기', false);

  if (court.length === 0 && bench.length === 0 && gk === undefined) return undefined;
  return { court, ...(gk !== undefined ? { gk } : {}), bench };
}

/** 팔레트 정화 — `#rrggbb` 만 남기고 1~`TEAM_PALETTE_MAX` 개로 맞춘다.
 *  ⚠️ **빈 팔레트를 통과시키지 않는다**: 킷은 인덱스로 색을 가리키므로 팔레트가 비면 모든 킷이
 *  가리킬 곳을 잃는다. 빈 배열·배열 아님 둘 다 `emptyTeam` 과 같은 두 색으로 되살린다(같은
 *  출처를 써야 "파일에서 복구된 팀" 과 "새로 만든 팀" 이 다른 색으로 갈라지지 않는다). */
function sanitizePalette(raw: unknown, repairs: Repair[]): string[] {
  const src = Array.isArray(raw) ? raw : [];
  if (!Array.isArray(raw) && raw !== undefined) pushRepair(repairs, 'palette', '팔레트가 배열이 아님 — 기본 팔레트로 대체', true);
  const out: string[] = [];
  for (const c of src) {
    if (typeof c === 'string' && HEX_COLOR_RE.test(c)) out.push(c);
    else pushRepair(repairs, 'palette', '색 형식(#rrggbb)이 아님 — 폐기', true);
  }
  if (out.length > TEAM_PALETTE_MAX) {
    pushRepair(repairs, 'palette', `팔레트 상한(${TEAM_PALETTE_MAX}) 초과 — 뒤에서 절단`, true);
    out.length = TEAM_PALETTE_MAX;
  }
  if (out.length === 0) {
    if (raw !== undefined) pushRepair(repairs, 'palette', '빈 팔레트 — 기본 팔레트로 대체', true);
    return [DEFAULT_TEAMS.home.color, DEFAULT_TEAMS.home.gkColor];
  }
  return out;
}

/** 킷 정화. 인덱스가 팔레트 범위 밖이면 **버리지 않고 접는다** — 파일이 가리키던 색이 사라졌다고
 *  킷 자체를 지우면, 사용자가 만들어 둔 «어웨이가 있다» 는 사실까지 함께 없어진다.
 *  - `field` → 0번
 *  - `gk` → 팔레트가 둘 이상이면 1번, 하나뿐이면 0번. GK 는 규정상 다른 색이어야 하므로(Laws)
 *    고를 수 있는 다른 색이 있을 때는 그쪽으로 접는 편이 사용자의 뜻에 가깝다.
 *  홈이 없으면 만든다. 모르는 킷 종류는 화이트리스트가 버린다(옛 `color`/`gkColor` 키도 같은 손에
 *  걸린다 — 이 함수를 지나지 못한 키는 결과 객체에 실리지 않는다). */
function sanitizeKits(raw: unknown, paletteLen: number, repairs: Repair[]): TeamKits {
  const gkFallback = paletteLen >= 2 ? 1 : 0;
  const src = isRecord(raw) ? raw : {};
  if (!isRecord(raw) && raw !== undefined) pushRepair(repairs, 'kits', '킷이 객체가 아님 — 홈 킷만 만든다', true);
  const slot = (v: unknown, path: string, fallback: number): number => {
    if (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < paletteLen) return v;
    pushRepair(repairs, path, `팔레트에 없는 색 번호 — ${fallback}번으로 대체`, true);
    return fallback;
  };
  const one = (v: unknown, kind: string): TeamKit => {
    const r = isRecord(v) ? v : {};
    return { field: slot(r.field, `kits.${kind}.field`, 0), gk: slot(r.gk, `kits.${kind}.gk`, gkFallback) };
  };
  const home = isRecord(src.home) ? one(src.home, 'home') : { field: 0, gk: gkFallback };
  if (!isRecord(src.home)) pushRepair(repairs, 'kits.home', '홈 킷 없음 — 기본 홈 킷을 만든다', true);
  const kits: TeamKits = { home };
  for (const kind of TEAM_KIT_KINDS) {
    if (kind === 'home') continue;
    if (isRecord(src[kind])) kits[kind] = one(src[kind], kind);
    else if (src[kind] !== undefined) pushRepair(repairs, `kits.${kind}`, '킷이 객체가 아님 — 폐기', false);
  }
  for (const key of Object.keys(src)) {
    if (!(TEAM_KIT_KINDS as readonly string[]).includes(key)) pushRepair(repairs, `kits.${key}`, '알 수 없는 킷 종류 — 폐기', false);
  }
  return kits;
}

export function validateTeam(doc: unknown): ValidateResult<Team> {
  if (!isRecord(doc)) {
    return { ok: false, issues: [{ path: '', message: '문서가 객체가 아님' }] };
  }
  const schemaVersionRaw = doc.schemaVersion;
  if (typeof schemaVersionRaw === 'number' && schemaVersionRaw > CURRENT_TEAM_SCHEMA) {
    return { ok: false, issues: [{ path: 'schemaVersion', message: `schemaVersion(${schemaVersionRaw}) 이 지원 버전(${CURRENT_TEAM_SCHEMA})보다 큼` }] };
  }
  const repairs: Repair[] = [];
  const id = typeof doc.id === 'string' && doc.id.length > 0 ? (doc.id as TeamId) : newId('tm');

  const nameRaw = typeof doc.name === 'string' ? doc.name.trim() : '';
  let name = nameRaw.slice(0, LIMITS.teamNameLen);
  if (name.length !== nameRaw.length) pushRepair(repairs, 'name', `팀 이름 길이 상한(${LIMITS.teamNameLen}) 초과 — 절단`, true);
  // 이름 없는 팀은 **거절하지 않고** 기본 이름을 준다 — 드릴 제목이 ''를 허용하는 것과 달리
  // 팀은 목록 카드·세션 드롭다운에서 이름으로만 식별되므로 빈 이름은 고를 수 없는 항목이 된다.
  if (name.length === 0) {
    name = defaultTeamName();
    if (doc.name !== undefined) pushRepair(repairs, 'name', '빈 팀 이름 — 기본 이름으로 대체', true);
  }

  const shortName = sanitizeText(typeof doc.shortName === 'string' ? doc.shortName.trim() : doc.shortName, LIMITS.shortNameLen, 'shortName', '약칭', repairs);
  const palette = sanitizePalette(doc.palette, repairs);
  const kits = sanitizeKits(doc.kits, palette.length, repairs);
  const league = sanitizeText(doc.league, LIMITS.teamLeagueLen, 'league', '리그', repairs);
  const season = sanitizeText(doc.season, LIMITS.teamSeasonLen, 'season', '시즌', repairs);
  const note = sanitizeText(doc.note, LIMITS.teamNoteLen, 'note', '팀 메모', repairs);

  const seenPlayers = new Set<string>();
  let players: Player[] = [];
  for (const raw of Array.isArray(doc.players) ? doc.players : []) {
    const p = sanitizeTeamPlayer(raw, seenPlayers, repairs);
    if (p) players.push(p);
  }
  if (players.length > LIMITS.rosterMax) {
    pushRepair(repairs, 'players', `선수 상한(${LIMITS.rosterMax}) 초과 — 뒤에서 절단`, true);
    players = players.slice(0, LIMITS.rosterMax);
  }
  // 주장은 **팀당 1명**(결정 6). 둘째부터 키를 지운다 — 인쇄된 팀시트에 완장이 둘이면
  // 그 문서는 규정 문서로서 못 쓴다(Laws L329-330 상 팀시트는 실재하는 서류다).
  let captainSeen = false;
  players = players.map((p) => {
    if (p.isCaptain !== true) return p;
    if (!captainSeen) {
      captainSeen = true;
      return p;
    }
    pushRepair(repairs, 'players.isCaptain', '주장은 팀당 1명 — 두 번째부터 해제', true);
    const { isCaptain: _drop, ...rest } = p;
    return rest;
  });

  const playerIds = new Set<string>(players.map((p) => p.id));
  const seenStaff = new Set<string>();
  let staff: Staff[] = [];
  for (const raw of Array.isArray(doc.staff) ? doc.staff : []) {
    const s = sanitizeStaff(raw, seenStaff, playerIds, repairs);
    if (s) staff.push(s);
  }
  if (staff.length > LIMITS.staffMax) {
    pushRepair(repairs, 'staff', `스태프 상한(${LIMITS.staffMax}) 초과 — 뒤에서 절단`, true);
    staff = staff.slice(0, LIMITS.staffMax);
  }
  // 선임 코치도 1명 — 벤치 제재를 승계하는 사람이라 둘이면 누가 받는지가 정해지지 않는다.
  let seniorSeen = false;
  staff = staff.map((s) => {
    if (s.isSeniorCoach !== true) return s;
    if (!seniorSeen) {
      seniorSeen = true;
      return s;
    }
    pushRepair(repairs, 'staff.isSeniorCoach', '선임 코치는 팀당 1명 — 두 번째부터 해제', true);
    const { isSeniorCoach: _drop, ...rest } = s;
    return rest;
  });

  const lineup = sanitizeLineup(doc.lineup, playerIds, repairs);
  const createdAt = typeof doc.createdAt === 'number' && Number.isFinite(doc.createdAt) ? doc.createdAt : Date.now();
  const updatedAt = typeof doc.updatedAt === 'number' && Number.isFinite(doc.updatedAt) ? doc.updatedAt : Date.now();

  return {
    ok: true,
    value: {
      schemaVersion: CURRENT_TEAM_SCHEMA,
      id,
      name,
      ...(shortName !== undefined && shortName.length > 0 ? { shortName } : {}),
      palette,
      kits,
      ...(league !== undefined ? { league } : {}),
      ...(season !== undefined ? { season } : {}),
      ...(note !== undefined ? { note } : {}),
      players,
      staff,
      ...(lineup !== undefined ? { lineup } : {}),
      createdAt,
      updatedAt,
    },
    repairs,
  };
}
