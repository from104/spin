// §5.12/§6.4 존 핸들.
//
// 좌표계: 핸들은 **차체 로컬 프레임**에 그리고, 그룹 전체가 TransformWriter 의 팔로워로
// 등록되어 칩과 똑같은 transform 을 받는다. 로컬에서 핸들 위치는 그냥 (lever, 0) 이므로
// 물리쪽 `zoneHandles()`(= `pointAtLever`)와 정의상 같은 점이 된다 — §5.12 blocker 가 경고한
// "렌더 위치와 래치 레버가 다르면 41px 스냅" 이 구조적으로 불가능해진다.
//
// 예전에는 월드 좌표를 React 로 계산해 그렸는데, 그 값이 선택 시점의 pose 로 고정돼
// 칩을 드래그하면 핸들만 제자리에 남았다(= 따로 놀았다). 60fps 로 움직이는 것은 React 가
// 아니라 writer 여야 한다(§6.1 규칙 1).
import { useEffect, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { CHAIR, INTERACT } from '../core/constants.ts';
import type { ChairId } from '../core/ids.ts';
import type { DragZone } from '../model/chair.ts';
import type { TransformWriter } from './transformWriter.ts';
import { ZONE_CURSOR, ZONE_GLYPH } from './zoneCursors.ts';

const ZONE_ORDER: readonly DragZone[] = ['towRear', 'translate', 'spin', 'towFront'];
const ZONE_LABEL: Record<DragZone, string> = {
  towRear: '후방 견인',
  translate: '평행 이동',
  spin: '제자리 회전',
  towFront: '전방 견인',
};

export interface ZoneHandlesProps {
  /** 선택된 휠체어. null 이면 아무것도 그리지 않는다(§ 선택된 칩에만 표시). */
  chairId: ChairId | null;
  writer: TransformWriter;
  pxPerUnit: number;
  /** 현재 hover 중이거나(마우스/펜) 드래그로 래치된 존 — 강조 표시(§5.12 hover 프리뷰). */
  activeZone: DragZone | null;
  onPointerDown?(zone: DragZone, e: ReactPointerEvent<SVGGElement>): void;
}

export function ZoneHandles({ chairId, writer, pxPerUnit, activeZone, onPointerDown }: ZoneHandlesProps) {
  const ref = useRef<SVGGElement | null>(null);

  useEffect(() => {
    if (!chairId) return;
    writer.registerFollower(chairId, ref.current);
    return () => writer.registerFollower(chairId, null);
  }, [writer, chairId]);

  if (!chairId) return null;

  const viewR = INTERACT.handleViewRadiusCssPx / pxPerUnit;
  const hitR = INTERACT.handleHitRadiusCssPx / pxPerUnit;
  // 차체 위에 얹히는 두 핸들(평행 이동·제자리 회전)은 시각적으로 줄인다 — 전체 코트가 보이는
  // 기본 배율에서 차체 폭이 60 CSS px 밖에 안 돼, 바깥 핸들과 같은 크기면 등번호를 덮는다.
  // 히트 반경(§7.3 44px)은 줄이지 않으므로 터치 타깃은 그대로다.
  const INNER_SCALE = 0.68;

  return (
    <g ref={ref} aria-hidden="true">
      {ZONE_ORDER.map((zone) => {
        const lever = INTERACT.handleLeverPx[zone];
        const active = zone === activeZone;
        // 차체 실제 범위(뒤끝 −7.5 ~ 앞범퍼 +30) 안이냐로 판정한다. 매직넘버로 두면
        // 레버 값을 조정할 때마다 어긋난다.
        const onBody = lever >= -CHAIR.pivotToRearPx && lever <= CHAIR.pivotToFrontPx;
        const r = onBody ? viewR * INNER_SCALE : viewR;
        const glyphScale = (r * 0.78) / 6;
        return (
          <g key={zone} transform={`translate(${lever} 0)`}>
            {/* 피벗 → 핸들 리더 라인 — 어느 휠체어 소속인지 알린다. 차체 밖 핸들에만 그린다
                (차체 안쪽 핸들은 선이 몸통에 묻혀 지저분하기만 하다). */}
            {!onBody && (
              <>
                <line x1={0} y1={0} x2={-lever} y2={0} stroke="rgba(0,0,0,.5)" strokeWidth={2.6} strokeLinecap="round" />
                <line x1={0} y1={0} x2={-lever} y2={0} stroke="rgba(255,255,255,.7)" strokeWidth={1} strokeDasharray="3 3" />
              </>
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
