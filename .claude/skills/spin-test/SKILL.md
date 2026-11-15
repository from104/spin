---
name: spin-test
description: SPIN 자동 테스트(code·web E2E 층)를 돌리고 결과를 읽고 실패를 분류한다. "테스트 돌려", "전체 테스트", "회귀 테스트", "E2E 돌려", "시나리오 추가", "플레이키 확인", "run the tests", "test suite", "playwright", "known-bug" 같은 요청에 사용.
---

# SPIN 테스트 스위트

돌리는 데 LLM이 필요 없다 — 한 명령으로 무인 실행. 구조·시나리오 작성법·선택자 규칙은 `e2e/README.md`, 설계 정본은
`docs/PLAN-TEST-SUITE.md`, 관행은 `AGENTS.md` 「E2E 시나리오 규칙」.

## 명령

| 하고 싶은 것 | 명령 |
|---|---|
| 전부(code + web) | `npm run test:all` |
| 한 층만 | `scripts/test-suite.sh --layer code` / `--layer web` (`--layer` 여러 번 가능) |
| 로컬에서 빠르게 | `scripts/test-suite.sh --no-cargo` — worktree 처럼 `target/` 이 없으면 cargo test 가 수 분이다. **CI 는 늘 cargo 를 돈다** |
| 처음 한 번 브라우저 설치 | `scripts/test-suite.sh --setup` (chromium·webkit, sudo 없는 WebKit 라이브러리 우회 포함) |
| 웹 빌드 강제 재빌드 | `--rebuild` (또는 `E2E_REBUILD=1`) — 입력이 바뀌면 자동 재빌드됨(지문 비교) |
| 플레이키 확인 | `scripts/test-suite.sh --layer web -- --repeat-each=3` (`--` 뒤는 playwright 인자) |
| 한 프로젝트·한 시험 | `scripts/test-suite.sh --layer web -- --project=webkit-desktop -g "S9"` 또는 `npm run test:e2e -- -g S9` |
| trace 열기 | `npx playwright show-trace test-results/e2e-artifacts/<시험>/trace.zip` |

층: `code` = lint(경고가 기준선 `LINT_BASELINE` 을 넘으면 실패 — 값은 `scripts/test-suite.sh` 한 곳) · typecheck · vitest · cargo test /
`web` = 운영 빌드(`dist/`) 위 Playwright 4프로젝트(chromium-desktop · webkit-desktop · chromium-mobile · chromium-tablet). `app` 층(Tauri·Android)은 아직 없다.
종료 코드: 실패 층이 있으면 1, **같은 작업 트리에서 이미 돌고 있으면 3**(`test-results/.run.lock` — 동시에 두 번 돌리지 않는다).

## 결과 읽는 순서

1. **`test-results/summary.md` 를 먼저 읽는다**(30줄 이하: 돌린/안 돌린 층, 층·프로젝트별 숫자, 실패 목록).
2. trace·스크린샷·로그는 **실패한 시험만** 연다. 단계별 로그는 `test-results/<층>-<단계>.log`, 전체는 `summary.json`.
3. 통과한 시험의 상세는 읽지 않는다.

## 실패 분류 순서

1. **환경** — 브라우저 미설치(`--setup`), 포트 4179 점유(`E2E_PORT`), 빌드 실패(`test-results/e2e-build.log`), cargo 없음, 락(종료 코드 3).
   시험 코드는 보지 않는다.
2. **플레이키** — `--repeat-each=3` 으로 재현이 갈리면. 고정 sleep 대신 `eventually`·`settled()` 로 기다리게 고친다(`retries` 로 덮지 않는다).
   vitest 전체가 부하에 약해 실패 집합이 회차마다 바뀌면 회귀가 아니라 경쟁이다 — 그 파일만 단독으로 다시 돌린다.
3. **진짜 회귀** — 같은 시험이 3번 다 실패. 변경 diff 와 대조해 앱 버그면 앱을 고친다. **시험을 약하게 고치지 않는다.**
4. **known-bug 뒤집힘** — 메시지가 `bug fixed — remove the known-bug mark` 이면 버그가 고쳐진 것: 아래 절차로 표시를 지운다.
   그 밖의 known-bug 는 summary.md 의 known-bug 줄에서 **실제 오류가 그 버그의 증상과 맞는지** 확인한다 — 시나리오의 `symptom` 과
   안 맞는 실패는 `known-bug 의 증상이 아닌 실패` 로 빨갛게 뜬다(다른 원인의 진짜 실패).

## known-bug(알려진 앱 버그)

- 시나리오의 `knownBug: '<설명>'` + `symptom: /오류 모양 정규식/`(필수)이 표시. 시나리오는 그대로 실행되고 **실패하면 통과**(요약에
  `known-bug` 로 따로 집계), **통과하면 빨강**(버그가 고쳐짐). `fixme`/`skip` 은 안 돌아서 고쳐도 모르므로 쓰지 않는다.
- 증상은 **벽시계 경주에 기대지 않는다** — 간격·시간이 증상이면 전제로 단언하거나 vitest 가짜 시계로 보낸다(AGENTS).
- 목록: `grep -rn knownBug e2e/scenarios`.
- **졸업시키기**: 앱을 고침 → 해당 시나리오가 빨개짐 → `knownBug`·`symptom` 줄 삭제 → 다시 돌려 초록 확인(고치는 커밋이 같이 지운다).
- 새 버그 발견 시: 정상 동작을 단언하는 시나리오를 쓰고 `knownBug` 를 단다. **앱 동작은 시나리오 커밋에서 고치지 않는다**
  (닻·testId 만 예외).

## 시나리오 추가

`e2e/scenarios/<그룹>.ts` 에 `{ title, needs?, seed?, knownBug?+symptom?, run(app) }` 추가, `e2e/web/<그룹>.spec.ts` 는 3줄(`runGroup`).
드라이버 중립(Playwright import 금지). 규칙(전부 AGENTS 「E2E 시나리오 규칙」):

1. 먼저 한 문장: **"이것을 지우면 어떤 실기 버그가 새는가?"** 를 머리말에 적는다. vitest 가 보는 산술은 E2E 로 안 간다.
2. **새 단언은 돌연변이로 증명한다** — 앱을 일부러 망가뜨려(재빌드 약 15초) 빨간불을 본 뒤 되돌린다. **되돌리기는 늘 복사본으로**
   (망가뜨리기 전에 `cp` 해 둔 것을 덮어쓴다) — `git checkout -- <파일>` 은 그 파일의 커밋 안 된 수정까지 지운다(실제로 한 번 날렸다).
   `git stash` 금지. 한 빌드에 하나만 망가뜨린다 — prefs 파싱을 망가뜨리면 조용한 시드가 깨져 상관없는 시나리오가 빨개진다.
   `npm run build` 는 `tsc -b` 를 먼저 돈다 — 돌연변이가 import 를 안 쓰게 만들면 빌드가 죽어 "빨강" 이 시험이 아니라 서버 기동 실패다.
3. 4프로젝트에서 `--repeat-each=3`(좌표·타이밍을 다루면 5)으로 안정 확인. 고정 sleep 금지, `retries` 0.
4. 제목은 한글 20자 안팎(ZFS formD 산출물 경로 한계). 문구·개수·순서 단언 금지(번역·기획이 바뀐다).
5. 커밋 끝줄: `typecheck 0 · lint 경고 48(기존) · vitest N 통과 · e2e N 통과(4프로젝트) · 돌연변이 N건으로 실효 확인`.

## 모델 배분(AGENTS §10)

- 돌리기: LLM 불필요(`npm run test:all` 만).
- 실패 분류·원인 분석: **opus**.
- 새 시나리오 작성: **sonnet**(어려운 물리·터치는 opus), 검토는 한 단계 위. 계획·어려운 검증은 fable.

## 로드맵

실제 앱 층 — Tauri Linux(xvfb + tauri-driver/WebdriverIO 로 `SpinApp` 구현) → Windows 러너 → Android 디버그 APK(Playwright `_android`).
드라이버만 새로 쓰면 `e2e/scenarios/*` 는 그대로 재사용한다.
