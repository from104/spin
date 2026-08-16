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

  it('조준 링은 더 이상 없다 — 키보드 조준점 개념이 사라졌다(2026-08-16)', () => {
    // Shift 가 어디서나 '정밀'로 통일되면서 "화살표에서만 Shift = 조준점만 이동" 이라는 세
    // 번째 뜻이 설 자리를 잃었고, 조준점을 돌리던 `[`/`]` 는 개체 순회가 가져갔다. 강조할
    // 대상이 없으니 링도 없다 — 끝점 조정은 손잡이를 직접 잡는다.
    const arrow: Arrow = { id: 'ar_1' as ArrowId, from: { x: 0, y: 0 }, ctrl: { x: 5, y: -5 }, to: { x: 10, y: 0 } };
    const { container } = render(
      <svg>
        <ArrowHandles arrow={arrow} pxPerUnit={1} />
      </svg>,
    );
    expect(container.querySelectorAll('.arrow-handle-aim')).toHaveLength(0);
  });

  it('from/ctrl/to 3개 핸들을 정확한 좌표에 그린다', () => {
    const arrow: Arrow = { id: 'ar_1' as ArrowId, from: { x: 0, y: 0 }, ctrl: { x: 5, y: -5 }, to: { x: 10, y: 0 } };
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
