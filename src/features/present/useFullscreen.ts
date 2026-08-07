// §6.9 전체화면. 브라우저 표(§6.9): Chrome/Edge/Firefox 는 표준 API, Safari macOS/iPadOS 는
// webkit 접두, iPhone Safari 는 <video> 전용이라 Fullscreen API 자체가 없다 → `pseudo` 폴백
// (position:fixed; inset:0; height:100dvh 등, 실제 CSS 는 PresentScreen 이 그린다 — 이 훅은
// 상태 판정만 맡는다).
import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

export type FullscreenState = 'off' | 'native' | 'pseudo';

export interface UseFullscreenResult {
  state: FullscreenState;
  supported: boolean;
  enter(o?: { userGesture: boolean }): Promise<void>;
  exit(): Promise<void>;
}

// 표준 API 가 없는 브라우저(Safari)의 webkit 접두 변형 — lib.dom.d.ts 에 없어 로컬로 좁혀 쓴다.
interface WebkitFullscreenDoc {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
  webkitFullscreenEnabled?: boolean;
}
interface WebkitFullscreenEl {
  webkitRequestFullscreen?: () => Promise<void> | void;
}

function currentFullscreenElement(): Element | null {
  const d = document as Document & WebkitFullscreenDoc;
  return d.fullscreenElement ?? d.webkitFullscreenElement ?? null;
}

function fullscreenIsSupported(): boolean {
  if (typeof document === 'undefined') return false;
  const d = document as Document & WebkitFullscreenDoc;
  if (typeof d.fullscreenEnabled === 'boolean') return d.fullscreenEnabled;
  if (typeof d.webkitFullscreenEnabled === 'boolean') return d.webkitFullscreenEnabled;
  // enabled 플래그가 없는 구형 구현이라도 requestFullscreen 자체가 있으면 지원으로 본다.
  return typeof document.documentElement.requestFullscreen === 'function';
}

/** iPhone Safari 는 Fullscreen API 자체가 없다 — `enter()` 가 실패하면 `pseudo` CSS 폴백으로
 *  떨어진다. `enter()`/`exit()` 는 실제 DOM 조작만 하고, 실제 상태 갱신은 `fullscreenchange`
 *  리스너가 authoritative 하게 확정한다(요청 실패·시스템 뒤로가기 양쪽 다 정확히 반영). */
export function useFullscreen(ref: RefObject<HTMLElement | null>): UseFullscreenResult {
  const [state, setState] = useState<FullscreenState>('off');
  const pseudoRef = useRef(false);

  useEffect(() => {
    const onChange = (): void => {
      const active = currentFullscreenElement() === ref.current;
      if (active) {
        pseudoRef.current = false;
        setState('native');
      } else if (!pseudoRef.current) {
        setState('off');
      }
      // pseudo 상태는 fullscreenchange 로 판정할 수 없다(브라우저 API 밖) — exit() 에서만 끈다.
    };
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('webkitfullscreenchange', onChange);
    };
  }, [ref]);

  const enter = useCallback(async (_o?: { userGesture: boolean }): Promise<void> => {
    const el = ref.current;
    if (!el) return;
    const target = el as HTMLElement & WebkitFullscreenEl;
    const request = target.requestFullscreen?.bind(target) ?? target.webkitRequestFullscreen?.bind(target);
    if (!request) {
      pseudoRef.current = true;
      setState('pseudo');
      return;
    }
    try {
      await request({ navigationUI: 'hide' } as FullscreenOptions);
      pseudoRef.current = false;
      setState('native');
    } catch {
      // 제스처 없이 호출됐거나 사용자가 거부한 경우 — CSS 의사 전체화면으로 떨어진다.
      pseudoRef.current = true;
      setState('pseudo');
    }
  }, [ref]);

  const exit = useCallback(async (): Promise<void> => {
    if (pseudoRef.current) {
      pseudoRef.current = false;
      setState('off');
      return;
    }
    const d = document as Document & WebkitFullscreenDoc;
    const exitFn = document.exitFullscreen?.bind(document) ?? d.webkitExitFullscreen?.bind(document);
    try {
      await exitFn?.();
    } catch {
      // 이미 전체화면이 아니면 조용히 무시 — 어차피 목표 상태는 'off'.
    }
    setState('off');
  }, []);

  return { state, supported: fullscreenIsSupported(), enter, exit };
}
