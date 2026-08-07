// §10.7 store — EditorProvider: state/dispatch 노출, 물리 월드 ref 수명주기.
import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createDrill } from '../../model/defaults.ts';
import { SettingsProvider } from '../settings/SettingsProvider.tsx';
import { EditorProvider, useEditorDispatch, useEditorState, useEditorWorld } from './EditorProvider.tsx';

function makeWrapper() {
  const drill = createDrill({ courtMode: 'full', formation: '1-2-1' });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <SettingsProvider>
      <EditorProvider drill={drill}>{children}</EditorProvider>
    </SettingsProvider>
  );
  return { wrapper, drill };
}

describe('EditorProvider', () => {
  it('useEditorState 가 초기 드릴로 시작한다', () => {
    const { wrapper, drill } = makeWrapper();
    const { result } = renderHook(() => useEditorState(), { wrapper });
    expect(result.current.present.id).toBe(drill.id);
    expect(result.current.stepId).toBe(drill.steps[0]!.id);
    expect(result.current.tool).toBe('select');
  });

  it('useEditorDispatch 로 보낸 액션이 useEditorState 에 반영된다', () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(
      () => ({ state: useEditorState(), dispatch: useEditorDispatch() }),
      { wrapper },
    );
    act(() => result.current.dispatch({ type: 'TOOL_SET', tool: 'ball' }));
    expect(result.current.state.tool).toBe('ball');
  });

  it('useEditorWorld 가 마운트 시 PhysicsWorldApi 를 만들고 언마운트 시 dispose 한다', () => {
    const { wrapper } = makeWrapper();
    const { result, unmount } = renderHook(() => useEditorWorld(), { wrapper });
    expect(result.current.current).not.toBeNull();
    const world = result.current.current!;
    let threw = false;
    unmount();
    expect(result.current.current).toBeNull();
    // dispose 이후 재호출해도 조용히 무시되는지(방어적) 는 physics-world 소관이라 여기서는
    // ref 가 정리됐다는 사실만 확인한다.
    try {
      world.isSettled();
    } catch {
      threw = true;
    }
    expect(threw).toBe(false);
  });
});
