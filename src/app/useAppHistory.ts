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
//
// `lastNavFromHistory` (PLAN-0-6-3-LOADER-NOTICE 결정 11) — 화면 전환 로더가 뒤로가기를
// 면제하는 신호다. 되돌아가기가 갈 때보다 느려지면 안 된다: 로더의 최소 표시 시간은 어차피
// 인위적인 지연이고, 그 지연을 "이미 본 화면으로 돌아가는 길" 에까지 물리면 사용자는 뒤로가기를
// 누를 때마다 벌을 받는 셈이 된다. `useNavigationType()` 이 이미 브라우저 표준 POP/PUSH/REPLACE
// 를 들고 있으므로 새 상태를 만들지 않고 그 값을 한 글자로 접기만 한다 — `back()` 의 진짜-뒤로
// 분기(`navigate(-1)`)와 브라우저 뒤로/앞으로 버튼은 둘 다 POP 다. `back()` 의 교체 분기(depth 0,
// REPLACE)와 `go()`(PUSH)는 false 다. 기존 필드(screen/target/go/back)는 시그니처를 한 글자도
// 바꾸지 않는다 — 이 필드는 **더한** 것이지 바꾼 것이 아니다.
import { createContext, createElement, useCallback, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useLocation, useNavigate, useNavigationType } from 'react-router';
import type { Screen } from './screens.ts';
import type { LegalDoc } from '../features/settings/legalContent.ts';
import { parsePath, pathFor } from './routes.ts';

/** 화면 안에서 **무엇을 열고 있는지**. 전부 평문이다 — URL 경로가 이 값의 저장소이므로
 *  (routes.ts) 문자열로 접을 수 있는 것만 실을 수 있다. 화면 키가 어느 해석을 쓸지 가른다:
 *  `drill` 은 board 에서 스테이지 대상, present 에서 시연 대상이다. */
export type NavTarget =
  | { kind: 'board' }
  | { kind: 'drill'; id: string }
  | { kind: 'session'; id: string }
  | { kind: 'tab'; tab: 'drills' | 'sessions' }
  | { kind: 'rule'; topic: string }
  /** 설정 화면 안에 뜨는 법적 고지 문서(`/settings/privacy`·`/settings/terms`).
   *  새 화면 키를 만들지 않는 이유는 PLAN-LEGAL-PAGES 결정 1 — 레일·헤더·도움말 등록을
   *  settings 에서 그대로 물려받는다. `rule` 이 rules 화면 안의 주제를 싣는 것과 같은 자리다.
   *  타입만 features 에서 가져온다(값 import 가 아니다) — 어느 문서가 있는지는 원문을 쥔
   *  쪽이 정하고, 여기는 그 목록을 베끼지 않는다. */
  | { kind: 'legal'; doc: LegalDoc }
  /** 공유 링크 착지(`/s/:id` — PLAN-SHARE-LINK 결정 9). 라이브러리 화면('drills') 안의
   *  대상이다 — `legal` 이 설정 안의 문서인 것과 같은 자리이고, 새 화면 키를 만들지 않는다.
   *  ⚠️ **열쇠는 여기 없다.** 링크의 `#` 뒤(43자 키)는 경로가 아니라 프래그먼트이고, 이 타입은
   *  "URL 경로로 접을 수 있는 것만 싣는다" 는 위 규약을 지킨다 — 열쇠는 UI 가 `location.hash`
   *  에서 읽는다. 여기 실으면 history state 와 prerender 에 열쇠가 복사된다. */
  | { kind: 'share'; id: string };

export interface AppHistoryApi {
  screen: Screen;
  /** 지금 주소가 싣고 있는 대상. AppShell 이 이걸로 스테이지/시연 대상을 파생한다. */
  target?: NavTarget;
  /** 이번 렌더의 전환이 POP(브라우저 뒤로/앞으로, 또는 back() 의 진짜-뒤로 분기)에서 왔는가.
   *  결정 11 — 화면 로더가 이 신호를 보고 뒤로가기 전환의 표시를 면제한다. **옵셔널이다** —
   *  이 저장소는 목 내비를 AppHistoryApi 객체 리터럴로 수십 곳에 직접 박아 두므로(테스트
   *  전역), 필수로 두면 이 파일 하나의 변경이 그 파일들을 전부 컴파일 에러로 깨운다. 실제
   *  구현(useAppHistory)은 항상 값을 채워 돌려주므로 소비자(AppShell)만 `?? false` 로 받으면
   *  된다 — "기존 API 는 한 글자도 바꾸지 않는다" 는 계약을 목 리터럴에도 지키는 방법이다. */
  lastNavFromHistory?: boolean;
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
  const navigationType = useNavigationType();
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

  return { screen: parsed.screen, target: parsed.target, lastNavFromHistory: navigationType === 'POP', go, back };
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
