// §3.5 선택된 획의 손잡이 셋(기현 지시 2026-09-03: *"3개의 앵커 회전, 양끝 화살표 그냥 클릭
// 3단계, 약간 외각에 회전(드래그는 회전, 그냥 클릭은 색 순환)"*).
//
// `ArrowHandles` 를 본떴다 — 크기(INTERACT.handle*Radius)·테두리·pointer-events 규약이 한 줄도
// 다르지 않다. 손이 화살표에서 배운 자리를 획에서 다시 배우지 않아도 되게 하는 것이 요점이다.
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { Vec2 } from '../core/units.ts';
import { INTERACT } from '../core/constants.ts';
import { strokeCenter, strokeColor, strokeHandlePoints, type Stroke, type StrokeGrip } from '../model/stroke.ts';

export interface StrokeHandlesProps {
  stroke: Stroke | null;
  pxPerUnit: number;
  onPointerDown?(which: StrokeGrip, e: ReactPointerEvent<SVGGElement>): void;
}

export function StrokeHandles({ stroke, pxPerUnit, onPointerDown }: StrokeHandlesProps) {
  if (!stroke) return null;
  const viewR = INTERACT.handleViewRadiusCssPx / pxPerUnit;
  const hitR = INTERACT.handleHitRadiusCssPx / pxPerUnit;
  const { from, to, rotate } = strokeHandlePoints(stroke);
  // 실이 나오는 자리는 **회전축**이다 — 획을 도는 축은 경계상자 중심(`rotateStrokeAbout` 의
  // 계약)이라, 실을 끝점에서 뽑으면 앵커가 무엇을 축으로 도는지 거짓말을 한다.
  const axis = strokeCenter(stroke);
  const color = strokeColor(stroke);
  const points: ReadonlyArray<{ which: StrokeGrip; p: Vec2 }> = [
    { which: 'from', p: from },
    { which: 'to', p: to },
    { which: 'rotate', p: rotate },
  ];

  return (
    <g aria-hidden="true">
      {/* 회전 앵커의 실 — 축에서 앵커까지. 도형·화살표 손잡이와 같은 이유다: 실이 없으면
          선 옆에 뜬 점 하나가 무엇의 손잡이인지, 무엇을 축으로 도는지 안 보인다.
          ⚠️ 획에는 화살표의 from–ctrl–to 실이 없다 — 굽힘점이 없어서 이을 자리가 없다. */}
      <line x1={axis.x} y1={axis.y} x2={rotate.x} y2={rotate.y} stroke="rgba(255,255,255,.35)" strokeDasharray="3 3" />
      {points.map(({ which, p }) => (
        <g key={which} transform={`translate(${p.x} ${p.y})`}>
          <circle r={hitR} fill="transparent" onPointerDown={(e) => onPointerDown?.(which, e)} />
          {/* 양 끝은 흰 점 — 화살표와 같다(거기서 도는 것은 색이 아니라 화살촉이다).
              회전 앵커만 화살표와 다르게 생겼고, 그럴 수밖에 없다: 화살표는 색 순환을
              굽힘점(ctrl)이 지고 회전 앵커는 회전만 하는데, **획에는 굽힘점이 없어서**
              색 순환이 회전 앵커로 합쳐졌다(기현 지시). 일이 둘이니 표시도 둘이다 —
              속은 **지금 선 색**(누르면 여기가 바뀐다는 견본), 테는 **강조색**(도형·화살표에서
              이미 학습된 '이 색 = 회전'). 하나만 쓰면 나머지 한 조작이 화면에서 사라진다. */}
          <circle
            r={viewR}
            fill={which === 'rotate' ? color : '#ffffff'}
            stroke={which === 'rotate' ? 'var(--accent)' : '#000'}
            strokeWidth={which === 'rotate' ? 2 : 1.2}
            pointerEvents="none"
          />
        </g>
      ))}
    </g>
  );
}
