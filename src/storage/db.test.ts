// §10.6 db. getDB/persistence/pressure/toStorageError 의 기본 동작.
import { describe, it, expect } from 'vitest';
import { getDB, isStorageStale, ensurePersistence, storagePressure, toStorageError, DB_NAME, DB_VERSION } from './db.ts';
import { StorageError } from './errors.ts';

describe('getDB', () => {
  it('SpinDB 스키마의 4개 스토어를 연다', async () => {
    const db = await getDB();
    expect(db.name).toBe(DB_NAME);
    expect(db.version).toBe(DB_VERSION);
    expect(Array.from(db.objectStoreNames).sort()).toEqual(['drillSummaries', 'drills', 'meta', 'sessions']);
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

describe('ensurePersistence / storagePressure', () => {
  it('navigator.storage 가 없거나 부분 지원이어도 던지지 않는다', async () => {
    await expect(ensurePersistence()).resolves.not.toThrow;
    const result = await ensurePersistence();
    expect(['persisted', 'best-effort', 'unavailable']).toContain(result);
  });
  it('storagePressure 는 null 또는 0~1 사이 숫자를 돌려준다', async () => {
    const p = await storagePressure();
    expect(p === null || (p >= 0 && p <= 1)).toBe(true);
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
