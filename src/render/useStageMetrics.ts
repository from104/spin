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

export interface StageMetrics {
  rect: DOMRect;
  view: StageView;
  pxPerUnit: number;
  offX: number;
  offY: number;
}

export function computeMetrics(rect: DOMRect, view: StageView): StageMetrics {
  const pxPerUnit = Math.min(rect.width / view.w, rect.height / view.h); // 'meet'
  return {
    rect,
    view,
    pxPerUnit,
    offX: rect.left + (rect.width - view.w * pxPerUnit) / 2, // 'xMid'
    offY: rect.top + (rect.height - view.h * pxPerUnit) / 2, // 'YMid'
  };
}

export function clientToWorld(m: StageMetrics, cx: number, cy: number): Vec2 {
  return {
    x: m.view.x + (cx - m.offX) / m.pxPerUnit,
    y: m.view.y + (cy - m.offY) / m.pxPerUnit,
  };
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
  /** 드래그 시작 시 다시 읽는다 — ResizeObserver 는 위치 이동(스크롤·URL바 접힘)을 관측하지 않는다. */
  refresh(): StageMetrics | null;
}

const PX_PER_UNIT_DEBOUNCE_MS = 100;

export function useStageMetrics(svgRef: RefObject<SVGSVGElement | null>, view: StageView): UseStageMetricsResult {
  const metricsRef = useRef<StageMetrics | null>(null);
  const [pxPerUnit, setPxPerUnit] = useState(1);
  const viewRef = useRef(view);
  viewRef.current = view;

  const refresh = useCallback((): StageMetrics | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const m = computeMetrics(rect, viewRef.current);
    metricsRef.current = m;
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

  return { metricsRef, pxPerUnit, refresh };
}
