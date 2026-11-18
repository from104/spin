// 심플 모드를 **끄는 순간** 실물 차체가 벽 밖에 걸친 휠체어를 판 안으로 넣는다 — 되돌리기 한 칸 · 토스트 한 번(2026-11-19 기현님 선택
// *"복귀 때 판 안으로"*, docs/PLAN-SIMPLE-DRIVE.md 결정 A7, physics/wallFit.ts).
// 지우면 새는 실기 버그: 심플의 벽은 원 하나라 앞을 벽에 댄 원은 실물로 13.5 px 판 밖이다. 끄고 [물리·상호작용] 이 켜져 있으면 Matter 벽이
// 다음 손짓에 그 차체를 67 px 밀어냈고 정착 커밋이 그 자리를 썼다(꺼져 있으면 판 밖인 채 남았다). 다른 스텝의 칩은 그 스텝으로 넘어가는
// 순간 같은 일을 겪는다. 넣을 것이 없을 때 되돌리기 칸·토스트가 생기면 스위치만 눌러도 기록이 쌓인다.
import { afterEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { CHAIR, PHYS } from '../../core/constants.ts';
import type { ChairId, StepId } from '../../core/ids.ts';
import { createDrill } from '../../model/defaults.ts';
import { courtDefFor } from '../../model/court.ts';
import { DISC_RADIUS_PX } from '../../model/chairDisc.ts';
import type { Drill } from '../../model/drill.ts';
import { makeDefaultPrefs, prunePhysics, savePrefs } from '../../storage/prefs.ts';
import { SettingsProvider, useSettingsActions } from '../settings/SettingsProvider.tsx';
import { ToastProvider, useToast } from '../toast/ToastProvider.tsx';
import { EditorProvider, useEditorDispatch, useEditorState, useEditorWorld } from './EditorProvider.tsx';

afterEach(() => localStorage.clear());

function mount(interact: boolean, parkedX: (vbW: number) => number) {
  savePrefs({ ...makeDefaultPrefs(), physics: prunePhysics({ interact }), board: { simple: true } });
  const base = createDrill({ courtMode: 'full', formation: '1-2-1' });
  const { vbW } = courtDefFor(base.courtMode, base.courtSize);
  const [a, b] = [base.cast.chairs[0]!.id as ChairId, base.cast.chairs[1]!.id as ChairId];
  const s0 = base.steps[0]!;
  const chairs = (y: number) => ({ [a]: { x: parkedX(vbW), y, angleDeg: 0 }, [b]: { x: 400, y: 300, angleDeg: 0 } });
  const drill: Drill = {
    ...base,
    // θ = 0 — 앞이 오른쪽 벽을 본다. 둘째 스텝에도 같은 칩이 같은 벽에 붙어 있다.
    steps: [
      { ...s0, chairs: chairs(150), balls: {}, cones: {}, notes: [], arrows: [], shapes: [] },
      { ...s0, id: 'st_two' as StepId, chairs: chairs(250), balls: {}, cones: {}, notes: [], arrows: [], shapes: [] },
    ],
  };
  const { result } = renderHook(
    () => ({ state: useEditorState(), dispatch: useEditorDispatch(), world: useEditorWorld(), settings: useSettingsActions(), toast: useToast() }),
    {
      wrapper: ({ children }: { children: ReactNode }) => (
        <SettingsProvider>
          <ToastProvider>
            <EditorProvider drill={drill}>{children}</EditorProvider>
          </ToastProvider>
        </SettingsProvider>
      ),
    },
  );
  const pose = (i: number) => result.current.state.present.steps[i]!.chairs[a]!;
  return { result, a, b, vbW, pose, simpleOff: () => act(() => void result.current.settings.setPrefs({ board: { simple: false } })) };
}

describe('심플 모드를 끄면 벽 밖에 걸친 휠체어를 판 안으로', () => {
  it('★ 모든 스텝의 그 칩이 차체 앞이 벽에 서는 자리로 — 되돌리기 한 번에 처음 자리, 토스트 한 번', () => {
    const m = mount(false, (w) => w - DISC_RADIUS_PX);
    const past0 = m.result.current.state.past.length;
    m.simpleOff();
    const want = m.vbW - CHAIR.pivotToFrontPx;
    expect(m.pose(0).x).toBeCloseTo(want);
    expect(m.pose(1).x).toBeCloseTo(want); // 다른 스텝도 — 넘어가는 순간 밀리지 않게
    expect(m.result.current.world.current!.read()[m.a]!.x).toBeCloseTo(want); // 지금 스텝의 바디도 같은 자리
    expect(m.result.current.state.past.length).toBe(past0 + 1);
    expect(m.result.current.toast.toasts).toHaveLength(1);
    act(() => m.result.current.dispatch({ type: 'UNDO' }));
    expect(m.pose(0).x).toBeCloseTo(m.vbW - DISC_RADIUS_PX);
    expect(m.pose(1).x).toBeCloseTo(m.vbW - DISC_RADIUS_PX);
  });

  it('★ 상호작용 켬이어도 벽이 밀어내지 않는다 — 월드가 깨어나 다른 칩을 끌어도 그 자리(옛 67 px 밀기)', () => {
    const m = mount(true, (w) => w - DISC_RADIUS_PX);
    m.simpleOff();
    const w = m.result.current.world.current!;
    const h = w.beginDrag({ kind: 'chair', id: m.b, s: 0.25 }, { x: 400, y: 300 })!;
    let now = 0;
    for (let i = 0; i < 600; i++) {
      now += PHYS.dtMs;
      h.move({ x: 500, y: 300 }, now);
      w.step(PHYS.dtS);
    }
    h.end();
    for (let i = 0; i < 240; i++) w.step(PHYS.dtS);
    expect(w.read()[m.b]!.x).toBeGreaterThan(450); // 전제: 다른 칩은 실제로 끌렸다
    expect(w.read()[m.a]!.x).toBeCloseTo(m.vbW - CHAIR.pivotToFrontPx, 1);
  });

  it('넣을 것이 없으면 아무것도 안 쓴다 — 되돌리기 칸도 토스트도 없다', () => {
    const m = mount(false, () => 300);
    const past0 = m.result.current.state.past.length;
    m.simpleOff();
    expect(m.result.current.state.past.length).toBe(past0);
    expect(m.result.current.toast.toasts).toHaveLength(0);
  });
});
