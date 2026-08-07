// §4.6/§6.8/§4.3 — useAutosave: 커밋 후 디바운스 저장 + CAS(expectedUpdatedAt) + 충돌 처리.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { idbDrillRepo } from '../storage/drillRepo.ts';
import { SettingsProvider } from '../store/settings/SettingsProvider.tsx';
import { EditorProvider, useEditorDispatch, useEditorState } from '../store/editor/EditorProvider.tsx';
import { useAutosave } from './useAutosave.ts';

async function makeStoredDrill() {
  return idbDrillRepo.createDrill({ courtMode: 'full', title: '자동저장 테스트' });
}

function makeWrapper(drill: Awaited<ReturnType<typeof makeStoredDrill>>) {
  return ({ children }: { children: ReactNode }) => (
    <SettingsProvider>
      <EditorProvider drill={drill}>{children}</EditorProvider>
    </SettingsProvider>
  );
}

function useHarness() {
  return { state: useEditorState(), dispatch: useEditorDispatch(), autosave: useAutosave() };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('useAutosave', () => {
  it('편집이 없으면 flush() 가 아무것도 쓰지 않는다', async () => {
    const drill = await makeStoredDrill();
    const putSpy = vi.spyOn(idbDrillRepo, 'putDrill');
    const { result } = renderHook(() => useHarness(), { wrapper: makeWrapper(drill) });

    await act(async () => {
      await result.current.autosave.flush();
    });
    expect(putSpy).not.toHaveBeenCalled();
    expect(result.current.autosave.status).toBe('idle');
  });

  it('커밋 후 flush() 가 CAS 로 저장하고 SAVED 를 디스패치한다', async () => {
    const drill = await makeStoredDrill();
    const { result } = renderHook(() => useHarness(), { wrapper: makeWrapper(drill) });

    act(() => result.current.dispatch({ type: 'TOOL_SET', tool: 'ball' })); // UI 전용 — 커밋 아님(참고용)
    act(() => result.current.dispatch({ type: 'META_SET', patch: { title: '수정된 제목' } }));
    expect(result.current.state.present.title).toBe('수정된 제목');

    await act(async () => {
      await result.current.autosave.flush();
    });

    expect(result.current.autosave.status).toBe('saved');
    expect(result.current.state.savedAt).not.toBeNull();

    const stored = await idbDrillRepo.getDrill(drill.id);
    expect(stored?.title).toBe('수정된 제목');
  });

  it('연속 두 번 저장해도 두 번째가 거짓 E_CONFLICT 로 실패하지 않는다', async () => {
    // store/editor/reducer.ts 의 SAVED 케이스는 baselineUpdatedAt 을 `s.present.updatedAt`
    // (로컬 편집으로는 절대 안 바뀌는 값)으로 재기준한다 — useAutosave 가 그 값을 그대로 믿으면
    // 두 번째 저장부터 항상 낡은 expectedUpdatedAt 을 보내 매번 거짓 충돌이 난다. 이 훅은 실제
    // 저장 성공 시각을 직접 추적해 우회한다(useAutosave.ts confirmedBaselineRef 주석 참고).
    const drill = await makeStoredDrill();
    const { result } = renderHook(() => useHarness(), { wrapper: makeWrapper(drill) });

    act(() => result.current.dispatch({ type: 'META_SET', patch: { title: '첫 저장' } }));
    await act(async () => {
      await result.current.autosave.flush();
    });
    expect(result.current.autosave.status).toBe('saved');

    act(() => result.current.dispatch({ type: 'META_SET', patch: { title: '두 번째 저장' } }));
    await act(async () => {
      await result.current.autosave.flush();
    });
    expect(result.current.autosave.status).toBe('saved'); // 'conflict' 로 떨어지면 회귀다
    expect(result.current.autosave.conflict).toBe(false);

    const stored = await idbDrillRepo.getDrill(drill.id);
    expect(stored?.title).toBe('두 번째 저장');
  });

  it('저장된 뒤 추가 편집 없이 다시 flush() 하면 재저장하지 않는다', async () => {
    const drill = await makeStoredDrill();
    const { result } = renderHook(() => useHarness(), { wrapper: makeWrapper(drill) });
    act(() => result.current.dispatch({ type: 'META_SET', patch: { title: 'A' } }));
    await act(async () => {
      await result.current.autosave.flush();
    });
    const putSpy = vi.spyOn(idbDrillRepo, 'putDrill');
    await act(async () => {
      await result.current.autosave.flush();
    });
    expect(putSpy).not.toHaveBeenCalled();
  });

  it('다른 탭이 먼저 저장해 E_CONFLICT 가 나면 conflict 상태가 되고 재시도하지 않는다', async () => {
    const drill = await makeStoredDrill();
    const { result } = renderHook(() => useHarness(), { wrapper: makeWrapper(drill) });
    act(() => result.current.dispatch({ type: 'META_SET', patch: { title: '내 변경' } }));

    // 다른 탭이 먼저 써서 updatedAt 을 앞서가게 만든다.
    await idbDrillRepo.putDrill({ ...drill, title: '다른 탭 변경' });

    await act(async () => {
      await result.current.autosave.flush();
    });
    expect(result.current.autosave.status).toBe('conflict');
    expect(result.current.autosave.conflict).toBe(true);

    const putSpy = vi.spyOn(idbDrillRepo, 'putDrill');
    await act(async () => {
      await result.current.autosave.flush(); // 충돌 해소 전까지는 재시도 자체를 안 한다
    });
    expect(putSpy).not.toHaveBeenCalled();

    const stored = await idbDrillRepo.getDrill(drill.id);
    expect(stored?.title).toBe('다른 탭 변경'); // 내 변경은 덮어쓰지 않았다
  });

  it('enabled=false 면 flush() 가 아무것도 하지 않는다', async () => {
    const drill = await makeStoredDrill();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <SettingsProvider>
        <EditorProvider drill={drill}>{children}</EditorProvider>
      </SettingsProvider>
    );
    const { result } = renderHook(
      () => {
        const dispatch = useEditorDispatch();
        const autosave = useAutosave(false);
        return { dispatch, autosave };
      },
      { wrapper },
    );
    act(() => result.current.dispatch({ type: 'META_SET', patch: { title: '변경' } }));
    const putSpy = vi.spyOn(idbDrillRepo, 'putDrill');
    await act(async () => {
      await result.current.autosave.flush();
    });
    expect(putSpy).not.toHaveBeenCalled();
    expect(result.current.autosave.status).toBe('idle');
  });

  it(
    '커밋 후 800ms 뒤 디바운스로 자동 저장된다(수동 flush() 없이)',
    async () => {
      // fake-indexeddb 의 내부 완료 콜백이 실제 매크로태스크에 얹혀 있어 vi.useFakeTimers() 와
      // 맞물리면 결코 풀리지 않는 대기가 된다 — 그래서 여기만 실제 시간을 짧게 기다린다.
      const drill = await makeStoredDrill();
      const { result } = renderHook(() => useHarness(), { wrapper: makeWrapper(drill) });
      act(() => result.current.dispatch({ type: 'META_SET', patch: { title: '디바운스 저장' } }));
      expect(result.current.autosave.status).toBe('idle');

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 950));
      });
      expect(result.current.autosave.status).toBe('saved');
      const stored = await idbDrillRepo.getDrill(drill.id);
      expect(stored?.title).toBe('디바운스 저장');
    },
    2000,
  );
});
