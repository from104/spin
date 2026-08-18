// §6.6 선택된 화살표의 from/ctrl/to 핸들 + 회전 앵커(2026-08-18 기현 지시).
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { Vec2 } from '../core/units.ts';
import { INTERACT } from '../core/constants.ts';
import { arrowColor, arrowMid, arrowRotateHandlePoint, type Arrow, type ArrowGrip } from '../model/arrow.ts';

export interface ArrowHandlesProps {
  arrow: Arrow | null;
  pxPerUnit: number;
  /** 키보드 조준점(§4.3 1.11) — Shift+방향키가 옮길 점을 링으로 표시한다. */
  onPointerDown?(which: ArrowGrip, e: ReactPointerEvent<SVGGElement>): void;
}

export function ArrowHandles({ arrow, pxPerUnit, onPointerDown }: ArrowHandlesProps) {
  if (!arrow) return null;
  const viewR = INTERACT.handleViewRadiusCssPx / pxPerUnit;
  const hitR = INTERACT.handleHitRadiusCssPx / pxPerUnit;
  const mid = arrowMid(arrow);
  const rotP = arrowRotateHandlePoint(arrow);
  const points: ReadonlyArray<{ which: ArrowGrip; p: Vec2 }> = [
    { which: 'from', p: arrow.from },
    { which: 'ctrl', p: arrow.ctrl },
    { which: 'to', p: arrow.to },
    { which: 'rotate', p: rotP },
  ];

  return (
    <g aria-hidden="true">
      <line x1={arrow.from.x} y1={arrow.from.y} x2={arrow.ctrl.x} y2={arrow.ctrl.y} stroke="rgba(255,255,255,.35)" strokeDasharray="3 3" />
      <line x1={arrow.ctrl.x} y1={arrow.ctrl.y} x2={arrow.to.x} y2={arrow.to.y} stroke="rgba(255,255,255,.35)" strokeDasharray="3 3" />
      {/* 회전 앵커의 실 — 곡선 한가운데(회전축)에서 앵커까지. 도형 손잡이의 실과 같은 이유다:
          실이 없으면 선 옆에 뜬 점 하나가 무엇의 손잡이인지, 무엇을 축으로 도는지 안 보인다. */}
      <line x1={mid.x} y1={mid.y} x2={rotP.x} y2={rotP.y} stroke="rgba(255,255,255,.35)" strokeDasharray="3 3" />
      {points.map(({ which, p }) => (
        <g key={which} transform={`translate(${p.x} ${p.y})`}>
          <circle r={hitR} fill="transparent" onPointerDown={(e) => onPointerDown?.(which, e)} />
          {/* 굽힘점은 **지금 선 색**으로 칠한다(2026-08-17). 여기를 누르면 색이 도니까
              (useEditorPointer.ts) 이 점이 곧 색 견본이어야 한다 — 테마 강조색(var(--accent))
              으로 두면 누르기 전에는 무엇이 바뀔지 알 수 없고, 누른 뒤에도 바뀐 티가 안 난다.
              양 끝이 흰 점인 것은 그대로다: 거기서 도는 것은 색이 아니라 화살촉이다.
              회전 앵커는 도형의 회전 손잡이와 같은 강조색이다 — 앱 안에서 "이 색 점 = 회전"
              이 이미 한 번 학습됐고, 흰 점 셋과 갈라져야 넷 중 무엇이 조작을 바꾸는지 보인다. */}
          <circle
            r={viewR}
            fill={which === 'ctrl' ? arrowColor(arrow) : which === 'rotate' ? 'var(--accent)' : '#ffffff'}
            stroke="#000"
            strokeWidth={1.2}
            pointerEvents="none"
          />
        </g>
      ))}
    </g>
  );
}
