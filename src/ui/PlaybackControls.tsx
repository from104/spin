// 편집·시연 공용 재생 묶음(2026-08-20, 기현님 지시 — "재생관련 버튼은 두 화면 동일한 모양
// (시연쪽 것) 모두 최우·최하단으로 위치"). 순수 표시 컴포넌트다 — playing/loop/speed 는
// PlaybackProvider(store/playback)가 쥐고, 이 컴포넌트는 값과 콜백만 받는다.
//
// 모양은 시연 쪽 것을 그대로 가져왔다: 반복 44 · 이전/다음 46 · 재생 60×60(accent) · 배속 알약.
// `ui/` 층에 있으므로 `features/` 방향 import 를 만들지 않는다 — IconLoop 을
// features/present/icons.tsx 에서 여기(ui/icons.tsx)로 옮긴 이유가 그것이다.
import type { CSSProperties } from 'react';
import type { PlaybackSpeed } from '../store/playback/PlaybackProvider.tsx';
import { IconChevronNext, IconChevronPrev, IconLoop, IconPause, IconPlay } from './icons.tsx';
import { useT } from '../i18n/useT.ts';

export interface PlaybackControlsProps {
  playing: boolean;
  /** "눌렀는데 아무 일도 안 난다"를 막는 순전한 UX 잠금(옛 StepSidebar.playback.canPlay 계약
   *  그대로) — 안전 자체는 재생 루프(useStepPlayback/PresentStage)가 스텝 부족이면 스스로
   *  멈춰 이미 보장된다. 시연은 항상 true 를 넘긴다(옛 시연 재생 버튼에는 이 잠금이 없었다). */
  canPlay: boolean;
  onTogglePlay(): void;
  loop: boolean;
  onToggleLoop(): void;
  onPrev(): void;
  onNext(): void;
  speed: PlaybackSpeed;
  onCycleSpeed(): void;
}

/** 속도 순환의 다음 값 — 편집·시연 둘 다 0.5→1→2→0.5 순환(옛 StepSidebar/PresentRunner 각자의
 *  NEXT_SPEED 를 여기 하나로 합친다). */
const NEXT_SPEED: Record<PlaybackSpeed, PlaybackSpeed> = { 0.5: 1, 1: 2, 2: 0.5 };

const transportSmallStyle: CSSProperties = {
  flex: 'none',
  width: 46,
  height: 46,
  borderRadius: 12,
  border: '1px solid var(--border)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'var(--muted)',
};

export function PlaybackControls({
  playing,
  canPlay,
  onTogglePlay,
  loop,
  onToggleLoop,
  onPrev,
  onNext,
  speed,
  onCycleSpeed,
}: PlaybackControlsProps) {
  const t = useT();
  return (
    <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
      <button
        type="button"
        aria-label={loop ? t('playback.loopOff') : t('playback.loopOn')}
        aria-pressed={loop}
        onClick={onToggleLoop}
        style={{
          flex: 'none',
          width: 44,
          height: 44,
          borderRadius: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: loop ? 'var(--accent)' : 'var(--muted)',
          background: 'color-mix(in srgb, var(--panel) 70%, transparent)',
          border: '1px solid var(--border)',
        }}
      >
        <IconLoop size={17} />
      </button>
      <button type="button" aria-label={t('playback.prev')} onClick={onPrev} style={transportSmallStyle}>
        <IconChevronPrev size={17} />
      </button>
      <button
        type="button"
        aria-label={playing ? t('playback.pause') : t('playback.play')}
        disabled={!canPlay}
        onClick={onTogglePlay}
        className="on-accent"
        style={{
          flex: 'none',
          width: 60,
          height: 60,
          borderRadius: 16,
          background: 'var(--accent)',
          color: 'var(--accent-ink-strong)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: canPlay ? 1 : 0.5,
        }}
      >
        {playing ? <IconPause size={21} /> : <IconPlay size={21} />}
      </button>
      <button type="button" aria-label={t('playback.next')} onClick={onNext} style={transportSmallStyle}>
        <IconChevronNext size={17} />
      </button>
      <button
        type="button"
        onClick={onCycleSpeed}
        aria-label={t('playback.speedAriaLabel', { speed, next: NEXT_SPEED[speed] })}
        style={{
          flex: 'none',
          minWidth: 44,
          minHeight: 44,
          padding: '0 10px',
          fontSize: '0.75rem',
          color: 'var(--muted)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          fontWeight: 600,
          fontFamily: "'Space Grotesk', sans-serif",
        }}
      >
        {speed}×
      </button>
    </div>
  );
}
