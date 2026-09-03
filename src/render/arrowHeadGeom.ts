// §6.6 화살촉 마커의 **기하 단일 출처**. 화면(ArrowMarkers.tsx)·PNG(buildStaticSvg.ts) 두
// 구현이 같은 숫자를 찍게 하는 자리다.
//
// ── 왜 리터럴이 아니라 식이 되었나 (2026-09-03) ─────────────────────────────────────────
// 2026-08-16 에는 화살촉 좌표를 **리터럴**로 적어 두는 것이 옳았다. 붙는 선의 굵기가
// `ARROW_STYLE.width`(3.4) 하나뿐이라 상수 한 벌이면 충분했고, 두 구현이 같은 글자를 찍는지
// 대조하기도 쉬웠다(courtLines.contract.test).
//
// **자유 그리기 획이 그 전제를 깼다.** 획은 굵기가 3단(`STROKE_WIDTHS` 2.4 / 3.4 / 5.2)이고,
// SVG 마커는 `markerUnits` 기본값이 `strokeWidth` 라 **붙는 선의 굵기에 비례해 통째로 커진다.**
// 화살촉이 굵기를 따라 커지는 것은 원하는 바지만(굵은 선에 잔 화살촉은 안 맞다), 그 배율은
// 케이싱 테두리에도 똑같이 걸린다 — 리터럴 한 벌을 세 굵기에 돌려 쓰면
//   · 2.4 에서: 테두리가 0.85 px 로 얇아지고, 게다가 마커 뷰포트(0~w, 0~h)를 **넘어 잘린다**
//     (경계 여백 0.353 은 3.4 기준으로 잡은 값이라 2.4 에서는 필요한 0.5 에 못 미친다)
//   · 5.2 에서: 테두리가 1.85 px 로 굵어져 화살촉이 검게 무거워진다
// 셋 다 "검정 테두리 1.2 px" 이라는 원래 계약(아래 상수)에서 벗어난 값이다.
//
// 그래서 상수를 **굵기의 함수**로 바꾼다. 리터럴이 지키던 것(두 구현이 같은 글자를 찍는다)은
// 그대로다 — 오히려 더 강해졌다. 이제 두 구현이 같은 *함수*를 부르고, 대조 테스트는 계속
// 화면 컴포넌트와 문자열을 도형 단위로 비교한다.
//
// ⚠️ **기본 굵기(3.4)에서는 옛 리터럴과 한 글자도 다르지 않아야 한다.** 그래야 화살표의
//    마커 id·모양·PNG 바이트가 이번 변경으로 흔들리지 않는다. `arrowHeadGeom.test.ts` 가
//    옛 리터럴을 그대로 적어 두고 그 등식을 못박는다(식이 자기 자신을 베끼지 않게).
import { ARROW_STYLE } from '../model/arrow.ts';

export type ArrowHeadKind = 'thin' | 'wide';
export const ARROW_HEAD_KINDS = ['thin', 'wide'] as const;

/** 화살촉 케이싱의 **목표 두께(월드 px)**. 본선 케이싱(ArrowPath 의 `+2.4` = 양쪽 1.2)과 같은
 *  값이다 — 선과 촉의 검은 테가 다른 두께면 촉이 따로 붙인 조각으로 보인다. */
export const ARROW_HEAD_CASING_PX = 1.2;

/** 선 케이싱(검정 halo)이 **양쪽 합해** 더하는 두께. 굵기에 비례시키지 않는다:
 *
 *  케이싱이 하는 일은 대비 확보이고(#38bdf8 는 코트 대비 2.49:1 로 WCAG 1.4.11 미달, 검정을
 *  깔면 9.80:1), 그 일에 필요한 것은 "보이는 검은 테" 이지 "선에 비례한 검은 테" 가 아니다.
 *  더 결정적인 이유는 **촉과 짝이 맞아야 한다**는 것이다 — 촉의 케이싱은 위 상수대로 굵기와
 *  무관하게 1.2 px 이므로, 몸통만 비례로 두면 굵은 획에서 선의 검은 테가 촉의 것보다 눈에
 *  띄게 두꺼워져 촉이 따로 붙인 조각으로 보인다. 값은 2.4 — 화살표가 쓰던 `+2.4` 그 수다.
 *
 *  여기(순수 .ts)에 두는 이유: PNG 경로(features/export/buildStaticSvg.ts)가 이 값을 쓰는데,
 *  그쪽은 React 를 한 조각도 들이지 않는다는 것이 파일 계약이라 `.tsx` 에서 가져올 수 없다. */
export const STROKE_CASING_PAD = 2 * ARROW_HEAD_CASING_PX;

/** 촉 끝(코)의 x. 뷰포트 폭은 여기에 케이싱이 삐져나갈 여유를 더한 값이다. */
const NOSE_X = 6.5;
/** 마커가 선 끝에 앉는 기준점의 x(케이싱 여백 전). 촉 끝보다 1.5 안쪽이라 촉이 선 끝을
 *  조금 넘어선다 — 2026-08-16 이전부터 한 픽셀도 안 바뀐 자리다. */
const REF_X = 5;
/** 종류별 촉의 **반높이**. 넓은 쪽은 길이는 같고 폭만 키운다(3.2 → 5.5) — 길이를 함께 키우면
 *  촉이 선의 끝을 넘어 자라 보여 "선이 길어졌다" 로 읽힌다(ArrowMarkers 의 옛 주석). */
const HALF_H: Record<ArrowHeadKind, number> = { thin: 3.2, wide: 5.5 };

const round = (n: number, digits: number): number => {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
};

export interface ArrowHeadGeom {
  /** 마커 좌표계의 촉 path. */
  d: string;
  markerWidth: number;
  markerHeight: number;
  refX: number;
  refY: number;
  /** 마커 좌표계의 테두리 두께. 마커가 `lineWidth` 배율로 그려지므로 이 값 × lineWidth 가
   *  화면 두께이고, 그것이 `2 × ARROW_HEAD_CASING_PX` 가 되게 잡혀 있다(양쪽 절반씩). */
  casingWidth: number;
}

/** 굵기 `lineWidth` 인 선에 붙일 화살촉의 기하.
 *
 *  좌표가 전부 `pad`(= 케이싱 절반) 만큼 밀려 있는 것이 요점이다: `stroke` 는 경로 **바깥으로도**
 *  절반이 나가는데 마커 뷰포트는 (0,0)~(w,h) 밖을 잘라내므로, 밀어 두지 않으면 위·왼쪽 테두리가
 *  깎인다. `refX`·`refY` 도 같은 값만큼 옮겨 촉이 선 끝에 놓이는 자리는 그대로다. */
export function arrowHeadGeom(kind: ArrowHeadKind, lineWidth: number = ARROW_STYLE.width): ArrowHeadGeom {
  const half = HALF_H[kind];
  // 자릿수가 다른 것(좌표 3, 두께·뷰포트 2)은 옛 리터럴을 그대로 재현하기 위해서다 —
  // 내보내기의 `num()` 이 둘째 자리에서 반올림하므로 두께를 3자리로 두면 한쪽만 0.706 으로
  // 찍혀 대조가 깨진다(ArrowMarkers 의 옛 HEAD_CASING_W 주석이 겪은 그 사고).
  const pad = round(ARROW_HEAD_CASING_PX / lineWidth, 3);
  const casingWidth = round((2 * ARROW_HEAD_CASING_PX) / lineWidth, 2);
  return {
    d: `M${pad},${pad} L${round(NOSE_X + pad, 3)},${round(half + pad, 3)} L${pad},${round(2 * half + pad, 3)} z`,
    markerWidth: round(NOSE_X + casingWidth, 2),
    markerHeight: round(2 * half + casingWidth, 2),
    refX: round(REF_X + pad, 3),
    refY: round(half + pad, 3),
    casingWidth,
  };
}

/** 색을 marker id 조각으로 접는다. `#38bdf8` → `38bdf8`. 이름색(`#` 없음)은 그대로 둔다 —
 *  `slice(1)` 을 무조건 걸면 앞 글자를 먹어 화면과 PNG 의 id 가 갈린다(옛 `markerKey`). */
export const arrowMarkerColorKey = (color: string): string => (color.startsWith('#') ? color.slice(1) : color);

/** 굵기 조각. **기본 굵기면 빈 문자열이다** — 화살표가 쓰던 id 가 이번 변경으로 한 글자도
 *  안 바뀌고, 기본 굵기 획(첨자 1 = 3.4)은 화살표의 마커를 **그대로 함께 쓴다**(중복 정의 0).
 *  `.` 은 CSS 선택자에서 클래스 구분자라 id 에 넣지 않는다. */
export const arrowMarkerWidthKey = (lineWidth: number): string =>
  lineWidth === ARROW_STYLE.width ? '' : `-w${String(lineWidth).replace('.', '_')}`;

/** `<marker>` 의 id — 화면·PNG·인쇄가 **같은 함수**로 만든다. 갈리면 화살촉이 통째로 사라진다
 *  (url(#…) 이 없는 id 를 가리키면 SVG 는 조용히 마커를 안 그린다). */
export function arrowMarkerId(uid: string, color: string, kind: ArrowHeadKind, lineWidth: number = ARROW_STYLE.width): string {
  return `${uid}-${arrowMarkerColorKey(color)}${arrowMarkerWidthKey(lineWidth)}-${kind}`;
}
