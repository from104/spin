// §6.6 화살표 마커. 마커 id 는 SVG 루트마다 유일해야 한다 — 전역 고정 id(mkAmber 등)를 쓰면
// url(#id) 참조가 문서 순서상 첫 번째로 해석되어 목록 카드 다중 인스턴스에서 화살촉이
// 사라지거나 깜빡인다. 화살촉에도 검정 케이싱이 필수다 — #38bdf8 는 코트 대비 2.49:1 로
// WCAG 1.4.11 미달이고 검정(3.93:1)이 그것을 채운다. 다만 본선과 달리 **덧그린 층이 아니라
// 화살촉 자신의 테두리**로 얻는다.
//
// ── 왜 케이싱 마커가 아니라 테두리인가 (2026-08-16, 기현 신고) ──────────────────────────
// 본선처럼 케이싱 path 에도 같은 마커를 걸었더니 화살촉 뒤로 **큰 검은 삼각형**이 비어져
// 나왔다. 마커는 `markerUnits` 기본값이 `strokeWidth` 라 붙는 선의 굵기에 비례해 커지는데,
// 케이싱 선은 본선보다 굵어서(3.4 → 5.8) 같은 기하가 **1.7배**로 그려졌기 때문이다.
// 그래서 화살촉 하나에 `fill`(색) + `stroke`(검정)를 함께 준다.
//
// ── 굵기 축이 생겼다 (2026-09-03) ─────────────────────────────────────────────────────
// 자유 그리기 획은 굵기가 3단이고, 위의 "마커는 선 굵기에 비례한다" 가 그대로 걸린다.
// 그래서 (색 × **굵기** × 종류) 마다 마커를 만든다. 기하·id 는 손으로 적지 않고 전부
// `arrowHeadGeom.ts` 가 준다 — 화면과 PNG 가 같은 함수를 부르는 것이 이 파일의 계약이다.
// 기본 굵기(`ARROW_STYLE.width`)에서는 id·좌표가 옛 리터럴과 한 글자도 다르지 않으므로,
// 화살표만 쓰는 화면은 이번 변경 전후로 완전히 같은 마크업을 낸다.
import { ARROW_CASING } from '../core/colors.ts';
import { ARROW_STYLE } from '../model/arrow.ts';
import { ARROW_HEAD_KINDS, arrowHeadGeom, arrowMarkerId } from './arrowHeadGeom.ts';

export interface ArrowMarkersProps {
  /** 이 SVG 루트에서 유일해야 하는 접두사. `useId()` 결과를 그대로 넘긴다. */
  uid: string;
  /** 이 SVG 안에서 실제로 쓰인 색 집합만큼만 만든다(보통 1~2개). */
  colors: readonly string[];
  /** 이 SVG 안에서 획이 쓰는 **선 굵기**. 화살표 굵기는 여기 없어도 언제나 만들어지므로,
   *  획이 없는 화면은 아무것도 안 넘기면 된다. */
  widths?: readonly number[];
}

export function ArrowMarkers({ uid, colors, widths }: ArrowMarkersProps) {
  // 화살표 굵기를 **언제나** 앞에 둔다: 호출부가 "획이 쓴 굵기" 만 모아 넘겼는데 그 스텝의
  // 획이 전부 가는 굵기였다면, 같은 판의 화살표가 참조할 마커가 통째로 사라진다(그리고 SVG 는
  // 없는 마커를 조용히 무시하므로 화살촉만 소리 없이 실종된다). 중복은 Set 이 접는다.
  const ws = Array.from(new Set([ARROW_STYLE.width, ...(widths ?? [])]));
  return (
    <>
      {colors.flatMap((color) =>
        ws.flatMap((w) =>
          ARROW_HEAD_KINDS.map((k) => {
            const g = arrowHeadGeom(k, w);
            return (
              <marker
                key={arrowMarkerId(uid, color, k, w)}
                id={arrowMarkerId(uid, color, k, w)}
                markerWidth={g.markerWidth}
                markerHeight={g.markerHeight}
                refX={g.refX}
                refY={g.refY}
                // `orient="auto-start-reverse"` — 시작점 화살촉은 선을 **거슬러** 봐야 한다.
                // 마커를 시작·끝 각각 만들지 않고 이 속성 하나로 해결한다(SVG2, 전 브라우저 지원).
                orient="auto-start-reverse"
              >
                <path d={g.d} fill={color} stroke={ARROW_CASING} strokeWidth={g.casingWidth} strokeLinejoin="round" />
              </marker>
            );
          }),
        ),
      )}
    </>
  );
}
