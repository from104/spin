// §10.7 히트 반경 상한(§6.5 blocker) 회귀.
import { describe, expect, it } from 'vitest';
import { INTERACT } from '../core/constants.ts';
import { DEFAULT_HIT_CSS_PX, HIT_R_MAX_PX, hitRadius } from './hitRadius.ts';

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
    // note 22: §4.3 P1-2 로 12.5 에서 올렸다. 메모는 자기 반지름이 0 이라 픽 반경이 `6/s` 뿐인데
    // 12.5 는 s<0.48 에서 그것을 잘라 화면상 메모를 점점 작게 만들었다. 휠체어(21.25)와 자리를
    // 다투지 않으므로 상한만 그 위로 올린다. physics/hitTest.ts 의 복제본과 같은 값이어야 한다.
    expect(HIT_R_MAX_PX).toEqual({ chair: 21.25, ball: 11.25, cone: 8.75, note: 22 });
  });

  it('기본 히트 타깃은 core 의 눈금(`--hit` 44px)과 같은 값이다', () => {
    // 예전에는 이 파일의 로컬 리터럴 44 였다 — 2단 히트가 코트 위에서 같은 눈금을 쓰게 되면서
    // core 로 올렸고, 두 곳이 어긋나면 "큰 터치 타깃" 설명문이 다시 거짓말이 된다.
    expect(DEFAULT_HIT_CSS_PX).toBe(INTERACT.hitTargetCssPx);
    expect(INTERACT.hitTargetCssPx).toBe(44);
    expect(INTERACT.hitTargetLargeCssPx).toBe(56);
  });

  it('"큰 터치 타깃"(56px) 설정을 세 번째 인자로 받아 반영한다', () => {
    const pxPerUnit = 4;
    expect(hitRadius('cone', pxPerUnit, 56)).toBeCloseTo(56 / 2 / pxPerUnit, 10);
  });
});
