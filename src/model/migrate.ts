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
/** prefs 는 여기서 처음으로 체인이 생긴다(§7 3.0). **v1 → v2 로 한 번만 올린다** — 트레이 서랍·
 *  seed 도장·2존 모드를 나눠 올리면 3차에 만든 백업 파일과 5차에 만든 백업 파일의 스키마가 서로
 *  달라지고, 중간 버전(v2)만 아는 파일이 세상에 남는다.
 *
 *  기본값을 `storage/prefs.ts` 에서 끌어오지 않고 리터럴로 박는 이유 둘: (a) prefs.ts 가 이 파일을
 *  import 하므로 반대 방향은 순환이다 (b) 마이그레이션은 **그때의 기본값**을 적어 둔 역사라, 나중에
 *  기본값이 바뀌어도 과거 문서의 해석이 따라 바뀌면 안 된다.
 *  `theme` 은 건드리지 않는다 — index.html 부트 스크립트가 마이그레이션을 거치지 않은 날것의
 *  localStorage 를 첫 페인트 전에 읽으므로, 이 필드를 옮기는 순간 테마가 깜빡인다. */
export const PREFS_MIGRATIONS: DocMigration[] = [
  {
    from: 1,
    to: 2,
    describe: 'prefs v1→v2: 트레이 서랍(tray) · seed 도장(seeded) · 2존 모드(a11y.twoZone)',
    migrate: (doc) => {
      // 없거나 형상이 어긋난 자리만 채운다 — 기존 값은 하나도 덮어쓰지 않는다.
      const branch = (v: unknown): Record<string, unknown> =>
        v !== null && typeof v === 'object' && !Array.isArray(v) ? { ...(v as Record<string, unknown>) } : {};
      const tray = branch(doc.tray);
      if (typeof tray.draw !== 'boolean') tray.draw = false;
      if (typeof tray.note !== 'boolean') tray.note = false;
      const a11y = branch(doc.a11y);
      if (typeof a11y.twoZone !== 'boolean') a11y.twoZone = false;
      const seeded = typeof doc.seeded === 'boolean' ? doc.seeded : false;
      return { ...doc, tray, a11y, seeded };
    },
  },
];

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
