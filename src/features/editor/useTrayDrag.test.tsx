// §6.10 트레이 → 코트 끌어다 놓기의 판정 로직.
//
// jsdom 은 레이아웃을 하지 않으므로 스테이지 계측(StageMetrics)은 손으로 만들어 넣는다.
// 여기서 지키려는 것은 좌표 변환 자체가 아니라(그건 useStageMetrics.test 가 본다) **언제
// 놓이고 언제 안 놓이는가** 다.
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { useRef } from 'react';
import type { CourtStageHandle } from '../../render/CourtStage.tsx';
import type { StageMetrics } from '../../render/useStageMetrics.ts';
import { useTrayDrag, type TrayDragItem } from './useTrayDrag.ts';

// 800×500 상자에 825×525 코트를 'meet' 로 넣은 상황. 세로가 꽉 차고 **좌우로 레터박스 띠**가
// 7.14px 씩 남는다 — 그 띠는 svg 안이지만 코트 밖이다.
const RECT = { left: 0, top: 0, right: 800, bottom: 500, width: 800, height: 500, x: 0, y: 0 } as DOMRect;
const VIEW = { x: 0, y: 0, w: 825, h: 525 };
const PX = Math.min(800 / 825, 500 / 525); // 0.95238…
const METRICS: StageMetrics = {
  rect: RECT,
  view: VIEW,
  rot: 0,
  pxPerUnit: PX,
  offX: (800 - 825 * PX) / 2, // 7.14…
  offY: (500 - 525 * PX) / 2, // 0
};

const ITEM: TrayDragItem = { kind: 'ball' };

function Harness({ onDrop, onTap }: { onDrop: (i: TrayDragItem, w: { x: number; y: number }) => void; onTap: () => void }) {
  const stageRef = useRef<CourtStageHandle | null>({
    zoomBy: () => {},
    resetZoom: () => {},
    panByScreen: () => {},
    refreshMetrics: () => METRICS,
    focusContainer: () => {},
  });
  const tray = useTrayDrag({ stageRef, onDrop });
  return (
    <>
      <button type="button" onPointerDown={(e) => tray.start(ITEM, e, onTap)}>
        공
      </button>
      {tray.dragging && <div ref={tray.ghostRef} data-testid="ghost" />}
    </>
  );
}

function setup() {
  const onDrop = vi.fn();
  const onTap = vi.fn();
  render(<Harness onDrop={onDrop} onTap={onTap} />);
  const src = screen.getByRole('button', { name: '공' });
  return { onDrop, onTap, src };
}

const down = (el: Element, x: number, y: number) => fireEvent.pointerDown(el, { pointerId: 1, clientX: x, clientY: y });
const move = (x: number, y: number) => fireEvent.pointerMove(window, { pointerId: 1, clientX: x, clientY: y });
const up = (x: number, y: number) => fireEvent.pointerUp(window, { pointerId: 1, clientX: x, clientY: y });

describe('useTrayDrag', () => {
  it('문턱을 못 넘고 손을 떼면 **탭**이다 — 예전 2단계 경로가 살아 있어야 한다', () => {
    const { onDrop, onTap, src } = setup();
    down(src, 100, 100);
    move(102, 101); // 2.2px — 문턱(6px) 미만
    up(102, 101);
    expect(onTap).toHaveBeenCalledTimes(1);
    expect(onDrop).not.toHaveBeenCalled();

    // 경계값: 전혀 움직이지 않아도(이동량 0) 마찬가지로 탭이다.
    cleanup();
    const zero = setup();
    down(zero.src, 100, 100);
    up(100, 100);
    expect(zero.onTap).toHaveBeenCalledTimes(1);
    expect(zero.onDrop).not.toHaveBeenCalled();
  });

  it('문턱을 넘어 코트 안에서 놓으면 그 자리에 놓인다', () => {
    const { onDrop, onTap, src } = setup();
    down(src, 100, 100);
    move(400, 250);
    up(400, 250);
    expect(onTap).not.toHaveBeenCalled();
    expect(onDrop).toHaveBeenCalledTimes(1);
    const [item, world] = onDrop.mock.calls[0]!;
    expect(item).toEqual(ITEM);
    expect(world.x).toBeCloseTo((400 - METRICS.offX) / PX, 3);
    expect(world.y).toBeCloseTo(250 / PX, 3);
  });

  it("코트 **바깥**(‘meet’ 레터박스 띠)에 놓으면 아무 일도 없다", () => {
    // svg 의 rect 안이라서 rect 만으로 판정하면 통과해버린다 — 그러면 판 밖에 개체가 생긴다.
    const { onDrop, src } = setup();
    down(src, 100, 100);
    move(3, 250); // rect 안(0..800)이지만 offX=7.14 보다 왼쪽 → world.x < 0
    up(3, 250);
    expect(onDrop).not.toHaveBeenCalled();
  });

  it('창 바깥에서 놓아도 아무 일도 없다', () => {
    const { onDrop, src } = setup();
    down(src, 100, 100);
    move(900, 250);
    up(900, 250);
    expect(onDrop).not.toHaveBeenCalled();
  });

  it('pointercancel 이면 놓지도 탭하지도 않는다', () => {
    const { onDrop, onTap, src } = setup();
    down(src, 100, 100);
    move(400, 250);
    fireEvent.pointerCancel(window, { pointerId: 1 });
    expect(onDrop).not.toHaveBeenCalled();
    expect(onTap).not.toHaveBeenCalled();
  });

  it('드래그 중에만 고스트가 뜨고, 뜨는 즉시 포인터 자리에 놓인다', () => {
    const { src } = setup();
    down(src, 100, 100);
    expect(screen.queryByTestId('ghost'), '문턱 전에 고스트가 떴다').toBeNull();
    move(400, 250);
    const ghost = screen.getByTestId('ghost');
    // 콜백 ref 가 붙는 즉시 위치를 쓴다 — 일반 ref 면 첫 프레임에 (0,0) 에서 번쩍인다.
    expect(ghost.style.transform).toContain('translate3d(400px, 250px, 0)');
    up(400, 250);
    expect(screen.queryByTestId('ghost')).toBeNull();
  });

  it('다른 손가락의 이벤트는 세션을 건드리지 않는다', () => {
    const { onDrop, src } = setup();
    down(src, 100, 100);
    fireEvent.pointerMove(window, { pointerId: 2, clientX: 400, clientY: 250 });
    fireEvent.pointerUp(window, { pointerId: 2, clientX: 400, clientY: 250 });
    expect(onDrop).not.toHaveBeenCalled();
    // 원래 손가락은 아직 살아 있다
    move(400, 250);
    up(400, 250);
    expect(onDrop).toHaveBeenCalledTimes(1);
  });
});
