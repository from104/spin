// §6.9 Wake Lock — secure context 밖(jsdom 은 navigator.wakeLock 자체가 없다)이면 unsupported,
// 요청이 거부되면 denied, 탭이 다시 보이면 재획득한다.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useWakeLock } from './useWakeLock.ts';

function setVisibility(v: DocumentVisibilityState): void {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: v });
}

describe('useWakeLock', () => {
  afterEach(() => {
    delete (navigator as unknown as Record<string, unknown>).wakeLock;
    setVisibility('visible');
  });

  it('navigator.wakeLock 이 없으면 unsupported', () => {
    const { result } = renderHook(() => useWakeLock(true));
    expect(result.current).toBe('unsupported');
  });

  it('enabled=false 면 요청하지 않고 idle 을 유지한다', () => {
    const request = vi.fn();
    Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request } });
    const { result } = renderHook(() => useWakeLock(false));
    expect(result.current).toBe('idle');
    expect(request).not.toHaveBeenCalled();
  });

  it('요청이 성공하면 active 가 된다', async () => {
    const sentinel = { release: vi.fn().mockResolvedValue(undefined), addEventListener: vi.fn() };
    const request = vi.fn().mockResolvedValue(sentinel);
    Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request } });

    const { result } = renderHook(() => useWakeLock(true));
    await waitFor(() => expect(result.current).toBe('active'));
    expect(request).toHaveBeenCalledWith('screen');
  });

  it('요청이 거부되면(NotAllowedError 등) denied 가 된다', async () => {
    const request = vi.fn().mockRejectedValue(new Error('NotAllowedError'));
    Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request } });

    const { result } = renderHook(() => useWakeLock(true));
    await waitFor(() => expect(result.current).toBe('denied'));
  });

  it('탭이 숨겨졌다 다시 보이면 재획득한다', async () => {
    let released = false;
    const sentinel = {
      release: vi.fn().mockImplementation(() => {
        released = true;
        return Promise.resolve();
      }),
      addEventListener: vi.fn(),
    };
    const request = vi.fn().mockResolvedValue(sentinel);
    Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request } });

    renderHook(() => useWakeLock(true));
    await waitFor(() => expect(request).toHaveBeenCalledTimes(1));

    // 브라우저가 탭이 숨겨지면 sentinel 을 자동 해제한다 — 'release' 이벤트로 시뮬레이션.
    const releaseHandler = sentinel.addEventListener.mock.calls[0]?.[1] as () => void;
    act(() => releaseHandler());
    void released;

    setVisibility('visible');
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
  });
});
