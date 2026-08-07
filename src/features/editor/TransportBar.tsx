// §6.10/프로토타입 329–356행 — 편집기 재생 트랜스포트. 실제 물리 기반 시연 재생(sampleDrill)은
// screen-present 소관이다(§6.9) — 편집기의 "재생"은 EditorProvider 가 이미 갖고 있는 스텝 전환
// 트윈(§6.7 poseFrame/startTween, stepId 변경마다 자동 발동)을 일정 간격으로 다음 스텝으로
// 넘기는 것뿐이다(useStepPlayback.ts) — 화살표·메모는 EditorProvider 트윈 범위 밖이라 스텝
// 경계에서 그대로 전환된다(§6.7 poseFrame 참고, deviations 기록).
import type { DrillStep } from '../../model/drill.ts';
import type { StepId } from '../../core/ids.ts';
import type { PlaybackSpeed } from '../../store/playback/PlaybackProvider.tsx';
import { IconChevronPrev, IconChevronNext, IconPlay, IconPause } from '../../ui/icons.tsx';

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
          <div role="tablist" aria-label="스텝 진행" style={{ display: 'flex', gap: 3, height: 44, alignItems: 'center' }}>
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
                  height: 6,
                  minHeight: 6,
                  borderRadius: 3,
                  background: i <= idx ? 'var(--accent)' : 'var(--elev)',
                  border: '1px solid var(--border)',
                }}
              />
            ))}
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
      </div>
    </div>
  );
}
