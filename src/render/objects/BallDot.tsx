// §6.6 공. 물리 반지름 4.125px, 시각 반지름 7px(프로토타입 그대로 — 괴리는 의도적, §12-Q4).
import { memo, useEffect, useRef } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import { BALL } from '../../core/constants.ts';
import { BALL_FILL } from '../../core/colors.ts';
import type { BallId } from '../../core/ids.ts';
import type { TransformWriter } from '../transformWriter.ts';

export interface BallDotProps {
  id: BallId;
  writer: TransformWriter;
  selected: boolean;
  active: boolean;
  ariaLabel: string;
  onPointerDown?: (id: BallId, e: ReactPointerEvent<SVGGElement>) => void;
  onKeyDown?: (id: BallId, e: ReactKeyboardEvent<SVGGElement>) => void;
}

export const BallDot = memo(function BallDot({ id, writer, selected, active, ariaLabel, onPointerDown, onKeyDown }: BallDotProps) {
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
      <circle cx={0} cy={0} r={BALL.viewRadiusPx} fill={BALL_FILL} stroke="#fff" strokeWidth={2.4} />
      <circle className="focus-ind-outer" cx={0} cy={0} r={BALL.viewRadiusPx + 5} />
      <circle className="focus-ind-inner" cx={0} cy={0} r={BALL.viewRadiusPx + 5} />
    </g>
  );
});
