// §7.1 규칙 존 — visible=false 일 때 아무것도 그리지 않는지만 여기서 본다. 채움·테두리
// 속성과 모드별 개수는 render/ruleZoneFill.test.tsx 가 합성색까지 계산해 잰다.
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
});
