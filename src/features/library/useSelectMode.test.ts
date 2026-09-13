// 선택 모드의 의미론(2026-09-14). 두 목록 화면이 **같은 훅**을 쓰므로 여기가 갈리면 한쪽만
// 고쳐지는 날이 온다.
//
// 지우면 새는 것 셋:
// ① 모드를 끄고도 체크가 남으면, 다시 켰을 때 «전에 고른 것» 이 선택된 채로 시작해 사람이
//    모르는 것을 지운다.
// ② [보이는 것 모두] 가 켜기만 하면 끌 길이 없다(같은 버튼이 켜고 끄는 것이 목록의 통상이다).
// ③ 지운 뒤 id 를 안 털면 없는 것을 계속 세어 «3개 선택» 이 화면과 안 맞는다.
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useSelectMode } from './useSelectMode.ts';

describe('useSelectMode', () => {
  it('모드를 끄면 체크가 전부 사라진다 — 다시 켰을 때 옛 선택이 되살아나면 안 된다', () => {
    const { result } = renderHook(() => useSelectMode<string>());
    act(() => result.current.enter('a'));
    act(() => result.current.toggle('b'));
    expect(result.current.count).toBe(2);

    act(() => result.current.exit());
    expect(result.current.mode).toBe(false);
    expect(result.current.count).toBe(0);

    act(() => result.current.enter());
    expect(result.current.count, '새로 켠 모드는 빈손이다').toBe(0);
  });

  it('[여기부터 선택] 은 그 하나를 이미 체크한 채로 연다 — 한 번 더 누르게 하지 않는다', () => {
    const { result } = renderHook(() => useSelectMode<string>());
    act(() => result.current.enter('a'));
    expect(result.current.checked.has('a')).toBe(true);
  });

  it('[보이는 것 모두] 는 켜고 끄는 같은 버튼이다 — 전부 켜져 있으면 푼다', () => {
    const { result } = renderHook(() => useSelectMode<string>());
    act(() => result.current.enter());
    act(() => result.current.toggleAll(['a', 'b', 'c']));
    expect(result.current.count).toBe(3);
    act(() => result.current.toggleAll(['a', 'b', 'c']));
    expect(result.current.count).toBe(0);
  });

  it('필터 밖의 체크는 [보이는 것 모두] 가 건드리지 않는다 — 안 보이는 것을 몰래 풀지 않는다', () => {
    const { result } = renderHook(() => useSelectMode<string>());
    act(() => result.current.enter('hidden'));
    act(() => result.current.toggleAll(['a', 'b']));
    expect(result.current.count).toBe(3);
    // 보이는 둘만 다시 누르면 그 둘만 풀린다.
    act(() => result.current.toggleAll(['a', 'b']));
    expect([...result.current.checked]).toEqual(['hidden']);
  });

  it('지운 것은 털어 낸다 — 없는 것을 세면 개수가 화면과 안 맞는다', () => {
    const { result } = renderHook(() => useSelectMode<string>());
    act(() => result.current.enter('a'));
    act(() => result.current.toggle('b'));
    act(() => result.current.remove(['a']));
    expect([...result.current.checked]).toEqual(['b']);
  });
});
