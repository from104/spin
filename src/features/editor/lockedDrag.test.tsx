// 잠긴 개체는 **못 끈다** (기현 지시 2026-08-14: *"잠김은 이동은 안 되지만 고정되어
// 상호작용은 하는"*).
//
// ⚠️ **이 파일이 왜 따로 있는가** — 화면 끝 테스트(objectMenu.test)로 재려다 실패했다.
// jsdom 은 `getBoundingClientRect` 가 전부 0 이라 개체가 애초에 안 움직이고, 그래서
// 차단 코드를 통째로 지우고 돌려도 **그대로 초록**이었다(2026-08-14 반증). 아무것도 안
// 지키는 단언이 초록이면 있느니만 못하다.
// 그래서 여기서는 `controller` 를 **직접** 부른다 — framePan.test 가 같은 이유로 간 길이다.
// 재는 것은 **판정**이고, 그 판정이 실제 이동으로 이어지는 배선은 물리·CourtStage 쪽이 문다.
import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useRef } from 'react';
import type { ReactNode } from 'react';
import { BALL, DEFAULT_ZONES } from '../../core/constants.ts';
import type { ChairId } from '../../core/ids.ts';
import { createDrill } from '../../model/defaults.ts';
import type { Drill } from '../../model/drill.ts';
import type { CourtStageHandle, PointerMeta } from '../../render/CourtStage.tsx';
import { SettingsProvider } from '../../store/settings/SettingsProvider.tsx';
import { EditorProvider, useEditorDispatch, useEditorState, useEditorWorld, useEditorWriter } from '../../store/editor/EditorProvider.tsx';
import { useEditorPointer } from './useEditorPointer.ts';

const META: PointerMeta = { pointerType: 'mouse', button: 0, shiftKey: false, metaKey: false, ctrlKey: false, altKey: false };
const AT = { x: 412.5, y: 262.5 };

function makeDrill(locked: boolean): { drill: Drill; chair: ChairId } {
  const base = createDrill({ courtMode: 'full', formation: '1-2-1' });
  const chair = base.cast.chairs[0]!.id;
  const step0 = base.steps[0]!;
  return {
    chair,
    drill: {
      ...base,
      steps: [
        {
          ...step0,
          chairs: { [chair]: { x: AT.x, y: AT.y, angleDeg: 90 } },
          balls: {},
          cones: {},
          arrows: [],
          notes: [],
          shapes: [],
          ...(locked ? { locked: [chair as string] } : {}),
        },
      ],
    },
  };
}

function mount(drill: Drill) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <SettingsProvider>
      <EditorProvider drill={drill}>{children}</EditorProvider>
    </SettingsProvider>
  );
  return renderHook(
    () => {
      const state = useEditorState();
      const dispatch = useEditorDispatch();
      const worldRef = useEditorWorld();
      const writer = useEditorWriter();
      const stageRef = useRef<CourtStageHandle | null>(null);
      const d = state.present;
      const step = d.steps[0]!;
      const pointer = useEditorPointer({
        drill: d,
        stepIndex: 0,
        step,
        // 화면(EditorStage)이 만드는 것과 **같은 집합**을 만든다 — 여기서 다른 것을 넘기면
        // 이 테스트는 화면이 아니라 자기 자신을 재게 된다.
        locked: new Set(step.locked ?? []),
        tool: 'select',
        coneSlot: 0,
        selection: state.selection,
        dispatch,
        worldRef,
        writer,
        stageRef,
        zones: DEFAULT_ZONES,
        ballMax: BALL.maxCount,
        pendingPlayerId: null,
        onPlayerPlaced: () => {},
        showToast: () => {},
        forceHandlesVisible: false,
        largeTargets: false,
      });
      return { state, pointer, worldRef };
    },
    { wrapper },
  );
}

/** 개체를 잡아 보고 **드래그 세션이 열렸는가**를 돌려준다.
 *
 *  ⚠️ 자리(좌표)로는 못 잰다. 두 번 헛짚었고 둘 다 기록해 둔다:
 *   ① 리듀서의 자세(`step.chairs`)는 손을 떼고 **정착한 뒤에야** 커밋된다(§4.3 PLACE_SETTLE).
 *   ② 물리 바디도 `onPointerMove` 만으로는 안 움직인다 — 물리 호출은 **rAF 틱 하나에서만**
 *      일어난다(§6.4 규칙). 여기서는 그 루프가 안 돈다.
 *  끌기의 시작은 `world.beginDrag` 다. 그것이 불렸는가가 곧 "끌 수 있는가" 이므로 그걸 센다. */
function grabAndDrag(drill: Drill) {
  const { result } = mount(drill);
  const world = result.current.worldRef.current!;
  const real = world.beginDrag.bind(world);
  let began = 0;
  world.beginDrag = (hit, grab) => {
    began += 1;
    return real(hit, grab);
  };
  act(() => {
    result.current.pointer.controller.onPointerDown(AT, META);
  });
  act(() => {
    result.current.pointer.controller.onPointerUp(null);
  });
  world.beginDrag = real;
  return { began, selection: result.current.state.selection };
}

describe('잠김 — 끌기만 막는다', () => {
  it('★ 잠근 휠체어는 끌어도 자세가 그대로다', () => {
    const { drill } = makeDrill(true);
    const after = grabAndDrag(drill);
    expect(after.began, '잠갔는데 드래그 세션이 열렸다').toBe(0);
  });

  it('대조군: 안 잠근 같은 휠체어는 같은 조작에서 실제로 움직인다', () => {
    // 이 대조군이 없으면 위 단언은 "이 하네스에서는 원래 아무것도 안 움직인다" 로도 통과한다.
    const { drill } = makeDrill(false);
    const after = grabAndDrag(drill);
    expect(after.began, '대조군이 세션을 안 열면 위 단언이 공짜다').toBeGreaterThan(0);
  });

  it('★ 잠겨도 **선택은 된다** — 못 고르면 잠금을 풀 길이 없다', () => {
    const { drill, chair } = makeDrill(true);
    const after = grabAndDrag(drill);
    expect(after.selection.has(chair), '잠긴 것을 고를 수가 없다 — 메뉴를 열 방법이 사라진다').toBe(true);
  });
});
