import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { KeyboardCursor } from './KeyboardCursor.tsx';

describe('KeyboardCursor', () => {
  it('visible=true 면 십자 + 라벨을 지정 좌표에 그린다', () => {
    // visible=false 면 아무것도 그리지 않는다(대조군).
    const hidden = render(
      <svg>
        <KeyboardCursor visible={false} x={0} y={0} />
      </svg>,
    ).container;
    expect(hidden.querySelectorAll('g')).toHaveLength(0);

    const { container } = render(
      <svg>
        <KeyboardCursor visible={true} x={62.5} y={387.5} label="c3" />
      </svg>,
    );
    const g = container.querySelector('g')!;
    expect(g).toHaveAttribute('transform', 'translate(62.5 387.5)');
    expect(g.querySelectorAll('line')).toHaveLength(2);
    expect(g.querySelector('text')?.textContent).toBe('c3');
  });
});
