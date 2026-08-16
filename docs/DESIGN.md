# SPIN 구현 계약서 (v1)

> 이 문서는 세 갈래 설계안과 그 적대적 심사를 **하나로 통합한 확정 계약**이다.
> 구현 에이전트는 이 문서만 보고 서로의 코드를 보지 않은 채 병렬로 파일을 만든다.
> 여기 적힌 시그니처·상수·파일 경로는 **그대로 쓴다**. 다르게 구현하면 조립이 깨진다.
>
> 검증 상태: 이 문서의 matter-js 관련 주장·수치는 전부 `matter-js@0.20.0` 소스를 읽고
> Node 스크립트로 **실측 검증**했다. 운동학 골든값은 §10.9의 참조 구현으로 실제 생성했다.
> 검증되지 않은 추정치는 "추정"이라고 명시했다.

---

## 0. 문서 지위 · 읽는 법

| 절 | 내용 | 주 독자 |
|---|---|---|
| §1 | 설계안 간 충돌 해소 결과 (확정 결정 46건) | 전원 |
| §2 | 좌표계·단위·상수 테이블 — **유일한 진실 공급원** | 전원 (반드시 먼저) |
| §3 | 데이터 모델 `src/model/` | model 담당 |
| §4 | 저장 계층 `src/storage/` | storage 담당 |
| §5 | 물리·운동학 `src/physics/` | physics 담당 |
| §6 | 렌더·상태·화면 `src/render/ src/store/ src/app/ src/features/` | UI 담당 |
| §7 | 접근성 계약 (출시 조건) | UI 담당 전원 |
| §8 | **파일 소유권 표** — 한 파일은 정확히 한 모듈이 쓴다 | 전원 |
| §9 | 구현 순서 (웨이브) | 오케스트레이터 |
| §10 | 검증 기준 · 테스트 목록 · 골든값 | 전원 |
| §11 | 기각한 심사 지적과 근거 | 리뷰어 |
| §12 | 미해결 질문 (코치 확인 필요) | PO |

**절대 규칙 3가지**

1. **숫자는 §2에서만 정의한다.** 다른 절에 나오는 숫자는 §2의 상수를 참조한 결과다. 모듈이
   자기 파일에 숫자를 다시 적으면 안 된다. 새 숫자가 필요하면 §2 소유 모듈(`core`)에 추가한다.
2. **`src/core/` 는 다른 어떤 `src/*` 도 import 하지 않는다.** 순환 의존을 원천 차단한다.
3. **tsconfig 제약 (어기면 빌드 실패, 실측 확인함)**
   - `erasableSyntaxOnly: true` → **`enum` 금지 / 생성자 파라미터 프로퍼티 금지 / `namespace` 금지 / `import =` 금지**
     (실측: 파라미터 프로퍼티는 `error TS1294`. 유니온 + `as const` 로 대체)
   - `verbatimModuleSyntax: true` → 타입은 반드시 `import type`
   - `noUnusedLocals` / `noUnusedParameters` → 미사용 인자는 `_` 접두
   - `noFallthroughCasesInSwitch` → IDB `upgrade` 는 `switch` 대신 `if (oldVersion < N)` 체인
   - `target/lib: ES2023` + `DOM` → `structuredClone`, `Error(msg, {cause})`, `Array.at` 사용 가능

---

### 0.1 재편 정정 색인 — **이 문서를 읽기 전에 반드시 본다** (2026-08-13, 6차 6.3)

이 계약서는 **v1 착수 시점(2026-08-08 이전)의 확정본**이다. 그 뒤 2026-08 재편(커밋 60여 개,
테스트 874 → 2468)이 여러 조항을 무효화했다. **문장을 지우지 않는다 — 기록이기 때문이다.**
대신 무효가 된 자리마다 `※ 정정` 각주를 달았고, 그 자리를 여기 한 곳에 모은다.

| 절 | 무효가 된 진술 | 사실 (2026-08-13) | 코드 출처 |
|---|---|---|---|
| §2.9 / §7.1 | `OBJ_STROKE` 흰선/코트 **5.34:1** | **4.78:1** (5.34 는 불투명 흰색 기준. 실제는 알파 .92 합성) | `src/core/colors.ts` |
| §3.2 | 코트 1종, 마진 1.0 m | **풀 코트 3단**(825×525 / 775×450 / 700×425) · 마진 **1.5 m** | `model/court.ts` `courtDefFor` |
| §3.11 | 썸네일 역산에 **센터서클 r=75 → r=30** 검산 | **센터 서클은 삭제됐다**(§9 결정 ⑧, 5.3) | `courtLines/FullCourtLines.tsx` |
| §4.6 | `export const UI_KEY = 'spin.ui'` | **삭제됨**(5.0 ④ — 죽은 export) | `src/storage/prefs.ts` |
| §5.12 | `handlesVisible = forced \|\| (touch && pxPerUnit < 1.28)` | **자동 배율 문턱을 뗐다** — `forced` 만 본다(5.5 결정 ④) | `physics/hitTest.ts:100` |
| §6.8 | 화면 키 5개 `home\|library\|editor\|present\|settings` | **4개** `board\|drills\|present\|settings` + 레일 3항목 | `src/app/screens.ts` |
| §8 | 소유권 표의 모듈 15종 | 화면 모듈이 **개명·분화**했다(아래 §8 각주) | `src/features/` |

**여기 없는 것도 어긋나 있을 수 있다.** 이 문서에 적힌 `파일:행` 참조는 재편으로 파일이
옮겨지고 늘어나 **대부분 어긋나 있다.** 6.3 은 자기가 손댄 문단의 참조만 실제로 열어 확인했다.
숫자가 필요하면 이 문서가 아니라 **코드를 읽어라** — 문서와 코드가 다르면 **코드가 사실이다.**

---

## 1. 확정 결정 — 설계안 간 충돌 해소

### 1.1 좌표계·단위·개체 ID (세 설계안이 모두 건드린 영역)

| # | 쟁점 | 설계안들의 주장 | **확정** | 근거 |
|---|---|---|---|---|
| D1 | 물리·저장 월드 단위 | 1: SVG px / 2: SVG px / 3: 미터 | **SVG px. `PX_PER_M = 25`** | matter 내부 상수가 전부 절대 픽셀 길이다(`slop 0.05`, `_restingThresh 2 px/step`). 미터를 쓰면 25배 어긋난다. 프로토타입 데이터도 px. 렌더 변환 0회 |
| D2 | 좌표 원점 | 1·2: viewBox 좌상단 / 3: 경기면 좌상단(미터) | **viewBox 좌상단 (0,0)** | 프로토타입 `frames` 좌표를 그대로 쓸 수 있고, 라인 밖 배치(킥인)가 자연스럽다 |
| D3 | 차체 치수 | 1: 1.30×0.75 m (32.5×18.75 px) / 2·3: 1.50×1.00 m (37.5×25 px) | **1.50 × 1.00 m = 37.5 × 25 px** | REQUIREMENTS §7 "프로토타입 시각 언어 유지". 등번호 20px 글리프가 25px 칩에 들어간다(18.75px엔 안 들어감). 부수 이득: `hullRadius = hypot(30,12.5) = 32.5 px` 정확히 정수 |
| D4 | 각도 표현 | 1: rad 연속 / 2: deg 연속 / 3: rad | **런타임·물리·렌더 = rad(연속). 저장 = deg(랩, 0.1° 반올림)** | rad는 matter/atan2 네이티브, deg는 JSON 가독성·`rotate()` 네이티브. 변환은 `model/chair.ts` 의 두 함수에만 존재 |
| D5 | 각도 랩 | 1: 저장 시 랩 / 2: 랩 안 함 | **저장 시 `[-180, 180)` 로 랩** | 랩 안 하면 재생 보간의 최단호 계약이 깨진다(θ0=0.1, θ1=6.0 → 결과 -0.283). "제자리 350° 회전"은 중간 스텝으로 표현 |
| D6 | 개체 ID 접두 | 2: `dr_ se_ st_ ch_ bl_ cn_ ar_ nt_ it_` / 3: `drl_ ses_ stp_ chr_ bal_ con_ arw_ not_` | **설계안 2 (2글자 접두)** | 템플릿 리터럴 타입·충돌 분석·`crypto` 폴백이 완비돼 있다 |
| D7 | 개체 정체성 층 | 2: cast/pose 2층 / 3: objects/place 2층 | **`Drill.cast` + `DrillStep.{chairs,balls,cones}` PoseMap** | 이름은 2안, 구조는 동일. pose 맵에 **키가 있으면 코트 위** |
| D8 | 화살표 곡선 | 2: 3차(c1,c2) / 3: 2차(ctrl) | **2차 베지에 `Q` (`from, ctrl, to`)** | 편집 핸들 3개로 끝난다. 프로토타입 `C` 경로는 손으로 쓴 목업이고 우리는 재생성한다 |
| D9 | 화살표 종류 | 2: `pass/move/shot` / 3: `move/pass + emphasis` | **`move / pass / shot` 3종** | 프로토타입 3스타일과 1:1 |
| D10 | 화살표 앵커링 | 3: `fromRef/toRef` / 2: 없음 | **없음 (생성 시 1회 스냅만)** | 스텝 간 참조 무결성 문제를 하나 더 만든다. §11-R3 |
| D11 | 메모 | 2: 스텝 로컬 / 3: cast 개체 | **스텝 로컬 `DrillStep.notes`** | 물리 개체가 아니고 보간 대상도 아니다 |
| D12 | 코트 모드 전환 | 1: 미언급 / 2: `cloneToCourt` 전면 / 3: v1 불변 | **드릴 레벨 불변. `cloneToCourt` 는 `half ↔ flat` 만 좌표 보존, `full ↔ *` 은 배치 리셋** ※재편 각주 참조 | full 30×18 m 와 half 18×15 m 는 어떤 아핀 변환으로도 같은 전술이 안 된다. half/flat 은 viewBox 동일 → 항등 |

> **※ D12 재편 각주 (2026-08-09, 기현 지시).** 드릴에서는 위 결정 그대로 **불변**이다. 새로
> 생긴 **자유 전술판(§6.8 재편)에서만** 코트를 자유롭게 바꿀 수 있는데, 그것도 **판이 리셋
> 상태일 때만** 연다. D12 가 막으려던 손실("배치를 옮겨 담을 수 없다")은 *잃을 배치가 있을
> 때* 생기므로, 전환 가능 조건을 "잃을 배치가 없는 상태"로 한정하면 손실이 원천적으로
> 발생하지 않는다 — 경고 대화상자도, `cloneToCourt` 의 배치 리셋 경로도 타지 않는다.
> 판정은 `past.length === 0` **AND** 스냅샷의 `pristine`(둘 다 필요한 이유는
> `src/storage/board.ts` 주석). 전환 자체는 `createDrill` 로 그 코트의 기본 배치를 새로 만든다.
| D13 | 하프 코트 90° | 3: 세로 월드로 정의, `horiz/vert` 분기 삭제 | **채택.** 칩 스프라이트는 +x 정본 1개 + `rotate(θ)` | 물리 각도와 렌더가 같은 변수를 공유. 분기 소멸 |

### 1.2 물리 (설계안 1 + 심사 blocker 전량 반영)

| # | 쟁점 | **확정** | 근거 |
|---|---|---|---|
| D14 | 회전축 | `Body.setCentre(body, {x:-11.25, y:0}, true)` → **`body.position` = 피벗** | 실측: 정점 불변, `setAngle` 이 `position` 기준 회전. 생성 순서 고정(§5.3) |
| D15 | 휠체어 body | **`isStatic: true` + 매 substep `setPosition/setAngle(…, true)`** | 실측: dynamic 150 kg 휠체어도 침투 해석에 94 cm 밀린다(질량 무관). static 은 엔진 레벨 보장 |
| D16 | 휠체어 mass | **절대 설정 금지.** `Body.setMass`/`setDensity` 호출 금지, 생성 옵션에 `mass` 금지 | 실측: static 에 `setMass(150)` → `inertia = NaN` → 첫 충돌에 공 좌표 NaN. 옵션 `{isStatic:true, mass:150}` 도 `inverseMass = 0.006667` 로 남아 임펄스가 틀어진다 |
| D17 | static 표면 계수 | **생성 후 프로퍼티 직접 대입** (`b.restitution=…; b.friction=…; b._original` 도 갱신) | 실측: `setStatic` 이 `restitution=0, friction=1` 로 덮어쓴다(옵션 순서 무관) |
| D18 | 잡은 점 래치 | **body-frame 2D 벡터 `(ax, lat)` → `(rho, beta)` 전체를 래치.** s만 래치 금지 | 실측: s만 래치하면 pointerdown 즉시 최대 70.9°(spin)/115.9°(towRear) 스냅. 수정 후 첫 substep Δ = 0.000000000 (§10.9 G1) |
| D19 | tow 부호 | `sign(a)` 트릭 폐기 → `θ_r = atan2(d) − beta` 통합식 | `beta` 가 전/후방 부호를 이미 담는다(lat=0, ax<0 → beta=π). lateral 을 담을 수 있는 유일한 형태 |
| D20 | tow 로프 | **단방향(unilateral) 로프.** 잡은 점을 피벗 쪽으로 밀면 회전 없이 평행 이동 | 실측: 강체 봉이면 되밀 때 손떨림 ±0.2 px 에 ∓153° 잭나이프. 가드 후 0.0000° (§10.9 G5) |
| D21 | spin 제어 | **절대 방향 추종 폐기 → 포인터의 피벗 둘레 각변위 누적 + 반경 게인** (`gain = min(1, r/9.375)`) | 실측: 절대 추종은 피벗 근처 직선 통과에 ±178° 폭주. 수정 후 ±17° 이고 섭동에 연속 (§10.9 G6) |
| D22 | 속도 클램프 | **고정 substep(1/120 s) 당 변위 클램프**, 최대 6 substep | 프레임당 클램프는 실효 속도가 프레임레이트에 종속. 고정 dt 는 30 fps 에서도 정확 |
| D23 | dt | `PHYS.dtMs = 1000/120` **고정**. rAF dt 를 그대로 넣지 않는다 | matter `_deltaMax = 16.667`, `Body._timeCorrection = true` → 가변 dt 는 `correction = dt/body.deltaTime` 배로 속도를 뻥튀기한다. 50 ms 를 넣으면 3배 |
| D24 | 휠체어↔휠체어 | **OBB SAT + 궤적 이분탐색 + 접선 슬라이드** | Detector 가 static–static 쌍을 스킵(실측). 이분탐색만으로는 이웃을 스쳐 지나갈 때 진행률 2.3% (실측). 접선 슬라이드 추가 시 100% |
| D25 | 겹침 탈출 | 이미 겹쳤으면 **침투 깊이가 줄어드는 이동만** 허용 | 무조건 허용하면 한 번 겹친 뒤 영구 관통 |
| D26 | 벽 | viewBox 테두리에만 정적 벽 4개. **라인에는 벽 없음** | 킥인·코너 세트피스는 라인 밖 배치가 필수. flat 은 라인 자체가 없다 |
| D27 | 경계 처리 | `clampPoseToBounds` 를 **별도 단계로 두지 않고** 이분탐색의 `blocked()` 술어에 통합 | 분리하면 spin 중 피벗이 최대 19.6 px 밀린다("제자리 회전" 계약 위반) |
| D28 | `enableSleeping` | **반드시 `false`** | 실측: static 휠체어는 잠든 body 와 충돌 검사 자체가 스킵된다(`Detector.js:96`) → 완전 관통 |
| D29 | 드래그 종료 | **`freezeKinematic()` 필수** | 실측: 미실행 시 정지한 휠체어가 1 초간 공을 47.3 px 밀고 1.30 m/s 를 준다 |
| D30 | 공 속도 단위 | **matter 속도 단위 = px per 16.667 ms = px/s ÷ 60.** 상수명에 단위를 박는다 | 실측: `setVelocity(300)` → 18,000 px/s(716 m/s). `setVelocity(5)` → 300.00 px/s |
| D31 | 반발계수 | `e=0.45` 는 접근속도 > 4.8 m/s 에서만 발동. **저속 반발 훅을 명시적으로 구현** | 실측: 4.8 m/s(=2.0 matter units) 경계에서 e_eff 0.0037 → 0.4500 계단. 훅 적용 후 1~12 m/s 전 구간 0.45 |
| D32 | 정착(settle) | `frictionAir` 만으로는 8 m/s 공이 **6.53 초** 굴러야 멈춘다 → **쿨롱 구름 감속 25 px/s² 추가** | 실측: fA 0.012 + roll 25 → 2.58 s / 7.39 m 로 유한 정지. 조기 종료가 실제로 발동한다 |
| D33 | 공·콘 드래그 | dynamic 유지 + 매 substep `setPosition(…, updateVelocity=false)` + `setVelocity(0)` + 경계 클램프 + substep 변위 상한 | `updateVelocity:true` 는 Verlet 되먹임으로 발산(실측 20프레임에 x = −4.3e6). static 전환은 Detector 스킵을 부른다 |
| D34 | 재생 | **물리 미사용. 결정론적 보간** | 결정성·스크럽·역재생·썸네일 일치 |
| D35 | Hermite 접선 | `K = arcTangentK(Δθ) = 2·tan(φ/4)/sin(φ/2)` | 실측: K=0.55 는 90° 전환에서 원호 대비 **15.54 px** 오차, K(90°)=1.171573 은 **0.027 px** |
| D36 | `wrapPi` 치역 | **`[-π, π)`.** `wrapPi(π) === -π` | 실측 확인. 문서·주석·테스트를 이 값에 맞춘다 |
| D37 | ω 상한 유도 | `ω = (bumperKmh/3.6)·PX_PER_M / pivotToFrontPx`. 물리 천장은 `omegaCeiling(linearKmh)` 로 **유도**하고 `bumperKmh` 상한을 동적 클램프 | 두 설정이 독립이면 전후진 4 km/h + 회전 30 km/h 같은 비물리 조합이 만들어진다 |

### 1.3 UI · 상태 · 저장 (설계안 2·3 + 심사)

| # | 쟁점 | **확정** | 근거 |
|---|---|---|---|
| D38 | 라우팅 | react-router 미도입. `useAppHistory` (`go` / `back` 2종) | 5화면·딥링크 불필요. `go` 만 있으면 뒤로가기가 시연 재진입 토글이 된다 |
| D39 | 상태 저장소 | zustand 미도입. Context 5개 + `useReducer`, **state/dispatch 분리 Provider** | 60 fps 갱신을 React 밖으로 뺐으므로 셀렉터가 불필요 |
| D40 | 60fps 경계 | `transform` 은 JSX 에 **절대** 쓰지 않는다. `TransformWriter` 단독 소유 | React 가 렌더하지 않은 속성은 재조정이 건드리지 않는다 |
| D41 | 초기 transform | `register()` 가 **동기적으로 마지막 프레임을 즉시 기록** | 안 하면 마운트 첫 페인트에 25개 개체가 좌상단에 겹치고, 시연 드릴 전환(`key` 재마운트)에서는 **영구 고착** |
| D42 | 현재 스텝 소유자 | **`EditorContext.stepId: StepId` 하나뿐.** index 는 파생 | 두 곳(Editor.stepId / Playback.stepIndex)에 두면 재생 시 코트가 안 움직이고 스텝 삭제 후 크래시 |
| D43 | 되돌리기 | 루트 스냅샷 스택 + coalesce + **`epoch`** | 커밋마다 물리 월드를 재구축하지 않기 위해 구조 변경/시점 점프에만 epoch 증가 |
| D44 | 썸네일 | 기하 요약만 캐시(색 미포함), 목록에서 실시간 SVG. **레코드별 `build` 버전 + 지연 재생성** | 전역 `SUMMARY_BUILD` 스윕은 구·신 번들 간 재생성 핑퐁을 만든다 |
| D45 | 세션 ↔ 드릴 | 참조(id). 캐스케이드 삭제 없음. **가져오기는 `idMap` 리맵 필수** | 리맵 없으면 "사본으로 추가" 가 세션을 조용히 다른 드릴로 연결한다 |
| D46 | 배포 | **http(s) 필수.** `file://` 미지원(Chrome 이 IDB 를 거부). `memoryDrillRepo` 는 **필수** | 시크릿 모드·저장소 차단에서도 앱이 떠야 한다 |

---

## 2. 좌표계 · 단위 · 상수 테이블 (유일한 진실 공급원)

소유 모듈: **`core`** (§8). 파일: `src/core/units.ts`, `src/core/angle.ts`, `src/core/constants.ts`,
`src/core/colors.ts`, `src/core/ids.ts`, `src/core/geom.ts`.

### 2.1 좌표계

```
월드 = SVG user unit(= px). 1 m = 25 px. 원점 = viewBox 좌상단.
+x 오른쪽, +y 아래.  각도 0 = +x, 양수 = 화면상 시계방향 (SVG y-down 이므로 matter 부호와 일치).
휠체어의 (x, y) 는 기하 중심이 아니라 **피벗(탑승자 머리)** 이다.
```

> **REQUIREMENTS §3 문구 정정**: "월드 단위 = 미터, 렌더 스케일 25 px/m" 은
> **"코트 규격을 미터로 명세하고, 저장·물리·렌더 좌표계는 SVG px(25 px/m)로 한다"** 로 읽는다.
> 미터를 실제 물리 단위로 쓰면 matter 의 하드코딩 상수(§2.7)가 전부 25배 어긋난다.

### 2.2 `src/core/units.ts`

```ts
export const PX_PER_M = 25;
export const M_PER_PX = 1 / PX_PER_M;                    // 0.04
export const mToPx = (m: number): number => m * PX_PER_M;
export const pxToM = (px: number): number => px * M_PER_PX;
export const kmhToPxPerS = (kmh: number): number => (kmh / 3.6) * PX_PER_M;
export const pxPerSToKmh = (v: number): number => (v / PX_PER_M) * 3.6;

/** matter.js 의 속도 단위는 px/s 가 아니라 px per Body._baseDelta(16.667 ms) 다.
 *  실측: setVelocity(b,{x:5,y:0}) -> 300.00 px/s.  setVelocity(b,{x:300}) -> 18,000 px/s. */
export const MATTER_BASE_DELTA_MS = 1000 / 60;           // 16.6666667
export const pxPerSToMatterV = (v: number): number => v / 60;
export const matterVToPxPerS = (v: number): number => v * 60;

export interface Vec2 { x: number; y: number }
```

### 2.3 `src/core/angle.ts`

```ts
export const TAU = Math.PI * 2;
export const DEG = 180 / Math.PI;
export const RAD = Math.PI / 180;

/** [-π, π) 로 정규화. 실측 확인: wrapPi(Math.PI) === -Math.PI */
export function wrapPi(a: number): number {
  let x = (a + Math.PI) % TAU;
  if (x < 0) x += TAU;
  return x - Math.PI;
}
export const shortestDelta = (from: number, to: number): number => wrapPi(to - from);
export const lerpAngle = (a: number, b: number, t: number): number => a + shortestDelta(a, b) * t;

/** 저장용: rad(연속) -> deg, [-180,180), 0.1° 반올림 */
export const radToStoredDeg = (rad: number): number => Math.round(wrapPi(rad) * DEG * 10) / 10;
/** 로드용: deg -> rad. 저장값이 랩돼 있으므로 그대로 통과 */
export const storedDegToRad = (deg: number): number => deg * RAD;

/** 90° 원호를 3차 Hermite 로 근사할 때 오차를 최소화하는 접선 계수.
 *  K(φ) = 2·tan(φ/4)/sin(φ/2).  검산: 0°→1, 30°→1.017332, 60°→1.071797,
 *  90°→1.171573, 120°→1.333333, 180°→2.
 *  실측(R=100, 90°): K=1.171573 → 최대 반경오차 0.027 px / K=0.55 → 15.539 px */
export function arcTangentK(dTheta: number): number {
  const p = Math.abs(dTheta);
  if (p < 1e-4) return 1;
  return (2 * Math.tan(p / 4)) / Math.sin(p / 2);
}
```

### 2.4 차체 기하 — `CHAIR` (확정, 전 모듈 공유)

| 항목 | 미터 | px | 유도 |
|---|---|---|---|
| 전체 길이 L | 1.50 | **37.5** | 프로토타입 칩 |
| 전체 폭 W | 1.00 | **25** | 프로토타입 칩 |
| 피벗 비율 `sPivot` | — | **0.20** | REQUIREMENTS §4.2 |
| 피벗 → 뒤끝 | 0.30 | **7.5** | 0.2·L |
| 피벗 → 앞범퍼 | 1.20 | **30** | 0.8·L. ω 유도의 r |
| 피벗 → centroid | 0.45 | **11.25** | (0.5−0.2)·L. `setCentre` 오프셋 |
| 피벗 → 최원거리 정점 `hullRadiusPx` | 1.30 | **32.5** | `hypot(30, 12.5)` — 정확히 32.5 (실측 확인) |
| 피벗 → 뒤 모서리 | 0.583 | 14.5774 | `hypot(7.5, 12.5)` |
| 볼가드 깊이 | 0.225 | **5.625** | 0.15·L. `s ∈ [0.85, 1.00]` — `sTowFrontMin` 과 일치 |
| 트랙 폭(구동륜 간격) | 0.65 | 16.25 | 전폭 1.00 − 타이어·가드 여유. ω 천장 유도용 |

### 2.5 `src/core/constants.ts` — 그대로 옮겨 쓸 것

```ts
import { PX_PER_M, pxPerSToMatterV } from './units.ts';

export const CHAIR = {
  lengthM: 1.5,   lengthPx: 37.5,
  widthM: 1.0,    widthPx: 25,
  guardM: 0.225,  guardPx: 5.625,
  sPivot: 0.2,
  pivotToRearPx: 7.5,
  pivotToFrontPx: 30,
  centroidOffsetPx: 11.25,
  hullRadiusPx: 32.5,
  rearCornerPx: 14.57738,
  trackM: 0.65,
  /** 문서값. matter body 에 절대 설정 금지 — setStatic 이 Infinity 로 강제하며
   *  setMass 호출 시 inertia = NaN 이 된다(실측). 'push' 모드 도입 시에만 쓴다. */
  massKgDoc: 150,
  restitution: 0.1,
  friction: 0.15,
  frictionStatic: 0.5,
} as const;

export const BALL = {
  diameterM: 0.33, radiusM: 0.165,
  radiusPx: 4.125,                 // 물리 반지름 (FIPFA 33 cm)
  viewRadiusPx: 7,                 // 시각 반지름 (프로토타입). 차이 2.875 px = 0.115 m — 의도된 괴리
  polySides: 16, polyRadiusPx: 4.16501480, inradiusPx: 4.08498520,
  massKg: 1.0,
  restitution: 0.45, friction: 0.02, frictionStatic: 0.05, frictionAir: 0.012,
  rollDecelPxPerS2: 25,            // 쿨롱 구름 감속 (§5.9)
  maxSpeedPxPerS: 420,             // = 16.8 m/s
  maxSpeedMatter: 7.0,             // = 420/60. setVelocity/getSpeed 에 쓰는 값
  maxCount: 10,
} as const;

export const CONE = {
  baseDiameterM: 0.25, radiusPx: 3.125,
  polySides: 12, polyRadiusPx: 3.17916369, inradiusPx: 3.07083631,
  viewWidthPx: 10, viewHeightPx: 9,
  massKg: 2.0,
  restitution: 0.05, friction: 0.4, frictionStatic: 0.6, frictionAir: 0.065,
  rollDecelPxPerS2: 25,
  maxSpeedPxPerS: 240, maxSpeedMatter: 4.0,
} as const;

export const WALL = {
  thicknessPx: 40, restitution: 0.1, friction: 0.6, frictionStatic: 0.8,
} as const;

/** 물리 루프 상수. dtMs 를 바꾸면 §5.7 마찰 튜닝값을 전부 재조정해야 한다
 *  (Resolver 의 접선 마찰은 timeScale³ 에 비례하고 _restingThreshTangent 는 스케일되지 않는다). */
export const PHYS = {
  dtMs: 1000 / 120,                // 8.3333333
  dtS: 1 / 120,
  maxSubsteps: 6,
  accClampMs: 50,                  // = 6 × 8.3333
  settleMaxMs: 4000,
  /** 단위: px per 16.667 ms (Body.getSpeed 와 같은 단위). 0.03 = 1.8 px/s = 7.2 cm/s */
  restSpeedMatter: 0.03,
  positionIterations: 6, velocityIterations: 4, constraintIterations: 2,
  /** matter Resolver._restingThresh. 이 값 미만의 접근속도에는 restitution 이 적용되지 않는다.
   *  2.0 matter units = 120 px/s = 4.8 m/s (dt 무관, 실측 확인). */
  restingThreshMatter: 2.0,
  lowSpeedBounceMinMatter: 0.15,   // 이 아래는 정착을 위해 반발시키지 않음 (= 9 px/s)
} as const;

export const DEFAULT_LIMITS = {
  linearKmh: 10,                   // vLin = 69.4444444 px/s = 0.5787037 px/substep
  bumperKmh: 30,                   // ω = 6.9444444 rad/s = 397.887358 °/s = 3.31573 °/substep
  linearKmhRange: [4, 16] as const,
  bumperKmhRange: [10, 36] as const,
} as const;

export const DEFAULT_ZONES = {
  sTowRearMax: 0.12,               // s ≤ 0.12          → towRear
  sSpinMin: 0.32,                  // 0.12 < s < 0.32   → translate
                                   // 0.32 ≤ s < 0.85   → spin
  sTowFrontMin: 0.85,              // s ≥ 0.85          → towFront  (= 볼가드 뒷면)
  grabPadPx: 10,                   // 히트영역 팽창 (축 앞뒤 + 측방), 0.4 m
} as const;

/** spin 게인 감쇠 반경. 포인터가 피벗에 가까울 때 각속도 폭주를 막는다. = 0.25·L */
export const SPIN_RADIUS_MIN_PX = 9.375;
/** 휠체어 간 최소 간격 (OBB SAT 팽창량) */
export const CHAIR_SEP_PX = 0.4;
/** 이분탐색 반복 횟수. 6회 → 1/64 substep = 선형 0.009 px, 각도 0.0009 rad */
export const RESOLVE_ITERS = 6;

export const INTERACT = {
  dragArmCssPx: 4,                 // 이만큼 움직여야 드래그 개시 (tapMaxMoveCssPx 보다 작아야 함)
  tapMaxMoveCssPx: 6, tapMaxMs: 350,
  /** 이 배율 미만이면 터치에서 직접 존 잡기를 끄고 핸들만 쓴다.
   *  24 CSS px / (0.20·37.5 px) = 3.2  (가장 좁은 '평행 이동' 밴드 기준, WCAG 2.5.8) */
  zoneDirectMinPxPerUnit: 3.2,
  handleHitRadiusCssPx: 22, handleViewRadiusCssPx: 11,
  /** 핸들의 월드 고정 레버(px). 렌더 위치와 래치 레버가 같은 함수에서 나와야 스냅이 없다. */
  handleLeverPx: { towRear: -37.5, translate: 0, spin: 22.5, towFront: 60 } as const,
  pickPadCssPx: 6,
  releaseChaseMs: 4000,            // 손을 뗀 뒤 목표까지 계속 따라감
  leashVisibleAtPx: 4,             // |T−G| 가 이보다 크면 리시·고스트 표시
  pointDragMaxPxPerSubstep: 3.0,   // 공·콘 드래그 (= 360 px/s = 14.4 m/s)
  zoomMin: 1, zoomMax: 6, zoomStep: 1.25,
} as const;

export const PLAYBACK = {
  stepIntervalMs: { 0.5: 2400, 1: 1500, 2: 800 } as const,   // 프로토타입 interval()
  transitionMsFor: (baseMs: number): number => Math.min(600, baseMs * 0.6),
  hermiteEnabled: true,
} as const;
```

### 2.6 유도값 (계산해 둔 확정 수치)

| 값 | 식 | 결과 |
|---|---|---|
| `vLinPxPerS` | `kmhToPxPerS(10)` | **69.4444444** px/s |
| substep 선형 변위 | `vLin/120` | **0.5787037** px |
| `omegaRadPerS` | `kmhToPxPerS(30) / 30` | **6.9444444** rad/s = **397.887358** °/s |
| substep 각변위 | `ω/120` | **0.05787037** rad = **3.31573** ° |
| 180° 선회 | `π/ω` | **0.45239** s |
| 360° 선회 | `2π/ω` | **0.90478** s |
| hull 정점 회전 변위/substep | `ω/120 × 32.5` | **1.880787** px |
| tow 최악 substep 변위 | `+ vLin/120` | **2.459491** px |
| ω 물리 천장 | `(linearKmh/3.6)·25 / (트랙/2 ·25)` = `(10/3.6)/0.325` | **8.547009** rad/s |
| 기본 ω 여유 | `6.9444/8.5470` | **81.2 %** — 채택 |
| `bumperKmh` 동적 상한 | `min(36, ceiling·1.2·3.6)` @linear=10 | **36.0** km/h (천장 36.92 미만) |
| 공 substep 최대 변위 | `420/120` | **3.5** px (콘 접촉 밴드 14.4 px 의 24 %) |
| 콘 substep 최대 변위 | `240/120` | **2.0** px |
| tow 최소 레버 | `(0.12−0.20)·37.5` | **3.0** px = 0.12 m |
| spin 레버 범위 | `(0.32…0.85−0.20)·37.5` | 4.5 … 24.375 px |
| towFront 최소 레버 | `(0.85−0.20)·37.5` | **24.375** px = 0.975 m |
| 존 폭 (px) | rear / trans / spin / front | 4.5 / 7.5 / 19.875 / 5.625 |

### 2.7 matter-js 0.20.0 실측 검증 로그

전부 `node_modules/matter-js/src/` 소스를 읽고 Node 로 직접 실행해 확인했다.

| 항목 | 결과 |
|---|---|
| `setCentre(rel=true)` 가 정점을 옮기지 않음 | position 411.25 → 400, centroid 411.25 유지 ✓ |
| `setAngle` 이 `position`(=피벗) 기준 회전 | 90° 후 centroid (400,261.25) ✓ |
| 피벗 고정 (임의 7각도 반복) | 최대 이탈 **0.000e+0** ✓ |
| `hullRadius` | **32.5000000** ✓ |
| `Bodies.rectangle({isStatic:true, restitution:.1, friction:.15})` | 실제 **restitution 0, friction 1**, frictionStatic 0.5 (옵션 순서 무관) |
| static + `Body.setMass(b,150)` | **inertia = NaN, inverseInertia = NaN** |
| `Bodies.rectangle({isStatic:true, mass:150})` | inertia Infinity 지만 **inverseMass = 0.006667 (≠0)** |
| `Body.setVelocity(b,{x:300})` @dt=1/120 | 변위 **150 px/substep = 18,000 px/s** |
| `Body.setVelocity(b,{x:5})` | **2.5 px/substep = 300.00 px/s** ✓ |
| `Body.getSpeed` 단위 | px per 16.667 ms (= px/s ÷ 60) |
| static body `deltaTime` | **16.66667 로 고정** (dynamic 은 8.33333) → `allAtRest` 는 static 을 제외해야 함 |
| restitution 절벽 (e=0.45, 평면 벽) | 4.8 m/s → e_eff **0.0037** / 5.0 m/s → **0.4500**. dt=1/60 에서도 동일 경계 |
| restitution 절벽 (e=0.90) | 4 m/s → 0.1493 / 6 m/s → 0.9000 |
| 저속 반발 훅 적용 후 | 1·2·3·4·5·8 m/s 전부 **e_eff 0.4500** ✓ |
| static 휠체어가 10 km/h 로 미는 공 | 정상상태 **2.7778 m/s** = 차체 속도 정확히 일치 ✓ |
| 8 m/s 공이 대기 static 휠체어 강타 | 이동 **0.0000000000**, 각도 **0.0000000000** ✓ |
| freeze 미실행 고스트 푸시 | 1 초 후 공이 **47.316 px 이동, 1.3016 m/s** (freeze 시 0.060 px, 0.0000 m/s) |
| 스핀킥 (ω=6.9444) | r=0.5 m → 8.21 / 0.75 → 8.44 / 1.0 → 7.55 / 1.2 → 10.06 / 1.3 m → **11.52 m/s** |
| `frictionAir` 시정수 @dt=1/120 | ball 0.012 → **1.3847 s** / cone 0.065 → **0.2522 s** |
| 8 m/s 공 정지 시간 | fA 만 → **6.53 s / 10.95 m** · fA+roll 25 → **2.58 s / 7.39 m** |
| `Bodies.circle(r=4.125)` 변 수 | **10** (→ `Bodies.polygon` 직접 사용 필요) |
| 휠체어 이분탐색만 (이웃 스쳐 지나가기) | 접선 진행률 **2.3 %** → 접선 슬라이드 추가 시 **100 %** |
| `Detector.collisions` | `bodyAStatic && (B.isStatic \|\| B.isSleeping)` → **continue** (소스 확인) |
| `Resolver._restingThresh` 스케일 | `-2 × (dt/16.667)` → **px/s 로는 dt 무관하게 120 px/s** |
| `Resolver._restingThreshTangent` | **스케일 안 됨** → dt=1/120 에서 11.76 m/s, dt=1/60 에서 5.88 m/s |
| 접선 마찰 임펄스 | `friction × sign × timeScale³` → dt 변경 시 마찰 재튜닝 필요 |
| `Pair.update` | `friction = min`, `frictionStatic = max`, `restitution = max` |

### 2.8 색 토큰 (추가만 한다 — 기존 12개 토큰은 건드리지 않는다)

`src/styles/tokens.css` 에 **추가**. 대비값은 전부 WCAG 상대휘도로 계산했다.

```css
:root {                         /* 다크 (기존 토큰 아래에 이어서) */
  --faint-text: #8794a3;        /* /panel 5.78:1  /panel-2 5.99:1 */
  --accent-text: var(--accent); /* /panel 14.21:1 */
  --accent-ink-strong: #0b0f14; /* /accent 15.29:1 */
  --hit: 44px;
}
[data-theme="light"] {
  --faint-text: #626c78;        /* /panel 5.34  /panel-2 4.96  /bg 4.58 */
  --accent-text: #446f00;       /* /panel 5.97  /panel-2 5.55  /bg 5.12 */
  --accent-ink-strong: #14200a; /* /accent 5.83 */
}
body[data-touch="large"] { --hit: 56px; }
```

**사용 규칙 (§7.1 감사 대상)**

| 토큰 | 용도 |
|---|---|
| `--faint` | **장식 전용** — 격자 라벨, 구분선 옆 아이콘, 비활성 표시 |
| `--faint-text` | 사람이 읽는 모든 11.5px 보조 텍스트 (`pageSub`, 카드 메타, 설정 설명, 세션 시간 …) |
| `--accent-text` | accent 를 **글자·아이콘 색**으로 쓸 때 (eyebrow, 배지, `STEP n/N`, 재생중 라벨) |
| `--accent` | accent 를 **배경**으로 쓸 때만 |
| `--accent-ink-strong` | accent 배경 위 글자·아이콘 |

기존 값 실측: `--faint`/panel 다크 3.57 · 라이트 2.97 (본문 실패) / 라이트 `--accent-ink`/accent **2.90** (주 버튼 실패).

### 2.9 `src/core/colors.ts`

```ts
export const COURT_BG = '#1f7a46';           // 다크·라이트 공통 (라이트 #2f9e5c 는 흰 라인 3.41:1
                                             // 로 떨어지고 격자·존이 전부 무효가 되어 폐기)
export const OBJ_STROKE = 'rgba(255,255,255,.92)';   // 흰선/코트 4.78:1  ※ 정정 2026-08-13
export const ARROW_CASING = '#000000';               // 검정(불투명)/코트 3.93:1
// [2] 2026-08-08 정정. 원래 'rgba(0,0,0,.62)' 였으나 알파 .62 를 코트(#1f7a46) 위에
// 합성한 실제 색은 rgb(12,46,27) 이고 코트 대비가 2.75:1 로, 케이싱이 존재하는 목적인
// 3:1(WCAG 1.4.11)을 못 채운다. 주석의 3.93 은 알파 1.0 일 때만 성립하는 값이었다.
// [3] 2026-08-13(6.3) 정정 — **흰색 쪽도 같은 함정이었다.** OBJ_STROKE 의 "5.34:1" 은 불투명
// 흰색 기준이고, 알파 .92 를 코트 위에 합성한 실제 값은 **4.78:1** 이다. [2] 가 검정 쪽만
// 고치고 흰색 쪽은 3차수 동안 그대로 뒀다. 기준(비텍스트 3:1)은 어느 쪽으로 세어도 넘으므로
// **조치가 아니라 숫자 정정**이다. 이제 `src/test/docsMatchCode.test.ts` 가 colors.ts 의 그
// 한 줄을 파일에서 읽어 `contrastRatio(compositeOver(OBJ_STROKE, COURT_BG), COURT_BG)` 와
// 대조한다 — 주석과 계산이 갈라지면 그 테스트가 먼저 빨개진다.
// 6.5(2026-08-13)가 더한 짝: `OBJ_STROKE_DARK = 'rgba(0,0,0,.92)'` — 밝은 차체(상대휘도 ≥ .25)
// 위에서 테두리를 뒤집는다. 코트 위 3.75:1.

export const CATEGORY_COLORS: Record<string, string> = {
  '공격': '#d93a3a', '수비': '#1f6bb8', '슈팅': '#e08a12',
  '세트피스': '#7c5cd6', '볼 운반': '#128a5c',
};
export const CATEGORY_FALLBACK_COLOR = '#6b7280';
export const categoryColor = (c: string): string => CATEGORY_COLORS[c] ?? CATEGORY_FALLBACK_COLOR;
export const KNOWN_CATEGORIES = ['공격', '수비', '슈팅', '세트피스', '볼 운반'] as const;

/** 팀 색 선택지. 프로토타입의 #2b7fd4 는 흰 글자 대비 4.13:1 로 등번호가 읽히지 않아
 *  #1f6bb8 (5.45:1) 로 교체했다. 나머지 3색은 프로토타입 그대로. */
export const TEAM_COLOR_CHOICES = ['#d93a3a', '#1f6bb8', '#e08a12', '#7c5cd6'] as const;
export const GK_HOME_COLOR = '#f2c811';      // 어두운 잉크 10.51:1
export const GK_AWAY_COLOR = '#22a95b';      // 어두운 잉크 5.56:1 (흰 글자였으면 3.05:1 실패)
export const BALL_FILL = '#fbbf24';
export const CONE_COLORS = ['#ff6b1a', '#ec4899'] as const;   // 슬롯 0, 1
export const ARROW_COLORS = { move: '#38bdf8', pass: '#fbbf24', shot: '#fbbf24' } as const;

const srgb = (v: number): number => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
export function relLuminance(hex: string): number {
  const [r, g, b] = (hex.replace('#', '').match(/../g) ?? []).map((x) => srgb(parseInt(x, 16) / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
/** 배경색 위에 얹을 글자색. 임계 0.25 는 팔레트 전체가 ≥4.5:1 을 만족하도록 정한 값.
 *  검산: #d93a3a(L .181)→흰 4.55 / #1f6bb8(.143)→흰 5.45 / #7c5cd6(.168)→흰 4.82
 *       #e08a12(.341)→어둠 6.30 / #f2c811(.602)→어둠 10.51 / #22a95b(.295)→어둠 5.56 */
export const inkFor = (fill: string): string => (relLuminance(fill) > 0.25 ? '#14200a' : '#ffffff');
```

---

## 3. 데이터 모델 — `src/model/`

### 3.1 ID — `src/core/ids.ts`

```ts
export type IdPrefix = 'dr'|'se'|'st'|'ch'|'bl'|'cn'|'ar'|'nt'|'it';
export type Id<P extends IdPrefix> = `${P}_${string}`;
export type DrillId = Id<'dr'>;  export type SessionId = Id<'se'>; export type StepId = Id<'st'>;
export type ChairId = Id<'ch'>;  export type BallId = Id<'bl'>;    export type ConeId = Id<'cn'>;
export type ArrowId = Id<'ar'>;  export type NoteId = Id<'nt'>;    export type ItemId = Id<'it'>;
export type CastId = ChairId | BallId | ConeId;

/** 17자: 접두(2) + '_' + time36(8) + seq36(2) + rand36(4) */
export function newId<P extends IdPrefix>(prefix: P): Id<P>;
/** 길이를 하드코딩하지 않는다. 2059년 시계·RTC 고장 기기의 id 도 받아들여야 한다. */
export function isId<P extends IdPrefix>(v: unknown, p: P): v is Id<P>;
//  구현: typeof v === 'string' && v.length >= 4 && v.length <= 64
//        && v.startsWith(p + '_') && /^[0-9a-z_]+$/.test(v)
```

`crypto.randomUUID` 미사용 근거 정정: `file://` 은 secure context 라 randomUUID 가 **있다**.
실제 근거는 **사설 IP http(체육관 LAN)가 secure context 가 아니라는 점**뿐이다.
`crypto.getRandomValues` 는 insecure context 에서도 동작하므로 폴백 구현은 유효하다.

충돌 보장 (실측): **같은 생성기 안에서는 동일 ms 에 1296개까지 seq 로 충돌 0**.
서로 다른 기기·탭 사이는 `rand36(4)` = 1/1,679,616. 시계를 고정하고 10만 개를 뽑으면 평균 2.1건
충돌하므로 §10 테스트는 두 개로 나눈다(§10.4).

### 3.2 코트 — `src/model/court.ts`

```ts
export type CourtMode = 'full' | 'half' | 'flat';
export const COURT_MODES = ['full', 'half', 'flat'] as const;
export interface Rect { x: number; y: number; w: number; h: number }

export interface CourtDef {
  mode: CourtMode; label: string; dims: string; desc: string;
  vbW: number; vbH: number;
  surface: Rect;                      // 라인 안쪽 경기면. flat 은 viewBox 전체
  ruleZones: Rect[];                  // 골 지역 2인 규칙 존
  goalPosts: Vec2[]; cornerCuts: string[]; spotMarks: Vec2[];
  grid: { cols: number; rows: number; cellW: number; cellH: number; origin: Vec2 };
  homeHeadingDeg: number; awayHeadingDeg: number;
}
export const COURT_DEFS: Record<CourtMode, CourtDef>;
export const gridLabel = (col: number, row: number): string =>
  String.fromCharCode(97 + col) + String(row + 1);        // a1, b4 …
export function gridCellCenter(mode: CourtMode, col: number, row: number): Vec2;
export function cellLabelAt(mode: CourtMode, p: Vec2): string | null;
/** 개체 좌표는 viewBox 안으로만 클램프한다 (경기면 밖 대기 배치 허용) */
export function clampToViewBox(mode: CourtMode, p: Vec2): Vec2;
```

| 필드 | full | half | flat |
|---|---|---|---|
| label / dims | 풀 코트 / 30 × 18 m | 하프 코트 / 18 × 15 m · 90° 회전 | 플랫 코트 / 라인 없음 |
| vbW, vbH | 825, 525 | 525, 450 | 525, 450 |
| surface | 37.5,37.5,750,450 | 37.5,37.5,450,375 | **0,0,525,450** |
| ruleZones | {37.5,162.5,125,200}, {662.5,162.5,125,200} | {162.5,287.5,200,125} | 없음 |
| goalPosts | (37.5,187.5)(37.5,337.5)(787.5,187.5)(787.5,337.5) | (187.5,412.5)(337.5,412.5) | 없음 |
| cornerCuts | `M37.5,62.5 L62.5,37.5` `M762.5,37.5 L787.5,62.5` `M787.5,462.5 L762.5,487.5` `M62.5,487.5 L37.5,462.5` | `M37.5,387.5 L62.5,412.5` `M462.5,412.5 L487.5,387.5` | 없음 |
| spotMarks | (125,262.5)(700,262.5) | (262.5,325) | 없음 |
| grid | 6×5, 125×90, origin(37.5,37.5) | 5×3, 90×125, origin(37.5,37.5) | **21×18, 25×25, origin(0,0)** |

> **※ 코트 외곽 마진 각주 (2026-08-10, 기현 지시).** 위 표는 옛 표에서 **사방 +12.5 px 옮긴**
> 값이다. 마진을 **1.0 → 1.5 m** 로 넓혔다: 킥인·코너 세트피스는 라인 밖 배치가 필수인데
> (D26) 1.0 m 로는 휠체어(길이 1.5 m)가 라인 밖에 온전히 서지 못했다.
> · **경기면 실치수는 그대로다**(30×18 m, 18×15 m) — 마진은 코트를 줄이는 것이 아니라 판을
>   넓히는 것이라 viewBox 가 사방 12.5 px 씩 커졌다.
> · flat 의 viewBox 는 **half 와 정확히 같아야 한다**(D12 무손실 전환의 전제)라 같이 커졌고,
>   1 m 격자가 20×17 → 21×18 이 됐다(축 헤더도 a..t → a..u, 1..17 → 1..18).
> · `model/defaults.ts` 의 기본 배치(FULL/HALF/FLAT_POSITIONS·BALL)도 같은 +12.5 를 받았다 —
>   안 옮기면 기본 포메이션이 0.5 m 치우친다.
> · 네 변의 여백은 `court.test.ts` 의 '코트 외곽 마진' 불변식이 붙잡는다.
| home / away heading | 90° / 270° | 90° / 270° | 90° / 270° |
| desc | 프로토타입 `courtDefs` 문자열 그대로 | 〃 | 〃 |

`desc` 는 `logic.js` 의 한국어 설명 3개를 그대로 옮긴다.

**검증**: 750/30 = 450/18 = 25 px/m ✓ · 골 폭 150 px = 6 m ✓ · 골 지역 125×200 px = 5×8 m ✓
· flat 525/25 = 21, 450/25 = 18 (나머지 0) ✓

> **※ 정정 각주 (2026-08-13, 6.3). 위 시그니처·표에서 세 가지가 무효다.**
>
> **① 풀 코트는 3단이다** (5.1 · §9 결정 ②, FIPFA Laws 2025). `COURT_DEFS[mode]` 를 직접
> 읽으면 풀 코트는 **언제나 30×18** 로 읽힌다 — 크기를 아는 코드는 전부
> `courtDefFor(mode, size)` 를 지난다. 좌표는 손으로 세 벌 적지 않고 `buildFullCourt(m, m)`
> 하나가 파생시킨다(리터럴 금지 규칙 10).
>
> | `CourtSize` | 규정상 자리 | vbW × vbH | surface | grid 칸 |
> |---|---|---|---|---|
> | `'30x18'` (기본) | 최대 | 825 × 525 | 37.5,37.5,750,450 | 125 × 90 |
> | `'28x15'` | 표준(농구 코트) | 775 × 450 | 37.5,37.5,700,375 | 116.67 × 75 |
> | `'25x14'` | 최소 | 700 × 425 | 37.5,37.5,625,350 | 104.17 × 70 |
>
> **크기에 비례하는 것은 경기면 사각형뿐이다.** 골대 폭(6 m)·골 지역(8×5 m)·페널티 마크
> (3.5 m)·코너 삼각형(1 m)·마진(1.5 m)은 Laws 가 절대 치수로 적는다. 격자는 **칸 수 6×5 를
> 유지**하고 칸의 치수만 달라진다. **하프·플랫은 3단을 따라가지 않는다**(근거 셋은
> `court.ts` 의 `COURT_DEFS.half` 머리말). 기본값을 `'28x15'` 로 옮기면 안 되는 이유도
> 그 파일의 ⚠️ 에 있다 — 옛 드릴이 전부 작은 코트에서 열려 선수가 라인 밖에 선다.
>
> **② `CourtDef` 에 필드 둘이 더 있다** (5.2 · 5.3):
> `encroachMarks: string[]` — 코너킥 인크로치먼트 마크(Laws 2025 신설). **각 골포스트
> 안쪽 1 m** 에서 골라인에 수직으로 필드 밖 0.5 m. 풀 4개 · 하프 2개 · 플랫 0개.
> 기준점이 코너가 아니라 **포스트**인 것이 핵심이다(코너 삼각형도 마침 1 m 라 헷갈린다).
> `centerMark: string \| null` — 하프라인 중점의 15 cm "X". **풀 코트만** 값이 있다.
>
> **③ 좌표 조회 함수들이 `size` 를 받는다**: `courtDefFor(mode, size?)` ·
> `gridCellCenter(mode, col, row, size?)` · `cellLabelAt(mode, p, size?)` ·
> `isOnSurface(mode, p, size?)` · `clampToViewBox(mode, p, size?)`.
> ⚠️ `clampToViewBox` 에서 `size` 를 빼먹으면 25×14 드릴(vb 700×425)의 좌표가 825×525 로
> 클램프돼 **판 밖 개체가 그대로 살아남는다**.

### 3.3 격자 — `src/model/grid.ts` (좌표 전량 계산 확정)

```ts
export interface GridGeom {
  vx: number[]; hy: number[];                        // 전체 선
  inner: { vx: number[]; hy: number[] };             // 코트 라인과 겹치지 않는 내부선만 그린다
  major?: { vx: number[]; hy: number[] };            // flat 전용 5 m 강조선
  cells: { text: string; x: number; y: number; col: number; row: number }[];
  axis?: { text: string; x: number; y: number }[];   // flat 전용 축 헤더
}
export function gridGeom(mode: CourtMode): GridGeom;   // 모듈 레벨 Map 캐시 필수 (§6.4)
```

**full** — 6열 × 5행, 5 m × 3.6 m
```
vx = 25,150,275,400,525,650,775      inner.vx = 150,275,400,525,650
hy = 25,115,205,295,385,475          inner.hy = 115,205,295,385
셀 중심 x = 87.5,212.5,337.5,462.5,587.5,712.5 · y = 70,160,250,340,430   (a1 … f5)
```
x=150·650 은 골 지역 라인과, x=400 은 하프라인과 정확히 일치한다.

**half** — 5열 × 3행, 3.6 m × 5 m
```
vx = 25,115,205,295,385,475          inner.vx = 115,205,295,385
hy = 25,150,275,400                  inner.hy = 150,275
셀 중심 x = 70,160,250,340,430 · y = 87.5,212.5,337.5   (a1 … e3)
```
y=275 는 하프 코트 골 지역 상단 라인과 일치한다.

**flat** — 1 m 격자, 20열 × 17행
```
vx = 0,25,…,500 (21개)   hy = 0,25,…,425 (18개)   inner = 양끝 제외
major.vx = 0,125,250,375,500   major.hy = 0,125,250,375
셀 중심 x = 12.5 + 25·i (i=0…19) · y = 12.5 + 25·j (j=0…16)   (a1 … t17)
```
셀 라벨 340개는 판독 불가 노이즈이므로 **축 헤더**만 그린다(스프레드시트 방식):
열 문자 `x = 12.5+25i, y = 9`, 행 숫자 `x = 8, y = 12.5+25j`, Space Grotesk 10px, opacity .30.
셀 주소 체계(`a1 … t17`)는 그대로 유지되고 인스펙터·라이브 리전이 정확히 읽어 준다.

**스타일**

| 항목 | 값 |
|---|---|
| 선 | `stroke="#ffffff" stroke-width="1" opacity=".22" shape-rendering="crispEdges"` |
| flat 강조선 | 같은 색 `opacity=".34"` |
| 셀 라벨(full/half) | `fill="#ffffff" opacity=".20"` Space Grotesk 18px/600 `text-anchor=middle dominant-baseline=central` |
| 그룹 | `<g aria-hidden="true" pointer-events="none">` **필수** |

격자 라벨은 코트 대비 1.5:1 이하로 어떤 WCAG 기준도 통과하지 못한다 — REQUIREMENTS 가 요구한
"흐릿하게" 그 자체이므로 **장식으로 취급**한다. 셀 주소의 권위 있는 출처는 인스펙터 텍스트와
`aria-live` 리전이고 그쪽은 `--text` 대비(15:1)를 쓴다.

### 3.4 휠체어 — `src/model/chair.ts`

```ts
export type DragZone = 'towRear' | 'translate' | 'spin' | 'towFront';
export const DRAG_ZONES = ['towRear', 'translate', 'spin', 'towFront'] as const;

/** 저장형(디스크·IDB·JSON). angleDeg 는 [-180,180) 로 랩되고 0.1° 로 반올림된다. */
export interface StoredChairPose { x: number; y: number; angleDeg: number }
/** 런타임형(물리·렌더). theta 는 rad, 드래그 중에는 연속(unwrapped). */
export interface ChairPose { x: number; y: number; theta: number }

export const poseFromStored = (p: StoredChairPose): ChairPose =>
  ({ x: p.x, y: p.y, theta: storedDegToRad(p.angleDeg) });
export const poseToStored = (p: ChairPose): StoredChairPose =>
  ({ x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10, angleDeg: radToStoredDeg(p.theta) });

export interface ZoneConfig {
  sTowRearMax: number; sSpinMin: number; sTowFrontMin: number; grabPadPx: number;
}
/** 잡은 점을 body frame 으로. ax = 축 방향(부호), lat = 측방(부호). 단위 px. */
export function projectGrab(pose: ChairPose, p: Vec2): { ax: number; lat: number; s: number };
export function classifyZone(s: number, z: ZoneConfig): DragZone;
//  s <= sTowRearMax → towRear / < sSpinMin → translate / < sTowFrontMin → spin / else towFront
export function chairCorners(p: ChairPose): [Vec2, Vec2, Vec2, Vec2];
export function pointAtLever(p: ChairPose, leverPx: number): Vec2;   // 피벗 + lever·u(θ)
```

**피벗 원점 렌더 규약 (프로토타입에서 바뀐 부분 — 렌더 담당 필독)**

저장하는 `(x, y)` 는 **피벗(머리)** 이다. 프로토타입 `frames`/`halfFrames` 의 좌표는 **기하 중심**이므로,
프로토타입 데이터를 옮길 때는 반드시 `pivot = centroid − 11.25·u(θ)` 로 변환해야 한다.
(§3.9 기본 배치 표는 이미 변환된 **피벗 좌표**다.)

```xml
<g>  <!-- writer 가 transform="translate(x y) rotate(deg)" 를 직접 기록. JSX 에는 transform 없음 -->
  <rect x="-7.5" y="-12.5" width="37.5" height="25" rx="5"
        fill="{teamColor}" stroke="rgba(255,255,255,.92)" stroke-width="2.2"/>
  <!-- 볼가드 s∈[0.85,1.00] — 전방 견인 존의 시각적 힌트 -->
  <rect x="24.375" y="-12.5" width="5.625" height="25" rx="2"
        fill="rgba(255,255,255,.24)" stroke="rgba(255,255,255,.92)" stroke-width="1.4"/>
  <!-- 머리 = 피벗 = 원점.  프로토타입은 centroid−12 = 피벗−0.75 였다(사실상 피벗) -->
  <circle cx="0" cy="0" r="4.2" fill="rgba(255,255,255,.92)"/>
  <g transform="translate(11.25 0)">
    <g>  <!-- writer 가 transform="rotate(-deg)" 를 기록. 등번호는 절대 회전하지 않는다 -->
      <text x="0" y="0" font-family="'Space Grotesk',sans-serif" font-size="20" font-weight="700"
            fill="{inkFor(teamColor)}" text-anchor="middle" dominant-baseline="central">{num}</text>
    </g>
  </g>
</g>
```

**등번호 역회전은 필수다.** 그룹 전체를 `rotate(θ)` 하면 풀 코트 상대팀 번호가 180° 뒤집히고
하프 코트는 양팀이 90° 눕는다. 프로토타입은 회전 대신 오프셋만 줬으므로 항상 정립이었다.
§7.5 "색에 의존하지 않는 팀 구분"의 근거가 등번호이므로 이건 접근성 요건이기도 하다.

### 3.5 드릴 스키마 — `src/model/drill.ts`

```ts
export type PoseMap<K extends string, P> = Partial<Record<K, P>>;
export type TeamSide = 'home' | 'away';

export interface ChairDef {
  id: ChairId; team: TeamSide;
  number: string;      // 화면에 그대로 찍는 값. 'G'|'2'|'3'|'4' (1~3자)
  isGk: boolean;
  role?: string;       // 'GK'|'DF'|'WG'|'PM' — 명단 패널 우측 라벨 (인스펙터 역할 셀렉트가 채움)
  name?: string;       // '플레이메이커' — 인스펙터 이름 입력이 채움
  color?: string;      // 지정 시 팀 색 무시 — 인스펙터 개별 색 스와치가 채움
}
export interface BallDef { id: BallId }
export interface ConeDef { id: ConeId; colorIndex: 0 | 1 }
export interface DrillCast { chairs: ChairDef[]; balls: BallDef[]; cones: ConeDef[] }

export type ArrowKind = 'move' | 'pass' | 'shot';
export interface Arrow {
  id: ArrowId; kind: ArrowKind;
  from: Vec2; ctrl: Vec2; to: Vec2;     // 2차 베지에
  color?: string;                        // kind 기본색을 무시할 때만 (인스펙터 색 스와치)
}
export interface ArrowStyle { color: string; width: number; dash: string }
export const ARROW_STYLES: Record<ArrowKind, ArrowStyle> = {
  move: { color: '#38bdf8', width: 3.4, dash: '' },
  pass: { color: '#fbbf24', width: 3,   dash: '9 9' },
  shot: { color: '#fbbf24', width: 5,   dash: '' },
};
export const arrowColor = (a: Arrow): string => a.color ?? ARROW_STYLES[a.kind].color;
export function arrowPath(a: Arrow): string;   // `M${from} Q${ctrl} ${to}`, 좌표 0.01 반올림
/** bow = 직선 대비 최대 처짐(px). 양수 = 진행방향 우측(화면상 시계방향).
 *  2차 베지에의 t=0.5 편차는 제어점 이동량의 1/2 이므로 2배로 보정한다. */
export function defaultCtrl(from: Vec2, to: Vec2, bow?: number): Vec2;
export function moveEndpoint(a: Arrow, which: 'from' | 'to', p: Vec2): Arrow;

export interface NoteLabel {
  id: NoteId; x: number; y: number; text: string;
  size?: number;                      // px, 기본 14 — 인스펙터 크기 셀렉트
  color?: string;                     // 기본 '#ffffff'
  align?: 'start' | 'middle' | 'end'; // 기본 'middle'
}

export interface DrillStep {
  id: StepId;
  name: string;                       // ≤40자
  note: string;                       // ≤600자
  durationMs?: number;                // 이 스텝만 재생 간격 override
  chairs: PoseMap<ChairId, StoredChairPose>;
  balls:  PoseMap<BallId, Vec2>;
  cones:  PoseMap<ConeId, Vec2>;
  arrows: Arrow[];
  notes:  NoteLabel[];
}

export type DrillLevel = '초급' | '중급' | '고급';
export const DRILL_LEVELS = ['초급', '중급', '고급'] as const;
export interface TeamStyle { label: string; color: string; gkColor: string }
export const CURRENT_DRILL_SCHEMA = 1;

export interface Drill {
  schemaVersion: number;
  id: DrillId;
  title: string;                      // ≤80자
  category: string;                   // 열린 string (UI 는 KNOWN_CATEGORIES 만 노출)
  level: DrillLevel;
  durationMin: number;                // 훈련 계획용 소요시간(분). 재생 속도와 무관
  tags: string[];                     // ≤12개, 각 ≤24자
  description?: string;
  courtMode: CourtMode;               // 드릴 레벨 불변
  formation: string;                  // 생성 시 쓴 포메이션. 표시용
  teams: Record<TeamSide, TeamStyle>; // 생성 시 prefs 에서 structuredClone 으로 복사
  cast: DrillCast;
  steps: DrillStep[];                 // 최소 1, 최대 60
  createdAt: number; updatedAt: number;
}
```

`TeamStyle` 에서 `ink`/`gkInk` 필드를 **뺐다** — 잉크는 `inkFor(color)` 로 유도한다(§2.9).
저장하면 팀 색만 바꿨을 때 잉크가 낡는다.

**`teams` 복사는 반드시 `structuredClone`.** 얕은 복사는 `DEFAULT_TEAMS` 의 `TeamStyle` 객체를
공유해서, 설정 화면이 한 번이라도 in-place 수정을 하면 이미 만든 드릴 색까지 같이 바뀐다.
`DEFAULT_TEAMS` 는 `Object.freeze` 로 중첩까지 얼린다.

**렌더 레이어 순서 (고정, per-object z 없음)**
`코트면 → 격자 → 규칙존 → 콘 → 화살표 → 휠체어 → 공 → 메모`

**ID 유일성 스코프 (검증이 이 표대로만 중복을 잡는다)**

| 개체 | 스코프 |
|---|---|
| `ChairId` / `BallId` / `ConeId` | `drill.cast` 안 |
| `StepId` | `drill.steps` 안 |
| `ArrowId` / `NoteId` | **스텝 하나 안에서만.** 스텝 간 동일 id 는 정상이며 **보존한다** |
| `ItemId` | 세션 하나 안 |

스텝 간 동일 `ArrowId` 는 D6(크로스페이드)의 핵심 메커니즘이다. 문서 전역 중복 제거를
하면 `duplicateStep` 으로 만든 모든 드릴이 저장→로드 후 크로스페이드를 잃는다.

### 3.6 presence · 재생 — `src/model/playback.ts`

```ts
export type Presence = 'both' | 'enter' | 'exit' | 'absent';
export function presenceOf<P>(a: P | undefined, b: P | undefined): Presence;
// both→자세 보간 opacity 1 / exit→A 자세 유지 1→0 / enter→B 자세 고정 0→1 / absent→렌더 안 함

export interface RenderChair { id: ChairId; def: ChairDef; x: number; y: number; theta: number; opacity: number }
export interface RenderBall  { id: BallId; x: number; y: number; opacity: number }
export interface RenderCone  { id: ConeId; colorIndex: 0|1; x: number; y: number; opacity: number }
export interface RenderFrame {
  stepIndex: number; t: number;
  chairs: RenderChair[]; balls: RenderBall[]; cones: RenderCone[];
  arrows: Array<Arrow & { opacity: number }>;
  notes: Array<NoteLabel & { opacity: number }>;
}
export function easeStandard(t: number): number;   // cubic-bezier(.4,0,.2,1)
export function interpolateSteps(d: Drill, from: DrillStep, to: DrillStep, e: number): RenderFrame;
export function effectiveStepMs(s: DrillStep, baseMs: number): number;   // s.durationMs ?? baseMs
export function drillTotalMs(d: Drill, baseMs: number): number;
export function sampleDrill(d: Drill, timeMs: number, o: {
  baseMs: number; transitionMs: number; loop: boolean;
}): RenderFrame;
```

**재생 구현은 `sampleDrill` + rAF 단일 경로.** CSS transition 대안은 **삭제**한다 —
스크럽·시크 때문에 `sampleDrill` 은 어차피 필요하고, 두 경로를 두면 루프 경계에서
자동 재생은 미끄러지고 스크럽은 순간이동하는 불일치가 생긴다.

**타임라인 (leading transition — 프로토타입 CSS `.6s` 와 같은 체감)**
```
i        = 현재 스텝 인덱스
localT   = timeMs − stepStart(i)
t        = clamp(localT / transitionMs, 0, 1)
from     = (i > 0) ? steps[i-1] : (loop ? steps[last] : steps[0])
frame    = interpolateSteps(drill, from, steps[i], easeStandard(t))
```
`transitionMs = min(600, baseMs × 0.6)` → 0.5×(2400) 600 · 1×(1500) 600 · 2×(800) 480.

**휠체어 = Hermite + 최단호 각도**
```
φ   = |shortestDelta(θ0, θ1)|,   K = arcTangentK(φ)
d   = |P1 − P0|
rev = dot(P1 − P0, u(θ0)) < 0        // 후진 전환이면 접선을 뒤로
sg  = rev ? −1 : +1
m0  = sg·K·d·u(θ0),  m1 = sg·K·d·u(θ1)
P(e) = h00·P0 + h10·m0 + h01·P1 + h11·m1        (표준 3차 Hermite 기저)
θ(e) = lerpAngle(θ0, θ1, e)                     // 끝점 헤딩 정확 일치 보장
```
`d ≈ 0`(제자리 회전 전환) → `m0 = m1 = 0` → 위치 고정 + 각도만 회전. 자연 축퇴.

**공·콘 = 선형** + `easeStandard`. `shot` 화살표와 같은 스텝의 공은 `easeOutQuad`.

**화살표·메모도 `presenceOf` 로 처리한다.**
`both` → `from/ctrl/to` 각 성분을 선형 보간, `kind`·`color`·`text` 는 to 쪽 값, opacity 1.
출력 배열은 id 로 유일해야 한다(§10.5 테스트로 강제).

`easeStandard` 는 Newton–Raphson 4회 + 이분 보정의 표준 cubic-bezier 솔버를 쓰되,
**모듈 로드 시 129점 LUT 를 만들고 그 배열을 소스에 하드코딩**한다(결정성 테스트가 부동소수
초기화 순서에 의존하지 않도록).

### 3.7 편집 연산 — `src/model/edits.ts`

전부 순수 함수, 새 `Drill` 반환. 변화 없으면 **동일 참조**를 반환한다(리렌더·히스토리 억제).

```ts
export function addBall(d: Drill, i: number, at: Vec2): Drill;
export function addCone(d: Drill, i: number, at: Vec2, colorIndex: 0|1): Drill;
/** cast 에 이미 있는 휠체어를 stepIndex..끝 에 배치. 이미 pose 가 있으면 no-op */
export function placeChair(d: Drill, i: number, id: ChairId, pose: StoredChairPose): Drill;
/** cast 에 새 휠체어 등록 + 배치. 팀당 4 초과면 원본 그대로 반환 */
export function addChair(d: Drill, i: number, def: Omit<ChairDef,'id'>, pose: StoredChairPose): Drill;
/** 표시 속성만 갱신 (전 스텝 무영향). team 은 바꿀 수 없다 */
export function updateChairDef(d: Drill, id: ChairId, patch: Partial<Omit<ChairDef,'id'|'team'>>): Drill;

// 오버로드로 id ↔ pose 상관을 강제한다. 단일 유니온이면 휠체어에 {x,y} 를 넣어도 컴파일된다
// (실측 확인) → step.chairs[id].angleDeg === undefined → rotate(NaN) → 그 칩이 화면에서 사라진다.
export function setPose(d: Drill, i: number, id: ChairId, p: StoredChairPose): Drill;
export function setPose(d: Drill, i: number, id: BallId,  p: Vec2): Drill;
export function setPose(d: Drill, i: number, id: ConeId,  p: Vec2): Drill;

export function removeFromStepOnward(d: Drill, i: number, id: CastId): Drill;   // 기본 '삭제'
export function removeFromThisStepOnly(d: Drill, i: number, id: CastId): Drill;
export function removeEverywhere(d: Drill, id: CastId): Drill;                  // cast + 전 스텝
export function propagateForward(d: Drill, i: number, id: CastId): Drill;
export function addStepAfter(d: Drill, i: number): Drill;      // 직전 스텝 복제, 이름 '스텝 N'
export function duplicateStep(d: Drill, i: number): Drill;
export function deleteStep(d: Drill, i: number): Drill;        // steps.length === 1 이면 no-op
export function moveStep(d: Drill, from: number, to: number): Drill;
export function setArrow(d: Drill, i: number, a: Arrow): Drill;
export function removeArrow(d: Drill, i: number, id: ArrowId): Drill;
export function setNote(d: Drill, i: number, n: NoteLabel): Drill;
export function removeNote(d: Drill, i: number, id: NoteId): Drill;

/** '없음' 은 오직 키 삭제로만 표현한다. `{...m, [k]: undefined}` 는 절대 금지.
 *  structuredClone(IDB)은 undefined 키를 보존하고 JSON 은 지운다(실측) →
 *  같은 드릴이 export→import 왕복으로 의미가 바뀐다. */
export function omitKey<K extends string, P>(m: PoseMap<K,P>, k: K): PoseMap<K,P>;
```

**시간축 규약: 추가도 삭제도 "이 스텝부터 끝까지".** 스텝은 시간 순 스냅샷이므로 대칭이다.
명단 패널에서 pose 없는 cast 항목은 흐리게 + **[배치] 버튼**을 반드시 노출한다
(안 그러면 하프 코트 기본값의 홈 GK 가 영원히 코트에 올라갈 수 없다).

### 3.8 검증·보정 — `src/model/validate.ts`

zod 등 런타임 스키마 라이브러리는 도입하지 않는다(의존성 0, 오프라인 번들 크기).
**절대 throw 하지 않는다** — 파일에서 온 임의 JSON 을 먹어도 된다.

```ts
export interface ValidationIssue { path: string; message: string }
export interface Repair { path: string; message: string; destructive: boolean }
export type ValidateResult<T> =
  | { ok: true; value: T; repairs: Repair[] }
  | { ok: false; issues: ValidationIssue[] };
export function validateDrill(doc: unknown): ValidateResult<Drill>;
export function validateSession(doc: unknown): ValidateResult<TrainingSession>;

export const LIMITS = {
  titleLen: 80, stepNameLen: 40, noteLen: 600, tagCount: 12, tagLen: 24,
  maxSteps: 60, maxBalls: 10, maxChairsPerTeam: 4,
  maxCones: 2000,                 // REQUIREMENTS 는 '제한 없음' — 이건 깨진 파일 방어용 상한
  maxArrowsPerStep: 40, maxNotesPerStep: 20, maxSessionItems: 40,
} as const;
```

**보정 파이프라인 — 이 순서를 지킨다 (순서가 바뀌면 불변식이 깨진다)**

```
1. 타입·필수 필드 (실패 → ok:false: id 없음/문자열 아님, courtMode 3종 아님,
                    steps 배열 아님, schemaVersion 이 현재보다 큼)
2. formation 정규화: FORMATIONS 에 없으면 '1-2-1'      ← defaultStep 호출보다 반드시 먼저
3. id 중복 제거 (§3.5 스코프 표대로만)
4. cast 상한: 공 10, 팀당 휠체어 4, 콘 2000 (뒤에서 절단)
5. cast 에 없는 pose 키 삭제                            ← 반드시 4 다음
6. 좌표 유한성: !Number.isFinite(x|y) 인 개체는 클램프가 아니라 제거
7. 휠체어 angleDeg 가 유한수 아니면 0, |a| > 36000 이면 ((a%360)+360)%360
8. clampToViewBox
9. 반올림: 좌표 0.1 px / 각도 0.1°
10. 스텝·화살표·메모·태그·문자열 길이 상한 절단
11. steps 빔 → defaultStep(courtMode, 2에서 정규화된 formation, 4~5를 거친 cast)
```

`defaultStep(mode, f: string, cast)` 은 시그니처를 `string` 으로 넓히고 내부에서
`FORMATIONS.includes(f) ? f : '1-2-1'` 로 폴백한다(이중 방어).

**상한 초과 정책**

| 항목 | 초과 시 |
|---|---|
| titleLen 80 / stepNameLen 40 / noteLen 600 / tagLen 24 | 절단 (`destructive: true`) |
| tagCount 12 / maxSteps 60 / maxArrowsPerStep 40 / maxNotesPerStep 20 / maxSessionItems 40 | 뒤에서 절단 (`destructive: true`) |
| maxChairsPerTeam 4 / maxBalls 10 / maxCones 2000 | 뒤에서 절단 + 5단계에서 고아 pose 동시 삭제 (`destructive: true`) |
| 그 외 (좌표 클램프·반올림·id 재발급·kind 폴백) | `destructive: false` |

**멱등성 필수**: `validateDrill(validateDrill(x).value).repairs.length === 0`. 이 한 줄이 순서 버그를 전부 잡는다.

### 3.9 기본값 — `src/model/defaults.ts`

```ts
export type FormationName = '1-2-1' | '2-1-1' | '1-1-2';
export const FORMATIONS = ['1-2-1', '2-1-1', '1-1-2'] as const;
export const DEFAULT_TEAMS: Readonly<Record<TeamSide, TeamStyle>>;   // Object.freeze 중첩까지
export function defaultCast(): DrillCast;   // 8칩(home G,2,3,4 / away G,2,3,4) + 공 1, 콘 0
export function defaultStep(mode: CourtMode, f: string, cast: DrillCast): DrillStep;
export function createDrill(init: {
  title?: string; courtMode: CourtMode; category?: string; level?: DrillLevel;
  formation?: FormationName; durationMin?: number; teams?: Record<TeamSide, TeamStyle>;
}): Drill;
```

`DEFAULT_TEAMS` = `{ home: {label:'우리 팀', color:'#d93a3a', gkColor:'#f2c811'},
away: {label:'상대', color:'#1f6bb8', gkColor:'#22a95b'} }`

포메이션 표기의 첫 숫자는 GK 를 포함한다(합 = 4). 1-2-1 = GK / 미드 2 / 포워드 1.

**풀 코트 기본 배치 — 피벗 좌표(px), 홈 θ=0°, 어웨이 θ=180°.**
어웨이는 `(x', y') = (800−x, 500−y)` 점대칭. 공 (400, 250).

| 포메이션 | 팀 | G | 2 | 3 | 4 |
|---|---|---|---|---|---|
| 1-2-1 | home | (62.5, 250) | (310, 115) | (310, 385) | **(352, 250)** |
| 1-2-1 | away | (737.5, 250) | (490, 385) | (490, 115) | **(448, 250)** |
| 2-1-1 | home | (62.5, 250) | (190, 250) | (295, 169) | **(352, 250)** |
| 2-1-1 | away | (737.5, 250) | (610, 250) | (505, 331) | **(448, 250)** |
| 1-1-2 | home | (62.5, 250) | (220, 250) | (355, 133) | (355, 367) |
| 1-1-2 | away | (737.5, 250) | (580, 250) | (445, 367) | (445, 133) |

**검증 실측 (OBB SAT 최소 간격)**: 1-2-1 **36.00 px (1.44 m)** · 2-1-1 **36.00 px** · 1-1-2 **30.00 px**.
공 표면 ↔ 가장 가까운 가드 **13.875 px = 0.555 m**.
(설계안 2 의 원래 값 `4번 = (370/430, 250)` 은 앞범퍼가 x=400 에서 정확히 맞닿고 공이 두 차체
사이에 파묻힌다 — 새 드릴을 만들자마자 초기 관통 상태가 된다. 352/448 로 고쳤다.)

**하프 코트 기본 배치** — 프로토타입 `halfFrames[0]` 을 `pivot = centroid − 11.25·u(θ)` 로 변환.
홈 θ=90°, 어웨이 θ=270°. **홈 GK 는 배치하지 않는다** (cast 에는 있고 pose 만 없다 — D7 의 실사용례).
공 **(250, 121)**.

| 팀 | G | 2 | 3 | 4 |
|---|---|---|---|---|
| home | *(없음)* | (140, 163.75) | (352, 163.75) | (250, 83.75) |
| away | (250, 388.25) | (250, 281.25) | (330, 240.25) | *(없음)* |

검증: 최소 OBB 간격 **16.5 px**, 전 hull 이 viewBox 안, 공 표면 ↔ 홈4 가드 **약 3 px**(볼 소유 상태).

**플랫 코트 기본 배치** — 홈 θ=90° y=120, 어웨이 θ=270° y=305, x = 100/200/300/400 (G,2,3,4 순).
공 (250, 212.5). 검증: 최소 간격 **75 px**, 전 hull 이 viewBox 안.

**불변식 (개발 모드에서 assert)**: `createDrill` 직후 어떤 두 휠체어 OBB 도 겹치지 않고
공 표면과 어떤 가드 사이 간격이 ≥ 2 px 이다.

### 3.10 코트 전환 — `cloneToCourt`

```ts
export function cloneToCourt(d: Drill, mode: CourtMode): Drill;
```
- `half ↔ flat`: viewBox 가 동일(500×425)하므로 **항등 변환**. 좌표·각도 그대로. 라인/규칙존만 달라진다.
- `full ↔ (half|flat)` 및 그 역: **좌표를 옮기지 않는다.** 새 id, 제목에 ` (하프)` 등을 붙이고
  메타데이터와 `cast` 만 복제한 뒤 **배치를 `defaultStep(mode, formation, cast)` 로 리셋**하고
  `description` 앞에 `[코트 전환 — 배치를 다시 만들어야 합니다]` 를 붙인다.

근거: full 30×18 m 와 half 18×15 m 는 실제 규격이 다르고 종횡비도 다르다(비등방 스케일은
각도를 보존하지 못한다). 어떤 아핀 변환으로도 "같은 전술"이 되지 않으므로 조용히 틀린 배치를
만드느니 명시적으로 리셋한다.

### 3.11 요약 · 썸네일 — `src/model/summary.ts`, `src/model/thumb.ts`

저장 시 **색 없는 기하 요약**만 만들고 픽셀은 만들지 않으며, 목록에서 실시간 SVG 로 그린다.
색을 굽지 않는 것이 핵심 — 테마·팀 색을 바꿔도 썸네일이 즉시 따라온다.

```ts
export interface ThumbSpec {
  mode: CourtMode;
  chairs: Array<{ x: number; y: number; a: number; t: 0|1; g: 0|1 }>;   // a = deg, t: 0=home 1=away
  balls: Array<[number, number]>;
  cones: Array<[number, number, 0|1]>;
  /** D5 와 일관되게 path 문자열이 아니라 제어점을 담는다. `d` 는 렌더 시 arrowPath 로 생성 */
  arrows: Array<{ p: [number,number,number,number,number,number]; k: ArrowKind }>;  // from,ctrl,to
}
export const THUMB_CAPS = { chairs: 8, balls: 4, cones: 8, arrows: 3 } as const;
export function buildThumb(d: Drill): ThumbSpec;        // 첫 스텝에서 생성

export const SUMMARY_BUILD = 1;
export interface DrillSummary {
  id: DrillId; build: number;         // = SUMMARY_BUILD. 레코드별 버전 (전역 스윕 금지)
  title: string; category: string; level: DrillLevel;
  durationMin: number; tags: string[]; courtMode: CourtMode; stepCount: number;
  createdAt: number; updatedAt: number;
  teams: Record<TeamSide, TeamStyle>; // 썸네일이 색을 여기서 읽는다 (structuredClone)
  thumb: ThumbSpec;
  searchKey: string;
  corrupt?: true;                     // 본문이 손상돼 열 수 없는 레코드 (§4.4)
}
export function buildSummary(d: Drill): DrillSummary;   // 약 700 B/건
```

**요약 필드 호환 규약**: 필드는 **추가만** 가능. 제거·의미변경이 필요하면 `SUMMARY_BUILD` 가
아니라 `DB_VERSION` 을 올려 스토어를 새로 만든다. 미래 빌드의 요약은 현재가 아는 필드의
상위집합이므로 그대로 읽어 렌더할 수 있다.

**`build` 를 레코드에 두고 지연 재생성한다.** `listDrillSummaries` 가 `build !== SUMMARY_BUILD`
인 레코드를 만나면 그 드릴만 로드해 재생성하고 되쓴다. 전역 `meta.summaryBuild` 비교 +
`rebuildAllSummaries()` 스윕은 (a) 앱 시작을 드릴 전량 역직렬화로 막고 (b) 구·신 번들 탭이
공존할 때 `!==` 비교가 서로를 무한 재생성하는 핑퐁을 만든다. `rebuildAllSummaries()` 는
설정 화면의 수동 '복구' 버튼으로만 남긴다.

**렌더 규약**: 카드 `<svg>` 는 `COURT_DEFS[mode]` 의 viewBox 를 그대로 쓰고
`preserveAspectRatio="xMidYMid meet"`. `CourtSurface` 를 재사용한다.

프로토타입 썸네일 마크업(template.html 176–193행)은 풀 코트 마크업에 `scale(0.4)`,
`translate(0,-4)` 를 적용한 것과 **완전히 동일**함을 역산 검증했다:
`경기면 25,25,750×450 → 10,6,300×180` ✓ · `하프라인 x=400 → 160` ✓ · `센터서클 r=75 → r=30` ✓
· `stroke 4 → 1.6`, `3.25 → 1.3` ✓. 따라서 `CourtThumbnail` 은 `FullCourtLines` 를 그대로 쓴다.
half/flat 은 `scale = min(320/500, 192/425) = 0.45176471`, `translate(47.058824, 0)`.

> **※ 정정 각주 (2026-08-13, 6.3). 위 역산 검산은 세 군데가 무효다** — 그러나 **결론
> ("`CourtThumbnail` 은 `FullCourtLines` 를 그대로 쓴다")은 그대로 유효하다.** 근거만 갱신한다.
>
> 1. **`센터서클 r=75 → r=30` 은 이제 존재하지 않는 도형의 검산이다.** 센터 서클은 5.3(§9
>    결정 ⑧)에서 **삭제**됐다 — Laws 2025 전문 50쪽에 *"circle"* 이 0회 나온다. 지금 그
>    자리에 있는 것은 15 cm "X"(`centerMark`)뿐이고, 3 m 감각은 2.12 의 *공을 따라다니는
>    파선 링*이 맡는다. 이 줄을 근거로 센터 서클을 되살리면 앱이 **파워체어 풋볼에 없는
>    선을 다시 가르친다**(`courtMarks.test.ts` 의 '어느 판에도 센터 서클의 자리가 없다' 가
>    그 가드다).
> 2. **좌표가 사방 +12.5 px 옮겨졌다**(마진 1.0 → 1.5 m, 2026-08-10). 경기면은
>    `25,25,750×450` 이 아니라 `37.5,37.5,750×450` 이고, 하프라인은 x=400 이 아니라 **412.5** 다.
> 3. **`scale`/`translate` 계산은 아예 안 쓴다.** 반응형은 SVG 자체(viewBox)에 맡긴다 —
>    `CourtThumbnail.tsx:59` 가 `viewBox={\`0 0 ${def.vbW} ${def.vbH}\`}` 하나로 끝낸다.
>    그리고 그 `def` 는 `COURT_DEFS[mode]` 가 아니라 **`courtDefFor(mode, size)`** 다(6.4) —
>    썸네일도 코트 크기 3단을 따라간다.

### 3.12 참조 · 세션 — `src/model/refs.ts`, `src/model/session.ts`

"순서 있는 드릴 참조" 는 세션과 (미래의) 드릴 셋이 공유한다. **제네릭이어야 한다** —
`DrillRef[]` 로 좁히면 `SessionItem` 의 추가 필드가 구조적으로 통과하면서 유실되고
타입 검사기가 잡아 주지 못한다(실측 확인: optional 필드라 대입이 에러 없이 통과).

```ts
// refs.ts
export interface DrillRef {
  id: ItemId; drillId: DrillId;
  titleCache: string; durationMinCache: number; categoryCache: string;
}
export function refreshRefs<T extends DrillRef>(
  refs: T[], src: Map<DrillId, Pick<DrillSummary,'title'|'durationMin'|'category'>>): T[];
  //  구현은 반드시 { ...r, titleCache: … } 스프레드 보존
export function resolveRefs<T extends DrillRef>(refs: T[], existing: Set<DrillId>): Array<T & { missing: boolean }>;
export function reorderRefs<T>(list: T[], from: number, to: number): T[];
export function refDrillIds(refs: DrillRef[]): DrillId[];   // 중복 제거된 배열
export function remapRefs<T extends DrillRef>(refs: T[], idMap: Map<DrillId, DrillId>): T[];

// session.ts
export const CURRENT_SESSION_SCHEMA = 1;
export interface SessionItem extends DrillRef {
  durationOverrideMin?: number; note?: string; restAfterMin?: number;
}
export interface TrainingSession {
  schemaVersion: number;
  id: SessionId; title: string; note?: string;
  scheduledAt?: number; location?: string;
  items: SessionItem[];
  drillIds: DrillId[];         // items 에서 파생. putSession 이 무조건 재계산
  createdAt: number; updatedAt: number;
}
export type ResolvedItem = SessionItem & { missing: boolean };
export interface ResolvedSession {
  session: TrainingSession; items: ResolvedItem[]; totalMin: number; missingCount: number;
}
export function resolveSession(s: TrainingSession, existing: Set<DrillId>): ResolvedSession;
export function sessionTotalMin(items: ResolvedItem[]): number;
//  = Σ(미누락 항목의 durationOverrideMin ?? durationMinCache) + Σ(restAfterMin ?? 0)
export function pickNextSession(list: TrainingSession[], now?: number): TrainingSession | null;
/** 로케일 조합 결과가 브라우저마다 달라지지 않도록 직접 조립한다 → "화 19:00" */
export function formatSessionWhen(ms: number): string;
```

**총 시간은 해석된 세션에서만 계산한다.** 목록도 `ResolvedSession[]` 을 준다(§4.5) —
안 그러면 목록이 "52분", 상세가 "총 42분 (누락 1개 제외)" 로 갈린다.

---

## 4. 저장 계층 — `src/storage/`

### 4.1 스키마 버저닝 — `src/model/migrate.ts`

**두 버전을 절대 섞지 않는다.** `DB_VERSION`(IndexedDB) = 스토어·인덱스 *구조*, `upgrade` 담당.
`schemaVersion`(문서) = 레코드 *내용* 구조, **읽기 시점** 마이그레이션 + 기회적 되쓰기.

```ts
export interface DocMigration {
  from: number; to: number; describe: string;
  migrate(doc: Record<string, unknown>): Record<string, unknown>;
}
export const DRILL_MIGRATIONS: DocMigration[] = [];     // v1 에서는 비어 있다
export const SESSION_MIGRATIONS: DocMigration[] = [];
export const PREFS_MIGRATIONS: DocMigration[] = [];

export type MigrateResult =
  | { ok: true; doc: Record<string, unknown>; changed: boolean; applied: string[] }
  | { ok: false; reason: 'too-new'; found: number; supported: number }
  | { ok: false; reason: 'no-path'; found: number };

export function migrateDoc(raw: unknown, chain: DocMigration[], current: number): MigrateResult;
```

구현 요건 (전부 심사 반영):
```ts
if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok:false, reason:'no-path', found:0 };
const doc = structuredClone(raw) as Record<string, unknown>;   // 얕은 복사 금지 — 호출자 오염
const v0 = doc.schemaVersion === undefined ? 1 : doc.schemaVersion;
if (!Number.isInteger(v0) || (v0 as number) < 1) return { ok:false, reason:'no-path', found:Number(v0)||0 };
//  NaN/Infinity/1.5 를 통과시키면 while 루프를 건너뛰고 도장만 찍힌다
```
`found: 0` 은 UI 에서 "알 수 없는 버전" 으로 표시한다.

규칙: **전진 전용** / **모든 읽기 경로(IDB·파일·localStorage)가 체인을 통과** / 각 `migrate` 는
순수하고 그 버전의 필드만 알며 **최신 타입을 import 하지 않는다** / 마이그레이션 후 반드시
`validateDrill` 통과 / v1 릴리스와 함께 `src/test/fixtures/drill.v1.json` 픽스처를 커밋한다.

**예외 1건 (명문화)**: §4.6 의 `index.html` 부트 스크립트는 인라인이라 체인을 import 할 수 없다.
그래서 `spin.prefs.theme` 은 **최상위 문자열 필드이고 `'light'` 값을 영구히 유지한다**는 것을
불변식으로 못박는다. 이 필드의 위치·타입을 바꾸는 마이그레이션은 부트 스크립트를 같은 커밋에서
함께 고쳐야 한다 (`index.html` 과 `prefs.ts` 양쪽 주석에서 상호 참조).

### 4.2 IndexedDB — `src/storage/db.ts`

```ts
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
export const DB_NAME = 'spin';
export const DB_VERSION = 1;
export interface MetaRecord { key: string; value: unknown }

export interface SpinDB extends DBSchema {
  drills:         { key: DrillId;   value: Drill;         indexes: { by_updatedAt: number } };
  drillSummaries: { key: DrillId;   value: DrillSummary;  indexes: { by_updatedAt: number } };
  sessions:       { key: SessionId; value: TrainingSession;
                    indexes: { by_updatedAt: number; by_drillId: DrillId } };
  meta:           { key: string;    value: MetaRecord };
}
export function getDB(): Promise<IDBPDatabase<SpinDB>>;
export function isStorageStale(): boolean;
export function onStorageStale(cb: () => void): void;
export function beginWrite(): void;   /** in-flight 카운터 ++ */
export function endWrite(): void;     /** -- */
export async function ensurePersistence(): Promise<'persisted'|'best-effort'|'unavailable'>;
export async function storagePressure(): Promise<number | null>;   // usage/quota, 0.8 초과면 배너
export function toStorageError(e: unknown, fallback: StorageErrorCode): StorageError;
```

`upgrade` 는 `if (oldVersion < N)` 체인 (`noFallthroughCasesInSwitch`):
```ts
upgrade(db, oldVersion) {
  if (oldVersion < 1) {
    db.createObjectStore('drills', { keyPath: 'id' }).createIndex('by_updatedAt', 'updatedAt');
    db.createObjectStore('drillSummaries', { keyPath: 'id' }).createIndex('by_updatedAt', 'updatedAt');
    const s = db.createObjectStore('sessions', { keyPath: 'id' });
    s.createIndex('by_updatedAt', 'updatedAt');
    s.createIndex('by_drillId', 'drillIds', { multiEntry: true });
    db.createObjectStore('meta', { keyPath: 'key' });
  }
  // if (oldVersion < 2) { /* 예: drillSets 스토어 */ }
}
```

**인덱스를 최소로 유지한다.** `drills.by_category` / `by_tag` / `drillSummaries.by_category` 는
§4.3 의 조회 전략(요약 전량 읽고 메모리 필터)상 **아무도 쓰지 않으면서** 매 `put` 마다 쓰기
비용과 쿼터를 소모하고, 나중에 지우려면 `DB_VERSION` 을 올려야 한다. 넣지 않는다.

**`blocking()` 처리 — DB 를 닫고 재연결을 시도하지 않는다.**
```ts
blocking() {
  needsReload = true;
  void (async () => {
    const t0 = Date.now();
    while (inFlight > 0 && Date.now() - t0 < 3000) await new Promise(r => setTimeout(r, 50));
    (await dbPromise)?.close(); dbPromise = null;
    staleCb?.();          // UI: '새 버전이 열렸습니다. 새로고침하세요' (닫기 불가 모달)
  })();
}
```
닫은 뒤 `getDB()` 가 `openDB('spin', 1)` 을 다시 부르면 디스크 버전(2) > 요청 버전(1) 이라
`VersionError` 로 **영구 실패**한다. 그래서 `needsReload` 면 즉시 reject 한다.
또 `d.close()` 는 진행 중인 쓰기 트랜잭션을 abort 시키므로 in-flight 를 먼저 배수한다.
`terminated()` 는 `dbPromise = null`. 그리고 `dbPromise = openDB(...).catch(e => { dbPromise = null; throw e; })`
로 실패를 캐싱하지 않는다.

**영속화·쿼터**: 앱 부팅과 첫 저장 성공 시 `ensurePersistence()`. `best-effort` 면 대문에
"저장소가 보호되지 않았습니다 — 주기적으로 내보내기" 상시 배너. 서버 백업이 없으므로
origin 축출은 전량 소실이다.

**모든 쓰기는 `await tx.done` 을 한다.** `put()` 의 Promise 만 await 하면 커밋 단계에서 터지는
`QuotaExceededError` 를 놓쳐 "저장 성공처럼 보이는데 드릴이 없는" 상태가 된다.

### 4.3 드릴 리포지토리 — `src/storage/drillRepo.ts`

```ts
export interface DrillQuery {
  category?: string; search?: string;
  sort?: 'updatedAt' | 'createdAt' | 'title';    // 기본 'updatedAt'
  order?: 'asc' | 'desc';                        // 기본 'desc'
  limit?: number; offset?: number;
}
export type DrillLoad =
  | { status: 'ok'; drill: Drill; repairs: Repair[] }
  | { status: 'missing' }
  | { status: 'corrupt'; issues: ValidationIssue[]; raw: unknown }
  | { status: 'too-new'; found: number; supported: number };

export interface DrillRepo {
  listDrillSummaries(q?: DrillQuery): Promise<DrillSummary[]>;
  countDrills(): Promise<number>;
  loadDrill(id: DrillId): Promise<DrillLoad>;
  getDrill(id: DrillId): Promise<Drill | undefined>;   // 'ok' 만 통과
  getRawDrill(id: DrillId): Promise<unknown>;          // 손상본 원본 JSON 내보내기용
  getDrills(ids: DrillId[]): Promise<Map<DrillId, Drill>>;
  putDrill(d: Drill, opts?: { touch?: boolean; expectedUpdatedAt?: number }): Promise<Drill>;
  createDrill(init: CreateDrillInit): Promise<Drill>;
  duplicateDrill(id: DrillId, opts?: { title?: string }): Promise<Drill>;
  deleteDrill(id: DrillId): Promise<void>;
  rebuildAllSummaries(): Promise<number>;
  markOpen(id: DrillId, open: boolean): void;          // 기회적 되쓰기 억제용
}
export const idbDrillRepo: DrillRepo;
export const memoryDrillRepo: DrillRepo;               // 필수 (선택 아님)
export function resolveDrillRepo(): Promise<{ repo: DrillRepo; degraded: boolean }>;
export function normalizeForSearch(s: string): string;
export type ReferrerKind = 'session' | 'drillSet';
export interface Referrer { kind: ReferrerKind; id: string; title: string }
/** 드릴 셋이 추가돼도 이 함수 안에서만 한 줄 늘어난다. findSessionsUsing 은 두지 않는다. */
export function findReferrers(id: DrillId): Promise<Referrer[]>;
```

**`putDrill` 계약 (반드시 이대로)**
```ts
assertWritable(d);                    // 값싼 형상 스윕: 모든 pose 의 x,y 가 유한수인지
const summary = buildSummary(next);
beginWrite();
const tx = db.transaction(['drills','drillSummaries'], 'readwrite');
const cur = await tx.objectStore('drills').get(d.id);
if (cur && opts?.expectedUpdatedAt !== undefined && cur.updatedAt !== opts.expectedUpdatedAt) {
  tx.abort(); throw new StorageError('E_CONFLICT', STORAGE_ERROR_MESSAGES.E_CONFLICT());
}
tx.objectStore('drills').put(next);
tx.objectStore('drillSummaries').put(summary);
try { await tx.done; } catch (e) { throw toStorageError(e, 'E_DB_UNAVAILABLE'); } finally { endWrite(); }
bc?.postMessage({ type: 'drill', id: next.id, updatedAt: next.updatedAt });
```
편집기는 로드 시 `updatedAt` 을 baseline 으로 보관하고 저장마다 `expectedUpdatedAt` 로 넘긴다.
`E_CONFLICT` 면 "다른 탭에서 이 드릴이 수정되었습니다 — 덮어쓰기 / 사본으로 저장" 다이얼로그.

**기회적 되쓰기는 조건부 CAS 로만.** `loadDrill` 이 마이그레이션·보정을 감지해도
(a) 그 드릴이 열려 있으면(`markOpen`) 아무것도 하지 않고,
(b) 보정이 **파괴적(`destructive: true`)이면 되쓰지 않는다**(사용자 확인 전에 손실 확정 금지),
(c) 쓸 때는 트랜잭션 안에서 `cur.updatedAt` 과 `cur.schemaVersion` 이 읽었던 그대로일 때만 쓰고,
(d) 반환 Promise 를 `.catch(() => {})` 로 반드시 잡는다.
`void putDrill(...)` 은 사용자의 저장과 레이스해서 편집 내용을 조용히 되돌린다 —
`touch:false` 라 `updatedAt` 도 그대로여서 탐지 자체가 불가능하다.

**손상 레코드**: `loadDrill` 이 `'corrupt'` 를 반환해도 **요약을 지우지 않는다**(지우면 UI 에서
완전히 접근 불가). `corrupt: true` 플래그가 붙은 요약을 남기고 카드에 경고 배지 + [원본 JSON
내보내기] [삭제] 두 버튼을 준다.

`listDrillSummaries` 는 `getAllFromIndex('drillSummaries','by_updatedAt')` 로 전량을 읽고
**메모리에서** 필터·정렬한다(부분일치 검색은 IDB 인덱스로 불가능, 200건 = 140 KB).

```ts
export function normalizeForSearch(s: string): string {
  return s.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
}
// searchKey = [title, category, level, ...tags].map(normalizeForSearch).join('␟')
```
구분자 `␟` 를 넣지 않으면 "크로스"+"공격" 이 이어붙어 "스공" 이 매치된다.
초성 검색이 필요해지면 손댈 지점은 이 함수와 `buildSummary` 의 `searchKey` 두 곳뿐이다.

### 4.4 에러 — `src/storage/errors.ts`

```ts
export type StorageErrorCode = 'E_DB_UNAVAILABLE'|'E_QUOTA'|'E_NOT_FOUND'|'E_CONFLICT'
  |'E_SCHEMA_TOO_NEW'|'E_INVALID_FILE'|'E_UNSUPPORTED_KIND';

/** 파라미터 프로퍼티 금지(erasableSyntaxOnly). 필드를 명시 선언하고 생성자에서 대입한다. */
export class StorageError extends Error {
  readonly code: StorageErrorCode;
  constructor(code: StorageErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);          // lib ES2023 이라 2번째 인자 사용 가능
    this.name = 'StorageError';
    this.code = code;
  }
}
/** 보간 자리가 필요하므로 문자열 상수가 아니라 함수다. */
export const STORAGE_ERROR_MESSAGES: Record<StorageErrorCode, (d?: string) => string> = {
  E_DB_UNAVAILABLE: () => '저장소를 열 수 없습니다. 이번 세션 동안만 유지됩니다.',
  E_QUOTA: () => '저장 공간이 부족합니다. 드릴을 정리하거나 내보낸 뒤 삭제하세요.',
  E_NOT_FOUND: () => '드릴을 찾을 수 없습니다.',
  E_CONFLICT: () => '다른 탭에서 이 드릴이 수정되었습니다. 덮어쓰기 / 사본으로 저장 중 선택하세요.',
  E_SCHEMA_TOO_NEW: () => '더 새로운 버전의 SPIN에서 만든 파일입니다. 앱을 업데이트하세요.',
  E_INVALID_FILE: () => 'SPIN 파일이 아니거나 손상되었습니다.',
  E_UNSUPPORTED_KIND: (d) => `이 버전에서 지원하지 않는 파일 종류입니다${d ? ` (${d})` : ''}.`,
};
```

### 4.5 세션 리포지토리 — `src/storage/sessionRepo.ts`

```ts
export function listSessions(): Promise<ResolvedSession[]>;       // 해석해서 준다
export function getSession(id: SessionId): Promise<ResolvedSession | undefined>;
export function putSession(s: TrainingSession): Promise<TrainingSession>;
export function createSession(init: { title: string; scheduledAt?: number; location?: string }): Promise<TrainingSession>;
export function deleteSession(id: SessionId): Promise<void>;
export function addDrillToSession(id: SessionId, drillId: DrillId): Promise<TrainingSession>;
export function reorderSessionItems(id: SessionId, from: number, to: number): Promise<TrainingSession>;
export function upcomingSession(): Promise<ResolvedSession | undefined>;
```

**`sessions.put` 을 모듈 밖으로 노출하지 않는다.** 모든 쓰기가 `putSession` 을 통과하고,
`putSession` 은 무조건 `drillIds = refDrillIds(items)` 를 **재계산**한다.
`validateSession` 도 파일의 `drillIds` 를 신뢰하지 않고 `items` 에서 재계산한다(불일치는 repair).
이 인덱스가 `deleteDrill` 앞 경고("이 드릴은 세션 2개에서 사용 중입니다")의 유일한 방어선이다.

캐시 갱신(`refreshRefs`)의 소스는 **드릴 전문이 아니라 요약**이다 (8개 세션이면 100 KB → 5.6 KB).
캐시 되쓰기도 `expectedUpdatedAt` 전제조건을 통과해야 한다.

드릴 삭제는 캐스케이드하지 않고 차단하지도 않는다. `missing` 은 **저장하지 않고 로드 시 파생**
한다 — 같은 id 로 다시 가져오면 자동 복구된다.

### 4.6 설정 — `src/storage/prefs.ts`

localStorage 를 쓰는 이유: 테마는 **첫 페인트 전에 동기로** 읽어야 한다(IDB 는 비동기 → FOUC).
체육관 조명 대응이 설정 목적인 앱에서 매 실행마다 흰 화면이 번쩍이면 본말전도다.

```ts
export const PREFS_KEY = 'spin.prefs';
export const UI_KEY = 'spin.ui';        // ※ 정정 2026-08-13: 삭제됨 (아래 각주)
export const CURRENT_PREFS_SCHEMA = 1;  // ※ 정정 2026-08-13: 지금은 2 (3.0 이 v1→v2)

export interface PhysicsParams {
  zones: ZoneConfig;
  linearKmh: number; bumperKmh: number;
  editorSpeedMultiplier: number;     // 1.0 기본. 드래그/놓은 뒤 이어가기에만 적용 (§5.11)
}
/** 중첩을 타입에서 푼다. Partial<PhysicsParams> 는 zones 를 부분 저장할 수 없어
 *  슬라이더 하나만 만져도 나머지 기본값이 박제된다. */
export type PhysicsOverride =
  Partial<Omit<PhysicsParams, 'zones'>> & { zones?: Partial<ZoneConfig> };

export interface Preferences {
  schemaVersion: number;
  theme: 'dark' | 'light';
  playbackSpeed: 0.5 | 1 | 2;
  loop: boolean;
  showGrid: boolean; showGridLabels: boolean; showRuleZones: boolean;
  teams: Record<TeamSide, TeamStyle>;
  defaultFormation: FormationName;
  defaultCourtMode: CourtMode | null;
  present: { autoFullscreen: boolean; wakeLock: boolean };
  a11y: { largeTargets: boolean; uiScale: 1 | 1.15 | 1.3;
          reduceMotion: 'system' | 'always';
          singleKeyShortcuts: 'on' | 'modifier' | 'off' };
  hints: { iosPwa: boolean; degradedStorage: boolean };
  physics: PhysicsOverride;
}
export const makeDefaultPrefs: () => Preferences;   // 상수 대신 팩토리 (공유 객체 유출 방지)
export function loadPrefs(): Preferences;           // 동기. migrate → validatePrefs
export function savePrefs(p: Preferences): boolean; // false = 저장 실패 (Safari 프라이빗 등)
export function patchPrefs(patch: Partial<Preferences>): { prefs: Preferences; persisted: boolean };
export function validatePrefs(raw: unknown): { value: Preferences; repairs: Repair[] };
export function resolvePhysics(p: Preferences): PhysicsParams;
export function prunePhysics(v: PhysicsParams | PhysicsOverride): PhysicsOverride;
export function resetPrefs(): void;
```

`savePrefs` 는 **절대 throw 하지 않는다** — Safari 프라이빗 모드는 `setItem` 을 매번
`QuotaExceededError` 로 던지고, React 이벤트 핸들러(테마 토글) 안에서 던지면 에러 바운더리까지
올라가 화면이 날아간다. 최초 실패 1회만 "설정이 이 탭에서만 유지됩니다" 토스트.

**`validatePrefs` 는 반드시 있어야 한다** (마이그레이션은 버전 전환이지 값 검증이 아니다):
```
theme:            raw === 'light' ? 'light' : 'dark'
playbackSpeed:    (raw === 0.5 || raw === 2) ? raw : 1
                  ← 1.5 를 통과시키면 STEP_INTERVAL_MS[1.5] = undefined → transitionMs = NaN
                    → 재생이 조용히 멈춘다
boolean 필드:     typeof === 'boolean' ? raw : 기본값
defaultCourtMode: COURT_MODES.includes(raw) ? raw : null
defaultFormation: FORMATIONS.includes(raw) ? raw : '1-2-1'
teams:            각 색을 /^#[0-9a-f]{6}$/i 로 검사, 실패 시 DEFAULT_TEAMS 대응값
```

**`resolvePhysics` 는 존 경계를 강제로 정렬·클램프한다** (역전된 값이 저장돼 있으면
`classifyZone` 이 항상 `towRear` 를 돌려줘 4존 조작이 통째로 죽는다):
```ts
const z = { ...DEFAULT_ZONES, ...(p.physics.zones ?? {}) };
const sTowRearMax  = clamp(z.sTowRearMax, 0.04, 0.18);
const sSpinMin     = clamp(z.sSpinMin, sTowRearMax + 0.04, 0.45);
const sTowFrontMin = clamp(z.sTowFrontMin, sSpinMin + 0.10, 0.96);
const linearKmh    = clamp(p.physics.linearKmh ?? 10, 4, 16);
const bumperKmh    = clamp(p.physics.bumperKmh ?? 30, 10, bumperKmhMax(linearKmh));
```

**설정 화면에 노출하는 물리 항목** (슬라이더는 서로를 밀어내 순서 불변식을 유지)

| 항목 | 기본 | 범위 | 단위 |
|---|---|---|---|
| 후방 견인 경계 | 0.12 | 0.04 – 0.18, step 0.01 | 차체 길이 비율 |
| 제자리 회전 시작 | 0.32 | 0.22 – 0.45, step 0.01 | 〃 |
| 전방 견인 시작 | 0.85 | 0.60 – 0.96, step 0.01 | 〃 |
| 전후진 속도 상한 | 10 | 4 – 16, step 0.5 | km/h |
| 회전(앞범퍼) 속도 상한 | 30 | 10 – `bumperKmhMax(linear)`, step 1 | km/h |
| 편집 속도 배수 | 1.0 | 1 – 4, step 0.5 | 배 |

**FOUC 방지 부트 스크립트** — `index.html` `<head>` 안, 스타일시트보다 먼저:
```html
<script>try{var p=JSON.parse(localStorage.getItem('spin.prefs')||'{}');
document.documentElement.dataset.theme=p.theme==='light'?'light':'dark'}
catch(e){document.documentElement.dataset.theme='dark'}</script>
```
⚠️ 이 스크립트가 첫 페인트 전에 읽으므로 **`spin.prefs` 의 `theme` 은 최상위 문자열로 남아야
한다.** 중첩시키거나 이름을 바꾸면 매 실행마다 흰 화면이 번쩍인다(재편 내내 지킨 불변식이다).

> **※ 정정 각주 (2026-08-13, 6.3). §4.6 에서 무효가 된 것 넷.**
>
> **① `UI_KEY = 'spin.ui'` 는 삭제됐다** (5.0 ④). 호출자 0곳인 죽은 export 였다.
> `src/storage/prefs.test.ts:443` 이 *"UI_KEY 는 이 모듈에 없다"* 를 **부재 단언**으로
> 지킨다 — 되살리면 그 테스트가 빨개진다.
>
> **② `CURRENT_PREFS_SCHEMA` 는 2 다** (3.0 ★E-6 이 v1→v2 를 **한 커밋에** 올렸다).
> 나눠서 올렸으면 `PREFS_MIGRATIONS` 를 네 번 손보고 3차·5차에 만든 백업 파일이 서로 다른
> 스키마가 됐을 것이다.
>
> **③ `Preferences` 에 필드가 늘었다.** v2 에서 더해진 것: `inspectorPinned`(결정 ③A —
> PC 인스펙터 고정 핀) · `a11y.sound`(놓임·막힘·상자 빔의 소리+진동. **한 스위치다** —
> 쪼개면 사용자가 구분할 수 없는 두 상태가 생긴다) · `a11y.twoZone`(결정 ④, 기본 OFF) ·
> `tray: { draw, note }`(§3 트레이 서랍 2개의 개폐) · `seeded`(seed 드릴 1회성 도장).
> ⚠️ **`src/storage/prefs.ts` 의 화이트리스트 조립부에 이름이 없는 필드는 localStorage
> 왕복에서 소리 없이 사라진다** — 필드를 더할 때 세 곳(`makeDefaultPrefs` · `validatePrefs`
> · `PREFS_MIGRATIONS`)을 같이 손봐야 하는 이유다.
>
> **④ `resolvePhysics` 의 리터럴은 상수로 옮겨졌다.** 위 코드블록의 `?? 10` / `?? 30` 은
> 지금 `DEFAULT_LIMITS.linearKmh` / `.bumperKmh` 다(§2.5). 값은 같다.
>
> **아직 사실인 것**(재편이 건드리지 않았다): `savePrefs` 는 절대 throw 하지 않는다 ·
> `validatePrefs` 의 화이트리스트 조립 · `resolvePhysics` 의 존 경계 정렬·클램프 ·
> 물리 6종 슬라이더의 기본값·범위 표. 6.1 은 그 6종을 **닫힌 서랍**으로 옮겼을 뿐
> (`git diff src/storage/prefs.ts` 0줄) 판정 경로를 한 글자도 바꾸지 않았다.

### 4.7 내보내기 / 가져오기 — `src/storage/transfer.ts`, `files.ts`

```ts
export const ENVELOPE_VERSION = 1;
export type SpinFileKind = 'drill' | 'session' | 'library' | 'prefs' | 'drillSet';
export interface SpinEnvelopeBase {
  spin: SpinFileKind; envelope: number; app: string; exportedAt: number;
}
export type SpinFile =
  | (SpinEnvelopeBase & { spin: 'drill';    payload: Drill })
  | (SpinEnvelopeBase & { spin: 'session';  payload: { session: TrainingSession; drills: Drill[] } })
  | (SpinEnvelopeBase & { spin: 'library';  payload: Drill[] })
  | (SpinEnvelopeBase & { spin: 'prefs';    payload: Preferences })
  | (SpinEnvelopeBase & { spin: 'drillSet'; payload: unknown });   // 파싱은 되고 커밋만 거부

export type ImportConflict = 'none' | 'identical' | 'exists';
export interface ImportCandidate<T> {
  doc: T; repairs: Repair[]; conflict: ImportConflict;
  existing?: { title: string; updatedAt: number };
}
export type ImportResolution = 'overwrite' | 'copy' | 'skip';
export interface ImportOutcome {
  idMap: Map<DrillId, DrillId>;      // 원본 id → 최종 저장 id ('skip'/'overwrite' 는 항등)
  written: DrillId[]; skipped: DrillId[]; failed: Array<{ id: DrillId; reason: string }>;
}

export function parseSpinFile(text: string): SpinFile;                    // 실패 시 StorageError
export function prepareDrillImport(file: SpinFile): Promise<ImportCandidate<Drill>[]>;
export function prepareSessionImport(file: SpinFile): Promise<{
  drills: ImportCandidate<Drill>[]; session: ImportCandidate<TrainingSession>;
}>;
/** 배치 커밋. 드릴 + 요약을 하나의 readwrite 트랜잭션에서 쓰고, 커밋 직전에 conflict 를 재확인한다 */
export function commitDrillImports(
  items: Array<{ candidate: ImportCandidate<Drill>; resolution: ImportResolution }>
): Promise<ImportOutcome>;
export function commitSessionImport(s: TrainingSession, out: ImportOutcome): Promise<TrainingSession>;
export function exportDrillFile(d: Drill): Blob;
export function exportSessionFile(s: TrainingSession, drills: Drill[]): Blob;
export function exportLibraryFile(ds: Drill[]): Blob;
export function sameDrill(a: Drill, b: Drill): boolean;
export function slugify(title: string, max?: number): string;
export function ymdLocal(ms: number): string;
export function drillFileName(d: Drill): string;
export function readTextFile(f: File): Promise<string>;
export function downloadBlob(blob: Blob, filename: string): void;
```

> **※ 정정 각주 (2026-08-13, 6.3). 4차(내보내기)가 §4.7 에 더한 것과 뺀 것.**
>
> **① 여섯 번째 kind `'backup'` 이 생겼다** (4.7 · §6.1b — 기기 이사 파일).
> `BackupPayload = { drills, sessions, prefs, board }` — **이 앱이 영구 저장하는 네 곳이
> 전부 여기 모인다**(IDB `drills` · IDB `sessions` · localStorage `spin.prefs` ·
> localStorage `spin.board`). 하나라도 빠지면 사용자는 "백업했다" 고 믿은 채 그것을 잃는다.
> `board` 는 한 번도 연 적 없으면 `null` 이 정상이다 — 없는 것을 빈 기본 판으로 채워
> 내보내면 복원이 남의 기기 판을 기본값으로 **덮어쓰는 길**이 열린다.
> ⚠️ **봉투 버전도 payload 스키마 버전도 올리지 않았다** — `ENVELOPE_VERSION` 은 1 그대로다.
> 담는 그릇이 하나 늘었다고 문서 버전을 올리면 기존 파일이 전부 `E_SCHEMA_TOO_NEW` 가 된다.
>
> **② `exportLibraryFile` 은 프로덕션 호출자가 0 이다** (4.7 §6.1b — 목록의 [전체 내보내기]
> 제거). `parseSpinFile` 은 `'library'` 를 **여전히 읽는다** — 옛 파일을 가진 사용자를 버리지
> 않기 위해서다. 즉 이 kind 는 **읽기 전용**이 됐고, 함수는 테스트 픽스처 빌더로만 남아 있다.
> 같은 이유로 `'prefs'` kind 도 **읽기만** 한다(쓰는 함수가 없다. `backup` 이 대신한다).
>
> **③ 내보내기 진입점이 하나로 통합됐다** (§6.4): [보드] 하단 [내보내기] 1개 →
> 3항목 시트(드릴 `.json` / PNG / 인쇄). 설정 화면의 [전체 내보내기]는
> **[기기 이사 파일 읽기]**(복원 쪽)로 바뀌었다.
>
> **④ 파일로 나가지만 앱이 도로 읽지 않는 것 둘**: PNG(4.4 — 자립 SVG 문자열을 구워
> 래스터화. `features/export/`)와 인쇄(4.5 — `window.print()` + `@media print`.
> `features/print/`). 둘 다 봉투가 아니므로 `SpinFileKind` 에 없다.

**`commitSessionImport` 은 반드시 리맵한다** — 없으면 "사본으로 추가"(기본 선택지)가 세션 항목을
조용히 로컬의 다른 드릴로 연결하고, `missing` 도 아니라 아무 경고가 뜨지 않는다:
```ts
const items = s.items.map(it => ({ ...it, drillId: out.idMap.get(it.drillId) ?? it.drillId }));
return putSession({ ...s, items, drillIds: refDrillIds(items) });
```
커밋 순서: **드릴 전부 커밋 → idMap 획득 → remapRefs → drillIds 재계산 → 세션 put** (한 트랜잭션).
`commitDrillImports` 는 `candidate.doc` 을 **변형하지 않는다**(옛 id 를 읽어야 하므로).

**ID 충돌 처리**
1. 같은 id 가 **없으면 원본 id 유지**. 새 id 를 발급하면 같은 파일을 두 번 받았을 때 중복이 쌓이고
   수정본을 다시 보내도 원본을 덮지 못한다.
2. 같은 id 가 **있으면** `sameDrill()` 로 동일 여부를 먼저 본다. 동일 → "이미 있는 드릴입니다".
3. 다르면 **묻는다** — 제목 + 양쪽 수정 시각 + **덮어쓰기 / 사본으로 추가 / 건너뛰기** 3택.
   포커스 기본값은 **"사본으로 추가"**(비파괴). 'skip' 선택 시 "이 항목은 기존 로컬 드릴을
   가리킵니다" 를 명시한다.
4. "사본으로 추가" = **드릴 id 만 새로 발급.** 스텝·개체 id 는 드릴 스코프라 그대로 안전.
   제목에 ` (사본)`, 이미 있으면 ` (사본 2)`.
5. **배치 내 중복 검사 필수**: `prepareDrillImport` 안에서 같은 파일에 같은 `DrillId` 가 둘 이상
   있으면 뒤쪽을 `conflict: 'exists'` 로 표시한다. 안 그러면 손상된 library 파일이
   "드릴 2개를 가져왔습니다" 를 보여 주면서 실제로는 1개만 남긴다(TOCTOU).

**`sameDrill` 은 정규 형태 비교여야 한다.** `JSON.stringify(a) === JSON.stringify(b)` 는
키 순서(structuredClone vs JSON.parse)와 `undefined` optional 에 민감해서, 어제 내보낸 파일을
그대로 다시 가져와도 3택 다이얼로그가 뜨고 엔터 한 번에 동일 내용 중복이 생긴다.
```ts
function canonical(v: unknown): unknown {  // 키 정렬 + undefined 제거 + 숫자 0.1 반올림
  if (Array.isArray(v)) return v.map(canonical);
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return Object.keys(o).sort().filter(k => o[k] !== undefined)
      .reduce<Record<string, unknown>>((a, k) => (a[k] = canonical(o[k]), a), {});
  }
  return typeof v === 'number' ? Math.round(v * 10) / 10 : v;
}
export const sameDrill = (a: Drill, b: Drill): boolean => {
  const strip = ({ updatedAt: _u, ...rest }: Drill) => rest;
  return JSON.stringify(canonical(strip(a))) === JSON.stringify(canonical(strip(b)));
};
```

**파일명** — `.spin.json` 이중 확장자 (여전히 JSON 으로 열리고, 목록에서 SPIN 파일임이 보이며,
`<input accept=".json,application/json">` 에 그대로 걸린다):
```
SPIN_{slug(title)}_{YYYYMMDD}.spin.json        예: SPIN_측면-돌파-후-크로스_20260807.spin.json
SPIN_세션_{slug(title)}_{YYYYMMDD}.spin.json   SPIN_전체_{YYYYMMDD}.spin.json
```
`slugify`: NFC 정규화 → 금지문자 `[\x00-\x1f<>:"/\\|?*]` 를 `-` 로 → 연속 `-` 축약 →
앞뒤 `-` 제거 → `[...s].slice(0,max)`(서로게이트 페어 보호). 빈 문자열이면 `'drill'`. 한글 유지.

봉투에 별도 `schemaVersion` 을 두지 않는다 — payload 가 자기 버전을 들고 있고 두 벌은 어긋난다.
`envelope > ENVELOPE_VERSION` → `E_SCHEMA_TOO_NEW`, 모르는 `spin` 값 → `E_UNSUPPORTED_KIND(kind)`.
File System Access API 는 쓰지 않는다(앵커 다운로드로 충분).

### 4.8 배포 형태 (확정)

- **http(s) 로 서빙한다.** `vite preview`, 태블릿의 간이 서버, 또는 LAN 사설 IP.
  **`file://` 은 지원하지 않는다** — Chrome 이 `indexedDB.open()` 을 `SecurityError` 로 거부한다.
  README 와 §4.2 에 명시.
- `memoryDrillRepo` 는 **필수**. 시크릿 모드·저장소 차단 어느 경우든 앱은 떠야 한다.
- 열화(degraded) 모드 UX: 저장 버튼은 동작하되 성공 토스트 대신 **"이 탭에서만 유지됩니다 —
  파일로 내보내세요" 상시 경고**, 그리고 탭을 닫기 전 `beforeunload` 경고.
  부팅 시 배너 한 번만으로는 20분 작업 후 탭을 닫는 코치를 구제하지 못한다.
- Wake Lock 은 secure context 필수 → 같은 이유로 http(s) 배포가 전제다(LAN 사설 IP http 는
  secure context 가 아니므로 Wake Lock 이 안 된다 → §6.9 폴백 문구를 반드시 구현).

---

## 5. 물리 · 운동학 — `src/physics/`

```
src/physics/
├── types.ts          공유 타입 (UI 가 의존하는 최소 계약)
├── kinematics.ts     ★ 순수 함수. matter 의존 0. 유닛테스트 주 대상
├── obb.ts            OBB SAT, resolveMotion, escapePinned
├── bodies.ts         createChairBody / createBallBody / createConeBody / createWalls
├── world.ts          엔진 생성·개체 관리·포즈 read/write·freeze·저속반발 훅
├── loop.ts           고정 timestep 누산기 + alpha + settle
├── hitTest.ts        포인터 → 대상/존 판정, 존 핸들 배치
├── drag.ts           드래그 세션(래치) 관리, substep 구동, 릴리스 체이스
└── index.ts
```

### 5.1 공유 타입 — `src/physics/types.ts`

```ts
import type { Vec2 } from '../core/units.ts';
import type { ChairPose, DragZone, ZoneConfig } from '../model/chair.ts';
import type { CastId, ChairId } from '../core/ids.ts';

export interface DragLimits { vLinPxPerS: number; omegaRadPerS: number }
/** pointerdown 에 래치되는 body-frame 그랩. 드래그 내내 불변. */
export interface GrabLatch {
  ax: number; lat: number;      // body frame px (부호 있음)
  rho: number; beta: number;    // 극좌표.  rho = hypot(ax,lat), beta = atan2(lat,ax)
}
export interface ZoneState { phiPrev?: number }     // spin 전용 증분 추적 상태
export interface KinInput {
  pose: ChairPose; grab: GrabLatch; target: Vec2; dt: number;
}
export interface Bounds { w: number; h: number }
export type BodyKind = 'chair' | 'ball' | 'cone' | 'wall';
export interface PoseBuffer { readonly ids: string[]; data: Float64Array }   // [x, y, theta] × n
```

### 5.2 잡은 점의 완전 래치 (blocker 수정 — 모든 존이 이걸 쓴다)

```
u(a)      = (cos a, sin a)
uPerp(a)  = (−sin a, cos a)
pointerdown:
  rel  = T0 − P0
  ax   = rel · u(θ0)                 // 축 방향, 부호 있음
  lat  = u(θ0) × rel                 //  = u.x·rel.y − u.y·rel.x   측방, 부호 있음
  rho  = hypot(ax, lat)              // 로프 길이 (불변)
  beta = atan2(lat, ax)              // 헤딩 대비 잡은점 방위 (불변)
  s    = sPivot + ax / L             // 존 판정에만 쓴다
매 substep:
  eB = u(θ + beta)
  G  = P + rho·eB                     // 잡은 점의 현재 월드 좌표
```

`beta` 가 전/후방 부호를 이미 담는다: `lat = 0, ax < 0` → `beta = π` → `eB = −u(θ)`.
따라서 설계안 1 의 `sign(a)` 트릭은 **폐기**하고 통합식 하나만 쓴다.

**s만 래치하면 무슨 일이 나는가 (실측)**: 차체 옆면(lat = ±12.5 px)을 짚고 손가락을 1 px도
움직이지 않아도 — spin s=0.32 → 즉시 70.9° 회전, towRear s=0.06 → 115.9°, translate → 12.5 px
측방 미끄러짐. `grabPadPx` 때문에 lat 은 최대 22.5 px 까지 나온다.
**수정 후 첫 substep Δ = 0.000000000 (8종 조합 전부 확인, §10.9 G1).**

### 5.3 body 생성 — `src/physics/bodies.ts`

```ts
export const CAT = { CHAIR: 0x0001, BALL: 0x0002, CONE: 0x0004, WALL: 0x0008 } as const;

/** body.position === 피벗 P 가 되도록 만든다. 이 순서를 절대 바꾸지 말 것. */
export function createChairBody(pose: ChairPose): Matter.Body {
  const off = CHAIR.centroidOffsetPx;                        // 11.25
  // 1) 각도 0 에서 centroid 를 피벗 앞쪽 off 에 놓고 생성.  mass/density 는 절대 넘기지 않는다
  const b = Bodies.rectangle(pose.x + off, pose.y, CHAIR.lengthPx, CHAIR.widthPx, {
    isStatic: true, label: 'chair',
    collisionFilter: { category: CAT.CHAIR, mask: CAT.BALL | CAT.CONE | CAT.WALL, group: 0 },
  });
  // 2) 기준점을 뒤로 off (아직 각도 0 이므로 로컬 = 월드)
  Body.setCentre(b, { x: -off, y: 0 }, true);                // position === (pose.x, pose.y)
  // 3) 마지막에 회전 (피벗 기준으로 회전됨)
  if (pose.theta !== 0) Body.setAngle(b, pose.theta);
  // 4) setStatic 이 덮어쓴 표면 계수를 되돌린다
  applyStaticSurface(b, CHAIR.restitution, CHAIR.friction, CHAIR.frictionStatic);
  return b;
}
export function applyStaticSurface(b: Matter.Body, e: number, mu: number, muS: number): void {
  b.restitution = e; b.friction = mu; b.frictionStatic = muS;
  const orig = (b as { _original?: { restitution: number; friction: number } })._original;
  if (orig) { orig.restitution = e; orig.friction = mu; }   // 향후 setStatic(false) 복원 대비
}
```

**생성 순서가 결정적으로 중요하다.** `setCentre(relative:true)` 의 오프셋은 **월드 좌표**다.
body 가 이미 회전해 있으면 피벗이 어긋난다(θ≠0 에서 생성 후 setCentre 하면 최대 13 px 이탈).

**`Body.setMass`/`setDensity` 는 휠체어에 절대 호출하지 않는다.** 옵션에 `mass` 도 넣지 않는다.
(실측: `setStatic` 이 `mass = inertia = Infinity` 로 만든 뒤 `setMass` 의 첫 줄
`moment = Infinity/(Infinity/6)` = **NaN** → `Resolver.solveVelocity` 의 `share` 가 NaN →
공 좌표가 NaN → 씬 전체 소멸. 옵션 `{isStatic:true, mass:150}` 도 `inverseMass = 0.006667` 이
남아 모든 임펄스가 0.66 % 작아진다.)

```ts
const polyRadius = (r: number, n: number) => r / ((1 + Math.cos(Math.PI / n)) / 2);
export function createBallBody(p: Vec2): Matter.Body;
//  Bodies.polygon(p.x, p.y, 16, BALL.polyRadiusPx, { label:'ball', circleRadius: BALL.radiusPx,
//    restitution:.45, friction:.02, frictionStatic:.05, frictionAir:.012, collisionFilter })
//  이후 Body.setMass(b, 1.0);  Body.setInertia(b, Infinity);      ← 이 순서 필수
export function createConeBody(p: Vec2): Matter.Body;   // 12각형, polyRadiusPx 3.17916369
export function createWalls(w: number, h: number): Matter.Body[];
```
`Bodies.circle` 은 `sides = ceil(max(10, min(maxSides, radius)))` 라 r=4.125 에서 **항상 10각형**
(실측 확인). `Bodies.polygon` 을 직접 쓰고 외접/내접 평균이 실제 반지름이 되도록 보정한다.
`Body.setInertia` 는 반드시 `Body.setMass` **다음**에 (setMass 가 관성을 재스케일한다).

**관성을 전부 `Infinity` 로 두는 이유**: (1) matter 에 구름 마찰이 없어 공의 스핀은 렌더에도
반영되지 않고 임펄스 분모만 갉아먹는다, (2) 대기 중 휠체어가 부딪혀 저절로 도는 것은 전술보드
버그로 읽힌다, (3) 시뮬이 "병진 + 명령 회전" 으로 축소되어 결정성이 크게 향상된다,
(4) `setCentre` 이후 관성이 centroid 기준이라 물리적으로 불일치하는 문제를 회피한다.

**개체 설정 확정 테이블**

| 개체 | 형상 | mass | inertia | restitution | friction | frictionStatic | frictionAir |
|---|---|---|---|---|---|---|---|
| 휠체어 | rect 37.5 × 25, `isStatic` | **설정 금지** (엔진이 ∞) | ∞ | 0.10† | 0.15† | 0.50 | — |
| 공 | 16각형 r_poly 4.16501480 | 1.0 | ∞ | 0.45 | 0.02 | 0.05 | 0.012 |
| 콘 | 12각형 r_poly 3.17916369 | 2.0 | ∞ | 0.05 | 0.40 | 0.60 | 0.065 |
| 벽 | rect 두께 40, `isStatic` | — | — | 0.10† | 0.60† | 0.80 | — |

† `setStatic` 이 0 / 1 로 덮어쓰므로 **생성 후 `applyStaticSurface` 로 되돌려야** 표의 값이 실제로 적용된다.
되돌리지 않으면 콘↔휠체어 마찰이 의도한 0.15 대신 **0.40 (2.7배)** 이 되어 콘이 가드에 끌려다닌다.

`Pair.update` 규칙: `friction = min(A,B)`, `frictionStatic = max`, `restitution = max`.
→ 공↔휠체어: e = 0.45, μ = 0.02 (가드 위를 미끄러짐) ✓

### 5.4 엔진 — `src/physics/world.ts`

```ts
export const ENGINE_OPTS: Matter.IEngineDefinition = {
  gravity: { x: 0, y: 0, scale: 0 },
  enableSleeping: false,          // ★ 절대 true 금지
  positionIterations: 6, velocityIterations: 4, constraintIterations: 2,
};
export interface WorldHandles {
  readonly engine: Matter.Engine;
  addChair(id: ChairId, pose: ChairPose): void;
  addBall(id: BallId, p: Vec2): void;
  addCone(id: ConeId, p: Vec2): void;
  remove(id: CastId): void;
  setChairPose(id: ChairId, pose: ChairPose, driven: boolean): void;
  setPoint(id: CastId, p: Vec2, driven: boolean): void;
  freeze(id: CastId): void;
  chairPose(id: ChairId): ChairPose;
  otherChairPoses(exceptId: ChairId): ChairPose[];
  readPoses(out: PoseBuffer): void;
  /** static 은 항상 rest 로 간주한다. 단위: px per 16.667 ms */
  allAtRest(eps?: number): boolean;
  applySpeedClamps(): void;       // 매 substep 후 호출
  applyRollingDecel(dtS: number): void;
  destroy(): void;
}
export function createWorld(courtW: number, courtH: number): WorldHandles;
export function freezeKinematic(b: Matter.Body): void;
```

**`enableSleeping: false` 는 협상 불가.** `Detector.collisions` 는
`if (bodyAStatic && (bodyB.isStatic || bodyB.isSleeping)) continue;` (소스 확인) 라
휠체어가 static 인 이상 **잠든 공/콘과는 충돌 검사 자체가 일어나지 않는다** → 완전 관통.
CPU 절약은 sleeping 이 아니라 **루프 자체를 멈춰서** 얻는다(§5.10).

**`allAtRest` 는 static 을 제외한다** (실측: static chair `deltaTime` 은 16.667 로 고정되고
dynamic 은 8.333 이라 같은 속도라도 `Body.getSpeed` 가 2배 다르다):
```ts
allAtRest: (eps = PHYS.restSpeedMatter) =>
  Composite.allBodies(engine.world).every(b => b.isStatic || Body.getSpeed(b) < eps),
```

**드래그 중 휠체어 구동** — 매 substep:
```ts
Body.setPosition(body, { x: P.x, y: P.y }, /* updateVelocity */ true);
Body.setAngle(body, thetaContinuous,       /* updateVelocity */ true);
// 그 다음 Engine.update(engine, PHYS.dtMs)
```
근거(소스): `Resolver.solveVelocity` 는 속도를 `position − positionPrev`, 각속도를
`angle − anglePrev` 로 **직접 계산**하고 `body.velocity` 프로퍼티를 쓰지 않는다. 접촉점 속도의
회전 성분은 `contactVertex − body.position` 기준이므로 `position` 을 피벗으로 옮긴 우리 설정에서
**스핀킥이 물리적으로 맞게 나온다**. 임펄스 적용부는 `if (!(bodyA.isStatic || bodyA.isSleeping))`
로 가드되어 static 은 절대 밀리지 않는다.

**`Body.setAngle` 에는 연속값(unwrapped)을 그대로 넘긴다.** `setAngle` 은 `delta = angle − body.angle`
을 쓰고 해석기는 `angle − anglePrev` 를 접촉점 속도로 쓴다. θ 를 wrap 해서 넣으면 seam 에서
delta 가 ±2π 로 튀고 **공이 순간적으로 초고속 킥을 맞는다.**

**드래그 종료 시 freeze 필수** (실측: 미실행 시 1초 후 공이 47.3 px 이동, 1.30 m/s):
```ts
export function freezeKinematic(b: Matter.Body): void {
  b.positionPrev.x = b.position.x; b.positionPrev.y = b.position.y;
  b.anglePrev = b.angle;
  b.velocity.x = 0; b.velocity.y = 0; b.speed = 0;
  b.angularVelocity = 0; b.angularSpeed = 0;
}
```

**"밀지만 밀리지 않는다" 의 유일한 수단은 `isStatic` 이다.** 질량비로는 실패한다 —
`Resolver.solvePosition` 은 질량을 전혀 고려하지 않고(`isStatic`/`isSleeping` 만 확인) 침투를
`positionDampen / totalContacts` 로 균등 배분하며, `postSolvePosition` 이 `positionImpulse` 를
`_positionWarming = 0.8` 로 다음 프레임에 warm 유지한다. 실측: dynamic 150 kg 휠체어에 1 kg 공을
8 m/s 로 충돌시키면 **휠체어가 94 cm 이동**한다(속도 임펄스 기여는 0.8 cm 뿐).

### 5.5 4존 운동학 — `src/physics/kinematics.ts` (matter 의존 0)

```ts
export function unitFwd(theta: number): Vec2;
export function grabFrom(pose: ChairPose, target: Vec2): GrabLatch;
export function grabPoint(pose: ChairPose, g: GrabLatch): Vec2;
export function grabFromLever(leverPx: number): GrabLatch;      // 핸들용: lat=0
export function classifyZone(s: number, z: ZoneConfig): DragZone;
export function stepTranslate(i: KinInput, lim: DragLimits): ChairPose;
export function stepSpin(i: KinInput, lim: DragLimits, st: ZoneState): ChairPose;
export function stepTow(i: KinInput, lim: DragLimits): ChairPose;
export function stepZone(z: DragZone, i: KinInput, lim: DragLimits, st: ZoneState): ChairPose;
export const clampMag = (v: Vec2, m: number): Vec2 => { … };
export const lerpPose = (a: ChairPose, b: ChairPose, t: number): ChairPose => ({
  x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, theta: lerpAngle(a.theta, b.theta, t),
});
```

#### (A) translate — 평행 이동
```
G = P + rho·u(θ + beta)
d = T − G;   if |d| > vLin·dt: d ← d·(vLin·dt/|d|)
P' = P + d;  θ' = θ
```

#### (B) spin — 피벗 고정 제자리 회전 (증분 각변위 + 반경 게인)
```
d = T − P;  r = |d|
if r < 1e-9: return pose (변화 없음, phiPrev 유지)
phi  = atan2(d.y, d.x)
if st.phiPrev === undefined: st.phiPrev = phi          // pointerdown 첫 호출 → Δ = 0
gain = min(1, r / SPIN_RADIUS_MIN_PX)                  // SPIN_RADIUS_MIN_PX = 9.375
Δ    = wrapPi(phi − st.phiPrev) · gain
st.phiPrev = phi
Δ    = clamp(Δ, −ω·dt, +ω·dt)
θ' = θ + Δ;   P' = P                                   // 피벗 완전 고정
```
**절대 방향 추종(`φ_tgt = atan2(T−P)`)을 폐기한 이유 (실측)**: 게인이 `1/|T−P|` 라 피벗 근처에서
발산한다. s=0.55(레버 11.25 px)를 잡고 축을 따라 +11.25 → −11.25 px 로 곧게 훑으면(총 22.5 px,
아주 작은 제스처) θ 가 **±178°** 로 뒤집히고 방향은 손떨림 0.4 px 이 정한다. 게다가 이 제스처가
180° 스핀을 명령하는 가장 자연스러운 동작이다.
**수정 후: ±17.0° (섭동 ±0.4 px), ±43.0° (±2 px) — 부호가 섭동에 연속.**
멀리서는 1:1 추종을 유지한다(포인터 114.6° → 차체 113.6°), 빠르면 ω 상한에 포화(§10.9 G7).

#### (C) tow — 견인 (전방·후방 공통, 단방향 로프)
```
eB = u(θ + beta);   G = P + rho·eB
err = T − G
if (|T − P| < rho):                      // ★ 로프 이완 — 밀 수 없다 (2026-08-09 정정)
    d = clampMag(err, vLin·dt);  return { P + d, θ }        // 회전 없이 평행 이동
vGrab = vLin + ω·rho
dG = clampMag(err, vGrab·dt);   Gt = G + dG
r  = P − Gt;   if |r| < 1e-9: r = −rho·eB
n  = r/|r|;    Pr = Gt + rho·n                              // 로프 길이 정확 유지
d  = Gt − Pr
θr = atan2(d.y, d.x) − beta                                 // ★ sign(a) 트릭 대체
gain = min(1, |P−Gt| / (rho·0.5))        // 피벗 통과 특이점 감쇠 (2026-08-09 추가)
Δ  = clamp(wrapPi(θr − θ)·gain, −ω·dt, +ω·dt);   θ' = θ + Δ
Pr2 = Gt − rho·u(θ' + beta)
dP = clampMag(Pr2 − P, vLin·dt);   P' = P + dP
```
우선순위: **로프 길이 정확 > 각속도 상한 > 선속도 상한.** 상태는 (P, θ) 뿐이고 G 는 매 프레임
재정의되므로 로프 길이는 **항상 정확히 rho** 다 (실측 오차 max **8.9e−16**).

**[3] 2026-08-09 정정 — 이완 판정 기준.** 원래 `err·eB < 0`(로프 방향과 90° 초과)이었는데,
이러면 **옆으로 비스듬히 끄는 정상 제스처까지 회전이 죽는다** — 전방 앵커를 135° 방향으로
1초 끌면 θ=0.0° 로 차체가 돌지 않고 미끄러지기만 했다(사용자 신고 → 실측 재현).
로프는 옆으로 당겨도 팽팽하다. 올바른 기준은 기하학적 도달 가능성이다: 링크 길이가 rho 로
고정이므로 **목표점이 반지름 rho 원 안이면**(|T−P| < rho) 압축 없이는 닿을 수 없다 = 미는 것.
아래 가드의 원래 목적("되밀어 미세 조정")은 그 동작이 원 안으로 들어오므로 새 기준으로도 그대로 막힌다.
큰 반전(원 밖으로 완전히 넘김)은 이제 회전하는데, 그게 물리적으로 맞다 —
문제였던 것은 회전 여부가 아니라 손떨림 0.2px 에 ∓167° 로 **갈리던 것**이고,
그건 반경 게인이 해소했다(실측: ε=±1 → ±6.3°, ε=±0.2 → ±1.3° 로 섭동에 연속·대칭).

**단방향 로프 가드가 없으면 (실측)**: towRear 로 40 px 뒤로 끈 뒤 손가락을 되밀면
측방 섭동 ±1 px 에 **∓167°**, ±0.2 px 에도 ∓153° 잭나이프 — 같은 제스처가 손떨림 0.2 px 에
333° 다른 결과를 낸다. 되밀어 미세 조정하는 것은 매 드래그마다 일어나는 동작이다.
**가드 후: 네 섭동값 모두 정확히 0.0000°** (§10.9 G5). 그리고 정상 동작(직선 후진, 측방 견인)은
비트 단위로 보존된다.

**부호 검산** (전방 a>0 → 헤딩 = 피벗→잡은점 / 후방 a<0 → 잡은점→피벗, 정확히 π 차이):

| 조작 | 전방 견인 | 후방 견인 |
|---|---|---|
| 잡은 점을 **아래(+y)** 로 당김 | θ **증가** (실측 +54.45°) | θ **감소** (실측 −89.30°) |
| 축 방향으로 당김 | θ 불변, 전진 | θ 불변, **후진** (실측 P=(−40.0000, −0.0000), θ=0.000000°) |

#### 짐벌 / ±π 랩어라운드 — 규칙 3가지

1. **모델의 θ 는 연속값으로 들고 다닌다.** 각 스텝은 `θ += Δ` (Δ 는 이미 최단호 clamp 됨) 로만
   갱신한다. 절대 매 프레임 wrap 하지 않는다.
2. `Body.setAngle(body, θ_cont, true)` 에 연속값을 그대로 넘긴다 (이유는 §5.4).
3. **직렬화·비교·UI 표시에만 wrap 한다** (`radToStoredDeg`). 로드 시에는 저장값을 그대로
   θ 초기값으로 삼는다. 저장값이 `[-180,180)` 로 랩돼 있으므로 두 스텝의 |Δθ| 는 항상 ≤ 2π 다.

`atan2` 결과와의 비교는 항상 `wrapPi(target − θ_cont)` 로 하므로 θ_cont 가 아무리 커도 안전하다.

### 5.6 충돌 해결 — `src/physics/obb.ts`

```ts
export interface SatResult { depth: number; axis: Vec2 | null }   // depth ≤ 0 → 분리
export function satOverlap(a: ChairPose, b: ChairPose, marginPx: number): SatResult;
export function chairsOverlap(a: ChairPose, b: ChairPose, marginPx: number): boolean;
export function outOfBounds(p: ChairPose, b: Bounds): SatResult;   // hull 이 viewBox 를 벗어난 깊이
/** 원으로 막는 장애물(공·콘). 휠체어는 OBB(`others`), 이쪽은 반지름을 가진 점이다 —
 *  원을 한 변 2r 사각형으로 근사하면 모서리에서 41% 넓게 막힌다(2026-08-15). */
export interface CircleObstacle { p: Vec2; r: number }
export function blockedAt(
  p: ChairPose, others: readonly ChairPose[], b: Bounds, margin: number,
  circles?: readonly CircleObstacle[],
): SatResult;
export function resolveMotion(
  from: ChairPose, to: ChairPose, others: readonly ChairPose[], bounds: Bounds,
  marginPx?: number, iters?: number, circles?: readonly CircleObstacle[],
): ChairPose;
export function escapePinned(
  p: Vec2, r: number, chairs: readonly ChairPose[], bounds: Bounds,
): Vec2;
export function clampPointToBounds(p: Vec2, r: number, b: Bounds): Vec2;
```

**`resolveMotion` 이 벽과 휠체어를 **한 술어로** 처리한다** — `clampPoseToBounds` 를 별도 단계로
두면 spin 중 피벗이 최대 19.6 px 밀려 "제자리 회전" 계약이 깨진다. `lerpPose(from, to, t)` 는
`from.x === to.x` 일 때 x 를 그대로 두므로, 이분탐색은 spin 의 피벗 고정을 자동으로 보존한다.

```
blocked(p) = 어떤 다른 휠체어 OBB 와 겹침(margin 팽창) OR hull 이 bounds 밖

1. if (!blocked(to)) return to
2. if (blocked(from)):                          // 이미 겹친 상태 — 탈출만 허용
     return depth(to) <= depth(from) ? to : from
3. lo=0, hi=1;  6회 이분 → stopped = lerpPose(from, to, lo)
4. // 접선 슬라이드 (병진 성분만)
   rest = (to.x−stopped.x, to.y−stopped.y)
   n    = blockedAt(to, …).axis                 // to 에서 최대 침투 축의 단위 법선
   t    = rest − (rest·n)·n
   cand = { stopped.x + t.x, stopped.y + t.y, theta: to.theta }
   if (!blocked(cand)) return cand
   else 6회 이분 (stopped → stopped+t) 후 그 지점 반환
5. return stopped
```

**접선 슬라이드가 없으면 (실측)**: 이웃 휠체어에 붙여 5초간 평행 드래그할 때
진행률 **2.3 %** (방해물이 없으면 346.2 px, 있으면 8.0 px). 즉 이웃을 스쳐 지나가는 것이
불가능하고 "벽에 접착제가 발린" 느낌이 된다. **접선 슬라이드 추가 후 100.0 %, 최종 겹침 없음.**

**`blocked(from)` 일 때 무조건 `to` 를 허용하면 안 된다.** 휠체어끼리는 static–static 이라 물리
백스톱이 전혀 없으므로, 한 번 겹치면 그 휠체어는 다른 휠체어를 영구히 관통한다. 겹침은 실제로
발생 가능하다(겹친 포즈로 저장된 JSON 가져오기, 존/상한 설정을 로드 중 변경 등).

**`escapePinned` (최종 안전망)**: 매 substep 의 `Engine.update` **직후**, 모든 dynamic body 에 대해
휠체어 OBB 4축 + 벽 4면과의 침투 깊이를 계산해 최대 침투가 반지름을 넘으면 **압착 축의 수직**
방향으로 `depth + slop` 만큼 강제 이탈시킨다. 두 휠체어 사이(또는 휠체어와 벽 사이)에 낀 공은
`Resolver.solvePosition` 이 양쪽 static 에서 반대 임펄스를 받아 상쇄되므로 스스로 못 빠져나온다.

비용: 대기 휠체어 7대 × 최대 12회 SAT = substep 당 최대 ~90회, 120 Hz 에서 무시 가능.
대부분의 substep 은 겹침 없음 판정 1회로 끝난다.

### 5.7 경계 · 벽 — 라인에는 벽 없음

물리 벽은 코트 라인이 아니라 **viewBox 테두리에만** 둔다.
근거: (1) 규칙상 공이 라인을 넘으면 킥인이지 튕기지 않는다 — 라인에 벽을 두면 규칙을 잘못
가르친다, (2) 킥인·코너 세트피스 드릴은 라인 밖 배치가 필수이고 여분 공 10개도 놓을 곳이 필요하다,
(3) `flat` 은 라인 자체가 없다, (4) 반면 개체가 캔버스 밖으로 사라지면 복구가 불가능하다.

```ts
// full: (0,0)-(800,500) / half·flat: (0,0)-(500,425)
// 내측면이 viewBox 경계와 일치하도록 두께 40 px 벽을 바깥에 배치. applyStaticSurface 필수
```
라인 아웃은 물리가 아니라 **표시**로 알린다: 공의 중심이 `surface` 를 벗어나면 칩에 "킥인" 배지.

드래그 중 휠체어는 static 이라 벽에 막히지 않으므로 `resolveMotion` 의 `bounds` 술어가 담당한다.
공·콘 드래그는 `clampPointToBounds` 로 목표점을 먼저 자른다.

### 5.8 클램프 · 루프 — `src/physics/loop.ts`

```ts
export interface PhysicsLoop {
  start(): void; stop(): void; isRunning(): boolean;
  requestSettle(ms?: number): void;
}
export function createLoop(o: {
  step: (dtSeconds: number) => void;
  render: (alpha: number) => void;
  atRest: () => boolean;
}): PhysicsLoop;
```

```ts
let elapsed = now - last; last = now;
if (elapsed > PHYS.accClampMs) elapsed = PHYS.accClampMs;    // 탭 백그라운드 복귀
acc += elapsed;
let n = 0;
while (acc >= PHYS.dtMs && n < PHYS.maxSubsteps) {
  savePrevPoses();
  stepKinematics(PHYS.dtS);                 // 4존 → resolveMotion → setChairPose
  Engine.update(engine, PHYS.dtMs);         // ★ 항상 고정 dt. rAF dt 를 넣지 않는다
  world.applySpeedClamps();
  world.applyRollingDecel(PHYS.dtS);
  escapePinnedAll();
  acc -= PHYS.dtMs; n++;
}
if (n === PHYS.maxSubsteps) acc = 0;        // 밀린 시간은 버린다 (몰아치기 금지)
render(acc / PHYS.dtMs);                    // alpha 보간
```

**`Engine.update` 에 가변 dt 를 넣으면 안 된다.** matter 는 `Engine._deltaMax = 16.667`,
`Body._timeCorrection = true` 이고 Verlet 적분이 `correction = deltaTime / body.deltaTime`,
force 항은 `deltaTime²` 를 쓴다. 50 ms 를 넣으면 그 프레임에 **모든 속도가 3배**, force 항은
9배가 되어 휠체어가 벽과 다른 휠체어를 관통한다. 저사양 태블릿에서 50 ms 프레임은 상시 발생한다.

**substep 당 변위 클램프인 이유**: 속도 클램프는 가변 프레임 시간과 결합하면 실효 속도가
프레임레이트에 종속되고, 프레임당 변위 클램프는 60 fps 에서 10 km/h / 30 fps 에서 5 km/h 가
된다. **고정 dt substep + substep 당 변위 클램프**는 30 fps 에서 substep 이 4번 돌아 실시간
속도가 정확히 유지되면서 순간이동이 없다.

**터널링 마진 (dt = 1/120)**

| 개체 | substep 최대 변위 | 상대 접촉 밴드 | 마진 |
|---|---|---|---|
| 드래그 휠체어 (hull 최원거리 정점, 회전+병진) | `ω·dt·32.5 + vLin·dt` = **2.459491** px | 공 반지름 4.125 + 차체 반폭 12.5 = 16.6 px | 6.8× |
| 공 (420 px/s) | **3.5** px | 공 4.125 + 콘 내접반경 3.071 = **7.196** px | 2.1× |
| 공 + 콘 (마주 접근) | 3.5 + 2.0 = **5.5** px | 7.196 px | 1.3× |
| 공 | 3.5 px | 벽 두께 40 px | 11.4× |
| 드래그 공·콘 | **3.0** px | 7.196 px | 2.4× |

계산식은 코드에 남겨 상한 설정을 바꿔도 자동 검증되게 한다(§10.3):
`PHYS.dtS * (lim.vLinPxPerS + lim.omegaRadPerS * CHAIR.hullRadiusPx)`.
`dt` 를 1/60 으로 되돌리면 공+콘 마진이 0.65× 로 떨어져 관통한다 — **dt 는 1/120 고정**이다.

### 5.9 속도 클램프 · 저속 반발 · 정착

```ts
/** matter 속도 단위는 px per 16.667 ms. 상수 이름에 단위를 박는다. */
export function clampBodySpeed(b: Matter.Body, maxMatter: number): void {
  const v = Body.getVelocity(b);                       // px per 16.667 ms
  const s = Math.hypot(v.x, v.y);
  if (s > maxMatter) Body.setVelocity(b, { x: v.x * maxMatter / s, y: v.y * maxMatter / s });
}
/** 유한 시간 내 정확히 0 이 되는 쿨롱 구름 감속. frictionAir 만으로는 지수 꼬리가 끝없다. */
export function applyRollingDecel(b: Matter.Body, decelPxPerS2: number, dtS: number): void {
  const dec = (decelPxPerS2 / 60) * dtS;               // px/s² → matter units per substep
  const v = Body.getVelocity(b); const s = Math.hypot(v.x, v.y);
  if (s <= 0) return;
  const ns = Math.max(0, s - dec);
  Body.setVelocity(b, { x: v.x * ns / s, y: v.y * ns / s });
}
```
`BALL.maxSpeedPxPerS = 300` 을 `Body.setVelocity` 에 그대로 넘기면 **18,000 px/s (716 m/s)** 가
되고, `Body.getSpeed(b) > 300` 비교는 **절대 참이 되지 않는다**(최대 스핀킥도 4.8 정도) — 어느
쪽으로 짜도 안전밸브가 통째로 죽는다. 반드시 `maxSpeedMatter` 를 쓴다.

**저속 반발 훅** (`collisionStart`, 공에만 적용):
```ts
Events.on(engine, 'collisionStart', ({ pairs }) => { for (const p of pairs) {
  const ball = p.bodyA.label === 'ball' ? p.bodyA : p.bodyB.label === 'ball' ? p.bodyB : null;
  if (!ball) continue;
  const other = ball === p.bodyA ? p.bodyB : p.bodyA;
  if (other.label === 'ball') continue;
  let n = p.collision.normal;
  if (p.collision.bodyA !== ball) n = { x: -n.x, y: -n.y };
  const v = Body.getVelocity(ball); const vn = v.x * n.x + v.y * n.y;
  if (vn < -PHYS.lowSpeedBounceMinMatter && vn >= -PHYS.restingThreshMatter) {
    const j = -(1 + BALL.restitution) * vn;
    Body.setVelocity(ball, { x: v.x + n.x * j, y: v.y + n.y * j });
  }
}});
```
근거(실측): `Resolver` 는 `normalVelocity < -2.0 × timeScale` 일 때만 restitution 분기로 간다.
물리 단위로는 정확히 **120 px/s = 4.8 m/s** (dt 무관). 그 미만은 Catto resting 누산 분기라
반발이 소멸한다 — e_eff 가 4.8 m/s 에서 **0.0037**, 5.0 m/s 에서 **0.4500** 으로 계단이 진다.
훅 적용 후 1·2·3·4·5·8 m/s 전 구간에서 e_eff = 0.4500 을 확인했다.
경계(정확히 2.0)에서 matter 와 훅이 겹칠 수 있으므로 테스트 허용치는 `e_eff ≥ 0.40` 으로 잡는다.

**정착(settle)** — `frictionAir` 만으로는 8 m/s 공이 **6.53 초 / 10.95 m** 를 굴러야 임계에 닿고,
그 사이 하드 컷이 걸리면 공이 코트 중간에서 뚝 멈춘 채 스텝 데이터로 커밋된다.
쿨롱 감속 **25 px/s² (1.0 m/s²)** 를 더하면 **2.58 초 / 7.39 m** 로 유한 정지하고
**조기 종료가 실제로 발동한다** (4 m/s 는 1.81 s / 2.93 m). 콘은 `fA 0.065` 만으로 0.94 s 이지만
결정성을 위해 같은 25 px/s² 를 적용한다.
`PHYS.settleMaxMs = 4000` 은 하드 컷이 아니라 안전망이고, 정상 경로는 조기 종료다(§10.3 회귀).

이 값들은 **저작 도구로서의 선택**이다 — 실제 체육관 바닥의 구름 저항은 0.15~0.3 m/s² 지만,
드릴 저작에서는 "공이 합리적인 시간 안에 멈추고 커밋 포즈가 결정론적"인 것이 우선한다.

### 5.10 편집 vs 재생 — 물리는 어디에 쓰이는가

**재생은 물리가 아니라 결정론적 보간이다** (§3.6). 물리는 **편집기 안에서, 드래그 중과 그 직후
정착 구간에만** 돈다 — 저작 보조 도구다.

| 물리가 하는 일 | 물리가 하지 않는 일 |
|---|---|
| 가드로 공을 밀고 스핀킥으로 차는 접촉 계산 | 스텝 재생 |
| 콘을 밀어내는 반응 | 자동 플레이 시뮬레이션 |
| 공·콘이 굴러가 자연스럽게 멈추는 감속 | 백그라운드 상시 시뮬 |
| 휠체어가 다른 휠체어·벽을 통과하지 않게 하는 블로킹 | 물리 기반 경로 생성 |

**생명주기**
```
드릴 열기       → createWorld(), 현재 스텝 포즈로 seed (updateVelocity=false)
pointerdown    → loop.start()
드래그 중       → 매 substep 운동학 + Engine.update
pointerup      → 릴리스 체이스 시작 (§5.11)
체이스 종료     → freezeKinematic(dragged); loop.requestSettle(PHYS.settleMaxMs)
정착 종료       → loop.stop(); 최종 포즈를 스텝 데이터에 커밋 (dispatch 1회)
스텝 전환/닫기  → loop.stop(); 새 스텝 포즈로 re-seed
```
드래그가 없을 때 루프는 **완전히 정지**한다 — CPU 0, sleeping 불필요.

### 5.11 드래그 세션 — `src/physics/drag.ts`

```ts
export interface DragSession {
  kind: 'chair' | 'ball' | 'cone';
  id: CastId;
  zone: DragZone | null;      // ★ pointerdown 시 래치, 이후 불변
  grab: GrabLatch;            // ★ 래치 (ball/cone 은 rho=0, ax/lat = 포인터-바디 오프셋)
  zoneState: ZoneState;
  target: Vec2;
  pointerId: number;
  armed: boolean;
  releasing: boolean; releaseStartMs: number;
  samples: Array<{ t: number; p: Vec2 }>;   // 릴리스 속도 산출용 최근 3개
}
export function beginDrag(hit: HitResult, world: Vec2, ctx: HitContext, pose: ChairPose): DragSession;
export function updateDragTarget(s: DragSession, world: Vec2, nowMs: number): void;
export function stepDrag(s: DragSession, w: WorldHandles, lim: DragLimits, b: Bounds, dtS: number): void;
export function beginRelease(s: DragSession, nowMs: number): void;
export function releaseDone(s: DragSession, w: WorldHandles, nowMs: number): boolean;
export function endDrag(s: DragSession, w: WorldHandles): void;
```

**존과 grab 은 pointerdown 시점에 한 번 정해지고 pointerup 까지 절대 바뀌지 않는다.**
드래그 중 포인터가 다른 존 위를 지나가도 아무 일도 없다 → 히스테리시스·데드밴드가 불필요해지고
존 경계는 순수하게 "집기 정확도" 문제로 축소된다.

`stepDrag`(휠체어) 참조 구현:
```ts
const cur = w.chairPose(s.id as ChairId);
const raw = stepZone(s.zone!, { pose: cur, grab: s.grab, target: s.target, dt: dtS }, lim, s.zoneState);
const fin = resolveMotion(cur, raw, w.otherChairPoses(s.id as ChairId), bounds, CHAIR_SEP_PX, RESOLVE_ITERS);
w.setChairPose(s.id as ChairId, fin, /* driven */ true);
```

`stepDrag`(공·콘):
```ts
let T = { x: s.target.x - s.grab.ax, y: s.target.y - s.grab.lat };   // 래치 오프셋 보존
T = clampPointToBounds(T, radius, bounds);
let d = { x: T.x - body.position.x, y: T.y - body.position.y };
d = clampMag(d, INTERACT.pointDragMaxPxPerSubstep);
Body.setPosition(body, { x: body.position.x + d.x, y: body.position.y + d.y }, /* updateVelocity */ false);
Body.setVelocity(body, { x: 0, y: 0 });
```
`updateVelocity: true` 는 `positionPrev` 되먹임으로 발산한다(실측: 프레임 시작에 1회
setPosition 하고 substep 2회 돌리는 구현이 20프레임 뒤 x = −4,323,686). `updateVelocity: false`
는 `positionPrev` 도 함께 이동시켜 접촉 속도를 0 으로 유지하므로, 드래그 중인 공이 콘을
**발사하지 않고 밀어내기만** 한다(`solvePosition` 은 위치 보정만 하고 속도를 주입하지 않는다).
드래그 중에도 **`isStatic` 으로 바꾸지 않는다** — 그러면 Detector 가 static–static 을 스킵해
다른 콘·공과 아예 안 부딪힌다.

**릴리스 체이스 (필수)**. `vLin = 69.4444 px/s` 는 풀코트 기본 배율에서 초당 약 58 CSS px 다.
포인터로 400 px 를 500 ms 에 옮기면 차체는 34.7 px(9 %)만 간다. 손을 뗀 자리에서 그냥 멈추면
코치는 같은 드래그를 5~10회 반복해야 한다.
```
pointerup → releasing = true, 래치된 zone·grab·마지막 target 으로 운동학을 계속 돌린다
종료 조건: |T − G| < 1 px  또는  경과 > INTERACT.releaseChaseMs(4000)  또는 사용자가 다시 탭
종료 시   → freezeKinematic + settle + 커밋
```
**지연 시각화 (필수)**: 드래그·체이스 중 `|T − G| > INTERACT.leashVisibleAtPx(4)` 이면
G 에서 T 까지 점선 리시 + T 위치에 반투명 고스트 칩을 그린다. 사용자가 "왜 안 따라오는지" 를
즉시 안다. 공·콘도 같은 규칙.

**`editorSpeedMultiplier`** (설정, 기본 1.0, 1–4): 드래그·체이스의 `vLin`/`ω` 에만 곱한다.
재생 보간에는 적용하지 않는다. 1보다 크게 하면 접촉 속도도 함께 커진다(물리적으로는 일관되지만
규정 속도는 아니다) — 설정 설명에 명시한다. 기본 1.0 이므로 REQUIREMENTS §4.4 를 기본값에서
정확히 지킨다.

### 5.12 히트 테스트 — `src/physics/hitTest.ts`

```ts
export interface HitResult {
  kind: 'chair' | 'ball' | 'cone' | 'note' | 'arrow' | 'arrowHandle' | 'zoneHandle';
  id: string;
  s?: number;                 // chair 직접 드래그: 축 방향 정규 위치
  zone?: DragZone;            // zoneHandle
  which?: 'from' | 'ctrl' | 'to';   // arrowHandle
}
export interface HitContext {
  zones: ZoneConfig; pxPerUnit: number; pointerType: string;
  selectedChairId: ChairId | null; selectedArrowId: ArrowId | null;
  handlesVisible: boolean; tool: ToolId;
}
export function hitTest(p: Vec2, scene: SceneSnapshot, ctx: HitContext): HitResult | null;
export function zoneHandles(pose: ChairPose, pxPerUnit: number)
  : Array<{ zone: DragZone; lever: number; pos: Vec2; hitR: number; viewR: number }>;
export const handlesVisible = (pxPerUnit: number, pointerType: string, forced: boolean): boolean =>
  forced || (pointerType === 'touch' && pxPerUnit < INTERACT.zoneDirectMinPxPerUnit);
```

> **※ 정정 각주 (2026-08-13, 5.5 결정 ④ · 6.3 기록). 위 `handlesVisible` 식은 무효다.**
> 지금은 **`forced` 만 본다**:
> ```ts
> export const handlesVisible = (_pxPerUnit: number, _pointerType: string, forced: boolean): boolean => forced;
> ```
> **자동 배율 문턱(`pxPerUnit < INTERACT.zoneDirectMinPxPerUnit`, 상수 1.28)을 뗀 이유 둘:**
> ① 실측 배율 분포(7인치 0.663 · narrow 0.891 · PC 핀 0.899 · PC 오버레이 1.151 ·
> 27인치 1.675)가 문턱 1.28 을 **여러 번 넘나든다** — 그대로 두면 *줌이 조작 규칙을 바꾸는
> 사고*가 된다. ② 7인치 태블릿은 0.663 이라 문턱이 **늘 참**이다. 즉 자동 분기를 남기면
> 결정 ④ 의 *"2존 기본 OFF"* 가 하필 이 앱의 1순위 기기에서만 거짓말이 된다.
>
> **인자 둘을 지우지 않고 남긴 것은 의도다.** 계약(§5.12)과 호출부를 그대로 두면서
> *"배율과 포인터 종류를 무엇으로 넣어도 답이 안 바뀐다"* 를 **단언 가능한 성질**로 만들기
> 위해서다 — `src/physics/twoZone.test.ts` 의 매트릭스가 자동 문턱의 부활을 막는 자물쇠다.
> `forced` 를 넣는 곳은 설정 [접근성] > **2존 모드** 토글(`prefs.a11y.twoZone`, 기본 OFF)이다.

**히트 우선순위 (이 순서로만)**
1. 공 / 콘 / 메모 — **자기 픽 반지름** (`r + pickPadCssPx/pxPerUnit`, 상한 §7.3)
2. **어떤 휠체어든 정확한 OBB 본체** (pad 없음)
3. 선택된 화살표의 핸들 (from / ctrl / to)
4. 선택된 휠체어의 존 핸들 (표시 중일 때만, **최근접 1개**)
5. 휠체어 hull + `grabPadPx` — 후보가 여럿이면 `|lat|` 최소
6. 화살표 stroke

**존 핸들이 1·2 보다 뒤인 것이 결정적이다.** 핸들 스팬은 저배율에서 월드 150 px(6 m)에 달하므로
앞에 두면 선택된 휠체어의 핸들이 반경 3 m 안의 다른 휠체어·공 탭을 전부 가로챈다.
"빈 공간 위의 핸들" 일 때만 최우선을 갖는다.

**존 핸들의 레버는 월드 고정, 시각 반지름만 화면 고정이다.**
```ts
INTERACT.handleLeverPx = { towRear: -37.5, translate: 0, spin: 22.5, towFront: 60 }
zoneHandles() 의 pos = pointAtLever(pose, lever),  hitR = 22/pxPerUnit,  viewR = 11/pxPerUnit
beginDrag(zoneHandle) 은 grabFromLever(lever) 를 그대로 래치한다  →  T = pos 에서 G = T
```
**화면 고정 오프셋 + 차체 고정 s 의 조합은 금지다.** 두 좌표가 불일치하면 손가락을 얹기만 해도
차체가 41 px(1.65 m) 혼자 전진한다(실측 시나리오). 핸들 렌더 위치와 래치 레버는 **반드시 같은
함수에서** 나와야 한다. 저배율에서 핸들 히트원이 겹치므로 **최근접 1개** 규칙을 적용한다.

**핸들 표시 조건**: 터치 && `pxPerUnit < 3.2`, 또는 사용자가 "존 핸들 항상 표시" 를 켠 경우.
`3.2 = 24 CSS px / (0.20 × 37.5 px)` — 가장 좁은 '평행 이동' 밴드가 WCAG 2.5.8 최소 24 px 를
만족하는 배율. 실측 레이아웃 기준 풀코트 기본 배율은 0.84~0.96 이라 **터치에서는 핸들이 정상 경로**다.
핸들에는 피벗→핸들 리더 라인을 그려 소속을 알린다.

마우스/펜은 배율과 무관하게 직접 존 잡기가 가능하되, **hover 프리뷰(차체 위 4밴드 오버레이 +
존 이름 툴팁)는 선택이 아니라 필수 요소**다 — 4.5 px 밴드를 눈으로 확인할 수 있어야 한다.

### 5.13 UI 가 의존하는 최소 계약

UI 는 `matter-js` 를 **직접 import 하지 않는다**. 테스트에서는 이 인터페이스의 목으로 편집기
전체를 검증한다.

```ts
export interface PhysicsSnapshot { [id: string]: { x: number; y: number; theta: number } }
export interface DragHandle { readonly zone: DragZone | null; move(worldPt: Vec2, nowMs: number): void; end(): void }
export interface PhysicsWorldApi {
  load(cast: DrillCast, step: DrillStep, mode: CourtMode): void;
  step(dtS: number): void;
  read(out?: PhysicsSnapshot): PhysicsSnapshot;
  beginDrag(hit: HitResult, grabWorld: Vec2): DragHandle | null;
  zoneAt(id: ChairId, worldPt: Vec2): DragZone | null;
  isSettled(): boolean;
  dispose(): void;
}
```

---

## 6. 렌더 · 상태 · 화면

### 6.1 60 fps ↔ React 경계 — 규칙 3가지

> **규칙 1. `transform` 속성은 JSX 에 절대 나타나지 않는다.**
> React 는 자기가 렌더한 속성만 재조정한다. `<g>` 에 `transform` prop 을 주지 않으면 상위
> 리렌더가 일어나도 rAF 워커가 쓴 라이브 위치가 되돌려지지 않는다.
>
> **규칙 2. `transform` 소유자는 언제나 `TransformWriter` 하나뿐이다.**
> 스텝 간 트윈도 CSS 가 아니라 같은 워커의 rAF lerp 로 처리한다.
>
> **규칙 3. React → 물리는 명령형 호출, 물리 → React 는 커밋 1회.**

```
┌──────────── React 트리 (저빈도) ────────────────────────────────────┐
│ EditorState(Drill, stepId, tool, selection, history, epoch)          │
│   │ 구조 렌더: <g data-oid ref=register>   (transform 없음!)         │
│   ▼                                                                  │
│ ObjectLayer ── ref 등록 ──▶ TransformWriter (Map<id, SVGGElement>)   │
└──────────────────────────┬───────────────────────────────────────────┘
                           │ write(id, x, y, rad) ← 60 fps, setAttribute
┌──────────────────────────┴───────────────────────────────────────────┐
│ RafScheduler (앱 전체 단일 루프)                                      │
│   ├─ PhysicsWorld.step(고정 dt) → read()      [편집기 드래그·정착]    │
│   └─ sampleDrill(t) → RenderFrame             [스텝 전환·재생]        │
└──────────────────────────────────────────────────────────────────────┘
                           │ 체이스·정착 종료
                           ▼   dispatch({type:'PLACE_COMMIT', …})  ← 리렌더 1회
```

### 6.2 `src/render/transformWriter.ts`

```ts
export interface TransformWriter {
  register(id: string, el: SVGGElement | null): void;
  registerCounter(id: string, el: SVGGElement | null): void;   // 등번호 역회전 노드
  write(id: string, x: number, y: number, rad: number): void;
  writeFrame(frame: Readonly<Record<string, { x: number; y: number; theta: number }>>): void;
  snapshot(): Record<string, { x: number; y: number; theta: number }>;
  clear(): void;
}
export function createTransformWriter(): TransformWriter;
```

구현 요건 (전부 심사 반영):

1. **클로저 지역 함수로 정의하고 메서드는 그것을 참조한다.** `writeFrame(){ … this.write() }`
   같은 객체 리터럴 메서드는 `raf.add(writer.writeFrame)` 로 넘기는 순간 `this` 가 undefined 라
   즉시 크래시한다(ESM strict).
2. **`register(id, el)` 은 마지막 프레임을 즉시 기록한다.** 안 하면 마운트 첫 페인트에 개체
   전부가 viewBox 원점에 겹치고, 시연의 드릴 전환(`key={drillId}` 재마운트)처럼 아무도 write 하지
   않는 경로에서는 **영구 고착**한다.
   ```ts
   const frame = new Map<string, {x:number;y:number;theta:number}>();
   register(id, el) {
     if (!el) { els.delete(id); prev.delete(id); return; }
     els.set(id, el);
     const p = frame.get(id); if (p) apply(id, el, p.x, p.y, p.theta);
   }
   ```
   추가로 `ObjectLayer` 는 `useLayoutEffect(() => writer.writeFrame(place), [])` 로 최초 프레임을
   페인트 전에 확정한다.
3. **숫자로 먼저 비교하고 바뀐 것만 문자열화한다.** `toFixed` 3회 + 템플릿 리터럴을 무조건
   만든 뒤 비교하면 정지 개체도 프레임당 4개의 임시 문자열을 만든다. 콘 40개면 초당 14,400개 →
   저사양 태블릿에서 GC 스파이크.
   ```ts
   const EPS_PX = 0.1, EPS_RAD = 1e-3;
   // prev 와 비교 후 변경분만 setAttribute
   //   본체: `translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${(rad*DEG).toFixed(2)})`
   //   등번호: `rotate(${(-rad*DEG).toFixed(2)})`
   ```
4. `for...in` 대신 `Object.keys()`.
5. SVG 자식에 CSS `transform` 을 쓰지 말고 **`transform` 속성**을 쓴다(Safari `transform-box`).

### 6.3 `src/render/rafLoop.ts`

```ts
export const raf: { add(fn: (dtMs: number, nowMs: number) => void): () => void };
```
```ts
private tick = (now: number) => {
  const dt = Math.min(50, now - this.last);
  this.last = now;
  this.id = 0;                                     // ★ 콜백이 해지해도 상태 일관
  for (const fn of Array.from(this.subs)) fn(dt, now);   // ★ 순회 중 Set 변경 방어
  if (this.subs.size && !this.id) this.id = requestAnimationFrame(this.tick);
};
```
tick 마지막에 무조건 `requestAnimationFrame` 을 예약하면, **마지막 구독자가 tick 안에서
해지할 때**(정확히 `isSettled()` 와 트윈 종료가 그렇다) `cancelAnimationFrame` 이 이미 발화한
프레임 id 를 취소해 no-op 이 되고 루프가 영원히 멈추지 않는다 → Wake Lock 을 켠 90분 시연에서
배터리를 그대로 태운다.

여기서 clamp 한 `dt` 는 **렌더 트윈 전용**이다. 물리는 §5.8 의 고정 dt 누산기가 소비한다.

### 6.4 `src/render/CourtStage.tsx` — 좌표 변환 · 줌 · 포인터

**줌/팬은 필수 기능이다** (a11y blocker). 실측 레이아웃(레일 84 + 도구레일 66 + 인스펙터 312
= 462 크롬, 스테이지 패딩 20/24, 헤더 62, 트랜스포트 ~95)에서 iPad 11"(1180×820) 풀코트는
`pxPerUnit = 0.8375` → 차체가 화면상 **31.4 CSS px**, 존 폭 3.8 / 6.3 / 16.6 / 4.7 CSS px 다.
1 CSS px ≈ 0.19 mm 이므로 견인 존은 0.7 mm — 맨손 접촉면(7~9 mm)으로 조준 불가능하다.
데스크톱 1920×1080 에서도 견인 존은 7.9 CSS px 로 24 px 미달이다.

```ts
export interface StageView { x: number; y: number; w: number; h: number }   // 현재 viewBox
export interface StageMetrics {
  rect: DOMRect; view: StageView;
  pxPerUnit: number; offX: number; offY: number;
}
export function computeMetrics(rect: DOMRect, view: StageView): StageMetrics {
  const pxPerUnit = Math.min(rect.width / view.w, rect.height / view.h);   // 'meet'
  return { rect, view, pxPerUnit,
    offX: rect.left + (rect.width  - view.w * pxPerUnit) / 2,              // 'xMid'
    offY: rect.top  + (rect.height - view.h * pxPerUnit) / 2 };            // 'YMid'
}
export function clientToWorld(m: StageMetrics, cx: number, cy: number): Vec2 {
  return { x: m.view.x + (cx - m.offX) / m.pxPerUnit, y: m.view.y + (cy - m.offY) / m.pxPerUnit };
}
export function zoomAt(view: StageView, def: CourtDef, focus: Vec2, factor: number): StageView;
```
`getScreenCTM()` 을 쓰지 않는 이유: jsdom 에 없어서 단위 테스트가 불가능하고, Safari 에서 CSS
transform 조상 아래 부정확한 사례가 보고된다. `preserveAspectRatio="xMidYMid meet"` 역산은
순수 함수라 테스트 가능하다.

> **※ §6.4 태블릿 표시 회전 각주 (2026-08-09, 기현 지시).** 원칙: **코트의 긴 축을 화면의 긴
> 축에 맞춘다.** 화면이 좌우로 길면 지금대로(풀=가로축, 하프·플랫=세로축), 위아래로 길면
> 그 반대가 된다. 구현은 그 둘을 따로 정의하지 않고 **스테이지를 90° 돌리는 것 하나**로
> 얻는다 — 돌리면 공격축이 자동으로 뒤집히기 때문이다.
> · 판정: `rotForRect(rect)` — **svg 가 실제로 차지한 상자** 기준(창이 아니라). 인스펙터가
>   옆에 있느냐 아래로 갔느냐에 따라 남는 상자가 달라지므로. 임계 0.95(정사각형 근처에서
>   판이 홱홱 돌지 않게).
> · 방향은 **시계방향**. 하프 코트의 골(아래)이 왼쪽으로 가서 공격 방향이 왼→오른쪽이 된다.
> · 회전은 **표현 계층에만** 산다. 월드 좌표·물리·모델·골든값은 한 줄도 바뀌지 않는다 —
>   `computeMetrics(rect, view, rot)` 가 상자의 가로·세로를 바꿔 잡고, CourtStage 가 월드
>   콘텐츠 전체를 `<g>` 하나로 돌린다.
> · ⚠️ **글자는 같이 돌면 안 된다.** 등번호·격자 라벨·메모·배치 커서는 `stageRot.tsx` 로
>   자기를 되돌린다. 등번호는 60fps writer 가 쓰는 `<g>` **안쪽에** 정적 `rotate(−rot)` 를
>   하나 더 두는 방식이라 프레임 루프는 회전의 존재를 모른다.
> · ⚠️ **화살표키는 화면 기준이다**(§7.5). `screenDeltaToWorld` 로 옮긴다 — 월드 +x 로
>   고정하면 세로 화면에서 오른쪽 키가 개체를 아래로 내려보낸다.
>
> **레이아웃(§6.4)**: 창이 세로면 3분할(도구|코트|속성) 대신 세로로 쌓는다 — 도구 레일이
> 하단 가로로 눕고, 속성은 하단 시트(기본 접힘)로 간다. 코트 폭이 750px 로 넓어진다.
> 레이아웃 판정은 **창** 기준이고 스테이지 회전은 **코트 영역** 기준이라 서로 다른 신호를
> 쓴다 — 같은 값으로 묶으면 패널이 내려가 코트가 넓어졌는데도 계속 세로로 판정한다.

- 줌 배율 `INTERACT.zoomMin(1) … zoomMax(6)`. 두 손가락 핀치, `Ctrl/⌘ +/−`, `+/−` 버튼(44×44).
- **두 번째 포인터가 내려오면 진행 중인 드래그를 취소하고 핀치-줌 모드로 전환한다** —
  이것이 "두 번째 손가락 완전 무시" 규칙의 유일한 예외다.
- `view` 는 코트 viewBox 를 `CHAIR.hullRadiusPx` 만큼 확장한 범위 안에 머문다.
- `StageMetrics` 는 **ref** 로 보관하고 리렌더를 유발하지 않는다. 히트 반경 계산에 필요한
  `pxPerUnit` 만 디바운스 100 ms 의 state 사본을 하나 더 둔다.
- **드래그 시작 시 rect 를 다시 읽는다.** `ResizeObserver` 는 위치 이동을 관측하지 않으므로,
  iOS URL 바 접힘·페이지 스크롤·`visualViewport` 변화에서 좌표가 어긋난다.
  `visualViewport` 의 `resize`/`scroll` 과 `window` 의 capture 단계 `scroll` 도 구독한다.

**포인터 통합** — 마우스·터치·펜은 전부 Pointer Events 한 경로.
```ts
function onPointerDown(e: React.PointerEvent) {
  if (active.current !== null) { /* 두 번째 포인터 → 핀치 모드 */ return; }
  if (e.pointerType === 'touch' && (e.clientX < 20 || e.clientX > innerWidth - 20)) return;
  metrics.current = computeMetrics(svgRef.current!.getBoundingClientRect(), view.current);
  active.current = e.pointerId;
  e.currentTarget.setPointerCapture(e.pointerId);
  begin(clientToWorld(metrics.current, e.clientX, e.clientY), e.pointerType === 'pen' && e.button === 5);
}
function onPointerMove(e: React.PointerEvent) {
  if (e.pointerId !== active.current) return;
  target.current = clientToWorld(metrics.current, e.clientX, e.clientY);   // ★ ref 에 기록만
}
```
**`pointermove` 에서 물리를 직접 호출하면 안 된다.** 120 Hz 태블릿은 프레임당 2회, 
`getCoalescedEvents()` 를 순회하면 8~10회 들어와 프레임당 변위 클램프가 그만큼 반복 적용되어
**실효 속도가 2~10배**가 된다(REQUIREMENTS §4.4 위반). 물리 호출은 rAF tick 하나에서만 한다:
```ts
unsub.current = raf.add(() => {
  const t = target.current;
  if (t) handle.current?.move(t, performance.now());     // 프레임당 정확히 1회
  physicsStepAccumulated();                              // §5.8 고정 dt 누산기
  writer.writeFrame(world.read(scratch));
});
```
`getCoalescedEvents()` 는 자유곡선 잉크에만 쓰고 물리 조작 경로에서는 쓰지 않는다.

필수 CSS:
```css
.stage-svg { touch-action: none; user-select: none; -webkit-user-select: none;
             -webkit-touch-callout: none; }
body { overscroll-behavior: none; }
html, body, #root { height: 100vh; height: 100dvh; }   /* dvh 폴백 순서 */
```
`pointercancel` 은 `pointerup` 과 **동일하게** 처리한다(iOS 시스템 제스처 가로채기).

`DRAG_ARM` 과 탭 임계는 **같은 단위(CSS px)** 여야 한다. `dragArmCssPx = 4 < tapMaxMoveCssPx = 6`
을 불변식으로 두고, 겹치는 구간은 **드래그 우선**("무장된 드래그가 있었으면 pointerup 은 탭이
아니다"). 서로 다른 단위면 배율에 따라 "탭도 드래그도 아닌 무반응 구간"이 생긴다.

### 6.5 히트 반경 상한 (blocker 수정)

`HIT_PX/2 / pxPerUnit` 를 무제한 역환산하면 iPad 11" 에서 공의 히트 원이 **지름 2.10 m**가 되어
휠체어(1.5 m)보다 커진다. 레이어 순서상 공이 위라 **볼 캐리어를 절대 잡을 수 없다.**
```ts
export const HIT_R_MAX_PX = { chair: 21.25, ball: 11.25, cone: 8.75, note: 12.5 } as const;
export const hitRadius = (kind: keyof typeof HIT_R_MAX_PX, pxPerUnit: number): number =>
  Math.min((INTERACT_HIT_PX / 2) / pxPerUnit, HIT_R_MAX_PX[kind]);
```
부족한 터치 타깃은 히트 영역이 아니라 **줌(§6.4)과 존 핸들(§5.12)** 로 보상한다.
그리고 히트 판정은 `pointer-events` 에 맡기지 않고 **월드 좌표 기준 순수 함수**
`hitTest()` 로 한다(§5.12 우선순위). 투명 히트 도형은 **키보드 포커스 타깃 용도로만** 남기고
`pointer-events: none` 으로 돌린다.

`ObjectLayer` 의 렌더 순서는 §3.5 를 따르되(콘 → 화살표 → 휠체어 → 공 → 메모),
클릭 우선순위는 `hitTest` 가 독립적으로 정한다.

### 6.6 레이어 구조

```xml
<svg viewBox={view} preserveAspectRatio="xMidYMid meet" role="application"
     tabIndex={0} aria-label="코트 편집 영역" aria-describedby="court-help">
  <defs><ArrowMarkers uid={useId()} colors={usedColors}/></defs>
  <rect width={vbW} height={vbH} rx={14} fill={COURT_BG}/>
  <CourtSurface mode variant/>          <!-- React.memo, mode+variant 에만 반응 -->
  <GridOverlay/>                        <!-- React.memo, aria-hidden, pointer-events:none -->
  <RuleZones/>                          <!-- React.memo -->
  <g class="arrows">   ArrowPath ×N (케이싱 + 본선)
  <g class="objects">  ConeMark / ChairChip / BallDot / NoteLabel  — transform 없음(!), ref 등록
  <SelectionOverlay/>  선택 링 · 4존 힌트 · 러버밴드 · 리시 · 고스트 (직접 DOM 조작)
  <ZoneHandles/>       선택된 휠체어의 존 핸들 4개 + 리더 라인
  <ArrowHandles/>      선택된 화살표의 from/ctrl/to 핸들
  <KeyboardCursor/>    키보드 배치 커서 (십자)
</svg>
```

`CourtSurface` 라인 마크업은 `template.html` 259–305행(편집기)·413–461행(시연)에서 그대로
이식하고 굵기만 prop 으로 받는다.

| variant | 외곽선 | 골지역 | 골 십자 | 킥인 원 | 센터점 |
|---|---|---|---|---|---|
| `editor` | 3 | 2.8 | 2.2 | r=4, sw 1.5 | r=4.5 |
| `present` | 3.2 | 3 | 2.4 | r=4.4, sw 1.6 | r=5 |
| `thumb` | 4 | 3.25 | — | — | r=2 |

**마커 id 는 SVG 루트마다 유일해야 한다.** 전역 `mkAmber`/`mkCyan` 을 쓰면 목록 카드 50장이
같은 id 를 문서에 중복 정의하고, `url(#mkAmber)` 는 문서 순서상 첫 번째로 해석되므로
목록 → 편집기 이동 시 화살촉이 통째로 사라지거나 가상화 카드가 붙었다 떨어질 때 깜빡인다.
```tsx
const uid = useId();
// 한 SVG 안에서 '실제로 쓰인 색 집합' 만큼만 마커를 만든다 (보통 1~2개)
<marker id={`${uid}-${color.slice(1)}`} …><path fill={color}/></marker>
// marker-end={`url(#${uid}-${arrowColor(a).slice(1)})`}
```
`ARROW_STYLES` 에 `markerId` 필드를 두지 않는다(§3.5). `context-stroke` 는 구형 태블릿 오프라인
배포 가정과 맞지 않아 쓰지 않는다.

**화살표는 케이싱(halo)을 반드시 넣는다.** `#38bdf8` 는 코트 대비 2.49:1 로 WCAG 1.4.11(3:1)
미달이다. 같은 `d` 를 두 번 그려 아래층 `stroke={ARROW_CASING} stroke-width={w+2.4}`(코트 대비
3.93:1), 위층에 기존 색. 마커도 동일 처리.

**규칙 존**은 `fill: var(--accent) opacity:.1` 을 폐기한다(합성 대비 **1.19:1** — 안 보인다).
`fill="#ffffff" opacity=".14"` + 경계에 `stroke="#ffffff" stroke-width="2" stroke-dasharray="8 6"`
(5.34:1). 면이 아니라 파선 테두리가 기능을 전달한다.

**공**: 물리 반지름 4.125 px, 시각 반지름 7 px(프로토타입). 2.875 px(0.115 m) 괴리는 의도적이며
`§12-Q4` 로 코치 확인 대상이다.
**콘**: 슬롯 0 = 채운 삼각형(10×9 px), 슬롯 1 = 삼각형 + **밑변 사각 베이스**(`M-6,4.5 H6 V6.5 H-6 Z`).
색이 아니라 **실루엣**으로 구분한다 — 흰 가로 띠(1.8 px)는 iPad 배율에서 1.5 px 얼룩으로 사라져
"색각 이상 대응" 근거가 성립하지 않는다. 둘 다 `stroke={OBJ_STROKE} stroke-width="1.6"`.

### 6.7 상태 관리

zustand 등 추가 의존성 없음. **god-context 금지** — 5개로 분할하고 각각 `{State, Dispatch}`
**별도 Provider** 로 노출한다(dispatch 만 쓰는 컴포넌트가 state 변경에 리렌더되지 않는다).

| Provider | 마운트 범위 | 담는 것 |
|---|---|---|
| `SettingsProvider` | 앱 전역 | `Preferences` 전체 + `resolvePhysics` 결과 |
| `LibraryProvider` | 앱 전역 | `DrillSummary[]`, `ResolvedSession[]`, 필터·검색어, repo 액션 |
| `EditorProvider` | `editor` 화면에서만 | `Drill` + 편집 UI 상태 + history + WorldHandles ref + TransformWriter |
| `PlaybackProvider` | `editor`·`present` 공용 | `playing`, `speed`, 누적 타이밍 ref (**stepIndex 없음**) |
| `ToastProvider` | 앱 전역 | 토스트 큐 |

`EditorProvider` 는 화면을 떠나면 언마운트되어 물리 엔진과 히스토리를 함께 정리한다.

**현재 스텝의 소유자는 `EditorState.stepId: StepId` 하나뿐이다.** index 는 파생한다.
```ts
export const selectStepIndex = (s: EditorState): number => {
  const i = s.present.steps.findIndex(st => st.id === s.stepId);
  return i < 0 ? 0 : i;
};
```
`STEP_DELETE`/`STEP_REORDER` 리듀서는 `stepId` 가 사라진 스텝을 가리키면
`steps[min(idx, steps.length-1)].id` 로 반드시 재지정한다. index 를 상태로 두면 스텝 3개짜리
드릴에서 3번을 지웠을 때 `steps[2]` 가 undefined 가 되어 크래시하고, 재정렬 후에는 조용히
엉뚱한 스텝이 선택된다.

#### 리듀서 액션 — `src/store/editor/actions.ts`

```ts
export type EditorAction =
  // UI (히스토리 제외)
  | { type: 'TOOL_SET'; tool: ToolId }
  | { type: 'CONE_SLOT_SET'; slot: 0 | 1 }
  | { type: 'SELECT_SET'; ids: string[] } | { type: 'SELECT_TOGGLE'; id: string }
  | { type: 'SELECT_CLEAR' }
  | { type: 'STEP_SELECT'; id: StepId }                    // ★ index 가 아니라 id
  | { type: 'SAVED'; at: number }
  | { type: 'COMMIT_BREAK' }                               // 키 리피트 경계
  // 드릴 데이터 (히스토리 커밋)
  | { type: 'DRILL_LOAD'; drill: Drill }
  | { type: 'META_SET'; patch: Partial<Pick<Drill,'title'|'category'|'level'|'durationMin'|'tags'|'description'|'formation'>> }
  | { type: 'STEP_ADD'; afterIndex: number } | { type: 'STEP_DUPLICATE'; id: StepId }
  | { type: 'STEP_DELETE'; id: StepId } | { type: 'STEP_REORDER'; id: StepId; toIndex: number }
  | { type: 'STEP_META'; id: StepId; patch: { name?: string; note?: string; durationMs?: number } }
  | { type: 'OBJECT_ADD'; kind: 'ball'|'cone'; at: Vec2; colorIndex?: 0|1 }
  | { type: 'OBJECT_REMOVE'; id: CastId; scope: 'onward'|'thisStep'|'everywhere' }
  | { type: 'CHAIR_PLACE'; id: ChairId; pose: StoredChairPose }
  | { type: 'CHAIR_DEF'; id: ChairId; patch: Partial<Omit<ChairDef,'id'|'team'>> }
  | { type: 'OBJECT_NUDGE'; id: CastId; d: Vec2; dTheta: number }   // 키보드 미세조정
  | { type: 'PLACE_BEGIN' }                                        // 드래그 시작: 히스토리 경계만
  | { type: 'PLACE_COMMIT'; stepId: StepId; chairs; balls; cones }  // 경계 닫기 (past 안 건드림)
  | { type: 'ARROW_SET'; arrow: Arrow } | { type: 'ARROW_REMOVE'; id: ArrowId }
  | { type: 'NOTE_SET'; note: NoteLabel } | { type: 'NOTE_REMOVE'; id: NoteId }
  | { type: 'UNDO' } | { type: 'REDO' };
```

**불변식 (리듀서에서 강제)**
1. `steps.length >= 1`
2. 모든 `PoseMap` 의 키가 `cast` 에 존재한다
3. `cast.balls.length <= 10`, `cast.chairs` 는 팀당 정확히 ≤ 4
4. `stepId` 는 항상 존재하는 스텝을 가리킨다

#### 히스토리 — `src/store/editor/history.ts`

```ts
export interface HistoryState {
  past: Drill[]; present: Drill; future: Drill[];
  lastCommit: { key: string; at: number; runStart: number } | null;
  epoch: number;              // 구조 변경·시점 점프에만 증가
}
export const HISTORY_LIMIT = 50;
export const COALESCE_MS = 700;
export const COALESCE_RUN_MAX_MS = 5000;
```
리듀서가 표준 불변 갱신(변경 경로만 새 객체)을 하므로 스냅샷 = **이전 루트 참조를 push**.
딥카피 0회.

- `COMMIT_TYPES` = 드릴 데이터를 바꾸는 액션 전부
- `COALESCE_TYPES` = `META_SET`, `STEP_META`, `NOTE_SET`, `ARROW_SET`, **`OBJECT_NUDGE`**
- coalesce 키는 `` `${type}:${id}` ``. `COMMIT_BREAK`(keyup) 는 `lastCommit = null`
- `runStart` 로 연속 병합 최대 길이를 5초로 제한
- 새 커밋 → `future = []`
- **`epoch`**: `UNDO`/`REDO`/`DRILL_LOAD`/`STEP_*`/`OBJECT_ADD`/`OBJECT_REMOVE`/`CHAIR_PLACE`
  에서만 +1. `META_SET`/`STEP_META`/`NOTE_SET`/`ARROW_SET`/`PLACE_COMMIT`/`OBJECT_NUDGE` 는 유지

**키보드 이동은 반드시 `OBJECT_NUDGE` + coalesce 를 쓴다.** 키 하나마다 `PLACE_COMMIT` 을
발행하면 OS 키 리피트(초당 25~33회)로 **2초 만에 `HISTORY_LIMIT` 50 이 소진**되어 그 이전의
모든 편집 이력이 사라진다.

**드래그와 히스토리**: 드래그 중 위치는 DOM 에만 존재하므로 아무것도 안 쌓인다.
`pointerdown` 시 `PLACE_BEGIN`(past 에 present 를 push, present 는 불변),
**정착 종료 시 `PLACE_COMMIT`**(past 를 건드리지 않고 present 만 교체) — 드래그 1회 = undo 1회.
정착이 5초 안에 안 오면 강제 커밋한다. (`pointerup` 과 `settle` 두 곳에서 커밋하면 undo 엔트리가
2개가 되어 "공만 원래 자리로 돌아가고 휠체어는 그대로"인 중간 상태가 나온다.)

#### UI 리듀서 합성 (필수 — 안 하면 도구 버튼이 눌리지 않는다)

```ts
export interface EditorState extends HistoryState {
  stepId: StepId; tool: ToolId; coneSlot: 0|1;
  selection: ReadonlySet<string>; savedAt: number | null; baselineUpdatedAt: number;
}
export function editorRootReducer(s: EditorState, a: EditorAction): EditorState {
  const ui = uiReducer(s, a);                    // TOOL_SET / SELECT_* / STEP_SELECT / … (항등이면 같은 참조)
  const h  = withHistory(drillReducer)(ui, a);   // COMMIT/UNDO/REDO 만 (항등이면 같은 참조)
  return h === ui ? ui : { ...ui, ...h };
}
```

#### 물리 재동기화 (blocker 수정)

```ts
useEffect(() => {                     // 월드 재구축: 로스터·코트가 바뀔 때만
  world.current?.load(state.present.cast, currentStep, state.present.courtMode);
}, [state.present.cast, state.present.courtMode]);

useLayoutEffect(() => {               // 프레임 세팅: 스텝 점프·undo 에만
  frameSync(currentStep, /* immediate */ structuralJump.current);
}, [state.stepId, state.epoch]);
```
`[state.present]` 에 걸면 메모 6글자 타이핑에 25바디 월드가 6번 재생성되고, `PLACE_COMMIT` 이
`writeFrame(pointerup 시점 포즈)` 를 강제해 **굴러가던 공이 정지·역행하며 제자리로 스냅**된다.
`PLACE_COMMIT` 은 이미 DOM/물리와 값이 같으므로 **어떤 재동기화도 하지 않는다**(단방향: 물리 → React).

#### 스텝 전환 트윈 (blocker 수정)

프레임 동기화 진입점은 하나이고 그 안에서 트윈/즉시를 분기한다:
```ts
const frameSync = (to: DrillStep, immediate: boolean) => {
  tween.current?.cancel();
  const from = writer.snapshot();                       // ← 트윈 시작점의 단일 출처
  const ms = immediate || reduceMotion ? 0 : PLAYBACK.transitionMsFor(stepMs);
  if (ms === 0) { writer.writeFrame(poseFrame(to)); return; }
  tween.current = startTween(from, poseFrame(to), ms, easeStandard, raf, writer);
};
```
`immediate = true` 는 undo/redo·드릴 로드·코트 재마운트에만. **스텝 이동은 항상 트윈**이다.
조건 없이 `writeFrame` 하면 프로토타입의 `.6s` 전환이 통째로 사라진다.

### 6.8 화면 골격 — `src/app/`

```ts
export type Screen = 'home' | 'library' | 'editor' | 'present' | 'settings';
export function useAppHistory(initial?: Screen): {
  screen: Screen; go(next: Screen): void; back(fallback: Screen): void;
};
```
`go` 는 `history.pushState` + depth++, `back` 은 depth > 0 이면 `history.back()` + depth--,
아니면 `go(fallback)`. **시연 종료는 반드시 `back('editor')`** — `go` 로 하면 히스토리에 쌓여
뒤로가기가 시연 재진입 토글이 되고, `autoFullscreen` 이 기본 ON 이라 제스처 없이 호출된
`requestFullscreen` 이 거부 → `pseudo` 폴백으로 떨어져 CSS 의사 전체화면에 갇힌다.

> **※ §6.8 재편 각주 (2026-08-09, 기현 지시).** 화면 키가 **5개 → 4개**가 됐다:
> `home | library | present | settings`. `editor` 는 별도 화면 키에서 **없앴다** — 대문에
> **자유 전술판이 상시 떠 있고**, 드릴을 열면 **같은 자리에 같은 컴포넌트**
> (`EditorWorkspace`)가 `mode='drill'` 로 뜬다. 무엇이 떠 있는지는 화면 키가 아니라
> `AppShell` 의 `StageTarget`(`board | drill`)이 정한다.
> · 전술판 = 1장짜리(스텝·트랜스포트 없음), `drillRepo` 자동저장 없음, 스냅샷 1장만
>   `localStorage`(`src/storage/board.ts`), 코트 전환 가능(D12 재편 각주), `[드릴로 저장]` 으로 승격.
> · 드릴 = 스텝·트랜스포트·자동저장 있음, 코트 불변.
> · 옛 대문의 훈련 현황 대시보드는 **목록 화면 상단**으로 옮겼다(`HomeDashboard`).
> · `CourtPicker` 는 은퇴했다. `prefs.defaultCourtMode` 는 전술판의 시작 코트가 됐다.
> · 시연 종료는 `back('editor')` → **`back('home')`**.
> · 헤더: `home` 은 정적 헤더를 받지 않는다(화면이 `useAppHeader` 로 직접 선언). 정적 config 를
>   주면 `AppHeader` 의 config prop 이 Context 를 덮어써 그 헤더가 통째로 사라진다.

> **※ §6.8 재편 각주 2 (2026-08-12, 계획서 2.1 — 3단 레일). 화면 키를 늘리지도 줄이지도
> 않았다: `home` → `board`, `library` → `drills` **개명만** 했다.** 위 2026-08-09 결정은
> 전부 그대로 유효하다. 확정형은 `src/app/screens.ts` 에 있다:
>
> | | 값 |
> |---|---|
> | `Screen` (`SCREEN_ORDER`) | `board` · `drills` · `present` · `settings` — **4개** |
> | `RailKey` (`RAIL_ITEMS`) | `board`(보드) · `drills`(드릴) · `settings`(설정) — **3개** |
>
> · **레일이 화면 키와 1:1 이 아니게 된 것**이 이번 재편의 유일한 구조 변화다. `present` 는
>   화면 키로 남되 **레일에서는 빠진다** — 레일로 들어오면 대상이 없어 *"시연할 드릴을
>   목록에서 선택하세요"* 만 뜨기 때문이다. 시연 중 레일 활성은 `SCREEN_TO_RAIL` 이 [드릴]로
>   접는다(레일이 편집기 내부 상태에 결합되는 것을 막는 명시적 상수 맵).
> · **옛 키 관용 경로**: `LEGACY_SCREEN_KEYS = { home: 'board', library: 'drills' }`.
>   사용자가 열어 둔 탭의 `history.state` 에 옛 키가 그대로 들어 있어, 지우면 그 탭들의
>   뒤로가기 이력이 통째로 무효가 된다. **한시적**이다 — 배포 후 한 사이클이 지나면 없앤다.
> · 시연 종료는 `back('home')` → **`back('board')`**.
> · 좁은 창(§5.1 boolean `narrow`)에서는 세로 레일이 **헤더 좌측 3칸 세그먼트**로 접힌다.
>   같은 3항목·같은 아이콘을 쓴다(`app/navChrome.ts` 의 `RAIL_ICONS` 가 그 사실의 단일 출처).
> · 옛 대문의 훈련 현황 대시보드(`HomeDashboard`)는 2.8/2.9 에서 **걷어냈다**.
> · **인쇄는 화면 키가 아니다**(4.5). `src/features/print/` 의 React 트리가 평소
>   `display:none` 으로 붙어 있다가 `@media print` 에서만 보인다.
> · ⚠️ **§3 첫 화면 표적 예산 ≤ 40.** [보드] 초기 화면 실측 37 / 서랍 둘 다 열림 40 — **여유 0**.
>   새 컨트롤은 초기 DOM 에 없는 곳(시트·서랍·모달·인스펙터 오버레이)에 넣는다.
>   `src/test/boardTargetBudget.test.tsx` 가 게이트다.

react-router 미도입 근거: 화면 4개·중첩 라우트 0·URL 공유가 제품 시나리오에 없음(드릴 공유는
`.json` 파일). 실제로 필요한 건 시스템 뒤로가기 하나뿐이고 그건 40줄이다. 라우터를 두면
전체화면 해제와 라우트 pop 이 같은 키 입력에 이중 동작할 위험이 있다.

**언세이브 데이터**: 확인 대화상자를 쓰지 않는다(`popstate` 는 취소할 수 없다). **자동저장**으로
문제를 없앤다 — 커밋 후 800 ms 디바운스 + 화면 전환 이펙트에서 동기 플러시 +
`visibilitychange:hidden` 플러시. 탭을 닫을 때 저장이 진행 중이면 `beforeunload`.

**헤더 조건부 표시** (프로토타입 `renderVals` 그대로): 코트 스위치 `(editor|present) && courtMode`
/ 검색 `library` / 시연 버튼 `(editor && courtMode) || library` / 주 액션
`home|library → 새 드릴`, `editor → 저장`, `present → 편집으로`.

> **※ 정정 각주 (2026-08-13, 6.3).** 위 **헤더 조건부 표시** 규칙은 화면 키 개명 전 문장이고
> (`home|library`·`editor`), `CourtPicker` 도 은퇴했다. 아래 **코트 모드 스위치 불변** 조항은
> 두 갈래로 갈렸다:
> · **드릴** — 여전히 불변이다(코트가 바뀌면 저장된 배치가 갈 곳을 잃는다).
> · **자유 전술판([보드])** — **판이 pristine 일 때만** 코트 형태(full/half/flat)와
>   **코트 규격 3단**(6.4)을 바꿀 수 있다. 판 위 개체가 0인 상태에서만 열리므로
>   *"코트를 줄였더니 선수가 밖에 서 있다"* 가 구조적으로 불가능하다.
>   규격 select 는 **인스펙터 오버레이 시트 안**에 있다(규칙: 표적 예산 ≤ 40, 여유 0).
>   하프·플랫에서는 select 를 내지 않고 *"규격 3단은 풀 코트에만 적용됩니다"* 라고 말한다 —
>   골라도 판이 안 변하는 컨트롤은 판이 거짓말하는 것과 같기 때문이다.
> 아래 `aria-disabled` + 토스트 패턴 자체는 여전히 유효한 계약이다.

**코트 모드 스위치는 v1 에서 불변이다** (프로토타입은 "변경할 수 없습니다" 안내와 `pickCourt`
스위치가 자기모순이다). 처리 방식은 공 도구 제한(§6.10)과 **동일 패턴**:
네이티브 `disabled` 를 쓰지 말고 `aria-disabled="true"` + `tabIndex={0}` 유지 +
`aria-describedby="court-lock-hint"`, 클릭/Enter 시 토스트로 같은 문구. 비활성 알약에 자물쇠
아이콘 12px 를 덧붙여 색·투명도 외의 단서를 준다. (`disabled` + `title` 은 키보드 도달 불가 +
터치에 hover 없음 + 스크린리더가 읽을 기회 없음 = 세 경로 모두에서 안내가 전달되지 않는다.)

### 6.9 시연 모드 — `src/features/present/`

```ts
export function useFullscreen(ref: RefObject<HTMLElement|null>): {
  state: 'off'|'native'|'pseudo'; supported: boolean;
  enter(o?: { userGesture: boolean }): Promise<void>; exit(): Promise<void>;
};
export function useWakeLock(enabled: boolean): 'idle'|'active'|'unsupported'|'denied';
export function useSwipe(o: { onPrev(): void; onNext(): void }): PointerHandlers;
```

| 브라우저 | 전체화면 | Wake Lock |
|---|---|---|
| Chrome/Edge (데스크톱·안드로이드) | ✅ `navigationUI:'hide'` | ✅ 84+ |
| Firefox | ✅ | ✅ 126+ |
| Safari macOS / iPadOS 12+ | ✅ (`webkit` 접두) | ✅ 16.4+ |
| **Safari iPhone** | ❌ (`<video>` 전용) → `pseudo` 폴백 | ✅ 16.4+ |

`pseudo` 폴백 CSS: `position:fixed; inset:0; z-index:100; height:100dvh; width:100vw;
padding: env(safe-area-inset-*)`. `index.html` 에 `viewport-fit=cover` 는 이미 있다 ✓
iPhone Safari 최초 진입 시 1회 안내(`prefs.hints.iosPwa`).

Wake Lock 은 **보안 컨텍스트 필수**. 사설 IP http 배포에서는 동작하지 않으므로
`unsupported`/`denied` 폴백 문구를 반드시 구현한다(`role="status"`, 6초):
"화면 꺼짐 방지를 사용할 수 없습니다. 기기 설정에서 화면 자동 잠금을 늘려 주세요."
무음 루프 `<video>` 해킹은 채택하지 않는다. 탭이 숨겨지면 브라우저가 자동 해제하므로
`visibilitychange` 에서 재획득한다.

**전체화면에서 나갈 UI 가 반드시 보여야 한다.** 시연 오버레이 우상단에 항상 표시되는
**44×44 '나가기' 버튼** (`aria-label="시연 종료"`, X 아이콘,
`background: color-mix(in srgb, var(--panel) 70%, transparent)`). 헤더는 숨기므로 '편집으로'
버튼이 사라지고, Android Chrome 네이티브 전체화면에서는 시스템 뒤로가기 2회라는 비가시적
지식에만 의존하게 된다.

**스와이프**: `|dx| > 60 CSS px && |dx| > 2|dy|`, 엣지 20 px 무시, 단일 포인터만.
**시간 상한(`SWIPE_MAX_MS`)은 두지 않는다** — 느린 제스처를 배제하면 운동 장애 사용자가
스텝을 넘길 수 없다. 시연 모드에는 다른 포인터 조작이 없으므로 오작동 위험도 없다.

**키보드** (시연): `→ ↓ PageDown Space` 다음 / `← ↑ PageUp` 이전 / `Home End` 처음·끝 /
`P` 재생 / `F` 전체화면 / `.` 블랙아웃 / `L` 반복 / `Shift+?` 도움말 /
`Esc` 는 2단 — 전체화면 중에는 브라우저가 가로채므로 `fullscreenchange` 로 창모드 복귀를
감지하되 **시연은 유지**하고, 창모드에서 받은 `Esc` 에서만 시연을 종료한다.
**블랙아웃 오버레이는 `onPointerDown={dismiss}` + `role="button" tabIndex={0}
aria-label="블랙아웃 해제"`** — 키보드로만 해제 가능하면 태블릿에서 검은 화면에 갇힌다.

**세션 시연**: `PresentScreen` 이 `sessionId` 를 받으면 드릴 진행 바 + 인터스티셜(2초) 추가.
드릴 전환 시 코트 모드가 다르면 `CourtStage` 를 `key={drillId}` 로 재마운트하고 200 ms
크로스페이드한다 — 이때 §6.2 의 `register` 즉시 기록이 없으면 개체가 좌상단에 영구 고착한다.
Wake Lock·전체화면은 세션 전체에 걸쳐 유지한다. `N` 다음 드릴, `Shift+N` 이전.
2026-08-16 — 시연 키를 편집기와 **같은 규칙**으로 맞췄다: 스텝은 `PageUp`/`PageDown`(방향키도
받는다), 재생은 `Space`, 토글은 `Alt+F`(전체화면)·`Alt+L`(반복)·`Alt+B`(화면 끄기). 개편 전에는
여기서만 `Space` 가 '다음 스텝'이고 재생이 `P` 였는데, 편집기에서 `P` 는 선수 도구다 — 같은
글자가 화면마다 다른 일을 하면 두 화면 사이에서 손이 뒤집힌다.

### 6.10 편집기 도구 9종 — `src/features/editor/`

> 2026-08-16 — 이동·패스가 **`line` 하나로** 합쳐졌고(뜻은 양 끝 화살촉이 나른다),
> 작도 도형 3종이 그 뒤에 섰다. 단축키는 같은 날 전면 개편됐다(§7.5f) — 숫자 키는 없다.

| # | key | 라벨 | 단축키 | 동작 |
|---|---|---|---|---|
| 1 | `select` | 선택 | `V` | 클릭 = 선택, Shift/⌘+클릭 = 토글, 빈 코트 드래그 = 러버밴드, **개체 드래그 = 4존 물리 조작** |
| 2 | `line` | 선 | `L` | 드래그로 화살표. 양 끝 화살촉은 반복 클릭으로 순환 |
| 3 | `shapeEllipse` | 원 | `O` | 작도 서랍 — `circle` 의 `c` 를 콘에 내주고 **oval** 로 본다 |
| 4 | `shapeTriangle` | 삼각 | `T` | 작도 서랍 |
| 5 | `shapeRect` | 사각 | `R` | 작도 서랍 |
| 6 | `ball` | 공 | `B` | 클릭 지점에 공 추가. **최대 10개** |
| 7 | `cone` | 콘 | `C` | 클릭 지점에 콘 추가. 2색, 무제한. 콘을 든 채 `C` 를 다시 = 색 토글 |
| 8 | `player` | 선수 | `P` | **미배치 선수를 코트에 배치** |
| 9 | `note` | 메모 | `N` | 클릭 지점에 텍스트 메모 |

**지우개 도구는 2026-08-16 에 제거됐다**(기현 지시). 삭제하는 문이 셋(지우개 도구 ·
`Delete` · `Ctrl/⌘+Delete`)이던 것을 **선택 후 `Delete`** 하나로 모았다. 쓸어서 여러 개를
지우던 경로는 러버밴드 선택 + `Ctrl/⌘+Delete` 가 대신한다. 부수 효과로 도형만 갖고 있던
"지우개면 즉시 삭제" 예외 분기와, 관대한 히트 반경이 파괴로 새지 않게 막던 `[A-2]` 의
두 번째 근거가 함께 없어졌다.

`select` 가 `V` 인 것이 머릿글자 규칙의 **유일한 예외**다: `s`·`e` 는 개체 조작이 가져갔고
`l`·`c`·`t` 는 다른 도구가 쓴다. 피그마·일러스트레이터·XD 가 전부 `V` 라 외부 관습을 근거로 삼았다.

콘은 공 바로 뒤(5번째)에 넣는다 — 레일 순서가 `포인터(1) → 작도(2–3) → 배치(4–6) → 주석(7)
→ 파괴(8)` 이고 콘은 "코트에 흩뿌리는 개체" 라 공과 같은 부류다.

도구 버튼 **52×50 px, 라벨 11px**(9px 은 저시력 하한 미달). 레일 높이 검증:
`8×50 + 7×5 + 26 + 코트라벨 30 = 491 px` < `최소 뷰포트 600 − 헤더 62 = 538` ✓

**콘 색 선택** — 플라이아웃 + 재클릭 토글. 도구 버튼 아이콘 우하단에 현재 색 점 8 px 을 항상
표시. 활성 상태에서 다시 클릭 = 색 토글. `C` 두 번도 토글. 플라이아웃은
`role="radiogroup" aria-label="콘 색상"`, 스와치 `role="radio" aria-checked`, 히트 44×44.

**공 11개째** — 모달 없음:
1. 10개가 되면 도구 버튼에 `aria-disabled="true"` + `opacity:.5`, 우상단 카운트 배지 `10/10`
2. 코트를 탭하면 아무것도 생성되지 않고 토스트: `공은 최대 10개까지 놓을 수 있습니다.`
   (`role="status"`, 3초, 중복 시 타이머만 리셋)
3. 배지는 공 1개 이상일 때 항상 `{n}/10`. `n ≥ 8` 이면 `--accent-text`
4. **버튼을 네이티브 `disabled` 로 만들지 않는다** — 포커스 가능 유지 + `aria-describedby`
   로 "최대 10개 도달" 을 연결해 스크린리더가 이유를 알 수 있게 한다

**선수 도구** = "미배치 선수를 코트에 배치". 로스터는 8명 고정(REQUIREMENTS §4.1)이므로
"9번째 선수 생성" 은 존재하지 않는다. 콘 플라이아웃과 같은 자리에 배치 팔레트(배지 19×26,
히트 44×44). 인스펙터 명단의 미배치 행(`opacity:.45` + `미배치` 라벨 + [배치] 버튼)에서도
같은 흐름이 시작된다.

**지우개**

| 대상 | 기본 클릭 | Alt/⌥ + 클릭 |
|---|---|---|
| 공 / 콘 / 메모 | 드릴에서 삭제(이 스텝부터 끝까지) | 현재 스텝만 |
| 화살표 | 현재 스텝에서 삭제 | — |
| **선수(휠체어)** | **삭제 아님 → 미배치** (로스터 8명 고정, 파괴하면 복구 경로 없음) | 현재 스텝만 |
| 코트 라인·격자·규칙 존 | 불가 (`pointer-events:none`) | — |

지우개 드래그는 지나간 개체를 연속 삭제하되 `pointerup` 에서 **한 번** 커밋(undo 1회로 전부 복구).
**모든 삭제 토스트에 [되돌리기] 액션 버튼을 붙인다.**

**화살표 편집**: 드래그로 생성(길이 < 12 px 이면 취소), 생성 시 시작점이 개체 중심 15 px 이내면
1회 스냅. 선택 시 핸들 3개 — `● from` / `◆ ctrl`(45° 회전 사각형, 색 없이 형태로 구분) / `● to`.
ctrl 에서 from·to 중점까지 `stroke-dasharray="3 3" opacity=".5"` 보조선. ctrl 더블탭 = 직선 복원.
드래그 중에는 `ARROW_SET` 을 dispatch 하지 않고 **DOM `d` 속성을 직접 갱신**, `pointerup` 에서만 커밋.

**4존 힌트**: 선택 도구 + 휠체어 hover/포커스 시 차체 위에 4밴드 구획을 `opacity:.28` 흰
구분선으로 표시하고 커서를 바꾼다 (`towRear/towFront → grab`, `translate → move`,
`spin → crosshair`). 드래그 시작 시 잡은 존을 `aria-live` 로 알린다.

### 6.11 훈련 세션 UI — 목록 화면의 탭

6번째 화면(레일 6개 = 프로토타입 5화면 구조 파괴)도, 대문 확장(대시보드 성격 변질)도,
모달(드릴 드래그 정렬 + 목록 참조를 동시에 못 봄)도 아닌 **목록 화면의 탭**을 쓴다.
세션은 개념적으로 "저장된 묶음" = 라이브러리 소속이고, 목록 상단에 이미 카테고리 알약 행이
있어 세그먼티드가 자연스럽게 얹힌다.

```
main (padding:22px 30px 46px, max-width:1180)
 ├ [탭] 드릴 | 세션          role="tablist", 알약 padding:8px 18px, min-height:44
 ├ (드릴 탭) 카테고리 알약 → 카드 그리드
 └ (세션 탭) 세션 리스트 행 (요일·시각 Space Grotesk 17px/700 + 장소 / 세션명 + 카테고리 점 /
                              총 시간 + "N개 드릴" + [시연] 44×44)
```
헤더 주 액션 라벨이 탭에 따라 `새 드릴` ↔ `새 세션` 으로 바뀐다.

**세션 편집 = 우측 드로어 380 px** (편집기 인스펙터와 같은 시각 언어).
기본 정보(세션명·일시·장소·계획 시간) / 드릴 목록(⠿ 드래그 핸들 44×44, 카테고리 점,
시간 입력, [×]) / `[+ 드릴 추가]` / `[세션 시연 시작]` 전폭 버튼 h:48.
정렬은 **포인터 기반 DnD**(HTML5 DnD 는 터치 미지원). 키보드는 핸들 포커스 후 `Alt+↑/↓`,
결과를 `aria-live` 로 알린다. 총 시간이 계획을 넘으면 `#e08a12` + `aria-describedby`.
드로어는 `role="dialog" aria-modal="false"`, 열 때 제목(`<h2 tabIndex={-1}>`)에 포커스,
`Esc`/닫기 시 **트리거였던 세션 행으로 포커스 복귀**.

**대문 '다음 훈련 세션' 카드**는 `upcomingSession()` 으로 실기능화한다.
시각 문자열은 `formatSessionWhen` 으로 직접 조립(로케일 조합 차이 방지). 드릴 행 최대 4개 +
`+N개 더`. 카드 전체가 버튼 → `go('library')` + 세션 탭 + 해당 드로어 열기.
세션이 없으면 빈 상태 + `[세션 만들기]`.

---

## 7. 접근성 계약 (v1 출시 조건)

사용자가 **장애인 스포츠 종사자**임을 전제로 아래를 출시 조건으로 확정한다.

### 7.1 대비 — 실측과 조치

| 조합 | 대비 | 조치 |
|---|---|---|
| dark `--text/--panel` 15.14 · `--muted/--panel` 6.79 | ✅ | — |
| light `--text/--panel` 18.05 · `--muted/--panel` 6.23 | ✅ | — |
| dark `--faint/--panel` **3.57** · `/--panel-2` **3.70** | ❌ | 본문에는 `--faint-text`(5.78/5.99) |
| light `--faint/--panel` **2.97** · `/--panel-2` **2.77** | ❌ | 본문에는 `--faint-text`(5.34/4.96) |
| light `--accent-ink/--accent` **2.90** | ❌ | accent 배경 위 글자는 `--accent-ink-strong`(5.83) |
| light accent-as-text `/--panel` **2.90** `/--panel-2` **2.70** `/--bg` **2.49** | ❌ | `--accent-text`(5.97/5.55/5.12) |
| dark accent-as-text `/--panel` 14.21 | ✅ | `--accent-text = var(--accent)` |
| 코트 위 흰 외곽선 `/#1f7a46` ~~5.34~~ → **4.78** | ✅ | 유지 (아래 각주 ①) |
| 코트 `#2f9e5c`(라이트): 흰 라인 **3.41**, 격자 .14 **1.21**, 규칙존 **1.12** | ❌ | **라이트 코트 배경 폐기.** 양 테마 모두 `#1f7a46` |
| 화살표 `#38bdf8/#1f7a46` **2.49** · `#fbbf24` **3.20** | ❌/△ | 검정 케이싱(**3.93**) 필수 |
| 규칙존 accent .10 합성 **1.19** | ❌ | 흰 .14 + 파선 흰 테두리(5.34) |
| 등번호 흰 글자: `#d93a3a` 4.55 / `#2b7fd4` **4.13** / `#e08a12` **2.69** / `#7c5cd6` 4.82 / `#22a95b` **3.05** | ❌ 일부 | `inkFor()` + 팀색 `#2b7fd4 → #1f6bb8`(5.45) |

**`--faint` 는 장식 전용이다.** §6 이하 모든 화면 인벤토리에서 사람이 읽는 텍스트는
`--faint-text` 를 쓴다: 헤더 부제, 대문 카드 메타·시각, 통계 단위, 코트 선택 치수, 도구 레일
코트 라벨, 인스펙터 역할·섹션 라벨·스텝 메모, 설정 설명, 세션 시간, 트랜스포트 우측 라벨.
장식으로 남기는 것: 격자 라벨, 구분선 옆 아이콘, 비활성 상태 표시.
**§9 마지막 웨이브에 `grep -rn 'var(--faint)' src/` 전수 감사를 넣는다.**

**등번호 잉크는 `inkFor(color)` 로 유도한다.** 프로토타입은 `mine && gk` 만 어두운 잉크였는데,
그러면 상대 GK(`#22a95b`)가 3.05:1, 앰버 팀색(`#e08a12`)이 2.69:1 로 읽히지 않는다.
등번호는 §7.5 "색에 의존하지 않는 팀 구분" 의 유일한 대체 표식이므로 이건 기능 요건이다.
홈 GK 잉크가 `#3a2e00` → `#14200a` 로 바뀌지만 육안 차이는 없다.

> **※ 정정 각주 (2026-08-13, 6.3). §7.1 에서 갱신된 것 셋.**
>
> **① `OBJ_STROKE` 는 4.78:1 이다** (5.34 아님). 5.34 는 **불투명 흰색** 기준이고 실제로 쓰는
> 값은 알파 .92 라, 코트(`#1f7a46`) 위에 합성하면 rgb(240,246,242) → **4.78:1** 이다.
> 같은 표의 `규칙존 … 파선 흰 테두리(5.34)` 행도 같은 값이므로 **4.78** 로 읽어야 한다.
> 기준(비텍스트 3:1)은 어느 쪽으로 세어도 넘으므로 **조치가 아니라 숫자 정정**이다.
> `src/test/docsMatchCode.test.ts` 가 `colors.ts` 의 그 한 줄을 파일에서 읽어 계산과 대조한다.
>
> **② 팀 구분은 색 밖에도 채널이 있다** (4.6 · 6.5). 상대팀 칩은 **파선 테두리**를 갖고,
> 6.5 부터 **차체가 밝은 칩(상대휘도 ≥ .25)은 테두리가 검정(`OBJ_STROKE_DARK`)으로 뒤집힌다** —
> 임계는 등번호 잉크가 흰색에서 검정으로 바뀌는 바로 그 지점이라, 눈으로 보는 규칙이
> *"글자가 검은 칩은 테두리도 검다"* 한 문장이 된다. 흰 테두리 고정이던 시절의 실측
> (`#e08a12` 2.50 · `#22a95b` 2.80 · `#f2c811` 1.55 — **기본 설정의 어웨이 GK 가 여기 걸렸다**)이
> 그 이유다. ⚠️ **공·콘·메모는 아직 이 규칙 밖이다**(흰 테두리 고정) — 아래 §7 남은 구멍.
>
> **③ 고대비·강제색 축이 생겼다** (5.6 · 6.6). `prefers-contrast` 와 `forced-colors: active`
> 대응이 `src/styles/contrast.css` 에 있고, CSS 는 jsdom 이 못 보므로 **파일을 텍스트로 읽는
> 계약 테스트**(`contrast.test.tsx` · `cssContract.ts`)가 그것을 지킨다.
> ⚠️ 강제색에서 *'켜짐'* 을 되살리는 규칙은 **`!important` 가 필수다** — 이 저장소의 켜짐
> 배경은 거의 전부 인라인 `style` 이고(대표: `src/ui/Button.tsx`), 캐스케이드는 오리진·중요도를
> 선택자보다 먼저 보므로 일반 author 규칙은 인라인에 진다(6.6 이 실측으로 찾은 결함).

### 7.2 포커스 표시 — `src/styles/a11y.css`

```css
:focus-visible { outline: 2px solid var(--accent-text); outline-offset: 2px; border-radius: inherit; }  /* [1] */
.on-accent:focus-visible { outline-color: var(--accent-ink-strong); box-shadow: 0 0 0 4px var(--accent); }

/* SVG 는 브라우저별 outline 렌더가 불안정 + accent 는 코트 위에서 라이트 1.17:1 → 이중 링 */
.court-obj { outline: none; }
.court-obj:focus-visible .focus-ind-outer,
.court-obj:focus-visible .focus-ind-inner { opacity: 1; }
.focus-ind-outer { opacity:0; fill:none; stroke:#000; stroke-width:5; }              /* 3.93:1 */
.focus-ind-inner { opacity:0; fill:none; stroke:#fff; stroke-width:2.5; stroke-dasharray:5 4; } /* 5.34:1 */

.sr-only { position:absolute; width:1px; height:1px; padding:0; margin:-1px;
           overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap; border:0; }
.skip-link { position:absolute; left:-9999px; }
.skip-link:focus { left:8px; top:8px; z-index:200; padding:10px 14px;
                   background:var(--accent); color:var(--accent-ink-strong);
                   border-radius:8px; font-weight:700; }
```
프로토타입은 포커스 스타일이 전무하다 — 위 CSS 가 그 결함을 정면으로 메운다.

**[1] 2026-08-08 정정.** 초판은 `outline: 2px solid var(--accent)` 였다 — §7.1 표가 바로 위에서
"light accent-as-text ❌ (2.49–2.90) → `--accent-text`(5.12–5.97)" 를 이미 판정해뒀는데, 그 조치가
이 포커스 링 규칙에만 안 붙어 있던 계약서 자체의 누락이었다(구현 오류 아님). 라이트 테마에서
`--accent` 를 outline 색으로 쓰면 인접 표면(`--bg`/`--panel`/`--panel-2`/`--elev`) 전부에서
2.49~2.90:1 로 SC 1.4.11 의 3:1 미달이었다. `--accent-text` 로 교체하면 다크는 값이 동일해
무영향(15.29/14.21/14.73/12.76, accent == accent-text), 라이트는 5.12/5.97/5.55/5.31 로 전부
3:1 을 넘는다. `src/styles/a11y.css`·`src/styles/tokens.css` 양쪽의 중복 `:focus-visible` 정의를
함께 고쳤다(후자는 로드 순서상 항상 a11y.css 에 덮이지만, 순서가 바뀔 미래를 대비해 값을 맞춰둔다).

### 7.3 터치 타깃

주 조작 컨트롤 **44×44 CSS px 이상**. 밀집 보조 컨트롤은 최소 32 px + 간격 8 px,
**어떤 경우에도 24 px 미만 금지**(WCAG 2.2 SC 2.5.8).

| 컨트롤 | 프로토타입 | 조치 |
|---|---|---|
| 레일 네비 64×58 · 테마 토글 44×44 · 시연 이전/다음 46 · 시연 재생 60 | ✅ | 유지 |
| 헤더 주 버튼 / 시연 버튼 (약 35–37 h) | ❌ | `min-height:44px` |
| 헤더 코트 알약 (29 h) | ❌ | 알약 `min-height:38`, 컨테이너 `min-height:44` |
| 도구 레일 50×48 | △ | **52×50** (라벨 11px) |
| 트랜스포트 이전/다음 35 · 재생 43 | ❌ | **44×44 / 48×48** |
| 스텝 타임라인 노드 15×15 | ❌ | 시각 15 유지 + 히트 `min(44, track/(n−1))` px, **24 미만이면 노드 렌더 중단** |
| 시연 스텝 바 height 6 | ❌ | 시각 6 + 히트 `height:44` 투명 래퍼 |
| 설정 토글 46×26 · 팀 색 스와치 30×30 | ❌ | 래퍼 `min-height:44` / 히트 44×44 |
| 카테고리 알약 (31 h) | ❌ | `min-height:40` (밀집 예외, 간격 8) |
| **인스펙터 선수 명단 행** (36 h) | ❌ | `padding:9px 0` → `min-height:44` |
| **대문 '전체 보기 →'** (17 h) | ❌ | `padding:8px 10px; margin:-8px -10px` |
| **헤더 검색 박스** (37 h) | ❌ | `min-height:44px` |
| **세션 드로어 [×]·시간 입력** | 미지정 | 44×44 / `min-height:44` |
| SVG 개체 | — | §6.5 `hitRadius()` + 상한 |

**타임라인 노드 겹침**: 트랙 폭은 데스크톱 약 700 px, iPad 11" 약 430 px 다. 노드 간격이
44 px 미만이 되는 순간(데스크톱 17스텝, 태블릿 11스텝)부터 히트 영역이 서로를 가린다.
`min(44, track/(n−1))` 로 클램프하고 그 값이 24 px 미만(트랙 430 기준 n ≥ 19)이면 노드 렌더를
중단하고 진행 바만 남긴 뒤 스텝 이동은 이전/다음 버튼과 인스펙터 스텝 목록에 위임한다.
인접 노드 사이 최소 간격 4 px 확보.

설정 **`큰 터치 타깃`** 토글: `body[data-touch="large"]` → `--hit: 56px`, SVG 히트도 56 기준.
설명에 "히트 영역만 커집니다" 를 명시한다(시각 크기는 `uiScale` 이 담당).

### 7.4 확대 — `uiScale`

체육관 태블릿에서 "브라우저 줌 200 %" 는 존재하지 않는다(iPadOS Safari 에 줌 UI 없음,
px 고정 폰트는 Dynamic Type 에 반응하지 않음, 스테이지는 `touch-action:none`).

- 설정 `a11y.uiScale: 1 | 1.15 | 1.3` → `document.documentElement.style.fontSize = 16*scale + 'px'`.
  **텍스트가 있는 컴포넌트만** rem 으로 작성한다(`ui/Button|Pill|Badge|Card`, 헤더, 인스펙터,
  설정, 세션 드로어). 전면 rem 전환은 하지 않는다.
- **폰트 하한**: 본문 12 px, 라벨 11 px. 프로토타입의 9 px(도구 라벨·코트 라벨)은 11 px 로 올린다.
- 코트 배율은 §6.4 의 스테이지 줌이 담당한다.
- 브라우저 줌 200 % 에서 가로 스크롤이 생기지 않는 것을 수용 기준으로 유지. 편집기만 예외적으로
  `< 1100 px` 이면 인스펙터를 하단 시트로 전환한다.

### 7.5 키보드 조작

**a. 화면 골격**
`<a class="skip-link" href="#main">본문으로 건너뛰기</a>` / `<nav aria-label="주요 메뉴">` +
`aria-current="page"` / 각 화면 `<main id="main" tabIndex={-1}>` / 헤더 타이틀은 실제 `<h1>` /
인스펙터 섹션 라벨은 `<h2>` / 편집기 3영역 = `<nav aria-label="도구">`,
`<div role="application" aria-label="코트 편집 영역">`, `<aside aria-label="드릴 속성">`.

**b. 코트는 하나의 컴포지트 위젯이다**
콘이 무제한이므로 개체마다 `tabIndex={0}` 을 주면 슬라럼 드릴에서 tab stop 이 50개를 넘어
WCAG 2.4.1 실패이고 스위치 인터페이스로는 인스펙터 도달이 불가능하다.
- SVG 루트에 `tabIndex={0}` **하나**, 개체는 `tabIndex={-1}`, 로빙 tabindex
- 컨테이너에 `aria-activedescendant`, `aria-describedby="court-help"`
  ("방향키로 커서 이동, Enter로 배치, Alt+←/→로 개체 순회")
- 개체 순회는 `Alt+←/→` (방향키는 이동에 쓰인다). 종류 건너뛰기는 `Alt+숫자`
- 순회 순서: 팀A 선수 → 팀B 선수 → 공 → 콘 → 메모 → 화살표
- `Esc` → `containerRef.current.focus({preventScroll:true})`. **컨테이너가 포커스 가능해야
  이 동작과 §7.5-d 의 키보드 커서가 성립한다** (프로토타입/설계안 3 에는 tab stop 이 없었다)

**c. 개체 포커스 상태의 키** (핸들러는 `<g>` 의 `onKeyDown` 에 붙이고 `stopPropagation`)

| 키 | 동작 |
|---|---|
| `←↑→↓` | 2.5 px (0.1 m) 이동 → `OBJECT_NUDGE` |
| `Shift + ←↑→↓` | 25 px (1 m) |
| `[` / `]` | 5° 회전 (Shift 15°) — 휠체어만 |
| `Enter` / `Space` | 선택 토글 |
| `Delete` / `Backspace` | 지우개 동작 |
| `Esc` | 코트 컨테이너로 포커스 복귀 |

**화살표 개체만 예외다**(§4.3 1.11, 2026-08-12). 화살표는 `OBJECT_NUDGE` 가 아니라
`ARROW_SET`(= 히스토리 병합 키가 `ARROW_SET:id`)으로 움직이고, `Shift` 의 뜻이 다르다.

| 키 (화살표 포커스) | 동작 |
|---|---|
| `←↑→↓` | 화살표 **전체**를 2.5 px 이동 (from·ctrl·to 를 함께 — 모양 유지) |
| `Shift + ←↑→↓` | **조준점 하나만** 2.5 px 이동 (기본 조준점 = 끝점 `to`) |
| `[` / `]` | 조준점 전환 — 끝점 → 시작점 → 굽힘점(ctrl). 라이브 리전 안내 + 핸들에 조준 링 |

`Shift = 25 px 큰 걸음`을 화살표에서 포기한 이유: 얹을 수식키가 없다. `Alt` 는 개체 순회·
파괴적 동작, `Ctrl` 은 줌/저장과 §4.4 P2-1 판 팬 예약이라 화살표에 남은 빈 수식키는 `Shift`
하나뿐이고, 화살표에서는 큰 걸음보다 **끝점 조준**이 압도적으로 중요하다(화살표는 '누가
**어디로**'의 본체다). 전체를 크게 옮기는 것은 방향키 연타(같은 coalesce 창 안이면 undo 1회)
또는 드래그로 한다. 다른 개체의 `Shift = 25 px` 계약은 그대로다.

**d. 포인터 없이 배치 — 키보드 커서**
배치 도구(`ball` `cone` `player` `note`)가 활성이고 **포커스가 컨테이너 자신**일 때
(`e.target === containerRef.current`) 십자 커서를 표시한다.
`←↑→↓` = 격자 칸 단위 이동 / `Shift+방향키` = 12.5 px(0.5 m) / `Enter` = 배치.
커서 이동 시 `aria-live` 로 `"c3 칸"`. → **8개 도구 전부가 키보드만으로 조작 가능**하다.

**e. 라이브 리전은 명령형이다 (React state 금지)**
```tsx
export const liveRegion = { el: null as HTMLElement | null, seq: 0,
  say(text: string) { if (!this.el) return;
    this.el.textContent = this.seq++ % 2 ? text : text + '​'; } };  // 중복 문구도 재낭독
export const LiveRegion = () => (
  <div aria-live="polite" aria-atomic="true" className="sr-only" ref={el => { liveRegion.el = el; }}/>
);
```
`{announcement}` state 로 만들면 400 ms 스로틀 갱신마다 앱 전체가 리렌더되어 드래그 중
롱태스크가 끼어들고 → 프레임 드랍 → dt 급증으로 연쇄된다.
`GridOverlay`·`RuleZones`·`ArrowMarkers` 는 `React.memo`, `gridGeom` 은 모듈 레벨 Map 캐시.
스로틀 400 ms. 문구 예: `A팀 3번 · d3 칸 · x 12.5미터 y 5.1미터 · 방향 90도`.
그 외 알림: 스텝 전환, 도구 전환, undo/redo(`되돌렸습니다: 공 추가`), 저장, 공 개수 제한,
세션 항목 순서 변경, 드래그 시작 시 잡은 존.

**f. 전역 단축키 (편집기)**

> ⚠️ **2026-08-16 전면 개편**(기현 지시). 아래 표는 결과이고, **정본은 코드의
> `src/core/keymap.ts`** 다 — 도움말 모달·시연 오버레이·디스패처가 전부 그 표에서 나오고
> `keymap.contract.test.ts` 가 무모순을 지킨다. 문서와 코드가 갈리면 코드가 맞다.

키를 고른 원칙: ① `W A S D`(이동)·`Q E`(회전)를 **개체 조작에 고정**하고 도구는 그 여섯을
못 쓴다 ② 나머지 도구는 **영어 머릿글자**, 막히면 다음 글자 ③ 보기 토글은 전부 `Alt+글자`.

| 층 | 키 | 동작 |
|---|---|---|
| 도구 | `V L O T R B C P N` | 선택 · 선 · 원 · 삼각 · 사각 · 공 · 콘 · 선수 · 메모 |
| 편집 | `Ctrl/⌘+Z` / `+Shift+Z` / `Ctrl+Y` | undo / redo |
| 편집 | `Ctrl/⌘+S` | 저장(자동저장 플러시), `preventDefault` |
| 편집 | `Ctrl/⌘+D` | 현재 스텝 복제 |
| 시간축 | `PageUp` / `PageDown` | 이전/다음 스텝 — **선택 상태와 무관** |
| 시간축 | `Space` | 재생/일시정지 (시연 화면도 같다) |
| 보기 | `Alt+G` / `Alt+Z` | 격자 / 골 지역 가이드 토글 |
| 보기 | `Ctrl/⌘ +` `-` `0` | 스테이지 줌 인/아웃/리셋 |
| 보기 | `Ctrl/⌘+방향키` | 판 이동(팬) |
| 전역 | `Esc` | 선택 해제 |
| 전역 | `Ctrl/⌘+Delete` | 선택한 개체 삭제 |
| 전역 | `Shift+?` | 도움말 오버레이 (`role="dialog"`, 포커스 트랩, `Esc`) |
| 개체 | `W A S D` · 방향키 | 이동 — 기본 25px, **`Shift` 가 정밀**(2.5px) |
| 개체 | `Q E` | 회전 — 기본 15°, `Shift` 5° |
| 개체 | `[` / `]` | 이전/다음 개체로 순회 |
| 개체 | `Enter` | 선택 / 해제 |
| 개체 | `Delete` | 그 개체 삭제 |

**숫자 키(1–8)는 폐지했다.** 도형 3종에만 숫자가 없는 반쪽짜리 상태였고, 문자 하나로
통일하면 도움말에 적을 것도 하나가 된다.

**⚠️ `KeyboardEvent.code` 로 판정한다(`key` 아님).** `key` 는 입력기가 해석한 문자라 **한글
입력 상태에서 `V` 가 `'ㅍ'` 로 들어와 문자 단축키가 통째로 죽는다**(2026-08-16 발견 — 그때까지
전 코드에 `e.code` 사용처가 0이었다). 대가는 비QWERTY 배열에서 인쇄된 글자와 어긋나는 것이고,
그래서 도움말의 글자는 QWERTY 기준이다. 예외는 구두점 하나(`?`)뿐 — 자리가 배열마다 달라
문자로도 잡는다(한글 모드에서도 구두점은 그대로 들어오므로 안전하다).

**WCAG 2.1.4 (Character Key Shortcuts, Level A) 준수 필수.**
음성 인식 사용자가 발화하면 단일 문자키가 연쇄 발화한다. **두 층으로 나눠 푼다**:

* **개체 층**(`W A S D` · `Q E` · `[ ]` · `Delete`) — 개체에 포커스가 있을 때만 살아 2.1.4 의
  *"Active only on focus"* 예외에 해당한다. 설정과 무관하게 동작한다. 이 예외는 **전역이
  아니라는 사실**에서만 나오므로, 이 키를 전역으로 올리면 준수가 함께 무너진다.
* **전역 도구 문자키**(`V L O T R B C P N`) — 예외가 없다. 설정 → 접근성의
  `단축키: 단일 키 / 수식키 필요(Alt+문자) / 끔` 3택(`a11y.singleKeyShortcuts`)이 여기에 걸린다.

`Alt+글자` 토글은 이미 수식키 조합이라 2.1.4 대상이 아니다(개편 전 `G`·`Z` 단독은 대상이었다).

**가드 함수 2종** — `Space`/`Enter` 는 브라우저가 활성화 키로 쓰므로 별도 가드가 필요하다:
```ts
export const isEditableTarget = (t: EventTarget | null): boolean =>
  t instanceof HTMLElement &&
  (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
export const isInteractiveTarget = (t: EventTarget | null): boolean =>
  t instanceof HTMLElement && t.closest(
    'button, a[href], select, textarea, input, summary, [role="button"], [role="radio"], [role="tab"], [contenteditable="true"]'
  ) !== null;
```
방향키·문자키는 `isEditableTarget` 만, **`Space`/`Enter` 는 `isInteractiveTarget` 도** 검사한다.
안 그러면 트랜스포트 '재생' 버튼에 포커스한 채 Space 를 누르면 네이티브 클릭 + 전역 핸들러가
이중 발화해 **아무 일도 일어나지 않고**, 시연에서는 스텝이 2칸 건너뛴다.
우선순위: **개체 포커스 > 인터랙티브 요소 포커스(네이티브 위임) > 전역**.

### 7.6 포커스 관리 (SPA 필수)

| 시점 | 동작 |
|---|---|
| 화면 전환 (`go`·`back`·`popstate` 전부) | `<main id="main" tabIndex={-1}>.focus({preventScroll:true})` + 라이브 리전에 `"{화면명} 화면"` |
| CourtPicker 선택 후 | 도구 레일 첫 버튼으로 이동 |
| 세션 드로어 열기 | 제목 `<h2 tabIndex={-1}>` 에 포커스 |
| 세션 드로어 닫기 (`Esc`·[×]) | `triggerRef.current?.focus()` |
| 토스트 | 포커스 이동 없음 (`role="status"`) |

### 7.7 ARIA 마크업 계약

| 컨트롤 | 계약 |
|---|---|
| 세그먼티드(코트 스위치·테마·속도·포메이션), 카테고리 알약 | 컨테이너 `role="radiogroup"` + `aria-label`, 항목 `role="radio" aria-checked`, 좌우 방향키 순회 + 로빙 tabindex. 활성 표시는 배경색 **외에** `font-weight:700` 차이도 준다 |
| 라이브러리 탭 | `role="tablist"` / `role="tab" aria-selected aria-controls` |
| 팀 색 스와치 | `role="radio" aria-checked` + `aria-label="팀 색상: 빨강"`, 선택 표시는 링 + **안쪽 체크 마크**(`inkFor()` 잉크) |
| 검색 | `<input type="search" id="drill-search">` + `<label class="sr-only">` + `min-height:44px`, placeholder 는 `--muted` |
| 아이콘 전용 버튼 | `aria-label` **필수**. `title` 은 마우스 힌트로만 병기(터치·스크린리더에서 불안정) |
| 코트 개체 `<g>` | `role="button" aria-label="A팀 3번 선수, d3 칸, 방향 90도" aria-pressed={selected}` |
| 격자 `<g>` | `aria-hidden="true" pointer-events="none"` |

### 7.8 나머지

- **모션**: `prefers-reduced-motion: reduce` 전역 규칙은 `tokens.css` 에 이미 있다 ✓
  추가로 JS 트윈 `ms → 0`, 카드 hover translate 제거, 인터스티셜 크로스페이드 제거.
  설정 `a11y.reduceMotion: 시스템 따름 / 항상 켬`.
- **색 비의존**: 팀 = 색 + **등번호**(§7.1) + 명단 텍스트. 콘 = 색 + **실루엣**(§6.6).
  화살표 = 색 + 파선/실선 + 굵기. 설정에 **상대 팀 색상 행을 신설**하고, 양쪽 스와치 목록에서
  상대가 이미 쓰는 색은 `aria-disabled` 처리한다.
- **터치 외 입력**: 모든 인터랙션이 Pointer Events 단일 경로 → 트랙볼·헤드 마우스·스위치
  인터페이스가 기본 지원된다(단, §7.5-b 의 tab stop 축소가 전제).

---

## 8. 파일 소유권 표

**한 파일은 정확히 한 모듈이 쓴다.** 다른 모듈의 파일을 수정해야 하면 작업을 멈추고 보고한다.

| 모듈 키 | 파일 | export (요약) | 의존 |
|---|---|---|---|
| **`core`** | `src/core/units.ts` `src/core/angle.ts` `src/core/ids.ts` `src/core/colors.ts` `src/core/constants.ts` `src/core/geom.ts` `src/core/index.ts` | §2 전량: `PX_PER_M` `mToPx` `kmhToPxPerS` `pxPerSToMatterV` `Vec2` / `wrapPi` `lerpAngle` `arcTangentK` `radToStoredDeg` / `newId` `isId` `Id<P>` 전 ID 타입 / `COURT_BG` `inkFor` `TEAM_COLOR_CHOICES` `CATEGORY_COLORS` / `CHAIR` `BALL` `CONE` `WALL` `PHYS` `DEFAULT_LIMITS` `DEFAULT_ZONES` `INTERACT` `PLAYBACK` `SPIN_RADIUS_MIN_PX` `CHAIR_SEP_PX` / `clamp` `clampMag` `dist2` `easeStandard` `cubicBezier` | — |
| **`court`** | `src/model/court.ts` `src/model/grid.ts` | `CourtMode` `COURT_DEFS` `CourtDef` `gridGeom` `gridLabel` `gridCellCenter` `cellLabelAt` `clampToViewBox` | core |
| **`physics-kin`** | `src/physics/types.ts` `src/physics/kinematics.ts` `src/physics/obb.ts` | `GrabLatch` `KinInput` `ZoneState` `DragLimits` / `grabFrom` `grabFromLever` `grabPoint` `stepZone` `stepTranslate` `stepSpin` `stepTow` `lerpPose` / `satOverlap` `chairsOverlap` `outOfBounds` `blockedAt` `resolveMotion` `escapePinned` `clampPointToBounds` | core, (타입만) court |
| **`ui-kit`** | `src/styles/a11y.css` `src/styles/tokens.css`(추가분만) `src/ui/icons.tsx` `src/ui/Button.tsx` `src/ui/Pill.tsx` `src/ui/Badge.tsx` `src/ui/Card.tsx` `src/ui/Segmented.tsx` `src/ui/Toggle.tsx` `src/ui/Toast.tsx` `src/ui/ToastHost.tsx` `src/ui/Modal.tsx` `src/ui/Drawer.tsx` `src/ui/LiveRegion.tsx` `src/ui/VisuallyHidden.tsx` `src/ui/SkipLink.tsx` `src/ui/useThrottledAnnounce.ts` `src/ui/keyboard.ts` | 프리미티브 + `liveRegion` `isEditableTarget` `isInteractiveTarget` | core |
| **`model`** | `src/model/chair.ts` `src/model/drill.ts` `src/model/edits.ts` `src/model/arrow.ts` `src/model/defaults.ts` `src/model/playback.ts` `src/model/session.ts` `src/model/refs.ts` `src/model/summary.ts` `src/model/thumb.ts` `src/model/validate.ts` `src/model/migrate.ts` `src/model/index.ts` | §3 전량 | core, court |
| **`physics-world`** | `src/physics/bodies.ts` `src/physics/world.ts` `src/physics/loop.ts` `src/physics/drag.ts` `src/physics/hitTest.ts` `src/physics/index.ts` | `createWorld` `WorldHandles` `createChairBody` `createLoop` `beginDrag` `stepDrag` `hitTest` `zoneHandles` `PhysicsWorldApi` | core, physics-kin, model, matter-js |
| **`storage`** | `src/storage/db.ts` `src/storage/errors.ts` `src/storage/drillRepo.ts` `src/storage/sessionRepo.ts` `src/storage/prefs.ts` `src/storage/transfer.ts` `src/storage/files.ts` `src/storage/index.ts` | §4 전량 | core, model, idb |
| **`render-court`** | `src/render/CourtSurface.tsx` `src/render/courtLines/FullCourtLines.tsx` `.../HalfCourtLines.tsx` `.../FlatCourtLines.tsx` `src/render/GridOverlay.tsx` `src/render/RuleZones.tsx` `src/render/ArrowMarkers.tsx` `src/render/CourtThumbnail.tsx` `src/render/CourtPreview.tsx` | `CourtSurface` `GridOverlay` `RuleZones` `ArrowMarkers` `CourtThumbnail` `CourtPreview` | core, court, model(thumb 타입), ui-kit |
| **`render-stage`** | `src/render/CourtStage.tsx` `src/render/ObjectLayer.tsx` `src/render/objects/ChairChip.tsx` `.../BallDot.tsx` `.../ConeMark.tsx` `.../NoteLabel.tsx` `.../ArrowPath.tsx` `src/render/SelectionOverlay.tsx` `src/render/ZoneHandles.tsx` `src/render/ArrowHandles.tsx` `src/render/KeyboardCursor.tsx` `src/render/useStageMetrics.ts` `src/render/transformWriter.ts` `src/render/rafLoop.ts` `src/render/hitRadius.ts` | `CourtStage` `ObjectLayer` `createTransformWriter` `raf` `computeMetrics` `clientToWorld` `zoomAt` `hitRadius` | core, court, model, physics(타입만), render-court, ui-kit |
| **`store`** | `src/store/settings/*` `src/store/library/*` `src/store/editor/*` `src/store/playback/*` `src/store/toast/*` | `SettingsProvider` `useSettings` / `LibraryProvider` / `EditorProvider` `useEditorState` `useEditorDispatch` `editorRootReducer` `withHistory` `selectStepIndex` `EditorAction` / `PlaybackProvider` / `ToastProvider` `useToast` | core, model, storage, physics-world, render-stage |
| **`app-shell`** | `src/app/App.tsx` `src/app/AppShell.tsx` `src/app/AppRail.tsx` `src/app/AppHeader.tsx` `src/app/useAppHistory.ts` `src/app/screens.ts` `src/app/useAutosave.ts` | `App` `AppShell` `useAppHistory` `Screen` `SCREEN_TITLES` | 전부 |
| **`screen-home-library`** | `src/features/home/*` `src/features/library/*` | `HomeScreen` `LibraryScreen` `SessionDrawer` … | store, render-court, ui-kit, model, storage |
| **`screen-editor`** | `src/features/editor/*` | `EditorScreen` `CourtPicker` `ToolRail` `TransportBar` `InspectorPanel` `useEditorPointer` `useEditorKeyboard` … | 전부 |
| **`screen-present`** | `src/features/present/*` | `PresentScreen` `useFullscreen` `useWakeLock` `useSwipe` … | 전부 |
| **`screen-settings`** | `src/features/settings/*` | `SettingsScreen` … | store, ui-kit, storage |
| **`test-fixtures`** | `src/test/setup.ts` `src/test/fixtures/*.json` `src/test/helpers/*.ts` | 픽스처 + `fake-indexeddb` 셋업 | — |

**공유 편집이 필요한 파일과 그 소유자**

| 파일 | 소유자 | 비고 |
|---|---|---|
| `src/styles/tokens.css` | `ui-kit` | 기존 12토큰은 건드리지 않고 §2.8 블록만 추가 |
| `src/main.tsx` | `app-shell` | import 추가만 |
| `index.html` | `app-shell` | §4.6 부트 스크립트 삽입 |
| `package.json` | `test-fixtures` | `pnpm add -D fake-indexeddb` 만. 다른 모듈은 의존성 추가 금지 |
| `vite.config.ts` | `test-fixtures` | `setupFiles` 유지 |

**설치 필요**: `pnpm add -D fake-indexeddb` (미설치). `src/test/setup.ts` 에
`import 'fake-indexeddb/auto'` 추가.

> **※ §8 정정 각주 (2026-08-13, 6.3).** 표의 **원칙**("한 파일은 정확히 한 모듈이 쓴다. 다른
> 모듈의 파일을 수정해야 하면 작업을 멈추고 보고한다")은 재편 내내 그대로 지켰다 — 실제로
> 6.5 는 6.4 와 겹친 두 파일을 **헝크 단위로만** 커밋했고, 6.1 은 자기 것이 아닌 수정을
> 스테이징하지 않았다. 바뀐 것은 **표의 내용**이다.
>
> **⚠️ 파일 경계는 "고치지 말라" 는 뜻이지 "못 본 척하라" 는 뜻이 아니다.** 4차에서 둘,
> 5차에서 또 둘이 *"내 소유 파일이 아니라 안 고쳤다"* 고만 적어 결함이 그대로 넘어갈 뻔했다
> (앱이 자기 백업 파일을 거절 / 물리 존 슬라이더가 판정에 안 감). 경계 밖 발견은
> **파일:행 + 무엇이 왜 잘못됐는지 + 재현 방법**을 보고에 적는다.
>
> **화면 모듈 3종이 개명·분화했다** (2.1 · 4차 · 6.4):
>
> | 옛 모듈 키 | 지금 |
> |---|---|
> | `screen-home-library` | `src/features/home/`(`nav.ts` 만 남았다) · `src/features/library/` · **`src/features/board/`**(신설 — 자유 전술판) |
> | `screen-editor` | `src/features/editor/` — `CourtPicker` **은퇴**, `EditorWorkspace`·`BoardBar`·`InspectorPanel`·`ToolRail`·`placement.ts`·`snapOnSettle.ts` 등으로 분화 |
> | (없었음) | **`src/features/export/`**(4.4 — 자립 SVG · PNG 래스터) · **`src/features/print/`**(4.5 — 인쇄 전용 React 트리) |
>
> **모듈 안에서 늘어난 파일 중 표에 없던 것들** (전수는 아니다):
> `core/colors.ts` 에 `OBJ_STROKE_DARK`·`strokeFor` · `model/court.ts` 에 `CourtSize`·
> `FULL_COURT_DEFS`·`courtDefFor` · `model/setPiece.ts`·`fillPreset.ts` ·
> `physics/twoZone.ts` · `storage/board.ts`(자유 전술판 스냅샷) ·
> `render/teamMark.ts`·`stageRot.tsx`·`courtLines/` · `app/navChrome.ts`·`chromeBudget.ts`·
> `announce.ts`·`screens.ts` · `styles/contrast.css`·`print.css`·`contrastMath.ts`·`cssContract.ts`
> (뒤 둘은 **테스트 전용 순수 모듈**이다 — 프로덕션 번들이 import 하지 않는다).
>
> **`src/test/` 는 이제 픽스처만 두는 자리가 아니다.** 여러 모듈을 **가로지르는 게이트**가 산다:
> `boardTargetBudget.test.tsx`(§3 표적 예산 ≤ 40) · `courtSizeConsumers.test.tsx`(새 `COURT_DEFS`
> 소비처가 생기면 먼저 빨개진다) · `courtSizeScreens.test.tsx`(코트를 그리는 화면 5개를
> **배열로 열거**한다 — 새 진입점이 생기면 행을 더해야 게이트가 그 화면을 본다) ·
> `docsMatchCode.test.ts`(6.3 — 문서·주석의 숫자를 코드 상수와 대조). 이것들은 어느 한 모듈의
> 소유가 아니라 **재편의 불변식**이다.

---

## 9. 구현 순서 · 의존관계

이 문서가 모든 시그니처를 확정했으므로 각 웨이브의 에이전트는 **서로의 구현을 보지 않고**
계약만 보고 작업한다. 웨이브 경계는 "그 파일이 디스크에 존재해야 컴파일된다" 는 조건이다.

```
Wave 1 (병렬 5) ─ core · court · physics-kin · ui-kit · test-fixtures
        └─ 게이트: pnpm typecheck 통과 + §10.1/§10.2/§10.9 골든 테스트 통과

Wave 2 (병렬 4) ─ model · physics-world · render-court · storage
        └─ 게이트: §10.3/§10.4/§10.5/§10.6 통과

Wave 3 (병렬 2) ─ render-stage · store
        └─ 게이트: §10.7 통과 (목 PhysicsWorld 로 드래그 커밋 검증)

Wave 4 (병렬 5) ─ app-shell · screen-home-library · screen-editor · screen-present · screen-settings
        └─ 게이트: §10.8 전량 + 접근성 감사(§10.10)
```

**의존 그래프 (순환 없음)**
```
core ──┬─ court ──┬─ model ──┬─ storage ──┐
       │          │          │            │
       ├─ physics-kin ── physics-world ───┤
       │                                  ├─ store ── app-shell ── screens
       ├─ ui-kit ─── render-court ────────┤
       │                render-stage ─────┘
       └─ test-fixtures
```

**웨이브 내 병렬 안전성**: 각 모듈이 §8 표의 파일만 쓰므로 충돌이 없다.
`src/styles/tokens.css`, `src/main.tsx`, `index.html`, `package.json` 은 표에 적힌 단독 소유자만
건드린다.

**Wave 1 에서 다른 모듈이 참조할 스텁**: 없다. Wave 1 산출물은 전부 완성품이어야 한다
(`core` 는 상수·순수 함수, `physics-kin` 은 순수 함수, `ui-kit` 은 프리미티브).

**Wave 2 의 `model` 이 `physics-kin` 의 `resolveMotion` 을 쓰지 않는다** — `defaults.ts` 의
겹침 검증만 `chairsOverlap` 을 쓴다(타입·함수 모두 Wave 1 산출물).

**웨이브 사이 게이트 명령**
```
pnpm typecheck && pnpm lint && pnpm test
```

---

## 10. 검증 기준

"됐다" 의 정의: **아래 전부가 `pnpm test` 에서 초록**이고, §10.10 수동 체크리스트를 통과한다.
물리 운동학은 눈으로 보기 전에 단위 테스트로 확정한다.

### 10.1 `core` — `src/core/*.test.ts`

- [ ] `wrapPi(Math.PI) === -Math.PI` · `wrapPi(-Math.PI) === -Math.PI` · `wrapPi(3.0) ≈ 3.0` ·
      `wrapPi(-3.5) ≈ 2.783185307` (치역이 `[-π, π)` 임을 계약으로 못박는다)
- [ ] `lerpAngle(a, b, 0) === a`, `lerpAngle(a, b, 1)` 의 wrap 이 `wrapPi(b)` 와 1e-12 이내
- [ ] `arcTangentK`: 0°→1 · 30°→1.017332 · 60°→1.071797 · **90°→1.171573** · 120°→1.333333 ·
      180°→2 (각 1e-6)
- [ ] Hermite 원호 근사: R=100, 90° 전환에서 201점 샘플 최대 반경오차 **< 0.05 px**
      (K=0.55 이면 15.54 px 이므로 이 테스트가 회귀를 잡는다)
- [ ] `radToStoredDeg(theta)` 왕복: 임의 20각도에서 `|wrapPi(storedDegToRad(radToStoredDeg(t))) − wrapPi(t)| < 0.001 rad`
- [ ] `pxPerSToMatterV(420) === 7`, `matterVToPxPerS(5) === 300`
- [ ] `inkFor`: 팔레트 8색 전부에 대해 반환 잉크의 대비가 **≥ 4.5:1**
- [ ] `easeStandard(0)===0`, `(1)===1`, 단조증가, `(0.5) ≈ 0.7756` ±0.02, **1000회 샘플 비트 동일**
      ※ 2026-08-08 정정. 원래 `≈0.5` 로 적혀 있었으나 이는 대칭 이징을 전제한 값이다.
      `cubic-bezier(.4,0,.2,1)` 은 P1+P2 = (0.6, 1.0) 로 (0.5,0.5) 점대칭 조건 P1+P2=(1,1) 을
      만족하지 않으므로 y(0.5)=0.5 가 **수학적으로 불가능**하다. 실제 해는 t=0.693344, y=0.775561.
      곡선 파라미터(§3.6 에서 두 번 명시)가 옳고 기대값이 틀린 것이므로 기대값을 정정한다.

### 10.2 `physics-kin` 순수 운동학 — `src/physics/kinematics.test.ts` (matter 불필요)

**골든값은 §10.9 의 참조 구현으로 실제 생성한 것이다.** 스펙과 다른 값이 나오면 구현이 틀렸다.

- [ ] **G1 스냅 없음 (blocker 회귀)** — 8조합 `(zone, s, lat)` = `(translate,0.25,12.5)`
      `(translate,0.20,−12.5)` `(spin,0.32,12.5)` `(spin,0.55,12.5)` `(spin,0.85,−12.5)`
      `(towFront,0.90,12.5)` `(towRear,0.06,12.5)` `(towRear,−0.20,−12.5)` 전부에서
      **첫 substep `|ΔP| < 1e-9` 이고 `|Δθ| < 1e-9`**
- [ ] `classifyZone`: s = −0.3 / 0.05 / 0.12 / 0.13 / 0.20 / 0.31 / 0.32 / 0.84 / 0.85 / 1.2
- [ ] `pointAtLever(pose, −7.5)` = 뒤끝, `(pose, 30)` = 앞범퍼 (임의 θ 5개)
- [ ] translate: θ 불변, `|P'−P| ≤ vLin·dt + 1e-9`, 상한 미만이면 `G' === T` (1e-9)
- [ ] spin: `P' === P` (부동소수 완전 일치), `|Δθ| ≤ ω·dt + 1e-12`
- [ ] **G2 직선 후진** — towRear s=0.06 lat=0, `T(t) = G0 + (−40·min(1,t/0.6), 0)`, dt=1/120,
      **84 스텝(0.7 s)** → `P = (−40.0000, −0.0000)`, `θ = 0.000000°` (±1e-4)
- [ ] **G3 전방 견인 부호** — s=0.90 lat=0, `T(t) = G0 + (0, 30·min(1,t/0.5))`, **60 스텝** →
      `θ = +54.4538°`, `P = (10.9893, 8.6418)` (±0.01)
- [ ] **G4 후방 견인 부호** — s=0.06 lat=0, 같은 램프, 60 스텝 →
      `θ = −89.3035°`, `P = (−5.1862, 24.7504)` (±0.01)
      ※ **포인터 궤적을 반드시 이 램프로 고정한다.** 스텝 입력(즉시 점프)이면 값이 크게 달라진다.
- [ ] **G5 로프 반전 안정성 (blocker 회귀)** — towRear s=0.06 으로 40 px 뒤로 끈 뒤(θ=0)
      `T = G0 + (0, ±ε)` 로 84 스텝 되밀기. **ε = ±1, ±0.2 네 경우 모두 `|θ| < 0.01°`**
      (가드가 없으면 ∓167° / ∓153°)
- [ ] **G6 spin 피벗 통과 안정성 (major 회귀)** — s=0.55 lat=0, 포인터를 축 위 +11.25 → −11.25 로
      18 스텝에 통과 후 60 스텝 유지, 측방 섭동 ε.
      `ε=±0.4 → θ = ±17.0188°`, `ε=±2 → θ = ±43.4855°` (±0.05). **부호가 ε 부호와 일치**
      (절대 추종이면 ±178°)
      ※ ε=±2 값은 2026-08-08 정정. 원래 적혀 있던 42.9838° 는 서로 독립인 세 구현
      (physics-kin 본 구현 / test-fixtures 참조 구현 / 헤라 직접 재현)이 모두 43.4855° 를 내고,
      스윕 스텝수 10~40·시작샘플 포함여부·홀드 59~61·클램프순서·각도균등 스윕까지 전수 시도해도
      재현되지 않았다. ε=±0.4 는 세 구현 모두 17.0193° 로 골든값과 0.0005° 이내 일치하므로
      §5.5(B) 수식 자체는 옳다 — 원 생성 스크립트의 궤적 이산화가 산문으로 복원되지 않는 문제다.
      이 테스트의 목적(부호가 ε 부호와 일치)은 43.4855° 에서도 그대로 성립한다.
- [ ] **G7 spin 추종** — 반경 30 px 에서 포인터를 2.0 rad/s 로 1.0 s 회전 → 차체 **113.637°**
      (포인터 114.59°). 12.0 rad/s 로 0.5 s → **195.628°** (ω 상한 198.944° 미만) (±0.1)
- [ ] **G8 속도 상한** — 포인터를 (+500,+500) 로 순간이동, 120 스텝.
      translate/towFront/towRear 전부 최대 피벗 속력 **69.444444 px/s** (±1e-5)
- [ ] **로프 길이 불변식** — 모든 tow 스텝 후 `| |G'−P'| − rho | < 1e-9`
      (실측 최대 오차 8.9e−16). G8 에서도 1.1e−14
- [ ] 특이점: `T === P` (spin), `Gt === P` (tow), `rho === 0` (translate 핸들) 에서 NaN/Infinity 없음
- [ ] `grabFromLever(-37.5)` → `{rho: 37.5, beta: π}`, `grabFromLever(60)` → `{rho: 60, beta: 0}`

### 10.3 `physics-world` matter 통합 — `src/physics/world.test.ts`

- [ ] `createChairBody({x:400,y:250,theta:-1.4})` 후 `body.position` = (400, 250) (1e-6),
      centroid 거리 = 11.25 (1e-6), 최원거리 정점 = **32.5** (1e-4)
- [ ] `Body.setAngle` 을 7각도 반복해도 피벗 좌표 불변 (1e-9)
- [ ] **`Number.isFinite(chair.inverseInertia) === true` 이고 `chair.inverseMass === 0`**
      (setMass NaN blocker 회귀)
- [ ] 휠체어·벽의 `restitution`/`friction` 이 `CHAIR`/`WALL` 표의 값과 일치
      (`applyStaticSurface` 회귀 — 안 하면 0 / 1)
- [ ] static 휠체어를 10 km/h 로 주행 → 공 정상상태 속도 **2.7778 m/s** ±2 %
- [ ] 8 m/s 공을 대기 휠체어에 충돌 → 휠체어 이동 **정확히 0**, 각도 변화 **정확히 0**
- [ ] **반발계수 계약 (양쪽 다)** — 저속 훅 포함 시 접근 1·2·3·4·5·8·12 m/s 전부 `e_eff ≥ 0.40`.
      훅을 끄면 4.8 m/s 에서 `e_eff < 0.02`, 5.0 m/s 에서 `0.45 ± 0.01` (구조적 성질 문서화)
- [ ] 스핀킥: ω_max 회전, 공 r = 1.2 m → **10.06 m/s**, r = 1.3 m → **11.52 m/s** (±10 %)
- [ ] `BALL.maxSpeedMatter` 클램프가 실제로 발동: `setVelocity(ball, {x: 20})` 후 1 substep →
      `getSpeed ≤ 7.0` 이고 substep 변위 ≤ 3.5 px
- [ ] **정착 조기 종료** — 8 m/s 킥 후 `allAtRest()` 가 **2.6 ± 0.3 초**에 참이 된다
      (`settleMaxMs` 하드컷이 아니라 조기 종료로 끝난다). 구름 감속을 빼면 6.5 초 → 실패해야 함
- [ ] 감쇠 시정수: 공 fA 0.012 → **1.3847 s** ±2 %, 콘 fA 0.065 → **0.2522 s** ±2 %
- [ ] **freeze 회귀** — 드래그 정지 후 1 초: freeze 시 공 이동 < 0.5 px, 미실행 시 > 20 px
- [ ] **`enableSleeping: true` 관통 회귀** — 문서화용으로 남긴다(잠든 공 위를 static 휠체어가
      지나가도 공이 움직이지 않음을 assert)
- [ ] `allAtRest()` 가 static body 를 항상 rest 로 간주 (static `deltaTime` 16.667 회귀)
- [ ] 공·콘 드래그: 포인터를 substep 당 50 px 로 순간이동시켜도 body 변위 ≤ 3.0 px,
      경계 밖으로 끌면 `clampPointToBounds` 안에 머물고, 근처 콘의 속도 < 1.0 m/s
- [ ] **터널링 마진 자동 검증** —
      `PHYS.dtS*(lim.vLin + lim.omega*CHAIR.hullRadiusPx) < BALL.radiusPx + CHAIR.widthPx/2` 이고
      `BALL.maxSpeedPxPerS*PHYS.dtS + CONE.maxSpeedPxPerS*PHYS.dtS < BALL.radiusPx + CONE.inradiusPx`
      (설정 상한을 올리면 이 테스트가 먼저 깨진다)

### 10.4 `physics-kin` 충돌 — `src/physics/obb.test.ts`

- [ ] `resolveMotion`: 접촉 직전 정지, 최종 겹침 없음
- [ ] **접선 슬라이드 (major 회귀)** — 이웃 휠체어(y 간격 25.4 px)에 붙여 (+400,+30) 방향으로
      5초 드래그 시 **x 진행률 ≥ 90 %** (이분탐색만이면 2.3 %)
- [ ] 시작 포즈가 이미 겹치면: 깊이가 줄어드는 이동은 허용, **깊어지는 이동은 거부**
- [ ] spin 궤적(P 고정)에 대해 `resolveMotion` 후에도 `P' === P` (부동소수 완전 일치)
- [ ] 경계: 임의 θ 20개에서 hull 4정점이 모두 viewBox 안
- [ ] `escapePinned`: 두 휠체어를 `CHAIR_SEP_PX` 간격까지 붙인 뒤 사이의 공이 어느 OBB 와도
      겹치지 않는다
- [ ] `clampPointToBounds` 가 반지름을 고려한다 (공 중심이 벽면에 정확히 닿지 않는다)

### 10.5 `model` — `src/model/*.test.ts`

- [ ] `gridGeom` 좌표가 §3.3 표와 정확히 일치 (full/half/flat 3종, 셀 중심·라벨 포함)
- [ ] `cellLabelAt` 왕복: `gridCellCenter(mode, c, r)` → `cellLabelAt` = `gridLabel(c, r)`
- [ ] `projectGrab` 4존 경계값을 θ = 0·90·180·270° 에서 검증
- [ ] `newId`: **시계 고정(`vi.setSystemTime`)에서 1296개 무충돌** / **실시간 10만 개 무충돌**
      (두 테스트를 분리한다. 시계를 고정한 채 10만 개를 뽑으면 평균 2.1건 충돌해 플레이키가 된다)
- [ ] `isId`: 10자·19자 id 를 모두 통과시키고, 접두 불일치·비문자열만 거부
- [ ] 편집 연산: `addBall` 이 `stepIndex` 이후에만 pose 삽입 · `deleteStep` 이 마지막 1개를 안 지움 ·
      모든 연산이 **원본 불변** · 변화 없으면 **동일 참조 반환**
- [ ] `placeChair`/`addChair`/`updateChairDef` 존재 및 팀당 4 상한
- [ ] `setPose` 오버로드: `setPose(d, 0, chairId, {x,y})` 가 **타입 에러**여야 한다
      (`// @ts-expect-error` 로 검증)
- [ ] `omitKey`: 결과에 키가 없다 (`'ch_x' in result === false`)
- [ ] **직렬화 동치** — 임의 드릴에 대해 `structuredClone(d)` 와 `JSON.parse(JSON.stringify(d))` 가
      **deep-equal**. 이 테스트가 `undefined` 키를 영구히 막는다
- [ ] presence 4종 + `interpolateSteps` 결과 배열이 **id 로 유일**
      (`new Set(frame.arrows.map(a=>a.id)).size === frame.arrows.length`)
- [ ] `interpChair(a,b,0) === a`, `(…,1)` 의 각도 wrap 이 `wrapPi(b.theta)` 와 1e-12
- [ ] `|P1−P0| = 0` 이면 위치가 t 전 구간에서 P0 고정
- [ ] 루프 켠 상태에서 총 길이 직후 시각의 프레임이 **마지막↔첫 스텝 사이 보간값**
- [ ] 동일 입력 1000회 샘플링 결과가 비트 단위 동일 (결정성)
- [ ] **`validateDrill` 멱등성**: `validateDrill(validateDrill(x).value).repairs.length === 0`
- [ ] 보정: cast 없는 pose 제거 · 공 11→10 + 고아 pose 동시 제거 · viewBox 클램프 ·
      `formation:'4-4-2'` 인 `steps:[]` 파일이 **throw 없이** 통과 · 알 수 없는 `ArrowKind` → `'move'`
- [ ] **기본 배치 불변식**: 3 포메이션 × full/half/flat 전부에서 어떤 두 휠체어 OBB 도 겹치지
      않고(최소 간격 ≥ 4 px), 공 표면과 어떤 가드 사이 ≥ 2 px, 모든 hull 이 viewBox 안
- [ ] 하프 기본 배치에서 홈 GK 는 cast 에 있고 pose 에는 없다
- [ ] `cloneToCourt(full → half)` 가 좌표를 옮기지 않고 배치를 리셋하며 heading 이 90/270 이다
- [ ] `migrate` 체인 연속성 · `schemaVersion: 999` → `too-new` · `schemaVersion: 1.5` → `no-path` ·
      `src/test/fixtures/drill.v1.json` 픽스처가 migrate→validate 통과
- [ ] `migrateDoc` 이 호출자 객체를 **변형하지 않는다** (중첩 배열 push 후 원본 확인)
- [ ] `refreshRefs`/`resolveRefs` 가 제네릭이고 `durationOverrideMin`/`restAfterMin`/`note` 를
      **보존**한다
- [ ] `defaultCtrl(from,to,bow=30)` 의 t=0.5 편차가 **30 ± 0.01**
- [ ] `arrowPath` 출력이 `M… Q… …` 형식이고 좌표가 0.01 로 반올림됨

### 10.6 `storage` — `src/storage/*.test.ts` (`fake-indexeddb` 필요)

- [ ] `StorageError` 가 **파라미터 프로퍼티를 쓰지 않는다** — `tsc -b` 가 통과하는 것으로 검증
      (`erasableSyntaxOnly` 위반 시 `TS1294`)
- [ ] `putDrill` 후 `drills` 와 `drillSummaries` 가 **한 트랜잭션에서 함께** 갱신
- [ ] `deleteDrill` 이 세션을 건드리지 않는다
- [ ] `putDrill(d, {expectedUpdatedAt: 낡은값})` → `E_CONFLICT` 이고 **아무것도 쓰이지 않는다**
- [ ] `tx.done` 을 await 한다 — 쿼터 초과를 모킹해 `E_QUOTA` 가 던져지는지
- [ ] `loadDrill` 4상태: `ok` / `missing` / `corrupt`(요약이 남고 `corrupt:true`) / `too-new`
- [ ] 기회적 되쓰기: 열려 있는 드릴(`markOpen`) 은 되쓰지 않고, `destructive` repair 는 되쓰지
      않으며, `updatedAt` 이 바뀌었으면 abort 한다
- [ ] 요약 지연 재생성: `build` 가 낮은 레코드만 재생성되고 나머지는 드릴을 로드하지 않는다
- [ ] `normalizeForSearch` + `searchKey` 구분자: "크로스" 와 "공격" 경계를 넘는 "스공" 이
      매치되지 **않는다**
- [ ] 파일명 규칙: 한글·특수문자·40자 초과·이모지(서로게이트 페어)
- [ ] 봉투 라운드트립 · `envelope: 2` → `E_SCHEMA_TOO_NEW` · `spin:'drillSet'` →
      `E_UNSUPPORTED_KIND` 이고 **메시지 본문에 `(drillSet)` 이 들어간다**
- [ ] `sameDrill`: 키 순서가 다른 동일 드릴을 **같다고 판정**하고, 0.05 px 차이도 같다고 판정
- [ ] **배치 내 중복 DrillId** 가 든 library 파일: `countDrills()` 증가분이 보고 건수와 일치
- [ ] **세션 가져오기 리맵**: 드릴 충돌에 'copy' 를 고르면 세션 항목이 **새 id** 를 가리키고
      `findReferrers` 가 그 세션을 찾아낸다
- [ ] 파일에서 온 세션(`drillIds: []`)을 커밋한 뒤 `findReferrers(드릴)` 가 SessionId 를 반환
- [ ] `validatePrefs`: `playbackSpeed: 1.5` → 1 · `theme:'purple'` → 'dark' ·
      `zones` 역전 → 정렬·클램프 · `linearKmh: 0` → 4
- [ ] `resolvePhysics`: 한 항목만 override 한 prefs 에서 `DEFAULT_ZONES` 를 바꾸면 나머지가 따라간다
- [ ] `savePrefs` 가 `setItem` throw 를 삼키고 `false` 를 반환한다
- [ ] `createDrill` 후 `prefs.teams` 를 in-place 수정해도 드릴 색이 불변 (`structuredClone` 회귀)

### 10.7 `render-stage` · `store` — `src/render/*.test.ts`, `src/store/*.test.ts`

- [ ] `computeMetrics` / `clientToWorld` 왕복 (줌·팬 상태 포함, 8케이스)
- [ ] `TransformWriter`: `const {writeFrame} = writer; writeFrame(f)` 가 **크래시하지 않는다**
      (`this` 바인딩 회귀)
- [ ] `register` 가 마지막 프레임을 즉시 기록한다 — `writeFrame` → `register` 순서로 호출해도
      `el.getAttribute('transform')` 이 채워져 있다 (첫 페인트 플래시 / 영구 고착 회귀)
- [ ] 등번호 노드에 `rotate(-θ)` 가 기록된다
- [ ] `write` 가 0.05 px 미만 변화에서 `setAttribute` 를 호출하지 않는다 (스파이)
- [ ] `raf`: 마지막 구독자가 **콜백 안에서** 해지하면 다음 프레임이 예약되지 않는다
- [ ] `hitRadius('ball', 0.8375)` 가 `HIT_R_MAX_PX.ball` 로 클램프된다
- [ ] `hitTest` 우선순위: 공이 가드 앞 8 px 에 있을 때 **차체 내부 탭이 휠체어를 반환**하고,
      선택된 휠체어의 존 핸들이 다른 휠체어 본체 탭을 **가로채지 않는다**
- [ ] `zoneHandles(pose, s).pos` 와 `grabFromLever(lever)` 로 만든 `grabPoint` 가 **동일**
      (핸들 스냅 blocker 회귀)
- [ ] `editorRootReducer`: `TOOL_SET`·`SELECT_*`·`STEP_SELECT` 가 실제로 상태를 바꾼다
      (`withHistory` 가 삼키지 않는다)
- [ ] undo/redo/coalesce/limit: `OBJECT_NUDGE` 30회 연속 → `past` 증가분 **1**,
      `COMMIT_BREAK` 후 30회 → 증가분 **1**
- [ ] `PLACE_BEGIN` + `PLACE_COMMIT` 한 쌍 = undo 1회
- [ ] `epoch` 가 `META_SET`/`STEP_META`/`PLACE_COMMIT`/`OBJECT_NUDGE` 에서 **증가하지 않는다**
- [ ] `STEP_DELETE` 로 현재 스텝을 지우면 `stepId` 가 유효한 스텝으로 재지정된다
- [ ] `selectStepIndex` 가 없는 stepId 에 0 을 반환한다
- [ ] `interpolateSteps` 결과를 목 writer 에 흘려 트윈이 `from → to` 로 진행함을 확인

### 10.8 화면 — `src/features/**/*.test.ts` (Testing Library)

- [ ] 목 `PhysicsWorldApi` 로 편집기 전체가 렌더되고 드래그 커밋이 1회 dispatch 된다
- [ ] 공 10개 제한: 11번째 클릭에 개체가 안 생기고 토스트가 뜬다
- [ ] 지우개 규칙 표(§6.10) 6행 전부
- [ ] `useAppHistory`: `go` ×2 → `back` ×2 가 시작 화면으로 돌아온다.
      `present` 에서 `back('editor')` 후 뒤로가기가 **present 로 되돌아가지 않는다**
- [ ] 한 문서에 카드 SVG 2개 + 편집기 SVG 를 동시에 마운트해도 **marker id 가 중복되지 않는다**
- [ ] `Space` 가 포커스된 버튼에서 전역 핸들러를 발화시키지 않는다
- [ ] 코트 컨테이너가 `tabIndex=0` 이고 `Esc` 로 포커스가 복귀한다
- [ ] 키보드 커서로 공·콘·선수·메모를 **포인터 없이** 배치할 수 있다
- [ ] 화면 전환 시 `<main>` 에 포커스가 가고 라이브 리전이 갱신된다
- [ ] 세션 드로어: 열 때 제목 포커스, 닫을 때 트리거 복귀
- [ ] 시연: '나가기' 버튼이 전체화면에서도 보이고 동작한다. 블랙아웃이 포인터로 해제된다

### 10.9 골든값 재생성 참조 구현

§10.2 의 골든값은 아래 알고리즘으로 생성했다. 값이 안 맞으면 **먼저 이 참조로 재현**해 본다.
파라미터: `L=37.5, W=25, sPivot=0.20, vLin=69.44444444, ω=6.944444444, dt=1/120,
SPIN_RADIUS_MIN_PX=9.375`.

```
grabOf(pose, T):  e=u(θ); rx=T.x−P.x; ry=T.y−P.y
                  ax = rx·e.x + ry·e.y;  lat = e.x·ry − e.y·rx
                  rho = hypot(ax,lat);   beta = atan2(lat,ax);  s = 0.20 + ax/37.5
G(pose,g)      :  e = u(θ+g.beta);  return P + g.rho·e
translate      :  d = clampMag(T − G, vLin·dt);            P += d
spin           :  §5.5 (B) 그대로. st.phiPrev 는 첫 호출에 phi 로 초기화
tow            :  §5.5 (C) 그대로. 단방향 가드 포함
```
전체 스크립트는 `src/test/helpers/kinematicsReference.ts` 로 커밋한다(테스트가 이걸 직접 쓴다).

**생성된 골든값 요약**

| 항목 | 값 |
|---|---|
| G1 첫 substep ΔP / Δθ (8조합) | **0.000000000 / 0.000000000** |
| G2 towRear 직선 후진 84스텝 | P = (−40.0000, −0.0000), θ = 0.000000° |
| G3 towFront 측방 견인 60스텝 | P = (10.9893, 8.6418), θ = **+54.4538°** |
| G4 towRear 측방 견인 60스텝 | P = (−5.1862, 24.7504), θ = **−89.3035°** |
| G5 로프 반전 (ε=±1, ±0.2) | θ = **0.0000°** (4케이스 전부) |
| G6 spin 피벗 통과 (ε=±0.4 / ±2) | θ = **±17.0188° / ±43.4855°** (±2 값 2026-08-08 정정, §10.2 각주) |
| G7 spin 추종 (2 rad/s 1.0 s / 12 rad/s 0.5 s) | **113.637° / 195.628°** |
| G8 최대 피벗 속력 (3존) | **69.444444 px/s**, 로프 오차 ≤ 1.1e−14 |
| 로프 길이 최대 오차 (G2) | **8.9e−16** |

### 10.10 수동 체크리스트 (Wave 4 게이트)

- [ ] `grep -rn 'var(--faint)' src/` 결과가 전부 §7.1 의 "장식" 목록에 해당한다
- [ ] 다크·라이트 양 테마에서 5화면 전부 육안 확인 (코트 배경이 양쪽 모두 `#1f7a46`)
- [ ] **키보드만으로 드릴 1개 완주**: 새 드릴 → 코트 선택 → 선수 배치 → 공·콘 배치 →
      화살표 2개 → 스텝 3개 → 저장 → 시연
- [ ] 태블릿 실기기: 전체화면 · Wake Lock · 스와이프 · 핀치 줌 · 존 핸들 드래그
- [ ] 브라우저 줌 200 % 에서 가로 스크롤 없음
- [ ] `uiScale 1.3` 에서 레이아웃이 깨지지 않음
- [ ] 저장소 차단(시크릿 모드)에서 앱이 뜨고 열화 경고가 보인다
- [ ] 두 탭에서 같은 드릴을 열고 한쪽에서 저장 → 다른 쪽이 `E_CONFLICT` 를 보여 준다

---

## 11. 기각한 심사 지적과 근거

전부 직접 검산했다. 기각 = "심사자의 관찰은 맞지만 결론이나 처방을 채택하지 않는다" 를 포함한다.

**R1. [math/matter blocker] "차체를 1.30 × 0.75 m 로 줄여라"**
→ **기각.** 심사가 아니라 설계안 1 의 전제였고, 다른 두 설계안·프로토타입·REQUIREMENTS §7 과
충돌한다. FIPFA 규격 근거는 타당하지만 대가가 크다: 등번호 20 px 글리프가 18.75 px 칩에 안 들어가
설계안 1 스스로 "폰트 20 → 11" 을 요구했고, 그 11 px 는 §7.4 의 폰트 하한(11 px)에 걸쳐 저시력
사용자에게 판독 불가가 된다. 등번호는 §7.5 "색 비의존 팀 구분" 의 유일한 대체 표식이므로 접근성
요건이다. 1.5 × 1.0 m 를 채택하고 부수 이득으로 `hullRadius = 32.5 px` 정수를 얻는다.
(설계안 1 의 물리 논증은 전부 유효하며 상수만 재유도했다.)

**R2. [math minor] "`_restingThreshTangent` 때문에 dt 를 1/60 으로 되돌리면 마찰이 달라진다"**
→ **관찰은 채택, 처방은 기각.** 소스 확인 결과 정확하다(`restingThreshTangent` 는 timeScale 이
곱해지지 않고 접선 마찰은 `timeScale³`). 하지만 처방("dt 를 바꿀 수 있게 하고 마찰을 재튜닝")은
받지 않는다. **`PHYS.dtMs` 를 1/120 고정 상수로 못박고** "이 값을 바꾸면 §5.3 마찰 테이블 전체를
재튜닝할 것" 주석만 남긴다. dt 를 1/60 으로 올리면 공+콘 터널링 마진이 1.3× → 0.65× 로 떨어져
관통이 발생하므로(§5.8) 애초에 선택지가 아니다.

**R3. [feel] "화살표 끝점을 개체에 앵커링(`fromRef`/`toRef`)하라"**
→ **기각.** 설계안 3 의 제안이다. 화살표는 물리 개체가 아니라 주석이고 스텝 로컬이다(D11).
앵커를 도입하면 (a) 스텝마다 참조 무결성을 검증해야 하고, (b) 개체를 미배치로 만들 때 "끊어서
고정 좌표로 전환" 하는 특수 경로가 필요하며, (c) `presenceOf` 보간이 참조 해석에 의존하게 된다.
**생성 시 1회 스냅**(시작점이 개체 중심 15 px 이내면 그 중심으로)이 이득의 90 % 를 0 의 지속
비용으로 준다.

**R4. [integrity] "`drillSummaries` 스토어를 없애고 단일 스토어 + 메모리 인덱스로 가라"**
→ **부분 기각.** "미사용 인덱스 4개를 지워라" 는 채택했다(§4.2 — `by_category`/`by_tag` 제거).
스토어 분리는 유지한다: 라이브러리 그리드가 요약에서 **실시간 SVG 썸네일**을 그리므로 목록을 열
때마다 드릴 전량(200건 ≈ 2 MB)을 역직렬화하게 되고, `content-visibility` 가상화와도 맞지 않는다.
분기 위험은 **항상 한 트랜잭션에서 함께 쓰는 것**으로 막고, 재생성 핑퐁은 **레코드별 `build` +
지연 재생성**으로 막았다(전역 스윕 폐기 — 이 부분은 심사 지적을 그대로 채택).

**R5. [future] "`SpinFileKind` 에서 `'drillSet'` 을 빼거나, `exportPrefsFile` 을 지금 만들어라"**
→ **엇갈려 채택.** `'drillSet'` 은 `SpinFile` 유니온에 **명시적으로 넣는다**(payload `unknown`,
커밋만 거부) — 그래야 미래 파일이 정체불명의 파싱 에러가 아니라 명확한 한국어 메시지를 낸다.
반면 `exportPrefsFile` 은 **기각**한다: 호출자 없는 죽은 코드이고, `Preferences` 가 이미 자기
`schemaVersion` + 마이그레이션 체인 + `spin.` 네임스페이스를 가지므로 나중에 무손실로 추가된다.
설계안 2 스스로 세운 "아무도 채우지 않는 것을 미리 넣지 않는다" 기준을 그대로 적용했다.

**R6. [feel] "존 경계를 0.10 / 0.38 로 넓혀 translate 를 크게 하라"**
→ **부분 기각.** "translate 가 가장 빈번한데 가장 좁다" 는 관찰은 맞다. 하지만 처방의 전제
("직접 잡기의 픽셀 크기를 키우면 해결된다")가 성립하지 않는다 — 실측 배율에서 translate 를
0.28·L 로 넓혀도 12.5 CSS px 라 여전히 WCAG 24 px 미달이고, 대신 spin 존이 좁아져 회전 조작이
나빠진다. **근본 해결은 §6.4 줌 + §5.12 존 핸들**이고 둘 다 채택했다. 경계는 `0.12 / 0.32 / 0.85`
로 두되 `sTowFrontMin = 0.85` 를 **렌더되는 볼가드 뒷면과 정확히 일치**시켜 사용자가 눈으로
경계를 알 수 있게 했다(가드 깊이 0.15·L). translate 밴드는 0.20·L = 7.5 px = 0.30 m 로
탑승자 머리·어깨 폭과 맞고, 저배율에서는 핸들이 정상 경로이므로 실사용 타깃은 44 CSS px 다.

**R7. [math minor] "§3.2 의 '`|a|` 나눗셈 특이점' 근거가 틀렸다"**
→ **관찰 채택, 문서 반영.** `stepSpin` 은 레버를 아예 쓰지 않고 `stepTow` 의 나눗셈은
`n = r/|r|` 하나뿐이다. §5.5 를 새로 쓰면서 근거를 정정했다: tow 는 `θr = atan2(Gt − Pr)` 에서
`|Gt − Pr| = rho` 이므로 rho → 0 이면 헤딩이 정의되지 않고, 밴드가 `rho ≥ 0.08·L = 3.0 px` 를
보장한다. spin 은 레버를 쓰지 않으므로 이 제약과 무관하며, 경계는 히트 타깃 배분 문제다.

**R8. [math minor] "`wrapPi` 를 `(−π, π]` 로 고쳐라"**
→ **기각. 문서를 구현에 맞춘다.** 실측 `wrapPi(π) === −π`. 180° 전환의 회전 방향이 반시계로
고정되는 것은 결정론적이고 기능적 결함이 아니다. 특수 케이스를 넣으면 코드가 늘고 테스트 표면이
커진다. 대신 `expect(wrapPi(Math.PI)).toBe(-Math.PI)` 를 **계약 테스트로 못박았다**(§10.1).

**R9. [a11y] "라이트 코트 배경 `#2f9e5c` 의 격자 opacity 를 .30 으로 올려라"**
→ **더 강한 조치로 대체.** .30 으로 올려도 라이트에서 1.48:1 이라 여전히 안 보인다.
**라이트 코트 배경 자체를 폐기하고 양 테마 모두 `#1f7a46` 을 쓴다**(`logic.js:288` 의
`dark?'#1f7a46':'#2f9e5c'` 분기 제거). 코트는 UI 패널이 아니라 "경기장" 이므로 테마에 따라
색이 바뀔 이유가 없고, 이렇게 하면 흰 라인 5.34:1 · 검정 케이싱 3.93:1 · 격자 .22 등
코트 위 모든 값이 한 벌로 검증된다.

**R10. [feel] "`BALL.maxSpeedPxPerS` 를 450 으로 올리고 콘 반지름을 키워라"**
→ **부분 채택.** 상한은 300 → **420** 으로 올린다(스핀킥 실측 최대 11.52 m/s = 288 px/s 대비
1.46배 여유, 36 km/h 설정 상단의 이론 최대도 커버). 450 은 기각한다 — substep 변위 3.75 px 가
공+콘 상대 접근(5.75 px)에서 접촉 밴드 7.196 px 의 80 % 에 달해 마진이 1.25× 로 떨어진다.
420 이면 5.5 px vs 7.196 px = 1.31× 다. 콘 반지름 확대는 렌더 일치가 깨지므로 기각하고,
대신 §10.3 에 **터널링 마진 자동 검증 테스트**를 넣어 상한을 올리면 테스트가 먼저 깨지게 했다.

**R11. [perf] "`dt` 클램프 50 ms 를 물리에 넣지 마라" → 채택. 다만 "슬로모션 대신 시간 스킵"의
`MAX_SUBSTEPS = 4` 는 기각하고 6 을 쓴다.**
`PHYS.accClampMs = 50 = 6 × 8.3333` 으로 두 값을 정확히 일치시켰다. 4로 하면 33 ms 만 소화해
30 fps 기기에서 실시간 속도가 유지되지 않는다.

**R12. [integrity] "`maxCones` 를 2000 으로 올리고 IDB 로드 경로에서도 repairs 를 알려라"**
→ **전면 채택.** 다만 심사가 제안한 "파괴적 보정이면 기회적 되쓰기를 하지 않는다" 를 넘어
**`Repair.destructive` 필드를 스키마에 명시**해 판단 근거를 코드에 남겼다(§3.8, §4.3).

**R13. [a11y] "`SWIPE_MAX_MS` 를 설정으로 노출하라"**
→ **더 단순한 조치로 대체.** 설정 항목을 늘리지 않고 **시간 상한을 아예 제거**한다.
시연 모드에는 개체 드래그가 없어 오작동 위험이 0 이므로 거리·비율 조건만으로 충분하다.

**R14. [math] "설계안 1 의 tow 골든값(+59.83° / −89.69°)이 재현되지 않는다"**
→ **관찰 채택. 값은 전면 재생성.** 심사자가 지적한 대로 원 문서의 값은 포인터 궤적이 명시되지
않아 재현 불가능했다. 차체 치수 변경(R1)과 lateral 래치·단방향 로프 수정까지 겹쳤으므로
**골든값을 처음부터 다시 만들었다**(§10.9). 이제 궤적·스텝 수·dt 가 전부 명시돼 있다.

**R15. [integrity] "`findSessionsUsing` 을 `findReferrers` 로 일반화하라"**
→ **채택** (§4.3). v1 코드량이 늘지 않고 드릴 셋 추가 시 diff 가 한 줄로 줄어든다.
반면 같은 렌즈의 "드릴 셋용 `ImportCandidate` 를 제네릭화하라" 도 **채택**했다
(`ImportCandidate<T>`) — 세션 가져오기가 v1 필수 기능이라 이미 두 종류가 필요하다.

---

## 12. 미해결 질문 (코치 확인 필요 — 구현을 막지는 않는다)

| # | 질문 | 현재 기본값 | 영향 |
|---|---|---|---|
| Q1 | 편집 드래그가 10 km/h 로 제한되어 코트를 가로지르는 배치에 10 초가 걸린다. `editorSpeedMultiplier` 를 기본 1.0 으로 둘까, 2.0 으로 둘까? | **1.0** (REQUIREMENTS §4.4 를 기본값에서 정확히 준수) + 릴리스 체이스 4초 + 리시/고스트 | 배치 조작 체감. 2.0 이면 접촉 속도도 2배가 되어 규정 속도가 아니게 된다 |
| Q2 | 회전 상한 30 km/h 는 물리 천장(8.547 rad/s)의 81 % 다. 실제 경기 스핀킥과 비교해 적절한가? | **30 km/h** (ω = 6.944 rad/s, 180° 선회 0.452 s, 스핀킥 실측 8.2–11.5 m/s) | 스핀킥 위력 |
| Q3 | 공이 접근속도 4.8 m/s 미만에서 튀지 않는 것은 matter 의 구조적 성질이다. 저속 반발 훅을 켤까(현재 켬), 아니면 "가드에 붙어 밀린다" 를 드리블 거동으로 수용할까? | **훅 켬** (전 구간 e=0.45) | 패스가 가드에 맞았을 때의 느낌 |
| Q4 | 공의 시각 반지름 7 px(0.28 m)이 물리 반지름 4.125 px(0.165 m)보다 2.875 px 크다. 시각을 줄일까, 물리를 키울까, 그대로 둘까? | **그대로** (프로토타입 시각 언어 유지) | 충돌이 "보이는 것보다 늦게" 일어난다. 0.115 m = 화면상 2.9 px |
| Q5 | 팀 색 `#2b7fd4` → `#1f6bb8` 변경(등번호 대비 4.13 → 5.45). 시각적으로 거의 같지만 프로토타입과 다르다. | **변경** | 상대 팀 칩 색조가 약간 진해진다 |
| Q6 | 콘 슬롯 1 을 "삼각형 + 밑변 사각 베이스" 실루엣으로 구분. 색만 다른 편이 나을까? | **실루엣 구분** | 색각 이상 대응 |
| Q7 | 스텝 간 350° 회전 같은 전환은 최단호 보간으로 −10° 가 된다(저장 각도를 랩하기 때문). 중간 스텝으로 표현하는 것으로 충분한가? | **최단호 + 중간 스텝** | 큰 회전 연출 |
| Q8 | 코트 모드 전환(`full ↔ half`)에서 배치를 리셋한다. 근사 변환이라도 있는 편이 나을까? | **리셋 + 안내 문구** | 코트 전환 워크플로 |
| Q9 | `full ↔ half` 전환 불가로 인해 "이 드릴을 하프에서도 해 보자" 가 재배치 작업이 된다. 드릴 셋(v2)에서 쌍으로 묶는 것으로 충분한가? | 미정 | v2 범위 |

---

## 부록 A. 프로토타입 → v1 매핑표

| 프로토타입 | v1 | 비고 |
|---|---|---|
| `sc-if value` / `sc-for list as` | `{cond && …}` / `{list.map(…)}` | key 필수 |
| `state.frame` | `EditorState.stepId` (index 는 `selectStepIndex` 파생) | D42 |
| `state.tool` | `EditorState.tool` | `add → player`, `text → note`, **`cone` 추가** |
| `frames` / `halfFrames` 하드코딩 | `Drill.steps` | 기본 배치는 `defaults.ts`. **좌표는 centroid → pivot 변환 필요** |
| `chips[].horiz/vert` | **삭제** → `<g transform=rotate(θ)>` + 등번호 역회전 | D13, §3.4 |
| `chips[].gstyle` (CSS transition) | **삭제** → `TransformWriter` + rAF 트윈 | D40 |
| `ballStyle` | `BallDot` + writer | |
| `arrows[].d` (cubic `C`) | `Arrow {from, ctrl, to}` (quadratic `Q`) | D8 |
| `courtDefs` | `COURT_DEFS` | surface/grid/ruleZones 추가 |
| `courtPreview()` | `CourtPreview.tsx` | 마크업 그대로 이식 |
| `drillDefs` / `session` 하드코딩 | IndexedDB `drills` / `sessions` | |
| `catColor` | `CATEGORY_COLORS` | `#2b7fd4 → #1f6bb8` |
| `interval()` | `PLAYBACK.stepIntervalMs` | 값 동일 (2400 / 1500 / 800) |
| `pickCourt` 헤더 스위치 | `aria-disabled` 세그먼티드 + 토스트 | §6.8 |
| `mk()` 의 `ink` | `inkFor(color)` | §2.9 |
| 코트 배경 `dark?'#1f7a46':'#2f9e5c'` | `COURT_BG = '#1f7a46'` (양 테마) | R9 |
| `title` 속성 툴팁 | `aria-label` 필수 + `title` 은 마우스 힌트 병기 | §7.7 |

## 부록 B. 출처

- FIPFA Laws of the Game / Technical Supplement — footguard 규정, 최고속 10 km/h
- SPFA Rules — 공 13″(33 cm), 코트 최대 30 × 18 m
- Goalfix Sports 가이드 — 공 33 cm / 약 1000 g, 골 폭 6 m
- Wikipedia *Powerchair football* — 최고속 10 km/h, 2인 규칙
- matter-js 0.20.0 소스 — `body/Body.js`, `collision/{Resolver,Detector,Pair}.js`,
  `core/{Engine,Common,Sleeping}.js`, `factory/Bodies.js`
- WCAG 2.2 — SC 1.4.3 / 1.4.11 / 2.1.4 / 2.4.1 / 2.4.7 / 2.4.11 / 2.5.8
- Apple HIG — 44 × 44 pt 최소 터치 타깃
