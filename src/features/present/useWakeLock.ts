// §6.9 Wake Lock — 화면 꺼짐 방지. secure context 필수라 사설 IP http 배포에서는 항상
// `unsupported` 로 떨어진다 — PresentScreen 이 그 상태를 문구로 노출한다(role="status", 6초).
// 탭이 숨겨지면 브라우저가 자동으로 sentinel 을 해제하므로 visibilitychange 에서 재획득한다.
import { useEffect, useRef, useState } from 'react';

export type WakeLockState = 'idle' | 'active' | 'unsupported' | 'denied';

interface NavigatorWithWakeLock {
  wakeLock?: { request(type: 'screen'): Promise<WakeLockSentinel> };
}

export function useWakeLock(enabled: boolean): WakeLockState {
  const [state, setState] = useState<WakeLockState>('idle');
  const sentinelRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
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
