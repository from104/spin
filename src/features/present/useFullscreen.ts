// §6.9 전체화면. 브라우저 표(§6.9): Chrome/Edge/Firefox 는 표준 API, Safari macOS/iPadOS 는
// webkit 접두, iPhone Safari 는 <video> 전용이라 Fullscreen API 자체가 없다 → `pseudo` 폴백
// (position:fixed; inset:0; height:100dvh 등, 실제 CSS 는 PresentScreen 이 그린다 — 이 훅은
// 상태 판정만 맡는다).
//
// ⚠️ 2026-09-17 안드로이드(PLAN-ANDROID 결정 10) — 네이티브 웹뷰에는 **세 번째 길**이 있다.
// Fullscreen API 는 «있는데 듣지 않는다»: Capacitor 의 `BridgeWebChromeClient.onShowCustomView`
// 가 요청을 받자마자 `onCustomViewHidden()` 을 되불러 그 자리에서 취소한다. 그래서 거기서는
// 부르지 않고 곧장 `pseudo`(CSS) 로 가고, 몰입은 **시스템 바 숨김**이 만든다.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { isCapacitorNative } from '../../platform/shell.ts';

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

/** 시스템 바(상태바·내비게이션바)를 감추거나 되돌린다. 안드로이드 몰입형의 전부다.
 *
 *  `SystemBars` 는 Capacitor 8 의 **코어 플러그인**이라 따로 설치할 패키지가 없다 — 옛 문서가
 *  시키는 `@capacitor/status-bar` 는 이 판에서 필요 없다. `bar` 를 생략하면 둘 다 걸린다.
 *  `animation` 은 주지 않는다: iOS 전용 옵션이라 안드로이드에서는 무시된다.
 *
 *  ⚠️ **네이티브에서만 부른다.** 웹 구현(`SystemBarsPluginWeb`)은 전부 no-op Promise 라 가드
 *  없이 불러도 터지지는 않는다 — 그래서 더 위험하다. 가드가 없으면 «부르긴 부르는데 아무 일도
 *  안 나는» 코드가 되고, 데스크톱에서 전체화면이 왜 안 되는지 찾는 데 시간을 먹는다. */
async function setSystemBarsHidden(hidden: boolean): Promise<void> {
  if (!isCapacitorNative()) return;
  try {
    // 동적 import — 정적으로 부르면 웹 번들이 Capacitor 런타임을 끌고 들어온다.
    const { SystemBars } = await import('@capacitor/core');
    await (hidden ? SystemBars.hide() : SystemBars.show());
  } catch {
    // 바를 못 감춰도 시연은 돌아야 한다 — 몰입이 조금 덜할 뿐이고, 화면은 이미 pseudo 다.
  }
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

  // ⚠️ **언마운트도 시연을 떠나는 길이다** — 부작용을 건 쪽이 되돌린다.
  // `exit()` 를 거치지 않는 길이 둘 있다: 하드웨어 뒤로가기(`platform/android/nativeBridge.ts` 가
  // `history.back()` 을 부르면 시연 화면이 그냥 언마운트된다)와 시연 [나가기](`nav.back()`).
  // 되돌리지 않으면 시스템 바가 **영영 숨은 채** 남아 라이브러리·설정이 상태바·내비바 없이
  // 그려지고 `--safe-area-inset-*` 도 0 으로 남는다(실기 A-3·A-9). 웹에서 이 구멍이 안 보였던
  // 이유는 브라우저가 DOM 이 사라질 때 네이티브 전체화면을 스스로 풀기 때문이다 — 시스템 바는
  // 아무도 안 풀어 준다. deps 가 빈 것에 뜻이 있다(언마운트 한 번). 상태를 ref 로만 읽으므로
  // 첫 렌더의 닫힌 값을 붙들 일이 없다.
  useEffect(
    () => () => {
      if (!pseudoRef.current) return; // native 는 브라우저 몫. pseudo 로 감춘 것만 우리가 되돌린다.
      pseudoRef.current = false;
      void setSystemBarsHidden(false); // 가드가 안에 있어 웹·iPhone pseudo 에서는 즉시 돌아온다
    },
    [],
  );

  const enter = useCallback(async (_o?: { userGesture: boolean }): Promise<void> => {
    const el = ref.current;
    if (!el) return;
    // 네이티브(안드로이드)는 Fullscreen API 를 **부르지 않는다**(머리말). 부르면 요청이
    // 그 자리에서 취소되면서 `fullscreenchange` 한 번이 헛돌아 상태만 흔들린다.
    if (isCapacitorNative()) {
      pseudoRef.current = true;
      setState('pseudo');
      await setSystemBarsHidden(true);
      return;
    }
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
      // 들어올 때 감췄으면 나갈 때 되돌린다. 네이티브가 아니면 이 호출은 즉시 돌아온다
      // (가드가 안에 있다) — pseudo 는 iPhone Safari 에서도 쓰는 상태라 여기서 셸을 또
      // 가르지 않는다.
      await setSystemBarsHidden(false);
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
