// 심플 모드의 휠체어 = 원 하나의 기하 — 모든 그림·판정 경로가 여기서만 읽는다.
// 정본 계획서: docs/PLAN-SIMPLE-DRIVE.md 결정 A3·A4·A5 (2026-11-16 기현 지시: *"심플 모드는 표시만
// 원으로. 원천적으로 물리 상호작용 없음"*).
//
// ⚠️ 이 파일이 있는 이유: 휠체어를 그리는 갈래가 일곱(편집 칩 · 시연 · 트레이 칩 · 트레이 고스트 ·
// PNG/영상 · 인쇄 · 선택/잠금 테두리)이고 판정이 하나다. 원을 갈래마다 따로 적으면 반드시 한쪽이
// 어긋난다(트레이 고스트 사고 72a6a12 와 같은 교훈). 지름·번호 글자·방향 눈금·테두리 여백·히트
// 반지름은 **여기만** 적고, 부르는 쪽은 `import` 만 한다.
//
// 기하의 약속:
//  · 원의 중심은 **피벗(원점)** 이다 — 자세(x, y, angleDeg)의 x, y 가 곧 중심이라, 돌려도 원이
//    제자리에서 돈다(차체처럼 피벗을 축으로 궤도를 그리지 않는다). 모델(드릴 데이터)은 그대로다.
//  · 지름 1.0 m(= 25 px) — 실물 차체 1.3 × 0.8 m 사이 값이라 포메이션 간격이 실물 판과 비슷하게 읽힌다.
//  · 방향 표시는 +x(보는 쪽) 앞쪽 원 안에 **플라나리아 눈 둘**(검은 작은 원)이다(2026-11-19 기현님: *"플라나리아 … 눈처럼 검은 작은
//    원으로"* — 삼각 눈금 하나 → 튀어나온 개구리 눈 둘(11-18) → 이것). 방향판·숫자키 1–9·조정 모드가 모두 "보는 쪽"을 쓴다.
//  · 규칙 화면 도해는 늘 실물 차체다(규칙 설명이 차체 크기에 걸려 있다) — 이 모듈을 쓰지 않는다.
import { mToPx } from '../core/units.ts';

/** 원 지름(m). 값의 정본. */
export const DISC_DIAMETER_M = 1.0;
/** 원 반지름(월드 px). */
export const DISC_RADIUS_PX = mToPx(DISC_DIAMETER_M) / 2;
/** 등번호·골키퍼 'G' 글자 크기 — 차체 칩(ChairChip LABEL_FONT_PX)과 같은 유도식(원래 20 × 2/3). */
export const DISC_LABEL_FONT_PX = (20 * 2) / 3;
/** 선택 링 여백(월드 px). 차체 칩의 SEL_PAD 와 같은 값이다. */
export const DISC_SEL_PAD = 3.5;
/** 키보드 포커스 링 여백. 차체 칩은 3 이다. */
export const DISC_FOCUS_PAD = 3;

/** 방향 표시 — 플라나리아 눈 둘. 원 안 앞쪽(+x) ±EYE_ANGLE 에 **검은 작은 원**이 둘, 둘레를 흰 테가 감싼다(플라나리아의 눈점처럼 —
 *  흰 테는 어두운 팀 색 위에서도 점이 보이게). `r` 을 받는 이유는 썸네일처럼 과장된 반지름으로도 같은 비율로 그리기 위해서다.
 *  번호는 원 가운데라 눈은 둘레 쪽(0.72 r)에 둔다. */
export interface DiscEye {
  cx: number;
  cy: number;
  r: number;
}
/** 눈 채움·테 색과 테 굵기(월드 px) — 다섯 갈래가 같은 값을 쓴다. */
export const DISC_EYE_FILL = '#000';
export const DISC_EYE_RIM = '#fff';
export const DISC_EYE_RIM_W = 0.8;
const EYE_ANGLE = (34 * Math.PI) / 180;
export function discEyes(r: number = DISC_RADIUS_PX): readonly [DiscEye, DiscEye] {
  const d = 0.72 * r;
  const eye = (sign: 1 | -1): DiscEye => ({ cx: d * Math.cos(EYE_ANGLE), cy: sign * d * Math.sin(EYE_ANGLE), r: 0.13 * r });
  return [eye(-1), eye(1)];
}

/** 월드 점 p 가 중심 c 의 원 안인가 — `pad`(월드 px)만큼 부풀려서. 편집기 히트가 쓴다. */
export function inDisc(c: { x: number; y: number }, p: { x: number; y: number }, pad = 0): boolean {
  return Math.hypot(p.x - c.x, p.y - c.y) <= DISC_RADIUS_PX + pad;
}
