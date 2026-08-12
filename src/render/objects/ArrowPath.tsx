// §6.6 화살표. 케이싱(halo)을 반드시 넣는다 — `#38bdf8` 는 코트 대비 2.49:1 로 WCAG 1.4.11
// 미달이라 검정 케이싱(3.93:1)이 없으면 시각 대비 요건을 못 채운다. marker-end 는 이 SVG
// 루트에서 유일한 `uid`(useId() 결과, CourtStage 가 공급)로 조립한다 — 전역 고정 id 를 쓰면
// 목록 카드 다중 인스턴스에서 url(#id) 참조가 문서 순서상 첫 번째로 깨진다(§6.6).
import { memo, useLayoutEffect, useRef } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import { ARROW_CASING } from '../../core/colors.ts';
import type { ArrowId } from '../../core/ids.ts';
import type { Arrow } from '../../model/arrow.ts';
import { ARROW_STYLES, arrowColor, arrowPath } from '../../model/arrow.ts';
import type { TransformWriter } from '../transformWriter.ts';

export interface ArrowPathProps {
  arrow: Arrow;
  /** ArrowMarkers 가 `${uid}-${colorHex.slice(1)}` 로 만든 marker id 의 접두사. */
  markerUid: string;
  /** 편집기(§6.7/3.10 스텝 전환 트윈)만 넘긴다 — 트윈이 registerArrow 로 `d` 를 직접 쓴다.
   *  시연·썸네일은 React 재렌더 경로(PresentObjects 헤더 주석)라 넘기지 않는다. */
  writer?: TransformWriter;
  selected: boolean;
  active: boolean;
  onPointerDown?: (id: ArrowId, e: ReactPointerEvent<SVGGElement>) => void;
  onKeyDown?: (id: ArrowId, e: ReactKeyboardEvent<SVGGElement>) => void;
}

export const ArrowPath = memo(function ArrowPath({ arrow, markerUid, writer, selected, active, onPointerDown, onKeyDown }: ArrowPathProps) {
  const gRef = useRef<SVGGElement | null>(null);
  // deps 에 arrow **객체**가 들어 있는 것이 핵심이다: React 가 d 를 다시 렌더할 때마다(스텝
  // 전환 커밋·인스펙터 편집) registerArrow 가 다시 돌아 writer 의 마지막 프레임 d 를 재생한다.
  // 이게 없으면 스텝 전환 커밋에서 React 가 도착 스텝의 d 를 먼저 써 버리는데, 직후의 트윈
  // 시작 프레임(e=0)은 writer 의 EPS 비교상 "변화 없음"이라 DOM 을 되찾지 못한다 — 화살표만
  // 트윈 없이 즉시 도착해 버린다. 같은 장 안의 편집에서는 잠깐 낡은 d 를 쓰지만, 같은 커밋의
  // ObjectLayer initialFrame 재적용(부모라 이 effect 뒤에 돈다)이 새 좌표로 즉시 덮는다.
  useLayoutEffect(() => {
    if (!writer) return;
    writer.registerArrow(arrow.id, gRef.current);
    return () => writer.registerArrow(arrow.id, null);
  }, [writer, arrow]);
  const d = arrowPath(arrow);
  const style = ARROW_STYLES[arrow.kind];
  const color = arrowColor(arrow);
  const markerId = `${markerUid}-${color.slice(1)}`;

  return (
    <g
      ref={gRef}
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
      {/* §7.2 포커스 표시. 다른 4종(공·콘·의자·메모)은 원/사각형으로 이미 focus-ind-*
       * 을 붙였는데 화살표만 빠져 있었다 — `.court-obj { outline:none }` 이 브라우저 기본
       * 포커스 링을 죽이므로 대체 링이 없으면 키보드 포커스가 전혀 안 보인다.
       * 경로형이라 같은 `d` 를 재사용해 화살표 자체를 감싸는 halo 로 그린다. */}
      <path className="focus-ind-outer" d={d} />
      <path className="focus-ind-inner" d={d} />
    </g>
  );
});
