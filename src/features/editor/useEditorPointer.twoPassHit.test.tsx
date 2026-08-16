// §4.3 P1-2 [A-2] — 2단 히트가 **도구를 가려서** 도는지 실제 포인터 경로에서 잰다.
//
// `hitTest` 단위 테스트(physics/twoPassHit.test.ts)는 "erase 면 2차 패스가 null" 을 재지만,
// 그것만으로는 배선이 증명되지 않는다: `eraseAt`·`placeAt` 이 어떤 ctx 로 hitTest 를 부르는지는
// 이 파일(useEditorPointer)이 정한다. 여기서 한 자리라도 `'select'` 를 넘기면 지우개가 반경
// 22 CSS px 짜리 파괴 도구가 되고, 콘을 나란히 놓을 수 없게 된다.
//
// 포인터 사건을 DOM 에 쏘지 않고 `controller` 를 직접 부르는 이유는 settle 테스트 머리말과 같다
// (jsdom 은 getBoundingClientRect 가 전부 0 이라 client→world 변환이 NaN 이 된다). 무대 핸들이
// 없으므로 pxPerUnit 은 기본값 1 로 남는다 — 월드 1px = 화면 1px 이라 **2차 반경이 곧 22 px** 이고
// 산수가 그대로 읽힌다.
import { afterEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useRef } from 'react';
import type { ReactNode } from 'react';
import { BALL, DEFAULT_ZONES } from '../../core/constants.ts';
import { newId } from '../../core/ids.ts';
import type { BallId, ConeId } from '../../core/ids.ts';
import { createDrill } from '../../model/defaults.ts';
import type { Drill } from '../../model/drill.ts';
import type { ToolId } from '../../physics/index.ts';
import type { CourtStageHandle, PointerDownResult, PointerMeta } from '../../render/CourtStage.tsx';
import { SettingsProvider } from '../../store/settings/SettingsProvider.tsx';
import { EditorProvider, useEditorDispatch, useEditorState, useEditorWorld, useEditorWriter } from '../../store/editor/EditorProvider.tsx';
import { useEditorPointer } from './useEditorPointer.ts';

const META: PointerMeta = { pointerType: 'mouse', button: 0, shiftKey: false, metaKey: false, ctrlKey: false, altKey: false };

const BALL_AT = { x: 200, y: 150 };
const CONE_AT = { x: 500, y: 400 };
/** 공/콘의 **1차** 픽 반경 밖, 2차 반경 안. s=1 에서 공 10.125 · 콘 9.125 < 18 < 22. */
const NEAR_MISS = 18;
/** 1차 반경 안 — "2차를 끄면 아무것도 못 잡는다" 가 아니라는 대조군. */
/** 기본 2차 반경(22) 밖, "큰 터치 타깃" 반경(28) 안. [D-4] 배선만 재는 거리다. */
const LARGE_ONLY = 25;

/** 휠체어가 한 대도 없는 판. 공 1개 + 주황 콘 1개만 두어 히트 후보를 좁힌다. */
function makeDrill(): { drill: Drill; ball: BallId; cone: ConeId } {
  const base = createDrill({ courtMode: 'full', formation: '1-2-1' });
  const ball = base.cast.balls[0]!.id;
  const cone = newId('cn');
  const step0 = base.steps[0]!;
  return {
    ball,
    cone,
    drill: {
      ...base,
      cast: { ...base.cast, cones: [{ id: cone, colorIndex: 0 }] },
      steps: [{ ...step0, chairs: {}, balls: { [ball]: BALL_AT }, cones: { [cone]: CONE_AT }, arrows: [], notes: [] }],
    },
  };
}

function useHarness(tool: ToolId, largeTargets: boolean) {
  const state = useEditorState();
  const dispatch = useEditorDispatch();
  const worldRef = useEditorWorld();
  const writer = useEditorWriter();
  const stageRef = useRef<CourtStageHandle | null>(null);
  const drill = state.present;
  const pointer = useEditorPointer({
    drill,
    stepIndex: 0,
    step: drill.steps[0]!,
    tool,
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
    largeTargets,
  });
  return { state, pointer };
}

function mount(drill: Drill, tool: ToolId, largeTargets = false) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <SettingsProvider>
      <EditorProvider drill={drill}>{children}</EditorProvider>
    </SettingsProvider>
  );
  return renderHook(() => useHarness(tool, largeTargets), { wrapper });
}

afterEach(() => localStorage.clear());

describe('select 도구 — 2차 패스가 실제로 배선돼 있다', () => {
  it('공에서 18px 떨어진 빈 곳을 탭하면 그 공이 선택된다', () => {
    const { drill, ball } = makeDrill();
    const { result } = mount(drill, 'select');
    let out: PointerDownResult | void = undefined;
    act(() => {
      out = result.current.pointer.controller.onPointerDown({ x: BALL_AT.x + NEAR_MISS, y: BALL_AT.y }, META);
    });
    act(() => result.current.pointer.controller.onPointerUp(null));
    expect(Array.from(result.current.state.selection)).toEqual([ball]);
    expect(out).toBeUndefined(); // 고무줄 경로(edgePan)로 새지 않았다
  });
});

// 2026-08-16 — 지우개 도구가 사라지면서 '문질러 지우기' 경로가 통째로 없어졌다(기현 지시).
// 여기 있던 두 테스트([A-2] 2차 패스가 지우개에서는 안 돈다)는 잴 대상이 없어졌다. 관대한
// 반경이 파괴로 새지 않는다는 계약 자체는 여전히 유효하고, 이제 `tool: 'select'` 가 아닌
// 모든 도구가 같은 규칙을 받는다 — physics/twoPassHit.test.ts 가 그것을 잰다.

describe('큰 터치 타깃 배선 [D-4]', () => {
  // 설정의 "큰 터치 타깃" 이 버튼(`--hit`)에서만 참이고 코트 위에서는 거짓이던 것을 닫는
  // 배선이다. hitTest 단위 테스트가 반경 56 을 재도, 이 hook 이 그 값을 안 넘기면 소용없다.
  const tapForBall = { x: BALL_AT.x + LARGE_ONLY, y: BALL_AT.y };

  it('꺼져 있으면 25px 떨어진 공은 잡히지 않는다(2차 반경 22)', () => {
    const { drill } = makeDrill();
    const { result } = mount(drill, 'select', false);
    act(() => void result.current.pointer.controller.onPointerDown(tapForBall, META));
    act(() => result.current.pointer.controller.onPointerUp(null));
    expect(Array.from(result.current.state.selection)).toEqual([]);
  });

  it('켜면 같은 25px 이 잡힌다(2차 반경 28)', () => {
    const { drill, ball } = makeDrill();
    const { result } = mount(drill, 'select', true);
    act(() => void result.current.pointer.controller.onPointerDown(tapForBall, META));
    act(() => result.current.pointer.controller.onPointerUp(null));
    expect(Array.from(result.current.state.selection)).toEqual([ball]);
  });
});
