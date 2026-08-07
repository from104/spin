// §6.9 전체화면. jsdom 은 Fullscreen API 를 구현하지 않으므로 필요한 만큼만 목으로 채운다.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFullscreen } from './useFullscreen.ts';

function setFullscreenElement(el: Element | null): void {
  Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: el });
}

describe('useFullscreen', () => {
  let el: HTMLDivElement;

  beforeEach(() => {
    el = document.createElement('div');
    document.body.appendChild(el);
    setFullscreenElement(null);
  });

  afterEach(() => {
    el.remove();
    // 테스트 전용 정리 — 다음 테스트가 own property 잔여물을 보지 않게 한다.
    delete (document as unknown as Record<string, unknown>).fullscreenElement;
    delete (document as unknown as Record<string, unknown>).exitFullscreen;
    delete (Element.prototype as unknown as Record<string, unknown>).requestFullscreen;
  });

  it('requestFullscreen 이 있고 성공하면 native 상태가 된다', async () => {
    Element.prototype.requestFullscreen = vi.fn().mockImplementation(function (this: Element) {
      setFullscreenElement(this);
      return Promise.resolve();
    });
    const ref = { current: el };
    const { result } = renderHook(() => useFullscreen(ref));

    await act(async () => {
      await result.current.enter();
    });
    expect(result.current.state).toBe('native');
    expect(el.requestFullscreen).toHaveBeenCalled();
  });

  it('requestFullscreen 자체가 없으면(iPhone Safari) pseudo 로 떨어진다', async () => {
    const ref = { current: el };
    const { result } = renderHook(() => useFullscreen(ref));

    await act(async () => {
      await result.current.enter();
    });
    expect(result.current.state).toBe('pseudo');
  });

  it('requestFullscreen 이 거부되면(제스처 없음 등) pseudo 로 떨어진다', async () => {
    Element.prototype.requestFullscreen = vi.fn().mockRejectedValue(new Error('denied'));
    const ref = { current: el };
    const { result } = renderHook(() => useFullscreen(ref));

    await act(async () => {
      await result.current.enter();
    });
    expect(result.current.state).toBe('pseudo');
  });

  it('native 상태에서 exit() 은 document.exitFullscreen 을 호출하고 off 가 된다', async () => {
    Element.prototype.requestFullscreen = vi.fn().mockImplementation(function (this: Element) {
      setFullscreenElement(this);
      return Promise.resolve();
    });
    document.exitFullscreen = vi.fn().mockImplementation(() => {
      setFullscreenElement(null);
      document.dispatchEvent(new Event('fullscreenchange'));
      return Promise.resolve();
    });
    const ref = { current: el };
    const { result } = renderHook(() => useFullscreen(ref));
    await act(async () => {
      await result.current.enter();
    });
    await act(async () => {
      await result.current.exit();
    });
    expect(document.exitFullscreen).toHaveBeenCalled();
    expect(result.current.state).toBe('off');
  });

  it('pseudo 상태에서 exit() 은 document.exitFullscreen 을 부르지 않고 off 가 된다', async () => {
    document.exitFullscreen = vi.fn();
    const ref = { current: el };
    const { result } = renderHook(() => useFullscreen(ref));
    await act(async () => {
      await result.current.enter(); // requestFullscreen 없음 → pseudo
    });
    await act(async () => {
      await result.current.exit();
    });
    expect(document.exitFullscreen).not.toHaveBeenCalled();
    expect(result.current.state).toBe('off');
  });

  it('시스템이 전체화면을 해제하면(Android 뒤로가기 등) fullscreenchange 로 off 를 감지한다', async () => {
    Element.prototype.requestFullscreen = vi.fn().mockImplementation(function (this: Element) {
      setFullscreenElement(this);
      return Promise.resolve();
    });
    const ref = { current: el };
    const { result } = renderHook(() => useFullscreen(ref));
    await act(async () => {
      await result.current.enter();
    });
    expect(result.current.state).toBe('native');

    act(() => {
      setFullscreenElement(null);
      document.dispatchEvent(new Event('fullscreenchange'));
    });
    expect(result.current.state).toBe('off');
  });
});
