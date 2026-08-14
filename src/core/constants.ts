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
  maxCount: 8, // 기현 지시 2026-08-11 (10 → 8). 트레이 상자에 남은 개수로 표시된다.
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
  /** 색상별 상한(기현 지시 2026-08-11). 주황 8개 + 파랑 8개 = 코트 위 최대 16개.
   *  공(8개)과 같은 상자 은유라 개수 규칙도 같은 자리에 둔다. */
  maxCountPerColor: 8,
} as const;

/** 메모 = 종이 쪽지(§4.3 P1-5). 히트테스트(`physics/hitTest.ts`)와 시각 칩
 *  (`render/objects/NoteLabel.tsx`)·선택 링(`render/SelectionOverlay.tsx`)이 **같은 숫자**를
 *  쓰게 하는 유일한 출처다. 이 셋이 어긋나면 P1-5 의 원인 그 자체 — "보이는데 안 잡힌다" —
 *  가 다시 생긴다.
 *
 *  ⚠️ 칩 **세로는 상수다**. `size`(§3.5 NoteLabel 스키마, 기본 14)는 글자 크기만 정한다.
 *  히트테스트가 보는 장면 스냅샷에는 메모의 좌표뿐이라(§5.12 SceneSnapshot) 반경이 상수일
 *  수밖에 없고, 그러면 그 반경이 감싸야 할 칩도 상수여야 한다. 인스펙터가 주는 것은
 *  text·align 둘뿐이라 실제로 size 를 바꾸는 경로는 없다. */
export const NOTE = {
  /** 빈 메모 칩(월드 px). 32×24 를 고른 이유는 **외접원 반지름이 정확히 20**(16·12·20 직각
   *  삼각형)이라 아래 hitRadiusPx·ringRadiusPx 와 딱 맞물리기 때문이다. */
  chipMinWPx: 32,
  chipHPx: 24,
  /** 접힌 모서리(오른쪽 위) 한 변. */
  foldPx: 8,
  /** 글이 길면 칩이 가로로 늘어난다 — 그때 글 좌우에 남기는 여백. */
  chipPadXPx: 7,
  /** 빈 칩 안에 들어가는 플레이스홀더 글자 크기. `chipMinWPx` 를 넘기지 않는 값이다
   *  ('메모' 2자 ≈ 20 px < 32 − 2·3). */
  placeholderSizePx: 10,
  /** 히트테스트가 쓰는 메모의 **자기 반지름** = 빈 칩의 외접원 반지름.
   *  그려진 쪽지의 네 꼭짓점까지 전부 픽 원 안이라 "칩을 눌렀는데 안 잡힌다" 가 없다. */
  hitRadiusPx: 20,
  /** 선택 링 반지름. `physics/hitTest.ts` 의 `HIT_R_MAX_PX.note`(=22, §6.5 상한) 와 같은
   *  값이고 칩 외접원(20)보다 크다 — 링이 칩을 감싸고, 상한이 칩 안쪽을 자르지 않는다. */
  ringRadiusPx: 22,
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
  /** 정착 판정에서 "아직 겹쳐 있다" 로 볼 최소 침투 깊이(px). §4.2 P0-1 자가 분리.
   *
   *  0 으로 둘 수 없다: matter Resolver 는 접촉을 정확히 0 이 아니라 **slop 만큼 파묻힌 채로**
   *  쉬게 둔다(Body.slop 0.05 × slopDampen(dt/16.667=0.5) = 0.025 px — 휠체어 16대를 한 점에
   *  쌓아 실측한 수렴값도 정확히 0.025 다). 0 을 문턱으로 삼으면 정상적으로 맞닿아 선 두 칩이
   *  영영 "겹침" 으로 읽혀 손을 뗄 때마다 루프가 상한 8초를 다 태운다 — 무릎 위 태블릿에서
   *  그건 곧 배터리다.
   *
   *  0.5 px 은 slop 의 20 배이고 실제 크기로는 2 cm(1 px = 4 cm)라 화면에서 보이지 않는다.
   *  반대쪽 여유도 충분하다: 실측에서 손 뗀 순간의 겹침은 12.50 px 이고 한 substep 뒤 2.728 px
   *  이라, 이 문턱이 "아직 겹쳤다" 를 놓칠 구간이 없다. */
  overlapRestPx: 0.5,
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
  /** §7.3 히트 타깃(CSS px) — `tokens.css` 의 `--hit` 과 **같은 값**이다(44 / 큰 터치 타깃 56).
   *
   *  버튼은 `min-height: var(--hit)` 로 이 눈금을 지키는데 코트 위 개체는 지키지 않았다.
   *  그래서 설정의 "큰 터치 타깃" 설명문이 판 위에서는 거짓말이었다(§4.3 P1-2 [D-4]).
   *  2단 히트의 **2차 패스 반경**이 이 값의 절반이다 — 44 → 22/s 월드, 56 → 28/s 월드.
   *
   *  render 의 `hitRadius.ts` 가 이 값을 로컬 상수로 복제해 두고 있었다(§6.5 가 core 에
   *  필드가 없다고 적어 둔 시절의 흔적). 이제 여기가 유일한 출처다. */
  hitTargetCssPx: 44,
  hitTargetLargeCssPx: 56,
  /** **정착 스냅** 문턱(§4.3 P1-3). 화면 기준 거리다 — 줌을 해도 손끝이 느끼는 여유가 같아야
   *  하므로 월드 px 로 두면 안 된다(확대할수록 스냅이 강해져 조준을 빼앗긴다).
   *
   *  6 CSS px 은 탭 판정(tapMaxMoveCssPx)과 히트 팽창(pickPadCssPx)과 같은 값이다 — "손이
   *  흔들린 정도" 로 이미 이 저장소가 쓰고 있는 눈금이라 새 숫자를 만들 이유가 없다.
   *  드래그 **중에는 절대 쓰지 않는다**: 체이스·속도 제한 위에 얹으면 따라오던 칩이 갑자기
   *  튄다. 오직 정착 완료 재커밋 경로에서만 쓴다. */
  settleSnapCssPx: 6,
  releaseChaseMs: 4000, // 손을 뗀 뒤 목표까지 계속 따라감
  leashVisibleAtPx: 4, // |T−G| 가 이보다 크면 리시·고스트 표시
  /** 공·콘 드래그의 substep 당 변위 상한.
   *
   *  이 값은 **UX 속도 제한이 아니라 터널링 방지선**이다. 공과 콘은 실제 파워체어 속도를
   *  흉내 낼 이유가 없다(기현 지시 2026-08-11: 공·콘은 이동 배치 시 속도 제한 없음) —
   *  손이 움직이는 대로 따라와야 한다. 예전 3.0 은 360 px/s 라 800px 코트를 가로지르는 데
   *  2.2초가 걸려, 끌면 개체가 한참 뒤처졌다.
   *
   *  상한을 유지하는 유일한 이유는 한 substep 에 벽을 뛰어넘지 않게 하는 것이다.
   *  벽 두께 WALL.thicknessPx(40) 보다 작아야 한다 — 25 px/substep = 3000 px/s 로
   *  코트 횡단 0.27초, 손으로 끄는 속도로는 체감되지 않는다. */
  pointDragMaxPxPerSubstep: 25,
  zoomMin: 1,
  zoomMax: 6,
  zoomStep: 1.25,

  /** 코트 위 휠 줌(기현 지시 2026-08-14: *"코트에 마우스 두고 휠 버튼 움직이면 줌"*).
   *
   *  휠 한 칸을 버튼 한 번(`zoomStep`)과 **같은 걸음**으로 맞춘다. 브라우저마다 단위가 달라
   *  그대로 쓸 수 없다 — `deltaMode` 가 0(픽셀)이면 한 칸이 보통 100, 1(줄)이면 3 안팎,
   *  2(페이지)면 1 이다. 그래서 전부 **칸 수**로 환산한 뒤 `zoomStep ** 칸수` 를 곱한다.
   *
   *  상한을 두는 이유: 트랙패드·고해상도 휠은 한 이벤트에 큰 delta 를 던질 때가 있고, 그러면
   *  한 번에 zoomMin↔zoomMax 를 가로질러 판이 순간이동한다. 발 마우스로는 되돌릴 좌표를
   *  잃는 것이라 **한 이벤트가 옮길 수 있는 거리 자체**를 막는다. */
  wheelZoomPxPerNotch: 100,
  wheelZoomLinesPerNotch: 3,
  wheelZoomMaxNotchPerEvent: 2,

  /** 고무줄 선택 중 화면 가장자리 자동 밀기(기현 지시 2026-08-11).
   *
   *  확대해 놓고 선택을 시작하면 화면 밖 개체는 어떤 방법으로도 사각형 안에 넣을 수 없다 —
   *  손을 떼면 선택이 끝나고, 떼지 않으면 판을 밀 수 없기 때문이다.
   *
   *  띠 폭은 손가락 하나(≈48px)보다 넓게 잡는다. 좁으면 태블릿에서 가장자리를 스치기만
   *  해도 걸리거나, 반대로 도달하기 전에 손이 화면 밖으로 나간다. 속도는 가장자리에
   *  **닿는 순간 0** 에서 시작해 띠 끝에서 최고가 되도록 제곱으로 붙인다 — 선형으로 두면
   *  띠에 들어서는 순간 판이 홱 튀어 조준을 잃는다. */
  edgePanBandPx: 56,
  edgePanMaxPxPerS: 900,

  /** Ctrl/Cmd + 방향키 한 번에 창이 가는 거리(**화면** CSS px, §4.4 P2-1).
   *
   *  화면 기준이라 배율이 달라져도 손이 느끼는 걸음이 같다(settleSnapCssPx 와 같은 이유).
   *  월드 px 로 두면 6배 확대에서 한 번 누를 때마다 판이 통째로 지나간다.
   *
   *  64 는 "한 번 눌러 옮겨진 것이 보이되 지나치지는 않는" 눈금이다 — 히트 타깃(44)보다
   *  크게 잡아야 한 번 눌렀을 때 개체 하나 폭 이상 움직인 것이 읽히고, 태블릿 세로
   *  코트 폭(≈500)을 8번 안에 훑는다. 연타는 브라우저 키 반복이 대신한다. */
  keyPanStepCssPx: 64,
} as const;

export const PLAYBACK = {
  stepIntervalMs: { 0.5: 2400, 1: 1500, 2: 800 } as const, // 프로토타입 interval()
  transitionMsFor: (baseMs: number): number => Math.min(600, baseMs * 0.6),
  hermiteEnabled: true,
} as const;
