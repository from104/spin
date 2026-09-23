# PLAN — iOS 앱 (Capacitor, iPad 전용) (2026-09-23)

> **정본 지위**: iOS 셸·빌드·서명·배포·플랫폼 분기의 정본. 상위 정본은 `ROADMAP.md` §0.7(대상 기기),
> 형제 정본은 `docs/PLAN-ANDROID.md`(같은 Capacitor 셸의 안드로이드 쪽 — 결정 번호를 그대로 인용한다)와
> `docs/PLAN-UI-SCALE.md`(「UI 크기: 자동」). 좌표·색·접근성 계약은 `docs/DESIGN.md`.
> 이 문서와 코드가 어긋나면 코드를 고친다.

기현님 지시(2026-09-23, 원문):

> iso용 ipad-mini 이상에서만 도는 앱 만들 계획 세워줘

## 0. 한 줄 원칙

**안드로이드에 이미 실려 있는 Capacitor 8 셸을 iOS 로 한 벌 더 낸다 — 새 어댑터를 쓰는 것이 아니라
`nativeShell()` 에 값 하나를 늘리고 갈라지는 자리만 iOS 판으로 채운다. 기기 제한은
`TARGETED_DEVICE_FAMILY = 2`(iPad 전용) 한 줄이면 끝난다.**

## 0.1 먼저 짚을 것 — 「iPad mini 이상」은 곧 「iPad 전부」다

iPad mini(8.3인치)가 **현행 iPad 중 가장 작다.** 그래서 "iPad mini 이상" 이라는 요구는 모델을 골라내는
문제가 아니라 **아이폰을 빼는 문제**이고, 그것은 Xcode 빌드 설정 한 줄(`TARGETED_DEVICE_FAMILY = 2`)로
끝난다. 안드로이드에서 `requiresSmallestWidthDp="600"` 으로 폰을 걸렀던 것(PLAN-ANDROID 결정 16)의
iOS 대응물이고, 이쪽이 더 깨끗하다 — **App Store 가 아이폰 사용자에게 아예 앱을 보여주지 않는다.**

세대를 더 자르고 싶으면 그것은 화면 크기가 아니라 **배포 타깃 iOS 버전**으로 조절한다(결정 3).

## 1. 결정 (기본값 — 뒤집기 쉽게 근거와 함께)

근거 표기: `[실측]` 은 2026-09-23 에 1차 출처에서 직접 확인한 것. `[미확인]` 은 아직 근거를 못 잡은
가정이라 실기에서 먼저 깨질 수 있는 것.

| # | 결정 | 근거 |
|---|---|---|
| 1 | 셸은 **Capacitor 8.2.0** — 안드로이드와 같은 판. `@capacitor/ios` 를 `core`·`cli`·`android` 와 같이 캐럿 없이 고정한다 | PLAN-ANDROID 결정 1 과 같은 이유(네이티브 템플릿과 JS 코어가 한 몸) |
| 2 | 프로젝트는 `npx cap add ios` 로 **`src-ios/`** 에 만든다(`capacitor.config.ts` 의 `ios.path`). 의존성 관리자는 템플릿 기본 **SPM** | Capacitor 8 부터 `cap add ios` 의 기본 템플릿이 SPM 이고 CocoaPods 는 `--packagemanager CocoaPods` 로 골라야 한다 [실측: capacitorjs.com/docs/updating/8-0]. 새로 시작하므로 기본을 따른다 — Homebrew·CocoaPods 설치가 통째로 빠진다 |
| 3 | 배포 타깃 **iOS 15.0**(Capacitor 8 최소). 더 올릴지는 **기현님 실기 iPad 모델이 정해진 뒤** 결정한다 | Capacitor 8 은 iOS 15+ 지원, 배포 타깃을 15.0 으로 올리라고 명시 [실측: capacitorjs.com/docs/ios, /updating/8-0]. 어느 iPad 세대가 어느 iPadOS 까지 가는지는 아직 1차 출처로 못 잡았다 [미확인] — 타깃을 올리면 구형 WebKit 함정이 줄지만 대상 기기도 준다 |
| 4 | 기기 제한은 **`TARGETED_DEVICE_FAMILY = 2`** 하나. 앱 안 `SmallScreenNotice` 는 그대로 둔다 | §0.1. 사이드로드가 불가능한 플랫폼이라 안드로이드와 달리 우회 경로가 없지만, 같은 코드가 안드로이드에서도 도는 방어선이므로 지운다는 뜻은 아니다 |
| 5 | 번들 ID 는 **`app.atit.spin`** — 안드로이드 패키지와 같은 값 | 같은 앱이다. Universal Links·OAuth 클라이언트가 모두 이 값을 기준으로 신원을 판정한다 |
| 6 | `NativeShell` 을 **`'tauri' \| 'android' \| 'ios'`** 로 넓히고 `nativeShell()` 이 `Capacitor.getPlatform()` 을 읽는다. **`isCapacitorNative()` 는 손대지 않는다** — iOS 에서도 참이다 | `shell.ts:44` 주석이 이미 "값이 늘면(iOS 등) 여기만 넓힌다" 고 못 박아 뒀다 |
| 7 | 넓힌 뒤 **기존 `'android'` 비교 11곳을 전수 감사**해서 「Capacitor 면 참」인지 「안드로이드에서만 참」인지 하나씩 판정한다. 대부분은 전자다 | 갈라지는 파일: `share/api.ts` · `app/App.tsx` · `features/library/ShareLinkModal.tsx` · `storage/files.ts` · `features/present/useWakeLock.ts` · `features/present/useFullscreen.ts` · `sync/auth.ts` · `platform/android/nativeBridge.ts`. **이 감사가 이번 작업의 진짜 몸통이다** — `cap add ios` 는 10분이면 끝난다 |
| 8 | 🔴 **「UI 크기: 자동」의 전제가 iOS 에서 깨진다.** `cssPxPerInch()` 는 안드로이드에서 dp = 1/160 in 이라는 **정의**에 기대는데, iOS 포인트는 정의가 아니라 **기기마다 다르다**: iPad mini 8.3" 는 326 ppi @2x → **163 pt/in**, 그 밖의 iPad(Pro·Air·일반)는 264 ppi @2x → **132 pt/in** | 163/132 = **1.23 배** — 8단계 눈금 한 칸보다 큰 오차라 «자동» 이 한 칸 틀린다. `devicePixelRatio` 는 둘 다 2 라 구분에 못 쓴다 |
| 9 | 결정 8 의 해법: **포인트 단위 화면 크기로 기기를 가른다** — `screen.width/height` 가 744×1133(mini)이면 163, 아니면 132. 표는 `platform/ios/pointDensity.ts` 하나에 두고 모르는 값이면 **132 로 떨어진다**(다수파) | 브리틀한 표지만 대안이 없다(웹은 물리 ppi 를 안 알려준다). 자동이 고른 값을 [설정]이 **화면에 보여주므로** 실기에서 바로 검증된다 — 숨은 자동이 아니다(PLAN-UI-SCALE 결정 3 의 그 이유) |
| 10 | 구글 로그인은 안드로이드와 **같은 RFC 8252 흐름**(`@capacitor/browser` + PKCE + `appUrlOpen`), 어댑터는 `sync/authIos.ts` 로 `authAndroid.ts` 와 **같은 4함수**. 다른 것은 둘뿐 — 클라이언트 ID 와 **리디렉션 스킴** | 구글 **iOS 유형** 클라이언트는 시크릿이 없고 리디렉션에 **역순 클라이언트 ID**(`com.googleusercontent.apps.XXXX:/oauth2redirect`)를 쓴다. 그 스킴을 `Info.plist` 의 `CFBundleURLTypes` 에 등록해야 앱이 콜백을 받는다 |
| 11 | 갱신 토큰은 `@capacitor/preferences`. iOS 에서 이것은 `UserDefaults` 이고 **iCloud 백업에 실린다** — 안드로이드의 `allowBackup="false"`(PLAN-ANDROID 결정 7)에 해당하는 것이 기본값으로 없다 | 대응 둘 중 하나를 고른다: ⓐ 토큰만 키체인(`@capacitor-community/*` 플러그인 추가) ⓑ `Info.plist` 가 아니라 **파일 속성**으로 백업 제외. ⓐ 가 정석이고 플러그인이 하나 는다. **실기 전에 정한다** |
| 12 | 파일 내보내기는 안드로이드와 같은 경로(Filesystem Cache → Share 시트). iPad 에서 공유 시트는 **팝오버**인데 누른 단추가 아니라 **화면 가운데**에 뜬다 — 기본은 그대로 받아들인다 | `@capacitor/share` 8.0.2 의 JS API 에는 앵커 옵션이 **없고**, iOS 구현이 `setCenteredPopover(actionController)` 로 가운데 고정한다 [실측: `node_modules/@capacitor/share/ios/Sources/SharePlugin/SharePlugin.swift:71`]. 크래시는 없다. 단추에 붙이려면 플러그인을 고쳐야 하므로 실기에서 거슬릴 때만 판단한다 |
| 13 | 딥링크는 **Universal Links**: `https://spin.atit.app/.well-known/apple-app-site-association`(확장자 **없음**, `Content-Type: application/json`, 리디렉션 금지). 생성기는 `scripts/ios-aasa.mjs` 로 `android-assetlinks.mjs` 를 그대로 옮긴다 | vhost 가 점 파일을 403 으로 막지만 `.well-known` 은 예외다 — assetlinks 로 2026-09-21 에 실측 확인(200 / application/json). 같은 경로를 쓰므로 **추가 서버 작업이 0 이다** |
| 14 | 앞 파일 안의 `appID` 는 **`<팀 ID>.app.atit.spin`** — 팀 ID 는 Apple Developer 계정이 생겨야 나온다. 그래서 이 단계는 **결정 20(계정) 뒤에** 온다 | 안드로이드의 SHA-256 지문과 같은 자리의 값이다 |
| 15 | **뒤로가기는 만들지 않는다.** iOS 에는 하드웨어 뒤로가기가 없고 WKWebView 는 가장자리 스와이프를 기본으로 안 받는다 — `@capacitor/app` 의 `backButton` 은 iOS 에서 **울리지 않는다** | PLAN-ANDROID 결정 12 의 대화상자→화면→앱 순서는 안드로이드 전용이다. iOS 는 화면 안 [뒤로] 단추로 충분하다(웹앱이 이미 갖고 있다) |
| 16 | 전체화면은 안드로이드와 같은 **pseudo(CSS) 경로**. 상태바는 `Info.plist` 의 `UIStatusBarHidden`, 홈 인디케이터는 `prefersHomeIndicatorAutoHidden` | WKWebView 에 Fullscreen API 가 없다 — 애초에 브라우저 크롬이 없어 필요도 없다(PLAN-ANDROID 결정 10 과 같은 결론, 다른 이유) |
| 17 | safe-area 는 `viewport-fit=cover` + 기존 `env(safe-area-inset-*)` 를 그대로 쓴다. `UIRequiresFullScreen`(Split View 끄기)은 **켜지 않는다** | 전술판을 옆에 놓고 메모 앱을 띄우는 것이 코트에서 오히려 쓸모 있다. 끄고 싶어지면 한 줄이라 나중에 뒤집기 쉽다 |
| 18 | 버전은 `CFBundleShortVersionString` = `package.json` 의 버전, `CFBundleVersion` = **`major*1_000_000 + minor*1_000 + patch`**(안드로이드 `versionCode` 와 같은 식, 0.6.12 → 6012) | 두 스토어에 같은 수를 보내면 대조가 쉽다(PLAN-ANDROID 결정 14) |
| 19 | 🔴 **배포처가 안드로이드와 다르다 — iOS 에는 사이드로드가 없다.** GitHub 릴리스에 `.ipa` 를 올려도 **아무도 설치할 수 없다.** 길은 셋뿐: ⓐ App Store ⓑ TestFlight ⓒ Ad Hoc(100대/년, UDID 등록) | **1차 목표는 ⓑ TestFlight** 로 잡는다 — 대상이 「아는 지도자 몇십 명」이라 충분하고 정식 심사를 미룰 수 있다. 대가: 빌드가 **90일마다 만료**돼 주기적으로 다시 올려야 한다. ⓐ 는 그 뒤 |
| 20 | **Apple Developer Program(연 99 USD) 가입이 선행 조건이다.** 이것 없이는 실기 설치도, TestFlight 도, Universal Links 도 없다 | 안드로이드는 키스토어를 내가 만들면 끝이었지만 iOS 는 **계정이 곧 신원**이다. 결정 14·21·22 가 전부 여기에 걸려 있다 |
| 21 | CI 는 `desktop-release.yml` 에 **`ios` 잡**을 더한다 — `needs: build`, 러너는 **`macos-26` 고정**(`macos-latest` 별칭에 기대지 않는다) | GitHub 러너 이미지 실측(2026-09-23): `macos-15`·`macos-26` 둘 다 **Xcode 26.x** 를 싣고 있어 Capacitor 8 의 Xcode 26 요구를 만족한다 [실측: actions/runner-images]. **맥을 사지 않아도 빌드는 된다** |
| 22 | 서명 시크릿은 넷 + 업로드 키 셋: 배포 인증서 `.p12`(base64)·그 암호·프로비저닝 프로파일(base64), 그리고 App Store Connect API 키(Issuer ID·Key ID·`.p8` base64) | 안드로이드 시크릿 4개와 같은 자리다. 임시 키체인에 넣는 것은 `apple-actions/import-codesign-certs` 가 한다. 업로드는 `xcrun altool --upload-app` |
| 23 | 테스트는 jsdom 이 잴 수 있는 것만: `authIos` 의 PKCE·역순 스킴 조립, `pointDensity` 의 화면크기→ppi 사상(표 전수), `nativeShell()` 이 세 값을 옳게 가르는 것 | PLAN-ANDROID 결정 23 과 같은 선. 네이티브 플러그인은 `vi.mock` |
| 24 | ⚠️ **App Store 심사 4.8(로그인 서비스)은 걸리지 않는다** — 다만 오해받기 쉬우므로 대비한다 | 4.8 은 서드파티 로그인으로 **앱의 주 계정을 만들거나 인증할 때** 적용된다 [실측: developer.apple.com/app-store/review/guidelines]. SPIN 은 계정이 없고 구글 로그인은 **이용자 자신의 드라이브에 닿기 위한 선택 기능**이다. 심사자가 오해하면 "로그인 없이 모든 기능이 돈다" 를 심사 메모에 적고 재심사 요청한다 |
| 25 | **개발은 맥 없이 리눅스(gofu)에서 한다** — 빌드는 CI(결정 21), 실행은 USB 로 붙인 실기 iPad, 디버깅은 웹 층만. 맥이 필요한 두 가지(iOS 시뮬레이터·Swift 네이티브 디버깅)는 **포기한다** | SPIN 의 네이티브 코드는 Capacitor 템플릿과 플러그인뿐이라 잃는 것이 작다. 버린 대안: gofu 에 macOS VM(애플 EULA 가 애플 하드웨어가 아닌 기계의 macOS 가상화를 금지) · xtool(1.20.1, 2026-09-21 — 리눅스 iOS 빌드 도구지만 **SwiftPM 패키지 전용**이라 Capacitor 의 Xcode 프로젝트가 그대로 안 들어간다 [실측: README]) · 클라우드 맥 대여(CI 로 충분) |
| 26 | **루프 1단 — 웹 층은 iPad 사파리로 gofu 개발 서버를 연다**(`http://100.75.15.13:5173`, tailnet — iPad 에 Tailscale 필요). 계정도 셸도 없이 **오늘 당장** 된다. 디버깅은 USB + `pymobiledevice3 webinspector`(iPad: 설정 → Safari → 고급 → 웹 속성 켜기) | 사파리가 곧 **iOS 의 WebKit** 이라 CSS·레이아웃·터치 결함 대부분이 여기서 잡힌다. `pymobiledevice3` 는 pip 11.17, `webinspector` 명령 존재 [실측: `pymobiledevice3/cli/webinspector.py`]. 리눅스→iPad 연결 자체는 아직 안 해봤다 [미확인] |
| 27 | **루프 2단 — 셸이 필요한 것**(구글 로그인 콜백·Universal Links·공유 시트·화면 켜둠)은 CI 가 **디버그 빌드 하나**를 굽되 `server.url` 을 gofu 개발 서버로 박는다. 이후 웹 수정은 **재빌드 없이** 반영되고, CI 는 네이티브 설정을 바꿀 때만 다시 돈다. 주소는 `SPIN_IOS_DEV_SERVER` 로 넣는다 | `server.url` 은 "intended for use with live-reload servers" [실측: `@capacitor/cli` declarations]. iOS 16.4+ 디버그 빌드는 `webContentsDebuggingEnabled` 가 **따로 안 켜도 참**이라 1단과 같은 도구로 앱 안 웹뷰를 검사한다 [실측: 같은 파일 "If not set, it's `true` for development builds"]. 한 바퀴 CI(10분+)를 웹 수정마다 태우지 않는 것이 이 결정의 전부다 |
| 28 | 디버그 빌드는 태그가 아니라 **`workflow_dispatch` 로 따로 돈다** — `.github/workflows/ios-dev.yml`, 입력은 개발 서버 주소, 산출물은 **Actions 아티팩트**(릴리스 자산 아님) | `desktop-release.yml` 이 한 파일이어야 하는 이유는 **릴리스 초안 하나에 전부 붙이기 위해서**다(그 파일 머리 주석). 디버그 빌드는 릴리스를 건드리지 않으므로 그 이유가 해당되지 않는다 |
| 29 | 🔴 **가드: 릴리스 빌드에 `server.url` 이 실리면 앱이 gofu 를 향한 채 나간다.** `ios` 잡에서 구워진 `capacitor.config.json` 을 되읽어 `server` 가 있으면 실패시킨다. http 로드에 필요한 ATS 예외도 **디버그 구성에만** 둔다 | 안드로이드 pack 단계의 「릴리스인데 디버그가 나왔다」 가드와 같은 모양(AGENTS §7 의 0.6.9 사고 — 빌드는 초록인데 나간 물건이 다르다). 가드는 **일부러 `server.url` 을 넣어 한 번 떨어뜨려 본다**(돌연변이 확인). 정확한 ATS 키는 셸 얹기 단계에서 실기로 확정한다 — Capacitor 문서의 `cleartext` 는 안드로이드만 다룬다 [미확인] |
| 30 | **설치는 gofu 에서 USB 로** — `ideviceinstaller`(apt 1.2.0) 또는 `pymobiledevice3`. 개발 서명 앱이라 iPadOS 16+ 의 **개발자 모드**를 켜야 하는데, 그 메뉴는 원래 Xcode 가 기기에 붙어야 나타난다 — 맥 없이 `pymobiledevice3 amfi reveal-developer-mode` 로 드러낸다 | `amfi` 에 `reveal-developer-mode`·`enable-developer-mode`·`developer-mode-status` 가 있다 [실측: `pymobiledevice3/cli/amfi.py`]. 프로비저닝 프로파일에 그 iPad 의 UDID 가 들어 있어야 설치된다 — gofu 에서 `idevice_id -l` 로 읽어 개발자 포털에 등록(§5) |

## 1.1 뒤집을 만한 전제 — PWA 로 충분한가

정직하게 적어 둔다. iPad Safari 에서 [홈 화면에 추가] 하면 이미 크롬 없는 전체화면으로 돌고, 구글
로그인·공유 시트·화면 켜둠(Wake Lock)도 대체로 된다. **네이티브 앱이 그 위에 더 주는 것**은 셋이다.

1. **App Store 에 존재한다** — 「파워체어 풋볼」로 검색해 찾을 수 있다. PWA 는 URL 을 아는 사람만 쓴다.
2. **설치가 한 동작이다** — 코치에게 "사파리로 열고 공유 단추를 눌러 홈 화면에 추가하세요" 를 시키지 않는다.
3. **화면 켜둠·오프라인이 확실하다** — Safari 의 PWA 는 iOS 판올림 때마다 조용히 동작이 바뀌어 왔다.

**이 셋이 연 99 USD + 90일마다 TestFlight 재업로드보다 값진가** — 그 판단만 기현님이 하면 된다.
아니라고 답해도 이 문서는 버려지지 않는다: §2·§3 의 작업 대부분(`nativeShell` 확장, `'android'` 비교
감사, 포인트 밀도)은 **PWA 로 가도 그대로 필요하다.**

## 2. 손대는 곳

**새로 생기는 것**

- `src-ios/` — `npx cap add ios` 산출물(Xcode 프로젝트, `App/Info.plist`)
- `src/platform/ios/pointDensity.ts` (+ 테스트) — 결정 8·9
- `src/sync/authIos.ts` (+ 테스트) — 결정 10
- `scripts/ios-aasa.mjs` — 결정 13
- `public/.well-known/apple-app-site-association` — 결정 13·14, 생성물
- `.github/workflows/desktop-release.yml` 의 `ios` 잡 — 결정 21·22, `server.url` 가드(결정 29)
- `.github/workflows/ios-dev.yml` — 디버그 빌드, `workflow_dispatch`(결정 27·28)

**고치는 것**

- `src/platform/shell.ts` — `NativeShell` 확장, `nativeShell()`, `cssPxPerInch()` (결정 6·8·9)
- `src/platform/android/nativeBridge.ts` → 공용 부분을 `src/platform/native/` 로 올릴지 감사 후 판단 (결정 7)
- `src/sync/auth.ts` — iOS 어댑터 분기 (결정 10)
- `src/storage/files.ts` — 결정 7 감사 대상 (공유 시트 경로는 안드로이드와 같다 — 결정 12)
- `src/features/library/ShareLinkModal.tsx` · `src/share/api.ts` · `src/app/App.tsx` ·
  `src/features/present/useWakeLock.ts` · `src/features/present/useFullscreen.ts` — 결정 7 감사 대상
- `capacitor.config.ts` — `ios` 블록, `SPIN_IOS_DEV_SERVER` 가 있을 때만 `server.url`(결정 27)
- `package.json` — `@capacitor/ios` 고정, `ios:build`·`ios:dev` 스크립트
- `docs/DEVELOPMENT.md` · `README.md`(ko·en) · `ROADMAP.md` §0.7 — 랜딩과 **같은 커밋**에서

## 3. 착수 순서

**0단계 — 기현님이 먼저 (§5). 여기가 끝나기 전에는 아래 0'·1 말고는 아무것도 못 한다.**

0'. **오늘 바로 — iPad 사파리로 웹 층 실기**(결정 26). 계정도 셸도 필요 없다. iPad 에 Tailscale 을 깔고
   `http://100.75.15.13:5173` 을 연다. 여기서 나오는 결함은 셸과 무관하게 고칠 것들이다.
1. **플랫폼 분기 정리 (맥 없이 된다)** — 결정 6·7·8·9. `nativeShell()` 확장, `'android'` 비교 11곳
   전수 감사, `pointDensity` 표와 테스트. **이 단계의 산출물은 그 자체로 안드로이드 코드를 더 옳게 만든다** —
   iOS 를 포기해도 남는다.
2. **셸 얹기** — `npx cap add ios`, `TARGETED_DEVICE_FAMILY = 2`, 배포 타깃, 번들 ID, 아이콘·스플래시.
   `Info.plist`(URL 스킴·상태바·safe-area).
3. **어댑터** — `authIos.ts`(결정 10), 토큰 저장(결정 11).
4. **딥링크** — `scripts/ios-aasa.mjs`, AASA 생성·배포, `Associated Domains` 활성화.
5. **CI** — 먼저 `ios-dev.yml`(디버그 빌드 → USB 설치 → 루프 2단이 도는 것까지, 결정 27·28·30),
   그다음 `ios` 잡(시크릿 일곱, `server.url` 가드, TestFlight 업로드 — 결정 21·22·29).
   디버그 쪽을 먼저 하는 이유: 셸 결함을 CI 한 바퀴마다가 아니라 웹 수정 속도로 잡을 수 있게 된다.
6. **실기** — §4.

## 4. 실기 확인 (jsdom 이 못 재는 것)

- ☐ I-1 iPad mini 에서 앱이 뜨고 [보드]·[규칙]·[설정]이 열린다
- ☐ I-2 **「UI 크기: 자동」이 고른 값이 옳다** — mini(163)와 11인치 이상(132)에서 **각각** 본다.
  [설정]에 표시된 값이 화면에서 스크롤 없이 다 들어가는 가장 큰 눈금인가 (결정 8·9 가 여기서 판정된다)
- ☐ I-3 구글 로그인 왕복 — 역순 스킴 콜백이 앱으로 돌아온다 (결정 10)
- ☐ I-4 앱을 지웠다 다시 깔아도 **토큰이 되살아나지 않는다** (결정 11 — iCloud 백업 제외가 실제로 먹는가)
- ☐ I-5 드릴 내보내기 → 공유 시트가 화면 가운데 팝오버로 뜨고, 저장·닫기 뒤 앱으로 돌아온다 (결정 12)
- ☐ I-6 `https://spin.atit.app/s/…` 링크를 메시지로 받아 누르면 **사파리가 아니라 앱**이 연다 (결정 13·14)
- ☐ I-7 시연 전체화면에서 상태바·홈 인디케이터가 사라지고 판이 세로를 다 쓴다 (결정 16)
- ☐ I-8 Split View 로 반쪽이 됐을 때 레이아웃이 깨지지 않는다 (결정 17)
- ☐ I-9 아이폰에서 App Store 에 **앱이 보이지 않는다** (결정 4 — iPad 전용이 실제로 먹는가)
- ☐ I-10 gofu 에서 USB 로 디버그 빌드가 설치되고, 개발자 모드가 맥 없이 켜진다 (결정 30)
- ☐ I-11 디버그 빌드가 gofu 개발 서버를 불러오고, **웹 수정이 재빌드 없이** 앱에 반영된다 (결정 27)
- ☐ I-12 `pymobiledevice3 webinspector` 로 사파리 탭과 **앱 안 웹뷰** 둘 다 검사된다 (결정 26·27)

## 5. 기현님 몫 — 수동 단계 (값은 어디에도 적지 않는다, 위치만)

1. **Apple Developer Program 가입** (연 99 USD, 개인 또는 사업자). 승인까지 하루~며칠. → **팀 ID** 확보
   (결정 14·20 이 여기 걸려 있다)
2. **실기 iPad 확보** — 최소 한 대, 가능하면 **mini 한 대 + 11인치 이상 한 대**(I-2 가 두 대를 요구한다).
   **Tailscale 설치**(결정 26), 설정 → Safari → 고급 → **웹 속성** 켜기. USB 로 gofu 에 처음 붙일 때
   iPad 화면의 「이 컴퓨터를 신뢰하시겠습니까?」에 [신뢰]
3. **App Store Connect 에 앱 등록** — 번들 ID `app.atit.spin`, 카테고리(스포츠 또는 교육),
   개인정보처리방침 URL `https://spin.atit.app/settings/privacy`
4. **인증서·프로파일 발급** — 배포 인증서(`.p12`)와 프로비저닝 프로파일, 그리고 디버그 빌드용
   **개발** 인증서·프로파일 한 벌(결정 27). 맥이 없으면 CSR 은 gofu 에서 `openssl` 로 만들어
   개발자 포털 웹에 올린다. **개발 프로파일에는 iPad UDID 가 들어가야 한다** — gofu 에서
   `idevice_id -l` 로 읽어 포털 「Devices」 에 먼저 등록(결정 30)
5. **App Store Connect API 키 발급** — Issuer ID · Key ID · `.p8`. **`.p8` 는 한 번만 내려받을 수 있다**
6. **GitHub 시크릿 일곱 등록**(결정 22) — 안드로이드 넷과 같은 자리
7. **구글 클라우드 콘솔**: 같은 프로젝트에 OAuth 클라이언트 **iOS** 유형 신설, 번들 ID `app.atit.spin`.
   **역순 클라이언트 ID** 를 결정 10 의 스킴으로 쓴다
8. **TestFlight 외부 테스터 그룹** 구성 + 베타 심사 제출(결정 19)

**돈과 시간**: 연 99 USD · 계정 승인 며칠 · 심사 1~3일. 안드로이드에서 들었던 것(0원, 즉시)과 다르다.

## 6. 안드로이드와 다른 것만 한 눈에

| | 안드로이드 (완료) | iOS (이 문서) |
|---|---|---|
| 폰 제외 | `requiresSmallestWidthDp="600"` + 콘솔 수동 | `TARGETED_DEVICE_FAMILY = 2` 한 줄 |
| 사이드로드 | APK 를 GitHub 릴리스에 | **없다** — TestFlight 아니면 App Store |
| 비용 | 0 | 연 99 USD |
| 빌드 기계 | 리눅스 러너 | **macOS 러너**(Xcode 26, 실측 확인) |
| 개발 루프 | gofu 에서 `cap run android`, 에뮬레이터 | 사파리 → gofu 개발 서버, 셸은 CI 디버그 빌드 한 번 + `server.url`. **시뮬레이터 없음** |
| 실기 설치 | `adb install` | USB + `ideviceinstaller`, 개발자 모드는 `pymobiledevice3 amfi` 로 |
| 서명 | 키스토어 하나(내가 만듦) | 인증서 + 프로파일 + API 키(애플이 발급) |
| 딥링크 | `assetlinks.json`(SHA-256) | `apple-app-site-association`(팀 ID) |
| 뒤로가기 | 하드웨어 단추 처리 필요 | **없다** — 할 일 없음 |
| 「자동」 UI 크기 | dp 정의로 1/160 in **고정** | 기기마다 132 또는 163 — **표가 필요하다** |
