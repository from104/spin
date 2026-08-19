// §6.3 세션 계획서의 자료 조립. 마크업이 아니라 **숫자와 순서**를 여기서 못박는다.
import { describe, expect, it } from 'vitest';
import { createDrill } from '../../model/defaults.ts';
import type { Drill } from '../../model/drill.ts';
import type { DrillId, ItemId, SessionId } from '../../core/ids.ts';
import { resolveSession, type TrainingSession } from '../../model/session.ts';
import { buildSessionPlan, formatPlanWhen, planDrillEntries } from './sessionPlan.ts';

function drill(title: string, durationMin: number): Drill {
  return { ...createDrill({ courtMode: 'full', formation: '1-2-1', durationMin }), title };
}

function sessionOf(
  drills: Drill[],
  opts: { overrides?: Record<number, number>; rests?: Record<number, number>; missingAt?: number } = {},
): { resolved: ReturnType<typeof resolveSession>; map: Map<DrillId, Drill> } {
  const session: TrainingSession = {
    schemaVersion: 2,
    id: 'se_1' as SessionId,
    title: '화요일 훈련',
    location: '체육관 A',
    note: '신입 2명 합류',
    scheduledAt: new Date(2026, 7, 12, 19, 0).getTime(),
    phases: [{ id: 'ph_1' as never, kind: 'custom' as const, title: '훈련', items: drills.map((d, i) => ({
      id: `it_${i}` as ItemId,
      drillId: d.id,
      titleCache: `${d.title} (옛 제목)`,
      durationMinCache: d.durationMin,
      categoryCache: d.drillType,
      durationOverrideMin: opts.overrides?.[i],
      restAfterMin: opts.rests?.[i],
    })) }],
    drillIds: drills.map((d) => d.id),
    createdAt: 0,
    updatedAt: 0,
  };
  // 삭제된 드릴 = 참조만 남고 실물이 없는 상태.
  const alive = drills.filter((_, i) => i !== opts.missingAt);
  const resolved = resolveSession(session, new Set(alive.map((d) => d.id)));
  return { resolved, map: new Map(alive.map((d) => [d.id, d])) };
}

describe('buildSessionPlan — 표지 표의 한 줄 한 줄', () => {
  it('항목 순서와 번호가 세션 순서 그대로다', () => {
    const { resolved, map } = sessionOf([drill('A', 10), drill('B', 12), drill('C', 8)]);
    const plan = buildSessionPlan(resolved, map, 'ko');
    expect(plan.entries.map((e) => [e.order, e.title])).toEqual([
      [1, 'A'],
      [2, 'B'],
      [3, 'C'],
    ]);
  });

  it('제목은 캐시가 아니라 실물 드릴에서 온다 — 종이와 앱이 다른 제목을 말하면 안 된다', () => {
    const { resolved, map } = sessionOf([drill('A', 10)]);
    expect(resolved.items[0]!.titleCache).toBe('A (옛 제목)');
    expect(buildSessionPlan(resolved, map, 'ko').entries[0]!.title).toBe('A');
  });

  it('시간 재정의가 캐시를 이긴다', () => {
    const { resolved, map } = sessionOf([drill('A', 10), drill('B', 12)], { overrides: { 1: 20 } });
    expect(buildSessionPlan(resolved, map, 'ko').entries.map((e) => e.durationMin)).toEqual([10, 20]);
  });

  it('휴식은 없으면 0 이다 — undefined 가 종이에 새지 않게', () => {
    const { resolved, map } = sessionOf([drill('A', 10), drill('B', 12)], { rests: { 0: 5 } });
    expect(buildSessionPlan(resolved, map, 'ko').entries.map((e) => e.restAfterMin)).toEqual([5, 0]);
  });

  it('총 시간은 resolveSession 이 계산한 값 그대로다 — 목록과 종이가 갈리면 안 된다', () => {
    const { resolved, map } = sessionOf([drill('A', 10), drill('B', 12)], { overrides: { 1: 20 }, rests: { 0: 5 } });
    expect(resolved.totalMin).toBe(35);
    expect(buildSessionPlan(resolved, map, 'ko').totalMin).toBe(35);
  });

  it('세션 준비물은 드릴별 준비물의 최대다', () => {
    const a = drill('A', 10);
    const b = { ...drill('B', 10), cast: { ...drill('B', 10).cast, cones: [{ id: 'co_1' as never, colorIndex: 0 as const }] } };
    const { resolved, map } = sessionOf([a, b]);
    const plan = buildSessionPlan(resolved, map, 'ko');
    expect(plan.prep.cones).toBe(1);
    expect(plan.prep.players).toBeGreaterThan(0);
  });

  it('날짜가 없으면 when 이 undefined 다(표지에서 줄째로 빠진다)', () => {
    const { resolved, map } = sessionOf([drill('A', 10)]);
    const noDate = { ...resolved, session: { ...resolved.session, scheduledAt: undefined } };
    expect(buildSessionPlan(noDate, map, 'ko').when).toBeUndefined();
  });
});

describe('삭제된 드릴 — 표에는 남고 장은 안 만든다', () => {
  it('누락 항목도 표지 표의 한 줄을 차지한다', () => {
    const { resolved, map } = sessionOf([drill('A', 10), drill('B', 12), drill('C', 8)], { missingAt: 1 });
    const plan = buildSessionPlan(resolved, map, 'ko');
    expect(plan.entries).toHaveLength(3);
    expect(plan.entries[1]!.missing).toBe(true);
    expect(plan.entries[1]!.title).toBe('B (옛 제목)'); // 실물이 없으니 캐시로 물러난다
    expect(plan.missingCount).toBe(1);
  });

  it('planDrillEntries 는 누락을 뺀다 — 코트가 없는 장을 만들 수 없다', () => {
    const { resolved, map } = sessionOf([drill('A', 10), drill('B', 12), drill('C', 8)], { missingAt: 1 });
    const plan = buildSessionPlan(resolved, map, 'ko');
    expect(planDrillEntries(plan).map((e) => e.title)).toEqual(['A', 'C']);
  });

  it('대조군: 아무것도 안 지웠으면 전부 남는다 — "언제나 걸러낸다" 인 구현을 막는다', () => {
    const { resolved, map } = sessionOf([drill('A', 10), drill('B', 12), drill('C', 8)]);
    const plan = buildSessionPlan(resolved, map, 'ko');
    expect(planDrillEntries(plan)).toHaveLength(3);
    expect(plan.missingCount).toBe(0);
  });

  it('참조는 살아 있는데 map 에 안 실린 드릴도 누락으로 본다 — 그릴 코트가 없기는 마찬가지다', () => {
    const { resolved } = sessionOf([drill('A', 10)]);
    const plan = buildSessionPlan(resolved, new Map(), 'ko');
    expect(plan.entries[0]!.missing).toBe(true);
    expect(planDrillEntries(plan)).toHaveLength(0);
  });
});

describe('formatPlanWhen — 종이에는 날짜가 있어야 한다', () => {
  it('요일·시각 앞에 연월일을 붙인다', () => {
    // 2026-08-12 는 수요일. formatSessionWhen 이 만드는 "수 19:00" 앞에 날짜가 붙는다.
    expect(formatPlanWhen(new Date(2026, 7, 12, 19, 0).getTime(), 'ko')).toBe('2026-08-12 수 19:00');
  });

  it('대조군: 요일·시각만으로는 지난주 계획서와 구분되지 않는다', () => {
    const a = formatPlanWhen(new Date(2026, 7, 5, 19, 0).getTime(), 'ko');
    const b = formatPlanWhen(new Date(2026, 7, 12, 19, 0).getTime(), 'ko');
    expect(a).not.toBe(b);
  });
});
