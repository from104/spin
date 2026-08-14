// 작도 도형의 **순수 규칙** (2026-08-14 기현 지시).
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
  shapeSize,
  toLocal,
  trianglePoints,
} from './shape.ts';
import type { Shape, ShapeKind } from './shape.ts';
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

  it('정삼각형: 무게중심은 안, 상자의 아래 두 꼭짓점 바깥쪽은 밖', () => {
    const s = S({ kind: 'triangle', w: 200, h: 200 });
    expect(shapeContains(s, { x: 100, y: 100 })).toBe(true);
    // 위쪽 상자 모서리 — 삼각형은 위가 뾰족해서 밖이다.
    expect(shapeContains(s, { x: 190, y: 20 })).toBe(false);
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

describe('정삼각형은 정삼각형을 유지한다 (기현 결정)', () => {
  it('shapeSize 가 두 변을 짧은 쪽으로 접는다 — 저장값이 어긋나도 화면은 정삼각형이다', () => {
    expect(shapeSize(S({ kind: 'triangle', w: 200, h: 80 }))).toEqual({ w: 80, h: 80 });
    // 대조군: 사각형·타원은 안 접는다.
    expect(shapeSize(S({ kind: 'rect', w: 200, h: 80 }))).toEqual({ w: 200, h: 80 });
    expect(shapeSize(S({ kind: 'ellipse', w: 200, h: 80 }))).toEqual({ w: 200, h: 80 });
  });

  it('어느 손잡이를 끌어도 두 변이 함께 간다', () => {
    const t = S({ kind: 'triangle', w: 100, h: 100 });
    const byW = dragShapeHandle(t, 'width', { x: t.x + 120, y: t.y });
    expect(byW.w).toBe(byW.h);
    const byH = dragShapeHandle(t, 'height', { x: t.x, y: t.y + 120 });
    expect(byH.w).toBe(byH.h);
    // 같은 거리면 같은 결과 — 두 손잡이가 한 값을 민다.
    expect(byW.w).toBeCloseTo(byH.w, 9);
  });

  it('세 변의 길이가 실제로 같다 — 꼭짓점 산수의 대조군', () => {
    const p = trianglePoints(120);
    const d = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
    expect(d(p[0]!, p[1]!)).toBeCloseTo(120, 6);
    expect(d(p[1]!, p[2]!)).toBeCloseTo(120, 6);
    expect(d(p[2]!, p[0]!)).toBeCloseTo(120, 6);
    // 무게중심이 원점이다 — 회전축이 여기라야 제자리에서 도는 것으로 보인다.
    expect((p[0]!.x + p[1]!.x + p[2]!.x) / 3).toBeCloseTo(0, 9);
    expect((p[0]!.y + p[1]!.y + p[2]!.y) / 3).toBeCloseTo(0, 9);
  });
});

describe('손잡이 — 자리와 끌기', () => {
  it('셋이 서로 다른 변에 선다 — 겹치면 하나를 영영 못 잡는다', () => {
    const pts = shapeHandlePoints(S());
    const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
    // 잡는 원의 반지름이 22 CSS px 이다 — 중심 간 거리가 그보다 넉넉해야 한다.
    expect(dist(pts.width, pts.height)).toBeGreaterThan(44);
    expect(dist(pts.width, pts.rotate)).toBeGreaterThan(44);
    expect(dist(pts.height, pts.rotate)).toBeGreaterThan(44);
  });

  it('도형 **밖**에 선다 — 변 위에 얹으면 면을 가려 크기를 눈으로 못 잰다', () => {
    const s = S();
    const pts = shapeHandlePoints(s);
    expect(pts.width.x).toBeCloseTo(s.x + s.w / 2 + SHAPE_HANDLE_GAP_PX, 9);
    expect(pts.height.y).toBeCloseTo(s.y + s.h / 2 + SHAPE_HANDLE_GAP_PX, 9);
    expect(pts.rotate.y).toBeCloseTo(s.y - s.h / 2 - SHAPE_HANDLE_GAP_PX, 9);
  });

  it('★ 회전하면 손잡이도 함께 돈다 — 그림과 히트가 같은 함수를 쓰는 근거', () => {
    const pts = shapeHandlePoints(S({ w: 200, h: 100, rot: 90 }));
    // 90° 에서 '가로' 손잡이는 오른쪽이 아니라 **아래**로 간다.
    expect(pts.width.x).toBeCloseTo(100, 6);
    expect(pts.width.y).toBeCloseTo(100 + 100 + SHAPE_HANDLE_GAP_PX, 6);
  });

  it('크기는 **중심 고정**으로 바뀐다 — 중심이 움직이면 회전축이 흔들린다', () => {
    const s = S();
    const next = dragShapeHandle(s, 'width', { x: s.x + 300, y: s.y });
    expect(next.x).toBe(s.x);
    expect(next.y).toBe(s.y);
    expect(next.h).toBe(s.h); // 가로만 바뀐다
    expect(next.w).toBeGreaterThan(s.w);
  });

  it('상·하한을 넘지 않는다 — 0 폭 도형은 집을 수가 없다', () => {
    const s = S();
    expect(dragShapeHandle(s, 'width', { x: s.x, y: s.y }).w).toBe(SHAPE_MIN_PX);
    expect(dragShapeHandle(s, 'width', { x: s.x + 99999, y: s.y }).w).toBe(SHAPE_MAX_PX);
  });

  it('회전 손잡이는 중심→포인터 각을 그대로 쓴다. 위쪽이 0° 다', () => {
    const s = S();
    expect(dragShapeHandle(s, 'rotate', { x: s.x, y: s.y - 100 }).rot).toBeCloseTo(0, 6);
    expect(dragShapeHandle(s, 'rotate', { x: s.x + 100, y: s.y }).rot).toBeCloseTo(90, 6);
    expect(dragShapeHandle(s, 'rotate', { x: s.x, y: s.y + 100 }).rot).toBeCloseTo(180, 6);
    // 음수로 안 나온다 — 저장값이 -90 이면 정화기·비교가 매번 다른 답을 낸다.
    expect(dragShapeHandle(s, 'rotate', { x: s.x - 100, y: s.y }).rot).toBeCloseTo(270, 6);
  });

  it('회전은 크기를 안 건드리고, 크기는 회전을 안 건드린다', () => {
    const s = S({ rot: 30 });
    const rotated = dragShapeHandle(s, 'rotate', { x: 400, y: 400 });
    expect(rotated.w).toBe(s.w);
    expect(rotated.h).toBe(s.h);
    const resized = dragShapeHandle(s, 'width', { x: 400, y: 400 });
    expect(resized.rot).toBe(s.rot);
  });
});

describe('makeShape — 놓았을 때', () => {
  it('세 종류 다 같은 기본 크기·각도 0 으로, 찍은 자리를 중심으로 선다', () => {
    for (const kind of ['ellipse', 'triangle', 'rect'] as ShapeKind[]) {
      const s = makeShape('sh_a' as ShapeId, kind, { x: 300, y: 200 });
      expect(s).toMatchObject({ kind, x: 300, y: 200, w: SHAPE_DEFAULT_PX, h: SHAPE_DEFAULT_PX, rot: 0 });
      // 놓자마자 자기 중심이 자기 안이어야 한다 — 아니면 놓고 나서 집을 수가 없다.
      expect(shapeContains(s, { x: 300, y: 200 })).toBe(true);
    }
  });
});
