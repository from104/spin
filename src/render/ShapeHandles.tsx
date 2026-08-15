// 선택된 도형의 손잡이 — 사각형·타원은 셋(대각 모서리 2 + 회전), **삼각형은 넷**(꼭짓점 3 +
// 회전). 셋 다 2026-08-15 기현 지시로 정해졌고, 그 전(2026-08-14)에는 전부 가로·세로·회전이었다.
//
// 모서리 4 + 회전 1(그림 프로그램의 통상)을 안 쓴 이유와, 삼각형만 넷인 이유(페르마 점)는
// 전부 model/shape.ts 의 `ShapeHandle` 주석에 있다. 여기서 목록을 세지 않고 `shapeHandlesFor`
// 를 부르는 것이 그 규칙의 유일한 출처를 하나로 두는 방법이다.
//
// 좌표·각도 산수는 **한 줄도 여기 없다.** 전부 `shapeHandlePoints`(순수)에서 온다 — 화면과
// 포인터 판정이 같은 함수를 써야 "보이는 자리를 짚었는데 안 잡히는" 어긋남이 원리적으로 없다.
import type { PointerEvent as ReactPointerEvent } from 'react';
import { INTERACT } from '../core/constants.ts';
import { shapeHandlePoints, shapeHandlesFor, shapeSize } from '../model/shape.ts';
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
  // 이 도형이 실제로 내는 손잡이만 돈다 — 삼각형은 꼭짓점 3 + 회전, 나머지는 가로·세로·회전.
  const handles = shapeHandlesFor(shape.kind);
  const at = (k: ShapeHandle) => pts[k]!;

  return (
    <g aria-hidden="true" data-shape-handles="">
      {/* 손잡이가 어느 변의 것인지 잇는 실 — 도형이 회전해 있으면 "이 점이 세로였나 가로였나"
          가 눈으로 안 잡힌다. 화살표 핸들이 같은 이유로 같은 실을 그린다. */}
      {handles.map((which) => (
        <line
          key={`l-${which}`}
          x1={shape.x}
          y1={shape.y}
          x2={at(which).x}
          y2={at(which).y}
          stroke="rgba(255,255,255,.35)"
          strokeDasharray="3 3"
          pointerEvents="none"
        />
      ))}
      {handles.map((which) => (
        <g key={which} transform={`translate(${at(which).x} ${at(which).y})`}>
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
          {/* 회전 손잡이만 색이 다르다 — 전부 같은 흰 점이면 어느 것이 모양이고 어느 것이
              회전인지 매번 시행착오로 알아내야 한다. 나머지는 실이 향하는 곳이 말해 준다
              (상자 도형은 가로·세로 변, 삼각형은 꼭짓점 셋). */}
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
