import { describe, expect, it } from 'vitest';
import { isId, newId } from './ids.ts';

// 참고: newId/isId 의 §10.5 정식 검증(시계 고정 1296개 무충돌 등)은 `model` 모듈 담당(§10.5).
// 여기서는 core 구현 자체의 기본 계약(형태·isId 판정)만 가볍게 확인한다.
describe('ids', () => {
  it('newId 는 접두_로 시작하는 17자 문자열을 만든다', () => {
    const id = newId('ch');
    expect(id).toMatch(/^ch_[0-9a-z]{14}$/);
    expect(id.length).toBe(17);
  });

  it('같은 ms 안에서 연속 호출해도 값이 겹치지 않는다', () => {
    const ids = new Set(Array.from({ length: 50 }, () => newId('bl')));
    expect(ids.size).toBe(50);
  });

  it('isId: 접두 일치 + 문자셋 통과', () => {
    expect(isId(newId('dr'), 'dr')).toBe(true);
    expect(isId('dr_abc1', 'dr')).toBe(true); // 10자, 길이 하드코딩 없음
    expect(isId('dr_' + 'a'.repeat(16), 'dr')).toBe(true); // 19자
  });

  it('isId: 접두 불일치·비문자열은 거부', () => {
    expect(isId(newId('dr'), 'se')).toBe(false);
    expect(isId(123, 'dr')).toBe(false);
    expect(isId(undefined, 'dr')).toBe(false);
    expect(isId('DR_abc1', 'dr')).toBe(false); // 대문자 불허
  });
});
