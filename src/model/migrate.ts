// §4.1 스키마 버저닝. DB_VERSION(IndexedDB 구조)과 schemaVersion(문서 내용)을 절대 섞지 않는다.
// 문서 마이그레이션은 읽기 시점 + 기회적 되쓰기.
import { SHAPE_DEFAULT_PX, triBBox, trianglePoints } from './shape.ts';
import { defaultDefense } from './rules.ts';
import { newId } from '../core/ids.ts';

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
  {
    from: 4,
    to: 5,
    describe: 'drill v4→v5: 자유 삼각형 — 정삼각형(w,h)을 꼭짓점 셋(pts)으로 옮긴다',
    // ⚠️ **여기는 적을 참말이 있다**(v3→v4 와 다르다). 2026-08-15 부터 삼각형의 모양은 w/h 가
    // 아니라 `pts` 가 지므로, 옛 파일의 삼각형은 여기서 명시적으로 꼭짓점을 받아야 한다.
    //
    // sanitize 의 폴백(`triPointsOf`)이 같은 값을 만들어 주므로 화면은 이 단계가 없어도 같다.
    // 그래도 찍는 이유 둘: ① 저장본이 스스로를 설명하게 된다(다음에 이 파일을 읽는 사람이
    // "w 가 한 변이었다" 는 옛 규약을 몰라도 된다) ② **도장을 올려야 배포된 v0.1.0 이 새 파일을
    // 거절한다** — 안 올리면 옛 앱이 자유 삼각형을 정삼각형으로 조용히 다시 그린다.
    //
    // h 는 **한 변이 아니라 실제 높이**(0.866·한변)로 바뀐다. 옛 모델은 w===h===한변 이라
    // 높이가 어디에도 안 적혀 있었고, 크기 표시가 그만큼 거짓말을 하고 있었다.
    migrate: (doc) => {
      const out: Record<string, unknown> = { ...doc };
      if (!Array.isArray(out.steps)) return out;
      out.steps = out.steps.map((st) => {
        if (!st || typeof st !== 'object') return st;
        const step = st as Record<string, unknown>;
        if (!Array.isArray(step.shapes)) return st;
        return {
          ...step,
          shapes: step.shapes.map((sh) => {
            if (!sh || typeof sh !== 'object') return sh;
            const shape = sh as Record<string, unknown>;
            if (shape.kind !== 'triangle' || shape.pts !== undefined) return sh;
            // 옛 규약: w 가 한 변이다(h 는 같은 값을 들고 다녔을 뿐 쓰이지 않았다).
            const side = typeof shape.w === 'number' && Number.isFinite(shape.w) ? shape.w : SHAPE_DEFAULT_PX;
            const pts = trianglePoints(side);
            const bbox = triBBox(pts);
            return { ...shape, w: bbox.w, h: bbox.h, pts: pts.map((p) => ({ x: p.x, y: p.y })) };
          }),
        };
      });
      return out;
    },
  },
  {
    from: 5,
    to: 6,
    describe: 'drill v5→v6: 진영(defense) — 옛 드릴은 기본 배치의 골키퍼 자리를 따른다',
    // ⚠️ **여기도 적을 참말이 있다.** 2026-08-15 부터 골 지역 3인 반칙은 **수비 팀만** 센다
    // (Law 11 — 공격은 제한 없다). 그 판단의 유일한 입력이 `defense` 이므로, 값이 없으면
    // 판정이 아니라 **누구를 붉게 칠하느냐**가 달라진다.
    //
    // 찍는 값은 `defaultDefense(courtMode)` 와 같아야 한다 — 정화기의 폴백과 갈라지면
    // "마이그레이션을 지난 파일" 과 "안 지난 파일" 이 다른 팀을 붉게 칠한다.
    // 근거: 풀 코트 기본 배치는 홈 GK 가 x=75(왼쪽 골 = ruleZones[0]), 하프 코트는 원정 GK 만
    // 놓인다(defaults.ts FULL_POSITIONS/HALF_POSITIONS). 즉 이 값이 "지금까지 판이 실제로
    // 보이던 모습" 이다. 플랫 코트는 골 지역이 없어 값이 안 쓰이지만, 필드는 채워 둔다 —
    // 코트를 나중에 바꿔도 문서가 스스로를 설명하게.
    migrate: (doc) => {
      if (doc.defense === 'home' || doc.defense === 'away') return doc;
      const mode = doc.courtMode === 'half' || doc.courtMode === 'flat' ? doc.courtMode : 'full';
      return { ...doc, defense: defaultDefense(mode) };
    },
  },
  {
    from: 6,
    to: 7,
    describe: 'drill v6→v7: 선 통일 — 화살표의 kind(이동·패스·슛)를 지운다',
    // ⚠️ **여기는 지우는 마이그레이션이다.** 2026-08-16 부터 화살표에 종류가 없다(기현 지시:
    // *"작도에 패스, 이동이 무의미하다. 선으로 통일"*). 뜻은 양 끝 화살촉이 나른다.
    //
    // 기현님 결정: **전부 기본 선으로**. 그래서 옛 kind 의 색(이동 파랑·패스 노랑)을 개별
    // 색으로 구워 넣지 **않는다** — 구워 넣으면 옛 드릴만 영영 다른 색으로 남는다.
    // 점선도 함께 사라진다(선은 언제나 실선이다).
    //
    // 화살촉은 안 찍는다: 모델 기본값이 곧 옛 모양(끝점 좁은 화살표·시작점 없음)이라
    // 찍을 참말이 없다. 도장을 올리는 이유는 **옛 앱이 새 파일을 정직하게 거절**하게 하는 것 —
    // v6 앱은 headFrom/headTo 를 모르므로 넓은 화살촉도 없는 화살촉도 전부 좁은 화살촉으로
    // 그린다(파일은 멀쩡히 열리고 아무 경고 없이 **다른 그림**이 나온다).
    migrate: (doc) => {
      const out: Record<string, unknown> = { ...doc };
      if (!Array.isArray(out.steps)) return out;
      out.steps = out.steps.map((st) => {
        if (!st || typeof st !== 'object') return st;
        const step = st as Record<string, unknown>;
        if (!Array.isArray(step.arrows)) return st;
        return {
          ...step,
          arrows: step.arrows.map((ar) => {
            if (!ar || typeof ar !== 'object') return ar;
            const { kind: _kind, ...rest } = ar as Record<string, unknown>;
            return rest;
          }),
        };
      });
      return out;
    },
  },
  {
    from: 7,
    to: 8,
    describe: 'drill v7→v8: 분류 유형(category→drillType) · 훈련량(reps/sets/intervalSec) 폐기',
    // ⚠️ **바꾸고 지우는 마이그레이션이다** — 그래서 무손실 방침 둘을 여기 적는다(2026-08-18
    // 기현님 확정, 구조 개편 질문 ⑤·⑦):
    //  ① category → drillType 매핑. 매핑표는 **리터럴**이다(마이그레이션은 그때의 분류를 적어
    //     둔 역사 — v2→v3 의 '30x18' 과 같은 규율). 원문 category 문자열은 **tags 에 편입**해
    //     보존한다: '공격'→tactical 로 접으면 공격/수비 구분이 사라지는데, 태그로 남기면 검색
    //     ('공격')이 계속 찾는다. '기타' 는 validate 의 옛 폴백값이라 정보가 0 — 편입하지 않는다.
    //  ② 훈련량 셋은 **description 말미에 텍스트로** 보존 후 삭제. 형식(필드)은 죽어도
    //     사용자가 적은 값("3회 × 2세트")은 글로 남는다. 전부 0/부재면 그냥 지운다.
    migrate: (doc) => {
      const out: Record<string, unknown> = { ...doc };
      // ① 분류 매핑 — v7 까지의 KNOWN_CATEGORIES 5종(그때의 목록을 리터럴로 박는다).
      const TYPE_OF: Record<string, string> = {
        '슈팅': 'technical',
        '볼 운반': 'technical',
        '공격': 'tactical',
        '수비': 'tactical',
        '세트피스': 'set-piece',
      };
      const cat = typeof out.category === 'string' ? out.category : '';
      if (typeof out.drillType !== 'string') out.drillType = TYPE_OF[cat] ?? 'technical';
      if (cat.length > 0 && cat !== '기타') {
        const tags = Array.isArray(out.tags) ? out.tags.filter((t): t is string => typeof t === 'string') : [];
        const tag = cat.slice(0, 24); // 그때의 tagLen 상한
        if (!tags.includes(tag) && tags.length < 12) tags.push(tag); // 그때의 tagCount 상한
        out.tags = tags;
      }
      delete out.category;
      // ② 훈련량 보존 — 문구는 그때의 인쇄(PrintDrillSheet metaLine)와 같은 조립 규칙이다.
      const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.round(v) : 0);
      const reps = num(out.reps);
      const sets = num(out.sets);
      const interval = num(out.intervalSec);
      if (reps > 0 || sets > 0 || interval > 0) {
        const parts: string[] = [];
        if (reps > 0 && sets > 0) parts.push(`${reps}회 × ${sets}세트`);
        else if (reps > 0) parts.push(`${reps}회`);
        else if (sets > 0) parts.push(`${sets}세트`);
        if (interval > 0) parts.push(`인터벌 ${interval}초`);
        const line = `훈련량(구버전): ${parts.join(' · ')}`;
        const desc = typeof out.description === 'string' ? out.description : '';
        out.description = (desc.length > 0 ? `${desc}\n${line}` : line).slice(0, 400); // 그때의 descriptionLen
      }
      delete out.reps;
      delete out.sets;
      delete out.intervalSec;
      return out;
    },
  },
];
/** 세션 v1 → v2 (2026-08-18 구조 개편) — 평평한 items 를 **단일 custom 구획**으로 감싼다.
 *  무손실: 항목 배열이 값째로 옮겨 갈 뿐이고, 빈 items 는 빈 phases 가 된다(빈 구획 하나를
 *  만들어 두지 않는 이유: "구획은 사용자가 만든 구조" 라서 — 없던 구조를 지어내지 않는다).
 *  구획 이름 '훈련' 은 defaultPhase(session.ts)와 같은 리터럴이어야 한다 — 갈라지면 승격된
 *  세션과 새 세션이 다른 이름을 갖는다. id 는 newId 라 이 마이그레이션은 멱등이 아니지만,
 *  migrateDoc 은 버전이 낮을 때만 각 단계를 1회 태우므로 문제가 없다(도장이 게이트다). */
export const SESSION_MIGRATIONS: DocMigration[] = [
  {
    from: 1,
    to: 2,
    describe: 'session v1→v2: 구획(phase) 계층 — items 를 단일 custom 구획으로 감싼다',
    migrate: (doc) => {
      const out: Record<string, unknown> = { ...doc };
      if (!Array.isArray(out.phases)) {
        const items = Array.isArray(out.items) ? out.items : [];
        out.phases = items.length > 0 ? [{ id: newId('ph'), kind: 'custom', title: '훈련', items }] : [];
      }
      delete out.items;
      return out;
    },
  },
];
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

/** 로스터(구조 개편 C3)는 v1 부터 시작한다 — 체인이 비어 있어도 등록해 두는 이유는 읽기
 *  경로(rosterRepo)가 처음부터 migrateDoc 관문을 지나게 하기 위해서다. 나중에 필드가 생길 때
 *  관문을 새로 뚫는 것이 아니라 체인에 단계 하나를 더하면 된다(prefs 가 걸었던 길). */
export const ROSTER_MIGRATIONS: DocMigration[] = [];

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
