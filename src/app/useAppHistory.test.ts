// §6.8 "go 는 history.pushState + depth++, back 은 depth > 0 이면 history.back() + depth--,
// 아니면 go(fallback)". history.back() 자체(진짜 브라우저 탐색)는 jsdom 에서 비동기·불안정하므로
// 그 경로는 popstate 를 직접 dispatch 해 검증하고, go()/back(fallback) 은 동기 경로를 검증한다.
//
// 2026-08-12(계획서 2.1·2.3): 화면 키가 board/drills 로 개명됐고 엔트리에 `target` 이 붙었다.
// 아래 리터럴은 **일부러 상수를 참조하지 않는다** — SCREEN_ORDER 를 읽어 쓰면 키를 잘못 바꿔도
// 테스트가 함께 따라 움직여 아무것도 못 잡는다.
import { beforeEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { readNavEntry, useAppHistory } from './useAppHistory.ts';
import type { NavEntry } from './useAppHistory.ts';

beforeEach(() => {
  window.history.replaceState(null, '');
});

describe('useAppHistory', () => {
  it('history.state 가 없으면 initial(기본값 board)로 시작하고 depth 0 을 심는다', () => {
    const { result } = renderHook(() => useAppHistory());
    expect(result.current.screen).toBe('board');
    expect(window.history.state).toEqual({ screen: 'board', depth: 0 });
  });

  it('initial 을 넘기면 그 화면으로 시작한다', () => {
    const { result } = renderHook(() => useAppHistory('drills'));
    expect(result.current.screen).toBe('drills');
  });

  it('이미 쌓인 history.state 가 있으면 그걸 우선한다(새로고침 재마운트)', () => {
    window.history.pushState({ screen: 'settings', depth: 2 }, '');
    const { result } = renderHook(() => useAppHistory('board'));
    expect(result.current.screen).toBe('settings');
  });

  it('go(next) 는 pushState + depth++ 를 하고 화면을 바꾼다', () => {
    const { result } = renderHook(() => useAppHistory('board'));
    act(() => result.current.go('drills'));
    expect(result.current.screen).toBe('drills');
    expect(window.history.state).toEqual({ screen: 'drills', depth: 1 });

    act(() => result.current.go('settings'));
    expect(result.current.screen).toBe('settings');
    expect(window.history.state).toEqual({ screen: 'settings', depth: 2 });
  });

  it('back(fallback) 은 depth 0 이면 go(fallback) 과 동일하게 동작한다(pushState, 히스토리 소진 안 함)', () => {
    const { result } = renderHook(() => useAppHistory('board'));
    act(() => result.current.back('drills'));
    expect(result.current.screen).toBe('drills');
    // go(fallback) 과 동일 — 새 엔트리를 쌓는다(뒤로가기가 아니라 앞으로 이동).
    expect(window.history.state).toEqual({ screen: 'drills', depth: 1 });
  });

  it('depth > 0 에서 back() 은 history.back() 을 호출한다(go(fallback) 으로 새지 않는다)', () => {
    const { result } = renderHook(() => useAppHistory('board'));
    act(() => result.current.go('settings')); // depth 1
    act(() => result.current.go('present')); // depth 2

    act(() => result.current.back('drills'));
    // depth>0 이므로 fallback 을 쓰지 않는다 — 실제 화면 전환은 popstate 가 확정한다(아래 테스트).
    // 여기서는 "새 엔트리를 쌓지 않았다(depth 가 fallback 으로 튀지 않는다)"만 확인한다.
    expect(result.current.screen).not.toBe('drills');
  });

  it('popstate(브라우저 뒤로/앞으로가기)를 받으면 화면과 depth 를 그 엔트리로 갱신한다', () => {
    const { result } = renderHook(() => useAppHistory('board'));
    act(() => result.current.go('settings')); // depth 1
    act(() => result.current.go('present')); // depth 2

    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate', { state: { screen: 'settings', depth: 1 } }));
    });
    expect(result.current.screen).toBe('settings');

    // depth 가 실제로 1로 되돌아왔는지는 그 다음 back() 이 fallback 으로 새지 않는 것으로 확인한다.
    act(() => result.current.back('board'));
    expect(result.current.screen).not.toBe('board');
  });

  it('popstate 로 depth 0 까지 돌아온 뒤에는 back(fallback) 이 다시 fallback 으로 동작한다', () => {
    const { result } = renderHook(() => useAppHistory('board'));
    act(() => result.current.go('settings')); // depth 1

    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate', { state: { screen: 'board', depth: 0 } }));
    });
    expect(result.current.screen).toBe('board');

    act(() => result.current.back('settings'));
    expect(result.current.screen).toBe('settings');
  });
});

describe('NavEntry.target (계획서 2.3)', () => {
  it('go 가 실은 대상이 엔트리와 훅 반환값 양쪽에 함께 실린다', () => {
    const { result } = renderHook(() => useAppHistory('board'));
    act(() => result.current.go('present', { kind: 'drill', id: 'dr_42' }));
    expect(result.current.target).toEqual({ kind: 'drill', id: 'dr_42' });
    expect(window.history.state).toEqual({ screen: 'present', depth: 1, target: { kind: 'drill', id: 'dr_42' } });
  });

  it('대상 없는 이동은 target 키 자체를 싣지 않는다', () => {
    const { result } = renderHook(() => useAppHistory('board'));
    act(() => result.current.go('settings'));
    expect(window.history.state).toEqual({ screen: 'settings', depth: 1 });
    expect(result.current.target).toBeUndefined();
    // 앞 엔트리의 대상이 다음 엔트리로 새면 안 된다.
    act(() => result.current.go('present', { kind: 'session', id: 'se_9' }));
    act(() => result.current.go('board'));
    expect(result.current.target).toBeUndefined();
  });

  it('엔트리는 structuredClone 왕복 후에도 동치다 — history.state 가 실을 수 있는 평문만 담는다', () => {
    // 함수·클래스가 섞이면 pushState 가 DataCloneError 로 죽는다. 네 kind 를 전부 태운다.
    const entries: NavEntry[] = [
      { screen: 'board', depth: 0, target: { kind: 'board' } },
      { screen: 'board', depth: 1, target: { kind: 'drill', id: 'dr_1' } },
      { screen: 'present', depth: 2, target: { kind: 'session', id: 'se_1' } },
      { screen: 'drills', depth: 3, target: { kind: 'tab', tab: 'sessions' } },
    ];
    for (const e of entries) {
      const round = structuredClone(e);
      expect(round).toEqual(e);
      // 왕복본을 그대로 다시 읽어도 같은 엔트리다(직렬화 → 복원 → 파싱 전 구간).
      expect(readNavEntry(round)).toEqual(e);
    }
  });

  it('popstate 가 돌려준 대상도 함께 복원된다', () => {
    const { result } = renderHook(() => useAppHistory('board'));
    act(() => result.current.go('board', { kind: 'drill', id: 'dr_a' }));
    act(() => result.current.go('board', { kind: 'drill', id: 'dr_b' }));
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate', { state: { screen: 'board', depth: 1, target: { kind: 'drill', id: 'dr_a' } } }));
    });
    expect(result.current.target).toEqual({ kind: 'drill', id: 'dr_a' });
  });

  it('마운트 시 history.state 의 대상을 seed 로 읽는다(리로드 복원)', () => {
    window.history.pushState({ screen: 'present', depth: 3, target: { kind: 'drill', id: 'dr_z' } }, '');
    const { result } = renderHook(() => useAppHistory('board'));
    expect(result.current.screen).toBe('present');
    expect(result.current.target).toEqual({ kind: 'drill', id: 'dr_z' });
  });
});

describe('readNavEntry — 구 키 접기와 화이트리스트', () => {
  it("구 키 'home'/'library' 를 신 키로 접는다", () => {
    // 개명 전에 열어 둔 탭의 history.state 가 전부 무효로 판정되면 그 탭들의 뒤로가기가
    // 초기 화면으로 떨어진다(계획서 2.3). 이 관용 경로가 그것을 막는 유일한 자리다.
    expect(readNavEntry({ screen: 'home', depth: 2 })).toEqual({ screen: 'board', depth: 2 });
    expect(readNavEntry({ screen: 'library', depth: 0 })).toEqual({ screen: 'drills', depth: 0 });
  });

  it('구 키 엔트리로 마운트하면 화면이 신 키로 복원되고 depth 도 살아남는다', () => {
    window.history.pushState({ screen: 'library', depth: 4 }, '');
    const { result } = renderHook(() => useAppHistory('board'));
    expect(result.current.screen).toBe('drills');
    // depth 4 가 살아 있으면 back() 이 fallback 으로 새지 않는다.
    act(() => result.current.back('settings'));
    expect(result.current.screen).not.toBe('settings');
  });

  it('구 키 엔트리는 마운트 시 신 키로 되쓰인다 — 옛 키가 그 탭에 계속 굴러다니지 않는다', () => {
    window.history.replaceState({ screen: 'home', depth: 0 }, '');
    renderHook(() => useAppHistory('drills'));
    expect(window.history.state).toEqual({ screen: 'board', depth: 0 });
  });

  it('남의 state 는 세 판정을 각각 따로 걸러낸다', () => {
    // 한 번에 여러 개를 틀리게 만들면 다른 판정이 대신 걸러줘서, 정작 지운 판정이 있어도
    // 초록불이 유지된다. 조건마다 하나씩만 틀리게 찌른다.
    expect(readNavEntry({ screen: 'nowhere', depth: 2 })).toBeNull(); // 화이트리스트도 구 키도 아님
    expect(readNavEntry({ screen: 'board', depth: '2' })).toBeNull(); // depth 가 숫자가 아님
    expect(readNavEntry({ depth: 2 })).toBeNull(); // screen 이 없음
    expect(readNavEntry(null)).toBeNull();
    expect(readNavEntry('board')).toBeNull();
    // 대조군 — 위 셋을 고치면 통과한다(전부 null 이라 통과하는 것이 아니다).
    expect(readNavEntry({ screen: 'board', depth: 2 })).toEqual({ screen: 'board', depth: 2 });
  });

  it('망가진 target 은 엔트리째 버리지 않고 대상만 떨어뜨린다', () => {
    // 화면 복원은 대상 복원보다 중요하다 — 대상 하나가 이상하다고 뒤로가기 이력까지
    // 초기화하면 손해가 훨씬 크다.
    expect(readNavEntry({ screen: 'board', depth: 1, target: { kind: 'drill' } })).toEqual({ screen: 'board', depth: 1 });
    expect(readNavEntry({ screen: 'board', depth: 1, target: { kind: 'nope', id: 'x' } })).toEqual({ screen: 'board', depth: 1 });
    expect(readNavEntry({ screen: 'drills', depth: 1, target: { kind: 'tab', tab: 'nope' } })).toEqual({ screen: 'drills', depth: 1 });
    expect(readNavEntry({ screen: 'board', depth: 1, target: 'dr_1' })).toEqual({ screen: 'board', depth: 1 });
    // 대조군 — 멀쩡한 대상은 그대로 실려 온다.
    expect(readNavEntry({ screen: 'board', depth: 1, target: { kind: 'drill', id: 'dr_1' } })).toEqual({
      screen: 'board',
      depth: 1,
      target: { kind: 'drill', id: 'dr_1' },
    });
  });
});
