// §6.10/프로토타입 329–356행 — 편집기 재생 트랜스포트. 실제 물리 기반 시연 재생(sampleDrill)은
// screen-present 소관이다(§6.9) — 편집기의 "재생"은 EditorProvider 가 이미 갖고 있는 스텝 전환
// 트윈(§6.7 poseFrame/startTween, stepId 변경마다 자동 발동)을 일정 간격으로 다음 스텝으로
// 넘기는 것뿐이다(useStepPlayback.ts) — 화살표·메모는 EditorProvider 트윈 범위 밖이라 스텝
// 경계에서 그대로 전환된다(§6.7 poseFrame 참고, deviations 기록).
import { useLayoutEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { DrillStep } from '../../model/drill.ts';
import type { StepId } from '../../core/ids.ts';
import type { PlaybackSpeed } from '../../store/playback/PlaybackProvider.tsx';
import { IconChevronPrev, IconChevronNext, IconPlay, IconPause } from '../../ui/icons.tsx';
import { SpeedLimitSwitch } from './SpeedLimitSwitch.tsx';

export interface TransportBarProps {
  steps: readonly DrillStep[];
  stepId: StepId;
  onSelectStep(id: StepId): void;
  playing: boolean;
  onTogglePlay(): void;
  speed: PlaybackSpeed;
  onCycleSpeed(): void;
}

const NEXT_SPEED: Record<PlaybackSpeed, PlaybackSpeed> = { 0.5: 1, 1: 2, 2: 0.5 };

// §7.3 터치 타깃 절대 하한(WCAG 2.5.8) — 이 밑으로는 노드 자체를 렌더하지 않는다.
const TIMELINE_MIN_HIT_PX = 24;
// §7.3 주 컨트롤 상한 — 스텝이 적어 여유가 있어도 히트 폭 "기준값"은 44 를 넘기지 않는다.
const TIMELINE_MAX_HIT_PX = 44;

/** §7.3 스텝 타임라인 히트 폭 클램프: min(44, track/(n−1)).
 *  트랙 430px 기준 n=18(=17 간격) → 25.29px(표시) / n=19(=18 간격) → 23.89px(중단) —
 *  DESIGN.md §7.3 "트랙 430 기준 n ≥ 19" 문구와 정확히 맞아떨어진다. */
export function clampTimelineHit(trackWidthPx: number, stepCount: number): number {
  if (stepCount <= 1) return TIMELINE_MAX_HIT_PX;
  return Math.min(TIMELINE_MAX_HIT_PX, trackWidthPx / (stepCount - 1));
}

/** 트랙 컨테이너의 실측 폭. ResizeObserver 가 없는 환경(jsdom)에선 최초 1회 측정 +
 *  window resize 로 대체한다 — §6.4 useStageMetrics 와 달리 이 컴포넌트는 스크롤에 반응할
 *  필요가 없다(레이아웃 폭만 바뀌면 된다). */
function useTrackWidth(): [RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setWidth(el.getBoundingClientRect().width);
    measure();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return [ref, width];
}

export function TransportBar({ steps, stepId, onSelectStep, playing, onTogglePlay, speed, onCycleSpeed }: TransportBarProps) {
  const idx = Math.max(
    0,
    steps.findIndex((s) => s.id === stepId),
  );
  const cur = steps[idx];
  const canPrev = idx > 0;
  const canNext = idx < steps.length - 1;

  const goPrev = () => canPrev && onSelectStep(steps[idx - 1]!.id);
  const goNext = () => canNext && onSelectStep(steps[idx + 1]!.id);

  const [trackRef, trackWidth] = useTrackWidth();
  // 스텝이 늘어나 히트 폭이 24px 밑으로 떨어지면 개별 노드 대신 진행 바만 남기고
  // 스텝 이동은 이전/다음 버튼과 인스펙터 스텝 목록에 위임한다(§7.3).
  const showTimelineNodes = steps.length <= 1 || clampTimelineHit(trackWidth, steps.length) >= TIMELINE_MIN_HIT_PX;

  return (
    <div style={{ flex: 'none', borderTop: '1px solid var(--border)', background: 'var(--panel)', padding: '12px 24px 15px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, maxWidth: 940, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            type="button"
            aria-label="이전 스텝"
            disabled={!canPrev}
            onClick={goPrev}
            style={{
              width: 44,
              height: 44,
              borderRadius: 9,
              border: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--muted)',
              opacity: canPrev ? 1 : 0.4,
            }}
          >
            <IconChevronPrev />
          </button>
          <button
            type="button"
            aria-label={playing ? '일시정지' : '재생'}
            disabled={steps.length < 2}
            onClick={onTogglePlay}
            style={{
              width: 48,
              height: 48,
              borderRadius: 11,
              background: 'var(--accent)',
              color: 'var(--accent-ink-strong)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: steps.length < 2 ? 0.5 : 1,
            }}
            className="on-accent"
          >
            {playing ? <IconPause /> : <IconPlay />}
          </button>
          <button
            type="button"
            aria-label="다음 스텝"
            disabled={!canNext}
            onClick={goNext}
            style={{
              width: 44,
              height: 44,
              borderRadius: 9,
              border: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--muted)',
              opacity: canNext ? 1 : 0.4,
            }}
          >
            <IconChevronNext />
          </button>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
            <span style={{ fontSize: '0.78125rem', fontWeight: 700 }}>
              스텝 {idx + 1} · {cur?.name ?? ''}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.6875rem', color: 'var(--faint-text)' }}>
              {playing && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--accent-text)', fontWeight: 700 }}>
                  <span aria-hidden style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)' }} />
                  재생중
                </span>
              )}
              {idx + 1}/{steps.length}
            </span>
          </div>
          <div ref={trackRef} style={{ height: 44, display: 'flex', alignItems: 'center' }}>
            {showTimelineNodes ? (
              <div role="tablist" aria-label="스텝 진행" style={{ display: 'flex', gap: 3, width: '100%', height: '100%', alignItems: 'center' }}>
                {steps.map((s, i) => (
                  <button
                    key={s.id}
                    type="button"
                    role="tab"
                    aria-selected={s.id === stepId}
                    aria-label={`스텝 ${i + 1}${s.name ? `: ${s.name}` : ''}`}
                    onClick={() => onSelectStep(s.id)}
                    style={{
                      flex: 1,
                      height: 44,
                      minHeight: 44,
                      display: 'flex',
                      alignItems: 'center',
                      background: 'transparent',
                      border: 'none',
                      padding: 0,
                    }}
                  >
                    {/* 시각 6px 막대는 그대로 두고, 버튼 자체(투명 히트 래퍼)를 44px 로 키운다(§7.3) */}
                    <span
                      aria-hidden
                      style={{
                        display: 'block',
                        width: '100%',
                        height: 6,
                        minHeight: 6,
                        borderRadius: 3,
                        background: i <= idx ? 'var(--accent)' : 'var(--elev)',
                        border: '1px solid var(--border)',
                      }}
                    />
                  </button>
                ))}
              </div>
            ) : (
              <div
                role="progressbar"
                aria-label="스텝 진행"
                aria-valuenow={idx + 1}
                aria-valuemin={1}
                aria-valuemax={steps.length}
                aria-valuetext={`스텝 ${idx + 1}/${steps.length}`}
                style={{
                  position: 'relative',
                  width: '100%',
                  height: 6,
                  minHeight: 6,
                  borderRadius: 3,
                  background: 'var(--elev)',
                  border: '1px solid var(--border)',
                  overflow: 'hidden',
                }}
              >
                <div aria-hidden style={{ position: 'absolute', inset: 0, width: `${((idx + 1) / steps.length) * 100}%`, background: 'var(--accent)' }} />
              </div>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={onCycleSpeed}
          aria-label={`재생 속도 ${speed}배. 눌러서 ${NEXT_SPEED[speed]}배로 변경`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            minHeight: 44,
            fontSize: '0.71875rem',
            color: 'var(--muted)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '0 11px',
            fontWeight: 600,
            fontFamily: "'Space Grotesk', sans-serif",
          }}
        >
          {speed}×
        </button>

        <SpeedLimitSwitch />
      </div>
    </div>
  );
}
