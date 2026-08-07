// §6.11 "formatSessionWhen 처럼 로케일 조합 결과가 브라우저마다 달라지지 않도록 직접 조립한다"는
// 원칙을 대문의 "최근 작업한 드릴" 상대시각 표기에도 그대로 적용한다.
import type { DrillSummary } from '../../model/summary.ts';
import type { TrainingSession } from '../../model/session.ts';

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** "방금 전" / "N분 전" / "N시간 전" / "N일 전" / 그 이상은 "YYYY.MM.DD". */
export function formatRelative(ms: number, now: number = Date.now()): string {
  const diff = now - ms;
  if (diff < MIN) return '방금 전';
  if (diff < HOUR) return `${Math.floor(diff / MIN)}분 전`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}시간 전`;
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)}일 전`;
  const d = new Date(ms);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

/** 오늘부터 `days`일 이내에 예정된 세션 수. */
export function countUpcomingSessions(sessions: readonly TrainingSession[], days: number, now: number = Date.now()): number {
  const until = now + days * DAY;
  return sessions.filter((s) => s.scheduledAt !== undefined && s.scheduledAt >= now && s.scheduledAt <= until).length;
}

export interface HomeStat {
  label: string;
  value: string;
  unit: string;
}

/** 대문 통계 4칸. 전부 라이브러리 요약에서 파생한다 — 하드코딩 금지(§ 작업지시). */
export function computeHomeStats(drills: DrillSummary[], sessionCount: number, upcomingWeekCount: number): HomeStat[] {
  const avgDuration = drills.length === 0 ? 0 : Math.round(drills.reduce((sum, d) => sum + d.durationMin, 0) / drills.length);
  return [
    { label: '전체 드릴', value: String(drills.length), unit: '개' },
    { label: '저장된 세션', value: String(sessionCount), unit: '개' },
    { label: '이번 주 예정 세션', value: String(upcomingWeekCount), unit: '개' },
    { label: '평균 소요 시간', value: drills.length === 0 ? '–' : String(avgDuration), unit: '분' },
  ];
}
