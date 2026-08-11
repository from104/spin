// §2.5 — 문서 값을 그대로 옮긴 것. 재계산·반올림 금지.
// 주의(계약서와 다른 점): 문서 코드블록은 `import { PX_PER_M, pxPerSToMatterV } from './units.ts'`
// 를 포함하지만 블록 안 어디서도 쓰지 않아 noUnusedLocals(tsconfig.app.json) 에서 TS6133 로 실패한다.
// 값은 전부 리터럴로 그대로 옮기고, 쓰이지 않는 이 import 만 제거했다.

export const CHAIR = {
  lengthM: 1.5,
  lengthPx: 37.5,
  widthM: 1.0,
  widthPx: 25,
  guardM: 0.225,
  guardPx: 5.625,
  sPivot: 0.2,
  pivotToRearPx: 7.5,
  pivotToFrontPx: 30,
  centroidOffsetPx: 11.25,
  hullRadiusPx: 32.5,
  rearCornerPx: 14.57738,
  trackM: 0.65,
  /** 문서값(사람 포함 120~150 kg). 예전에는 "matter body 에 절대 설정 금지" 였다 — static
   *  body 에 setMass 를 부르면 inertia 가 NaN 이 되기 때문이다(실측). 2026-08-10 'push' 모드
   *  도입으로 휠체어가 dynamic 이 되면서 그 제약이 풀렸고, 아래 massKg 가 실제로 적용된다. */
  massKgDoc: 150,
  /** 실제 바디 질량. 120~150 의 중간값. 골대(80)보다 무겁고 공(1.3)·콘(0.3)보다 훨씬 무겁다 —
   *  이 순서가 곧 "무엇이 얼마나 밀리느냐" 의 위계다(§5.4). */
  massKg: 135,
  /** dynamic 이 되면서 필요해진 감쇠. 이게 없으면 한 번 밀린 휠체어가 **영원히 미끄러진다**
   *  (중력도, 구름 감속도 없는 평면 시뮬레이션이다). 값이 큰 이유는 실물 파워체어가
   *  구동륜 저항 때문에 밀린 뒤 곧 서기 때문 — "묵직하게 밀린다" 의 절반은 이 감쇠다. */
  frictionAir: 0.35,
  restitution: 0.1,
  friction: 0.15,
  frictionStatic: 0.5,
} as const;

export const BALL = {
  diameterM: 0.33,
  radiusM: 0.165,
  radiusPx: 4.125, // 물리 반지름 (FIPFA 33 cm)
  viewRadiusPx: 7, // 시각 반지름 (프로토타입). 차이 2.875 px = 0.115 m — 의도된 괴리
  polySides: 16,
  polyRadiusPx: 4.1650148,
  inradiusPx: 4.0849852,
  massKg: 1.3, // FIPFA 실물
  restitution: 0.45,
  friction: 0.02,
  frictionStatic: 0.05,
  /** ⚠️ 공의 감속은 **구름저항이 주역이고 공기저항은 조역**이다(2026-08-10 기현 지시로 재조정).
   *  예전 값(fA 0.012 / roll 25)은 반대였다 — fA 0.012 는 120 Hz 에서 0.5 초마다 속도를
   *  반감시키는 지수 감쇠라, 강슛(8 m/s)이 30 m 코트의 1/4 인 7.4 m 에서 죽었다.
   *  실측표(정지시간 / 이동거리):
   *    fA 0.012·roll 25 → 2.58 s / 7.4 m   (옛값. 너무 끈적하다)
   *    fA 0.004·roll 12 → 6.55 s / 19.9 m  ← 채택
   *    fA 0.002·roll  8 → 8.70 s / 31.1 m  (코트를 넘어 벽을 계속 때린다)
   *  roll 25 는 체육관 바닥 기준으로도 과했다: 25 px/s² = 1.0 m/s² = μ_r 0.10 인데
   *  공기주입식 공의 실제 구름저항은 μ_r 0.01~0.03(=0.1~0.3 m/s²)이다. */
  frictionAir: 0.004,
  rollDecelPxPerS2: 12, // 쿨롱 구름 감속 (§5.9)
  maxSpeedPxPerS: 420, // = 16.8 m/s
  maxSpeedMatter: 7.0, // = 420/60. setVelocity/getSpeed 에 쓰는 값
  maxCount: 10,
} as const;

export const CONE = {
  baseDiameterM: 0.25,
  radiusPx: 3.125,
  polySides: 12,
  polyRadiusPx: 3.17916369,
  inradiusPx: 3.07083631,
  viewWidthPx: 10,
  viewHeightPx: 9,
  massKg: 0.3, // 실물 콘
  restitution: 0.05,
  friction: 0.4,
  frictionStatic: 0.6,
  frictionAir: 0.065,
  rollDecelPxPerS2: 25,
  maxSpeedPxPerS: 240,
  maxSpeedMatter: 4.0,
} as const;

/** 골대 포스트(§5.4 무게 위계, 2026-08-10 기현 지시).
 *
 *  **실제 코트에서 골대는 고정돼 있지 않다.** 휠체어가 부딪히면 밀리도록 만들어져 있는데,
 *  안 밀리면 안전 사고가 나기 때문이다. 그래서 여기서도 static 이 아니다 —
 *  휠체어(120~150 kg)에는 밀리고 공(1.3 kg)에는 밀리지 않는 질량을 고른다.
 *
 *  ⚠️ `massKg` 는 "그럴듯한 실물값" 이 아니라 **위 두 요구를 동시에 만족시키려고 고른 값**이다.
 *  숫자만 보고 바꾸지 말 것 — world.test.ts 의 두 거동 테스트(공에 안 밀림 / 휠체어에 밀림)가
 *  이 값을 양쪽에서 붙잡고 있다.
 *
 *  사용자가 임의로 옮길 수는 없다(드래그 대상이 아니다). 오직 휠체어에 밀려서만 움직이고,
 *  `골대 원위치` 버튼으로 되돌린다. */
export const GOAL = {
  /** 물리 반지름. 렌더의 spot 표시(r≈4)보다 약간 크게 잡아 휠체어가 파고들지 않게 한다. */
  radiusPx: 5,
  polySides: 12,
  massKg: 80,
  restitution: 0.02,
  /** 바닥 마찰이 커서 공에 맞아도 제자리를 지킨다. 휠체어의 지속적인 힘에는 밀린다. */
  friction: 0.7,
  frictionStatic: 0.95,
  frictionAir: 0.25,
  /** 원위치 복귀 구동 속도·상한. 벽에 낀 휠체어 때문에 영원히 미는 상태에 갇히지 않게
   *  상한을 넘으면 정확한 좌표로 스냅한다(남은 겹침은 escapePinned 가 받는다). */
  returnPxPerS: 260,
  returnMaxMs: 500,
} as const;

export const WALL = {
  thicknessPx: 40,
  restitution: 0.1,
  friction: 0.6,
  frictionStatic: 0.8,
} as const;

/** 물리 루프 상수. dtMs 를 바꾸면 §5.7 마찰 튜닝값을 전부 재조정해야 한다
 *  (Resolver 의 접선 마찰은 timeScale³ 에 비례하고 _restingThreshTangent 는 스케일되지 않는다). */
export const PHYS = {
  dtMs: 1000 / 120, // 8.3333333
  dtS: 1 / 120,
  maxSubsteps: 6,
  accClampMs: 50, // = 6 × 8.3333
  /** 드래그가 끝난 뒤 물리 루프를 유지하는 상한. 공이 더 잘 구르게 바꾸면서(§5.9 재조정)
   *  강슛의 정지 시간이 2.58 → 6.55 초가 됐다 — 4 초로 두면 **굴러가는 도중에 루프가 끊겨**
   *  공이 허공에서 멎는다. 조기 종료(정지 감지)가 여전히 먼저 발동한다는 D32 의 취지는 유지된다. */
  settleMaxMs: 8000,
  /** 단위: px per 16.667 ms (Body.getSpeed 와 같은 단위). 0.03 = 1.8 px/s = 7.2 cm/s */
  restSpeedMatter: 0.03,
  positionIterations: 6,
  velocityIterations: 4,
  constraintIterations: 2,
  /** matter Resolver._restingThresh. 이 값 미만의 접근속도에는 restitution 이 적용되지 않는다.
   *  2.0 matter units = 120 px/s = 4.8 m/s (dt 무관, 실측 확인). */
  restingThreshMatter: 2.0,
  lowSpeedBounceMinMatter: 0.15, // 이 아래는 정착을 위해 반발시키지 않음 (= 9 px/s)
} as const;

export const DEFAULT_LIMITS = {
  linearKmh: 10, // vLin = 69.4444444 px/s = 0.5787037 px/substep
  bumperKmh: 30, // ω = 6.9444444 rad/s = 397.887358 °/s = 3.31573 °/substep
  linearKmhRange: [4, 16] as const,
  bumperKmhRange: [10, 36] as const,
} as const;

/** 휠체어 드래그 존 경계. s∈[0,1] 이 **차체 그 자체**다(s=0 뒤끝, s=1 앞범퍼).
 *
 * 2026-08-11 기현 지시로 차체를 둘로만 나눈다. 처음엔 1/3 : 2/3 이었고, 같은 날 후속 지시로
 * **반씩**으로 옮겼다:
 *   · 뒤 1/2 (s ≤ 1/2, 로컬 x ≤ 11.25) → **그대로 이동**
 *   · 앞 1/2 (s > 1/2)                → **제자리 회전**
 * 견인(towRear·towFront)은 차체 **밖** 가이드 핸들에만 남긴다 — 경계를 0 과 1 에 두면
 * 차체 안에서는 절대 견인으로 잡히지 않고, 앞뒤로 뻗은 가이드를 잡아야만 견인이 된다.
 * 예전 값(0.12 / 0.32 / 0.85)은 차체를 네 토막으로 잘라, 등번호 근처를 잡아도 견인이
 * 걸리는 일이 있었다. */
export const DEFAULT_ZONES = {
  sTowRearMax: 0, // s ≤ 0            → towRear  (차체 뒤끝 **밖** = 후방 가이드)
  sSpinMin: 1 / 2, // 0 < s ≤ 1/2      → translate (뒤 절반 = 그대로 이동)
  // 1/2 < s < 1      → spin      (앞 절반 = 제자리 회전)
  sTowFrontMin: 1, // s ≥ 1            → towFront (앞범퍼 **밖** = 전방 가이드)
  grabPadPx: 10, // 히트영역 팽창 (축 앞뒤 + 측방), 0.4 m
} as const;

/** spin 게인 감쇠 반경. 포인터가 피벗에 가까울 때 각속도 폭주를 막는다. = 0.25·L */
export const SPIN_RADIUS_MIN_PX = 9.375;
/** 휠체어 간 최소 간격 (OBB SAT 팽창량) */
export const CHAIR_SEP_PX = 0.4;
/** 이분탐색 반복 횟수. 6회 → 1/64 substep = 선형 0.009 px, 각도 0.0009 rad */
export const RESOLVE_ITERS = 6;

export const INTERACT = {
  dragArmCssPx: 4, // 이만큼 움직여야 드래그 개시 (tapMaxMoveCssPx 보다 작아야 함)
  tapMaxMoveCssPx: 6,
  tapMaxMs: 350,
  /** 이 배율 미만이면 터치에서 직접 존 잡기를 끄고 핸들만 쓴다. 기준은 **가장 좁은 밴드가
   *  터치 최소 타깃(24 CSS px, WCAG 2.5.8)을 확보하는 배율**이다.
   *
   *  2026-08-11 재편으로 차체가 둘로만 나뉘었고, 후속 지시로 경계가 반반이 되면서 두 밴드가
   *  똑같이 차체의 1/2 = 18.75 px 이 됐다(1/3 일 때 12.5 px, 네 토막이던 시절 7.5 px).
   *  24 / 18.75 = 1.28 — 밴드가 넓어질수록 더 작게 축소해도 손가락으로 직접 잡을 수 있다.
   *  유도식을 그대로 두고 값만 남겨 두면 주석이 거짓말이 되므로 함께 옮긴다. */
  zoneDirectMinPxPerUnit: 1.28,
  handleHitRadiusCssPx: 22,
  handleViewRadiusCssPx: 11,
  /** 핸들의 월드 고정 레버(px). 렌더 위치와 래치 레버가 같은 함수에서 나와야 스냅이 없다.
   *
   *  앞뒤 두 핸들(towRear·towFront)은 "줄을 매달아 끌고 간다"는 컨셉이므로 차체에서 떼어 놓는다.
   *  차체는 뒤끝 −7.5, 앞범퍼 +30 이니 아래 값은 양쪽 다 **15 px(0.6 m)** 씩 띄운 것이다.
   *  붙여 놓으면 몸통에 얹힌 안쪽 두 핸들과 구분이 안 되고, 끌고 가는 동작이라는 것도 안 읽힌다.
   *  반대로 너무 떼면(42.5 px 로 해봤다) 기본 포메이션에서 옆 칩까지 넘어가 소속이 헷갈리고
   *  손이 멀어 조작이 번거롭다. 15 px 이 "떨어져 있다"가 읽히는 최소치다. */
  handleLeverPx: { towRear: -22.5, translate: 0, spin: 22.5, towFront: 45 } as const,
  pickPadCssPx: 6,
  releaseChaseMs: 4000, // 손을 뗀 뒤 목표까지 계속 따라감
  leashVisibleAtPx: 4, // |T−G| 가 이보다 크면 리시·고스트 표시
  pointDragMaxPxPerSubstep: 3.0, // 공·콘 드래그 (= 360 px/s = 14.4 m/s)
  zoomMin: 1,
  zoomMax: 6,
  zoomStep: 1.25,
} as const;

export const PLAYBACK = {
  stepIntervalMs: { 0.5: 2400, 1: 1500, 2: 800 } as const, // 프로토타입 interval()
  transitionMsFor: (baseMs: number): number => Math.min(600, baseMs * 0.6),
  hermiteEnabled: true,
} as const;
