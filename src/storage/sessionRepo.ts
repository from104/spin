// §4.5 세션 리포지토리. sessions.put 을 모듈 밖으로 노출하지 않는다 — 모든 쓰기가 putSession 을
// 통과하고, putSession 은 무조건 drillIds = refDrillIds(items) 를 재계산한다. 이 인덱스가
// deleteDrill 앞 경고("이 드릴은 세션 2개에서 사용 중입니다")의 유일한 방어선이다.
import { getDB, beginWrite, endWrite, toStorageError } from './db.ts';
import { StorageError, STORAGE_ERROR_MESSAGES } from './errors.ts';
import type { TrainingSession, SessionItem, ResolvedSession } from '../model/session.ts';
import { CURRENT_SESSION_SCHEMA, resolveSession, pickNextSession } from '../model/session.ts';
import { refDrillIds, reorderRefs, refreshRefs } from '../model/refs.ts';
import type { DrillSummary } from '../model/summary.ts';
import { newId } from '../core/ids.ts';
import type { DrillId, SessionId } from '../core/ids.ts';

type SummaryCacheSrc = Pick<DrillSummary, 'title' | 'durationMin' | 'category'>;

/** 캐시 갱신(refreshRefs)의 소스는 드릴 전문이 아니라 요약이다(8개 세션이면 100 KB → 5.6 KB). */
async function loadSummaryMap(): Promise<Map<DrillId, SummaryCacheSrc>> {
  const db = await getDB();
  const all = await db.getAll('drillSummaries');
  const map = new Map<DrillId, SummaryCacheSrc>();
  for (const s of all) map.set(s.id, { title: s.title, durationMin: s.durationMin, category: s.category });
  return map;
}

async function existingDrillIdSet(): Promise<Set<DrillId>> {
  const db = await getDB();
  const keys = await db.getAllKeys('drillSummaries');
  return new Set(keys);
}

/** 조건부 되쓰기 — 세션이 읽었던 그대로(updatedAt 불변)일 때만 캐시를 갱신한다.
 *  fire-and-forget 이므로 실패를 반드시 삼킨다. */
async function refreshSessionCacheOpportunistic(s: TrainingSession): Promise<void> {
  const summaryMap = await loadSummaryMap();
  const refreshedItems = refreshRefs(s.items, summaryMap);
  const changed = refreshedItems.some((it, i) => {
    const orig = s.items[i];
    return !orig || it.titleCache !== orig.titleCache || it.durationMinCache !== orig.durationMinCache || it.categoryCache !== orig.categoryCache;
  });
  if (!changed) return;
  const db = await getDB();
  beginWrite();
  try {
    const tx = db.transaction('sessions', 'readwrite');
    const cur = await tx.store.get(s.id);
    if (!cur || cur.updatedAt !== s.updatedAt) {
      tx.abort();
      await tx.done.catch(() => {});
      return;
    }
    const next: TrainingSession = { ...cur, items: refreshedItems, drillIds: refDrillIds(refreshedItems) };
    tx.store.put(next);
    await tx.done;
  } finally {
    endWrite();
  }
}

export async function listSessions(): Promise<ResolvedSession[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex('sessions', 'by_updatedAt');
  const existing = await existingDrillIdSet();
  for (const s of all) void refreshSessionCacheOpportunistic(s).catch(() => {});
  return all.map((s) => resolveSession(s, existing)).sort((a, b) => b.session.updatedAt - a.session.updatedAt);
}

export async function getSession(id: SessionId): Promise<ResolvedSession | undefined> {
  const db = await getDB();
  const s = await db.get('sessions', id);
  if (!s) return undefined;
  void refreshSessionCacheOpportunistic(s).catch(() => {});
  const existing = await existingDrillIdSet();
  return resolveSession(s, existing);
}

/** 유일한 쓰기 경로. drillIds 를 무조건 재계산하고 updatedAt 을 찍는다. */
export async function putSession(s: TrainingSession): Promise<TrainingSession> {
  const items = s.items;
  const next: TrainingSession = { ...s, items, drillIds: refDrillIds(items), updatedAt: Date.now() };
  const db = await getDB().catch((e) => {
    throw toStorageError(e, 'E_DB_UNAVAILABLE');
  });
  beginWrite();
  try {
    const tx = db.transaction('sessions', 'readwrite');
    tx.store.put(next);
    await tx.done;
  } catch (e) {
    throw toStorageError(e, 'E_DB_UNAVAILABLE');
  } finally {
    endWrite();
  }
  return next;
}

export async function createSession(init: { title: string; scheduledAt?: number; location?: string }): Promise<TrainingSession> {
  const now = Date.now();
  const s: TrainingSession = {
    schemaVersion: CURRENT_SESSION_SCHEMA,
    id: newId('se'),
    title: init.title,
    ...(init.scheduledAt !== undefined ? { scheduledAt: init.scheduledAt } : {}),
    ...(init.location !== undefined ? { location: init.location } : {}),
    items: [],
    drillIds: [],
    createdAt: now,
    updatedAt: now,
  };
  return putSession(s);
}

export async function deleteSession(id: SessionId): Promise<void> {
  const db = await getDB();
  beginWrite();
  try {
    const tx = db.transaction('sessions', 'readwrite');
    tx.store.delete(id);
    await tx.done;
  } catch (e) {
    throw toStorageError(e, 'E_DB_UNAVAILABLE');
  } finally {
    endWrite();
  }
}

export async function addDrillToSession(id: SessionId, drillId: DrillId): Promise<TrainingSession> {
  const db = await getDB();
  const s = await db.get('sessions', id);
  if (!s) throw new StorageError('E_NOT_FOUND', STORAGE_ERROR_MESSAGES.E_NOT_FOUND());
  const summaryMap = await loadSummaryMap();
  const meta = summaryMap.get(drillId);
  const item: SessionItem = {
    id: newId('it'),
    drillId,
    titleCache: meta?.title ?? '',
    durationMinCache: meta?.durationMin ?? 0,
    categoryCache: meta?.category ?? '',
  };
  return putSession({ ...s, items: [...s.items, item] });
}

export async function reorderSessionItems(id: SessionId, from: number, to: number): Promise<TrainingSession> {
  const db = await getDB();
  const s = await db.get('sessions', id);
  if (!s) throw new StorageError('E_NOT_FOUND', STORAGE_ERROR_MESSAGES.E_NOT_FOUND());
  return putSession({ ...s, items: reorderRefs(s.items, from, to) });
}

export async function upcomingSession(): Promise<ResolvedSession | undefined> {
  const db = await getDB();
  const all = await db.getAll('sessions');
  const next = pickNextSession(all);
  if (!next) return undefined;
  const existing = await existingDrillIdSet();
  return resolveSession(next, existing);
}
