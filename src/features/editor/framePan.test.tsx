// §4.4 P2-1 — **어디서 시작했는가**가 손짓의 뜻을 정한다.
//
//   경기면(surface) 밖 마진에서 시작 = 판 이동   /   경기면 안에서 시작 = 고무줄 선택
//
// 심사관 1 이 [치명]으로 짚은 `edgePanBandPx = 56` 충돌의 해소가 이 한 줄이다: 마진 띠
// (1.5 m = 37.5 월드px) 전체가 edgePan 띠 안에 들어가므로 "왼쪽 56px 만 조심하면 된다"
// 가 아니었다. 두 기능이 **같은 화면 자리**를 두고 다투지 않게, 시작 지점으로 갈랐다.
// edgePan 은 고무줄이 **이미 시작된 뒤에만** 도는 기능이라 그대로 유효하다 — 아래에
// 별도 단언을 둔다.
//
// 포인터 사건을 DOM 에 쏘지 않고 `controller` 를 직접 부르는 이유는 twoPassHit 테스트
// 머리말과 같다(jsdom 은 getBoundingClientRect 가 전부 0 이라 client→world 가 NaN 이 된다).
// 여기서 재는 것은 **판정**이고, 그 판정을 실제로 판 이동으로 옮기는 배선은 CourtStage 쪽
// 테스트(CourtStage.framePan.test.tsx)가 따로 문다.
import { afterEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useRef } from 'react';
import type { ReactNode } from 'react';
import { BALL, DEFAULT_ZONES } from '../../core/constants.ts';
import type { ChairId } from '../../core/ids.ts';
import { createDrill } from '../../model/defaults.ts';
import { COURT_DEFS, type CourtMode } from '../../model/court.ts';
import type { Drill } from '../../model/drill.ts';
import type { ToolId } from '../../physics/index.ts';
import type { CourtStageHandle, PointerDownResult, PointerMeta } from '../../render/CourtStage.tsx';
import { SettingsProvider } from '../../store/settings/SettingsProvider.tsx';
import { EditorProvider, useEditorDispatch, useEditorState, useEditorWorld, useEditorWriter } from '../../store/editor/EditorProvider.tsx';
import { useEditorPointer } from './useEditorPointer.ts';

const META: PointerMeta = { pointerType: 'mouse', button: 0, shiftKey: false, metaKey: false, ctrlKey: false, altKey: false };

const FULL = COURT_DEFS.full.surface;
/** 경기면 한가운데 — 고무줄이 시작돼야 하는 자리. */
const INSIDE = { x: 412.5, y: 262.5 };
/** 왼쪽 마진 한가운데(x=18.75). 마진은 37.5px 이므로 edgePan 띠(56 CSS px) 안에 통째로 들어간다. */
const MARGIN_LEFT = { x: FULL.x / 2, y: 262.5 };
/** 아래 마진 — 좌측만 고친 구현이 통과하지 못하게 반대쪽도 본다. */
const MARGIN_BOTTOM = { x: 412.5, y: FULL.y + FULL.h + 18 };

/** 판 하나를 짓는다. `where` 가 비면 코트에 개체가 하나도 없다 — 좌표 판정만 재는 테스트는
 *  전부 그 판을 쓴다(개체가 있으면 히트테스트가 먼저 걸려 무엇을 쟀는지 흐려진다).
 *  `where` 에 자리를 주면 그 자리에 휠체어를 세운다 — 마진에 세우는 것이 곧 킥인·코너
 *  세트피스(D26)의 배치다. */
function makeDrill(where: { margin?: { x: number; y: number }; inside?: boolean } = {}, courtMode: CourtMode = 'full'): { drill: Drill; marginChair: ChairId; insideChair: ChairId } {
  const base = createDrill({ courtMode, formation: '1-2-1' });
  const marginChair = base.cast.chairs[0]!.id;
  const insideChair = base.cast.chairs[1]!.id;
  const step0 = base.steps[0]!;
  const chairs: Record<string, { x: number; y: number; angleDeg: number }> = {};
  if (where.margin) chairs[marginChair] = { x: where.margin.x, y: where.margin.y, angleDeg: 90 };
  if (where.inside) chairs[insideChair] = { x: INSIDE.x, y: INSIDE.y, angleDeg: 90 };
  return {
    marginChair,
    insideChair,
    drill: {
      ...base,
      steps: [{ ...step0, chairs, balls: {}, cones: {}, arrows: [], notes: [] }],
    },
  };
}

function useHarness(tool: ToolId) {
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
    largeTargets: false,
  });
  return { state, pointer };
}

function mount(drill: Drill, tool: ToolId = 'select') {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <SettingsProvider>
      <EditorProvider drill={drill}>{children}</EditorProvider>
    </SettingsProvider>
  );
  return renderHook(() => useHarness(tool), { wrapper });
}

/** pointerdown 을 한 번 쏘고 판정을 돌려받는다. */
function down(result: { current: { pointer: { controller: { onPointerDown(w: { x: number; y: number }, m: PointerMeta): PointerDownResult | void } } } }, world: { x: number; y: number }, meta: PointerMeta = META): PointerDownResult | void {
  let out: PointerDownResult | void = undefined;
  act(() => {
    out = result.current.pointer.controller.onPointerDown(world, meta);
  });
  return out;
}

afterEach(() => localStorage.clear());

describe('시작 지점이 손짓의 뜻을 정한다', () => {
  it('경기면 안 빈 곳에서 시작하면 고무줄이다 — 판을 밀지 않는다', () => {
    const { drill } = makeDrill();
    const { result } = mount(drill);
    const out = down(result, { x: 600, y: 420 });
    expect(out?.pan).toBeFalsy();
    expect(out?.edgePan).toBe(true);
  });

  it('경기면 밖 마진에서 시작하면 판 이동이다 — 고무줄도 edgePan 도 열지 않는다', () => {
    const { drill } = makeDrill();
    const { result } = mount(drill);
    const out = down(result, MARGIN_LEFT);
    expect(out?.pan).toBe(true);
    // edgePan 은 **고무줄 세션 중에만** 도는 기능이다. 판을 직접 미는 손짓에 켜지면
    // 마진을 잡은 채로 가장자리에 머무르는 동안 판이 두 번 밀린다.
    expect(out?.edgePan).toBeFalsy();
  });

  it('네 변의 마진이 모두 판 이동이다 — 좌측만의 문제가 아니었다', () => {
    const { drill } = makeDrill();
    const { result } = mount(drill);
    for (const p of [MARGIN_LEFT, MARGIN_BOTTOM, { x: FULL.x + FULL.w + 18, y: 262.5 }, { x: 412.5, y: FULL.y / 2 }]) {
      expect(down(result, p)?.pan, JSON.stringify(p)).toBe(true);
    }
  });

  it('라인 위(경계선)는 경기면이다 — 고무줄이 시작된다', () => {
    const { drill } = makeDrill();
    const { result } = mount(drill);
    expect(down(result, { x: FULL.x, y: 262.5 })?.edgePan).toBe(true);
    // 대조군 — 한 픽셀만 밖으로 나가면 곧바로 판 이동이다.
    expect(down(result, { x: FULL.x - 1, y: 262.5 })?.pan).toBe(true);
  });
});

describe('마진에 개체가 서 있으면 개체가 이긴다 (킥인·코너 세트피스 D26)', () => {
  it('마진에 세운 휠체어를 누르면 판이 아니라 그 휠체어를 잡는다', () => {
    // 판정 순서가 뒤집히면(좌표를 먼저 보면) 라인 밖 배치가 통째로 조작 불가가 된다.
    const { drill, marginChair } = makeDrill({ margin: MARGIN_LEFT });
    const { result } = mount(drill);
    const out = down(result, MARGIN_LEFT);
    expect(out?.pan).toBeFalsy();
    expect(Array.from(result.current.state.selection)).toEqual([marginChair]);
  });
});

describe('flat 코트에는 테두리가 없다', () => {
  it('마진이 0 이므로 판 어디서 시작해도 고무줄이다', () => {
    // surface 가 viewBox 전체다(D12). 여기서 판 이동이 시작되면 라인 없는 판에서
    // 고무줄 선택이 통째로 사라진다.
    const { drill } = makeDrill({}, 'flat');
    const { result } = mount(drill);
    expect(down(result, { x: 5, y: 5 })?.edgePan).toBe(true);
    expect(down(result, { x: 5, y: 5 })?.pan).toBeFalsy();
  });

  it('판 바깥(viewBox 밖)은 flat 에서도 판 이동이다 — 확대해서 밀면 닿는 자리다', () => {
    const { drill } = makeDrill({}, 'flat');
    const { result } = mount(drill);
    expect(down(result, { x: -10, y: 200 })?.pan).toBe(true);
  });
});

describe('선택 도구가 아니면 마진은 그냥 마진이다', () => {
  it('공 도구로 마진을 누르면 판이 아니라 공이 놓인다 (라인 밖 대기 배치)', () => {
    const { drill } = makeDrill();
    const { result } = mount(drill, 'ball');
    const out = down(result, MARGIN_BOTTOM);
    expect(out?.pan).toBeFalsy();
    expect(Object.keys(result.current.state.present.steps[0]!.balls)).toHaveLength(1);
  });

  it('화살표(이동) 도구로 마진에서 시작해도 판을 밀지 않는다 — 라인 밖에서 들어오는 경로다', () => {
    const { drill } = makeDrill();
    const { result } = mount(drill, 'line');
    expect(down(result, MARGIN_LEFT)?.pan).toBeFalsy();
    expect(result.current.pointer.arrowDraft).not.toBeNull();
  });

});

describe('마진을 제자리에서 톡 치면 빈 곳 탭과 같다 ([A-3] 해제 경로 보존)', () => {
  /** 먼저 경기면 안 휠체어를 골라 둔다 — 풀 것이 있어야 해제가 관측된다. */
  function withSelection() {
    const { drill, insideChair } = makeDrill({ inside: true });
    const { result } = mount(drill);
    down(result, INSIDE);
    act(() => result.current.pointer.controller.onPointerUp(null));
    expect(Array.from(result.current.state.selection)).toEqual([insideChair]);
    return { result, insideChair };
  }

  it('마진 탭(제자리) → 선택이 풀린다', () => {
    // 지금까지는 크기 0 짜리 고무줄이 이 일을 했다. 마진을 판 이동으로 넘기면서
    // 이 경로가 조용히 사라지면 그것이 곧 회귀다.
    const { result } = withSelection();
    down(result, MARGIN_LEFT);
    // CourtStage 는 판을 밀지 않은 이동에 **좌표를 실어** up 을 넘긴다(= 탭이었다).
    act(() => result.current.pointer.controller.onPointerUp({ x: 10, y: 10 }));
    expect(Array.from(result.current.state.selection)).toEqual([]);
  });

  it('마진을 실제로 끈 뒤에는 선택이 그대로다 — 판을 민 것이지 탭이 아니다', () => {
    const { result, insideChair } = withSelection();
    down(result, MARGIN_LEFT);
    // 민 뒤에는 좌표 없이 온다(pointercancel 과 같은 "탭이 아니다" 신호).
    act(() => result.current.pointer.controller.onPointerUp(null));
    expect(Array.from(result.current.state.selection)).toEqual([insideChair]);
  });

  it('Shift(가산 선택) 로 마진을 톡 쳐도 선택이 유지된다 — 고무줄 규칙과 같다', () => {
    const { result, insideChair } = withSelection();
    down(result, MARGIN_LEFT, { ...META, shiftKey: true });
    act(() => result.current.pointer.controller.onPointerUp({ x: 10, y: 10 }));
    expect(Array.from(result.current.state.selection)).toEqual([insideChair]);
  });
});
