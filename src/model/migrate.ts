// §4.1 스키마 버저닝. DB_VERSION(IndexedDB 구조)과 schemaVersion(문서 내용)을 절대 섞지 않는다.
// 문서 마이그레이션은 읽기 시점 + 기회적 되쓰기.
export interface DocMigration {
  from: number;
  to: number;
  describe: string;
  migrate(doc: Record<string, unknown>): Record<string, unknown>;
}
export const DRILL_MIGRATIONS: DocMigration[] = []; // v1 에서는 비어 있다
export const SESSION_MIGRATIONS: DocMigration[] = [];
export const PREFS_MIGRATIONS: DocMigration[] = [];

export type MigrateResult =
  | { ok: true; doc: Record<string, unknown>; changed: boolean; applied: string[] }
  | { ok: false; reason: 'too-new'; found: number; supported: number }
  | { ok: false; reason: 'no-path'; found: number };

export function migrateDoc(raw: unknown, chain: DocMigration[], current: number): MigrateResult {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, reason: 'no-path', found: 0 };
  }
  const hadVersionField = Object.prototype.hasOwnProperty.call(raw, 'schemaVersion');
  const doc = structuredClone(raw) as Record<string, unknown>; // 얕은 복사 금지 — 호출자 오염
  const v0 = doc.schemaVersion === undefined ? 1 : doc.schemaVersion;
  if (!Number.isInteger(v0) || (v0 as number) < 1) {
    // NaN/Infinity/1.5 를 통과시키면 while 루프를 건너뛰고 도장만 찍힌다
    return { ok: false, reason: 'no-path', found: Number(v0) || 0 };
  }
  let version = v0 as number;
  if (version > current) {
    return { ok: false, reason: 'too-new', found: version, supported: current };
  }

  const applied: string[] = [];
  let cursor = doc;
  while (version < current) {
    const step = chain.find((m) => m.from === version);
    if (!step) return { ok: false, reason: 'no-path', found: version };
    cursor = step.migrate(cursor);
    cursor.schemaVersion = step.to;
    applied.push(step.describe);
    version = step.to;
  }
  cursor.schemaVersion = current;

  return { ok: true, doc: cursor, changed: applied.length > 0 || !hadVersionField, applied };
}
