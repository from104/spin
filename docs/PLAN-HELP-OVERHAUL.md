# PLAN — 튜토리얼 · 도움말 · 단축키 전면 개편 (2026-09-08)

기현님 지시(2026-09-08, 원문): *"튜토리얼, 도움말, 단축키 전면 개편 — 초보자가 익힐 수 있도록 기능 하나하나 자세하게
설명. 단축키가 한영 상태에 영향 안 받게. 단축키가 작동 안할때가 있었다."*

이 문서가 이 개편의 정본 계획서다. 상위 정본은 `AGENTS.md` 와 `docs/PLAN-HELP-TUTORIAL.md`(2026-08-20, 엔진·10문답 —
그 결정은 뒤집지 않고 **위에 쌓는다**). 단축키의 정본은 여전히 `src/core/keymap.ts`(2026-08-16 개편) 이다.

## 0. 조사로 확인된 사실 (2026-09-08 조사 워크플로우, 반박 검증 통과)

| # | 사실 | 근거 |
|---|---|---|
| F1 | 단축키 정본은 이미 **물리 키(`KeyboardEvent.code`)** 기준이라 한글 입력 상태에서도 매칭돼야 정상이다. 세 디스패처(편집 전역·개체 층·시연)가 전부 그 경로다 | `src/core/keymap.ts:8-16`, `eventCode` :345 |
| F2 | 그런데 **`code` 가 비는 이벤트** 에서는 폴백이 ASCII 알파벳뿐이라 한글 자모(`ㅂ`…)가 오면 죽는다. 수식키 모드(`modifier`)의 재조회는 `key` 를 아예 안 넘겨 폴백조차 못 탄다 | `keymap.ts:312-353`, `useEditorKeyboard.ts:73-81` |
| F3 | IME 가드(`isComposing`/`keyCode 229`) 가 **없는 입력칸**이 있다 — 헤더의 드릴 이름·설명 인라인 편집(Enter → blur 커밋, Esc → 복원), `CenterModal` 의 Esc(드릴 정보 시트의 준비물·코칭포인트 텍스트칸 위). 저장소 자신이 `NoteEditModal` 에서 "조합을 끝내는 Enter 가 새면 첫 낱말마다 닫힌다"고 관측해 둔 패턴이다 | `AppHeader.tsx:492-499, 569-576`, `CenterModal.tsx:31-35`, `NoteEditModal.tsx:117` |
| F4 | 단축키가 "안 먹는" 것처럼 보이는 정상 동작이 셋 있다 — 입력칸 포커스 중엔 저장만 산다, 버튼에 포커스가 남으면 Space/Enter 는 버튼이 먹는다(§7.5f 이중 발화 방지), 설정 [편집기 단축키] 가 `수식키 필요`/`끔` 이면 문자키가 Alt 를 요구하거나 죽는다. **사용자에게 이 셋을 알려주는 글이 어디에도 없다** | `useEditorKeyboard.ts:95-107`, `prefs.ts:139` |
| F5 | 도움말은 9섹션 × `{term, desc}` 한 줄 항목(i18n `help.*` 94키) 의 flat `<dl>` — 제목·순서·목록·키캡·강조를 담을 자리가 없다. en/ja 는 ko 와 이미 내용이 갈라졌다([보드 설정] 개편 미반영). 콘텐츠를 지키는 테스트가 없다 | `helpSections.ts:39-50`, `HelpCenter.tsx:46-58` |
| F6 | 긴 글의 선례는 규칙 화면(`ruleTopics.ts` — 로케일별 파일 + `kind` 블록 유니온) | `ruleTopics.ts:68-89, 700-720` |
| F7 | 튜토리얼은 7화면 30단계, 엔진은 **보기 전용**(`TutorialStep = {target,titleKey,bodyKey}`), 대상 없는 단계는 조용히 빠지고 플래그는 찍힌다, 재측정은 resize 뿐(스크롤 없음), 배경 클릭도 종료 | `types.ts:7-11`, `useTutorial.ts:53-57,109-118`, `TutorialOverlay.tsx:57-62,163-166` |
| F8 | 도움말이 아예 설명하지 않는 기능군: 개체 메뉴 전부(잠금·무시·표시순서·복제·같은 것 고르기), 화살표 핸들 탭(화살촉·색 순환), 공 재탭(거리 원 순환), 스텝 연결 방식 셋, 선택 모드·키보드 스텝 순서 바꾸기, 코트 키보드 커서·Alt+←/→ 순회, 내보내기 넷(PNG·PDF·MP4·링크), 공유받기, 설정의 대부분(재생·명단·시연·물리·동기화), 헤더 검색·이름 편집·코트 전환, 앱 크롬(테마·언어·변경내역) | 조사 inventory(`scratchpad/feature-inventory.txt`) 대조 |
| F9 | 조사 도구 함정: `keymap.ts` 에 NUL 바이트(중복 제거 키 구분자)가 있어 `rg` 가 바이너리로 건너뛴다 — **`rg -a`** 필수 | `keymap.ts:404` |

## 0.1 한 줄 원칙

**도움말은 "기능 하나 = 항목 하나" 의 설명서, 튜토리얼은 "손으로 한 번 해 보는" 첫 길, 단축키는 물리 키 하나로 어디서나 같게.**
셋은 한 정본(keymap)·한 목록(기능 전수 목록)에서 나오고, 서로를 가리킨다(투어 끝 → 도움말, 도움말 끝 → 투어).

## 1. 결정

| # | 결정 | 근거 |
|---|---|---|
| 1 | **도움말 콘텐츠 모델을 규칙 화면 방식으로 교체** — `src/ui/help/helpContent.ts`(타입) + `helpContent.ko.ts / .en.ts / .ja.ts`(본문). 섹션 → 주제(topic, 기능 하나) → 블록. i18n `help.*` 의 `item*.term/desc` 94키 중 본문 키는 **폐기**(섹션 이름·UI 문구만 남긴다). | F5·F6. 1088줄짜리 `ko.ts` 에 수백 줄 본문을 더 얹지 않는다. 로케일 파일 분리는 규칙 콘텐츠가 이미 간 길 |
| 2 | 블록 종류는 **여섯**: `p`(문단) · `h`(소제목) · `steps`(번호 순서) · `list`(글머리) · `tip`(팁/주의, `tone: 'tip'\|'warn'`) · `keys`(단축키 표 — `scope` 를 적으면 keymap 에서 **파생**, 직접 행을 적지 않는다). 인라인은 `**굵게**` 와 `` `키` ``(→ `<kbd>`) 둘만 정규식으로 푼다. 마크다운 파서 의존성 0 | 초보자 설명서에 필요한 최소 집합. 표는 keymap 파생만 허용해 "손으로 적은 단축키 표" 를 원천 봉쇄(2026-08-16 교훈) |
| 3 | **주제 목록은 §2.1 개요가 정본**이고 3로케일이 같은 `id` 집합을 가져야 한다 — 테스트가 id 집합·빈 블록·`keys` 의 scope 유효성을 잰다 | 콘텐츠 보호 테스트 부재(F5). "검사표에 데이터를 베끼지 않는다" — 표는 id 만 대조 |
| 4 | HelpCenter 화면: 왼쪽 목차(섹션 → 접힌 주제 목록), 위에 **찾기 입력**(주제 제목·본문 대소문자 무시 부분일치, 3로케일 본문에 대해), 오른쪽 본문은 주제마다 `<article id>`. 여는 쪽은 `initialSection` 그대로에 `initialTopic?` 을 더한다 | 기능이 70여 개면 목차만으론 못 찾는다 |
| 5 | 단축키 섹션에 **[키 진단]** 을 단다 — 열려 있는 동안 마지막 keydown 의 `code`·`key`·수식키·`isComposing` 과 "이 키에 걸린 동작" 을 보여 준다 | "작동 안 할 때가 있었다" 를 실기에서 **본인이** 판정할 수 있게. jsdom 이 못 재는 IME 문제의 유일한 관측 수단 |
| 6 | 단축키 섹션 본문에 F4 의 세 경우와 "한/영 무관·자판 인쇄(QWERTY) 기준·Mac 은 ⌘" 을 명시한다 | F4. 지금은 코드 주석에만 있다 |
| 7 | 키 처리 통일 — `src/ui/keyboard.ts` 에 `isImeKeyEvent(e)`(= `isComposing \|\| keyCode===229 \|\| key==='Process'`) 를 두고 Modal·CenterModal·Drawer·TutorialOverlay·AppHeader·NoteEditModal 이 **그 함수 하나**를 쓴다. `Modal.tsx:88-89` 의 낡은 근거("사용처 6개, 텍스트 입력 0") 는 ⚠️ 로 갱신 | F3. 같은 가드가 여섯 벌 있으면 일곱째가 빠진다 |
| 8 | `KEY_TO_CODE` 에 **두벌식 자모 → code** 를 더한다(ㅂㅈㄷㄱㅅㅛㅕㅑㅐㅔ / ㅁㄴㅇㄹㅎㅗㅓㅏㅣ / ㅋㅌㅊㅍㅠㅜㅡ + 쌍자음·ㅒㅖ). `gatedLookup` 의 재조회에 `key` 를 넘긴다 | F2. `code` 가 비는 환경(일부 WebView·외장 키보드)에서만 도는 폴백이라 정상 경로엔 영향 0 |
| 9 | `AppHeader` 이름·설명 입력: Enter/Esc 앞에 IME 가드. `CenterModal`·`Drawer` Esc 에 가드. `StepSidebar` 의 `e.key === ' '` 등 남은 `e.key` 문자 비교는 `eventCode` 로 바꾼다(Escape/Enter/Arrow 는 IME 와 무관하므로 **바꾸지 않는다** — 바꾸는 것은 문자·Space 뿐) | F3. 손대는 범위를 "한영에 흔들릴 수 있는 것" 으로 한정 |

> **결정 9 각주 (2026-09-08 검수)** — **요소 활성화(Enter/Space) 관용구는 이 결정의 대상이 아니다.**
> `role="radio"`·`role="button"` 처럼 브라우저가 활성화 키를 안 주는 요소에 손으로 Enter/Space 를
> 되돌려주는 자리(`AppHeader.tsx` 잠긴 코트 스위치, `PresentRunner.tsx` 암전 해제)는 `e.key === ' '`
> 그대로 둔다: 단축키 매칭이 아니라 그 요소를 누르는 일이고, 활성화 키의 `key` 는 입력기가 바꾸지
> 않으며, 그 요소들은 텍스트를 받지 않는다. 바꾸는 것은 **디스패처가 키로 동작을 고르는 자리**뿐이다.
| 10 | `Alt` 좌우 구분·한/영 키 자체는 **손대지 않는다.** 대신 [키 진단] 으로 실기에서 본다 | 코드로 확정 못 하는 플랫폼 동작(조사 '추측' 항목). 잘못 고치면 정상 자판을 깬다 |
| 11 | 튜토리얼 엔진 확장 셋: (a) `advanceOnClick?: true` — 구멍 안 대상을 실제로 누르면 다음 단계(실습형), (b) 대상이 스크롤 컨테이너 밖이면 `scrollIntoView({block:'nearest'})` 후 측정하고 `scroll` 도 재측정 트리거(capture), (c) 마지막 말풍선에 **[자세한 도움말]** 버튼 → 그 화면 섹션의 HelpCenter | F7. 초보자에게 "보기만" 은 익히는 게 아니다. (b) 는 드릴 목록 필터 단계가 이미 걸리는 실기 증상 |
| 12 | 튜토리얼 단계 **증설**(§2.2, 30 → 46): 실습형은 되돌릴 수 있는 것에만(스텝 추가·재생·도구 고르기 등), 파괴적인 것(삭제·비우기)엔 안 건다 | 결정 5 의 "화면마다 다르게" 유지. 첫 방문에 데이터가 망가지면 안 된다 |
| 13 | 대상 없는 단계가 **하나라도 빠진 채** 끝나면 플래그를 찍되 `tutorialsSeen` 값 형식은 그대로(`true`) — 시연 자동 전체화면이 이 플래그를 읽는다(`PresentRunner.tsx:177-184`) | 형식을 바꾸면 그쪽이 깨진다. 빠진 단계는 [투어 다시 보기] 로 본다 |
| 14 | 옛 `help.*.item*.term/desc` 키와 `HelpItem`/`NarrativeSection` 타입은 **같은 커밋에서 지운다**(AGENTS §9 — 호출자 0 을 rg 로 교차 확인). `editorHelpRows.ts`/`presentHelpRows.ts` 는 `keys` 블록의 파생원으로 **남긴다** | 두 벌 두지 않는다(§3) |
| 15 | 낡은 주석 넷을 이 기회에 고친다: `HelpCenter.tsx:8-11`(레일 미배선), `HelpTriggerProvider.tsx` 머리말의 `AppNavAside`, `Modal.tsx:88-89`, `ruleTopics.ts:17-18`(ko 전용) | 조사가 주석을 코드로 착각한 사례가 둘. 다음 조사도 그런다 |
| 17 | **첫 방문 순서에 도움말 [시작하기]를 끼운다**(2026-09-08 기현 지시 *"첫 접속 시 로딩이 끝나고 도움말 시작하기 보여줘"*): 로더 걷힘 → 작은 화면 안내 → 도움말 [시작하기](AppShell 의 별도 HelpCenter 인스턴스) → 화면 투어(게이트에 `!welcomeOpen`). 도장 `prefs.helpWelcomeSeen`(기기별·옵셔널), 닫을 때 한 곳에서 찍고, 설정 [튜토리얼 다시 보기]가 투어와 함께 되돌린다. 테스트 환경은 로더와 같은 스위치(`firstVisitPromptsEnabled`)로 끈다 | 안내 모달의 결정 25·30 과 같은 규율. 게이트에 안 넣으면 스포트라이트가 모달 위에 선다(appLoader.test 의 돌연변이로 증명) |
| 16 | 스키마·prefs 도장 **안 올린다.** `tutorialsSeen` 화이트리스트 파서가 새 화면 키 없이도 산다 | `prefs.ts:199-203` |

## 2. 손대는 곳 (구현자별 소유 — 겹치지 않는다)

**A. 단축키(opus)** — `src/core/keymap.ts`(자모 표·`isImeKeyEvent` 는 아님), `src/ui/keyboard.ts`(`isImeKeyEvent`), `src/features/editor/useEditorKeyboard.ts`(재조회 `key`), `src/app/AppHeader.tsx`, `src/ui/{Modal,CenterModal,Drawer}.tsx`, `src/ui/tutorial/TutorialOverlay.tsx`(가드 한 줄만 — 나머지는 B 소유), `src/features/editor/{NoteEditModal,StepSidebar}.tsx`, `src/ui/help/KeyDiagnostics.tsx`(신규, 순수 컴포넌트 — HelpCenter 에 꽂는 것은 C), 테스트: `keymap.test`(자모 폴백·재조회 — 돌연변이 증명), `AppHeader` 조합 Enter 무시, `CenterModal` 조합 Esc 무시. i18n: `help.keys.diag.*` 만.

**B. 튜토리얼(opus)** — `src/ui/tutorial/{types,useTutorial,TutorialOverlay}.tsx`(결정 11), 7개 `tutorialSteps.ts`, 화면 컴포넌트의 `data-tut` 앵커 추가(§2.2 에 적힌 것만), `useTutorial.test.tsx`(**advanceOnClick 만** — scroll 재측정은 §4 실기로 넘긴다: jsdom 은 rect 가 전부 0 이라 `scrollTargetIntoView` 가 0 크기 가드에서 먼저 물러나고, 그것을 우회하려 rect 를 mock 하면 mock 이 자기 답을 되읽는 자기증명이 된다), i18n `tutorial.*` 키(3로케일, **`tutorial.` 접두 구역만** Edit). [자세한 도움말] 은 `useTutorial` 결과에 `onOpenHelp?` 를 받아 화면이 HelpCenter 를 연다.

**C1. 도움말 UI(opus)** — `src/ui/help/helpContent.ts`(타입 — §2.3 그대로), `helpSections.ts`(섹션 순서·라벨만 남기고 `HelpItem` 폐기), `HelpCenter.tsx`(블록 렌더러·목차·찾기·`initialTopic`·KeyDiagnostics 마운트), `HelpCenter.test.tsx`, 콘텐츠 계약 테스트 `helpContent.test.ts`(결정 3), i18n `help.*` UI 키(찾기·결과 없음·진단 레이블 — **`help.` 접두 구역만** Edit, 본문 키 삭제).

**C2. 도움말 본문 ko(opus)** — `src/ui/help/helpContent.ko.ts` 만. §2.1 개요의 주제 전부, 주제당 "무엇인가 → 어떻게 하나(steps) → 팁/주의 → 관련 키". 근거는 `scratchpad/feature-inventory.txt` 와 실제 컴포넌트(라벨은 `ko.ts` 의 실제 문자열을 `[대괄호]` 로 인용).

**C3. 번역(sonnet ×2, C2 뒤)** — `helpContent.en.ts`, `helpContent.ja.ts`. 같은 id·같은 블록 수, UI 라벨은 각 로케일 사전의 실제 문자열.

**D. 문서(sonnet)** — `CHANGELOG.md` ×3 `[Unreleased]`, `ROADMAP.md`(1.0 "사용 설명" 항목 완료 표기), `docs/PLAN-HELP-TUTORIAL.md` 머리말에 2026-09-08 후속 한 줄, `docs/DESIGN.md` §7.5f 근처에 IME 가드 계약 한 문단, `AGENTS.md` §6 에 "keymap.ts 는 `rg -a`" 한 줄(F9), 결정 15 의 주석 넷.

### 2.1 도움말 주제 개요 (정본 — 3로케일 id 집합)

섹션 id 는 지금 아홉 그대로. 주제 id 는 `섹션.주제`.

- **start** — `what`(SPIN 이 무엇인가·다섯 화면) · `first-drill`(10분 따라하기: 새 드릴 → 칩 놓기 → 스텝 추가 → 재생 → 시연) · `navigation`(레일·헤더·좁은 창·테마·언어·변경내역) · `saving`(자동저장·기기 저장·백업과 동기화의 차이) · `help-and-tour`(도움말 여는 법·투어 다시 보기·찾기)
- **board** — `what`(드릴과 다른 점: 스텝 없음·자동저장 없음) · `court`(코트 형태·크기·진영은 [코트 비우기] 뒤에만) · `to-drill`([드릴로 편집])
- **library** — `list`(카드/목록·정렬·유형·상황 필터·헤더 검색) · `new-drill`(다이얼로그: 이름·코트) · `card`(열기·▶시연·⋮ 메뉴: 복제·파일로 내보내기·링크로 공유·삭제) · `delete-undo`(확인·참조 세션 경고·토스트 되돌리기·휴지통 없음) · `import`(가져오기·충돌 처리 셋·오분류 안내·결과 보고) · `share-link`(만들기·복사·유효기간·열쇠·오류 6종) · `share-receive`(공유받은 드릴/세션 모달)
- **editor** — `layout`(헤더·기능바·트레이·코트·스텝 사이드바·노트띠) · `tools`(11 도구 하나씩: 선택·선·자유 그리기·원·삼각·사각·공·콘·선수·메모·지우기 + 같은 도구 두 번 = 연속 배치) · `tray`(팀 칩·공 상자·콘 상자·서랍) · `place-move`(놓기·옮기기·미세 조정 패드·이동 속도 제한) · `select`(선택·여럿·같은 것 전부·Esc·Ctrl+A) · `object-menu`(수정·복제·잠금·무시·표시순서·삭제/빼기 구분) · `arrows-shapes`(화살표 핸들 탭=화살촉/색 순환·굽힘·도형·자유 그리기·지우개) · `ball-ring`(공 재탭 = 거리 원 순환·세트피스 소유) · `notes`(메모 개체: 크기·색 / 스텝 노트: 코치 발화) · `steps`(추가·복제·삭제·순서·최대 장수·선택 모드·키보드 순서 바꾸기) · `step-links`(끊김·딜레이 연결·딜레이 없는 연결 = 애니메이션) · `playback`(재생 묶음·배속·반복·스텝 시간) · `view`(확대·이동·격자·골 지역 가이드·규칙 경고 발화) · `board-settings`([보드 설정] 전 항목·골대 원위치·드릴은 코트 잠김) · `undo-save`(되돌리기·자동저장·저장 표시) · `drill-info`(정보 시트 전 필드·헤더 이름/설명 인라인 편집) · `caps`(개수 상한 전부) · `keyboard-court`(커서·Enter 배치·Alt+←/→ 순회·W A S D·Q E)
- **sessions** — `what`(세션 = 구획 + 드릴 편성) · `list`(다음 세션 카드·⋮ 메뉴: 시연·내보내기·링크로 공유·삭제) · `info`(이름·일시·장소·목표 시간·메모) · `phases`(구획 추가·종류·목표 배분·이동·삭제 시 병합) · `items`(드릴 추가·소요시간·이동·제거·메모/휴식) · `allocation`(게이지·초과·누락) · `participants`(체크리스트·명단·PF2) · `present-export`(세션 시연·내보내기·공유 링크)
- **present** — `start-exit`(어디서 시작하나·[편집으로]/[세션으로]·Esc) · `controls`(재생·이전/다음·반복·배속·진행바 점프) · `fullscreen`(자동 전체화면·첫 방문 예외) · `gestures`(스와이프·탭) · `blackout`(Alt+B·해제) · `info-roster`(정보 패널·명단) · `session-flow`(구간·드릴 넘김·인터스티셜) · `wake-lock`
- **export** *(신설 아님 — `editor` 안 주제로 두면 길어 **섹션 승격**: `HelpSectionKey` 에 `export` 추가, 순서는 present 다음)* — `png` · `print-pdf` · `video`(720p/1080p·지원 브라우저·용량·저장 위치) · `link`(드릴/세션 링크의 차이) · `backup`(설정의 전체 내보내기와의 차이)
- **rules** — `topics`(카드·배지·이전/다음) · `scenes`(장면 재생·비교표) · `laws` · `overlay`(편집기 안 규칙 경고와의 관계)
- **settings** — `screen`(테마·격자·라벨·골 지역·UI 배율) · `playback` · `roster` · `present` · `a11y`(큰 타깃·2존·소리·모션·**편집기 단축키 3모드**) · `physics`(접이식 전 항목·기본값 복원) · `data`(가져오기·내보내기·복원 옵션·결과 보고) · `sync`(Drive 연결·동의·지금 동기화·해제·데이터 삭제·충돌·데스크톱 로그인 차이) · `tutorial-reset` · `legal`
- **shortcuts** — `how`(물리 키·한/영 무관·QWERTY·⌘·안 먹는 세 경우·설정 3모드) · `editor`(keys global) · `object`(keys object) · `board`(steps 없는 표) · `present`(keys present) · `diagnose`([키 진단])

### 2.2 튜토리얼 단계 (30 → 42) — ★ 는 실습형(advanceOnClick)

**이 표는 랜딩 뒤 실제 코드로 맞춘 것이다(2026-09-08 검수).** 착수 때 적었던 46 은 표의 합(43)과도
달랐고, 세 곳이 구현에서 갈라졌다 — 아래 각주 ①②③ 이 그 셋이다. 3로케일 `tutorial.*.stepN` 키 쌍도 42.

| 화면 | 전 | 후 | 단계(대상 `data-tut`) |
|---|---|---|---|
| library | 3 | 5 | library-search(신규 앵커, 헤더 검색) → library-card → library-card-menu(신규, 첫 카드 ⋮) → library-filters → header-primary ★(새 드릴 다이얼로그가 뜨면 투어 끝)③ |
| sessions | 2 | 3 | header-primary → sessions-card → sessions-card-menu(신규) |
| sessionEditor | 5 | 6 | sessionEditor-info → sessionEditor-addphase ★ → sessionEditor-adddrill → sessionEditor-allocation → sessionEditor-participants → sessionEditor-present(세션 시연)② |
| editor | 8 | 12 | editor-step-sidebar → editor-add-step ★ → editor-tray → editor-tool-select(신규, 도구 레일 선택 도구) → editor-court → editor-playback ★(재생 눌러 보기) → editor-note → editor-functionbar(신규, 되돌리기·보드 설정·내보내기 묶음) → editor-gap(신규, 스텝 사이 연결 버튼) → drill-info → editor-export(신규, 기능바 [내보내기]) → header-primary |
| board | 5 | 7 | editor-tray → editor-tool-select → editor-court → board-draw → board-functionbar → editor-export → header-primary |
| present | 4 | 6 | present-playback ★ → present-progress → present-sidebar → present-info(신규) → present-fullscreen(신규, 세로바 전체화면 칸) → header-primary |
| rules | 3 | 3 | rules-home → rules-appendix → rules-card ★(카드를 열면 투어 끝)①③ |

① **`rules-play` 는 넣지 않았다.** [장면 재생]은 주제 **상세**에만 있는 버튼인데 엔진은 `start()` 하는
그 순간 DOM 에 있는 대상만 고르므로(빈 화면 가드), 홈에서 시작하는 이 투어는 그 단계를 언제나 걸러
낸다 — 넣으면 절대 안 뜨는 단계가 된다. 앵커는 `RuleSceneBlock` 에 심어 두었으니 엔진이 **중간에
생기는 대상**을 다루게 되는 날 배열에 한 줄만 더하면 합류한다.
② sessionEditor 의 마지막은 `header-primary` 가 아니라 `sessionEditor-present` 다 — 그 화면의 헤더 주
액션은 [새 세션]이라 "편성을 마쳤으면 시연" 이라는 말과 가리키는 것이 어긋난다.
③ **화면을 바꾸는 ★ 는 맨 뒤에 둔다.** 모달을 여는 ★(library `header-primary`)를 중간에 두면 투어
오버레이가 그 위를 덮어 `aria-modal` 이 둘 동시에 서고, 다이얼로그의 [취소]가 덮개 밑에 깔린다.
화면을 갈아 끼우는 ★(rules `rules-card`)를 중간에 두면 뒤 단계의 대상이 통째로 사라진다.

신규 앵커는 각 화면 컴포넌트에 `data-tut` 한 줄씩(B 소유). 없는 화면 상태(드릴 0개)에서는 기존 계약대로 그 단계만 빠진다.

### 2.3 콘텐츠 타입 (C1 이 이 그대로 만든다 — C2·C3 가 이 타입에 맞춰 쓴다)

```ts
export type HelpInline = string;                       // `**굵게**` · `` `키` `` 만 해석
export type HelpBlock =
  | { kind: 'p'; text: HelpInline }
  | { kind: 'h'; text: string }
  | { kind: 'steps'; items: readonly HelpInline[] }
  | { kind: 'list'; items: readonly HelpInline[] }
  | { kind: 'tip'; tone: 'tip' | 'warn'; text: HelpInline }
  | { kind: 'keys'; scope: 'editor' | 'object' | 'board' | 'present' | 'tools' };  // keymap 파생
export interface HelpTopic { id: string; title: string; blocks: readonly HelpBlock[] }
export interface HelpSectionContent { key: HelpSectionKey; intro?: HelpInline; topics: readonly HelpTopic[] }
export type HelpContent = Record<HelpSectionKey, HelpSectionContent>;
export function helpContentFor(locale: Locale): HelpContent;   // helpContent.ts 가 3벌을 고른다
```

## 3. 착수 순서

A(단축키) → B ∥ C1 ∥ C2 ∥ D → C3 → 검수(게이트·돌연변이·콘텐츠 대조) → 실기.
i18n 3벌(`ko/en/ja.ts`)은 병렬 구간에서 **Edit 로 자기 접두 구역만**, Write 덮어쓰기 금지. 게이트: `npm run typecheck` · `npm run lint`(경고 48 = HEAD 유지) · `npx vitest run`.

## 4. 실기 확인 (jsdom 이 못 재는 것)

- 한글 입력 상태에서 편집기 문자키(V·B·C·P…)·`Shift+C`·`Alt+G`·`Ctrl+S` — [키 진단] 으로 `code`/`key`/조합 상태를 본다. Windows MS-IME·Linux ibus·iPad 외장 키보드.
- 헤더 이름 편집에서 한글 낱말 조합 중 Enter — 편집이 닫히지 않아야 한다. 드릴 정보 시트 텍스트칸에서 조합 중 Esc — 시트가 닫히지 않아야 한다.
- 투어 실습형 단계(★)가 터치에서 한 번에 넘어가는지, 스크롤된 대상(드릴 목록 필터)이 보이게 밀리는지, 좁은 창.
  - **안쪽 스크롤러**(드릴 목록·스텝 사이드바)가 뷰포트 중간에 있는 창 크기를 특히 본다 — jsdom 은 rect 가 전부 0 이라 이 판정을 못 재고, 그래서 `scrollTargetIntoView` 에는 테스트가 없다.
  - ★ 앵커가 **묶음**에 붙은 세 자리(`editor-playback`·`present-playback`·`editor-add-step`)에서 배속 칸이나 틈의 여백을 눌러도 넘어간다 — 실습의 뜻이 흐려지면 앵커를 버튼 자체로 옮긴다.
  - 편집기 첫 방문에서 투어가 뜨기까지의 지연(스텝 1장짜리 드릴은 `editor-gap` 을 못 찾아 재시도 상한 20프레임 ≈ 330ms 를 다 쓴다) 이 체감되는지.
- 도움말 찾기·목차·`<kbd>` 표기·다크 모드 가독성, 태블릿에서 한 손 스크롤.
- [키 진단]의 **설정 게이트** 행 — [설정] → [접근성] → [편집기 단축키] 를 [끔]·[수식키 필요] 로 두고 문자키를 눌러 `global` 층이 비고 게이트 행이 그 이유를 말하는지.

## 5. 검수 결과 (2026-09-08)

랜딩 뒤 검수가 24건을 보고했고(must 7 · should 9 · nit 8), 아래가 그 처리다.

**고친 것 — must 7건.** ① 도움말 `editor.keyboard-court` 의 개체 순회 키가 존재하지 않는 `Alt+←/→` 로 적혀
있었다(정본은 `[`/`]`, `Shift` 로 선택 확장) — 3로케일 교체. 발원지인 `i18n` 의 `editor.workspace.courtHelp`
는 남았다(아래 미해결). ② 시연 터치 제스처의 "탭 = 조작 막대 다시 보이기" 는 없는 동작이었다 — 실제 동작
(암전 해제·진행바 칸 탭으로 점프)으로 교체. ③ `settings.sync` 에 충돌 규칙(LWW — 나중에 고친 쪽이 남고,
삭제도 시각이 늦으면 이긴다)과 오류 안내를 추가. ④ `editor.view` 에 팬(`Ctrl+방향키`·빈 코트 끌기) 추가.
⑤ `editor.drill-info` 에 [유형]·[경기 상황]·[난이도] 추가. ⑥ `DESIGN.md` §7.5f 의 IME 가드 문단이 코드와
반대로 적혀 있었다(가드는 Enter·Esc 에 **건다**) — 문단 교체. ⑦ CHANGELOG 번역본의 대괄호 라벨을 그 언어의
실제 UI 문자열로(`[Full help]` · `［詳しいヘルプ］`).

**고친 것 — should.** [키 진단]의 걸린 동작이 설정 게이트를 무시하고 `lookupDef` 원본을 보여 주던 것을
`gatedLookup` 재사용으로 바로잡고(그 함수를 `useEditorKeyboard` 에서 export), 게이트 값을 한 행으로 더했다
— 머리말의 "세 갈래" 는 "네 갈래" 가 됐다. 드릴 목록 투어의 `header-primary` ★ 를 **마지막**으로 옮겼다
(§2.2 ③). `scrollTargetIntoView` 의 뷰포트 밖 판정을 지우고 `block:'nearest'` 를 그냥 부르게 했다 — 안쪽
스크롤러에 클리핑된 대상이 그 판정을 빠져나가고 있었다. §2.2 표를 실제(42단계)로 맞췄다. 도움말 본문에서
코트 형태 셋(풀/하프/플랫)·헤더 [코트 형태] 스위치·[무시]의 실제 효과·자유 전술판 저장 여부 세 문장의
불일치·세션 삭제 확인과 되돌리기·미세 조정 패드 여섯 칸·[본문으로 건너뛰기]·스텝 60장 상한·영상 저장
위치를 3로케일에 채웠다.

**고친 것 — nit.** [키 진단] 언마운트 정리에 단언을 붙였다(돌연변이 M11 이 살아 있던 자리). ja 도움말 본문의
반각 괄호를 전각 `（）` 로 일괄 치환(백틱·대괄호 라벨은 제외 — 그 안은 UI 문자열 인용이다). en/ja 라벨 인용
어긋남 4건 정정. `advanceOnClick` 주석에 "앵커 안 어디를 눌러도 넘어간다" 를 명시.

**안 고친 것.** `AppHeader` 잠긴 코트 스위치의 `e.key === ' '` 는 그대로 두고 결정 9 옆에 각주를 달았다
(요소 활성화 관용구는 그 결정의 대상이 아니다). `useTutorial` 의 "없을 수 있는 대상" 대기(`editor-gap`)는
실기에서 체감되는지 먼저 본다 — §4. 설정 화면 HelpCenter 의 [투어 다시 보기] 가 아무 일도 안 하는 것은
이 개편 이전부터의 것이라 범위 밖으로 남긴다.

**남은 구멍(다른 소유).** ① `src/features/rules/ruleTopics.ja.ts` 에 `tutorialAnchor` 가 **하나도 없다**
(ko·en 은 각 3개) — 일본어에서는 규칙 투어가 `rules-home` 한 단계로 줄고 §2.2 가 요구한 ★ 실습 단계가 아예
안 뜬다. 2026-08-31 부터 있던 구멍이다. ② `src/i18n/*.ts` 의 `editor.workspace.courtHelp` 가 아직
"Alt+←/→" 로 적혀 있다 — 위 must ①과 같은 문장이니 같은 말로 정정해야 한다. ③ `PresentRunner.tsx` 의 암전
해제 `e.key === ' '` 는 결정 9 각주가 덮는다(고칠 것 없음, 기록만).

### 5.1 수정 단계가 남긴 것의 처리 (2026-09-08, 세션 마무리)

- `ruleTopics.ja.ts` 에 `tutorialAnchor` 둘(rules-card·rules-appendix) 추가 — 일본어에서 규칙 투어의 카드·부록 단계가 빠지던 것. 앵커 계약 테스트를 3로케일 순회로 넓혔다(ja 앵커 하나 제거 → 빨간불 확인 후 복구).
- `editor.workspace.courtHelp` 3로케일의 존재하지 않는 `Alt+←/→` 를 `[ / ]` 로 정정(도움말 본문과 같은 발원지).
- 헤드리스 크롬(vite 5197·CDP 9229)으로 도움말 목차·드릴 편집 섹션·찾기·단축키 섹션 렌더를 확인. [키 진단]에 `key:'ㅍ', code:'KeyV'` 를 보내면 `물리 키 KeyV · 입력된 글자 ㅍ · 걸린 동작 global: tool:select` 로 표시됐다(스크린샷 scratchpad `help-2-help-editor.png`·`help-4-help-keys.png`).
- 남긴 것(범위 밖·실기): `initialTopic` 호출자 0(진입점만 없음), 설정 화면 HelpCenter 의 빈 `onRestartTutorial`(개편 이전부터), `library.import` 결과 보고의 조건 분기 서술.
