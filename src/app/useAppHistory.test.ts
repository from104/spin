// §6.8 "go 는 history.pushState + depth++, back 은 depth > 0 이면 history.back() + depth--,
// 아니면 go(fallback)". history.back() 자체(진짜 브라우저 탐색)는 jsdom 에서 비동기·불안정하므로
// 그 경로는 popstate 를 직접 dispatch 해 검증하고, go()/back(fallback) 은 동기 경로를 검증한다.
import { beforeEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useAppHistory } from './useAppHistory.ts';

beforeEach(() => {
  window.history.replaceState(null, '');
});

describe('useAppHistory', () => {
  it('history.state 가 없으면 initial(기본값 home)로 시작하고 depth 0 을 심는다', () => {
    const { result } = renderHook(() => useAppHistory());
    expect(result.current.screen).toBe('home');
    expect(window.history.state).toEqual({ screen: 'home', depth: 0 });
  });

  it('initial 을 넘기면 그 화면으로 시작한다', () => {
    const { result } = renderHook(() => useAppHistory('library'));
    expect(result.current.screen).toBe('library');
  });

  it('이미 쌓인 history.state 가 있으면 그걸 우선한다(새로고침 재마운트)', () => {
    window.history.pushState({ screen: 'editor', depth: 2 }, '');
    const { result } = renderHook(() => useAppHistory('home'));
    expect(result.current.screen).toBe('editor');
  });

  it('go(next) 는 pushState + depth++ 를 하고 화면을 바꾼다', () => {
    const { result } = renderHook(() => useAppHistory('home'));
    act(() => result.current.go('library'));
    expect(result.current.screen).toBe('library');
    expect(window.history.state).toEqual({ screen: 'library', depth: 1 });

    act(() => result.current.go('editor'));
    expect(result.current.screen).toBe('editor');
    expect(window.history.state).toEqual({ screen: 'editor', depth: 2 });
  });

  it('back(fallback) 은 depth 0 이면 go(fallback) 과 동일하게 동작한다(pushState, 히스토리 소진 안 함)', () => {
    const { result } = renderHook(() => useAppHistory('home'));
    act(() => result.current.back('library'));
    expect(result.current.screen).toBe('library');
    // go(fallback) 과 동일 — 새 엔트리를 쌓는다(뒤로가기가 아니라 앞으로 이동).
    expect(window.history.state).toEqual({ screen: 'library', depth: 1 });
  });

  it('depth > 0 에서 back() 은 history.back() 을 호출한다(go(fallback) 으로 새지 않는다)', () => {
    const { result } = renderHook(() => useAppHistory('home'));
    act(() => result.current.go('editor')); // depth 1
    act(() => result.current.go('present')); // depth 2

    act(() => result.current.back('library'));
    // depth>0 이므로 fallback 을 쓰지 않는다 — 실제 화면 전환은 popstate 가 확정한다(아래 테스트).
    // 여기서는 "새 엔트리를 쌓지 않았다(депth 가 fallback 으로 튀지 않는다)"만 확인한다.
    expect(result.current.screen).not.toBe('library');
  });

  it('popstate(브라우저 뒤로/앞으로가기)를 받으면 화면과 depth 를 그 엔트리로 갱신한다', () => {
    const { result } = renderHook(() => useAppHistory('home'));
    act(() => result.current.go('editor')); // depth 1
    act(() => result.current.go('present')); // depth 2

    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate', { state: { screen: 'editor', depth: 1 } }));
    });
    expect(result.current.screen).toBe('editor');

    // depth 가 실제로 1로 되돌아왔는지는 그 다음 back() 이 fallback 으로 새지 않는 것으로 확인한다.
    act(() => result.current.back('home'));
    expect(result.current.screen).not.toBe('home');
  });

  it('popstate 로 depth 0 까지 돌아온 뒤에는 back(fallback) 이 다시 fallback 으로 동작한다', () => {
    const { result } = renderHook(() => useAppHistory('home'));
    act(() => result.current.go('editor')); // depth 1

    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate', { state: { screen: 'home', depth: 0 } }));
    });
    expect(result.current.screen).toBe('home');

    act(() => result.current.back('settings'));
    expect(result.current.screen).toBe('settings');
  });
});
