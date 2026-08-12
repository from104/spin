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

  it('activePart 를 주면 그 점에만 조준 링이 붙는다 (§4.3 1.11 키보드 조준)', () => {
    const arrow: Arrow = { id: 'ar_1' as ArrowId, kind: 'move', from: { x: 0, y: 0 }, ctrl: { x: 5, y: -5 }, to: { x: 10, y: 0 } };
    const { container, rerender } = render(
      <svg>
        <ArrowHandles arrow={arrow} pxPerUnit={1} />
      </svg>,
    );
    // 기본(마우스만 쓰는 경우) = 링 없음. 지금까지의 그림이 한 픽셀도 안 바뀐다.
    expect(container.querySelectorAll('.arrow-handle-aim')).toHaveLength(0);

    rerender(
      <svg>
        <ArrowHandles arrow={arrow} pxPerUnit={1} activePart="to" />
      </svg>,
    );
    const rings = container.querySelectorAll('.arrow-handle-aim');
    expect(rings).toHaveLength(1);
    // 링은 끝점(10,0) 그룹 안에 있어야 한다 — 엉뚱한 점을 강조하면 조준 표시가 거짓말이 된다.
    expect(rings[0]!.closest('g[transform]')?.getAttribute('transform')).toBe('translate(10 0)');
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
