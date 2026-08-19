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
import { ZONE_LABEL } from '../model/chair.ts';
import type { TransformWriter } from './transformWriter.ts';
import { ZONE_CURSOR, ZONE_GLYPH } from './zoneCursors.ts';
import { useLocale } from '../i18n/useLocale.ts';

/** 화면에 그리는 핸들은 **차체 밖 견인 가이드 둘뿐**이다(기현 지시 2026-08-11).
 *
 *  2구역 재편 뒤로 차체 자체가 곧 '뒤 절반 = 그대로 이동 / 앞 절반 = 제자리 회전' 이고,
 *  그 둘은 음영과 마우스 커서로 이미 표시된다. 같은 자리에 핸들까지 얹으면 등번호를 가리고
 *  무엇을 잡아야 하는지가 오히려 흐려진다. 반대로 견인은 차체 밖에서만 잡히므로
 *  가이드가 없으면 그런 조작이 있다는 것 자체를 알 수 없다 — 그래서 앞뒤만 남긴다.
 *  차체 위 커서 변형은 ChairChip 이 계속 담당한다. */
const ZONE_ORDER: readonly DragZone[] = ['towRear', 'towFront'];

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
  const locale = useLocale();

  useEffect(() => {
    if (!chairId) return;
    writer.registerFollower(chairId, ref.current);
    return () => writer.registerFollower(chairId, null);
  }, [writer, chairId]);

  if (!chairId) return null;

  const viewR = INTERACT.handleViewRadiusCssPx / pxPerUnit;
  const hitR = INTERACT.handleHitRadiusCssPx / pxPerUnit;
  const glyphScale = (viewR * 0.78) / 6;

  return (
    <g ref={ref} aria-hidden="true">
      {ZONE_ORDER.map((zone) => {
        const lever = INTERACT.handleLeverPx[zone];
        const active = zone === activeZone;
        // 리더 라인은 **차체 앞에서 멈춘다**. 예전에는 피벗까지 그어 차체를 가로질렀는데,
        // 몸통을 덮어 지저분한 데다 포인터까지 가로채 등번호 근처에서 존 커서가 죽었다.
        const bodyEdge = lever < 0 ? -CHAIR.pivotToRearPx : CHAIR.pivotToFrontPx;
        const leaderEnd = bodyEdge - lever; // 핸들 로컬 좌표
        return (
          <g key={zone} transform={`translate(${lever} 0)`}>
            {/* 핸들 → 차체 리더 라인 — 어느 휠체어 소속인지 알린다. 포인터는 통과시킨다. */}
            <line x1={0} y1={0} x2={leaderEnd} y2={0} stroke="rgba(0,0,0,.5)" strokeWidth={2.6} strokeLinecap="round" pointerEvents="none" />
            <line x1={0} y1={0} x2={leaderEnd} y2={0} stroke="rgba(255,255,255,.7)" strokeWidth={1} strokeDasharray="3 3" pointerEvents="none" />
            <circle
              r={hitR}
              fill="transparent"
              style={{ cursor: ZONE_CURSOR[zone] }}
              onPointerDown={(e) => onPointerDown?.(zone, e)}
            />
            {/* 어두운 테두리를 먼저 깔아 밝은 차체·코트 어디에 놓여도 원의 경계가 살아 있게 한다. */}
            <circle r={viewR} fill={active ? 'var(--accent)' : '#ffffff'} stroke="rgba(0,0,0,.75)" strokeWidth={2} pointerEvents="none">
              <title>{ZONE_LABEL[locale][zone]}</title>
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
