// §4.7 내보내기/가져오기. 봉투에 별도 schemaVersion 을 두지 않는다 — payload 가 자기 버전을
// 들고 있고 두 벌은 어긋난다. envelope > ENVELOPE_VERSION → E_SCHEMA_TOO_NEW, 모르는 spin 값 →
// E_UNSUPPORTED_KIND(kind). 'drillSet' 은 파싱은 되고(SpinFile 유니온에 존재) 커밋만 거부한다 —
// prepareDrillImport/prepareSessionImport 가 자신이 다루지 않는 spin 종류를 받으면 여기서 던진다.
import { getDB, beginWrite, endWrite, toStorageError } from './db.ts';
import { StorageError, STORAGE_ERROR_MESSAGES } from './errors.ts';
import type { Drill } from '../model/drill.ts';
import { CURRENT_DRILL_SCHEMA } from '../model/drill.ts';
import type { TrainingSession, SessionItem } from '../model/session.ts';
import { CURRENT_SESSION_SCHEMA } from '../model/session.ts';
import { validateDrill, validateSession, type Repair } from '../model/validate.ts';
import { migrateDoc, DRILL_MIGRATIONS, SESSION_MIGRATIONS } from '../model/migrate.ts';
import { refDrillIds, remapRefs } from '../model/refs.ts';
import { buildSummary } from '../model/summary.ts';
import { newId } from '../core/ids.ts';
import type { DrillId } from '../core/ids.ts';
import type { Preferences } from './prefs.ts';
import { putSession } from './sessionRepo.ts';

export const ENVELOPE_VERSION = 1;
export type SpinFileKind = 'drill' | 'session' | 'library' | 'prefs' | 'drillSet';
const KNOWN_KINDS: readonly SpinFileKind[] = ['drill', 'session', 'library', 'prefs', 'drillSet'];

export interface SpinEnvelopeBase {
  spin: SpinFileKind;
  envelope: number;
  app: string;
  exportedAt: number;
}

export type SpinFile =
  | (SpinEnvelopeBase & { spin: 'drill'; payload: Drill })
  | (SpinEnvelopeBase & { spin: 'session'; payload: { session: TrainingSession; drills: Drill[] } })
  | (SpinEnvelopeBase & { spin: 'library'; payload: Drill[] })
  | (SpinEnvelopeBase & { spin: 'prefs'; payload: Preferences })
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
    throw new StorageError('E_UNSUPPORTED_KIND', STORAGE_ERROR_MESSAGES.E_UNSUPPORTED_KIND(spin));
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

function stripUpdatedAt(d: Drill): Omit<Drill, 'updatedAt'> {
  const { updatedAt, ...rest } = d;
  void updatedAt;
  return rest;
}

export const sameDrill = (a: Drill, b: Drill): boolean =>
  JSON.stringify(canonical(stripUpdatedAt(a))) === JSON.stringify(canonical(stripUpdatedAt(b)));

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
  throw new StorageError('E_UNSUPPORTED_KIND', STORAGE_ERROR_MESSAGES.E_UNSUPPORTED_KIND(file.spin));
}

export async function prepareSessionImport(file: SpinFile): Promise<{
  drills: ImportCandidate<Drill>[];
  session: ImportCandidate<TrainingSession>;
}> {
  if (file.spin !== 'session') {
    throw new StorageError('E_UNSUPPORTED_KIND', STORAGE_ERROR_MESSAGES.E_UNSUPPORTED_KIND(file.spin));
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
    } else {
      // 'copy' — 드릴 id 만 새로 발급한다. 스텝·개체 id 는 드릴 스코프라 그대로 안전.
      const newDrillId = existing ? newId('dr') : origId;
      let title = candidate.doc.title;
      if (existing) {
        let candTitle = `${candidate.doc.title} (사본)`;
        let n = 2;
        while (existingTitles.has(candTitle)) {
          candTitle = `${candidate.doc.title} (사본 ${n})`;
          n++;
        }
        title = candTitle;
        existingTitles.add(title);
      }
      const now = Date.now();
      finalDoc = { ...structuredClone(candidate.doc), id: newDrillId, title, createdAt: now, updatedAt: now };
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
  const items: SessionItem[] = remapRefs(s.items, out.idMap);
  return putSession({ ...s, items, drillIds: refDrillIds(items) });
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
export function exportLibraryFile(ds: Drill[]): Blob {
  return toBlob(toEnvelope('library', ds));
}
