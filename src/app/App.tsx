// §6.7 Provider 조립 — god-context 금지: 5개 Provider 를 분리해서 겹쳐 쌓는다.
// EditorProvider/PlaybackProvider 는 여기 없다 — "editor 화면에서만"/"editor·present 화면
// 공용"(§6.7 표) 이라 화면을 실제로 마운트하는 screen-editor/screen-present 가 그 화면 트리
// 안에서 직접 마운트한다. App 은 앱 전역 3종(Settings·Library·Toast)만 책임진다.
import { useEffect, useRef } from 'react';
import { cues } from '../ui/cues.ts';
import { resolveDrillRepo } from '../storage/drillRepo.ts';
import { seedDrillsOnce } from '../storage/seed.ts';
import { createHashRouter, RouterProvider } from 'react-router';
import { SettingsProvider, useSettingsActions, useSettingsState } from '../store/settings/SettingsProvider.tsx';
import { LibraryProvider, useLibraryActions } from '../store/library/LibraryProvider.tsx';
import { ToastProvider } from '../store/toast/ToastProvider.tsx';
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

/** §3 seed 드릴 1회 심기(3.8). `ThemeEffects` 와 같은 자리·같은 모양이다 — 아무것도 안 그리고
 *  prefs 를 한 번 읽어 부작용 하나를 배선하는 조각. export 는 테스트용이다.
 *
 *  **왜 LibraryProvider 안이 아니라 여기인가**: 저장소를 쥔 쪽은 LibraryProvider 지만, 거기에
 *  넣으면 그 Provider 가 `SettingsProvider` **없이는 못 서는 물건**이 된다. 지금 그것을 단독으로
 *  마운트하는 테스트가 셋 있고(`LibraryProvider.test.tsx` · `LibraryScreen.test.tsx` ·
 *  `SessionsScreen.test.tsx`), 그 중 둘은 목록 화면 소유다. app-shell 은 의존이 전부
 *  열려 있는 유일한 모듈이라(§8) 두 Provider 를 함께 보는 조립은 원래 이쪽 몫이다.
 *
 *  **순서가 계약이다**: 심기 → 도장. 도장을 먼저 찍으면 심기가 실패한 기기에서 온보딩이 영영
 *  사라진다. 반대 순서의 위험(도장을 못 찍어 다음 실행에 또 심기)은 `storage/seed.ts` 의
 *  자물쇠 ②(같은 제목이 이미 있으면 안 심는다)가 받는다.
 *
 *  **ref 가드는 StrictMode 때문이다**(main.tsx). 이중 마운트에서 effect 가 두 번 도는데 ref 는
 *  remount 를 건너 살아남는다. 대신 **취소 플래그는 두지 않는다** — 첫 회를 취소하면 심기는
 *  이미 나갔는데 도장과 목록 갱신만 빠지는, 가장 나쁜 절반 상태가 된다. */
export function SeedDrills() {
  const { prefs } = useSettingsState();
  const { setPrefs } = useSettingsActions();
  const { refresh } = useLibraryActions();
  const startedRef = useRef(false);

  useEffect(() => {
    if (prefs.seeded || startedRef.current) return;
    startedRef.current = true;
    void (async () => {
      try {
        const { repo } = await resolveDrillRepo();
        const outcome = await seedDrillsOnce(repo, { seeded: false });
        setPrefs({ seeded: true });
        if (outcome.seeded) await refresh();
      } catch {
        // IDB 열화·쿼터 초과. 도장을 안 찍었으니 다음 실행에서 다시 시도한다 — 온보딩 드릴
        // 셋이 없다고 앱이 못 뜰 이유는 없으므로 조용히 넘긴다(§4.5 "드릴 목록은 살아있어야").
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
const router = createHashRouter([{ path: '*', element: <AppShell /> }]);

export default function App() {
  return (
    <SettingsProvider>
      <ThemeEffects />
      <LibraryProvider>
        <SeedDrills />
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </LibraryProvider>
    </SettingsProvider>
  );
}
