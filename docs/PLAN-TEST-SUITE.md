# PLAN-TEST-SUITE — 한 명령 테스트 스위트와 웹 E2E (2026-11-15)

> 기현 결정(QCalc 에서 내린 것을 SPIN 에 그대로 적용): 앱 코드에 `data-testid` 와 e2e 훅을 넣는다 ·
> 로컬에서도 돈다 · 지금 범위는 **code + web 층** · 실제 앱(Tauri·Android) 층과 디버그 APK 는 뒤 단계.

**정본 지위**: 테스트 스위트(실행기·E2E·CI·스킬)의 설계 정본. 상위 정본은 `AGENTS.md` 「테스트 작성
규칙」·§6·§10. 참고 구현은 QCalc `feature/e2e-suite`(커밋된 파일만 — 그쪽 작업 트리의 `e2e/app/`·
`WdioApp.ts`·`playwright.app.config.ts` 는 미검증이라 보지 않는다). 이 문서는 계획이며 코드는 없다.

## 0. 한 줄 원칙

**jsdom 이 못 재는 것만 E2E 로 간다** — 진짜 포인터·진짜 레이아웃·진짜 IndexedDB·진짜 라우팅·WebKit.
시나리오마다 "지우면 어떤 실기 버그가 새는가" 에 답하고, 새 단언은 앱을 일부러 망가뜨려(재빌드 14초)
빨간불을 본 뒤 남긴다. 잡음은 기능을 끄지 않고 **상태를 심어서** 없앤다.

## 1. 결정

| # | 결정 | 근거 |
|---|---|---|
| 1 | 층은 `code` \| `web` \| `app`(자리만). 기본 실행 = code + web | QCalc 와 같은 꼴. app 은 "not implemented yet" 로 남긴다 |
| 2 | `@playwright/test` 1.65.x, 프로젝트 3개: `chromium-desktop`(1280×800 ≈ WebView2) · `webkit-desktop`(1280×800 ≈ WebKitGTK/Safari) · `chromium-mobile`(Pixel 7 세로·터치 ≈ Android WebView) | 1280×800 은 `src-tauri/tauri.conf.json:16-17` 기본 창. Pixel 7 은 작은 화면 안내 + 좁은 배치 + 코트 90° 회전이 한꺼번에 서는 최악 조건. 브라우저 chromium-1255·webkit-2388 은 이미 캐시에 있다 |
| 3 | 대상은 **운영 빌드**(`npm run build` = tsc -b + vite build + 프리렌더, 실측 14초)를 로컬 정적 서버로 | 프리렌더 페이지·청크 분할·`FallbackResource /index.html` 을 그대로 본다. dev 서버는 그 셋을 못 본다 |
| 4 | 시나리오는 드라이버 중립(`SpinApp` 인터페이스 + `needs` 능력). Playwright 를 import 하지 않는다 | 뒤 단계의 WebdriverIO/tauri-driver·Android 어댑터가 그대로 재사용 |
| 5 | 첫 실행 잡음은 **`spin.prefs` 시드**로 지운다. `?e2e=1` 이 하는 일은 읽기 전용 다리(`window.__spinE2E`) 하나뿐 | SPIN 의 잡음은 전부 prefs 도장으로 이미 제어된다(§3). 기능을 끄는 스위치를 새로 만들면 배송 경로가 사각지대가 된다(`loaderMinMs` 의 교훈, AGENTS §6) |
| 6 | 좌표는 브라우저의 `getScreenCTM()` 으로 얻는다 — 앱의 `computeMetrics` 를 테스트가 베끼지 않는다 | 앱은 jsdom 때문에 CTM 을 일부러 안 쓴다(`useStageMetrics.ts:1`). 그래서 CTM 은 앱 산술과 **독립인 판정자**가 된다 |
| 7 | `knownBug` + 필수 `symptom` 정규식. `fixme`/`skip`·`retries` 는 안 쓴다 | 고쳐도 모르는 일이 없다. 흔들림은 숨기지 않고 드러낸다 |
| 8 | i18n 패리티 층은 **들이지 않는다** | `en.ts:5`·`ja.ts:5` 가 `Record<DictKey,string>` 이라 키 누락은 `npm run typecheck` 가 이미 잡는다. 도해는 `figureLocale.test.tsx` 가 DOM 에서 잰다. 남는 빈틈(화면 전체의 언어 누수)은 시나리오 S13 이 실행 중에 잰다 |
| 9 | CI 는 새 파일 `ci.yml` 하나(devel push + PR), `contents: read` | `desktop-release.yml` 은 태그·수동 전용이라 방아쇠가 안 겹친다. 그 파일은 건드리지 않는다 |
| 10 | 시나리오는 17개에서 시작하고 늘릴 때마다 §0 의 질문에 답한다 | 2026-09-04 감량의 재발 방지 |

## 2. QCalc 에서 가져오는 것

| QCalc 파일 | 처리 | SPIN 에서 |
|---|---|---|
| `playwright.config.ts` | 각색 | 뷰포트 1280×800, `testDir: e2e/web`, 포트 `E2E_PORT`(기본 4179 — QCalc 4178 과 겹치지 않게), `retries: 0`, 실패만 trace·스크린샷, 능력 옵션에서 `clipboard` 빼고 `pointer`·`resize`·`download`·`prerender` 추가 |
| `e2e/support/serve.mjs` | 각색 | 빌드 명령 `npm run build`, 출력 `dist/`. 낡음 판정 입력: `src/ public/ index.html vite.config.ts package.json scripts/prerender.mjs CHANGELOG*.md`(변경 이력 모달이 원문을 굽는다). 응답 순서는 운영 vhost 를 흉내: 파일 → `<경로>/index.html`(프리렌더) → `/index.html`(fallback) |
| `e2e/web/run.ts` | 그대로 | `runGroup` — needs 검사·skip 사유·knownBug/symptom 판정 |
| `e2e/web/*.spec.ts` | 그대로(꼴) | 그룹당 3줄 |
| `e2e/scenarios/kit.ts` | 각색 | `Scenario`·`defineGroup`·`todo`·`missingCapabilities`·`eventually` 는 그대로. 키패드 표(KEY/SHIFT·tapKeys)는 버리고 코트 도구(`at(u,v)`·`expectPose`·`settled`·`expectUnder`)로 바꾼다 |
| `e2e/drivers/CalcApp.ts` · `PlaywrightApp.ts` | 새로 씀 | `SpinApp.ts` · `PlaywrightApp.ts`(§4). 구조(인터페이스 + Capability + `step`)만 계승 |
| `e2e/fixtures/test.ts` | 각색 | `capabilities` 옵션 + `app` 픽스처. `clipboardMode` 삭제 |
| `e2e/fixtures/seed.ts` | 각색 | 빈 문서(`/__e2e__/blank`)에서 localStorage 를 비우고 **IndexedDB `spin` 을 지운 뒤** prefs 를 심는다. 프로필 3종(§3) |
| `e2e/fixtures/network.ts` | 각색 | 고정 응답할 것이 없다. 외부 요청 전부 차단 + 차단된 주소 기록(구글 GIS·Drive·공유 API 가 새면 실패) |
| `e2e/fixtures/clipboard.ts` | 버림 | 지금 시나리오에 클립보드가 없다(공유 링크는 서버가 필요해 범위 밖) |
| `scripts/test-suite.sh` | 각색 | §6. yarn → npm, `vue-tsc` → `npm run typecheck`, `--setup` 의 WebKit 라이브러리 우회는 그대로 |
| `scripts/test-summary.mjs` | 거의 그대로 | 입력·출력 형식 동일. cargo 줄 파서만 확인 |
| `src/__tests__/i18n-parity.test.ts` (+baseline) | 버림 | 결정 8 |
| `.claude/skills/qcalc-test/SKILL.md` | 각색 | `spin-test`(§6) |
| `.github/workflows/ci.yml` | 각색 | §6. 번들 예산 단계 삭제, corepack/yarn → `npm ci` |
| `e2e/README.md` | 각색 | 구조·시나리오 쓰는 법·선택자 규칙·known-bug 절차. SPIN 관행대로 한국어 |
| `d1017e62`(`?e2e=1`) | 발상만 | QCalc 는 모션 감축·업데이트 확인 생략을 플래그로 했다. SPIN 은 그 둘이 prefs·플랫폼 판정으로 이미 풀린다(§3) |

## 3. `?e2e=1` 과 시드 — 무엇을 어떻게 잠재우나

잡음별 실측. **"시드"** = `localStorage['spin.prefs']`(`prefs.ts:15`) 에 값을 넣는 것.

| 잡음 | 훅 지점 | 처리 |
|---|---|---|
| 부팅·레일 로더(1500/1000ms) | `loader/appLoaderTiming.ts:96-99` `loaderMinMs`, `useAppLoader.ts:60` | 시드 `a11y.reduceMotion: 'always'` → `reduced` 분기로 0. 새 스위치 없음 |
| 스텝 트윈·CSS 모션 | `store/editor/tween.ts:88`, `EditorProvider.tsx:156`, `SettingsProvider.tsx:58-59`(`data-reduce-motion`) | 같은 시드. 재생 시나리오(S7)만 `'system'` 으로 두어 실제 rAF 경로를 돈다 |
| 작은 화면 안내 | `AppShell.tsx:523` | 시드 `smallScreenNoticeDismissed: true` (Pixel 7 은 `SMALL_SCREEN_MIN_PX` 600 미만이라 반드시 뜬다) |
| 첫 방문 [시작하기] | `AppShell.tsx:550` (`firstVisitPromptsEnabled()` 는 `MODE==='test'` 에서만 꺼짐 — 운영 빌드에선 켜져 있다) | 시드 `helpWelcomeSeen: true` |
| 화면별 투어 8종 | `ui/tutorial/useTutorial.ts:126-130`, 시연 자동 전체화면 게이트 `PresentRunner.tsx:180` | 시드 `tutorialsSeen` 에 `TUTORIAL_SCREEN_KEYS`(`prefs.ts:151`) 전부 |
| 시드 드릴 22벌 | `App.tsx:113-121` `SeedDrills`, `storage/seed.ts:75` | 프로필로 고른다 — `seeded: true` 면 빈 서랍, `false` 면 **앱이 스스로** 22벌을 심는다(id·시각 고정이라 `/drills/<id>` 로 바로 연다). IDB 문서를 테스트가 직접 쓰지 않는다 — 스키마를 두 벌 두지 않는다 |
| 소리·진동 | `prefs.ts:165` `a11y.sound` | 시드 `false` |
| 언어 자동 감지 | `prefs.ts` `language: 'auto'`, `App.tsx` `LocaleFromUrl` | 시드 `'ko'` + Playwright `locale: 'ko-KR'`. `/en/…` 진입이 시드를 이기는 것은 S13 이 본다 |
| Drive 동기화 | `sync/useSyncEngine.ts:58` (`prefs.sync.enabled && isSyncConfigured()`) | 기본 꺼짐 — 손댈 것 없음. 네트워크 픽스처가 구글 요청을 감시 |
| 업데이트 확인 | `app/update/useDesktopUpdate.ts:56` (`isTauriWebview()` 아니면 안 돈다) | 웹 층은 무관. **app 층 단계에서** 이 자리에 e2e 플래그 조건을 넣는다 |
| 서비스 워커·분석 | 없음(`rg serviceWorker\|gtag\|analytics` 0건, `vite.config.ts:80` 플러그인은 react 뿐) | 없음 |
| 변경 이력·언어·다운로드 모달 | `AppRail.tsx:310` 등 — 전부 손으로 연다 | 없음 |
| 자동 저장 800ms 디바운스 | `app/useAutosave.ts:13,92` | 끄지 않는다. 다리의 `autosave` 상태로 기다린다 |
| 물리 정착 | `physics/loop.ts:48,77` (`atRest()` 또는 `settleMaxMs`) | 끄지 않는다. 다리의 `busy` 로 기다린다 |

시드 프로필(`fixtures/seed.ts`): **`quiet`**(기본 — 위 도장 전부 + `seeded: true`) · **`scenes`**(quiet 에서
`seeded: false` — 규칙 장면 22벌) · **`fresh`**(아무것도 안 심음 — S3 전용). 시나리오가 `seed: { prefs: {…} }` 로 덮어쓴다.

**`?e2e=1` 이 실제로 하는 일**(앱 코드 변경 최소):
- 새 파일 `src/core/e2eMode.ts` — 모듈 최상위에서 `location.search` 의 `e2e=1` 을 한 번 읽고 `sessionStorage`
  에 걸쇠를 건다(앱 안 이동·새로고침에서 쿼리가 사라져도 유지). `file:`(해시 라우터)에선 `index.html?e2e=1#/`.
- `App.tsx` 의 `NativeBridge`(247-262행)와 같은 꼴로 `E2EBridge` 를 둔다 — 판정이 **동적 import 앞**에 있어
  플래그가 없으면 다리 코드가 실행되지 않는다. 다리는 편집기 트리 안에서 아래를 **읽기 전용**으로 낸다:
  `window.__spinE2E = { objects(): {id, kind, team?, x, y, angleDeg}[], stepIndex, stepCount, playing, busy, autosave }`.
  `busy` = 드래그 중 · 정착 대기 중(`loop.ts:30` `settleDeadline`) · 트윈 진행 중 가운데 하나라도 참.
- 플래그가 없으면 동작이 하나도 안 바뀐다 — 이것을 vitest 케이스 하나로 못박는다(다리 미설치 확인).

## 4. 드라이버 이음매 — `SpinApp`

```
platform · capabilities: 'pointer'|'touch'|'keyboard'|'reload'|'resize'|'download'|'prerender'|'netMock'
seed(state?) · open(route) · reload() · resize(w,h) · step(title, body)
screen()                      현재 화면 키(app-shell 의 data-screen)
courtRot()                    0|90 (court-stage 의 data-rot)
tapCourt(pt) · dragCourt(from, to, {steps?}) · doubleTap(objId) · pressKey(chord)
placeFromTray(kind, pt, {via: 'tap'|'drag', team?})
objects() · objectCenter(id)  모델 자세(다리) · 화면 중심(실제 bbox)
undo() · redo() · addStep() · selectStep(i) · play() · settled()
courtModal.setMode(mode) · courtModal.toggleDefense() · courtModal.toggle('grid'|'ruleZones')
nudge(dir) · openHelp() · setLang(code) · documentLang() · snapshotUi()
exportPng() → {width, height, blankRatio}    (download 능력)
```

**좌표**: 시나리오는 코트 점을 `at(u, v)` — **필드 사각형의 0..1 비율**로 말한다(상수 `PX_PER_M`·여백을
베끼지 않는다). 드라이버가 화면 좌표로 푼다:
1. `[data-testid="court-field"]`(필드 사각형)의 `getBBox()` → 월드 좌표의 필드 상자.
2. `[data-testid="court-world"]`(`CourtStage.tsx:943` 의 `<g>` — 회전 변환이 걸리는 그 그룹)의
   `getScreenCTM()` 으로 월드 → 화면. 역행렬로 화면 → 월드. 줌·팬(`viewBox`, 909행)·90° 회전·UI 배율
   (`#spin-scale` 의 `transform: scale`)이 전부 브라우저가 계산한 행렬 안에 들어 있다.

**판정이 자기증명이 되지 않게** 두 경로를 맞댄다: 누른 화면 점 ↔ `objectCenter(id)`(실제 `#obj-<id>` 의
`getBoundingClientRect` 중심)는 **화면 px** 로, 저장·복원·되돌리기는 `objects()`(모델)로 본다. 앱의
`clientToWorld`(`useStageMetrics.ts:80`)가 회전에서 어긋나면 첫 번째가, 리듀서가 틀리면 두 번째가 빨개진다.

**기다림**: `settled()` = `__spinE2E.busy === false` 이고 `objects()` 가 연속 두 프레임 같을 때. 고정 sleep 금지.
다리가 없는 드라이버(뒤 단계)는 자세 안정 폴링만으로 대신한다. 터치 드래그는 `page.mouse` 가 아니라
CDP `Input.dispatchTouchEvent` 로 보낸다(그래야 `pointerType: 'touch'` 가 된다) — WebKit 에는 없으므로
`touch` 능력은 `chromium-mobile` 만 갖는다.

**선택자**: `data-testid` 를 최소로. 이미 있는 것을 먼저 쓴다 — `#obj-<id>`·`data-shape-id`(개체),
`data-tut="editor-tray|editor-court|editor-playback|editor-step-sidebar|editor-export|library-card|…"`(투어 닻).
aria-label·보이는 문구는 번역되므로 선택자로 쓰지 않는다. 새로 다는 것(약 20개): `app-shell[data-screen]`,
`court-stage[data-rot]`, `court-world`, `court-field`, `tray-item-<kind>[-<team>]`, `fn-undo`, `fn-redo`, `fn-court`,
`court-mode-<mode>`, `court-defense`, `court-toggle-grid`, `court-toggle-rulezones`, `step-add`, `step-card`,
`play-toggle`, `nudge-pad`, `nudge-<dir>`, `onboarding`, `onboarding-next`, `small-screen-notice`, `tutorial-overlay`,
`help-open`, `help-modal`, `lang-<code>`, `export-png`.

> ⚠️ 2단계 구현 때 실제로 단 이름(위 목록과 다른 곳만):
> - `step-add` 는 **새로 달지 않았다** — 맨 뒤 틈에 이미 `data-tut="editor-add-step"` 이 있고(2026-08-30 부터
>   스텝을 늘리는 유일한 길), 그 안의 첫 버튼이 [+]다. "이미 있는 것을 먼저 쓴다" 를 따랐다.
> - 트레이: 휠체어 칩 `tray-item-chair-<home|away>`(같은 팀 칩이 여럿이면 같은 이름 — 드라이버가 첫 칩을
>   쓴다. 팀은 칩에 안 그리는 `ChairSlot.team` 으로만 실린다), 공 `tray-item-ball`, 콘 `tray-item-cone-<0|1>`,
>   도구 `tray-item-<도구 id>`(`select`·`note`·`eraser`·`line`·`freehand`·`shape*`).
> - `court-field` 는 기존 도형에 달 수 없었다(풀=rect, 하프=path, 플랫=선 없음). `CourtStage` 에
>   `def.surface` 를 그리는 **보이지 않는 rect**(fill 없음·포인터 무시)를 하나 더했다. 라인 컴포넌트는
>   내보내기 SVG 와 도형 집합을 맞대는 계약(`courtLines.contract.test.ts`)이 있어 건드리지 않았다.
> - `nudge-<dir>` 의 dir: `up`·`down`·`left`·`right`·`rotateLeft`·`rotateRight`.
> - `lang-<code>` 의 code 에 `auto` 가 하나 더 있다(LanguageModal 의 행 그대로).
> - 다리 `window.__spinE2E` 의 모양은 `src/app/e2e/bridgeContract.ts`(앱·시험이 함께 읽는 타입 전용 파일)에
>   있고 `surface: 'board'|'drill'` 이 더해졌다. `busy` 는 ① 정착 억제 창(`settleHoldUntil`) ② **그려진 자세
>   (TransformWriter 마지막 프레임) ≠ 모델 자세** 로 판정한다 — 드래그·물리 체이스·트윈이 전부 ②의 모양이라
>   물리 루프·트윈 핸들을 밖으로 꺼내는 API 를 새로 만들지 않았다. `autosave` 는 드릴이면 `useAutosave` 의
>   새 `pending`, 전술판이면 localStorage 문자열과 `serializeBoard(present)`(board.ts 로 뽑아낸 직렬화 단일
>   출처)를 견준다.

## 5. 시나리오 17개

프로젝트 약자: **CD** chromium-desktop · **WK** webkit-desktop · **CM** chromium-mobile. 우선순위 P0 > P1 > P2.

| # | P | 시나리오 | jsdom 이 못 재는 이유 | 프로젝트 | 필요한 닻·능력 |
|---|---|---|---|---|---|
| S1 | 0 | 부팅과 직접 진입 — `/` `/drills` `/sessions` `/team` `/rules` `/settings` 를 주소로 열고 새로고침. 콘솔 오류 0, 코트 크기 > 0 | 운영 청크·fallback·실제 레이아웃 | 전부 | `app-shell[data-screen]`, `court-stage` |
| S2 | 0 | 프리렌더 `/rules/<주제>/` · `/en/…` · `/ja/…` — JS 전 원문에 본문이 있고, 넘겨받은 뒤 로더가 글을 덮지 않으며(`prerenderLanding.ts`), `html[lang]` 이 맞고, 장면 재생이 된다 | 프리렌더 산출물과 `createRoot` 인수인계는 빌드에만 있다 | CD WK | `prerender`, `data-tut="rules-play"` |
| S3 | 0 | 첫 방문 순서(`fresh`) — 로더 → (CM: 작은 화면 안내) → [시작하기] → 투어. 어느 순간에도 `aria-modal` 은 하나. 닫고 새로고침하면 안 나온다 | 2026-09-16 T7 사고 — 가짜 시계는 두 effect 를 한 flush 로 묶어 못 봤다(`AppShell.tsx:537-545`) | 전부 | `onboarding`, `small-screen-notice`, `tutorial-overlay` |
| S4 | 0 | 놓기 — 트레이 탭→코트 탭, 트레이 끌어다 놓기. 놓인 자리가 손끝 아래(±3px) | `setPointerCapture`·실제 좌표(`useTrayDrag.ts`), rect 가 0 이 아니어야 한다 | 전부(CM 터치) | `tray-item-*`, 좌표 2종 |
| S5 | 0 | 끌기·되돌리기·다시하기 — 화면 이동량만큼 움직이고, 되돌리면 정확히 원위치 | 진짜 pointermove 열·rAF 변환 쓰기(`transformWriter.ts`) | 전부 | `fn-undo`, `fn-redo` |
| S6 | 0 | 돌아간 코트 — 세로 화면(rot 90)에서 탭·끌기가 손끝을 따르고, 화살표 오른쪽 키가 **화면** 오른쪽으로 민다 | 회전 판정이 뷰포트·크롬 실측에 달렸다(`useStageRot.ts:39`) | CM, CD·WK(`resize` 800×1280) | `court-stage[data-rot]`, `resize` |
| S7 | 0 | 스텝 추가 + 재생(모션 `'system'`) — 2스텝을 만들고 재생하면 끝 자세가 2스텝과 같고 `playing` 이 내려간다 | 실제 rAF·트윈 시계 | 전부 | `step-add`, `step-card`, `play-toggle` |
| S8 | 0 | 새로고침 너머 보존 — 전술판(localStorage `spin.board`)과 드릴(IDB 자동 저장) 둘 다 자세가 그대로 | 진짜 IndexedDB(특히 WebKit)·실제 페이지 수명 | 전부 | `reload`, 다리 `autosave` |
| S9 | 0 | 좁은 창에서도 기능이 남는다 — 900×600(Tauri 최소) · 1099/1100 경계 · 800×1280: 트레이·기능 바·스텝·재생이 뷰포트 안에 있고 가려지지 않으며(`elementFromPoint`) 가로 스크롤이 없다 | `getBoundingClientRect` 가 전부 0 | CD WK(`resize`), CM | `data-tut` 닻들 |
| S10 | 1 | 시드 22벌(`scenes`) — 서랍에 22장, 하나 지우고 새로고침해도 안 살아난다 | 실제 IDB 트랜잭션 + 도장 순서(`App.tsx:113-121`) | CD WK | `data-tut="library-card"` |
| S11 | 1 | 더블탭 미세 조정(2026-11) — 휠체어·공·콘을 더블탭하면 패드가 뜨고 한 번 누르면 한 칸 움직인다. 메모는 패드가 아니라 편집이 열린다 | 실제 두 번 탭의 간격·포인터 열 | CM(터치), CD | `nudge-pad`, `nudge-<dir>` |
| S12 | 1 | PNG 내보내기 — 파일이 내려오고, 풀리며, 크기가 맞고, 한 색이 아니다 | canvas·SVG 래스터화(WebKit 이 다르다) | CD WK | `download`, `export-png` |
| S13 | 1 | 언어 누수 점검 — 설정에서 ko→en→ja, 주요 화면의 보이는 글·aria 이름에 한글이 안 남는다(허용 목록: 고유명·사용자 데이터). `/en/` 진입이 저장된 언어를 이긴다. 도움말 모달 포함 | 화면 전체의 렌더 결과. 소스 grep·키 패리티는 이걸 못 본다 | CD | `snapshotUi`, `lang-<code>`, `help-modal` |
| S14 | 1 | 줌 뒤에도 손끝 — 휠 줌은 커서 아래 점을 붙잡고, 줌·팬 뒤 놓기가 손끝 아래 | 실제 wheel 이벤트·CTM | CD WK | 좌표 2종 |
| S15 | 2 | [진영 바꾸기] 를 따르는 방향(2026-11) — 풀 코트에 놓은 휠체어가 상대 골대를 보고, 바꾼 뒤 놓으면 180° 돈다 | 산술(`placement.ts:133`)은 vitest 가 본다. 여기서 보는 것은 **모달 → 트레이 놓기 배선**뿐 | CD | `fn-court`, `court-defense` |
| S16 | 2 | 판 설정 스위치 — 격자·규칙 구역을 끄면 층이 실제로 사라지고 새로고침 뒤에도 유지. CM 에서 스위치가 화면 안에 있다 | 실제 가시성·모달이 작은 화면에 들어가는가 | CD CM | `court-toggle-*` |
| S17 | 2 | 끌어서 밀기 — 휠체어를 다른 휠체어로 밀면 밀려나고, 정착 뒤 겹치지 않으며 코트 밖으로 안 나간다 | 실제 이벤트 주기 위의 Matter.js 루프(수치 자체는 vitest) | CD WK | `settled` |

안 넣는 것: 공유 링크(서버 필요) · Drive 동기화(OAuth) · MP4 내보내기(코덱 편차) · 시연 전체화면(헤드리스 불가) —
실기 목록(`docs/FIELD-TEST.md`)에 남는다. 3프로젝트 합계 약 41 시험.

## 6. 실행기 · 요약 · 스킬 · CI

- **`scripts/test-suite.sh`** — `--layer code|web|app`(여러 번, 기본 code+web) · `--setup` · `--rebuild` ·
  `-- <playwright 인자>`. code 층 = `npm run lint` → `npm run typecheck` → `npm test -- --reporter=default
  --reporter=json --outputFile.json=test-results/vitest.json` → `cargo test --manifest-path src-tauri/Cargo.toml`
  (cargo 없으면 skip 으로 기록). 린트는 종료 코드만 본다(경고 48건 기준선은 실패가 아니다).
  - ⚠️ 1단계 구현 때 더함: **`--no-cargo`**(skip 으로 기록). `target/` 이 없는 작업 트리(git worktree 등)
    에서는 cargo test 가 Tauri 크레이트 트리 전체를 처음부터 컴파일해 수 분이 든다 — 웹만 고친 회차가
    그 값을 치를 이유가 없다. 기본값은 그대로 cargo 를 돈다.
- **`package.json`**: `test:all` = `bash scripts/test-suite.sh`, `test:e2e` = `playwright test`. 짝 `_comment:` 키를
  함께(AGENTS §6). devDependency 는 `@playwright/test` 하나.
- **`scripts/test-summary.mjs`** → `test-results/summary.md`(30줄 이하: 돌린/안 돌린 층, 층·프로젝트별 수, 실패·
  known-bug 목록) + `summary.json`. 실행 시작 때 지우고 끝에 새로 쓴다. 실패가 있으면 종료 코드 1.
- **곁가지**: `tsconfig.e2e.json` 을 루트 `tsconfig.json` references 에 추가(`npm run typecheck` 가 e2e 도 본다),
  `.gitignore` 에 `test-results/`·`playwright-report/`. vitest `include`(`vite.config.ts:126`)는 `src/`·`server/`
  뿐이라 `e2e/` 와 안 섞인다. 새 파일 전부 한국어 머리말 주석(AGENTS §1.1).
- **스킬 `.claude/skills/spin-test/SKILL.md`** — 명령 표 · 결과 읽는 순서(summary.md 먼저, 실패만 trace) · 실패
  분류(환경 → 플레이키 `--repeat-each=3` → 진짜 회귀 → known-bug 뒤집힘) · known-bug 졸업 절차 · 시나리오 추가
  규칙(§0 질문 + 돌연변이 + 3프로젝트 `--repeat-each=3`) · 모델 배분(돌리기 = LLM 불필요, 실패 분류 opus,
  시나리오 작성 sonnet → 검토 opus).
- **`.github/workflows/ci.yml`** — `on: push: branches [devel]` + `pull_request: branches [devel, main]`,
  `permissions: contents: read`, `concurrency: ci-${{ github.ref }}`(PR 만 진행 중 취소). 잡 셋: `code`(npm ci →
  lint → typecheck → test), `web-e2e`(Playwright 버전 키로 브라우저 캐시 → `npx playwright install --with-deps
  chromium webkit` → `scripts/test-suite.sh --layer web` → summary.md 를 `$GITHUB_STEP_SUMMARY` 에 → 실패 때만
  보고서 업로드 7일), `cargo-test`(`src-tauri/**` 가 바뀐 push/PR 에서만 — 첫 단계가 변경 경로를 보고 건너뛴다).
  시크릿을 하나도 안 쓴다 — 포크 PR·Dependabot PR 에서도 그대로 돈다.
- **시간 예산**: 로컬 code 층 약 2~3분(vitest 가 대부분, cargo 는 캐시가 있으면 10초대) · web 층 빌드 14초 +
  41 시험 약 1~2분 → **합계 5분 이내**. CI 는 설치 포함 code 4분 · web-e2e 6분(병렬). web 층이 3분을 넘기면
  시나리오를 늘린 것이 아니라 기다림이 잘못된 것이다.

## 7. 착수 순서 — 단계·모델·커밋

모델은 AGENTS §10. 검증은 구현보다 한 단계 위.

| 단계 | 커밋 | 내용 | 구현 | 검증 |
|---|---|---|---|---|
| 1 | `build(e2e): Playwright 골격 — 정적 서버·실행기·요약·S1 (PLAN-TEST-SUITE §2·§6)` | 의존성, 설정, `serve.mjs`, 픽스처, `run.ts`, `kit.ts` 뼈대, `SpinApp` 최소형, 실행기·요약, S1. AGENTS.md 에 E2E 규칙 절(같은 커밋 — 머리말의 규율) | opus | fable |
| 2 | `feat(app): e2e 모드와 읽기 전용 다리 · data-testid (§3·§4)` | `core/e2eMode.ts`, `E2EBridge`, 닻 약 20개, "플래그 없으면 무변화" vitest 1건, DESIGN.md 계약 한 줄 | opus | fable |
| 3 | `test(e2e): 코트 좌표 드라이버와 핵심 흐름 S3–S8 (§4·§5)` | CTM 좌표·터치(CDP)·`settled`, P0 시나리오. **가장 어려운 단계** — 3프로젝트 `--repeat-each=5` | opus | fable |
| 4 | `test(e2e): 레이아웃·프리렌더 S2·S9 (§5)` | `resize`·`prerender` 능력 | sonnet | opus |
| 5 | `test(e2e): 기능 시나리오 S10–S17 (§5)` | 패턴이 선 뒤라 쉬움. S12(PNG)만 opus 로 올린다 | sonnet | opus |
| 6 | `chore: spin-test 스킬과 PR CI (§6)` | 스킬, `ci.yml`, `e2e/README.md`, CONTRIBUTING 한 줄 | sonnet | opus |

각 커밋 본문 끝줄: `typecheck 0 · lint 경고 48(기존) · vitest N 통과 · e2e N 통과(3프로젝트) · 돌연변이 N건으로 실효 확인`.
push 는 지시가 있을 때만. 뒤 단계(자리표시): Tauri Linux(xvfb + tauri-driver/WebdriverIO 로 `SpinApp` 구현,
`useDesktopUpdate.ts:56` 에 플래그) → Windows 러너 → Android 디버그 APK(Playwright `_android`).

## 8. 위험

| 위험 | 대응 |
|---|---|
| **WebKit 포인터** — `setPointerCapture`·`pointercancel` 순서가 Chromium 과 다르고 터치 에뮬레이션이 없다. Ubuntu 에선 `libmanette` 없으면 아예 안 뜬다 | WK 는 마우스 포인터만, 터치는 CM. 차이로 실패하면 시험을 약하게 고치지 않고 `knownBug` + `symptom`. `--setup` 이 라이브러리 우회 |
| **`getScreenCTM()` 이 조상의 CSS `transform`(UI 배율)을 엔진마다 다르게 반영** | 3단계 첫 작업으로 "눌러서 놓은 자리 == bbox 중심" 을 3프로젝트에서 실증. 어긋나는 엔진이 있으면 그 프로젝트만 시드 `a11y.uiScale` 을 100% 고정으로 내리고 사유를 README 에 적는다 |
| **Matter.js·rAF 타이밍** — 정착 시점이 프레임에 달렸다 | `settled()`(다리 `busy` + 두 프레임 동일) 하나로만 기다린다. 자세 비교는 정확값이 아니라 허용 오차(화면 3px / 모델은 왕복 동일성). `retries: 0` 유지 |
| 자동 저장 800ms 안에 새로고침 | S8 은 `autosave === 'saved'` 를 기다린 뒤 새로고침. "기다리지 않으면 잃는가" 는 발견되면 knownBug 로 따로 적는다 |
| 빌드 낡음 — 낡은 `dist/` 로 초록 | `serve.mjs` 가 입력 mtime 을 비교(§2), `reuseExistingServer: false`. 프리렌더 포함 14초라 비용은 작다 |
| 다리가 운영 번들에 실린다 | 동적 import + 플래그 판정 선행. 읽기 전용. vitest 1건이 미설치를 못박는다 |
| 닻 20개가 번역·리팩터에 쓸려 나간다 | 닻 이름은 `e2e/README.md` 「선택자 규칙」이 정본, S1 이 핵심 닻 존재를 본다 |
| 시나리오가 변경 감지기로 자란다 | 문구·개수·순서 단언 금지(AGENTS 「테스트 작성 규칙」). 추가 때 §0 질문 + 돌연변이 |

## 9. 실기 확인(이 스위트가 대신하지 못하는 것)

실제 WebView2·WebKitGTK·Android WebView 의 차이, 태블릿 손가락 정확도, 소리·진동, 전체화면·화면 꺼짐 방지,
OAuth. 이 스위트는 그것들의 **근사**다 — 화면에 보이는 것을 바꿨으면 여전히 `http://100.75.15.13:5173/` 에서 본다.
