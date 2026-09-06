// §6.7 Provider 조립 — god-context 금지: 5개 Provider 를 분리해서 겹쳐 쌓는다.
// EditorProvider/PlaybackProvider 는 여기 없다 — "editor 화면에서만"/"editor·present 화면
// 공용"(§6.7 표) 이라 화면을 실제로 마운트하는 screen-editor/screen-present 가 그 화면 트리
// 안에서 직접 마운트한다. App 은 앱 전역 3종(Settings·Library·Toast)만 책임진다.
import { useEffect, useRef } from 'react';
import { cues } from '../ui/cues.ts';
import { resolveDrillRepo } from '../storage/drillRepo.ts';
import { seedDrillsOnce } from '../storage/seed.ts';
import { createBrowserRouter, createHashRouter, RouterProvider } from 'react-router';
import { legacyHashPath, splitLocalePrefix } from './localePrefix.ts';
import { SettingsProvider, useSettingsActions, useSettingsState } from '../store/settings/SettingsProvider.tsx';
import { LibraryProvider, useLibraryActions } from '../store/library/LibraryProvider.tsx';
import { ToastProvider } from '../store/toast/ToastProvider.tsx';
import { useLocale } from '../i18n/useLocale.ts';
import { useSyncEngine } from '../sync/useSyncEngine.ts';
import { AppShell } from './AppShell.tsx';

/** §4.6 FOUC 방지 부트 스크립트가 첫 페인트 전 data-theme 을 심어 두지만, 그 이후(테마 토글·
 *  설정 화면의 uiScale·큰 터치 타깃·놓임 소리)는 React 가 넘겨받아야 한다. localStorage 를
 *  동기로 다시 읽지 않고 이미 로드된 SettingsProvider 의 prefs 를 단일 출처로 삼는다 — 두
 *  출처가 있으면 부트 스크립트 갱신 없이 prefs 스키마가 바뀔 때 조용히 어긋난다.
 *  (export 는 테스트용이다 — 이 조각만 떼어 마운트해야 AppShell 트리 전체를 세우지 않는다.) */
export function ThemeEffects() {
  const { prefs } = useSettingsState();

  useEffect(() => {
    document.documentElement.dataset.theme = prefs.theme;
  }, [prefs.theme]);

  useEffect(() => {
    // §7.4 uiScale — 텍스트가 있는 컴포넌트만 rem 을 쓰므로 루트 폰트 크기 하나로 전부 스케일된다.
    document.documentElement.style.fontSize = `${16 * prefs.a11y.uiScale}px`;
  }, [prefs.a11y.uiScale]);

  useEffect(() => {
    // §7.3 큰 터치 타깃 — tokens.css 의 body[data-touch="large"] 가 --hit 을 56px 로 올린다.
    if (prefs.a11y.largeTargets) document.body.dataset.touch = 'large';
    else delete document.body.dataset.touch;
  }, [prefs.a11y.largeTargets]);

  useEffect(() => {
    // §4.3 P1-4 놓임 소리·진동. **왜 SettingsProvider 가 아니라 여기인가**: 모션 줄이기와
    // 같은 층의 설정이지만(그쪽은 store 가 documentElement 에 data 속성을 건다), `cues` 는
    // ui-kit 이고 DESIGN.md §8 모듈 표에서 `store` 의 의존 목록에 ui-kit 이 없다. 의존이 전부
    // 열려 있는 app-shell 이 그 배선을 대신 진다 — uiScale·큰 터치 타깃과 같은 자리다.
    cues.setEnabled(prefs.a11y.sound);
  }, [prefs.a11y.sound]);

  return null;
}

/** i18n C1 — `<html lang>` 반영. 테마와 달리 부트 스크립트 짝이 없다: React 가 그리기 전에
 *  뜨는 정적 HTML 은 **자기 언어를 이미 `<html lang>` 에 달고 나온다** — 프리렌더(SEO C1,
 *  scripts/prerender.mjs)가 페이지마다 박아 주기 때문이다. 그러니 여기가 하는 일은 첫 화면을
 *  맞추는 것이 아니라, 설정에서 언어를 바꿨을 때 따라가는 것이다.
 *
 *  ⚠️ 2026-09-02 이전 주석은 *"정적 HTML 에 어떤 언어의 텍스트도 없다(빈 `#root`)"* 였다.
 *  프리렌더가 `#root` 안에 규칙 본문을 넣으면서 그 전제가 죽었다. export 는 테스트용. */
export function LocaleEffects() {
  const locale = useLocale();

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return null;
}

/** §3 seed 드릴 1회 심기(3.8). `ThemeEffects` 와 같은 자리·같은 모양이다 — 아무것도 안 그리고
 *  prefs 를 한 번 읽어 부작용 하나를 배선하는 조각. export 는 테스트용이다.
 *
 *  **왜 LibraryProvider 안이 아니라 여기인가**: 저장소를 쥔 쪽은 LibraryProvider 지만, 거기에
 *  넣으면 그 Provider 가 `SettingsProvider` **없이는 못 서는 물건**이 된다. 지금 그것을 단독으로
 *  마운트하는 테스트가 셋 있고(`LibraryProvider.test.tsx` · `LibraryScreen.test.tsx` ·
 *  `SessionsScreen.test.tsx`), 그 중 둘은 목록 화면 소유다. app-shell 은 의존이 전부
 *  열려 있는 유일한 모듈이라(§8) 두 Provider 를 함께 보는 조립은 원래 이쪽 몫이다.
 *
 *  **순서가 계약이다**: 심기 → 도장. 도장을 먼저 찍으면 심기가 실패한 기기에서 기본 드릴이 영영
 *  사라진다. 반대 순서의 위험(도장을 못 찍어 다음 실행에 또 심기)은 `storage/seed.ts` 의
 *  자물쇠 ②(같은 id 가 이미 있으면 안 심는다 — ⚠️ 2026-09-06 제목에서 id 로 바뀌었다)가 받는다.
 *
 *  **ref 가드는 StrictMode 때문이다**(main.tsx). 이중 마운트에서 effect 가 두 번 도는데 ref 는
 *  remount 를 건너 살아남는다. 대신 **취소 플래그는 두지 않는다** — 첫 회를 취소하면 심기는
 *  이미 나갔는데 도장과 목록 갱신만 빠지는, 가장 나쁜 절반 상태가 된다.
 *
 *  **로케일을 ref 로 읽는 이유**(2026-09-06, 시드가 규칙 장면이 되면서 생긴 자리): 심는 드릴의
 *  팀 라벨이 로케일을 탄다. 그런데 `/en/…` 으로 들어온 첫 방문에서는 `LocaleFromUrl` 이 같은
 *  커밋의 effect 에서 언어를 바꾸므로, 이 effect 가 **그 반영 전의 값**을 잡는다. 심기는
 *  `resolveDrillRepo()` 를 기다렸다가 진행하니, 그 사이에 온 최신 값을 ref 에서 읽으면
 *  영어로 들어온 사람이 한국어 팀 라벨을 받는 일이 없다. 의존성에 locale 을 넣는 것으로는
 *  안 된다 — `startedRef` 가 재진입을 막아 두 번째 실행이 아예 없다. */
export function SeedDrills() {
  const { prefs } = useSettingsState();
  const { setPrefs } = useSettingsActions();
  const { refresh } = useLibraryActions();
  const locale = useLocale();
  const localeRef = useRef(locale);
  localeRef.current = locale;
  const startedRef = useRef(false);

  useEffect(() => {
    if (prefs.seeded || startedRef.current) return;
    startedRef.current = true;
    void (async () => {
      try {
        const { repo } = await resolveDrillRepo();
        const outcome = await seedDrillsOnce(repo, { seeded: false, locale: localeRef.current });
        setPrefs({ seeded: true });
        if (outcome.seeded) await refresh();
      } catch {
        // IDB 열화·쿼터 초과. 도장을 안 찍었으니 다음 실행에서 다시 시도한다 — 시드 드릴이
        // 없다고 앱이 못 뜰 이유는 없으므로 조용히 넘긴다(§4.5 "드릴 목록은 살아있어야").
        startedRef.current = false;
      }
    })();
  }, [prefs.seeded, setPrefs, refresh]);

  return null;
}

/** C4(react-router 도입) — **스플랫 단일 라우트**다. 경로 매칭은 routes.ts 의 parsePath 가
 *  하고(AppShell 의 화면 스위치가 그 결과를 읽는다), 라우터는 히스토리·URL·location.state 를
 *  진다. 중첩 라우트가 0 인 앱이라(레일+헤더는 화면이 아니라 크롬이다) Outlet 계층을 세우면
 *  얻는 것 없이 화면-크롬 사이에 컨텍스트 배관만 는다 — 화면이 정말 중첩되는 날 다시 편다.
 *  **해시 라우터인 이유는 routes.ts 머리말에** (정적 파일 배포 = SPA fallback 없음). */
/** **왜 더 이상 해시가 아닌가** (2026-09-02). routes.ts 머리말이 적어 둔 해시의 근거는
 *  *"배포가 정적 파일 복사라 SPA fallback 재작성 규칙이 없다 — BrowserRouter 는 `/drills`
 *  새로고침에서 404 다"* 였다. **그 전제가 죽었다**: 지금 배포처(spin.atit.app)의 vhost 에는
 *  `FallbackResource /index.html` 이 있고 `/library` 가 200 으로 뜬다(실측). 두 번째 근거였던
 *  *"URL 공유가 제품 시나리오에 없다"* 도, 규칙 해설을 검색에서 찾아 들어오게 만들기로 한
 *  순간 죽었다 — 해시 뒤는 구글이 URL 로 보지 않아서 앱 전체가 **한 장짜리 페이지**였다.
 *
 *  `file:` 만 예외로 남긴다. 데스크톱(Tauri)·로컬 파일 열기에는 서버가 없어 fallback 이
 *  없으므로 거기서는 해시가 여전히 유일한 방법이다 — 옛 근거가 아직 살아 있는 자리다. */
function createAppRouter() {
  const routes = [{ path: '*', element: <AppShell /> }];
  if (typeof window === 'undefined' || window.location.protocol === 'file:') {
    return createHashRouter(routes);
  }
  // 0.6.0 까지 나간 해시 주소를 먼저 경로로 갈아 끼운다. 라우터를 만들기 **전**이어야 한다 —
  // 뒤에 하면 라우터가 이미 뿌리를 첫 엔트리로 잡아 board 를 한 번 그린다.
  const moved = legacyHashPath(window.location.pathname, window.location.hash);
  if (moved) window.history.replaceState(null, '', moved);
  return createBrowserRouter(routes, { basename: splitLocalePrefix(window.location.pathname).basename });
}

const router = createAppRouter();

/** SEO C1 — 주소가 언어를 명시했으면(`/en/…`·`/ja/…`) 그 언어로 연다.
 *
 *  일본어 검색 결과를 눌러 들어온 사람에게 한국어 화면을 보여주면 그 방문은 거기서 끝난다.
 *  **저장된 설정보다 주소가 세다** — 주소의 언어는 방문자가 방금 고른 것이고, 설정은 예전에
 *  고른 것이기 때문이다. 그래서 prefs 를 실제로 바꾼다(설정 화면에서 되돌릴 수 있다).
 *  뿌리(`/`)로 들어오면 아무것도 안 한다 — 그쪽은 설정·자동감지의 영역 그대로다. */
export function LocaleFromUrl() {
  const { prefs } = useSettingsState();
  const { setPrefs } = useSettingsActions();
  const appliedRef = useRef(false);

  useEffect(() => {
    if (appliedRef.current) return;
    appliedRef.current = true;
    const { locale } = splitLocalePrefix(window.location.pathname);
    if (locale && prefs.language !== locale) setPrefs({ language: locale });
    // 의존성을 비워 두는 것이 계약이다 — 첫 진입에만 본다. 안 그러면 설정 화면에서 언어를
    // 바꾸는 순간 주소가 그것을 다시 되돌린다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

/** 0.6 Drive 동기화 — SeedDrills 와 같은 자리·같은 모양(아무것도 안 그리고 부작용 배선).
 *  LibraryProvider 안인 이유: 패스가 문서를 내려받으면 refresh 로 목록을 다시 읽어야 한다.
 *  동기화 꺼짐(기본값)·미구성 빌드에서는 훅이 아무 배선도 하지 않는다(useSyncEngine). */
export function SyncEffects() {
  useSyncEngine();
  return null;
}

export default function App() {
  return (
    <SettingsProvider>
      <ThemeEffects />
      <LocaleFromUrl />
      <LocaleEffects />
      <LibraryProvider>
        <SeedDrills />
        <SyncEffects />
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </LibraryProvider>
    </SettingsProvider>
  );
}
