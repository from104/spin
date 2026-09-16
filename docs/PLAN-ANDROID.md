# PLAN — 안드로이드 앱 (Capacitor) (2026-09-17)

> **정본 지위**: 안드로이드 셸·빌드·배포·플랫폼 분기의 정본. 상위 정본은 `ROADMAP.md` §0.7(대상 기기·
> 포팅 순서·App Links 방침)이고, 좌표·색·접근성 계약은 `docs/DESIGN.md`, 데스크톱 셸의 선례는
> `docs/AUDIT-DESKTOP-MERGE-2026-09-05.md` 와 `src-tauri/`. 이 문서와 코드가 어긋나면 코드를 고친다.

기현님 지시(2026-09-17, 원문):

> 안드로이드 앱 만들자. qcalc 참고

## 0. 한 줄 원칙

**웹앱 한 벌을 Capacitor 8 셸에 그대로 싣고, 네이티브가 꼭 필요한 다섯 자리(구글 로그인 · 파일 내보내기 ·
공유 시트 · 화면 유지/전체화면 · 딥링크/뒤로가기)만 데스크톱(Tauri)과 같은 자리에 같은 모양의 어댑터로 붙인다.**
셸을 qcalc(Capacitor) 로 정한 이유: Tauri Android 도 가능하지만 데스크톱 러스트 쪽(루프백 OAuth ·
`save_bytes_dialog` · 갱신 토큰 파일)은 모바일에서 하나도 그대로 못 쓰므로 어느 쪽이든 어댑터를 새로 써야
하고, 그렇다면 기현님이 이미 운용 중인 qcalc 의 CI·서명·버전코드 파이프라인과 Capacitor 플러그인 생태계
(Browser·Share·Filesystem·App)가 있는 쪽이 싸다. (Tauri Android 로 뒤집을 근거가 생기면 §1 결정 1 을 뒤집되
이 문단을 지우지 않는다 — AGENTS.md §2.)

## 1. 결정 (기본값 — 뒤집기 쉽게 근거와 함께)

근거 표기: `[조사 c#]` 는 2026-09-17 조사 워크플로우(4갈래 조사 + 44건 반박 검증)에서 살아남은 주장.
`[반박 정정]` 은 반박 검증이 원 주장을 고친 것 — 고친 문장만 여기 적었다.

| # | 결정 | 근거 |
|---|---|---|
| 1 | 셸은 **Capacitor 8.2.0**(qcalc 와 같은 판 — core·cli·android 는 캐럿 없이 고정한다, 네이티브 템플릿과 JS 코어가 한 몸이라서; 플러그인은 8.2 판이 없어 각자 8.x 최신을 고정). 네이티브 프로젝트는 `src-android/`(`capacitor.config.ts` 의 `android.path`) — `src-tauri/` 와 짝 | `android.path` 로 폴더명 변경 가능 [조사 build c2]. 데스크톱 어댑터는 모바일 재사용 불가(§0) |
| 2 | `capacitor.config.ts` 는 **루트**에 두고 `server` 블록을 두지 않는다 — 출처는 기본값 `https://localhost` | Capacitor 8 은 `file` 스킴을 금지 목록으로 거부한다(qcalc 의 `androidScheme: "file"` 은 죽은 설정) [반박 정정]. `https://localhost` 는 secure context 라 WebCodecs·IndexedDB·crypto.subtle·Wake Lock 이 켜진다 |
| 3 | **라우터는 손대지 않는다** — `App.tsx` 의 `file:` 분기가 거짓이라 BrowserRouter 를 탄다. 로컬 서버가 마지막 조각에 점이 없는 경로를 index.html 로 폴백한다 | `WebViewLocalServer.java:399` + `html5mode` 기본 true [조사 webview c1]. ⚠️ 함정: 판정이 "파일 없음"이 아니라 "점 없음"이라, 점 없는 정적 파일은 index.html 에 가려진다 — `public/` 에 확장자 없는 파일을 두지 않는다 |
| 4 | 판정자는 **`src/platform/shell.ts` 하나**: `isTauriWebview()`(files.ts 에서 옮김) · `isCapacitorNative()`(`globalThis.Capacitor?.isNativePlatform?.() === true`, `@capacitor/core` 를 import 하지 않아 웹 번들이 깨끗하다) · `nativeShell(): 'tauri' \| 'android' \| null`. `authDesktop.ts` 의 `isDesktop()` 도 여기서 가져온다 | AGENTS §3 두 벌 두지 않는다. 2026-09-16(2ea7483) 선례가 복제가 아니라 import 였다 [반박 정정]. files.ts 가 로그인 모듈과 엮이면 안 된다는 옛 이유는 중립 모듈이 생기면 사라진다 |
| 5 | 구글 로그인은 **데스크톱과 같은 RFC 8252 흐름**: `@capacitor/browser`(Custom Tabs) + PKCE + 커스텀 스킴 `app.atit.spin:/oauth2redirect` 를 `@capacitor/app` 의 `appUrlOpen` 으로 수신 → `oauth2.googleapis.com/token` 에 `code_verifier` 만(시크릿 없음). `src/sync/authAndroid.ts` 가 `authDesktop.ts` 와 같은 4함수(`isConfigured/connectInteractive/getAccessToken/revokeAccess` + `invalidateToken`) | WebView 안 구글 로그인은 `disallowed_useragent` 로 차단 [조사 oauth c1, 정정]. 안드로이드 클라이언트는 시크릿·redirect 칸이 없고 패키지명+SHA-1 만 [c2]. 대안 Google Identity Services `AuthorizationClient` 는 네이티브 플러그인을 새로 써야 해 기존 PKCE 코드 재사용이 더 싸다 — 실기에서 커스텀 스킴이 막히면 그쪽으로 뒤집는다 |
| 6 | 클라이언트 ID 는 `SPIN_ANDROID_GOOGLE_CLIENT_ID`(공개값이라 시크릿 아님 — 워크플로에 그대로 적는다). 디버그·릴리스 SHA-1 은 **한 클라이언트에 지문 둘** 등록. 콘솔 Advanced Settings 의 **Custom URI scheme 을 켠다**(2023-10 이후 새 클라이언트는 기본 꺼짐) | [조사 oauth c3 정정, c4]. AGENTS §7 "비밀이 아닌 값은 워크플로에" |
| 7 | 갱신 토큰은 `@capacitor/preferences`(앱 샌드박스 SharedPreferences) + **`android:allowBackup="false"`** + `dataExtractionRules` 로 클라우드 백업·기기 이전에서 제외 | 데스크톱 0600 파일과 같은 눈높이(암호화 아님, 프로세스 격리). 템플릿 기본이 `allowBackup=true` 라 그대로 두면 토큰이 백업으로 복제된다 [조사 oauth c9 정정]. prefs(IndexedDB) 에 넣지 않는 이유는 `authDesktop.ts` 머리말과 같다(백업 파일이 prefs 를 싣는다) |
| 8 | 파일 내보내기(`downloadBlob`)는 안드로이드에서 **Filesystem(Cache) → Share 시트**: `isCapacitorNative()` 분기를 `isTauriWebview()` 바로 뒤에 둔다. 시트가 닫히면 `saved`, `Share canceled` 는 `cancelled`. 캐시 파일은 시트가 닫힌 뒤 **60초 유예**(`SHARE_CACHE_CLEANUP_MS`) 뒤 삭제 — 받는 앱은 chooser 가 닫힌 **뒤에** `content://` 를 읽으므로 곧바로 지우면 0바이트를 받는다(`REVOKE_DELAY_MS` 와 같은 모양) | Web Share API 가 WebView 에 없다(crbug 40540400) [조사 webview c4]. `showSaveFilePicker` 도 없다. qcalc `useRecordManager.ts:161-172` 가 같은 길 |
| 9 | 공유 링크 **만들기**: `ShareLinkModal` 의 [복사] 옆에 안드로이드에서만 [공유] 단추(`@capacitor/share` 로 url+title). 받기: App Links(`https://spin.atit.app/s/*`, `autoVerify`) → `appUrlOpen` → `navigate(pathname + hash)` 하면 기존 `useShareLanding` 이 `location.hash` 에서 열쇠를 읽는다. 찬 시작(앱이 꺼진 채 링크를 누름)도 `appUrlOpen` 으로 온다 — `BridgeActivity.load()` 가 런치 인텐트를 `onNewIntent` 로 되돌려 넣고 플러그인이 retained 이벤트로 붙잡는다(`getLaunchUrl()` 을 겹쳐 부르면 두 번 이동한다, 검수 정정). 로케일 접두(`/ja/s/…`)는 `splitLocalePrefix` 로 떼고 넘긴다 — 앱의 basename 은 늘 `/` 다 | ROADMAP §0.7 공유 링크 방침. `useShareLanding`(AppShell.tsx:186-199) 이 라우터 모드와 무관하게 hash 를 한 번 읽고 지운다 [조사 spin 2] |
| 10 | 시연 **전체화면**: 네이티브에서는 Fullscreen API 를 부르지 않고 `useFullscreen` 의 pseudo(CSS) 경로 + 시스템 바 숨김(몰입형 — `@capacitor/core` 의 코어 플러그인 `SystemBars`, 따로 깔 것 없음; 훅이 **언마운트에서 되돌린다** — 뒤로가기·[나가기]는 `exit()` 를 안 거친다, 검수 정정). **화면 유지**: `navigator.wakeLock` 이 있으면 그대로, 네이티브에서는 `@capacitor-community/keep-awake`(FLAG_KEEP_SCREEN_ON) 를 먼저 쓴다 | `BridgeWebChromeClient.onShowCustomView` 가 즉시 `onCustomViewHidden()` 을 불러 전체화면이 곧장 취소된다 [조사 webview c2]. WebView 의 Wake Lock 은 BCD 가 "mirror"(추정) 이고 Permissions API 가 없어 부분 지원 [정정] — 플래그가 확실하다 |
| 11 | safe-area: `appShell.css` 의 `env(safe-area-inset-*)` 를 `var(--safe-area-inset-*, env(safe-area-inset-*, 0px))` 로 — **var 가 앞** | Capacitor 8 SystemBars 가 Android 15+ 에서 `--safe-area-inset-*` 커스텀 프로퍼티를 주입한다(`viewport-fit=cover` 필요 — index.html 에 이미 있다). `env()` 의 fallback 은 미정의일 때만 발화하는데 Chromium 은 늘 0px 로 정의하므로 뒤에 두면 절대 안 읽힌다 [반박 정정]. WebView 140 미만 우회다 |
| 12 | 뒤로가기: `@capacitor/app` `backButton` 리스너 — `canGoBack` 이면 `history.back()`, 아니면 `App.minimizeApp()`(종료 아님) | 리스너가 없으면 히스토리가 비었을 때 아무 일도 안 일어난다 [조사 webview c9]. qcalc `boot/android.ts` 선례 |
| 13 | 외부 링크는 손대지 않는다 — 다른 출처 내비게이션은 `Bridge.launchIntent` 가 시스템 브라우저로 넘긴다 | [조사 webview c5]. `target=_blank` 는 DownloadModal 하나이고 안드로이드에서는 렌더되지 않는다 |
| 14 | `versionCode = major*1_000_000 + minor*1_000 + patch`(0.6.11 → 6011), `versionName` 은 `package.json` 에서 Gradle 이 읽는다. 형식·상한(2_100_000_000) 검사만 두고 qcalc 식 `>=100` 가드는 두지 않는다 | qcalc `build.gradle:9-31` 의 배선을 가져오되 폭을 넓힌다 [반박 정정 — SPIN 은 minor 가 자주 올라 patch 100 은 오지 않지만, 폭이 넓으면 가드가 필요 없다] |
| 15 | 대상 SDK: 템플릿 기본(compile/target **36**, minSdk 24, AGP 8.13.0, Gradle 8.14.3 — 2026-09-17 `cap add` 실측) 그대로. JDK 21 | Play 신규 앱은 2026-08-31 부터 targetSdk 36 필수 [조사 build c6]. gofu 에 JDK 21(`/usr/lib/jvm/java-21-openjdk-amd64`, Android Studio JBR 21) 이 있다 — 기본 `java` 는 25 라 `JAVA_HOME` 을 세운다 |
| 16 | 폰 제외: manifest `<supports-screens android:requiresSmallestWidthDp="600" …/>` + Play Console 기기 카탈로그에서 폰 폼팩터 제외(수동). 앱 안 `SmallScreenNotice`(짧은 변 < 600) 는 그대로 — 사이드로드 APK 의 마지막 방어 | 600dp 는 책형 폴드폰의 펼친 화면(Fold5~8 ≥ 600dp)을 걸러내지 않고 플립형(360~410dp)만 걸러낸다 [반박 정정]. ROADMAP §0.7 "7인치 이상·펼친 폴드폰" |
| 17 | 배포물 둘: **APK**(GitHub 릴리스, `SPIN_{v}_android.apk`, 업로드 키로 서명) + **AAB**(`SPIN_{v}_android.aab`, **릴리스 자산으로도** 올린다). `./gradlew assembleRelease bundleRelease` 한 번 — CI 는 `npm run android:build` 로 부른다(JDK 고르기·서명 갈림을 두 벌 두지 않으려고) | [조사 build c7, c8]. qcalc 는 APK 만. 처음 결정은 「AAB 는 아티팩트」였다 — 2026-09-17 검수에서 뒤집음: 아티팩트는 90일에 만료되고 Play 수동 업로드는 릴리스 페이지에서 받는 쪽이 맞다 |
| 18 | CI 는 `desktop-release.yml` 에 `android` 잡 추가(`needs: build` — 릴리스 초안이 만들어진 뒤 `gh release upload`). 시크릿 4개 `SPIN_ANDROID_KEYSTORE_BASE64 / _KEYSTORE_PASSWORD / _KEY_ALIAS / _KEY_PASSWORD`, 「주입할 환경변수 확인」 단계에 `SPIN_ANDROID_GOOGLE_CLIENT_ID`·`SPIN_ANDROID_WEB_ORIGIN` 을 **같이 넣는다**. 키스토어는 `$RUNNER_TEMP` 에 풀고 빌드 뒤 지운다 | AGENTS §7 빈 시크릿 사고(0.6.9). qcalc `release.yml:333-` 의 구조를 Quasar 없이 다시 짠다: `npm ci → npm run build(SPIN_ANDROID_BUILD=1) → npx cap sync android → gradlew` [반박 정정 — `vite build` 만 부르면 SEO 프리렌더가 빠진다] |
| 19 | 웹 출처는 `SPIN_ANDROID_WEB_ORIGIN`(=`https://spin.atit.app`, 공개값). `share/api.ts` 의 `desktopWebOrigin()` 을 `nativeWebOrigin()` 으로 일반화해 `SPIN_DESKTOP_WEB_ORIGIN ?? SPIN_ANDROID_WEB_ORIGIN` 을 읽는다. `vite.config.ts` 는 `SPIN_ANDROID_BUILD` 가 있을 때만 `SPIN_ANDROID_` 접두를 허용 | `https://localhost` 에서 상대 경로 `/api/share` 는 아무 데도 닿지 않는다 — 데스크톱과 같은 문제 [조사 spin 10]. Capacitor CLI 훅(`capacitor:sync:before`, `CAPACITOR_PLATFORM_NAME`) 도 있지만 웹 빌드를 훅 안에 숨기면 `cap run -l` 이 매번 빌드한다 — npm 스크립트가 신호를 세우는 쪽이 눈에 보인다 |
| 20 | 아이콘은 `src-tauri/icons/android/` 의 mipmap(적응형 xml 포함)을 `src-android/app/src/main/res/` 로 복사, `ic_launcher_round.xml` 을 하나 더 만든다. 스플래시는 Android 12+ 시스템 스플래시(`Theme.SplashScreen`, 배경 `#0b0f14`) — 플러그인 없음 | `tauri icon` 산출물이 표준 구조 [조사 build c15-16]. 시스템 스플래시는 테마를 걸어야 커스터마이즈된다 [c18 정정] |
| 21 | `public/.well-known/assetlinks.json` 에는 **설치되는 APK 를 서명한 모든 키**의 SHA-256: 업로드 키(GitHub APK) + Play 앱 서명 키(첫 Play 게시 뒤 콘솔에서) + 디버그 키(실기 시험용). 지문이 아직 없어 이번 회차에는 **생성 스크립트**(`scripts/android-assetlinks.mjs`) 만 두고 파일은 키스토어가 생긴 뒤 커밋 | [반박 정정 — "둘 다"가 아니라 "설치분을 서명한 전부"]. 배포는 `dist/` rsync 라 `public/` 에 두면 함께 나간다(vhost 는 점 파일 403, `.well-known` 만 예외 — `scripts/deploy-aws.sh:163-165`) |
| 22 | 개발: `npm run android:dev`(= `cap run android` — CLI 의 `-l`/`--external` 은 쓰지 않는다: 8.2 에 `--external` 이 없어 즉사하고, `-l` 은 주소를 제 값으로 덮어쓴다, 검수 정정) 는 `SPIN_CAP_SERVER_URL=http://100.75.15.13:5173` 가 있을 때만 `server.url`+`cleartext` 를 켠다(커밋되는 값 아님). 개발 서버에는 `SPIN_ANDROID_` 접두가 열리지 않으므로 동기화·공유 출처까지 보려면 `SPIN_ANDROID_BUILD=1 npm run dev`. `android:build`·`android:open` 과 짝 `_comment:android` | [조사 build c23]. AGENTS §6 스크립트 짝 규칙 |
| 23 | 테스트는 jsdom 이 잴 수 있는 것만: `authAndroid` 의 PKCE·state·토큰 교환(플러그인은 `vi.mock`), `downloadBlob` 네이티브 분기의 결과 사상, 딥링크 URL → 경로 변환 순수 함수, `nativeWebOrigin` 우선순위. 나머지는 §4 실기 | AGENTS 테스트 작성 규칙(값 없는 테스트는 못 지우는 코드) |

## 2. 손대는 곳 (순서대로)

**셸** `package.json`(의존성 `@capacitor/{core,cli,android,app,browser,share,filesystem,preferences}` ·
`@capacitor-community/keep-awake`, 스크립트 `android:*`) → `capacitor.config.ts`(루트, `tsconfig.node.json` include 에
추가 — 안 넣으면 typecheck 가 조용히 건너뛴다) → `npx cap add android` 로 `src-android/` → `AndroidManifest.xml`
(allowBackup false·dataExtractionRules·intent-filter 둘: 커스텀 스킴 `app.atit.spin` · App Links
`https://spin.atit.app` path `/s/…`·`supports-screens`) → `app/build.gradle`(versionName/Code·`signingConfigs.release` env)
→ `res/`(아이콘·스플래시 테마·`xml/data_extraction_rules.xml`) → `src-android/.gitignore`(`src-tauri/.gitignore`
선례: 디렉터리 자기 것).

**판정** `src/platform/shell.ts`(신규) → `storage/files.ts`(`isTauriWebview` 를 re-export 하지 않고 import 로 바꾼다;
소비자 `app/download/desktopDownload.ts`·`app/update/useDesktopUpdate.ts` 도 새 경로) → `sync/authDesktop.ts`
(`isDesktop` 을 shell 에서).

**어댑터** `sync/authAndroid.ts`(신규) → `sync/auth.ts`(4곳 디스패치를 `nativeShell()` 스위치로) →
`storage/files.ts`(`downloadBlob` 분기) → `features/library/ShareLinkModal.tsx`([공유]) → `share/api.ts`
(`nativeWebOrigin`) → `features/present/useFullscreen.ts`·`useWakeLock.ts` → `styles/appShell.css`(결정 11) →
`platform/android/nativeBridge.ts`(신규: `backButton`·`appUrlOpen` 리스너, `App.tsx` 에서 네이티브일 때만 동적 import)
→ `i18n/{ko,en,ja}.ts`(`library.share.shareSheet` 등 — 셋을 함께).

**빌드·문서** `vite.config.ts`(envPrefix) → `.github/workflows/desktop-release.yml`(`android` 잡) →
`scripts/android-assetlinks.mjs` → `ROADMAP.md` §0.7 체크 → `CHANGELOG.md`(+`.en`·`.ja`) `[Unreleased]` →
`AGENTS.md` §7(env 이름) → `docs/FIELD-TEST.md`(안드로이드 앱 행) → `README.md`(설치 절은 첫 릴리스 뒤).

## 3. 착수 순서

1. **셸 스캐폴드** — 의존성·`capacitor.config.ts`·`cap add`·manifest·gradle·아이콘·스크립트. 끝 조건: gofu 에서
   `JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64 npm run android:build` 가 디버그 APK 를 굽는다(서명 env 없으면
   `assembleDebug` 로 떨어진다).
2. **판정 통일 + 로그인 어댑터** — `platform/shell.ts`, `authAndroid.ts`, `auth.ts`. 테스트: `authAndroid.test.ts`
   (`authDesktop.test.ts` 를 본보기로).
3. **내보내기·공유·시연 어댑터 + CSS** — `downloadBlob`·`ShareLinkModal`·`api.ts`·`useFullscreen`·`useWakeLock`·
   `appShell.css`·`nativeBridge.ts`·i18n.
4. **CI·문서** — `android` 잡, assetlinks 스크립트, ROADMAP·CHANGELOG·AGENTS·FIELD-TEST.
5. **검증** — `npm run typecheck` · `npm run lint:rel` · `npm run test:rel <파일>` 을 단계마다, 커밋 직전 전체 한 번.
   디버그 APK 를 gofu 의 태블릿 AVD(`qcalc35tab`)에 설치해 첫 화면·라이브러리·시연 진입 스크린샷.
6. **기현님 몫(수동, 비밀은 위치만 기록)** — 아래 §5.

## 4. 실기 확인 (jsdom 이 못 재는 것)

기기: 기현님 안드로이드 태블릿(개발 서버 `http://100.75.15.13:5173` 라이브 리로드, 또는 Taildrop 으로 APK).

- ☐ A-1 첫 실행이 `https://localhost` 로 뜨고(개발자 도구 `chrome://inspect`), 라이브러리·규칙·설정이 열린다
- ☐ A-2 화면 회전(가로↔세로) 뒤 코트가 잘리지 않는다 — 액티비티 재시작 없이(`configChanges`)
- ☐ A-3 시연 진입 시 시스템 바가 숨고 화면이 꺼지지 않는다(5분 방치). 설정에서 [화면 꺼짐 방지] 를 끄면 꺼진다
- ☐ A-4 드릴 내보내기 → 공유 시트가 뜨고 [파일에 저장]·[드라이브]·[카카오톡] 으로 보낼 수 있다. 시트를 물리면 «저장했습니다» 가 뜨지 **않는다**
- ☐ A-5 영상(MP4) 내보내기가 끝까지 돌고 시트로 나간다(WebCodecs)
- ☐ A-6 [Google 계정 연결] → Custom Tab 에서 로그인 → 앱으로 돌아오고 탭이 닫힌다 → 동기화가 돈다. 앱을 죽이고 다시 열어도 로그인 없이 동기화된다(갱신 토큰)
- ☐ A-7 [연결 해제] 뒤 다시 연결하면 동의 화면이 다시 뜬다(prompt=consent), 갱신 토큰이 새로 온다
- ☐ A-8 공유 링크 [공유] 로 카카오톡에 보내고, 그 링크를 눌렀을 때 **앱**이 열려 착지 시트가 뜬다(assetlinks 커밋 뒤). 앱이 없는 기기에서는 웹이 열린다
- ☐ A-9 뒤로가기: 화면 안 이동을 되돌리고, 첫 화면에서는 앱이 홈으로 내려간다(종료 아님)
- ☐ A-10 safe-area: 상태바·내비게이션바 뒤로 UI 가 먹히지 않는다(Android 15+ 기기·에뮬레이터 둘 다)
- ☐ A-11 폴드폰(펼침)에서 설치·실행이 된다(Play 내부 테스트 뒤)
- ☐ A-12 `SmallScreenNotice` 가 태블릿에서는 뜨지 않고, 사이드로드한 폰에서는 뜬다

## 5. 기현님 몫 — 수동 단계 (값은 어디에도 적지 않는다, 위치만)

1. **업로드 키스토어**: `keytool -genkeypair -v -keystore secrets/android-upload.jks -alias spin-upload -keyalg RSA -keysize 2048 -validity 10000`
   → `secrets/` 는 gitignore. 비밀번호·별칭은 `.env.local`(gitignore) 에 `SPIN_ANDROID_KEYSTORE_PASSWORD` 등으로.
   백업은 볼트가 아니라 **오프라인 두 곳**(잃으면 Play 업로드 키 재설정 절차가 필요하다).
2. **GitHub 시크릿 4개** 등록(결정 18) — `base64 -w0 secrets/android-upload.jks` 값.
3. **구글 클라우드 콘솔**: 같은 프로젝트에 OAuth 클라이언트 **Android** 유형 신설 — 패키지 `app.atit.spin`, SHA-1 은
   업로드 키(`keytool -list -v -keystore secrets/android-upload.jks`) 와 디버그 키(`~/.android/debug.keystore`,
   비밀번호 `android`) **둘 다** 등록. **Advanced Settings → Custom URI scheme 켜기.** 클라이언트 ID 를
   `desktop-release.yml` 의 `SPIN_ANDROID_GOOGLE_CLIENT_ID` 와 `.env.local` 에 적는다(공개값).
4. **assetlinks**: `node scripts/android-assetlinks.mjs <SHA256…>` 로 `public/.well-known/assetlinks.json` 을 만들어
   커밋·배포. Play 게시 뒤 콘솔 「앱 서명」의 앱 서명 키 SHA-256 을 추가.
5. **Play Console**: 앱 등록(패키지 `app.atit.spin`, 카테고리 교육) → 기기 카탈로그에서 폰 폼팩터 제외 → 내부 테스트에
   AAB 업로드 → 개인정보처리방침 URL(`https://spin.atit.app/…` 법적 고지 페이지).
6. **SDK 관리 도구 복구(선택)**: gofu 의 `~/Android/Sdk/cmdline-tools/` 가 없고 옛 `tools/bin/sdkmanager` 는 JDK 21 에서
   죽는다(JAXB). 이번엔 AGP 가 platform 36 을 스스로 받았지만 build-tools·NDK 를 손으로 깔 일이 생기면 cmdline-tools 를
   먼저 받는다(Android Studio → SDK Manager 로도 된다).

## 6. 교훈 (2026-09-17 랜딩·검수)

- 조사 단계에서 "qcalc 가 그렇게 했다" 는 근거 하나로 옮기려던 것 둘이 죽은 설정이었다 — `androidScheme: "file"`(8.x 가
  거부), `Theme.SplashScreen` 미연결(시스템 스플래시는 어차피 뜬다). **참고 프로젝트도 정본이 아니다 — 소스로 확인한다.**
- **검수(fable 3명)가 잡은 것 6건, 전부 돌연변이로 실효 확인 뒤 고침**: ① 토큰 종점의 일시 장애(5xx·429, `error` 본문 없음)를
  `E_SYNC_AUTH` 로 접어 멀쩡한 갱신 토큰을 지우던 것 — 죽은 토큰의 신호는 `invalid_grant` 하나다(공용 `authInstalled.ts` 라
  데스크톱도 같이 나았다) ② 리스너 정리(`disarm`)가 테스트 스텁(이벤트명 Map)으로는 증명되지 않던 것 — 남은 리스너 수 0 단언
  ③ `installedAuth()` 의 `case 'android'` 가 어느 테스트에도 안 잡히던 것(desktop 으로 바꿔도 초록 = 「조용히 빈 화면」의 정확히
  그 모양) ④ 찬 시작 딥링크 두 번 이동(`getLaunchUrl` + retained `appUrlOpen`) ⑤ 시연을 pseudo 상태로 떠나면 시스템 바가 영영
  숨던 것(훅 언마운트 undo) ⑥ `cap run android -l --external` 이 8.2 CLI 에 없는 옵션으로 즉사하던 것.
- 🪤 **`set -euo pipefail` + `… | head -1` 은 exit 141 로 단계를 죽인다**(aapt2 badging 4KB 에서도 재현). qcalc 의 같은 줄이 멀쩡한
  이유는 그쪽 run 블록에 `set -e` 가 없어서다 — `sed -n '1p'` 로. 데스크톱 잡의 같은 자리 둘도 같이 고쳤다.
- **테스트 스텁은 실물의 실패 모양을 가져야 한다** — 등록부를 이벤트명 키 Map 으로 만들면 누수된 리스너를 다음 등록이 덮어써
  머리말이 경고한 바로 그 버그를 못 본다.
- 남은 것(low, 다음 회차): `PresentRunner.tsx` 의 언마운트 정리 effect 는 첫 렌더의 `state 'off'` 를 붙들어 죽은 코드다(훅이 스스로
  되돌리게 됐으니 지우는 쪽이 맞다) · `authDesktop.ts` 의 `isDesktop()` 은 테스트만 부른다(케이스를 shell 쪽으로 옮기고 삭제) ·
  `SystemBars.hide()` 는 `BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE` 를 걸지 않아 가장자리 스와이프에 바가 돌아올 수 있다(실기 A-3
  에서 본다) · 템플릿 잔재(`ExampleUnitTest`·`ExampleInstrumentedTest`·`layout/activity_main.xml`) 청소.
