// §10.7 SelectionOverlay — "직접 DOM 조작"(§6.6) 계약: 부모가 ref 메서드를 호출하면 즉시
// DOM 속성이 바뀐다(React state 를 거치지 않는다 → act() 없이도 반영돼야 한다).
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { createRef } from 'react';
import { SelectionOverlay, type SelectionOverlayHandle } from './SelectionOverlay.tsx';

function setup() {
  const ref = createRef<SelectionOverlayHandle>();
  const { container } = render(
    <svg>
      <SelectionOverlay ref={ref} />
    </svg>,
  );
  return { ref, container };
}

describe('SelectionOverlay', () => {
  it('setRing("chair", ...) 은 React 리렌더 없이 즉시 transform 을 쓴다', () => {
    const { ref, container } = setup();
    // setRing(null) 상태(초기값)에서는 링이 숨겨져 있다(대조군).
    const initialRing = container.querySelector('rect[rx="8"]')!.parentElement as unknown as SVGGElement;
    expect(initialRing.style.display).toBe('none');

    ref.current!.setRing('chair', 12, -34, Math.PI);
    const ringGroup = container.querySelector('rect[rx="8"]')!.parentElement as unknown as SVGGElement;
    expect(ringGroup.style.display).toBe('');
    expect(ringGroup.getAttribute('transform')).toBe('translate(12.00 -34.00) rotate(180.00)');

    // setRing("ball", ...) 은 원형 링을 보이고 사각 링은 숨긴다.
    ref.current!.setRing('ball', 0, 0, 0);
    const rect = container.querySelector('rect[rx="8"]') as SVGRectElement;
    const circle = container.querySelector('circle[r="12"]') as SVGCircleElement;
    expect(rect.style.display).toBe('none');
    expect(circle.style.display).toBe('');
  });

  it('setRubberBand 은 x/y/width/height 를 갱신하고 null 이면 숨긴다', () => {
    const { ref, container } = setup();
    ref.current!.setRubberBand({ x: 10, y: 20, w: 30, h: 40 });
    const band = container.querySelector('rect[stroke-dasharray="5 4"]')!;
    expect(band).toHaveAttribute('x', '10');
    expect(band).toHaveAttribute('width', '30');
    ref.current!.setRubberBand(null);
    expect((band as SVGRectElement).style.display).toBe('none');
  });

  it('setLeash 는 line 의 x1/y1/x2/y2 를 갱신한다(§5.11 지연 시각화)', () => {
    const { ref, container } = setup();
    ref.current!.setLeash({ x: 1, y: 2 }, { x: 3, y: 4 });
    const line = container.querySelector('line')!;
    expect(line).toHaveAttribute('x1', '1.00');
    expect(line).toHaveAttribute('y2', '4.00');
  });

  it('setGhost(null) 은 고스트를 숨긴다', () => {
    const { ref, container } = setup();
    ref.current!.setGhost('cone', 5, 5, 0);
    const ghost = Array.from(container.querySelectorAll('g')).find((g) => g.getAttribute('opacity') === '0.35')!;
    expect(ghost.style.display).toBe('');
    ref.current!.setGhost(null, 0, 0, 0);
    expect(ghost.style.display).toBe('none');
  });
});
