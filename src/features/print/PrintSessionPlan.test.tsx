// §6.3 완료 판정 — **세션 계획서 = 표지 1 + 드릴 n**.
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { createDrill } from '../../model/defaults.ts';
import type { Drill } from '../../model/drill.ts';
import type { DrillId, ItemId, SessionId } from '../../core/ids.ts';
import { resolveSession, type TrainingSession } from '../../model/session.ts';
import { buildSessionPlan } from './sessionPlan.ts';
import { PrintSessionPlan } from './PrintSessionPlan.tsx';

function drill(title: string): Drill {
  return { ...createDrill({ courtMode: 'full', formation: '1-2-1' }), title };
}

function planOf(titles: string[], opts: { missingAt?: number; rests?: Record<number, number> } = {}) {
  const drills = titles.map(drill);
  const session: TrainingSession = {
    schemaVersion: 1,
    id: 'se_1' as SessionId,
    title: '화요일 훈련',
    location: '체육관 A',
    scheduledAt: new Date(2026, 7, 12, 19, 0).getTime(),
    items: drills.map((d, i) => ({
      id: `it_${i}` as ItemId,
      drillId: d.id,
      titleCache: d.title,
      durationMinCache: d.durationMin,
      categoryCache: d.drillType,
      restAfterMin: opts.rests?.[i],
    })),
    drillIds: drills.map((d) => d.id),
    createdAt: 0,
    updatedAt: 0,
  };
  const alive = drills.filter((_, i) => i !== opts.missingAt);
  const resolved = resolveSession(session, new Set(alive.map((d) => d.id)));
  const map = new Map<DrillId, Drill>(alive.map((d) => [d.id, d]));
  return buildSessionPlan(resolved, map);
}

describe('장 수 = 표지 1 + 드릴 n', () => {
  it('드릴 3개짜리 세션은 4장이다', () => {
    const { container } = render(<PrintSessionPlan plan={planOf(['A', 'B', 'C'])} />);
    const pages = container.querySelectorAll('[data-print-page]');
    expect(pages.length).toBeGreaterThan(0); // 하한 — "0장이라 통과" 방지
    expect(pages).toHaveLength(4);
    expect(pages[0]!.getAttribute('data-print-page')).toBe('cover');
    expect(container.querySelectorAll('[data-print-page="drill"]')).toHaveLength(3);
  });

  it('드릴 1개짜리 세션은 2장이다 — 드릴 수에 실제로 반응하는가', () => {
    expect(render(<PrintSessionPlan plan={planOf(['A'])} />).container.querySelectorAll('[data-print-page]')).toHaveLength(2);
  });

  it('대조군: 드릴이 0개여도 표지 1장은 나온다(빈 종이가 아니다)', () => {
    const { container } = render(<PrintSessionPlan plan={planOf([])} />);
    expect(container.querySelectorAll('[data-print-page]')).toHaveLength(1);
    expect(container.textContent).toContain('화요일 훈련');
  });

  it('드릴 장의 순서가 세션 순서다', () => {
    const { container } = render(<PrintSessionPlan plan={planOf(['A', 'B', 'C'])} />);
    const orders = Array.from(container.querySelectorAll('[data-print-page="drill"]')).map((el) => el.getAttribute('data-plan-order'));
    expect(orders).toEqual(['1', '2', '3']);
  });
});

describe('표지', () => {
  it('세션명·날짜·장소·총 시간이 실린다', () => {
    const cover = render(<PrintSessionPlan plan={planOf(['A', 'B'])} />).container.querySelector('[data-print-page="cover"]')!;
    expect(cover.textContent).toContain('화요일 훈련');
    expect(cover.textContent).toContain('2026-08-12');
    expect(cover.textContent).toContain('체육관 A');
    expect(cover.textContent).toContain('총 20분'); // 기본 10분 × 2
  });

  it('타임테이블 줄 수 = 항목 수', () => {
    const cover = render(<PrintSessionPlan plan={planOf(['A', 'B', 'C'])} />).container.querySelector('[data-print-page="cover"]')!;
    expect(cover.querySelectorAll('[data-plan-row]')).toHaveLength(3);
  });

  it('휴식은 있으면 분으로, 없으면 —', () => {
    const cover = render(<PrintSessionPlan plan={planOf(['A', 'B'], { rests: { 0: 5 } })} />).container.querySelector('[data-print-page="cover"]')!;
    const cells = Array.from(cover.querySelectorAll('[data-plan-row]')).map((r) => r.children[3]!.textContent);
    expect(cells).toEqual(['5분', '—']);
  });
});

describe('삭제된 드릴 — 표에는 남고 장은 없다', () => {
  it('표지 줄은 3개인데 드릴 장은 2장이다', () => {
    const { container } = render(<PrintSessionPlan plan={planOf(['A', 'B', 'C'], { missingAt: 1 })} />);
    expect(container.querySelectorAll('[data-plan-row]')).toHaveLength(3);
    expect(container.querySelectorAll('[data-print-page="drill"]')).toHaveLength(2);
    expect(container.querySelector('[data-plan-row="2"]')!.textContent).toContain('삭제된 드릴');
  });

  it('대조군: 아무것도 안 지웠으면 3장 다 나온다', () => {
    const { container } = render(<PrintSessionPlan plan={planOf(['A', 'B', 'C'])} />);
    expect(container.querySelectorAll('[data-print-page="drill"]')).toHaveLength(3);
    expect(container.textContent).not.toContain('삭제된 드릴');
  });
});

describe('드릴 장', () => {
  it('코트 그림 1개와 스텝별 코칭 메모가 실린다', () => {
    const plan = planOf(['A']);
    const { container } = render(<PrintSessionPlan plan={plan} />);
    const page = container.querySelector('[data-print-page="drill"]')!;
    expect(page.querySelectorAll('svg')).toHaveLength(1);
    // 기본 드릴은 스텝 1개 — 목록 항목 수가 스텝 수와 같아야 한다.
    expect(page.querySelectorAll('[data-step-index]')).toHaveLength(plan.entries[0]!.drill!.steps.length);
  });
});
