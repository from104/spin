// 판 이동(§6.4 뷰포트). 줌과 이동이 **같은 범위 클램프**를 쓰는지가 핵심이다 —
// 두 곳에서 따로 자르면 확대해 놓고 밀었을 때만 판 밖으로 나가는 종류의 버그가 생긴다.
import { describe, expect, it } from 'vitest';
import { clampViewToCourt, panView, panViewByScreen, zoomAt, screenDeltaToWorld, type StageView } from './useStageMetrics.ts';
import { COURT_DEFS } from '../model/court.ts';
import { CHAIR, INTERACT } from '../core/constants.ts';

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

// §4.4 P2-1 — 키보드 팬(Ctrl+방향키)과 가장자리 자동 밀기가 **같은 환산**을 쓴다.
// 회전을 각자 다루면 세로 태블릿에서 한쪽만 축이 어긋난다.
describe('panViewByScreen — 화면 CSS px 로 창을 민다', () => {
  const M = (rot: 0 | 90, pxPerUnit: number) => ({ rot, pxPerUnit });

  it('배율로 나눈 만큼 창이 간다 — 확대할수록 같은 키가 월드에서는 조금 움직인다', () => {
    const v = zoomed(); // 2배
    // pxPerUnit 2 = 화면 64px 이 월드 32px.
    const moved = panViewByScreen(v, def, M(0, 2), 64, 0);
    expect(moved.x).toBeCloseTo(v.x + 32, 6);
    expect(moved.y).toBeCloseTo(v.y, 6);
    // 대조군 — 배율이 절반이면 같은 키가 두 배로 움직인다(화면 걸음이 고정이라는 뜻).
    expect(panViewByScreen(v, def, M(0, 1), 64, 0).x).toBeCloseTo(v.x + 64, 6);
  });

  it('부호는 "창이 키 방향으로 간다" — 오른쪽 키를 누르면 판의 오른쪽이 보인다', () => {
    const v = zoomed();
    expect(panViewByScreen(v, def, M(0, 1), 40, 0).x).toBeGreaterThan(v.x);
    expect(panViewByScreen(v, def, M(0, 1), -40, 0).x).toBeLessThan(v.x);
    expect(panViewByScreen(v, def, M(0, 1), 0, 40).y).toBeGreaterThan(v.y);
    expect(panViewByScreen(v, def, M(0, 1), 0, -40).y).toBeLessThan(v.y);
  });

  it('90° 돌아가 있으면 screenDeltaToWorld 를 지나 축이 바뀐다', () => {
    // 이 변환을 빠뜨리면 세로 태블릿에서 오른쪽 키가 판을 아래로 내려보낸다.
    const v = zoomed();
    const right = panViewByScreen(v, def, M(90, 1), 40, 0);
    expect(right.x).toBeCloseTo(v.x, 6); // 가로는 그대로
    expect(right.y).toBeCloseTo(v.y - 40, 6); // 화면 +x → 월드 −y
    const down = panViewByScreen(v, def, M(90, 1), 0, 40);
    expect(down.x).toBeCloseTo(v.x + 40, 6); // 화면 +y → 월드 +x
    expect(down.y).toBeCloseTo(v.y, 6);
  });

  it('돌아가지 않았으면 화면 축과 월드 축이 같다 (대조군)', () => {
    const v = zoomed();
    const right = panViewByScreen(v, def, M(0, 1), 40, 0);
    expect(right.x).toBeCloseTo(v.x + 40, 6);
    expect(right.y).toBeCloseTo(v.y, 6);
  });

  it('panView 와 같은 범위 클램프를 쓴다 — 아무리 밀어도 판을 잃지 않는다', () => {
    const v = zoomed(3);
    const far = panViewByScreen(v, def, M(0, 1), 99999, 99999);
    expect(far).toEqual(panView(v, def, { x: 99999, y: 99999 }));
  });

  it('배율이 0 이면(레이아웃 전) 아무 일도 하지 않는다 — Infinity 가 view 에 새지 않는다', () => {
    // jsdom·마운트 직후에는 getBoundingClientRect 가 전부 0 이라 pxPerUnit 이 0 이다.
    // 나누면 Infinity 가 들어가 판을 영영 잃는다.
    const v = zoomed();
    expect(panViewByScreen(v, def, M(0, 0), 64, 64)).toBe(v);
    expect(Number.isFinite(panViewByScreen(v, def, M(0, 0), 64, 64).x)).toBe(true);
  });

  it('걸음 상수는 히트 타깃보다 크다 — 한 번 눌러 움직인 것이 보여야 한다', () => {
    expect(INTERACT.keyPanStepCssPx).toBeGreaterThan(INTERACT.hitTargetCssPx);
  });
});
