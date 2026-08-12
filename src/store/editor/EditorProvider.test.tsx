// §10.7 store — EditorProvider: state/dispatch 노출, 물리 월드 ref 수명주기.
import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createDrill } from '../../model/defaults.ts';
import { newId } from '../../core/ids.ts';
import { SettingsProvider, useSettingsActions } from '../settings/SettingsProvider.tsx';
import { EditorProvider, useEditorDispatch, useEditorState, useEditorWorld } from './EditorProvider.tsx';
import { makeDefaultPrefs, PREFS_KEY } from '../../storage/prefs.ts';
import type { PhysicsWorldApi } from '../../physics/index.ts';

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

// ── 설정의 물리 존 슬라이더 → 살아 있는 물리 월드 (2026-08-13, 5차 검증관) ────────────────────
//
// ⚠️ 이 describe 가 없던 동안, EditorProvider 의 `setZones` 배선을 **통째로 지워도 전체
// 스위트가 전건 초록이었다**(실측: 458 passed / 0 failed). physics 쪽 단위 테스트는 월드에
// 직접 setZones 를 부르므로 "설정이 월드까지 오는가" 를 아무도 묻지 않았기 때문이다.
// 여기가 그 통로를 붙잡는다 — 생성 시점(4번째 인자)과 살아 있는 월드(effect) 양쪽.
describe('설정의 물리 존이 물리 월드까지 간다 (5차 검증관)', () => {
  const SPIN_EARLY = { sTowRearMax: 0.05, sSpinMin: 0.22, sTowFrontMin: 0.85, grabPadPx: 10 };
  /** 기본 표에서는 translate, SPIN_EARLY 에서는 spin 인 지점. 두 표가 실제로 갈리는 자리라야
   *  아래 단언이 "무엇을 넣어도 통과" 가 되지 않는다. */
  const S_DIVERGENT = 0.3;

  /** 첫 스텝에 **실제로 놓인** 휠체어를 고른다 — 하프 코트는 8대 중 6대만 놓이므로
   *  `cast.chairs[0]`(홈 GK)을 그냥 쓰면 좌표가 undefined 다. */
  function chairHitAt(drill: ReturnType<typeof createDrill>, s: number) {
    const step = drill.steps[0]!;
    const id = drill.cast.chairs.find((c) => step.chairs[c.id] !== undefined)!.id;
    const p = step.chairs[id]!;
    return { hit: { kind: 'chair', id, s } as never, at: { x: p.x, y: p.y } };
  }

  function zoneOf(world: PhysicsWorldApi, drill: ReturnType<typeof createDrill>, s: number) {
    const { hit, at } = chairHitAt(drill, s);
    const h = world.beginDrag(hit, at);
    const z = h?.zone ?? null;
    h?.end();
    return z;
  }

  it('대조군 — 기본 설정에서는 그 지점이 translate 다 (두 표가 정말 다른 답을 낸다)', () => {
    const { wrapper, drill } = makeWrapper();
    const { result } = renderHook(() => useEditorWorld(), { wrapper });
    expect(zoneOf(result.current.current!, drill, S_DIVERGENT)).toBe('translate');
  });

  it('저장된 존 설정으로 시작한 월드는 **처음부터** 그 경계로 가른다 (생성 인자)', () => {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ ...makeDefaultPrefs(), physics: { zones: SPIN_EARLY } }));
    const { wrapper, drill } = makeWrapper();
    const { result } = renderHook(() => useEditorWorld(), { wrapper });
    expect(zoneOf(result.current.current!, drill, S_DIVERGENT)).toBe('spin');
    localStorage.clear();
  });

  it('실행 중 슬라이더를 옮기면 **살아 있는 월드**가 즉시 따라온다 (setZones effect)', () => {
    const { wrapper, drill } = makeWrapper();
    const { result } = renderHook(
      () => ({ world: useEditorWorld(), settings: useSettingsActions() }),
      { wrapper },
    );
    // 먼저 기본값임을 확인한다 — 시작부터 spin 이면 아래 단언이 아무것도 증명하지 못한다.
    expect(zoneOf(result.current.world.current!, drill, S_DIVERGENT)).toBe('translate');
    act(() => {
      result.current.settings.setPrefs({ physics: { zones: SPIN_EARLY } });
    });
    expect(zoneOf(result.current.world.current!, drill, S_DIVERGENT)).toBe('spin');
    // 되돌리면 원래대로 — 한 번 바뀌면 굳는 구현을 막는다.
    act(() => {
      result.current.settings.setPrefs({ physics: {} });
    });
    expect(zoneOf(result.current.world.current!, drill, S_DIVERGENT)).toBe('translate');
    localStorage.clear();
  });

  it('⚠️ 코트를 바꿔 **월드가 새로 만들어져도** 설정한 경계를 유지한다 (생성 인자가 하는 일)', () => {
    // 이 축이 왜 따로 필요한가: 월드 재생성 effect 의 deps 는 [courtMode] 이고 setZones effect 의
    // deps 는 [physics] 다. 코트를 바꾸면 앞은 돌고 **뒤는 안 돈다** — 생성 시점에 존을 안 넘기면
    // 새 월드가 기본 경계로 태어나고, 사용자는 "코트를 바꿨더니 슬라이더가 초기화됐다" 로 겪는다.
    // 마운트 직후만 재면 setZones effect 가 뒤늦게 고쳐 주므로 이 결함이 보이지 않는다.
    const { wrapper, drill } = makeWrapper();
    const { result } = renderHook(
      () => ({ world: useEditorWorld(), settings: useSettingsActions(), dispatch: useEditorDispatch() }),
      { wrapper },
    );
    act(() => {
      result.current.settings.setPrefs({ physics: { zones: SPIN_EARLY } });
    });
    const before = result.current.world.current!;
    expect(zoneOf(before, drill, S_DIVERGENT)).toBe('spin');

    const half = createDrill({ courtMode: 'half', formation: '1-2-1' });
    act(() => result.current.dispatch({ type: 'DRILL_LOAD', drill: half }));

    const after = result.current.world.current!;
    expect(after, '코트 전환으로 월드가 실제로 재생성됐다').not.toBe(before); // 대조군
    expect(zoneOf(after, half, S_DIVERGENT)).toBe('spin');
    localStorage.clear();
  });
});
