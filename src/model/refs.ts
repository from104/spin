// §3.12 참조 — "순서 있는 드릴 참조". 세션과 (미래의) 드릴 셋이 공유한다. 제네릭이어야 한다 —
// DrillRef[] 로 좁히면 SessionItem 의 추가 필드가 구조적으로 통과하면서 유실된다.
import type { DrillId, ItemId } from '../core/ids.ts';
import type { DrillSummary } from './summary.ts';

export interface DrillRef {
  id: ItemId;
  drillId: DrillId;
  titleCache: string;
  durationMinCache: number;
  categoryCache: string;
}

export function refreshRefs<T extends DrillRef>(
  refs: T[],
  src: Map<DrillId, Pick<DrillSummary, 'title' | 'durationMin' | 'category'>>,
): T[] {
  return refs.map((r) => {
    const s = src.get(r.drillId);
    if (!s) return r;
    return { ...r, titleCache: s.title, durationMinCache: s.durationMin, categoryCache: s.category };
  });
}

export function resolveRefs<T extends DrillRef>(refs: T[], existing: Set<DrillId>): Array<T & { missing: boolean }> {
  return refs.map((r) => ({ ...r, missing: !existing.has(r.drillId) }));
}

export function reorderRefs<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || from >= list.length || to < 0 || to >= list.length) return list;
  const copy = list.slice();
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item!);
  return copy;
}

/** 중복 제거된 배열. */
export function refDrillIds(refs: DrillRef[]): DrillId[] {
  const seen = new Set<DrillId>();
  const out: DrillId[] = [];
  for (const r of refs) {
    if (!seen.has(r.drillId)) {
      seen.add(r.drillId);
      out.push(r.drillId);
    }
  }
  return out;
}

export function remapRefs<T extends DrillRef>(refs: T[], idMap: Map<DrillId, DrillId>): T[] {
  return refs.map((r) => {
    const mapped = idMap.get(r.drillId);
    return mapped ? { ...r, drillId: mapped } : r;
  });
}
