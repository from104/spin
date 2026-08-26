// §5.1 — 코트 크기 3단이 **저장을 견디는가**. (기하 검산은 court.test.ts, 배치는 defaults.test.ts)
//
// 새 필드가 조용히 사라지는 자리는 이 저장소에서 이미 셋으로 확인돼 있다:
//   (1) `validate.ts` 화이트리스트 조립부 — 파싱만 하고 조립부에 안 적으면 IDB 왕복에서 증발한다
//   (2) `DRILL_MIGRATIONS` — 옛 문서가 필드를 못 얻으면 기본값이 바뀌는 날 통째로 다른 코트가 된다
//   (3) 좌표 클램프 — 크기를 안 넘기면 25×14 판 밖 좌표가 살아남는다
// 셋을 각각 따로 찌른다. 하나로 뭉치면 둘이 죽어도 초록불이다.
import { describe, expect, it } from 'vitest';
// tsconfig 에 resolveJsonModule 이 없어(다른 모듈 소유 설정) 다른 스키마 테스트와 같은 `?raw` 로 읽는다.
import drillV1Raw from '../test/fixtures/drill.v1.json?raw';
import { migrateDoc, DRILL_MIGRATIONS } from './migrate.ts';
import { CURRENT_DRILL_SCHEMA, type Drill } from './drill.ts';
import { createDrill } from './defaults.ts';
import { validateDrill } from './validate.ts';
import { COURT_SIZES, DEFAULT_COURT_SIZE, courtDefFor, isOnSurface, type CourtSize } from './court.ts';

const v1: Record<string, unknown> = JSON.parse(drillV1Raw);

/** courtSize 를 **모르는** v2 문서. "이미 사용자 기기에 저장돼 있는 드릴" 의 모형이다. */
function v2DocWithout(): Record<string, unknown> {
  const d = createDrill({ courtMode: 'full', formation: '1-2-1', title: '옛 드릴' });
  const raw = JSON.parse(JSON.stringify(d)) as Record<string, unknown>;
  delete raw.courtSize;
  raw.schemaVersion = 2;
  return raw;
}

describe('§5.1 마이그레이션 — 옛 드릴은 30×18 로 못박혀 올라온다', () => {
  it('courtSize 를 모르는 v2 문서가 v3 로 오르며 30×18 을 얻는다', () => {
    const raw = v2DocWithout();
    expect('courtSize' in raw).toBe(false); // 대조군 — 픽스처가 실제로 필드를 안 갖고 있다
    const r = migrateDoc(raw, DRILL_MIGRATIONS, CURRENT_DRILL_SCHEMA);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.doc.courtSize).toBe('30x18');
    expect(r.doc.schemaVersion).toBe(CURRENT_DRILL_SCHEMA);
    // v2 문서는 v3(코트 크기)·v4(도형)·v5(자유 삼각형)·v6(진영)·v7(선 통일)·v8(분류 개편)
    // 여섯 단계를 지난다.
    expect(r.applied[0]).toBe('drill v2→v3: 코트 크기 3단(courtSize) — 옛 드릴은 30×18 로 못박는다');
    expect(r.applied).toHaveLength(7);
  });

  it('무손실 — v2 의 모든 키가 값째로 살아남는다', () => {
    const raw = v2DocWithout();
    const r = migrateDoc(raw, DRILL_MIGRATIONS, CURRENT_DRILL_SCHEMA);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    for (const [k, v] of Object.entries(raw)) {
      if (k === 'schemaVersion') continue; // 도장만 최신으로
      // v7→v8 이 category 를 drillType 으로 대체하고 원문을 tags 에 편입한다(drillV2.test.ts 가 단언).
      if (k === 'category' || k === 'tags') continue;
      expect(r.doc[k], `v2 의 '${k}' 가 사라지거나 바뀌었다`).toEqual(v);
    }
    // 대조군 — 픽스처가 알맹이를 갖고 있어야 위 루프가 의미를 갖는다.
    expect(Object.keys(raw).length).toBeGreaterThan(15);
    expect((r.doc.steps as unknown[]).length).toBeGreaterThan(0);
  });

  it('v1 → v9 전 체인이 한 번에 돈다 (교육 필드 + 코트 크기 + 도형 + 자유 삼각형 + 진영 + 선 통일 + 분류 개편 + 공 링 이관)', () => {
    const r = migrateDoc(v1, DRILL_MIGRATIONS, CURRENT_DRILL_SCHEMA);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.doc.courtSize).toBe('30x18');
    expect(r.doc.objective).toBe(''); // v1→v2 도 여전히 돈다(뒷문장에도 단언을 둔다)
    expect(r.applied).toHaveLength(8);
    // 멱등 — 이미 최신인 문서를 다시 넣으면 아무 일도 안 한다.
    const again = migrateDoc(r.doc, DRILL_MIGRATIONS, CURRENT_DRILL_SCHEMA);
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    expect(again.changed).toBe(false);
    expect(again.applied).toHaveLength(0);
    expect(again.doc.courtSize).toBe('30x18');
  });

  it('이미 크기를 갖고 있는 문서는 덮어쓰지 않는다', () => {
    const r = migrateDoc({ ...v2DocWithout(), courtSize: '28x15' }, DRILL_MIGRATIONS, CURRENT_DRILL_SCHEMA);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.doc.courtSize).toBe('28x15');
  });

  it('마이그레이션 결과가 validateDrill 을 보정 없이 통과한다', () => {
    const r = migrateDoc(v2DocWithout(), DRILL_MIGRATIONS, CURRENT_DRILL_SCHEMA);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const v = validateDrill(r.doc);
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.repairs).toHaveLength(0); // 마이그레이션 기본값 = validate 가 만드는 값
    expect(v.value.courtSize).toBe('30x18');
  });

  it('⚠️ 기존 드릴이 지금과 **똑같이 보인다** — 좌표가 한 픽셀도 안 움직인다', () => {
    const before = v2DocWithout();
    const r = migrateDoc(before, DRILL_MIGRATIONS, CURRENT_DRILL_SCHEMA);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const v = validateDrill(r.doc);
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.value.steps[0]!.chairs).toEqual((before.steps as Drill['steps'])[0]!.chairs);
    expect(v.value.steps[0]!.balls).toEqual((before.steps as Drill['steps'])[0]!.balls);
    // 그리고 그 좌표가 실제로 30×18 판 위에 있다.
    expect(courtDefFor('full', v.value.courtSize).vbW).toBe(825);
    for (const p of Object.values(v.value.steps[0]!.chairs)) {
      expect(isOnSurface('full', p!, v.value.courtSize)).toBe(true);
    }
  });
});

describe('§5.1 화이트리스트 — validate 왕복에서 courtSize 가 살아남는다', () => {
  it('세 값이 전부 보존된다 — 하나씩 따로', () => {
    for (const size of COURT_SIZES) {
      const d = createDrill({ courtMode: 'full', courtSize: size });
      const v = validateDrill(d);
      expect(v.ok, size).toBe(true);
      if (!v.ok) return;
      expect(v.value.courtSize, size).toBe(size);
      expect(v.repairs, size).toHaveLength(0);
    }
  });

  it('JSON 왕복(파일 내보내기 경로)에서도 그대로다', () => {
    for (const size of COURT_SIZES) {
      const d = createDrill({ courtMode: 'full', courtSize: size, title: `${size} 드릴` });
      const roundtrip = JSON.parse(JSON.stringify(d)) as Drill;
      expect(roundtrip).toEqual(d); // undefined 키 누출 없음(§3.7)
      const v = validateDrill(roundtrip);
      expect(v.ok, size).toBe(true);
      if (!v.ok) return;
      expect(v.value.courtSize, size).toBe(size);
    }
  });

  it('멱등 — 한 번 통과한 값을 다시 넣어도 보정이 없다', () => {
    const first = validateDrill(createDrill({ courtMode: 'full', courtSize: '25x14' }));
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = validateDrill(first.value);
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.repairs).toHaveLength(0);
    expect(second.value.courtSize).toBe('25x14');
  });

  it('필드가 없으면 기본값이고 보정도 안 남긴다 — 옛 드릴에 매번 토스트가 뜨면 안 된다', () => {
    const d = createDrill({ courtMode: 'full' }) as unknown as Record<string, unknown>;
    delete d.courtSize;
    const v = validateDrill(d);
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.value.courtSize).toBe(DEFAULT_COURT_SIZE);
    expect(v.repairs).toHaveLength(0);
  });

  it('깨진 값은 던지지 않고 기본으로 접으며 그 사실을 남긴다', () => {
    for (const bad of ['full', '30X18', '', 42, null, {}]) {
      const v = validateDrill({ ...createDrill({ courtMode: 'full' }), courtSize: bad });
      expect(v.ok, String(bad)).toBe(true);
      if (!v.ok) return;
      expect(v.value.courtSize, String(bad)).toBe(DEFAULT_COURT_SIZE);
      expect(v.repairs.some((r) => r.path === 'courtSize'), String(bad)).toBe(true);
      // 비파괴 보정이다 — 좌표를 버리는 것이 아니라 판을 기본으로 되돌리는 것뿐이다.
      expect(v.repairs.filter((r) => r.path === 'courtSize').every((r) => !r.destructive)).toBe(true);
    }
  });

  it('courtSize 는 courtMode 와 달리 **없어도 실패가 아니다** (대조군)', () => {
    const d = createDrill({ courtMode: 'full' }) as unknown as Record<string, unknown>;
    delete d.courtSize;
    expect(validateDrill(d).ok).toBe(true);
    // 대조군 — courtMode 는 없으면 실패다. 둘의 취급이 다르다는 것이 이 항목의 설계다.
    const noMode = createDrill({ courtMode: 'full' }) as unknown as Record<string, unknown>;
    delete noMode.courtMode;
    expect(validateDrill(noMode).ok).toBe(false);
  });
});

describe('§5.1 클램프가 드릴의 코트 크기를 따라간다', () => {
  // ⚠️ 여기가 "size 를 안 흘려보내면 무슨 일이 나는가" 다. 25×14 드릴(vb 700×425)에 x=800 짜리
  // 개체가 들어오면 **판 밖**인데, 크기를 모르면 825×525 기준으로 재서 그대로 통과시킨다.
  const withStray = (size: CourtSize): Drill => {
    const d = createDrill({ courtMode: 'full', courtSize: size });
    const id = d.cast.chairs[0]!.id;
    const step = d.steps[0]!;
    step.chairs[id] = { x: 800, y: 500, angleDeg: 0 };
    step.balls[d.cast.balls[0]!.id] = { x: 900, y: 900 };
    return d;
  };

  it('25×14 드릴의 판 밖 좌표는 700×425 로 접힌다', () => {
    const v = validateDrill(withStray('25x14'));
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    const chairId = v.value.cast.chairs[0]!.id;
    expect(v.value.steps[0]!.chairs[chairId]).toMatchObject({ x: 700, y: 425 });
    expect(v.value.steps[0]!.balls[v.value.cast.balls[0]!.id]).toEqual({ x: 700, y: 425 });
  });

  it('28×15 는 775×450 으로, 30×18 은 825×525 로 — 단마다 다른 자리에서 접힌다', () => {
    const v28 = validateDrill(withStray('28x15'));
    const v30 = validateDrill(withStray('30x18'));
    expect(v28.ok && v30.ok).toBe(true);
    if (!v28.ok || !v30.ok) return;
    expect(v28.value.steps[0]!.chairs[v28.value.cast.chairs[0]!.id]).toMatchObject({ x: 775, y: 450 });
    // 대조군 — 30×18 에서는 x=800 이 판 안이라 **접히지 않는다**. 셋이 다 같은 값으로 접히면
    // 크기를 안 보고 한 판으로 재고 있다는 뜻이다.
    expect(v30.value.steps[0]!.chairs[v30.value.cast.chairs[0]!.id]).toMatchObject({ x: 800, y: 500 });
  });

  it('스텝이 비어 있을 때 만드는 기본 스텝도 그 크기의 코트에 놓인다', () => {
    const d = createDrill({ courtMode: 'full', courtSize: '25x14' });
    const v = validateDrill({ ...d, steps: [] });
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.value.steps).toHaveLength(1);
    for (const p of Object.values(v.value.steps[0]!.chairs)) {
      expect(isOnSurface('full', p!, '25x14')).toBe(true);
    }
  });
});
