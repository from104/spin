// §10.7 store — EditorProvider: state/dispatch 노출, 물리 월드 ref 수명주기.
import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createDrill } from '../../model/defaults.ts';
import { newId } from '../../core/ids.ts';
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

describe('스텝 전환 시 물리 월드 동기화 (회귀)', () => {
  /** 두 스텝의 개체 위치가 확실히 다른 드릴 */
  function makeTwoStepDrill() {
    const base = createDrill({ courtMode: 'full', formation: '1-2-1' });
    const s0 = base.steps[0]!;
    const s1 = {
      ...s0,
      id: newId('st'),
      name: '두 번째',
      chairs: Object.fromEntries(Object.entries(s0.chairs).map(([id, p]) => [id, { ...p!, x: p!.x + 180 }])),
    };
    return { ...base, steps: [s0, s1] } as typeof base;
  }

  it('스텝을 넘기면 물리 바디도 새 스텝 위치로 옮겨진다', async () => {
    // 회귀: world.load 의 deps 가 [cast, courtMode] 뿐이라 스텝을 넘겨도 물리 바디는 이전 스텝
    // 위치에 머물렀다. 화면은 트윈으로 옳게 움직이므로 눈으로는 멀쩡해 보이지만, 그 상태에서
    // 개체를 잡으면 beginDrag 가 낡은 자세를 읽어와 이전 스텝 자리로 튀었다.
    const drill = makeTwoStepDrill();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <SettingsProvider>
        <EditorProvider drill={drill}>{children}</EditorProvider>
      </SettingsProvider>
    );
    const { result } = renderHook(() => ({ world: useEditorWorld(), dispatch: useEditorDispatch() }), { wrapper });

    const chairId = Object.keys(drill.steps[0]!.chairs)[0]!;
    const step1X = (drill.steps[0]!.chairs as Record<string, { x: number }>)[chairId]!.x;
    const step2X = (drill.steps[1]!.chairs as Record<string, { x: number }>)[chairId]!.x;
    expect(step2X).toBe(step1X + 180);

    expect(result.current.world.current?.read()[chairId]?.x).toBeCloseTo(step1X, 1);

    await act(async () => {
      result.current.dispatch({ type: 'STEP_SELECT', id: drill.steps[1]!.id });
    });

    expect(result.current.world.current?.read()[chairId]?.x).toBeCloseTo(step2X, 1);
  });
});
