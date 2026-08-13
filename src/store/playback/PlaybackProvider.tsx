// §6.7 PlaybackProvider — editor·present 공용. "playing, speed, 누적 타이밍 ref (stepIndex 없음)".
// 누적 타이밍은 60fps 로 전진하므로 React state 에 두지 않는다(§6.1 규칙3: 물리/타이밍 → React 는
// 커밋 1회) — ref 로 들고, 컴포넌트는 매 rAF 프레임 getElapsedMs() 를 읽어 sampleDrill 에 넘긴다.
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

export type PlaybackSpeed = 0.5 | 1 | 2;

export interface PlaybackState {
  playing: boolean;
  speed: PlaybackSpeed;
  loop: boolean;
}
export interface PlaybackActions {
  play(): void;
  pause(): void;
  toggle(): void;
  setSpeed(s: PlaybackSpeed): void;
  setLoop(v: boolean): void;
  /** 재생 중이 아니면 0 이 아니라 마지막 elapsed 를 유지한다(스크럽 도중 pause 해도 위치 보존). */
  getElapsedMs(): number;
  /** dtMs*speed 만큼 전진시키고 새 elapsed(ms) 를 반환한다. 재생 중이 아니면 no-op. */
  advanceMs(dtMs: number): number;
  seekMs(ms: number): void;
  resetMs(): void;
}

const PlaybackStateContext = createContext<PlaybackState | null>(null);
const PlaybackActionsContext = createContext<PlaybackActions | null>(null);

export function PlaybackProvider({
  children,
  initialSpeed = 1,
  initialLoop = false,
}: {
  children: ReactNode;
  initialSpeed?: PlaybackSpeed;
  /** 설정 [재생] > '마지막 스텝에서 반복'(`prefs.loop`)의 초기값.
   *
   *  ⚠️ 2026-08-13(6차 검증) 이전에는 이 prop 이 **없었고** loop 가 `useState(false)` 하드코딩
   *  이었다. `initialSpeed` 는 있는데 이것만 없어서, `prefs.loop` 는 저장·마이그레이션·검증·
   *  백업까지 전부 왕복하면서 **재생에는 한 번도 닿지 않았다**(프로덕션 소비처가 설정 토글
   *  자기 자신 1곳뿐이었다). 설정 행의 *"끝나면 처음 스텝으로 되돌아갑니다"* 가 거짓이던
   *  기간이다. 되돌리면 playbackLoopPref.test.tsx 의 ①②④ 가 빨개진다. */
  initialLoop?: boolean;
}) {
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeedState] = useState<PlaybackSpeed>(initialSpeed);
  // 초기값일 뿐이다 — 시연 화면의 [반복] 버튼은 그대로 이 세션 안에서 값을 뒤집는다.
  // 설정은 "어느 쪽으로 켜고 시작하는가" 만 정하고, 판단은 코치에게 남긴다.
  const [loop, setLoopState] = useState(initialLoop);
  const elapsedRef = useRef(0);
  const playingRef = useRef(false);
  const speedRef = useRef<PlaybackSpeed>(initialSpeed);
  playingRef.current = playing;
  speedRef.current = speed;

  const play = useCallback(() => setPlaying(true), []);
  const pause = useCallback(() => setPlaying(false), []);
  const toggle = useCallback(() => setPlaying((p) => !p), []);
  const setSpeed = useCallback((s: PlaybackSpeed) => setSpeedState(s), []);
  const setLoop = useCallback((v: boolean) => setLoopState(v), []);
  const getElapsedMs = useCallback(() => elapsedRef.current, []);
  const advanceMs = useCallback((dtMs: number) => {
    if (playingRef.current) elapsedRef.current += dtMs * speedRef.current;
    return elapsedRef.current;
  }, []);
  const seekMs = useCallback((ms: number) => {
    elapsedRef.current = Math.max(0, ms);
  }, []);
  const resetMs = useCallback(() => {
    elapsedRef.current = 0;
  }, []);

  const state = useMemo<PlaybackState>(() => ({ playing, speed, loop }), [playing, speed, loop]);
  const actions = useMemo<PlaybackActions>(
    () => ({ play, pause, toggle, setSpeed, setLoop, getElapsedMs, advanceMs, seekMs, resetMs }),
    [play, pause, toggle, setSpeed, setLoop, getElapsedMs, advanceMs, seekMs, resetMs],
  );

  return (
    <PlaybackActionsContext.Provider value={actions}>
      <PlaybackStateContext.Provider value={state}>{children}</PlaybackStateContext.Provider>
    </PlaybackActionsContext.Provider>
  );
}

export function usePlaybackState(): PlaybackState {
  const v = useContext(PlaybackStateContext);
  if (!v) throw new Error('usePlaybackState 는 PlaybackProvider 안에서만 쓸 수 있다');
  return v;
}
export function usePlaybackActions(): PlaybackActions {
  const v = useContext(PlaybackActionsContext);
  if (!v) throw new Error('usePlaybackActions 는 PlaybackProvider 안에서만 쓸 수 있다');
  return v;
}
export function usePlayback(): PlaybackState & PlaybackActions {
  const state = usePlaybackState();
  const actions = usePlaybackActions();
  return useMemo(() => ({ ...state, ...actions }), [state, actions]);
}
