// §6.6 콘. 색이 아니라 실루엣으로 구분한다 — 흰 가로 띠는 iPad 배율에서 얼룩으로 사라져
// "색각 이상 대응" 근거가 성립하지 않는다. 슬롯 0 = 채운 삼각형, 슬롯 1 = 삼각형 + 밑변 사각 베이스.
import { memo, useEffect, useRef } from 'react';
import { LockTint } from './LockTint.tsx';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import { CONE_COLORS, OBJ_STROKE } from '../../core/colors.ts';
import { CONE_BASE_D, CONE_TRIANGLE_D } from './coneGeom.ts';
import type { ConeId } from '../../core/ids.ts';
import type { TransformWriter } from '../transformWriter.ts';

export interface ConeMarkProps {
  id: ConeId;
  writer: TransformWriter;
  colorIndex: 0 | 1;
  selected: boolean;
  /** 잠김(2026-08-14) — 이동만 막힌 상태. 붉은 테두리로 표시한다. */
  locked?: boolean;
  active: boolean;
  ariaLabel: string;
  onPointerDown?: (id: ConeId, e: ReactPointerEvent<SVGGElement>) => void;
  onKeyDown?: (id: ConeId, e: ReactKeyboardEvent<SVGGElement>) => void;
}

// ⚠️ 2026-09-06 — 여기 리터럴이던 두 path 는 `coneGeom.ts` 하나에서 온다(인쇄·PNG 가 같은
// 모양을 따로 적고 있었다). 이름만 지역 별칭으로 남긴다.
const TRIANGLE_D = CONE_TRIANGLE_D;
const BASE_D = CONE_BASE_D;

export const ConeMark = memo(function ConeMark({
  id,
  writer,
  colorIndex,
  selected,
  locked = false,
  active,
  ariaLabel,
  onPointerDown,
  onKeyDown,
}: ConeMarkProps) {
  const ref = useRef<SVGGElement | null>(null);

  useEffect(() => {
    writer.register(id, ref.current);
    return () => writer.register(id, null);
  }, [writer, id]);

  const fill = CONE_COLORS[colorIndex];

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
      {/* 선택 링 — ChairChip·BallDot 과 같은 2겹 규약 */}
      {selected && (
        <g className="sel-ring" pointerEvents="none">
          <circle cx={0} cy={0} r={9.5} fill="none" stroke="rgba(0,0,0,.65)" strokeWidth={4} />
          <circle cx={0} cy={0} r={9.5} fill="none" stroke="var(--accent)" strokeWidth={2} strokeDasharray="4.5 3" />
        </g>
      )}
      <path d={TRIANGLE_D} fill={fill} stroke={OBJ_STROKE} strokeWidth={1.6} />
      {colorIndex === 1 && <path d={BASE_D} fill={fill} stroke={OBJ_STROKE} strokeWidth={1.6} />}
      <circle className="focus-ind-outer" cx={0} cy={0} r={9} />
      <circle className="focus-ind-inner" cx={0} cy={0} r={9} />
      {/* 잠김 덮개는 **콘 그림보다 뒤에** 온다 — 앞에 두면 불투명한 삼각형이 통째로 가린다
          (ChairChip 머리말의 2026-08-15 신고 참고). */}
      {locked && <LockTint r={9.5} />}
    </g>
  );
});
