// §3.5 자유 그리기 획의 렌더러. **`ArrowPath` 의 쌍둥이다** — 케이싱·선택 halo·포커스 링·
// 잠김 덮개의 층 구조가 한 층도 다르지 않다. 다른 것은 셋뿐이다:
//   ① `d` 를 `arrowPath` 가 아니라 `strokePath`(N점 Catmull-Rom)가 만든다
//   ② 선 굵기가 상수가 아니라 `strokeWidthOf(s)`(3단)이다 — 파생값이 전부 이 수를 따라간다
//   ③ 화살촉 기본값이 `none/none` 이다(획은 선이 기본, 촉은 사용자가 켠다 — PLAN 결정 5)
//
// 편집·시연 **공용**이다(ArrowPath 와 같은 규약): `writer` 를 넘기면 스텝 전환 트윈이 `d` 를
// 직접 쓰고, 안 넘기면 React 재렌더 경로다.
import { memo, useLayoutEffect, useRef } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import { ARROW_CASING, LOCK_TINT_COLOR, LOCK_TINT_OPACITY } from '../../core/colors.ts';
import type { StrokeId } from '../../core/ids.ts';
import type { ArrowHead } from '../../model/arrow.ts';
import type { Stroke } from '../../model/stroke.ts';
import { strokeColor, strokeHeadFrom, strokeHeadTo, strokePath, strokeWidthOf } from '../../model/stroke.ts';
import { STROKE_CASING_PAD, arrowMarkerId } from '../arrowHeadGeom.ts';
import type { TransformWriter } from '../transformWriter.ts';
import { translate } from '../../i18n/useT.ts';
import type { Locale } from '../../i18n/locale.ts';
import { useLocale } from '../../i18n/useLocale.ts';

export interface StrokePathProps {
  stroke: Stroke;
  /** ArrowMarkers 가 이 SVG 루트에 만든 `useId()` 접두사. 마커 id 는 (접두 · 색 · **굵기** ·
   *  종류)로 조립한다 — 조립은 `arrowMarkerId` 하나가 한다(arrowHeadGeom.ts). */
  markerUid: string;
  /** 편집기(§6.7/3.10 스텝 전환 트윈)만 넘긴다. 시연·인쇄·썸네일은 React 재렌더 경로다. */
  writer?: TransformWriter;
  selected: boolean;
  locked?: boolean;
  active: boolean;
  onPointerDown?: (id: StrokeId, e: ReactPointerEvent<SVGGElement>) => void;
  onKeyDown?: (id: StrokeId, e: ReactKeyboardEvent<SVGGElement>) => void;
}

/** 접근성 이름 — **화살표와 같은 낱말을 쓴다.**
 *
 *  `arrow.label.*` 사전이 이미 "선 / 화살표 선 / 양쪽 넓은 화살표 선" 이라 말하고 있고(그 낱말
 *  들에 '화살표 개체' 라는 뜻은 없다), 획과 화살표는 화살촉 어휘를 **정말로 공유한다**
 *  (`cycleHead` 하나가 둘의 순환을 쥔다). 여기에 따로 사전 항목을 세우면 같은 촉이 개체마다
 *  다른 이름으로 읽힌다 — 스크린리더 사용자에게 그것은 없는 구분을 가르치는 일이다. */
export function strokeLabel(s: Pick<Stroke, 'headFrom' | 'headTo'>, locale: Locale): string {
  const f = strokeHeadFrom(s);
  const t = strokeHeadTo(s);
  const name = (h: ArrowHead): string => translate(locale, h === 'wide' ? 'arrow.label.wideName' : 'arrow.label.thinName');
  if (f === 'none' && t === 'none') return translate(locale, 'arrow.label.plain');
  if (f !== 'none' && t !== 'none') return translate(locale, 'arrow.label.bothTemplate', { name: name(t) });
  return translate(locale, 'arrow.label.oneTemplate', { name: name(f === 'none' ? t : f) });
}

/** 선택 halo 의 두께 여유 — 화살표와 같은 +6, 같은 강조색·같은 불투명도. 획만 다른 두께로
 *  두면 "선택된 선" 이 개체마다 다르게 보인다. */
const SELECT_HALO_PAD = 6;
/** 잠김 덮개의 두께 여유 — 화살표와 같은 +5. */
const LOCK_PAD = 5;

export const StrokePath = memo(function StrokePath({ stroke, markerUid, writer, selected, locked = false, active, onPointerDown, onKeyDown }: StrokePathProps) {
  const gRef = useRef<SVGGElement | null>(null);
  const locale = useLocale();
  // deps 에 stroke **객체**가 들어 있는 이유는 ArrowPath 와 같다 — React 가 d 를 다시 렌더할
  // 때마다 registerStroke 가 돌아 writer 의 마지막 프레임 d 를 재생한다. 점 수를 함께 넘기는
  // 것이 스냅 정책의 전부다(transformWriter.registerStroke 머리말).
  useLayoutEffect(() => {
    if (!writer) return;
    writer.registerStroke(stroke.id, gRef.current, stroke.points.length);
    return () => writer.registerStroke(stroke.id, null);
  }, [writer, stroke]);

  const d = strokePath(stroke);
  const width = strokeWidthOf(stroke);
  const color = strokeColor(stroke);
  const hFrom = strokeHeadFrom(stroke);
  const hTo = strokeHeadTo(stroke);

  return (
    <g
      ref={gRef}
      id={`obj-${stroke.id}`}
      className="court-obj"
      role="button"
      aria-label={strokeLabel(stroke, locale)}
      aria-pressed={selected}
      tabIndex={active ? 0 : -1}
      onPointerDown={(e) => onPointerDown?.(stroke.id, e)}
      style={onPointerDown ? { cursor: 'move' } : undefined}
      onKeyDown={(e) => onKeyDown?.(stroke.id, e)}
    >
      {selected && <path d={d} fill="none" stroke="var(--accent)" strokeWidth={width + SELECT_HALO_PAD} strokeLinecap="round" strokeLinejoin="round" opacity={0.45} />}
      {/* 케이싱은 **선에만** 건다 — 여기에 마커까지 달면 케이싱 굵기에 비례해 촉이 커져
          화살촉 뒤로 검은 삼각형이 비어져 나온다(ArrowPath 가 겪은 그대로). */}
      <path d={d} fill="none" stroke={ARROW_CASING} strokeWidth={width + STROKE_CASING_PAD} strokeLinecap="round" strokeLinejoin="round" />
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={width}
        strokeLinecap="round"
        strokeLinejoin="round"
        markerStart={hFrom === 'none' ? undefined : `url(#${arrowMarkerId(markerUid, color, hFrom, width)})`}
        markerEnd={hTo === 'none' ? undefined : `url(#${arrowMarkerId(markerUid, color, hTo, width)})`}
      />
      {/* §7.2 포커스 표시 — `.court-obj { outline:none }` 이 브라우저 기본 링을 죽이므로
          경로형 개체는 같은 `d` 를 재사용해 자기 자신을 감싸는 halo 로 그린다. */}
      <path className="focus-ind-outer" d={d} />
      <path className="focus-ind-inner" d={d} />
      {locked && (
        // 화살표와 같이 **면이 아니라 선**으로 덮는다(면으로 덮으면 굽은 획의 안쪽까지 칠해진다).
        <path
          className="lock-tint"
          d={d}
          fill="none"
          stroke={LOCK_TINT_COLOR}
          strokeOpacity={LOCK_TINT_OPACITY}
          strokeWidth={width + LOCK_PAD}
          strokeLinecap="round"
          strokeLinejoin="round"
          pointerEvents="none"
        />
      )}
    </g>
  );
});
