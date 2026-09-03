// 자유 그리기(획)의 포인터 조작 (기현 지시 2026-09-03).
//
// *"드릴 편집 작도에 자유 그리기 추가. 백터로 그리고 3개의 앵커 회전, 양끝 화살표 그냥 클릭
//  3단계, 약간 외각에 회전(드래그는 회전, 그냥 클릭은 색 순환). 선 (반복 클릭 굵기 3단계,
//  드래그 이동)."*
//
// arrowPointer.test.tsx 와 **같은 하네스**다(무대 없음 → pxPerUnit = 1, 컨트롤러 직접 호출).
// 같은 이유이기도 하다: jsdom 은 getBoundingClientRect 가 0 이라 client→world 변환이 NaN 이고,
// 여기서 재려는 것은 화면이 아니라 **한 pointerdown 이 어느 갈래로 가는가** 다.
//
// ⚠️ 이 파일이 화살표 쪽과 갈리는 지점은 셋뿐이고, 그 셋이 곧 이 도구의 새 규칙이다:
//   ① 몸통 탭에 뜻이 있다(굵기) — 그래서 재탭 해제를 안 탄다.
//   ② 회전 앵커 탭에 뜻이 있다(색) — 획에는 굽힘점이 없어 색이 갈 자리가 거기뿐이다.
//   ③ 양 끝 앵커는 **끌어도 안 움직인다** — 지시에 클릭만 있고, N점 획의 끝점만 옮기면
//      마지막 선분 하나가 늘어나 손으로 그은 모양이 깨진다.
import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useRef } from 'react';
import type { ReactNode } from 'react';
import { BALL, DEFAULT_ZONES, INTERACT } from '../../core/constants.ts';
import { newId } from '../../core/ids.ts';
import type { StrokeId } from '../../core/ids.ts';
import { createDrill } from '../../model/defaults.ts';
import { ARROW_COLOR_CYCLE, ARROW_ROTATE_GAP_PX, ARROW_STYLE, arrowColor } from '../../model/arrow.ts';
import {
  STROKE_WIDTH_DEFAULT,
  strokeCenter,
  strokeHeadFrom,
  strokeHeadTo,
  strokeWidthIndexOf,
} from '../../model/stroke.ts';
import type { Drill, DrillStep } from '../../model/drill.ts';
import type { ToolId } from '../../physics/index.ts';
import type { CourtStageHandle, PointerMeta } from '../../render/CourtStage.tsx';
import { SettingsProvider } from '../../store/settings/SettingsProvider.tsx';
import { EditorProvider, useEditorDispatch, useEditorState, useEditorWorld, useEditorWriter } from '../../store/editor/EditorProvider.tsx';
import { useEditorPointer } from './useEditorPointer.ts';

const META: PointerMeta = { pointerType: 'mouse', button: 0, shiftKey: false, metaKey: false, ctrlKey: false, altKey: false };
const CLIENT = { x: 10, y: 10 };

/** 수평 3점 획. 몸통 지점(325,350)은 세 앵커 전부에서 25px 넘게 떨어져 있어
 *  `handleHitRadiusCssPx`(22) 밖이다 — 몸통을 잡았는데 앵커로 새면 이 파일의 절반이 뜻을 잃는다. */
const PTS = [
  { x: 300, y: 350 },
  { x: 350, y: 350 },
  { x: 400, y: 350 },
];
const FROM = PTS[0]!;
const TO = PTS[2]!;
const BODY = { x: 325, y: 350 };
/** 회전 앵커 — 끝 접선(+x) 방향으로 GAP 만큼 바깥. `strokeHandlePoints` 가 정하는 그 자리다. */
const ROTATE = { x: TO.x + ARROW_ROTATE_GAP_PX, y: TO.y };
/** 경계상자 중심 = 회전축. */
const CENTER = { x: 350, y: 350 };

function makeDrill(): { drill: Drill; strokeId: StrokeId } {
  const base = createDrill({ courtMode: 'full', formation: '1-2-1', empty: true });
  const strokeId = newId('fh');
  const step0 = base.steps[0]!;
  const step: DrillStep = {
    ...step0,
    chairs: {},
    balls: {},
    cones: {},
    notes: [],
    arrows: [],
    strokes: [{ id: strokeId, points: PTS }],
  };
  return { strokeId, drill: { ...base, steps: [step] } };
}

/** 획이 하나도 없는 판 — 자유 그리기 캡처를 재는 쪽이 쓴다. */
function emptyDrill(): Drill {
  const base = createDrill({ courtMode: 'full', formation: '1-2-1', empty: true });
  const step0 = base.steps[0]!;
  const step: DrillStep = { ...step0, chairs: {}, balls: {}, cones: {}, notes: [], arrows: [], strokes: [] };
  return { ...base, steps: [step] };
}

const noop = () => {};

function useHarness(tool: ToolId, onEraseIds: (ids: string[], scope: 'onward' | 'thisStep') => void) {
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
    onPlayerPlaced: noop,
    onEraseIds,
    showToast: noop,
    forceHandlesVisible: false,
    largeTargets: false,
  });
  return { state, pointer, step };
}

function mount(tool: ToolId = 'select', drill: Drill = makeDrill().drill) {
  const onEraseIds = vi.fn<(ids: string[], scope: 'onward' | 'thisStep') => void>();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <SettingsProvider>
      <EditorProvider drill={drill}>{children}</EditorProvider>
    </SettingsProvider>
  );
  const h = renderHook(() => useHarness(tool, onEraseIds), { wrapper });
  return { h, onEraseIds };
}

function mountFixture(tool: ToolId = 'select') {
  const { drill, strokeId } = makeDrill();
  const { h, onEraseIds } = mount(tool, drill);
  return { h, strokeId, onEraseIds };
}

type Harness = ReturnType<typeof mount>['h'];

const strokeOf = (h: Harness, id: StrokeId) => h.result.current.state.present.steps[0]!.strokes!.find((s) => s.id === id)!;
const strokesOf = (h: Harness) => h.result.current.state.present.steps[0]!.strokes ?? [];

function tapAt(h: Harness, p: { x: number; y: number }): void {
  act(() => h.result.current.pointer.controller.onPointerDown(p, META));
  act(() => h.result.current.pointer.controller.onPointerUp(CLIENT));
}

/** 끌기 — 탭 임계(6 CSS px = 6 월드 px)를 확실히 넘긴다. */
function dragFromTo(h: Harness, a: { x: number; y: number }, b: { x: number; y: number }): void {
  act(() => h.result.current.pointer.controller.onPointerDown(a, META));
  act(() => h.result.current.pointer.controller.onPointerMove(b, 16));
  act(() => h.result.current.pointer.controller.onPointerUp(CLIENT));
}

/** 여러 점을 지나며 긋는다 — 자유 그리기 캡처가 실제로 받는 모양(표본 다발). */
function scribble(h: Harness, pts: readonly { x: number; y: number }[]): void {
  act(() => h.result.current.pointer.controller.onPointerDown(pts[0]!, META));
  for (let i = 1; i < pts.length; i += 1) {
    const p = pts[i]!;
    act(() => h.result.current.pointer.controller.onPointerMove(p, 16 * i));
  }
  act(() => h.result.current.pointer.controller.onPointerUp(CLIENT));
}

/** 앵커는 **선택된 획에만** 뜬다(hitTest 의 selectedStrokeId 게이트). 그래서 앵커를 재는
 *  테스트는 몸통을 한 번 눌러 고르고 시작한다 — 이 한 줄이 없으면 앵커 자리를 눌러도
 *  아무 히트도 안 나 빈 코트 탭이 된다. ⚠️ 이 탭은 **굵기도 한 칸 돌린다**(그것이 몸통 탭의
 *  뜻이다) — 그래서 굵기를 재는 it 은 이 함수를 쓰지 않고 첫 탭부터 직접 센다. */
function selectFirst(h: Harness): void {
  tapAt(h, BODY);
}

describe('자유 그리기 캡처 — 손이 지나간 자리가 획이 된다', () => {
  it('★ 그으면 획 하나가 생기고, 저장된 점은 **표본보다 적다**(RDP 가 실제로 돌았다)', () => {
    const { h } = mount('freehand', emptyDrill());
    // 100 → 200 을 5px 씩. 21 표본 전부가 `STROKE_MIN_STEP_PX`(2) 를 넘어 캡처에 남고,
    // 전부 한 직선 위라 RDP 가 양 끝만 남긴다.
    const raw = Array.from({ length: 21 }, (_, i) => ({ x: 100 + i * 5, y: 100 }));
    scribble(h, raw);
    const list = strokesOf(h);
    expect(list, '획이 안 만들어졌다').toHaveLength(1);
    const s = list[0]!;
    expect(s.points.length, '단순화가 표본을 하나도 안 줄였다').toBeLessThan(raw.length);
    expect(s.points).toEqual([raw[0], raw[raw.length - 1]]);
    // 기본 스타일은 **키를 안 만든다** — 굵기·색·화살촉의 기본값은 '키 없음' 이라는 계약.
    expect(Object.hasOwn(s, 'width')).toBe(false);
    expect(Object.hasOwn(s, 'color')).toBe(false);
    expect(strokeHeadTo(s), '자유 그리기의 기본은 선이지 화살표가 아니다').toBe('none');
  });

  it('★ 굽은 획은 굽이를 잃지 않는다 — 단순화가 모양까지 펴 버리면 도구가 죽는다', () => {
    const { h } = mount('freehand', emptyDrill());
    // ㄱ 자로 꺾는다. 꺾이는 점은 직선에서 멀리 떨어져 있어 RDP 가 반드시 남긴다.
    const raw = [
      ...Array.from({ length: 11 }, (_, i) => ({ x: 100 + i * 5, y: 100 })),
      ...Array.from({ length: 10 }, (_, i) => ({ x: 150, y: 105 + i * 5 })),
    ];
    scribble(h, raw);
    const s = strokesOf(h)[0]!;
    expect(s.points).toContainEqual({ x: 150, y: 100 });
    expect(s.points[0]).toEqual({ x: 100, y: 100 });
    expect(s.points[s.points.length - 1]).toEqual({ x: 150, y: 150 });
  });

  it('제자리 탭은 획이 아니다 — 판이 점 하나짜리 부스러기로 덮이지 않는다', () => {
    const { h } = mount('freehand', emptyDrill());
    tapAt(h, { x: 100, y: 100 });
    expect(strokesOf(h)).toHaveLength(0);
  });

  it('탭 임계 안에서 떤 것도 획이 아니다 — 누르다 1px 흔들린 손이 자국을 남기지 않는다', () => {
    const { h } = mount('freehand', emptyDrill());
    // 3px 씩 두 번 = 총 길이 6 → 임계(6)를 **넘지 못한다**(`>` 판정).
    scribble(h, [
      { x: 100, y: 100 },
      { x: 103, y: 100 },
      { x: 106, y: 100 },
    ]);
    expect(strokesOf(h)).toHaveLength(0);
  });

  it('★ 제자리로 돌아오는 획도 살아남는다 — 길이를 시작-끝 직선거리로 재면 동그라미가 사라진다', () => {
    // 이 it 이 `polylineLength` 의 존재 이유다. 화살표는 두 점이 전부라 직선거리가 곧 크기지만
    // (그쪽 12px 관문), 획은 손이 지나간 거리가 크기다 — 원을 그리면 시작점과 끝점이 붙어 있어
    // 직선거리로 재는 순간 방금 그린 원이 통째로 버려진다.
    const { h } = mount('freehand', emptyDrill());
    const r = 30;
    const loop = Array.from({ length: 25 }, (_, i) => {
      const a = (i / 24) * Math.PI * 2;
      return { x: 200 + r * Math.cos(a), y: 200 + r * Math.sin(a) };
    });
    scribble(h, loop);
    expect(strokesOf(h), '제자리로 돌아온 획이 탭으로 잡혀 버려졌다').toHaveLength(1);
    const s = strokesOf(h)[0]!;
    expect(s.points.length, '원이 직선 둘로 접혔다').toBeGreaterThan(4);
  });

  it('대조군 — 임계를 넘기면 같은 손짓이 획이 된다(위 it 이 그냥 아무것도 안 재는 것이 아니다)', () => {
    const { h } = mount('freehand', emptyDrill());
    scribble(h, [
      { x: 100, y: 100 },
      { x: 105, y: 100 },
      { x: 110, y: 100 },
    ]);
    expect(strokesOf(h)).toHaveLength(1);
  });

  it('그리는 동안 미리보기가 나온다 — 손을 떼면 사라진다(계약: strokeDraft)', () => {
    const { h } = mount('freehand', emptyDrill());
    expect(h.result.current.pointer.strokeDraft, '안 그리는데 미리보기가 있다').toBeNull();
    act(() => h.result.current.pointer.controller.onPointerDown({ x: 100, y: 100 }, META));
    act(() => h.result.current.pointer.controller.onPointerMove({ x: 140, y: 100 }, 16));
    expect(h.result.current.pointer.strokeDraft).toEqual([
      { x: 100, y: 100 },
      { x: 140, y: 100 },
    ]);
    act(() => h.result.current.pointer.controller.onPointerUp(CLIENT));
    expect(h.result.current.pointer.strokeDraft, '손을 뗐는데 미리보기가 남았다').toBeNull();
  });

  it('개체 위에서 시작해도 그 개체를 잡지 않는다 — 여기서 히트테스트는 안 돈다', () => {
    // 기존 획 **위**(BODY)에서 긋기 시작한다. select 도구였다면 그 획의 몸통이 잡히는 자리다.
    const { drill, strokeId } = makeDrill();
    const { h } = mount('freehand', drill);
    scribble(h, [BODY, { x: BODY.x, y: BODY.y + 20 }, { x: BODY.x, y: BODY.y + 40 }]);
    expect(strokesOf(h), '새 획이 안 생겼다 = 몸통을 잡아 버렸다').toHaveLength(2);
    expect(strokeOf(h, strokeId).points, '밑에 깔린 획이 끌려갔다').toEqual(PTS);
  });
});

describe('몸통 — 누르면 굵기가 돌고, 끌면 통째로 간다', () => {
  it('★ 반복 클릭이 굵기 3단을 돈다 — 한 바퀴 돌면 width 키가 사라진다', () => {
    const { h, strokeId } = mountFixture();
    expect(strokeWidthIndexOf(strokeOf(h, strokeId)), '기본 첨자가 1이 아니다').toBe(STROKE_WIDTH_DEFAULT);
    tapAt(h, BODY);
    expect(strokeWidthIndexOf(strokeOf(h, strokeId))).toBe(2);
    tapAt(h, BODY);
    expect(strokeWidthIndexOf(strokeOf(h, strokeId))).toBe(0);
    tapAt(h, BODY);
    expect(strokeWidthIndexOf(strokeOf(h, strokeId)), '세 번 눌러도 제자리로 안 왔다').toBe(STROKE_WIDTH_DEFAULT);
    expect(Object.hasOwn(strokeOf(h, strokeId), 'width'), '기본으로 돌아왔는데 width 키가 남았다').toBe(false);
  });

  it('★ 재탭에도 선택이 **안 풀린다** — 굵기를 고르는 동안 앵커를 잃으면 안 된다', () => {
    // 화살표 몸통과 갈리는 자리다(그쪽은 재탭 = 해제). 근거는 useEditorPointer 의
    // `hit.kind !== 'stroke'` 가드 주석: 탭에 도는 값이 있는 개체는 탭이 해제로 안 흘러간다.
    const { h, strokeId } = mountFixture();
    tapAt(h, BODY);
    // 첫 클릭도 고르기다 — 굵기를 돌리려면 그 획의 앵커가 보여야 한다.
    expect(h.result.current.state.selection.has(strokeId)).toBe(true);
    tapAt(h, BODY);
    expect(h.result.current.state.selection.has(strokeId), '재탭에 선택이 풀렸다').toBe(true);
  });

  it('★ 끌면 점 전부가 같은 델타로 움직인다 — 모양이 그대로다', () => {
    const { h, strokeId } = mountFixture();
    const d = { x: 40, y: -25 };
    dragFromTo(h, BODY, { x: BODY.x + d.x, y: BODY.y + d.y });
    const s = strokeOf(h, strokeId);
    expect(s.points).toEqual(PTS.map((p) => ({ x: p.x + d.x, y: p.y + d.y })));
    // 끌었으면 굵기는 안 돈다 — 누르기와 끌기가 갈린다.
    expect(strokeWidthIndexOf(s), '끌었는데 굵기까지 돌았다').toBe(STROKE_WIDTH_DEFAULT);
  });

  it('탭 임계 안 떨림은 여전히 누르기다 — 1px 흔들려도 획이 안 옮겨진다', () => {
    const { h, strokeId } = mountFixture();
    dragFromTo(h, BODY, { x: BODY.x + INTERACT.tapMaxMoveCssPx - 1, y: BODY.y });
    const s = strokeOf(h, strokeId);
    expect(s.points, '임계 안 떨림에 획이 옮겨졌다').toEqual(PTS);
    expect(strokeWidthIndexOf(s), '임계 안 떨림인데 굵기가 안 돌았다').toBe(2);
  });
});

describe('양 끝 앵커 — 누르면 화살촉이 돈다, 끌어도 안 움직인다', () => {
  it('★ 끝점을 눌렀다 떼면 화살촉이 돈다 — 없음 → 좁은 → 넓은 → 없음', () => {
    const { h, strokeId } = mountFixture();
    selectFirst(h);
    expect(strokeHeadTo(strokeOf(h, strokeId)), '획의 기본은 화살촉 없음이다').toBe('none');
    tapAt(h, TO);
    expect(strokeHeadTo(strokeOf(h, strokeId))).toBe('thin');
    tapAt(h, TO);
    expect(strokeHeadTo(strokeOf(h, strokeId))).toBe('wide');
    tapAt(h, TO);
    expect(strokeHeadTo(strokeOf(h, strokeId)), '세 번 눌러도 제자리로 안 왔다').toBe('none');
    expect(Object.hasOwn(strokeOf(h, strokeId), 'headTo'), "'none' 으로 돌아왔는데 키가 남았다").toBe(false);
  });

  it('★ 시작점도 따로 돈다 — 반대쪽은 안 건드린다', () => {
    const { h, strokeId } = mountFixture();
    selectFirst(h);
    tapAt(h, FROM);
    expect(strokeHeadFrom(strokeOf(h, strokeId))).toBe('thin');
    expect(strokeHeadTo(strokeOf(h, strokeId)), '시작점을 눌렀는데 끝점이 함께 돌았다').toBe('none');
  });

  it('★ 끝 앵커를 **끌어도 아무 일이 없다** — 획의 끝점은 옮기는 손잡이가 아니다', () => {
    const { h, strokeId } = mountFixture();
    selectFirst(h);
    dragFromTo(h, TO, { x: TO.x + 60, y: TO.y - 40 });
    const s = strokeOf(h, strokeId);
    expect(s.points, '끌었는데 획이 움직였다').toEqual(PTS);
    expect(strokeHeadTo(s), '끌었는데 화살촉까지 돌았다').toBe('none');
  });

  it('선택 전에는 앵커가 없다 — 그 자리를 눌러도 화살촉이 안 돈다', () => {
    const { h, strokeId } = mountFixture();
    tapAt(h, TO); // 고르지 않은 채로 끝점 자리를 누른다 = 빈 코트
    expect(strokeHeadTo(strokeOf(h, strokeId))).toBe('none');
  });
});

describe('회전 앵커 — 끌면 축 둘레로 돌고, 누르면 색이 돈다', () => {
  it('★ 누르면 색이 돈다 — 하늘(기본) → 노랑 → 빨강 → 하늘', () => {
    const { h, strokeId } = mountFixture();
    selectFirst(h);
    expect(arrowColor(strokeOf(h, strokeId)), '기본색이 화살표와 다르다').toBe(ARROW_STYLE.color);
    tapAt(h, ROTATE);
    expect(arrowColor(strokeOf(h, strokeId))).toBe(ARROW_COLOR_CYCLE[1]);
    tapAt(h, ROTATE);
    expect(arrowColor(strokeOf(h, strokeId))).toBe(ARROW_COLOR_CYCLE[2]);
    tapAt(h, ROTATE);
    expect(arrowColor(strokeOf(h, strokeId)), '세 번 눌러도 제자리로 안 왔다').toBe(ARROW_STYLE.color);
    expect(Object.hasOwn(strokeOf(h, strokeId), 'color'), '기본색인데 color 키가 남았다').toBe(false);
  });

  it('★ 끌면 색이 아니라 **점 전부가 축 둘레로 돈다** — 축은 경계상자 중심이다', () => {
    const { h, strokeId } = mountFixture();
    selectFirst(h);
    // 잡은 각 0°(축 오른쪽) → 90°(축 아래) = 시계 +90°. y-down 회전: (x,y)→(-y,x).
    dragFromTo(h, ROTATE, { x: CENTER.x, y: CENTER.y + ARROW_ROTATE_GAP_PX });
    const s = strokeOf(h, strokeId);
    expect(s.points[0]!.x).toBeCloseTo(350, 9); // (300,350): rel (-50,0) → (0,-50)
    expect(s.points[0]!.y).toBeCloseTo(300, 9);
    expect(s.points[2]!.x).toBeCloseTo(350, 9); // (400,350): rel (50,0) → (0,50)
    expect(s.points[2]!.y).toBeCloseTo(400, 9);
    // ★ 축이 보존된다 — 돌리는 동안 중심이 흘러 다니면 획이 화면을 가로질러 기어간다.
    expect(strokeCenter(s).x).toBeCloseTo(CENTER.x, 9);
    expect(strokeCenter(s).y).toBeCloseTo(CENTER.y, 9);
    expect(arrowColor(s), '끌었는데 색까지 돌았다').toBe(ARROW_STYLE.color);
  });

  it('중간을 거쳐 가도 끝 각도만 남는다 — 증분 누적이 아니라 래치 기준 변위다', () => {
    const { h, strokeId } = mountFixture();
    selectFirst(h);
    act(() => h.result.current.pointer.controller.onPointerDown(ROTATE, META));
    act(() => h.result.current.pointer.controller.onPointerMove({ x: CENTER.x, y: CENTER.y - ARROW_ROTATE_GAP_PX }, 16));
    act(() => h.result.current.pointer.controller.onPointerMove({ x: CENTER.x, y: CENTER.y + ARROW_ROTATE_GAP_PX }, 32));
    act(() => h.result.current.pointer.controller.onPointerUp(CLIENT));
    const s = strokeOf(h, strokeId);
    expect(s.points[0]!.y).toBeCloseTo(300, 9);
    expect(s.points[2]!.y).toBeCloseTo(400, 9);
  });

  it('탭 임계 안 떨림도 회전이 아니다 — 1px 흔들려도 획이 안 돈다', () => {
    const { h, strokeId } = mountFixture();
    selectFirst(h);
    dragFromTo(h, ROTATE, { x: ROTATE.x + INTERACT.tapMaxMoveCssPx - 1, y: ROTATE.y });
    expect(strokeOf(h, strokeId).points).toEqual(PTS);
  });
});

describe('[지우기] 도구 — 획도 표적이다', () => {
  it('★ 몸통을 찍으면 그 획이 치워진다(트레이 드롭·Delete 와 같은 함수로 들어간다)', () => {
    const { h, strokeId, onEraseIds } = mountFixture('eraser');
    tapAt(h, BODY);
    expect(onEraseIds).toHaveBeenCalledWith([strokeId], 'onward');
  });

  it('빈 곳을 찍으면 획이 아니라 도구가 빠진다 — 파괴 도구가 관대하지 않다', () => {
    const { h, onEraseIds } = mountFixture('eraser');
    // 획에서 40px 떨어진 곳. select 라면 2차(관대) 패스가 잡았을 거리지만 지우기는 1차뿐이다.
    tapAt(h, { x: BODY.x, y: BODY.y + 40 });
    expect(onEraseIds).not.toHaveBeenCalled();
    expect(h.result.current.state.tool).toBe('select');
  });
});
