// §7.1 규칙 존 대비 조치 검증: accent .10 이 아니라 흰 .14 + 파선 흰 테두리를 쓰는지 확인한다.
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { RuleZones } from './RuleZones.tsx';

describe('RuleZones', () => {
  it('visible=false 면 아무것도 그리지 않는다', () => {
    const { container } = render(
      <svg>
        <RuleZones mode="full" visible={false} />
      </svg>,
    );
    expect(container.querySelectorAll('rect')).toHaveLength(0);
  });

  it('full: 존 2개를 흰 .14 채움 + 파선(8 6) 흰 테두리로 그린다 — accent 는 쓰지 않는다', () => {
    const { container } = render(
      <svg>
        <RuleZones mode="full" visible />
      </svg>,
    );
    const rects = container.querySelectorAll('rect');
    expect(rects).toHaveLength(2);
    rects.forEach((r) => {
      expect(r).toHaveAttribute('fill', '#ffffff');
      expect(r).toHaveAttribute('opacity', '0.14');
      expect(r).toHaveAttribute('stroke', '#ffffff');
      expect(r).toHaveAttribute('stroke-dasharray', '8 6');
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
