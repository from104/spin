// §6.6/§7.1 규칙 존. 프로토타입의 `fill: var(--accent) opacity:.1` 은 합성 대비 1.19:1 로
// 폐기됐다 — 쓰지 않는다. 흰 .14 채움 + 파선 흰 테두리(5.34:1)로 대체한다: 면이 아니라
// 파선 테두리가 기능을 전달한다.
//
// ── 2026-08-13 기현 지시 ② 로 **채움 색만** 뒤집혔다(위 문장은 기록으로 남긴다) ──────────
// *"골에리어 안쪽 흐린 효과 붉은 계열로 수정 (반칙 표시는 진하게, 그냥은 연하게)"*.
// 흰 .14 → 연한 붉은(RULE_ZONE_FILL α.22). **파선 흰 테두리는 그대로다** — 색은 세 번째
// 채널일 뿐이고(RuleOverlay.tsx:8) 색을 못 보는 코치에게 존을 알려 주는 것은 여전히 이 파선이다.
//
// ⚠️ 같은 손질에서 **요소 `opacity` 를 걷어내고 `fill-opacity` 로 바꿨다.** SVG 의 `opacity` 는
//    fill 과 stroke 에 **함께** 걸리므로 옛 `opacity={0.14}` 는 위 머리말이 5.34:1 이라고 적어
//    둔 그 흰 파선까지 0.14 로 깎고 있었다 — 실측 합성 #599d76 vs 면 #3e8d60 = **1.26:1**, 즉
//    "기능을 전달한다" 던 채널이 사실상 없었다. `stroke="#ffffff"`·`stroke-dasharray="8 6"` 는
//    마크업에 그대로 있었으므로 **마크업 단언은 전부 통과하던 헛통과**다(colors.ts 가
//    2026-08-13 에 정정한 OBJ_STROKE 알파 함정과 같은 형태). 지금 값은 흰 선/면 4.23:1 ·
//    흰 선/코트 5.34:1 이다. 되돌리면 render/ruleZoneFill.test.tsx 의 '흰 파선 채널' 이 빨개진다.
//    ⚠️ CSS 갈고리도 함께 옮겼다 — styles/contrast.css ②③ 은 이제 `fill-opacity` 를 쓴다.
import { memo } from 'react';
import { courtDefFor, type CourtMode, type CourtSize } from '../model/court.ts';
import { RULE_DASH, RULE_OK_STROKE, RULE_ZONE_FILL, RULE_ZONE_FILL_OPACITY } from './ruleOverlay.ts';

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
          fill={RULE_ZONE_FILL}
          fillOpacity={RULE_ZONE_FILL_OPACITY}
          stroke={RULE_OK_STROKE}
          strokeWidth={2}
          strokeDasharray={RULE_DASH}
        />
      ))}
    </g>
  );
});
