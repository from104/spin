import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, renderHook, act } from '@testing-library/react';
import { LiveRegion, liveRegion } from './LiveRegion.tsx';
import { useThrottledAnnounce } from './useThrottledAnnounce.ts';

describe('useThrottledAnnounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('첫 호출은 즉시 liveRegion.say 를 낭독한다(leading)', () => {
    render(<LiveRegion />);
    const { result } = renderHook(() => useThrottledAnnounce(400));
    act(() => result.current('c3 칸'));
    expect(liveRegion.el?.textContent?.startsWith('c3 칸')).toBe(true);
  });

  it('스로틀 창(400ms) 안의 후속 호출은 즉시 반영되지 않고 마지막 문구만 트레일링에 낭독된다', () => {
    render(<LiveRegion />);
    const { result } = renderHook(() => useThrottledAnnounce(400));

    act(() => result.current('c3 칸'));
    const afterFirst = liveRegion.el?.textContent;

    act(() => result.current('c4 칸'));
    // 창 안이므로 아직 c4 로 갱신되지 않았다.
    expect(liveRegion.el?.textContent).toBe(afterFirst);

    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(liveRegion.el?.textContent?.startsWith('c4 칸')).toBe(true);
  });

  it('400ms 가 지난 뒤의 호출은 다시 즉시(leading) 낭독된다', () => {
    render(<LiveRegion />);
    const { result } = renderHook(() => useThrottledAnnounce(400));

    act(() => result.current('첫 문구'));
    act(() => {
      vi.advanceTimersByTime(500);
    });
    act(() => result.current('두번째 문구'));
    expect(liveRegion.el?.textContent?.startsWith('두번째 문구')).toBe(true);
  });
});
