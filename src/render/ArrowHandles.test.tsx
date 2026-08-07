import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { ArrowHandles } from './ArrowHandles.tsx';
import type { Arrow } from '../model/arrow.ts';
import type { ArrowId } from '../core/ids.ts';

describe('ArrowHandles', () => {
  it('arrow=null 이면 아무것도 그리지 않는다', () => {
    const { container } = render(
      <svg>
        <ArrowHandles arrow={null} pxPerUnit={1} />
      </svg>,
    );
    expect(container.querySelectorAll('circle')).toHaveLength(0);
  });

  it('from/ctrl/to 3개 핸들을 정확한 좌표에 그린다', () => {
    const arrow: Arrow = { id: 'ar_1' as ArrowId, kind: 'move', from: { x: 0, y: 0 }, ctrl: { x: 5, y: -5 }, to: { x: 10, y: 0 } };
    const { container } = render(
      <svg>
        <ArrowHandles arrow={arrow} pxPerUnit={1} />
      </svg>,
    );
    const groups = container.querySelectorAll('g[transform^="translate"]');
    expect(groups).toHaveLength(3);
    expect(container.querySelector('g[transform="translate(5 -5)"]')).not.toBeNull();
  });
});
