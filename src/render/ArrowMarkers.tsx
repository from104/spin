// §6.6 화살표 마커. 마커 id 는 SVG 루트마다 유일해야 한다 — 전역 고정 id(mkAmber 등)를 쓰면
// url(#id) 참조가 문서 순서상 첫 번째로 해석되어 목록 카드 다중 인스턴스에서 화살촉이
// 사라지거나 깜빡인다. 화살촉에도 검정 케이싱이 필수다 — #38bdf8 는 코트 대비 2.49:1 로
// WCAG 1.4.11 미달이고 검정(3.93:1)이 그것을 채운다. 다만 본선과 달리 **덧그린 층이 아니라
// 화살촉 자신의 테두리**로 얻는다(아래 HEAD_CASING_W 머리말).
import { ARROW_CASING } from '../core/colors.ts';

export interface ArrowMarkersProps {
  /** 이 SVG 루트에서 유일해야 하는 접두사. `useId()` 결과를 그대로 넘긴다. */
  uid: string;
  /** 이 SVG 안에서 실제로 쓰인 색 집합만큼만 만든다(보통 1~2개). */
  colors: readonly string[];
}

/** 화살촉 둘 — **좁은**(2026-08-16 이전의 그 모양, 한 픽셀도 안 바꿨다)과 **넓은**.
 *
 *  넓은 쪽은 길이는 같고 폭만 키운다(6.4 → 11). 길이를 함께 키우면 화살촉이 선의 끝을 넘어
 *  자라 보여 "선이 길어졌다" 로 읽힌다 — 바꾸는 것은 **굵기의 인상**이지 길이가 아니다. */
const HEADS = {
  thin: { d: 'M0.353,0.353 L6.853,3.553 L0.353,6.753 z', w: 7.21, h: 7.11, refY: 3.553 },
  wide: { d: 'M0.353,0.353 L6.853,5.853 L0.353,11.353 z', w: 7.21, h: 11.71, refY: 5.853 },
} as const;

/** 화살촉 케이싱은 **테두리(stroke)** 다 — 별도 마커가 아니다(2026-08-16, 기현 신고).
 *
 *  ── 왜 케이싱 마커를 떼었는가 ────────────────────────────────────────────────────────
 *  본선처럼 케이싱 path 에도 같은 마커를 걸었더니 화살촉 뒤로 **큰 검은 삼각형**이 비어져
 *  나왔다. 마커는 `markerUnits` 기본값이 `strokeWidth` 라 붙는 선의 굵기에 비례해 커지는데,
 *  케이싱 선은 본선보다 굵어서(3.4 → 5.8) 같은 기하가 **1.7배**로 그려졌기 때문이다.
 *  얇은 후광을 의도한 자리에 1.7배 덩어리가 앉은 것이라, 대비를 얻자고 모양을 잃었다.
 *
 *  그래서 화살촉 하나에 `fill`(색) + `stroke`(검정)를 함께 준다. 테두리 두께는 본선 케이싱과
 *  **같은 1.2px** 이 되도록 마커 좌표계로 환산한다 — 마커가 본선 굵기 배율로 그려지므로
 *  `2 × 1.2 / ARROW_STYLE.width`. 위 HEADS 좌표가 0.353(=1.2/3.4)씩 밀려 있는 것도 같은
 *  이유다: stroke 는 경로 **바깥으로도** 절반이 나가는데, 마커 뷰포트는 (0,0)~(w,h) 밖을
 *  잘라내므로 밀어 두지 않으면 위쪽·왼쪽 테두리가 깎인다. refX·refY 도 같은 값만큼 옮겨
 *  화살촉이 선 끝에 놓이는 자리는 그대로다.
 *
 *  값은 `2 × 1.2 / ARROW_STYLE.width` 를 **소수 둘째 자리**로 끊은 것이다(0.71 × 3.4 / 2 =
 *  1.207px). 식이 아니라 리터럴인 이유는 HEADS 좌표와 같다 — 내보내기(buildStaticSvg)가
 *  같은 수를 문자열로 찍고 courtLines.contract 가 두 구현을 글자 단위로 대조한다. 자릿수까지
 *  맞춘 것도 그래서다: 내보내기의 `num()` 이 둘째 자리에서 반올림하므로 0.706 으로 두면
 *  한쪽만 0.71 로 찍혀 계약이 깨진다(실제로 겪었다). */
const HEAD_CASING_W = 0.71;

/** `orient="auto-start-reverse"` — 시작점 화살촉은 선을 **거슬러** 봐야 한다.
 *  마커를 시작·끝 각각 만들지 않고 이 속성 하나로 해결한다(SVG2, 전 브라우저 지원). */
export function ArrowMarkers({ uid, colors }: ArrowMarkersProps) {
  const kinds = ['thin', 'wide'] as const;
  return (
    <>
      {colors.flatMap((color) =>
        kinds.map((k) => (
          <marker
            key={`${color}-${k}`}
            id={`${uid}-${color.slice(1)}-${k}`}
            markerWidth={HEADS[k].w}
            markerHeight={HEADS[k].h}
            refX={5.353}
            refY={HEADS[k].refY}
            orient="auto-start-reverse"
          >
            <path
              d={HEADS[k].d}
              fill={color}
              stroke={ARROW_CASING}
              strokeWidth={HEAD_CASING_W}
              strokeLinejoin="round"
            />
          </marker>
        )),
      )}
    </>
  );
}
