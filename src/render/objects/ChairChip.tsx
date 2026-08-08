// §3.4 "피벗 원점 렌더 규약" 그대로 이식. `<g>` 에는 transform prop 을 절대 주지 않는다
// (§6.1 규칙 1) — 위치는 TransformWriter 가 마운트된 ref 에 직접 쓴다.
import { memo, useEffect, useRef } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import { CHAIR } from '../../core/constants.ts';
import { inkFor } from '../../core/colors.ts';
import type { ChairId } from '../../core/ids.ts';
import type { TransformWriter } from '../transformWriter.ts';
import type { ZoneConfig } from '../../model/chair.ts';
import { ZONE_CURSOR } from '../zoneCursors.ts';

export interface ChairChipProps {
  id: ChairId;
  writer: TransformWriter;
  color: string;
  number: string;
  selected: boolean;
  /** 로빙 tabindex 대상(§7.5b `aria-activedescendant`). */
  active: boolean;
  ariaLabel: string;
  /** 넘기면 차체 위 4개 존에 각각 다른 마우스 커서를 얹는다(편집기 전용).
   *  시연 화면은 드래그가 없으므로 넘기지 않는다. */
  zoneCursors?: ZoneConfig | null;
  onPointerDown?: (id: ChairId, e: ReactPointerEvent<SVGGElement>) => void;
  onKeyDown?: (id: ChairId, e: ReactKeyboardEvent<SVGGElement>) => void;
}

const FONT = "'Space Grotesk',sans-serif";
const HALF_W = CHAIR.widthPx / 2;
/** 선택 링 여백(월드 px). 차체 테두리(2.2)와 겹치지 않게 띄운다. */
const SEL_PAD = 3.5;

/** s∈[0,1] 을 차체 로컬 x 로 옮긴다. s=0 이 뒤끝(−pivotToRear), s=1 이 앞범퍼(+pivotToFront). */
const sToX = (s: number): number => -CHAIR.pivotToRearPx + s * CHAIR.lengthPx;

/** 존 경계로 차체를 4구간으로 자른다. 경계값은 설정에서 바뀔 수 있어 매번 계산한다. */
function zoneSpans(z: ZoneConfig): { zone: 'towRear' | 'translate' | 'spin' | 'towFront'; x0: number; x1: number }[] {
  return [
    { zone: 'towRear' as const, x0: sToX(0), x1: sToX(z.sTowRearMax) },
    { zone: 'translate' as const, x0: sToX(z.sTowRearMax), x1: sToX(z.sSpinMin) },
    { zone: 'spin' as const, x0: sToX(z.sSpinMin), x1: sToX(z.sTowFrontMin) },
    { zone: 'towFront' as const, x0: sToX(z.sTowFrontMin), x1: sToX(1) },
  ];
}

export const ChairChip = memo(function ChairChip({
  id,
  writer,
  color,
  number,
  selected,
  active,
  ariaLabel,
  zoneCursors,
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
      {/* 선택 링 — 차체보다 살짝 크게 둘러 그린다. 어두운 밑선 위에 액센트 파선을 얹어
          어떤 팀 색·코트 밝기에서도 보이게 한다(단색 한 겹이면 팀 색과 겹쳐 사라진다). */}
      {selected && (
        <g className="sel-ring" pointerEvents="none">
          <rect
            x={-CHAIR.pivotToRearPx - SEL_PAD}
            y={-HALF_W - SEL_PAD}
            width={CHAIR.lengthPx + SEL_PAD * 2}
            height={CHAIR.widthPx + SEL_PAD * 2}
            rx={5 + SEL_PAD}
            fill="none"
            stroke="rgba(0,0,0,.65)"
            strokeWidth={4.5}
          />
          <rect
            x={-CHAIR.pivotToRearPx - SEL_PAD}
            y={-HALF_W - SEL_PAD}
            width={CHAIR.lengthPx + SEL_PAD * 2}
            height={CHAIR.widthPx + SEL_PAD * 2}
            rx={5 + SEL_PAD}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={2.2}
            strokeDasharray="6 4"
          />
        </g>
      )}
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
      {/* 차체 위 4개 존에 각각 다른 커서를 얹는다 — 어디를 잡느냐로 동작이 갈리므로
          누르기 전에 커서만 보고 알 수 있어야 한다. 투명 사각형이라 그림에는 영향이 없고,
          onPointerDown 은 부모 <g> 로 버블링되므로 기존 히트 처리도 그대로다.
          **선택된 칩에만** 얹는다: 코트에 9대가 있는데 전부 존 커서를 물고 있으면
          어느 칩이 조작 대상인지 흐려지고, 지나가기만 해도 커서가 계속 바뀌어 시끄럽다. */}
      {selected && zoneCursors &&
        zoneSpans(zoneCursors).map((z) => (
          <rect
            key={z.zone}
            x={z.x0}
            y={-HALF_W}
            width={z.x1 - z.x0}
            height={CHAIR.widthPx}
            fill="transparent"
            style={{ cursor: ZONE_CURSOR[z.zone] }}
          />
        ))}
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
