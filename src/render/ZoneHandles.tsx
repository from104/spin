// §5.12/§6.4 존 핸들. 렌더 위치는 물리-world 의 `zoneHandles()` 와 **같은 함수**
// (`model/chair.ts` 의 `pointAtLever`)에서 나온다 — 다른 값을 쓰면 핸들을 잡을 때
// 41px(1.65m) 스냅이 생긴다(§5.12 blocker). render-stage 는 physics 런타임을 의존하지 않으므로
// (§8) physics-world 의 zoneHandles() 를 호출하지 않고, 그 함수가 내부적으로 쓰는 것과
// 동일한 model 함수를 직접 호출해 일치를 보장한다.
import type { PointerEvent as ReactPointerEvent } from 'react';
import { INTERACT } from '../core/constants.ts';
import type { ChairPose, DragZone } from '../model/chair.ts';
import { pointAtLever } from '../model/chair.ts';

const ZONE_ORDER: readonly DragZone[] = ['towRear', 'translate', 'spin', 'towFront'];
const ZONE_LABEL: Record<DragZone, string> = {
  towRear: '후방 견인',
  translate: '평행 이동',
  spin: '제자리 회전',
  towFront: '전방 견인',
};

export interface ZoneHandlesProps {
  pose: ChairPose | null;
  pxPerUnit: number;
  visible: boolean;
  /** 현재 hover 중이거나(마우스/펜) 드래그로 래치된 존 — 강조 표시(§5.12 hover 프리뷰). */
  activeZone: DragZone | null;
  onPointerDown?(zone: DragZone, e: ReactPointerEvent<SVGGElement>): void;
}

export function ZoneHandles({ pose, pxPerUnit, visible, activeZone, onPointerDown }: ZoneHandlesProps) {
  if (!visible || !pose) return null;
  const viewR = INTERACT.handleViewRadiusCssPx / pxPerUnit;
  const hitR = INTERACT.handleHitRadiusCssPx / pxPerUnit;

  return (
    <g aria-hidden="true">
      {ZONE_ORDER.map((zone) => {
        const lever = INTERACT.handleLeverPx[zone];
        const pos = pointAtLever(pose, lever);
        const active = zone === activeZone;
        return (
          <g key={zone} transform={`translate(${pos.x} ${pos.y})`}>
            {/* 피벗 → 핸들 리더 라인 — 어느 휠체어 소속인지 알린다. */}
            <line x1={0} y1={0} x2={pose.x - pos.x} y2={pose.y - pos.y} stroke="rgba(255,255,255,.35)" strokeWidth={1} />
            <circle r={hitR} fill="transparent" onPointerDown={(e) => onPointerDown?.(zone, e)} />
            <circle
              r={viewR}
              fill={active ? 'var(--accent)' : 'rgba(255,255,255,.85)'}
              stroke="#000"
              strokeWidth={1}
              opacity={active ? 0.95 : 0.55}
              pointerEvents="none"
            >
              <title>{ZONE_LABEL[zone]}</title>
            </circle>
          </g>
        );
      })}
    </g>
  );
}
