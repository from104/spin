// §5.1 `useIsNarrow` — 두 boolean 중 새로 생긴 하나.
//
// 스텁을 "matches 를 그냥 돌려주는" 것으로 만들지 않는다. 그러면 질의 문자열이 `min-width` 로
// 뒤집혀도, 1100 이 900 으로 바뀌어도 테스트가 전부 초록불이다 — **스텁이 실제로 max-width 를
// 해석해서** 창 폭과 비교해야 경계 판정이 검증된다(jsdom 의 matchMedia 는 없거나 늘 false 라
// 미디어 질의를 평가하지 않는다).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { NARROW_QUERY, useIsNarrow } from './useIsNarrow.ts';

interface FakeMedia {
  setWidth(px: number): void;
  /** 지금 살아 있는 리스너 수. 해제 검증의 대조군이다. */
  listenerCount(): number;
}

/** 창 폭을 흉내내는 matchMedia. 질의를 파싱해 `max-width: N` 과 실제 폭을 비교한다. */
function stubViewport(initial: number, opts: { legacy?: boolean } = {}): FakeMedia {
  let width = initial;
  const lists = new Set<Set<() => void>>();
  const evaluate = (q: string): boolean => {
    const m = /max-width:\s*([\d.]+)px/.exec(q);
    return m ? width <= Number(m[1]) : false;
  };
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => {
      const handlers = new Set<() => void>();
      const mql = {
        get matches() {
          return evaluate(query);
        },
        media: query,
        ...(opts.legacy
          ? {
              // Safari 16 이전 — addEventListener 가 아예 없다.
              addListener: (fn: () => void) => handlers.add(fn),
              removeListener: (fn: () => void) => handlers.delete(fn),
            }
          : {
              addEventListener: (_: string, fn: () => void) => handlers.add(fn),
              removeEventListener: (_: string, fn: () => void) => handlers.delete(fn),
              addListener: (fn: () => void) => handlers.add(fn),
              removeListener: (fn: () => void) => handlers.delete(fn),
            }),
        dispatchEvent: () => true,
      } as unknown as MediaQueryList;
      lists.add(handlers);
      return mql;
    },
  });
  return {
    setWidth(px) {
      width = px;
      act(() => lists.forEach((handlers) => handlers.forEach((h) => h())));
    },
    listenerCount() {
      return [...lists].reduce((sum, handlers) => sum + handlers.size, 0);
    },
  };
}

afterEach(() => {
  delete (window as unknown as { matchMedia?: unknown }).matchMedia;
  vi.restoreAllMocks();
});

describe('useIsNarrow — 창 폭 1100 미만', () => {
  it.each([
    [1099, true],
    [1100, false],
    [1101, false],
    [1024, true],
    [800, true],
    [1920, false],
  ])('%ipx 창 → %s', (width, expected) => {
    stubViewport(width);
    const { result } = renderHook(() => useIsNarrow());
    expect(result.current).toBe(expected);
  });

  it('창을 줄이면 문턱을 넘는 순간 바뀐다', () => {
    const media = stubViewport(1280);
    const { result } = renderHook(() => useIsNarrow());
    expect(result.current).toBe(false);

    media.setWidth(1100); // 경계값 — 아직 좁지 않다
    expect(result.current).toBe(false);
    media.setWidth(1099);
    expect(result.current).toBe(true);
    media.setWidth(1440); // 되돌아온다
    expect(result.current).toBe(false);
  });

  it('matchMedia 가 없으면 넓은 쪽으로 물러난다', () => {
    // jsdom 기본값이자 아주 오래된 브라우저. 좁은 쪽으로 물러나면 PC 에서 레일이 사라진 채
    // 뜨는 것이 기본 동작이 된다 — 없는 정보로 크롬을 걷어내지 않는다.
    delete (window as unknown as { matchMedia?: unknown }).matchMedia;
    const { result } = renderHook(() => useIsNarrow());
    expect(result.current).toBe(false);
  });

  it('Safari 16 이전(addEventListener 없음)에서도 문턱 전환이 온다', () => {
    const media = stubViewport(1280, { legacy: true });
    const { result } = renderHook(() => useIsNarrow());
    expect(result.current).toBe(false);
    media.setWidth(1024);
    expect(result.current).toBe(true);
  });

  it('언마운트하면 리스너를 놓는다', () => {
    const media = stubViewport(1280);
    const { unmount } = renderHook(() => useIsNarrow());
    // 대조군 — 해제 단언이 "애초에 안 걸렸다" 로도 통과하지 않게 붙어 있는 상태를 먼저 본다.
    expect(media.listenerCount()).toBe(1);
    unmount();
    expect(media.listenerCount()).toBe(0);
  });

  it('세로 판정과 독립이다 — 하나의 질의만 본다', () => {
    // 두 boolean 을 한 질의로 뭉뚱그리면 세로로 세운 큰 태블릿이 덤으로 좁아진다.
    const calls: string[] = [];
    stubViewport(1280);
    const real = window.matchMedia;
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: (q: string) => {
        calls.push(q);
        return real(q);
      },
    });
    renderHook(() => useIsNarrow());
    expect(calls.every((q) => q === NARROW_QUERY)).toBe(true);
    expect(calls.some((q) => q.includes('orientation'))).toBe(false);
  });
});
