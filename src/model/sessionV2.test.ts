// Session v1 → v2 (2026-08-18 구조 개편) — 구획(phase) 계층.
// 이 스위트가 지키는 것 셋: (1) v1 평평한 items 가 단일 custom 구획으로 무손실 승격된다
// (2) 구획 인지 편집 헬퍼(추가·제거·이동)가 구획 구조를 규칙대로 다룬다
// (3) 화이트리스트 왕복에서 v2 신필드(goalTotalMin·plannedMin·participantIds)가 살아남는다.
import { describe, expect, it } from 'vitest';
import { migrateDoc, SESSION_MIGRATIONS } from './migrate.ts';
import {
  CURRENT_SESSION_SCHEMA,
  addSessionItem,
  defaultPhase,
  flattenSessionItems,
  moveSessionItemFlat,
  phaseLabel,
  removeSessionItem,
  updateSessionItem,
  type SessionItem,
  type TrainingSession,
} from './session.ts';
import { validateSession } from './validate.ts';

const mkItem = (n: number): SessionItem => ({
  id: `it_${n}` as never,
  drillId: `dr_${n}` as never,
  titleCache: `드릴 ${n}`,
  durationMinCache: 10,
  categoryCache: 'technical',
});

const mkSession = (phases: TrainingSession['phases']): TrainingSession => ({
  schemaVersion: CURRENT_SESSION_SCHEMA,
  id: 'se_x' as never,
  title: '세션',
  phases,
  drillIds: [],
  createdAt: 0,
  updatedAt: 0,
});

describe('세션 v1→v2 마이그레이션', () => {
  it('평평한 items 가 단일 custom 구획으로 무손실 승격된다', () => {
    const v1 = {
      schemaVersion: 1,
      id: 'se_old',
      title: '옛 세션',
      note: '메모',
      location: '체육관',
      items: [mkItem(1), { ...mkItem(2), durationOverrideMin: 20, restAfterMin: 5, note: '항목 메모' }],
      drillIds: ['dr_1', 'dr_2'],
      createdAt: 100,
      updatedAt: 200,
    };
    const r = migrateDoc(v1, SESSION_MIGRATIONS, CURRENT_SESSION_SCHEMA);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const phases = r.doc.phases as TrainingSession['phases'];
    expect(phases).toHaveLength(1);
    expect(phases[0]!.kind).toBe('custom');
    expect(phases[0]!.title).toBe('훈련'); // defaultPhase 와 같은 리터럴이어야 한다
    expect(defaultPhase().title).toBe('훈련');
    expect(phases[0]!.items).toEqual(v1.items); // 항목이 값째로 옮겨 간다
    expect('items' in r.doc).toBe(false);
    // 승격본이 validate 를 통과한다 — 저장 경로와 같은 관문.
    const v = validateSession(r.doc);
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.value.drillIds).toEqual(['dr_1', 'dr_2']);
    expect(flattenSessionItems(v.value).map((i) => i.id)).toEqual(['it_1', 'it_2']);
  });

  it('빈 items 는 빈 phases 가 된다 — 없던 구조를 지어내지 않는다', () => {
    const r = migrateDoc({ schemaVersion: 1, id: 'se_e', title: '', items: [], drillIds: [], createdAt: 0, updatedAt: 0 }, SESSION_MIGRATIONS, CURRENT_SESSION_SCHEMA);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.doc.phases).toEqual([]);
  });
});

describe('구획 인지 편집 헬퍼', () => {
  it('addSessionItem — 구획이 없으면 기본 구획을 만들고, 있으면 마지막 구획 끝에 붙는다', () => {
    const empty = mkSession([]);
    const one = addSessionItem(empty, mkItem(1));
    expect(one.phases).toHaveLength(1);
    expect(phaseLabel(one.phases[0]!)).toBe('훈련');
    const two = addSessionItem(one, mkItem(2));
    expect(two.phases[0]!.items.map((i) => i.id)).toEqual(['it_1', 'it_2']);
    // phaseId 지정 시 그 구획으로.
    const multi = mkSession([
      { id: 'ph_a' as never, kind: 'warm-up', items: [mkItem(1)] },
      { id: 'ph_b' as never, kind: 'tactical', items: [] },
    ]);
    const added = addSessionItem(multi, mkItem(9), 'ph_a' as never);
    expect(added.phases[0]!.items).toHaveLength(2);
    expect(added.phases[1]!.items).toHaveLength(0);
  });

  it('remove/update 는 전 구획을 수색하고 빈 구획을 남긴다 — 구획은 사용자가 만든 구조다', () => {
    const s = mkSession([
      { id: 'ph_a' as never, kind: 'warm-up', items: [mkItem(1)] },
      { id: 'ph_b' as never, kind: 'tactical', items: [mkItem(2)] },
    ]);
    const removed = removeSessionItem(s, 'it_2');
    expect(removed.phases).toHaveLength(2); // 빈 구획 유지
    expect(removed.phases[1]!.items).toHaveLength(0);
    const updated = updateSessionItem(s, 'it_2', { durationOverrideMin: 25 });
    expect(updated.phases[1]!.items[0]!.durationOverrideMin).toBe(25);
  });

  it('moveSessionItemFlat — 구획 경계를 넘는 이동은 넘어간 구획으로의 이사다', () => {
    const s = mkSession([
      { id: 'ph_a' as never, kind: 'warm-up', items: [mkItem(1), mkItem(2)] },
      { id: 'ph_b' as never, kind: 'tactical', items: [mkItem(3), mkItem(4)] },
    ]);
    // 같은 구획 안 (0→1)
    const inPhase = moveSessionItemFlat(s, 0, 1);
    expect(inPhase.phases[0]!.items.map((i) => i.id)).toEqual(['it_2', 'it_1']);
    // 경계 넘기 (0→2): it_1 이 뒤 구획으로 이사 — 각 구획 항목 수가 이동을 따라간다.
    const cross = moveSessionItemFlat(s, 0, 2);
    expect(cross.phases[0]!.items.map((i) => i.id)).toEqual(['it_2']);
    expect(cross.phases[1]!.items.map((i) => i.id)).toEqual(['it_3', 'it_1', 'it_4']);
    // flatten 좌표계에서 보면 단순한 위치 이동이다.
    expect(flattenSessionItems(cross).map((i) => i.id)).toEqual(['it_2', 'it_3', 'it_1', 'it_4']);
    // 범위 밖은 동일 참조.
    expect(moveSessionItemFlat(s, 0, 9)).toBe(s);
  });
});

describe('v2 신필드 화이트리스트 왕복', () => {
  it('goalTotalMin·plannedMin·participantIds 가 JSON 왕복에서 살아남는다', () => {
    const s: TrainingSession = {
      ...mkSession([{ id: 'ph_a' as never, kind: 'warm-up', plannedMin: 15, items: [mkItem(1)] }]),
      goalTotalMin: 90,
      participantIds: ['pl_1' as never, 'pl_2' as never],
    };
    const v = validateSession(JSON.parse(JSON.stringify(s)));
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.value.goalTotalMin).toBe(90);
    expect(v.value.phases[0]!.plannedMin).toBe(15);
    expect(v.value.participantIds).toEqual(['pl_1', 'pl_2']);
  });

  it('음수·비유한 목표 시간은 키를 버린다(미지정)', () => {
    const v = validateSession({ id: 'se_x', title: '', phases: [], goalTotalMin: -5 });
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect('goalTotalMin' in v.value).toBe(false);
  });
});
