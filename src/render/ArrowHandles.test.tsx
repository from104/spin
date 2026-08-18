import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { ArrowHandles } from './ArrowHandles.tsx';
import { ARROW_COLOR_CYCLE, ARROW_STYLE, type Arrow } from '../model/arrow.ts';
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

  it('from/ctrl/to + 회전 앵커, 4개 핸들을 정확한 좌표에 그린다 (앵커는 2026-08-18)', () => {
    const arrow: Arrow = { id: 'ar_1' as ArrowId, from: { x: 0, y: 0 }, ctrl: { x: 5, y: -5 }, to: { x: 10, y: 0 } };
    const { container } = render(
      <svg>
        <ArrowHandles arrow={arrow} pxPerUnit={1} />
      </svg>,
    );
    const groups = container.querySelectorAll('g[transform^="translate"]');
    expect(groups).toHaveLength(4);
    expect(container.querySelector('g[transform="translate(5 -5)"]')).not.toBeNull();
    // 회전 앵커 — mid(5,-2.5)에서 굽힘(위) 반대쪽인 아래로 48: (5, 45.5). 강조색이 회전의
    // 표식이다(도형 회전 손잡이와 같은 색 — 흰 점 셋과 갈라져야 무엇이 도는지 보인다).
    const anchor = container.querySelector('g[transform="translate(5 45.5)"]');
    expect(anchor).not.toBeNull();
    expect(anchor!.querySelector('circle[stroke="#000"]')!.getAttribute('fill')).toBe('var(--accent)');
  });
});

// 2026-08-17 — 굽힘점을 누르면 색이 도니까(useEditorPointer.ts) **그 점이 곧 색 견본**이어야
// 한다. 테마 강조색으로 되돌리면 누르기 전에도 뒤에도 무엇이 바뀌었는지 알 수 없다.
describe('굽힘점은 지금 선 색으로 칠한다', () => {
  const at = (a: Arrow) => {
    const { container } = render(<ArrowHandles arrow={a} pxPerUnit={1} />);
    const g = container.querySelector('g[transform="translate(50 10)"]')!;
    return g.querySelector('circle[stroke="#000"]')!.getAttribute('fill');
  };
  const base: Arrow = { id: 'ar_1' as ArrowId, from: { x: 0, y: 0 }, ctrl: { x: 50, y: 10 }, to: { x: 100, y: 0 } };

  it('색을 안 지정하면 기본색이다', () => {
    expect(at(base)).toBe(ARROW_STYLE.color);
  });

  it('색을 지정하면 그 색이다 — 대조군: 값이 실제로 따라온다', () => {
    expect(at({ ...base, color: ARROW_COLOR_CYCLE[2]! })).toBe(ARROW_COLOR_CYCLE[2]);
  });

  it('양 끝은 여전히 흰 점이다 — 거기서 도는 것은 색이 아니라 화살촉이다', () => {
    const { container } = render(<ArrowHandles arrow={{ ...base, color: ARROW_COLOR_CYCLE[2]! }} pxPerUnit={1} />);
    for (const t of ['translate(0 0)', 'translate(100 0)']) {
      const g = container.querySelector(`g[transform="${t}"]`)!;
      expect(g.querySelector('circle[stroke="#000"]')!.getAttribute('fill')).toBe('#ffffff');
    }
  });
});
