# SPIN 자동 테스트 (e2e)

LLM 없이 한 명령으로 무인 실행한다. 같은 **시나리오**를 웹 빌드·Tauri·Android 에서 돌리는 것이 목표이고, 지금은 운영 웹 빌드
위의 Playwright 드라이버(web 층)와 실제 Tauri 앱 위의 WebDriver 드라이버(app 층, Linux — Windows 는 CI 전용)가 있다. 설계 정본은 `docs/PLAN-TEST-SUITE.md`, 관행은 `AGENTS.md` 「E2E 시나리오 규칙」,
돌리고 읽는 요령은 스킬 `.claude/skills/spin-test/SKILL.md`. (QCalc `feature/e2e-suite` 의 스위트를 SPIN 에 맞게 각색했다.)

```bash
npm run test:all                                 # = scripts/test-suite.sh : code + web
scripts/test-suite.sh --setup                    # 처음 한 번: Playwright 브라우저(chromium, webkit) 설치
scripts/test-suite.sh --layer web                # e2e 만
scripts/test-suite.sh --layer web -- --repeat-each=3 --project=webkit-desktop   # -- 뒤는 playwright 인자
scripts/test-suite.sh --no-cargo                 # 로컬 전용: cargo test 건너뛰기(CI 는 늘 돈다)
npm run test:e2e -- -g "S9"                      # playwright 직접
npx playwright show-trace test-results/e2e-artifacts/<시험>/trace.zip   # 실패 추적 열기
scripts/test-suite.sh --layer app                # 실제 Tauri 앱 (이 기계의 OS — Linux: Xvfb 안, 사용자 세션·프로필 무관)
npm run test:e2e:app -- -g "N4"                  # app 층 playwright 직접 (바이너리: node e2e/app/build.mjs)
scripts/test-suite.sh --layer app --artifact v0.6.13   # 배송된 AppImage·latest.json·서명 (draft = 가장 새 초안)
```

결과는 `test-results/summary.md`(30줄 이하, 실행 시작 때 지우고 끝에 새로 씀) · `summary.json` · `e2e-junit.xml` · 단계별 `*.log`,
HTML 보고서는 `playwright-report/`. 추적·스크린샷은 **실패한 시험만** 남는다. 실패가 있으면 종료 코드 1, 같은 작업 트리에서
이미 돌고 있으면 3(`test-results/.run.lock`). 린트는 경고 수가 기준선(`scripts/test-suite.sh` 의 `LINT_BASELINE`, 한 곳)을 넘으면 실패한다.

## 층(layer)

| 층 | 내용 |
|---|---|
| `code` | `npm run lint`(기준선 판정) · `npm run typecheck` · vitest · `cargo test`(src-tauri, cargo 가 있고 `--no-cargo` 가 아닐 때) |
| `web` | 운영 웹 빌드(`npm run build` → `dist/`, 프리렌더 포함)를 정적 서버로 띄워 Playwright 3프로젝트 |
| `app` | 실제 Tauri 앱 — 디버그 바이너리(`tauri build --debug --no-bundle`, 웹 층과 같은 `dist/` 를 품는다)를 Xvfb 안에서 tauri-driver + WebKitWebDriver 로 (아래 「app 층」). 기본 층이 아니다(`--layer app`) |

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
  drivers/page-functions.ts   페이지 안에서 도는 판정(준비·정착·좌표·가림) — 두 드라이버가 같은 함수를 쓴다
  drivers/webdriver.ts        W3C WebDriver 최소 클라이언트(노드 fetch — WebdriverIO 를 안 쓰는 까닭은 머리말)
  drivers/WdioApp.ts          SpinApp 의 WebDriver 구현 — 실제 앱용
  app/                        app 층 (playwright.app.config.ts 가 실행기)
    build.mjs                 디버그 바이너리를 필요할 때만 → src-tauri/target/e2e-app/spin (입력 지문)
    env-linux.ts              격리 데스크톱: Xvfb · 사설 D-Bus · gnome-keyring · 임시 HOME/XDG · tauri-driver
    env-windows.ts            Windows(CI 전용): 러너 데스크톱 · msedgedriver · 앱 폴더 두 개만 지우기
    procs.ts · procs-win.ts   실행 표지(SPIN_E2E_RUN)/PID 로 우리 프로세스만 찾고 끝낸다
    global-setup.ts           격리 데스크톱을 한 번 띄우고(연기 시험 포함) teardown 에서 정리
    session.ts                WebDriver 세션 = 앱 프로세스 하나 (재실행 · 창 닫기 · 프로필 비우기)
    tauri-app.ts              TauriApp = WdioApp + invoke · X 창 · 프로필 파일 · 앱 로그
    fixtures.ts · run.ts      Playwright 픽스처(앱 하나를 시험끼리 재사용) · 그룹 → 시험(only 로 부분집합)
    shared.spec.ts            공유 시나리오 부분집합 S1·S4·S5·S5b·S7·S8a·S8b
    native.ts · native.spec.ts  앱 전용 시나리오 N1–N7
    sweep-windows.mjs         Windows 의 남은 PID 쓸기
    artifact.mjs              산출물 모드 준비: 릴리스 자산 받기 · AppImage 풀기 · launch.sh(/dev/dri 가림)
    artifact.spec.ts          산출물 모드 시험: R1–R3(latest.json·서명) + N1–N3
    minisign.ts · xwd.ts      서명 검증(BLAKE2b-512 + Ed25519) · X 화면 화소(xwd -root)
playwright.app.config.ts      app 층 설정 (workers 1, 프로젝트 tauri-linux / tauri-windows)
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

## app 층 (실제 Tauri 앱, Linux)

```
scripts/test-suite.sh --layer app        # = --platform <이 기계의 OS>. windows 는 Windows 호스트(CI)에서만, 그 밖은 skip
  1. app build   node e2e/app/build.mjs — dist/(serve.mjs --build-only, 웹 층과 같은 운영 빌드) + `tauri build --debug --no-bundle`
                 (beforeBuildCommand 끔, 서명 없음). 입력 지문이 바뀌었을 때만 — 첫 빌드 약 1분 30초(빈 target/), 그 뒤 재사용 0초 ·
                 변경 시 약 10초. 강제: --rebuild. 로그 app-build-tauri.log
  2. app linux   npx playwright test -c playwright.app.config.ts  (-- 뒤 인자 전달)
  3. app cleanup 이번 실행 표지를 가진 프로세스가 남았는지 확인 — 남았으면 끝내고 fail
```

- **사용자 데이터를 절대 건드리지 않는다.** 진짜 프로필 `~/.local/share/app.atit.spin` 에는 구글 갱신 토큰과 IndexedDB 가 있다. env-linux.ts 가
  `HOME`·`XDG_CONFIG_HOME`·`XDG_DATA_HOME`·`XDG_CACHE_HOME`·`XDG_RUNTIME_DIR` 를 `/tmp/spin-e2e-app-*` 아래로 돌리고(끝나면 삭제 —
  남기려면 `E2E_KEEP_PROFILE=1`) 시작 때 다섯이 다 그 안인지 다시 본다. N6(갱신 토큰)은 쓰기 **전에** 앱에게 app_data_dir 를 물어 격리 프로필이
  아니면 멈춘다.
- **격리 세션**: Xvfb(1920×1080, `-displayfd`) · 사설 D-Bus 세션 · 그 위의 `gnome-keyring-daemon --unlock --components=secrets`(없으면 포털이
  org.freedesktop.secrets 를 120초 기다려 세션 생성이 죽는다) · `WAYLAND_DISPLAY` 지움 + `GDK_BACKEND=x11`(안 주면 GTK3 가 `wayland-0` 을 스스로
  찾아 창이 사용자 데스크톱에 뜬다) · 소프트웨어 렌더 env(Mesa EGL·`LIBGL_ALWAYS_SOFTWARE`·합성/DMA-BUF/샌드박스 끔 — NVIDIA 호스트에서 시스템
  WebKit 이 Xvfb 에 그리는 조합, **시험 전용**) · `APPIMAGE`·`APPDIR`·`GTK_IM_MODULE` 등 지움.
- **프로세스**: 모두 `SPIN_E2E_RUN=<토큰>` 을 물려받는다. 정리는 이름·패턴이 아니라 이 토큰을 가진 것만(`pkill` 금지). 실행기가 죽어도 다음 실행/
  같은 실행 끝의 `app cleanup` 이 `test-results/.app-run.json` 의 토큰으로 쓸어 낸다.
- **세션 하나 = 앱 프로세스 하나**를 시험끼리 재사용(workers 1). 시험마다 `seed` 는 같은 출처의 정적 파일(`/favicon-32.png`)로 가서 저장소를
  비우고 심은 뒤 `tauri://localhost/…?e2e=1` 로 연다. 시험이 앱을 끄거나 창 크기를 바꾸면 픽스처가 다음 시험 전에 새 프로필로 다시 띄운다.
- **능력**: `pointer`·`keyboard`(WebDriver 입력 동작 — WebKit 이 GTK 이벤트로 합성) · `reload` · `xwindow`(xwininfo·xprop, Linux 만).
  없는 것: `touch` · `resize`(앱 최소 900×600 아래로 못 줄인다) · `netMock` · `download`(저장은 네이티브 대화 상자) · `prerender` · 대화 상자 첫 방문
  기록(WebDriver classic 에는 문서보다 먼저 심는 스크립트가 없다). 콘솔 오류는 문서가 **준비된 뒤부터** 문서 안 기록기로 모은다.
- **누르기**: 페이지 안에서 "보이고·멈췄고·자기 중심에서 맨 위" 일 때까지 기다려 그 중심에 포인터 동작을 보낸다(`hitPointInPage` — Playwright
  click() 의 판정과 같은 뜻). 끌기는 이동마다 한 프레임씩 쉰다(웹 드라이버와 같다).
- **앱 종료**: WebDriver 세션 종료는 앱을 죽인다. 재실행 보존(N4)은 `closeWindow()` — 사람이 창을 닫는 것처럼 마지막 창을 닫아 정상 종료시킨다.
- **업데이터**: N3 은 `plugin:updater|check` **만** 부른다. 받기·설치는 절대 부르지 않는다(deb 판의 설치는 `pkexec dpkg -i` 로 사용자 세션에 암호
  창을 띄울 수 있다). 앱도 뜬 뒤 4초에 스스로 확인한다 — 지금 판이 최신보다 옛것이면 안내 띠가 뜨지만 시험은 그것을 누르지 않는다.
- **실패 읽기**: summary.md → `test-results/app-html-report/`(실패 시험의 스크린샷 + 앱 로그 끝) → 환경 로그 `test-results/app-{xvfb,dbus,keyring,driver,
  driver-stderr}.log`(앱의 stderr 는 driver-stderr). `app-exited` 주석 = 시험 뒤 앱이 죽어 있었다. 연기 시험(globalSetup 이 세션을 한 번 열어 봄)이
  실패하면 층 전체가 바로 멈추고 드라이버 로그 끝을 보인다.
- **필요한 것**: `Xvfb` · `dbus-daemon` · `gnome-keyring-daemon` · `WebKitWebDriver`(apt `webkit2gtk-driver`) · `xwininfo`/`xprop`(x11-utils) ·
  `tauri-driver`(`cargo install tauri-driver --version 2.1.0 --locked`). 없으면 globalSetup 이 무엇이 없는지 말하고 실패한다.
- **CI**: `.github/workflows/e2e-app.yml` — 야간(03:30 KST)·수동·`workflow_call`, linux(ubuntu-22.04)·windows 잡. PR 게이트에는 없다.

### app 층 — 산출물 모드 (배송된 AppImage)

`--artifact <태그 | draft | AppImage 경로>` 는 굽지 않고 **배송된 AppImage**(자동 업데이트가 내려보내는 파일 — 번들 WebKit·라이브러리째)를
띄운다. `e2e/app/artifact.mjs` 가 릴리스를 목록에서 찾아(초안은 `GET /releases/tags/{tag}` 가 404 라서) latest.json·`*.sig`·AppImage·deb·rpm 을
자산 id 로 받고(`gh` — 초안은 쓰기 권한 토큰), `--appimage-extract` 로 풀고, 껍데기 `launch.sh` 를 쓴다(캐시 `src-tauri/target/e2e-release/<태그>/`,
명세 `test-results/.app-artifact.json`). 시험은 `e2e/app/artifact.spec.ts` 하나:

| 시험 | 보는 것 |
|---|---|
| R1 | latest.json 의 version = 태그, 모든 플랫폼 주소가 `…/releases/download/<태그>/<자산>` 이고 그 자산이 릴리스에 있다 |
| R2 | 리눅스 묶음(AppImage·deb·rpm)의 서명이 `tauri.conf.json` 의 `plugins.updater.pubkey` 로 풀린다(minisign: BLAKE2b-512 + Ed25519, 전역 서명까지 — `e2e/app/minisign.ts`). 판정자 자체 검증: AppImage 를 deb 의 서명으로 풀면 **떨어져야** 한다 |
| R3 | 나머지 플랫폼(MSI·NSIS·macOS)의 latest.json 서명 = 올린 `<자산>.sig` |
| N1–N3 | AppImage 가 판을 그리고(X 화면 화소), `plugin:app|version` = 태그, `plugin:updater|check` 가 던지지 않는다(받기·설치 절대 안 함) |

- **NVIDIA 호스트**: 번들 Mesa 가 /dev/dri 의 NVIDIA 렌더 노드를 집어 아무것도 못 그린다 — `bwrap --dev-bind / / --tmpfs /dev/dri -- AppRun` 으로
  가린다(gofu). /dev/dri 가 없거나(GitHub 러너) bwrap 이 안 돌면 안 가린다. 강제 `E2E_APP_DRI_MASK=1`, 끄기 `=0`.
- **N1 은 X 서버 화소**(`xwd -root`, e2e/app/xwd.ts)로 본다 — 번들 WebKit 은 한 번 이동한 뒤 WebDriver 스크린샷이 영영 안 돌아온다(gofu 실측,
  첫 문서에서는 0.5초). 구운 바이너리 회차도 Linux 에서는 같은 길이다.
- **CI**: `desktop-release.yml` 의 `artifact-check` 잡(태그 푸시, build 뒤)이 초안에 같은 검사를 돌린다 — 빨가면 초안을 공개하지 않는다.
  아무것도 올리지 않는다. 다음 태그 푸시에서 처음 진짜로 검증된다.

### app 층 — Windows (CI 전용)

`e2e-app.yml` 의 `windows` 잡이 `scripts/test-suite.sh --layer app --platform windows` 를 Git Bash 에서 돈다(로컬 Linux 에서는 skip).
tauri-driver `--native-driver msedgedriver.exe`(WebView2 와 같은 판 — 워크플로가 msedgedriver-tool 로 받아 `SPIN_E2E_NATIVE_DRIVER` 에)
→ 앱(WebView2, 출처 `http://tauri.localhost`). Tauri/WebView2 는 앱 폴더를 Known Folder API 로 찾아 격리할 수 없어서 `CI=true`(또는
`SPIN_E2E_ALLOW_REAL_PROFILE=1`)가 아니면 시작을 거부하고, `%APPDATA%\app.atit.spin`·`%LOCALAPPDATA%\app.atit.spin` 두 폴더**만** 지운다.
프로세스는 PID 로 추적해 `taskkill /T /F /PID`(이름으로는 안 끝냄). `xwindow` 가 없어 N5 는 skip. **gofu 에서 검증할 수 없다** — 첫 CI 결과로
기대값·known-bug(`knownBug` + 증상)를 다듬는다.

### 발견 사항 (app 층)

- (시험 환경, 앱 버그 아님) **WebKit 의 뒤로/앞으로 캐시가 IndexedDB 연결을 쥔 채 문서를 보관한다** — 그러면 다음 문서의 `deleteDatabase` 가
  성공도 `blocked` 도 없이 영영 기다린다(새 프로필로 막 뜬 앱에서 시드가 20초 스크립트 상한으로 죽었다). 드라이버가 떠나는 문서에 unload 듣개를
  달아 캐시에 못 들어가게 한다(WdioApp.harvestErrors).
- (앱 동작) 전술판 저장 꼴은 좌표를 반올림한다(262.678 → 262.7) — 재실행 보존(N4)은 월드 단위 0.5 안을 같다고 본다.
- (릴리스, 해롭지 않음) desktop-release.yml 이 AppImage 이름을 카탈로그 규약으로 고칠 때 `.sig` 는 옛 이름(`SPIN_0.6.13_amd64.AppImage.sig`)으로
  남는다 — 내용은 latest.json 서명과 같고 업데이터는 latest.json 만 쓴다. R3 이 주석(note)으로 남긴다.
- (드라이버) 배송 AppImage 의 번들 WebKit 은 이동 뒤 WebDriver 스크린샷이 안 돌아온다 → N1 은 xwd(위).

## 이 스위트가 대신하지 못하는 것

실제 WebView2(Windows 는 CI 첫 실행 전까지)·Android WebView 의 차이, deb·rpm·MSI·NSIS·dmg 를 **설치해서** 띄우기(서명만 본다 — 띄우는
것은 AppImage 뿐), 태블릿 손가락 정확도, 소리·진동, 전체화면·화면 꺼짐 방지, OAuth, 공유 링크(서버),
Drive 동기화, MP4 내보내기(코덱 편차), 시연 전체화면 — 실기 목록(`docs/FIELD-TEST.md`)에 남는다. 화면에 보이는 것을 바꿨으면
여전히 `http://100.75.15.13:5173/` 에서 본다.
