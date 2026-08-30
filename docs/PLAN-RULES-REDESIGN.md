# SPIN 규칙 화면 재설계 — 주제별 학습 구조 (v2)

> ⚠️ **설계 히스토리 — 2026-08-31 부로 콘텐츠 정본이 아니다.** 이 문서의 **콘텐츠 구조**
> 부분(확정 결정 1·4 의 "8주제", §1 「8주제와 키·URL」 표와 `contested` 독립 주제,
> `out-of-play` 의 tagline, §2 주제별 산문)은 [`PLAN-RULES-9CARDS.md`](./PLAN-RULES-9CARDS.md)
> 로 대체됐다. **지우지 않고 남긴다** — 무엇이 언제 왜 바뀌었는지는 그 문서 §1.2 「뒤집는
> 결정」 표가 옛 근거와 함께 적는다. 카드 홈·블록 모델·재개 비교표·포스터+단일 활성 같은
> **구조 결정은 그대로 살아 있다.**

## Context

2026-08-21 랜딩한 규칙 화면(18개조 사전식 + 14장면 + 3도해)에 대해 기현님 판정: **"규칙 전문을 넣는 건 무리였다."** 조항 순서는 참조(찾아보기)에는 맞지만 학습(익히기)에는 맞지 않다 — 코치·선수가 실제로 궁금한 건 "제13조가 뭐지"가 아니라 "킥인이랑 코너킥이 뭐가 다르지", "2-on-1이 언제 성립하지"다. 그래서 **18개조 사전을 주제별 학습 구조 8개로 재편**하고, 조항 사전은 압축판 부록으로 강등한다. 설치된 프런트엔드 스킬 13종과 보드(시연 인프라)를 적극 활용한다.

정본 문서: 이 설계를 `docs/PLAN-RULES-REDESIGN.md`로 커밋 1에 싣는다. 팩트 원천은 `docs/RULES-FIPFA-2025.md`(이번에 세트볼 절차·회전킥·경합 판정 원문 보강).

## 확정 결정 (기현님 20문답, 2026-08-22)

| # | 결정 |
|---|---|
| 1 | 최상위 탐색 = **카드 홈 그리드** (8주제 카드 → 상세 전환, 마스터-디테일 폐기) |
| 2 | 부록 = **18개조 압축판** (조항당 2~3줄, 기존 상세 본문 폐기) |
| 3 | **/rules/\<topic\> 딥링크 신설 + 기존 nav 배선 결함 수리** |
| 4 | 주제 구성 = 나열한 **8개 그대로** |
| 5 | 비교표 행 = **표준 5행** (언제/볼 위치/상대 거리/직접 득점/특이사항) |
| 6 | 비교표 열 = **7열, 직·간접FK 분리** (세트볼은 주제③에서) |
| 7 | 표→장면 = **열 선택 → 표 아래 단일 플레이어 교체 재생** |
| 8 | 좁은 화면 표 = **재개별 카드 세로 접기** (가로 스크롤 금지 — 스킬 지침) |
| 9 | 상세 = **전폭 문서 + ←뒤로 + 하단 이전/다음 주제** |
| 10 | 다중 장면 = **포스터 + 단일 활성** (재생 누른 것만, 나머지 포스터 복귀) |
| 11 | **수동 재생만** (자동 재생 없음) |
| 12 | 2-on-1 = **5장면** (기본 위반 · 관여 전/후 컷 대비 · GK 예외 강조 · 상대 없음 · 회피 이탈) |
| 13 | **세트볼 장면 1개 신설** (참여 2명 30cm + 3m 링) |
| 14 | **회전킥 장면도 신설** (원문 취지: 금지 아님, 위험한 플레이 판정 가능) |
| 15 | 경합 = **1장면만** (동시 접촉 주행 판정) |
| 16 | 카드 = **사유 요약 리스트** (경고 7종·퇴장 8종, 도해 없음) |
| 17 | 신규 정지 도해 = **필요한 곳만** (5m/3m 거리 개념도 1장 수준) |
| 18 | 연출 = **적극적** (단 reduced-motion 두 채널·opacity/transform 위주·상호작용 ≤300ms 게이트는 준수) |
| 19 | 퀴즈 = **제외** (로드맵 후보로만 기록) |
| 20 | **한 사이클에 전부 구현** (커밋은 단계별) |

## 1. 정보 구조(IA)

### 8주제와 키·URL

| # | key | 제목(안) | 태그라인(안) | 장면 | 도해 |
|---|---|---|---|---|---|
| 1 | `basics` | 기본 규칙 | 코트·선수·공·장비 | field-tour, lineup | court, ball, equipment |
| 2 | `restarts` | 경기 재개 한눈에 | 7가지 재개를 표 하나로 | kickoff, kick-in, corner, goal-kick, dfk, ifk, penalty (표 연동) | — (표가 주인공) |
| 3 | `out-of-play` | 아웃 오브 플레이 | 라인·5m·세트볼·투터치 | inout, scoring, set-ball, dfk+ifk(재참조) | distance(신규) |
| 4 | `goal-area` | 골에어리어 반칙 | 3인 진입·PK 조건·GK | three-in-area, penalty(재참조) | — |
| 5 | `two-on-one` | 2-on-1 | 3m 안 2대1, 예외까지 | two-on-one + 신규 4 | — |
| 6 | `fouls` | 그 외의 반칙 | 램핑·회전킥·카드 | ramming, spin-kick(신규) | — (카드 리스트 블록) |
| 7 | `contested` | 경합: 누구 터치아웃? | 동시 터치 판정 | contested-touch(신규) | — |
| 8 | `rulebook` | 공식 룰 북 | FIPFA 18개조 압축 참조 | — | — (압축표 블록) |

- 기존 14장면 전부 재배치되고 고아 장면 2개(three-in-area, ifk)가 해소된다. 신규 7장면 → **총 21장면**.
- 재개 7열 ↔ 기존 set-piece 장면 7개가 정확히 1:1 대응 — 표의 각 열이 그 장면을 연다.
- 장면 재참조 허용: penalty는 주제②(표)와 주제④(PK 조건)에서, dfk/ifk는 ②와 ③에서 참조 가능 — 장면은 데이터라 중복 비용 없음.

### 라우팅
- `/rules` = 카드 홈, `/rules/<topicKey>` = 주제 상세.
- NavTarget `{kind:'rule', law:number}` → `{kind:'rule', topic:RuleTopicKey}` 로 교체.
- 관용: `/rules/law-N` 파싱 시 `topic:'rulebook'` 으로 매핑(과거 형식 부활 아님, 흡수만).
- **배선 결함 수리**: AppShell에 `ruleTopicFromNav` 추가 → `<RulesScreen topic={...}>` prop 전달, 화면에서 주제 선택 시 `nav.go('rules', {kind:'rule', topic})` 호출(역방향 URL 동기화). 뒤로가기 = 브라우저 히스토리와 일치.

### 콘텐츠 모델 (`ruleTopics.ts` 신설)

```ts
type RuleTopicKey = 'basics'|'restarts'|'out-of-play'|'goal-area'|'two-on-one'|'fouls'|'contested'|'rulebook';

type RuleBlock =
  | { kind: 'prose'; heading?: string; body: string[] }       // 읽는 산문(문단 배열)
  | { kind: 'figure'; figureId: RuleFigureId }                 // 정지 도해
  | { kind: 'scene'; sceneId: RuleSceneId; heading: string; lead?: string }  // 인라인 보드 장면
  | { kind: 'restart-table' }                                  // 비교표(단일 전용 블록)
  | { kind: 'card-list' }                                      // 경고·퇴장 사유 리스트(단일)
  | { kind: 'law-index' };                                     // 부록 18개조 압축표(단일)

interface RuleTopic { key: RuleTopicKey; title: string; tagline: string; blocks: RuleBlock[]; }
export function ruleTopicsFor(locale: Locale): readonly RuleTopic[];  // ko 고정(기존 패턴)
```

- `ruleContent.ts`의 `RuleLaw`는 부록 전용으로 축소: `{law, key, group, title, summary}` — summary 2~3줄로 압축, `sceneId`/`figureId` 필드 제거(연결 책임이 topics로 이동).
- 비교표 데이터는 `restartTable.ts` 분리: 7열×5행 + 열별 `sceneId` — 표와 장면 연결 정합을 테스트로 고정.

## 2. 주제별 콘텐츠 상세 (팩트는 전부 RULES-FIPFA-2025.md 대응 조문 명기)

### ① 기본 규칙 `basics`
prose(코트 규격·라인 5cm) → figure `court` → scene `field-tour` → prose(선수: 4명 GK 포함·최소 2명·교대 4명·체어 통제력) → scene `lineup` → prose(공: 구형·저반발·타넘지 못할 압력, 파열 시: 인플레이 중→세트볼 / 재개 중→그 재개 다시) → figure `ball` → prose(장비: 10km/h 전·후진 동일, 벨트·가드, 밑판 경계) → figure `equipment`.

### ② 경기 재개 한눈에 `restarts`
prose(도입: "정지된 공이 다시 살아나는 7가지 방법") → **restart-table** → 표 아래 연동 플레이어(기본 kickoff).

**표 데이터 (7열×5행)** — 전 셀 2~6단어, 상세는 장면 노트로:

| 행 | 킥오프 | 킥인 | 코너킥 | 골킥 | 직접FK | 간접FK | 페널티킥 |
|---|---|---|---|---|---|---|---|
| 언제 | 시작·득점 후 | 터치라인 아웃 | 수비가 골라인 아웃 | 공격이 골라인 아웃 | 직접FK 반칙 | 간접FK 위반 | 에어리어 안 중대 반칙 |
| 볼 위치 | 센터 마크 | 나간 지점 | 코너 트라이앵글 | 에어리어 안 임의 | 반칙 지점 | 위반 지점 | 페널티 마크 3.5m |
| 상대 거리 | 5m | 5m | 5m(에어리어 안 1m 마크 뒤) | 5m | 5m | 5m | 마크 뒤 5m·에어리어 밖 |
| 직접 득점 | ✓ | ✓ | ✓ | 상대 골만 | ✓ | ✕ 경유 필요 | ✓ |
| 특이 | 전원 자기 진영 | 동시 터치는 바깥쪽에 | GK 골라인 뒤 예외 | 에어리어 벗어나야 인플레이 | 자책 직접 → 상대 코너 | 주심 한 팔 시그널 | GK 골라인 뒤 정지 |

"직접 득점" 행은 `Verdict` 시각 어휘(✓/✕ + 짧은 라벨) 재사용 — 색만으로 뜻을 전하지 않는다(스킬 게이트).

**2026-08-22 원문 재확인**: 투터치(2회 연속 터치) 금지는 **7열 전부**에 명시돼 있다(페널티킥·코너킥도 포함 — 최초 조사에서 "명시 없음"으로 나왔던 것은 오독, PDF 원문 Law 14/17에서 직접 확인). 위반 시 제재도 전부 동일("위반 지점에서 상대에게 간접프리킥"). 따라서 표의 "특이" 행에 투터치를 열마다 반복하지 않는다 — 표 위 prose에 "전 재개 공통: 투터치 금지·위반 시 간접FK"를 한 번 적고, "특이" 행은 그 재개만의 진짜 차별점(전원 자기 진영·동시터치 규칙·GK 예외 등)으로 채운다.

### ③ 아웃 오브 플레이 `out-of-play`
prose(원칙: 공 **전체**가 라인을 넘어야 — 지면·공중 불문) → scene `inout` → prose(득점도 같은 원칙 + 50.8cm 부양 무효) → scene `scoring` → prose(재개 공통 5m, 세트볼만 3m) → **figure `distance`(신규)** → prose(세트볼 절차: 인플레이 중 기타 사유 중단 → 중단 지점, 참여 각 팀 1명 30cm·터치라인 평행 대치, 나머지 3m 밖, 신호 전 턴 → 간접FK, 에어리어 안이면 에어리어 라인 최근접점) → scene `set-ball`(신규) → prose(투터치 금지: 킥오프 위반 시 간접FK 명시, FK·킥인·골킥 공통) → prose(직·간접 차이) → scene `dfk` → scene `ifk`.

### ④ 골에어리어 반칙 `goal-area`
prose(3인 진입 → 간접FK, 득점 기회 저지면 카드 병과) → scene `three-in-area` → prose(에어리어 안 직접FK 반칙 → PK) → scene `penalty`(재참조) → prose(GK 아닌 선수 골라인 통과 → 간접FK, 득점 저지면 퇴장) → prose(에어리어 안 FK 특칙: 수비는 코트 안 임의 지점·상대는 에어리어 밖·공이 에어리어를 직접 벗어나야).

### ⑤ 2-on-1 `two-on-one`
prose(정의: 인플레이 공 3m 안 같은 팀 2 + 상대 1, **셋 모두 액티브 플레이 관여 시에만** 성립. 액티브 플레이 = 관여·방해·위치 이득) → 장면 5개:
1. `two-on-one` (기존) — 기본 위반 → 간접FK
2. `two-on-one-active` (신규) — **존재만으론 합법** → 둘째가 관여하는 순간 위반 (컷 대비)
3. `two-on-one-gk` (신규) — **GK 예외**: 둘 중 하나가 자기 에어리어 안 GK면 성립 안 함 (강조 — lead 문구와 노트에 굵게)
4. `two-on-one-open` (신규) — 3m 안에 상대가 없으면 성립 안 함
5. `two-on-one-escape` (신규) — 회피 이탈 5조건(자연스러운 흐름·페이즈 내 미재진입·원위치 재진입·안전·비상습) 지키면 합법, 어기면 경고

### ⑥ 그 외의 반칙 `fouls`
prose(직접FK 6종: 램핑·붙듦·핸드볼·팔 사용·침 뱉기·득점 기회 저지) → scene `ramming` → prose(회전킥: **금지 아님** — 동작 일부 구간에서 공·주변이 안 보여 위험 상황을 만들 수 있고, 그 경우 "위험한 플레이"로 간접FK 판정 대상) → scene `spin-kick`(신규) → prose(간접FK 6종) → **card-list 블록**(경고 7종 · 퇴장 8종 — 옐로/레드 소형 마크 + 사유 한 줄씩) → prose(징계 절차: 반칙자 불특정 시 선임 코치 승계, 권한은 도착~퇴장).

### ⑦ 경합: 누구 터치아웃? `contested`
prose(기본: 마지막 터치 팀의 상대에게 킥인) → scene `contested-touch`(신규): 두 상대가 터치라인 따라 접촉 주행하며 공 동시 터치 → 아웃 → **바깥쪽에서 공을 안에 묶어두려던 선수 쪽** 킥인.

### ⑧ 공식 룰 북 `rulebook`
prose(판본·출처: FIPFA Laws of the Game, 2025-04 승인판) → **law-index 블록**: 18개조 압축표(조항 번호·제목·2~3줄 요약). 기존 55개 불릿 상세는 폐기하고 새로 압축해 쓴다.

### 신규 장면 7개 SPEC 골격

| sceneId | 스텝 | cut | ring | 개요 |
|---|---|---|---|---|
| `two-on-one-active` | 3 | [2] | 3m | ①2+1이 링 안, 둘째 정지(합법 노트) ②둘째가 공 쪽 관여(위반) ③(컷) 간접FK 배치 |
| `two-on-one-gk` | 2 | — | 3m | 자기 에어리어 안 GK + 필드 1명 + 상대 — 성립 안 함(강조 노트) |
| `two-on-one-open` | 2 | — | 3m | 같은 팀 2명뿐, 링 안 상대 0 — 성립 안 함 |
| `two-on-one-escape` | 3 | [2] | 3m | ①위반 임박 ②한 명이 장외로 회피(조건 노트) ③(컷) 원위치 부근 재진입 |
| `set-ball` | 2 | — | 3m | ①참여 2명 30cm 평행 대치 + 전원 3m 밖 ②신호 후 재개(신호 전 턴 → 간접FK 노트) |
| `spin-kick` | 3 | [2] | — | ①공 옆 회전 준비(회전 화살표) ②회전 중 사각지대로 상대 접근(위험 강조) ③(컷) 위험한 플레이 판정 시 간접FK |
| `contested-touch` | 2 | — | — | ①두 상대 접촉 주행·공 동시 터치 ②아웃 → 바깥쪽 선수 쪽 킥인(판정 노트) |

전 장면 기존 규율 유지: `courtMode:'full'`, `courtSize:'28x15'`, cut 스텝 인덱스 ≠ 0.

## 3. UI 설계

### 카드 홈 (`/rules`)
- 반응형 그리드 `repeat(auto-fill, minmax(240px, 1fr))`, 좁으면 1열. `useIsNarrow` 신규 분기 불필요(그리드가 자체 반응).
- 카드 = `Card` 관례(1px `--border`·radius 1rem·`--panel`) + 제목(`text-wrap: balance`) + 태그라인 + 메타 배지 줄(`Badge`: "장면 5" / "도해 3" / "비교표"). 부록 카드는 `--panel-2` 배경으로 2차 톤 구분.
- 주제 카드에 번호를 붙이지 않는다(frontend-design 지침: 분류지 순서가 아님) — 순서는 그리드 배열로만.
- 활성/hover: `1.5px solid var(--accent)` + `color-mix(in srgb, var(--accent) 8%, var(--panel))` (SessionTab 강조 카드 관용구).

### 주제 상세 (`/rules/<topic>`)
- 상단 `←뒤로` (44px 히트 하한 준수 — 기존 미달 버그 함께 수리, 라벨 i18n 키로), `<h2>` 제목 + 태그라인.
- 본문 = blocks 순서 렌더. 산문 `maxWidth:760·line-height 1.6·text-wrap:pretty`, 장면·도해 `maxWidth:560`(기존 규율).
- 하단 이전/다음 주제: 미니 카드 2개(제목+태그라인), 마지막 주제의 다음 = 없음.
- 헤더 부제: 정적 헤더 유지가 기본. 상세 진입 시 부제를 주제명으로 바꿀 수 있는지는 AppShell 구조 확인 후 결정(불가하면 화면 안 h2로 충분).

### 비교표 (넓은 화면)
- 진짜 `<table>` + `<caption>` + `<th scope="col|row">` (스킬 게이트: 시맨틱 표).
- 열 머리글 = 선택 버튼(`aria-pressed`), 선택 열은 세로 전체 `color-mix(accent 8%)` 배경 + 머리글 accent 테두리. 수치 전부 `tabular-nums`(Badge 기존 설정 재사용).
- 행 hover 하이라이트(배경 `--elev`), 150ms.
- 구분선 `1px solid var(--border)`(구조는 테두리, 그림자 금지 — 스킬 지침).
- 표 아래 연동 플레이어 1개: 열 선택 → `key={sceneId}` 재마운트 + crossfade. 아래 인라인 장면 블록과 같은 컴포넌트 재사용.

### 비교표 (좁은 화면)
- 재개 1종 = 카드 1장 세로 나열. 카드 안 `<dl>`(HelpCenter `DlItems` 관례)로 5항목, 카드 하단 "장면 재생" 버튼 → 카드 바로 아래 인라인 플레이어 확장(단일 활성 규율 공유).

### 인라인 장면 블록 (`RuleSceneBlock`)
- `FigureCard` 유사 카드: 제목띠(장면명) → 보드(aspect-ratio로 자리 예약 — CLS 0) → 노트 띠(64px min=max 기존 규율) → 컨트롤.
- **검증 확정: `PresentStage`는 `usePlaybackState/Actions`를 무조건 호출하므로 Provider 없이 못 세운다** (PresentStage.tsx:61-62). → 블록 구조는 **단일 마운트**: 항상 `PlaybackProvider`(경량 컨텍스트) + PresentStage를 세우고, `active` prop으로 상태만 바꾼다.
- **포스터 상태**(`active=false`): paused + 스텝 0 정지화면(마운트 직후 `seekMs(0)` + `seekToken` 정착 프레임 1회 — 기존 RulesScreen.tsx:74-77 트릭 이관 필수, 없으면 "전환 시작 자세"로 멈춤) + 중앙 재생 오버레이(60px accent 원 — `PlaybackControls` 재생 버튼과 동일 어휘) + "n스텝" 배지. 컨트롤·노트 띠는 숨김 대신 **자리 유지**(높이 고정, 내용만 교체 — 레이아웃 점프 금지).
- **활성 상태**: `PlaybackControls` 전체 + 노트 띠 가동.
- **단일 활성**: 주제 문서(`RuleTopicDoc`)가 활성 sceneId **하나**를 보유(장면 블록들+표 플레이어가 공유하는 단일 출처). 다른 블록 재생 시 이전 블록은 `active=false`로 pause+스텝0 복귀. PlaybackProvider 마운트는 **RuleSceneBlock.tsx 한 파일에만**(표 플레이어도 이 블록 재사용) — `playbackLoopPref.test`의 MOUNTS 갱신 + 리터럴 `initialLoop={prefs.loop}` 유지(소스 문자열 검사).
- 1스텝 장면(field-tour·lineup)은 포스터가 곧 완성 상태 — 재생 오버레이 없이 정지 도해처럼 렌더(기존 동작 유지).

### 신규 도해 `distance` (5m vs 3m 개념도)
- 공 중심 동심원 2개(5m 실선 = 일반 재개, 3m 파선 = 세트볼) + 치수선 + 체어 실루엣(`PowerchairSide` 재사용) 1~2대.
- **draw-in 연출**: 최초 뷰 진입 시 `stroke-dashoffset` 링 그리기 1회(≤600ms — 상호작용 아닌 일러스트 연출이라 300ms 게이트 밖, reduced-motion 시 정적 완성 상태).
- 기존 도해 규율 준수: 수치는 상수에서 파생 가능한 것만 파생, `stage-svg` 클래스 금지, 강제색에서 모양·라벨로 읽히게.

### 카드 사유 리스트 블록
- 경고 7종·퇴장 8종을 2절 리스트로. 각 행 앞 소형 카드 마크(12×16 라운드 사각 — 옐로 `#e8c33a`계·레드 `#d64545`계, 색+**"경고"/"퇴장" 텍스트 라벨** 병기 — 색만으로 전하지 않기). 신규 도해 아님, 리스트 마크업.

## 4. 연출(모션) 설계 — "적극적", 단 게이트 준수

공통 게이트: opacity/transform만(레이아웃 속성 애니 금지) · ease-out · 상호작용 전환 ≤300ms · reduced-motion 두 채널(`prefs.a11y.reduceMotion === 'always'` + `prefers-reduced-motion`) 모두에서 비활성 · `transition: all` 금지(속성 명시).

| 전환 | 효과 | 시간 | reduced-motion 시 |
|---|---|---|---|
| 카드 홈 첫 페인트 | 카드 stagger 40ms 간격, `scale(.96)→1` + opacity | 180ms | 즉시 표시 |
| 카드 hover/focus | border-color + 배경 tint | 150ms | 유지(모션 아님) |
| 홈→상세 진입 | 상세 opacity + `translateY(8px)→0` | 200ms | 즉시 |
| 상세→홈 복귀 | 홈 crossfade | 150ms | 즉시 |
| 표 열 선택 | 열 배경 tint 전환 + 플레이어 crossfade | 150/200ms | 즉시 교체 |
| 포스터→재생 | 판 crossfade + 컨트롤 fade-in | 200ms | 즉시 |
| cut 스텝 진입 | 노트 띠에 "장면 리셋" 배지 + 판 테두리 accent 1회 펄스 | 300ms | 배지만 |
| distance 도해 | 링 draw-in 1회 | ≤600ms | 정적 완성 |
| 이전/다음 주제 | 상세 진입과 동일 | 200ms | 즉시 |

구현 규율: **UI 커밋마다 착수 전 해당 스킬 로드** — 카드 홈·상세(`frontend-design`, `make-interfaces-feel-better`), 비교표(`ui-ux-pro-max` 표 참조·`web-design-guidelines`), 연출(`animate`, `animation-vocabulary`), 마감 리뷰(`review-animations`, `improve-animations` — 명시 호출).

## 5. 문서·팩트 갱신

`docs/RULES-FIPFA-2025.md` 보강 완료(커밋 1, 원문 PDF 재대조 — 스크래치패드 `fipfa-laws-2025.txt` 활용):
- Law 8에 **세트볼 절차 절 신설** — 완료: 트리거(인플레이 중 기타 사유 중단 전반), 참여 2명 30cm 평행 대치, 전원 3m, 신호 전 턴 → 간접FK, 에어리어 안 특칙(에어리어 라인 최근접점), 재개 중 파열은 세트볼 아닌 해당 재개 반복.
- Law 12에 **회전킥 정의 절 신설** — 완료: 원문 취지 그대로(금지 아님·위험 상황 가능·위험한 플레이 포섭).
- Law 15 동시 접촉 판정 문구 확인(이미 있음 — 유지).
- **투터치의 PK·코너킥 적용 여부 원문 재확인 — 완료, 둘 다 명시돼 있었다**(최초 조사가 오독). Law 14(1543행)·Law 17(1707-1711행) 원문에서 "두 번째로 만지면 안 됨 → 위반 지점에서 상대에게 간접프리킥"을 직접 확인, 두 조항 모두에 문장 추가. 사실상 7열 전부 공통 규정 — §2 표 설계에 반영(투터치는 표 위 prose로 한 번, "특이" 행에서 킥오프의 중복 문구 제거).
- `CORE_FACTS`에 `30cm` 추가는 **보류** — 문서에는 반영했으나(§"앱 반영 시 참고"), `ruleContent.ts`에 대응 문구가 아직 없어(부록 압축은 커밋 5) 지금 추가하면 `rulesDocTruth.test.ts`가 깨진다. 커밋 3(topics-data, 세트볼 주제 산문 작성) 또는 커밋 5에서 함께 추가.

기타 문서: README(규칙 화면 소개 갱신) · REQUIREMENTS §7.1 · DESIGN §6.12(주제 구조·블록 모델·단일 활성 규율로 재서술) · CHANGELOG [Unreleased] "변경됨" · FIELD-TEST §3.6(재설계 검증 행) · ROADMAP(퀴즈를 후보로 기록).

## 6. 엔지니어링 계획 (코드 검증 완료)

### 검증 결과 요약 (가정 9개)
| # | 가정 | 결과 |
|---|---|---|
| 1 | PresentStage Provider 비의존 | ✘ — usePlayback* 무조건 호출(PresentStage.tsx:61-62). 포스터도 Provider+paused (§3에 반영) |
| 2 | 체어 회전 표현 | ✔ — `SeedPose=[x,y,angleDeg]`, transformWriter가 rotate 적용. 회전킥은 스텝당 angleDeg 90°+씩 회전으로 연출(공 스핀은 화살표·노트 보조) |
| 3 | situation | ✔ — 옵셔널이고 **`'set-ball'`·`'2-on-1-spacing'`이 유니언에 이미 존재**(drill.ts:157-168) — 신규 장면에 그대로 사용 |
| 4 | RULE_SCENE_GEO | ✔ — cx/cy·goal*·area*·penalty*·centerMark·surface로 신규 7장면 전부 커버(터치라인 y=surface.y0) |
| 5 | NavTarget 파급 | 참조처 3곳뿐(useAppHistory.ts:32, routes.ts:54·88). useAppHistory.test 왕복 배열은 수동 — topic 케이스 손으로 추가 |
| 6 | 헤더 부제 | 동적 발행 구조는 있으나(board/present 선례) 정적 config와 동시 사용 불가 + wiring 테스트('경기 규칙') 파손 → **정적 유지, 주제 제목은 문서 상단에** |
| 7 | 아이콘 재고 | 60여 개 보유. 8카드 후보: IconBoard/IconListSteps/IconSides/IconGoalReset/IconToolPlayer/IconClear/IconToolBall/IconRules — 신규 제작 0~2개 |
| 8 | restartTargets | 유효(화면 이동+start만). **함정**: start()는 재시도 없는 1회 querySelector — 상세 뷰에서 재시작 시 무음 no-op → 핸들러가 홈 복귀 후 rAF 한두 틱 뒤 start() |
| 9 | tutorialsSeen | 앵커는 저장 안 됨 — 스텝 개편해도 무사고. `rules:true` 기기는 자동 재노출 없음 → **키 유지 결정**(화면이 어제 랜딩돼 시청 기기가 사실상 기현님 기기뿐, 도움말 [투어 다시 보기]로 충분) |

### 신규 파일
- `src/features/rules/ruleTopics.ts` — 8주제 데이터(§1 모델). 카드 아이콘은 데이터에 JSX 금지 — 화면 쪽 `Record<RuleTopicKey, ComponentType>`(RuleFigure 디스패처 패턴, 누락=컴파일 오류).
- `src/features/rules/restartTable.ts` — `RestartColumn{key, label, sceneId, cells{when,ball,distance,directGoal,notes}}` 7열 + 행 라벨 5. sceneId는 기존 set-piece 장면 7개와 1:1.
- `src/features/rules/RulesHome.tsx` — 카드 그리드(stagger, `data-tut` 앵커 보유). props `{topics, onOpen}`.
- `src/features/rules/RuleTopicDoc.tsx` — 전폭 상세(←뒤로·blocks 순회·이전/다음). 활성 sceneId 단일 출처.
- `src/features/rules/RuleSceneBlock.tsx` — §3 구조. **PlaybackProvider 마운트가 RulesScreen→이 파일로 이동**(유일 마운트 파일).
- `src/features/rules/RestartTableBlock.tsx` — 표(wide)/카드 접기(narrow, `useIsNarrow` 재사용·신규 breakpoint 금지) + 아래 RuleSceneBlock 1개(`key={sceneId}` 교체).
- `src/features/rules/figures/DistanceFigure.tsx` — 5m/3m 동심원 개념도(`PowerchairSide` 재사용), `figures/ids.ts`에 `'distance'` 추가.
- `src/features/rules/ruleTopics.test.ts` — 신규 불변식(아래).

### 수정 파일
- `RulesScreen.tsx` 재작성 — 홈/상세 뷰 + topic prop 수용 + 튜토리얼/도움말 배선(재시작=홈 복귀+rAF 후 start).
- `ruleContent.ts` — 부록 압축(조항당 2~3줄). **CORE_FACTS 12개 문자열 보존이 원고 제약**. `figureId`/`sceneId` 필드는 유지(RuleFigure.test의 law1/2/4 매핑 보존).
- `ruleScenes.ts` — 신규 7장면 + SCENE_META(ring/defense/cutSteps) + RULE_SCENE_IDS 21.
- `tutorialSteps.ts` — 앵커 3개 전부 홈 요소로(`rules-home` 그리드 / `rules-card` 첫 카드 / `rules-appendix` 부록 카드) — autoStart의 allFound 조건 충족. dict 키는 기존 `tutorial.rules.step*` 재사용(문구만 3언어 교체 — 키 불변이라 타입 안전).
- `useAppHistory.ts` — `{kind:'rule'; topic:string}`. `routes.ts` — pathFor `/rules/${topic}`, parsePath에서 `law-(\d+)` → `{topic:'rulebook'}` 관용 매핑(그 외 세그먼트는 topic 그대로 — 미지 키는 화면이 홈 폴백, routes는 features 미import 유지).
- `AppShell.tsx` — `ruleTopicFromNav` 변환기(기존 3형제 옆) + `<RulesScreen topic={...} nav={homeNav}>`. 헤더 정적 유지.
- `src/features/home/nav.ts` — `openRuleTopic(key)` 추가 → `go('rules', {kind:'rule', topic})` — **선택 시 URL 동기화 결함의 최종 수리 지점**.
- `playbackLoopPref.test.tsx` — MOUNTS의 rules 항목을 `RuleSceneBlock.tsx`로 교체.
- `src/i18n/{ko,en,ja}.ts` — 신규 UI 라벨(뒤로·이전/다음·재생/포스터 aria·표 열 선택 aria)은 3파일 원자 추가(`Record<DictKey,string>` 컴파일 강제), 기존 키는 문구만 갱신.
- `screens.ts` — `SCREEN_SUBTITLES.rules` 문구를 주제형으로 3언어 갱신(테스트는 truthy만 봐서 **잊기 쉬움 — 명시 항목**).

### 테스트 이행 표
| 테스트 | 처치 |
|---|---|
| `rulesDocTruth.test.ts` | **무변** — 압축 원고가 CORE_FACTS를 보존하는 것이 작성 제약(조항별 배정 체크리스트를 쓰고 시작) |
| `ruleScenes.test.ts` | IDS 21 · 3m 화이트리스트를 집합 상수로 확장(two-on-one 계열 5 + set-ball) · 5m 7종/cut≠0/28x15 단언 유지 |
| `RulesScreen.test.tsx` | 전면 재작성: 8카드 전수 → 카드→상세+뒤로 → 이전/다음 → 부록 압축 행 전수 → 단일 활성 규율(A 재생 중 B 재생→A 포스터 복귀) |
| `RuleFigure.test.tsx` | 유지 + `'distance'`는 it.each 대조군에 자동 편입 |
| `AppShell.wiring.test.tsx` | RulesScreen 목이 topic prop 렌더 + 딥링크 2케이스(`/rules/two-on-one` 직행, `/rules/law-3`→부록 관용) + 기존 `/rules` 유지 |
| `useAppHistory.test.ts` | 왕복 배열에 topic 케이스 추가. **law-N 관용은 왕복 불가 — 단방향 it로 격리** |
| `playbackLoopPref.test.tsx` | MOUNTS 파일 교체(대조군이 자가 검증) |
| `screens.test.ts` · `PresentStage.rules.test.tsx` | 무변 |

신규: `ruleTopics.test.ts` — 주제 8·키 유일 · blocks의 sceneId/figureId 실존 · **21장면 전부 최소 1주제 배치(고아 방지 대조군)** · 표 7열×5행 전칸 채움 · 표 sceneId 실존. `RestartTableBlock` — 열 선택→장면 교체, narrow 카드 접기.

### 커밋 슬라이스 (각 커밋 후 typecheck+test green)
1. `docs:` PLAN-RULES-REDESIGN.md + RULES-FIPFA-2025.md 보강(세트볼 절차·회전킥·투터치 PK/코너 원문 재확인)
2. `feat(rules):` **scenes-21** — 신규 7장면 + ruleScenes.test 갱신을 한 커밋(14 고정 단언과 신규 데이터의 유일한 원자 지점. 화면은 기존 14개만 참조 중이라 무영향)
3. `feat(rules):` **topics-data** — ruleTopics.ts + restartTable.ts + DistanceFigure(정적) + ruleTopics.test (소비자 없음 — 자명 green. 21개 sceneId 참조라 2 다음)
4. `feat(rules):` **screen-swap** — RulesHome/RuleTopicDoc/RuleSceneBlock/RestartTableBlock + RulesScreen 재작성 + 카드 리스트 블록 + tutorialSteps + i18n + **RulesScreen.test 교체 + MOUNTS 갱신 + 단일 활성·표 테스트**. 옛 테스트·새 구조 공존 불가 지점을 전부 이 커밋에 집약. 부록은 아직 기존 상세를 lawDigest로 렌더 → rulesDocTruth·RuleFigure.test 무변 green. topic은 내부 useState(URL 아직 /rules) → 라우팅 테스트 무변
5. `feat(rules):` **appendix-compress** — ruleContent 압축(rulesDocTruth가 감시자)
6. `feat(rules):` **deeplink** — useAppHistory/routes/AppShell/nav.ts + 테스트. 4의 내부 상태를 URL 파생으로 승격(순서 근거: 4가 prop 없이 자립하므로 중간 커밋 전부 동작 상태)
7. `feat(rules):` **motion** — stagger·주제 전환·표 하이라이트·포스터 crossfade·cut 펄스·distance draw-in. CSS transition/animation으로 쓰면 reduced-motion 두 채널(`:root[data-reduce-motion]` + prefers)이 공짜 적용, JS 구동분만 `effectiveReduceMotion` 게이트
8. `docs:` README·REQUIREMENTS §7.1·DESIGN §6.12 재서술·CHANGELOG·FIELD-TEST·ROADMAP(퀴즈 후보 기록)

### 리스크/함정 (구현 시 체크리스트)
1. CORE_FACTS 유실 — '20분'·'50.8cm'·'10km/h'·'33cm'·'13인치'·'22cm'가 압축에서 탈락하기 쉬움 → 원고 전 조항별 배정표 작성.
2. i18n — 신규 키는 3파일 원자, 기존 키 재사용 우선.
3. 튜토리얼 — 앵커 3개 전부 홈 + 재시작 핸들러 홈 복귀+rAF(안 하면 "다시 보기 눌렀는데 무반응" 버그).
4. MOUNTS — Provider 마운트는 RuleSceneBlock.tsx 한 곳만(RestartTableBlock에서 또 세우면 즉시 실패).
5. `initialLoop={prefs.loop}` 리터럴 유지(소스 문자열 검사) — 변수 경유 금지.
6. 동시 마운트 비용 — 포스터도 PresentStage 풀 마운트. 홈 카드에는 스테이지 금지(아이콘·텍스트만), 최다 주제는 2-on-1의 5장면이 상한.
7. 포스터 정착 프레임 — seekToken 트릭 이관 필수.
8. `/rules/garbage` → 홈 폴백은 의도된 단순화(404 없는 기존 교리) — 주석 명기.
9. SCREEN_SUBTITLES.rules 갱신 잊기 쉬움(테스트 미강제).

푸시는 지시 시에만(관례). 실기 검증: 카드 홈 그리드 반응형·stagger, 표 narrow 접기, 단일 활성 전환, 딥링크 새로고침(`/rules/two-on-one`·`/rules/law-3` 관용), 튜토리얼 재시작 — 100.75.15.13:5173.
