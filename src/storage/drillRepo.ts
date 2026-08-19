// §4.3 드릴 리포지토리. listDrillSummaries 는 요약 전량을 읽어 메모리에서 필터·정렬한다
// (부분일치 검색은 IDB 인덱스로 불가능, 200건 = 140 KB — §4.2 의 "인덱스 최소화" 근거와 짝).
import { getDB, beginWrite, endWrite, toStorageError } from './db.ts';
import { StorageError, STORAGE_ERROR_MESSAGES } from './errors.ts';
import type { Drill } from '../model/drill.ts';
import { CURRENT_DRILL_SCHEMA } from '../model/drill.ts';
import { validateDrill, type Repair, type ValidationIssue } from '../model/validate.ts';
import { migrateDoc, DRILL_MIGRATIONS } from '../model/migrate.ts';
import { buildSummary, SUMMARY_BUILD, type DrillSummary } from '../model/summary.ts';
import { createDrill as modelCreateDrill } from '../model/defaults.ts';
import { newId } from '../core/ids.ts';
import type { DrillId } from '../core/ids.ts';
import { postSyncEvent, tombstoneRecord } from './syncMeta.ts';

export interface DrillQuery {
  /** v8 분류 유형 필터(DRILL_TYPES 키). 옛 category 필터의 후계다. */
  drillType?: string;
  /** v8 경기 상황 필터(DRILL_SITUATIONS 키). */
  situation?: string;
  search?: string;
  sort?: 'updatedAt' | 'createdAt' | 'title'; // 기본 'updatedAt'
  order?: 'asc' | 'desc'; // 기본 'desc'
  limit?: number;
  offset?: number;
}

export type DrillLoad =
  | { status: 'ok'; drill: Drill; repairs: Repair[] }
  | { status: 'missing' }
  | { status: 'corrupt'; issues: ValidationIssue[]; raw: unknown }
  | { status: 'too-new'; found: number; supported: number };

export interface DrillRepo {
  listDrillSummaries(q?: DrillQuery): Promise<DrillSummary[]>;
  countDrills(): Promise<number>;
  loadDrill(id: DrillId): Promise<DrillLoad>;
  getDrill(id: DrillId): Promise<Drill | undefined>; // 'ok' 만 통과
  getRawDrill(id: DrillId): Promise<unknown>; // 손상본 원본 JSON 내보내기용
  getDrills(ids: DrillId[]): Promise<Map<DrillId, Drill>>;
  putDrill(d: Drill, opts?: { touch?: boolean; expectedUpdatedAt?: number }): Promise<Drill>;
  createDrill(init: CreateDrillInit): Promise<Drill>;
  duplicateDrill(id: DrillId, opts?: { title?: string }): Promise<Drill>;
  deleteDrill(id: DrillId): Promise<void>;
  rebuildAllSummaries(): Promise<number>;
  markOpen(id: DrillId, open: boolean): void; // 기회적 되쓰기 억제용
}

export type CreateDrillInit = Parameters<typeof modelCreateDrill>[0];

export type ReferrerKind = 'session' | 'drillSet';
export interface Referrer {
  kind: ReferrerKind;
  id: string;
  title: string;
}

export function normalizeForSearch(s: string): string {
  return s.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
}

function isRecordField(v: unknown, key: string): unknown {
  if (v && typeof v === 'object' && key in v) return (v as Record<string, unknown>)[key];
  return undefined;
}

/** 값싼 형상 스윕: 저장 직전 모든 pose 의 x,y 가 유한수인지만 확인한다(전체 validateDrill 은
 *  비용이 크고 이미 신뢰할 수 있는 런타임 Drill 을 다시 검증하는 것은 낭비). */
function assertWritable(d: Drill): void {
  for (const step of d.steps) {
    for (const maps of [step.chairs, step.balls, step.cones]) {
      for (const p of Object.values(maps)) {
        if (!p) continue;
        if (!Number.isFinite((p as { x: number }).x) || !Number.isFinite((p as { y: number }).y)) {
          throw new StorageError('E_INVALID_FILE', STORAGE_ERROR_MESSAGES.E_INVALID_FILE());
        }
      }
    }
  }
}

function sortSummaries(list: DrillSummary[], sort: NonNullable<DrillQuery['sort']>, order: NonNullable<DrillQuery['order']>): DrillSummary[] {
  const sorted = list.slice().sort((a, b) => {
    const av = sort === 'title' ? a.title : sort === 'createdAt' ? a.createdAt : a.updatedAt;
    const bv = sort === 'title' ? b.title : sort === 'createdAt' ? b.createdAt : b.updatedAt;
    if (av < bv) return -1;
    if (av > bv) return 1;
    return 0;
  });
  if (order === 'desc') sorted.reverse();
  return sorted;
}

function filterSummaries(list: DrillSummary[], q: DrillQuery): DrillSummary[] {
  let out = list;
  if (q.drillType) out = out.filter((s) => s.drillType === q.drillType);
  if (q.situation) out = out.filter((s) => s.situation === q.situation);
  if (q.search) {
    const needle = normalizeForSearch(q.search);
    out = out.filter((s) => s.searchKey.includes(needle));
  }
  return out;
}

function paginate<T>(list: T[], q: DrillQuery): T[] {
  const offset = q.offset ?? 0;
  return q.limit !== undefined ? list.slice(offset, offset + q.limit) : list.slice(offset);
}

/** 마이그레이션(문서 schemaVersion) + validateDrill 을 결합한 4상태 로더. IDB·메모리 양쪽에서 공유. */
function loadDrillFromRaw(raw: unknown): DrillLoad {
  const mig = migrateDoc(raw, DRILL_MIGRATIONS, CURRENT_DRILL_SCHEMA);
  if (!mig.ok) {
    if (mig.reason === 'too-new') return { status: 'too-new', found: mig.found, supported: CURRENT_DRILL_SCHEMA };
    return { status: 'corrupt', issues: [{ path: 'schemaVersion', message: `지원되지 않는 schemaVersion(${mig.found})` }], raw };
  }
  const v = validateDrill(mig.doc);
  if (!v.ok) return { status: 'corrupt', issues: v.issues, raw };
  const migRepairs: Repair[] = mig.applied.map((describe) => ({ path: 'schemaVersion', message: describe, destructive: false }));
  return { status: 'ok', drill: v.value, repairs: [...migRepairs, ...v.repairs] };
}

// ---- idbDrillRepo ------------------------------------------------------------------------------
// 쓰기 방송은 syncMeta.ts 의 postSyncEvent 로 일원화됐다(0.6 커밋 1) — 옛 'spin-drill-sync'
// 채널(발신 putDrill 한 곳·수신 0곳)의 후신이다.

const openDrillIds = new Set<DrillId>();

async function opportunisticRewrite(id: DrillId, drill: Drill, expectedUpdatedAt: number, expectedSchemaVersion: number): Promise<void> {
  const db = await getDB();
  const summary = buildSummary(drill);
  beginWrite();
  try {
    const tx = db.transaction(['drills', 'drillSummaries'], 'readwrite');
    const cur = await tx.objectStore('drills').get(id);
    if (!cur || cur.updatedAt !== expectedUpdatedAt || cur.schemaVersion !== expectedSchemaVersion) {
      tx.abort();
      await tx.done.catch(() => {});
      return;
    }
    tx.objectStore('drills').put(drill);
    tx.objectStore('drillSummaries').put(summary);
    await tx.done;
  } finally {
    endWrite();
  }
}

async function idbLoadDrill(id: DrillId): Promise<DrillLoad> {
  const db = await getDB();
  const raw: unknown = await db.get('drills', id);
  if (raw === undefined) return { status: 'missing' };
  const rawUpdatedAt = isRecordField(raw, 'updatedAt');
  const rawSchemaVersion = isRecordField(raw, 'schemaVersion');
  const result = loadDrillFromRaw(raw);
  // 기회적 되쓰기: 열려 있거나(markOpen) 파괴적 보정이면 절대 되쓰지 않는다(사용자 확인 전 손실 확정 금지).
  if (result.status === 'ok' && result.repairs.length > 0 && typeof rawUpdatedAt === 'number' && !openDrillIds.has(id)) {
    const destructive = result.repairs.some((r) => r.destructive);
    if (!destructive) {
      void opportunisticRewrite(id, result.drill, rawUpdatedAt, typeof rawSchemaVersion === 'number' ? rawSchemaVersion : 1).catch(() => {});
    }
  }
  return result;
}

async function idbPutDrill(d: Drill, opts?: { touch?: boolean; expectedUpdatedAt?: number }): Promise<Drill> {
  const next: Drill = opts?.touch === false ? d : { ...d, updatedAt: Date.now() };
  assertWritable(next);
  const summary = buildSummary(next);
  const db = await getDB().catch((e) => {
    throw toStorageError(e, 'E_DB_UNAVAILABLE');
  });
  beginWrite();
  try {
    const tx = db.transaction(['drills', 'drillSummaries'], 'readwrite');
    const cur = await tx.objectStore('drills').get(d.id);
    if (cur && opts?.expectedUpdatedAt !== undefined && cur.updatedAt !== opts.expectedUpdatedAt) {
      tx.abort();
      await tx.done.catch(() => {}); // abort 는 tx.done 을 reject 시킨다 — unhandled rejection 방지
      throw new StorageError('E_CONFLICT', STORAGE_ERROR_MESSAGES.E_CONFLICT());
    }
    try {
      // put() 도 try 안에 둔다 — 계약서 스니펫은 tx.done 만 감싸지만, 커밋 단계뿐 아니라
      // put() 호출 자체가 QuotaExceededError 를 동기로 던지는 구현도 있어(스펙상 두 경로 모두
      // 가능) 어느 쪽이든 E_QUOTA 로 변환되게 한다.
      tx.objectStore('drills').put(next);
      tx.objectStore('drillSummaries').put(summary);
      await tx.done;
    } catch (e) {
      throw toStorageError(e, 'E_DB_UNAVAILABLE');
    }
  } finally {
    endWrite();
  }
  postSyncEvent({ type: 'drill', id: next.id, op: 'put', updatedAt: next.updatedAt });
  return next;
}

export const idbDrillRepo: DrillRepo = {
  async listDrillSummaries(q = {}) {
    const db = await getDB();
    const all = await db.getAllFromIndex('drillSummaries', 'by_updatedAt');
    const filtered = filterSummaries(all, q);
    const sorted = sortSummaries(filtered, q.sort ?? 'updatedAt', q.order ?? 'desc');
    return paginate(sorted, q);
  },
  async countDrills() {
    const db = await getDB();
    return db.count('drills');
  },
  loadDrill: idbLoadDrill,
  async getDrill(id) {
    const res = await idbLoadDrill(id);
    return res.status === 'ok' ? res.drill : undefined;
  },
  async getRawDrill(id) {
    const db = await getDB();
    return db.get('drills', id);
  },
  async getDrills(ids) {
    const entries = await Promise.all(
      ids.map(async (id): Promise<[DrillId, Drill | undefined]> => {
        const res = await idbLoadDrill(id);
        return [id, res.status === 'ok' ? res.drill : undefined];
      }),
    );
    const map = new Map<DrillId, Drill>();
    for (const [id, d] of entries) if (d) map.set(id, d);
    return map;
  },
  putDrill: idbPutDrill,
  async createDrill(init) {
    const d = modelCreateDrill(init);
    return idbPutDrill(d, { touch: false });
  },
  async duplicateDrill(id, opts) {
    const db = await getDB();
    const raw: unknown = await db.get('drills', id);
    if (raw === undefined) throw new StorageError('E_NOT_FOUND', STORAGE_ERROR_MESSAGES.E_NOT_FOUND());
    const loaded = loadDrillFromRaw(raw);
    if (loaded.status !== 'ok') throw new StorageError('E_NOT_FOUND', STORAGE_ERROR_MESSAGES.E_NOT_FOUND());
    const now = Date.now();
    const next: Drill = {
      ...structuredClone(loaded.drill),
      id: newId('dr'),
      title: opts?.title ?? `${loaded.drill.title} (사본)`,
      createdAt: now,
      updatedAt: now,
    };
    return idbPutDrill(next, { touch: false });
  },
  async deleteDrill(id) {
    // 드릴 삭제는 세션을 건드리지 않는다 — 캐스케이드도, 차단도 하지 않는다(§4.5).
    const db = await getDB();
    const deletedAt = Date.now();
    beginWrite();
    try {
      // 톰스톤을 **같은 트랜잭션**에 쓴다(0.6 동기화) — 삭제와 "지웠다는 기록"이 따로 가면
      // 그 사이에서 크래시했을 때 다른 기기가 이 삭제를 영영 모르고, 다음 pull 이 지운
      // 드릴을 "원격에만 있는 신규" 로 오판해 되살린다.
      const tx = db.transaction(['drills', 'drillSummaries', 'meta'], 'readwrite');
      tx.objectStore('drills').delete(id);
      tx.objectStore('drillSummaries').delete(id);
      tx.objectStore('meta').put(tombstoneRecord('drill', id, deletedAt));
      await tx.done;
    } catch (e) {
      throw toStorageError(e, 'E_DB_UNAVAILABLE');
    } finally {
      endWrite();
    }
    postSyncEvent({ type: 'drill', id, op: 'delete', deletedAt });
  },
  async rebuildAllSummaries() {
    // 요약 지연 재생성: build 가 SUMMARY_BUILD 보다 낮은 레코드만 드릴을 로드해 재생성한다.
    const db = await getDB();
    const all = await db.getAll('drillSummaries');
    let n = 0;
    for (const s of all) {
      if (s.build >= SUMMARY_BUILD) continue;
      const raw: unknown = await db.get('drills', s.id);
      if (raw === undefined) continue;
      const loaded = loadDrillFromRaw(raw);
      if (loaded.status !== 'ok') continue;
      const summary = buildSummary(loaded.drill);
      beginWrite();
      try {
        const tx = db.transaction('drillSummaries', 'readwrite');
        tx.store.put(summary);
        await tx.done;
      } finally {
        endWrite();
      }
      n++;
    }
    return n;
  },
  markOpen(id, open) {
    if (open) openDrillIds.add(id);
    else openDrillIds.delete(id);
  },
};

// ---- memoryDrillRepo (필수 — IndexedDB 불가 환경 폴백) -------------------------------------------

function createMemoryDrillRepo(): DrillRepo {
  const drills = new Map<DrillId, Drill>();
  const summaries = new Map<DrillId, DrillSummary>();
  const openSet = new Set<DrillId>();

  const write = (d: Drill): Drill => {
    const clone = structuredClone(d);
    drills.set(clone.id, clone);
    summaries.set(clone.id, buildSummary(clone));
    return structuredClone(clone);
  };

  return {
    async listDrillSummaries(q = {}) {
      const filtered = filterSummaries(Array.from(summaries.values()), q);
      const sorted = sortSummaries(filtered, q.sort ?? 'updatedAt', q.order ?? 'desc');
      return paginate(sorted, q);
    },
    async countDrills() {
      return drills.size;
    },
    async loadDrill(id) {
      const d = drills.get(id);
      if (!d) return { status: 'missing' };
      return { status: 'ok', drill: structuredClone(d), repairs: [] };
    },
    async getDrill(id) {
      const d = drills.get(id);
      return d ? structuredClone(d) : undefined;
    },
    async getRawDrill(id) {
      const d = drills.get(id);
      return d ? structuredClone(d) : undefined;
    },
    async getDrills(ids) {
      const map = new Map<DrillId, Drill>();
      for (const id of ids) {
        const d = drills.get(id);
        if (d) map.set(id, structuredClone(d));
      }
      return map;
    },
    async putDrill(d, opts) {
      const cur = drills.get(d.id);
      if (cur && opts?.expectedUpdatedAt !== undefined && cur.updatedAt !== opts.expectedUpdatedAt) {
        throw new StorageError('E_CONFLICT', STORAGE_ERROR_MESSAGES.E_CONFLICT());
      }
      const next: Drill = opts?.touch === false ? d : { ...d, updatedAt: Date.now() };
      assertWritable(next);
      return write(next);
    },
    async createDrill(init) {
      return write(modelCreateDrill(init));
    },
    async duplicateDrill(id, opts) {
      const d = drills.get(id);
      if (!d) throw new StorageError('E_NOT_FOUND', STORAGE_ERROR_MESSAGES.E_NOT_FOUND());
      const now = Date.now();
      const next: Drill = { ...structuredClone(d), id: newId('dr'), title: opts?.title ?? `${d.title} (사본)`, createdAt: now, updatedAt: now };
      return write(next);
    },
    async deleteDrill(id) {
      drills.delete(id);
      summaries.delete(id);
    },
    async rebuildAllSummaries() {
      let n = 0;
      for (const [id, d] of drills) {
        summaries.set(id, buildSummary(d));
        n++;
      }
      return n;
    },
    markOpen(id, open) {
      if (open) openSet.add(id);
      else openSet.delete(id);
    },
  };
}

export const memoryDrillRepo: DrillRepo = createMemoryDrillRepo();

export async function resolveDrillRepo(): Promise<{ repo: DrillRepo; degraded: boolean }> {
  try {
    await getDB();
    return { repo: idbDrillRepo, degraded: false };
  } catch {
    return { repo: memoryDrillRepo, degraded: true };
  }
}

/** 드릴 셋이 추가돼도 이 함수 안에서만 한 줄 늘어난다. findSessionsUsing 은 두지 않는다.
 *  IDB 를 못 열면(열화 모드) 빈 배열 — 참조 경고는 부가 기능이지 핵심 경로가 아니다. */
export async function findReferrers(id: DrillId): Promise<Referrer[]> {
  try {
    const db = await getDB();
    const sessions = await db.getAllFromIndex('sessions', 'by_drillId', id);
    return sessions.map((s) => ({ kind: 'session' as const, id: s.id, title: s.title }));
  } catch {
    return [];
  }
}
