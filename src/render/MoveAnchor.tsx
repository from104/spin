// 이동 앵커 — 고른 것을 **통째로 옮기는** 손잡이 하나. 2026-09-13 기현님 지시에서 나왔다:
// 겹쳐 놓인 도형·메모는 몸통을 집기가 어렵다(위에 있는 것이 손을 먼저 먹는다). 앵커는 그
// 겹침 바깥, 상자 위(자리가 없으면 아래)에 떠서 **언제나 집히는 표적**이 되어 준다.
//
// ⚠️ 기존 이동 방법은 하나도 줄지 않는다 — 몸통 드래그·키보드 이동 전부 그대로다. 이 앵커는
// 더한 길이지 바꾼 길이 아니다.
//
// 자리 계산은 여기 한 줄도 없다: `moveAnchorPlacement`(순수)가 화면 좌표로 재고, 부모가 그것을
// 월드로 되돌려 넘긴다. 같은 이유로 `ShapeHandles` 도 `shapeHandlePoints` 를 부른다 —
// 보이는 자리와 잡히는 자리가 한 함수에서 나와야 "보이는데 안 잡힌다" 가 원리적으로 없다.
import type { PointerEvent as ReactPointerEvent } from 'react';
import { INTERACT } from '../core/constants.ts';

export interface MoveAnchorProps {
  /** 월드 좌표. 화면 기준으로 잰 자리를 부모가 `clientToWorld` 로 되돌린 값이다. */
  x: number;
  y: number;
  pxPerUnit: number;
  /** 상자 아래로 뒤집혔는가 — 꼭지가 가리키는 쪽이 바뀐다. */
  below: boolean;
  onPointerDown?(e: ReactPointerEvent<SVGCircleElement>): void;
}

export function MoveAnchor({ x, y, pxPerUnit, below, onPointerDown }: MoveAnchorProps) {
  // 손잡이 셋(도형·화살표·획)과 **같은 상수**를 쓴다. 여기만 다른 크기를 쓰면 같은 판 위에서
  // 표적 크기가 손잡이마다 달라진다.
  const viewR = INTERACT.handleViewRadiusCssPx / pxPerUnit;
  const hitR = INTERACT.handleHitRadiusCssPx / pxPerUnit;
  // 개체 쪽으로 내린 짧은 꼭지 — 이 앵커가 **무엇의** 것인지 잇는 실이다. 없으면 판 위에 점이
  // 하나 떠 있는 것으로만 보인다(도형 손잡이가 같은 이유로 같은 파선을 그린다).
  const stem = (below ? -1 : 1) * (viewR * 1.6);
  const g = viewR * 0.52; // 십자 화살표 반지름

  return (
    <g aria-hidden="true" data-move-anchor="" transform={`translate(${x.toFixed(2)} ${y.toFixed(2)})`}>
      <line x1={0} y1={0} x2={0} y2={stem} stroke="rgba(255,255,255,.5)" strokeDasharray="3 3" pointerEvents="none" />
      {/* 잡는 원은 **보이는 원보다 두 배**다(22 대 11) — 도형 손잡이 주석과 같은 근거다.
          투명하지만 손은 먹는다. 이 원이 겹친 개체들보다 위에 있는 것이 이 기능의 전부다. */}
      <circle r={hitR} fill="transparent" onPointerDown={onPointerDown} style={{ cursor: 'move' }} />
      <circle r={viewR} fill="var(--accent)" stroke="#000" strokeWidth={1.2} pointerEvents="none" />
      {/* 십자 화살표 — "옮기는 것" 이라는 뜻을 그림 하나로 말한다. 도형 손잡이의 흰 점(크기)·
          강조색 점(회전)과 헷갈리지 않게 **모양**으로 가른다(색만으로 말하지 않는다). */}
      <path
        d={`M ${-g} 0 H ${g} M 0 ${-g} V ${g} M ${-g} 0 l ${g * 0.42} ${-g * 0.42} M ${-g} 0 l ${g * 0.42} ${g * 0.42} M ${g} 0 l ${-g * 0.42} ${-g * 0.42} M ${g} 0 l ${-g * 0.42} ${g * 0.42} M 0 ${-g} l ${-g * 0.42} ${g * 0.42} M 0 ${-g} l ${g * 0.42} ${g * 0.42} M 0 ${g} l ${-g * 0.42} ${-g * 0.42} M 0 ${g} l ${g * 0.42} ${-g * 0.42}`}
        stroke="var(--accent-ink)"
        strokeWidth={1.4 / pxPerUnit}
        strokeLinecap="round"
        fill="none"
        pointerEvents="none"
      />
    </g>
  );
}
