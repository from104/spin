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
import type { NoteLabel as NoteLabelData } from '../model/drill.ts';
import type { TransformWriter } from './transformWriter.ts';
import type { ZoneConfig } from '../model/chair.ts';
import { ChairChip } from './objects/ChairChip.tsx';
import { BallDot } from './objects/BallDot.tsx';
import { GoalPost } from './objects/GoalPost.tsx';
import { ConeMark } from './objects/ConeMark.tsx';
import { NoteLabel } from './objects/NoteLabel.tsx';
import { ArrowPath } from './objects/ArrowPath.tsx';

export interface ObjectLayerChair {
  id: ChairId;
  color: string;
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
  onObjectPointerDown?(id: string, e: ReactPointerEvent<SVGGElement>): void;
  onObjectKeyDown?(id: string, e: ReactKeyboardEvent<SVGGElement>): void;
}

export function ObjectLayer({
  writer,
  chairs,
  balls,
  cones,
  goals,
  notes,
  arrows,
  markerUid,
  selection,
  zoneCursors,
  activeId,
  initialFrame,
  onObjectPointerDown,
  onObjectKeyDown,
}: ObjectLayerProps) {
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
      {(goals ?? []).map((gid) => (
        <GoalPost key={gid} id={gid} writer={writer} />
      ))}
      {cones.map((c) => (
        <ConeMark
          key={c.id}
          id={c.id}
          writer={writer}
          colorIndex={c.colorIndex}
          selected={selection.has(c.id)}
          active={activeId === c.id}
          ariaLabel={`콘 ${c.colorIndex === 0 ? '주황' : '파랑'}`}
          onPointerDown={onObjectPointerDown}
          onKeyDown={onObjectKeyDown}
        />
      ))}
      {arrows.map((a) => (
        <ArrowPath
          key={a.id}
          arrow={a}
          markerUid={markerUid}
          selected={selection.has(a.id)}
          active={activeId === a.id}
          onPointerDown={onObjectPointerDown}
          onKeyDown={onObjectKeyDown}
        />
      ))}
      {chairs.map((c) => (
        <ChairChip
          key={c.id}
          id={c.id}
          writer={writer}
          color={c.color}
          number={c.number}
          selected={selection.has(c.id)}
          active={activeId === c.id}
          ariaLabel={c.ariaLabel}
          zoneCursors={zoneCursors}
          onPointerDown={onObjectPointerDown}
          onKeyDown={onObjectKeyDown}
        />
      ))}
      {balls.map((id) => (
        <BallDot
          key={id}
          id={id}
          writer={writer}
          selected={selection.has(id)}
          active={activeId === id}
          ariaLabel="공"
          onPointerDown={onObjectPointerDown}
          onKeyDown={onObjectKeyDown}
        />
      ))}
      {notes.map((n) => (
        <NoteLabel
          key={n.id}
          id={n.id}
          writer={writer}
          text={n.text}
          size={n.size}
          color={n.color}
          align={n.align}
          selected={selection.has(n.id)}
          active={activeId === n.id}
          ariaLabel={`메모: ${n.text}`}
          onPointerDown={onObjectPointerDown}
          onKeyDown={onObjectKeyDown}
        />
      ))}
    </>
  );
}
