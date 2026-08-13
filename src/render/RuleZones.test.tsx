// §7.1 규칙 존 대비 조치 검증: accent .10 이 아니라 **연한 붉은 .22 + 파선 흰 테두리**를 쓰는지
// 확인한다(2026-08-13 기현 지시 ② 로 흰 .14 → 붉은 계열. 채움이 왜 이 값인지·두 상태가 왜
// 갈리는지는 render/ruleZoneFill.test.tsx 가 합성색을 계산해 잰다).
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { RuleZones } from './RuleZones.tsx';
import { RULE_DASH, RULE_OK_STROKE, RULE_ZONE_FILL, RULE_ZONE_FILL_OPACITY } from './ruleOverlay.ts';

describe('RuleZones', () => {
  it('visible=false 면 아무것도 그리지 않는다', () => {
    const { container } = render(
      <svg>
        <RuleZones mode="full" visible={false} />
      </svg>,
    );
    expect(container.querySelectorAll('rect')).toHaveLength(0);
  });

  it('full: 존 2개를 연한 붉은 .22 채움 + 파선(8 6) 흰 테두리로 그린다 — accent 는 쓰지 않는다', () => {
    const { container } = render(
      <svg>
        <RuleZones mode="full" visible />
      </svg>,
    );
    const rects = container.querySelectorAll('rect');
    expect(rects).toHaveLength(2);
    rects.forEach((r) => {
      expect(r).toHaveAttribute('fill', RULE_ZONE_FILL);
      expect(Number(r.getAttribute('fill-opacity'))).toBe(RULE_ZONE_FILL_OPACITY);
      // ⚠️ 요소 `opacity` 로 농도를 주지 않는다 — fill 과 stroke 에 함께 걸려 흰 파선까지
      //    깎는다(옛 .14 에서 흰 선/면이 1.26:1 이었다. RuleZones.tsx 머리말 참고).
      expect(r).not.toHaveAttribute('opacity');
      expect(r).toHaveAttribute('stroke', RULE_OK_STROKE);
      expect(r).toHaveAttribute('stroke-dasharray', RULE_DASH);
    });
  });

  it('flat 은 규칙존이 없다', () => {
    const { container } = render(
      <svg>
        <RuleZones mode="flat" visible />
      </svg>,
    );
    expect(container.querySelectorAll('rect')).toHaveLength(0);
  });
});
