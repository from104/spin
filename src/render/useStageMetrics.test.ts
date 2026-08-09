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

// ── 표시 회전(§6.4 태블릿) ───────────────────────────────────────────────────────────────
import { rotForFit, screenDeltaToWorld, worldToClient as w2c } from './useStageMetrics.ts';
import type { StageRot } from './useStageMetrics.ts';

/** 위 rect() 헬퍼의 축약 — 원점이 0 인 상자. */
const rectOf = (w: number, h: number): DOMRect => rect(0, 0, w, h);

describe('rotForFit — 어느 방향이 더 크게 들어가는가', () => {
  const full: StageView = { x: 0, y: 0, w: 800, h: 500 }; // 1.6:1
  const half: StageView = { x: 0, y: 0, w: 500, h: 425 }; // 1.18:1

  it('가로로 긴 상자에서 풀 코트는 돌리지 않는다', () => {
    expect(rotForFit({ width: 1200, height: 700 }, full)).toBe(0);
  });

  it('세로로 긴 상자에서 풀 코트는 돌린다', () => {
    expect(rotForFit({ width: 750, height: 1100 }, full)).toBe(90);
  });

  it('⚠️ 거의 정사각형 상자에서는 돌려도 이득이 없어 돌리지 않는다', () => {
    // 실기 회귀: iPad 세로에서 도구·속성을 아래로 내리면 코트 영역이 865×870 이 된다.
    // "상자가 세로면 돌린다" 로 판정하면 여기서 1% 이득에 판이 통째로 뒤집힌다.
    expect(rotForFit({ width: 865, height: 870 }, full)).toBe(0);
  });

  it('⚠️ 하프 코트는 세로 상자에서도 이득이 작으면 안 돌린다', () => {
    // 하프(1.18:1)는 풀(1.6:1)보다 정사각형에 가까워 회전 이득이 훨씬 작다.
    // 코트마다 답이 다르다는 것이 "상자 모양만으로는 못 정한다" 는 근거다.
    expect(rotForFit({ width: 865, height: 870 }, half)).toBe(0);
    expect(rotForFit({ width: 700, height: 1200 }, half)).toBe(90);
  });

  it('돌린 쪽이 실제로 더 커질 때만 90 을 돌려준다', () => {
    // 판정과 결과가 어긋나지 않는지 — computeMetrics 로 직접 재서 대조한다.
    for (const rect of [
      { width: 1200, height: 700 },
      { width: 750, height: 1100 },
      { width: 865, height: 870 },
      { width: 400, height: 1600 },
    ]) {
      for (const view of [full, half]) {
        const decided = rotForFit(rect, view);
        const d = rectOf(rect.width, rect.height);
        const flat = computeMetrics(d, view, 0).pxPerUnit;
        const turned = computeMetrics(d, view, 90).pxPerUnit;
        if (decided === 90) expect(turned).toBeGreaterThan(flat);
      }
    }
  });

  it('0 크기(jsdom 초기 렌더)에서도 터지지 않고 0', () => {
    expect(rotForFit({ width: 0, height: 0 }, full)).toBe(0);
  });
});

describe('회전 상태의 clientToWorld ↔ worldToClient 왕복', () => {
  const views: StageView[] = [
    { x: 0, y: 0, w: 800, h: 500 }, // 풀
    { x: 0, y: 0, w: 500, h: 425 }, // 하프·플랫
    { x: -30, y: 12, w: 400, h: 250 }, // 줌·팬 상태
  ];
  const rots: StageRot[] = [0, 90];

  for (const rot of rots) {
    for (const view of views) {
      it(`rot=${rot} view=${view.w}×${view.h} 에서 월드→클라이언트→월드가 항등`, () => {
        const m = computeMetrics(rect(37, 19, 900, 1200), view, rot);
        for (const p of [
          { x: view.x, y: view.y },
          { x: view.x + view.w, y: view.y + view.h },
          { x: view.x + view.w / 3, y: view.y + view.h / 7 },
        ]) {
          const c = w2c(m, p.x, p.y);
          const back = clientToWorld(m, c.clientX, c.clientY);
          expect(back.x).toBeCloseTo(p.x, 6);
          expect(back.y).toBeCloseTo(p.y, 6);
        }
      });
    }
  }
});

describe('회전이 실제로 축을 바꾼다 (항등이면 회전이 아니다)', () => {
  const view: StageView = { x: 0, y: 0, w: 800, h: 500 };

  it('rot=90 이면 상자의 가로·세로가 뒤바뀐다', () => {
    // 세로로 긴 스테이지에 풀 코트(800×500)를 넣는다.
    const flat = computeMetrics(rect(0, 0, 600, 1000), view, 0);
    const turned = computeMetrics(rect(0, 0, 600, 1000), view, 90);
    // 안 돌리면 폭에 맞춰 600×375 — 높이의 62%가 빈다.
    expect(flat.pxPerUnit).toBeCloseTo(600 / 800, 6); // 0.75
    // 돌리면 상자가 500×800 이 되어 폭에 맞춰 600×960 — 화면을 거의 채운다.
    expect(turned.pxPerUnit).toBeCloseTo(600 / 500, 6); // 1.2
    expect(turned.pxPerUnit).toBeGreaterThan(flat.pxPerUnit * 1.5);
  });

  it('월드의 가로축이 화면의 세로축이 된다 — 풀 코트 두 골대가 위아래로 간다', () => {
    const m = computeMetrics(rect(0, 0, 500, 800), view, 90);
    const left = w2c(m, 25, 250); // 월드 왼쪽 골
    const right = w2c(m, 775, 250); // 월드 오른쪽 골
    expect(left.clientY).toBeLessThan(right.clientY); // 화면에서 위/아래로 갈린다
    expect(left.clientX).toBeCloseTo(right.clientX, 6); // 같은 세로선 위
  });

  it('하프 코트의 골(아래)이 화면 왼쪽으로 간다 — 시계방향이라는 계약', () => {
    // 반시계로 구현하면 오른쪽으로 가서 공격 방향이 오른→왼쪽이 된다(전술도 관례에 어긋남).
    const half: StageView = { x: 0, y: 0, w: 500, h: 425 };
    const m = computeMetrics(rect(0, 0, 400, 800), half, 90);
    const goal = w2c(m, 250, 400); // 골 라인(아래)
    const top = w2c(m, 250, 25); // 반대편(위)
    expect(goal.clientX).toBeLessThan(top.clientX);
  });
});

describe('screenDeltaToWorld — 화살표는 화면 기준이어야 한다(§7.5)', () => {
  it('회전이 없으면 그대로', () => {
    expect(screenDeltaToWorld({ rot: 0 }, 25, 0)).toEqual({ x: 25, y: 0 });
    expect(screenDeltaToWorld({ rot: 0 }, 0, 25)).toEqual({ x: 0, y: 25 });
  });

  it('rot=90 이면 화면 오른쪽(+x)이 월드 −y 가 된다', () => {
    // 이 매핑이 없으면 세로 화면에서 ArrowRight 가 개체를 아래로 내려보낸다.
    // -0 과 +0 은 toEqual 이 구분하므로 성분으로 비교한다.
    const right = screenDeltaToWorld({ rot: 90 }, 25, 0);
    expect(right.x).toBe(0);
    expect(right.y).toBe(-25);
    const down = screenDeltaToWorld({ rot: 90 }, 0, 25);
    expect(down.x).toBe(25);
    expect(down.y).toBeCloseTo(0, 10); // -0 이라 toBe(0) 은 Object.is 로 실패한다
  });

  it('화면 델타를 월드로 옮긴 뒤 다시 화면으로 그리면 원래 방향이다', () => {
    // 왕복으로 부호 실수를 잡는다 — 부호 하나만 틀려도 위 두 테스트는 통과할 수 있다.
    const view: StageView = { x: 0, y: 0, w: 800, h: 500 };
    const m = computeMetrics(rect(0, 0, 500, 800), view, 90);
    const start = { x: 400, y: 250 };
    const d = screenDeltaToWorld(m, 30, 0); // 화면에서 오른쪽으로 30
    const a = w2c(m, start.x, start.y);
    const b = w2c(m, start.x + d.x, start.y + d.y);
    expect(b.clientX).toBeGreaterThan(a.clientX); // 화면에서도 오른쪽
    expect(b.clientY).toBeCloseTo(a.clientY, 6);
  });
});
