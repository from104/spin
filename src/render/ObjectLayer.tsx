// §6.6 레이어 구조 — 표준 개체 렌더러. `<g>` 자식에는 transform prop 이 절대 나타나지 않는다
// (§6.1 규칙 1) — 위치는 각 개체가 마운트 시 등록한 ref 에 TransformWriter 가 직접 쓴다.
//
// 주의(계약서와 다른 점): §6.6 의 XML 스케치는 `<g class="arrows">` 를 `<g class="objects">`
// (콘/휠체어/공/메모) **앞**에 두지만, §3.5 가 못박은 표준 z-order("코트면 → 격자 → 규칙존 →
// 콘 → 화살표 → 휠체어 → 공 → 메모")와 이미 커밋된 render-court 의 `CourtThumbnail.tsx`
// 실제 구현(콘 → 화살표 → 휠체어 → 공 순서로 한 그룹에 나열)은 둘 다 화살표가 콘 "다음"·
// 휠체어 "앞"에 오는 단일 순서를 쓴다. §0 원칙("계약서와 실제 코드가 다르면 실제 코드가
// 맞다")에 따라 이 파일도 CourtThumbnail 과 같은 단일 순서(콘→화살표→휠체어→공→메모)를 쓴다.
import { useLayoutEffect, useRef } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import type { BallId, ChairId, ConeId } from '../core/ids.ts';
import type { Arrow } from '../model/arrow.ts';
import type { NoteLabel as NoteLabelData, TeamSide } from '../model/drill.ts';
import type { TransformWriter } from './transformWriter.ts';
import type { RuleOverlayApi } from './ruleOverlay.ts';
import type { ZoneConfig } from '../model/chair.ts';
import { ChairChip } from './objects/ChairChip.tsx';
import { BallDot } from './objects/BallDot.tsx';
import { GoalHomeGhost, GoalPost } from './objects/GoalPost.tsx';
import { ConeMark } from './objects/ConeMark.tsx';
import { NoteLabel } from './objects/NoteLabel.tsx';
import { ArrowPath } from './objects/ArrowPath.tsx';
import { useT } from '../i18n/useT.ts';

export interface ObjectLayerChair {
  id: ChairId;
  color: string;
  /** 팀 소속. 4.6 이 더한 **색이 아닌 팀 채널**(테두리 파선·볼가드 톤)의 입력이다.
   *  ⚠️ 필수로 둔다 — 선택으로 내리면 새 호출자가 조용히 빠뜨리고, 그 칩만 색 하나로
   *  갈리는 상태로 돌아간다(흑백 인쇄·색각 이상에서 구분 불가). */
  team: TeamSide;
  number: string;
  ariaLabel: string;
}
export interface ObjectLayerCone {
  id: ConeId;
  colorIndex: 0 | 1;
}

export interface ObjectLayerProps {
  writer: TransformWriter;
  chairs: readonly ObjectLayerChair[];
  balls: readonly BallId[];
  cones: readonly ObjectLayerCone[];
  /** 골대 포스트 id(`gp_0`…). 편집기에서만 넘긴다 — 시연·썸네일은 코트 라인의 정적 표시를 쓴다. */
  goals?: readonly string[];
  /** 그중 **제자리를 벗어난** 것들. 이 골대만 복귀 커서를 얻고 눌린다(GoalPost 머리말). */
  displacedGoals?: ReadonlySet<string>;
  /** 골대의 제자리(코트 정의 좌표). `goals` 와 **같은 순서**다. 밀린 골대에 점선 유령을
   *  남기는 데만 쓴다 — 없으면 유령 없이 강조 링만 뜬다(마우스는 커서로도 안다). */
  goalHomes?: readonly { x: number; y: number }[];
  /** 밀린 골대를 눌렀을 때 — **모든** 골대를 원위치로. 편집기에서만 넘긴다. */
  onGoalReturn?: () => void;
  notes: readonly NoteLabelData[];
  arrows: readonly Arrow[];
  /** ArrowMarkers 가 이 SVG 루트에 만든 `useId()` 접두사. */
  markerUid: string;
  selection: ReadonlySet<string>;
  /** 편집기에서만 넘긴다 — 차체 위 4개 존에 존별 마우스 커서를 얹는다. */
  zoneCursors?: ZoneConfig | null;
  /** 로빙 tabindex 대상(§7.5b `aria-activedescendant`). */
  activeId: string | null;
  /** 마운트 첫 페인트에 즉시 확정할 프레임(§6.2 요건 2) — 드릴 재마운트·스텝 점프 직후에도 채운다. */
  initialFrame?: Readonly<Record<string, { x: number; y: number; theta: number }>>;
  /** 3.10 스텝 전환의 등장/퇴장 페이드 — 시연(interpolateSteps)의 opacity 규칙과 같은 그림.
   *  키 = 화살표/메모 id, 값 = 방향. 'out' 은 이전 스텝에만 있던 개체(호출자가 arrows/notes
   *  목록에 함께 실어 보낸다)라 조작 대상이 아니다 — pointer-events 를 CSS 가 끊는다.
   *  움직임 자체는 CSS 애니메이션이 그린다(§6.1 규칙 준수: React 는 프레임을 구동하지 않는다). */
  fades?: Readonly<Record<string, 'in' | 'out'>>;
  /** 잠긴 개체 id — 붉은 테두리를 그린다(2026-08-14 기현 지시). 이동 차단은 편집기 몫이다. */
  locked?: ReadonlySet<string>;
  /** 무시된 휠체어 id — 흐리게 그리고 포인터를 안 받는다. 물리에서는 이미 빠져 있다
   *  (physics/index.ts 의 load). 여기서 흐리게만 하고 body 를 두면 "안 보이는데 부딪히는"
   *  유령이 되므로, 두 곳이 **같은 목록**을 봐야 한다. */
  ignored?: ReadonlySet<string>;
  /** 페이드 지속(ms). stepTransitionMs 와 같은 값이어야 위치 트윈과 한 시계로 끝난다. */
  fadeMs?: number;
  /** 아웃오브플레이(Law 9) 공 채움색 갱신 — 있으면(=규칙 존 스위치가 배선된 화면) 공마다
   *  circle 을 등록해 `rules.write()` 가 매 프레임 직접 fill 을 바꾼다(BallDot.tsx 참고).
   *  옵셔널이다 — 이 값을 안 넘기는 소비처(예: 인쇄 미리보기)는 recolor 가 그냥 없다. */
  rules?: RuleOverlayApi;
  onObjectPointerDown?(id: string, e: ReactPointerEvent<SVGGElement>): void;
  onObjectKeyDown?(id: string, e: ReactKeyboardEvent<SVGGElement>): void;
}

export function ObjectLayer({
  writer,
  chairs,
  balls,
  cones,
  goals,
  displacedGoals,
  goalHomes,
  onGoalReturn,
  notes,
  arrows,
  markerUid,
  selection,
  zoneCursors,
  activeId,
  initialFrame,
  fades,
  fadeMs,
  locked,
  ignored,
  rules,
  onObjectPointerDown,
  onObjectKeyDown,
}: ObjectLayerProps) {
  const t = useT();
  // 화살표·메모의 페이드 래퍼 속성. 래퍼 <g> 는 **항상** 두고 클래스만 바꾼다 — 전환 중에만
  // 감쌌다 벗기면 React 가 자식을 재마운트해 포커스가 떨어지고 writer 등록이 한 번 더 돈다.
  /** 무시된 개체의 껍데기 속성 — **흐리게만** 한다.
   *
   *  ⚠️ `pointerEvents:'none'` 을 함께 걸었다가 되돌렸다(기현 신고 2026-08-14: *"무시된
   *  오브젝트의 선택이 안 되거나 오른쪽 클릭이 안 된다"*). 손이 안 닿으면 **무시를 풀 방법이
   *  없다** — 잠김에서 "선택은 막지 않는다" 로 피했던 함정에 무시가 그대로 빠져 있었다.
   *  '상호작용 안 함' 은 **물리**의 이야기다(공이 통과한다). 그것은 physics/index.ts 의 load 가
   *  body 를 안 만드는 것으로 이미 지켜지고, 화면에서 손까지 막을 이유는 없었다. */
  const ghostProps = (id: string): { style?: { opacity: number } } =>
    ignored?.has(id) ? { style: { opacity: 0.32 } } : {};

  const fadeProps = (id: string): { className?: string; style?: { animationDuration: string } } => {
    const dir = fades?.[id];
    if (!dir || !fadeMs) return {};
    return { className: dir === 'in' ? 'court-fade-in' : 'court-fade-out', style: { animationDuration: `${fadeMs}ms` } };
  };
  // §6.2: ObjectLayer 는 마운트/재마운트마다 최초 프레임을 페인트 전에 확정한다 —
  // 안 하면 마운트 첫 페인트에 개체 전부가 viewBox 원점에 겹치고, 아무도 write 하지
  // 않는 경로(시연의 `key={drillId}` 드릴 재마운트)에서는 영구 고착한다.
  const framePinnedRef = useRef<Readonly<Record<string, { x: number; y: number; theta: number }>> | undefined>(
    undefined,
  );
  useLayoutEffect(() => {
    if (initialFrame && initialFrame !== framePinnedRef.current) {
      writer.writeFrame(initialFrame);
      framePinnedRef.current = initialFrame;
    }
    // 마운트 시 1회 + initialFrame 참조가 바뀔 때(재시드)만 — 매 렌더마다 재적용하지 않는다.
  }, [writer, initialFrame]);

  return (
    <>
      {/* 유령이 **먼저** — 제자리는 밀린 골대와 겹칠 수 있고(막 밀리기 시작한 순간), 그때
          위에 오면 진짜 골대를 가린다. */}
      {(goals ?? []).map((gid, i) => {
        const home = goalHomes?.[i];
        if (!home || !displacedGoals?.has(gid)) return null;
        return <GoalHomeGhost key={`${gid}_home`} x={home.x} y={home.y} />;
      })}
      {(goals ?? []).map((gid) => (
        <GoalPost key={gid} id={gid} writer={writer} displaced={displacedGoals?.has(gid) ?? false} onReturn={onGoalReturn} />
      ))}
      {cones.map((c) => (
        <ConeMark
          key={c.id}
          id={c.id}
          writer={writer}
          colorIndex={c.colorIndex}
          selected={selection.has(c.id)}
          locked={locked?.has(c.id)}
          active={activeId === c.id}
          ariaLabel={t('present.objects.coneAriaLabel', { color: t(c.colorIndex === 0 ? 'team.colorNames.orange' : 'team.colorNames.blue') })}
          onPointerDown={onObjectPointerDown}
          onKeyDown={onObjectKeyDown}
        />
      ))}
      {arrows.map((a) => (
        <g key={a.id} {...fadeProps(a.id)}>
          <ArrowPath
            arrow={a}
            markerUid={markerUid}
            writer={writer}
            selected={selection.has(a.id)}
            locked={locked?.has(a.id)}
            active={activeId === a.id}
            onPointerDown={onObjectPointerDown}
            onKeyDown={onObjectKeyDown}
          />
        </g>
      ))}
      {chairs.map((c) => (
        // 무시는 **휠체어에만** 있다(기현 지시) — 그래서 껍데기도 여기만 씌운다.
        <g key={c.id} {...ghostProps(c.id)}>
        <ChairChip
          id={c.id}
          writer={writer}
          color={c.color}
          team={c.team}
          number={c.number}
          selected={selection.has(c.id)}
          locked={locked?.has(c.id)}
          active={activeId === c.id}
          ariaLabel={c.ariaLabel}
          zoneCursors={zoneCursors}
          onPointerDown={onObjectPointerDown}
          onKeyDown={onObjectKeyDown}
        />
        </g>
      ))}
      {balls.map((id) => (
        <BallDot
          key={id}
          id={id}
          writer={writer}
          selected={selection.has(id)}
          locked={locked?.has(id)}
          active={activeId === id}
          ariaLabel={t('present.objects.ballAriaLabel')}
          rules={rules}
          onPointerDown={onObjectPointerDown}
          onKeyDown={onObjectKeyDown}
        />
      ))}
      {notes.map((n) => (
        <g key={n.id} {...fadeProps(n.id)}>
          <NoteLabel
            id={n.id}
            writer={writer}
            text={n.text}
            size={n.size}
            color={n.color}
            align={n.align}
            selected={selection.has(n.id)}
            locked={locked?.has(n.id)}
            active={activeId === n.id}
            ariaLabel={t('objectLayer.noteAriaLabel', { text: n.text })}
            onPointerDown={onObjectPointerDown}
            onKeyDown={onObjectKeyDown}
          />
        </g>
      ))}
    </>
  );
}
