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
    const t0 = Date.now();
    const ids = new Set<string>();
    for (let i = 0; i < 100_000; i++) ids.add(newId('bl'));

    // ★ 전제를 먼저 확인한다: **시계가 실제로 흘렀는가**.
    //
    // 이 테스트는 ms 마다 seq 가 0 으로 돌아가는 덕에 통과한다. 실측 생성 속도는
    // ms 당 39개라 seq(1296)를 감을 일이 없고, 그래서 rand 4자리는 쓰이지도 않는다.
    // 그런데 시계가 멈춰 있으면 10만개가 한 ms 에 몰려 seq 가 77바퀴를 감고, 그때는
    // rand 충돌만 남아 평균 2.1건이 난다(위 describe 를 분리해 둔 이유가 그것이다).
    //
    // 2026-08-12 전체 스위트에서 이 테스트가 한 번 빨간불이 났는데 단독 재현은
    // 0/240 이었다. 남은 설명은 "그 실행에서 시계가 멈춰 있었다"(다른 파일의 가짜
    // 타이머 유출) 뿐이다. 확증하지 못했으므로 다음 번에 스스로 말하게 해 둔다 —
    // 여기서 걸리면 범인은 id 생성기가 아니라 시계다.
    expect(Date.now(), '시계가 멈춰 있다 — 가짜 타이머가 샜다면 이 테스트는 id 가 아니라 환경을 잰 것이다').toBeGreaterThan(t0);
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
