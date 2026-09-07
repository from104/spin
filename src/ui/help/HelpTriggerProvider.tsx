// 레일 [도움말] 일원화(§0.5 Phase 5, docs/PLAN-HELP-TUTORIAL.md §A) — 왼쪽 레일(`AppRail`)·
// 좁은 창 헤더(`AppNavAside` — 파일은 `src/app/AppNavSegment.tsx` 다, 이름과 파일이 어긋나
// 있어 찾을 때 헤맨다)의 [도움말] 버튼은 화면 트리 밖(AppShell)에 있어서 "지금 열려
// 있는 화면"의 도움말을 직접 못 연다. 각 화면이 자기 `HelpCenter` 의 `open` 을 여는 함수를
// 여기 등록해 두면, 레일 버튼은 그 등록된 함수를 부르기만 한다 — 화면이 바뀌면(마운트·
// 언마운트) 등록도 함께 갈린다.
//
// §8 "screen-home-library 의존은 store·render-court·ui-kit·model·storage 뿐" 을 지키려고
// `src/app/` 이 아니라 `src/ui/help/`(ui-kit)에 둔다 — 드릴 목록·세션 화면도 app-shell 을
// import 하지 않고 이 파일을 쓸 수 있어야 한다.
import { createContext, useCallback, useContext, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

interface HelpTriggerApi {
  subscribe(show: () => void): () => void;
  show(): void;
}

const HelpTriggerContext = createContext<HelpTriggerApi | null>(null);

export function HelpTriggerProvider({ children }: { children: ReactNode }) {
  // ref 다 — "지금 어떤 화면이 등록돼 있는가" 는 렌더와 무관한 배선 상태라 리렌더를 끌 이유가
  // 없다(구독자는 언제나 최신 함수를 부르면 그만이다).
  const currentRef = useRef<(() => void) | null>(null);

  const subscribe = useCallback((show: () => void) => {
    currentRef.current = show;
    return () => {
      if (currentRef.current === show) currentRef.current = null;
    };
  }, []);
  const show = useCallback(() => {
    currentRef.current?.();
  }, []);

  return <HelpTriggerContext.Provider value={{ subscribe, show }}>{children}</HelpTriggerContext.Provider>;
}

/** 화면이 자기 "도움말 열기" 함수를 등록한다 — 마운트 중엔 이 화면이 "현재 화면"이다.
 *  `show` 는 안정된 참조로 넘겨라(useCallback) — 매 렌더 새 함수면 등록·해지가 매번 돈다
 *  (동작은 맞지만 낭비다). Provider 밖(예: 단위 테스트에서 HelpCenter 만 단독으로 세울 때)
 *  에서는 조용히 아무 일도 안 한다. */
export function usePublishHelpShow(show: () => void): void {
  const ctx = useContext(HelpTriggerContext);
  useEffect(() => {
    if (!ctx) return;
    return ctx.subscribe(show);
  }, [ctx, show]);
}

/** 레일 [도움말] 버튼이 부른다 — 등록된 화면이 없으면(전환 중 등 드문 순간) 조용히 아무 일도
 *  안 한다. Provider 밖에서 부르면 no-op. */
export function useHelpShow(): () => void {
  const ctx = useContext(HelpTriggerContext);
  return useCallback(() => ctx?.show(), [ctx]);
}
