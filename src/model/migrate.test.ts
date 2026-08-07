// §4.1 스키마 버저닝 검증.
import { describe, expect, it } from 'vitest';
// tsconfig 에 resolveJsonModule 이 없어(다른 모듈 소유 설정 — 임의로 켜지 않는다) 일반 JSON import
// 대신 vite/client 가 제공하는 `?raw` 문자열 import 로 읽어 직접 JSON.parse 한다.
import drillV1Raw from '../test/fixtures/drill.v1.json?raw';
import { migrateDoc, DRILL_MIGRATIONS, type DocMigration } from './migrate.ts';
import { CURRENT_DRILL_SCHEMA } from './drill.ts';
import { validateDrill } from './validate.ts';

const drillV1Fixture: Record<string, unknown> = JSON.parse(drillV1Raw);

describe('migrateDoc — 기본 실패 경로', () => {
  it('schemaVersion 이 현재보다 크면 too-new', () => {
    const r = migrateDoc({ schemaVersion: 999 }, DRILL_MIGRATIONS, CURRENT_DRILL_SCHEMA);
    expect(r).toEqual({ ok: false, reason: 'too-new', found: 999, supported: CURRENT_DRILL_SCHEMA });
  });

  it('schemaVersion 이 정수가 아니면(1.5) no-path', () => {
    const r = migrateDoc({ schemaVersion: 1.5 }, DRILL_MIGRATIONS, CURRENT_DRILL_SCHEMA);
    expect(r).toEqual({ ok: false, reason: 'no-path', found: 1.5 });
  });

  it('객체가 아니면 no-path(found:0)', () => {
    expect(migrateDoc(null, DRILL_MIGRATIONS, CURRENT_DRILL_SCHEMA)).toEqual({ ok: false, reason: 'no-path', found: 0 });
    expect(migrateDoc([1, 2], DRILL_MIGRATIONS, CURRENT_DRILL_SCHEMA)).toEqual({ ok: false, reason: 'no-path', found: 0 });
    expect(migrateDoc('x', DRILL_MIGRATIONS, CURRENT_DRILL_SCHEMA)).toEqual({ ok: false, reason: 'no-path', found: 0 });
  });
});

describe('migrateDoc — 호출자 불변', () => {
  it('반환된 doc 을 변형해도 원본 raw 는 바뀌지 않는다', () => {
    const raw = { schemaVersion: 1, steps: [{ id: 'st_1' }] };
    const r = migrateDoc(raw, DRILL_MIGRATIONS, 1);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    (r.doc.steps as unknown[]).push({ id: 'st_2' });
    expect((raw.steps as unknown[]).length).toBe(1);
  });

  it('schemaVersion 필드가 아예 없던 문서는 changed:true 로 표시된다(기회적 되쓰기)', () => {
    const raw = { steps: [] };
    const r = migrateDoc(raw, DRILL_MIGRATIONS, 1);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.changed).toBe(true);
    expect(r.doc.schemaVersion).toBe(1);
  });

  it('이미 최신 schemaVersion 이 명시돼 있으면 changed:false', () => {
    const raw = { schemaVersion: 1, steps: [] };
    const r = migrateDoc(raw, DRILL_MIGRATIONS, 1);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.changed).toBe(false);
    expect(r.applied).toHaveLength(0);
  });
});

describe('migrateDoc — 체인 연속성 (합성 체인)', () => {
  const chain: DocMigration[] = [
    { from: 1, to: 2, describe: 'v1→v2: add foo', migrate: (d) => ({ ...d, foo: 'added' }) },
    { from: 2, to: 3, describe: 'v2→v3: add bar', migrate: (d) => ({ ...d, bar: 'added' }) },
  ];

  it('여러 단계를 순서대로 적용해 최신 버전에 도달한다', () => {
    const r = migrateDoc({ schemaVersion: 1 }, chain, 3);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.doc.schemaVersion).toBe(3);
    expect(r.doc.foo).toBe('added');
    expect(r.doc.bar).toBe('added');
    expect(r.applied).toEqual(['v1→v2: add foo', 'v2→v3: add bar']);
    expect(r.changed).toBe(true);
  });

  it('중간 버전에 대응하는 체인이 없으면 no-path', () => {
    const brokenChain: DocMigration[] = [{ from: 1, to: 2, describe: 'x', migrate: (d) => d }];
    const r = migrateDoc({ schemaVersion: 2 }, brokenChain, 3); // 2→3 경로가 없다
    expect(r).toEqual({ ok: false, reason: 'no-path', found: 2 });
  });
});

describe('drill.v1.json 픽스처', () => {
  it('migrate → validate 가 통과한다', () => {
    const migrated = migrateDoc(drillV1Fixture, DRILL_MIGRATIONS, CURRENT_DRILL_SCHEMA);
    expect(migrated.ok).toBe(true);
    if (!migrated.ok) return;
    const validated = validateDrill(migrated.doc);
    expect(validated.ok).toBe(true);
    if (!validated.ok) return;
    expect(validated.value.id).toBe(drillV1Fixture.id);
    // 픽스처는 이미 잘 정돈된 문서이므로 보정이 없어야 한다.
    expect(validated.repairs).toHaveLength(0);
  });
});
