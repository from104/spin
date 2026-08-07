// §10.7 computeMetrics/clientToWorld 왕복 검증(줌·팬 상태 포함, 8케이스) + zoomAt 스모크.
import { describe, expect, it } from 'vitest';
import { computeMetrics, clientToWorld, type StageView } from './useStageMetrics.ts';
import { zoomAt } from './useStageMetrics.ts';
import { COURT_DEFS } from '../model/court.ts';
import { CHAIR, INTERACT } from '../core/constants.ts';

function rect(left: number, top: number, width: number, height: number): DOMRect {
  return { left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) };
}

/** world → client 왜곡값. clientToWorld 의 역함수 — 이 파일 자체 테스트용 참조 구현. */
function worldToClient(m: ReturnType<typeof computeMetrics>, wx: number, wy: number): { cx: number; cy: number } {
  return { cx: m.offX + (wx - m.view.x) * m.pxPerUnit, cy: m.offY + (wy - m.view.y) * m.pxPerUnit };
}

describe('computeMetrics / clientToWorld 왕복', () => {
  const cases: Array<{ label: string; rect: DOMRect; view: StageView }> = [
    { label: '풀코트 정사각 스테이지, 줌1', rect: rect(0, 0, 800, 800), view: { x: 0, y: 0, w: 800, h: 500 } },
    { label: '풀코트 가로로 넓은 스테이지', rect: rect(0, 0, 1600, 500), view: { x: 0, y: 0, w: 800, h: 500 } },
    { label: '풀코트, 스테이지 오프셋(레일 84px)', rect: rect(84, 62, 1000, 700), view: { x: 0, y: 0, w: 800, h: 500 } },
    { label: 'iPad 11" 풀코트 실측(§6.4)', rect: rect(150, 62, 894, 700), view: { x: 0, y: 0, w: 800, h: 500 } },
    { label: '줌인 2배(중앙 팬)', rect: rect(0, 0, 1000, 700), view: { x: 200, y: 125, w: 400, h: 250 } },
    { label: '줌인 4배 + 팬(우하단 근처)', rect: rect(0, 0, 900, 600), view: { x: 500, y: 300, w: 200, h: 125 } },
    { label: '하프 코트, 세로로 긴 스테이지', rect: rect(20, 20, 500, 900), view: { x: 0, y: 0, w: 500, h: 425 } },
    { label: '하프 코트, 줌인 + 팬', rect: rect(0, 0, 700, 700), view: { x: 100, y: 80, w: 250, h: 212.5 } },
  ];

  it.each(cases)('$label', ({ rect: r, view }) => {
    const m = computeMetrics(r, view);
    const probes: Array<[number, number]> = [
      [r.left, r.top],
      [r.left + r.width, r.top + r.height],
      [r.left + r.width / 2, r.top + r.height / 2],
      [r.left + r.width * 0.25, r.top + r.height * 0.75],
    ];
    for (const [cx, cy] of probes) {
      const world = clientToWorld(m, cx, cy);
      const back = worldToClient(m, world.x, world.y);
      expect(back.cx).toBeCloseTo(cx, 6);
      expect(back.cy).toBeCloseTo(cy, 6);
    }
  });

  it("pxPerUnit 은 'meet'(가로/세로 중 더 작은 배율)을 쓴다", () => {
    // 가로로 훨씬 넓은 스테이지 — 세로가 병목이라 배율은 세로 기준이어야 한다.
    const m = computeMetrics(rect(0, 0, 4000, 500), { x: 0, y: 0, w: 800, h: 500 });
    expect(m.pxPerUnit).toBeCloseTo(1, 10);
  });

  it('xMidYMid 오프셋 — 남는 여백이 좌우/상하 균등 분배된다', () => {
    const m = computeMetrics(rect(0, 0, 1000, 500), { x: 0, y: 0, w: 800, h: 500 });
    // pxPerUnit=1, 남는 가로 200px 이 좌우 100씩
    expect(m.pxPerUnit).toBeCloseTo(1, 10);
    expect(m.offX).toBeCloseTo(100, 10);
    expect(m.offY).toBeCloseTo(0, 10);
  });
});

describe('zoomAt', () => {
  const def = COURT_DEFS.full;
  const base: StageView = { x: 0, y: 0, w: def.vbW, h: def.vbH };

  it('factor>1 은 확대(view 가 좁아진다)', () => {
    const v = zoomAt(base, def, { x: 400, y: 250 }, 2);
    expect(v.w).toBeLessThan(base.w);
    expect(v.h).toBeLessThan(base.h);
  });

  it('focus 점의 상대 위치를 유지한다(센터 고정 확대는 그대로 센터)', () => {
    const focus = { x: def.vbW / 2, y: def.vbH / 2 };
    const v = zoomAt(base, def, focus, 2);
    expect(v.x + v.w / 2).toBeCloseTo(focus.x, 6);
    expect(v.y + v.h / 2).toBeCloseTo(focus.y, 6);
  });

  it(`줌은 INTERACT.zoomMax(${INTERACT.zoomMax})를 넘지 않는다`, () => {
    let v = base;
    for (let i = 0; i < 20; i++) v = zoomAt(v, def, { x: 400, y: 250 }, 2);
    const zoom = def.vbW / v.w;
    expect(zoom).toBeLessThanOrEqual(INTERACT.zoomMax + 1e-9);
  });

  it(`줌은 INTERACT.zoomMin(${INTERACT.zoomMin}) 아래로 내려가지 않는다`, () => {
    let v = base;
    for (let i = 0; i < 5; i++) v = zoomAt(v, def, { x: 400, y: 250 }, 0.1);
    const zoom = def.vbW / v.w;
    expect(zoom).toBeGreaterThanOrEqual(INTERACT.zoomMin - 1e-9);
  });

  it(`view 는 코트를 ${CHAIR.hullRadiusPx}px 확장한 범위를 벗어나지 않는다`, () => {
    // 코너 쪽으로 마구 팬을 시도해도(포커스를 바깥으로) x,y 가 마진 밖으로 나가지 않는다.
    const v = zoomAt(base, def, { x: -1000, y: -1000 }, 3);
    expect(v.x).toBeGreaterThanOrEqual(-CHAIR.hullRadiusPx - 1e-6);
    expect(v.y).toBeGreaterThanOrEqual(-CHAIR.hullRadiusPx - 1e-6);
    expect(v.x + v.w).toBeLessThanOrEqual(def.vbW + CHAIR.hullRadiusPx + 1e-6);
    expect(v.y + v.h).toBeLessThanOrEqual(def.vbH + CHAIR.hullRadiusPx + 1e-6);
  });
});
