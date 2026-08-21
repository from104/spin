// §6.8 내비게이션 어댑터 (구조 개편 C4, 2026-08-18 — react-router 도입, 질문 20문 ⑫).
//
// **파일 이름·export 시그니처(AppHistoryApi·useAppNav·AppNavProvider)는 그대로다.** 이 계약은
// EditorWorkspace 가 역방향으로 물고 있는 세 줄 중 하나라(§8 — useAppNav/useAppHeader/
// useAutosave) 개명하면 편집기와 그 테스트 수십 개가 연쇄로 깨진다. 바뀐 것은 속뿐이다:
// 자작 pushState 히스토리(depth 를 history.state 에 실어 나르던 것)가 react-router 의
// useLocation/useNavigate 위로 옮겨 갔고, 화면 키 ↔ 경로 접기는 routes.ts 가 쥔다.
//
// **depth 는 살아남았다** — location.state 로 자리만 옮겼다. back(fallback) 의 계약
// ("in-app 으로 쌓은 이력이 있으면 진짜 뒤로, 없으면 fallback 으로") 은 시연 종료가
// 뒤로가기 토글이 되지 않게 하는 안전판이라(옛 파일 머리말) 그대로 지켜야 한다.
// react-router 의 data 라우터는 location.state 를 history.state.usr 에 실어 보존하므로
// 새로고침·브라우저 뒤로가기에서도 옛 구현과 같은 생존성을 갖는다.
//
// 구 키(home/library) 관용 경로(LEGACY_SCREEN_KEYS·readNavEntry)는 **여기서 은퇴했다** —
// 진실이 history.state 에서 URL 로 옮겨 가면서 옛 state 엔트리는 더 이상 아무도 읽지 않는다
// (한시적 관용 경로라던 그 약속의 이행이다).
import { createContext, createElement, useCallback, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router';
import type { Screen } from './screens.ts';
import { parsePath, pathFor } from './routes.ts';

/** 화면 안에서 **무엇을 열고 있는지**. 전부 평문이다 — URL 경로가 이 값의 저장소이므로
 *  (routes.ts) 문자열로 접을 수 있는 것만 실을 수 있다. 화면 키가 어느 해석을 쓸지 가른다:
 *  `drill` 은 board 에서 스테이지 대상, present 에서 시연 대상이다. */
export type NavTarget =
  | { kind: 'board' }
  | { kind: 'drill'; id: string }
  | { kind: 'session'; id: string }
  | { kind: 'tab'; tab: 'drills' | 'sessions' }
  | { kind: 'rule'; topic: string };

export interface AppHistoryApi {
  screen: Screen;
  /** 지금 주소가 싣고 있는 대상. AppShell 이 이걸로 스테이지/시연 대상을 파생한다. */
  target?: NavTarget;
  go(next: Screen, target?: NavTarget): void;
  back(fallback: Screen, fallbackTarget?: NavTarget): void;
}

/** location.state 에 실려 다니는 in-app 깊이. 직접 진입·새로고침 첫 엔트리는 0 이다. */
function depthOf(state: unknown): number {
  if (typeof state === 'object' && state !== null && typeof (state as { depth?: unknown }).depth === 'number') {
    return (state as { depth: number }).depth;
  }
  return 0;
}

export function useAppHistory(_initial: Screen = 'board'): AppHistoryApi {
  const location = useLocation();
  const navigate = useNavigate();
  const parsed = useMemo(() => parsePath(location.pathname, location.search), [location.pathname, location.search]);
  const depth = depthOf(location.state);

  const go = useCallback(
    (next: Screen, target?: NavTarget) => {
      void navigate(pathFor(next, target), { state: { depth: depth + 1 } });
    },
    [navigate, depth],
  );

  const back = useCallback(
    (fallback: Screen, fallbackTarget?: NavTarget) => {
      if (depth > 0) {
        void navigate(-1); // 실제 화면 갱신은 라우터의 location 변경이 authoritative 하게 확정한다
      } else {
        // 직접 진입(공유·새로고침)이라 돌아갈 in-app 이력이 없다 — fallback 으로 **교체**한다.
        // push 로 하면 히스토리에 쌓여 브라우저 뒤로가기가 시연 재진입 토글이 된다(옛 구현의
        // go(fallback) 는 그 버그를 안고 있었다 — 어차피 depth 0 엔트리 위라 드러나지 않았을 뿐).
        void navigate(pathFor(fallback, fallbackTarget), { replace: true, state: { depth: 0 } });
      }
    },
    [navigate, depth],
  );

  return { screen: parsed.screen, target: parsed.target, go, back };
}

// ── 화면 트리 전역 공유 (계약 밖 확장 export) ──────────────────────────────
// AppShell 이 훅을 정확히 한 번만 부르고 Context 로 내려 모든 화면이 같은 {screen, go, back}
// 을 쓴다 — 값 자체가 URL 파생이라 옛 "두 번째 인스턴스가 어긋난다" 문제는 사라졌지만,
// **테스트가 이 Provider 로 목 내비를 주입하는 계약**이 수십 파일에 서 있어 통로를 유지한다.
const AppNavContext = createContext<AppHistoryApi | null>(null);

export function AppNavProvider({ value, children }: { value: AppHistoryApi; children: ReactNode }) {
  return createElement(AppNavContext.Provider, { value }, children);
}

export function useAppNav(): AppHistoryApi {
  const v = useContext(AppNavContext);
  if (!v) throw new Error('useAppNav 는 AppShell(AppNavProvider) 안에서만 쓸 수 있다');
  return v;
}
