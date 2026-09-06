// §6.6 훈련 콘의 **모양**. React 가 없다 — path 문자열과 굵기뿐이다.
//
// 왜 파일이 따로 있나 (2026-09-06): 콘을 그리는 곳이 셋인데(편집·시연 `ConeMark.tsx`,
// 인쇄 `PrintCourt.tsx`, PNG `buildStaticSvg.ts`) **path 가 세 벌**이었다 — 둘은 리터럴,
// 하나만 `CONE` 상수 파생. 그래서 `CONE.viewHeightPx` 를 고치면 PNG 만 새 모양이 되고
// 판·종이는 옛 모양으로 남는 구조였다. AGENTS §3: *"치수를 리터럴로 적지 않는다."*
//
// 슬롯 0 = 채운 삼각형, 슬롯 1 = 삼각형 + 밑변 사각 베이스. 색이 아니라 **실루엣**으로
// 구분한다(흰 가로 띠는 iPad 배율에서 얼룩으로 사라진다 — ConeMark.tsx 머리말).
import { CONE } from '../../core/constants.ts';

/** 10×9 px 삼각형(§6.6)을 정수 좌표에 앉힌 모양이라 밑변이 원점보다 0.5 아래다. */
const HALF_W = CONE.viewWidthPx / 2; // 5
export const CONE_TRIANGLE_D = `M0,${-HALF_W} L${HALF_W},${CONE.viewHeightPx - HALF_W} L${-HALF_W},${CONE.viewHeightPx - HALF_W} Z`;
/** 슬롯 1 전용 밑변 사각 베이스. 삼각형 밑변(y=4)에 맞물리는 값이라 그대로 옮겨 적는다. */
export const CONE_BASE_D = 'M-6,4.5 H6 V6.5 H-6 Z';
export const CONE_STROKE_W = 1.6;
