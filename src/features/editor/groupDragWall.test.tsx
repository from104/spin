// 덩어리 끌기(여럿 고른 채 하나를 끄는 손짓)도 **지금 모드의 벽**을 지킨다 — 하나 끌기와 같은 규칙(2026-11-19 「기본, 심플 모드
// 완전 분리」, PLAN-SIMPLE-DRIVE 결정 A7).
// 지우면 새는 실기 버그: 두 모드는 벽이 다르다(심플 = 원, 평소 = 실물 차체). 한 모드에서 벽에 붙인 칩은 다른 모드의 규칙으로는 판
// 밖인데, 덩어리 끌기의 벽(world.groupDelta)은 이미 판 밖인 개체를 "더 나가지 않게"만 막는다. 그래서 그 칩을 벽을 따라 무리로 끌면
// 판 밖인 채 드릴에 저장됐다 — 평소 모드에서 차체 13.5 px, 심플에서 원 6 px(2026-11-19 검수 실측). 하나 끌기는 799 로 들어왔다.
// 포인터 사건을 DOM 에 쏘지 않고 `controller` 를 직접 부르는 이유는 trayDropDrag.test.tsx 와 같다.
import { afterEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useRef } from 'react';
import type { ReactNode } from 'react';
import { BALL, CHAIR, DEFAULT_ZONES } from '../../core/constants.ts';
import type { ChairId } from '../../core/ids.ts';
import { createDrill } from '../../model/defaults.ts';
import { courtDefFor } from '../../model/court.ts';
import { DISC_RADIUS_PX } from '../../model/chairDisc.ts';
import type { Drill } from '../../model/drill.ts';
import type { CourtStageHandle, PointerMeta } from '../../render/CourtStage.tsx';
import { makeDefaultPrefs, savePrefs } from '../../storage/prefs.ts';
import { SettingsProvider } from '../../store/settings/SettingsProvider.tsx';
import { EditorProvider, useEditorDispatch, useEditorState, useEditorWorld, useEditorWriter } from '../../store/editor/EditorProvider.tsx';
import { useEditorPointer } from './useEditorPointer.ts';

const META: PointerMeta = { pointerType: 'mouse', button: 0, shiftKey: false, metaKey: false, ctrlKey: false, altKey: false };
const CLIENT = { x: 10, y: 10 };

afterEach(() => localStorage.clear());

function setup(simple: boolean, parkedX: (w: number) => number) {
  savePrefs({ ...makeDefaultPrefs(), board: { simple } });
  const base = createDrill({ courtMode: 'full', formation: '1-2-1' });
  const { vbW } = courtDefFor(base.courtMode, base.courtSize);
  const [a, b] = [base.cast.chairs[0]!.id, base.cast.chairs[1]!.id];
  const at = { x: parkedX(vbW), y: 150 };
  const drill: Drill = {
    ...base,
    steps: [{ ...base.steps[0]!, chairs: { [a]: { ...at, angleDeg: 0 }, [b]: { x: 400, y: 300, angleDeg: 0 } }, balls: {}, cones: {}, notes: [], arrows: [], shapes: [] }],
  };
  const { result } = renderHook(
    () => {
      const state = useEditorState();
      const dispatch = useEditorDispatch();
      const worldRef = useEditorWorld();
      const writer = useEditorWriter();
      const stageRef = useRef<CourtStageHandle | null>(null);
      const step = state.present.steps[0]!;
      const pointer = useEditorPointer({
        drill: state.present, stepIndex: 0, step, tool: 'select', locked: new Set(), coneSlot: 0, selection: state.selection,
        dispatch, worldRef, writer, stageRef, zones: DEFAULT_ZONES, ballMax: BALL.maxCount, pendingPlayerId: null,
        onPlayerPlaced: () => {}, onEraseIds: () => {}, showToast: () => {}, largeTargets: false, chairDisc: simple,
      });
      return { state, dispatch, pointer };
    },
    { wrapper: ({ children }: { children: ReactNode }) => <SettingsProvider><EditorProvider drill={drill}>{children}</EditorProvider></SettingsProvider> },
  );
  act(() => result.current.dispatch({ type: 'SELECT_SET', ids: [a, b] }));
  // 무리를 벽을 따라(+y) 200 끈다
  act(() => result.current.pointer.controller.onPointerDown(at, META));
  for (let i = 1; i <= 10; i++) act(() => result.current.pointer.controller.onPointerMove({ x: at.x, y: at.y + 20 * i }, 16 * i, CLIENT));
  act(() => result.current.pointer.controller.onPointerUp(CLIENT));
  const pose = () => result.current.state.present.steps[0]!.chairs[a as ChairId]!;
  return { vbW, at, pose, undo: () => act(() => result.current.dispatch({ type: 'UNDO' })) };
}

describe('덩어리 끌기 — 다른 모드의 벽에 붙어 있던 칩도 지금 모드의 벽으로 놓인다', () => {
  it('★ 평소: 심플에서 앞을 오른쪽 벽에 댄 칩(차체 13.5 px 밖)을 무리로 벽 따라 끌면 차체 앞이 벽에 선다 — 되돌리기 한 번에 처음 자리', () => {
    const s = setup(false, (w) => w - DISC_RADIUS_PX);
    expect(s.pose().y).toBeCloseTo(s.at.y + 200); // 전제: 무리가 실제로 끌렸다
    expect(s.pose().x).toBeCloseTo(s.vbW - CHAIR.pivotToFrontPx, 1);
    s.undo();
    expect(s.pose()).toMatchObject({ x: s.at.x, y: s.at.y }); // 벽 넣기는 끈 이동과 같은 칸
  });
  it('★ 심플: 평소에서 뒤를 왼쪽 벽에 댄 칩(원 6 px 밖)을 무리로 벽 따라 끌면 원이 벽에 선다', () => {
    const s = setup(true, () => CHAIR.pivotToRearPx);
    expect(s.pose().y).toBeCloseTo(s.at.y + 200);
    expect(s.pose().x).toBeCloseTo(DISC_RADIUS_PX, 1);
  });
});
