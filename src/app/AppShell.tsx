// §6.8 화면 골격의 실제 레이아웃 — 프로토타입 template.html 의 앱 레일(84px)+헤더(62px)+본문
// 구조를 그대로 옮긴다. **좁은 창에서는 그 레일이 0 이 되고 헤더 좌측 세그먼트가 대신 선다**
// (3.-2 §5.2 — 폭 예산 117 중 84 가 그 행이다). useAppHistory 를 여기서 정확히 한 번만 불러 AppNavProvider 로 내려보낸다
// (useAppHistory.ts 상단 주석 — 여러 곳에서 각자 부르면 popstate 가 없는 go()/back() 호출이
// 서로 어긋난다).
//
// 화면 간 계약 — src/features/home/nav.ts(screen-home-library 소유)와 상호 확인 완료(그 파일
// 상단 "통합 확인" 주석 참고):
//  · board(자유 전술판)/drills 는 §8 표대로 app-shell 을 import 하지 않는다. 화면 전환은 이
//    파일이 HomeNav 를 만족하도록 만든 어댑터를 `nav` prop 으로 내려받아서 하고, 헤더(제목·부제·검색·주 액션)
//    도 app-shell(이 파일의 staticHeaderConfigFor)이 정적으로 계산해 AppHeader 에 꽂는다 —
//    그 두 화면은 useAppHeader 를 스스로 부르지 않는다.
//  · settings 도 §8 표대로 app-shell 미의존이라 마찬가지로 정적 헤더를 받는다.
//  · editor/present 는 §8 표대로 app-shell 에 의존해도 되는 화면이라 useAppNav()/useAppHeader()
//    를 직접 구독할 수 있다 — 그래서 이 둘은 정적 헤더 대신 AppHeader 의 Context 구독으로
//    비켜준다(staticHeaderConfigFor 가 undefined 를 돌려준다).
//  · "무엇을 열지"(어떤 드릴/세션)는 react-router 가 없어(§6.8) DESIGN.md 에 채널이 없다 —
//    editor/present 가 app-shell 에 의존 가능하므로 이 파일이 라우팅 대상을 Context 로 들고
//    있다가 useStageTarget()/usePresentTarget() 로 내준다(계약 밖 확장, 아래 export 참고).
//    2026-08-12(계획서 2.3)부터 그 대상은 history.state 의 NavTarget 에도 함께 실린다 —
//    리로드·뒤로가기로 재마운트돼도 무엇을 열고 있었는지가 살아남아야 하기 때문이다.
//  · `<main id="main" tabIndex={-1}>` 는 각 화면이 §7.5a 대로 스스로 렌더한다 — AppShell 은
//    화면 스위치 바깥에 별도 <main> 을 두지 않는다(board/drills 쪽과 상호 확인 완료).
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { SkipLink } from '../ui/SkipLink.tsx';
import { useIsNarrow } from '../ui/useIsNarrow.ts';
import { LiveRegion, liveRegion } from '../ui/LiveRegion.tsx';
import { ToastHost } from '../ui/ToastHost.tsx';
import { IconPlus } from '../ui/icons.tsx';
import { useToast } from '../store/toast/ToastProvider.tsx';
import { useLibrary } from '../store/library/LibraryProvider.tsx';
import type { DrillId, SessionId } from '../core/ids.ts';
import type { HomeNav, LibraryTab } from '../features/home/nav.ts';
import { AppRail } from './AppRail.tsx';
import { AppHeader, HeaderProvider } from './AppHeader.tsx';
import type { HeaderConfig } from './AppHeader.tsx';
import { AppNavProvider, useAppHistory } from './useAppHistory.ts';
import type { AppHistoryApi, NavTarget } from './useAppHistory.ts';
import { announceFor } from './announce.ts';
import { SCREEN_SUBTITLES, SCREEN_TITLES } from './screens.ts';
import type { Screen } from './screens.ts';

// 화면 컴포넌트 — screen-home-library/screen-editor/screen-present/screen-settings 소유(§8).
// Wave 4 는 이 다섯 모듈이 병렬로 진행되므로, 형제 모듈의 산출물이 아직 없는 동안은 이 import
// 가 타입체크를 막는다(정상 — 통합 시점에 다시 확인한다). 최종 보고서에 명시.
import { LibraryScreen } from '../features/library/LibraryScreen.tsx';
import { BoardScreen } from '../features/board/BoardScreen.tsx';
import { EditorScreen } from '../features/editor/EditorScreen.tsx';
import { PresentScreen } from '../features/present/PresentScreen.tsx';
import { SettingsScreen } from '../features/settings/SettingsScreen.tsx';

// ── 화면 간 라우팅 대상 (계약 밖 확장 — DESIGN.md 가 안 정한 부분을 메운다) ──────────────────
/** `board` 자리에 무엇이 떠 있는지. 2026-08-09 재편으로 `editor` 화면 키가 없어지면서,
 *  "자유 전술판이냐 드릴 편집이냐" 는 화면 키가 아니라 이 값이 정한다(screens.ts 주석 참고).
 *  기본값이 board 인 것이 곧 "대문에 전술판이 상시 떠 있다" 는 요구다. */
export type StageTarget = { kind: 'board' } | { kind: 'drill'; drillId: DrillId };
export type PresentTarget = { kind: 'drill'; drillId: DrillId } | { kind: 'session'; sessionId: SessionId };

const StageTargetContext = createContext<StageTarget>({ kind: 'board' });
const PresentTargetContext = createContext<PresentTarget | null>(null);

// ── NavTarget(history.state) ↔ 화면별 대상 ────────────────────────────────────────────────
// NavEntry.target 은 평문 { kind, id } 라 board/present 어느 쪽 대상인지를 스스로 말하지
// 않는다 — **화면 키가 그 해석을 정한다**(useAppHistory.ts 의 NavTarget 주석). 아래 셋이
// 그 해석의 유일한 자리다. 못 읽으면 null 을 돌려 "지금 값을 그대로 둔다" 는 뜻이 된다.

function stageFromNav(screen: Screen, target: NavTarget | undefined): StageTarget | null {
  if (screen !== 'board' || !target) return null;
  if (target.kind === 'board') return { kind: 'board' };
  if (target.kind === 'drill') return { kind: 'drill', drillId: target.id as DrillId };
  return null;
}

function presentFromNav(screen: Screen, target: NavTarget | undefined): PresentTarget | null {
  if (screen !== 'present' || !target) return null;
  if (target.kind === 'drill') return { kind: 'drill', drillId: target.id as DrillId };
  if (target.kind === 'session') return { kind: 'session', sessionId: target.id as SessionId };
  return null;
}

/** 목록 화면의 초기 의도(어느 탭 · 어느 드로어). **대상이 없는 drills 엔트리는 "의도 없음"** 이라
 *  빈 의도를 돌려준다 — board 의 "대상이 없으면 지금 값을 그대로 둔다"(손에 든 판은 들렀다 와도
 *  그대로)와 갈리는 지점이고, 그것이 계약이다. 목록은 손에 든 물건이 아니라 들어올 때마다 새로
 *  여는 화면이라, 앞서 열었던 탭·드로어가 뒤 엔트리에서 따라오면 **뒤로가기가 어긋난다**(계획서
 *  2.9: 탭 전환은 엔트리를 쌓고 뒤로가기는 정확히 이전 탭으로 돌아와야 한다). 탭을 안 실은
 *  엔트리로 돌아오면 LibraryScreen 이 세션 개수로 기본 탭을 다시 정한다(defaultLibraryTab). */
function intentFromNav(screen: Screen, target: NavTarget | undefined): { tab?: LibraryTab; openSessionId?: SessionId } | null {
  if (screen !== 'drills') return null;
  if (target?.kind === 'tab') return { tab: target.tab };
  if (target?.kind === 'session') return { tab: 'sessions', openSessionId: target.id as SessionId };
  return {};
}

/** board 자리의 화면들(BoardScreen/EditorScreen)이 자기가 무엇을 그릴지 알아내는 통로 —
 *  둘 다 app-shell 에 의존해도 되는 화면이라(§8 "전부") 이 훅을 직접 부를 수 있다. */
export function useStageTarget(): StageTarget {
  return useContext(StageTargetContext);
}
/** screen-present 가 무엇을 시연할지 알아내는 통로. 레일에서 직접 '시연'을 눌러 들어온 경우
 *  등 대상이 없을 수 있다 — null 이면 화면이 자체적으로 빈 상태를 그린다. */
export function usePresentTarget(): PresentTarget | null {
  return useContext(PresentTargetContext);
}

/** HomeNav(=LibraryNav) 구현체 — useAppHistory().go 위에 "무엇을 열지"까지 함께 기록한다.
 *
 *  대상을 **두 곳에** 쓴다: (1) React state(즉시 — 화면 키와 같은 배치에서 바뀌어야 판이
 *  board→drill 로 한 프레임 깜빡이지 않는다) (2) history.state 의 NavTarget(리로드·뒤로가기
 *  생존). 둘 중 하나만 쓰면 각각 "리로드하면 빈 화면"·"한 프레임 헛 마운트" 가 된다. */
function useHomeNavAdapter(
  nav: AppHistoryApi,
  setStageTarget: (t: StageTarget) => void,
  setPresentTarget: (t: PresentTarget) => void,
  setLibraryIntent: (i: { tab?: LibraryTab; openSessionId?: SessionId } | null) => void,
): HomeNav {
  return useMemo<HomeNav>(
    () => ({
      // "새 드릴" = 전술판으로 데려가기. 새 드릴은 전술판에서 그린 뒤 [드릴로 저장] 으로
      // 승격시키는 것이 재편 후의 주 경로다(§6.8). 여기서 판을 초기화하지는 **않는다** —
      // 목록에서 버튼 하나 눌렀다고 그리던 판이 날아가면 안 된다.
      newDrill: () => {
        setStageTarget({ kind: 'board' });
        nav.go('board', { kind: 'board' });
      },
      openDrill: (id) => {
        setStageTarget({ kind: 'drill', drillId: id });
        nav.go('board', { kind: 'drill', id });
      },
      goLibrary: (opts) => {
        setLibraryIntent(opts ?? null);
        nav.go('drills', opts?.tab ? { kind: 'tab', tab: opts.tab } : undefined);
      },
      openSession: (id) => {
        setLibraryIntent({ tab: 'sessions', openSessionId: id });
        nav.go('drills', { kind: 'session', id });
      },
      presentDrill: (id) => {
        setPresentTarget({ kind: 'drill', drillId: id });
        nav.go('present', { kind: 'drill', id });
      },
      presentSession: (id) => {
        setPresentTarget({ kind: 'session', sessionId: id });
        nav.go('present', { kind: 'session', id });
      },
    }),
    [nav, setStageTarget, setPresentTarget, setLibraryIntent],
  );
}

/** drills/settings 는 §8 표대로 app-shell 미의존이라 useAppHeader 로 스스로를 못 알린다
 *  — 그 둘의 헤더는 여기서 정적으로 계산해 AppHeader 에 직접 prop 으로 먹인다. board/present 는
 *  courtMode·저장 상태처럼 화면 내부 Provider 안의 값이 필요해서 대신 스스로 useAppHeader 로
 *  선언한다 — 이 함수는 그 둘에서 undefined 를 반환해 AppHeader 가 Context 값을 쓰게 비켜준다
 *  (정적 계산과 Context 선언이 같은 프레임에 동시에 밀어넣으면 서로 경합한다). */
function useStaticHeaderConfig(screen: Screen, nav: HomeNav): HeaderConfig | undefined {
  const { search, setSearch } = useLibrary();
  switch (screen) {
    // ★ 'board' 는 이제 여기서 다루지 않는다(undefined 로 떨어진다). 2026-08-09 재편으로 board
    // 자리에는 자유 전술판/드릴 편집이 뜨고, 둘 다 useAppHeader 로 자기 헤더를 선언한다 —
    // 코트 전환 세그먼트·[드릴로 저장]·되돌리기처럼 Provider 안쪽 값이 필요해서다.
    // 여기서 정적 config 를 돌려주면 AppHeader 의 config prop 이 Context 를 **덮어써서**
    // 그 헤더가 통째로 사라진다(실제로 그랬다 — 테스트는 AppHeader 를 config 없이 렌더해서
    // 못 잡았고, 앱을 띄워 보고서야 드러났다).
    case 'drills':
      return {
        title: SCREEN_TITLES.drills,
        subtitle: SCREEN_SUBTITLES.drills,
        primary: { label: '새 드릴', icon: <IconPlus size={15} />, onAction: nav.newDrill },
        search: { value: search, onChange: setSearch, placeholder: '드릴 검색…' },
      };
    case 'settings':
      return { title: SCREEN_TITLES.settings, subtitle: SCREEN_SUBTITLES.settings };
    default:
      return undefined;
  }
}

function renderScreen(
  screen: Screen,
  stage: StageTarget,
  nav: HomeNav,
  libraryIntent: { tab?: LibraryTab; openSessionId?: SessionId } | null,
) {
  switch (screen) {
    case 'board':
      // 같은 자리, 같은 EditorWorkspace — board 냐 drill 이냐만 다르다(§6.8 재편).
      return stage.kind === 'board' ? <BoardScreen /> : <EditorScreen />;
    case 'drills':
      return <LibraryScreen nav={nav} initialTab={libraryIntent?.tab} initialOpenSessionId={libraryIntent?.openSessionId} />;
    case 'present':
      return <PresentScreen />;
    case 'settings':
      return <SettingsScreen />;
  }
}

/** 얕은 평문 비교 — 세 대상은 전부 `{ kind, id }` 꼴의 평면 객체다. 참조가 아니라 **내용**으로
 *  비교해야, popstate 동기화가 이미 서 있는 것과 같은 값을 다시 심어 헛 재렌더를 만들지 않는다. */
function sameTarget(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  return ka.length === kb.length && ka.every((k) => (a as Record<string, unknown>)[k] === (b as Record<string, unknown>)[k]);
}

export function AppShell() {
  const nav = useAppHistory('board');
  const { toasts, dismiss } = useToast();
  const { drills, sessions } = useLibrary();
  const isFirstRender = useRef(true);
  // 3.-2 §5.2 — 좁으면 84px 레일을 걷고 같은 3항목을 헤더 좌측 세그먼트로 세운다. **판정은
  // 여기 한 번뿐이다**: 레일과 세그먼트가 같은 boolean 을 나눠 써야 "둘 다 서 있다/둘 다
  // 없다" 는 프레임이 열리지 않는다. 판 위에 오버레이로 얹지 않는 이유는 AppNavSegment.tsx
  // 머리말(edgePanBandPx=56 충돌)에 있다.
  const narrow = useIsNarrow();

  /** 라이브 리전 발표문이 쓸 제목 조회. 목록 요약·세션은 앱 최상단에서 이미 한 번 읽혀 있으므로
   *  (LibraryProvider) 여기서 저장소를 새로 열지 않는다 — 발표가 비동기가 되면 화면이 바뀐
   *  한참 뒤에 읽혀 "방금 무엇이 열렸는가" 가 아니게 된다. 못 찾으면 undefined 를 돌려
   *  announceFor 가 제목 없는 문장을 쓰게 둔다. */
  const titleOf = useCallback(
    (t: StageTarget | PresentTarget): string | undefined => {
      if (t.kind === 'drill') return drills.find((d) => d.id === t.drillId)?.title;
      if (t.kind === 'session') return sessions.find((s) => s.session.id === t.sessionId)?.session.title;
      return undefined;
    },
    [drills, sessions],
  );

  // 초기값은 history.state 가 싣고 온 대상에서 되살린다 — 체육관 태블릿이 시연 도중 리로드돼도
  // 화면만 'present' 로 돌아오고 대상은 null 이라 *"시연할 드릴을 목록에서 선택하세요"* 라는
  // 빈 화면이 뜨던 자리다(계획서 2.3). 지연 초기화라 마운트 시점에 이미 옳은 값이다 —
  // 아래 동기화 이펙트에 맡기면 판이 board→drill 로 한 프레임 깜빡이며 헛 마운트한다.
  const [stageTarget, setStageTarget] = useState<StageTarget>(() => stageFromNav(nav.screen, nav.target) ?? { kind: 'board' });
  const [presentTarget, setPresentTarget] = useState<PresentTarget | null>(() => presentFromNav(nav.screen, nav.target));
  const [libraryIntent, setLibraryIntent] = useState<{ tab?: LibraryTab; openSessionId?: SessionId } | null>(() =>
    intentFromNav(nav.screen, nav.target),
  );
  const homeNav = useHomeNavAdapter(nav, setStageTarget, setPresentTarget, setLibraryIntent);
  const staticHeaderConfig = useStaticHeaderConfig(nav.screen, homeNav);

  // 브라우저 뒤로/앞으로가기로 돌아온 엔트리가 대상을 싣고 있으면 그 대상으로 되돌린다.
  // 스테이지·시연은 없으면(대상 없는 엔트리) 지금 값을 그대로 둔다 — 레일 [보드]는 대상을
  // 안 싣고, 그것이 곧 "들렀다 와도 손에 든 판은 그대로" 라는 계약이다(2.1 원칙 2).
  // **목록 의도만 반대다**: 빈 의도도 값이라 그대로 심는다(intentFromNav 주석).
  const navTarget = nav.target;
  useEffect(() => {
    const s = stageFromNav(nav.screen, navTarget);
    if (s) setStageTarget((prev) => (sameTarget(prev, s) ? prev : s));
    const p = presentFromNav(nav.screen, navTarget);
    if (p) setPresentTarget((prev) => (sameTarget(prev, p) ? prev : p));
    const i = intentFromNav(nav.screen, navTarget);
    if (i) setLibraryIntent((prev) => (sameTarget(prev, i) ? prev : i));
  }, [nav.screen, navTarget]);

  // §7.6: 화면 전환(go·back·popstate 전부) 시 <main id="main"> 에 포커스 + 라이브 리전 발표.
  // 최초 마운트(직접 진입)는 제외한다 — 브라우저가 이미 페이지 로드 시점의 포커스를 다뤘다.
  // main 은 화면마다 자기 것을 렌더하므로(위 주석) DOM 조회는 화면 전환 커밋 이후에 한다.
  //
  // 발표문은 화면 키가 아니라 announceFor 가 만든다 — 화면 키만 읽으면 자유판이든 드릴이든
  // 늘 "전술판 화면" 이라, 시각장애 코치는 방금 무엇이 열렸는지 알 수 없다(계획서 2.4).
  // 그래서 의존성에 대상 둘이 함께 들어간다: 같은 board 화면 안에서 대상만 바뀌는 전환
  // (드릴 열기·[빈 판으로])도 발표 대상이다.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    document.getElementById('main')?.focus({ preventScroll: true });
    liveRegion.say(announceFor(nav.screen, stageTarget, presentTarget, { titleOf, tab: libraryIntent?.tab }));
    // titleOf/libraryIntent 는 발표문의 재료일 뿐 전환 신호가 아니다 — 목록이 뒤늦게 읽히거나
    // 탭만 바뀌었다고 같은 화면을 다시 발표하면 안 된다(포커스도 함께 튄다).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nav.screen, stageTarget, presentTarget]);

  return (
    <AppNavProvider value={nav}>
      <HeaderProvider>
        <StageTargetContext.Provider value={stageTarget}>
          <PresentTargetContext.Provider value={presentTarget}>
            <SkipLink />
            <div style={{ height: '100%', display: 'flex', overflow: 'hidden', background: 'var(--bg)', color: 'var(--text)' }}>
              {!narrow && <AppRail />}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <AppHeader config={staticHeaderConfig} narrow={narrow} />
                {renderScreen(nav.screen, stageTarget, homeNav, libraryIntent)}
              </div>
            </div>
            <ToastHost toasts={toasts} onDismiss={dismiss} />
            <LiveRegion />
          </PresentTargetContext.Provider>
        </StageTargetContext.Provider>
      </HeaderProvider>
    </AppNavProvider>
  );
}
