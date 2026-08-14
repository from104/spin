// 텍스트 메모 = **종이 쪽지**(§4.3 P1-5). §3.5 NoteLabel 스키마 — size 기본 14, color 기본 흰색,
// align 기본 middle.
//
// 예전에는 `<text>{text}</text>` 하나뿐이었다. 그래서 `placement.ts` 가 만드는 `text:''` 메모는
// **픽셀이 0** 이었고 — 즉 메모 도구로 코트를 탭하면 화면에 아무 일도 안 일어났다. 5종 개체 중
// 유일하게 선택 링도 안 그려서(`aria-pressed` 만 있었다) 선택된 것조차 보이지 않았다.
// 이제 글이 있든 없든 **접힌 쪽지 칩**을 그리고, 빈 메모에는 흐린 플레이스홀더를 얹는다.
//
// 칩의 크기는 `core/constants.ts` 의 `NOTE` 한 곳에서 온다 — 히트 반경(physics/hitTest.ts)과
// 선택 링(SelectionOverlay)이 같은 숫자를 쓰게 하기 위해서다. 그 머리말이 왜 세로가 상수인지를
// 적어 두었다.
//
// 메모는 물리 드래그 대상이 아니지만(§5.13 DRAGGABLE_KINDS 에 없음) 좌표는 다른 개체와 똑같이
// TransformWriter 가 쓴다 — `store/editor/tween.ts` 의 `poseFrame` 이 메모를 포함한다.
import { memo, useEffect, useRef } from 'react';
import { LockTint } from './LockTint.tsx';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import { NOTE } from '../../core/constants.ts';
import { NOTE_FILL, NOTE_FOLD_FILL, NOTE_PLACEHOLDER_FILL, OBJ_STROKE } from '../../core/colors.ts';
import type { NoteId } from '../../core/ids.ts';
import type { TransformWriter } from '../transformWriter.ts';
import { useUprightTransform } from '../stageRot.tsx';
import { NOTE_PLACEHOLDER, noteChipPathD, noteChipWidthPx, noteFoldPathD } from './noteChip.ts';

export interface NoteLabelProps {
  id: NoteId;
  writer: TransformWriter;
  text: string;
  size?: number;
  color?: string;
  align?: 'start' | 'middle' | 'end';
  selected: boolean;
  /** 잠김(2026-08-14) — 이동만 막힌 상태. 붉은 테두리로 표시한다. */
  locked?: boolean;
  active: boolean;
  ariaLabel: string;
  onPointerDown?: (id: NoteId, e: ReactPointerEvent<SVGGElement>) => void;
  onKeyDown?: (id: NoteId, e: ReactKeyboardEvent<SVGGElement>) => void;
}

const FONT = "'Pretendard',sans-serif";

export const NoteLabel = memo(function NoteLabel({
  id,
  writer,
  text,
  size = 14,
  color = '#ffffff',
  align = 'middle',
  selected,
  locked = false,
  active,
  ariaLabel,
  onPointerDown,
  onKeyDown,
}: NoteLabelProps) {
  const upright = useUprightTransform();
  const ref = useRef<SVGGElement | null>(null);

  useEffect(() => {
    writer.register(id, ref.current);
    return () => writer.register(id, null);
  }, [writer, id]);

  const empty = text.length === 0;
  const w = noteChipWidthPx(text, size);
  const halfW = w / 2;
  const halfH = NOTE.chipHPx / 2;
  const chipD = noteChipPathD(halfW);
  const foldD = noteFoldPathD(halfW);
  // align 은 글의 정렬이 아니라 **앵커 기준 칩의 위치**이기도 하다 — start 면 앵커가 왼쪽 끝이다.
  const textX = align === 'start' ? -halfW + NOTE.chipPadXPx : align === 'end' ? halfW - NOTE.chipPadXPx : 0;

  return (
    <g
      ref={ref}
      id={`obj-${id}`}
      className="court-obj"
      role="button"
      aria-label={ariaLabel}
      aria-pressed={selected}
      tabIndex={active ? 0 : -1}
      onPointerDown={(e) => onPointerDown?.(id, e)}
      onKeyDown={(e) => onKeyDown?.(id, e)}
    >
      {locked && <LockTint r={NOTE.ringRadiusPx} />}
      {/* 선택 링 — ChairChip·BallDot·ConeMark 와 같은 2겹 규약(한 겹이면 개체 색과 겹쳐 사라진다).
          반지름은 칩의 외접원(20)보다 큰 22 라 칩을 통째로 감싼다. 원이라 판 회전과 무관하다. */}
      {selected && (
        <g className="sel-ring" pointerEvents="none">
          <circle cx={0} cy={0} r={NOTE.ringRadiusPx} fill="none" stroke="rgba(0,0,0,.65)" strokeWidth={4} />
          <circle cx={0} cy={0} r={NOTE.ringRadiusPx} fill="none" stroke="var(--accent)" strokeWidth={2} strokeDasharray="4.5 3" />
        </g>
      )}
      {/* 판이 돌아도 쪽지는 바로 선다(§6.4). 칩이 사각형이라 글자와 **함께** 되돌려야 한다. */}
      <g transform={upright}>
        <path className="note-chip" d={chipD} fill={NOTE_FILL} stroke={OBJ_STROKE} strokeWidth={1.4} strokeLinejoin="round" />
        <path className="note-fold" d={foldD} fill={NOTE_FOLD_FILL} stroke={OBJ_STROKE} strokeWidth={1.4} strokeLinejoin="round" />
        {empty ? (
          <text
            className="note-placeholder"
            x={0}
            y={0}
            fontFamily={FONT}
            fontSize={NOTE.placeholderSizePx}
            fontWeight={600}
            fill={NOTE_PLACEHOLDER_FILL}
            textAnchor="middle"
            dominantBaseline="central"
          >
            {NOTE_PLACEHOLDER}
          </text>
        ) : (
          <text x={textX} y={0} fontFamily={FONT} fontSize={size} fontWeight={600} fill={color} textAnchor={align} dominantBaseline="central">
            {text}
          </text>
        )}
      </g>
      {/* 포커스 링도 칩을 감싼다 — 예전에는 글자 상자(size 기준)를 감싸서 빈 메모에서는 아무것도
          없는 허공에 떴다. 칩과 같은 upright 안에 둬야 판을 돌려도 어긋나지 않는다. */}
      <g transform={upright}>
        <rect className="focus-ind-outer" x={-halfW - 3} y={-halfH - 3} width={w + 6} height={NOTE.chipHPx + 6} rx={5} />
        <rect className="focus-ind-inner" x={-halfW - 3} y={-halfH - 3} width={w + 6} height={NOTE.chipHPx + 6} rx={5} />
      </g>
    </g>
  );
});
