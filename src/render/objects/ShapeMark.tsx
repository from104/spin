// 작도 도형 **하나**를 그린다 — `ShapeLayer.tsx` 에서 뽑아낸 것(2026-09-06, PLAN-Z-ORDER 결정 4).
//
// ── 왜 뽑아냈나 ──────────────────────────────────────────────────────────────────────
// 도형이 개체 표시 순서(z-order)의 대상이 되면서 **다른 개체 사이에 끼어 그려질 수** 있게
// 됐다. 그 전까지 도형은 언제나 한 덩어리로 개체 아래에 깔렸으므로 "층 컴포넌트" 하나면
// 충분했지만, 이제는 콘과 화살표 사이에 도형 하나만 놓이는 판이 성립한다 — 층으로는 표현할
// 수 없는 배치다. 그래서 **한 장 그리기**를 여기로 내리고, 층(`ShapeLayer`)은 이것을 여러 번
// 부르는 껍데기가 됐다.
//
// ⚠️ **그리는 코드는 여전히 여기 하나뿐이다.** 판·시연·인쇄·썸네일 네 곳이 이 컴포넌트를
// 부른다(PNG 만 문자열을 굽는 `shapesMarkup` 을 쓰고, 그 둘의 동일성은
// `features/export/courtLines.contract.test.ts` 가 잰다). 네 곳이 각자 그리면 반투명 값이
// 어긋나는 날 **인쇄물만 진한** 판이 나오고, 그것은 코트에서야 알게 된다.
//
// ⚠️ 겹치면 진해지는 성질(알파 합성)을 지키는 것은 **없는 코드**다 — 이 `<g>` 나 이것을 감싸는
// `<g>` 에 `opacity`·`mix-blend-mode` 를 걸거나 도형들을 한 `<path>` 로 합치면 깨진다.
// 근거 전문은 `ShapeLayer.tsx` 머리말에 그대로 있다.
import { SHAPE_CASING_PX, SHAPE_FILL_OPACITY, SHAPE_STROKE_PX, pointsAttr, shapeColor, shapeSize, triPointsOf } from '../../model/shape.ts';
import type { Shape } from '../../model/shape.ts';
import { LOCK_TINT_COLOR, LOCK_TINT_OPACITY } from '../../core/colors.ts';

/** 도형의 **면**(색·불투명도를 지는 요소)을 가리키는 표식. 한 장이 케이싱까지 두 겹이 되면서
 *  «그 도형의 색이 무엇인가» 를 묻는 자리(테스트·검수 스크립트)가 첫 요소를 집으면 검정이 나온다.
 *  PNG 쪽(`buildStaticSvg`)도 같은 표식을 단다 — 두 벌 대조가 속성까지 맞춰 보기 때문이다. */

/** 테두리 밑 케이싱 색. 화살표의 `ARROW_CASING` 과 같은 검정이고 같은 이유다 — 코트 초록 위에서
 *  어느 색이든 경계를 세우는 유일한 값이다(코트 대비 3.93:1). */
const CASING_COLOR = '#000000';

export interface ShapeMarkProps {
  shape: Shape;
  /** 선택됨 — 테두리를 액센트로 바꿔 "지금 이것" 을 말한다. 편집기만 켠다
   *  (시연·인쇄·썸네일에는 선택이라는 개념이 없다). */
  selected?: boolean;
  /** 잠김 — 보라 반투명 덮개를 얹는다(2026-08-14). 다른 개체와 **같은 표시**라야
   *  "이건 왜 안 움직이지" 를 매번 다시 배우지 않는다. */
  locked?: boolean;
  /** 개체 포인터 배선. 편집기만 넘긴다 — 없으면 도형은 그림일 뿐이라 클릭도 안 받는다. */
  onPointerDown?: (id: string, e: React.PointerEvent<SVGGElement>) => void;
  /** 키보드 초점이 여기 있는가(2026-09-14). 편집기만 켠다 — **시연·인쇄·썸네일·내보내기는
   *  이 prop 을 안 넘기므로 출력이 한 픽셀도 안 바뀐다**(골든 대조가 그것을 지킨다).
   *  다른 개체(휠체어·공·콘·메모)가 쓰는 초점 표시와 같은 2겹 규약이다. */
  active?: boolean;
  /** 테두리 굵기 배수. 기본 1(판·시연·인쇄). **썸네일만 키운다** — 축소해 그리는 곳에서
   *  `SHAPE_STROKE_PX` 2 는 카드에서 0.7 px 가 되어 테두리가 사실상 사라진다.
   *  ⚠️ 굵기만이다. 도형의 **크기는 사용자가 그린 구역 그 자체**라 배수를 곱하면 안 된다 —
   *  키운 구역은 없는 구역이고, 판은 없는 것을 가르치지 않는다. */
  strokeScale?: number;
}

export function ShapeMark({ shape: s, selected = false, locked = false, active = false, onPointerDown, strokeScale = 1 }: ShapeMarkProps) {
  const sw = SHAPE_STROKE_PX * strokeScale;
  const { w, h } = shapeSize(s);
  // 삼각형의 모양은 w/h 가 아니라 꼭짓점이 진다(2026-08-15 자유 삼각형). w/h 는 타원·
  // 사각형 전용이고, 삼각형에서는 크기 표시용 경계상자일 뿐이다.
  const tri = s.kind === 'triangle' ? pointsAttr(triPointsOf(s)) : '';
  // ⚠️ 2026-09-14 — 테두리가 **불투명**이 되고 그 밑에 검정 케이싱이 깔린다. 옛 식은
  //    `strokeOpacity = selected ? 1 : SHAPE_STROKE_OPACITY(0.55)` 였는데, 색이 생기면서 그
  //    값으로는 안 보이는 색이 나왔다(주황 1.26:1 — SHAPE_STROKE_OPACITY 주석의 실측표).
  const paint = selected ? 'var(--accent)' : shapeColor(s);
  // 케이싱도 굵기 배수를 탄다 — 썸네일에서 본체만 굵어지면 케이싱이 상대적으로 사라진다.
  const casing = sw + SHAPE_CASING_PX * strokeScale;
  return (
    <g
      className="court-shape"
      data-shape-id={s.id}
      transform={`translate(${s.x} ${s.y}) rotate(${s.rot})`}
      onPointerDown={onPointerDown ? (e) => onPointerDown(s.id, e) : undefined}
      style={onPointerDown ? { cursor: 'move' } : undefined}
    >
      {/* 케이싱 → 본체 두 겹. 케이싱은 **면을 칠하지 않는다**(fill=none) — 칠하면 α 0.13 의
          «겹칠수록 진해진다» 가 검정으로 덮여 죽는다. */}
      {s.kind === 'ellipse' && (
        <>
          <ellipse rx={w / 2} ry={h / 2} fill="none" stroke={CASING_COLOR} strokeWidth={casing} />
          <ellipse data-shape-face="" rx={w / 2} ry={h / 2} fill={shapeColor(s)} fillOpacity={SHAPE_FILL_OPACITY} stroke={paint} strokeWidth={sw} />
        </>
      )}
      {s.kind === 'rect' && (
        <>
          <rect x={-w / 2} y={-h / 2} width={w} height={h} fill="none" stroke={CASING_COLOR} strokeWidth={casing} />
          <rect data-shape-face="" x={-w / 2} y={-h / 2} width={w} height={h} fill={shapeColor(s)} fillOpacity={SHAPE_FILL_OPACITY} stroke={paint} strokeWidth={sw} />
        </>
      )}

      {/* 잠김 덮개 — 도형의 **모양 그대로** 덮는다. 상자로 덮으면 타원·삼각형 밖까지
          칠해져 "무엇이 잠겼는지" 가 흐려진다. 면 위에 얹으므로 도형 뒤에 온다. */}
      {s.kind === 'triangle' && (
        <>
          <polygon points={tri} fill="none" stroke={CASING_COLOR} strokeWidth={casing} strokeLinejoin="round" />
          <polygon
            data-shape-face=""
            points={tri}
            fill={shapeColor(s)}
            fillOpacity={SHAPE_FILL_OPACITY}
            stroke={paint}
            strokeWidth={sw}
            strokeLinejoin="round"
          />
        </>
      )}
      {/* 키보드 초점 표시(2026-09-14) — 다른 개체와 **같은 2겹 규약**이다. `active` 를 안 주는
          곳(시연·인쇄·썸네일·PNG)에서는 요소 자체가 안 나가므로 출력이 한 픽셀도 안 바뀐다.
          도형 경계에 맞춰 그리므로 회전 변환 **안쪽**에 있다 — 밖에 두면 돌린 도형에서 테두리가
          어긋난다. `court-obj:focus-visible` 이 색을 켠다(styles/contrast.css). */}
      {active && (
        <>
          <rect className="focus-ind-outer" x={-w / 2} y={-h / 2} width={w} height={h} fill="none" />
          <rect className="focus-ind-inner" x={-w / 2} y={-h / 2} width={w} height={h} fill="none" />
        </>
      )}
      {locked && s.kind === 'ellipse' && (
        <ellipse rx={w / 2} ry={h / 2} fill={LOCK_TINT_COLOR} fillOpacity={LOCK_TINT_OPACITY} pointerEvents="none" />
      )}
      {locked && s.kind === 'rect' && (
        <rect x={-w / 2} y={-h / 2} width={w} height={h} fill={LOCK_TINT_COLOR} fillOpacity={LOCK_TINT_OPACITY} pointerEvents="none" />
      )}
      {locked && s.kind === 'triangle' && (
        <polygon points={tri} fill={LOCK_TINT_COLOR} fillOpacity={LOCK_TINT_OPACITY} pointerEvents="none" />
      )}
    </g>
  );
}
