// §6.6 공. 물리 반지름 4.125px, 시각 반지름 7px(프로토타입 그대로 — 괴리는 의도적, §12-Q4).
import { memo, useEffect, useRef } from 'react';
import { LockTint } from './LockTint.tsx';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import { BALL } from '../../core/constants.ts';
import { BALL_FILL } from '../../core/colors.ts';
import type { BallId } from '../../core/ids.ts';
import type { TransformWriter } from '../transformWriter.ts';

export interface BallDotProps {
  id: BallId;
  writer: TransformWriter;
  selected: boolean;
  /** 잠김(2026-08-14) — 이동만 막힌 상태. 붉은 테두리로 표시한다. */
  locked?: boolean;
  active: boolean;
  ariaLabel: string;
  onPointerDown?: (id: BallId, e: ReactPointerEvent<SVGGElement>) => void;
  onKeyDown?: (id: BallId, e: ReactKeyboardEvent<SVGGElement>) => void;
}

export const BallDot = memo(function BallDot({ id, writer, selected,
  locked = false, active, ariaLabel, onPointerDown, onKeyDown }: BallDotProps) {
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
      {/* 선택 링 — 어두운 밑선 + 액센트 파선 2겹(ChairChip 과 동일한 근거: 한 겹이면 개체 색과 겹쳐 사라진다) */}
      {selected && (
        <g className="sel-ring" pointerEvents="none">
          <circle cx={0} cy={0} r={BALL.viewRadiusPx + 4} fill="none" stroke="rgba(0,0,0,.65)" strokeWidth={4.5} />
          <circle cx={0} cy={0} r={BALL.viewRadiusPx + 4} fill="none" stroke="var(--accent)" strokeWidth={2.2} strokeDasharray="5 3.5" />
        </g>
      )}
      <circle cx={0} cy={0} r={BALL.viewRadiusPx} fill={BALL_FILL} stroke="#fff" strokeWidth={2.4} />
      <circle className="focus-ind-outer" cx={0} cy={0} r={BALL.viewRadiusPx + 5} />
      <circle className="focus-ind-inner" cx={0} cy={0} r={BALL.viewRadiusPx + 5} />
      {/* 잠김 덮개는 **공보다 뒤에** 온다 — 앞에 두면 불투명한 공이 통째로 가린다. */}
      {locked && <LockTint r={BALL.viewRadiusPx + 4} />}
    </g>
  );
});
