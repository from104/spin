// §4.2 IndexedDB. DB_VERSION(구조) 과 문서 schemaVersion(내용) 을 절대 섞지 않는다 — 읽기 시점
// 마이그레이션은 model/migrate.ts, 여기는 스토어·인덱스 구조만 다룬다. 인덱스는 최소로 유지한다
// (by_category/by_tag 는 §4.3 의 "요약 전량 읽고 메모리 필터" 전략상 아무도 안 쓰면서 매 put 마다
// 쓰기 비용·쿼터를 소모하므로 넣지 않는다).
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Drill } from '../model/drill.ts';
import type { DrillSummary } from '../model/summary.ts';
import type { TrainingSession } from '../model/session.ts';
import type { DrillId, SessionId } from '../core/ids.ts';
import { StorageError, STORAGE_ERROR_MESSAGES, type StorageErrorCode } from './errors.ts';

export const DB_NAME = 'spin';
export const DB_VERSION = 1;

export interface MetaRecord {
  key: string;
  value: unknown;
}

export interface SpinDB extends DBSchema {
  drills: { key: DrillId; value: Drill; indexes: { by_updatedAt: number } };
  drillSummaries: { key: DrillId; value: DrillSummary; indexes: { by_updatedAt: number } };
  sessions: {
    key: SessionId;
    value: TrainingSession;
    indexes: { by_updatedAt: number; by_drillId: DrillId };
  };
  meta: { key: string; value: MetaRecord };
}

let dbPromise: Promise<IDBPDatabase<SpinDB>> | null = null;
let needsReload = false;
let inFlight = 0;
let staleCb: (() => void) | undefined;

export function isStorageStale(): boolean {
  return needsReload;
}

export function onStorageStale(cb: () => void): void {
  staleCb = cb;
}

/** in-flight 쓰기 카운터 ++. blocking() 이 db.close() 전에 이 카운터를 배수한다 —
 *  close() 는 진행 중인 쓰기 트랜잭션을 abort 시키기 때문이다. */
export function beginWrite(): void {
  inFlight++;
}
export function endWrite(): void {
  inFlight--;
}

function openSpinDB(): Promise<IDBPDatabase<SpinDB>> {
  return openDB<SpinDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        db.createObjectStore('drills', { keyPath: 'id' }).createIndex('by_updatedAt', 'updatedAt');
        db.createObjectStore('drillSummaries', { keyPath: 'id' }).createIndex('by_updatedAt', 'updatedAt');
        const s = db.createObjectStore('sessions', { keyPath: 'id' });
        s.createIndex('by_updatedAt', 'updatedAt');
        s.createIndex('by_drillId', 'drillIds', { multiEntry: true });
        db.createObjectStore('meta', { keyPath: 'key' });
      }
      // if (oldVersion < 2) { /* 예: drillSets 스토어 */ }
    },
    // DB 를 닫고 재연결을 시도하지 않는다 — 닫은 뒤 다시 openDB('spin',1) 을 부르면 디스크
    // 버전(신규) > 요청 버전(1) 이라 VersionError 로 영구 실패한다. needsReload 를 세워
    // getDB() 가 즉시 reject 하게 한다.
    blocking() {
      needsReload = true;
      void (async () => {
        const t0 = Date.now();
        while (inFlight > 0 && Date.now() - t0 < 3000) await new Promise((r) => setTimeout(r, 50));
        (await dbPromise)?.close();
        dbPromise = null;
        staleCb?.(); // UI: '새 버전이 열렸습니다. 새로고침하세요' (닫기 불가 모달)
      })();
    },
    terminated() {
      dbPromise = null;
    },
  });
}

export function getDB(): Promise<IDBPDatabase<SpinDB>> {
  if (needsReload) {
    return Promise.reject(new StorageError('E_DB_UNAVAILABLE', STORAGE_ERROR_MESSAGES.E_DB_UNAVAILABLE()));
  }
  if (!dbPromise) {
    // 실패를 캐싱하지 않는다 — 다음 getDB() 호출이 다시 시도할 수 있어야 한다.
    dbPromise = openSpinDB().catch((e) => {
      dbPromise = null;
      throw e;
    });
  }
  return dbPromise;
}

export function toStorageError(e: unknown, fallback: StorageErrorCode): StorageError {
  if (e instanceof StorageError) return e;
  // DOMException(jsdom 포함 일부 구현) 은 instanceof Error 가 아닐 수 있어(실측 확인) 구조적으로
  // name 필드를 본다.
  const name = e && typeof e === 'object' && 'name' in e && typeof (e as { name: unknown }).name === 'string' ? (e as { name: string }).name : '';
  if (name === 'QuotaExceededError') {
    return new StorageError('E_QUOTA', STORAGE_ERROR_MESSAGES.E_QUOTA(), { cause: e });
  }
  return new StorageError(fallback, STORAGE_ERROR_MESSAGES[fallback](), { cause: e });
}
