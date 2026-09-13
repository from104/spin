// 이동 앵커의 자리. 이 산수가 틀리면 앵커가 **화면 밖으로 나가 영영 못 잡는다** — 그리고 그
// 사고는 창을 그 크기로 만들어야만 보이므로 실기로 잡기 어렵다. 숫자로 재는 것은 숫자로 잰다.
import { describe, expect, it } from 'vitest';
import { moveAnchorPlacement } from './moveAnchorPlacement.ts';

const OPTS = { gapPx: 10, viewRadiusPx: 11, hitRadiusPx: 22 };
/** 넉넉한 무대 — 물림(clamp)이 끼어들지 않는 대조군이다. */
const STAGE = { left: 0, top: 0, right: 1000, bottom: 800 };

describe('moveAnchorPlacement', () => {
  it('기본은 상자 중앙 위 — 위 모서리에서 틈+보이는반지름 만큼 올라간다', () => {
    const p = moveAnchorPlacement({ left: 100, top: 200, right: 300, bottom: 260 }, STAGE, OPTS);
    expect(p.clientX, '가로는 상자의 한가운데').toBe(200);
    expect(p.clientY).toBe(200 - 21);
    expect(p.below).toBe(false);
  });

  it('위가 모자라면 중앙 아래로 뒤집는다 — 판정은 **잡히는 원**(22)이 잘리느냐다', () => {
    // top=30 → 위 자리는 y=9, 잡히는 원은 −13 까지 뻗어 무대 밖이다. 보이는 원(11)만 보면
    // 통과해 버리는 자리라, 이 한 줄이 "보이는데 안 잡힌다" 를 막는다.
    const p = moveAnchorPlacement({ left: 100, top: 30, right: 300, bottom: 90 }, STAGE, OPTS);
    expect(p.below).toBe(true);
    expect(p.clientY).toBe(90 + 21);
    expect(p.clientX, '뒤집혀도 가로는 여전히 한가운데').toBe(200);
  });

  it('경계 바로 위아래 — 22px 이 딱 들어가면 위에 남는다', () => {
    const fits = moveAnchorPlacement({ left: 0, top: 43, right: 100, bottom: 80 }, STAGE, OPTS);
    expect(fits.below, 'y=22, 잡히는 원의 위끝이 정확히 0 — 잘리지 않았다').toBe(false);
    const flips = moveAnchorPlacement({ left: 0, top: 42, right: 100, bottom: 80 }, STAGE, OPTS);
    expect(flips.below, '1px 만 더 올라가면 잘린다').toBe(true);
  });

  it('개체가 화면 밖으로 반쯤 나가 있어도 앵커는 무대 안에 남는다 — 중앙보다 잡히는 것이 먼저다', () => {
    const left = moveAnchorPlacement({ left: -400, top: 300, right: -100, bottom: 360 }, STAGE, OPTS);
    expect(left.clientX, '왼쪽으로 물린다').toBe(22);
    const right = moveAnchorPlacement({ left: 1100, top: 300, right: 1400, bottom: 360 }, STAGE, OPTS);
    expect(right.clientX, '오른쪽으로 물린다').toBe(978);
  });

  it('무대가 앵커보다 얇아도 NaN 이 아니다 — 위쪽 한계로 모인다', () => {
    const thin = { left: 0, top: 0, right: 30, bottom: 30 };
    const p = moveAnchorPlacement({ left: 0, top: 10, right: 30, bottom: 20 }, thin, OPTS);
    expect(Number.isFinite(p.clientX)).toBe(true);
    expect(Number.isFinite(p.clientY)).toBe(true);
  });
});
