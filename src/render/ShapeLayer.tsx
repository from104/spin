// 작도 도형 층 — 코트 **위**, 칩·화살표 **아래**(기현 지시 2026-08-14).
//
// ── 이 파일이 하나인 이유 ────────────────────────────────────────────────────────────
// 도형은 네 곳에서 그려진다: 편집기(CourtStage) · 시연(PresentStage) · 인쇄(PrintCourt) ·
// 썸네일(CourtThumbnail). 네 곳이 각자 그리면 반투명 값이 어긋나는 날 **인쇄물만 진한** 판이
// 나오고, 그것은 코트에서야 알게 된다. 그래서 그리는 코드는 여기 하나뿐이다.
//
// ── "겹치면 진해진다" 를 지키는 것은 **없는 코드**다 ──────────────────────────────────
// 요구는 *"면은 연하게 반투명해야 하며 서로 겹치면 진해져야 함"* 이다. 알파 합성은 원래
// 그렇게 동작하므로 **아무것도 안 하면 저절로 된다.** 대신 다음 셋 중 하나라도 하면 깨진다:
//   ① 이 <g> 에 `opacity` 를 걸기 — 그룹이 먼저 합성돼 **한 겹으로 납작해진다.**
//   ② `mix-blend-mode` 를 걸기 — 겹침이 곱연산이 되어 색이 탁해진다.
//   ③ 도형들을 하나의 `<path>` 로 합치기 — 겹친 부분이 fill-rule 로 **뚫린다.**
// 셋 다 "정리" 처럼 보이는 변경이라 나중에 누가 손댈 자리다. ShapeLayer.test 가 ①을 직접 막고,
// 나머지 둘은 이 문단이 근거를 쥔다.
import { SHAPE_COLOR, SHAPE_FILL_OPACITY, SHAPE_STROKE_OPACITY, SHAPE_STROKE_PX, shapeSize, trianglePointsAttr } from '../model/shape.ts';
import type { Shape } from '../model/shape.ts';
import { LOCK_TINT_COLOR, LOCK_TINT_OPACITY } from '../core/colors.ts';

export interface ShapeLayerProps {
  shapes?: readonly Shape[];
  /** 선택된 도형 id — 테두리를 액센트로 바꿔 "지금 이것" 을 말한다. 편집기만 넘긴다
   *  (시연·인쇄·썸네일에는 선택이라는 개념이 없다). */
  selected?: ReadonlySet<string>;
  /** 잠긴 도형 id — 보라 반투명 덮개를 얹는다(2026-08-14). 다른 개체와 **같은 표시**라야
   *  "이건 왜 안 움직이지" 를 매번 다시 배우지 않는다. */
  locked?: ReadonlySet<string>;
  /** 개체 포인터 배선. 편집기만 넘긴다 — 없으면 도형은 그림일 뿐이라 클릭도 안 받는다. */
  onPointerDown?: (id: string, e: React.PointerEvent<SVGGElement>) => void;
}

export function ShapeLayer({ shapes = [], selected, locked, onPointerDown }: ShapeLayerProps) {
  // ⚠️ 기본값이 필요하다. 도형 필드는 2026-08-14 에 생겼고, 그 전에 만들어진 스텝 객체(옛
  // 저장본·테스트 픽스처)에는 키가 아예 없다 — `shapes.length` 로 바로 읽으면 판이 통째로
  // 안 그려진다. 정화기(validate)가 언제나 배열을 만들어 주지만, 그 길을 안 지나는 객체가
  // 실재한다는 것을 여기서 한 번 더 받아 준다.
  if (shapes.length === 0) return null;
  return (
    // ⚠️ 이 <g> 에 `opacity` 를 걸지 마라(머리말 ①). 겹침이 통째로 사라진다.
    <g aria-hidden="true" data-shape-layer="">
      {shapes.map((s) => {
        const { w, h } = shapeSize(s);
        const on = selected?.has(s.id) ?? false;
        const isLocked = locked?.has(s.id) ?? false;
        const stroke = on ? 'var(--accent)' : SHAPE_COLOR;
        const strokeOpacity = on ? 1 : SHAPE_STROKE_OPACITY;
        return (
          <g
            key={s.id}
            className="court-shape"
            data-shape-id={s.id}
            transform={`translate(${s.x} ${s.y}) rotate(${s.rot})`}
            onPointerDown={onPointerDown ? (e) => onPointerDown(s.id, e) : undefined}
            style={onPointerDown ? { cursor: 'move' } : undefined}
          >
            {s.kind === 'ellipse' && (
              <ellipse
                rx={w / 2}
                ry={h / 2}
                fill={SHAPE_COLOR}
                fillOpacity={SHAPE_FILL_OPACITY}
                stroke={stroke}
                strokeOpacity={strokeOpacity}
                strokeWidth={SHAPE_STROKE_PX}
              />
            )}
            {s.kind === 'rect' && (
              <rect
                x={-w / 2}
                y={-h / 2}
                width={w}
                height={h}
                fill={SHAPE_COLOR}
                fillOpacity={SHAPE_FILL_OPACITY}
                stroke={stroke}
                strokeOpacity={strokeOpacity}
                strokeWidth={SHAPE_STROKE_PX}
              />
            )}
            {/* 잠김 덮개 — 도형의 **모양 그대로** 덮는다. 상자로 덮으면 타원·삼각형 밖까지
                칠해져 "무엇이 잠겼는지" 가 흐려진다. 면 위에 얹으므로 도형 뒤에 온다. */}
            {s.kind === 'triangle' && (
              <polygon
                points={trianglePointsAttr(w)}
                fill={SHAPE_COLOR}
                fillOpacity={SHAPE_FILL_OPACITY}
                stroke={stroke}
                strokeOpacity={strokeOpacity}
                strokeWidth={SHAPE_STROKE_PX}
                strokeLinejoin="round"
              />
            )}
            {isLocked && s.kind === 'ellipse' && (
              <ellipse rx={w / 2} ry={h / 2} fill={LOCK_TINT_COLOR} fillOpacity={LOCK_TINT_OPACITY} pointerEvents="none" />
            )}
            {isLocked && s.kind === 'rect' && (
              <rect x={-w / 2} y={-h / 2} width={w} height={h} fill={LOCK_TINT_COLOR} fillOpacity={LOCK_TINT_OPACITY} pointerEvents="none" />
            )}
            {isLocked && s.kind === 'triangle' && (
              <polygon points={trianglePointsAttr(w)} fill={LOCK_TINT_COLOR} fillOpacity={LOCK_TINT_OPACITY} pointerEvents="none" />
            )}
          </g>
        );
      })}
    </g>
  );
}
