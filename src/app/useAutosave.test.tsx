// §4.6/§6.8/§4.3 — useAutosave: 커밋 후 디바운스 저장 + CAS(expectedUpdatedAt) + 충돌 처리.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { ChairId, StepId } from '../core/ids.ts';
import type { StoredChairPose } from '../model/chair.ts';
import type { PoseMap } from '../model/drill.ts';
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

// §4.2 A-5 — 정착 억제 창. 드래그는 커밋을 **두 번** 만든다: 손을 뗀 시점(PLACE_COMMIT)과
// 물리가 다 선 시점(PLACE_SETTLE, §4.2 P0-2). 정착이 디바운스 800ms 를 넘으면 그 사이에
// 타이머가 터져 IDB CAS 쓰기가 두 번 나가고, 그 두 번째는 첫 번째가 아직 날아가는 중이면
// (savingRef) 조용히 **버려진다** — 정작 저장돼야 할 정착 좌표가 유실된다.
describe('useAutosave — 드래그 1회당 IDB 쓰기 횟수', () => {
  /** 드래그 두 단계를 그대로 흉내내는 액션 묶음. 좌표만 다르고 형태는 같다. */
  function poseSetter(step: { id: StepId; chairs: Record<string, StoredChairPose | undefined> }) {
    const chairId = Object.keys(step.chairs)[0] as ChairId;
    return {
      chairId,
      at: (x: number) => ({ ...step.chairs, [chairId]: { ...step.chairs[chairId]!, x } }) as PoseMap<ChairId, StoredChairPose>,
    };
  }

  it(
    '억제 창이 열려 있으면 정착이 끝난 뒤 **한 번만** 쓴다',
    async () => {
      const drill = await makeStoredDrill();
      const { result } = renderHook(() => useHarness(), { wrapper: makeWrapper(drill) });
      const step = result.current.state.present.steps[0]!;
      const { chairId, at } = poseSetter(step);
      const putSpy = vi.spyOn(idbDrillRepo, 'putDrill');
      const empty = { balls: step.balls, cones: step.cones };

      // 손을 뗀 순간: 억제 창을 열고 "가다 만 자리" 를 커밋한다.
      act(() => {
        result.current.dispatch({ type: 'SETTLE_ARM', until: Date.now() + 4000 });
        result.current.dispatch({ type: 'PLACE_BEGIN' });
        result.current.dispatch({ type: 'PLACE_COMMIT', stepId: step.id, chairs: at(300), ...empty });
      });
      expect(result.current.state.settleHoldUntil).toBeGreaterThan(Date.now());

      // 디바운스(800ms)가 지나도 아직 안 쓴다 — 정착이 끝나지 않았다.
      await act(async () => {
        await new Promise((r) => setTimeout(r, 950));
      });
      expect(putSpy).not.toHaveBeenCalled();

      // 정착 재커밋이 창을 닫는다 → 그 뒤 800ms 에 딱 한 번.
      act(() => result.current.dispatch({ type: 'PLACE_SETTLE', stepId: step.id, chairs: at(400), ...empty }));
      expect(result.current.state.settleHoldUntil).toBe(0);
      await act(async () => {
        await new Promise((r) => setTimeout(r, 950));
      });
      expect(putSpy).toHaveBeenCalledTimes(1);

      // 저장된 것은 정착 좌표다. 첫 커밋(300)이 저장되면 재커밋이 유실된 것이다.
      const stored = await idbDrillRepo.getDrill(drill.id);
      expect(stored?.steps[0]?.chairs[chairId]?.x).toBe(400);
    },
    6000,
  );

  it(
    '대조군 — 억제 창이 없으면 같은 순서가 쓰기 2회가 된다',
    async () => {
      // 이 대조군이 없으면 위 테스트는 "원래 한 번이었다" 로도 통과한다.
      const drill = await makeStoredDrill();
      const { result } = renderHook(() => useHarness(), { wrapper: makeWrapper(drill) });
      const step = result.current.state.present.steps[0]!;
      const { at } = poseSetter(step);
      const putSpy = vi.spyOn(idbDrillRepo, 'putDrill');
      const empty = { balls: step.balls, cones: step.cones };

      act(() => {
        result.current.dispatch({ type: 'PLACE_BEGIN' });
        result.current.dispatch({ type: 'PLACE_COMMIT', stepId: step.id, chairs: at(300), ...empty });
      });
      await act(async () => {
        await new Promise((r) => setTimeout(r, 950));
      });
      expect(putSpy).toHaveBeenCalledTimes(1);

      act(() => result.current.dispatch({ type: 'PLACE_SETTLE', stepId: step.id, chairs: at(400), ...empty }));
      await act(async () => {
        await new Promise((r) => setTimeout(r, 950));
      });
      expect(putSpy).toHaveBeenCalledTimes(2);
    },
    6000,
  );
});
