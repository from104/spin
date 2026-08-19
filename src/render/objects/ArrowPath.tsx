// §6.6 화살표. 케이싱(halo)을 반드시 넣는다 — `#38bdf8` 는 코트 대비 2.49:1 로 WCAG 1.4.11
// 미달이라 검정 케이싱(3.93:1)이 없으면 시각 대비 요건을 못 채운다. marker-end 는 이 SVG
// 루트에서 유일한 `uid`(useId() 결과, CourtStage 가 공급)로 조립한다 — 전역 고정 id 를 쓰면
// 목록 카드 다중 인스턴스에서 url(#id) 참조가 문서 순서상 첫 번째로 깨진다(§6.6).
import { memo, useLayoutEffect, useRef } from 'react';
import { LOCK_TINT_COLOR, LOCK_TINT_OPACITY } from '../../core/colors.ts';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import { ARROW_CASING } from '../../core/colors.ts';
import type { ArrowId } from '../../core/ids.ts';
import type { Arrow, ArrowHead } from '../../model/arrow.ts';
import { ARROW_STYLE, arrowColor, arrowPath, headFromOf, headToOf } from '../../model/arrow.ts';
import type { TransformWriter } from '../transformWriter.ts';
import { translate } from '../../i18n/useT.ts';
import type { Locale } from '../../i18n/locale.ts';
import { useLocale } from '../../i18n/useLocale.ts';

export interface ArrowPathProps {
  arrow: Arrow;
  /** ArrowMarkers 가 `${uid}-${colorHex.slice(1)}` 로 만든 marker id 의 접두사. */
  markerUid: string;
  /** 편집기(§6.7/3.10 스텝 전환 트윈)만 넘긴다 — 트윈이 registerArrow 로 `d` 를 직접 쓴다.
   *  시연·썸네일은 React 재렌더 경로(PresentObjects 헤더 주석)라 넘기지 않는다. */
  writer?: TransformWriter;
  selected: boolean;
  /** 잠김(2026-08-14) — 화살표는 선이라 덮개도 선이다(굵은 보라 반투명 획). */
  locked?: boolean;
  active: boolean;
  onPointerDown?: (id: ArrowId, e: ReactPointerEvent<SVGGElement>) => void;
  onKeyDown?: (id: ArrowId, e: ReactKeyboardEvent<SVGGElement>) => void;
}

/** 접근성 이름 — 종류가 사라졌으므로 **양 끝 화살촉**이 그 자리를 말한다(2026-08-16).
 *  스크린리더 사용자에게 '이동/패스' 는 이제 없는 구분이고, 실제로 다른 것은 화살촉이다. */
export function arrowLabel(a: Pick<Arrow, 'headFrom' | 'headTo'>, locale: Locale): string {
  const f = headFromOf(a);
  const t = headToOf(a);
  const name = (h: ArrowHead): string => translate(locale, h === 'wide' ? 'arrow.label.wideName' : 'arrow.label.thinName');
  if (f === 'none' && t === 'none') return translate(locale, 'arrow.label.plain');
  if (f !== 'none' && t !== 'none') return translate(locale, 'arrow.label.bothTemplate', { name: name(t) });
  return translate(locale, 'arrow.label.oneTemplate', { name: name(f === 'none' ? t : f) });
}

export const ArrowPath = memo(function ArrowPath({ arrow, markerUid, writer, selected, locked = false, active, onPointerDown, onKeyDown }: ArrowPathProps) {
  const gRef = useRef<SVGGElement | null>(null);
  const locale = useLocale();
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
  const style = ARROW_STYLE;
  const color = arrowColor(arrow);
  const markerId = `${markerUid}-${color.slice(1)}`;
  const hFrom = headFromOf(arrow);
  const hTo = headToOf(arrow);
  // 십자 커서 — **도형의 몸통과 같은 신호**다(기현 지시 2026-08-16: *"커서를 십자로(도형처럼)"*).
  // 잡으면 선이 통째로 간다는 예고이고, 끝 앵커(원)와 몸통(선)이 서로 다른 일을 한다는 것을
  // 손이 닿기 전에 알려 주는 유일한 채널이다.
  // ⚠️ `onPointerDown` 이 없는 화면(시연·인쇄·썸네일)에는 안 건다 — 거기서는 못 옮긴다.

  return (
    <g
      ref={gRef}
      id={`obj-${arrow.id}`}
      className="court-obj"
      role="button"
      aria-label={arrowLabel(arrow, locale)}
      aria-pressed={selected}
      tabIndex={active ? 0 : -1}
      onPointerDown={(e) => onPointerDown?.(arrow.id, e)}
      style={onPointerDown ? { cursor: 'move' } : undefined}
      onKeyDown={(e) => onKeyDown?.(arrow.id, e)}
    >
      {selected && <path d={d} fill="none" stroke="var(--accent)" strokeWidth={style.width + 6} strokeLinecap="round" opacity={0.45} />}
      {/* 케이싱은 **선에만** 건다. 여기에 화살촉 마커까지 달면 케이싱 굵기(5.8)에 비례해
          마커가 1.7배로 커져 화살촉 뒤로 검은 삼각형이 비어져 나온다(기현 신고 2026-08-16).
          화살촉의 대비는 마커 자신의 테두리가 맡는다 — 근거는 ArrowMarkers 의 HEAD_CASING_W. */}
      <path d={d} fill="none" stroke={ARROW_CASING} strokeWidth={style.width + 2.4} strokeLinecap="round" />
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={style.width}
        strokeLinecap="round"
        markerStart={hFrom === 'none' ? undefined : `url(#${markerId}-${hFrom})`}
        markerEnd={hTo === 'none' ? undefined : `url(#${markerId}-${hTo})`}
      />
      {/* §7.2 포커스 표시. 다른 4종(공·콘·의자·메모)은 원/사각형으로 이미 focus-ind-*
       * 을 붙였는데 화살표만 빠져 있었다 — `.court-obj { outline:none }` 이 브라우저 기본
       * 포커스 링을 죽이므로 대체 링이 없으면 키보드 포커스가 전혀 안 보인다.
       * 경로형이라 같은 `d` 를 재사용해 화살표 자체를 감싸는 halo 로 그린다. */}
      <path className="focus-ind-outer" d={d} />
      <path className="focus-ind-inner" d={d} />
      {locked && (
        // 화살표는 선이라 덮개도 **선**이다 — 면으로 덮으면 굽은 화살표의 활 안쪽까지 칠해진다.
        // 다른 4종과 같이 **화살표보다 뒤에** 그린다(앞에 두면 몸통이 덮개를 가리고 가장자리
        // 후광만 남아 "잠긴 건지 아닌지" 가 애매해진다 — 기현 신고 2026-08-15).
        <path
          className="lock-tint"
          d={d}
          fill="none"
          stroke={LOCK_TINT_COLOR}
          strokeOpacity={LOCK_TINT_OPACITY}
          strokeWidth={style.width + 5}
          strokeLinecap="round"
          pointerEvents="none"
        />
      )}
    </g>
  );
});
