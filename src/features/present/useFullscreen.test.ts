// §6.9 전체화면. jsdom 은 Fullscreen API 를 구현하지 않으므로 필요한 만큼만 목으로 채운다.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFullscreen } from './useFullscreen.ts';

// 안드로이드 분기가 동적으로 여는 코어 플러그인(PLAN-ANDROID 결정 10). 웹 묶음은 네이티브
// 판정이 거짓이라 여기까지 오지 않는다.
const hide = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
const show = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
vi.mock('@capacitor/core', () => ({ SystemBars: { hide: () => hide(), show: () => show() } }));

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

// ── 안드로이드(Capacitor) — PLAN-ANDROID 결정 10 ───────────────────────────────────────
//
// 지우면 새는 것 둘:
//  ① 네이티브에서 Fullscreen API 를 부르면 `onShowCustomView` 가 그 자리에서 요청을 취소한다.
//     «불렀는데 아무 일도 안 나는» 상태로 남고 시스템 바는 그대로 보인다(실기 A-3).
//  ② 들어갈 때만 감추고 나올 때 안 되돌리면, 시연을 끝낸 사람이 상태바 없는 앱에 갇힌다.
//     ⚠️ 나가는 길은 `exit()` 만이 아니다 — 하드웨어 뒤로가기도 [나가기] 도 화면을 갈아 끼울 뿐
//     이라 훅은 그냥 **언마운트**된다. 그래서 정리(unmount) 케이스가 따로 있다(2026-09-17 검수).
describe('useFullscreen — 네이티브 웹뷰', () => {
  let el: HTMLDivElement;

  beforeEach(() => {
    el = document.createElement('div');
    document.body.appendChild(el);
    hide.mockClear();
    show.mockClear();
    (globalThis as { Capacitor?: unknown }).Capacitor = { isNativePlatform: () => true };
  });

  afterEach(() => {
    el.remove();
    delete (globalThis as { Capacitor?: unknown }).Capacitor;
    delete (Element.prototype as unknown as Record<string, unknown>).requestFullscreen;
  });

  it('Fullscreen API 가 **있어도** 부르지 않고 pseudo + 시스템 바 숨김으로 간다', async () => {
    // 헛통과 방지: 쓸 수 있는 requestFullscreen 을 깔아 둔다. 판정이 셸을 안 보면 native 가 된다.
    Element.prototype.requestFullscreen = vi.fn().mockResolvedValue(undefined);
    const ref = { current: el };
    const { result } = renderHook(() => useFullscreen(ref));

    await act(async () => {
      await result.current.enter({ userGesture: true });
    });

    expect(result.current.state).toBe('pseudo');
    expect(el.requestFullscreen).not.toHaveBeenCalled();
    expect(hide).toHaveBeenCalledTimes(1);
  });

  it('exit() 은 시스템 바를 되돌린다 — 시연이 끝나면 상태바가 돌아와야 한다', async () => {
    const ref = { current: el };
    const { result } = renderHook(() => useFullscreen(ref));
    await act(async () => {
      await result.current.enter({ userGesture: true });
    });
    await act(async () => {
      await result.current.exit();
    });

    expect(result.current.state).toBe('off');
    expect(show).toHaveBeenCalledTimes(1);
  });

  it('★ exit() 없이 언마운트돼도 시스템 바를 되돌린다 — 뒤로가기·[나가기] 는 exit() 를 거치지 않는다', async () => {
    const ref = { current: el };
    const { result, unmount } = renderHook(() => useFullscreen(ref));
    await act(async () => {
      await result.current.enter({ userGesture: true });
    });
    expect(hide).toHaveBeenCalledTimes(1);

    unmount();
    // 정리는 동적 import(`@capacitor/core`) 를 태운다 — 마이크로태스크로는 안 끝나므로 틱을 준다.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(show).toHaveBeenCalledTimes(1);
  });
});
