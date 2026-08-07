// §6.9 스와이프 판정: |dx|>60 && |dx|>2|dy|, 엣지 20px 무시, 단일 포인터만, 시간 상한 없음.
import { describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSwipe } from './useSwipe.ts';
import type { PointerEvent as ReactPointerEvent } from 'react';

function ev(x: number, y: number, id = 1): ReactPointerEvent {
  return { clientX: x, clientY: y, pointerId: id } as unknown as ReactPointerEvent;
}

describe('useSwipe', () => {
  it('오른쪽에서 왼쪽으로 60px 넘게 움직이면 onNext', () => {
    const onNext = vi.fn();
    const onPrev = vi.fn();
    const { result } = renderHook(() => useSwipe({ onPrev, onNext }));
    act(() => {
      result.current.onPointerDown(ev(500, 300));
      result.current.onPointerUp(ev(430, 300));
    });
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onPrev).not.toHaveBeenCalled();
  });

  it('왼쪽에서 오른쪽으로 60px 넘게 움직이면 onPrev', () => {
    const onNext = vi.fn();
    const onPrev = vi.fn();
    const { result } = renderHook(() => useSwipe({ onPrev, onNext }));
    act(() => {
      result.current.onPointerDown(ev(300, 300));
      result.current.onPointerUp(ev(370, 300));
    });
    expect(onPrev).toHaveBeenCalledTimes(1);
  });

  it('60px 미만이면 무시한다', () => {
    const onNext = vi.fn();
    const onPrev = vi.fn();
    const { result } = renderHook(() => useSwipe({ onPrev, onNext }));
    act(() => {
      result.current.onPointerDown(ev(500, 300));
      result.current.onPointerUp(ev(460, 300));
    });
    expect(onNext).not.toHaveBeenCalled();
    expect(onPrev).not.toHaveBeenCalled();
  });

  it('세로 이동이 가로 이동의 절반을 넘으면(|dx|<=2|dy|) 무시한다', () => {
    const onNext = vi.fn();
    const onPrev = vi.fn();
    const { result } = renderHook(() => useSwipe({ onPrev, onNext }));
    act(() => {
      result.current.onPointerDown(ev(500, 300));
      result.current.onPointerUp(ev(420, 250)); // dx=-80, dy=-50 → |dx|(80) <= 2*|dy|(100)
    });
    expect(onNext).not.toHaveBeenCalled();
  });

  it('엣지(20px 이내) 시작점은 스와이프로 잡지 않는다', () => {
    const onNext = vi.fn();
    const onPrev = vi.fn();
    const { result } = renderHook(() => useSwipe({ onPrev, onNext }));
    act(() => {
      result.current.onPointerDown(ev(10, 300)); // 왼쪽 엣지
      result.current.onPointerUp(ev(120, 300));
    });
    expect(onPrev).not.toHaveBeenCalled();
    expect(onNext).not.toHaveBeenCalled();
  });

  it('두 번째 포인터는 완전히 무시한다', () => {
    const onNext = vi.fn();
    const onPrev = vi.fn();
    const { result } = renderHook(() => useSwipe({ onPrev, onNext }));
    act(() => {
      result.current.onPointerDown(ev(500, 300, 1));
      result.current.onPointerDown(ev(200, 300, 2)); // 두 번째 포인터 — 무시
      result.current.onPointerUp(ev(600, 300, 2)); // id 불일치 — 판정 안 함
    });
    expect(onNext).not.toHaveBeenCalled();
    expect(onPrev).not.toHaveBeenCalled();
    act(() => {
      result.current.onPointerUp(ev(400, 300, 1)); // 원래 포인터로 마무리
    });
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('pointercancel 은 스와이프로 치지 않는다', () => {
    const onNext = vi.fn();
    const onPrev = vi.fn();
    const { result } = renderHook(() => useSwipe({ onPrev, onNext }));
    act(() => {
      result.current.onPointerDown(ev(500, 300));
      result.current.onPointerCancel(ev(430, 300));
    });
    expect(onNext).not.toHaveBeenCalled();
    expect(onPrev).not.toHaveBeenCalled();
  });

  it('시간 상한이 없다 — 아주 느린 제스처도 인정한다', async () => {
    const onNext = vi.fn();
    const onPrev = vi.fn();
    const { result } = renderHook(() => useSwipe({ onPrev, onNext }));
    act(() => {
      result.current.onPointerDown(ev(500, 300));
    });
    await new Promise((r) => setTimeout(r, 5));
    act(() => {
      result.current.onPointerUp(ev(430, 300));
    });
    expect(onNext).toHaveBeenCalledTimes(1);
  });
});
