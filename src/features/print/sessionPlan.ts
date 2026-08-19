// §6.3 세션 계획서의 **자료**를 만든다(그리는 것은 PrintSessionPlan.tsx).
//
// 왜 순수 함수로 떼는가: 표지의 타임테이블은 "몇 번째 · 무슨 드릴 · 몇 분 · 다음 휴식" 이고
// 이건 전부 `ResolvedSession` 에서 파생된다. 컴포넌트 안에서 계산하면 *"삭제된 드릴이 표에
// 남는가"* · *"시간 재정의가 총합에 반영되는가"* 를 마크업을 통해서만 물어야 한다.
import type { DrillId } from '../../core/ids.ts';
import type { Drill } from '../../model/drill.ts';
import type { ResolvedSession } from '../../model/session.ts';
import { formatSessionWhen } from '../../model/session.ts';
import { maxPrep, prepFor, type PrepCounts, type PrepList } from './prep.ts';
import type { Locale } from '../../i18n/locale.ts';

export interface PlanEntry {
  /** 표지 표의 순번(1부터). 누락 항목도 번호를 받는다 — 종이와 화면의 순서가 어긋나면 안 된다. */
  order: number;
  title: string;
  durationMin: number;
  /** 이 드릴 **다음**의 휴식(분). 0 이면 휴식 없음. */
  restAfterMin: number;
  note?: string;
  /** 드릴이 지워졌다(참조만 남았다). 표지 표에는 남기고, **드릴 장은 만들지 않는다** —
   *  그릴 코트가 없다. */
  missing: boolean;
  drill?: Drill;
  prep?: PrepList;
}

export interface SessionPlan {
  title: string;
  /** "2026-08-12 화 19:00". 시각 미정이면 undefined — 표지에서 줄째로 빠진다. */
  when?: string;
  location?: string;
  note?: string;
  /** `resolveSession` 이 이미 계산한 값을 그대로 쓴다(목록과 종이가 갈리지 않게). */
  totalMin: number;
  entries: PlanEntry[];
  /** 세션 전체 준비물 = 드릴별 최대(prep.ts `maxPrep` 머리말 참고). */
  prep: PrepCounts;
  missingCount: number;
}

/** `formatSessionWhen` 은 "화 19:00" 까지만 만든다(§3.12 — 로케일 조합을 안 쓴다는 원칙).
 *  종이에는 날짜가 반드시 있어야 한다: 코치가 지난주 계획서와 섞어 든다. 같은 원칙으로
 *  직접 조립한다. */
export function formatPlanWhen(ms: number, locale: Locale): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${day} ${formatSessionWhen(ms, locale)}`;
}

export function buildSessionPlan(resolved: ResolvedSession, drills: ReadonlyMap<DrillId, Drill>, locale: Locale): SessionPlan {
  const entries: PlanEntry[] = resolved.items.map((item, i) => {
    const drill = item.missing ? undefined : drills.get(item.drillId);
    return {
      order: i + 1,
      // 캐시된 제목이 아니라 **실물 드릴의 제목**을 먼저 쓴다 — 캐시는 갱신이 밀릴 수 있고,
      // 종이에 찍힌 제목이 앱과 다르면 코치가 다른 드릴을 찾는다. 실물이 없으면 캐시로 물러난다.
      title: drill?.title ?? item.titleCache,
      durationMin: item.durationOverrideMin ?? item.durationMinCache,
      restAfterMin: item.restAfterMin ?? 0,
      note: item.note,
      // `missing` 은 resolveRefs 의 판정이지만, 참조는 살아 있는데 map 에 안 들어온 경우
      // (호출부가 일부만 실었다)도 그릴 코트가 없기는 마찬가지다.
      missing: item.missing || drill === undefined,
      drill,
      prep: drill ? prepFor(drill) : undefined,
    };
  });

  const prep = maxPrep(entries.flatMap((e) => (e.prep ? [e.prep] : [])));

  return {
    title: resolved.session.title,
    when: resolved.session.scheduledAt === undefined ? undefined : formatPlanWhen(resolved.session.scheduledAt, locale),
    location: resolved.session.location,
    note: resolved.session.note,
    totalMin: resolved.totalMin,
    entries,
    prep,
    missingCount: entries.filter((e) => e.missing).length,
  };
}

/** 종이에 실리는 드릴 장의 목록 = 누락이 아닌 항목. 표지 1 + **이것의 길이** 가 총 장수다. */
export function planDrillEntries(plan: SessionPlan): PlanEntry[] {
  return plan.entries.filter((e) => !e.missing);
}
