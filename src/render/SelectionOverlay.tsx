// §6.6 선택 링 · 러버밴드 · 리시(지연 시각화) · 고스트. 드래그·체이스 중 매 프레임 갱신될
// 수 있는 요소들(리시·고스트)이 섞여 있으므로 §6.1 규칙과 동일하게 "직접 DOM 조작" 으로
// 만든다 — React state 로 만들면 드래그 중 리렌더가 생긴다. 부모(store)가 ref 로 메서드를
// 직접 호출한다.
import { forwardRef, useImperativeHandle, useRef } from 'react';
import type { Vec2 } from '../core/units.ts';
import { DEG } from '../core/angle.ts';

export type SelectionShape = 'chair' | 'ball' | 'cone' | 'note';

export interface SelectionOverlayHandle {
  /** 선택 링. shape=null 이면 숨긴다. */
  setRing(shape: SelectionShape | null, x: number, y: number, theta: number): void;
  setRubberBand(rect: { x: number; y: number; w: number; h: number } | null): void;
  /** §5.11 지연 시각화 — |T−G| > leashVisibleAtPx 일 때만 부모가 호출한다. */
  setLeash(grab: Vec2 | null, target: Vec2 | null): void;
  setGhost(shape: SelectionShape | null, x: number, y: number, theta: number): void;
}

const RING_ROUND_R: Record<Exclude<SelectionShape, 'chair'>, number> = { ball: 12, cone: 9, note: 22 };
const hide = (el: SVGElement | null): void => {
  if (el) el.style.display = 'none';
};
const show = (el: SVGElement | null): void => {
  if (el) el.style.display = '';
};

export const SelectionOverlay = forwardRef<SelectionOverlayHandle>(function SelectionOverlay(_props, ref) {
  const ringRef = useRef<SVGGElement | null>(null);
  const ringChairRef = useRef<SVGRectElement | null>(null);
  const ringRoundRef = useRef<SVGCircleElement | null>(null);
  const bandRef = useRef<SVGRectElement | null>(null);
  const leashRef = useRef<SVGLineElement | null>(null);
  const ghostChairRef = useRef<SVGRectElement | null>(null);
  const ghostRoundRef = useRef<SVGCircleElement | null>(null);
  const ghostGroupRef = useRef<SVGGElement | null>(null);

  useImperativeHandle(
    ref,
    () => ({
      setRing(shape, x, y, theta) {
        const g = ringRef.current;
        if (!g) return;
        if (!shape) {
          hide(g);
          return;
        }
        show(g);
        const isChair = shape === 'chair';
        g.setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${isChair ? (theta * DEG).toFixed(2) : '0'})`);
        if (isChair) {
          show(ringChairRef.current);
          hide(ringRoundRef.current);
        } else {
          hide(ringChairRef.current);
          show(ringRoundRef.current);
          ringRoundRef.current?.setAttribute('r', String(RING_ROUND_R[shape]));
        }
      },
      setRubberBand(rect) {
        const el = bandRef.current;
        if (!el) return;
        if (!rect) {
          hide(el);
          return;
        }
        show(el);
        el.setAttribute('x', String(rect.x));
        el.setAttribute('y', String(rect.y));
        el.setAttribute('width', String(Math.max(0, rect.w)));
        el.setAttribute('height', String(Math.max(0, rect.h)));
      },
      setLeash(grab, target) {
        const el = leashRef.current;
        if (!el) return;
        if (!grab || !target) {
          hide(el);
          return;
        }
        show(el);
        el.setAttribute('x1', grab.x.toFixed(2));
        el.setAttribute('y1', grab.y.toFixed(2));
        el.setAttribute('x2', target.x.toFixed(2));
        el.setAttribute('y2', target.y.toFixed(2));
      },
      setGhost(shape, x, y, theta) {
        const g = ghostGroupRef.current;
        if (!g) return;
        if (!shape) {
          hide(g);
          return;
        }
        show(g);
        const isChair = shape === 'chair';
        g.setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${isChair ? (theta * DEG).toFixed(2) : '0'})`);
        if (isChair) {
          show(ghostChairRef.current);
          hide(ghostRoundRef.current);
        } else {
          hide(ghostChairRef.current);
          show(ghostRoundRef.current);
          ghostRoundRef.current?.setAttribute('r', String(RING_ROUND_R[shape]));
        }
      },
    }),
    [],
  );

  return (
    <g aria-hidden="true" pointerEvents="none">
      <rect
        ref={bandRef}
        style={{ display: 'none' }}
        fill="color-mix(in srgb, var(--accent) 16%, transparent)"
        stroke="var(--accent)"
        strokeWidth={1.5}
        strokeDasharray="5 4"
      />
      <line ref={leashRef} style={{ display: 'none' }} stroke="#ffffff" strokeWidth={1.6} strokeDasharray="3 4" opacity={0.85} />
      <g ref={ghostGroupRef} style={{ display: 'none' }} opacity={0.35}>
        <rect ref={ghostChairRef} x={-7.5} y={-12.5} width={37.5} height={25} rx={5} fill="#ffffff" />
        <circle ref={ghostRoundRef} cx={0} cy={0} r={12} fill="#ffffff" />
      </g>
      <g ref={ringRef} style={{ display: 'none' }}>
        <rect
          ref={ringChairRef}
          x={-11.5}
          y={-16.5}
          width={45.5}
          height={33}
          rx={8}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={2}
          strokeDasharray="4 3"
        />
        <circle ref={ringRoundRef} cx={0} cy={0} r={12} fill="none" stroke="var(--accent)" strokeWidth={2} strokeDasharray="4 3" />
      </g>
    </g>
  );
});
