// §6.8 그대로: go 는 history.pushState + depth++, back 은 depth > 0 이면 history.back() + depth--,
// 아니면 go(fallback). 시연 종료는 반드시 back('editor') — go 로 하면 히스토리에 쌓여 뒤로가기가
// 시연 재진입 토글이 되고, autoFullscreen 기본 ON 이 제스처 없는 requestFullscreen 거부를 부른다.
//
// depth 는 "이 세션에서 useAppHistory 로 쌓은 in-app 엔트리 수" 다. window.history.state 에
// { screen, depth } 를 실어 브라우저 뒤로/앞으로가기(popstate)에도 살아남게 한다 — 새로고침·
// 뒤로가기로 재마운트돼도 현재 화면과 depth 를 잃지 않는다.
import { createContext, createElement, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Screen } from './screens.ts';

interface NavEntry {
  screen: Screen;
  depth: number;
}

const SCREEN_SET: ReadonlySet<string> = new Set<Screen>(['home', 'library', 'editor', 'present', 'settings']);

function isNavEntry(v: unknown): v is NavEntry {
  return (
    typeof v === 'object' &&
    v !== null &&
    'screen' in v &&
    'depth' in v &&
    typeof (v as NavEntry).depth === 'number' &&
    SCREEN_SET.has((v as NavEntry).screen)
  );
}

export interface AppHistoryApi {
  screen: Screen;
  go(next: Screen): void;
  back(fallback: Screen): void;
}

export function useAppHistory(initial: Screen = 'home'): AppHistoryApi {
  const seed = isNavEntry(window.history.state) ? window.history.state : { screen: initial, depth: 0 };
  const [screen, setScreen] = useState<Screen>(seed.screen);
  const depthRef = useRef(seed.depth);

  // 최초 진입(직접 로드·새로고침)이라 history.state 가 비어 있으면 depth 0 을 심는다.
  // replaceState 라 새 엔트리를 쌓지 않는다.
  useEffect(() => {
    if (!isNavEntry(window.history.state)) {
      const entry: NavEntry = { screen: seed.screen, depth: 0 };
      window.history.replaceState(entry, '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onPopState = (e: PopStateEvent) => {
      const entry = isNavEntry(e.state) ? e.state : { screen: initial, depth: 0 };
      depthRef.current = entry.depth;
      setScreen(entry.screen);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [initial]);

  const go = useCallback((next: Screen) => {
    const entry: NavEntry = { screen: next, depth: depthRef.current + 1 };
    depthRef.current = entry.depth;
    window.history.pushState(entry, '');
    setScreen(next);
  }, []);

  const back = useCallback(
    (fallback: Screen) => {
      if (depthRef.current > 0) {
        depthRef.current -= 1;
        window.history.back(); // 실제 화면·depth 갱신은 popstate 핸들러가 authoritative 하게 확정한다
      } else {
        go(fallback);
      }
    },
    [go],
  );

  return { screen, go, back };
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
