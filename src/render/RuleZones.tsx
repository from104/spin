// §6.6/§7.1 규칙 존. 프로토타입의 `fill: var(--accent) opacity:.1` 은 합성 대비 1.19:1 로
// 폐기됐다 — 쓰지 않는다. 흰 .14 채움 + 파선 흰 테두리(5.34:1)로 대체한다: 면이 아니라
// 파선 테두리가 기능을 전달한다.
import { memo } from 'react';
import { courtDefFor, type CourtMode, type CourtSize } from '../model/court.ts';

export interface RuleZonesProps {
  mode: CourtMode;
  /** §6.4 — 골 지역(8×5 m)의 **깊이는 절대 치수라 안 변하지만 자리는 변한다**: 골라인이
   *  코트 크기를 따라 움직이기 때문이다(25×14 의 오른쪽 골 지역 x=537.5, 30×18 은 662.5). */
  size?: CourtSize;
  /** 프로토타입 `showRuleZones` 토글과 동일 — 기본은 숨김. */
  visible: boolean;
}

export const RuleZones = memo(function RuleZones({ mode, size, visible }: RuleZonesProps) {
  if (!visible) return null;
  const zones = courtDefFor(mode, size).ruleZones;
  if (zones.length === 0) return null;

  return (
    <g>
      {zones.map((z) => (
        <rect
          key={`${z.x},${z.y}`}
          x={z.x}
          y={z.y}
          width={z.w}
          height={z.h}
          fill="#ffffff"
          opacity={0.14}
          stroke="#ffffff"
          strokeWidth={2}
          strokeDasharray="8 6"
        />
      ))}
    </g>
  );
});
