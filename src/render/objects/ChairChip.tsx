// §3.4 "피벗 원점 렌더 규약" 그대로 이식. `<g>` 에는 transform prop 을 절대 주지 않는다
// (§6.1 규칙 1) — 위치는 TransformWriter 가 마운트된 ref 에 직접 쓴다.
import { memo, useEffect, useRef } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import { CHAIR } from '../../core/constants.ts';
import { inkFor } from '../../core/colors.ts';
import type { ChairId } from '../../core/ids.ts';
import type { TransformWriter } from '../transformWriter.ts';

export interface ChairChipProps {
  id: ChairId;
  writer: TransformWriter;
  color: string;
  number: string;
  selected: boolean;
  /** 로빙 tabindex 대상(§7.5b `aria-activedescendant`). */
  active: boolean;
  ariaLabel: string;
  onPointerDown?: (id: ChairId, e: ReactPointerEvent<SVGGElement>) => void;
  onKeyDown?: (id: ChairId, e: ReactKeyboardEvent<SVGGElement>) => void;
}

const FONT = "'Space Grotesk',sans-serif";
const HALF_W = CHAIR.widthPx / 2;

export const ChairChip = memo(function ChairChip({
  id,
  writer,
  color,
  number,
  selected,
  active,
  ariaLabel,
  onPointerDown,
  onKeyDown,
}: ChairChipProps) {
  const bodyRef = useRef<SVGGElement | null>(null);
  const counterRef = useRef<SVGGElement | null>(null);

  useEffect(() => {
    writer.register(id, bodyRef.current);
    return () => writer.register(id, null);
  }, [writer, id]);
  useEffect(() => {
    writer.registerCounter(id, counterRef.current);
    return () => writer.registerCounter(id, null);
  }, [writer, id]);

  const ink = inkFor(color);

  return (
    <g
      ref={bodyRef}
      id={`obj-${id}`}
      className="court-obj"
      role="button"
      aria-label={ariaLabel}
      aria-pressed={selected}
      tabIndex={active ? 0 : -1}
      onPointerDown={(e) => onPointerDown?.(id, e)}
      onKeyDown={(e) => onKeyDown?.(id, e)}
    >
      <rect
        x={-CHAIR.pivotToRearPx}
        y={-HALF_W}
        width={CHAIR.lengthPx}
        height={CHAIR.widthPx}
        rx={5}
        fill={color}
        stroke="rgba(255,255,255,.92)"
        strokeWidth={2.2}
      />
      {/* 볼가드 s∈[0.85,1.00] — 전방 견인 존의 시각적 힌트 */}
      <rect
        x={CHAIR.pivotToFrontPx - CHAIR.guardPx}
        y={-HALF_W}
        width={CHAIR.guardPx}
        height={CHAIR.widthPx}
        rx={2}
        fill="rgba(255,255,255,.24)"
        stroke="rgba(255,255,255,.92)"
        strokeWidth={1.4}
      />
      {/* 머리 = 피벗 = 원점 */}
      <circle cx={0} cy={0} r={4.2} fill="rgba(255,255,255,.92)" />
      <g transform={`translate(${CHAIR.centroidOffsetPx} 0)`}>
        {/* writer 가 rotate(-θ) 를 기록한다 — 등번호는 절대 회전하지 않는다(§3.4). */}
        <g ref={counterRef}>
          <text
            x={0}
            y={0}
            fontFamily={FONT}
            fontSize={20}
            fontWeight={700}
            fill={ink}
            textAnchor="middle"
            dominantBaseline="central"
          >
            {number}
          </text>
        </g>
      </g>
      <rect
        className="focus-ind-outer"
        x={-CHAIR.pivotToRearPx - 3}
        y={-HALF_W - 3}
        width={CHAIR.lengthPx + 6}
        height={CHAIR.widthPx + 6}
        rx={8}
      />
      <rect
        className="focus-ind-inner"
        x={-CHAIR.pivotToRearPx - 3}
        y={-HALF_W - 3}
        width={CHAIR.lengthPx + 6}
        height={CHAIR.widthPx + 6}
        rx={8}
      />
    </g>
  );
});
