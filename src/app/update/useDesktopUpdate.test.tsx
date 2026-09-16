// 「웹앱에서는 업데이터가 한 줄도 안 돈다」 (2026-09-16).
//
// 지우면 새는 것: `isTauriWebview()` 가드를 빼면 **브라우저에서 `@tauri-apps/plugin-updater`
// 를 동적 import 한다.** 그 모듈은 데스크톱 전용이라 웹에서 터지고, 터지지 않더라도 웹 번들에
// 쓰이지도 않을 코드가 딸려 들어간다. 잡히는 곳이 여기뿐인 이유는 그 실패가 **타이머가 한 번
// 돈 뒤**(4초)에야 나서 렌더 테스트가 전부 초록인 채 지나가기 때문이다.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useDesktopUpdate } from './useDesktopUpdate.ts';

// ⚠️ **플러그인을 목으로 세우고 「불렸는가」를 잰다.** 처음에는 «오류가 안 나면 됐다» 로 쟀는데
// 그것으로는 가드를 빼도 초록이었다(돌연변이로 확인): 브라우저 환경에서 `check()` 는 던지는
// 대신 **영영 안 풀린다** — Tauri IPC 응답을 기다린다. 안 풀리는 약속은 catch 를 못 깨우므로
// «오류 없음» 이 «안 건드렸음» 의 증거가 못 된다. 그래서 호출 자체를 본다.
const check = vi.fn(() => new Promise(() => {})); // 실제와 같이 영영 안 풀린다
vi.mock('@tauri-apps/plugin-updater', () => ({ check: () => check() }));

afterEach(() => {
  check.mockClear();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('데스크톱 업데이트 훅', () => {
  it('웹앱(= __TAURI_INTERNALS__ 없음)에서는 찾지도, 터지지도 않는다', async () => {
    expect('__TAURI_INTERNALS__' in globalThis, '이 테스트 환경은 웹이어야 한다').toBe(false);
    vi.useFakeTimers();
    const { result } = renderHook(() => useDesktopUpdate());

    // 타이머와 마이크로태스크를 함께 비운다 — 확인은 `setTimeout` 안의 `await import(...)`
    // 뒤에 일어나므로 둘 중 하나만 돌리면 호출이 도착하기 전에 단언이 끝난다.
    await act(async () => {
      vi.advanceTimersByTime(60_000);
      await vi.runAllTimersAsync();
    });

    expect(check, '웹에서 업데이터 플러그인을 불렀다 — 가드가 빠졌다').not.toHaveBeenCalled();
    expect(result.current.found).toBeNull();
    expect(result.current.stage).toBe('idle');
    expect(result.current.error).toBeNull();
  });

  it('찾은 것이 없으면 install() 을 눌러도 아무 일도 안 한다 — 빈 핸들로 받으러 가지 않는다', () => {
    const { result } = renderHook(() => useDesktopUpdate());
    act(() => result.current.install());
    expect(result.current.stage).toBe('idle');
  });
});
