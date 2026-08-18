// §3.12 참조 — 제네릭 보존, resolve/refresh/reorder.
import { describe, expect, it } from 'vitest';
import type { DrillId, ItemId } from '../core/ids.ts';
import { newId } from '../core/ids.ts';
import { refDrillIds, refreshRefs, remapRefs, reorderRefs, resolveRefs } from './refs.ts';
import type { SessionItem } from './session.ts';
import { resolveSession, sessionTotalMin, pickNextSession, formatSessionWhen } from './session.ts';
import type { TrainingSession } from './session.ts';

function item(overrides: Partial<SessionItem> = {}): SessionItem {
  return {
    id: newId('it') as ItemId,
    drillId: 'dr_x' as DrillId,
    titleCache: 'old',
    durationMinCache: 5,
    categoryCache: '공격',
    ...overrides,
  };
}

describe('refreshRefs', () => {
  it('제네릭이고 durationOverrideMin/restAfterMin/note 를 보존한다', () => {
    const items: SessionItem[] = [item({ durationOverrideMin: 20, note: '메모', restAfterMin: 3 })];
    // v8 — 캐시의 분류 소스는 요약의 drillType 키다(옛 한국어 category 캐시를 이 갱신이 덮는다).
    const src = new Map([['dr_x' as DrillId, { title: '새 제목', durationMin: 10, drillType: 'tactical' as const }]]);
    const out = refreshRefs(items, src);
    expect(out[0]!.titleCache).toBe('새 제목');
    expect(out[0]!.durationMinCache).toBe(10);
    expect(out[0]!.categoryCache).toBe('tactical');
    expect(out[0]!.durationOverrideMin).toBe(20);
    expect(out[0]!.note).toBe('메모');
    expect(out[0]!.restAfterMin).toBe(3);
  });

  it('src 에 없는 drillId 는 그대로 둔다', () => {
    const items: SessionItem[] = [item()];
    const out = refreshRefs(items, new Map());
    expect(out[0]).toEqual(items[0]);
  });
});

describe('resolveRefs', () => {
  it('missing 플래그를 계산하면서 추가 필드를 보존한다', () => {
    const items: SessionItem[] = [item({ note: '메모' }), item({ drillId: 'dr_gone' as DrillId })];
    const out = resolveRefs(items, new Set(['dr_x' as DrillId]));
    expect(out[0]!.missing).toBe(false);
    expect(out[0]!.note).toBe('메모');
    expect(out[1]!.missing).toBe(true);
  });
});

describe('reorderRefs / refDrillIds / remapRefs', () => {
  it('reorderRefs 는 범위를 벗어나면 동일 참조', () => {
    const list = [1, 2, 3];
    expect(reorderRefs(list, 0, 0)).toBe(list);
    expect(reorderRefs(list, -1, 1)).toBe(list);
    expect(reorderRefs(list, 0, 2)).toEqual([2, 3, 1]);
  });

  it('refDrillIds 는 중복을 제거한다', () => {
    const items: SessionItem[] = [item({ drillId: 'dr_a' as DrillId }), item({ drillId: 'dr_b' as DrillId }), item({ drillId: 'dr_a' as DrillId })];
    expect(refDrillIds(items)).toEqual(['dr_a', 'dr_b']);
  });

  it('remapRefs 는 매핑된 drillId 만 바꾼다', () => {
    const items: SessionItem[] = [item({ drillId: 'dr_a' as DrillId })];
    const out = remapRefs(items, new Map([['dr_a' as DrillId, 'dr_z' as DrillId]]));
    expect(out[0]!.drillId).toBe('dr_z');
  });
});

describe('session — 총 시간은 해석된 세션에서만 계산한다', () => {
  it('sessionTotalMin: 누락 항목 제외, override/restAfter 반영', () => {
    const resolved = [
      { ...item({ durationOverrideMin: 20, restAfterMin: 5 }), missing: false },
      { ...item({ durationMinCache: 12 }), missing: false },
      { ...item({ durationMinCache: 999 }), missing: true }, // 누락 — 제외
    ];
    expect(sessionTotalMin(resolved)).toBe(20 + 5 + 12);
  });

  it('resolveSession 이 missingCount 를 정확히 세고, 구획별 합계와 평평한 뷰가 일치한다 (v2)', () => {
    const session: TrainingSession = {
      schemaVersion: 2,
      id: 'se_x' as never,
      title: '세션',
      phases: [
        { id: 'ph_1' as never, kind: 'warm-up', items: [item({ drillId: 'dr_a' as DrillId })] },
        { id: 'ph_2' as never, kind: 'tactical', items: [item({ drillId: 'dr_missing' as DrillId })] },
      ],
      drillIds: ['dr_a' as DrillId, 'dr_missing' as DrillId],
      createdAt: 0,
      updatedAt: 0,
    };
    const r = resolveSession(session, new Set(['dr_a' as DrillId]));
    expect(r.missingCount).toBe(1);
    expect(r.totalMin).toBe(5); // dr_a 만 포함
    expect(r.phases).toHaveLength(2);
    expect(r.phases[0]!.totalMin).toBe(5);
    expect(r.phases[1]!.totalMin).toBe(0); // 누락 항목은 구획 합계에서도 빠진다
    expect(r.items).toHaveLength(2); // 평평한 하위 호환 뷰 = 구획 순서대로 flatten
  });
});

describe('pickNextSession / formatSessionWhen', () => {
  it('미래 중 가장 가까운 세션을 고른다', () => {
    const mk = (id: string, at?: number): TrainingSession => ({
      schemaVersion: 2,
      id: id as never,
      title: id,
      phases: [],
      drillIds: [],
      createdAt: 0,
      updatedAt: 0,
      ...(at !== undefined ? { scheduledAt: at } : {}),
    });
    const now = 1000;
    const list = [mk('past', 500), mk('far', 5000), mk('near', 2000), mk('none')];
    expect(pickNextSession(list, now)!.id).toBe('near');
  });

  it('formatSessionWhen 이 "요일 HH:MM" 형식이다', () => {
    const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
    const d = new Date(2026, 0, 6, 9, 5);
    const s = formatSessionWhen(d.getTime());
    expect(s).toBe(`${WEEKDAYS[d.getDay()]} 09:05`);
  });
});
