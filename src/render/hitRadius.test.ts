// §10.7 히트 반경 상한(§6.5 blocker) 회귀.
import { describe, expect, it } from 'vitest';
import { HIT_R_MAX_PX, hitRadius } from './hitRadius.ts';

describe('hitRadius', () => {
  it('hitRadius("ball", 0.8375) 가 HIT_R_MAX_PX.ball 로 클램프된다(iPad 11" 풀코트 실측 배율)', () => {
    expect(hitRadius('ball', 0.8375)).toBe(HIT_R_MAX_PX.ball);
  });

  it('고배율(줌인)에서는 상한에 닿지 않고 CSS px 역환산값을 그대로 쓴다', () => {
    // 44/2/pxPerUnit < cap 이 되는 배율을 고른다.
    const pxPerUnit = 4;
    const expected = 44 / 2 / pxPerUnit;
    expect(expected).toBeLessThan(HIT_R_MAX_PX.ball);
    expect(hitRadius('ball', pxPerUnit)).toBeCloseTo(expected, 10);
  });

  it('네 종류 모두 상한표(§6.5)와 일치한다', () => {
    expect(HIT_R_MAX_PX).toEqual({ chair: 21.25, ball: 11.25, cone: 8.75, note: 12.5 });
  });

  it('"큰 터치 타깃"(56px) 설정을 세 번째 인자로 받아 반영한다', () => {
    const pxPerUnit = 4;
    expect(hitRadius('cone', pxPerUnit, 56)).toBeCloseTo(56 / 2 / pxPerUnit, 10);
  });
});
