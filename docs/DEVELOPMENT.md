# SPIN — 개발 · 검증 · 배포

이 저장소에서 **일하는 법**입니다. 무엇을 만드는 앱인지, 왜 이런 설계인지는
[OVERVIEW.md](OVERVIEW.md) 에 있고, 처음 오신 분은 [README](../README.md) 부터 보십시오.

기여하려는 분은 [CONTRIBUTING.md](../CONTRIBUTING.md) 를 먼저 읽으십시오 — 이 문서는
그보다 깊은 배경(왜 이 규율이 있는가, 배포가 실제로 무엇을 하는가)을 담습니다.

---

## 1. 이 저장소에서 일하는 법

규율이 셋 있습니다. 셋 다 **사고를 겪고 생긴 것**이라, 지키지 않으면 같은 사고가 다시 납니다.

1. **주석이 사실인지 테스트가 확인한다.** `src/test/docsMatchCode.test.ts` 가 `docs/REQUIREMENTS.md`
   의 표를 **텍스트로 읽어** 코드 상수와 대조합니다. 코드를 바꾸고 문서를 안 고치면(그 반대도)
   그 테스트가 먼저 빨개집니다. *"확인하는 테스트가 없으면 주석은 언젠가 거짓이 된다"* 를
   이미 겪었습니다(2026-08-11, 좌표 리터럴 사고).
2. **좁혀서 돌리고, 커밋 직전에 한 번 전부 돌린다.** `npm run test:rel <파일>` 은 그 파일을
   import 하는 테스트만 돌립니다(2~5초). 전체는 55초이고 **커밋 직전 한 번**입니다.
3. **뒤집은 결정은 근거를 남긴다.** 왜 그렇게 정했었는지를 지우면, 몇 달 뒤에 같은 이유로
   같은 결정을 다시 하게 됩니다.

에이전트용 세부 규약(코드·커밋·문서·테스트·i18n 관행)은 [AGENTS.md](../AGENTS.md) 에, 구현 계약은 [docs/DESIGN.md](DESIGN.md) §0(문서 지위·읽는 법)에 있습니다.

### 문서 지도

| 파일 | 내용 |
|---|---|
| [ROADMAP.md](../ROADMAP.md) | **앞으로 할 일의 정본** — 버전별 계획과 결정 대기 항목 |
| [docs/REQUIREMENTS.md](REQUIREMENTS.md) | 요구사항 확정본. 숫자는 테스트가 지킵니다 |
| [docs/DESIGN.md](DESIGN.md) | 구현 계약서 — 좌표·상수·시그니처·파일 소유권·접근성 계약 |
| [docs/FALSIFICATION-BASELINE.md](FALSIFICATION-BASELINE.md) | "이 주장이 틀렸다면 무엇이 보일 것인가" 기준선 |
| [docs/FIELD-TEST.md](FIELD-TEST.md) | 실기 검증 항목과 결과 |
| [docs/PLAN-2026-08.md](PLAN-2026-08.md) | ❄️ **동결** — 2026-08 재편의 설계 근거와 §8 「하지 않을 것」 |
| [CHANGELOG.md](../CHANGELOG.md) | 변경 이력 (Keep a Changelog) |

---

## 2. 개발 실행

```bash
npm install
npm run dev          # 개발 서버
npm run build        # tsc -b && vite build (타입체크 포함)
npm run lint         # oxlint
npm run test         # 전체 (커밋 직전 한 번)
npm run test:rel src/render/CourtStage.tsx   # 그 파일을 쓰는 테스트만
npm run share:dev    # 공유 링크 서버(localhost:8787)
```

현재 **260개 파일 3,573개 테스트**가 돌고 있습니다.

공유 링크를 개발 중에 만들고 열려면 `npm run share:dev` 로 공유 서버를 함께 띄웁니다 —
Vite 개발 서버가 `/api` 요청을 그쪽으로 프록시하므로 앱 코드는 운영과 똑같이 같은 출처의
`/api/share` 만 부릅니다(정본 `docs/PLAN-SHARE-LINK.md` 결정 3·4).

### 배포

실제로 뜨는 곳은 **spin.atit.app**(AWS Lightsail) 하나입니다. `spin.atit.dev` 는
콘텐츠를 서빙하지 않습니다 — **리다이렉션 전용**입니다(옛 링크·즐겨찾기가 spin.atit.app 으로
자동 이동하게 하는 것이 그 역할 전부).

```bash
npm run deploy:aws -- --dry-run   # 무엇이 바뀌는지만 본다 (아무것도 안 쓴다)
npm run deploy:aws                # 테스트 → 빌드 → 배포
```

`dist/` 를 Lightsail 인스턴스의 Apache 가상호스트(`/opt/bitnami/apache2/spin-htdocs`)로
SSH+rsync 하는 것이 전부입니다. 근거와 안전장치는
[`scripts/deploy-aws.sh`](../scripts/deploy-aws.sh) 머리말에 있습니다.

**배포 대상은 저장소에 적혀 있지 않습니다.** 호스트·계정·SSH 키 경로는 전부 환경변수로
주어야 하고, 없으면 스크립트가 그 자리에서 멈춥니다. 키 이름은
[`.env.deploy.example`](../.env.deploy.example) 에 있습니다 — 그 파일을 `.env.deploy` 로
복사해 값을 채우면 스크립트가 알아서 읽습니다(`.env.deploy` 는 `.gitignore` 대상).
이 저장소를 포크한 분은 자기 서버 값을 넣으면 그대로 돕니다.

공유 링크 백엔드(`server/share`)는 [`scripts/deploy-share.sh`](../scripts/deploy-share.sh)
가 같은 환경변수로 올립니다. 원격 systemd 유닛을 설치·재시작하므로 먼저 `--dry-run` 을
보십시오.

cube 로 올리는 [`scripts/deploy.sh`](../scripts/deploy.sh)(`npm run deploy`)도 저장소에는
남아 있지만, spin.atit.dev 가 리다이렉션 전용이 된 지금은 그리로 올려도 사용자 눈에는
보이지 않습니다 — 일상적인 배포 명령이 아닙니다.

### 데스크톱 (Tauri)

같은 코드 한 벌로 리눅스·윈도우·맥 네이티브 앱을 냅니다. 웹앱 쪽 분기는 없습니다 —
Tauri 는 `dist/` 를 그대로 감싸는 셸이라 `src/` 는 손대지 않았습니다.

```bash
npm run tauri:dev      # vite dev 서버 + 네이티브 창 (HMR 그대로)
npm run tauri:build    # dist 빌드 → 설치 패키지
```

산출물은 `src-tauri/target/release/bundle/` 아래에 나옵니다. gofu(리눅스)에서는
deb·rpm·AppImage 3종이 나오고, **윈도우·맥 패키지는 그 OS 에서만 만들어집니다** —
그쪽은 [`.github/workflows/desktop-release.yml`](../.github/workflows/desktop-release.yml)
가 3-OS 매트릭스로 굽습니다(태그 `v*` 를 밀면 릴리스 초안, Actions 수동 실행이면
아티팩트만). 서명·공증은 아직 없어 맥·윈도우 첫 실행에는 경고가 뜹니다.

리눅스에서 처음 빌드하려면 시스템 헤더가 필요합니다:

```bash
sudo apt install libwebkit2gtk-4.1-dev libxdo-dev libayatana-appindicator3-dev librsvg2-dev
```

알아 둘 것:

- 라우터가 이미 `createHashRouter` 라 네이티브 셸에서 그대로 돕니다([OVERVIEW.md §4 코드 지도](OVERVIEW.md) 참조).
- 창 CSP 는 `src-tauri/tauri.conf.json` 에 있습니다. `index.html` 의 FOUC 방지 부트
  스크립트가 인라인이라 `script-src` 에 `'unsafe-inline'` 이 들어 있습니다 — 앱은 원격
  문서를 열지 않고 렌더는 전부 React 라 유입 경로가 없지만, 부트 스크립트를 외부 파일로
  빼면 이 예외도 없앨 수 있습니다.
- **AppImage 는 웨일랜드에서 함정이 하나 있습니다.** linuxdeploy 가 만드는 AppRun 이
  `GDK_BACKEND=x11` 을 강제하는데 웨일랜드 세션은 `GTK_IM_MODULE=wayland` 를 내보내
  둡니다 — X11 디스플레이 위에서 웨일랜드 입력기 모듈이 로드돼 창이 뜨기도 전에
  SIGSEGV 로 죽습니다. `src-tauri/src/main.rs` 의 `fix_appimage_display_backend()` 가
  AppImage + 웨일랜드 세션일 때만 그 강제를 걷어내, deb·rpm 과 `npm run tauri:dev` 가
  이미 멀쩡히 돌고 있는 조건(웨일랜드 백엔드 + 웨일랜드 입력기)으로 되돌립니다.
  입력기 쪽을 X11 에 맞추는 방향(`GTK_IM_MODULE=xim`)도 해 봤지만 **창이 통째로
  얼어붙습니다** — xim 은 동기 프로토콜이라 웹뷰가 있는 구성에서 물립니다. 고치지
  마세요.
- **그 가드에는 탈출구가 있습니다.** `WAYLAND_DISPLAY` 가 없는 실행 맥락(systemd 유저
  유닛·일부 런처, `env -u WAYLAND_DISPLAY` 로 재현)에서도 같은 쌍이 성립하므로, 그때는
  `GTK_IM_MODULE` 쪽을 지워 쌍을 끊습니다(앱은 x11 로 뜨고 입력기는 GTK 기본으로
  떨어질 수 있습니다). 반대로 AppImage 를 일부러 X11 로 돌리고 싶으면 `SPIN_FORCE_X11=1` 을
  주고 띄우세요 — 이 가드를 끄고 `GDK_BACKEND=x11` 을 그대로 두되, 크래시 쌍이 성립하면
  `GTK_IM_MODULE` 만 뗍니다(웨일랜드 백엔드가 다시 말썽일 때의 회피로). AppImage 밖(deb·rpm)
  에서는 이 변수가 아무것도 바꾸지 않습니다 — 거기서 X11 을 원하면 `GDK_BACKEND=x11` 을 직접
  주면 되고, 그때도 `GTK_IM_MODULE=wayland` 는 앱이 알아서 뗍니다.
- **드라이브 동기화는 데스크톱에서 로그인 흐름이 다릅니다.** 웹은 GIS 팝업이지만
  데스크톱 웹뷰는 팝업을 못 띄우고(`Failed to open popup window`), 띄웠어도 출처가
  `tauri://localhost` 라 구글 콘솔에 등록할 수 없습니다. 그래서 데스크톱은 **설치형 앱
  흐름**(외부 브라우저 + `127.0.0.1` 루프백 + PKCE)으로 갑니다 — `src/sync/authDesktop.ts`
  와 `src-tauri/src/oauth.rs`. 갈라지는 곳은 `src/sync/auth.ts` **한 군데**뿐이라
  소비자(설정 화면·동기화 엔진)는 플랫폼을 모릅니다.

  쓰려면 **구글 콘솔에서 "데스크톱 앱" 유형 클라이언트를 따로** 만들어야 합니다(웹용
  클라이언트로는 이 흐름이 안 됩니다). 만든 값은 `.env.local` 에 넣습니다(키 이름은
  [`.env.example`](../.env.example) 참조):

  ```
  SPIN_DESKTOP_GOOGLE_CLIENT_ID=…
  SPIN_DESKTOP_GOOGLE_CLIENT_SECRET=…
  ```

  `VITE_` 가 아니라 `SPIN_DESKTOP_` 접두어인 것이 중요합니다 — `vite.config.ts` 의
  `envPrefix` 가 이 접두어를 **Tauri 빌드에서만** 주입하므로, `npm run build`(웹)에는 이
  값이 아예 실리지 않습니다.

  그 '시크릿' 은 이름과 달리 **비밀이 아닙니다** — 설치형 앱은 배포본을 뜯으면 누구나
  읽을 수 있고 구글도 그 전제로 설계했습니다(그래서 PKCE 가 있습니다). 그래도 저장소에는
  안 넣습니다. 리다이렉트 URI 는 등록할 필요가 없습니다 — 데스크톱 유형은 `127.0.0.1` 의
  아무 포트나 허용하고, 앱은 매번 OS 가 고른 빈 포트를 씁니다.

  설치형은 웹에 없는 물건을 하나 받습니다 — **갱신 토큰**. 만료가 없는 열쇠라
  `localStorage` 가 아니라 앱 데이터 폴더에 0600 파일로 둡니다(`secret_store.rs`).
  prefs 에 넣지 않는 것이 핵심입니다: 백업 파일이 prefs 를 통째로 실어서, 넣는 순간
  남의 기기로 새어 나갑니다.

---

