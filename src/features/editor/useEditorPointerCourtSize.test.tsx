// §6.4 — **포인터 판정이 그 판의 코트 크기를 본다.**
//
// useEditorPointer 는 코트 정의를 세 군데서 쓴다. 셋 다 크기를 안 넘기면 25×14 판에서
// 30×18 의 답을 낸다.
//   ① `isOnSurface` — "여기는 코트인가 판의 테두리인가"(§4.4 P2-1). 틀리면 경기면 **밖**을
//      잡았는데 고무줄 선택이 시작되고, 판이 안 밀린다. 여기서는 **행동으로** 잰다.
//   ② `snapOnSettle` 의 `size` — 앵커가 남의 코트 것이 된다.
//   ③ `formationSlots` 의 `size` — 스냅 후보 ④(기본 배치 슬롯)가 남의 코트 것이 된다.
//
// jsdom 에는 레이아웃이 없어 client→world 변환이 NaN 이 되므로, 이웃 파일(settle 테스트)과
// 같은 관용구로 `controller` 를 **월드 좌표로 직접** 부른다.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, renderHook, waitFor } from '@testing-library/react';
import { createRef, useRef } from 'react';
import type { ReactNode } from 'react';
import { BALL, DEFAULT_ZONES } from '../../core/constants.ts';
import type { ChairId } from '../../core/ids.ts';
import { createDrill, formationSlots } from '../../model/defaults.ts';
import type { Drill } from '../../model/drill.ts';
import { courtDefFor, gridCellCenter, isOnSurface, type CourtSize } from '../../model/court.ts';
import type { CourtStageHandle, PointerMeta } from '../../render/CourtStage.tsx';
import { SettingsProvider } from '../../store/settings/SettingsProvider.tsx';
import { EditorProvider, useEditorDispatch, useEditorState, useEditorWorld, useEditorWriter } from '../../store/editor/EditorProvider.tsx';
import type { EditorWorldRef } from '../../store/editor/EditorProvider.tsx';
import { EditorStage } from './EditorStage.tsx';
import { createTransformWriter } from '../../render/transformWriter.ts';
import * as snapModule from './snapOnSettle.ts';
import { useEditorPointer } from './useEditorPointer.ts';

const META: PointerMeta = { pointerType: 'mouse', button: 0, shiftKey: false, metaKey: false, ctrlKey: false, altKey: false };

/** 25×14 경기면 **밖**(x > 662.5)이면서 30×18 경기면 **안**인 지점.
 *  = 크기를 안 넘기면 두 판의 판정이 갈리는 자리. 좌표는 court.ts 에서 파생한다(규칙 10). */
const PROBE = {
  x: (courtDefFor('full', '25x14').surface.x + courtDefFor('full', '25x14').surface.w + courtDefFor('full', '25x14').vbW) / 2,
  y: 200,
};

function makeDrill(size: CourtSize): { drill: Drill; chairId: ChairId } {
  const base = createDrill({ courtMode: 'full', courtSize: size, formation: '1-2-1' });
  const chairId = base.cast.chairs[0]!.id;
  const step0 = base.steps[0]!;
  return {
    chairId,
    // 휠체어 한 대만 — 이웃이 없어야 체이스가 다른 칩에 막히지 않는다(settle 테스트와 같은 이유).
    drill: { ...base, steps: [{ ...step0, chairs: { [chairId]: { x: 200, y: 240, angleDeg: 0 } }, balls: {}, cones: {} }] },
  };
}

function useHarness() {
  const state = useEditorState();
  const dispatch = useEditorDispatch();
  const worldRef = useEditorWorld();
  const writer = useEditorWriter();
  const stageRef = useRef<CourtStageHandle | null>(null);
  const drill = state.present;
  const pointer = useEditorPointer({
    drill,
    step: drill.steps[0]!,
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
}

function mount(drill: Drill) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <SettingsProvider>
      <EditorProvider drill={drill}>{children}</EditorProvider>
    </SettingsProvider>
  );
  return renderHook(() => useHarness(), { wrapper });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('§6.4 ① 경기면 판정이 코트 크기를 따라간다', () => {
  it('대조군: 이 지점은 25×14 에서는 경기면 밖, 30×18 에서는 안이다 (모델 수준)', () => {
    expect(isOnSurface('full', PROBE, '25x14')).toBe(false);
    expect(isOnSurface('full', PROBE, '30x18')).toBe(true);
    // 그리고 두 판 모두에서 **viewBox 안**이다 — "판 밖이라 아무 일도 안 난다" 가 아니다.
    expect(PROBE.x).toBeLessThan(courtDefFor('full', '25x14').vbW);
  });

  it('25×14 판에서 그 지점을 잡으면 **판 이동**이 된다 (마진 = 판의 테두리, §4.4 P2-1)', () => {
    const { drill } = makeDrill('25x14');
    const { result } = mount(drill);
    let out: unknown;
    act(() => {
      out = result.current.pointer.controller.onPointerDown(PROBE, META);
    });
    expect(out).toMatchObject({ pan: true });
  });

  it('대조군: 30×18 판에서 같은 지점은 판 이동이 아니다 (고무줄 선택이 시작된다)', () => {
    const { drill } = makeDrill('30x18');
    const { result } = mount(drill);
    let out: unknown;
    act(() => {
      out = result.current.pointer.controller.onPointerDown(PROBE, META);
    });
    expect(out).not.toMatchObject({ pan: true });
  });
});

describe('§6.4 ②③ 정착 스냅에 판의 크기와 그 크기의 슬롯이 실린다', () => {
  it(
    '25×14 판의 정착 스냅은 size=25x14 와 그 크기의 포메이션 슬롯을 받는다',
    async () => {
      const spy = vi.spyOn(snapModule, 'snapOnSettle');
      const { drill, chairId } = makeDrill('25x14');
      const { result } = mount(drill);
      const poseOf = () => result.current.state.present.steps[0]!.chairs[chairId]!;
      const x0 = poseOf().x;

      const ctrl = () => result.current.pointer.controller;
      act(() => void ctrl().onPointerDown({ x: 200, y: 240 }, META));
      act(() => ctrl().onPointerMove({ x: 350, y: 240 }, 0));
      await act(async () => await sleep(60));
      act(() => ctrl().onPointerUp(null));

      await waitFor(() => expect(poseOf().x).toBeGreaterThan(x0 + 40), { timeout: 20000, interval: 40 });
      expect(spy, '정착 스냅이 아예 안 불렸다 — 아래 단언이 헛것이 된다').toHaveBeenCalledTimes(1);

      const ctx = spy.mock.calls[0]![1];
      expect(ctx.mode).toBe('full');
      expect(ctx.size).toBe('25x14');
      // 슬롯도 그 크기의 것이다. 30×18 슬롯과 **다르다**는 것까지 본다(대조군).
      expect(ctx.slots).toEqual(formationSlots('full', '1-2-1', '25x14'));
      expect(ctx.slots).not.toEqual(formationSlots('full', '1-2-1', '30x18'));
    },
    30000,
  );
});

// ── ④ 키보드 배치 커서(§7.5d) ──────────────────────────────────────────────────────────
//
// 격자 칸의 **중심 좌표**는 크기마다 다르다(30×18 은 125×90 px 칸, 25×14 는 104.17×70).
// EditorStage 가 `gridCellCenter` 에 크기를 안 넘기면 키보드 사용자만 남의 코트 격자 위를
// 걷는다 — 마우스 경로는 멀쩡하므로 눈으로는 절대 안 보인다.
describe('§6.4 ④ 키보드 배치 커서가 그 코트의 격자 위에 선다', () => {
  it.each(['30x18', '25x14'] as const)('%s — ArrowRight 한 번이면 b1 칸 중심이다', (size) => {
    const drill = createDrill({ courtMode: 'full', courtSize: size, empty: true });
    // 무대 핸들을 실제로 붙인다 — 프로덕션(EditorWorkspace)이 늘 붙이고, §7.5d 키 경로가
    // `refreshMetrics()` 로 회전을 물어보기 때문이다(jsdom 은 폭이 0 이라 rot=0 이 나온다).
    const stageRef = createRef<CourtStageHandle>();
    const { container } = render(
      <EditorStage
        rot={0}
        ref={stageRef}
        drill={drill}
        step={drill.steps[0]!}
        tool="ball"
        coneSlot={0}
        selection={new Set()}
        dispatch={vi.fn()}
        worldRef={{ current: null } as EditorWorldRef}
        writer={createTransformWriter()}
        zones={DEFAULT_ZONES}
        ballMax={BALL.maxCount}
        pendingPlayerId={null}
        onPlayerPlaced={vi.fn()}
        showToast={vi.fn()}
        showGrid={false}
        showGridLabels={false}
        showRuleZones={false}
        largeTargets={false}
        onEraseIds={vi.fn()}
      />,
    );
    const stage = container.querySelector('svg[role="application"]')!;
    fireEvent.keyDown(stage, { key: 'ArrowRight' });

    const want = gridCellCenter('full', 1, 0, size);
    const cursor = container.querySelector('g[transform^="translate("]:not([data-obj])');
    expect(container.innerHTML, '키보드 커서가 그려지지 않았다 — 아래 단언이 헛것이 된다').toContain('translate(');
    expect(cursor?.getAttribute('transform')).toBe(`translate(${want.x} ${want.y})`);
  });

  it('대조군: 두 크기의 b1 중심이 서로 다르다', () => {
    expect(gridCellCenter('full', 1, 0, '30x18')).not.toEqual(gridCellCenter('full', 1, 0, '25x14'));
  });
});
