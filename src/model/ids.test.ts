// §10.5 의 정식 newId/isId 골든 테스트. core/ids.test.ts 는 기본 계약만 가볍게 확인하고,
// 이 파일이 "시계 고정 1296개 무충돌"과 "실시간 10만개 무충돌"을 검증한다(두 테스트를 분리 —
// 시계를 고정한 채 10만개를 뽑으면 평균 2.1건 충돌해 플레이키가 된다).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isId, newId } from '../core/ids.ts';

describe('newId — 시계 고정, 같은 ms 안 1296개', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('1296개까지 충돌 없이 생성된다', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 1296; i++) ids.add(newId('ch'));
    expect(ids.size).toBe(1296);
  });
});

describe('newId — 실시간, 10만개', () => {
  it('실제 시계로 10만개를 뽑아도 충돌이 없다', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100_000; i++) ids.add(newId('bl'));
    expect(ids.size).toBe(100_000);
  });
});

describe('isId', () => {
  it('10자 · 19자 id 를 모두 통과시킨다(길이 하드코딩 없음)', () => {
    expect(isId('dr_abc1', 'dr')).toBe(true); // 10자
    expect(isId('dr_' + 'a'.repeat(16), 'dr')).toBe(true); // 19자
  });
  it('접두 불일치·비문자열만 거부한다', () => {
    expect(isId('se_abc1', 'dr')).toBe(false);
    expect(isId(123, 'dr')).toBe(false);
    expect(isId(undefined, 'dr')).toBe(false);
    expect(isId(null, 'dr')).toBe(false);
  });
});
