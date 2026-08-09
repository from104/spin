// 텍스트 메모. §3.5 NoteLabel 스키마 — size 기본 14, color 기본 흰색, align 기본 middle.
// 메모는 물리 드래그 대상이 아니지만(§5.13 DRAGGABLE_KINDS 에 없음) 포인터로 옮기는 동작은
// 좌표만 바뀌는 저빈도 조작이라 TransformWriter 를 그대로 재사용해 마운트 즉시 위치를 잡는다.
import { memo, useEffect, useRef } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import type { NoteId } from '../../core/ids.ts';
import type { TransformWriter } from '../transformWriter.ts';
import { useUprightTransform } from '../stageRot.tsx';

export interface NoteLabelProps {
  id: NoteId;
  writer: TransformWriter;
  text: string;
  size?: number;
  color?: string;
  align?: 'start' | 'middle' | 'end';
  selected: boolean;
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
      {/* 판이 돌아도 메모는 바로 선다(§6.4). */}
      <g transform={upright}>
      <text x={0} y={0} fontFamily={FONT} fontSize={size} fontWeight={600} fill={color} textAnchor={align} dominantBaseline="central">
        {text}
      </text>
      </g>
      <rect className="focus-ind-outer" x={-size * 2} y={-size * 0.9} width={size * 4} height={size * 1.8} rx={4} />
      <rect className="focus-ind-inner" x={-size * 2} y={-size * 0.9} width={size * 4} height={size * 1.8} rx={4} />
    </g>
  );
});
