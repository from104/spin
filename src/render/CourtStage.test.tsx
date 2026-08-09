// §10.7 CourtStage 스모크 검증 — 좌표 변환·포인터 위임·줌 배율 상한, §6.6 레이어 순서.
import { describe, expect, it, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { createRef } from 'react';
import { createTransformWriter } from './transformWriter.ts';
import { CourtStage, type CourtStageHandle, type CourtStagePointerController } from './CourtStage.tsx';
import { INTERACT } from '../core/constants.ts';

/** 기본 rect 는 **풀 코트 viewBox 와 같은 825×525** 다 — 그래야 client↔world 가 1:1 이 되어
 *  좌표 단언이 읽기 쉽다. 마진을 1.5 m 로 넓히며 viewBox 가 800×500 → 825×525 가 됐고,
 *  스텁을 안 따라 바꾸면 'meet' 여백 때문에 중심이 어긋난다(실제로 412.5 가 나왔다). */
function stubSvgLayout(container: HTMLElement, rect: Partial<DOMRect> = {}): void {
  const svg = container.querySelector('svg')!;
  vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    top: 0,
    width: 825,
    height: 525,
    right: 825,
    bottom: 525,
    x: 0,
    y: 0,
    toJSON: () => ({}),
    ...rect,
  } as DOMRect);
  if (!svg.setPointerCapture) svg.setPointerCapture = () => {};
  if (!svg.releasePointerCapture) svg.releasePointerCapture = () => {};
}

function makeController(): CourtStagePointerController & {
  downs: Array<{ x: number; y: number }>;
  ups: number;
} {
  const downs: Array<{ x: number; y: number }> = [];
  let ups = 0;
  return {
    downs,
    get ups() {
      return ups;
    },
    onPointerDown(world) {
      downs.push(world);
    },
    onPointerMove() {},
    onPointerUp() {
      ups++;
    },
  };
}

describe('CourtStage — 레이어 구조(§6.6)', () => {
  it('svg 루트가 role=application, tabIndex=0, viewBox=0 0 825 525(풀코트)를 갖는다', () => {
    const writer = createTransformWriter();
    const controller = makeController();
    const { container } = render(
      <CourtStage
        mode="full"
        variant="editor"
        writer={writer}
        controller={controller}
        showGrid={false}
        showGridLabels={false}
        showRuleZones={false}
        chairs={[]}
        balls={[]}
        cones={[]}
        notes={[]}
        arrows={[]}
        selection={new Set()}
        activeId={null}
      />,
    );
    const svg = container.querySelector('svg')!;
    expect(svg).toHaveAttribute('role', 'application');
    expect(svg).toHaveAttribute('tabindex', '0');
    expect(svg).toHaveAttribute('viewBox', '0 0 825 525');
  });
});

describe('CourtStage — 포인터 위임(§6.4)', () => {
  it('pointerdown 은 world 좌표로 변환해 controller.onPointerDown 을 1회 호출한다', () => {
    const writer = createTransformWriter();
    const controller = makeController();
    const { container } = render(
      <CourtStage
        mode="full"
        variant="editor"
        writer={writer}
        controller={controller}
        showGrid={false}
        showGridLabels={false}
        showRuleZones={false}
        chairs={[]}
        balls={[]}
        cones={[]}
        notes={[]}
        arrows={[]}
        selection={new Set()}
        activeId={null}
      />,
    );
    stubSvgLayout(container);
    const svg = container.querySelector('svg')!;
    svg.dispatchEvent(
      new window.PointerEvent('pointerdown', { pointerId: 1, clientX: 400, clientY: 250, pointerType: 'mouse', bubbles: true }),
    );
    expect(controller.downs).toHaveLength(1);
    expect(controller.downs[0]!.x).toBeCloseTo(400, 6);
    expect(controller.downs[0]!.y).toBeCloseTo(250, 6);
  });

  it('pointerup 은 controller.onPointerUp 을 호출한다(드래그 종료 커밋 경로)', () => {
    const writer = createTransformWriter();
    const controller = makeController();
    const { container } = render(
      <CourtStage
        mode="full"
        variant="editor"
        writer={writer}
        controller={controller}
        showGrid={false}
        showGridLabels={false}
        showRuleZones={false}
        chairs={[]}
        balls={[]}
        cones={[]}
        notes={[]}
        arrows={[]}
        selection={new Set()}
        activeId={null}
      />,
    );
    stubSvgLayout(container);
    const svg = container.querySelector('svg')!;
    svg.dispatchEvent(new window.PointerEvent('pointerdown', { pointerId: 1, clientX: 400, clientY: 250, pointerType: 'mouse', bubbles: true }));
    svg.dispatchEvent(new window.PointerEvent('pointerup', { pointerId: 1, clientX: 400, clientY: 250, pointerType: 'mouse', bubbles: true }));
    expect(controller.ups).toBe(1);
  });

  it('pointercancel 도 pointerup 과 동일하게 onPointerUp 을 부른다(iOS 제스처 가로채기)', () => {
    const writer = createTransformWriter();
    const controller = makeController();
    const { container } = render(
      <CourtStage
        mode="full"
        variant="editor"
        writer={writer}
        controller={controller}
        showGrid={false}
        showGridLabels={false}
        showRuleZones={false}
        chairs={[]}
        balls={[]}
        cones={[]}
        notes={[]}
        arrows={[]}
        selection={new Set()}
        activeId={null}
      />,
    );
    stubSvgLayout(container);
    const svg = container.querySelector('svg')!;
    svg.dispatchEvent(new window.PointerEvent('pointerdown', { pointerId: 1, clientX: 100, clientY: 100, pointerType: 'touch', bubbles: true }));
    svg.dispatchEvent(new window.PointerEvent('pointercancel', { pointerId: 1, clientX: 100, clientY: 100, pointerType: 'touch', bubbles: true }));
    expect(controller.ups).toBe(1);
  });

  it('터치 엣지(clientX<20)에서의 pointerdown 은 무시한다(OS 뒤로가기 제스처 보존)', () => {
    const writer = createTransformWriter();
    const controller = makeController();
    const { container } = render(
      <CourtStage
        mode="full"
        variant="editor"
        writer={writer}
        controller={controller}
        showGrid={false}
        showGridLabels={false}
        showRuleZones={false}
        chairs={[]}
        balls={[]}
        cones={[]}
        notes={[]}
        arrows={[]}
        selection={new Set()}
        activeId={null}
      />,
    );
    stubSvgLayout(container);
    const svg = container.querySelector('svg')!;
    svg.dispatchEvent(new window.PointerEvent('pointerdown', { pointerId: 1, clientX: 5, clientY: 250, pointerType: 'touch', bubbles: true }));
    expect(controller.downs).toHaveLength(0);
  });
});

describe('CourtStage — 줌(§6.4/§7.3)', () => {
  it('imperative handle.zoomBy 로 줌인하면 viewBox 가 좁아지고 zoomMax 를 넘지 않는다', () => {
    const writer = createTransformWriter();
    const controller = makeController();
    const ref = createRef<CourtStageHandle>();
    const { container } = render(
      <CourtStage
        ref={ref}
        mode="full"
        variant="editor"
        writer={writer}
        controller={controller}
        showGrid={false}
        showGridLabels={false}
        showRuleZones={false}
        chairs={[]}
        balls={[]}
        cones={[]}
        notes={[]}
        arrows={[]}
        selection={new Set()}
        activeId={null}
      />,
    );
    stubSvgLayout(container);
    act(() => {
      for (let i = 0; i < 10; i++) ref.current!.zoomBy(2);
    });
    const svg = container.querySelector('svg')!;
    const [, , w] = svg.getAttribute('viewBox')!.split(' ').map(Number);
    const zoom = 800 / w!;
    expect(zoom).toBeLessThanOrEqual(INTERACT.zoomMax + 1e-9);
    expect(w!).toBeLessThan(800);
  });

  it('resetZoom 은 풀코트 기본 viewBox(0 0 825 525)로 되돌린다', () => {
    const writer = createTransformWriter();
    const controller = makeController();
    const ref = createRef<CourtStageHandle>();
    const { container } = render(
      <CourtStage
        ref={ref}
        mode="full"
        variant="editor"
        writer={writer}
        controller={controller}
        showGrid={false}
        showGridLabels={false}
        showRuleZones={false}
        chairs={[]}
        balls={[]}
        cones={[]}
        notes={[]}
        arrows={[]}
        selection={new Set()}
        activeId={null}
      />,
    );
    stubSvgLayout(container);
    act(() => {
      ref.current!.zoomBy(3);
      ref.current!.resetZoom();
    });
    const svg = container.querySelector('svg')!;
    expect(svg).toHaveAttribute('viewBox', '0 0 825 525');
  });
});
