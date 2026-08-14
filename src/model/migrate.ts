// §4.1 스키마 버저닝. DB_VERSION(IndexedDB 구조)과 schemaVersion(문서 내용)을 절대 섞지 않는다.
// 문서 마이그레이션은 읽기 시점 + 기회적 되쓰기.
export interface DocMigration {
  from: number;
  to: number;
  describe: string;
  migrate(doc: Record<string, unknown>): Record<string, unknown>;
}
/** 드릴 v1 → v2 (§7 3.2/3.3). **한 번만 올린다** — 교육 필드와 훈련량을 나눠 올리면 migrate 를
 *  두 번 돌고, "교육 필드는 아는데 훈련량은 모르는" 중간 버전 파일이 세상에 남는다.
 *
 *  PREFS_MIGRATIONS 와 같은 규칙 셋을 그대로 따른다: (a) **없거나 형상이 어긋난 자리만** 채운다 —
 *  기존 값은 하나도 덮어쓰지 않는다 (b) 기본값을 리터럴로 박는다(마이그레이션은 *그때의* 기본값을
 *  적어 둔 역사다) (c) 알 수 없는 필드는 그대로 통과시킨다 — 여기서 거르면 화이트리스트가 두 곳이
 *  되고, 실제 거르는 자리는 validateDrill 하나여야 한다.
 *
 *  숫자 셋(필요 인원·반복·세트·인터벌)의 기본값이 1 이 아니라 **0(미지정)** 인 이유는 drill.ts
 *  주석 참고 — 정하지도 않은 "1회 × 1세트" 를 4차 PDF 가 사실인 양 찍게 두지 않는다. */
export const DRILL_MIGRATIONS: DocMigration[] = [
  {
    from: 1,
    to: 2,
    describe: 'drill v1→v2: 교육 필드(목적·코칭 포인트·필요 인원·필요 장비) + 훈련량(반복·세트·인터벌)',
    migrate: (doc) => {
      const out: Record<string, unknown> = { ...doc };
      if (typeof out.objective !== 'string') out.objective = '';
      if (!Array.isArray(out.coachingPoints)) out.coachingPoints = [];
      if (typeof out.equipment !== 'string') out.equipment = '';
      for (const k of ['playersNeeded', 'reps', 'sets', 'intervalSec']) {
        if (typeof out[k] !== 'number' || !Number.isFinite(out[k])) out[k] = 0;
      }
      return out;
    },
  },
  {
    from: 2,
    to: 3,
    describe: 'drill v2→v3: 코트 크기 3단(courtSize) — 옛 드릴은 30×18 로 못박는다',
    migrate: (doc) => {
      const out: Record<string, unknown> = { ...doc };
      // ⚠️ **이 한 줄이 "기존 드릴이 지금과 똑같이 보인다" 의 전부다.** courtSize 를 안 새기면
      // 기본값이 언젠가 28×15 로 옮겨졌을 때 옛 드릴이 통째로 다른 코트에서 열린다 —
      // 좌표는 30×18 인데 판만 작아지므로 선수가 라인 밖에 선다.
      // 기본값을 `court.ts` 에서 끌어오지 않고 리터럴로 박는 이유는 위 체인과 같다:
      // 마이그레이션은 **그때의 기본값**을 적어 둔 역사다.
      if (typeof out.courtSize !== 'string') out.courtSize = '30x18';
      return out;
    },
  },
  // 5.2 `BallDef.ring`(공마다 3 m/5 m 원)은 **여기에 단계를 더하지 않는다** — 근거 셋은
  // drill.ts 의 CURRENT_DRILL_SCHEMA 주석에 있다. 요지: 없으면 'none' 이 전역이라 채울 것이
  // 0 이고, 옛 앱이 몰라도 좌표의 뜻이 안 바뀌며, 도장을 올리면 배포된 v0.1.0 이 새 파일을
  // 전부 too-new 로 거절한다. **이 체인의 마지막 to 는 CURRENT_DRILL_SCHEMA 와 같아야 한다**
  // (같지 않으면 migrateDoc 이 no-path 로 떨어져 모든 옛 파일이 열리지 않는다).
  {
    from: 3,
    to: 4,
    describe: 'drill v3→v4: 작도 도형(shapes) — 옛 스텝에는 빈 배열을 찍는다',
    // ⚠️ **적을 참말이 없는 상승이다**(drill.ts 의 CURRENT_DRILL_SCHEMA 주석). 빈 배열은
    // sanitize 가 어차피 만들어 주므로 이 함수는 사실상 아무 일도 안 한다 — 목적은 도장이고,
    // 도장의 목적은 **옛 앱이 새 파일을 정직하게 거절하게** 하는 것이다.
    migrate: (doc) => {
      const out: Record<string, unknown> = { ...doc };
      if (Array.isArray(out.steps)) {
        out.steps = out.steps.map((st) =>
          st && typeof st === 'object' && !Array.isArray((st as Record<string, unknown>).shapes)
            ? { ...(st as Record<string, unknown>), shapes: [] }
            : st,
        );
      }
      return out;
    },
  },
];
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
