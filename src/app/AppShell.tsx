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
//  · "무엇을 열지"(어떤 드릴/세션)는 **URL 이 저장소다**(구조 개편 C4, react-router 도입 —
//    routes.ts 의 pathFor/parsePath 가 단일 출처). 이 파일은 그 값을 파생해 Context 로
//    내준다(useStageTarget()/usePresentTarget()) — 리로드·뒤로가기 생존이 공짜가 됐고,
//    옛 "React state + history.state 두 곳에 쓴다" 이중 장부는 은퇴했다.
//  · `<main id="main" tabIndex={-1}>` 는 각 화면이 §7.5a 대로 스스로 렌더한다 — AppShell 은
//    화면 스위치 바깥에 별도 <main> 을 두지 않는다(board/drills 쪽과 상호 확인 완료).
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { SkipLink } from '../ui/SkipLink.tsx';
import { useIsNarrow } from '../ui/useIsNarrow.ts';
import { LiveRegion, liveRegion } from '../ui/LiveRegion.tsx';
import { ToastHost } from '../ui/ToastHost.tsx';
import { IconPlus, IconArrowLeft } from '../ui/icons.tsx';
import { useToast } from '../store/toast/ToastProvider.tsx';
import { useLibrary } from '../store/library/LibraryProvider.tsx';
import type { DrillId, SessionId } from '../core/ids.ts';
import type { HomeNav } from '../features/home/nav.ts';
import { AppRail } from './AppRail.tsx';
import { AppHeader, HeaderProvider } from './AppHeader.tsx';
import type { HeaderConfig } from './AppHeader.tsx';
import { AppNavProvider, useAppHistory } from './useAppHistory.ts';
import type { AppHistoryApi, NavTarget } from './useAppHistory.ts';
import { HelpTriggerProvider } from '../ui/help/HelpTriggerProvider.tsx';
import { announceFor } from './announce.ts';
import { SCREEN_SUBTITLES, SCREEN_TITLES, railFor } from './screens.ts';
import type { Screen } from './screens.ts';
import { useT } from '../i18n/useT.ts';
import { useLocale } from '../i18n/useLocale.ts';

// 화면 컴포넌트 — screen-home-library/screen-editor/screen-present/screen-settings 소유(§8).
// Wave 4 는 이 다섯 모듈이 병렬로 진행되므로, 형제 모듈의 산출물이 아직 없는 동안은 이 import
// 가 타입체크를 막는다(정상 — 통합 시점에 다시 확인한다). 최종 보고서에 명시.
import { LibraryScreen } from '../features/library/LibraryScreen.tsx';
import { NewDrillDialog } from '../features/library/NewDrillDialog.tsx';
import { SessionsScreen } from '../features/sessions/SessionsScreen.tsx';
import { SessionEditorScreen } from '../features/sessions/SessionEditorScreen.tsx';
import { BoardScreen } from '../features/board/BoardScreen.tsx';
import { EditorScreen } from '../features/editor/EditorScreen.tsx';
import { PresentScreen } from '../features/present/PresentScreen.tsx';
import { RulesScreen } from '../features/rules/RulesScreen.tsx';
import { RULE_TOPIC_KEYS, ruleTopicsFor } from '../features/rules/ruleTopics.ts';
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

function stageFromNav(screen: Screen, target: NavTarget | undefined): StageTarget {
  if (screen === 'board' && target?.kind === 'drill') return { kind: 'drill', drillId: target.id as DrillId };
  return { kind: 'board' };
}

function presentFromNav(screen: Screen, target: NavTarget | undefined): PresentTarget | null {
  if (screen !== 'present' || !target) return null;
  if (target.kind === 'drill') return { kind: 'drill', drillId: target.id as DrillId };
  if (target.kind === 'session') return { kind: 'session', sessionId: target.id as SessionId };
  return null;
}

/** 세션 화면의 편집 대상(C6) — `/sessions/:id` 에서 파생한다. 드릴의 StageTarget 과 같은 꼴:
 *  같은 레일 항목(세션) 아래 목록/편집이 대상 유무로 갈린다. */
function sessionEditFromNav(screen: Screen, target: NavTarget | undefined): SessionId | undefined {
  if (screen !== 'sessions' || target?.kind !== 'session') return undefined;
  return target.id as SessionId;
}

/** 규칙 화면의 주제 상세 대상(2026-08-22 주제별 재설계) — `/rules/:topic` 에서 파생한다.
 *  유효한 주제 키인지는 여기서 검증하지 않는다(routes.ts 는 features 를 안 물고, 이 함수도
 *  같은 층에 있다) — 모르는 문자열이면 RulesScreen 이 스스로 카드 홈으로 폴백한다
 *  (routes.ts 의 "모르는 경로는 board" 와 같은 404-없음 교리, 화면 단위로 축소 적용). */
function ruleTopicFromNav(screen: Screen, target: NavTarget | undefined): string | undefined {
  if (screen !== 'rules' || target?.kind !== 'rule') return undefined;
  return target.topic;
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
function useHomeNavAdapter(nav: AppHistoryApi, openNewDrill: () => void): HomeNav {
  return useMemo<HomeNav>(
    () => ({
      // "새 드릴" = **화면 전환이 아니라 다이얼로그**(2026-08-28 기현 지시). 이름과 코트를
      // 먼저 묻고, [만들기] 로 태어난 드릴의 편집기로 간다 — NewDrillDialog.tsx 머리말 참고.
      //
      // 옛 기록(지우지 않는다): 2026-08-09 재편에서 이 자리는 `nav.go('board', {kind:'board'})`
      // 였다 — *"새 드릴은 전술판에서 그린 뒤 [드릴로 저장] 으로 승격시키는 것이 주 경로다(§6.8).
      // 여기서 판을 초기화하지는 않는다 — 목록에서 버튼 하나 눌렀다고 그리던 판이 날아가면 안 된다."*
      // 그 승격 경로는 전술판에 그대로 남아 있고, 여기만 갈라졌다.
      // C4 — 대상은 URL 로만 간다. 옛 "React state + history.state 두 곳 쓰기" 는 URL 이
      // 진실이 되면서 한 곳으로 접혔다(한 프레임 헛 마운트의 원인이던 이중 장부가 사라졌다).
      newDrill: openNewDrill,
      openDrill: (id) => nav.go('board', { kind: 'drill', id }),
      goLibrary: (opts) => nav.go('drills', opts?.tab ? { kind: 'tab', tab: opts.tab } : undefined),
      openSession: (id) => nav.go('drills', { kind: 'session', id }),
      presentDrill: (id) => nav.go('present', { kind: 'drill', id }),
      presentSession: (id) => nav.go('present', { kind: 'session', id }),
      openRuleTopic: (key) => nav.go('rules', key ? { kind: 'rule', topic: key } : undefined),
    }),
    [nav, openNewDrill],
  );
}

/** drills/settings 는 §8 표대로 app-shell 미의존이라 useAppHeader 로 스스로를 못 알린다
 *  — 그 둘의 헤더는 여기서 정적으로 계산해 AppHeader 에 직접 prop 으로 먹인다. board/present 는
 *  courtMode·저장 상태처럼 화면 내부 Provider 안의 값이 필요해서 대신 스스로 useAppHeader 로
 *  선언한다 — 이 함수는 그 둘에서 undefined 를 반환해 AppHeader 가 Context 값을 쓰게 비켜준다
 *  (정적 계산과 Context 선언이 같은 프레임에 동시에 밀어넣으면 서로 경합한다). */
function useStaticHeaderConfig(screen: Screen, nav: HomeNav, ruleTopic: string | undefined): HeaderConfig | undefined {
  const { search, setSearch } = useLibrary();
  const { createSession } = useLibrary();
  const locale = useLocale();
  const t = useT();
  switch (screen) {
    // ★ 'board' 는 이제 여기서 다루지 않는다(undefined 로 떨어진다). 2026-08-09 재편으로 board
    // 자리에는 자유 전술판/드릴 편집이 뜨고, 둘 다 useAppHeader 로 자기 헤더를 선언한다 —
    // 코트 전환 세그먼트·[드릴로 저장]·되돌리기처럼 Provider 안쪽 값이 필요해서다.
    // 여기서 정적 config 를 돌려주면 AppHeader 의 config prop 이 Context 를 **덮어써서**
    // 그 헤더가 통째로 사라진다(실제로 그랬다 — 테스트는 AppHeader 를 config 없이 렌더해서
    // 못 잡았고, 앱을 띄워 보고서야 드러났다).
    case 'drills':
      return {
        title: SCREEN_TITLES[locale].drills,
        subtitle: SCREEN_SUBTITLES[locale].drills,
        align: 'center',
        primary: { label: t('app.header.newDrill'), icon: <IconPlus size={15} />, onAction: nav.newDrill },
        search: { value: search, onChange: setSearch, placeholder: t('app.header.drillSearchPlaceholder') },
      };
    case 'sessions':
      // C5 — 세션 1급 화면의 헤더. [새 세션]이 여기 있는 이유: 목록이 비어 있지 않을 때의
      // 유일한 생성 진입점이다(빈 상태 CTA 는 SessionTab 본문에 그대로 있다).
      return {
        title: SCREEN_TITLES[locale].sessions,
        subtitle: SCREEN_SUBTITLES[locale].sessions,
        align: 'center',
        primary: {
          label: t('app.header.newSession'),
          icon: <IconPlus size={15} />,
          onAction: () => {
            void (async () => {
              // 새 세션의 기본 제목도 지금 켜진 UI 언어를 따른다 — 데이터지만 사용자가
              // 이름을 고치기 전까지 보게 되는 값이라, 다른 언어로 튀면 어색하다.
              const s = await createSession({ title: t('app.header.newSession') });
              nav.openSession(s.id); // 만들자마자 드로어로 — 이름부터 고치는 흐름
            })();
          },
        },
      };
    case 'rules': {
      // 2026-09-03 기현 지시 — 목록은 화면 제목·부제를 **가운데**, 카드 안은 카드 주제목·부제목을
      // 가운데 + 왼쪽 끝 [← 목록으로]. 규칙 화면은 §8 표대로 app-shell 미의존이라 여기서 계산한다
      // (문서 맨 위에 있던 [← 홈으로] 버튼은 이 버튼으로 옮겨 갔다 — RuleTopicDoc 에서 뺐다).
      const topic =
        ruleTopic && (RULE_TOPIC_KEYS as readonly string[]).includes(ruleTopic)
          ? ruleTopicsFor(locale).find((tp) => tp.key === ruleTopic)
          : undefined;
      if (!topic) return { title: SCREEN_TITLES[locale].rules, subtitle: SCREEN_SUBTITLES[locale].rules, align: 'center' };
      return {
        title: topic.title,
        subtitle: topic.tagline,
        align: 'center',
        leading: { label: t('rules.backToList'), icon: <IconArrowLeft size={16} />, onAction: () => nav.openRuleTopic() },
      };
    }
    case 'settings':
      return { title: SCREEN_TITLES[locale].settings, subtitle: SCREEN_SUBTITLES[locale].settings, align: 'center' };
    default:
      return undefined;
  }
}

function renderScreen(screen: Screen, stage: StageTarget, nav: HomeNav, sessionEditId: SessionId | undefined, ruleTopic: string | undefined) {
  switch (screen) {
    case 'board':
      // 같은 자리, 같은 EditorWorkspace — board 냐 drill 이냐만 다르다(§6.8 재편).
      return stage.kind === 'board' ? <BoardScreen /> : <EditorScreen />;
    case 'drills':
      return <LibraryScreen nav={nav} />;
    case 'sessions':
      // C6 — 드릴 자리와 같은 꼴: 대상이 있으면 전용 편집 화면, 없으면 목록.
      return sessionEditId ? <SessionEditorScreen nav={nav} sessionId={sessionEditId} /> : <SessionsScreen nav={nav} />;
    case 'present':
      return <PresentScreen />;
    case 'rules':
      return <RulesScreen topic={ruleTopic} nav={nav} />;
    case 'settings':
      return <SettingsScreen />;
  }
}

export function AppShell() {
  const nav = useAppHistory('board');
  const { toasts, dismiss } = useToast();
  const { drills, sessions } = useLibrary();
  const isFirstRender = useRef(true);
  const locale = useLocale();
  const t = useT();
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

  // C4 — 세 대상 전부 **URL 파생**이다(useState 아님). 리로드·뒤로가기 복원이 공짜고,
  // 화면 키와 대상이 같은 location 에서 나오므로 "판이 board→drill 로 한 프레임 깜빡" 하던
  // 이중 장부 문제가 원천적으로 없다.
  const stageTarget = useMemo(() => stageFromNav(nav.screen, nav.target), [nav.screen, nav.target]);
  const presentTarget = useMemo(() => presentFromNav(nav.screen, nav.target), [nav.screen, nav.target]);
  const sessionEditId = sessionEditFromNav(nav.screen, nav.target);
  const ruleTopic = ruleTopicFromNav(nav.screen, nav.target);
  // [새 드릴] 다이얼로그는 **화면이 아니라 앱 껍데기**가 세운다 — 진입점이 목록 화면의 빈 상태
  // CTA 와 헤더 주 액션 둘이라, 화면 안에 두면 헤더에서 누른 경우를 못 받는다.
  // URL 로 안 올리는 이유: 이 모달은 되돌아올 자리가 없다(취소하면 있던 화면 그대로, 만들면
  // 편집기로 간다). 히스토리에 한 칸을 만들면 편집기에서 뒤로가기가 빈 모달로 되돌아온다.
  const [newDrillOpen, setNewDrillOpen] = useState(false);
  const openNewDrill = useCallback(() => setNewDrillOpen(true), []);
  const homeNav = useHomeNavAdapter(nav, openNewDrill);

  // 레일·헤더 세그먼트의 활성 항목. **여기서 한 번만** 계산해 둘에 똑같이 내려보낸다
  // (`narrow` 가 간 길과 같다 — AppHeader.tsx 의 그 주석). 화면 키만으로는 드릴을 편집하는
  // 중에도 [보드]에 불이 들어온다: board 자리에 무엇이 떠 있는지를 화면 키는 말하지 않고,
  // 그것을 아는 값은 renderScreen 이 보는 stageTarget 하나다(2026-08-14 기현님 지시).
  const activeRail = railFor(nav.screen, stageTarget.kind, presentTarget?.kind ?? null);

  // ★ 자유 전술판은 **넓은 창에서 헤더를 안 세운다**(기현 지시 2026-08-14: *"상단 헤더 삭제.
  //   공간 확보"*). 헤더가 지고 있던 것이 전부 딴 데로 갔기 때문이다 — 코트 전환·되돌리기·
  //   [드릴로 저장]은 오른쪽 기능 바로, 제목과 부제는 삭제. 남은 것은 62px 빈 줄뿐이었다.
  //
  //   ⚠️ **좁은 창에서는 남긴다**(기현님 확인: *"좁은창 이동에서의 헤더는 유지"*). 좁으면 84px
  //   레일이 통째로 빠지고 그 자리를 헤더의 3칸 세그먼트가 대신한다 — 헤더까지 지우면 화면을
  //   옮길 방법이 아예 없어진다. 그때도 내용은 세그먼트뿐이다(EditorWorkspace 가 제목을 안 준다).
  //
  //   ⚠️ 2026-08-15 (드릴 편집 재설계 ②) — **드릴 편집도 같아졌다.** 옛 기록(지우지 않는다):
  //   *"드릴 편집(stageTarget.kind === 'drill')은 아직 옛 배치라 헤더가 필요하다 — 제목·[저장]·
  //   [시연]이 전부 거기 있다. 그래서 판정에 stageTarget 이 들어간다."* 그 셋 중 [저장]은 기능
  //   바로, [시연]은 하단 트랜스포트로 갔고 제목은 인스펙터가 갖는다. 그래서 이제 두 화면이
  //   같은 규칙을 쓴다 — `stageTarget` 이 판정에서 빠졌다.
  //
  //   ★ 이것은 미관이 아니라 **코트 크기**의 문제다(실측): 1024×600 에서 헤더 48px 이 남아
  //   있으면 오른쪽 기둥이 1열에 못 들어가(요구 599 > 가용 552) **2열로 흐르고**, 그 44px 가
  //   폭에서 또 빠진다. 헤더를 걷으면 599 ≤ 600 으로 1열이 되어 폭 크롬이 217 → 173,
  //   코트 축척이 0.8990 → 0.9905 로 **10% 커진다.**
  //   ⚠️ 여유가 **1px** 이다. 기둥에 칸이나 구분선을 하나만 더해도 도로 2열이 된다 —
  //      더할 때는 functionBarMetrics 의 요구 높이부터 계산할 것.
  //
  //   ⚠️ 2026-08-20 (기현님 지시) — **드릴 편집이 다시 헤더를 얻는다.** 되살리는 이유는 이번엔
  //   [저장]·[시연]이 아니라 *"드릴 편집 화면과 시연 화면은 비슷한 레이아웃이어야 ux가
  //   좋아진다"* — 두 화면이 같은 헤더(제목·ⓘ·상황별 전환 버튼)를 쓰게 맞춘다. 위 10% 이득은
  //   **다시 치른다**: 헤더 48(세로) + 하단 재생 묶음이 60px 재생 버튼을 실으며 +16(세로) +
  //   1024×600 에서 기능 바가 도로 2열로 흘러 폭 +44. 대가를 알고도 맞추는 쪽을 택했다 —
  //   실측 문턱이 바뀐 것은 아니라서, 작은 창(1024×600 급)에서 코트가 준 체감을 실기로 확인해야
  //   한다(계획서 "치러야 하는 대가" 참고). `stageTarget` 이 판정에 **돌아온다.**
  // 🔁 2026-09-03 기현 지시(*"보드에도 다른 화면들처럼 헤더 넣고 가운데 정렬로 제목 크게, 짧은 설명
  //   부제목으로. 맨 오른쪽에 [+ 드릴로 편집]"*)로 **자유 전술판도 헤더가 선다.** 2026-08-14 의
  //   "상단 헤더 삭제, 공간 확보" 는 헤더가 빈 줄뿐이었을 때의 결정이었고, 이제 헤더가 제목·부제·주
  //   액션을 진다(위 62px 이득은 다시 치른다). 옛 판정식은 이랬다:
  //   `narrow || nav.screen !== 'board' || stageTarget.kind === 'drill'`.
  const showHeader = true;
  const staticHeaderConfig = useStaticHeaderConfig(nav.screen, homeNav, ruleTopic);

  // §7.6: 화면 전환(go·back·popstate 전부) 시 <main id="main"> 에 포커스 + 라이브 리전 발표.
  // 최초 마운트(직접 진입)는 제외한다 — 브라우저가 이미 페이지 로드 시점의 포커스를 다뤘다.
  // main 은 화면마다 자기 것을 렌더하므로(위 주석) DOM 조회는 화면 전환 커밋 이후에 한다.
  //
  // 발표문은 화면 키가 아니라 announceFor 가 만든다 — 화면 키만 읽으면 자유판이든 드릴이든
  // 늘 "전술판 화면" 이라, 시각장애 코치는 방금 무엇이 열렸는지 알 수 없다(계획서 2.4).
  // 그래서 의존성에 대상 둘이 함께 들어간다: 같은 board 화면 안에서 대상만 바뀌는 전환
  // (드릴 열기·레일 [보드])도 발표 대상이다.
  // C4 — 전환 신호를 **값의 열쇠**로 접는다: 파생 객체는 location 이 바뀔 때마다 새 참조라
  // 객체를 deps 에 두면 같은 화면 재방문에도 발표가 반복된다. 열쇠 문자열이 그 함정을 막는다.
  const stageKey = stageTarget.kind === 'drill' ? `drill:${stageTarget.drillId}` : 'board';
  const presentKey = presentTarget ? `${presentTarget.kind}:${presentTarget.kind === 'drill' ? presentTarget.drillId : presentTarget.sessionId}` : '';
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    document.getElementById('main')?.focus({ preventScroll: true });
    liveRegion.say(announceFor(nav.screen, stageTarget, presentTarget, locale, { titleOf }));
    // titleOf 는 발표문의 재료일 뿐 전환 신호가 아니다 — 목록이 뒤늦게 읽혔다고 같은 화면을
    // 다시 발표하면 안 된다(포커스도 함께 튄다).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nav.screen, stageKey, presentKey]);

  return (
    <AppNavProvider value={nav}>
      <HeaderProvider>
        <StageTargetContext.Provider value={stageTarget}>
          <PresentTargetContext.Provider value={presentTarget}>
            {/* §0.5 Phase 5 — 레일 [도움말] 이 "지금 열려 있는 화면" 의 도움말을 열려면, 그
                화면(AppRail 의 형제, 아래 renderScreen)이 자기 HelpCenter 를 여는 함수를
                등록할 곳이 필요하다. AppNavProvider 안(레일·화면이 같은 트리)이라 등록·조회가
                항상 "지금 그려진 화면" 을 가리킨다 — HelpTriggerProvider.tsx 머리말 참고. */}
            <HelpTriggerProvider>
              <SkipLink label={t('a11y.skipToContent')} />
              <div style={{ height: '100%', display: 'flex', overflow: 'hidden', background: 'var(--bg)', color: 'var(--text)' }}>
                {!narrow && <AppRail active={activeRail} />}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  {showHeader && <AppHeader config={staticHeaderConfig} narrow={narrow} activeRail={activeRail} />}
                  {renderScreen(nav.screen, stageTarget, homeNav, sessionEditId, ruleTopic)}
                </div>
              </div>
              <NewDrillDialog
                open={newDrillOpen}
                onClose={() => setNewDrillOpen(false)}
                onCreated={(id) => {
                  setNewDrillOpen(false);
                  homeNav.openDrill(id);
                }}
              />
              <ToastHost toasts={toasts} onDismiss={dismiss} />
              <LiveRegion />
            </HelpTriggerProvider>
          </PresentTargetContext.Provider>
        </StageTargetContext.Provider>
      </HeaderProvider>
    </AppNavProvider>
  );
}
