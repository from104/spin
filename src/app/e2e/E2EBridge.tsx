// 시험 다리 자리 — `?e2e=1` 일 때만 편집기 트리 안에 마운트된다. docs/PLAN-TEST-SUITE.md §3·§4.
//
// App.tsx 의 `NativeBridge` 와 같은 꼴이다: 아무것도 그리지 않고, **동적 import** 로 설치 모듈
// (installE2EBridge.ts)을 불러 `window.__spinE2E` 를 세운다. 판정(`E2E_MODE`)은 **마운트 자리**
// (EditorWorkspace 의 `{E2E_MODE && <E2EBridge …/>}`)에 한 번만 둔다 — 여기에 한 번 더 두면 두 겹이 되어,
// 마운트 자리의 판정을 지워도 "플래그 없으면 미설치" 시험(E2EBridge.test.tsx)이 빨개지지 않는다.
//
// 편집기 트리 안이어야 하는 이유: 다리가 읽는 셋(리듀서 상태·TransformWriter·자동저장 훅의 상태)이
// 전부 EditorProvider 와 EditorWorkspace 의 지역 상태라 그 바깥에서는 닿지 않는다.
import { useEffect, useRef } from 'react';
import { useEditorState, useEditorWriter } from '../../store/editor/EditorProvider.tsx';
import type { AutosaveApi } from '../useAutosave.ts';
import type { E2EBridgeSource } from './installE2EBridge.ts';

export function E2EBridge({ autosave, playing }: { autosave: AutosaveApi | null; playing: boolean }) {
  const state = useEditorState();
  const writer = useEditorWriter();
  // 다리의 getter 는 언제 불려도 **지금** 값을 읽어야 한다 — 매 렌더 갈아 끼운다(BoardHost 의 presentRef 와 같은 꼴)
  const sourceRef = useRef<E2EBridgeSource | null>(null);
  sourceRef.current = { state, writer, playing, autosave: autosave && { status: autosave.status, pending: autosave.pending } };

  useEffect(() => {
    let off: (() => void) | null = null;
    let cancelled = false;
    void import('./installE2EBridge.ts').then(({ installE2EBridge }) => {
      // StrictMode 의 이중 마운트에서 첫 회차가 이미 정리된 뒤 도착할 수 있다(NativeBridge 와 같은 사정)
      if (cancelled) return;
      off = installE2EBridge(() => sourceRef.current!);
    });
    return () => {
      cancelled = true;
      off?.();
    };
  }, []);

  return null;
}
