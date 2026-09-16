// 안드로이드 네이티브 브리지 — **뒤로가기**(PLAN-ANDROID 결정 12)와 **딥링크 착지**(결정 9)
// 둘만 진다. 정본은 `docs/PLAN-ANDROID.md` §1 그 두 줄이다.
//
// ⚠️ 이 파일은 **네이티브에서만 import 된다**(`app/App.tsx` 의 동적 import + `isCapacitorNative()`
//    가드). 정적으로 부르면 `@capacitor/app` 이 웹 번들에 통째로 실린다 — 웹에서는 한 줄도
//    안 쓰이는 코드다. 같은 이유로 안쪽에서도 플러그인을 동적으로 연다.
//
// ⚠️ **로그인 복귀는 여기서 받지 않는다.** 커스텀 스킴 `app.atit.spin:/oauth2redirect` 는
//    `sync/authAndroid.ts` 가 자기 `appUrlOpen` 리스너로 받아 `state` 를 맞춰 보고 인가 코드를
//    토큰으로 바꾼다(결정 5). 한 리스너가 둘을 다 받으면 인가 코드가 이 파일을 거쳐 가게 되고,
//    그것은 열쇠를 나르는 경로를 하나 더 만드는 일이다. 여기서는 **https 링크만** 본다.
import { splitLocalePrefix } from '../../app/localePrefix.ts';
import type { PluginListenerHandle } from '@capacitor/core';

/** App Links 로 잡는 호스트. `src-android/app/src/main/AndroidManifest.xml` 의 intent-filter
 *  (`autoVerify="true"` · `android:host="spin.atit.app"` · `pathPrefix="/s/"`)와 **같은 값이어야
 *  한다** — 한쪽만 고치면 안드로이드는 링크를 앱에 넘기는데 앱이 조용히 무시하거나(대문이 뜬다),
 *  그 반대로 앱이 기다리는 링크가 브라우저로 샌다. */
const APP_LINK_HOST = 'spin.atit.app';

/** 공유 링크 착지 경로. `/s/<id>` 뿐이고 id 꼴은 **보지 않는다** — `app/routes.ts` 의 같은
 *  자리 주석 그대로다(오타 한 글자짜리 링크를 여기서 떨구면 "링크가 없거나 만료됐습니다" 라는
 *  알맞은 문구를 볼 기회조차 사라진다). 뒤 슬래시는 받아서 지운다: 메신저가 링크 끝에 `/` 를
 *  붙여 보내는 일이 있고, 그때 인텐트는 이미 앱에 도착해 있어서 여기서 null 을 내면 사용자는
 *  «눌렀는데 대문이 떴다» 를 본다. */
const SHARE_PATH_RE = /^\/s\/([^/]+)\/?$/;

/** 딥링크 URL → 라우터에 넘길 앱 내부 경로. 우리 것이 아니면 `null`(= 아무것도 하지 않는다).
 *
 *  **열쇠는 `#` 뒤에 그대로 실려 간다.** 공유 링크의 복호 키는 서버에 없고 조각(fragment)에만
 *  있으므로(`share/link.ts`), 경로만 넘기고 해시를 버리면 착지 시트가 "열쇠가 맞지 않습니다"를
 *  띄운다. `AppShell` 의 `useShareLanding` 이 `location.hash` 를 한 번 읽고 지우는 구조라,
 *  이 함수가 할 일은 해시를 **살려서** 넘기는 것뿐이다. */
export function deepLinkPath(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null; // URL 이 아닌 것(빈 문자열 등)은 조용히 흘린다 — 브리지가 죽을 이유가 없다.
  }
  // https 만 본다: 커스텀 스킴은 로그인 몫이고(머리말), http 는 App Links 로 검증되지 않아
  // 애초에 우리 인텐트가 아니다.
  if (u.protocol !== 'https:' || u.hostname !== APP_LINK_HOST) return null;
  // 로케일 접두(`/en`·`/ja`)는 **웹의 SEO 장치**다(`app/localePrefix.ts`). 앱은 언제나
  // `https://localhost/` 에서 떠서 라우터 basename 이 `/` 하나이므로, 접두를 단 채 navigate 하면
  // 라우터가 `ja` 를 첫 조각으로 읽어 대문으로 떨어진다. 걷어내고 넘긴다 — 링크가 어느 언어
  // 페이지에서 복사됐든 앱의 언어는 설정이 쥐고 있다.
  const { rest } = splitLocalePrefix(u.pathname);
  const m = SHARE_PATH_RE.exec(rest);
  if (!m) return null;
  return `/s/${m[1]!}${u.hash}`;
}

/** 라우터에 길을 묻는 통로. `App.tsx` 가 모듈 수준 `router.navigate` 를 그대로 넘긴다 — 훅이
 *  아니라 값이라 이 파일이 React 를 몰라도 된다. */
export type NavigateFn = (path: string) => void;

/** 앱이 되돌아갈 곳이 있는가.
 *
 *  ⚠️ 2026-09-17 에뮬레이터 실측(Pixel Tablet AVD, API 35): 플러그인이 주는 `canGoBack`(=
 *  `WebView.canGoBack()`)은 라우터의 pushState 이동을 **세지 않는다** — 딥링크로 라이브러리에
 *  착지한 뒤에도 false 라, 결정 12 그대로면 뒤로가기 한 번에 앱이 홈으로 내려갔다. 진실은
 *  라우터가 쥐고 있다: react-router 의 브라우저 히스토리는 자기 엔트리 번호를
 *  `history.state.idx` 에 적는다(첫 엔트리 0, `createBrowserHistory` 의 `getIndex`). 그 값이
 *  없는 자리(라우터 밖 상태)에서만 네이티브 판정으로 물러난다. */
export function canGoBackInApp(nativeCanGoBack: boolean): boolean {
  const state = window.history.state as { idx?: unknown } | null;
  const idx = state?.idx;
  return typeof idx === 'number' ? idx > 0 : nativeCanGoBack;
}

/** 열린 대화상자가 있으면 뒤로가기는 **그것을 닫는 것**이다 — 화면을 떠나거나 앱을 내리면
 *  안 된다. Modal·CenterModal·TutorialOverlay 는 document 의 keydown(캡처)을, Drawer 는 자기
 *  루트의 keydown 을 듣고 Escape 에 닫히므로, 맨 위 대화상자 **요소에** Escape 를 쏘면 캡처 단계의
 *  document 리스너와 버블 단계의 루트 리스너가 둘 다 받는다(document 에 쏘면 Drawer 가 못 받는다).
 *  보냈으면 true — 닫혔는지는 확인하지 않는다(닫기를 거부하는 대화상자는 그럴 이유가 있다). */
export function closeTopDialog(): boolean {
  const dialogs = document.querySelectorAll<HTMLElement>('[role="dialog"]');
  const top = dialogs[dialogs.length - 1];
  if (!top) return false;
  top.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  return true;
}

/** 브리지를 건다. 돌려주는 함수를 부르면 리스너가 전부 떨어진다.
 *
 *  **동기로 돌려주는 이유**: React effect 의 정리 함수는 동기여야 한다. 플러그인을 여는 것은
 *  비동기라, 등록이 끝나기 전에 언마운트되는 창(StrictMode 의 이중 마운트가 바로 그것이다)이
 *  생긴다 — `disposed` 플래그로 그때 받은 핸들을 받자마자 떼어 리스너가 새지 않게 한다. */
export function mountNativeBridge(navigate: NavigateFn): () => void {
  let disposed = false;
  const handles: PluginListenerHandle[] = [];

  const track = (pending: Promise<PluginListenerHandle>): void => {
    void pending
      .then((h) => {
        if (disposed) void h.remove().catch(() => {});
        else handles.push(h);
      })
      .catch(() => {
        // 리스너 등록 실패는 브리지가 없다는 뜻이다(가드가 틀렸거나 플러그인이 빠졌다).
        // 앱이 못 뜰 이유는 아니므로 조용히 넘긴다 — 뒤로가기는 시스템 기본 동작으로 돌아간다.
      });
  };

  void (async () => {
    const { App } = await import('@capacitor/app');
    if (disposed) return;

    track(
      App.addListener('backButton', ({ canGoBack }) => {
        // ⚠️ 리스너가 **하나라도 있으면** 플러그인은 자기 기본 동작을 하지 않는다
        //    (@capacitor/app 8.1.1 `AppPlugin.java:49` — `hasListeners(EVENT_BACK_BUTTON)`).
        //    즉 아래 세 줄이 안드로이드 뒤로가기의 전부다. 순서가 계약이다: 대화상자 → 화면 → 앱.
        if (closeTopDialog()) return;
        // `canGoBack` 을 그대로 믿지 않는 이유는 `canGoBackInApp` 머리말(에뮬레이터 실측).
        if (canGoBackInApp(canGoBack)) window.history.back();
        // 첫 화면에서는 **홈으로 내린다**. `exitApp()` 은 프로세스를 죽여서, 되돌아온 사람이
        // 편집 중이던 화면 대신 첫 화면을 본다(결정 12).
        else void App.minimizeApp().catch(() => {});
      }),
    );

    track(
      App.addListener('appUrlOpen', ({ url }) => {
        const path = deepLinkPath(url);
        if (path) navigate(path);
      }),
    );

    // ⚠️ 찬 시작(앱이 꺼진 채 링크를 누름)도 **바로 위 리스너로 온다** — 따로 물을 것이 없다.
    //    `BridgeActivity.load()` 가 런치 인텐트를 `onNewIntent(getIntent())` 로 되돌려 넣고
    //    (`@capacitor/android` `BridgeActivity.java:51`), 그것을 받은 AppPlugin 이
    //    `notifyListeners(EVENT_URL_OPEN, ret, true)` 로 **보관**했다가(`AppPlugin.java:142-154`,
    //    retainUntilConsumed) JS 가 첫 `addListener` 를 거는 순간 넘긴다
    //    (`Plugin.java:626-640` `sendRetainedArgumentsForEvent`). 그래서 위 리스너 하나면
    //    찬 시작·더운 시작이 같은 길로 들어온다.
    //
    //    ── ⚠️ 2026-09-17: 여기 `App.getLaunchUrl()` 로 한 번 더 묻는 블록이 있었다. 근거로 적었던
    //    "플러그인은 `handleOnNewIntent` 에서만 쏘므로 찬 시작에는 안 온다"(`AppPlugin.java:142`)
    //    는 **쏘는 자리**만 맞고 전제가 틀렸다 — 런치 인텐트가 바로 그 자리로 되돌아 들어간다.
    //    결과는 같은 URL 을 두 번 navigate 하는 것이었고, 히스토리가 [`/`, `/s/X`, `/s/X#key`]
    //    세 칸이 돼 ① `useShareLanding` 이 일부러 지운 열쇠가 주소·웹뷰 히스토리에 되살아나고
    //    ② 착지 화면에서 뒤로가기 한 번이 «아무 일도 안 난다»(같은 경로로 pop) 였다.
    //    실기 A-8·A-9 가 그 자리에서 헛돈다. dedupe 로 덮지 않고 **지운** 이유: 마지막 URL 을
    //    기억해 거르면 «같은 링크를 두 번 누르는» 정상 사용까지 막힌다. ────────────────────
  })();

  return () => {
    disposed = true;
    for (const h of handles) void h.remove().catch(() => {});
    handles.length = 0;
  };
}
