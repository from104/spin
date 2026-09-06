# PLAN — 첫 실행 기본 드릴 = 규칙 화면 장면 (2026-09-06)

기현님 지시(2026-09-06, 원문): *"첫 실행시 기본 저장되어있는 드릴을 규칙에 있는 드릴로 교체 (앞으로 쭉 그 정책 유지"*

이 문서는 이 정책의 **정본 계획서**다. 상위 정본은 `AGENTS.md` §5(시연 콘텐츠는 편집기로) — 이 정책은 그 절의 연장이며
랜딩 커밋에서 §5 에 한 문단으로 박는다. 폐기되는 것: 손코딩 시드 3벌(`src/model/seedDrillContent.ts`, `docs/SEED-DRILLS-DRAFT.md`
"승인 대기" 초안). 옛 근거(스텝 메모로 조작법을 읽어 주는 온보딩 내레이션, `seedDrillContent.ts:9-16`)는 **잃는다** — 규칙
장면 19벌은 메모가 비어 있다. 그 장치가 다시 필요하면 장면 메모를 **편집기에서** 채워 재임포트한다(손코딩 금지는 그대로).

## 0. 한 줄 원칙

**첫 실행에 심는 드릴의 정본은 규칙 화면의 장면 목록(`RULE_SCENE_IDS`) 하나다.** 규칙에 장면을 넣으면 시드에도 들어가고,
빼면 시드에서도 빠진다. 시드 전용 드릴 목록·시드 전용 손코딩은 앞으로 없다.

## 1. 결정 (기본값 — 뒤집기 쉽게 근거와 함께)

| # | 결정 | 근거 |
|---|---|---|
| 1 | 시드 = `RULE_SCENE_IDS` **22벌 전부**(raw 19 + SeedDrillSpec 갈래 3), 순서는 규칙 카드 순서(`ruleTopics.ts` 배열 → 카드 안 장면 순 → 재개표 7종 순) | 지시가 "규칙에 있는 드릴". 큐레이션(초·중·고급 진행)은 정책상 사라진다 — 큐레이션이 필요하면 규칙 화면 쪽에서 정한다 |
| 2 | 드릴 문서는 `buildRuleScene(id, locale)` 결과를 그대로 심는다(팀 라벨만 로케일, 메모·쪽지는 한국어 고정 — 기존 시드도 같았다) | 두 번째 변환 경로를 만들지 않는다(§3 정본 하나) |
| 3 | **id 고정**: raw 갈래는 `.scene.ts` 리터럴 id 그대로, SeedDrillSpec 갈래 3벌은 고정 id 표(`dr_rule_fieldtour` 꼴, `isId(id,'dr')` 통과)로 | 기기마다 새 id 를 발급하면 동기화 뒤 기기 수만큼 사본이 생긴다(지금 시드의 알려진 결함). 같은 id 면 한 벌 |
| 4 | **시각 고정**: `createdAt`/`updatedAt` = `SEED_EPOCH − i·60s`(카드 순서 i, `SEED_EPOCH` = 2026-09-06T00:00:00Z 상수). `putDrill(touch:false)` 유지 | 동기화는 LWW(`sync/plan.ts`) — 한 기기에서 고친 드릴은 시각이 새로워 **항상** 다른 기기의 미편집 시드를 이긴다(정보 유실 없음). 지운 것(톰스톤)도 시드보다 새로워 되살아나지 않는다. 시각을 카드 순으로 내리면 목록(최신순)이 카드 순서가 된다 |
| 5 | 자물쇠①(`prefs.seeded`) 그대로, 자물쇠② 는 제목 중복 → **id 존재** 검사로 | id 가 고정이니 제목보다 정확하다. 제목은 사용자가 바꿀 수 있다 |
| 6 | 기존 기기(이미 `seeded`)에는 **소급하지 않는다**. 옛 손코딩 시드 3벌은 그 기기에 남는다 | 지시가 "첫 실행시". 재시드 장치는 만들지 않는다 |
| 7 | 시드 제목 = 규칙 화면이 그 장면에 붙이는 **캡션**(있으면 로케일판)을 "카드번호 제목" 꼴로; 캡션이 없으면 raw 제목 그대로 | raw 제목은 편집기 내부 명명(`5-1 2-on- 1  반칙 1` 오타 포함)이라 목록에 그대로 낼 수 없다. `.scene.ts` 는 손대지 않는다(`--check` 계약) — 제목은 심는 순간 씌운다. 캡션 표가 이미 `ruleContent`/`ruleTopics` 에 있으면 그것이 정본, 없으면 만들지 말고 raw 제목 |
| 8 | 폐기: `seedDrillContent.ts`(3벌) · `docs/SEED-DRILLS-DRAFT.md` · `seedDrills.test.ts` 의 **콘텐츠 계약** 테스트(온보딩 대본 2도막·초중고 하나씩·카테고리) — 변환기(`buildSeedDrill`)와 그 테스트는 규칙 (1)갈래가 쓰므로 남는다 | 정책이 죽인 것은 "손코딩 시드 본문" 이지 변환기가 아니다(AGENTS.md §9: 호출자 0 이라고 다 지우지 않는다 — 여기선 호출자가 있다) |
| 9 | `FALSIFICATION-BASELINE.md` 의 시드 반증선(2440~) 중 "SeedDrillSpec 문구 교체" 전제 항목은 ⚠️ 2026-09-06 로 뒤집고, 왕복 동일성·코트 밖·겹침 같은 **형식** 반증선은 규칙 장면 22벌에 그대로 건다 | 반증선의 뜻(심은 것이 온전한가)은 살아 있다 |

## 2. 손대는 곳

`src/features/rules/ruleScenes.ts`(`seedRuleDrills(locale): Drill[]` — 카드 순서·고정 id·고정 시각·캡션 제목; `RULE_SCENE_IDS` 는
그대로 정본) → `src/model/seedDrills.ts`(`buildSeedDrills` 제거 또는 규칙 위임, `buildSeedDrill` 변환기 존치) →
`src/model/seedDrillContent.ts` 삭제 → `src/storage/seed.ts`(자물쇠②, 문서 출처) → `src/app/App.tsx`(호출부) →
테스트: `seedDrills.test.ts`(콘텐츠 계약 삭제·변환기 유지), `storage/seed.test.ts`, `App.seed.test.tsx`(22벌·id 고정·시각·두 번 심어도 한 벌) →
문서: `AGENTS.md` §5 문단, `docs/SEED-DRILLS-DRAFT.md` 삭제, `FALSIFICATION-BASELINE.md`, `CHANGELOG` 3벌.

## 3. 착수 순서

1. 구현(한 사람: 위 파일이 서로 얽힌다) ∥ 2. 문서(AGENTS §5·FALSIFICATION·CHANGELOG) → 3. 검수 → 4. 실기.

## 4. 실기 확인(jsdom 이 못 재는 것)

- 새 프로필(localStorage 비움)로 첫 실행 → 목록에 22벌이 카드 순서로, 제목이 캡션인지, 각각 열려 시연되는지.
- 두 기기 첫 실행 뒤 동기화 → 사본 없이 22벌, 한쪽에서 고친 것이 이기는지, 지운 것이 되살아나지 않는지.
- 규칙 화면은 한 픽셀도 안 바뀌어야 한다(장면 소비 경로는 그대로).

## 5. 구현 결과·검수 (2026-09-06)

구현·문서·검수 세 에이전트가 병렬로 일했고, 검수가 마지막 관문이었다. 커밋은 아직 없다(커밋 담당 몫 —
`docs/PLAN-SEED-FROM-RULES.md` 는 미추적이고 `seedDrillContent.ts`·`SEED-DRILLS-DRAFT.md` 삭제만 인덱스에 올라 있다).

### 5.1 관문 숫자

| 관문 | 결과 |
|---|---|
| `npm run typecheck` | 0 |
| `npm run lint` | 경고 48 = HEAD 48(새 경고 0, 건드린 파일에 0) |
| `npx vitest run` 전체 | 288 파일 3733 통과, 74s, 단일 회차 |
| 돌연변이(검수가 직접) | 5건 전부 빨간불 — 아래 5.2 ① 참조 |
| 헤드리스(빈 프로필, 5199 포트, CDP) | 첫 실행 `/drills` 에 **22벌**, 전부 `초급` 한 묶음, 맨 위 *"제1조 — 필드 규격"*(카드 1). 재적재 후 22벌 그대로(사본 0), `prefs.seeded=true`, IDB 키에 `dr_rule_field_tour`·`dr_rule_lineup`·`dr_rule_two_on_one_open` + 봉투 id 19벌 |

### 5.2 검수가 고친 것

① **시각 단언이 자기증명이었다.** `SEED_EPOCH` 상수 자체를 `Date.now()` 로 바꾼 돌연변이가 ruleScenes·seed·App.seed
186 케이스를 **전부 통과**했다 — 테스트가 모듈의 `SEED_EPOCH` 를 가져다 `SEED_EPOCH − i·60s` 와 비교하니 그 값이 기계
시계여도 자기와 같다(구현 보고의 "돌연변이 6" 은 상수가 아니라 사용처를 바꾼 것으로 보인다). 계획서 결정 4 가 못 박은 날짜를
모듈과 무관하게 `expect(SEED_EPOCH).toBe(Date.UTC(2026, 8, 6))` 로 핀했다(`ruleScenes.test.ts`, 고정 id 리터럴 핀과 같은
논리). 핀 뒤 같은 돌연변이가 1 실패로 잡힌다. 나머지 돌연변이: lineup 고정 id 제거 → 3 실패 / 자물쇠② 삭제 → 3 실패 /
순서 `reverse()` → 1 실패 / `touch:true` → 2 실패. 전건 원복 후 186 초록 재확인.

② `docs/DESIGN.md` §규칙 화면의 "**21개** 장면 데이터" 옆에 2026-09-06 현재 22개(정본 `RULE_SCENE_IDS`) 를 병기했다
(문서 담당의 blocker ③).

### 5.3 계획과 다른 것 · 확인한 것

- **결정 7 은 "raw 제목" 갈래로 랜딩.** `ruleTopics.ts` 의 scene 블록은 `{ kind:'scene'; sceneId }` 뿐이라 장면별 캡션 표가
  코드에 없다 — 계획서의 "없으면 만들지 말고 raw" 대로. 목록에는 `5-1 2-on- 1  반칙 1` 같은 편집기 원본 제목이 그대로
  뜬다(헤드리스에서 실측). 거슬리면 `.scene.ts` 재임포트(`--title`)로 고친다(§5 라인).
- **왕복 동일성 반증선은 `repairs 0` + 봉투 보존**으로 걸렸다. 편집기 좌표의 긴 소수를 `validateDrill` 이 0.1 단위로 비파괴
  반올림해 3벌은 `toEqual` 이 애초에 성립하지 않는다(구현 실측, 테스트 주석에 기록). FALSIFICATION §3 표의 "왕복 동일성" 은
  이 뜻으로 읽어야 한다.
- **목록이 카드 순서로 보이는 것은 22벌이 전부 `초급`이라서다.** `LibraryScreen` 은 난이도 그룹(초→중→고)으로 먼저 나누고
  그 안에서 `updatedAt` 내림차순이다. 나중에 어떤 장면의 `level` 이 `중급` 이 되면 그 벌은 다른 묶음으로 내려가 카드 순서가
  깨진다 — 시드가 아니라 목록 화면의 기존 정책이므로 여기서 고치지 않았다.
- 동기화 동률: 두 기기가 같은 id·같은 시각으로 심으면 `sync/plan.ts` 는 `L === R` 로 부기만 한다(먼저 올린 쪽이 원격,
  뒤쪽은 로컬 유지 · 밀고 당기기 없음). 기기 간에 다를 수 있는 것은 (1) 갈래 3벌의 내부 id(체어·스텝, `buildSeedDrill` 이
  `newId`)와 로케일별 팀 라벨뿐이고 문서 단위 LWW 라 사본은 안 생긴다.
- `storage/seed.ts` → `features/rules/ruleScenes.ts` import 는 storage 층에서 features 로 향하는 첫 의존이다(머리말에 근거).
  값 순환 없음 — `ruleTopics.ts`·`restartTable.ts` 는 `ruleScenes.ts` 에서 타입만 가져온다.
- 규칙 화면 소비 경로 미변경: `git status` 에 `features/rules/` 는 `ruleScenes.ts`·`.test.ts` 둘뿐(`RuleSceneBlock`·`RulesScreen`
  ·`ruleTopics`·`restartTable` 무변경).

### 5.4 남은 실기(jsdom·헤드리스가 못 재는 것)

- 태블릿 새 프로필 첫 실행: 22벌 각각이 열려 시연되는지, 원본 제목이 목록에서 읽히는지(오타 포함 그대로다).
- 두 기기 첫 실행 뒤 동기화: 사본 0 / 한쪽 편집이 이기는지 / 지운 것이 안 되살아나는지(헤드리스는 1기기만 봤다).
- 규칙 화면이 한 픽셀도 안 바뀌었는지(코드상 소비 경로 무변경, 눈으로만 확정).
- `/en/…` 첫 방문에서 팀 라벨이 영어로 심기는지(`localeRef` 경로, 헤드리스는 ko 만 봤다).
