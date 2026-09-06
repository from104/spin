// 작도 도형 — 타원 · 정삼각형 · 직사각형 (기현 지시 2026-08-14).
//
// *"작도에 원(타원), 삼각형, 사각형을 삽입 가능하게 해줘. 레이어는 코트보다는 높고 칩·화살표
// 들보다는 낮게. 면은 연하게 반투명해야 하며 서로 겹치면 진해져야 함. 각 오브젝트는 이동,
// 크기조정, 회전이 가능해야 함."*
//
// ── ⚠️ 2026-09-06: 위 인용의 *"칩·화살표들보다는 낮게"* 는 **기본값**이 됐다 ──────────────
// 개체 표시 순서(z-order, `docs/PLAN-Z-ORDER.md` 결정 4)가 생기면서 도형도 사용자가 스텝마다
// 올리고 내릴 수 있는 7종의 하나가 됐다. 2026-08-14 지시가 뒤집힌 것이 아니다 — 그 순서는
// `model/zOrder.ts` 의 `DEFAULT_TIERS` 첫 칸(도형이 맨 아래)으로 그대로 살아 있고, 아무도
// 손대지 않은 스텝은 한 픽셀도 안 변한다. 바뀐 것은 **사용자가 그것을 뒤집을 수 있다**는 것
// 하나뿐이다. 그리는 자리도 따라 옮겼다: `render/ShapeLayer.tsx`(층)에서
// `render/objects/ShapeMark.tsx`(한 장)로 — 층으로는 "콘과 화살표 사이에 도형 한 장" 을
// 표현할 수 없기 때문이다.
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

/** 삼각형의 세 꼭짓점 — 회전 **전**, **무게중심 기준** 국소 좌표.
 *
 *  불변식: **세 점의 합이 (0,0)** 이다. 즉 `Shape.x,y` 가 곧 무게중심이고 회전축이다.
 *  한 점을 끌면 무게중심이 움직이므로, 끄는 쪽이 매번 재중심(`recenterTri`)해서 이 불변식을
 *  되세운다 — 안 그러면 회전축이 도형 밖으로 새어 나가 "제자리에서 도는" 성질이 깨진다. */
export type TriPoints = readonly [Vec2, Vec2, Vec2];

export interface Shape {
  id: ShapeId;
  kind: ShapeKind;
  /** 중심(월드 px). 회전축이기도 하다. 삼각형은 **무게중심**이다. */
  x: number;
  y: number;
  /** 회전 **전** 전체 폭·높이(월드 px).
   *
   *  ⚠️ 삼각형에서는 **입력이 아니라 결과**다(2026-08-15). 모양은 `pts` 가 지고, 이 둘은 그
   *  경계상자를 받아 적은 값이다 — 크기 표시와 옛 저장본 폴백에만 쓰인다. 삼각형의 w/h 를
   *  고쳐도 모양은 안 바뀐다. */
  w: number;
  h: number;
  /** 도(度), 시계방향. */
  rot: number;
  /** **삼각형 전용.** 없으면 `w` 를 한 변으로 하는 정삼각형으로 읽는다(옛 저장본).
   *  타원·사각형에는 없다 — 있어도 무시된다. */
  pts?: TriPoints;
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

/** 정삼각형의 꼭짓점(중심 기준, 회전 전). `side` 는 한 변.
 *
 *  **무게중심**을 원점으로 잡는다 — 외접원 중심이 아니라. 회전축이 무게중심이라야 삼각형이
 *  제자리에서 도는 것으로 보인다(외접원 중심으로 돌리면 아래로 처진 채 도는 것처럼 읽힌다).
 *
 *  ⚠️ 이제 이 함수는 **모양의 정의가 아니라 기본값**이다(2026-08-15). 새로 놓는 삼각형과
 *  `pts` 가 없는 옛 저장본이 여기서 나온다. */
export function trianglePoints(side: number): TriPoints {
  const height = (side * Math.sqrt(3)) / 2;
  return [
    { x: 0, y: (-height * 2) / 3 },
    { x: -side / 2, y: height / 3 },
    { x: side / 2, y: height / 3 },
  ];
}

/** 이 삼각형의 꼭짓점. `pts` 가 없으면 **`w` 를 한 변으로 하는 정삼각형**으로 읽는다.
 *
 *  ⚠️ `min(w,h)` 가 아니라 `w` 다. 옛 모델은 삼각형을 `w === h === 한 변` 으로 저장했고 실제
 *  높이(0.866·한변)는 어디에도 안 적혀 있었다 — 이제 h 가 진짜 경계상자 높이라, 여기서
 *  min 을 쓰면 이사 온 삼각형이 13.4% 작아진다. */
export function triPointsOf(s: Shape): TriPoints {
  return s.pts ?? trianglePoints(s.w);
}

const centroidOf = (p: TriPoints): Vec2 => ({ x: (p[0].x + p[1].x + p[2].x) / 3, y: (p[0].y + p[1].y + p[2].y) / 3 });

/** 무게중심을 원점으로 되돌린 꼭짓점과, 그만큼 옮겨야 할 중심 이동량(국소 좌표).
 *  한 점을 끌면 무게중심이 따라 움직이는데, 나머지 두 점은 화면에서 **가만히 있어야** 한다 —
 *  중심을 그 이동량만큼 같이 옮기는 것이 그 보증이다. */
export function recenterTri(p: TriPoints): { pts: TriPoints; shift: Vec2 } {
  const c = centroidOf(p);
  return {
    pts: [
      { x: p[0].x - c.x, y: p[0].y - c.y },
      { x: p[1].x - c.x, y: p[1].y - c.y },
      { x: p[2].x - c.x, y: p[2].y - c.y },
    ],
    shift: c,
  };
}

/** 꼭짓점 셋의 경계상자. 삼각형의 `w,h` 는 이 값이다. */
export function triBBox(p: TriPoints): { w: number; h: number } {
  const xs = [p[0].x, p[1].x, p[2].x];
  const ys = [p[0].y, p[1].y, p[2].y];
  return { w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
}

/** 부호 있는 넓이의 두 배. 부호는 감김 방향이라 **판정에는 절댓값**을 쓴다. */
export const triCross2 = (p: TriPoints): number =>
  (p[1].x - p[0].x) * (p[2].y - p[0].y) - (p[1].y - p[0].y) * (p[2].x - p[0].x);

/** 세 점이 한 줄에 서는 것을 막는 하한(넓이). 정삼각형 한 변 `SHAPE_MIN_PX`(24)의 넓이가
 *  약 249 이므로, 144 는 "꽤 납작하지만 아직 삼각형" 까지 허용한다. 0 으로 두면 꼭짓점을
 *  반대 변 너머로 끌었을 때 감김이 뒤집히면서 도형이 순간 사라진 것처럼 보인다. */
export const TRI_MIN_AREA_PX2 = (SHAPE_MIN_PX * SHAPE_MIN_PX) / 4;

export const pointsAttr = (p: TriPoints): string => p.map((q) => `${q.x.toFixed(3)},${q.y.toFixed(3)}`).join(' ');

/** 도형의 실제 폭·높이. 삼각형은 꼭짓점의 경계상자다(저장된 w/h 가 어쩌다 어긋나 있어도
 *  화면은 언제나 `pts` 를 따른다 — 모양의 유일한 출처가 하나여야 한다). */
export function shapeSize(s: Shape): { w: number; h: number } {
  if (s.kind === 'triangle') return triBBox(triPointsOf(s));
  return { w: s.w, h: s.h };
}

/** 손잡이 — **사각형·타원은 셋**(대각 모서리 2 + 회전), **삼각형은 넷**(꼭짓점 3 + 회전).
 *
 *  모서리 **4** + 회전 1(그림 프로그램의 통상)을 안 쓴 이유: 짚는 손잡이는 44px 이라야 하는데,
 *  다섯 개를 그 크기로 띄우면 기본 크기(100 월드 px ≈ 4 m)의 도형이 자기 손잡이에 통째로
 *  덮인다. 모서리를 **둘만** 내는 것이 그 판단의 결론이다 — 마주 보는 대각 둘이면 상자가
 *  완전히 정해지므로 나머지 둘은 정보를 더하지 않으면서 자리만 먹는다.
 *
 *  ── 가로·세로에서 대각 모서리로 바뀐 이유(기현 지시 2026-08-15) ────────────────────────
 *  *"사각형도 2개의 대각에 위치한 2개의 꼭지점으로 크기 정할 수 있게."* (타원도 같이 — 기현
 *  결정). 옛 손잡이 둘은 각각 한 축만 바꿔서 "이 상자를 이만큼" 을 한 번에 못 그렸다.
 *  대각 둘이면 **끌지 않은 쪽이 제자리에 남아** 상자를 직접 그리는 조작이 된다(삼각형 꼭짓점이
 *  간 길과 같다). 이로써 세 도형이 **모두 같은 문법**이 됐다: 짚은 점만 움직이고 나머지는
 *  제자리, 중심은 그에 맞춰 다시 잡힌다.
 *
 *  ⚠️ 타원에서 이 두 점은 **면 밖**이다(경계상자 모서리는 타원에 안 닿는다). 그림 도구의
 *  통상이고, 면을 안 가린다는 점에서는 오히려 낫다 — 옛 가로·세로 손잡이를 한 뼘 밀어내던
 *  이유(`SHAPE_HANDLE_GAP_PX`)가 여기서는 저절로 성립한다.
 *
 *  ── 삼각형만 넷인 이유(기현 지시 2026-08-15) ────────────────────────────────────────
 *  *"앵커는 4개 : 회전용 1개, 중심에서 꼭지점 사이의 거리 3개. 어떤 모양의 삼각형이든 그릴
 *  수 있게."* 이로써 **2026-08-14 의 '정삼각형 유지' 결정이 뒤집혔다**(옛 결정은 지우지 않고
 *  여기 남긴다 — 그때는 크기 손잡이 둘이 함께 가는 것이 계약이었다).
 *
 *  ⚠️ 꼭짓점 손잡이는 **반지름만이 아니라 2차원으로 자유롭게** 움직인다. 지시대로 방향을
 *  120° 씩 고정하고 거리 셋만 두면 *"어떤 모양의 삼각형이든"* 이 성립하지 않는다: 중심에서
 *  세 꼭짓점이 정확히 120° 로 벌어져 보이는 점은 **페르마 점**이고, 그 점이 삼각형 안에
 *  있으려면 세 각이 모두 120° 미만이어야 한다. 한 각이 120° 이상인 납작한 삼각형은 그
 *  좌표계로 표현할 수 없다. 자유 이동은 반지름만 늘리는 조작을 부분집합으로 포함하므로
 *  지시하신 조작감은 그대로 남는다(기현 확인 2026-08-15). */
export type ShapeHandle = 'rotate' | 'v0' | 'v1' | 'v2' | 'c0' | 'c1';
/** 사각형·타원 — 경계상자의 마주 보는 두 모서리. */
export const CORNER_HANDLES = ['c0', 'c1', 'rotate'] as const;
export const TRI_HANDLES = ['v0', 'v1', 'v2', 'rotate'] as const;

/** 이 도형이 실제로 내는 손잡이. 화면·포인터·테스트가 전부 이 목록 하나를 돈다. */
export function shapeHandlesFor(kind: ShapeKind): readonly ShapeHandle[] {
  return kind === 'triangle' ? TRI_HANDLES : CORNER_HANDLES;
}

/** 꼭짓점 손잡이 이름 → `pts` 의 첨자. */
export const vertexIndex = (h: ShapeHandle): 0 | 1 | 2 | null => (h === 'v0' ? 0 : h === 'v1' ? 1 : h === 'v2' ? 2 : null);

/** 사각형 대각 손잡이의 **부호**(회전 전 국소 좌표). c0 = 좌상, c1 = 우하. */
export const cornerSign = (h: ShapeHandle): -1 | 1 | null => (h === 'c0' ? -1 : h === 'c1' ? 1 : null);

/** 손잡이를 도형 밖으로 밀어내는 거리(월드 px). 변 위에 얹으면 손잡이가 면을 가려서
 *  "지금 얼마나 큰가" 를 눈으로 못 잰다. */
export const SHAPE_HANDLE_GAP_PX = 16;

/** 삼각형의 회전 손잡이가 앉을 **방향**(국소 라디안).
 *
 *  세 꼭짓점 사이의 **가장 넓은 각도 틈을 반으로 가르는 쪽**이다. 왜 "언제나 위" 가 아닌가:
 *  꼭짓점이 자유롭게 움직이므로 위쪽에 꼭짓점이 서는 배치가 흔하고(기본 삼각형이 이미 그렇다),
 *  그러면 두 손잡이가 16px 사이로 겹쳐 어느 쪽을 짚었는지 알 수 없다 — 잡는 원은 보이는 원의
 *  두 배라 실제로는 통째로 포개진다. 꼭짓점이 셋이면 가장 넓은 틈은 반드시 120° 이상이므로,
 *  그 이등분선은 어느 꼭짓점에서도 최소 60° 떨어진다. */
function triRotateAngle(p: TriPoints): number {
  const angs = [Math.atan2(p[0].y, p[0].x), Math.atan2(p[1].y, p[1].x), Math.atan2(p[2].y, p[2].x)].sort((a, b) => a - b);
  let best = 0;
  let bestGap = -1;
  for (let i = 0; i < 3; i++) {
    const a = angs[i]!;
    const b = i === 2 ? angs[0]! + Math.PI * 2 : angs[i + 1]!;
    const gap = b - a;
    if (gap > bestGap) {
      bestGap = gap;
      best = a + gap / 2;
    }
  }
  return best;
}

/** 무게중심에서 그 방향으로 **삼각형 변까지의 거리**. 무게중심은 언제나 삼각형 안이므로
 *  광선은 반드시 한 변을 지난다(세 변을 다 재고 가장 가까운 교점을 쓴다 — 감김 방향이 뒤집혀
 *  있어도 답이 같다). */
function triEdgeDistance(p: TriPoints, ang: number): number {
  const d: Vec2 = { x: Math.cos(ang), y: Math.sin(ang) };
  let best = Infinity;
  for (let i = 0; i < 3; i++) {
    const a = p[i]!;
    const b = p[(i + 1) % 3]!;
    const e: Vec2 = { x: b.x - a.x, y: b.y - a.y };
    const den = d.x * e.y - d.y * e.x;
    if (Math.abs(den) < 1e-12) continue; // 변과 평행 — 이 변으로는 안 나간다
    const t = (a.x * e.y - a.y * e.x) / den;
    const s = (a.x * d.y - a.y * d.x) / den;
    if (t > 0 && s >= -1e-9 && s <= 1 + 1e-9 && t < best) best = t;
  }
  return Number.isFinite(best) ? best : 0;
}

/** 회전 손잡이가 다른 손잡이와 이만큼은 떨어져 있어야 한다(월드 px).
 *  잡는 원의 반지름이 22 CSS px 이라 두 개가 안 겹치려면 44 가 하한이고, 여유를 조금 뒀다. */
export const SHAPE_ROTATE_MIN_SEP_PX = 48;

/** `ang` 방향의 회전 손잡이를, `base` 에서 시작해 **다른 손잡이들과 겹치지 않을 만큼만** 민다.
 *
 *  닫힌 식으로 푼다(반복 탐색 없음). 손잡이가 거리 d, 다른 점이 거리 r·사잇각 θ 일 때 둘 사이는
 *  `d² − 2rd·cosθ + r²` 이므로, 이것이 SEP² 이상이 되는 최소 d 는
 *  `r·cosθ + √(SEP² − (r·sinθ)²)` 다. 수직거리 `r·sinθ` 가 이미 SEP 이상이면 제약이 없다.
 *
 *  삼각형(꼭짓점 셋)과 사각형(대각 둘)이 **같은 함수**를 쓴다 — 규칙이 갈라지면 한쪽에서만
 *  겹치는 크기 구간이 생기고, 그런 것은 그 크기를 실제로 만들어 보기 전에는 안 보인다. */
function radiusClearOf(others: readonly Vec2[], ang: number, base: number): number {
  const ux = Math.cos(ang);
  const uy = Math.sin(ang);
  let rr = base;
  for (const v of others) {
    const r = Math.hypot(v.x, v.y);
    if (r < 1e-9) continue;
    const along = v.x * ux + v.y * uy; // = r·cosθ
    const perp = Math.abs(v.x * uy - v.y * ux); // = r·|sinθ|
    if (perp >= SHAPE_ROTATE_MIN_SEP_PX) continue;
    const need = along + Math.sqrt(SHAPE_ROTATE_MIN_SEP_PX * SHAPE_ROTATE_MIN_SEP_PX - perp * perp);
    if (need > rr) rr = need;
  }
  return rr;
}

/** 회전 손잡이의 중심 거리.
 *
 *  ⚠️ **가장 먼 꼭짓점이 기준이 아니다**(기현 신고 2026-08-15: *"회전 앵커가 삼각형 형태에 따라
 *  너무 멀리 떨어진다"*). 한쪽만 길쭉한 삼각형에서 그 규칙은 **정작 좁은 쪽인데도** 먼 꼭짓점
 *  만큼 밀어내, 손잡이가 도형에서 한참 떨어진 허공에 뜬다.
 *
 *  대신 **그 방향으로 도형이 실제로 뻗은 만큼**(변까지의 거리) + 한 뼘이다. 다만 그것만으로는
 *  작은 삼각형에서 꼭짓점과 붙어 버리므로(정삼각형 한 변 60 이면 34 까지 가까워진다), 어느
 *  꼭짓점과도 `SHAPE_ROTATE_MIN_SEP_PX` 는 떨어지도록 **필요한 만큼만** 더 민다
 *  (`radiusClearOf` — 사각형의 대각 손잡이도 같은 함수를 쓴다). */
function triRotateRadius(p: TriPoints, ang: number): number {
  return radiusClearOf(p, ang, Math.max(triEdgeDistance(p, ang), SHAPE_MIN_PX / 2) + SHAPE_HANDLE_GAP_PX);
}

/** 손잡이의 **월드 좌표**. 회전까지 먹인 값이라 화면은 이 점에 그대로 찍으면 된다.
 *  포인터 판정도 같은 함수를 써야 그림과 히트가 어긋나지 않는다.
 *
 *  반환은 그 도형이 실제로 내는 손잡이만 담는다(`shapeHandlesFor`). */
export function shapeHandlePoints(s: Shape): Partial<Record<ShapeHandle, Vec2>> {
  const local: Partial<Record<ShapeHandle, Vec2>> = {};
  if (s.kind === 'triangle') {
    const p = triPointsOf(s);
    local.v0 = p[0];
    local.v1 = p[1];
    local.v2 = p[2];
    // 회전 손잡이는 **그 방향의 변 바로 바깥**이다(`triRotateRadius`). 안쪽에 두면 면에 가려
    // 안 보이고, 가장 먼 꼭짓점을 기준으로 잡으면 길쭉한 삼각형에서 허공까지 밀려난다.
    const a = triRotateAngle(p);
    const rr = triRotateRadius(p, a);
    local.rotate = { x: Math.cos(a) * rr, y: Math.sin(a) * rr };
  } else {
    const { w, h } = shapeSize(s);
    // 대각 둘 — **경계상자의 모서리 그 자리**다(오프셋 없음). 손잡이가 곧 모서리라야 "여기까지"
    // 를 직접 그리는 조작이 된다.
    // ⚠️ 타원에서는 이 점이 **면 밖**이다(상자 모서리는 타원에 안 닿는다). 그림 도구의 통상이고,
    //    면을 안 가린다는 점에서는 오히려 낫다 — 옛 가로·세로 손잡이가 한 뼘 밀려나 있던 이유가
    //    그것이었는데 여기서는 저절로 성립한다.
    local.c0 = { x: -w / 2, y: -h / 2 };
    local.c1 = { x: w / 2, y: h / 2 };
    // 회전은 **위쪽**이다. 대각 둘이 좌상·우하라 위쪽 한가운데는 늘 비어 있다. 다만 상자가
    // 옆으로 납작하면 좌상 모서리가 코앞이므로(폭 24 면 12px), 겹치지 않을 만큼만 더 민다.
    local.rotate = { x: 0, y: -radiusClearOf([local.c0, local.c1], -Math.PI / 2, h / 2 + SHAPE_HANDLE_GAP_PX) };
  }
  const rad = (s.rot * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const out: Partial<Record<ShapeHandle, Vec2>> = {};
  for (const k of shapeHandlesFor(s.kind)) {
    const p = local[k]!;
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
  // 삼각형 — 세 변에 대해 같은 쪽인가(부호 일관성).
  //
  // ⚠️ **감김 방향을 가정하지 않는다.** 옛 코드는 정삼각형이라 언제나 시계방향인 것을 알고
  // `cross ≤ 0` 만 봤는데, 꼭짓점을 자유롭게 끌면 반대 변을 넘어가는 순간 감김이 뒤집힌다
  // (넓이 하한이 그 순간을 막지만, 포인터가 한 프레임에 건너뛰면 통과할 수 있다). 부호가
  // 뒤집힌 삼각형을 "언제나 바깥" 으로 읽으면 도형이 클릭을 안 받는 유령이 된다.
  const pts = triPointsOf(s);
  let pos = false;
  let neg = false;
  for (let i = 0; i < 3; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % 3]!;
    const cross = (b.x - a.x) * (q.y - a.y) - (b.y - a.y) * (q.x - a.x);
    if (cross > 1e-9) pos = true;
    else if (cross < -1e-9) neg = true;
  }
  return !(pos && neg);
}

/** 손잡이를 월드 점 `p` 로 끌었을 때의 새 도형. **순수 함수다** — 포인터 코드가 자기 산수를
 *  갖지 않게 하려는 것이고, 그래야 이 규칙을 jsdom 없이 검증할 수 있다.
 *
 *  ⚠️ **중심은 고정이 아니다.** 옛 규칙(2026-08-14)은 "중심 고정 — 중심이 회전축이므로 크기를
 *  바꿀 때 중심이 움직이면 도형이 돌면서 이동까지 한다" 였는데, 손잡이가 전부 **모서리·꼭짓점**
 *  이 되면서(2026-08-15) 뒤집혔다: 짚은 점 말고 **나머지가 제자리에 남아야** 그린 자리와 결과가
 *  같다. 회전축이 흔들리는 문제는 중심을 **다시 잡아**(모서리 한가운데 / 무게중심) 해결한다 —
 *  옛 규칙이 막으려던 것은 그대로 막히고, 조작만 직접적인 것으로 바뀐 셈이다. */
export function dragShapeHandle(s: Shape, which: ShapeHandle, p: Vec2): Shape {
  if (which === 'rotate') {
    // 회전 손잡이가 앉은 **방향**을 기준으로 각을 잰다. 상자 도형은 그 방향이 위(-90°)라
    // 옛 식(+90)과 한 글자도 다르지 않고, 삼각형은 손잡이가 가장 넓은 틈에 앉으므로 그
    // 각만큼 빼 준다 — 안 그러면 손잡이를 잡는 순간 도형이 그 차이만큼 튄다.
    const base = s.kind === 'triangle' ? (triRotateAngle(triPointsOf(s)) * 180) / Math.PI : -90;
    const deg = (Math.atan2(p.y - s.y, p.x - s.x) * 180) / Math.PI - base;
    return { ...s, rot: ((deg % 360) + 360) % 360 };
  }

  const corner = cornerSign(which);
  if (corner !== null) {
    // ★ 사각형 대각 손잡이 — **끌지 않은 모서리가 제자리에 남는다**(기현 지시 2026-08-15).
    //
    // 타원의 가로·세로 손잡이와 **정반대 규칙**이라 한 줄로 못박아 둔다: 그쪽은 중심 고정이고
    // (중심이 회전축이라 크기를 바꿀 때 중심이 움직이면 도형이 돌면서 이동까지 한다), 이쪽은
    // 마주 보는 모서리 고정이다. 대각 둘로 "상자를 이만큼" 을 그리는 조작에서 중심을 고정하면
    // 끌지 않은 모서리가 반대로 따라 움직여, 그린 자리와 결과가 어긋난다.
    // 회전축이 흔들리는 문제는 여기서도 그대로 있으므로 — 중심을 두 모서리의 한가운데로
    // **다시 잡아** 해결한다(삼각형의 재중심과 같은 수법이다).
    const { w, h } = shapeSize(s);
    const opp: Vec2 = { x: (-corner * w) / 2, y: (-corner * h) / 2 };
    const q = toLocal(s, p);
    // ★ **뒤집기를 허용하지 않는다.** 끄는 모서리는 언제나 고정 모서리의 자기 쪽(c1 이면
    //   오른쪽·아래, c0 이면 왼쪽·위)에 머문다.
    //
    //   그림 도구는 보통 뒤집기를 허용하지만, 여기서는 손잡이가 **대각 둘뿐**이라 그럴 수 없다:
    //   한 축만 부호가 뒤집히면(예: 위로는 넘어가고 오른쪽으로는 안 넘어감) 고정하기로 한
    //   모서리가 **손잡이가 없는 반대 대각**(우상/좌하)으로 옮겨 가, 그 점을 다시 잡을 방법이
    //   영영 없어진다. 모서리 넷을 다 내면 풀리는 문제지만 그러면 표적이 다섯이 된다
    //   (`ShapeHandle` 머리말). 뒤집고 싶으면 회전 손잡이가 있다.
    const span = (a: number, b: number): number => {
      const mag = Math.min(SHAPE_MAX_PX, Math.max(SHAPE_MIN_PX, (a - b) * corner));
      return mag * corner;
    };
    const dx = span(q.x, opp.x);
    const dy = span(q.y, opp.y);
    const mid: Vec2 = { x: opp.x + dx / 2, y: opp.y + dy / 2 };
    const rad = (s.rot * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    return {
      ...s,
      x: s.x + mid.x * cos - mid.y * sin,
      y: s.y + mid.x * sin + mid.y * cos,
      w: Math.abs(dx),
      h: Math.abs(dy),
    };
  }

  const vi = vertexIndex(which);
  if (vi !== null) {
    // 꼭짓점을 **포인터 자리 그대로** 옮긴다(손잡이 오프셋이 없다 — 손잡이가 곧 꼭짓점이다).
    const cur = triPointsOf(s);
    const q = toLocal(s, p);
    // 중심에서 너무 멀거나 가까운 것만 막는다. 방향은 안 건드린다 — 그것이 이 조작의 요점이다.
    const d = Math.hypot(q.x, q.y);
    const lim = Math.min(SHAPE_MAX_PX / 2, Math.max(SHAPE_MIN_PX / 2, d));
    const k = d < 1e-9 ? 0 : lim / d;
    const moved: Vec2 = d < 1e-9 ? { x: SHAPE_MIN_PX / 2, y: 0 } : { x: q.x * k, y: q.y * k };
    const next: TriPoints = [vi === 0 ? moved : cur[0], vi === 1 ? moved : cur[1], vi === 2 ? moved : cur[2]];
    // 한 줄로 서면 도형이 사라진다 — 그 이동은 통째로 거부한다(마지막 성립하는 자리에 머문다).
    if (Math.abs(triCross2(next)) < TRI_MIN_AREA_PX2 * 2) return s;
    // 무게중심이 따라 움직였으니 중심을 그만큼 옮겨 **나머지 두 꼭짓점을 제자리에 붙든다.**
    const { pts, shift } = recenterTri(next);
    const rad = (s.rot * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const bbox = triBBox(pts);
    return {
      ...s,
      x: s.x + shift.x * cos - shift.y * sin,
      y: s.y + shift.x * sin + shift.y * cos,
      w: bbox.w,
      h: bbox.h,
      pts,
    };
  }

  // 여기 닿을 손잡이는 없다 — `ShapeHandle` 은 회전·꼭짓점·모서리가 전부이고 위에서 다 처리했다.
  // (2026-08-15 에 가로·세로 손잡이가 사라지면서 이 자리가 도달 불가가 됐다.)
  return s;
}

export function makeShape(id: ShapeId, kind: ShapeKind, at: Vec2): Shape {
  const base = { id, kind, x: at.x, y: at.y, rot: 0 };
  if (kind !== 'triangle') return { ...base, w: SHAPE_DEFAULT_PX, h: SHAPE_DEFAULT_PX };
  // 새 삼각형은 **정삼각형에서 시작한다** — 자유롭게 끌 수 있다고 해서 시작 모양까지 임의일
  // 이유는 없다. h 는 한 변이 아니라 실제 높이(0.866·한변)다(Shape.w/h 의 ⚠️).
  const pts = trianglePoints(SHAPE_DEFAULT_PX);
  const bbox = triBBox(pts);
  return { ...base, w: bbox.w, h: bbox.h, pts };
}
