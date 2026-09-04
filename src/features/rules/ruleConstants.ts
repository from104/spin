// 규칙 화면 도해가 파생하는 **규정** 수치(2026-09-03).
//
// 왜 core/constants.ts 가 아닌가: 그쪽은 시뮬레이터가 계산에 쓰는 **물리** 상수(공 지름·차체
// 치수·코트 기하)다. 여기 값들(출전 인원·등급 상한·경기 시간·물림 초)은 판 위의 물리와 무관한
// 규정이라, 섞어 두면 시뮬레이터가 안 쓰는 값이 물리 상수 옆에 앉아 "이것도 계산에 들어가나"를
// 헷갈리게 한다. 도해는 이 값에서 칸 수·막대 폭·눈금 수를 **파생**한다 — 컴포넌트에 4·20·5 를
// 직접 적지 않는다(치수 하드코딩 금지 규율, BallFigure 의 SOCCER5_CM 관례와 같다).
//
// 값마다 정본 줄을 적는다. 정본(docs/RULES-FIPFA-2025.md)이 바뀌면 여기가 먼저 바뀌어야 하고,
// 산문(ruleTopics.ts)은 문자열 리터럴이라 따로 고쳐야 한다 — 어긋나면 리뷰에서 잡는다.
export const LAW = {
  /** 한 팀 코트 위 최대 인원(그중 1명 골키퍼). docs/RULES-FIPFA-2025.md:89 (Law 3) */
  teamMaxOnCourt: 4,
  /** 한 경기에 출전시킬 수 있는 PF2 최대 — FIPFA 공인 대회 기준. docs/RULES-FIPFA-2025.md:346 (Law 18) */
  pf2MaxOnCourt: 2,
  /** 전·후반 각 길이(분). 양 팀과 심판이 합의하면 바꿀 수 있는 기본값. docs/RULES-FIPFA-2025.md:136 (Law 7) */
  halfMin: 20,
  /** 하프타임 최대(분). docs/RULES-FIPFA-2025.md:137 (Law 7) */
  halftimeMaxMin: 10,
  /** 액티브 플레이 중인 상대 둘 이상 사이에 공이 물린 채 이 초를 넘기면 아웃오브플레이. docs/RULES-FIPFA-2025.md:166 (Law 9) */
  stuckBallSec: 5,
  /** 공이 바닥에서 이 높이 이상 떠서 골라인을 넘으면 득점 무효(Law 10 :180). 같은 높이가 Law 9 :168 에도 있으나
   *  거기서는 '주심이 보기에 위험'해야 아웃이다 — 도해(goal-height)는 Law 10 만 그린다. 20in = 0.508m. */
  liftedBallM: 0.508,
  /** 골포스트 실물 — 코트 라인 굵기의 파이프, 높이 1.5m, 바닥에서 0.5m 에 표시. Laws 본문이 아니라 현장 규격
   *  (2026-09-03 기현님, docs/RULES-FIPFA-2025.md Law 1 ⬆ 항목). 0.5m 표시는 liftedBallM 판정의 눈금이다. */
  goalPostHeightM: 1.5,
  goalPostMarkM: 0.5,
} as const;

/** 규칙 계보 도해(카드 1 `lineage`)의 시점들. 연도는 text.ts 에 적지 않고 여기서 포맷한다. */
export const LINEAGE = {
  /** 2005 년 병합 대상이던 네 변종. 순서는 정본의 나열 순 — 도해의 세로 위치는 컴포넌트(BRANCH_Y)가 정한다(템플릿이 된 영국식을 몸통 높이에 둔다). docs/research/powerchair-football/uspsa-history.md:48 */
  variants: ['fr', 'ca-us', 'jp', 'en'],
  /** 포르투갈 코임브라 — 영국 규칙을 국제 표준으로 만장일치 채택. docs/research/powerchair-football/README.md:58 · england-wfa.md:12-14 */
  coimbra: { y: 2005, m: 10 },
  /** 미국 애틀랜타 — 규칙 확정, FIPFA 로 개명. docs/research/powerchair-football/README.md:59 */
  fipfa: { y: 2006, m: 7 },
  /** 이 화면의 정본 판. docs/RULES-FIPFA-2025.md:4 */
  edition: { y: 2025, m: 4 },
} as const;

export type LineageVariant = (typeof LINEAGE.variants)[number];
