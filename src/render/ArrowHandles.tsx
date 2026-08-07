// §6.6 선택된 화살표의 from/ctrl/to 핸들.
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { Vec2 } from '../core/units.ts';
import { INTERACT } from '../core/constants.ts';
import type { Arrow } from '../model/arrow.ts';

export interface ArrowHandlesProps {
  arrow: Arrow | null;
  pxPerUnit: number;
  onPointerDown?(which: 'from' | 'ctrl' | 'to', e: ReactPointerEvent<SVGGElement>): void;
}

export function ArrowHandles({ arrow, pxPerUnit, onPointerDown }: ArrowHandlesProps) {
  if (!arrow) return null;
  const viewR = INTERACT.handleViewRadiusCssPx / pxPerUnit;
  const hitR = INTERACT.handleHitRadiusCssPx / pxPerUnit;
  const points: ReadonlyArray<{ which: 'from' | 'ctrl' | 'to'; p: Vec2 }> = [
    { which: 'from', p: arrow.from },
    { which: 'ctrl', p: arrow.ctrl },
    { which: 'to', p: arrow.to },
  ];

  return (
    <g aria-hidden="true">
      <line x1={arrow.from.x} y1={arrow.from.y} x2={arrow.ctrl.x} y2={arrow.ctrl.y} stroke="rgba(255,255,255,.35)" strokeDasharray="3 3" />
      <line x1={arrow.ctrl.x} y1={arrow.ctrl.y} x2={arrow.to.x} y2={arrow.to.y} stroke="rgba(255,255,255,.35)" strokeDasharray="3 3" />
      {points.map(({ which, p }) => (
        <g key={which} transform={`translate(${p.x} ${p.y})`}>
          <circle r={hitR} fill="transparent" onPointerDown={(e) => onPointerDown?.(which, e)} />
          <circle
            r={viewR}
            fill={which === 'ctrl' ? 'var(--accent)' : '#ffffff'}
            stroke="#000"
            strokeWidth={1.2}
            pointerEvents="none"
          />
        </g>
      ))}
    </g>
  );
}
