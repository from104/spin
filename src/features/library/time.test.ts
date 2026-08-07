import { describe, expect, it } from 'vitest';
import { fromLocalInputValue, toLocalInputValue } from './time.ts';

describe('toLocalInputValue / fromLocalInputValue', () => {
  it('왕복한다(분 단위)', () => {
    const ms = new Date(2026, 7, 8, 19, 5, 0, 0).getTime();
    const str = toLocalInputValue(ms);
    expect(str).toBe('2026-08-08T19:05');
    expect(fromLocalInputValue(str)).toBe(new Date(2026, 7, 8, 19, 5).getTime());
  });
  it('잘못된 입력은 undefined 를 반환한다', () => {
    expect(fromLocalInputValue('')).toBeUndefined();
    expect(fromLocalInputValue('not-a-date')).toBeUndefined();
  });
});
