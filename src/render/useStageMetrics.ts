// §6.4 좌표 변환 · 줌. `getScreenCTM()` 을 쓰지 않는 이유: jsdom 에 없어서 단위 테스트가
// 불가능하고, Safari 에서 CSS transform 조상 아래 부정확한 사례가 보고된다.
// `preserveAspectRatio="xMidYMid meet"` 역산은 순수 함수라 테스트 가능하다.
import type { Vec2 } from '../core/units.ts';
import { clamp } from '../core/geom.ts';
import { CHAIR, INTERACT } from '../core/constants.ts';
import type { CourtDef } from '../model/court.ts';

export interface StageView {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** 스테이지 표시 회전(§6.4 태블릿 대응, 2026-08-09 기현 지시).
 *
 *  **코트 영역이 세로로 길면 90° 돌린다.** 코트의 공격축이 화면의 긴 축과 어긋나면 남는 여백이
 *  절반을 넘는다 — iPad 세로에서 풀 코트는 666×416 으로 그려져 높이의 54% 가 빈다. 돌리면
 *  562×900 이 되어 가용 면적이 약 2배가 된다.
 *
 *  회전은 **표현 계층에만** 산다. 월드 좌표·물리·모델은 한 줄도 바뀌지 않는다 — 돌아간 것은
 *  판을 바라보는 각도이지 판이 아니다. 그래서 `cloneToCourt`·기본 배치·격자 라벨·골든값이
 *  전부 그대로다.
 *
 *  방향은 **시계방향**이다. 하프 코트는 골이 아래(y=400)에 있어서 시계방향으로 돌리면 골이
 *  왼쪽으로 가고 공격 방향이 왼→오른쪽이 된다(전술도 관례). 반시계면 오른→왼쪽이 된다. */
export type StageRot = 0 | 90;

/** 돌려서 이만큼은 더 커져야 돌린다. 1.0 으로 두면 근소한 차이에도 판이 홱홱 돌고, 정사각형
 *  근처에서는 폭이 몇 px 만 변해도 뒤집힌다. 8% 는 "눈에 띄게 커질 때만" 의 어림값이다. */
const ROTATE_GAIN = 1.08;

/** **어느 방향이 더 크게 들어가는가**로 정한다.
 *
 *  처음에는 "상자가 세로로 길면 돌린다" 로 했는데 실기에서 틀렸다 — iPad 세로에서 도구·속성을
 *  아래로 내리고 나면 코트 영역이 865×870 처럼 **거의 정사각형**이 된다. 상자만 보면 가로라
 *  안 돌지만, 그 안에서 풀 코트(1.6:1)는 위아래로 크게 남는다. 반대로 하프 코트(1.18:1)는
 *  같은 상자에서 돌리면 오히려 작아진다. 즉 답은 상자 모양이 아니라 **코트와 상자의 조합**에
 *  달려 있고, 그것을 직접 재는 것이 곧 "긴 축을 긴 축에 맞춘다" 는 원칙 그 자체다.
 *
 *  ⚠️ 2026-08-14 재설계(§4.2) 이후 **이 함수를 `<svg>` 실측 rect 로 부르는 자리는 없다.**
 *  화면이 쓰는 유일한 호출자는 `courtScale`(chromeBudget.ts)이고, 그쪽 입력은 창 크기에서
 *  계산한 코트 상자다. 실측 rect 를 다시 여기 넣으면 P3(코트 칸이 자기 종횡비로 맞춰짐) 위에서
 *  고리가 닫히며 **쌍안정**이 되살아난다 — 0 과 90 이 둘 다 고정점이라 창을 줄인 순서에 따라
 *  축척이 23% 달라지고 재현이 안 된다(useStageRot.ts 머리말 · useStageRot.test.ts 의 쌍안정 절).
 *  useStageRot.test.ts 의 소스 계약이 "프로덕션에서 chromeBudget 말고는 아무도 안 부른다" 를
 *  못박고 있다. */
export function rotForFit(rect: { width: number; height: number }, view: StageView): StageRot {
  if (rect.width <= 0 || rect.height <= 0 || view.w <= 0 || view.h <= 0) return 0;
  const flat = Math.min(rect.width / view.w, rect.height / view.h);
  const turned = Math.min(rect.width / view.h, rect.height / view.w);
  return turned > flat * ROTATE_GAIN ? 90 : 0;
}

export interface StageMetrics {
  rect: DOMRect;
  view: StageView;
  rot: StageRot;
  pxPerUnit: number;
  offX: number;
  offY: number;
}

export function computeMetrics(rect: DOMRect, view: StageView, rot: StageRot = 0): StageMetrics {
  // 90° 돌리면 화면에 놓이는 상자의 가로·세로가 뒤바뀐다. 'meet' 역산은 그 상자 기준이다.
  const boxW = rot === 90 ? view.h : view.w;
  const boxH = rot === 90 ? view.w : view.h;
  const pxPerUnit = Math.min(rect.width / boxW, rect.height / boxH); // 'meet'
  return {
    rect,
    view,
    rot,
    pxPerUnit,
    offX: rect.left + (rect.width - boxW * pxPerUnit) / 2, // 'xMid'
    offY: rect.top + (rect.height - boxH * pxPerUnit) / 2, // 'YMid'
  };
}

export function clientToWorld(m: StageMetrics, cx: number, cy: number): Vec2 {
  const bx = (cx - m.offX) / m.pxPerUnit; // 화면에 놓인 상자 안의 좌표
  const by = (cy - m.offY) / m.pxPerUnit;
  // 시계방향 90°: 월드 (x,y) → 상자 (view.y+view.h−y, x−view.x). 그 역이 아래 식이다.
  if (m.rot === 90) return { x: m.view.x + by, y: m.view.y + m.view.h - bx };
  return { x: m.view.x + bx, y: m.view.y + by };
}

/** clientToWorld 의 역. 회전이 붙으면서 두 방향을 같은 곳에서 유지해야 어긋나지 않는다
 *  (왕복 항등을 테스트가 못 박는다). */
export function worldToClient(m: StageMetrics, wx: number, wy: number): { clientX: number; clientY: number } {
  const bx = m.rot === 90 ? m.view.y + m.view.h - wy : wx - m.view.x;
  const by = m.rot === 90 ? wx - m.view.x : wy - m.view.y;
  return { clientX: m.offX + bx * m.pxPerUnit, clientY: m.offY + by * m.pxPerUnit };
}

/** 화면에서 본 방향(ArrowRight 등)을 월드 델타로 옮긴다.
 *
 *  §7.5 접근성: **ArrowRight 는 화면에서 오른쪽으로 움직여야 한다.** 월드 +x 로 고정하면
 *  세로 화면에서는 오른쪽 키가 개체를 아래로 내려보낸다 — 보이는 것과 손이 어긋난다. */
export function screenDeltaToWorld(m: Pick<StageMetrics, 'rot'>, dx: number, dy: number): Vec2 {
  // 시계방향 90° 의 역: 화면 +x → 월드 −y, 화면 +y → 월드 +x.
  if (m.rot === 90) return { x: dy, y: -dx };
  return { x: dx, y: dy };
}

/** `view` 는 코트 viewBox 를 `CHAIR.hullRadiusPx` 만큼 확장한 범위 안에 머문다.
 *  줌 배율은 가로 기준(def.vbW / view.w)으로 추적하고 `INTERACT.zoomMin..zoomMax` 로 clamp 한다.
 *  `focus`(포인터·핀치 중심)를 view 안 상대 위치(fx,fy)로 고정한 채 스케일한다. */
/** view 가 머무를 수 있는 범위. 코트 viewBox 를 `CHAIR.hullRadiusPx` 만큼 넓힌 만큼이다 —
 *  라인 밖에 놓인 개체와 밀려난 골대까지는 보여야 하지만, 그 너머 빈 공간까지 헤매게 두면
 *  "판을 잃어버리는" 일이 생긴다. 줌과 이동이 같은 범위를 써야 어긋나지 않는다. */
export function clampViewToCourt(view: StageView, def: CourtDef): StageView {
  const margin = CHAIR.hullRadiusPx;
  const maxX = Math.max(-margin, def.vbW + margin - view.w);
  const maxY = Math.max(-margin, def.vbH + margin - view.h);
  return { ...view, x: clamp(view.x, -margin, maxX), y: clamp(view.y, -margin, maxY) };
}

/** 줌 배율은 가로 기준(def.vbW / view.w)으로 추적하고 `INTERACT.zoomMin..zoomMax` 로 clamp 한다.
 *  `focus`(포인터·핀치 중심)를 view 안 상대 위치(fx,fy)로 고정한 채 스케일한다. */
export function zoomAt(view: StageView, def: CourtDef, focus: Vec2, factor: number): StageView {
  const curZoom = def.vbW / view.w;
  const nextZoom = clamp(curZoom * factor, INTERACT.zoomMin, INTERACT.zoomMax);
  const w = def.vbW / nextZoom;
  const h = def.vbH / nextZoom;
  const fx = view.w > 0 ? (focus.x - view.x) / view.w : 0.5;
  const fy = view.h > 0 ? (focus.y - view.y) / view.h : 0.5;
  return clampViewToCourt({ x: focus.x - fx * w, y: focus.y - fy * h, w, h }, def);
}

/** 판을 **월드 델타만큼 민다**. 손이 잡은 것은 판이므로 화면에서 오른쪽으로 끌면 view 는
 *  왼쪽으로 간다 — 부호는 호출자가 이미 뒤집어 넘긴다(화면 델타 → 월드 델타 변환이
 *  회전(rot)까지 함께 처리해야 해서 여기서 다시 손대면 두 곳에서 뒤집힌다). */
export function panView(view: StageView, def: CourtDef, d: Vec2): StageView {
  return clampViewToCourt({ ...view, x: view.x + d.x, y: view.y + d.y }, def);
}

/** 화면 CSS px 델타만큼 **창을 민다** — 창이 그 방향으로 간다(판을 손으로 잡아 미는 것과
 *  부호가 반대다. 그쪽은 호출자가 뒤집어 넘긴다).
 *
 *  회전·배율 환산을 이 한곳에 모은다: 키보드 팬(§4.4 P2-1 Ctrl+방향키)과 가장자리 자동
 *  밀기가 같은 식을 써야, 판이 90° 돌아간 세로 태블릿에서 두 경로가 서로 다른 쪽으로 가는
 *  일이 없다. `screenDeltaToWorld` 를 지나지 않으면 오른쪽 키가 판을 아래로 내려보낸다.
 *
 *  `pxPerUnit` 이 0 이면(레이아웃 전·측정 실패) 아무 일도 하지 않는다 — 0 으로 나눈
 *  Infinity 가 view 에 들어가면 판을 영영 잃는다. */
export function panViewByScreen(
  view: StageView,
  def: CourtDef,
  m: Pick<StageMetrics, 'rot' | 'pxPerUnit'>,
  dxCssPx: number,
  dyCssPx: number,
): StageView {
  if (!(m.pxPerUnit > 0)) return view;
  return panView(view, def, screenDeltaToWorld(m, dxCssPx / m.pxPerUnit, dyCssPx / m.pxPerUnit));
}

/** 화면 가장자리 자동 밀기 속도(**화면** px/s). 포인터가 상자 가장자리 띠 안으로 들어간
 *  깊이에 제곱으로 비례한다. 바깥으로 나가도 최고 속도에서 멈춘다 — 손이 화면 밖으로
 *  많이 나갔다고 판이 더 빨리 달아나면 되돌아올 수 없다.
 *
 *  부호는 "포인터가 간 쪽으로 창이 따라간다" 다: 왼쪽 띠에 들어가면 창이 왼쪽(−x)으로 간다.
 *  판을 손으로 미는 것(부호 반전)과 반대이므로 한곳에 몰아 둔다. */
export function edgePanVelocity(
  rect: { left: number; top: number; right: number; bottom: number },
  client: Vec2,
  bandPx: number,
  maxPxPerS: number,
): Vec2 {
  const axis = (lo: number, hi: number, p: number): number => {
    const inLo = bandPx - (p - lo); // 왼/위 가장자리로부터의 침투 깊이
    const inHi = bandPx - (hi - p);
    const depth = inLo > 0 ? -inLo : inHi > 0 ? inHi : 0;
    if (depth === 0 || bandPx <= 0) return 0;
    const t = clamp(Math.abs(depth) / bandPx, 0, 1);
    return Math.sign(depth) * t * t * maxPxPerS;
  };
  return { x: axis(rect.left, rect.right, client.x), y: axis(rect.top, rect.bottom, client.y) };
}

// ── 2026-08-14 7차 검증: 여기 있던 `useStageMetrics` 훅을 **지웠다** ────────────────────────
// 무엇이었나: `svgRef` 를 ResizeObserver/visualViewport 로 구독해 `computeMetrics` 를 다시 돌리고
// `pxPerUnit` 을 디바운스로 state 에 흘리던 훅(+ `UseStageMetricsResult`). **호출자가 0곳이었다** —
// v0.1.0(abb4963) 시점에도 이미 0곳이라 이번 재설계가 만든 빚이 아니다. CourtStage 가 같은 일을
// 자기 안에 따로 구현해 두었고(rotRef · metricsRef · refreshMetrics), 화면이 실제로 도는 것은
// 그쪽 한 벌뿐이다.
//
// 왜 지웠나: P1(§4.2)이 지시대로 이 훅의 시그니처에 `rot` 을 얹고 *"회전을 정하는 곳은 이제
// useStageRot 하나뿐"* 이라는 규율 주석까지 달아 두면서, **죽은 코드가 살아 있는 코드와 같은
// 규율을 지키는 척하게 됐다.** 이 저장소가 실제로 크게 데인 사고가 정확히 그 형태다 — 물리
// 프로브가 코트 크기를 골대까지 안 넘겨 잡종 월드를 만들었는데 2468 전건 초록이었던 일(*"하네스도
// 검증 대상이다"*). 같은 모듈 안에 `rotForFit` 의 소비자가 두 벌 있으면, 다음 사람이 어느 쪽이
// 진짜인지 헤매다 죽은 쪽을 고치고 초록불을 받는다. P1·P3·P5 가 세 라운드 연속으로 이 사실을
// 보고했지만 *"내 소유 파일이 아니라"* 로 남아 있었다.
//
// 되살릴 일이 생기면 `git show abb4963:src/render/useStageMetrics.ts` 에 옛 전문이 있다. 다만
// 되살릴 때는 **CourtStage 쪽을 지워 한 벌로 만들어라** — 두 벌이 된 것이 문제였지 훅이 문제가
// 아니었다. 이 파일에 남은 것은 전부 순수 함수다(rotForFit · computeMetrics · zoomAt · panBy …).
