// 3.2/3.3 — 드릴 스키마 **v1 → v2**: 교육 필드(목적 · 코칭 포인트 · 필요 인원 · 필요 장비) +
// 훈련량(반복 · 세트 · 인터벌). 결정 ⑦ = (B) 중간.
//
// 이 스위트가 지키는 것은 셋이고, 셋 다 **조용한 데이터 유실**이 일어나는 자리다:
//   (1) 구 버전 파일이 마이그레이션으로 기본값을 얻는다 — 그리고 **기존 값은 하나도 안 잃는다**
//   (2) `validate.ts` 화이트리스트 조립부를 통과한다 — 거기 안 적힌 필드는 IDB 왕복에서 소리
//       없이 증발한다(파싱만 해 놓고 조립부를 빼먹어도 컴파일은 통과한다)
//   (3) 요약(DrillSummary)에는 **싣지 않는다** — 근거는 summary.ts 의 SUMMARY_BUILD 주석
import { describe, expect, it } from 'vitest';
// tsconfig 에 resolveJsonModule 이 없어(다른 모듈 소유 설정) migrate.test.ts 와 같은 `?raw` 로 읽는다.
import drillV1Raw from '../test/fixtures/drill.v1.json?raw';
import { migrateDoc, DRILL_MIGRATIONS } from './migrate.ts';
import { CURRENT_DRILL_SCHEMA } from './drill.ts';
import { createDrill } from './defaults.ts';
import { validateDrill, LIMITS } from './validate.ts';
import { buildSummary, SUMMARY_BUILD } from './summary.ts';

const v1: Record<string, unknown> = JSON.parse(drillV1Raw);

/** v2 가 새로 아는 키 전부. 한 곳에 모아 두고 세 관문에서 같은 목록을 쓴다. */
const TEACHING_KEYS = ['objective', 'coachingPoints', 'playersNeeded', 'equipment', 'reps', 'sets', 'intervalSec'] as const;

function migrateV1(doc: Record<string, unknown> = v1): Record<string, unknown> {
  const r = migrateDoc(doc, DRILL_MIGRATIONS, CURRENT_DRILL_SCHEMA);
  expect(r.ok).toBe(true);
  if (!r.ok) throw new Error('migrate 실패');
  return r.doc;
}

describe('3.2/3.3 마이그레이션 — 구 버전 드릴 파일이 v2 로 올라온다', () => {
  it('새 필드가 기본값으로 채워진다 (숫자는 1 이 아니라 0 = 미지정)', () => {
    const doc = migrateV1();
    // 일곱 개를 **따로** 단언한다 — 하나로 뭉치면 여섯 개가 비어도 초록불이 될 수 있다.
    expect(doc.objective).toBe('');
    expect(doc.coachingPoints).toEqual([]);
    expect(doc.equipment).toBe('');
    expect(doc.playersNeeded).toBe(0);
    expect(doc.reps).toBe(0);
    expect(doc.sets).toBe(0);
    expect(doc.intervalSec).toBe(0);
  });

  it('기존 필드를 **하나도** 잃지 않는다', () => {
    const doc = migrateV1();
    for (const [key, value] of Object.entries(v1)) {
      if (key === 'schemaVersion') continue; // 도장만 1 → 4 로 바뀐다
      if (key === 'steps') {
        // ⚠️ 2026-08-14 — v3→v4 가 스텝마다 `shapes: []` 를 **더한다**. 무손실의 뜻은
        // "잃지 않는다" 이지 "한 글자도 안 는다" 가 아니다 — 더해진 키 하나를 빼고 대조한다.
        // ⚠️ 2026-08-16 — v6→v7 은 반대로 화살표의 `kind` 를 **지운다**(선 통일). 그것은
        //    **의도된 손실**이라 기대값에서도 함께 뺀다 — 안 빼면 이 it 이 "지우지 마라" 를
        //    요구하게 되어 마이그레이션과 정면으로 부딪힌다.
        const stripKind = (steps: unknown): unknown =>
          (steps as Record<string, unknown>[]).map((st) => ({
            ...st,
            arrows: ((st.arrows as Record<string, unknown>[] | undefined) ?? []).map(({ kind: _k, ...a }) => a),
          }));
        const got = (doc[key] as Record<string, unknown>[]).map(({ shapes, ...rest }) => {
          expect(shapes, '도형 단계가 스텝에 빈 배열을 안 찍었다').toEqual([]);
          return rest;
        });
        expect(got, `v1 의 '${key}' 가 사라지거나 바뀌었다`).toEqual(stripKind(value));
        continue;
      }
      expect(doc[key], `v1 의 '${key}' 가 사라지거나 바뀌었다`).toEqual(value);
    }
    // 대조군 — 픽스처가 실제로 알맹이를 갖고 있어야 위 루프가 의미를 갖는다.
    expect(Object.keys(v1).length).toBeGreaterThan(10);
    expect((doc.steps as unknown[]).length).toBeGreaterThan(0);
  });

  it('스키마 도장이 v1 에서 최신까지 오르고 각 단계는 정확히 1회만 적용된다', () => {
    // 5.1 에서 체인이 v2→v3(코트 크기 3단)까지 길어졌다. 길이를 숫자로 박으면 다음 상승 때
    // 또 고쳐야 하고, 무엇보다 **어떤 단계가 돌았는지**를 못 본다 — 순서째로 단언한다.
    const r = migrateDoc(v1, DRILL_MIGRATIONS, CURRENT_DRILL_SCHEMA);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.doc.schemaVersion).toBe(CURRENT_DRILL_SCHEMA);
    expect(r.applied).toEqual(DRILL_MIGRATIONS.map((m) => m.describe));
    expect(r.applied.length).toBeGreaterThanOrEqual(2); // 대조군 — 체인이 비어서 통과한 것이 아니다

    // 이미 v2 인 문서를 다시 통과시키면 아무것도 안 한다(같은 단계에서 두 번 올리지 않는다).
    const again = migrateDoc(r.doc, DRILL_MIGRATIONS, CURRENT_DRILL_SCHEMA);
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    expect(again.changed).toBe(false);
    expect(again.applied).toHaveLength(0);
  });

  it('이미 값이 들어 있는 문서는 덮어쓰지 않는다', () => {
    const doc = migrateV1({ ...v1, objective: '이미 적어 둔 목적', reps: 3, coachingPoints: ['받기 전에 몸을 연다'] });
    expect(doc.objective).toBe('이미 적어 둔 목적');
    expect(doc.reps).toBe(3);
    expect(doc.coachingPoints).toEqual(['받기 전에 몸을 연다']);
    // 대조군 — 손대지 않은 자리는 여전히 기본값이 들어온다.
    expect(doc.sets).toBe(0);
  });

  it('형상이 어긋난 값(문자열 reps · null coachingPoints)은 기본값으로 갈아 끼운다', () => {
    const doc = migrateV1({ ...v1, reps: '세 번', coachingPoints: null, playersNeeded: NaN });
    expect(doc.reps).toBe(0);
    expect(doc.coachingPoints).toEqual([]);
    expect(doc.playersNeeded).toBe(0);
  });

  it('마이그레이션 결과가 validateDrill 을 보정 없이 통과한다', () => {
    const v = validateDrill(migrateV1());
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.repairs).toHaveLength(0); // 기본값이 곧 validate 가 만드는 값이어야 한다
    expect(v.value.schemaVersion).toBe(CURRENT_DRILL_SCHEMA);
  });
});

describe('3.2/3.3 화이트리스트 — validate 왕복에서 살아남는다', () => {
  const filled = {
    objective: '측면에서 받아 골문 쪽으로 방향을 트는 습관',
    coachingPoints: ['받기 전에 몸을 연다', '패스는 낮게'],
    playersNeeded: 6,
    equipment: '공 2 · 콘 6 · 조끼 8',
    reps: 3,
    sets: 2,
    intervalSec: 60,
  };

  it('일곱 필드가 전부 보존된다', () => {
    const d = createDrill({ courtMode: 'full', formation: '1-2-1' });
    const v = validateDrill({ ...d, ...filled });
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    // 하나씩 따로 — 조립부에서 한 줄만 빠져도 나머지 여섯은 초록불이다.
    expect(v.value.objective).toBe(filled.objective);
    expect(v.value.coachingPoints).toEqual(filled.coachingPoints);
    expect(v.value.playersNeeded).toBe(6);
    expect(v.value.equipment).toBe(filled.equipment);
    expect(v.value.reps).toBe(3);
    expect(v.value.sets).toBe(2);
    expect(v.value.intervalSec).toBe(60);
    expect(v.repairs).toHaveLength(0);
  });

  it('JSON 왕복(파일 내보내기 경로)에서도 그대로다 — 그리고 새 드릴은 키를 갖고 태어난다', () => {
    const d = createDrill({ courtMode: 'full', formation: '1-2-1' });
    for (const k of TEACHING_KEYS) expect(d[k], `createDrill 이 '${k}' 를 안 만든다`).toBeDefined();

    const filledDrill = { ...d, ...filled };
    const roundtrip = JSON.parse(JSON.stringify(filledDrill));
    expect(roundtrip).toEqual(filledDrill); // undefined 키 누출 없음(§3.7)
    const v = validateDrill(roundtrip);
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    for (const k of TEACHING_KEYS) expect(v.value[k]).toEqual(filled[k]);
  });

  it('멱등 — 한 번 통과한 값을 다시 넣으면 보정이 없다', () => {
    const d = createDrill({ courtMode: 'full', formation: '1-2-1' });
    const first = validateDrill({ ...d, ...filled });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = validateDrill(first.value);
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.repairs).toHaveLength(0);
    expect(second.value.coachingPoints).toEqual(filled.coachingPoints);
  });
});

describe('3.2/3.3 상한과 형상 보정 — 깨진 파일을 먹어도 throw 하지 않는다', () => {
  const base = createDrill({ courtMode: 'full', formation: '1-2-1' });
  const check = (patch: Record<string, unknown>) => {
    const v = validateDrill({ ...base, ...patch });
    expect(v.ok).toBe(true);
    if (!v.ok) throw new Error('validate 실패');
    return v;
  };

  it('목적·필요 장비는 상한에서 잘린다', () => {
    const v = check({ objective: 'ㄱ'.repeat(LIMITS.objectiveLen + 40), equipment: 'ㄴ'.repeat(LIMITS.equipmentLen + 5) });
    expect(v.value.objective).toHaveLength(LIMITS.objectiveLen);
    expect(v.value.equipment).toHaveLength(LIMITS.equipmentLen);
    expect(v.repairs.filter((r) => r.destructive).length).toBeGreaterThanOrEqual(2);
  });

  it('코칭 포인트는 개수·길이 상한을 지키고 빈 줄과 비문자열을 버린다', () => {
    const v = check({
      coachingPoints: ['하나', '  ', '', 'ㄷ'.repeat(LIMITS.coachingPointLen + 10), 42, ...Array.from({ length: 8 }, (_, i) => `점 ${i}`)],
    });
    const out = v.value.coachingPoints!;
    expect(out.length).toBe(LIMITS.coachingPointCount);
    expect(out[0]).toBe('하나'); // 빈 줄이 빠지고 순서는 유지
    expect(out.every((s) => s.length <= LIMITS.coachingPointLen)).toBe(true);
    expect(out.includes('')).toBe(false);
  });

  it('개수 필드는 0..상한 정수로 접힌다 — 각각 따로', () => {
    expect(check({ playersNeeded: 999 }).value.playersNeeded).toBe(LIMITS.playersNeededMax);
    expect(check({ reps: -3 }).value.reps).toBe(0);
    expect(check({ sets: 2.4 }).value.sets).toBe(2); // 반올림
    expect(check({ intervalSec: 10_000 }).value.intervalSec).toBe(LIMITS.intervalSecMax);
    // 대조군 — 범위 안의 값은 손대지 않고 보정도 기록하지 않는다.
    const ok = check({ playersNeeded: 6, reps: 3, sets: 2, intervalSec: 60 });
    expect(ok.repairs).toHaveLength(0);
  });

  it('타입이 아예 다른 값은 **키를 만들지 않는다** — `{키: undefined}` 를 남기지 않는다', () => {
    const v = check({ objective: 42, coachingPoints: '문자열', reps: 'x' });
    expect('objective' in v.value).toBe(false);
    expect('coachingPoints' in v.value).toBe(false);
    expect('reps' in v.value).toBe(false);
    // 대조군 — 같은 문서의 성한 필드는 살아 있다.
    expect(v.value.title).toBe(base.title);
  });
});

describe('3.2/3.3 요약 결정 — 교육 필드는 DrillSummary 에 싣지 않는다', () => {
  it('요약에 교육 필드 키가 없다 — build 가 올라간 뒤에도 그대로다', () => {
    // 근거는 summary.ts 주석 셋 중 살아 있는 둘: 목록이 안 읽는다 · searchKey 를 바꾸면 검색이
    // 레코드마다 달라진다. (셋째 근거 "rebuildAllSummaries 호출자가 0" 은 2026-08-17 에
    // 사라졌다 — 썸네일 도형·메모 때문에 build 를 2 로 올리면서 LibraryProvider 가 그 경로를
    // 부르게 됐다. **그래도 교육 필드는 여전히 안 싣는다** — 목록이 읽지 않기 때문이다.)
    expect(SUMMARY_BUILD).toBe(2);
    const d = createDrill({ courtMode: 'full', formation: '1-2-1', title: '요약 검증 드릴' });
    const s = buildSummary({ ...d, objective: '스핀턴전개목적', coachingPoints: ['몸을 연다'], playersNeeded: 6, equipment: '조끼', reps: 3, sets: 2, intervalSec: 60 });
    for (const k of TEACHING_KEYS) expect(k in s, `요약에 '${k}' 가 들어갔다 — build 상승과 재구축 경로가 같이 필요하다`).toBe(false);
    expect(s.searchKey).not.toContain('스핀턴전개목적');
    // 대조군 — searchKey 가 비어서 통과한 것이 아니다.
    expect(s.searchKey).toContain('요약 검증 드릴');
  });
});
