// §6.4 좌표 변환 · 줌. `getScreenCTM()` 을 쓰지 않는 이유: jsdom 에 없어서 단위 테스트가
// 불가능하고, Safari 에서 CSS transform 조상 아래 부정확한 사례가 보고된다.
// `preserveAspectRatio="xMidYMid meet"` 역산은 순수 함수라 테스트 가능하다.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
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
 *  달려 있고, 그것을 직접 재는 것이 곧 "긴 축을 긴 축에 맞춘다" 는 원칙 그 자체다. */
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
export function zoomAt(view: StageView, def: CourtDef, focus: Vec2, factor: number): StageView {
  const curZoom = def.vbW / view.w;
  const nextZoom = clamp(curZoom * factor, INTERACT.zoomMin, INTERACT.zoomMax);
  const w = def.vbW / nextZoom;
  const h = def.vbH / nextZoom;
  const fx = view.w > 0 ? (focus.x - view.x) / view.w : 0.5;
  const fy = view.h > 0 ? (focus.y - view.y) / view.h : 0.5;

  const margin = CHAIR.hullRadiusPx;
  const minX = -margin;
  const minY = -margin;
  const maxX = Math.max(minX, def.vbW + margin - w);
  const maxY = Math.max(minY, def.vbH + margin - h);
  const x = clamp(focus.x - fx * w, minX, maxX);
  const y = clamp(focus.y - fy * h, minY, maxY);
  return { x, y, w, h };
}

export interface UseStageMetricsResult {
  /** 리렌더를 유발하지 않는 실측치. 히트테스트·좌표변환은 항상 이 ref 를 읽는다. */
  metricsRef: RefObject<StageMetrics | null>;
  /** 히트 반경 계산용 디바운스(100ms) state 사본. */
  pxPerUnit: number;
  /** 표시 회전. **디바운스하지 않는다** — viewBox 와 `<g>` 변환이 이 값으로 그려지므로, 늦으면
   *  회전 직후 한 프레임 동안 좌표계와 그림이 어긋난다. */
  rot: StageRot;
  /** 드래그 시작 시 다시 읽는다 — ResizeObserver 는 위치 이동(스크롤·URL바 접힘)을 관측하지 않는다. */
  refresh(): StageMetrics | null;
}

const PX_PER_UNIT_DEBOUNCE_MS = 100;

export function useStageMetrics(svgRef: RefObject<SVGSVGElement | null>, view: StageView): UseStageMetricsResult {
  const metricsRef = useRef<StageMetrics | null>(null);
  const [pxPerUnit, setPxPerUnit] = useState(1);
  const [rot, setRot] = useState<StageRot>(0);
  const viewRef = useRef(view);
  viewRef.current = view;

  const refresh = useCallback((): StageMetrics | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    // 회전은 **svg 가 실제로 차지한 상자**로 정한다(창이 아니라). 인스펙터가 폭을 먹느냐,
    // 하단으로 내려갔느냐에 따라 같은 창에서도 판단이 달라져야 한다.
    const next = rotForFit(rect, viewRef.current);
    const m = computeMetrics(rect, viewRef.current, next);
    metricsRef.current = m;
    setRot(next); // 같은 값이면 React 가 리렌더를 생략한다
    return m;
  }, [svgRef]);

  useEffect(() => {
    const m = refresh();
    if (m) setPxPerUnit(m.pxPerUnit);

    let timer: number | null = null;
    const scheduleStateSync = (): void => {
      const next = refresh();
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        timer = null;
        if (next) setPxPerUnit(next.pxPerUnit);
      }, PX_PER_UNIT_DEBOUNCE_MS);
    };

    const vv = window.visualViewport;
    vv?.addEventListener('resize', scheduleStateSync);
    vv?.addEventListener('scroll', scheduleStateSync);
    window.addEventListener('resize', scheduleStateSync);
    // capture 단계 scroll — 스테이지를 담은 어떤 조상이 스크롤돼도 좌표가 어긋난다(§6.4).
    window.addEventListener('scroll', scheduleStateSync, true);

    return () => {
      vv?.removeEventListener('resize', scheduleStateSync);
      vv?.removeEventListener('scroll', scheduleStateSync);
      window.removeEventListener('resize', scheduleStateSync);
      window.removeEventListener('scroll', scheduleStateSync, true);
      if (timer !== null) window.clearTimeout(timer);
    };
    // view.w/h(줌 배율)가 바뀌면 즉시 재계산해야 한다.
  }, [refresh, view.w, view.h]);

  return { metricsRef, pxPerUnit, rot, refresh };
}
