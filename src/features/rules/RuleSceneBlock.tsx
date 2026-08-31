// 주제별 재설계(2026-08-22)의 인라인 장면 블록 — docs/PLAN-RULES-REDESIGN.md §3.
//
// 포스터(비활성)와 재생(활성) 두 상태를 **한 마운트 안에서** 오간다. `PresentStage` 는
// `usePlaybackState`/`usePlaybackActions` 를 무조건 호출해 Provider 없이 못 서므로(검증
// 완료, PresentStage.tsx), 포스터도 Provider+PresentStage 를 그대로 세우고 `active` prop 으로
// 컨트롤 노출 여부만 가른다 — "포스터"는 별도 정지 이미지가 아니라 이 판의 일시정지 상태다.
//
// ⚠️ **Provider 마운트는 이 파일이 유일하다.** 재개 비교표 아래 플레이어도 이 컴포넌트를 그대로
// 재사용한다(RestartTableBlock.tsx) — 새 Provider 를 또 세우면 `playbackLoopPref.test.tsx` 의
// MOUNTS 전수 열거가 실패한다. `initialLoop={prefs.loop}` 는 반드시 리터럴로 쓴다(그 테스트가
// 소스 문자열을 검사한다).
//
// 단일 활성 규율(계획 §3 "포스터+단일 활성")의 실제 주체는 호출부(RuleTopicDoc)다 — 이 컴포넌트는
// `active`/`onActivate` 두 prop 으로만 참여한다. 활성이 꺼지는 순간(다른 블록이 활성화됨)만
// 일시정지 + 스텝0 로 되돌린다 — 최초 마운트는 별도 처리가 필요 없다(`elapsed=0` 이 이미 스텝0
// 상태다, `seekToStep` 은 Prev/Next 와 똑같이 "정착 프레임" 규칙을 이미 지킨다).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { IconPlay } from '../../ui/icons.tsx';
import { useT } from '../../i18n/useT.ts';
import { useLocale } from '../../i18n/useLocale.ts';

/** 코트 아래 노트 띠의 고정 높이 — `PresentRunner.tsx` 의 `PRESENT_NOTE_BAND_PX`(86)와 같은
 *  이유(min=max 로 스텝을 넘길 때 코트가 위아래로 안 밀리게 한다). */
const NOTE_BAND_PX = 64;

/** 이 장면이 노트 띠에 **글이 들어가는** 장면인가 — 고정 높이를 걸지 말지를 가른다.
 *
 *  ⚠️ 판단 단위는 **스텝이 아니라 장면**이다. 스텝마다 재면 노트가 있는 스텝과 없는 스텝을
 *  오갈 때 띠가 생겼다 사라졌다 하며 재생 중에 판이 위아래로 뛴다 — `NOTE_BAND_PX` 고정이
 *  애초에 막으려던 바로 그 현상이다. 장면 전체에 노트가 하나라도 있으면 그 장면은
 *  처음부터 끝까지 고정 높이를 쓴다(= 지금까지의 동작 그대로).
 *
 *  반대로 한 스텝도 노트가 없는 장면은 띠에 `STEP n/m` 한 줄만 남거나(다스텝) 아무것도
 *  안 남는다(1스텝). 그 높이는 스텝이 바뀌어도 변하지 않으므로 고정할 이유가 없고,
 *  고정하면 빈 64px 이 그대로 자리를 먹는다. 편집기로 만든 장면들(scenes/*.scene.ts)은
 *  설명을 스텝 노트가 아니라 코트 위 라벨(`step.notes[]`)로 적어서 전부 여기에 해당한다. */
function sceneHasNote(steps: readonly DrillStep[]): boolean {
  return steps.some((s) => (s.note ?? '').trim() !== '');
}

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

function RuleSceneInner({
  drill,
  reduceMotion,
  active,
  onActivate,
}: {
  drill: Drill;
  reduceMotion: boolean;
  active: boolean;
  onActivate: () => void;
}) {
  const t = useT();
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
      // 스텝 구간의 끝자락(정착된 자세)으로 착지한다 — 시작점(localT=0)은 "전환 시작" 프레임이라
      // 방금 이동한 스텝이 이전 스텝처럼 보인다(PresentRunner.seekToStep 과 같은 이유).
      playbackActions.seekMs(start + Math.max(0, dur - 1));
      setSeekToken((v) => v + 1);
    },
    [drill, starts, baseMs, playbackActions],
  );

  // 다른 블록이 활성화되면(이 블록: 활성→비활성) 일시정지하고 스텝0(포스터 자세)으로 되돌린다.
  const wasActiveRef = useRef(active);
  useEffect(() => {
    if (wasActiveRef.current && !active) {
      playbackActions.pause();
      seekToStep(0);
    }
    wasActiveRef.current = active;
  }, [active, playbackActions, seekToStep]);

  const togglePlay = useCallback(() => {
    // 끝 스텝에서 [재생] = 처음으로 되감고 재생 — PresentRunner.togglePlay 와 같은 규칙.
    if (!playback.playing && stepIdx >= drill.steps.length - 1) {
      playbackActions.resetMs();
      setSeekToken((v) => v + 1);
    }
    playbackActions.toggle();
  }, [playback.playing, stepIdx, drill.steps.length, playbackActions]);

  // 포스터 클릭 = 활성화 + 즉시 재생. 두 상태 갱신이 같은 이벤트 핸들러 안이라 한 번에 배치된다.
  const handlePosterPlay = useCallback(() => {
    onActivate();
    togglePlay();
  }, [onActivate, togglePlay]);

  const onStepChange = useCallback((idx: number) => setStepIdx(idx), []);

  const def = courtDefFor(drill.courtMode, drill.courtSize);
  const step = drill.steps[stepIdx];
  const multiStep = drill.steps.length > 1;
  const hasNote = useMemo(() => sceneHasNote(drill.steps), [drill]);
  const showPoster = multiStep && !active;
  // 컷 스텝(보간 없이 즉시 전환)에 진입했다는 신호 — `key={stepIdx}` 로 스텝을 넘길 때마다
  // 이 오버레이를 다시 마운트시켜 펄스 keyframe 을 매번 재생시킨다(§4 "cut 스텝 진입" 연출).
  const isCutStep = step?.cut === true;

  return (
    <div style={{ marginTop: 20 }}>
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 560,
          aspectRatio: `${def.vbW} / ${def.vbH}`,
          borderRadius: 16,
          overflow: 'hidden',
        }}
      >
        <PresentStage drill={drill} showRuleZones reduceMotion={reduceMotion} seekToken={seekToken} onStepChange={onStepChange} />
        {isCutStep && (
          <div
            key={stepIdx}
            className="rules-cut-pulse"
            aria-hidden
            style={{ position: 'absolute', inset: 0, borderRadius: 16, boxShadow: 'inset 0 0 0 3px var(--accent)', pointerEvents: 'none' }}
          />
        )}
        {/* 조건부 렌더가 아니라 상시 마운트 + opacity/pointer-events 전환이다 — 그래야 사라질 때도
            (다른 장면 재생 시 포스터로 복귀할 때는 반대로) 즉시 뚝 끊기지 않고 페이드된다. */}
        {multiStep && (
          <button
            type="button"
            onClick={handlePosterPlay}
            aria-label={t('rules.playScene')}
            aria-hidden={!showPoster}
            tabIndex={showPoster ? 0 : -1}
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'color-mix(in srgb, var(--panel) 35%, transparent)',
              opacity: showPoster ? 1 : 0,
              pointerEvents: showPoster ? 'auto' : 'none',
              transition: 'opacity 200ms cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          >
            <span
              className="on-accent"
              style={{
                width: 60,
                height: 60,
                borderRadius: 16,
                background: 'var(--accent)',
                color: 'var(--accent-ink-strong)',
                display: 'flex',
                alignItems: 'center',
                // 재생 삼각형은 시각 무게중심이 왼쪽으로 쏠려 보인다 — 기하 중심이 아니라
                // 광학 중심으로 1px 밀어 준다(PlaybackControls 의 같은 아이콘과 동일 처리 없음:
                // 여기서는 원이 훨씬 커서 어긋남이 눈에 띄므로 이 블록만 보정).
                justifyContent: 'center',
                paddingLeft: 3,
              }}
            >
              <IconPlay size={24} />
            </span>
          </button>
        )}
      </div>
      {/* 노트도 없고 STEP 줄도 없으면(노트 없는 1스텝 장면) 띠를 아예 렌더하지 않는다 —
          빈 div 만 남겨도 marginTop 10 이 그대로 자리를 먹는다. */}
      {(hasNote || multiStep) && (
        <div
          style={
            hasNote
              ? { minHeight: NOTE_BAND_PX, maxHeight: NOTE_BAND_PX, overflow: 'hidden', marginTop: 10 }
              : { marginTop: 10 }
          }
        >
          {multiStep && (
            <div
              style={{
                fontSize: '0.6875rem',
                fontWeight: 700,
                letterSpacing: '0.04em',
                color: 'var(--faint-text)',
                marginBottom: 2,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              STEP {stepIdx + 1}/{drill.steps.length}
            </div>
          )}
          {step?.note && <p style={{ fontSize: '0.875rem', lineHeight: 1.5, color: 'var(--text)' }}>{step.note}</p>}
        </div>
      )}
      {multiStep && active && (
        <div className="rules-controls-in" style={{ marginTop: 10 }}>
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

export interface RuleSceneBlockProps {
  sceneId: RuleSceneId;
  /** 이 블록이 "지금 재생 중인 하나"인가 — 단일 활성 규율의 상태는 호출부가 쥔다. */
  active: boolean;
  onActivate: () => void;
}

/** 장면 하나의 마운트 전체. 호출부가 `key={sceneId}` 를 줘야 조항·주제를 바꿀 때 다시 마운트된다
 *  (재생 위치가 이전 장면 것을 들고 오지 않도록). */
export function RuleSceneBlock({ sceneId, active, onActivate }: RuleSceneBlockProps) {
  const { prefs } = useSettingsState();
  const locale = useLocale();
  const drill = useMemo(() => buildRuleScene(sceneId, locale), [sceneId, locale]);
  const reduceMotion = effectiveReduceMotion(prefs.a11y.reduceMotion);
  return (
    <PlaybackProvider initialSpeed={1} initialLoop={prefs.loop}>
      <RuleSceneInner drill={drill} reduceMotion={reduceMotion} active={active} onActivate={onActivate} />
    </PlaybackProvider>
  );
}
