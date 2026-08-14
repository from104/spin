// 선택된 도형의 손잡이 셋 — 가로 · 세로 · 회전 (기현 결정 2026-08-14).
//
// 모서리 4 + 회전 1(그림 프로그램의 통상)을 안 쓴 이유는 model/shape.ts 의 SHAPE_HANDLES
// 주석에 있다: 44px 짜리를 다섯 개 띄우면 기본 크기 도형이 자기 손잡이에 통째로 덮인다.
//
// 좌표·각도 산수는 **한 줄도 여기 없다.** 전부 `shapeHandlePoints`(순수)에서 온다 — 화면과
// 포인터 판정이 같은 함수를 써야 "보이는 자리를 짚었는데 안 잡히는" 어긋남이 원리적으로 없다.
import type { PointerEvent as ReactPointerEvent } from 'react';
import { INTERACT } from '../core/constants.ts';
import { SHAPE_HANDLES, shapeHandlePoints, shapeSize } from '../model/shape.ts';
import type { Shape, ShapeHandle } from '../model/shape.ts';

export interface ShapeHandlesProps {
  shape: Shape | null;
  pxPerUnit: number;
  onPointerDown?(which: ShapeHandle, e: ReactPointerEvent<SVGGElement>): void;
}

export function ShapeHandles({ shape, pxPerUnit, onPointerDown }: ShapeHandlesProps) {
  if (!shape) return null;
  const viewR = INTERACT.handleViewRadiusCssPx / pxPerUnit;
  const hitR = INTERACT.handleHitRadiusCssPx / pxPerUnit;
  const pts = shapeHandlePoints(shape);
  const { w, h } = shapeSize(shape);

  return (
    <g aria-hidden="true" data-shape-handles="">
      {/* 손잡이가 어느 변의 것인지 잇는 실 — 도형이 회전해 있으면 "이 점이 세로였나 가로였나"
          가 눈으로 안 잡힌다. 화살표 핸들이 같은 이유로 같은 실을 그린다. */}
      {SHAPE_HANDLES.map((which) => (
        <line
          key={`l-${which}`}
          x1={shape.x}
          y1={shape.y}
          x2={pts[which].x}
          y2={pts[which].y}
          stroke="rgba(255,255,255,.35)"
          strokeDasharray="3 3"
          pointerEvents="none"
        />
      ))}
      {SHAPE_HANDLES.map((which) => (
        <g key={which} transform={`translate(${pts[which].x} ${pts[which].y})`}>
          {/* 잡는 원은 **보이는 원보다 두 배**다(22 대 11). 발 마우스·입 젓가락이 이 앱의
              기준이라, 눈에 보이는 크기로 조준하게 두면 매번 빗나간다. */}
          <circle r={hitR} fill="transparent" onPointerDown={(e) => onPointerDown?.(which, e)} style={{ cursor: 'pointer' }} />
          <circle
            r={viewR}
            fill={which === 'rotate' ? 'var(--accent)' : '#ffffff'}
            stroke="#000"
            strokeWidth={1.2}
            pointerEvents="none"
          />
          {/* 회전 손잡이만 색이 다르다 — 셋이 같은 흰 점이면 어느 것이 크기고 어느 것이
              회전인지 매번 시행착오로 알아내야 한다. 크기 둘은 실이 향하는 변이 말해 준다. */}
        </g>
      ))}
      {/* 지금 크기 — 미터로 적는다(월드 px / 25). 손잡이를 끄는 동안 "몇 m 짜리 구역인가" 를
          숫자로 못 보면 코트 위 다른 것과 견주는 수밖에 없다. 회전 중에는 안 바뀌므로 그대로 둔다. */}
      <text
        x={shape.x}
        y={shape.y}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={11 / pxPerUnit}
        fill="rgba(255,255,255,.85)"
        pointerEvents="none"
      >
        {(w / 25).toFixed(1)} × {(h / 25).toFixed(1)} m
      </text>
    </g>
  );
}
