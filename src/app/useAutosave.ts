// §4.6/§6.8/§4.3 — 편집 중 드릴을 IndexedDB 에 CAS(§4.3 putDrill expectedUpdatedAt)로 자동 저장한다.
// "커밋 후 800ms 디바운스 + 화면 전환 이펙트에서 동기 플러시 + visibilitychange:hidden 플러시.
// 탭을 닫을 때 저장이 진행 중이면 beforeunload." (§6.8)
//
// EditorProvider 가 "editor 화면에서만" 마운트되므로(§6.7) 이 훅은 screen-editor 가 그 트리
// 안에서(= EditorProvider 의 자손에서) 불러야 한다 — useEditorState/useEditorDispatch 를 그대로
// 통과시켜 쓴다.
import { useCallback, useEffect, useRef, useState } from 'react';
import { resolveDrillRepo } from '../storage/drillRepo.ts';
import { StorageError } from '../storage/errors.ts';
import { useEditorDispatch, useEditorState } from '../store/editor/EditorProvider.tsx';

const AUTOSAVE_DEBOUNCE_MS = 800;

export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'conflict' | 'error';

export interface AutosaveApi {
  status: AutosaveStatus;
  /** 다른 탭이 같은 드릴을 먼저 저장했다(§4.3 E_CONFLICT). 사용자가 덮어쓰기/사본 저장을
   *  고르기 전까지 자동저장은 재시도하지 않는다 — screen-editor 가 이 값으로 다이얼로그를 띄운다. */
  conflict: boolean;
  /** 디바운스를 건너뛰고 즉시 저장을 시도한다. 이미 conflict 면 아무것도 하지 않는다. */
  flush(): Promise<void>;
}

export function useAutosave(enabled: boolean = true): AutosaveApi {
  const state = useEditorState();
  const dispatch = useEditorDispatch();
  const [status, setStatus] = useState<AutosaveStatus>('idle');

  // flush 시점에 항상 최신 상태를 읽는다 — 디바운스 타이머가 걸린 뒤 여러 번 더 편집돼도
  // 마지막 상태 하나만 저장한다(중간 스냅샷을 저장할 이유가 없다).
  const stateRef = useRef(state);
  stateRef.current = state;
  const savingRef = useRef(false);
  const conflictRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  // 마지막으로 저장을 "시도"한 present 참조 — 편집 리듀서는 변경 경로만 새 객체를 만들므로
  // (§6.7 "딥카피 0회") 참조 동일성만으로 "저장할 내용이 있는지" 판단할 수 있다.
  // updatedAt 은 저장 시점에만 바뀌므로(§4.3 putDrill touch) 이 판단에 쓸 수 없다.
  const lastAttemptedRef = useRef(state.present);

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const flush = useCallback(async (): Promise<void> => {
    if (!enabled || conflictRef.current || savingRef.current) return;
    clearTimer();
    const s = stateRef.current;
    if (s.present === lastAttemptedRef.current) return; // 변경 없음
    const previousAttempt = lastAttemptedRef.current;
    lastAttemptedRef.current = s.present;
    savingRef.current = true;
    setStatus('saving');
    try {
      const { repo } = await resolveDrillRepo();
      const saved = await repo.putDrill(s.present, { expectedUpdatedAt: s.baselineUpdatedAt });
      dispatch({ type: 'SAVED', at: saved.updatedAt });
      setStatus('saved');
    } catch (e) {
      if (e instanceof StorageError && e.code === 'E_CONFLICT') {
        conflictRef.current = true;
        setStatus('conflict');
      } else {
        // 다음 커밋(혹은 다음 flush)에서 같은 내용을 재시도할 수 있도록 되돌린다
        // (E_DB_UNAVAILABLE/E_QUOTA 는 일시적일 수 있다).
        lastAttemptedRef.current = previousAttempt;
        setStatus('error');
      }
    } finally {
      savingRef.current = false;
    }
  }, [enabled, dispatch]);

  // 커밋(= present 참조 변경) 후 800ms 디바운스.
  //
  // ★ 정착 억제 창(§4.2 A-5): 드래그는 커밋을 **두 번** 만든다 — 손을 뗀 시점(PLACE_COMMIT)과
  //   물리가 다 선 시점(PLACE_SETTLE). 정착이 800ms 를 넘으면 그 사이에 디바운스가 터져 IDB
  //   CAS 쓰기가 두 번 나가고, 그 두 번째는 첫 번째가 아직 날아가는 중이면(savingRef) 조용히
  //   **버려진다** — 정착 좌표가 저장되지 않는다. 그래서 첫 커밋의 타이머를 억제 창 마감까지
  //   미뤄 두 커밋을 한 번의 쓰기로 합친다.
  //   마감은 절대 시각이라 정착 통지가 영영 안 와도(스텝 전환으로 world.load 가 끼어들면
  //   그렇게 된다) 그 시각에 타이머가 스스로 터진다 — 저장이 영구히 멎지 않는다.
  useEffect(() => {
    if (!enabled || conflictRef.current) return;
    clearTimer();
    const holdMs = state.settleHoldUntil - Date.now();
    timerRef.current = window.setTimeout(
      () => {
        timerRef.current = null;
        void flush();
      },
      holdMs > 0 ? holdMs : AUTOSAVE_DEBOUNCE_MS,
    );
    return clearTimer;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.present, state.settleHoldUntil, enabled]);

  // visibilitychange:hidden 플러시 — 탭 전환·기기 화면 잠금에도 유실 없이 저장한다.
  useEffect(() => {
    if (!enabled) return;
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') void flush();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [enabled, flush]);

  // beforeunload — 저장이 진행 중이거나 디바운스 대기 중이면 브라우저 이탈 경고를 띄운다.
  useEffect(() => {
    if (!enabled) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (savingRef.current || timerRef.current !== null) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [enabled]);

  // 화면 전환(= 이 훅을 부른 컴포넌트의 언마운트) 시 동기 플러시. IndexedDB 쓰기는 본질적으로
  // 비동기라 완료를 기다릴 수 없지만, 트랜잭션은 React 생명주기와 무관하게 진행된다.
  useEffect(() => {
    return () => {
      void flush();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { status, conflict: status === 'conflict', flush };
}
