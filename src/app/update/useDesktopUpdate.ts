// 데스크톱 자동 업데이트 — **찾고, 묻고, 받고, 다시 연다** (2026-09-16 기현 지시:
// *"Tauri updater를 제대로 세우고 appimage, msi, dmg만"*).
//
// ⚠️ 그 지시의 «dmg» 는 **`.app.tar.gz` 로 이행했다.** Tauri 의 맥 업데이트 묶음은 dmg 가
// 아니라 앱 묶음을 압축한 `.app.tar.gz` 다(공식 문서 「Signing updates > Building」). dmg 는
// 사람이 받아 끌어다 놓는 형식이라 자기 교체의 재료가 못 된다 — 그래서 dmg 는 다운로드
// 목록에 그대로 두고, 업데이트는 같은 판에서 나온 `.app.tar.gz` 가 진다. 덮는 셋:
//   리눅스 AppImage · 윈도우 MSI · 맥 .app.tar.gz
// deb·rpm·snap 은 **일부러 뺐다.** 그쪽은 패키지 관리자와 스토어가 갱신을 지는 영역이고,
// snap 은 confinement 가 앱의 자기 교체를 아예 막는다. 거기서 업데이트를 권하면 되지도 않는
// 일을 시키는 것이다.
//
// ⚠️ **웹앱에서는 한 줄도 안 돈다.** 플러그인 자체가 데스크톱 전용이고, `isTauriWebview()` 가
// 거짓이면 동적 import 조차 하지 않는다 — 웹 번들에 업데이터가 딸려 들어가지 않게 하려는 것이
// 첫째 이유이고(그 코드는 웹에서 영영 안 쓰인다), 브라우저에서 `@tauri-apps/*` 가 터지지
// 않게 하려는 것이 둘째다.
//
// 자동으로 **설치하지 않는다.** 찾기까지만 자동이고 받는 것은 사람이 누른다 — 코치가 체육관에서
// 시연 직전에 앱이 제멋대로 재시작하면 그날 훈련이 끝난다.
import { useCallback, useEffect, useState } from 'react';
import { isTauriWebview } from '../../storage/files.ts';

/** 찾은 새 판. 화면(모달)이 읽는 값만 담는다 — 플러그인 타입을 UI 까지 끌고 가지 않는다. */
export interface FoundUpdate {
  version: string;
  notes?: string;
}

export type UpdateStage = 'idle' | 'found' | 'downloading' | 'ready' | 'failed';

export interface DesktopUpdateApi {
  /** 새 판을 찾았는가. 웹앱·최신판이면 언제나 null 이다. */
  found: FoundUpdate | null;
  stage: UpdateStage;
  /** 0~1. 서버가 길이를 안 주면 null 이라 «진행 중» 만 보여 준다(거짓 막대를 그리지 않는다). */
  progress: number | null;
  error: string | null;
  /** 받아서 설치하고 앱을 다시 연다. 끝나면 이 함수는 **돌아오지 않는다**(앱이 재시작된다). */
  install(): void;
  dismiss(): void;
}

/** 첫 확인을 미루는 시간(ms). 뜨자마자 네트워크를 물면 첫 화면이 그만큼 늦다 — 업데이트는
 *  급한 일이 아니므로 앱이 자리를 잡은 뒤에 조용히 본다. */
const CHECK_DELAY_MS = 4000;

export function useDesktopUpdate(): DesktopUpdateApi {
  const [found, setFound] = useState<FoundUpdate | null>(null);
  const [stage, setStage] = useState<UpdateStage>('idle');
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  // 플러그인이 돌려준 핸들. 받기를 누를 때 그것을 그대로 써야 한다(두 번 찾지 않는다).
  const [handle, setHandle] = useState<{ downloadAndInstall: (cb?: (e: unknown) => void) => Promise<void> } | null>(null);

  useEffect(() => {
    if (!isTauriWebview()) return undefined;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const { check } = await import('@tauri-apps/plugin-updater');
          const up = await check();
          if (cancelled || up === null) return;
          setHandle(up as unknown as typeof handle);
          setFound({ version: up.version, notes: up.body });
          setStage('found');
        } catch (e) {
          // ⚠️ **조용히 삼킨다.** 업데이트 확인 실패는 사용자가 지금 하려는 일과 무관하다 —
          // 체육관 와이파이가 없다고 «업데이트 서버에 못 닿았습니다» 를 띄우면 그게 방해다.
          // 누른 뒤의 실패(아래 install)만 사람에게 말한다.
          if (!cancelled) setError(e instanceof Error ? e.message : String(e));
        }
      })();
    }, CHECK_DELAY_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  const install = useCallback((): void => {
    if (handle === null) return;
    setStage('downloading');
    setError(null);
    void (async () => {
      try {
        let total = 0;
        let got = 0;
        await handle.downloadAndInstall((ev) => {
          const e = ev as { event: string; data?: { contentLength?: number; chunkLength?: number } };
          if (e.event === 'Started') total = e.data?.contentLength ?? 0;
          else if (e.event === 'Progress') {
            got += e.data?.chunkLength ?? 0;
            setProgress(total > 0 ? Math.min(1, got / total) : null);
          } else if (e.event === 'Finished') setStage('ready');
        });
        // 여기 닿으면 설치까지 끝난 것이다. 리눅스·맥은 앱을 다시 열어야 새 판이 뜬다.
        const { relaunch } = await import('@tauri-apps/plugin-process');
        await relaunch();
      } catch (e) {
        setStage('failed');
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [handle]);

  const dismiss = useCallback((): void => {
    setFound(null);
    setStage('idle');
  }, []);

  return { found, stage, progress, error, install, dismiss };
}
