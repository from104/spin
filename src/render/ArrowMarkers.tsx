// §6.6 화살표 마커. 마커 id 는 SVG 루트마다 유일해야 한다 — 전역 고정 id(mkAmber 등)를 쓰면
// url(#id) 참조가 문서 순서상 첫 번째로 해석되어 목록 카드 다중 인스턴스에서 화살촉이
// 사라지거나 깜빡인다. 화살표 본선과 마찬가지로 마커도 케이싱(halo)을 먼저 그린다 —
// #38bdf8 는 코트 대비 2.49:1 로 WCAG 1.4.11 미달이라 검정 케이싱(3.93:1)이 필수다.
import { ARROW_CASING } from '../core/colors.ts';

export interface ArrowMarkersProps {
  /** 이 SVG 루트에서 유일해야 하는 접두사. `useId()` 결과를 그대로 넘긴다. */
  uid: string;
  /** 이 SVG 안에서 실제로 쓰인 색 집합만큼만 만든다(보통 1~2개). */
  colors: readonly string[];
}

const HEAD_D = 'M0,0 L6.5,3.2 L0,6.4 z';

export function ArrowMarkers({ uid, colors }: ArrowMarkersProps) {
  return (
    <>
      <marker id={`${uid}-casing`} markerWidth={7} markerHeight={7} refX={5} refY={3.2} orient="auto">
        <path d={HEAD_D} fill={ARROW_CASING} />
      </marker>
      {colors.map((color) => (
        <marker
          key={color}
          id={`${uid}-${color.slice(1)}`}
          markerWidth={7}
          markerHeight={7}
          refX={5}
          refY={3.2}
          orient="auto"
        >
          <path d={HEAD_D} fill={color} />
        </marker>
      ))}
    </>
  );
}
