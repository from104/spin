// §6.7 Provider 조립 — god-context 금지: 5개 Provider 를 분리해서 겹쳐 쌓는다.
// EditorProvider/PlaybackProvider 는 여기 없다 — "editor 화면에서만"/"editor·present 화면
// 공용"(§6.7 표) 이라 화면을 실제로 마운트하는 screen-editor/screen-present 가 그 화면 트리
// 안에서 직접 마운트한다. App 은 앱 전역 3종(Settings·Library·Toast)만 책임진다.
import { useEffect } from 'react';
import { cues } from '../ui/cues.ts';
import { SettingsProvider, useSettingsState } from '../store/settings/SettingsProvider.tsx';
import { LibraryProvider } from '../store/library/LibraryProvider.tsx';
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

export default function App() {
  return (
    <SettingsProvider>
      <ThemeEffects />
      <LibraryProvider>
        <ToastProvider>
          <AppShell />
        </ToastProvider>
      </LibraryProvider>
    </SettingsProvider>
  );
}
