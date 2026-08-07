// §3.12 훈련 세션. 총 시간은 해석된 세션(ResolvedSession)에서만 계산한다 — 안 그러면 목록이
// "52분", 상세가 "총 42분(누락 1개 제외)" 로 갈린다.
import type { DrillId, SessionId } from '../core/ids.ts';
import type { DrillRef } from './refs.ts';
import { resolveRefs } from './refs.ts';

export const CURRENT_SESSION_SCHEMA = 1;

export interface SessionItem extends DrillRef {
  durationOverrideMin?: number;
  note?: string;
  restAfterMin?: number;
}

export interface TrainingSession {
  schemaVersion: number;
  id: SessionId;
  title: string;
  note?: string;
  scheduledAt?: number;
  location?: string;
  items: SessionItem[];
  drillIds: DrillId[]; // items 에서 파생. putSession 이 무조건 재계산
  createdAt: number;
  updatedAt: number;
}

export type ResolvedItem = SessionItem & { missing: boolean };
export interface ResolvedSession {
  session: TrainingSession;
  items: ResolvedItem[];
  totalMin: number;
  missingCount: number;
}

export function resolveSession(s: TrainingSession, existing: Set<DrillId>): ResolvedSession {
  const items = resolveRefs(s.items, existing);
  const totalMin = sessionTotalMin(items);
  const missingCount = items.filter((i) => i.missing).length;
  return { session: s, items, totalMin, missingCount };
}

/** Σ(미누락 항목의 durationOverrideMin ?? durationMinCache) + Σ(restAfterMin ?? 0) */
export function sessionTotalMin(items: ResolvedItem[]): number {
  let total = 0;
  for (const item of items) {
    if (item.missing) continue;
    total += item.durationOverrideMin ?? item.durationMinCache;
    total += item.restAfterMin ?? 0;
  }
  return total;
}

export function pickNextSession(list: TrainingSession[], now: number = Date.now()): TrainingSession | null {
  let best: TrainingSession | null = null;
  for (const s of list) {
    if (s.scheduledAt === undefined || s.scheduledAt < now) continue;
    if (!best || s.scheduledAt < best.scheduledAt!) best = s;
  }
  return best;
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/** 로케일 조합 결과가 브라우저마다 달라지지 않도록 직접 조립한다 → "화 19:00" */
export function formatSessionWhen(ms: number): string {
  const d = new Date(ms);
  const wd = WEEKDAYS[d.getDay()];
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${wd} ${hh}:${mm}`;
}
