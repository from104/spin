// 작도 도형의 **순수 규칙** (2026-08-14 기현 지시 · 2026-08-15 자유 삼각형).
//
// 이 파일이 도형 기능의 무게중심이다: 화면 코드(ShapeLayer·ShapeHandles·CourtStage 의 끌기)는
// 전부 여기 함수를 부르기만 하고 자기 산수를 갖지 않는다. 그래서 회전·크기·히트 판정이
// 어긋나는 사고는 여기서 잡히거나 어디서도 안 잡힌다.
import { describe, expect, it } from 'vitest';
import {
  SHAPE_DEFAULT_PX,
  SHAPE_HANDLE_GAP_PX,
  SHAPE_MAX_PX,
  SHAPE_MIN_PX,
  dragShapeHandle,
  makeShape,
  shapeContains,
  shapeHandlePoints,
  shapeHandlesFor,
  shapeSize,
  toLocal,
  triBBox,
  triPointsOf,
  trianglePoints,
} from './shape.ts';
import type { Shape, ShapeKind, TriPoints } from './shape.ts';
import type { ShapeId } from '../core/ids.ts';

const S = (over: Partial<Shape> = {}): Shape => ({
  id: 'sh_t' as ShapeId,
  kind: 'rect',
  x: 100,
  y: 100,
  w: 200,
  h: 100,
  rot: 0,
  ...over,
});

/** 삼각형 하나. `pts` 를 안 주면 한 변 `w` 인 정삼각형이다(모델의 폴백과 같은 규약). */
const T = (over: Partial<Shape> = {}): Shape => S({ kind: 'triangle', w: 200, h: 200, ...over });

/** 타원 하나. **가로·세로 손잡이를 아직 쓰는 유일한 도형**이라, 그 규칙을 재는 테스트는
 *  2026-08-15(사각형이 대각 꼭짓점으로 바뀜) 이후 전부 이쪽으로 옮겨 왔다. */
const E = (over: Partial<Shape> = {}): Shape => S({ kind: 'ellipse', ...over });

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

describe('히트 판정 — 보이는 것을 짚으면 잡힌다', () => {
  it('사각형: 안·모서리·밖', () => {
    const s = S();
    expect(shapeContains(s, { x: 100, y: 100 })).toBe(true);
    expect(shapeContains(s, { x: 199, y: 149 })).toBe(true); // 모서리 바로 안
    expect(shapeContains(s, { x: 201, y: 100 })).toBe(false);
    expect(shapeContains(s, { x: 100, y: 151 })).toBe(false);
  });

  it('타원: 네 꼭짓점은 **밖**이다 — 사각형과 같은 판정을 쓰고 있으면 여기서 걸린다', () => {
    const s = S({ kind: 'ellipse' });
    expect(shapeContains(s, { x: 100, y: 100 })).toBe(true);
    expect(shapeContains(s, { x: 199, y: 100 })).toBe(true); // 장축 끝
    expect(shapeContains(s, { x: 100, y: 149 })).toBe(true); // 단축 끝
    // 상자의 우하단 꼭짓점 — 사각형이면 안, 타원이면 밖.
    expect(shapeContains(s, { x: 199, y: 149 })).toBe(false);
  });

  it('삼각형: 무게중심은 안, 상자의 위 모서리는 밖', () => {
    const s = T();
    expect(shapeContains(s, { x: 100, y: 100 })).toBe(true);
    // 위쪽 상자 모서리 — 삼각형은 위가 뾰족해서 밖이다.
    expect(shapeContains(s, { x: 190, y: 20 })).toBe(false);
  });

  it('★ 감김이 뒤집힌 삼각형도 판정된다 — 시계방향을 가정하면 도형이 유령이 된다', () => {
    const cw: TriPoints = [
      { x: 0, y: -60 },
      { x: -60, y: 40 },
      { x: 60, y: 40 },
    ];
    // 같은 삼각형, 순서만 뒤집었다(반시계). 눈에 보이는 도형은 한 픽셀도 다르지 않다.
    const ccw: TriPoints = [cw[0], cw[2], cw[1]];
    expect(shapeContains(T({ pts: cw }), { x: 100, y: 100 })).toBe(true);
    expect(shapeContains(T({ pts: ccw }), { x: 100, y: 100 })).toBe(true);
    // 밖도 양쪽 다 밖이다 — "전부 안" 으로 뭉개서 통과한 것이 아니다.
    expect(shapeContains(T({ pts: cw }), { x: 100, y: 200 })).toBe(false);
    expect(shapeContains(T({ pts: ccw }), { x: 100, y: 200 })).toBe(false);
  });

  it('★ 회전한 도형도 정확히 판정된다 — 회전을 무시하면 여기서 갈린다', () => {
    const s = S({ w: 200, h: 40, rot: 90 });
    // 90° 돌면 가로로 길던 것이 세로로 길어진다.
    expect(shapeContains(s, { x: 100, y: 190 })).toBe(true);
    expect(shapeContains(s, { x: 190, y: 100 })).toBe(false);
    // 대조군: 안 돌린 같은 도형은 정반대다.
    const flat = S({ w: 200, h: 40, rot: 0 });
    expect(shapeContains(flat, { x: 100, y: 190 })).toBe(false);
    expect(shapeContains(flat, { x: 190, y: 100 })).toBe(true);
  });

  it('toLocal 은 회전의 역이다 — 왕복하면 제자리다', () => {
    const s = S({ rot: 37 });
    const p = { x: 240, y: -60 };
    const q = toLocal(s, p);
    const rad = (s.rot * Math.PI) / 180;
    const back = {
      x: s.x + q.x * Math.cos(rad) - q.y * Math.sin(rad),
      y: s.y + q.x * Math.sin(rad) + q.y * Math.cos(rad),
    };
    expect(back.x).toBeCloseTo(p.x, 9);
    expect(back.y).toBeCloseTo(p.y, 9);
  });
});

// ── 자유 삼각형 (기현 지시 2026-08-15) ────────────────────────────────────────────────
// *"앵커는 4개 : 회전용 1개, 중심에서 꼭지점 사이의 거리 3개. 어떤 모양의 삼각형이든."*
// 2026-08-14 의 '정삼각형 유지' 결정을 뒤집은 자리라, 옛 계약(두 변이 함께 간다)을 재던
// 테스트는 여기서 **정반대**를 재는 테스트로 바뀌었다.
describe('자유 삼각형 — 모양의 출처는 꼭짓점이다', () => {
  it('shapeSize 는 꼭짓점의 경계상자다 — 저장된 w/h 를 안 믿는다', () => {
    const pts: TriPoints = [
      { x: 0, y: -40 },
      { x: -30, y: 20 },
      { x: 90, y: 20 },
    ];
    // w/h 에 엉뚱한 값을 박아 둬도 화면은 꼭짓점을 따른다.
    expect(shapeSize(T({ pts, w: 999, h: 7 }))).toEqual({ w: 120, h: 60 });
    // 대조군: 사각형·타원은 저장값 그대로다.
    expect(shapeSize(S({ kind: 'rect', w: 200, h: 80 }))).toEqual({ w: 200, h: 80 });
    expect(shapeSize(S({ kind: 'ellipse', w: 200, h: 80 }))).toEqual({ w: 200, h: 80 });
  });

  it('pts 가 없으면 **w 를 한 변으로 하는 정삼각형**이다 — 옛 저장본 폴백', () => {
    const p = triPointsOf(T({ w: 120, h: 120 }));
    expect(dist(p[0], p[1])).toBeCloseTo(120, 6);
    expect(dist(p[1], p[2])).toBeCloseTo(120, 6);
    expect(dist(p[2], p[0])).toBeCloseTo(120, 6);
    // ⚠️ min(w,h) 가 아니라 w 다. min 이면 이사 온 삼각형이 13.4% 작아진다.
    expect(triPointsOf(T({ w: 120, h: 60 }))).toEqual(trianglePoints(120));
  });

  it('trianglePoints: 세 변이 같고 무게중심이 원점이다 — 꼭짓점 산수의 대조군', () => {
    const p = trianglePoints(120);
    expect(dist(p[0], p[1])).toBeCloseTo(120, 6);
    expect(dist(p[1], p[2])).toBeCloseTo(120, 6);
    expect(dist(p[2], p[0])).toBeCloseTo(120, 6);
    // 무게중심이 원점이다 — 회전축이 여기라야 제자리에서 도는 것으로 보인다.
    expect((p[0].x + p[1].x + p[2].x) / 3).toBeCloseTo(0, 9);
    expect((p[0].y + p[1].y + p[2].y) / 3).toBeCloseTo(0, 9);
  });

  it('삼각형만 넷이다 — 사각형·타원은 대각 둘 + 회전으로 같다', () => {
    expect(shapeHandlesFor('triangle')).toEqual(['v0', 'v1', 'v2', 'rotate']);
    expect(shapeHandlesFor('rect')).toEqual(['c0', 'c1', 'rotate']);
    expect(shapeHandlesFor('ellipse')).toEqual(['c0', 'c1', 'rotate']);
  });

  it('꼭짓점 손잡이는 **꼭짓점 그 자리**에 선다 — 오프셋이 있으면 잡는 순간 도형이 튄다', () => {
    const s = T({ w: 200, h: 200 });
    const pts = shapeHandlePoints(s);
    const local = triPointsOf(s);
    expect(pts.v0!.x).toBeCloseTo(s.x + local[0].x, 9);
    expect(pts.v0!.y).toBeCloseTo(s.y + local[0].y, 9);
    expect(pts.v2!.x).toBeCloseTo(s.x + local[2].x, 9);
  });

  /** 극단적인 모양까지 포함한 시험대. 회전 손잡이 규칙은 이 전부에서 성립해야 한다. */
  const SHAPES: Array<[string, Shape]> = [
    ['정삼각형(기본)', T({ w: 200, h: 200 })],
    ['정삼각형(작은 것)', T({ w: 60, h: 60 })],
    ['위가 뾰족한 이등변', T({ pts: [{ x: 0, y: -90 }, { x: -70, y: 45 }, { x: 70, y: 45 }] })],
    ['한 꼭짓점만 멀리(길쭉)', T({ pts: [{ x: 293.3, y: 0 }, { x: -146.7, y: -30 }, { x: -146.7, y: 30 }] })],
    ['한 각 174°(납작)', T({ pts: [{ x: -150, y: 10 }, { x: 150, y: 10 }, { x: 0, y: -20 }] })],
  ];

  it('★ 회전 손잡이가 어느 꼭짓점과도 안 겹친다 — 겹치면 하나를 영영 못 잡는다', () => {
    // 기본 정삼각형은 **위쪽에 꼭짓점이 있다.** 회전 손잡이를 "언제나 위" 로 두면 여기서 겹친다.
    for (const [name, s] of SHAPES) {
      const p = shapeHandlePoints(s);
      // 잡는 원의 반지름이 22 CSS px 이다 — 중심 간 거리가 그보다 넉넉해야 한다.
      expect(dist(p.rotate!, p.v0!), `${name}: 회전 손잡이가 v0 에 겹친다`).toBeGreaterThanOrEqual(44);
      expect(dist(p.rotate!, p.v1!), `${name}: 회전 손잡이가 v1 에 겹친다`).toBeGreaterThanOrEqual(44);
      expect(dist(p.rotate!, p.v2!), `${name}: 회전 손잡이가 v2 에 겹친다`).toBeGreaterThanOrEqual(44);
    }
  });

  it('★ 회전 손잡이가 **도형에서 멀리 떨어지지 않는다** (기현 신고 2026-08-15)', () => {
    // 옛 규칙은 "가장 먼 꼭짓점 + 한 뼘" 이었다. 한쪽만 길쭉한 삼각형에서는 정작 좁은 쪽인데도
    // 그만큼 밀려나 손잡이가 허공에 떴다(실측: 길쭉 309px · 납작 166px).
    for (const [name, s] of SHAPES) {
      const p = triPointsOf(s);
      const h = shapeHandlePoints(s);
      const maxR = Math.max(...p.map((q) => Math.hypot(q.x, q.y)));
      const at = Math.hypot(h.rotate!.x - s.x, h.rotate!.y - s.y);
      // 옛 규칙(maxR + 16)보다 반드시 가깝다 — 작은 도형은 이격 보장 때문에 조금 멀어질 수
      // 있으므로 "옛 규칙 이하" 로 재지 않고, **도형이 클수록 이득이 크다** 는 쪽을 못박는다.
      if (maxR > 100) {
        expect(at, `${name}: 회전 손잡이가 여전히 멀다`).toBeLessThan(maxR * 0.75);
      }
      // 어떤 모양이든 절대 한도 — 코트 세로(525)의 4분의 1을 넘어가면 그것은 판 위의 미아다.
      expect(at, `${name}: 회전 손잡이가 판을 가로질렀다`).toBeLessThan(130);
    }
  });

  it('회전 손잡이는 **그 방향의 변 바로 바깥**이다 — 안에 있으면 면에 가려 안 보인다', () => {
    const s = T({ w: 200, h: 200 });
    const h = shapeHandlePoints(s);
    // 손잡이가 도형 안이면 안 된다(면이 반투명이라 흰 점이 묻힌다).
    expect(shapeContains(s, h.rotate!)).toBe(false);
    // 정삼각형이면 그 방향의 변까지 거리는 내접원 반지름(한 변/(2√3))이다.
    const inradius = 200 / (2 * Math.sqrt(3));
    const at = Math.hypot(h.rotate!.x - s.x, h.rotate!.y - s.y);
    expect(at).toBeCloseTo(inradius + SHAPE_HANDLE_GAP_PX, 6);
  });

  it('★ 꼭짓점 하나를 끌면 **나머지 둘은 화면에서 안 움직인다**', () => {
    const s = T({ w: 200, h: 200 });
    const before = shapeHandlePoints(s);
    const next = dragShapeHandle(s, 'v0', { x: s.x + 150, y: s.y - 30 });
    const after = shapeHandlePoints(next);
    // 무게중심이 따라 움직였으므로 중심(x,y)은 바뀐다 — 그런데도 두 꼭짓점의 **월드 좌표**는
    // 그대로여야 한다. 이 둘을 동시에 만족시키는 것이 recenterTri 다.
    expect(next.x).not.toBeCloseTo(s.x, 6);
    expect(after.v1!.x).toBeCloseTo(before.v1!.x, 6);
    expect(after.v1!.y).toBeCloseTo(before.v1!.y, 6);
    expect(after.v2!.x).toBeCloseTo(before.v2!.x, 6);
    expect(after.v2!.y).toBeCloseTo(before.v2!.y, 6);
    // 끈 꼭짓점은 포인터 자리에 온다.
    expect(after.v0!.x).toBeCloseTo(s.x + 150, 6);
    expect(after.v0!.y).toBeCloseTo(s.y - 30, 6);
  });

  it('무게중심이 언제나 원점이다 — 회전축이 새어 나가면 제자리 회전이 깨진다', () => {
    let s = T({ w: 200, h: 200 });
    s = dragShapeHandle(s, 'v0', { x: s.x + 150, y: s.y - 30 });
    s = dragShapeHandle(s, 'v1', { x: s.x - 40, y: s.y + 120 });
    const p = triPointsOf(s);
    expect((p[0].x + p[1].x + p[2].x) / 3).toBeCloseTo(0, 9);
    expect((p[0].y + p[1].y + p[2].y) / 3).toBeCloseTo(0, 9);
    // w/h 도 따라 갱신된다 — 크기 표시가 도형과 갈라지면 안 된다.
    expect(s.w).toBeCloseTo(triBBox(p).w, 9);
    expect(s.h).toBeCloseTo(triBBox(p).h, 9);
  });

  it('★ 한 각이 120° 이상인 납작한 삼각형도 만들어진다 — 이것이 "어떤 모양이든" 의 뜻이다', () => {
    // 반지름 셋 + 120° 고정 방향(페르마 점) 좌표계로는 **원리적으로 표현할 수 없는** 삼각형이다.
    let s = T({ w: 200, h: 200 });
    s = dragShapeHandle(s, 'v0', { x: s.x - 150, y: s.y });
    s = dragShapeHandle(s, 'v1', { x: s.x + 150, y: s.y });
    s = dragShapeHandle(s, 'v2', { x: s.x, y: s.y + 20 });
    const p = triPointsOf(s);
    // 가장 큰 각을 잰다.
    const ang = (a: number, b: number, c: number) => {
      const A = p[a]!;
      const B = p[b]!;
      const C = p[c]!;
      const u = { x: A.x - B.x, y: A.y - B.y };
      const v = { x: C.x - B.x, y: C.y - B.y };
      return (Math.acos((u.x * v.x + u.y * v.y) / (Math.hypot(u.x, u.y) * Math.hypot(v.x, v.y))) * 180) / Math.PI;
    };
    const widest = Math.max(ang(0, 1, 2), ang(1, 2, 0), ang(2, 0, 1));
    expect(widest, '납작한 삼각형이 안 만들어졌다 — 자유 이동이 아니라 반지름만 움직이고 있다').toBeGreaterThan(120);
    // 그리고 그 도형은 여전히 자기 안을 짚으면 잡힌다.
    expect(shapeContains(s, { x: s.x, y: s.y })).toBe(true);
  });

  it('한 줄로 서는 이동은 **거부**한다 — 넓이 0 이면 도형이 화면에서 사라진다', () => {
    // ⚠️ 밑변을 중심에서 멀리 둔다. 원점 **바로 옆**에 끌어다 놓으면 최소 반지름 클램프
    //    (12px)가 그 점을 선 밖으로 밀어내 버려, 무너지는 이동이 애초에 만들어지지 않는다
    //    — 첫 판에서 그렇게 짜서 "거부됐다" 가 아니라 "무너뜨리지도 못했다" 를 재고 있었다.
    const flat = T({
      pts: [
        { x: -100, y: 20 },
        { x: 100, y: 20 },
        { x: 0, y: -40 },
      ],
    });
    // v2 를 나머지 둘을 잇는 선 위로 끌면 삼각형이 무너진다 — 그 이동은 통째로 무시된다.
    const next = dragShapeHandle(flat, 'v2', { x: flat.x, y: flat.y + 20 });
    expect(next).toBe(flat);
    // 대조군: 같은 방향이라도 선에서 벗어나면 받아들인다.
    expect(dragShapeHandle(flat, 'v2', { x: flat.x, y: flat.y + 60 })).not.toBe(flat);
  });

  it('꼭짓점의 **거리만** 가둔다 — 방향은 자유다', () => {
    const s = T({ w: 200, h: 200 });
    const far = dragShapeHandle(s, 'v0', { x: s.x + 99999, y: s.y });
    // ⚠️ 재는 것은 **월드 좌표**다. 국소 좌표로 재면 안 맞는다 — 클램프는 끌던 순간의 중심을
    //    기준으로 걸리고, 그 뒤 재중심(recenterTri)이 원점을 옮기기 때문이다.
    const at = shapeHandlePoints(far).v0!;
    expect(at.x).toBeCloseTo(s.x + SHAPE_MAX_PX / 2, 6);
    // 방향은 그대로 오른쪽이다(거리만 잘렸다).
    expect(at.y).toBeCloseTo(s.y, 6);
  });

  it('★ 회전 손잡이를 잡는 순간 도형이 안 튄다 — 삼각형은 손잡이가 위에 없다', () => {
    const s = T({ w: 200, h: 200, rot: 40 });
    const at = shapeHandlePoints(s).rotate!;
    // 손잡이를 잡고 **그 자리 그대로** 두면 각이 그대로여야 한다.
    expect(dragShapeHandle(s, 'rotate', at).rot).toBeCloseTo(40, 6);
  });
});

describe('손잡이 — 자리와 끌기', () => {
  it('셋이 서로 겹치지 않는다 — 겹치면 하나를 영영 못 잡는다', () => {
    const pts = shapeHandlePoints(E());
    // 잡는 원의 반지름이 22 CSS px 이다 — 중심 간 거리가 그보다 넉넉해야 한다.
    expect(dist(pts.c0!, pts.c1!)).toBeGreaterThan(44);
    expect(dist(pts.c0!, pts.rotate!)).toBeGreaterThan(44);
    expect(dist(pts.c1!, pts.rotate!)).toBeGreaterThan(44);
  });

  it('타원도 대각 둘이다 — 손잡이가 **경계상자 모서리**에 선다(면 밖이라 안 가린다)', () => {
    const s = E({ w: 200, h: 100 });
    const pts = shapeHandlePoints(s);
    expect(pts.c0).toEqual({ x: s.x - 100, y: s.y - 50 });
    expect(pts.c1).toEqual({ x: s.x + 100, y: s.y + 50 });
    // 상자 모서리는 타원에 안 닿는다 — 옛 가로·세로 손잡이가 한 뼘 밀려나 있던 이유가
    // 여기서는 저절로 성립한다.
    expect(shapeContains(s, pts.c1!)).toBe(false);
    // 회전 손잡이는 위쪽이고 도형 밖이다.
    expect(pts.rotate!.y).toBeLessThan(s.y - s.h / 2);
  });

  it('★ 회전하면 손잡이도 함께 돈다 — 그림과 히트가 같은 함수를 쓰는 근거', () => {
    const s = E({ w: 200, h: 100, rot: 90 });
    const pts = shapeHandlePoints(s);
    // 90° 돌면 국소 (+100,+50) 인 우하 모서리가 월드에서는 (−50,+100) 쪽으로 간다.
    expect(pts.c1!.x).toBeCloseTo(s.x - 50, 6);
    expect(pts.c1!.y).toBeCloseTo(s.y + 100, 6);
  });

  it('타원의 크기도 **마주 보는 모서리 고정**이다 — 사각형과 같은 규칙', () => {
    const s = E({ w: 200, h: 100 });
    const before = shapeHandlePoints(s);
    const next = dragShapeHandle(s, 'c1', { x: s.x + 300, y: s.y + 120 });
    const after = shapeHandlePoints(next);
    expect(after.c0!.x).toBeCloseTo(before.c0!.x, 9);
    expect(after.c0!.y).toBeCloseTo(before.c0!.y, 9);
    expect(after.c1!.x).toBeCloseTo(s.x + 300, 9);
    // 중심이 따라 움직인다 — 옛 '중심 고정' 규칙이 남아 있으면 여기서 걸린다.
    expect(next.x).not.toBeCloseTo(s.x, 6);
  });

  it('상·하한을 넘지 않는다 — 0 폭 도형은 집을 수가 없다', () => {
    const s = E();
    expect(dragShapeHandle(s, 'c1', { x: s.x - 999, y: s.y - 999 }).w).toBe(SHAPE_MIN_PX);
    expect(dragShapeHandle(s, 'c1', { x: s.x + 99999, y: s.y + 99999 }).w).toBe(SHAPE_MAX_PX);
  });

  it('회전 손잡이는 중심→포인터 각을 그대로 쓴다. 위쪽이 0° 다', () => {
    const s = E();
    expect(dragShapeHandle(s, 'rotate', { x: s.x, y: s.y - 100 }).rot).toBeCloseTo(0, 6);
    expect(dragShapeHandle(s, 'rotate', { x: s.x + 100, y: s.y }).rot).toBeCloseTo(90, 6);
    expect(dragShapeHandle(s, 'rotate', { x: s.x, y: s.y + 100 }).rot).toBeCloseTo(180, 6);
    // 음수로 안 나온다 — 저장값이 -90 이면 정화기·비교가 매번 다른 답을 낸다.
    expect(dragShapeHandle(s, 'rotate', { x: s.x - 100, y: s.y }).rot).toBeCloseTo(270, 6);
  });

  it('회전은 크기를 안 건드리고, 크기는 회전을 안 건드린다', () => {
    const s = E({ rot: 30 });
    const rotated = dragShapeHandle(s, 'rotate', { x: 400, y: 400 });
    expect(rotated.w).toBe(s.w);
    expect(rotated.h).toBe(s.h);
    const resized = dragShapeHandle(s, 'c1', { x: 400, y: 400 });
    expect(resized.rot).toBe(s.rot);
  });

  it('삼각형에서 회전은 꼭짓점을 안 건드린다 — 도는 것이지 모양이 바뀌는 것이 아니다', () => {
    const s = T({ w: 200, h: 200 });
    const rotated = dragShapeHandle(s, 'rotate', { x: 400, y: 400 });
    expect(triPointsOf(rotated)).toEqual(triPointsOf(s));
    expect(rotated.x).toBe(s.x);
    expect(rotated.y).toBe(s.y);
  });
});

describe('makeShape — 놓았을 때', () => {
  it('찍은 자리를 중심으로, 각도 0 으로 선다', () => {
    for (const kind of ['ellipse', 'triangle', 'rect'] as ShapeKind[]) {
      const s = makeShape('sh_a' as ShapeId, kind, { x: 300, y: 200 });
      expect(s).toMatchObject({ kind, x: 300, y: 200, w: SHAPE_DEFAULT_PX, rot: 0 });
      // 놓자마자 자기 중심이 자기 안이어야 한다 — 아니면 놓고 나서 집을 수가 없다.
      expect(shapeContains(s, { x: 300, y: 200 })).toBe(true);
    }
  });

  it('새 삼각형은 **정삼각형**에서 시작하고, h 는 한 변이 아니라 실제 높이다', () => {
    const s = makeShape('sh_a' as ShapeId, 'triangle', { x: 300, y: 200 });
    const p = triPointsOf(s);
    expect(dist(p[0], p[1])).toBeCloseTo(SHAPE_DEFAULT_PX, 6);
    expect(s.w).toBeCloseTo(SHAPE_DEFAULT_PX, 6);
    // 정삼각형의 높이는 0.866·한변이다. 옛 모델은 여기에 한 변을 적어 크기 표시가 거짓말했다.
    expect(s.h).toBeCloseTo((SHAPE_DEFAULT_PX * Math.sqrt(3)) / 2, 6);
    // 대조군: 사각형·타원은 여전히 w === h 다.
    expect(makeShape('sh_b' as ShapeId, 'rect', { x: 0, y: 0 }).h).toBe(SHAPE_DEFAULT_PX);
  });
});
// ── 사각형 대각 꼭짓점 (기현 지시 2026-08-15) ──────────────────────────────────────────
// *"사각형도 2개의 대각에 위치한 2개의 꼭지점으로 크기 정할 수 있게."*
// 타원의 가로·세로 손잡이(중심 고정)와 **정반대 규칙**이다: 여기서는 끌지 않은 대각이 고정이다.
describe('사각형 — 대각 꼭짓점 둘로 상자를 그린다', () => {
  it('손잡이가 상자의 **모서리 그 자리**에 선다 — 오프셋이 있으면 잡는 순간 튄다', () => {
    const s = S({ w: 200, h: 100 });
    const h = shapeHandlePoints(s);
    expect(h.c0).toEqual({ x: s.x - 100, y: s.y - 50 }); // 좌상
    expect(h.c1).toEqual({ x: s.x + 100, y: s.y + 50 }); // 우하
    // 손잡이는 셋뿐이다 — 모서리 넷을 다 내면 표적이 다섯이 된다.
    expect(Object.keys(h).sort()).toEqual(['c0', 'c1', 'rotate']);
  });

  it('★ 한 모서리를 끌면 **마주 보는 모서리가 제자리에 남는다**', () => {
    const s = S({ w: 200, h: 100 });
    const before = shapeHandlePoints(s);
    const next = dragShapeHandle(s, 'c1', { x: s.x + 300, y: s.y + 20 });
    const after = shapeHandlePoints(next);
    // 끌지 않은 좌상 모서리는 월드에서 한 픽셀도 안 움직인다.
    expect(after.c0!.x).toBeCloseTo(before.c0!.x, 9);
    expect(after.c0!.y).toBeCloseTo(before.c0!.y, 9);
    // 끈 모서리는 포인터 자리에 온다.
    expect(after.c1!.x).toBeCloseTo(s.x + 300, 9);
    expect(after.c1!.y).toBeCloseTo(s.y + 20, 9);
    // 중심은 두 모서리의 한가운데로 다시 잡힌다 — 회전축이 상자 밖으로 새면 안 된다.
    expect(next.x).toBeCloseTo((before.c0!.x + s.x + 300) / 2, 9);
    expect(next.y).toBeCloseTo((before.c0!.y + s.y + 20) / 2, 9);
  });

  it('반대쪽(c0)을 끌어도 대칭으로 동작한다 — 한쪽만 배선하고 끝내지 않았는지', () => {
    const s = S({ w: 200, h: 100 });
    const before = shapeHandlePoints(s);
    const next = dragShapeHandle(s, 'c0', { x: s.x - 300, y: s.y - 20 });
    const after = shapeHandlePoints(next);
    expect(after.c1!.x).toBeCloseTo(before.c1!.x, 9);
    expect(after.c1!.y).toBeCloseTo(before.c1!.y, 9);
    expect(after.c0!.x).toBeCloseTo(s.x - 300, 9);
  });

  it('★ 회전한 사각형도 어긋나지 않는다 — 회전 전 좌표계에서 상자를 잡는다', () => {
    const s = S({ w: 200, h: 100, rot: 37 });
    const before = shapeHandlePoints(s);
    // 회전한 상자에서 우하 모서리를 바깥으로 민다(뒤집히지 않는 방향).
    const target = { x: before.c1!.x + 60, y: before.c1!.y + 40 };
    const next = dragShapeHandle(s, 'c1', target);
    const after = shapeHandlePoints(next);
    expect(next.rot, '크기 조정이 회전을 건드렸다').toBe(37);
    expect(after.c0!.x).toBeCloseTo(before.c0!.x, 9);
    expect(after.c0!.y).toBeCloseTo(before.c0!.y, 9);
    expect(after.c1!.x).toBeCloseTo(target.x, 9);
    expect(after.c1!.y).toBeCloseTo(target.y, 9);
  });

  it('★ 반대편을 지나쳐 끌어도 **뒤집히지 않는다** — 손잡이 없는 대각이 생기면 안 된다', () => {
    // 그림 도구는 보통 뒤집기를 허용하지만, 여기 손잡이는 대각 **둘뿐**이다. 한 축만 부호가
    // 뒤집히면 고정 모서리가 손잡이 없는 반대 대각(우상/좌하)으로 가서 영영 못 잡는 자리가 된다.
    const s = S({ w: 200, h: 100, rot: 37 });
    const fixed = shapeHandlePoints(s).c0!;
    // 고정 모서리를 한참 지나쳐 끈다 — 그래도 c0 은 c0 자리에 남는다.
    const next = dragShapeHandle(s, 'c1', { x: fixed.x - 300, y: fixed.y - 200 });
    const after = shapeHandlePoints(next);
    expect(after.c0!.x, '뒤집히면서 고정 모서리가 움직였다').toBeCloseTo(fixed.x, 9);
    expect(after.c0!.y).toBeCloseTo(fixed.y, 9);
    // 최소 크기로 접히되 상자는 여전히 c0 → c1 방향이다.
    expect(next.w).toBe(SHAPE_MIN_PX);
    expect(next.h).toBe(SHAPE_MIN_PX);
    expect(next.rot).toBe(37);
  });

  it('상·하한을 넘지 않고, **부호를 보존한다** — 잃으면 모서리가 반대편으로 튄다', () => {
    const s = S({ w: 200, h: 100 });
    // 우하를 좌상 자리로 끌면(뒤집기) 최소 크기로 접히되 방향은 유지된다.
    const tiny = dragShapeHandle(s, 'c1', { x: s.x - 100, y: s.y - 50 });
    expect(tiny.w).toBe(SHAPE_MIN_PX);
    expect(tiny.h).toBe(SHAPE_MIN_PX);
    const huge = dragShapeHandle(s, 'c1', { x: s.x + 99999, y: s.y + 99999 });
    expect(huge.w).toBe(SHAPE_MAX_PX);
    expect(huge.h).toBe(SHAPE_MAX_PX);
    // 최소로 접혀도 좌상 모서리는 여전히 제자리다.
    const c0 = shapeHandlePoints(s).c0!;
    expect(shapeHandlePoints(tiny).c0!.x).toBeCloseTo(c0.x, 9);
    expect(shapeHandlePoints(tiny).c0!.y).toBeCloseTo(c0.y, 9);
  });

  it('★ 회전 손잡이가 대각 손잡이와 안 겹친다 — 납작한 상자에서 좌상이 코앞이다', () => {
    for (const s of [S({ w: 200, h: 100 }), S({ w: 24, h: 24 }), S({ w: 30, h: 400 }), S({ w: 900, h: 26 })]) {
      const h = shapeHandlePoints(s);
      expect(dist(h.rotate!, h.c0!), `${s.w}×${s.h}: 회전이 좌상에 겹친다`).toBeGreaterThanOrEqual(44);
      expect(dist(h.rotate!, h.c1!), `${s.w}×${s.h}: 회전이 우하에 겹친다`).toBeGreaterThanOrEqual(44);
    }
  });

  it('회전은 상자를 안 건드린다', () => {
    const s = S({ w: 200, h: 100 });
    const r = dragShapeHandle(s, 'rotate', { x: 400, y: 400 });
    expect({ w: r.w, h: r.h, x: r.x, y: r.y }).toEqual({ w: s.w, h: s.h, x: s.x, y: s.y });
  });
});
