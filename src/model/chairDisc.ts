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
//  · 방향 눈금 하나가 +x(보는 쪽)에 붙는다 — 방향판·숫자키 1–9·주행 모드가 모두 "보는 쪽"을 쓴다.
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

/** 방향 눈금(작은 삼각형) 꼭짓점 — 원 둘레 +x 쪽에 붙고 바깥을 향한다. `r` 을 받는 이유는 썸네일처럼
 *  과장된 반지름으로도 같은 비율의 눈금을 그리기 위해서다(기본은 실제 원). 점 3개 `x,y x,y x,y`. */
export function discTickPoints(r: number = DISC_RADIUS_PX): string {
  const baseX = r - 0.1 * r;
  const tipX = r + 0.3 * r;
  const half = 0.26 * r;
  return `${baseX},${-half} ${tipX},0 ${baseX},${half}`;
}

/** 월드 점 p 가 중심 c 의 원 안인가 — `pad`(월드 px)만큼 부풀려서. 편집기 히트가 쓴다. */
export function inDisc(c: { x: number; y: number }, p: { x: number; y: number }, pad = 0): boolean {
  return Math.hypot(p.x - c.x, p.y - c.y) <= DISC_RADIUS_PX + pad;
}
