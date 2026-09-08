// §4.7 내보내기/가져오기. 봉투에 별도 schemaVersion 을 두지 않는다 — payload 가 자기 버전을
// 들고 있고 두 벌은 어긋난다. envelope > ENVELOPE_VERSION → E_SCHEMA_TOO_NEW, 모르는 spin 값 →
// E_UNSUPPORTED_KIND(kind). 'drillSet' 은 파싱은 되고(SpinFile 유니온에 존재) 커밋만 거부한다 —
// prepareDrillImport/prepareSessionImport 가 자신이 다루지 않는 spin 종류를 받으면 여기서 던진다.
//
// §6.1b 'backup'(기기 이사 파일)이 여섯 번째 kind 로 들어온다. **봉투 버전도, payload 스키마
// 버전도 올리지 않는다** — ENVELOPE_VERSION 은 1 그대로고 payload 안의 드릴은 schemaVersion 2,
// prefs 는 2, 세션은 1, 판은 1 을 그대로 싣는다. 봉투 버전과 문서 스키마 버전은 별개 축이라,
// 담는 그릇이 하나 늘었다고 문서 버전을 올리면 migrate.ts 의 마이그레이션 계약(v1→v2 를 "한 번만
// 올린다" 는 결정)이 통째로 흔들리고 기존 파일이 전부 too-new 가 된다.
import { getDB, beginWrite, endWrite, toStorageError } from './db.ts';
import { StorageError, STORAGE_ERROR_MESSAGES } from './errors.ts';
import type { Drill } from '../model/drill.ts';
import { CURRENT_DRILL_SCHEMA, isStepEmpty } from '../model/drill.ts';
import type { TrainingSession, SessionItem } from '../model/session.ts';
import { CURRENT_SESSION_SCHEMA } from '../model/session.ts';
import { validateDrill, validateSession, validateRoster, type Repair } from '../model/validate.ts';
import { migrateDoc, DRILL_MIGRATIONS, SESSION_MIGRATIONS, PREFS_MIGRATIONS , ROSTER_MIGRATIONS } from '../model/migrate.ts';
import { refDrillIds, remapRefs } from '../model/refs.ts';
import { buildSummary } from '../model/summary.ts';
import { newId } from '../core/ids.ts';
import type { DrillId, SessionId } from '../core/ids.ts';
import type { Preferences } from './prefs.ts';
import { CURRENT_PREFS_SCHEMA, validatePrefs, savePrefs, loadPrefs } from './prefs.ts';
import type { BoardSnapshot } from './board.ts';
import { CURRENT_BOARD_SCHEMA, loadBoard, saveBoard } from './board.ts';
import { putSession } from './sessionRepo.ts';
import { putTeam } from './teamRepo.ts';
import { loadRoster, saveRoster } from './rosterRepo.ts';
import { CURRENT_ROSTER_SCHEMA, type Roster } from '../model/roster.ts';
import { CURRENT_TEAM_SCHEMA, type Team } from '../model/team.ts';
import { validateTeam } from '../model/validate.ts';
import { TEAM_MIGRATIONS } from '../model/migrate.ts';
import type { TeamId } from '../core/ids.ts';

export const ENVELOPE_VERSION = 1;
/** ⚠️ 2026-09-09 — 'team'([팀] 메뉴, PLAN-TEAM.md 결정 13)이 일곱 번째 kind 다. **봉투 버전은
 *  1 그대로**다: 그릇이 하나 늘어난 것이지 그릇의 문법이 바뀐 것이 아니다(위 §6.1b 와 같은 판단).
 *  옛 앱이 이 파일을 열면 `E_UNSUPPORTED_KIND('team')` 로 정직하게 거절한다 — 봉투 버전을
 *  올렸다면 그 앱은 «너무 새 파일» 이라며 **기존 드릴 파일까지** 못 열게 됐을 것이다. */
export type SpinFileKind = 'drill' | 'session' | 'library' | 'prefs' | 'drillSet' | 'backup' | 'team';
const KNOWN_KINDS: readonly SpinFileKind[] = ['drill', 'session', 'library', 'prefs', 'drillSet', 'backup', 'team'];

export interface SpinEnvelopeBase {
  spin: SpinFileKind;
  envelope: number;
  app: string;
  exportedAt: number;
}

/** §6.1b 기기 이사 파일의 payload. **이 앱이 영구 저장하는 다섯 곳이 전부 여기에 모인다** —
 *  IDB `drills` · IDB `sessions` · IDB `teams` · localStorage `spin.prefs` · localStorage `spin.board`.
 *  하나라도 빠지면 사용자는 "백업했다" 고 믿은 채로 그것을 잃는다(이 항목의 존재 이유다).
 *  ── ⚠️ 2026-09-09: 위 «네 곳» 은 [팀] 메뉴(PLAN-TEAM.md 결정 2·13)로 다섯이 됐다. 이 문장은
 *  숫자를 세는 장식이 아니라 **새 저장처를 만들 때 여기를 고치라는 표식**이다 — 새 IDB 스토어를
 *  파고 이 목록을 안 고치면 백업이 조용히 거짓말을 시작한다. ──
 *  판(board)은 한 번도 연 적이 없으면 없는 것이 정상이라 `null` 을 허용한다 — 없는 것을 빈
 *  기본 판으로 채워 내보내면 복원이 남의 기기 판을 기본값으로 덮어쓰는 길이 열린다. */
export interface BackupPayload {
  drills: Drill[];
  sessions: TrainingSession[];
  prefs: Preferences;
  board: BoardSnapshot | null;
  /** 로스터(C3, 2026-08-18). **optional 이고 ENVELOPE_VERSION 은 1 그대로다** — 그릇이 아니라
   *  내용의 축이고, 구 백업 파일엔 이 키가 없으며 없으면 복원이 건너뛴다(backup kind 를 더할 때
   *  세운 그 원칙). 빈 명단은 키를 생략한다 — 없는 것과 빈 것이 같은 뜻이라서다. */
  roster?: Roster;
  /** 팀 전량([팀] 메뉴, 2026-09-09 · 결정 13). roster 와 같은 규율로 **optional** 이고 봉투
   *  버전은 1 그대로다 — 옛 백업엔 이 키가 없고, 없으면 복원이 건너뛴다. 팀이 0개면 키를
   *  생략한다. ⚠️ 등급(`klass`) 제외 옵션은 **여기 없다**: 기기 이사 파일은 내 기기에서 내
   *  기기로 가는 통짜 사본이라 빼면 그냥 데이터를 잃는다. 남에게 건네는 한 팀짜리 파일
   *  (`exportTeamFile`)에만 그 스위치가 있다(결정 13). */
  teams?: Team[];
}

export type SpinFile =
  | (SpinEnvelopeBase & { spin: 'drill'; payload: Drill })
  | (SpinEnvelopeBase & { spin: 'session'; payload: { session: TrainingSession; drills: Drill[] } })
  | (SpinEnvelopeBase & { spin: 'library'; payload: Drill[] })
  | (SpinEnvelopeBase & { spin: 'prefs'; payload: Preferences })
  | (SpinEnvelopeBase & { spin: 'backup'; payload: BackupPayload })
  | (SpinEnvelopeBase & { spin: 'team'; payload: Team })
  | (SpinEnvelopeBase & { spin: 'drillSet'; payload: unknown }); // 파싱은 되고 커밋만 거부

export type ImportConflict = 'none' | 'identical' | 'exists';
export interface ImportCandidate<T> {
  doc: T;
  repairs: Repair[];
  conflict: ImportConflict;
  existing?: { title: string; updatedAt: number };
}
export type ImportResolution = 'overwrite' | 'copy' | 'skip';
export interface ImportOutcome {
  idMap: Map<DrillId, DrillId>; // 원본 id → 최종 저장 id ('skip'/'overwrite' 는 항등)
  written: DrillId[];
  skipped: DrillId[];
  failed: Array<{ id: DrillId; reason: string }>;
}

const APP_NAME = 'SPIN';
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

// ---- 파싱 -----------------------------------------------------------------------------------

export function parseSpinFile(text: string): SpinFile {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (e) {
    throw new StorageError('E_INVALID_FILE', STORAGE_ERROR_MESSAGES.E_INVALID_FILE(), { cause: e });
  }
  if (!isRecord(json)) throw new StorageError('E_INVALID_FILE', STORAGE_ERROR_MESSAGES.E_INVALID_FILE());
  const { spin, envelope, app, exportedAt } = json;
  if (typeof spin !== 'string' || typeof envelope !== 'number' || typeof app !== 'string' || typeof exportedAt !== 'number' || !('payload' in json)) {
    throw new StorageError('E_INVALID_FILE', STORAGE_ERROR_MESSAGES.E_INVALID_FILE());
  }
  if (envelope > ENVELOPE_VERSION) {
    throw new StorageError('E_SCHEMA_TOO_NEW', STORAGE_ERROR_MESSAGES.E_SCHEMA_TOO_NEW());
  }
  if (!KNOWN_KINDS.includes(spin as SpinFileKind)) {
    throw new StorageError('E_UNSUPPORTED_KIND', STORAGE_ERROR_MESSAGES.E_UNSUPPORTED_KIND(spin), { detail: spin });
  }
  return json as unknown as SpinFile;
}

// ---- sameDrill: 정규 형태 비교 ----------------------------------------------------------------
// JSON.stringify(a)===JSON.stringify(b) 는 키 순서(structuredClone vs JSON.parse)와 undefined
// optional 에 민감해서, 어제 내보낸 파일을 그대로 다시 가져와도 3택 다이얼로그가 뜨고 엔터 한 번에
// 동일 내용 중복이 생긴다.

function canonical(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(canonical);
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return Object.keys(o)
      .sort()
      .filter((k) => o[k] !== undefined)
      .reduce<Record<string, unknown>>((a, k) => {
        a[k] = canonical(o[k]);
        return a;
      }, {});
  }
  return typeof v === 'number' ? Math.round(v * 10) / 10 : v;
}

function stripUpdatedAt<T extends { updatedAt: number }>(d: T): Omit<T, 'updatedAt'> {
  const { updatedAt, ...rest } = d;
  void updatedAt;
  return rest;
}

/** 저장 문서 2개가 "같은 내용" 인가 — updatedAt 만 다른 것은 같다고 본다. 드릴과 세션이 공유한다
 *  (세션 쪽 사용처: restoreBackup 의 id 충돌 판정. 같은 백업을 두 번 복원해도 세션이 두 벌로
 *  불어나지 않게 하는 유일한 장치다). */
const sameSaved = <T extends { updatedAt: number }>(a: T, b: T): boolean =>
  JSON.stringify(canonical(stripUpdatedAt(a))) === JSON.stringify(canonical(stripUpdatedAt(b)));

export const sameDrill = (a: Drill, b: Drill): boolean => sameSaved(a, b);

// ---- 가져오기 준비 ----------------------------------------------------------------------------

async function existingDrillFor(id: DrillId): Promise<Drill | undefined> {
  try {
    const db = await getDB();
    return await db.get('drills', id);
  } catch {
    return undefined;
  }
}

/** 배치 내 중복 DrillId 검사 필수 — 안 그러면 손상된 library 파일이 "드릴 2개를 가져왔습니다" 를
 *  보여주면서 실제로는 1개만 남긴다(TOCTOU). 뒤쪽 항목을 conflict:'exists' 로 표시한다. */
async function prepareDrillCandidates(raws: unknown[]): Promise<ImportCandidate<Drill>[]> {
  const out: ImportCandidate<Drill>[] = [];
  const seenInBatch = new Map<DrillId, ImportCandidate<Drill>>();
  for (const raw of raws) {
    const mig = migrateDoc(raw, DRILL_MIGRATIONS, CURRENT_DRILL_SCHEMA);
    if (!mig.ok) continue; // too-new/no-path 항목은 배치에서 조용히 제외
    const v = validateDrill(mig.doc);
    if (!v.ok) continue;
    const doc = v.value;
    const dup = seenInBatch.get(doc.id);
    let candidate: ImportCandidate<Drill>;
    if (dup) {
      candidate = { doc, repairs: v.repairs, conflict: 'exists', existing: { title: dup.doc.title, updatedAt: dup.doc.updatedAt } };
    } else {
      const existing = await existingDrillFor(doc.id);
      if (!existing) {
        candidate = { doc, repairs: v.repairs, conflict: 'none' };
      } else if (sameDrill(existing, doc)) {
        candidate = { doc, repairs: v.repairs, conflict: 'identical', existing: { title: existing.title, updatedAt: existing.updatedAt } };
      } else {
        candidate = { doc, repairs: v.repairs, conflict: 'exists', existing: { title: existing.title, updatedAt: existing.updatedAt } };
      }
    }
    seenInBatch.set(doc.id, candidate);
    out.push(candidate);
  }
  return out;
}

export async function prepareDrillImport(file: SpinFile): Promise<ImportCandidate<Drill>[]> {
  if (file.spin === 'drill') return prepareDrillCandidates([file.payload]);
  if (file.spin === 'library') return prepareDrillCandidates(file.payload);
  throw new StorageError('E_UNSUPPORTED_KIND', STORAGE_ERROR_MESSAGES.E_UNSUPPORTED_KIND(file.spin), { detail: file.spin });
}

export async function prepareSessionImport(file: SpinFile): Promise<{
  drills: ImportCandidate<Drill>[];
  session: ImportCandidate<TrainingSession>;
}> {
  if (file.spin !== 'session') {
    throw new StorageError('E_UNSUPPORTED_KIND', STORAGE_ERROR_MESSAGES.E_UNSUPPORTED_KIND(file.spin), { detail: file.spin });
  }
  const drills = await prepareDrillCandidates(file.payload.drills);
  const mig = migrateDoc(file.payload.session, SESSION_MIGRATIONS, CURRENT_SESSION_SCHEMA);
  const v = mig.ok ? validateSession(mig.doc) : undefined;
  if (!v || !v.ok) {
    throw new StorageError('E_INVALID_FILE', STORAGE_ERROR_MESSAGES.E_INVALID_FILE());
  }
  // 세션 자체는 파일에서 온 항상 새로운 문서로 취급한다 — 드릴처럼 로컬본과 겹칠 경우를 3택으로
  // 묻는 대상이 아니다(§4.7 은 드릴 id 충돌만 다룬다).
  const session: ImportCandidate<TrainingSession> = { doc: v.value, repairs: v.repairs, conflict: 'none' };
  return { drills, session };
}

// ---- 커밋 -----------------------------------------------------------------------------------

/** 배치 커밋. 드릴 + 요약을 하나의 readwrite 트랜잭션에서 쓰고, 커밋 직전에 conflict 를
 *  재확인한다(TOCTOU). candidate.doc 은 변형하지 않는다(옛 id 를 읽어야 하므로). */
export async function commitDrillImports(
  items: Array<{ candidate: ImportCandidate<Drill>; resolution: ImportResolution }>,
): Promise<ImportOutcome> {
  const idMap = new Map<DrillId, DrillId>();
  const written: DrillId[] = [];
  const skipped: DrillId[] = [];
  const failed: Array<{ id: DrillId; reason: string }> = [];

  const db = await getDB().catch((e) => {
    throw toStorageError(e, 'E_DB_UNAVAILABLE');
  });
  const existingTitles = new Set((await db.getAll('drillSummaries')).map((s) => s.title));

  for (const { candidate, resolution } of items) {
    const origId = candidate.doc.id;
    if (resolution === 'skip') {
      idMap.set(origId, origId);
      skipped.push(origId);
      continue;
    }

    let existing: Drill | undefined;
    try {
      existing = await db.get('drills', origId);
    } catch {
      existing = undefined;
    }

    let finalDoc: Drill;
    if (resolution === 'overwrite') {
      finalDoc = { ...structuredClone(candidate.doc), id: origId, updatedAt: Date.now() };
    } else if (existing) {
      // 'copy' + 충돌 — 진짜 사본이다. 드릴 id 만 새로 발급한다(스텝·개체 id 는 드릴 스코프라
      // 그대로 안전). 이 문서는 지금 이 기기에서 새로 만들어진 것이므로 createdAt/updatedAt 을
      // 지금으로 찍는 것이 맞다(5.0 ① — 예외 쪽).
      let candTitle = `${candidate.doc.title} (사본)`;
      let n = 2;
      while (existingTitles.has(candTitle)) {
        candTitle = `${candidate.doc.title} (사본 ${n})`;
        n++;
      }
      existingTitles.add(candTitle);
      const now = Date.now();
      finalDoc = { ...structuredClone(candidate.doc), id: newId('dr'), title: candTitle, createdAt: now, updatedAt: now };
    } else {
      // 'copy' + 충돌 없음 — id 도 내용도 파일 그대로 들어온다. ⚠️ createdAt/updatedAt 을
      // **보존한다**(5.0 ① 결정, 2026-08-13): 기기 이사는 "같은 드릴이 옮겨간 것" 이지 새로
      // 만든 것이 아니다. 여기서 now 를 찍으면 세션(createdAt 보존)과 비대칭이 되고,
      // `drillSummaries.by_updatedAt` 인덱스가 이미 있어 "최근 수정순" 정렬이 붙는 순간
      // 기기 이사 직후의 정렬이 전부 "방금" 으로 뭉개진다.
      finalDoc = structuredClone(candidate.doc);
    }

    const summary = buildSummary(finalDoc);
    beginWrite();
    try {
      const tx = db.transaction(['drills', 'drillSummaries'], 'readwrite');
      tx.objectStore('drills').put(finalDoc);
      tx.objectStore('drillSummaries').put(summary);
      await tx.done;
    } catch (e) {
      failed.push({ id: origId, reason: toStorageError(e, 'E_DB_UNAVAILABLE').message });
      continue;
    } finally {
      endWrite();
    }
    idMap.set(origId, finalDoc.id);
    written.push(finalDoc.id);
  }

  return { idMap, written, skipped, failed };
}

/** 반드시 리맵한다 — 없으면 "사본으로 추가"(기본 선택지)가 세션 항목을 조용히 로컬의 다른 드릴로
 *  연결하고, missing 도 아니라서 아무 경고가 뜨지 않는다. 커밋 순서: 드릴 전부 커밋(호출자가 이미
 *  commitDrillImports 로 완료) → idMap 획득 → remapRefs → drillIds 재계산 → 세션 put. */
export async function commitSessionImport(s: TrainingSession, out: ImportOutcome): Promise<TrainingSession> {
  // v2 — 참조 재매핑은 **전 구획**을 돌아야 한다. 한 구획만 돌면 copy 로 들여온 드릴을
  // 다른 구획의 항목이 옛 id 로 계속 가리켜 missing 이 된다. drillIds 는 putSession 이
  // flatten 기준으로 어차피 재계산하므로 여기서 만들지 않는다.
  const phases = s.phases.map((p) => ({ ...p, items: remapRefs(p.items, out.idMap) as SessionItem[] }));
  return putSession({ ...s, phases });
}

// ---- 내보내기 --------------------------------------------------------------------------------

function toEnvelope<K extends SpinFileKind>(spin: K, payload: unknown): SpinEnvelopeBase & { spin: K; payload: unknown } {
  return { spin, envelope: ENVELOPE_VERSION, app: APP_NAME, exportedAt: Date.now(), payload };
}

function toBlob(obj: unknown): Blob {
  return new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
}

export function exportDrillFile(d: Drill): Blob {
  return toBlob(toEnvelope('drill', d));
}
export function exportSessionFile(s: TrainingSession, drills: Drill[]): Blob {
  return toBlob(toEnvelope('session', { session: s, drills }));
}
/** ⚠️ **화면에서 부르는 곳이 없다. 그래도 지우지 마라** (2026-08-31 위생 청소에서 살려 둔 것).
 *  'library' 봉투를 **읽는** 길(`parseSpinFile` → `readImportFile`)은 계약으로 살아 있다 —
 *  옛 버전이 내보낸 파일을 지금도 열 수 있어야 하기 때문이다. 그 읽기를 검증하려면 그 형식의
 *  파일을 만들 줄 알아야 하고, 이 함수가 유일한 생성기다(`features/library/transfer.test.ts`
 *  가 정확히 그렇게 쓴다). 지우면 읽기 계약이 소리 없이 검증 밖으로 나간다. */
export function exportLibraryFile(ds: Drill[]): Blob {
  return toBlob(toEnvelope('library', ds));
}

// ---- team 봉투 — 팀 하나짜리 파일(PLAN-TEAM.md 결정 13) -----------------------------------------
//
// ⚠️ **팀은 공유 링크로 나가지 않는다**(결정 12, 기현 지시 *"공유 링크 없음"*). 이 파일에서
// `share/` 를 import 하는 순간 그 울타리가 무너진다 — 나가는 길은 이 봉투와 기기 이사 파일뿐이다.

export interface ExportTeamOptions {
  /** [등급 정보 제외] — 기본 꺼짐(결정 13). 켜면 선수의 PF 등급(`klass`)을 **키째** 지운다.
   *
   *  ⚠️ **키를 지우지 값을 비우지 않는다.** `klass: undefined` 로 두면 JSON.stringify 가 키를
   *  통째로 빼 주긴 하지만, 그건 직렬화기의 부수효과에 기대는 것이고 도중에 어떤 표현
   *  (구조화 복제·IDB 저장)을 거치면 «미분류로 지정됨» 이라는 서로 다른 뜻으로 되살아난다.
   *  `codec.ts` 의 이름 지우개가 같은 이유로 `delete` 를 쓴다.
   *
   *  왜 스위치가 필요한가: 등급은 의료·기능 평가에서 나온 값이라 팀 밖으로 나갈 때 뜻이 달라진다.
   *  기본을 꺼 둔 것은 **정상 사용(내 기기 → 내 기기, 코치 → 같은 팀 코치)에서 등급이 빠지면
   *  받는 쪽이 라인업 경고를 못 받기 때문**이다 — 켜는 것은 파일을 남에게 줄 때의 선택이다. */
  stripClass?: boolean;
}

/** 팀 하나 → `.spin.team.json` 봉투. 원본 `Team` 은 건드리지 않는다(구조화 사본에서 지운다). */
export function exportTeamFile(t: Team, opts: ExportTeamOptions = {}): Blob {
  const doc = structuredClone(t) as Team & { players: Array<Record<string, unknown>> };
  if (opts.stripClass) for (const p of doc.players) delete p.klass;
  return toBlob(toEnvelope('team', doc));
}

async function existingTeamFor(id: TeamId): Promise<Team | undefined> {
  try {
    const db = await getDB();
    return await db.get('teams', id);
  } catch {
    return undefined;
  }
}

/** 드릴과 **같은 3택 구조**로 후보를 만든다(결정 13 «드릴식 개별 충돌»). 팀을 세션처럼
 *  "항상 새 문서" 로 취급하지 않는 이유: 팀은 사용자가 몇 달을 쌓는 문서라, 백업을 두 번
 *  복원했다고 «우리 팀 (사본)» 이 늘어나면 어느 쪽이 진짜인지 사용자가 못 가른다. */
async function prepareTeamCandidates(raws: unknown[]): Promise<ImportCandidate<Team>[]> {
  const out: ImportCandidate<Team>[] = [];
  const seenInBatch = new Map<TeamId, ImportCandidate<Team>>();
  for (const raw of raws) {
    const mig = migrateDoc(raw, TEAM_MIGRATIONS, CURRENT_TEAM_SCHEMA);
    if (!mig.ok) continue; // too-new/no-path 항목은 배치에서 조용히 제외 — 개수 차가 보고의 재료다
    const v = validateTeam(mig.doc);
    if (!v.ok) continue;
    const doc = v.value;
    const dup = seenInBatch.get(doc.id);
    let candidate: ImportCandidate<Team>;
    if (dup) {
      candidate = { doc, repairs: v.repairs, conflict: 'exists', existing: { title: dup.doc.name, updatedAt: dup.doc.updatedAt } };
    } else {
      const existing = await existingTeamFor(doc.id);
      if (!existing) candidate = { doc, repairs: v.repairs, conflict: 'none' };
      else if (sameSaved(existing, doc)) candidate = { doc, repairs: v.repairs, conflict: 'identical', existing: { title: existing.name, updatedAt: existing.updatedAt } };
      else candidate = { doc, repairs: v.repairs, conflict: 'exists', existing: { title: existing.name, updatedAt: existing.updatedAt } };
    }
    seenInBatch.set(doc.id, candidate);
    out.push(candidate);
  }
  return out;
}

/** 파일 하나(kind 'team') → 후보 하나. 화면(`features/team/transfer.ts`)이 이걸로 3택을 묻는다. */
export async function prepareTeamImport(file: SpinFile): Promise<ImportCandidate<Team>[]> {
  if (file.spin === 'team') return prepareTeamCandidates([file.payload]);
  throw new StorageError('E_UNSUPPORTED_KIND', STORAGE_ERROR_MESSAGES.E_UNSUPPORTED_KIND(file.spin), { detail: file.spin });
}

export interface TeamImportOutcome {
  written: TeamId[];
  skipped: TeamId[];
  failed: Array<{ id: TeamId; reason: string }>;
}

/** 팀 커밋. `putTeam(touch:false)` 로 **파일의 시각을 보존한다** — 기기 이사는 "같은 팀이
 *  옮겨간 것" 이지 새로 만든 것이 아니다(드릴 무충돌 copy·세션 putSessionPreservingTimes 와
 *  같은 결정, 5.0 ①). 목록이 `updatedAt` 내림차순이라 여기서 now 를 찍으면 이사 직후 정렬이
 *  전부 "방금" 으로 뭉개진다.
 *
 *  ⚠️ 'copy' + 충돌에서 **선수·스태프 id 는 그대로 둔다**(팀 id 만 새로 발급). 결정 20 의
 *  `duplicateTeam` 은 사용자가 의도적으로 «또 하나의 팀» 을 만드는 자리라 id 를 재발급하지만,
 *  복원은 같은 사람들을 도로 들여오는 자리다 — 여기서 `pl_` 를 갈면 같은 파일에 실려 온 세션의
 *  `participantIds` 가 통째로 «지워진 선수» 가 된다. */
export async function commitTeamImports(
  items: Array<{ candidate: ImportCandidate<Team>; resolution: ImportResolution }>,
  opts: {
    /** 사본 이름 짓기. 기본값의 한국어는 이 파일의 드릴·세션 사본과 **같은 자리의 같은 빚**이다
     *  (`${title} (사본)`) — 팀만 따로 고치면 한 파일 안에서 규칙이 둘이 된다. 화면에서 부를 때는
     *  로케일 문자열을 넘긴다(`features/team/transfer.ts`). */
    copyName?: (name: string) => string;
  } = {},
): Promise<TeamImportOutcome> {
  const copyName = opts.copyName ?? ((n: string) => `${n} (사본)`);
  const written: TeamId[] = [];
  const skipped: TeamId[] = [];
  const failed: Array<{ id: TeamId; reason: string }> = [];
  for (const { candidate, resolution } of items) {
    const origId = candidate.doc.id;
    if (resolution === 'skip') {
      skipped.push(origId);
      continue;
    }
    const existing = await existingTeamFor(origId);
    const doc: Team =
      resolution === 'copy' && existing
        ? { ...structuredClone(candidate.doc), id: newId('tm'), name: copyName(candidate.doc.name) }
        : structuredClone(candidate.doc);
    try {
      const put = await putTeam(doc, { touch: false });
      written.push(put.id);
    } catch (e) {
      failed.push({ id: origId, reason: e instanceof Error ? e.message : String(e) });
    }
  }
  return { written, skipped, failed };
}

// ---- backup 봉투 — 기기 이사 파일(§6.1b) --------------------------------------------------------
//
// 여기에는 **봉투를 만들고 읽는 것까지만** 둔다. 파일 이름·다운로드·화면 안내는 4.7(설정 화면)이
// 붙인다. 화면에서 부를 세 함수: collectBackup() → exportBackupFile() → (파일 선택) →
// parseSpinFile() → restoreBackup().

/** 백업을 모은다. 드릴은 IDB 레코드를 **날것 그대로** 싣는다 — validateDrill 을 태우면 손상돼
 *  열리지 않던 레코드가 백업 파일에서 아예 사라져, 사용자가 나중에 손으로 고칠 기회까지 잃는다.
 *  검증은 복원 쪽(prepareDrillCandidates)에서 한다. */
export async function collectBackup(): Promise<BackupPayload> {
  const db = await getDB().catch((e) => {
    throw toStorageError(e, 'E_DB_UNAVAILABLE');
  });
  const drills = await db.getAll('drills');
  const sessions = await db.getAll('sessions');
  // 팀도 **날것 그대로** — validateTeam 을 태우면 손상돼 열리지 않던 팀이 백업에서 아예 사라져,
  // 사용자가 나중에 손으로 고칠 기회까지 잃는다(위 드릴과 같은 규율).
  const teams = await db.getAll('teams');
  const board = loadBoard();
  const roster = await loadRoster();
  return {
    drills,
    sessions,
    prefs: loadPrefs(),
    board: board ? { schemaVersion: CURRENT_BOARD_SCHEMA, drill: board.drill } : null,
    ...(roster.players.length > 0 ? { roster } : {}), // 빈 명단 = 키 생략(BackupPayload 주석)
    ...(teams.length > 0 ? { teams } : {}), // 팀 0개도 같은 규율로 키 생략
  };
}

export function exportBackupFile(p: BackupPayload): Blob {
  return toBlob(toEnvelope('backup', p));
}

/** 복원 정책. 기본값은 전부 **"남의 기기에 있는 것을 지우지 않는다"** 쪽으로 잡혀 있다. */
export interface RestoreBackupOptions {
  /** 드릴 id 가 로컬과 충돌할 때(내용이 다를 때) 무엇을 할지. 기본 'copy' —
   *  §4.7 의 "포커스 기본값은 사본으로 추가" 와 같은 값이다. */
  drillConflict?: ImportResolution;
  /** ⚠️ prefs 기본값이 'skip' 인 것은 실수가 아니다. 백업 파일은 **드릴을 얻으려고 남에게서
   *  받는 경우**(코치끼리 주고받기)가 기기 이사만큼 흔한데, 그때 통째로 덮어쓰면 테마뿐 아니라
   *  a11y(큰 표적·UI 배율·단일키 단축키·모션 줄이기)가 말없이 바뀐다. 접근성 설정은 사용자가
   *  자기 몸에 맞춰 둔 값이라 `largeTargets`/`uiScale` 이 조용히 꺼지는 것은 접근성 사고다.
   *  기기 이사(설정도 가져오고 싶다)는 화면에서 체크박스 하나로 'replace' 를 넘긴다.
   *
   *  **필드별 병합은 하지 않는다** — prefs 는 validatePrefs 가 전 필드를 채워 돌려주므로
   *  "로컬에 없는 필드만 채운다" 는 규칙이 아무것도 안 하는 규칙이 되고, 임의로 반쪽만 섞으면
   *  두 기기 어디에도 없던 제3의 설정 상태가 생긴다. 통째로 두거나 통째로 바꾸거나 둘 뿐이다. */
  prefs?: 'skip' | 'replace';
  /** 자유 전술판. 기본 'auto' = **로컬 판이 없거나 pristine(기본 배치 그대로)일 때만** 복원한다.
   *  편집 중인 판은 목록에 뜨지도 않고 되돌릴 수도 없는 단 한 장이라, 덮어쓰면 복구 경로가 0 이다.
   *  BoardSnapshot.pristine 이 바로 그 판정을 위해 저장본까지 따라다니는 필드다(board.ts 주석). */
  board?: 'auto' | 'skip' | 'replace';
  /** 로스터. 기본 'auto' = **로컬 명단이 비어 있을 때만** 복원한다 — 남의 백업에서 드릴만
   *  얻으려는 사용자의 팀 명단을 덮어쓰지 않는다(prefs 와 같은 결의 판단, 다만 명단은 비어
   *  있으면 잃을 것이 없어 auto 가 안전하게 채워 줄 수 있다). */
  roster?: 'auto' | 'skip' | 'replace';
  /** 팀 id 가 로컬과 충돌할 때(내용이 다를 때) 무엇을 할지. 기본 'copy' — 드릴과 같은 값이고
   *  같은 이유다: 남의 편집을 말없이 덮지 않는다. 'identical' 은 항상 skip 이다(멱등). */
  teamConflict?: ImportResolution;
}

/** 전술판 복원 결과. ⚠️ 옛 'skipped' 하나가 **서로 다른 두 사유**를 뭉개고 있었다(5.0 ②a,
 *  2026-08-13): "파일에 판이 없다"(정상 — 할 일이 없다)와 "로컬 판이 편집 중이라 덮지 않았다"
 *  (사용자가 [전술판 교체]를 켜면 해소된다)는 사용자가 해야 할 일이 다르다. 토스트가 그 둘을
 *  다르게 말하려면 보고가 먼저 갈라져 있어야 한다 — 다시 합치면 dataExport.ts 의
 *  backupReportLine 이 이유를 지어내거나 침묵하는 것 둘 중 하나로 돌아간다.
 *  'skipped' 는 이제 **정책상 건너뜀**(mode:'skip')만 뜻한다. */
export type BoardRestoreResult = 'restored' | 'skipped' | 'none-in-file' | 'kept-local-edited' | 'unreadable';

export interface BackupRestoreReport {
  /** 파일에 들어 있던 개수 — 커밋된 개수와의 차이가 곧 "조용히 건너뛴 손상 항목" 이다(§6.1c
   *  '보고하되 묻지 않는다' 가 이 숫자를 읽는다). */
  drillsInFile: number;
  sessionsInFile: number;
  /** 팀도 같은 셈 — 파일에 있던 수와 커밋된 수의 차가 «조용히 건너뛴 손상 팀» 이다. */
  teamsInFile: number;
  drills: ImportOutcome;
  sessionsWritten: SessionId[];
  sessionsSkipped: SessionId[];
  sessionsFailed: number;
  prefs: 'restored' | 'skipped' | 'unreadable';
  board: BoardRestoreResult;
  /** 'kept-local' = 로컬 명단이 있어 auto 가 덮지 않았다(사용자가 'replace' 로 해소). */
  roster: 'restored' | 'skipped' | 'none-in-file' | 'kept-local' | 'unreadable';
  /** 팀([팀] 메뉴, 2026-09-09). roster 처럼 상태 하나로 뭉치지 않고 드릴처럼 **개수**로 보고한다 —
   *  팀은 여러 문서라 "복원함/안 함" 이 한 마디로 참이 되는 대상이 아니다(결정 13). */
  teams: TeamImportOutcome;
}

async function existingSessionFor(id: SessionId): Promise<TrainingSession | undefined> {
  try {
    const db = await getDB();
    return await db.get('sessions', id);
  } catch {
    return undefined;
  }
}

/** 5.0 ① — 복원 전용 세션 쓰기. `putSession` 을 부르지 않는 유일한 이유는 그 함수가 updatedAt 을
 *  **무조건 지금으로** 찍기 때문이다(sessionRepo.ts "유일한 쓰기 경로... updatedAt 을 찍는다").
 *  편집 경로에서는 그게 맞지만, 기기 이사는 "같은 세션이 옮겨간 것" 이라 파일의 시각을 보존해야
 *  한다 — 드릴 쪽(commitDrillImports 의 무충돌 copy)과 같은 결정이다. `listSessions` 가
 *  `by_updatedAt` 인덱스로 정렬하므로, 여기서 now 를 찍으면 이사 직후 세션 목록 순서가 전부
 *  "방금" 으로 뭉개진다. ⚠️ putSession 의 불변식(drillIds = refDrillIds(items) 재계산)은
 *  **호출자가 이미 마친 문서만** 받는 것으로 지킨다 — 이 함수를 다른 곳에서 재사용하지 마라. */
async function putSessionPreservingTimes(s: TrainingSession): Promise<TrainingSession> {
  const db = await getDB().catch((e) => {
    throw toStorageError(e, 'E_DB_UNAVAILABLE');
  });
  beginWrite();
  try {
    const tx = db.transaction('sessions', 'readwrite');
    tx.store.put(s);
    await tx.done;
  } catch (e) {
    throw toStorageError(e, 'E_DB_UNAVAILABLE');
  } finally {
    endWrite();
  }
  return s;
}

/** 'unreadable' 은 **로컬 설정을 그대로 둔다**는 뜻이다. 읽을 수 없는 파일을 만났을 때 기본값으로
 *  되돌리면, 복원에 실패했으면서 사용자 설정까지 지우는 최악이 된다. */
function restorePrefsFrom(raw: unknown): 'restored' | 'unreadable' {
  const mig = migrateDoc(raw, PREFS_MIGRATIONS, CURRENT_PREFS_SCHEMA);
  if (!mig.ok) return 'unreadable'; // too-new(더 새 앱의 설정) / no-path(형상 불일치) 둘 다
  // savePrefs 는 Preferences 를 통째로 JSON 화한다 — theme 은 **최상위 문자열**로 남는다.
  // ⚠️ index.html:26-33 부트 스크립트가 첫 페인트 전에 `spin.prefs.theme` 을 날것으로 읽는다.
  // 복원 경로가 여기서 중첩 구조를 쓰면 복원 직후 새로고침에서 테마가 한 번 깜빡인다.
  savePrefs(validatePrefs(mig.doc).value);
  return 'restored';
}

function restoreBoardFrom(raw: unknown, mode: NonNullable<RestoreBackupOptions['board']>): BoardRestoreResult {
  if (mode === 'skip') return 'skipped';
  if (!isRecord(raw)) return 'none-in-file'; // 파일에 판이 없다(null) — 정상, 할 일이 없다
  const mig = migrateDoc(raw.drill, DRILL_MIGRATIONS, CURRENT_DRILL_SCHEMA);
  if (!mig.ok) return 'unreadable';
  const v = validateDrill(mig.doc);
  if (!v.ok) return 'unreadable';
  if (mode === 'auto') {
    const local = loadBoard();
    // ⚠️ 편집 중인 판은 목록에 뜨지도 않고 되돌릴 수도 없는 단 한 장이라 auto 는 덮지 않는다.
    //    다만 그 사실을 'skipped' 로 뭉개면 사용자는 이유도, 회피책([전술판 교체] 재시도)도
    //    영영 모른다 — 그래서 별도 사유로 돌려준다(5.0 ②a).
    // 2026-08-28 — 판정이 `!local.pristine`(= 저장본 기준선) 에서 **판을 직접 세는 것**으로
    // 바뀌었다. 묻는 것은 그때나 지금이나 "덮으면 잃을 것이 있는가" 이고, 개체를 세는 쪽이
    // 그 질문에 곧바로 답한다(EditorWorkspace 의 코트 전환 게이트와 같은 술어를 쓴다).
    if (local && !local.drill.steps.every(isStepEmpty)) return 'kept-local-edited';
  }
  return saveBoard(v.value) ? 'restored' : 'unreadable';
}

async function restoreRosterFrom(raw: unknown, mode: NonNullable<RestoreBackupOptions['roster']>): Promise<BackupRestoreReport['roster']> {
  if (mode === 'skip') return 'skipped';
  if (raw === undefined || raw === null) return 'none-in-file'; // 구 백업·빈 명단 — 정상, 할 일 없음
  const mig = migrateDoc(raw, ROSTER_MIGRATIONS, CURRENT_ROSTER_SCHEMA);
  if (!mig.ok) return 'unreadable';
  const v = validateRoster(mig.doc);
  if (!v.ok) return 'unreadable';
  if (mode === 'auto') {
    const local = await loadRoster();
    if (local.players.length > 0) return 'kept-local'; // 남의 백업이 내 팀 명단을 덮지 않게
  }
  try {
    await saveRoster(v.value);
    return 'restored';
  } catch {
    return 'unreadable';
  }
}

/** 기기 이사 파일을 되돌린다.
 *
 *  **B-6(요약) 결정 — 길 ①: 드릴마다 buildSummary 를 직접 부른다.** 복원은 `commitDrillImports`
 *  를 그대로 지나가고, 그 함수는 드릴과 요약을 **하나의 readwrite 트랜잭션에서 함께** 쓴다
 *  (transfer.ts 의 `buildSummary(finalDoc)`). 그래서 복원한 드릴은 목록에 제목·썸네일과 함께
 *  즉시 나타난다 — 아래 "복원한 드릴이 목록에 제목과 함께 보인다" 테스트가 이것을 못박는다.
 *
 *  길 ②(끝에서 `rebuildAllSummaries()`)를 택하지 않은 이유는 **그 함수가 이 상황에서 no-op**
 *  이기 때문이다: 구현이 `if (s.build >= SUMMARY_BUILD) continue` 라 방금 쓴 build:1 요약은
 *  전부 건너뛴다. 요약 스토어를 통째로 훑는 비용만 내고 고치는 것은 0개다. 즉 길 ② 를 부르면
 *  "복원이 요약을 만든다" 는 **거짓 안전감**만 얻는다. `SUMMARY_BUILD` 는 1 그대로 둔다 —
 *  summary.ts 주석의 근거 3개가 그대로 유효하고, 복원 경로에 build 를 올릴 이유는 없다.
 *  (build 를 올려야 할 날이 오면 그때 재구축 경로를 **같은 커밋에서** 만든다.) */
export async function restoreBackup(file: SpinFile, opts: RestoreBackupOptions = {}): Promise<BackupRestoreReport> {
  if (file.spin !== 'backup') {
    throw new StorageError('E_UNSUPPORTED_KIND', STORAGE_ERROR_MESSAGES.E_UNSUPPORTED_KIND(file.spin), { detail: file.spin });
  }
  const raw: unknown = file.payload;
  if (!isRecord(raw)) throw new StorageError('E_INVALID_FILE', STORAGE_ERROR_MESSAGES.E_INVALID_FILE());
  const drillsRaw = Array.isArray(raw.drills) ? (raw.drills as unknown[]) : [];
  const sessionsRaw = Array.isArray(raw.sessions) ? (raw.sessions as unknown[]) : [];
  const teamsRaw = Array.isArray(raw.teams) ? (raw.teams as unknown[]) : []; // 구 백업엔 키가 없다 — 정상

  // 1) 드릴 먼저. 세션 리맵이 이 idMap 을 필요로 하므로 순서를 바꿀 수 없다.
  const onExists = opts.drillConflict ?? 'copy';
  const candidates = await prepareDrillCandidates(drillsRaw);
  const drills = await commitDrillImports(
    candidates.map((candidate) => ({
      candidate,
      // 'identical' 은 이미 같은 내용이 로컬에 있다 — 쓰면 (사본) 만 늘어난다.
      resolution: candidate.conflict === 'identical' ? 'skip' : candidate.conflict === 'exists' ? onExists : 'copy',
    })),
  );

  // 2) 세션. **반드시 remapRefs 를 지난다** — 드릴이 충돌로 새 id 를 받았는데 세션이 옛 id 를
  //    가리키면 그 항목은 missing 도 아니고(로컬의 다른 드릴이 그 id 를 갖고 있다) 경고도 안 뜬다.
  const sessionsWritten: SessionId[] = [];
  const sessionsSkipped: SessionId[] = [];
  let sessionsFailed = 0;
  for (const rawSession of sessionsRaw) {
    const mig = migrateDoc(rawSession, SESSION_MIGRATIONS, CURRENT_SESSION_SCHEMA);
    const v = mig.ok ? validateSession(mig.doc) : undefined;
    if (!v || !v.ok) {
      sessionsFailed++;
      continue;
    }
    // v2 — 재매핑은 전 구획을 돈다(commitSessionImport 와 같은 이유).
    const phases = v.value.phases.map((p) => ({ ...p, items: remapRefs(p.items, drills.idMap) as SessionItem[] }));
    const remapped: TrainingSession = { ...v.value, phases, drillIds: refDrillIds(phases.flatMap((p) => p.items)) };
    const local = await existingSessionFor(remapped.id);
    if (local && sameSaved(local, remapped)) {
      // 같은 백업을 두 번 복원해도 세션이 불어나지 않는다(멱등).
      sessionsSkipped.push(local.id);
      continue;
    }
    // id 는 같은데 내용이 다르다 = 로컬에서 그 세션을 고쳤다. 덮어쓰면 그 편집이 사라지므로
    // 드릴의 'copy' 와 같은 규칙으로 새 id + (사본) 을 준다 — 사본은 지금 새로 만들어진
    // 문서이므로 createdAt/updatedAt 도 지금이다(5.0 ①). 충돌이 없으면 파일의 시각을 보존한다.
    const now = Date.now();
    const doc: TrainingSession = local
      ? { ...remapped, id: newId('se'), title: `${remapped.title} (사본)`, createdAt: now, updatedAt: now }
      : remapped;
    const put = await putSessionPreservingTimes(doc);
    sessionsWritten.push(put.id);
  }

  // 3) 팀. 드릴과 같은 3택이고, 세션 **뒤에** 돈다 — 순서는 지금은 무관하지만(팀은 세션을
  //    참조하지 않고 세션이 팀 id 를 한 방향으로만 가리킨다) 참조 방향을 따라 두는 편이
  //    나중에 리맵이 생겨도 자리를 안 옮긴다.
  const onTeamExists = opts.teamConflict ?? 'copy';
  const teamCandidates = await prepareTeamCandidates(teamsRaw);
  const teams = await commitTeamImports(
    teamCandidates.map((candidate) => ({
      candidate,
      resolution: candidate.conflict === 'identical' ? 'skip' : candidate.conflict === 'exists' ? onTeamExists : 'copy',
    })),
  );

  // 4) 설정·판. 옵션 기본값의 근거는 RestoreBackupOptions 주석에 있다.
  const prefs = (opts.prefs ?? 'skip') === 'replace' ? restorePrefsFrom(raw.prefs) : 'skipped';
  const board = restoreBoardFrom(raw.board, opts.board ?? 'auto');
  const roster = await restoreRosterFrom(raw.roster, opts.roster ?? 'auto');

  return {
    drillsInFile: drillsRaw.length,
    sessionsInFile: sessionsRaw.length,
    teamsInFile: teamsRaw.length,
    drills,
    sessionsWritten,
    sessionsSkipped,
    sessionsFailed,
    prefs,
    board,
    roster,
    teams,
  };
}
