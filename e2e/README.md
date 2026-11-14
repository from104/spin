# SPIN 자동 테스트 (e2e)

LLM 없이 한 명령으로 무인 실행한다. 같은 **시나리오**를 웹 빌드·Tauri·Android 에서 돌리는 것이 목표이고, 지금은 운영 웹 빌드
위의 Playwright 드라이버(web 층)가 있다. 설계 정본은 `docs/PLAN-TEST-SUITE.md`, 관행은 `AGENTS.md` 「E2E 시나리오 규칙」,
돌리고 읽는 요령은 스킬 `.claude/skills/spin-test/SKILL.md`. (QCalc `feature/e2e-suite` 의 스위트를 SPIN 에 맞게 각색했다.)

```bash
npm run test:all                                 # = scripts/test-suite.sh : code + web
scripts/test-suite.sh --setup                    # 처음 한 번: Playwright 브라우저(chromium, webkit) 설치
scripts/test-suite.sh --layer web                # e2e 만
scripts/test-suite.sh --layer web -- --repeat-each=3 --project=webkit-desktop   # -- 뒤는 playwright 인자
scripts/test-suite.sh --no-cargo                 # 로컬 전용: cargo test 건너뛰기(CI 는 늘 돈다)
npm run test:e2e -- -g "S9"                      # playwright 직접
npx playwright show-trace test-results/e2e-artifacts/<시험>/trace.zip   # 실패 추적 열기
```

결과는 `test-results/summary.md`(30줄 이하, 실행 시작 때 지우고 끝에 새로 씀) · `summary.json` · `e2e-junit.xml` · 단계별 `*.log`,
HTML 보고서는 `playwright-report/`. 추적·스크린샷은 **실패한 시험만** 남는다. 실패가 있으면 종료 코드 1, 같은 작업 트리에서
이미 돌고 있으면 3(`test-results/.run.lock`). 린트는 경고 수가 기준선(`scripts/test-suite.sh` 의 `LINT_BASELINE`, 한 곳)을 넘으면 실패한다.

## 층(layer)

| 층 | 내용 |
|---|---|
| `code` | `npm run lint`(기준선 판정) · `npm run typecheck` · vitest · `cargo test`(src-tauri, cargo 가 있고 `--no-cargo` 가 아닐 때) |
| `web` | 운영 웹 빌드(`npm run build` → `dist/`, 프리렌더 포함)를 정적 서버로 띄워 Playwright 3프로젝트 |
| `app` | 실제 앱(Tauri·Android) — 아직 없다 |

웹 프로젝트(`playwright.config.ts`) — 실제 셸의 **근사**다(실기 대체가 아니다)

| 프로젝트 | 근사 대상 | 능력 |
|---|---|---|
| `chromium-desktop` | Windows WebView2 (1280×800) | pointer keyboard reload resize download prerender netMock |
| `webkit-desktop` | Linux WebKitGTK · Safari (1280×800) | 위와 같음(터치 에뮬레이션 없음) |
| `chromium-mobile` | Android WebView (Pixel 7 세로, 터치) | touch keyboard reload netMock |

빌드 재사용: `e2e/support/serve.mjs` 가 빌드 입력의 지문(경로·mtime·크기 해시, `dist/.e2e-inputs`)이 바뀌었을 때만 다시 빌드한다
(로그 `test-results/e2e-build.log`, 약 15초). 강제는 `--rebuild`/`E2E_REBUILD=1`, 포트는 `E2E_PORT`(기본 4179).

## 구조

```
playwright.config.ts          프로젝트 3개, webServer(serve.mjs), 보고서
e2e/
  drivers/SpinApp.ts          드라이버 중립 인터페이스 + Capability (시나리오는 이것만 안다)
  drivers/PlaywrightApp.ts    Playwright Page 구현
  scenarios/kit.ts            시나리오 형식 · eventually/check/expectQuiet · 코트 좌표 도구(at·expectNear·poseKey)
  scenarios/<그룹>.ts         시나리오 그룹 (boot firstRun court steps persist prerender layout library nudge language zoom court.modal push)
  web/<그룹>.spec.ts          3줄짜리 스펙 — runGroup(그룹)
  web/run.ts                  그룹 → Playwright 시험 (needs 검사·skip·knownBug/symptom)
  fixtures/test.ts            Playwright test 확장: capabilities 옵션, app 픽스처(외부 요청 차단·대화 상자 감시)
  fixtures/seed.ts            localStorage 시드 프로필(quiet · scenes · fresh)
  fixtures/network.ts         127.0.0.1 밖으로 나가려는 요청을 끊고 기록
  support/serve.mjs           빌드(필요할 때) + dist/ 정적 서버(운영 vhost 응답 순서 흉내, `/__e2e__/blank`)
scripts/test-suite.sh         층 실행기,  scripts/test-summary.mjs  요약 작성
```

## 시나리오 지도

| # | 그룹 | 보는 것 | 프로젝트 |
|---|---|---|---|
| S1 | boot | 여섯 주소 직접 진입·새로고침 | 전부 |
| S2 | prerender | 프리렌더 착지 ko·en·ja — JS 이전 원문·넘겨받은 뒤 로더·`html[lang]`·장면 재생 | CD WK |
| S3 | firstRun | 첫 방문 순서(로더 → 안내 → [시작하기] → 투어)·`aria-modal` 하나 | 전부 |
| S4–S6 | court | 놓기·끌기·되돌리기·돌아간 코트 | 전부(S6 은 창 회전) |
| S7 | steps | 스텝 추가+재생, 접힌 스텝 목록(S7b·S7c 는 known-bug) | 전부 |
| S8 | persist | 새로고침 너머 보존(전술판·드릴), 화면 자리까지 | 전부 |
| S9 | layout | 좁은 창 900×600·1099/1100·800×1280 — 닻이 뷰포트 안·가려지지 않음·가로 스크롤 없음 | 전부 |
| S10 | library | 시드 서랍과 지운 시드가 되살아나지 않음 | 전부 |
| S11 | nudge | 더블탭 미세 조정 패드·한 번 = 한 칸·메모는 글 열기 | 전부 |
| S12 | export | PNG 내보내기 — 내려온 파일을 Node 에서 직접 풀어(`e2e/support/png.ts`) 서명·긴 변 2048·불투명·한 색 아님, 휠체어 놓기 전후 차이가 놓은 쪽에 한 덩이 | CD WK |
| S13 | language | en·ja 화면에 한글이 없다(S13c 전술판은 known-bug — 알려진 누수 밖의 한글은 진짜 실패), `/en/` 이 저장 언어를 이김 | 전부(좁은 창은 머리띠의 언어 단추) |
| S14 | zoom | 휠 줌이 커서 밑 점을 붙들고, 빈 코트 더블클릭 뒤 끌기(팬)가 끈 만큼 판을 밀며, 줌·팬 뒤 놓기가 손끝 아래 | CD WK |
| S15 | court.modal | [진영 바꾸기] 가 놓는 방향을 따른다 | CD WK |
| S16 | court.modal | 격자·규칙 구역 스위치가 층을 지우고 새로고침 뒤에도 유지, 스위치가 화면 안 | 전부 |
| S17 | push | 물리·상호작용을 켠 채 휠체어로 휠체어를 밀기 | CD WK |

## 선택자 규칙 — 닻 목록

선택자는 **`data-testid`·기존 투어 닻(`data-tut`)·개체 id(`#obj-<id>`)** 만 쓴다. aria-label·보이는 문구는 번역되므로 선택자로 쓰지
않는다. 이 목록이 정본이다 — 닻을 지우거나 이름을 바꾸면 S1 과 해당 시나리오가 빨개진다(리팩터가 닻을 쓸어 가는 것을 막는 안전망).

**`data-testid`**

| 영역 | 닻 |
|---|---|
| 셸·화면 | `app-shell`(`data-screen`) · `court-stage`(`data-rot`) · `court-world` · `court-field` |
| 트레이 | `tray-item-chair-<home\|away>` · `tray-item-ball` · `tray-item-cone-<0\|1>` · `tray-item-<도구 id>`(`select`·`note`·`eraser`…) |
| 기능 바·모달 | `fn-undo` · `fn-redo` · `fn-court` · `court-modal` · `court-mode-<mode>` · `court-defense` · `court-toggle-grid` · `court-toggle-rulezones` · `court-toggle-interact` |
| 그림 층 | `layer-grid` · `layer-rulezones` |
| 스텝·재생 | `step-card` · `step-list-toggle` · `play-toggle` |
| 미세 조정 | `nudge-pad` · `nudge-<up\|down\|left\|right\|rotateLeft\|rotateRight>` |
| 메모 | `note-edit-modal` · `note-save` |
| 서랍 | `drill-delete` · `confirm-dialog` · `confirm-ok` |
| 첫 방문·도움말 | `onboarding` · `onboarding-next` · `small-screen-notice` · `tutorial-overlay` · `help-open` · `help-modal` |
| 언어·내보내기 | `lang-open` · `lang-<auto\|ko\|en\|ja>` · `export-png` |

**`data-tut`(기존 투어 닻)**: `library-card` · `library-card-menu` · `rules-play` · `editor-tray` · `editor-court` ·
`editor-functionbar` · `editor-playback` · `editor-step-sidebar` · `editor-add-step` · `editor-export` · `header-primary`.

**다리 `window.__spinE2E`** (`?e2e=1` 일 때만 서는 읽기 전용, 모양은 `src/app/e2e/bridgeContract.ts`):
`surface`('board'|'drill') · `objects()`(휠체어·공·콘의 모델 자세) · `stepIndex`·`stepCount`·`playing` · `busy` · `autosave`.
`busy` 와 `autosave` 로 기다린다 — 고정 sleep 은 없다.

**좌표**: 코트 점은 `at(u, v)` — 경기면(`court-field`) 사각형의 0..1 비율. 드라이버가 `court-world` 의 `getScreenCTM()` 으로 화면 좌표로
푼다(줌·팬·90° 회전·UI 배율이 브라우저 행렬 안에 있다). 판정은 두 경로를 맞댄다 — 누른 화면 점 ↔ 개체의 실제 bbox 중심(px),
저장·복원·되돌리기는 모델 자세(`objects()`).

## 시나리오 쓰는 법

1. `e2e/scenarios/<그룹>.ts` 에서 `defineGroup('<그룹>', [...])` 을 default export 한다. 시나리오 하나 = 시험 하나.
2. 시나리오는 `{ title, needs?, seed?, knownBug?+symptom?, run(app) }`. **Playwright 를 import 하지 않는다** — `SpinApp` 메서드와
   `kit.ts` 도구만 쓴다. 그래야 Tauri·Android 드라이버에서 그대로 돈다.
3. `needs` 에 필요한 능력을 적는다. 드라이버에 없으면 실행기가 건너뛰고 이유를 보고서에 남긴다.
4. 앱은 실행기가 `app.seed(scenario.seed)` 로 띄운다. 프로필은 `quiet`(기본, 첫 실행 잡음 전부 잠재움·빈 서랍) ·
   `scenes`(규칙 장면을 앱이 스스로 심음) · `fresh`(아무것도 안 심음). `seed: { prefs: {…} }` 로 덮어쓴다.
5. 화면 단언은 전부 기다리며 확인한다 — `eventually(label, read, expected)`, 편집 뒤에는 `app.settled()`. 고정 sleep 금지.
6. 머리말에 "지우면 어떤 실기 버그가 새는가" 를 쓴다. 새 단언은 돌연변이로 증명한다(스킬 `spin-test` 「시나리오 추가」).
7. 드라이버에 기능이 더 필요하면 `SpinApp` 에 메서드를 더하고 `PlaywrightApp` 에 구현한다. 드라이버 고유 기능이면 Capability 를 더한다.

**앱 버그로 실패하면 시험을 약하게 고치지 않는다.** `knownBug: '<버그 설명>'` 과 `symptom: /<오류 메시지 정규식>/` 을 함께 적는다.
시나리오는 그대로 실행되고 실패하면 기대된 실패(요약에 `known-bug` 로 집계), **통과하면 빨갛게** `bug fixed — remove the known-bug mark`.
고친 사람이 그 표시를 지운다. 증상이 벽시계(두 입력 사이 N ms)에 기대면 안 된다. 목록: `grep -rn knownBug e2e/scenarios`.

## 이 스위트가 대신하지 못하는 것

실제 WebView2·WebKitGTK·Android WebView 의 차이, 태블릿 손가락 정확도, 소리·진동, 전체화면·화면 꺼짐 방지, OAuth, 공유 링크(서버),
Drive 동기화, MP4 내보내기(코덱 편차), 시연 전체화면 — 실기 목록(`docs/FIELD-TEST.md`)에 남는다. 화면에 보이는 것을 바꿨으면
여전히 `http://100.75.15.13:5173/` 에서 본다.
