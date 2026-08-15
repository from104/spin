// 선의 포인터 조작 3종 (기현 지시 2026-08-16).
//
// *"양 끝 앵커를 반복 클릭하면 [화살표 없음, 폭이 좁은 화살표, 폭이 넓은 화살표] 순차로
//  변하게 하고, 선 중간에 마우스 올리면 … 커서를 십자로 … 드래그하면 선 자체가 이동하게."*
//
// 세 가지가 **같은 pointerdown 에서 갈린다**: 끝 앵커를 눌렀다 떼면 순환, 끌면 그 점 이동,
// 몸통을 끌면 통째로 이동. 그 분기가 틀리면 "누르려다 1px 흔들려 점이 옮겨지는" 부류의 사고가
// 나는데, 화면 테스트로는 안 잡힌다 — 여기서 컨트롤러를 직접 부른다(tapDeselect.test 와 같은
// 이유: jsdom 은 getBoundingClientRect 가 0 이라 client→world 변환이 NaN 이다).
import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useRef } from 'react';
import type { ReactNode } from 'react';
import { BALL, DEFAULT_ZONES, INTERACT } from '../../core/constants.ts';
import { newId } from '../../core/ids.ts';
import type { ArrowId } from '../../core/ids.ts';
import { createDrill } from '../../model/defaults.ts';
import { headFromOf, headToOf } from '../../model/arrow.ts';
import type { Drill, DrillStep } from '../../model/drill.ts';
import type { CourtStageHandle, PointerMeta } from '../../render/CourtStage.tsx';
import { SettingsProvider } from '../../store/settings/SettingsProvider.tsx';
import { EditorProvider, useEditorDispatch, useEditorState, useEditorWorld, useEditorWriter } from '../../store/editor/EditorProvider.tsx';
import { useEditorPointer } from './useEditorPointer.ts';

const META: PointerMeta = { pointerType: 'mouse', button: 0, shiftKey: false, metaKey: false, ctrlKey: false, altKey: false };
const CLIENT = { x: 10, y: 10 };

/** 수평 직선. 몸통 지점(325,350)은 세 핸들에서 25px 떨어져 handleHitRadiusCssPx(22) 밖이다 —
 *  몸통을 잡았는데 핸들로 새면 이 파일의 절반이 뜻을 잃는다. */
const ARROW = { from: { x: 300, y: 350 }, ctrl: { x: 350, y: 350 }, to: { x: 400, y: 350 } };
const BODY = { x: 325, y: 350 };

function makeDrill(): { drill: Drill; arrowId: ArrowId } {
  const base = createDrill({ courtMode: 'full', formation: '1-2-1', empty: true });
  const arrowId = newId('ar');
  const step0 = base.steps[0]!;
  const step: DrillStep = { ...step0, chairs: {}, balls: {}, cones: {}, notes: [], arrows: [{ id: arrowId, ...ARROW }] };
  return { arrowId, drill: { ...base, steps: [step] } };
}

const noop = () => {};

function useHarness() {
  const state = useEditorState();
  const dispatch = useEditorDispatch();
  const worldRef = useEditorWorld();
  const writer = useEditorWriter();
  const stageRef = useRef<CourtStageHandle | null>(null); // 무대 없음 → pxPerUnit = 1
  const drill = state.present;
  const step = drill.steps[0]!;
  const pointer = useEditorPointer({
    drill,
    stepIndex: 0,
    step,
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
    onPlayerPlaced: noop,
    showToast: noop,
    forceHandlesVisible: false,
    largeTargets: false,
  });
  return { state, pointer };
}

function mount() {
  const { drill, arrowId } = makeDrill();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <SettingsProvider>
      <EditorProvider drill={drill}>{children}</EditorProvider>
    </SettingsProvider>
  );
  const h = renderHook(() => useHarness(), { wrapper });
  return { h, arrowId };
}

type Harness = ReturnType<typeof mount>['h'];

/** 끝 앵커는 **선택된 화살표에만** 뜬다(ArrowHandles 는 선택된 하나만 그리고, hitTest 도 그때만
 *  arrowHandle 을 돌려준다). 그래서 앵커를 재는 테스트는 몸통을 한 번 눌러 고르고 시작한다 —
 *  이 한 줄이 없으면 앵커를 눌러도 '몸통' 으로 잡혀 선이 통째로 움직인다(처음에 그렇게 짰다). */
function selectFirst(h: Harness): void {
  tapAt(h, BODY);
}

const arrowOf = (h: Harness, id: ArrowId) => h.result.current.state.present.steps[0]!.arrows.find((a) => a.id === id)!;

/** 제자리 누르기 — down 과 up 사이에 이동이 없다. */
function tapAt(h: Harness, p: { x: number; y: number }): void {
  act(() => h.result.current.pointer.controller.onPointerDown(p, META));
  act(() => h.result.current.pointer.controller.onPointerUp(CLIENT));
}

/** 끌기 — 임계를 확실히 넘긴다(탭 임계는 6 CSS px = 6 월드 px). */
function dragFromTo(h: Harness, a: { x: number; y: number }, b: { x: number; y: number }): void {
  act(() => h.result.current.pointer.controller.onPointerDown(a, META));
  act(() => h.result.current.pointer.controller.onPointerMove(b, 16));
  act(() => h.result.current.pointer.controller.onPointerUp(CLIENT));
}

describe('끝 앵커 — 누르면 순환, 끌면 이동', () => {
  it('★ 끝점을 눌렀다 떼면 화살촉이 돈다 — 좁은 → 넓은 → 없음 → 좁은', () => {
    const { h, arrowId } = mount();
    selectFirst(h);
    expect(headToOf(arrowOf(h, arrowId)), '기본이 좁은 화살표가 아니다').toBe('thin');
    tapAt(h, ARROW.to);
    expect(headToOf(arrowOf(h, arrowId))).toBe('wide');
    tapAt(h, ARROW.to);
    expect(headToOf(arrowOf(h, arrowId))).toBe('none');
    tapAt(h, ARROW.to);
    expect(headToOf(arrowOf(h, arrowId)), '세 번 눌러도 제자리로 안 왔다').toBe('thin');
  });

  it('★ 시작점도 따로 돈다 — 없음에서 시작하고 반대쪽은 안 건드린다', () => {
    const { h, arrowId } = mount();
    selectFirst(h);
    expect(headFromOf(arrowOf(h, arrowId))).toBe('none');
    tapAt(h, ARROW.from);
    expect(headFromOf(arrowOf(h, arrowId))).toBe('thin');
    expect(headToOf(arrowOf(h, arrowId)), '시작점을 눌렀는데 끝점이 함께 돌았다').toBe('thin');
  });

  it('★ 끌면 순환이 아니라 **그 점이 옮겨진다**', () => {
    const { h, arrowId } = mount();
    selectFirst(h);
    const target = { x: ARROW.to.x + 60, y: ARROW.to.y - 40 };
    dragFromTo(h, ARROW.to, target);
    const a = arrowOf(h, arrowId);
    expect(a.to).toEqual(target);
    expect(headToOf(a), '끌었는데 화살촉까지 돌았다').toBe('thin');
    // 나머지 두 점은 그대로다 — 끝점 드래그는 그 점 하나만 옮긴다.
    expect(a.from).toEqual(ARROW.from);
    expect(a.ctrl).toEqual(ARROW.ctrl);
  });

  it('탭 임계 **안**에서 흔들린 것은 여전히 누르기다 — 1px 떨림에 점이 안 옮겨진다', () => {
    const { h, arrowId } = mount();
    selectFirst(h);
    const jitter = { x: ARROW.to.x + INTERACT.tapMaxMoveCssPx - 1, y: ARROW.to.y };
    dragFromTo(h, ARROW.to, jitter);
    const a = arrowOf(h, arrowId);
    expect(a.to, '임계 안 떨림에 점이 옮겨졌다').toEqual(ARROW.to);
    expect(headToOf(a), '임계 안 떨림인데 순환이 안 됐다').toBe('wide');
  });

  it('굽힘점(ctrl)에는 화살촉이 없다 — 눌러도 아무 일도 안 난다', () => {
    const { h, arrowId } = mount();
    selectFirst(h);
    const before = arrowOf(h, arrowId);
    tapAt(h, ARROW.ctrl);
    const after = arrowOf(h, arrowId);
    expect(headFromOf(after)).toBe(headFromOf(before));
    expect(headToOf(after)).toBe(headToOf(before));
  });
});

describe('몸통 — 끌면 선이 통째로 간다', () => {
  it('★ 세 점이 같은 델타로 함께 움직인다 — 모양이 그대로다', () => {
    const { h, arrowId } = mount();
    const d = { x: 40, y: -25 };
    dragFromTo(h, BODY, { x: BODY.x + d.x, y: BODY.y + d.y });
    const a = arrowOf(h, arrowId);
    expect(a.from).toEqual({ x: ARROW.from.x + d.x, y: ARROW.from.y + d.y });
    expect(a.ctrl).toEqual({ x: ARROW.ctrl.x + d.x, y: ARROW.ctrl.y + d.y });
    expect(a.to).toEqual({ x: ARROW.to.x + d.x, y: ARROW.to.y + d.y });
  });

  it('★ 몸통을 끌어도 화살촉은 안 바뀐다', () => {
    const { h, arrowId } = mount();
    dragFromTo(h, BODY, { x: BODY.x + 40, y: BODY.y });
    expect(headToOf(arrowOf(h, arrowId))).toBe('thin');
    expect(headFromOf(arrowOf(h, arrowId))).toBe('none');
  });

  it('★ 몸통 재탭 해제가 살아 있다 — 몸통 드래그 세션이 그 판정을 삼키면 안 된다', () => {
    // 2026-08-16 에 실제로 한 번 삼켰다: 몸통 세션이 pointerup 에서 그냥 return 하는 바람에
    // 화살표만 선택이 안 풀렸다. 메모가 간 길(finishTap)과 같아야 한다.
    const { h, arrowId } = mount();
    tapAt(h, BODY); // 선택
    expect(h.result.current.state.selection.has(arrowId)).toBe(true);
    tapAt(h, BODY); // 재탭 → 해제
    expect(h.result.current.state.selection.has(arrowId), '재탭했는데 선택이 안 풀렸다').toBe(false);
  });
});
