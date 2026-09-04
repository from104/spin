// §6.6 공. 물리 반지름 4.125px, 시각 반지름 7px(프로토타입 그대로 — 괴리는 의도적, §12-Q4).
import { memo, useEffect, useRef } from 'react';
import { LockTint } from './LockTint.tsx';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import { BALL } from '../../core/constants.ts';
import { BALL_FILL } from '../../core/colors.ts';
import type { BallId } from '../../core/ids.ts';
import type { TransformWriter } from '../transformWriter.ts';
import type { RuleOverlayApi } from '../ruleOverlay.ts';

export interface BallDotProps {
  id: BallId;
  writer: TransformWriter;
  selected: boolean;
  /** 잠김(2026-08-14) — 이동만 막힌 상태. 붉은 테두리로 표시한다. */
  locked?: boolean;
  active: boolean;
  ariaLabel: string;
  /** 아웃오브플레이(Law 9) 채움색 갱신 — 있으면 이 공의 circle 을 등록해 `rules.write()` 가
   *  매 프레임 직접 fill 을 바꾼다(React 를 지나지 않음, ruleOverlay.ts 머리말과 같은 이유).
   *  옵셔널이다 — 편집기(ObjectLayer)는 아직 이 표시 대상이 아니라 넘기지 않는다. */
  rules?: RuleOverlayApi;
  onPointerDown?: (id: BallId, e: ReactPointerEvent<SVGGElement>) => void;
  onKeyDown?: (id: BallId, e: ReactKeyboardEvent<SVGGElement>) => void;
}

export const BallDot = memo(function BallDot({ id, writer, selected,
  locked = false, active, ariaLabel, rules, onPointerDown, onKeyDown }: BallDotProps) {
  const ref = useRef<SVGGElement | null>(null);
  const fillRef = useRef<SVGCircleElement | null>(null);

  useEffect(() => {
    writer.register(id, ref.current);
    return () => writer.register(id, null);
  }, [writer, id]);

  useEffect(() => {
    rules?.registerBall(id, fillRef.current);
    return () => rules?.registerBall(id, null);
  }, [rules, id]);

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
      <circle ref={fillRef} cx={0} cy={0} r={BALL.viewRadiusPx} fill={BALL_FILL} stroke="#fff" strokeWidth={2.4} />
      <circle className="focus-ind-outer" cx={0} cy={0} r={BALL.viewRadiusPx + 5} />
      <circle className="focus-ind-inner" cx={0} cy={0} r={BALL.viewRadiusPx + 5} />
      {/* 잠김 덮개는 **공보다 뒤에** 온다 — 앞에 두면 불투명한 공이 통째로 가린다. */}
      {locked && <LockTint r={BALL.viewRadiusPx + 4} />}
    </g>
  );
});
