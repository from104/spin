import { useCallback, useEffect, useRef } from 'react';
import { liveRegion } from './LiveRegion.tsx';

const THROTTLE_MS = 400;

/**
 * §7.5e "스로틀 400ms" — 드래그 중 좌표 안내처럼 고빈도로 갱신되는 문구를
 * `liveRegion.say` 로 흘려보내되 400ms 에 한 번만 실제 낭독시킨다.
 * leading + trailing: 첫 호출은 즉시 낭독, 창 안에서 이어지는 호출은 마지막 문구만
 * 트레일링에 낭독한다(중간 문구를 다 읽으면 스크린리더가 밀린다).
 */
export function useThrottledAnnounce(ms: number = THROTTLE_MS): (text: string) => void {
  const lastAtRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const pendingRef = useRef<string | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  return useCallback(
    (text: string) => {
      const now = Date.now();
      const elapsed = now - lastAtRef.current;
      if (elapsed >= ms && timerRef.current === null) {
        lastAtRef.current = now;
        liveRegion.say(text);
        return;
      }
      pendingRef.current = text;
      if (timerRef.current === null) {
        timerRef.current = window.setTimeout(
          () => {
            timerRef.current = null;
            lastAtRef.current = Date.now();
            if (pendingRef.current !== null) {
              liveRegion.say(pendingRef.current);
              pendingRef.current = null;
            }
          },
          Math.max(0, ms - elapsed),
        );
      }
    },
    [ms],
  );
}
