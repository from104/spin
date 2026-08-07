// §3.8 검증·보정 — 11단계 파이프라인, 멱등성, throw 없음.
import { describe, expect, it } from 'vitest';
import { createDrill } from './defaults.ts';
import { validateDrill, validateSession } from './validate.ts';

describe('validateDrill — 멱등성', () => {
  it('한 번 통과한 값을 다시 넣으면 repairs 가 비어 있다', () => {
    const d = createDrill({ courtMode: 'full', formation: '1-2-1' });
    const first = validateDrill(d);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = validateDrill(first.value);
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.repairs).toHaveLength(0);
  });
});

describe('validateDrill — 실패 조건', () => {
  it('id 가 없으면 ok:false', () => {
    const r = validateDrill({ courtMode: 'full', steps: [] });
    expect(r.ok).toBe(false);
  });
  it('courtMode 가 3종이 아니면 ok:false', () => {
    const r = validateDrill({ id: 'dr_x', courtMode: 'weird', steps: [] });
    expect(r.ok).toBe(false);
  });
  it('steps 가 배열이 아니면 ok:false', () => {
    const r = validateDrill({ id: 'dr_x', courtMode: 'full', steps: {} });
    expect(r.ok).toBe(false);
  });
  it('schemaVersion 이 현재보다 크면 ok:false', () => {
    const r = validateDrill({ id: 'dr_x', courtMode: 'full', steps: [], schemaVersion: 999 });
    expect(r.ok).toBe(false);
  });
});

describe('validateDrill — 보정', () => {
  it('cast 에 없는 pose 를 제거한다', () => {
    const raw = {
      id: 'dr_x',
      courtMode: 'full',
      cast: { chairs: [{ id: 'ch_a', team: 'home', number: '2', isGk: false }], balls: [], cones: [] },
      steps: [
        {
          id: 'st_1',
          name: 's1',
          note: '',
          chairs: { ch_a: { x: 1, y: 1, angleDeg: 0 }, ch_ghost: { x: 9, y: 9, angleDeg: 0 } },
          balls: {},
          cones: {},
          arrows: [],
          notes: [],
        },
      ],
    };
    const r = validateDrill(raw);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.steps[0]!.chairs['ch_a' as never]).toBeDefined();
    expect('ch_ghost' in r.value.steps[0]!.chairs).toBe(false);
    expect(r.repairs.some((x) => x.destructive)).toBe(true);
  });

  it('공 11개는 10개로 절단되고, 잘린 공의 고아 pose 도 같이 제거된다', () => {
    const balls = Array.from({ length: 11 }, (_, i) => ({ id: `bl_${i}` }));
    const ballPoses: Record<string, { x: number; y: number }> = {};
    for (const b of balls) ballPoses[b.id] = { x: 1, y: 1 };
    const raw = {
      id: 'dr_x',
      courtMode: 'flat',
      cast: { chairs: [], balls, cones: [] },
      steps: [{ id: 'st_1', name: 's', note: '', chairs: {}, balls: ballPoses, cones: {}, arrows: [], notes: [] }],
    };
    const r = validateDrill(raw);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.cast.balls).toHaveLength(10);
    expect(Object.keys(r.value.steps[0]!.balls)).toHaveLength(10);
    expect('bl_10' in r.value.steps[0]!.balls).toBe(false);
  });

  it('viewBox 밖 좌표는 클램프된다', () => {
    const raw = {
      id: 'dr_x',
      courtMode: 'flat',
      cast: { chairs: [], balls: [{ id: 'bl_a' }], cones: [] },
      steps: [
        { id: 'st_1', name: 's', note: '', chairs: {}, balls: { bl_a: { x: -999, y: 99999 } }, cones: {}, arrows: [], notes: [] },
      ],
    };
    const r = validateDrill(raw);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const p = r.value.steps[0]!.balls['bl_a' as never]!;
    expect(p.x).toBeGreaterThanOrEqual(0);
    expect(p.x).toBeLessThanOrEqual(500);
    expect(p.y).toBeGreaterThanOrEqual(0);
    expect(p.y).toBeLessThanOrEqual(425);
  });

  it("formation:'4-4-2' 이고 steps:[] 인 파일이 throw 없이 통과한다", () => {
    const raw = {
      id: 'dr_x',
      courtMode: 'full',
      formation: '4-4-2',
      cast: { chairs: [], balls: [], cones: [] },
      steps: [],
    };
    expect(() => validateDrill(raw)).not.toThrow();
    const r = validateDrill(raw);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.formation).toBe('1-2-1');
    expect(r.value.steps).toHaveLength(1);
  });

  it('알 수 없는 ArrowKind 는 move 로 폴백된다', () => {
    const raw = {
      id: 'dr_x',
      courtMode: 'flat',
      cast: { chairs: [], balls: [], cones: [] },
      steps: [
        {
          id: 'st_1',
          name: 's',
          note: '',
          chairs: {},
          balls: {},
          cones: {},
          arrows: [{ id: 'ar_1', kind: 'teleport', from: { x: 0, y: 0 }, ctrl: { x: 1, y: 1 }, to: { x: 2, y: 2 } }],
          notes: [],
        },
      ],
    };
    const r = validateDrill(raw);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.steps[0]!.arrows[0]!.kind).toBe('move');
  });

  it('완전히 깨진(빈) 객체도 throw 없이 실패 결과를 준다', () => {
    expect(() => validateDrill({})).not.toThrow();
    expect(() => validateDrill(null)).not.toThrow();
    expect(() => validateDrill('garbage')).not.toThrow();
    expect(() => validateDrill(42)).not.toThrow();
  });
});

describe('validateSession', () => {
  it('정상 세션은 그대로 통과한다', () => {
    const raw = {
      id: 'se_x',
      title: '세션',
      items: [{ id: 'it_1', drillId: 'dr_1', titleCache: 'A', durationMinCache: 10, categoryCache: '공격' }],
    };
    const r = validateSession(raw);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.drillIds).toEqual(['dr_1']);
  });

  it('id 가 없으면 ok:false', () => {
    expect(validateSession({ items: [] }).ok).toBe(false);
  });
});
