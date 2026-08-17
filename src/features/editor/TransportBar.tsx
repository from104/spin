// §6.10/§4.4 P2-3 — 편집기 재생 트랜스포트.
//
// 실제 물리 기반 시연 재생(sampleDrill)은 screen-present 소관이다(§6.9) — 편집기의 "재생"은
// EditorProvider 가 이미 갖고 있는 스텝 전환 트윈(§6.7 poseFrame/startTween, stepId 변경마다
// 자동 발동)을 일정 간격으로 다음 스텝으로 넘기는 것뿐이다(useStepPlayback.ts).
//
// 2026-08-17 재편(PLAN-STEP-EDITING.md 구현 순서 ②, 기현님 확정) — **재생 전담으로 축소했다.**
// 스텝 목록·선택·순서 바꾸기·추가는 왼쪽 세로 사이드바(StepSidebar.tsx)로 전부 이사했다.
//   · 옛 2.10 재편(스텝 사진 뭉치 칩 줄)이 여기 있던 시절의 근거·감사 evidence 는
//     StepSidebar.tsx 머리말에 있다 — 칩이 카드로 형태만 바꿔 이사했지 없어진 게 아니다.
//   · 그래서 이 바에 남는 것은 **재생 토글·속도·viewControls** 뿐이다. `drill`·`stepId`·
//     `onSelectStep`·`onReorderStep`·`onAddStep` 프롭이 전부 빠졌다 — 스텝을 아예 모른다.
//   · 바 높이(64)의 유일한 출처는 여전히 재생 버튼(--hit + 4)이다 — 칩이 없어져도 안 변한다.
import type { ReactNode } from 'react';
import type { PlaybackSpeed } from '../../store/playback/PlaybackProvider.tsx';
import { IconPlay, IconPause } from '../../ui/icons.tsx';
import { SpeedLimitSwitch } from './SpeedLimitSwitch.tsx';
import { bottomBarPadCss } from './bottomBarMetrics.ts';

export interface TransportBarProps {
  playing: boolean;
  onTogglePlay(): void;
  /** 재생을 걸 스텝이 둘 미만이면 눌러도 `useStepPlayback` 이 다음 프레임에 스스로 멈춘다
   *  (자기 교정, 안전은 이미 보장된다) — 그래도 버튼을 미리 잠그는 것은 "눌렀는데 아무 일도
   *  안 난다" 는 헛손질을 막는 순전한 UX 다. 그래서 `Drill` 전체가 아니라 이 한 boolean 만
   *  받는다 — 스텝 개수 말고는 이 바가 스텝에 대해 알 것이 없어졌다. */
  canPlay: boolean;
  speed: PlaybackSpeed;
  onCycleSpeed(): void;
  /** 뷰 컨트롤 두 손잡이(`[보기▾]` · `[속성]`). 근거·규율은 BoardBar 의 같은 prop 주석에 있다 —
   *  두 바가 **같은 인스턴스**를 받고, 바 안에서는 **맨 끝**이라 앞선 표적이 안 밀린다. */
  viewControls?: ReactNode;
}

const NEXT_SPEED: Record<PlaybackSpeed, PlaybackSpeed> = { 0.5: 1, 1: 2, 2: 0.5 };

export function TransportBar({ playing, onTogglePlay, canPlay, speed, onCycleSpeed, viewControls }: TransportBarProps) {
  return (
    <div style={{ flex: 'none', borderTop: '1px solid var(--border)', background: 'var(--panel)', padding: bottomBarPadCss() }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          maxWidth: 940,
          margin: '0 auto',
          // 바 높이의 유일한 출처. 가장 큰 것이 재생 버튼이라 --hit + 4 다(bottomBarMetrics).
          height: 'calc(var(--hit) + 4px)',
        }}
      >
        <button
          type="button"
          aria-label={playing ? '일시정지' : '재생'}
          disabled={!canPlay}
          onClick={onTogglePlay}
          style={{
            // 이 바의 유일한 손잡이라 이전/다음보다 컸던 위계(+4px)를 그대로 지킨다.
            width: 'calc(var(--hit) + 4px)',
            height: 'calc(var(--hit) + 4px)',
            borderRadius: 11,
            background: 'var(--accent)',
            color: 'var(--accent-ink-strong)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 'none',
            opacity: canPlay ? 1 : 0.5,
          }}
          className="on-accent"
        >
          {playing ? <IconPause /> : <IconPlay />}
        </button>

        <div style={{ flex: 1 }} />

        <button
          type="button"
          onClick={onCycleSpeed}
          aria-label={`재생 속도 ${speed}배. 눌러서 ${NEXT_SPEED[speed]}배로 변경`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            flex: 'none',
            minHeight: 'var(--hit)',
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

        {viewControls}
      </div>
    </div>
  );
}
