// §6.9 Wake Lock — 화면 꺼짐 방지. secure context 필수라 사설 IP http 배포에서는 항상
// `unsupported` 로 떨어진다 — PresentScreen 이 그 상태를 문구로 노출한다(role="status", 6초).
// 탭이 숨겨지면 브라우저가 자동으로 sentinel 을 해제하므로 visibilitychange 에서 재획득한다.
//
// ⚠️ 2026-09-17 안드로이드(PLAN-ANDROID 결정 10) — 네이티브에서는 **플러그인이 먼저다.**
// 웹뷰의 Wake Lock 은 지원이 반쪽이고(Permissions API 가 없어 거부 이유를 물을 수도 없다),
// `@capacitor-community/keep-awake` 는 액티비티 창에 `FLAG_KEEP_SCREEN_ON` 을 거는 확실한 길이다.
import { useEffect, useRef, useState } from 'react';
import { isCapacitorNative } from '../../platform/shell.ts';

export type WakeLockState = 'idle' | 'active' | 'unsupported' | 'denied';

interface NavigatorWithWakeLock {
  wakeLock?: { request(type: 'screen'): Promise<WakeLockSentinel> };
}

/** 네이티브 플래그 조작을 **부른 순서대로** 돌리는 한 줄.
 *
 *  `FLAG_KEEP_SCREEN_ON` 은 훅마다 하나가 아니라 **액티비티 창에 하나**다. 그래서 켜기·끄기가
 *  각자 동적 import 를 기다리면, 늦게 시킨 일이 먼저 끝나 결과가 뒤집힌다 — 시연을 껐다 켜기를
 *  빠르게 하면 상태는 'active' 인데 화면은 꺼지는, 실기에서만 보이고 재현도 잘 안 되는 종류다.
 *  모듈 수준에 두는 것이 옳다: 고치는 대상이 모듈이 아니라 **기기**이기 때문이다. */
let keepAwakeChain: Promise<void> = Promise.resolve();

function queueKeepAwake(want: boolean): Promise<void> {
  keepAwakeChain = keepAwakeChain
    // 앞 회차가 실패했다고 다음 회차를 막지 않는다 — 줄의 목적은 순서이지 성패 전파가 아니다.
    .catch(() => {})
    .then(async () => {
      const { KeepAwake } = await import('@capacitor-community/keep-awake');
      await (want ? KeepAwake.keepAwake() : KeepAwake.allowSleep());
    });
  return keepAwakeChain;
}

export function useWakeLock(enabled: boolean): WakeLockState {
  const [state, setState] = useState<WakeLockState>('idle');
  const sentinelRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    // 네이티브가 **먼저**다: 웹뷰에도 `navigator.wakeLock` 이 있는 판이 있어서 순서를 바꾸면
    // 반쪽짜리 브라우저 경로가 확실한 플래그를 가린다(결정 10).
    if (isCapacitorNative()) {
      let cancelled = false;
      if (!enabled) {
        setState('idle');
        // 아래 정리 함수가 이미 끄고 지나갔을 수 있다(켬→끔이면 두 번 나간다). 그래도 여기서
        // 한 번 더 부르는 이유는 바로 밑 브라우저 경로가 sentinel 을 명시적으로 놓는 것과 같다 —
        // 플래그는 **기기에 하나**라, "꺼져 있어야 할 때 확실히 껐다"가 한 번 더 도는 no-op 보다
        // 싸다. 줄(`queueKeepAwake`)이 순서를 지키므로 두 번 나가도 결과는 같다.
        void queueKeepAwake(false).catch(() => {});
        return;
      }
      void queueKeepAwake(true).then(
        () => {
          if (!cancelled) setState('active');
        },
        () => {
          // 플러그인이 없거나 거절했다. 브라우저 경로의 'denied' 와 같은 뜻이라 같은 값을 쓴다 —
          // 화면은 이 값 하나로 «화면이 꺼질 수 있습니다» 를 띄운다(PresentRunner).
          if (!cancelled) setState('denied');
        },
      );
      // ⚠️ **visibilitychange 재획득이 없다.** 브라우저 sentinel 은 탭이 숨으면 시스템이
      //    회수해 가지만, 플래그는 창에 그대로 붙어 있다(앱이 뒤에 있는 동안 효력이 없을
      //    뿐이다). 회수당하지 않으니 되찾을 것도 없다 — 아래 브라우저 경로의 리스너를 여기
      //    복사해 오면 돌아올 때마다 플래그를 한 번씩 더 거는 헛일만 는다.
      return () => {
        cancelled = true;
        void queueKeepAwake(false).catch(() => {});
      };
    }

    const nav = navigator as Navigator & NavigatorWithWakeLock;
    if (!enabled) {
      void sentinelRef.current?.release().catch(() => {});
      sentinelRef.current = null;
      setState('idle');
      return;
    }
    if (!nav.wakeLock) {
      setState('unsupported');
      return;
    }
    let cancelled = false;

    const acquire = async (): Promise<void> => {
      try {
        const sentinel = await nav.wakeLock!.request('screen');
        if (cancelled) {
          void sentinel.release().catch(() => {});
          return;
        }
        sentinelRef.current = sentinel;
        setState('active');
        sentinel.addEventListener('release', () => {
          // 탭이 숨겨지면 브라우저가 자동으로 sentinel 을 해제한다 — ref 도 함께 비워야
          // visibilitychange 핸들러의 `!sentinelRef.current` 재획득 조건이 성립한다.
          if (sentinelRef.current === sentinel) sentinelRef.current = null;
          if (!cancelled) setState('idle');
        });
      } catch {
        // NotAllowedError(권한 거부) 등 — secure context 가 아니거나 시스템이 거부한 경우.
        if (!cancelled) setState('denied');
      }
    };

    void acquire();

    const onVisibility = (): void => {
      if (document.visibilityState === 'visible' && !sentinelRef.current) void acquire();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      void sentinelRef.current?.release().catch(() => {});
      sentinelRef.current = null;
    };
  }, [enabled]);

  return state;
}
