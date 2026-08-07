// §6.6/§7.1 규칙 존. 프로토타입의 `fill: var(--accent) opacity:.1` 은 합성 대비 1.19:1 로
// 폐기됐다 — 쓰지 않는다. 흰 .14 채움 + 파선 흰 테두리(5.34:1)로 대체한다: 면이 아니라
// 파선 테두리가 기능을 전달한다.
import { memo } from 'react';
import { COURT_DEFS, type CourtMode } from '../model/court.ts';

export interface RuleZonesProps {
  mode: CourtMode;
  /** 프로토타입 `showRuleZones` 토글과 동일 — 기본은 숨김. */
  visible: boolean;
}

export const RuleZones = memo(function RuleZones({ mode, visible }: RuleZonesProps) {
  if (!visible) return null;
  const zones = COURT_DEFS[mode].ruleZones;
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
