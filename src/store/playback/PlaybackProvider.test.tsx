// §10.7 store — PlaybackProvider: "playing, speed, 누적 타이밍 ref (stepIndex 없음)".
import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { PlaybackProvider, usePlayback } from './PlaybackProvider.tsx';

const wrapper = ({ children }: { children: ReactNode }) => <PlaybackProvider>{children}</PlaybackProvider>;

describe('PlaybackProvider', () => {
  it('기본값: playing=false, speed=1, loop=false', () => {
    const { result } = renderHook(() => usePlayback(), { wrapper });
    expect(result.current.playing).toBe(false);
    expect(result.current.speed).toBe(1);
    expect(result.current.loop).toBe(false);
  });

  it('play/pause/toggle 이 playing 을 바꾼다', () => {
    const { result } = renderHook(() => usePlayback(), { wrapper });
    act(() => result.current.play());
    expect(result.current.playing).toBe(true);
    act(() => result.current.toggle());
    expect(result.current.playing).toBe(false);
    act(() => result.current.pause());
    expect(result.current.playing).toBe(false);
  });

  it('advanceMs 는 재생 중이 아니면 누적하지 않는다', () => {
    const { result } = renderHook(() => usePlayback(), { wrapper });
    act(() => {
      result.current.advanceMs(16);
    });
    expect(result.current.getElapsedMs()).toBe(0);
  });

  it('advanceMs 는 재생 중일 때 speed 배수로 누적된다(React state 리렌더 없이 ref 로)', () => {
    const { result } = renderHook(() => usePlayback(), { wrapper });
    act(() => {
      result.current.play();
      result.current.setSpeed(2);
    });
    act(() => {
      result.current.advanceMs(16);
      result.current.advanceMs(16);
    });
    expect(result.current.getElapsedMs()).toBe(64); // (16+16)*2
  });

  it('seekMs/resetMs 가 누적 시간을 직접 조정한다', () => {
    const { result } = renderHook(() => usePlayback(), { wrapper });
    act(() => result.current.seekMs(500));
    expect(result.current.getElapsedMs()).toBe(500);
    act(() => result.current.resetMs());
    expect(result.current.getElapsedMs()).toBe(0);
  });
});
