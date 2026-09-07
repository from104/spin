# PLAN — 스텝 연결 방식 셋: 끊김 · 딜레이 연결 · 딜레이 없는 연결 (2026-09-08)

기현님 지시(2026-09-08, 원문): *"드릴 편집에서 스텝을 연결하는 옵션을 '끊김, 딜레이 연결, 딜레이 없는 연결' 을 둬서 실질적인
애니메이션 수준의 원칙적으로 만들 수 있도록 구현해봐"*

이 문서가 정본 계획서다. 상위 정본은 `docs/PLAN-STEP-EDITING.md`(2026-08-17 스텝 사슬·`cut`) 와 `AGENTS.md`. 옛 결정은
뒤집지 않는다 — **셋 중 둘은 이미 있다**: 지금의 기본 연결(구간 앞 `transitionMs` 트윈 → 나머지 정지)이 곧 "딜레이 연결",
`cut` 이 "끊김". 새로 생기는 것은 **딜레이 없는 연결** 하나다.

## 0. 한 줄 원칙

**연결 방식은 "다음 스텝" 이 쥔다(`PLAN-STEP-EDITING` 의 교리 그대로), 저장은 예외만 싣는다.** 딜레이 없는 연결은 그 스텝의
트윈이 구간 전체를 차지해 정지 없이 다음 스텝의 트윈으로 넘어가는 것 — 그래서 여러 스텝을 이으면 키프레임 애니메이션이 된다.

## 1. 결정 (기본값 — 뒤집기 쉽게 근거와 함께)

| # | 결정 | 근거 |
|---|---|---|
| 1 | 저장: `DrillStep.seamless?: true` 를 `cut?: true` 옆에 더한다. 둘은 배타 — `validate` 가 둘 다 있으면 `cut` 을 남기고 `seamless` 를 버린다(끊김이 더 강한 뜻). 편집기는 `stepLink(step): 'cut'\|'seamless'\|'delay'` 로 읽고 `STEP_META` 패치로 쓴다(`delay` = 두 키 삭제) | `cut` 을 유니언으로 바꾸면 2026-08-17 이후 저장본 전부에 마이그레이션이 필요하고(=도장 상승), 규칙 장면 후처리도 바뀐다. 예외만 싣는 관행(`locked`·`ignored`·`cut`·`zOrder`)과 같은 결 |
| 2 | 스키마 도장 **안 올린다**(v11 유지) | `cut` 선례(`PLAN-STEP-EDITING` §…): 스텝의 정지 포즈는 같고 과정만 다르다 — 옛 앱은 딜레이 연결로 재생할 뿐 다른 그림을 그리지 않는다(②에 안 걸린다) |
| 3 | 재생(`sampleDrill`): `seamless` 스텝은 트윈 길이 = 그 스텝의 `durationMs` 전체(정지 0). 이징은 **연속 구간 단위**: 딜레이 없는 스텝이 연이어 k…m 이면 k 는 ease-in, 가운데는 선형, m 은 ease-out; 혼자면 지금의 `easeStandard`(in-out). `cut`·`delay` 스텝은 지금 그대로 | 스텝마다 in-out 을 걸면 키프레임마다 멈칫한다 — 애니메이션 도구가 하는 대로 구간 양끝만 가감속 |
| 4 | 등장(enter)·퇴장 개체의 페이드는 seamless 에서도 지금 규칙(트윈 앞부분)을 따른다 | 별도 결정을 만들 만큼 값이 없다 |
| 5 | 타임라인(`effectiveStepMs`·`stepStartsMs`·총 길이)은 **안 바뀐다** — seamless 는 구간 안에서 트윈을 어떻게 나누느냐만 바꾼다 | PresentRunner·RuleSceneBlock 이중 구현을 안 건드린다(조사 위험 1) |
| 6 | UI: `StepSidebar` 의 틈 버튼(`GapSlot`)을 **3상태 순환**으로 — 딜레이 연결(고리, muted) → 딜레이 없는 연결(이어진 고리 + 화살, accent) → 끊김(벌어진 고리, `#ff6b6b`) → …. `aria-pressed` 대신 `aria-label` 에 현재 상태와 다음 상태. `title` 도 같이 | 클릭 하나로 도는 것이 젓가락·터치에 맞다. 하위메뉴는 셋에 과하다 |
| 7 | 규칙 화면 `.rules-cut-pulse` 는 `cut` 전용 그대로. seamless 진입 신호 없음 | 이어지는 것이 곧 신호다 |
| 8 | 인쇄·PNG·썸네일 무관(정적 프레임) — 계획서에 명시만 | 조사 §4 |
| 9 | 규칙 장면 후처리(`ruleScenes.ts` 의 cut 인덱스)는 손대지 않는다. 장면에 seamless 를 쓰려면 편집기에서 만들어 재임포트 | AGENTS §5 |

## 2. 손대는 곳

`model/drill.ts`(`seamless` 필드 + 근거 주석, `cut` 주석에 3상태 언급) → `model/validate.ts`(배타 정화, `cut:false` 와 같은 꼴) →
`model/stepLink.ts`(신규: `StepLink`, `stepLink(step)`, `stepLinkPatch(link)`) → `model/playback.ts`(seamless 트윈·구간 이징) →
`store/editor/reducer.ts`(`STEP_META` 가 `seamless:false` 도 키 삭제) → `features/editor/StepSidebar.tsx`(`GapSlot` 3상태, `onSetLink(id, link)`) →
`EditorStage.tsx`(배선) → `ui/icons.tsx`(`IconChainSeamless`) → `i18n/{ko,en,ja}.ts` → 테스트(`playback.test`·`validate.test`·
`StepSidebar` 테스트·`stepLink.test`) → `CHANGELOG` 3벌 · `PLAN-STEP-EDITING.md` 에 한 줄(2026-09-08 셋째 상태) · `DESIGN.md` 재생 서술.

## 3. 착수 순서

모델·재생 → 편집기 UI → 문서·검증(돌연변이) → 실기.

## 4. 실기 확인(jsdom 이 못 재는 것)

- 스텝 3~4개를 딜레이 없는 연결로 이었을 때 시연이 한 동작처럼 흐르는지(멈칫 없음), 양끝 가감속 체감.
- 2x·0.5x 배속에서도 자연스러운지, 루프 경계.
- 틈 버튼 3상태가 터치에서 한 번에 넘어가는지, 색·아이콘 구분(강제색 모드 포함).
