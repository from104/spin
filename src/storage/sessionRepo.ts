// §4.5 세션 리포지토리. sessions.put 을 모듈 밖으로 노출하지 않는다 — 모든 쓰기가 putSession 을
// 통과하고, putSession 은 무조건 drillIds = refDrillIds(flattenSessionItems(s)) 를 재계산한다.
// 이 인덱스가 deleteDrill 앞 경고("이 드릴은 세션 2개에서 사용 중입니다")의 유일한 방어선이다.
// v2(2026-08-18) — 항목이 구획(phases) 안으로 들어갔다. 평평한 순회는 전부 flatten 을 거친다.
import { getDB, beginWrite, endWrite, toStorageError } from './db.ts';
import { StorageError, STORAGE_ERROR_MESSAGES } from './errors.ts';
import type { TrainingSession, SessionItem, ResolvedSession } from '../model/session.ts';
import { CURRENT_SESSION_SCHEMA, resolveSession, pickNextSession, flattenSessionItems, addSessionItem, moveSessionItemFlat } from '../model/session.ts';
import { refDrillIds, refreshRefs } from '../model/refs.ts';
import type { DrillSummary } from '../model/summary.ts';
import { newId } from '../core/ids.ts';
import type { DrillId, SessionId } from '../core/ids.ts';

type SummaryCacheSrc = Pick<DrillSummary, 'title' | 'durationMin' | 'drillType'>;

/** 캐시 갱신(refreshRefs)의 소스는 드릴 전문이 아니라 요약이다(8개 세션이면 100 KB → 5.6 KB). */
async function loadSummaryMap(): Promise<Map<DrillId, SummaryCacheSrc>> {
  const db = await getDB();
  const all = await db.getAll('drillSummaries');
  const map = new Map<DrillId, SummaryCacheSrc>();
  // ⚠️ 재구축 전(build<4) 옛 레코드에는 drillType 이 없을 수 있다 — 캐시는 표시용 점 하나라
  // 'technical' 폴백이면 충분하고, 다음 refreshRefs 가 재구축된 값으로 덮는다.
  for (const s of all) map.set(s.id, { title: s.title, durationMin: s.durationMin, drillType: s.drillType ?? 'technical' });
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
  // 구획마다 따로 갱신한다 — refreshRefs 는 평평한 배열용이라, 구획 구조는 여기서 보존한다.
  const refreshedPhases = s.phases.map((p) => ({ ...p, items: refreshRefs(p.items, summaryMap) }));
  const before = flattenSessionItems(s);
  const after = flattenSessionItems({ phases: refreshedPhases });
  const changed = after.some((it, i) => {
    const orig = before[i];
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
    const next: TrainingSession = { ...cur, phases: refreshedPhases, drillIds: refDrillIds(after) };
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

/** 유일한 쓰기 경로. drillIds 를 무조건 재계산하고 updatedAt 을 찍는다.
 *  ⚠️ 재계산은 **flatten 기준**이다 — 구획을 직접 돌면 by_drillId 인덱스가 구획 하나를
 *  빠뜨려도 컴파일이 통과한다. 이 인덱스가 깨지면 드릴 삭제 경고가 침묵한다. */
export async function putSession(s: TrainingSession): Promise<TrainingSession> {
  const next: TrainingSession = { ...s, drillIds: refDrillIds(flattenSessionItems(s)), updatedAt: Date.now() };
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
    phases: [], // 빈 세션은 구획도 0 — 첫 드릴 추가(addSessionItem)가 기본 구획을 만든다
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
    categoryCache: meta?.drillType ?? '', // v8 — 캐시 값은 유형 키다(refs.ts DrillRef 주석)
  };
  return putSession(addSessionItem(s, item)); // 마지막 구획에 붙는다(없으면 기본 구획 생성)
}

export async function reorderSessionItems(id: SessionId, from: number, to: number): Promise<TrainingSession> {
  const db = await getDB();
  const s = await db.get('sessions', id);
  if (!s) throw new StorageError('E_NOT_FOUND', STORAGE_ERROR_MESSAGES.E_NOT_FOUND());
  // 첨자는 flatten 좌표계다(드로어의 ↑↓). 구획 경계를 넘으면 그 구획으로 이사한다.
  return putSession(moveSessionItemFlat(s, from, to));
}

export async function upcomingSession(): Promise<ResolvedSession | undefined> {
  const db = await getDB();
  const all = await db.getAll('sessions');
  const next = pickNextSession(all);
  if (!next) return undefined;
  const existing = await existingDrillIdSet();
  return resolveSession(next, existing);
}
