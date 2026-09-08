// §10.6 db. getDB/toStorageError 의 기본 동작.
import { describe, it, expect } from 'vitest';
import { openDB } from 'idb';
import type { DBSchema } from 'idb';
import { getDB, isStorageStale, toStorageError, DB_NAME, DB_VERSION } from './db.ts';
import { StorageError } from './errors.ts';

// ★ 이 describe 가 **파일에서 가장 먼저** 온다. `getDB()` 는 모듈 싱글턴이라 아래 케이스가
//   먼저 돌면 DB 가 이미 v2 로 열려 있어 v1 을 세울 수 없다(fake-indexeddb 가 VersionError).
// ── v1 → v2 업그레이드 (2026-09-09 검수) ─────────────────────────────────────────────
// 위 케이스는 **빈 DB 에 v2 를 새로 여는** 경로라, `upgrade` 의 `oldVersion < 2` 분기가 옛
// 데이터 위에서 도는 길을 한 번도 안 탄다. 이 파일을 지우면 새는 것: 스토어를 하나 더 파면서
// 실수로 기존 스토어를 지우거나 다시 만들어 **드릴·세션·명단이 통째로 사라지는** 것 — 사용자가
// 앱을 새 버전으로 여는 그 한 번에만 일어나고, 그 뒤에는 복구할 데이터가 없다.
// PLAN-TEAM §4 실기 ①(탭 두 개)의 나머지 절반(멀티탭 강제 새로고침)만 실기에 남는다.
describe('DB v1 → v2 업그레이드', () => {
  /** v1 시절의 스키마 — **여기서만** 산다. `db.ts` 의 SpinDB 는 이미 v2 라 옛 판을 재현할 수
   *  없고, 이 선언이 곧 «그때 무엇이 있었나» 의 기록이다. 값은 대조에 쓰는 필드만 적는다. */
  interface V1Schema extends DBSchema {
    drills: { key: string; value: { id: string; schemaVersion: number; title: string; updatedAt: number } };
    drillSummaries: { key: string; value: { id: string; title: string; updatedAt: number }; indexes: { by_updatedAt: number } };
    sessions: {
      key: string;
      value: { id: string; schemaVersion: number; title: string; drillIds: string[]; updatedAt: number };
      indexes: { by_updatedAt: number; by_drillId: string };
    };
    meta: { key: string; value: { key: string; value: unknown } };
  }

  it('v1 의 레코드·인덱스가 살아남고 teams 스토어가 는다', async () => {
    const v1 = await openDB<V1Schema>(DB_NAME, 1, {
      upgrade(db) {
        db.createObjectStore('drills', { keyPath: 'id' });
        db.createObjectStore('drillSummaries', { keyPath: 'id' }).createIndex('by_updatedAt', 'updatedAt');
        const s = db.createObjectStore('sessions', { keyPath: 'id' });
        s.createIndex('by_updatedAt', 'updatedAt');
        s.createIndex('by_drillId', 'drillIds', { multiEntry: true });
        db.createObjectStore('meta', { keyPath: 'key' });
      },
    });
    await v1.put('drills', { id: 'dr_old', schemaVersion: 11, title: '옛 드릴', updatedAt: 1 });
    await v1.put('drillSummaries', { id: 'dr_old', title: '옛 드릴', updatedAt: 1 });
    await v1.put('sessions', { id: 'se_old', schemaVersion: 2, title: '옛 세션', drillIds: ['dr_old'], updatedAt: 1 });
    await v1.put('meta', { key: 'roster', value: { schemaVersion: 1, players: [{ id: 'pl_a', name: '김' }], updatedAt: 5 } });
    expect(v1.version).toBe(1);
    v1.close();

    const db = await getDB();
    expect(db.version).toBe(2);
    expect(await db.get('drills', 'dr_old' as never)).toMatchObject({ title: '옛 드릴' });
    expect(await db.get('drillSummaries', 'dr_old' as never)).toMatchObject({ title: '옛 드릴' });
    expect(await db.get('sessions', 'se_old' as never)).toMatchObject({ title: '옛 세션' });
    expect((await db.get('meta', 'roster'))?.value).toMatchObject({ players: [{ id: 'pl_a' }] });
    expect(Array.from(db.objectStoreNames).sort()).toEqual(['drillSummaries', 'drills', 'meta', 'sessions', 'teams']);
    // 옛 인덱스도 산다 — 스토어를 다시 만들면 여기서 잡힌다.
    expect(await db.getAllFromIndex('sessions', 'by_drillId', 'dr_old' as never)).toHaveLength(1);
  });
});

describe('getDB', () => {
  it('SpinDB 스키마의 5개 스토어를 연다 — v2 에서 teams 가 늘었다', async () => {
    const db = await getDB();
    expect(db.name).toBe(DB_NAME);
    expect(db.version).toBe(DB_VERSION);
    expect(DB_VERSION).toBe(2); // [팀] 메뉴(2026-09-09) — 올리는 대가는 멀티탭 강제 새로고침이다
    expect(Array.from(db.objectStoreNames).sort()).toEqual(['drillSummaries', 'drills', 'meta', 'sessions', 'teams']);
    // 목록 정렬의 유일한 축 — 인덱스가 없으면 listTeams 가 조용히 통째 스캔으로 떨어진다.
    expect(Array.from(db.transaction('teams').store.indexNames)).toEqual(['by_updatedAt']);
  });
  it('같은 커넥션을 재사용한다(싱글턴)', async () => {
    const a = await getDB();
    const b = await getDB();
    expect(a).toBe(b);
  });
  it('isStorageStale 은 초기 상태에서 false', () => {
    expect(isStorageStale()).toBe(false);
  });
});

describe('toStorageError', () => {
  it('StorageError 는 그대로 통과시킨다', () => {
    const original = new StorageError('E_NOT_FOUND', '없음');
    expect(toStorageError(original, 'E_DB_UNAVAILABLE')).toBe(original);
  });
  it('QuotaExceededError 이름을 가진 에러는 E_QUOTA 로 변환한다(instanceof Error 여부와 무관)', () => {
    const dom = new DOMException('quota', 'QuotaExceededError');
    expect(toStorageError(dom, 'E_DB_UNAVAILABLE').code).toBe('E_QUOTA');
  });
  it('그 외 에러는 fallback 코드로 변환한다', () => {
    expect(toStorageError(new Error('boom'), 'E_DB_UNAVAILABLE').code).toBe('E_DB_UNAVAILABLE');
    expect(toStorageError('그냥 문자열', 'E_INVALID_FILE').code).toBe('E_INVALID_FILE');
  });
});
