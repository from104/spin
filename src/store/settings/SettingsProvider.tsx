// §4.6 설정 상태. localStorage 동기 읽기(storage/prefs.ts)를 감싸는 얇은 Provider — god-context
// 금지 원칙에 따라 state 컨텍스트와 actions 컨텍스트를 분리한다(actions 만 쓰는 컴포넌트가
// prefs 변경에 리렌더되지 않는다).
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Preferences, PhysicsParams } from '../../storage/prefs.ts';
import { loadPrefs, savePrefs, resolvePhysics, resetPrefs as resetPrefsStorage } from '../../storage/prefs.ts';

export interface SettingsState {
  prefs: Preferences;
  physics: PhysicsParams;
  /** savePrefs 가 false 를 반환한 첫 순간을 screen-settings 가 토스트 트리거로 쓴다(§4.6). */
  persistFailed: boolean;
}
export interface SettingsActions {
  /** 부분 갱신 + 즉시 영속화. 실패해도 React state 는 갱신된다(이번 탭 한정 유지). */
  setPrefs(patch: Partial<Preferences>): boolean;
  resetPrefs(): void;
}

const SettingsStateContext = createContext<SettingsState | null>(null);
const SettingsActionsContext = createContext<SettingsActions | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefsState] = useState<Preferences>(() => loadPrefs());
  const [persistFailed, setPersistFailed] = useState(false);

  const setPrefs = useCallback((patch: Partial<Preferences>): boolean => {
    let persisted = true;
    setPrefsState((cur) => {
      const merged: Preferences = { ...cur, ...patch };
      persisted = savePrefs(merged);
      return merged;
    });
    if (!persisted) setPersistFailed(true);
    return persisted;
  }, []);

  const doReset = useCallback(() => {
    resetPrefsStorage();
    setPrefsState(loadPrefs());
    setPersistFailed(false);
  }, []);

  const state = useMemo<SettingsState>(() => ({ prefs, physics: resolvePhysics(prefs), persistFailed }), [prefs, persistFailed]);
  const actions = useMemo<SettingsActions>(() => ({ setPrefs, resetPrefs: doReset }), [setPrefs, doReset]);

  // §7.8 a11y.reduceMotion — '항상 켬'(='always')은 JS 트윈만 0ms 로 만드는 걸로는 부족하다
  // (감사 minor #11): CSS 애니메이션·트랜지션은 OS 의 prefers-reduced-motion 미디어쿼리만 보고
  // 돌아서, OS 설정이 없는 사용자가 앱 안에서 '항상 켬' 을 골라도 CSS 모션이 안 꺼진다.
  // 'system'(=OS 따름)일 때는 CSS 의 @media (prefers-reduced-motion: reduce) 가 이미 알아서
  // 처리하므로 여기서 손댈 필요가 없다 — 'always' 로 명시적으로 켰을 때만 루트에 data 속성을
  // 걸어 CSS 쪽에서도 강제로 끌 수 있게 한다.
  // (styles 담당 에이전트에게 필요한 CSS: `:root[data-reduce-motion="true"] *, ::before, ::after
  // { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important;
  //   transition-duration: 0.01ms !important; scroll-behavior: auto !important; }`)
  useEffect(() => {
    if (prefs.a11y.reduceMotion === 'always') {
      document.documentElement.dataset.reduceMotion = 'true';
    } else {
      delete document.documentElement.dataset.reduceMotion;
    }
  }, [prefs.a11y.reduceMotion]);

  return (
    <SettingsActionsContext.Provider value={actions}>
      <SettingsStateContext.Provider value={state}>{children}</SettingsStateContext.Provider>
    </SettingsActionsContext.Provider>
  );
}

export function useSettingsState(): SettingsState {
  const v = useContext(SettingsStateContext);
  if (!v) throw new Error('useSettingsState 는 SettingsProvider 안에서만 쓸 수 있다');
  return v;
}
export function useSettingsActions(): SettingsActions {
  const v = useContext(SettingsActionsContext);
  if (!v) throw new Error('useSettingsActions 는 SettingsProvider 안에서만 쓸 수 있다');
  return v;
}
/** 편의 훅 — state+actions 를 합쳐서 쓴다(§6.7 계약 export 명). state 를 구독하므로 prefs
 *  변경 시 리렌더된다; dispatch 전용 최적화가 필요하면 useSettingsActions 를 직접 쓴다. */
export function useSettings(): SettingsState & SettingsActions {
  const state = useSettingsState();
  const actions = useSettingsActions();
  return useMemo(() => ({ ...state, ...actions }), [state, actions]);
}
