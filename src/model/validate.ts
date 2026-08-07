// §3.8 검증·보정. zod 등 런타임 스키마 라이브러리 미사용(의존성 0). 절대 throw 하지 않는다 —
// 파일에서 온 임의 JSON 을 먹어도 된다. 11단계 고정 순서 파이프라인, 멱등.
import { newId } from '../core/ids.ts';
import type { ChairId, BallId, ConeId, StepId, ArrowId, NoteId, DrillId, SessionId, ItemId } from '../core/ids.ts';
import type { Vec2 } from '../core/units.ts';
import { COURT_MODES, clampToViewBox, type CourtMode } from './court.ts';
import { FORMATIONS, defaultStep, DEFAULT_TEAMS } from './defaults.ts';
import { CURRENT_DRILL_SCHEMA, DRILL_LEVELS } from './drill.ts';
import type { Drill, DrillCast, ChairDef, BallDef, ConeDef, TeamStyle, TeamSide, DrillLevel, PoseMap, NoteLabel } from './drill.ts';
import type { StoredChairPose } from './chair.ts';
import type { Arrow, ArrowKind } from './arrow.ts';
import { CURRENT_SESSION_SCHEMA } from './session.ts';
import type { TrainingSession, SessionItem } from './session.ts';
import { refDrillIds } from './refs.ts';

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

export const LIMITS = {
  titleLen: 80,
  stepNameLen: 40,
  noteLen: 600,
  tagCount: 12,
  tagLen: 24,
  maxSteps: 60,
  maxBalls: 10,
  maxChairsPerTeam: 4,
  maxCones: 2000, // REQUIREMENTS 는 '제한 없음' — 이건 깨진 파일 방어용 상한
  maxArrowsPerStep: 40,
  maxNotesPerStep: 20,
  maxSessionItems: 40,
} as const;

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const pushRepair = (repairs: Repair[], path: string, message: string, destructive: boolean): void => {
  repairs.push({ path, message, destructive });
};

// ---- §3.8 단계 6/7/8/9 결합: 좌표 유한성 → 각도 보정 → 클램프 → 반올림 -----------------------

function sanitizeChairPose(raw: unknown, mode: CourtMode): StoredChairPose | null {
  if (!isRecord(raw)) return null;
  const x = typeof raw.x === 'number' ? raw.x : NaN;
  const y = typeof raw.y === 'number' ? raw.y : NaN;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null; // 6: 유한하지 않으면 제거
  let a = typeof raw.angleDeg === 'number' ? raw.angleDeg : NaN;
  if (!Number.isFinite(a)) a = 0; // 7
  else if (Math.abs(a) > 36000) a = ((a % 360) + 360) % 360; // 7
  const clamped = clampToViewBox(mode, { x, y }); // 8
  return {
    x: Math.round(clamped.x * 10) / 10, // 9
    y: Math.round(clamped.y * 10) / 10,
    angleDeg: Math.round(a * 10) / 10,
  };
}

function sanitizeVec(raw: unknown, mode: CourtMode): Vec2 | null {
  if (!isRecord(raw)) return null;
  const x = typeof raw.x === 'number' ? raw.x : NaN;
  const y = typeof raw.y === 'number' ? raw.y : NaN;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const clamped = clampToViewBox(mode, { x, y });
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
    if (typeof item.name === 'string') def.name = item.name;
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

function sanitizeTeamStyle(raw: unknown, fallback: TeamStyle): TeamStyle {
  if (!isRecord(raw)) return { ...fallback };
  return {
    label: typeof raw.label === 'string' ? raw.label : fallback.label,
    color: typeof raw.color === 'string' ? raw.color : fallback.color,
    gkColor: typeof raw.gkColor === 'string' ? raw.gkColor : fallback.gkColor,
  };
}

// ---- 화살표·메모 -----------------------------------------------------------------------------

function sanitizeArrow(raw: unknown): Arrow | null {
  if (!isRecord(raw)) return null;
  const id = typeof raw.id === 'string' && raw.id.length > 0 ? (raw.id as ArrowId) : newId('ar');
  const kindRaw = raw.kind;
  const kind: ArrowKind = kindRaw === 'move' || kindRaw === 'pass' || kindRaw === 'shot' ? kindRaw : 'move';
  const from = sanitizeFreeVec(raw.from);
  const ctrl = sanitizeFreeVec(raw.ctrl);
  const to = sanitizeFreeVec(raw.to);
  if (!from || !ctrl || !to) return null;
  const arrow: Arrow = { id, kind, from, ctrl, to };
  if (typeof raw.color === 'string') arrow.color = raw.color;
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

function sanitizeNote(raw: unknown, mode: CourtMode, repairs: Repair[]): NoteLabel | null {
  if (!isRecord(raw)) return null;
  const id = typeof raw.id === 'string' && raw.id.length > 0 ? (raw.id as NoteId) : newId('nt');
  const p = sanitizeVec(raw, mode);
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

function sanitizeNotes(raw: unknown, mode: CourtMode, repairs: Repair[]): NoteLabel[] {
  const arr = Array.isArray(raw) ? raw : [];
  const seen = new Set<string>();
  let out: NoteLabel[] = [];
  for (const item of arr) {
    const n = sanitizeNote(item, mode, repairs);
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
    home: sanitizeTeamStyle(isRecord(doc.teams) ? doc.teams.home : undefined, DEFAULT_TEAMS.home),
    away: sanitizeTeamStyle(isRecord(doc.teams) ? doc.teams.away : undefined, DEFAULT_TEAMS.away),
  };

  let title = typeof doc.title === 'string' ? doc.title : '';
  if (title.length > LIMITS.titleLen) {
    pushRepair(repairs, 'title', '제목 길이 상한(80) 초과 — 절단', true);
    title = title.slice(0, LIMITS.titleLen);
  }
  const category = typeof doc.category === 'string' ? doc.category : '기타';
  const level: DrillLevel = (DRILL_LEVELS as readonly string[]).includes(doc.level as string)
    ? (doc.level as DrillLevel)
    : '초급';
  const durationMin = typeof doc.durationMin === 'number' && Number.isFinite(doc.durationMin) ? doc.durationMin : 10;
  const description = typeof doc.description === 'string' ? doc.description : undefined;

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
      const pose = sanitizeChairPose(val, courtMode);
      if (pose) chairsMap[key as ChairId] = pose;
    }
    const ballsMap: PoseMap<BallId, Vec2> = {};
    const ballsRaw = isRecord(rawStep.balls) ? rawStep.balls : {};
    for (const [key, val] of Object.entries(ballsRaw)) {
      if (!ballIds.has(key)) {
        orphanDropped = true;
        continue;
      }
      const p = sanitizeVec(val, courtMode);
      if (p) ballsMap[key as BallId] = p;
    }
    const conesMap: PoseMap<ConeId, Vec2> = {};
    const conesRaw = isRecord(rawStep.cones) ? rawStep.cones : {};
    for (const [key, val] of Object.entries(conesRaw)) {
      if (!coneIds.has(key)) {
        orphanDropped = true;
        continue;
      }
      const p = sanitizeVec(val, courtMode);
      if (p) conesMap[key as ConeId] = p;
    }
    if (orphanDropped) pushRepair(repairs, 'steps.pose', 'cast 에 없는 pose 제거', true);

    const arrows = sanitizeArrows(rawStep.arrows, repairs);
    const notes = sanitizeNotes(rawStep.notes, courtMode, repairs);

    stepsOut.push({
      id,
      name,
      note,
      ...(durationMs !== undefined ? { durationMs } : {}),
      chairs: chairsMap,
      balls: ballsMap,
      cones: conesMap,
      arrows,
      notes,
    });
  }
  if (stepsOut.length > LIMITS.maxSteps) {
    pushRepair(repairs, 'steps', '스텝 개수 상한(60) 초과 — 뒤에서 절단', true);
    stepsOut = stepsOut.slice(0, LIMITS.maxSteps);
  }
  // 11. steps 빔 → defaultStep.
  if (stepsOut.length === 0) {
    pushRepair(repairs, 'steps', '스텝이 비어 있어 기본 스텝을 생성함', false);
    stepsOut = [defaultStep(courtMode, formation, cast)];
  }

  const drill: Drill = {
    schemaVersion,
    id: doc.id as DrillId,
    title,
    category,
    level,
    durationMin,
    tags,
    ...(description !== undefined ? { description } : {}),
    courtMode,
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
  if (!Array.isArray(doc.items)) issues.push({ path: 'items', message: 'items 가 배열이 아님' });
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
  const note = typeof doc.note === 'string' ? doc.note : undefined;
  const scheduledAt = typeof doc.scheduledAt === 'number' && Number.isFinite(doc.scheduledAt) ? doc.scheduledAt : undefined;
  const location = typeof doc.location === 'string' ? doc.location : undefined;

  const seen = new Set<string>();
  let items: SessionItem[] = [];
  for (const raw of doc.items as unknown[]) {
    if (!isRecord(raw)) continue;
    let id = typeof raw.id === 'string' && raw.id.length > 0 ? (raw.id as ItemId) : newId('it');
    if (seen.has(id)) {
      id = newId('it');
      pushRepair(repairs, 'items.id', '중복 항목 id 재발급', false);
    }
    seen.add(id);
    if (typeof raw.drillId !== 'string' || raw.drillId.length === 0) continue; // drillId 없는 항목은 버림
    const drillId = raw.drillId as DrillId;
    const titleCache = typeof raw.titleCache === 'string' ? raw.titleCache : '';
    const durationMinCache =
      typeof raw.durationMinCache === 'number' && Number.isFinite(raw.durationMinCache) ? raw.durationMinCache : 0;
    const categoryCache = typeof raw.categoryCache === 'string' ? raw.categoryCache : '';
    const item: SessionItem = { id, drillId, titleCache, durationMinCache, categoryCache };
    if (typeof raw.durationOverrideMin === 'number' && Number.isFinite(raw.durationOverrideMin)) {
      item.durationOverrideMin = raw.durationOverrideMin;
    }
    if (typeof raw.note === 'string') item.note = raw.note;
    if (typeof raw.restAfterMin === 'number' && Number.isFinite(raw.restAfterMin)) item.restAfterMin = raw.restAfterMin;
    items.push(item);
  }
  if (items.length > LIMITS.maxSessionItems) {
    pushRepair(repairs, 'items', '세션 항목 상한(40) 초과 — 뒤에서 절단', true);
    items = items.slice(0, LIMITS.maxSessionItems);
  }

  const drillIds = refDrillIds(items);
  const createdAt = typeof doc.createdAt === 'number' && Number.isFinite(doc.createdAt) ? doc.createdAt : Date.now();
  const updatedAt = typeof doc.updatedAt === 'number' && Number.isFinite(doc.updatedAt) ? doc.updatedAt : Date.now();

  const session: TrainingSession = {
    schemaVersion,
    id: doc.id as SessionId,
    title,
    ...(note !== undefined ? { note } : {}),
    ...(scheduledAt !== undefined ? { scheduledAt } : {}),
    ...(location !== undefined ? { location } : {}),
    items,
    drillIds,
    createdAt,
    updatedAt,
  };
  return { ok: true, value: session, repairs };
}
