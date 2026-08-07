// §6.6 화살표. 케이싱(halo)을 반드시 넣는다 — `#38bdf8` 는 코트 대비 2.49:1 로 WCAG 1.4.11
// 미달이라 검정 케이싱(3.93:1)이 없으면 시각 대비 요건을 못 채운다. marker-end 는 이 SVG
// 루트에서 유일한 `uid`(useId() 결과, CourtStage 가 공급)로 조립한다 — 전역 고정 id 를 쓰면
// 목록 카드 다중 인스턴스에서 url(#id) 참조가 문서 순서상 첫 번째로 깨진다(§6.6).
import { memo } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import { ARROW_CASING } from '../../core/colors.ts';
import type { ArrowId } from '../../core/ids.ts';
import type { Arrow } from '../../model/arrow.ts';
import { ARROW_STYLES, arrowColor, arrowPath } from '../../model/arrow.ts';

export interface ArrowPathProps {
  arrow: Arrow;
  /** ArrowMarkers 가 `${uid}-${colorHex.slice(1)}` 로 만든 marker id 의 접두사. */
  markerUid: string;
  selected: boolean;
  active: boolean;
  onPointerDown?: (id: ArrowId, e: ReactPointerEvent<SVGGElement>) => void;
  onKeyDown?: (id: ArrowId, e: ReactKeyboardEvent<SVGGElement>) => void;
}

export const ArrowPath = memo(function ArrowPath({ arrow, markerUid, selected, active, onPointerDown, onKeyDown }: ArrowPathProps) {
  const d = arrowPath(arrow);
  const style = ARROW_STYLES[arrow.kind];
  const color = arrowColor(arrow);
  const markerId = `${markerUid}-${color.slice(1)}`;

  return (
    <g
      id={`obj-${arrow.id}`}
      className="court-obj"
      role="button"
      aria-label={`${arrow.kind === 'pass' ? '패스' : arrow.kind === 'shot' ? '슛' : '이동'} 화살표`}
      aria-pressed={selected}
      tabIndex={active ? 0 : -1}
      onPointerDown={(e) => onPointerDown?.(arrow.id, e)}
      onKeyDown={(e) => onKeyDown?.(arrow.id, e)}
    >
      {selected && <path d={d} fill="none" stroke="var(--accent)" strokeWidth={style.width + 6} strokeLinecap="round" opacity={0.45} />}
      <path d={d} fill="none" stroke={ARROW_CASING} strokeWidth={style.width + 2.4} strokeLinecap="round" />
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={style.width}
        strokeLinecap="round"
        strokeDasharray={style.dash || undefined}
        markerEnd={`url(#${markerId})`}
      />
    </g>
  );
});
