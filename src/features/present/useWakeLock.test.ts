// §6.9 Wake Lock — secure context 밖(jsdom 은 navigator.wakeLock 자체가 없다)이면 unsupported,
// 요청이 거부되면 denied, 탭이 다시 보이면 재획득한다.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useWakeLock } from './useWakeLock.ts';

// 안드로이드 분기가 동적으로 여는 플러그인(PLAN-ANDROID 결정 10). 웹 묶음은 네이티브 판정이
// 거짓이라 여기까지 오지 않는다.
const keepAwake = vi.fn<() => Promise<void>>();
const allowSleep = vi.fn<() => Promise<void>>();
vi.mock('@capacitor-community/keep-awake', () => ({
  KeepAwake: { keepAwake: () => keepAwake(), allowSleep: () => allowSleep() },
}));

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

// ── 안드로이드(Capacitor) — PLAN-ANDROID 결정 10 ───────────────────────────────────────
//
// 지우면 새는 것 둘:
//  ① 웹뷰의 반쪽짜리 `navigator.wakeLock` 이 확실한 플래그를 가리면, 시연 중 화면이 꺼진다
//     (실기 A-3 의 "5분 방치"). 상태는 'active' 라 화면에 경고도 안 뜬다 — 가장 나쁜 조합이다.
//  ② 끄기가 안 나가면 시연을 마친 뒤에도 화면이 영영 안 꺼져 배터리를 먹는다.
describe('useWakeLock — 네이티브 웹뷰', () => {
  beforeEach(() => {
    keepAwake.mockReset().mockResolvedValue(undefined);
    allowSleep.mockReset().mockResolvedValue(undefined);
    (globalThis as { Capacitor?: unknown }).Capacitor = { isNativePlatform: () => true };
  });

  afterEach(() => {
    delete (globalThis as { Capacitor?: unknown }).Capacitor;
  });

  it('브라우저 Wake Lock 이 **있어도** 플러그인을 쓴다', async () => {
    // 헛통과 방지: 쓸 수 있는 navigator.wakeLock 을 깔아 둔다. 셸을 안 보면 이쪽이 이긴다.
    const request = vi.fn().mockResolvedValue({ release: vi.fn(), addEventListener: vi.fn() });
    Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request } });

    const { result } = renderHook(() => useWakeLock(true));
    await waitFor(() => expect(result.current).toBe('active'));
    expect(keepAwake).toHaveBeenCalledTimes(1);
    expect(request).not.toHaveBeenCalled();
  });

  it('설정을 끄면 잠을 허용하고 idle 로 돌아간다', async () => {
    const { result, rerender } = renderHook(({ on }) => useWakeLock(on), { initialProps: { on: true } });
    await waitFor(() => expect(result.current).toBe('active'));

    rerender({ on: false });
    expect(result.current).toBe('idle');
    await waitFor(() => expect(allowSleep).toHaveBeenCalled());
  });

  it('플러그인이 거절하면 denied — 화면이 «꺼질 수 있습니다» 를 말해야 한다', async () => {
    keepAwake.mockRejectedValue(new Error('not supported'));
    const { result } = renderHook(() => useWakeLock(true));
    await waitFor(() => expect(result.current).toBe('denied'));
  });
});
