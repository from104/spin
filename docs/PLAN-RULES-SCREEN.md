# 규칙 화면 계획 (2026-08-21 확정)

> 기현님 지시: *"왼쪽바 설정과 세션 사이에 '규칙'이라는 아이콘을 넣어서 파워체어풋볼의
> 규칙 전반에 걸쳐 보드를 이용한 애니메이션할 수 있는 화면을 만드는 계획을 정말 디테일하게
> 작성. 먼저 최신 룰 문서화 md로."*
>
> 콘텐츠 언어는 한국어 먼저(en/ja는 구조만), 장면은 전 조항으로 확장, 탐색 구조는
> 목록형+장면재생 — 2026-08-21 확인.
>
> 이 문서가 구현의 정본이다. 규칙 조문 자체의 정본은 [`RULES-FIPFA-2025.md`](./RULES-FIPFA-2025.md).

## 배경

로드맵 "버전 미정 — 새 기능 후보"에 이미 있던 항목(ROADMAP.md, 2026-08-21 제안: *"보드를
이용한 움직이는 규칙 설명 화면 — 전술판 엔진(물리·재생·보간)을 재사용해 2-on-1·골지역
3인·세트피스 5m 같은 규칙을…"*)을 실행한다. 조사 결과, 로드맵 문구의 "물리"는 재검토
대상이다 — 시연(present) 경로는 물리 엔진(matter-js) 없이 순수 보간(`sampleDrill`)만으로
동작하고, 규칙 화면도 이 경로를 그대로 쓴다(§C 참조).

## A. 화면 등록 (뼈대)

새 화면 키 **`rules`**, 경로 **`/rules`** + 딥링크 **`/rules/law-N`**(N=1~18). 레일 순서는
**보드 · 드릴 · 세션 · 규칙 · 설정**(세션과 설정 사이).

| 파일 | 변경 |
|---|---|
| `src/app/screens.ts` | `Screen`에 `'rules'` 추가, `SCREEN_ORDER`(세션 다음), `RailKey`+`RAIL_ITEMS`를 `['board','drills','sessions','rules','settings']`로, `SCREEN_TO_RAIL.rules='rules'`, `SCREEN_NAV_LABELS`/`SCREEN_TITLES`/`SCREEN_SUBTITLES` 3언어×3표(ko '규칙'/en 'Rules'/ja 'ルール'; 부제: 파워체어풋볼 규칙을 보드 애니메이션으로 익힌다는 취지) |
| `src/app/routes.ts` | `pathFor` case(`'rules'`→`/rules`, target 있으면 `/rules/law-11`), `parsePath` 세그먼트 매칭, 머리말 경로 표 갱신. `useAppHistory.ts`의 `NavTarget`에 `{kind:'rule', law: number}` 추가 |
| `src/app/navChrome.ts` | `RAIL_ICONS.rules = IconRules`, `RAIL_NAV_TARGETS.rules = undefined` |
| `src/ui/icons.tsx` | `IconRules` 신규 — 호루라기 모티프, `size=19` 기본값, 기존 스트로크 스타일 준수 |
| `src/app/AppShell.tsx` | import, `renderScreen` case, `useStaticHeaderConfig`에 rules 정적 헤더(title/subtitle) 추가, 딥링크 대상 파생(`ruleFromNav`) |
| `src/app/announce.ts` + `src/i18n/{ko,en,ja}.ts` | `app.announce.rules` 키 3벌 + switch case |
| `src/features/rules/RulesScreen.tsx` | 신규 — `<main id="main" tabIndex={-1}>` 관례(SessionsScreen.tsx 스타일) |

라우터(`App.tsx`)는 splat 단일 라우트라 **손대지 않는다** — 매칭은 전부 `pathFor`/`parsePath`가
진다.

## B. 콘텐츠 모델

`src/features/rules/` 신규 파일 2개.

### `ruleContent.ts` — 조항 텍스트의 단일 출처

```ts
interface RuleLaw {
  law: number;                 // 1~18
  key: string;                 // 'field' | 'ball' | ... (딥링크·테스트 식별용)
  group: 'basics' | 'play' | 'restarts' | 'officials';
  title: string;                // '제1조 — 필드'
  summary: string[];            // 요약 문단(불릿) — RULES-FIPFA-2025.md 에서 발췌
  sceneId?: RuleSceneId;        // 장면 있는 조항만
}
export function ruleContentFor(locale: Locale): readonly RuleLaw[];
// 지금은 모든 로케일이 ko 배열을 반환한다. en/ja 확장 시 이 함수만 분기하면
// 되고 화면 코드는 바뀌지 않는다.
```

그룹: 기본(1~4) · 경기 진행(7~11) · 반칙·재시작(12~17) · 심판·분류(5·6·18).

### `ruleScenes.ts` — 장면 데이터

`SeedDrillSpec` 패턴(`src/model/seedDrills.ts`)을 그대로 차용하되 rules 전용 빌더로 감싼다.
드릴 문서를 손으로 적으면 cast 참조 누락 등이 조용히 유실되므로(`seedDrills.ts` 머리말의
근거와 동일), 반드시 이 변환기를 거친다.

```ts
export type RuleSceneId =
  | 'field-tour' | 'lineup' | 'kickoff' | 'inout' | 'scoring'
  | 'two-on-one' | 'three-in-area' | 'ramming'
  | 'dfk' | 'ifk' | 'penalty' | 'kick-in' | 'goal-kick' | 'corner';

export function buildRuleScene(id: RuleSceneId): Drill;  // 내부에서 buildSeedDrill 재사용
```

- `buildSeedDrill(spec, createdAt)`은 고정 `createdAt`을 받으므로 임의 타임스탬프로 호출
  (장면은 저장하지 않으니 값 자체는 무의미).
- 장면 코트: `courtMode:'full'`, `courtSize:'28x15'`(FIPFA 기본 규격, RULES-FIPFA-2025.md
  Law 1).
- 스텝별 해설은 `DrillStep.note`(≤600자)에, 거리 표기는 `notes`(NoteLabel)·`arrows`로.
- `cut: true`로 "위반 장면 → (컷) → 올바른 장면" 리셋 점프를 표현.
- `BallDef.ring: '3m'|'5m'`로 2-on-1의 3m 판정선, 리스타트 5m 후퇴선을 시각화.
- `situation` 필드는 기존 `DrillSituation` 값(`'kick-off'`·`'kick-in'`·`'2-on-1-spacing'` 등)에
  매핑.

### 장면 목록 (14개)

| # | sceneId | Law | 내용 |
|---|---|---|---|
| 1 | field-tour | 1 | 정지 1스텝 도해 — 골에어리어 8×5m·페널티 마크 3.5m·골대 6m·코너 트라이앵글·1m 침범 마크를 NoteLabel·화살표로 표기 |
| 2 | lineup | 3 | 4v4+GK 기본 배치(정지) |
| 3 | kickoff | 8 | 배치(자기 진영·상대 5m 링) → 킥 → 직접 득점 인정 |
| 4 | inout | 9 | 볼이 라인에 걸친 상태(인) vs 전체 통과(아웃) 대비 |
| 5 | scoring | 10 | 볼 전체가 굴러 골라인 통과(득점) vs 일부만 걸침(노골) |
| 6 | two-on-one | 11 | 3m 링 안 2+1 위반 → 간접FK → (컷) 한 명이 빠져 합법이 되는 장면 |
| 7 | three-in-area | 11 | 자기 에어리어 3인 진입 → 간접FK |
| 8 | ramming | 12 | 과도한 힘의 램핑 → 직접FK(충돌은 보간 연출 — 물리 불사용) |
| 9 | dfk | 13 | 직접FK — 상대 5m 링, 직접 득점 |
| 10 | ifk | 13 | 간접FK — 주심 시그널 표현(NoteLabel), 터치 경유 득점 vs 직접(골킥) |
| 11 | penalty | 14 | 배치 규정(마크 3.5m·GK 골라인 뒤 정지·나머지 마크 뒤 5m) → 킥 |
| 12 | kick-in | 15 | 터치라인 지점·5m 후퇴 → 직접 득점 |
| 13 | goal-kick | 16 | 에어리어 안 임의 지점 → 에어리어 밖으로 나가야 인플레이(위반 재킥 대비 컷) |
| 14 | corner | 17 | 트라이앵글 배치·에어리어 밖 5m·안쪽 1m 마크 뒤 → 킥 |

텍스트 전용(장면 없음): Law 2·4·5·6·7·12(카드 규정 자체)·18.

## C. 재생 조립 (RulesScreen 본체)

목록형+장면재생, 마스터-디테일 레이아웃.

```tsx
// 넓은 창: 좌측 조항 목록(그룹 헤더 + 18행) | 우측 디테일
// 좁은 창(useIsNarrow): 목록 ↔ 디테일 2뷰 전환(뒤로가기)
<PlaybackProvider initialSpeed={1} initialLoop>
  <PresentStage drill={scene} showRuleZones reduceMotion={rm}
                seekToken={tok} onStepChange={setStepIdx} />
  {/* 스텝 해설 띠: PresentRunner.tsx 의 노트띠 마크업 차용,
      PRESENT_NOTE_BAND_PX 고정 높이 규율 유지(스텝 전환 시 코트가 밀리지 않게) */}
  <PlaybackControls playing={...} canPlay={...} onTogglePlay={...} ... />
</PlaybackProvider>
```

- 디테일 상단: 조항 제목 + `summary` 문단(스크롤). 장면이 있으면 그 아래 보드.
- `PresentStage`는 `SettingsProvider` 컨텍스트가 필요하다(prefs 구독) — AppShell 안이므로
  자동 충족된다. `className="stage-svg"`는 장식이 아니라 Windows 고대비 모드 제외 갈고리이므로
  반드시 유지한다(`src/styles/contrast.test.tsx`가 코트를 그리는 모든 SVG 루트를 이 클래스
  기준으로 훑는다).
- 정지 도해 장면(1스텝뿐인 장면)은 재생 컨트롤을 숨기고 볼 링·노트만 표시.
- 조항을 고르면 URL을 `/rules/law-N`으로 동기화(`nav.go('rules', {kind:'rule', law})`) —
  새로고침·공유 가능한 딥링크.
- 섹션 패널 스타일은 `SettingsScreen.tsx`의 관례(테두리·radius·배경)를 차용.

이 조립이 성립함은 이미 `PresentStage.rules.test.tsx`가 증명한다 — `PresentStage` +
`PlaybackProvider` + `SettingsProvider`만으로, 저장소 없이 인메모리 `Drill` 리터럴을 직접
마운트할 수 있다.

## D. 도움말·튜토리얼 연동

- `HelpSectionKey`(`src/ui/help/helpSections.ts`)에 `'rules'` 추가, `HELP_SECTION_ORDER`·
  `HELP_SECTION_LABEL_KEY`·`HELP_NARRATIVE_SECTIONS`에 항목 추가 + `help.section.rules`·
  `help.rules.*` 사전 키 3언어.
- `TutorialScreenKey`(`src/storage/prefs.ts`의 `TUTORIAL_SCREEN_KEYS`)에 `'rules'` 추가 —
  기존 `tutorialsSeen` 맵에 선택 필드를 더하는 것뿐이라 **스키마 버전은 그대로**(필드
  추가가 아니라 기존 옵셔널 맵의 새 키 — 부재 시 "미시청"으로 자연 해석됨을 확인 후 진행).
- `src/features/rules/tutorialSteps.ts` — 3단계(목록 → 보드 재생 → 해설 띠), `data-tut`
  속성 부착. `usePublishHelpShow` 배선은 `SettingsScreen.tsx`의 관례를 따른다.
- HelpCenter의 `'start'` 섹션에 규칙 화면을 안내하는 한 줄만 추가(화면 간 이동 링크는 두지
  않는다 — 기존 도움말은 산문·용어집 구조를 유지).

## E. 테스트

### 갱신 (하드코딩 대조표가 있는 기존 테스트)

- `src/app/screens.test.ts` — EXPECTED 배열·개수(5→6), RAIL_ITEMS(4→5)
- `src/test/docsMatchCode.test.ts` + `docs/REQUIREMENTS.md` §7.1 — "5개"→"6개",
  "4개"→"5개", `rules`(규칙) 라벨 추가
- `src/app/AppShell.wiring.test.tsx` — SCREEN_TESTIDS에 `'screen-rules'`, RAIL_LABELS에
  `'규칙'`, RulesScreen mock, renderScreen/레일 활성/URL 왕복/발표/정적 헤더/좁은 창 각 describe
- `src/app/useAppHistory.test.ts` — `/rules`·`/rules/law-11` 왕복 항등(SCREEN_ORDER 전수
  대조는 자동 확장)
- `src/app/AppRail.test.tsx` · `AppNavSegment.test.tsx` — '규칙' 라벨
- `src/app/announce.test.ts` — rules 발표문

### 신규

- `src/features/rules/ruleScenes.test.ts` — ① 14개 장면 전부 `validateDrill` 통과(저장
  왕복 불변) ② 각 `RuleLaw.sceneId`가 실존 장면을 가리킴 ③ 장면 코트가 `'28x15'`
- `src/features/rules/RulesScreen.test.tsx` — 목록 18행 렌더, 조항 선택 → 요약 표시,
  장면 있는 조항 선택 → 스테이지 마운트(`PresentStage.rules.test.tsx` 패턴), 좁은 창 2뷰 전환
- `src/features/rules/rulesDocTruth.test.ts`(`docsMatchCode` 스타일) — `RULES-FIPFA-2025.md`의
  핵심 수치(3m·5m·3.5m·8m·5m깊이·6m·10km/h·50.8cm·20분)가 `ruleContent.ts` 요약과 어긋나지
  않음을 문자열 대조로 고정

## F. 문서 갱신

- `README.md` — "화면은 다섯" → 여섯, `### 규칙` 소절 추가. (겸사겸사) 상태 배지가 이번
  0.5.0 범프 이후 갱신되지 않은 채 남아 있으면 함께 정정.
- `docs/REQUIREMENTS.md` §7.1 표 — 테스트가 강제.
- `docs/DESIGN.md` — 규칙 화면 절 추가(시연 경로 재사용·물리 미사용 근거 명시).
- `CHANGELOG.md` `[Unreleased]` "추가됨".
- `ROADMAP.md` — "버전 미정 — 새 기능 후보"의 해당 항목을 이행 완료로 표기.
- `docs/FIELD-TEST.md` — 규칙 화면 실기 확인 행 추가.

## 커밋 순서

각 커밋 전 `typecheck` + 관련 `test:rel` green 확인.

1. `docs: FIPFA 2025 규칙 정본 문서 + 규칙 화면 계획서`(RULES-FIPFA-2025.md,
   PLAN-RULES-SCREEN.md)
2. `feat(rules): 화면 등록 뼈대` — screens/routes/icon/AppShell/announce + 빈 RulesScreen +
   등록 테스트 일괄 갱신
3. `feat(rules): 조항 텍스트 콘텐츠(ko 18개조)` — ruleContent.ts + 목록/디테일 텍스트 UI +
   테스트
4. `feat(rules): 장면 데이터 1차` — 도해·리스타트 계열 8개(field-tour·lineup·kickoff·
   inout·scoring·dfk·kick-in·goal-kick) + validateDrill 테스트
5. `feat(rules): 장면 데이터 2차` — 판정 계열 6개(two-on-one·three-in-area·ramming·ifk·
   penalty·corner)
6. `feat(rules): 재생 조립` — PresentStage+해설 띠+PlaybackControls, 딥링크, 좁은 창
7. `feat(rules): 도움말 섹션·튜토리얼`
8. `docs: README·REQUIREMENTS·DESIGN·CHANGELOG·ROADMAP·FIELD-TEST 갱신`

푸시는 지시가 있을 때만(관례). 실기 검증 대상: 좁은 창 2뷰 전환, 보드 축척, 장면 재생
체감 속도 — 100.75.15.13:5173.

## 검증

- `npm run typecheck` — Screen 유니언 확장이 라벨 표 9칸·exhaustive switch 누락을 컴파일
  단계에서 잡아준다.
- `npm run test:rel <파일>` 수시 사용, 커밋 직전에만 `npm test` 전체(현재 3523 tests).
- `npm run build` — 번들에 matter-js가 rules 경로로 새로 끌려오지 않는지 확인(시연 경로만
  사용하므로 끌려오면 안 됨).
- 실기: 레일 순서(보드·드릴·세션·**규칙**·설정), `/rules/law-11` 새로고침 딥링크, 장면
  재생·컷 점프·3m/5m 링 표시.

## 비범위 (가져오지 않는 것)

- `src/physics/*`(matter-js) — 램핑 장면도 보간 연출로 충분하다.
- `CourtStage.tsx`(편집기 스테이지)·`store/editor/*`·`useStepPlayback` — 전부 편집 전용
  경로.
- `storage/drillRepo` — 장면은 인메모리로만 존재, 저장·동기화 대상이 아니다.
- en/ja 규칙 본문 번역(구조만 준비), 애니메이션 안에서의 규칙 위반 자동 판정(주심 역할
  대체 아님 — 어디까지나 설명용 시연).
