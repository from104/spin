// 작도 도형 — 타원 · 정삼각형 · 직사각형 (기현 지시 2026-08-14).
//
// *"작도에 원(타원), 삼각형, 사각형을 삽입 가능하게 해줘. 레이어는 코트보다는 높고 칩·화살표
// 들보다는 낮게. 면은 연하게 반투명해야 하며 서로 겹치면 진해져야 함. 각 오브젝트는 이동,
// 크기조정, 회전이 가능해야 함."*
//
// ── 왜 별도 모델인가 ─────────────────────────────────────────────────────────────────
// 화살표(Arrow)는 점 셋으로 정의되는 **곡선**이라 크기·회전이라는 개념 자체가 없고, 메모
// (NoteLabel)는 글자라 회전이 뜻을 잃는다. 도형은 **상자 하나 + 각도**로 사는 첫 개체다.
//
// ── 좌표 규약 ────────────────────────────────────────────────────────────────────────
// `x,y` 는 **중심**이다(화살표의 from/to 나 메모의 좌상단이 아니라). 회전이 있는 개체는
// 중심이 회전축이어야 저장값과 화면이 어긋나지 않는다 — 좌상단 기준으로 두면 각도를 바꿀
// 때마다 x,y 를 함께 고쳐야 하고, 그 두 번의 갱신 사이에 반올림이 끼어 도형이 조금씩 흐른다.
// `w,h` 는 **회전 전** 전체 폭·높이. `rot` 은 도(度) 단위 시계방향(화면 y축이 아래라 SVG
// `rotate()` 와 부호가 같다).
import type { ShapeId } from '../core/ids.ts';
import type { Vec2 } from '../core/units.ts';

export type ShapeKind = 'ellipse' | 'triangle' | 'rect';
export const SHAPE_KINDS = ['ellipse', 'triangle', 'rect'] as const;

export interface Shape {
  id: ShapeId;
  kind: ShapeKind;
  /** 중심(월드 px). 회전축이기도 하다. */
  x: number;
  y: number;
  /** 회전 **전** 전체 폭·높이(월드 px). */
  w: number;
  h: number;
  /** 도(度), 시계방향. */
  rot: number;
}

/** 놓을 때의 기본 크기 — 100 월드 px = **4 m**(코트 축척 25 px = 1 m).
 *  골 지역(6×4 m)보다 작고 센터서클만 한 크기라, 놓자마자 판을 덮지 않으면서도 눈에 띈다. */
export const SHAPE_DEFAULT_PX = 100;
/** 손잡이로 줄일 수 있는 하한. 이보다 작으면 도형 위에 손잡이 셋이 서로 겹쳐 잡을 수 없다. */
export const SHAPE_MIN_PX = 24;
/** 상한 — 풀 코트 대각선(825×525)보다 크게 만들 이유가 없다. */
export const SHAPE_MAX_PX = 1000;

/** 면 불투명도. **낮게 잡는 것이 계약이다** — 겹칠수록 진해지는 것이 이 도형의 요구사항이고
 *  (기현 지시), 한 겹이 이미 진하면 두 겹은 그냥 흰 판이 된다.
 *  0.13 이면 코트(#1f7a46) 위에서 한 겹 1.19:1 · 두 겹 1.41:1 · 세 겹 1.68:1 로 벌어진다. */
export const SHAPE_FILL_OPACITY = 0.13;
/** 테두리는 면보다 훨씬 진하다. 면만으로는 경계가 안 보여서 "어디까지가 이 도형인가" 를
 *  눈으로 못 재고, 그러면 손잡이를 찾을 수도 없다. */
export const SHAPE_STROKE_OPACITY = 0.55;
export const SHAPE_STROKE_PX = 2;
/** 색은 **흰색 하나로 고정**이다(기현 결정 2026-08-14).
 *
 *  팀 색(빨강·파랑)으로 가르는 안을 검토했다가 접었다: 칩과 같은 색을 쓰면 "빨강 지역 = 빨강
 *  팀" 으로 읽히는 이득이 있지만, 겹침이 요구사항이라 **빨강+파랑이 겹친 자리의 색**을 사람이
 *  해석할 수 없다(보라색 구역은 아무 뜻도 없다). 한 색이면 겹침이 곧 농도라 단계가 깨끗하다. */
export const SHAPE_COLOR = '#ffffff';

/** 정삼각형을 유지한다(기현 결정) — 그래서 삼각형은 `w` 와 `h` 가 **언제나 같다.**
 *  손잡이 둘(가로·세로) 중 어느 쪽을 끌어도 두 값이 함께 간다. */
export const isUniform = (kind: ShapeKind): boolean => kind === 'triangle';

/** 도형의 실제 폭·높이. 삼각형은 정삼각형이라 한 변으로 접는다 — 저장값이 어쩌다 어긋나
 *  있어도(옛 파일·손편집) 화면은 정삼각형으로 그린다. */
export function shapeSize(s: Shape): { w: number; h: number } {
  if (isUniform(s.kind)) {
    const side = Math.min(s.w, s.h);
    return { w: side, h: side };
  }
  return { w: s.w, h: s.h };
}

/** 정삼각형의 꼭짓점(중심 기준, 회전 전). `side` 는 한 변.
 *
 *  **무게중심**을 원점으로 잡는다 — 외접원 중심이 아니라. 회전축이 무게중심이라야 삼각형이
 *  제자리에서 도는 것으로 보인다(외접원 중심으로 돌리면 아래로 처진 채 도는 것처럼 읽힌다). */
export function trianglePoints(side: number): readonly Vec2[] {
  const height = (side * Math.sqrt(3)) / 2;
  return [
    { x: 0, y: (-height * 2) / 3 },
    { x: -side / 2, y: height / 3 },
    { x: side / 2, y: height / 3 },
  ];
}

export const trianglePointsAttr = (side: number): string =>
  trianglePoints(side)
    .map((p) => `${p.x.toFixed(3)},${p.y.toFixed(3)}`)
    .join(' ');

/** 손잡이 셋 — 기현 결정(*"큰 것 3개 — 가로·세로·회전"*).
 *
 *  모서리 4 + 회전 1(그림 프로그램의 통상)을 안 쓴 이유: 발 마우스·입 젓가락으로 짚는
 *  손잡이는 44px 이라야 하는데, 다섯 개를 그 크기로 띄우면 기본 크기(100 월드 px ≈ 4 m)의
 *  도형이 자기 손잡이에 통째로 덮인다. 셋이면 세 변에 하나씩이라 서로 안 겹친다. */
export type ShapeHandle = 'width' | 'height' | 'rotate';
export const SHAPE_HANDLES = ['width', 'height', 'rotate'] as const;

/** 손잡이를 도형 밖으로 밀어내는 거리(월드 px). 변 위에 얹으면 손잡이가 면을 가려서
 *  "지금 얼마나 큰가" 를 눈으로 못 잰다. */
export const SHAPE_HANDLE_GAP_PX = 16;

/** 손잡이의 **월드 좌표**. 회전까지 먹인 값이라 화면은 이 점에 그대로 찍으면 된다.
 *  포인터 판정도 같은 함수를 써야 그림과 히트가 어긋나지 않는다. */
export function shapeHandlePoints(s: Shape): Record<ShapeHandle, Vec2> {
  const { w, h } = shapeSize(s);
  const local: Record<ShapeHandle, Vec2> = {
    width: { x: w / 2 + SHAPE_HANDLE_GAP_PX, y: 0 },
    height: { x: 0, y: h / 2 + SHAPE_HANDLE_GAP_PX },
    // 회전은 **위쪽**이다. 크기 손잡이 둘과 반대편이라 셋이 절대 안 겹친다.
    rotate: { x: 0, y: -(h / 2 + SHAPE_HANDLE_GAP_PX) },
  };
  const rad = (s.rot * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const out = {} as Record<ShapeHandle, Vec2>;
  for (const k of SHAPE_HANDLES) {
    const p = local[k];
    out[k] = { x: s.x + p.x * cos - p.y * sin, y: s.y + p.x * sin + p.y * cos };
  }
  return out;
}

/** 월드 점을 도형의 **회전 전 좌표계**로 되돌린다. 히트 판정·크기 조정이 전부 이걸 지난다 —
 *  회전된 도형을 회전된 채로 판정하려 들면 도형마다 다른 산수가 필요해진다. */
export function toLocal(s: Shape, p: Vec2): Vec2 {
  const rad = (-s.rot * Math.PI) / 180;
  const dx = p.x - s.x;
  const dy = p.y - s.y;
  return { x: dx * Math.cos(rad) - dy * Math.sin(rad), y: dx * Math.sin(rad) + dy * Math.cos(rad) };
}

/** 점이 도형 **안**인가. 면이 반투명해도 판정은 꽉 찬 면 기준이다 — 눈에 보이는 것을 짚으면
 *  잡혀야 한다(테두리만 잡히면 얇은 선을 조준하는 셈이라 발 마우스로는 거의 불가능하다). */
export function shapeContains(s: Shape, p: Vec2): boolean {
  const { w, h } = shapeSize(s);
  const q = toLocal(s, p);
  if (w <= 0 || h <= 0) return false;
  if (s.kind === 'rect') return Math.abs(q.x) <= w / 2 && Math.abs(q.y) <= h / 2;
  if (s.kind === 'ellipse') {
    const nx = q.x / (w / 2);
    const ny = q.y / (h / 2);
    return nx * nx + ny * ny <= 1;
  }
  // 정삼각형 — 세 변에 대해 같은 쪽인가(부호 일관성). 꼭짓점 순서가 시계방향이라 부호가
  // 셋 다 ≤ 0 이면 안이다.
  const pts = trianglePoints(w);
  for (let i = 0; i < 3; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % 3]!;
    const cross = (b.x - a.x) * (q.y - a.y) - (b.y - a.y) * (q.x - a.x);
    if (cross > 1e-9) return false;
  }
  return true;
}

const clampSize = (v: number): number => Math.min(SHAPE_MAX_PX, Math.max(SHAPE_MIN_PX, v));

/** 손잡이를 월드 점 `p` 로 끌었을 때의 새 도형. **순수 함수다** — 포인터 코드가 자기 산수를
 *  갖지 않게 하려는 것이고, 그래야 이 규칙을 jsdom 없이 검증할 수 있다.
 *
 *  크기는 **중심 고정**으로 바뀐다(반대편 변이 고정되는 통상 방식이 아니라). 중심이 회전축
 *  이므로, 크기를 바꿀 때 중심이 움직이면 같은 조작에서 도형이 돌면서 이동까지 한다. */
export function dragShapeHandle(s: Shape, which: ShapeHandle, p: Vec2): Shape {
  if (which === 'rotate') {
    // 회전 손잡이는 **위쪽**에 있다 — 중심에서 포인터로 향하는 각이 곧 도형의 각이다.
    const deg = (Math.atan2(p.y - s.y, p.x - s.x) * 180) / Math.PI + 90;
    return { ...s, rot: ((deg % 360) + 360) % 360 };
  }
  const q = toLocal(s, p);
  const raw = which === 'width' ? Math.abs(q.x) - SHAPE_HANDLE_GAP_PX : Math.abs(q.y) - SHAPE_HANDLE_GAP_PX;
  const next = clampSize(raw * 2);
  // 정삼각형은 두 값이 함께 간다(기현 결정) — 어느 손잡이를 끌어도 같은 결과다.
  if (isUniform(s.kind)) return { ...s, w: next, h: next };
  return which === 'width' ? { ...s, w: next } : { ...s, h: next };
}

export function makeShape(id: ShapeId, kind: ShapeKind, at: Vec2): Shape {
  return { id, kind, x: at.x, y: at.y, w: SHAPE_DEFAULT_PX, h: SHAPE_DEFAULT_PX, rot: 0 };
}
