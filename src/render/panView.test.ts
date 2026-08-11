// 판 이동(§6.4 뷰포트). 줌과 이동이 **같은 범위 클램프**를 쓰는지가 핵심이다 —
// 두 곳에서 따로 자르면 확대해 놓고 밀었을 때만 판 밖으로 나가는 종류의 버그가 생긴다.
import { describe, expect, it } from 'vitest';
import { clampViewToCourt, panView, zoomAt, screenDeltaToWorld, type StageView } from './useStageMetrics.ts';
import { COURT_DEFS } from '../model/court.ts';
import { CHAIR } from '../core/constants.ts';

const def = COURT_DEFS.full;
const MARGIN = CHAIR.hullRadiusPx;

/** 2배로 확대한 창을 판 한가운데 둔다. */
function zoomed(factor = 2): StageView {
  return zoomAt({ x: 0, y: 0, w: def.vbW, h: def.vbH }, def, { x: def.vbW / 2, y: def.vbH / 2 }, factor);
}

describe('panView — 확대했을 때만 의미가 있다', () => {
  it('확대한 창을 민 만큼 옮긴다', () => {
    const v = zoomed();
    const moved = panView(v, def, { x: 40, y: -25 });
    expect(moved.x).toBeCloseTo(v.x + 40, 6);
    expect(moved.y).toBeCloseTo(v.y - 25, 6);
    expect(moved.w).toBe(v.w); // 이동은 배율을 건드리지 않는다
    expect(moved.h).toBe(v.h);
  });

  it('맞춤(100%) 에서는 여백만큼밖에 못 민다 — 판을 다 보고 있으니 갈 곳이 없다', () => {
    const fit: StageView = { x: 0, y: 0, w: def.vbW, h: def.vbH };
    expect(panView(fit, def, { x: 500, y: 500 }).x).toBeCloseTo(MARGIN, 6);
    expect(panView(fit, def, { x: -500, y: -500 }).x).toBeCloseTo(-MARGIN, 6);
  });

  it('아무리 밀어도 판을 잃어버리지 않는다', () => {
    const v = zoomed(3);
    const far = panView(v, def, { x: 99999, y: 99999 });
    expect(far.x).toBeCloseTo(def.vbW + MARGIN - v.w, 6);
    expect(far.y).toBeCloseTo(def.vbH + MARGIN - v.h, 6);
    const back = panView(v, def, { x: -99999, y: -99999 });
    expect(back.x).toBeCloseTo(-MARGIN, 6);
    expect(back.y).toBeCloseTo(-MARGIN, 6);
  });

  it('줌과 이동이 같은 범위를 쓴다', () => {
    // 줌이 스스로 자른 결과를 다시 자르면 달라지면 안 된다.
    const v = zoomAt({ x: 0, y: 0, w: def.vbW, h: def.vbH }, def, { x: 0, y: 0 }, 4);
    expect(clampViewToCourt(v, def)).toEqual(v);
  });
});

describe('화면 델타 → 월드 델타 (세로 화면 회전)', () => {
  it('돌아가지 않았으면 그대로다', () => {
    expect(screenDeltaToWorld({ rot: 0 }, 10, -4)).toEqual({ x: 10, y: -4 });
  });

  it('90° 돌아가 있으면 축이 바뀐다 — 화면에서 왼쪽으로 끌면 판도 왼쪽으로 가야 한다', () => {
    // 이 변환을 빠뜨리면 세로 태블릿에서 좌우로 끌었는데 판이 위아래로 움직인다.
    expect(screenDeltaToWorld({ rot: 90 }, 10, 0)).toEqual({ x: 0, y: -10 });
    expect(screenDeltaToWorld({ rot: 90 }, 0, 10)).toEqual({ x: 10, y: -0 });
  });
});
