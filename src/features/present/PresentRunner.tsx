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
import { useSettingsState } from '../../store/settings/SettingsProvider.tsx';
import { useToast } from '../../store/toast/ToastProvider.tsx';
import { PlaybackProvider, usePlaybackState, usePlaybackActions } from '../../store/playback/PlaybackProvider.tsx';
import { resolveDrillRepo } from '../../storage/drillRepo.ts';
import { getSession } from '../../storage/sessionRepo.ts';
import type { Drill, DrillStep } from '../../model/drill.ts';
import type { TrainingSession } from '../../model/session.ts';
import { effectiveStepMs } from '../../model/playback.ts';
import { PLAYBACK } from '../../core/constants.ts';
import { categoryColor } from '../../core/colors.ts';
import { clamp } from '../../core/geom.ts';
import { liveRegion } from '../../ui/LiveRegion.tsx';
import { isEditableTarget, isInteractiveTarget } from '../../ui/keyboard.ts';
import { Button } from '../../ui/Button.tsx';
import { IconChevronNext, IconChevronPrev, IconClose, IconPause, IconPlay } from '../../ui/icons.tsx';
import { IconFullscreenEnter, IconFullscreenExit, IconHelp, IconLoop } from './icons.tsx';
import { PresentStage } from './PresentStage.tsx';
import { HelpOverlay } from './HelpOverlay.tsx';
import { useFullscreen } from './useFullscreen.ts';
import { useWakeLock } from './useWakeLock.ts';
import { useSwipe } from './useSwipe.ts';

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
  | { status: 'ready'; kind: 'session'; session: TrainingSession; drills: Drill[] };

async function loadTarget(target: PresentTarget | null): Promise<PresentLoad> {
  if (!target) return { status: 'empty' };
  const { repo } = await resolveDrillRepo();
  if (target.kind === 'drill') {
    const res = await repo.loadDrill(target.drillId);
    if (res.status === 'ok') return { status: 'ready', kind: 'drill', drill: res.drill };
    if (res.status === 'missing') return { status: 'error', message: '드릴을 찾을 수 없습니다. 삭제되었을 수 있습니다.' };
    return { status: 'error', message: '드릴 파일을 읽을 수 없습니다.' };
  }
  const resolved = await getSession(target.sessionId);
  if (!resolved) return { status: 'error', message: '세션을 찾을 수 없습니다. 삭제되었을 수 있습니다.' };
  const nonMissingIds = resolved.items.filter((i) => !i.missing).map((i) => i.drillId);
  const drillMap = await repo.getDrills(nonMissingIds);
  const drills: Drill[] = [];
  for (const item of resolved.items) {
    if (item.missing) continue;
    const d = drillMap.get(item.drillId);
    if (d) drills.push(d);
  }
  if (drills.length === 0) return { status: 'error', message: '세션에 시연할 드릴이 없습니다.' };
  return { status: 'ready', kind: 'session', session: resolved.session, drills };
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

  const [load, setLoad] = useState<PresentLoad>({ status: 'loading' });
  useEffect(() => {
    let cancelled = false;
    setLoad({ status: 'loading' });
    void loadTarget(target).then((res) => {
      if (!cancelled) setLoad(res);
    });
    return () => {
      cancelled = true;
    };
  }, [target]);

  const backFallback: Screen = target?.kind === 'session' ? 'library' : 'editor';
  const exit = useCallback(() => nav.back(backFallback), [nav, backFallback]);

  const reduceMotion = effectiveReduceMotion(prefs.a11y.reduceMotion);

  const fullscreen = useFullscreen(rootRef);
  const wakeLock = useWakeLock(prefs.present.wakeLock);
  const wakeLockNoticeShown = useRef(false);
  useEffect(() => {
    if ((wakeLock === 'unsupported' || wakeLock === 'denied') && !wakeLockNoticeShown.current) {
      wakeLockNoticeShown.current = true;
      toast.show('화면 꺼짐 방지를 사용할 수 없습니다. 기기 설정에서 화면 자동 잠금을 늘려 주세요.', { durationMs: 6000 });
    }
  }, [wakeLock, toast]);

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

  const headerTitle = load.status === 'ready' ? (load.kind === 'drill' ? load.drill.title : load.session.title) : '시연 모드';
  useAppHeader({
    title: headerTitle,
    subtitle: '팀 앞에서 드릴을 단계별로 보여주세요',
    primary: { label: backFallback === 'library' ? '목록으로' : '편집으로', onAction: exit },
  });

  if (load.status === 'loading') {
    return (
      <main id="main" tabIndex={-1} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', outline: 'none' }}>
        <p style={{ color: 'var(--faint-text)', fontSize: '0.875rem' }}>불러오는 중…</p>
      </main>
    );
  }

  if (load.status === 'empty') {
    return (
      <main id="main" tabIndex={-1} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, outline: 'none' }}>
        <p style={{ color: 'var(--faint-text)', fontSize: '0.875rem' }}>시연할 드릴을 목록에서 선택하세요.</p>
        <Button variant="primary" onClick={() => nav.back('library')}>
          목록으로
        </Button>
      </main>
    );
  }

  if (load.status === 'error') {
    return (
      <main id="main" tabIndex={-1} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, outline: 'none' }}>
        <p style={{ color: 'var(--faint-text)', fontSize: '0.875rem' }}>{load.message}</p>
        <Button variant="primary" onClick={() => nav.back('library')}>
          목록으로
        </Button>
      </main>
    );
  }

  return (
    <PlaybackProvider initialSpeed={prefs.playbackSpeed}>
      <PresentBody
        rootRef={rootRef}
        load={load}
        reduceMotion={!!reduceMotion}
        showRuleZones={prefs.showRuleZones}
        fullscreen={fullscreen}
        wakeLock={wakeLock}
        helpOpen={helpOpen}
        setHelpOpen={setHelpOpen}
        blackout={blackout}
        setBlackout={setBlackout}
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
  fullscreen: ReturnType<typeof useFullscreen>;
  wakeLock: ReturnType<typeof useWakeLock>;
  helpOpen: boolean;
  setHelpOpen(v: boolean): void;
  blackout: boolean;
  setBlackout(v: boolean): void;
  exit(): void;
}

/** PlaybackProvider 안에서만 쓸 수 있는 부분(재생 상태 구독) — 그래서 부모와 분리했다. */
function PresentBody({ rootRef, load, reduceMotion, showRuleZones, fullscreen, wakeLock, helpOpen, setHelpOpen, blackout, setBlackout, exit }: PresentBodyProps) {
  const playback = usePlaybackState();
  const playbackActions = usePlaybackActions();

  const drills = load.kind === 'session' ? load.drills : [load.drill];
  const [drillIndex, setDrillIndex] = useState(0);
  const [interstitial, setInterstitial] = useState<Drill | null>(null);
  const drill = drills[Math.min(drillIndex, drills.length - 1)]!;

  const [stepIndex, setStepIndex] = useState(0);
  const [seekToken, setSeekToken] = useState(0);
  const currentStep = drill.steps[stepIndex];

  const baseMs = PLAYBACK.stepIntervalMs[playback.speed];
  const starts = useMemo(() => stepStartsMs(drill.steps, baseMs), [drill, baseMs]);

  const onStepChange = useCallback((idx: number, step: DrillStep) => {
    setStepIndex(idx);
    liveRegion.say(`스텝 ${idx + 1} · ${step.name || '이름 없음'}`);
  }, []);

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

      setInterstitial(target);
      liveRegion.say(`다음 드릴: ${target.title}`);
      // 빠르게 연속 전환하면 이전 타이머가 남아 새 오버레이를 조기에 지운다 — 매번 갈아끼운다.
      if (interstitialTimer.current !== null) window.clearTimeout(interstitialTimer.current);
      interstitialTimer.current = window.setTimeout(() => {
        interstitialTimer.current = null;
        setInterstitial(null);
      }, 2000);
    },
    [drills, drillIndex, playbackActions],
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
      if (e.key === 'Escape') {
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
      if ((e.key === ' ' || e.key === 'Spacebar') && isInteractiveTarget(e.target)) return; // 네이티브 위임 우선(§7.5f)

      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
        case 'PageDown':
        case ' ':
        case 'Spacebar':
          e.preventDefault();
          if (e.shiftKey) goDrill(1);
          else nextStep();
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
        case 'PageUp':
          e.preventDefault();
          if (e.shiftKey) goDrill(-1);
          else prevStep();
          break;
        case 'Home':
          e.preventDefault();
          seekToStep(0);
          break;
        case 'End':
          e.preventDefault();
          seekToStep(drill.steps.length - 1);
          break;
        case 'n':
        case 'N':
          e.preventDefault();
          goDrill(1);
          break;
        case 'p':
        case 'P':
          e.preventDefault();
          playbackActions.toggle();
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          if (fullscreen.state === 'off') void fullscreen.enter({ userGesture: true });
          else void fullscreen.exit();
          break;
        case '.':
          e.preventDefault();
          setBlackout(true);
          break;
        case 'l':
        case 'L':
          e.preventDefault();
          playbackActions.setLoop(!playback.loop);
          liveRegion.say(playback.loop ? '반복 껐습니다' : '반복 켰습니다');
          break;
        case '?':
          if (e.shiftKey) {
            e.preventDefault();
            setHelpOpen(true);
          }
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [blackout, helpOpen, fullscreen, exit, nextStep, prevStep, seekToStep, goDrill, drill, playbackActions, playback.loop, setBlackout, setHelpOpen]);

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
      {/* 전체화면(특히 네이티브)에서는 앱 헤더가 화면 밖이 되므로 나갈 UI 가 여기 항상 있어야
          한다(§6.9) — 44×44, 우상단, 항상 표시. */}
      <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 10, display: 'flex', gap: 8 }}>
        <button type="button" aria-label="도움말" onClick={() => setHelpOpen(true)} style={iconBtnStyle}>
          <IconHelp size={18} />
        </button>
        <button
          type="button"
          aria-label={fullscreen.state === 'off' ? '전체화면' : '전체화면 종료'}
          onClick={() => (fullscreen.state === 'off' ? fullscreen.enter({ userGesture: true }) : fullscreen.exit())}
          style={iconBtnStyle}
        >
          {fullscreen.state === 'off' ? <IconFullscreenEnter size={18} /> : <IconFullscreenExit size={18} />}
        </button>
        <button type="button" aria-label="시연 종료" onClick={exit} style={iconBtnStyle}>
          <IconClose size={18} />
        </button>
      </div>

      {load.kind === 'session' && (
        <div style={{ flex: 'none', padding: '14px 30px 0', display: 'flex', gap: 6 }} aria-label={`세션 진행 ${drillIndex + 1}/${drills.length}`}>
          {drills.map((d, i) => (
            <button
              key={d.id}
              type="button"
              aria-label={`${i + 1}번째 드릴: ${d.title}`}
              aria-current={i === drillIndex ? 'step' : undefined}
              onClick={() => {
                if (i === drillIndex) return;
                goDrill(i - drillIndex);
              }}
              style={{
                flex: 1,
                height: 4,
                borderRadius: 2,
                background: i === drillIndex ? 'var(--accent)' : i < drillIndex ? 'var(--muted)' : 'var(--border)',
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
            reduceMotion={reduceMotion}
            seekToken={seekToken}
            onStepChange={onStepChange}
            onEnded={() => playbackActions.pause()}
          />
        </div>
      </div>

      <div style={{ flex: 'none', padding: '6px 30px 22px' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 22 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 5 }}>
              <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 12, fontWeight: 700, color: 'var(--accent-text)', letterSpacing: 1 }}>
                STEP {stepIndex + 1}/{drill.steps.length}
              </span>
              <span style={{ fontSize: 19, fontWeight: 750, letterSpacing: -0.4 }}>{currentStep?.name || '이름 없음'}</span>
              <span aria-hidden style={{ width: 7, height: 7, borderRadius: '50%', background: categoryColor(drill.category), flex: 'none' }} />
            </div>
            {currentStep?.note && <p style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.55, maxWidth: 760 }}>{currentStep.note}</p>}
          </div>
          <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              aria-label={playback.loop ? '반복 끄기' : '반복 켜기'}
              aria-pressed={playback.loop}
              onClick={() => playbackActions.setLoop(!playback.loop)}
              style={{ ...iconBtnStyle, position: 'static', color: playback.loop ? 'var(--accent)' : 'var(--muted)' }}
            >
              <IconLoop size={17} />
            </button>
            <button type="button" aria-label="이전 스텝" onClick={prevStep} style={transportSmallStyle}>
              <IconChevronPrev size={17} />
            </button>
            <button
              type="button"
              aria-label={playback.playing ? '일시정지' : '재생'}
              onClick={() => playbackActions.toggle()}
              className="on-accent"
              style={{
                width: 60,
                height: 60,
                borderRadius: 16,
                background: 'var(--accent)',
                color: 'var(--accent-ink-strong)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {playback.playing ? <IconPause size={21} /> : <IconPlay size={21} />}
            </button>
            <button type="button" aria-label="다음 스텝" onClick={nextStep} style={transportSmallStyle}>
              <IconChevronNext size={17} />
            </button>
          </div>
        </div>
        {/* 막대는 시각적으로 6px 이지만 버튼 자체는 44px 여야 한다 — §7.3 이 정한 절대 하한은
            24px(WCAG 2.5.8)이고 6px 막대를 그대로 버튼으로 두면 손가락으로 못 짚는다.
            편집기 TransportBar 와 같은 방식(투명 히트 래퍼 + 안쪽 span 막대). */}
        <div style={{ maxWidth: 1080, margin: '10px auto 0', display: 'flex', gap: 9 }}>
          {drill.steps.map((s, i) => (
            <button
              key={s.id}
              type="button"
              aria-label={`${i + 1}번 스텝으로 이동`}
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
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, color: 'var(--accent-text)' }}>다음 드릴</span>
          <span style={{ fontSize: 24, fontWeight: 750 }}>{interstitial.title}</span>
        </div>
      )}

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
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);
  return (
    <div
      ref={ref}
      role="button"
      tabIndex={0}
      aria-label="블랙아웃 해제"
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
  return <span className="sr-only">화면 꺼짐 방지를 사용할 수 없습니다. 기기 설정에서 화면 자동 잠금을 늘려 주세요.</span>;
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

const transportSmallStyle: CSSProperties = {
  width: 46,
  height: 46,
  borderRadius: 12,
  border: '1px solid var(--border)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'var(--muted)',
};

export type { PresentLoad };
export { stepStartsMs };
