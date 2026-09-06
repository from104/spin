// 작도 도형 층 — 코트 **위**, 칩·화살표 **아래**(기현 지시 2026-08-14).
//
// ── ⚠️ 2026-09-06: 위 한 줄은 **기본값**으로 내려앉았다 ─────────────────────────────────
// 개체 표시 순서(z-order, `docs/PLAN-Z-ORDER.md` 결정 4)가 생기면서 도형도 사용자가 스텝마다
// 올리고 내릴 수 있는 7종 개체의 하나가 됐다. 2026-08-14 지시가 뒤집힌 것이 아니라 **아무도
// 순서를 손대지 않았을 때의 자리**로 산다(`model/zOrder.ts` 의 `DEFAULT_TIERS` 첫 칸이 곧
// 그 지시다 — 도형은 여전히 맨 아래에서 시작한다).
//
// 그래서 판(`ObjectLayer`)·시연·인쇄는 이 층 컴포넌트를 더 이상 쓰지 않는다: 도형이 콘과
// 화살표 사이에 한 장만 낄 수 있게 된 이상 "도형 층" 이라는 덩어리가 성립하지 않기 때문이다.
// 그 세 곳은 `objects/ShapeMark.tsx`(도형 한 장)를 순서 목록 안에서 부른다. 이 컴포넌트가
// 남아 있는 곳은 **썸네일**뿐이다 — 요약(`ThumbSpec`)에는 개체 id 가 없어 순서를 표현할 자리가
// 없고(그 한계는 `CourtThumbnail.tsx` 의 ⚠️ 참고), 거기서는 도형이 언제나 한 덩어리다.
//
// ── 이 파일이 하나인 이유 ────────────────────────────────────────────────────────────
// 도형은 네 곳에서 그려진다: 편집기(CourtStage) · 시연(PresentStage) · 인쇄(PrintCourt) ·
// 썸네일(CourtThumbnail). 네 곳이 각자 그리면 반투명 값이 어긋나는 날 **인쇄물만 진한** 판이
// 나오고, 그것은 코트에서야 알게 된다. 그래서 그리는 코드는 한 곳뿐이다 —
// ⚠️ 2026-09-06 부터 그 한 곳은 이 파일이 아니라 `objects/ShapeMark.tsx` 다(위 절 참고).
// 이 파일은 그것을 여러 번 부르는 껍데기이지 두 번째 그리기 코드가 아니다.
//
// ── "겹치면 진해진다" 를 지키는 것은 **없는 코드**다 ──────────────────────────────────
// 요구는 *"면은 연하게 반투명해야 하며 서로 겹치면 진해져야 함"* 이다. 알파 합성은 원래
// 그렇게 동작하므로 **아무것도 안 하면 저절로 된다.** 대신 다음 셋 중 하나라도 하면 깨진다:
//   ① 이 <g> 에 `opacity` 를 걸기 — 그룹이 먼저 합성돼 **한 겹으로 납작해진다.**
//   ② `mix-blend-mode` 를 걸기 — 겹침이 곱연산이 되어 색이 탁해진다.
//   ③ 도형들을 하나의 `<path>` 로 합치기 — 겹친 부분이 fill-rule 로 **뚫린다.**
// 셋 다 "정리" 처럼 보이는 변경이라 나중에 누가 손댈 자리다. ShapeLayer.test 가 ①을 직접 막고,
// 나머지 둘은 이 문단이 근거를 쥔다.
import { ShapeMark } from './objects/ShapeMark.tsx';
import type { Shape } from '../model/shape.ts';

export interface ShapeLayerProps {
  shapes?: readonly Shape[];
  /** 선택된 도형 id — 테두리를 액센트로 바꿔 "지금 이것" 을 말한다. 편집기만 넘긴다
   *  (시연·인쇄·썸네일에는 선택이라는 개념이 없다). */
  selected?: ReadonlySet<string>;
  /** 잠긴 도형 id — 보라 반투명 덮개를 얹는다(2026-08-14). */
  locked?: ReadonlySet<string>;
  /** 개체 포인터 배선. 없으면 도형은 그림일 뿐이라 클릭도 안 받는다. */
  onPointerDown?: (id: string, e: React.PointerEvent<SVGGElement>) => void;
  /** 테두리 굵기 배수 — 썸네일만 키운다. 근거는 `ShapeMark` 의 같은 prop 주석. */
  strokeScale?: number;
}

export function ShapeLayer({ shapes = [], selected, locked, onPointerDown, strokeScale = 1 }: ShapeLayerProps) {
  // ⚠️ 기본값이 필요하다. 도형 필드는 2026-08-14 에 생겼고, 그 전에 만들어진 스텝 객체(옛
  // 저장본·테스트 픽스처)에는 키가 아예 없다 — `shapes.length` 로 바로 읽으면 판이 통째로
  // 안 그려진다. 정화기(validate)가 언제나 배열을 만들어 주지만, 그 길을 안 지나는 객체가
  // 실재한다는 것을 여기서 한 번 더 받아 준다.
  if (shapes.length === 0) return null;
  return (
    // ⚠️ 이 <g> 에 `opacity` 를 걸지 마라(머리말 ①). 겹침이 통째로 사라진다.
    <g aria-hidden="true" data-shape-layer="">
      {shapes.map((s) => (
        <ShapeMark
          key={s.id}
          shape={s}
          selected={selected?.has(s.id) ?? false}
          locked={locked?.has(s.id) ?? false}
          onPointerDown={onPointerDown}
          strokeScale={strokeScale}
        />
      ))}
    </g>
  );
}
