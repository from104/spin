// 규칙 화면(2026-08-21 신설, docs/PLAN-RULES-SCREEN.md 정본) — §A/§B/§C 구현.
//
// settings 와 같은 "app-shell 미의존" 화면이다: 헤더는 AppShell.useStaticHeaderConfig 가
// 정적으로 채우고, 이 컴포넌트는 nav prop 없이 스스로 완결된 <main> 을 그린다.
//
// 보드 재생은 시연(present) 인프라를 그대로 재사용한다 — `PresentStage` 는 저장소 없이
// 인메모리 `Drill` 을 prop 으로 받아 애니메이션한다(`PresentStage.rules.test.tsx` 가 그 성립을
// 증명한다). `PresentRunner` 전체는 끌어오지 않는다 — 세션·전체화면·헤더 배선까지 딸려 오는
// 무거운 화면이고, 여기 필요한 것은 "스텝 사이를 seekMs 로 오가는 최소 뼈대"뿐이다. 그 로직
// (`stepStartsMs`/`seekToStep`/`togglePlay`)은 `PresentRunner.tsx` 의 로컬 함수와 같은
// 모양이지만, `features/present` → `features/rules` cross-feature import 를 만들지 않기 위해
// 이 파일 안에 다시 옮겨 적었다(각 화면이 app-shell 미의존으로 스스로 완결된다는 관례와 같은
// 이유 — AppShell.tsx 머리말 "화면 간 계약" 참고).
import { useCallback, useMemo, useState } from 'react';
import { RULE_GROUP_LABELS, RULE_GROUP_ORDER, ruleContentFor } from './ruleContent.ts';
import type { RuleLaw } from './ruleContent.ts';
import { RuleFigure } from './RuleFigure.tsx';
import { buildRuleScene } from './ruleScenes.ts';
import type { RuleSceneId } from './ruleScenes.ts';
import type { Drill, DrillStep } from '../../model/drill.ts';
import { effectiveStepMs } from '../../model/playback.ts';
import { courtDefFor } from '../../model/court.ts';
import { clamp } from '../../core/geom.ts';
import { PLAYBACK } from '../../core/constants.ts';
import { PlaybackProvider, usePlaybackActions, usePlaybackState } from '../../store/playback/PlaybackProvider.tsx';
import type { PlaybackSpeed } from '../../store/playback/PlaybackProvider.tsx';
import { effectiveReduceMotion } from '../../store/editor/tween.ts';
import { useSettingsState } from '../../store/settings/SettingsProvider.tsx';
import { PresentStage } from '../present/PresentStage.tsx';
import { PlaybackControls } from '../../ui/PlaybackControls.tsx';
import { useIsNarrow } from '../../ui/useIsNarrow.ts';
import { useLocale } from '../../i18n/useLocale.ts';
import { HelpCenter } from '../../ui/help/HelpCenter.tsx';
import { usePublishHelpShow } from '../../ui/help/HelpTriggerProvider.tsx';
import { useTutorial } from '../../ui/tutorial/useTutorial.ts';
import { TutorialOverlay } from '../../ui/tutorial/TutorialOverlay.tsx';
import { RULES_TUTORIAL_STEPS } from './tutorialSteps.ts';

const LIST_WIDTH_PX = 320;
/** 코트 아래 노트 띠의 고정 높이. `PresentRunner.tsx` 의 `PRESENT_NOTE_BAND_PX`(86)와 같은
 *  이유(min=max 로 걸어 스텝을 넘길 때 코트가 위아래로 안 밀리게 한다) — 이 화면은 스텝
 *  진행바·실명 로스터 줄이 없어 그만큼 더 낮다. */
const NOTE_BAND_PX = 64;

/** 편집·시연과 같은 순환(0.5→1→2→0.5) — `ui/PlaybackControls.tsx` 의 같은 이름 상수와 동일. */
const NEXT_SPEED: Record<PlaybackSpeed, PlaybackSpeed> = { 0.5: 1, 1: 2, 2: 0.5 };

/** `sampleDrill` 과 같은 식(§3.6 타임라인)으로 스텝 시작 시각을 구한다. */
function stepStartsMs(steps: readonly DrillStep[], baseMs: number): number[] {
  const starts: number[] = [];
  let acc = 0;
  for (const s of steps) {
    starts.push(acc);
    acc += effectiveStepMs(s, baseMs);
  }
  return starts;
}

/** 장면 하나의 보드+노트+재생 버튼. `PlaybackProvider` 안에서만 쓴다. */
function RuleScenePlayer({ drill, reduceMotion }: { drill: Drill; reduceMotion: boolean }) {
  const playback = usePlaybackState();
  const playbackActions = usePlaybackActions();
  const [stepIdx, setStepIdx] = useState(0);
  const [seekToken, setSeekToken] = useState(0);

  const baseMs = PLAYBACK.stepIntervalMs[playback.speed];
  const starts = useMemo(() => stepStartsMs(drill.steps, baseMs), [drill, baseMs]);

  const seekToStep = useCallback(
    (idx: number) => {
      const clamped = clamp(idx, 0, drill.steps.length - 1);
      const start = starts[clamped] ?? 0;
      const dur = effectiveStepMs(drill.steps[clamped]!, baseMs);
      // 스텝 구간의 끝자락(정착된 자세)으로 착지한다 — PresentRunner.seekToStep 과 같은 이유:
      // 시작점(localT=0)은 "전환 시작" 프레임이라 방금 이동한 스텝이 이전 스텝처럼 보인다.
      playbackActions.seekMs(start + Math.max(0, dur - 1));
      setSeekToken((v) => v + 1);
    },
    [drill, starts, baseMs, playbackActions],
  );

  const togglePlay = useCallback(() => {
    // 끝 스텝에서 [재생] = 처음으로 되감고 재생 — PresentRunner.togglePlay 와 같은 규칙.
    if (!playback.playing && stepIdx >= drill.steps.length - 1) {
      playbackActions.resetMs();
      setSeekToken((v) => v + 1);
    }
    playbackActions.toggle();
  }, [playback.playing, stepIdx, drill.steps.length, playbackActions]);

  const onStepChange = useCallback((idx: number) => setStepIdx(idx), []);

  const def = courtDefFor(drill.courtMode, drill.courtSize);
  const step = drill.steps[stepIdx];
  const multiStep = drill.steps.length > 1;

  return (
    <div style={{ marginTop: 20 }}>
      <div data-tut="rules-board" style={{ width: '100%', maxWidth: 560, aspectRatio: `${def.vbW} / ${def.vbH}`, borderRadius: 16, overflow: 'hidden' }}>
        <PresentStage drill={drill} showRuleZones reduceMotion={reduceMotion} seekToken={seekToken} onStepChange={onStepChange} />
      </div>
      <div data-tut="rules-note" style={{ minHeight: NOTE_BAND_PX, maxHeight: NOTE_BAND_PX, overflow: 'hidden', marginTop: 10 }}>
        {multiStep && (
          <div style={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.04em', color: 'var(--faint-text)', marginBottom: 2 }}>
            STEP {stepIdx + 1}/{drill.steps.length}
          </div>
        )}
        {step?.note && <p style={{ fontSize: '0.875rem', lineHeight: 1.5, color: 'var(--text)' }}>{step.note}</p>}
      </div>
      {multiStep && (
        <div style={{ marginTop: 10 }}>
          <PlaybackControls
            playing={playback.playing}
            canPlay
            onTogglePlay={togglePlay}
            loop={playback.loop}
            onToggleLoop={() => playbackActions.setLoop(!playback.loop)}
            onPrev={() => seekToStep(stepIdx - 1)}
            onNext={() => seekToStep(stepIdx + 1)}
            speed={playback.speed}
            onCycleSpeed={() => playbackActions.setSpeed(NEXT_SPEED[playback.speed])}
          />
        </div>
      )}
    </div>
  );
}

/** 장면 id → 드릴 빌드 + 재생 상태 provider. `key={sceneId}`(호출부)로 조항을 바꿀 때마다
 *  통째로 다시 마운트한다 — 재생 경과·스텝 위치가 이전 조항 것을 들고 오면 안 된다.
 *
 *  `initialLoop={prefs.loop}` — 전술판·드릴 편집기·시연과 같은 배선이다. `prefs.loop` 를
 *  세 화면이 이미 내리는데 이 화면만 하드코딩하면 설정 [반복 재생]이 여기서만 안 먹힌다
 *  (playbackLoopPref.test.tsx §④ 전수 열거가 이 자리를 붙잡는다). */
function RuleSceneStage({ sceneId }: { sceneId: RuleSceneId }) {
  const { prefs } = useSettingsState();
  const drill = useMemo(() => buildRuleScene(sceneId), [sceneId]);
  const reduceMotion = effectiveReduceMotion(prefs.a11y.reduceMotion);
  return (
    <PlaybackProvider initialSpeed={1} initialLoop={prefs.loop}>
      <RuleScenePlayer drill={drill} reduceMotion={reduceMotion} />
    </PlaybackProvider>
  );
}

function RuleListRow({ law, active, onSelect }: { law: RuleLaw; active: boolean; onSelect: () => void }) {
  return (
    <li>
      <button
        type="button"
        aria-current={active ? 'true' : undefined}
        onClick={onSelect}
        style={{
          width: '100%',
          textAlign: 'left',
          padding: '10px 14px',
          borderRadius: 10,
          border: active ? '1.5px solid var(--accent)' : '1.5px solid transparent',
          background: active ? 'color-mix(in srgb, var(--accent) 16%, transparent)' : 'transparent',
          color: active ? 'var(--text)' : 'var(--muted)',
          fontSize: '0.875rem',
          fontWeight: active ? 600 : 500,
        }}
      >
        {law.title}
      </button>
    </li>
  );
}

function RuleDetail({ law, onBack }: { law: RuleLaw; onBack?: () => void }) {
  return (
    <div style={{ maxWidth: 640 }}>
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          style={{ marginBottom: 16, color: 'var(--muted)', fontSize: '0.8125rem', fontWeight: 600 }}
        >
          ← 목록으로
        </button>
      )}
      <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 16 }}>{law.title}</h2>
      <ul style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingLeft: '1.1em', listStyle: 'disc' }}>
        {law.summary.map((line, i) => (
          <li key={i} style={{ fontSize: '0.9375rem', lineHeight: 1.6, color: 'var(--text)' }}>
            {line}
          </li>
        ))}
      </ul>
      {/* 순서: 요약 → 도해 → 장면. "읽고 나서 본다" 는 한 방향을 지킨다 — 도해를 제목
          바로 밑에 올리면 조문이 전부 접힌 아래로 밀린다. 도해와 장면은 배타가 아니라서
          둘 다 있는 조항은 정지 그림 다음에 움직이는 판이 온다. */}
      {law.figureId && <RuleFigure id={law.figureId} />}
      {law.sceneId && <RuleSceneStage key={law.sceneId} sceneId={law.sceneId} />}
    </div>
  );
}

export function RulesScreen() {
  const locale = useLocale();
  const narrow = useIsNarrow();
  const laws = ruleContentFor(locale);
  const [selectedLaw, setSelectedLaw] = useState(1);
  const [view, setView] = useState<'list' | 'detail'>('list');

  // §0.5 Phase 5 — 레일 [도움말] 이 "지금 열려 있는 화면" 을 열려면 이 화면이 자기 HelpCenter 를
  // 여는 함수를 등록해야 한다(SettingsScreen.tsx·PresentRunner.tsx 와 같은 배선).
  const [helpOpen, setHelpOpen] = useState(false);
  const showHelp = useCallback(() => setHelpOpen(true), []);
  usePublishHelpShow(showHelp);
  // 기본 선택(제1조 — 필드)이 목록·보드·노트 셋을 항상 함께 그리므로 첫 진입에서 3단계가
  // 전부 살아남는다(tutorialSteps.ts 머리말).
  const tutorial = useTutorial('rules', RULES_TUTORIAL_STEPS, true);

  const current = laws.find((l) => l.law === selectedLaw) ?? laws[0];

  const select = (law: number) => {
    setSelectedLaw(law);
    if (narrow) setView('detail');
  };

  const showList = !narrow || view === 'list';
  const showDetail = !narrow || view === 'detail';

  return (
    <main id="main" tabIndex={-1} style={{ flex: 1, display: 'flex', overflow: 'hidden', outline: 'none', background: 'var(--bg)' }}>
      {showList && (
        <nav
          aria-label="규칙 조항 목록"
          data-tut="rules-list"
          style={{
            flex: narrow ? 1 : `0 0 ${LIST_WIDTH_PX}px`,
            overflowY: 'auto',
            borderRight: narrow ? 'none' : '1px solid var(--border)',
            padding: '18px 12px',
          }}
        >
          {RULE_GROUP_ORDER.map((group) => (
            <div key={group} style={{ marginBottom: 18 }}>
              <div
                style={{
                  padding: '0 14px 6px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  letterSpacing: '0.02em',
                  color: 'var(--faint-text)',
                }}
              >
                {RULE_GROUP_LABELS[group]}
              </div>
              <ul style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {laws
                  .filter((l) => l.group === group)
                  .map((law) => (
                    <RuleListRow key={law.law} law={law} active={law.law === selectedLaw} onSelect={() => select(law.law)} />
                  ))}
              </ul>
            </div>
          ))}
        </nav>
      )}
      {showDetail && current && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '26px 30px 46px' }}>
          <RuleDetail law={current} onBack={narrow ? () => setView('list') : undefined} />
        </div>
      )}
      <HelpCenter open={helpOpen} onClose={() => setHelpOpen(false)} initialSection="rules" onRestartTutorial={() => tutorial.start()} />
      {tutorial.step && (
        <TutorialOverlay
          step={tutorial.step}
          stepIndex={tutorial.stepIndex}
          totalSteps={tutorial.totalSteps}
          onNext={tutorial.next}
          onPrev={tutorial.prev}
          onSkip={tutorial.skip}
        />
      )}
    </main>
  );
}
