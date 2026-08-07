import { describe, expect, it } from 'vitest';
import { computeHomeStats, countUpcomingSessions, formatRelative } from './format.ts';
import type { DrillSummary } from '../../model/summary.ts';
import type { TrainingSession } from '../../model/session.ts';

function summary(over: Partial<DrillSummary>): DrillSummary {
  return {
    id: 'dr_x' as DrillSummary['id'],
    build: 1,
    title: 't',
    category: '공격',
    level: '초급',
    durationMin: 10,
    tags: [],
    courtMode: 'full',
    stepCount: 1,
    createdAt: 0,
    updatedAt: 0,
    teams: {
      home: { label: 'h', color: '#fff', gkColor: '#fff' },
      away: { label: 'a', color: '#000', gkColor: '#000' },
    },
    thumb: { mode: 'full', chairs: [], balls: [], cones: [], arrows: [] },
    searchKey: 't',
    ...over,
  };
}

describe('formatRelative', () => {
  const now = Date.UTC(2026, 7, 8, 12, 0, 0);
  it('1분 미만은 방금 전', () => {
    expect(formatRelative(now - 30_000, now)).toBe('방금 전');
  });
  it('분/시간/일 단위로 반올림 내림', () => {
    expect(formatRelative(now - 5 * 60_000, now)).toBe('5분 전');
    expect(formatRelative(now - 3 * 3600_000, now)).toBe('3시간 전');
    expect(formatRelative(now - 2 * 86400_000, now)).toBe('2일 전');
  });
  it('7일 이상이면 날짜로 표기한다', () => {
    expect(formatRelative(Date.UTC(2026, 6, 1), Date.UTC(2026, 7, 8))).toBe('2026.07.01');
  });
});

describe('computeHomeStats', () => {
  it('드릴이 없으면 평균 시간이 대시(–)다', () => {
    const stats = computeHomeStats([], 0, 0);
    expect(stats).toHaveLength(4);
    expect(stats.find((s) => s.label === '평균 소요 시간')?.value).toBe('–');
    expect(stats.find((s) => s.label === '전체 드릴')?.value).toBe('0');
  });
  it('평균 소요 시간을 반올림한다', () => {
    const drills = [summary({ durationMin: 10 }), summary({ durationMin: 15 })];
    const stats = computeHomeStats(drills, 2, 1);
    expect(stats.find((s) => s.label === '평균 소요 시간')?.value).toBe('13'); // 12.5 → round
    expect(stats.find((s) => s.label === '저장된 세션')?.value).toBe('2');
    expect(stats.find((s) => s.label === '이번 주 예정 세션')?.value).toBe('1');
  });
});

describe('countUpcomingSessions', () => {
  const now = Date.UTC(2026, 7, 8);
  const DAY = 86_400_000;
  const mk = (scheduledAt?: number): TrainingSession => ({
    schemaVersion: 1,
    id: 'se_x' as TrainingSession['id'],
    title: 's',
    ...(scheduledAt !== undefined ? { scheduledAt } : {}),
    items: [],
    drillIds: [],
    createdAt: 0,
    updatedAt: 0,
  });

  it('과거·미정의 세션은 세지 않는다', () => {
    expect(countUpcomingSessions([mk(now - DAY), mk(undefined)], 7, now)).toBe(0);
  });
  it('7일 이내 세션만 센다', () => {
    const list = [mk(now + DAY), mk(now + 6 * DAY), mk(now + 8 * DAY)];
    expect(countUpcomingSessions(list, 7, now)).toBe(2);
  });
});
