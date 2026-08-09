// §6.8 화면 골격의 실제 레이아웃 — 프로토타입 template.html 의 앱 레일(84px)+헤더(62px)+본문
// 구조를 그대로 옮긴다. useAppHistory 를 여기서 정확히 한 번만 불러 AppNavProvider 로 내려보낸다
// (useAppHistory.ts 상단 주석 — 여러 곳에서 각자 부르면 popstate 가 없는 go()/back() 호출이
// 서로 어긋난다).
//
// 화면 간 계약 — src/features/home/nav.ts(screen-home-library 소유)와 상호 확인 완료(그 파일
// 상단 "통합 확인" 주석 참고):
//  · home/library 는 §8 표대로 app-shell 을 import 하지 않는다. 화면 전환은 이 파일이 HomeNav
//    를 만족하도록 만든 어댑터를 `nav` prop 으로 내려받아서 하고, 헤더(제목·부제·검색·주 액션)
//    도 app-shell(이 파일의 staticHeaderConfigFor)이 정적으로 계산해 AppHeader 에 꽂는다 —
//    그 두 화면은 useAppHeader 를 스스로 부르지 않는다.
//  · settings 도 §8 표대로 app-shell 미의존이라 마찬가지로 정적 헤더를 받는다.
//  · editor/present 는 §8 표대로 app-shell 에 의존해도 되는 화면이라 useAppNav()/useAppHeader()
//    를 직접 구독할 수 있다 — 그래서 이 둘은 정적 헤더 대신 AppHeader 의 Context 구독으로
//    비켜준다(staticHeaderConfigFor 가 undefined 를 돌려준다).
//  · "무엇을 열지"(어떤 드릴/세션)는 react-router 가 없어(§6.8) DESIGN.md 에 채널이 없다 —
//    editor/present 가 app-shell 에 의존 가능하므로 이 파일이 라우팅 대상을 Context 로 들고
//    있다가 useEditorTarget()/usePresentTarget() 로 내준다(계약 밖 확장, 아래 export 참고).
//  · `<main id="main" tabIndex={-1}>` 는 각 화면이 §7.5a 대로 스스로 렌더한다 — AppShell 은
//    화면 스위치 바깥에 별도 <main> 을 두지 않는다(home/library 쪽과 상호 확인 완료).
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { SkipLink } from '../ui/SkipLink.tsx';
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
import type { AppHistoryApi } from './useAppHistory.ts';
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
/** `home` 자리에 무엇이 떠 있는지. 2026-08-09 재편으로 `editor` 화면 키가 없어지면서,
 *  "자유 전술판이냐 드릴 편집이냐" 는 화면 키가 아니라 이 값이 정한다(screens.ts 주석 참고).
 *  기본값이 board 인 것이 곧 "대문에 전술판이 상시 떠 있다" 는 요구다. */
export type StageTarget = { kind: 'board' } | { kind: 'drill'; drillId: DrillId };
export type PresentTarget = { kind: 'drill'; drillId: DrillId } | { kind: 'session'; sessionId: SessionId };

const StageTargetContext = createContext<StageTarget>({ kind: 'board' });
const PresentTargetContext = createContext<PresentTarget | null>(null);

/** home 자리의 화면들(BoardScreen/EditorScreen)이 자기가 무엇을 그릴지 알아내는 통로 —
 *  둘 다 app-shell 에 의존해도 되는 화면이라(§8 "전부") 이 훅을 직접 부를 수 있다. */
export function useStageTarget(): StageTarget {
  return useContext(StageTargetContext);
}
/** screen-present 가 무엇을 시연할지 알아내는 통로. 레일에서 직접 '시연'을 눌러 들어온 경우
 *  등 대상이 없을 수 있다 — null 이면 화면이 자체적으로 빈 상태를 그린다. */
export function usePresentTarget(): PresentTarget | null {
  return useContext(PresentTargetContext);
}

/** HomeNav(=LibraryNav) 구현체 — useAppHistory().go 위에 "무엇을 열지"까지 함께 기록한다. */
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
        nav.go('home');
      },
      openDrill: (id) => {
        setStageTarget({ kind: 'drill', drillId: id });
        nav.go('home');
      },
      goLibrary: (opts) => {
        setLibraryIntent(opts ?? null);
        nav.go('library');
      },
      openSession: (id) => {
        setLibraryIntent({ tab: 'sessions', openSessionId: id });
        nav.go('library');
      },
      presentDrill: (id) => {
        setPresentTarget({ kind: 'drill', drillId: id });
        nav.go('present');
      },
      presentSession: (id) => {
        setPresentTarget({ kind: 'session', sessionId: id });
        nav.go('present');
      },
    }),
    [nav, setStageTarget, setPresentTarget, setLibraryIntent],
  );
}

/** home/library/settings 는 §8 표대로 app-shell 미의존이라 useAppHeader 로 스스로를 못 알린다
 *  — 그 셋의 헤더는 여기서 정적으로 계산해 AppHeader 에 직접 prop 으로 먹인다. editor/present 는
 *  courtMode·저장 상태처럼 화면 내부 Provider 안의 값이 필요해서 대신 스스로 useAppHeader 로
 *  선언한다 — 이 함수는 그 둘에서 undefined 를 반환해 AppHeader 가 Context 값을 쓰게 비켜준다
 *  (정적 계산과 Context 선언이 같은 프레임에 동시에 밀어넣으면 서로 경합한다). */
function useStaticHeaderConfig(screen: Screen, nav: HomeNav): HeaderConfig | undefined {
  const { search, setSearch } = useLibrary();
  switch (screen) {
    // ★ 'home' 은 이제 여기서 다루지 않는다(undefined 로 떨어진다). 2026-08-09 재편으로 home
    // 자리에는 자유 전술판/드릴 편집이 뜨고, 둘 다 useAppHeader 로 자기 헤더를 선언한다 —
    // 코트 전환 세그먼트·[드릴로 저장]·되돌리기처럼 Provider 안쪽 값이 필요해서다.
    // 여기서 정적 config 를 돌려주면 AppHeader 의 config prop 이 Context 를 **덮어써서**
    // 그 헤더가 통째로 사라진다(실제로 그랬다 — 테스트는 AppHeader 를 config 없이 렌더해서
    // 못 잡았고, 앱을 띄워 보고서야 드러났다).
    case 'library':
      return {
        title: SCREEN_TITLES.library,
        subtitle: SCREEN_SUBTITLES.library,
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
    case 'home':
      // 같은 자리, 같은 EditorWorkspace — board 냐 drill 이냐만 다르다(§6.8 재편).
      return stage.kind === 'board' ? <BoardScreen /> : <EditorScreen />;
    case 'library':
      return <LibraryScreen nav={nav} initialTab={libraryIntent?.tab} initialOpenSessionId={libraryIntent?.openSessionId} />;
    case 'present':
      return <PresentScreen />;
    case 'settings':
      return <SettingsScreen />;
  }
}

export function AppShell() {
  const nav = useAppHistory('home');
  const { toasts, dismiss } = useToast();
  const isFirstRender = useRef(true);

  const [stageTarget, setStageTarget] = useState<StageTarget>({ kind: 'board' });
  const [presentTarget, setPresentTarget] = useState<PresentTarget | null>(null);
  const [libraryIntent, setLibraryIntent] = useState<{ tab?: LibraryTab; openSessionId?: SessionId } | null>(null);
  const homeNav = useHomeNavAdapter(nav, setStageTarget, setPresentTarget, setLibraryIntent);
  const staticHeaderConfig = useStaticHeaderConfig(nav.screen, homeNav);

  // §7.6: 화면 전환(go·back·popstate 전부) 시 <main id="main"> 에 포커스 + 라이브 리전 발표.
  // 최초 마운트(직접 진입)는 제외한다 — 브라우저가 이미 페이지 로드 시점의 포커스를 다뤘다.
  // main 은 화면마다 자기 것을 렌더하므로(위 주석) DOM 조회는 화면 전환 커밋 이후에 한다.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    document.getElementById('main')?.focus({ preventScroll: true });
    liveRegion.say(`${SCREEN_TITLES[nav.screen]} 화면`);
  }, [nav.screen]);

  return (
    <AppNavProvider value={nav}>
      <HeaderProvider>
        <StageTargetContext.Provider value={stageTarget}>
          <PresentTargetContext.Provider value={presentTarget}>
            <SkipLink />
            <div style={{ height: '100vh', display: 'flex', overflow: 'hidden', background: 'var(--bg)', color: 'var(--text)' }}>
              <AppRail />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <AppHeader config={staticHeaderConfig} />
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
