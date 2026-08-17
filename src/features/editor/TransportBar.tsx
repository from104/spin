// §6.10/§4.4 P2-3 — 편집기 재생 트랜스포트 + **스텝 사진 뭉치**.
//
// 실제 물리 기반 시연 재생(sampleDrill)은 screen-present 소관이다(§6.9) — 편집기의 "재생"은
// EditorProvider 가 이미 갖고 있는 스텝 전환 트윈(§6.7 poseFrame/startTween, stepId 변경마다
// 자동 발동)을 일정 간격으로 다음 스텝으로 넘기는 것뿐이다(useStepPlayback.ts).
//
// 2026-08-12 재편(P2-3): 스크러버 **트랙 자체를 스텝 썸네일 칩 줄로** 바꿨다.
//   왜 — 스텝 조작(순서·추가)이 인스펙터의 26×22 / 22×22 버튼에만 있었는데 2.2 가 인스펙터를
//   기본 접힘 오버레이로 내리면서 그 조작이 화면에서 사라졌다. WCAG 24px 미달인 버튼을 시트
//   안으로 한 겹 더 밀어 넣는 대신, 판을 찍어 쌓은 사진 뭉치가 그 자리를 메운다.
//   · 칩 = 그 스텝의 판 사진(CourtThumbnail). 히트는 --hit 파생이라 기본 44, 큰 타깃 56 이다.
//   · 옛 `clampTimelineHit`(트랙을 n−1 로 나누고 24px 미만이면 노드를 접던 §7.3 규칙)은
//     **사라졌다.** 칩은 안 줄고 줄이 가로로 구르므로 스텝이 몇 장이든 44 를 지킨다 —
//     노드를 접고 진행 바만 남기던 대체 경로 자체가 필요 없어졌다(DESIGN.md §7.3 의 그 행은
//     시연 화면 스텝 바에만 남는다).
//   · 라벨줄("스텝 3 · 이름")을 칩 안으로 흡수해 바 높이를 94 → **64** 로 줄였다(§5.2 예산).
//
// 순서 바꾸기는 **끌기와 키보드 둘 다** 된다. 발 마우스·스위치 사용자에게 끌기는 가장 실패하기
// 쉬운 입력이라(§5.5) 키보드 경로가 장식이 아니라 주 경로다: Space 로 집고 ←/→ 로 옮기고
// Space/Enter 로 놓고 Esc 로 되돌린다. 수식키 조합을 쓰지 않는 것은 입에 문 젓가락으로 치는
// 사용자에게 동시 누르기가 곧 실패이기 때문이다.
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react';
import type { Drill } from '../../model/drill.ts';
import type { StepId } from '../../core/ids.ts';
import type { PlaybackSpeed } from '../../store/playback/PlaybackProvider.tsx';
import { IconChevronPrev, IconChevronNext, IconPlay, IconPause, IconPlus } from '../../ui/icons.tsx';
import { CHIP_GLYPH_SCALE, CourtThumbnail } from '../../render/CourtThumbnail.tsx';
import { buildStepThumb } from '../../model/thumb.ts';
import { LIMITS } from '../../model/validate.ts';
import { liveRegion } from '../../ui/LiveRegion.tsx';
import { SpeedLimitSwitch } from './SpeedLimitSwitch.tsx';
import { bottomBarPadCss, movedOrder, stepChipWidthCss } from './bottomBarMetrics.ts';
import { useStepReorderDrag } from './useStepReorderDrag.ts';

export interface TransportBarProps {
  /** 칩이 스텝마다 판을 그리므로 steps 만으로는 부족하다 — cast·팀 색·코트가 함께 필요하다. */
  drill: Drill;
  stepId: StepId;
  onSelectStep(id: StepId): void;
  /** 순서 변경. `toIndex` 는 옮긴 **뒤**의 자리(edits.ts moveStep 과 같은 규칙). */
  onReorderStep(id: StepId, toIndex: number): void;
  /** [한 장 더 찍기] — 지금 스텝을 복제해 바로 뒤에 넣는다(§3.5: 화살표·메모 id 보존). */
  onAddStep(): void;
  playing: boolean;
  onTogglePlay(): void;
  speed: PlaybackSpeed;
  onCycleSpeed(): void;
  /** 뷰 컨트롤 두 손잡이(`[보기▾]` · `[속성]`). 근거·규율은 BoardBar 의 같은 prop 주석에 있다 —
   *  두 바가 **같은 인스턴스**를 받고, 바 안에서는 **맨 끝**이라 앞선 표적이 안 밀린다. */
  viewControls?: ReactNode;
}

const NEXT_SPEED: Record<PlaybackSpeed, PlaybackSpeed> = { 0.5: 1, 1: 2, 2: 0.5 };

const ICON_BTN = {
  width: 'var(--hit)',
  height: 'var(--hit)',
  borderRadius: 9,
  border: '1px solid var(--border)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'var(--muted)',
  flex: 'none',
} as const;

export function TransportBar({ drill, stepId, onSelectStep, onReorderStep, onAddStep, playing, onTogglePlay, speed, onCycleSpeed, viewControls }: TransportBarProps) {
  const steps = drill.steps;
  const idx = Math.max(
    0,
    steps.findIndex((s) => s.id === stepId),
  );
  const canPrev = idx > 0;
  const canNext = idx < steps.length - 1;

  const goPrev = () => canPrev && onSelectStep(steps[idx - 1]!.id);
  const goNext = () => canNext && onSelectStep(steps[idx + 1]!.id);

  // 칩 사진. 드릴이 바뀔 때만 다시 만든다 — 스텝 60장이라도 기하 요약이라 가볍지만, 매
  // 리렌더마다 60개를 새로 만들면 CourtThumbnail 이 전부 새 props 를 받아 다시 그린다.
  const thumbs = useMemo(() => new Map(drill.steps.map((s, i) => [s.id, buildStepThumb(drill, i)])), [drill]);
  const teamColors = useMemo(
    () => ({
      home: drill.teams.home.color,
      away: drill.teams.away.color,
      homeGk: drill.teams.home.gkColor,
      awayGk: drill.teams.away.gkColor,
    }),
    [drill.teams],
  );

  const chipRefs = useRef(new Map<StepId, HTMLButtonElement>());
  const measureCenters = useCallback(
    () =>
      // 지금 **화면 순서**로 재야 한다. steps 순서로 재면 미리보기로 자리를 바꾼 뒤 판정이
      // 어긋난다 — DOM 을 직접 훑는 이유다.
      [...chipRefs.current.values()]
        .filter((el) => el.isConnected)
        .sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left)
        .map((el) => {
          const r = el.getBoundingClientRect();
          return r.left + r.width / 2;
        }),
    [],
  );
  const drag = useStepReorderDrag({
    measureCenters,
    onCommit: (id, to) => {
      onReorderStep(id, to);
      liveRegion.say(`${to + 1}번째로 옮겼습니다.`);
    },
  });

  // 키보드 순서 바꾸기의 '집은' 상태. 집힌 칩은 ←/→ 를 전역 스텝 이동(useEditorKeyboard)에
  // 넘기지 않고 자기가 먹는다.
  const [held, setHeld] = useState<{ id: StepId; origin: number } | null>(null);
  const hintId = useId();

  // 끌기 중에는 미리보기 순서로 그린다. 커밋은 손을 뗄 때 한 번이다.
  const order = drag.state ? movedOrder(steps, drag.state.from, drag.state.to) : steps;

  // 스텝이 바뀌면 그 사진이 보이도록 줄을 굴린다. 안 하면 12장째 스텝에서 ←/→ 를 눌렀을 때
  // 화면 밖에서 선택만 움직인다. jsdom 에는 scrollIntoView 가 없다 — 그래서 선택 호출이다.
  useEffect(() => {
    chipRefs.current.get(stepId)?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [stepId]);

  const onChipKeyDown = (e: ReactKeyboardEvent<HTMLButtonElement>, s: { id: StepId }, i: number) => {
    if (e.key === ' ') {
      // 네이티브 click(Space 로 발화)과 전역 재생 토글을 **둘 다** 막는다. 여기서 막지 않으면
      // 집으려던 순간 스텝이 선택되고 재생이 켜진다.
      e.preventDefault();
      e.stopPropagation();
      if (held?.id === s.id) {
        setHeld(null);
        liveRegion.say(`${i + 1}번째에 놓았습니다.`);
      } else {
        setHeld({ id: s.id, origin: i });
        liveRegion.say(`스텝 ${i + 1} 집었습니다. 좌우 방향키로 옮기고 스페이스로 놓으세요.`);
      }
      return;
    }
    if (!held || held.id !== s.id) return; // 집지 않았으면 ←/→ 는 전역 스텝 이동 그대로다

    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      e.stopPropagation();
      const to = i + (e.key === 'ArrowLeft' ? -1 : 1);
      if (to < 0 || to >= steps.length) return; // 끝에서는 조용히 멈춘다(감아 돌지 않는다)
      onReorderStep(s.id, to);
      liveRegion.say(`${to + 1}번째로 옮겼습니다.`);
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation(); // 전역 Esc(선택 해제)까지 함께 터지면 되돌린 이유가 안 보인다
      onReorderStep(s.id, held.origin);
      setHeld(null);
      liveRegion.say('제자리로 되돌렸습니다.');
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      setHeld(null);
      liveRegion.say(`${i + 1}번째에 놓았습니다.`);
    }
  };

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 'none' }}>
          <button type="button" aria-label="이전 스텝" disabled={!canPrev} onClick={goPrev} style={{ ...ICON_BTN, opacity: canPrev ? 1 : 0.4 }}>
            <IconChevronPrev />
          </button>
          <button
            type="button"
            aria-label={playing ? '일시정지' : '재생'}
            disabled={steps.length < 2}
            onClick={onTogglePlay}
            style={{
              // 주 액션은 이전/다음보다 한 뼘 크다 — 그 위계(+4px)를 --hit 위에서도 유지한다.
              width: 'calc(var(--hit) + 4px)',
              height: 'calc(var(--hit) + 4px)',
              borderRadius: 11,
              background: 'var(--accent)',
              color: 'var(--accent-ink-strong)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 'none',
              opacity: steps.length < 2 ? 0.5 : 1,
            }}
            className="on-accent"
          >
            {playing ? <IconPause /> : <IconPlay />}
          </button>
          <button type="button" aria-label="다음 스텝" disabled={!canNext} onClick={goNext} style={{ ...ICON_BTN, opacity: canNext ? 1 : 0.4 }}>
            <IconChevronNext />
          </button>
        </div>

        {/* 순서 바꾸기 안내. 스크롤 상자 **밖**에 둔다 — 안에 있으면 1px 짜리라도 scrollWidth 에 낀다. */}
        <span id={hintId} className="sr-only">
          스페이스로 집은 뒤 좌우 방향키로 순서를 바꿉니다. 스페이스나 엔터로 놓고, Esc 로 되돌립니다.
        </span>
        {/* 사진 뭉치. 칩은 안 줄고 넘치면 가로로 구른다 — 옛 타임라인의 "19장부터 노드 접기" 를
            대신하는 것이 이 스크롤이다. */}
        <div style={{ flex: 1, minWidth: 0, overflowX: 'auto', overflowY: 'hidden' }}>
          <div role="tablist" aria-label="스텝" style={{ display: 'flex', alignItems: 'center', gap: 4, width: 'max-content' }}>
            {order.map((s, i) => {
              const selected = s.id === stepId;
              const dragging = drag.state?.id === s.id;
              const grabbed = held?.id === s.id;
              return (
                <button
                  key={s.id}
                  ref={(el) => {
                    if (el) chipRefs.current.set(s.id, el);
                    else chipRefs.current.delete(s.id);
                  }}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-posinset={i + 1}
                  aria-setsize={steps.length}
                  aria-label={`스텝 ${i + 1}${s.name ? `: ${s.name}` : ''}`}
                  aria-describedby={hintId}
                  title={s.name || `스텝 ${i + 1}`}
                  onPointerDown={(e) => drag.start(e, s.id, i)}
                  onClick={() => {
                    if (drag.consumeDragClick()) return; // 끌기의 뒤끝이 선택으로 둔갑하지 않게
                    onSelectStep(s.id);
                  }}
                  onKeyDown={(e) => onChipKeyDown(e, s, i)}
                  onBlur={() => grabbed && setHeld(null)}
                  style={{
                    position: 'relative',
                    flex: 'none',
                    // 히트 하한(§5.4/WCAG 2.5.8): 높이는 --hit 그대로, 폭은 코트 비율 파생이되
                    // 어느 쪽도 --hit 밑으로 안 간다.
                    height: 'var(--hit)',
                    minHeight: 'var(--hit)',
                    width: stepChipWidthCss(drill.courtMode, drill.courtSize),
                    minWidth: 'var(--hit)',
                    padding: 0,
                    borderRadius: 7,
                    overflow: 'hidden',
                    background: 'var(--elev)',
                    border: selected ? '2px solid var(--accent)' : '1px solid var(--border)',
                    outline: grabbed ? '2px dashed var(--accent)' : undefined,
                    outlineOffset: 2,
                    opacity: dragging ? 0.55 : 1,
                    // 가로 제스처는 우리가(순서 바꾸기), 세로는 브라우저가 가져간다. 'none' 으로
                    // 다 뺏으면 칩 위에서 시작한 세로 스크롤이 죽고, 안 뺏으면 가로 끌기가
                    // 줄 스크롤에 먹혀 순서를 못 바꾼다.
                    touchAction: 'pan-y',
                  }}
                >
                  <span aria-hidden="true" style={{ position: 'absolute', inset: 0 }}>
                    <CourtThumbnail
                      fill
                      mode={drill.courtMode}
                      size={drill.courtSize}
                      thumb={thumbs.get(s.id)}
                      teamColors={teamColors}
                      // 칩은 44 px 다 — 카드 글리프를 그대로 쓰면 개체가 1 px 미만이 된다.
                      glyphScale={CHIP_GLYPH_SCALE}
                    />
                  </span>
                  <span
                    aria-hidden="true"
                    style={{
                      position: 'absolute',
                      left: 2,
                      top: 2,
                      minWidth: 14,
                      height: 14,
                      padding: '0 3px',
                      borderRadius: 4,
                      background: selected ? 'var(--accent)' : 'color-mix(in srgb, var(--panel) 82%, transparent)',
                      color: selected ? 'var(--accent-ink-strong)' : 'var(--muted)',
                      fontFamily: "'Space Grotesk', sans-serif",
                      fontSize: '0.625rem',
                      fontWeight: 700,
                      lineHeight: '14px',
                    }}
                  >
                    {i + 1}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          aria-label="한 장 더 찍기"
          title={steps.length >= LIMITS.maxSteps ? `스텝은 ${LIMITS.maxSteps}장까지입니다.` : '지금 판을 한 장 더 찍어 뒤에 넣습니다.'}
          disabled={steps.length >= LIMITS.maxSteps}
          onClick={onAddStep}
          style={{
            ...ICON_BTN,
            border: '1px dashed var(--border-strong)',
            color: 'var(--faint-text)',
            opacity: steps.length >= LIMITS.maxSteps ? 0.4 : 1,
          }}
        >
          <IconPlus size={17} />
        </button>

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
