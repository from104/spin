// 0.6 Drive 동기화 — 동기화 부기(bookkeeping)의 단일 출처. **meta 스토어의 'sync/' 레코드들**이다.
//
// 새 IDB 스토어를 파지 않는다(rosterRepo 머리말과 같은 판단): 전용 스토어는 DB_VERSION 상승
// + 열린 다른 탭 전부에 blocking() 강제 새로고침 모달(db.ts)이 따라온다. meta 한 키에 배열로
// 뭉치지도 않는다 — 두 탭이 동시에 삭제하면 읽기-수정-쓰기 레이스로 톰스톤이 유실된다.
// 레코드 하나 = put 하나라서, 삭제 트랜잭션 **안에** 원자적으로 낄 수 있는 것이 개별 레코드의
// 요점이다(deleteDrill/deleteSession 이 실제로 그렇게 쓴다).
//
// 키 설계:
//   sync/d/<type>/<id> = { lastSyncedAt, remoteFileId? }   문서행 — 마지막으로 원격과 맞춘 시각
//   sync/t/<type>/<id> = { deletedAt }                     톰스톤 — "여기서 지웠다" 의 증거
//   sync/meta          = { writerId, accountEmail?, lastSyncAt? }
//
// "동기화 대기(dirty)" 상태는 **저장하지 않는다** — updatedAt > lastSyncedAt 로 매 패스
// 재유도한다. 크래시·토큰 만료 어디서 끊겨도 다음 패스가 줍고, 유실할 상태 자체가 없다.
import { getDB, beginWrite, endWrite, toStorageError, type MetaRecord } from './db.ts';

/** 동기화 대상 문서 종류. prefs·board 는 v1 범위 밖이다(수정시각이 없어 최신 승 판정 불가 —
 *  계획서 결정 6). roster 는 단일 문서라 id 를 'roster' 하나로 고정해 쓴다. */
export type SyncDocType = 'drill' | 'session' | 'roster';

export interface SyncDocRow {
  /** 이 문서를 마지막으로 원격과 맞춘 시각(= 그 시점의 updatedAt). */
  lastSyncedAt: number;
  /** 원격 파일 id — 있으면 files.list 없이도 그 파일을 조준할 수 있는 최적화 힌트일 뿐,
   *  진실은 언제나 원격 목록의 appProperties 다. */
  remoteFileId?: string;
}

export interface SyncTombstoneRow {
  deletedAt: number;
}

export interface SyncDeviceMeta {
  /** 이 기기(정확히는 이 브라우저 프로필)의 식별자. 충돌 동률의 tie-break 에 쓴다. */
  writerId: string;
  /** 연결된 구글 계정 힌트. prefs 가 아니라 여기 두는 이유: 백업 파일(collectBackup)은
   *  prefs 를 통째로 싣는다 — 이메일이 백업을 타고 다른 기기·다른 사람에게 가면 안 된다. */
  accountEmail?: string;
  lastSyncAt?: number;
}

const DOC_PREFIX = 'sync/d/';
const TOMB_PREFIX = 'sync/t/';
export const SYNC_META_KEY = 'sync/meta';

export function docRowKey(type: SyncDocType, id: string): string {
  return `${DOC_PREFIX}${type}/${id}`;
}
export function tombstoneKey(type: SyncDocType, id: string): string {
  return `${TOMB_PREFIX}${type}/${id}`;
}

/** 삭제 트랜잭션 안에 끼워 넣을 톰스톤 레코드. 리포가 `tx.objectStore('meta').put(...)` 한 줄로
 *  삭제와 같은 tx 에 원자적으로 기록한다 — 삭제와 "지웠다는 기록" 이 따로 가면 그 사이에서
 *  크래시했을 때 다른 기기가 이 삭제를 영영 모른다. */
export function tombstoneRecord(type: SyncDocType, id: string, deletedAt: number): MetaRecord {
  return { key: tombstoneKey(type, id), value: { deletedAt } satisfies SyncTombstoneRow };
}

/** 'sync/d/drill/dr_abc' → { type:'drill', id:'dr_abc' }. 형식이 아니면 null. */
function parseKey(prefix: string, key: string): { type: SyncDocType; id: string } | null {
  if (!key.startsWith(prefix)) return null;
  const rest = key.slice(prefix.length);
  const cut = rest.indexOf('/');
  if (cut <= 0 || cut === rest.length - 1) return null;
  const type = rest.slice(0, cut);
  if (type !== 'drill' && type !== 'session' && type !== 'roster') return null;
  return { type, id: rest.slice(cut + 1) };
}

/** 문자열 키의 접두 범위. '￿' 상한은 IndexedDB 문자열 키 정렬(코드 유닛 순)에서
 *  해당 접두로 시작하는 모든 키를 덮는 표준 관용구다. */
const prefixRange = (prefix: string) => IDBKeyRange.bound(prefix, `${prefix}￿`);

// ── 문서행 ────────────────────────────────────────────────────────────────────────────

export async function getSyncDocRow(type: SyncDocType, id: string): Promise<SyncDocRow | undefined> {
  const db = await getDB();
  const rec = await db.get('meta', docRowKey(type, id));
  return rec ? (rec.value as SyncDocRow) : undefined;
}

export async function putSyncDocRow(type: SyncDocType, id: string, row: SyncDocRow): Promise<void> {
  const db = await getDB().catch((e) => {
    throw toStorageError(e, 'E_DB_UNAVAILABLE');
  });
  beginWrite();
  try {
    const tx = db.transaction('meta', 'readwrite');
    tx.store.put({ key: docRowKey(type, id), value: row });
    await tx.done;
  } catch (e) {
    throw toStorageError(e, 'E_DB_UNAVAILABLE');
  } finally {
    endWrite();
  }
}

export async function deleteSyncDocRow(type: SyncDocType, id: string): Promise<void> {
  const db = await getDB();
  beginWrite();
  try {
    const tx = db.transaction('meta', 'readwrite');
    tx.store.delete(docRowKey(type, id));
    await tx.done;
  } catch (e) {
    throw toStorageError(e, 'E_DB_UNAVAILABLE');
  } finally {
    endWrite();
  }
}

export async function listSyncDocRows(): Promise<Array<{ type: SyncDocType; id: string; row: SyncDocRow }>> {
  const db = await getDB();
  const recs = await db.getAll('meta', prefixRange(DOC_PREFIX));
  const out: Array<{ type: SyncDocType; id: string; row: SyncDocRow }> = [];
  for (const rec of recs) {
    const parsed = parseKey(DOC_PREFIX, rec.key);
    if (parsed) out.push({ ...parsed, row: rec.value as SyncDocRow });
  }
  return out;
}

/** 계정 교체(다른 이메일로 재연결) 시 — "이 원격과 맞춘 적 있다" 는 기억을 전부 버린다.
 *  **톰스톤은 남긴다**: 이 기기에서 지운 사실은 계정이 바뀌어도 참이고, 새 원격에 같은
 *  문서가 있으면 최신 승 판정이 여전히 필요하다. */
export async function clearSyncDocRows(): Promise<void> {
  const db = await getDB();
  beginWrite();
  try {
    const tx = db.transaction('meta', 'readwrite');
    tx.store.delete(prefixRange(DOC_PREFIX));
    await tx.done;
  } catch (e) {
    throw toStorageError(e, 'E_DB_UNAVAILABLE');
  } finally {
    endWrite();
  }
}

// ── 톰스톤 ────────────────────────────────────────────────────────────────────────────

export async function listTombstones(): Promise<Array<{ type: SyncDocType; id: string; deletedAt: number }>> {
  const db = await getDB();
  const recs = await db.getAll('meta', prefixRange(TOMB_PREFIX));
  const out: Array<{ type: SyncDocType; id: string; deletedAt: number }> = [];
  for (const rec of recs) {
    const parsed = parseKey(TOMB_PREFIX, rec.key);
    if (parsed) out.push({ ...parsed, deletedAt: (rec.value as SyncTombstoneRow).deletedAt });
  }
  return out;
}

/** 톰스톤 정리 — 원격에 삭제가 반영·확인된 뒤(또는 90일 GC)에만 부른다. */
export async function deleteTombstone(type: SyncDocType, id: string): Promise<void> {
  const db = await getDB();
  beginWrite();
  try {
    const tx = db.transaction('meta', 'readwrite');
    tx.store.delete(tombstoneKey(type, id));
    await tx.done;
  } catch (e) {
    throw toStorageError(e, 'E_DB_UNAVAILABLE');
  } finally {
    endWrite();
  }
}

// ── 기기행 ────────────────────────────────────────────────────────────────────────────

export async function getSyncDeviceMeta(): Promise<SyncDeviceMeta | undefined> {
  const db = await getDB();
  const rec = await db.get('meta', SYNC_META_KEY);
  return rec ? (rec.value as SyncDeviceMeta) : undefined;
}

export async function putSyncDeviceMeta(meta: SyncDeviceMeta): Promise<void> {
  const db = await getDB().catch((e) => {
    throw toStorageError(e, 'E_DB_UNAVAILABLE');
  });
  beginWrite();
  try {
    const tx = db.transaction('meta', 'readwrite');
    tx.store.put({ key: SYNC_META_KEY, value: meta });
    await tx.done;
  } catch (e) {
    throw toStorageError(e, 'E_DB_UNAVAILABLE');
  } finally {
    endWrite();
  }
}

/** writerId 를 보장한다 — 없으면 만들어 저장하고, 있으면 그대로. 두 탭이 동시에 불러도
 *  마지막 put 이 이기고 그 뒤로는 같은 값을 읽으므로 실질적 수렴에 문제가 없다(동률
 *  tie-break 용 식별자라 잠깐의 불일치가 데이터를 해치지 않는다). */
export async function ensureWriterId(): Promise<string> {
  const cur = await getSyncDeviceMeta();
  if (cur?.writerId) return cur.writerId;
  const writerId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `w_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  await putSyncDeviceMeta({ ...cur, writerId });
  return writerId;
}

// ── 변경 방송 ─────────────────────────────────────────────────────────────────────────
// 옛 'spin-drill-sync'(발신 putDrill 한 곳 · 수신 0곳)의 후신. 발신을 쓰기 5경로(putDrill·
// deleteDrill·putSession·deleteSession·saveRoster) 전부로 넓히고 'spin-sync' 로 개명했다 —
// 수신자가 0곳인 지금이 개명의 적기다(rg 확인). 동기화 엔진(0.6 커밋 6)이 이 채널을 구독해
// 디바운스 push 의 트리거로 쓴다.
//
// 같은 탭 구독자에게는 **동기 로컬 디스패치**로도 알린다: BroadcastChannel 은 발신 인스턴스
// 자신에게 배달하지 않고, 채널이 없는 환경(구형 브라우저)도 있다 — 로컬 Set 이 그 구멍을
// 막고, 교차 탭은 채널이 나른다. 이 모듈은 단일 번들에서 한 번만 평가되므로 같은 탭에서
// 로컬·채널 이중 배달은 일어나지 않는다.

export type SyncEvent =
  | { type: SyncDocType; id: string; op: 'put'; updatedAt: number }
  | { type: SyncDocType; id: string; op: 'delete'; deletedAt: number }
  /** 동기화 패스 종료(engine.ts 발신) — pulled>0 이면 각 탭의 useSyncEngine 이 라이브러리를
   *  다시 읽는다(LibraryProvider.refresh 는 수동 호출 방식이라 이 방송이 유일한 통지 경로다). */
  | { op: 'pass'; pushed: number; pulled: number };

const listeners = new Set<(e: SyncEvent) => void>();

const bc: BroadcastChannel | undefined = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('spin-sync') : undefined;
if (bc) {
  bc.onmessage = (ev: MessageEvent) => {
    dispatch(ev.data as SyncEvent);
  };
}

function dispatch(e: SyncEvent): void {
  for (const cb of listeners) {
    // 구독자의 예외가 저장 경로를 깨면 안 된다 — 방송은 부가 정보다.
    try {
      cb(e);
    } catch {
      /* 삼킨다 */
    }
  }
}

/** 리포가 쓰기 성공 **후**에 부른다(트랜잭션 밖 — 방송 실패가 저장을 되돌릴 수 없으므로
 *  안에서 부를 이유가 없다). */
export function postSyncEvent(e: SyncEvent): void {
  dispatch(e);
  bc?.postMessage(e);
}

export function subscribeSyncEvents(cb: (e: SyncEvent) => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
