// §6.8 그대로: go 는 history.pushState + depth++, back 은 depth > 0 이면 history.back() + depth--,
// 아니면 go(fallback). 시연 종료는 반드시 back('board') — go 로 하면 히스토리에 쌓여 뒤로가기가
// 시연 재진입 토글이 되고, autoFullscreen 기본 ON 이 제스처 없는 requestFullscreen 거부를 부른다.
//
// depth 는 "이 세션에서 useAppHistory 로 쌓은 in-app 엔트리 수" 다. window.history.state 에
// { screen, depth, target? } 를 실어 브라우저 뒤로/앞으로가기(popstate)에도 살아남게 한다 —
// 새로고침·뒤로가기로 재마운트돼도 현재 화면과 depth, 그리고 **무엇을 열고 있었는지**를 잃지
// 않는다.
//
// 2026-08-12(계획서 2.3): 엔트리에 `target` 을 얹었다. 그전에는 화면 키만 실려 있어서, 체육관
// 태블릿이 시연 도중 리로드되면 화면은 'present' 로 복원되는데 AppShell 의 presentTarget 은
// null 로 리셋돼 *"시연할 드릴을 목록에서 선택하세요"* 라는 빈 화면이 떴다.
import { createContext, createElement, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { LEGACY_SCREEN_KEYS, SCREEN_ORDER } from './screens.ts';
import type { Screen } from './screens.ts';

/** 화면 안에서 **무엇을 열고 있는지**. 전부 structured-clone 안전한 평문이다 — 함수·클래스를
 *  실으면 history.state 직렬화가 통째로 실패한다(DataCloneError). 화면 키가 어느 해석을 쓸지
 *  가른다: `drill` 은 board 에서 스테이지 대상, present 에서 시연 대상이다. */
export type NavTarget =
  | { kind: 'board' }
  | { kind: 'drill'; id: string }
  | { kind: 'session'; id: string }
  | { kind: 'tab'; tab: 'drills' | 'sessions' };

export interface NavEntry {
  screen: Screen;
  depth: number;
  target?: NavTarget;
}

const SCREEN_SET: ReadonlySet<string> = new Set<Screen>(SCREEN_ORDER);

function isNavTarget(v: unknown): v is NavTarget {
  if (typeof v !== 'object' || v === null) return false;
  const t = v as { kind?: unknown; id?: unknown; tab?: unknown };
  if (t.kind === 'board') return true;
  if (t.kind === 'drill' || t.kind === 'session') return typeof t.id === 'string' && t.id.length > 0;
  if (t.kind === 'tab') return t.tab === 'drills' || t.tab === 'sessions';
  return false;
}

/** history.state 를 NavEntry 로 읽는다. 아니면 null.
 *
 *  **구 키를 신 키로 접는 것이 이 함수의 두 번째 일이다.** 개명 전에 열어 둔 탭의 history.state
 *  에는 `'home'`/`'library'` 가 그대로 들어 있는데, 화이트리스트만 갈아끼우면 그 엔트리들이
 *  전부 "남의 state" 로 판정돼 뒤로가기가 초기 화면으로 떨어진다. 그래서 **판정(boolean)이 아니라
 *  변환(NavEntry|null)** 이다 — 옛 `isNavEntry` 가드가 이 이름으로 바뀐 이유다. */
export function readNavEntry(v: unknown): NavEntry | null {
  if (typeof v !== 'object' || v === null) return null;
  const raw = v as { screen?: unknown; depth?: unknown; target?: unknown };
  if (typeof raw.depth !== 'number' || typeof raw.screen !== 'string') return null;
  const screen = SCREEN_SET.has(raw.screen) ? (raw.screen as Screen) : LEGACY_SCREEN_KEYS[raw.screen];
  if (!screen) return null;
  return isNavTarget(raw.target) ? { screen, depth: raw.depth, target: raw.target } : { screen, depth: raw.depth };
}

/** target 이 undefined 면 키 자체를 싣지 않는다 — history.state 를 눈으로 읽을 때(그리고
 *  toEqual 로 단언할 때) 없는 대상이 `target: undefined` 로 남아 있으면 헷갈린다. */
function entryOf(screen: Screen, depth: number, target?: NavTarget): NavEntry {
  return target ? { screen, depth, target } : { screen, depth };
}

export interface AppHistoryApi {
  screen: Screen;
  /** 지금 엔트리가 싣고 있는 대상. AppShell 이 이걸로 스테이지/시연 대상을 되살린다. */
  target?: NavTarget;
  go(next: Screen, target?: NavTarget): void;
  back(fallback: Screen, fallbackTarget?: NavTarget): void;
}

export function useAppHistory(initial: Screen = 'board'): AppHistoryApi {
  const seed = readNavEntry(window.history.state) ?? { screen: initial, depth: 0 };
  const [view, setView] = useState<{ screen: Screen; target?: NavTarget }>({ screen: seed.screen, target: seed.target });
  const depthRef = useRef(seed.depth);

  // 최초 진입(직접 로드·새로고침)이라 history.state 가 비어 있으면 depth 0 을 심는다. 구 키
  // 엔트리로 들어온 경우에는 접은 결과를 되쓴다 — 안 그러면 그 탭이 살아 있는 동안 옛 키가
  // 계속 굴러다닌다. replaceState 라 어느 쪽이든 새 엔트리를 쌓지 않는다.
  useEffect(() => {
    window.history.replaceState(entryOf(seed.screen, seed.depth, seed.target), '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onPopState = (e: PopStateEvent) => {
      const entry = readNavEntry(e.state) ?? { screen: initial, depth: 0 };
      depthRef.current = entry.depth;
      setView({ screen: entry.screen, target: entry.target });
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [initial]);

  const go = useCallback((next: Screen, target?: NavTarget) => {
    const entry = entryOf(next, depthRef.current + 1, target);
    depthRef.current = entry.depth;
    window.history.pushState(entry, '');
    setView({ screen: next, target });
  }, []);

  const back = useCallback(
    (fallback: Screen, fallbackTarget?: NavTarget) => {
      if (depthRef.current > 0) {
        depthRef.current -= 1;
        window.history.back(); // 실제 화면·depth 갱신은 popstate 핸들러가 authoritative 하게 확정한다
      } else {
        go(fallback, fallbackTarget);
      }
    },
    [go],
  );

  return { screen: view.screen, target: view.target, go, back };
}

// ── 화면 트리 전역 공유 (계약 밖 확장 export) ──────────────────────────────
// useAppHistory() 를 화면마다 다시 부르면 안 된다: go()/back() 은 popstate 를 발생시키지
// 않는(브라우저가 pushState/replaceState 에는 popstate 를 쏘지 않는다) 프로그래밍적 호출이라,
// AppShell 이 아닌 다른 곳에서 독립적으로 호출한 두 번째 인스턴스가 go() 를 불러도 AppShell 의
// screen state 는 갱신되지 않는다 — 화면이 바뀌지 않는 것처럼 보인다. 그래서 AppShell 이 훅을
// 정확히 한 번만 부르고, 그 결과를 Context 로 내려 모든 화면이 같은 {screen, go, back} 을 쓴다.
const AppNavContext = createContext<AppHistoryApi | null>(null);

export function AppNavProvider({ value, children }: { value: AppHistoryApi; children: ReactNode }) {
  return createElement(AppNavContext.Provider, { value }, children);
}

export function useAppNav(): AppHistoryApi {
  const v = useContext(AppNavContext);
  if (!v) throw new Error('useAppNav 는 AppShell(AppNavProvider) 안에서만 쓸 수 있다');
  return v;
}
