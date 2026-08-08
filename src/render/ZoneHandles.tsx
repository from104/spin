// §5.12/§6.4 존 핸들. 렌더 위치는 물리-world 의 `zoneHandles()` 와 **같은 함수**
// (`model/chair.ts` 의 `pointAtLever`)에서 나온다 — 다른 값을 쓰면 핸들을 잡을 때
// 41px(1.65m) 스냅이 생긴다(§5.12 blocker). render-stage 는 physics 런타임을 의존하지 않으므로
// (§8) physics-world 의 zoneHandles() 를 호출하지 않고, 그 함수가 내부적으로 쓰는 것과
// 동일한 model 함수를 직접 호출해 일치를 보장한다.
import type { PointerEvent as ReactPointerEvent } from 'react';
import { INTERACT } from '../core/constants.ts';
import type { ChairPose, DragZone } from '../model/chair.ts';
import { pointAtLever } from '../model/chair.ts';
import { ZONE_CURSOR, ZONE_GLYPH } from './zoneCursors.ts';

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
  // 차체 위에 얹히는 두 핸들(평행 이동·제자리 회전)은 시각적으로 줄인다 — 전체 코트가 보이는
  // 기본 배율에서 차체 폭이 60 CSS px 밖에 안 돼, 바깥 핸들과 같은 크기면 등번호를 덮는다.
  // 히트 반경(§7.3 44px)은 줄이지 않으므로 터치 타깃은 그대로다.
  const INNER_SCALE = 0.68;

  return (
    <g aria-hidden="true">
      {ZONE_ORDER.map((zone) => {
        const lever = INTERACT.handleLeverPx[zone];
        const pos = pointAtLever(pose, lever);
        const active = zone === activeZone;
        const onBody = Math.abs(lever) <= 33;
        const r = onBody ? viewR * INNER_SCALE : viewR;
        const glyphScale = (r * 0.78) / 6;
        return (
          <g key={zone} transform={`translate(${pos.x} ${pos.y})`}>
            {/* 피벗 → 핸들 리더 라인 — 어느 휠체어 소속인지 알린다. 차체 밖 핸들에만 그린다
                (차체 안쪽 핸들은 선이 몸통에 묻혀 지저분하기만 하다). */}
            {!onBody && (
              <line
                x1={0}
                y1={0}
                x2={pose.x - pos.x}
                y2={pose.y - pos.y}
                stroke="rgba(0,0,0,.5)"
                strokeWidth={2.6}
                strokeLinecap="round"
              />
            )}
            {!onBody && (
              <line
                x1={0}
                y1={0}
                x2={pose.x - pos.x}
                y2={pose.y - pos.y}
                stroke="rgba(255,255,255,.7)"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
            )}
            <circle
              r={hitR}
              fill="transparent"
              style={{ cursor: ZONE_CURSOR[zone] }}
              onPointerDown={(e) => onPointerDown?.(zone, e)}
            />
            {/* 어두운 테두리를 먼저 깔아 밝은 차체·코트 어디에 놓여도 원의 경계가 살아 있게 한다. */}
            <circle r={r} fill={active ? 'var(--accent)' : '#ffffff'} stroke="rgba(0,0,0,.75)" strokeWidth={2} pointerEvents="none">
              <title>{ZONE_LABEL[zone]}</title>
            </circle>
            <g transform={`scale(${glyphScale})`} pointerEvents="none">
              <path
                d={ZONE_GLYPH[zone]}
                fill="none"
                stroke="#0b0f14"
                strokeWidth={1.7}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            </g>
          </g>
        );
      })}
    </g>
  );
}
