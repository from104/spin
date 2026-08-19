// §6.9 시연 모드 — 실제 로직. `PresentScreen.tsx`(app-shell 이 마운트하는 얇은 래퍼)에서
// 분리했다: `target`/`nav` 를 평범한 prop 으로 받아야 app-shell 없이(HeaderProvider 만 감싸고)
// 테스트할 수 있고, 여기서 `../../app/AppShell.tsx` 를 값(런타임) 으로 import 하지 않아야
// Vite 가 그 파일의 import 그래프(EditorScreen·SettingsScreen 등 Wave 4 형제 모듈)를 통째로
// 해석하려 들지 않는다 — `PresentTarget` 은 타입만 가져온다(`import type`, verbatimModuleSyntax
// 로 완전히 소거되어 그 파일을 실제로 resolve 하지 않는다).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, RefObject } from 'react';
import { useAppHeader } from '../../app/AppHeader.tsx';
import type { PresentTarget } from '../../app/AppShell.tsx';
import type { Screen } from '../../app/screens.ts';
import type { NavTarget } from '../../app/useAppHistory.ts';
import { useSettingsState } from '../../store/settings/SettingsProvider.tsx';
import { useToast } from '../../store/toast/ToastProvider.tsx';
import { PlaybackProvider, usePlaybackState, usePlaybackActions } from '../../store/playback/PlaybackProvider.tsx';
import { resolveDrillRepo } from '../../storage/drillRepo.ts';
import { getSession } from '../../storage/sessionRepo.ts';
import { phaseLabel } from '../../model/session.ts';
import type { Drill, DrillStep } from '../../model/drill.ts';
import type { TrainingSession } from '../../model/session.ts';
import { effectiveStepMs } from '../../model/playback.ts';
import { hasChairName, numberedName } from '../../model/chairLabel.ts';
import { PLAYBACK } from '../../core/constants.ts';
import { drillTypeColor } from '../../core/colors.ts';
import { clamp } from '../../core/geom.ts';
import { eventCode, lookupKey } from '../../core/keymap.ts';
import { liveRegion } from '../../ui/LiveRegion.tsx';
import { isEditableTarget, isInteractiveTarget } from '../../ui/keyboard.ts';
import { Button } from '../../ui/Button.tsx';
import { PlaybackControls } from '../../ui/PlaybackControls.tsx';
import { IconFullscreenEnter, IconFullscreenExit, IconHelp } from './icons.tsx';
import { PresentStage } from './PresentStage.tsx';
import { progressCellState } from './progressCells.ts';
import { DrillInfoModal } from './DrillInfoModal.tsx';
import { HelpOverlay } from './HelpOverlay.tsx';
import { useFullscreen } from './useFullscreen.ts';
import { useWakeLock } from './useWakeLock.ts';
import { useSwipe } from './useSwipe.ts';
import { useT, translate } from '../../i18n/useT.ts';
import { useLocale } from '../../i18n/useLocale.ts';
import type { Locale } from '../../i18n/locale.ts';
import { SCREEN_TITLES } from '../../app/screens.ts';

/** store/editor/EditorProvider.tsx 의 동명 함수와 같은 판정(§7.8) — 그 파일은 store 소유라
 *  가져다 쓸 수 없어(§8) 이 작은 순수 함수만 그대로 복제한다. */
function effectiveReduceMotion(setting: 'system' | 'always'): boolean {
  if (setting === 'always') return true;
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// ── 로딩 상태 ────────────────────────────────────────────────────────────────────────────────
type PresentLoad =
  | { status: 'loading' }
  | { status: 'empty' }
  | { status: 'error'; message: string }
  | { status: 'ready'; kind: 'drill'; drill: Drill }
  | {
      status: 'ready';
      kind: 'session';
      session: TrainingSession;
      drills: Drill[];
      /** C9 — 구획 인지. drills[i] 가 속한 구획 첨자(of)와 구획 라벨. 구획이 0~1개면 null —
       *  구획 UI(라벨·쉼 화면·구분 틈)를 세울 이유가 없다. */
      phases: { of: number[]; labels: string[] } | null;
    };

async function loadTarget(target: PresentTarget | null, locale: Locale): Promise<PresentLoad> {
  if (!target) return { status: 'empty' };
  const { repo } = await resolveDrillRepo();
  if (target.kind === 'drill') {
    const res = await repo.loadDrill(target.drillId);
    if (res.status === 'ok') return { status: 'ready', kind: 'drill', drill: res.drill };
    if (res.status === 'missing') return { status: 'error', message: translate(locale, 'present.drillNotFound') };
    return { status: 'error', message: translate(locale, 'present.drillUnreadable') };
  }
  const resolved = await getSession(target.sessionId);
  if (!resolved) return { status: 'error', message: translate(locale, 'present.sessionNotFound') };
  const nonMissingIds = resolved.items.filter((i) => !i.missing).map((i) => i.drillId);
  const drillMap = await repo.getDrills(nonMissingIds);
  // C9 — 구획 순회로 drills 와 phaseOf 를 **같은 루프에서** 만든다. flatten(resolved.items)을
  // 따로 돌면 두 배열의 첨자가 어긋날 길이 생긴다(순서의 단일 출처는 resolved.phases 다).
  const drills: Drill[] = [];
  const phaseOf: number[] = [];
  resolved.phases.forEach((rp, pi) => {
    for (const item of rp.items) {
      if (item.missing) continue;
      const d = drillMap.get(item.drillId);
      if (d) {
        drills.push(d);
        phaseOf.push(pi);
      }
    }
  });
  if (drills.length === 0) return { status: 'error', message: translate(locale, 'present.sessionEmpty') };
  const labels = resolved.phases.map((rp) => phaseLabel(rp.phase, locale));
  const phases = resolved.phases.length > 1 ? { of: phaseOf, labels } : null;
  return { status: 'ready', kind: 'session', session: resolved.session, drills, phases };
}

/** sampleDrill 과 같은 식(§3.6 타임라인)으로 스텝 시작 시각을 구한다 — 스텝 진행바 클릭·N/Home/End
 *  키가 이 값으로 seekMs 한다. */
function stepStartsMs(steps: readonly DrillStep[], baseMs: number): number[] {
  const starts: number[] = [];
  let acc = 0;
  for (const s of steps) {
    starts.push(acc);
    acc += effectiveStepMs(s, baseMs);
  }
  return starts;
}

export interface PresentNav {
  back(fallback: Screen): void;
  /** C12(2026-08-19 기현님) — 헤더 [편집으로]/[세션으로]의 **명시 이동**. back(이력 뒤로)은
   *  목록에서 들어왔으면 목록으로 돌아가 버려, 버튼 라벨이 약속한 목적지와 어긋났다.
   *  AppHistoryApi 가 구조적으로 만족한다(PresentScreen 은 useAppNav() 를 그대로 넘긴다). */
  go(next: Screen, target?: NavTarget): void;
}

export interface PresentRunnerProps {
  target: PresentTarget | null;
  nav: PresentNav;
}

/** 시연 화면의 실제 로직. `target`/`nav` 를 평범한 prop 으로 받아 app-shell 없이도 테스트할 수
 *  있다(파일 헤더 주석 참고). */
export function PresentRunner({ target, nav }: PresentRunnerProps) {
  const { prefs } = useSettingsState();
  const toast = useToast();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const t = useT();
  const locale = useLocale();

  const [load, setLoad] = useState<PresentLoad>({ status: 'loading' });
  useEffect(() => {
    let cancelled = false;
    setLoad({ status: 'loading' });
    void loadTarget(target, locale).then((res) => {
      if (!cancelled) setLoad(res);
    });
    return () => {
      cancelled = true;
    };
  }, [target, locale]);

  const backFallback: Screen = target?.kind === 'session' ? 'sessions' : 'board';
  // Esc·[시연 종료]는 **뒤로**다(들어온 자리로) — 이력이 없으면 fallback.
  const exit = useCallback(() => nav.back(backFallback), [nav, backFallback]);
  // C12 — 헤더 주 버튼은 라벨이 약속한 곳으로 **명시 이동**한다: 드릴 시연 → 그 드릴의
  // 편집 화면, 세션 시연 → 그 세션의 편집 화면. back 으로 하면 목록에서 들어온 경우
  // "[편집으로]를 눌렀는데 목록이 뜨는" 어긋남이 된다(기현님 실기 지적).
  const goOrigin = useCallback(() => {
    if (target?.kind === 'drill') nav.go('board', { kind: 'drill', id: target.drillId });
    else if (target?.kind === 'session') nav.go('sessions', { kind: 'session', id: target.sessionId });
    else nav.back(backFallback);
  }, [nav, target, backFallback]);

  const reduceMotion = effectiveReduceMotion(prefs.a11y.reduceMotion);

  const fullscreen = useFullscreen(rootRef);
  const wakeLock = useWakeLock(prefs.present.wakeLock);
  const wakeLockNoticeShown = useRef(false);
  useEffect(() => {
    if ((wakeLock === 'unsupported' || wakeLock === 'denied') && !wakeLockNoticeShown.current) {
      wakeLockNoticeShown.current = true;
      toast.show(t('present.wakeLockUnavailable'), { durationMs: 6000 });
    }
  }, [wakeLock, toast, t]);

  // §6.8 "autoFullscreen 기본 ON 이면 제스처 없는 requestFullscreen 이 거부돼 pseudo 로 떨어진다"
  // — 실패해도 useFullscreen.enter() 자체가 pseudo 로 폴백하므로 안전하다.
  const autoFullscreenTried = useRef(false);
  useEffect(() => {
    if (load.status !== 'ready' || autoFullscreenTried.current || !prefs.present.autoFullscreen) return;
    autoFullscreenTried.current = true;
    void fullscreen.enter({ userGesture: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load.status, prefs.present.autoFullscreen]);

  useEffect(() => {
    return () => {
      if (fullscreen.state !== 'off') void fullscreen.exit();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [helpOpen, setHelpOpen] = useState(false);
  const [blackout, setBlackout] = useState(false);
  // C11 — 드릴 정보(읽기 전용) 모달의 열림 상태. `useAppHeader` 는 여기(PresentRunner)에서
  // 부르므로, 헤더의 ⓘ(2026-08-20 §B)가 이 state 를 쥐어야 한다 — `helpOpen`/`blackout` 이
  // 이미 간 길과 같다. 모달 자체(`DrillInfoModal`)는 `drill`(세션이면 현재 드릴)을 아는
  // `PresentBody` 에 그대로 두고, 이 state 만 prop 으로 내린다.
  const [infoOpen, setInfoOpen] = useState(false);

  const headerTitle = load.status === 'ready' ? (load.kind === 'drill' ? load.drill.title : load.session.title) : SCREEN_TITLES[locale].present;
  useAppHeader({
    title: headerTitle,
    compact: true,
    infoButton: { onAction: () => setInfoOpen(true), label: t('present.infoAriaLabel') },
    primary: { label: target?.kind === 'session' ? t('present.primaryToSession') : t('present.primaryToEdit'), onAction: goOrigin },
  });

  if (load.status === 'loading') {
    return (
      <main id="main" tabIndex={-1} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', outline: 'none' }}>
        <p style={{ color: 'var(--faint-text)', fontSize: '0.875rem' }}>{t('common.loading')}</p>
      </main>
    );
  }

  if (load.status === 'empty') {
    return (
      <main id="main" tabIndex={-1} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, outline: 'none' }}>
        <p style={{ color: 'var(--faint-text)', fontSize: '0.875rem' }}>{t('present.emptyText')}</p>
        <Button variant="primary" onClick={() => nav.back('drills')}>
          {t('present.backToList')}
        </Button>
      </main>
    );
  }

  if (load.status === 'error') {
    return (
      <main id="main" tabIndex={-1} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, outline: 'none' }}>
        <p style={{ color: 'var(--faint-text)', fontSize: '0.875rem' }}>{load.message}</p>
        <Button variant="primary" onClick={() => nav.back('drills')}>
          {t('present.backToList')}
        </Button>
      </main>
    );
  }

  return (
    <PlaybackProvider initialSpeed={prefs.playbackSpeed} initialLoop={prefs.loop}>
      <PresentBody
        rootRef={rootRef}
        load={load}
        reduceMotion={!!reduceMotion}
        showRuleZones={prefs.showRuleZones}
        showGrid={prefs.showGrid}
        showGridLabels={prefs.showGridLabels}
        fullscreen={fullscreen}
        wakeLock={wakeLock}
        helpOpen={helpOpen}
        setHelpOpen={setHelpOpen}
        blackout={blackout}
        setBlackout={setBlackout}
        infoOpen={infoOpen}
        setInfoOpen={setInfoOpen}
        exit={exit}
      />
    </PlaybackProvider>
  );
}

interface PresentBodyProps {
  rootRef: RefObject<HTMLDivElement | null>;
  load: Extract<PresentLoad, { status: 'ready' }>;
  reduceMotion: boolean;
  showRuleZones: boolean;
  /** C11 — 격자는 편집기와 같은 저장값(prefs.showGrid)을 따른다. */
  showGrid: boolean;
  showGridLabels: boolean;
  fullscreen: ReturnType<typeof useFullscreen>;
  wakeLock: ReturnType<typeof useWakeLock>;
  helpOpen: boolean;
  setHelpOpen(v: boolean): void;
  blackout: boolean;
  setBlackout(v: boolean): void;
  /** C11 — 드릴 정보 모달. 2026-08-20 부터 PresentRunner 소유(파일 상단 주석 참고). */
  infoOpen: boolean;
  setInfoOpen(v: boolean): void;
  exit(): void;
}

/** PlaybackProvider 안에서만 쓸 수 있는 부분(재생 상태 구독) — 그래서 부모와 분리했다. */
function PresentBody({
  rootRef,
  load,
  reduceMotion,
  showRuleZones,
  showGrid,
  showGridLabels,
  fullscreen,
  wakeLock,
  helpOpen,
  setHelpOpen,
  blackout,
  setBlackout,
  infoOpen,
  setInfoOpen,
  exit,
}: PresentBodyProps) {
  const playback = usePlaybackState();
  const playbackActions = usePlaybackActions();
  const t = useT();

  const drills = load.kind === 'session' ? load.drills : [load.drill];
  const phaseInfo = load.kind === 'session' ? load.phases : null;
  const [drillIndex, setDrillIndex] = useState(0);
  const [interstitial, setInterstitial] = useState<{ drill: Drill; phase: string | null } | null>(null);
  const drill = drills[Math.min(drillIndex, drills.length - 1)]!;
  const phaseIdx = phaseInfo ? (phaseInfo.of[Math.min(drillIndex, drills.length - 1)] ?? null) : null;

  const [stepIndex, setStepIndex] = useState(0);
  const [seekToken, setSeekToken] = useState(0);
  const currentStep = drill.steps[stepIndex];

  // §3.4 — 실명을 적어 둔 선수만, 드릴 단위로 한 번 만든다. 스텝마다 다시 만들면 60fps
  // 재생 중에 배열이 매 프레임 새로 생긴다(자막 아래 한 줄이 그럴 이유가 없다).
  const namedRoster = useMemo(
    () => drill.cast.chairs.filter(hasChairName).map((c) => numberedName(c.number, c.name)),
    [drill],
  );

  const baseMs = PLAYBACK.stepIntervalMs[playback.speed];
  const starts = useMemo(() => stepStartsMs(drill.steps, baseMs), [drill, baseMs]);

  // 과제⑦(기현님 확정 2026-08-17): 스텝 이름 필드는 UI 전역에서 폐기됐다 — 로드 시
  // 정화기가 note 로 이관하고 name 은 항상 ''다(validate.ts migrateStepName). 그래서
  // step.name 은 더 이상 읽을 값이 없다 — 번호만 안내한다(편집기 사이드바 카드가
  // "번호 + 썸네일만" 인 것과 같은 축소, §스텝 카드).
  const onStepChange = useCallback((idx: number, _step: DrillStep) => {
    setStepIndex(idx);
    liveRegion.say(t('present.stepAnnounce', { n: idx + 1 }));
  }, [t]);

  const seekToStep = useCallback(
    (idx: number) => {
      const clamped = clamp(idx, 0, drill.steps.length - 1);
      const start = starts[clamped] ?? 0;
      const dur = effectiveStepMs(drill.steps[clamped]!, baseMs);
      // 스텝 구간의 끝자락(정착된 자세)으로 착지한다 — 시작점(localT=0)은 "전환 시작" 프레임이라
      // 방금 이동한 스텝이 여전히 이전 스텝처럼 보인다.
      playbackActions.seekMs(start + Math.max(0, dur - 1));
      setSeekToken((v) => v + 1);
    },
    [drill, starts, baseMs, playbackActions],
  );

  const interstitialTimer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (interstitialTimer.current !== null) window.clearTimeout(interstitialTimer.current);
    },
    [],
  );

  const goDrill = useCallback(
    (delta: number) => {
      if (drills.length < 2) return;
      const next = clamp(drillIndex + delta, 0, drills.length - 1);
      if (next === drillIndex) return;
      const target = drills[next]!;

      // 코트를 **먼저** 새 드릴의 첫 스텝으로 바꾼다. 예전에는 이 네 줄이 아래 setTimeout 안에
      // 있어서, 오버레이가 "다음 드릴: B" 를 알리는 2초 동안 코트가 이전 드릴 위치에 그대로
      // 머물렀다 — 체육관에서 보면 전환이 실패한 것처럼 보인다. 이제 오버레이 뒤로 새 드릴의
      // 시작 배치가 비쳐서, 코치가 제목을 읽는 동안 팀이 대형을 미리 볼 수 있다.
      setDrillIndex(next);
      setStepIndex(0);
      playbackActions.resetMs();
      setSeekToken((v) => v + 1);

      // C9 — 구획 경계를 넘는 전환은 쉼 화면이 **구획 이름**까지 알린다(질문 ⑯).
      const fromPhase = phaseInfo?.of[drillIndex];
      const toPhase = phaseInfo?.of[next];
      const crossed = phaseInfo && toPhase !== undefined && toPhase !== fromPhase ? phaseInfo.labels[toPhase]! : null;
      setInterstitial({ drill: target, phase: crossed });
      liveRegion.say(crossed ? t('present.nextPhaseAnnounce', { phase: crossed, title: target.title }) : t('present.nextDrillAnnounce', { title: target.title }));
      // 빠르게 연속 전환하면 이전 타이머가 남아 새 오버레이를 조기에 지운다 — 매번 갈아끼운다.
      if (interstitialTimer.current !== null) window.clearTimeout(interstitialTimer.current);
      interstitialTimer.current = window.setTimeout(() => {
        interstitialTimer.current = null;
        setInterstitial(null);
      }, 2000);
    },
    [drills, drillIndex, playbackActions, phaseInfo, t],
  );

  const nextStep = useCallback(() => {
    if (stepIndex >= drill.steps.length - 1) {
      if (drills.length > 1) goDrill(1);
      return;
    }
    seekToStep(stepIndex + 1);
  }, [stepIndex, drill, drills.length, goDrill, seekToStep]);
  const prevStep = useCallback(() => {
    if (stepIndex <= 0) {
      if (drills.length > 1) goDrill(-1);
      return;
    }
    seekToStep(stepIndex - 1);
  }, [stepIndex, drills.length, goDrill, seekToStep]);

  // 끝 스텝에서 [재생] = 처음으로 되감고 재생(2026-08-20 기현님 지시, §F) — loop 설정과
  // **무관**하다. `seekToStep(0)` 을 안 쓰는 이유는 그 함수가 스텝 0 의 **끝자락**(정착된
  // 자세)으로 착지해서다(seekToStep 주석) — 되감기는 그 드릴의 진짜 처음이어야 한다.
  // `resetMs()` 로 경과를 0 으로 되돌리고 `seekToken` 을 올려 멈춘 상태에서도 첫 프레임을
  // 즉시 다시 그린다(PresentStage 의 useLayoutEffect 가 그 값을 본다) — 그러면
  // `PresentStage.endedRef` 도 함께 초기화되어(그 effect 의 `endedRef.current = false`)
  // `onEnded` 가 다음 재생 끝에서 다시 울린다. 세션 시연에서도 되감기는 **그 드릴의 처음**
  // 까지다 — 다음 드릴로 넘기지 않는다(goDrill 을 안 부른다).
  const togglePlay = useCallback(() => {
    if (!playback.playing && stepIndex >= drill.steps.length - 1) {
      playbackActions.resetMs();
      setSeekToken((v) => v + 1);
    }
    playbackActions.toggle();
  }, [playback.playing, stepIndex, drill.steps.length, playbackActions]);

  const swipeHandlers = useSwipe({ onPrev: prevStep, onNext: nextStep });

  // ── 키보드(§6.9) ────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (helpOpen) return; // 도움말 오버레이가 열려 있으면 Modal 이 자체적으로 Esc 를 처리한다
      if (blackout) {
        e.preventDefault();
        setBlackout(false);
        return;
      }
      // Esc 는 표(`present.exit`)에도 있지만 여기서 먼저 본다 — 전체화면 상태에 따라 "나가기"
      // 의 대상이 브라우저 전체화면인지 시연인지가 갈리고, 그 판단은 키맵이 알 바가 아니다.
      if (eventCode(e) === 'Escape') {
        if (fullscreen.state === 'native') return; // 브라우저가 가로챈다 — fullscreenchange 로 감지
        if (fullscreen.state === 'pseudo') {
          e.preventDefault();
          void fullscreen.exit();
          return;
        }
        exit();
        return;
      }
      if (isEditableTarget(e.target)) return;

      // 2026-08-16 — 시연도 편집기와 **같은 표**를 쓴다(`core/keymap.ts` 의 `scope: 'present'`).
      // 개편 전에는 여기서만 Space 가 '다음 스텝' 이고 재생이 `P` 였는데, 편집기에서 P 는 선수
      // 도구다. 같은 글자가 화면마다 다른 일을 하면 두 화면 사이에서 손이 뒤집힌다.
      const id = lookupKey('present', e);
      if (!id) return;

      // §7.5f Space 는 브라우저가 활성화 키로 쓴다 — 하단 컨트롤 버튼에 포커스한 채 누르면
      // 네이티브 클릭과 여기가 이중 발화해 스텝이 두 칸 건너뛴다.
      if (id === 'present.play' && isInteractiveTarget(e.target)) return;

      switch (id) {
        case 'present.next':
          e.preventDefault();
          nextStep();
          break;
        case 'present.prev':
          e.preventDefault();
          prevStep();
          break;
        case 'present.first':
          e.preventDefault();
          seekToStep(0);
          break;
        case 'present.last':
          e.preventDefault();
          seekToStep(drill.steps.length - 1);
          break;
        case 'present.nextDrill':
          e.preventDefault();
          goDrill(1);
          break;
        case 'present.prevDrill':
          e.preventDefault();
          goDrill(-1);
          break;
        case 'present.play':
          e.preventDefault();
          togglePlay();
          break;
        case 'present.fullscreen':
          e.preventDefault();
          if (fullscreen.state === 'off') void fullscreen.enter({ userGesture: true });
          else void fullscreen.exit();
          break;
        case 'present.blackout':
          e.preventDefault();
          setBlackout(true);
          break;
        case 'present.loop':
          e.preventDefault();
          playbackActions.setLoop(!playback.loop);
          liveRegion.say(playback.loop ? t('present.loopOffAnnounce') : t('present.loopOnAnnounce'));
          break;
        case 'help':
          e.preventDefault();
          setHelpOpen(true);
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [blackout, helpOpen, fullscreen, exit, nextStep, prevStep, seekToStep, goDrill, drill, playbackActions, playback.loop, togglePlay, setBlackout, setHelpOpen, t]);

  const pseudoStyle: CSSProperties =
    fullscreen.state === 'pseudo'
      ? {
          position: 'fixed',
          inset: 0,
          zIndex: 100,
          height: '100dvh',
          width: '100vw',
          padding: 'env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)',
        }
      : {};

  return (
    <main
      id="main"
      tabIndex={-1}
      ref={rootRef}
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        background: 'var(--panel-2)',
        outline: 'none',
        position: 'relative',
        ...pseudoStyle,
      }}
    >
      {/* 우상단 상시 버튼 — 44×44, 세로로 선다(§6.9/2026-08-20 §C).
          ⚠️ 2026-08-20 (기현님 지시, §B·C) — ⓘ가 헤더(제목 옆)로 옮겨 가면서 이 묶음은 셋
          (도움말·전체화면·나가기)만 남았었다.
          ⚠️ 2026-08-20 (후속, 기현님 지시 — "시연 모드에서 오른쪽 기능바에서 x버튼 지우기") —
          나가기(X) 버튼을 걷어낸다. Esc 로 나가는 길은 그대로 있다(전체화면 중이면 먼저
          전체화면만 빠져나오고, 한 번 더 누르면 시연을 나간다 — 키다운 핸들러의 Escape 분기).
          남는 것은 둘(도움말·전체화면)이다. */}
      <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button type="button" aria-label={t('present.helpAriaLabel')} onClick={() => setHelpOpen(true)} style={iconBtnStyle}>
          <IconHelp size={18} />
        </button>
        <button
          type="button"
          aria-label={fullscreen.state === 'off' ? t('present.fullscreenEnter') : t('present.fullscreenExit')}
          onClick={() => (fullscreen.state === 'off' ? fullscreen.enter({ userGesture: true }) : fullscreen.exit())}
          style={iconBtnStyle}
        >
          {fullscreen.state === 'off' ? <IconFullscreenEnter size={18} /> : <IconFullscreenExit size={18} />}
        </button>
      </div>

      {load.kind === 'session' && (
        <div style={{ flex: 'none', padding: '14px 30px 0', display: 'flex', gap: 6 }} aria-label={t('present.sessionProgressAriaLabel', { current: drillIndex + 1, total: drills.length })}>
          {drills.map((d, i) => (
            <button
              key={d.id}
              type="button"
              aria-label={t('present.drillProgressAriaLabel', { index: i + 1, title: d.title })}
              aria-current={i === drillIndex ? 'step' : undefined}
              // ★ 6.6 — 강제색(Windows 고대비)에서 지나간 칸(--muted)과 남은 칸(--border)은
              // **둘 다 Canvas** 가 되어 "어디까지 했는가" 가 통째로 사라진다(현재 칸만 Highlight
              // 로 남는다). 이 갈고리가 styles/contrast.css ④ 에서 시스템 색으로 되살아난다.
              // ⚠️ 갈고리는 **막대 그 자체인 요소**에 붙어야 한다 — 여기서는 버튼이 곧 4px 막대다.
              data-progress={progressCellState(i, drillIndex)}
              onClick={() => {
                if (i === drillIndex) return;
                goDrill(i - drillIndex);
              }}
              style={{
                flex: 1,
                height: 4,
                borderRadius: 2,
                background: i === drillIndex ? 'var(--accent)' : i < drillIndex ? 'var(--muted)' : 'var(--border)',
                // C9 — 구획 경계에 틈을 벌린다. 칸 문법(색·data-progress)은 그대로라
                // 고대비 갈고리(styles/contrast.css ④)와 충돌하지 않는다.
                marginLeft: phaseInfo && i > 0 && phaseInfo.of[i] !== phaseInfo.of[i - 1] ? 12 : undefined,
              }}
            />
          ))}
        </div>
      )}

      <div
        style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '22px 30px 8px', touchAction: 'pan-y' }}
        {...swipeHandlers}
      >
        <div
          key={drill.id}
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: interstitial ? 0.15 : 1,
            transition: reduceMotion ? undefined : 'opacity .2s ease',
          }}
        >
          <PresentStage
            drill={drill}
            showRuleZones={showRuleZones}
            showGrid={showGrid}
            showGridLabels={showGridLabels}
            reduceMotion={reduceMotion}
            seekToken={seekToken}
            onStepChange={onStepChange}
            onEnded={() => playbackActions.pause()}
          />
        </div>
      </div>

      <div style={{ flex: 'none', padding: '6px 30px 22px' }}>
        {/* 2026-08-20 (기현님 지시, §D·E) — 재생 묶음이 공용 PlaybackControls 로 바뀌며
            **최우측**으로(옛 `maxWidth:1080, margin:'0 auto'` 를 걷어내 전폭으로 편다), 노트
            열은 **고정 높이 전폭 띠**가 된다. `PRESENT_NOTE_BAND_PX` 는 STEP 줄 + 노트 2줄 +
            이름 줄의 대략치다 — min=max 로 걸어 스텝을 넘길 때(노트 있음↔없음) 이 줄의 키가
            안 바뀌게 한다(선택모드 출렁임을 고친 것과 같은 원리: 조건부 마운트가 아니라
            높이를 먼저 고정하고 내용만 교체한다). 긴 노트는 `overflowY:'auto'` 로 안쪽에서만
            스크롤되어 띠를 밀지 않는다. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
          <div style={{ flex: 1, minWidth: 0, minHeight: PRESENT_NOTE_BAND_PX, maxHeight: PRESENT_NOTE_BAND_PX, overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 5 }}>
              <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 12, fontWeight: 700, color: 'var(--accent-text)', letterSpacing: 1 }}>
                STEP {stepIndex + 1}/{drill.steps.length}
              </span>
              {/* C9 — 지금 어느 구획인가. 세션에 구획이 둘 이상일 때만 선다(라벨 소음 방지). */}
              {phaseInfo && phaseIdx !== null && (
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>
                  {phaseInfo.labels[phaseIdx]} {phaseIdx + 1}/{phaseInfo.labels.length}
                </span>
              )}
              {/* 스텝 이름 헤드라인은 과제⑦(2026-08-17)로 폐기됐다 — name 은 로드 시 note 로
                  이관돼 항상 ''다(§스텝 카드, "번호 + 썸네일만"과 같은 축소). 스텝 텍스트는
                  아래 note 문단 하나로만 보여준다. */}
              <span aria-hidden style={{ width: 7, height: 7, borderRadius: '50%', background: drillTypeColor(drill.drillType), flex: 'none' }} />
            </div>
            {currentStep?.note && <p style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.55, maxWidth: 760 }}>{currentStep.note}</p>}
            {/* §7 3.4 선수 실명 — **번호 ↔ 사람을 잇는 범례**다. 코트의 칩은 등번호만 찍고
                (2026-08-11 등번호 2/3 크기 결정) 접근성 트리에서는 통째로 aria-hidden 이라
                (PresentStage) 이름을 적어 둔 코치에게 그 이름이 시연에서 한 번도 안 나왔다.
                이름을 **적은 선수만** 싣는다: 안 적었으면 이 줄 자체가 없고, 절반만 적었으면
                적은 절반만 나온다 — 번호뿐인 항목을 나열하면 코트에 이미 있는 정보를 옮겨
                적는 것이라 자막이 길어지기만 한다. */}
            {namedRoster.length > 0 && (
              <p aria-label={t('present.rosterAriaLabel')} style={{ fontSize: 12.5, color: 'var(--faint-text)', lineHeight: 1.5, marginTop: 5, maxWidth: 760 }}>
                {namedRoster.join(' · ')}
              </p>
            )}
          </div>
          <PlaybackControls
            playing={playback.playing}
            canPlay
            onTogglePlay={togglePlay}
            loop={playback.loop}
            onToggleLoop={() => playbackActions.setLoop(!playback.loop)}
            onPrev={prevStep}
            onNext={nextStep}
            speed={playback.speed}
            onCycleSpeed={() => playbackActions.setSpeed(playback.speed === 0.5 ? 1 : playback.speed === 1 ? 2 : 0.5)}
          />
        </div>
        {/* 막대는 시각적으로 6px 이지만 버튼 자체는 44px 여야 한다 — §7.3 이 정한 절대 하한은
            24px(WCAG 2.5.8)이고 6px 막대를 그대로 버튼으로 두면 손가락으로 못 짚는다.
            편집기 TransportBar 와 같은 방식(투명 히트 래퍼 + 안쪽 span 막대). */}
        <div style={{ marginTop: 10, display: 'flex', gap: 9 }}>
          {drill.steps.map((s, i) => (
            <button
              key={s.id}
              type="button"
              aria-label={t('present.stepJumpAriaLabel', { n: i + 1 })}
              aria-current={i === stepIndex ? 'step' : undefined}
              onClick={() => seekToStep(i)}
              style={{
                flex: 1,
                height: 44,
                minHeight: 44,
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                background: 'none',
                border: 'none',
              }}
            >
              <span
                aria-hidden="true"
                // ★ 6.6 — 위 세션 줄과 **같은 갈고리**. 다만 여기서 막대는 버튼이 아니라 이
                // 안쪽 span 이다(버튼은 §7.3 하한을 채우는 44px 투명 히트 래퍼다). 갈고리를
                // 버튼에 붙이면 강제색에서 44px 짜리 덩어리가 통째로 칠해진다.
                data-progress={progressCellState(i, stepIndex)}
                style={{
                  display: 'block',
                  width: '100%',
                  height: 6,
                  borderRadius: 3,
                  background: i === stepIndex ? 'var(--accent)' : i < stepIndex ? 'var(--muted)' : 'var(--border)',
                  transition: 'background .2s ease',
                }}
              />
            </button>
          ))}
        </div>
      </div>

      {interstitial && (
        <div
          role="status"
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 20,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            background: 'var(--panel-2)',
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, color: 'var(--accent-text)' }}>
            {interstitial.phase ? t('present.interstitialNextPhase', { phase: interstitial.phase }) : t('present.interstitialNextDrill')}
          </span>
          <span style={{ fontSize: 24, fontWeight: 750 }}>{interstitial.drill.title}</span>
        </div>
      )}

      <DrillInfoModal drill={drill} open={infoOpen} onClose={() => setInfoOpen(false)} />

      {blackout && <BlackoutOverlay onDismiss={() => setBlackout(false)} />}

      {(wakeLock === 'unsupported' || wakeLock === 'denied') && <VisuallyHiddenNotice />}

      <HelpOverlay open={helpOpen} onClose={() => setHelpOpen(false)} />
    </main>
  );
}

/** §6.9 블랙아웃 — `onPointerDown` + `role="button" tabIndex={0}` (키보드로만 해제 가능하면
 *  태블릿에서 검은 화면에 갇힌다). 마운트 시 1회만 포커스한다(ref 콜백에 직접 `.focus()` 를
 *  두면 부모가 리렌더될 때마다 다시 포커스를 뺏는다). */
function BlackoutOverlay({ onDismiss }: { onDismiss(): void }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const t = useT();
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);
  return (
    <div
      ref={ref}
      role="button"
      tabIndex={0}
      aria-label={t('present.blackoutDismissAriaLabel')}
      onPointerDown={onDismiss}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onDismiss();
      }}
      style={{ position: 'absolute', inset: 0, zIndex: 30, background: '#000' }}
    />
  );
}

/** 화면 꺼짐 방지 폴백 문구 — 토스트로 이미 1회 안내했으므로(위 useEffect) 여기는 스크린리더
 *  전용 상시 안내만 둔다(문구 자체는 §6.9 그대로). */
function VisuallyHiddenNotice() {
  const t = useT();
  return <span className="sr-only">{t('present.wakeLockUnavailable')}</span>;
}

const iconBtnStyle: CSSProperties = {
  position: 'static',
  width: 44,
  height: 44,
  borderRadius: 10,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'var(--text)',
  background: 'color-mix(in srgb, var(--panel) 70%, transparent)',
  border: '1px solid var(--border)',
};

/** 코트 아래 노트 띠의 고정 높이(2026-08-20 §E) — STEP 줄(≈17) + 노트 최대 2줄(14px·lh 1.55
 *  ≈ 43) + 이름 줄(≈24, marginTop 포함)의 대략치다. min=max 로 걸어 노트 유무와 무관하게
 *  이 띠의 키를 고정한다 — 스텝을 넘길 때 코트가 위아래로 안 밀리는 것이 이 상수의 전부다. */
const PRESENT_NOTE_BAND_PX = 86;

export type { PresentLoad };
export { stepStartsMs };
