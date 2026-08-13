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
//
// ── ⚠️⚠️ 2026-08-13 6차 검증관 정정 — 위 1~3행·7~8행의 뒷문장은 **사실이 아니다** ──────────
// *"면이 아니라 파선 테두리가 기능을 전달한다"* / *"존을 알려 주는 것은 여전히 이 파선이다"*
// 는 옛 `opacity` 함정을 걷어낸 **뒤에도** 성립하지 않는다. 이유는 알파가 아니라 **기하**다:
// 이 rect 의 네 변은 코트 자신의 흰 실선 위에 **정확히 겹쳐** 그어지고, 그 실선이 더 굵다.
//   · 존 rect stroke-width **2** (파선 8 6)
//   · 골 지역 실선 stroke-width **2.8** (위·오른·아래 세 변을 덮는다)
//   · 외곽선 실선 stroke-width **3** (골라인 쪽 네 번째 변을 덮는다)
// 파선의 빈칸에는 아래 실선이 그대로 보이므로 파선은 **연속된 흰 선으로 뭉개진다** — 존을
// 켜고 끄는 차이는 화면에서 **면(fill)뿐**이다. 즉 위 15행의 "흰 선/면 4.23:1" 은 화면에
// 나타나지 않는 색쌍의 값이다(흰 선은 면 위가 아니라 흰 실선 위에 얹힌다).
// 옛 문장을 지우지 않는 이유는 기록이기 때문이고, 사실은 render/ruleZoneFill.test.tsx 의
// '규칙 존의 흰 파선은 코트 실선에 완전히 가려진다' 가 **네 변 전부** 붙잡는다(대조군 포함).
// 되돌리려면(= 파선을 실제로 보이게) stroke-width 를 코트 실선보다 굵히거나 rect 를 안쪽으로
// 들여야 하고, 둘 다 판의 그림을 바꾸는 결정이라 **기현님 판단 없이 하지 않았다**.
// 다행히 골 지역의 경계 자체는 코트 실선이 언제나 그리므로 잃은 정보는 없다 — 잃은 것은
// "파선이 존을 알려 준다" 는 **설명**이지 경계선이 아니다.
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
