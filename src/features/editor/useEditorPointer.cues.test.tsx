// §4.3 P1-4 배선 — "놓으면 소리가 나고 손끝이 울린다" 가 실제 포인터 경로에 닿는가.
//
// 신호의 모양은 ui/cueSpec.test.ts 가, 게이트·수명은 ui/cues.test.ts 가, 막힘 판정은
// blockCue.test.ts 가 각각 잰다. 여기서 재는 것은 **어느 사건이 어느 신호를 부르는가** 뿐이다.
//
// [D-7] 이 파일의 절반은 **소리가 나지 않아야 할 자리**와 **말하지 않아야 할 자리**다:
//   · pointercancel 은 놓은 것이 아니다
//   · 배치가 상한에 막히면 토스트가 말하므로 소리는 침묵한다
//   · 놓임은 라이브 리전에 한 글자도 쓰지 않는다 — 같은 사건을 소리와 발화로 두 번 통보하면
//     스크린리더 사용자에게는 그냥 소음이다
//
// 포인터 사건을 DOM 에 쏘지 않고 controller 를 직접 부른다(tapDeselect.test.tsx 와 같은 이유:
// jsdom 은 getBoundingClientRect 가 전부 0 이라 client→world 변환이 NaN 이 된다).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useRef } from 'react';
import type { ReactNode } from 'react';
import { BALL, DEFAULT_ZONES } from '../../core/constants.ts';
import { isId, newId } from '../../core/ids.ts';
import type { CastId, ChairId } from '../../core/ids.ts';
import { createDrill } from '../../model/defaults.ts';
import type { Drill, DrillStep } from '../../model/drill.ts';
import type { CourtStageHandle, PointerMeta } from '../../render/CourtStage.tsx';
import type { ToolId } from '../../physics/index.ts';
import { SettingsProvider } from '../../store/settings/SettingsProvider.tsx';
import { EditorProvider, useEditorDispatch, useEditorState, useEditorWorld, useEditorWriter } from '../../store/editor/EditorProvider.tsx';
import { liveRegion } from '../../ui/LiveRegion.tsx';
import { cues } from '../../ui/cues.ts';
import { useEditorPointer } from './useEditorPointer.ts';

const META: PointerMeta = { pointerType: 'touch', button: 0, shiftKey: false, metaKey: false, ctrlKey: false, altKey: false };
/** pointerup 의 화면 좌표. null 은 pointercancel 이라는 뜻이므로 값 자체보다 **null 이 아님**이 중요하다. */
const CLIENT = { x: 10, y: 10 };

const CHAIR_AT = { x: 200, y: 240, angleDeg: 0 };
/** 차체 밖 전방 45px = towFront 존 핸들 자리(INTERACT.handleLeverPx.towFront). 이 자리를 잡으면
 *  `liveRegion.say('전방 견인 잡음')` 이 나간다 — D-7 판정의 **대조군**이다. */
const TOW_FRONT_HANDLE = { x: CHAIR_AT.x + 45, y: CHAIR_AT.y };

const noop = () => {};

function makeDrill(): { drill: Drill; chairId: ChairId } {
  const base = createDrill({ courtMode: 'full', formation: '1-2-1' });
  const chairId = base.cast.chairs[0]!.id;
  const step0 = base.steps[0]!;
  const step: DrillStep = { ...step0, chairs: { [chairId]: { ...CHAIR_AT } }, balls: {}, cones: {}, notes: [], arrows: [] };
  return { chairId, drill: { ...base, steps: [step] } };
}

/** 공을 상한만큼 채운 판 — 배치 실패(토스트) 경로를 만든다. */
function makeBallFullDrill(): Drill {
  const base = createDrill({ courtMode: 'full', formation: '1-2-1', empty: true });
  const balls: Record<string, { x: number; y: number }> = {};
  const defs = [];
  for (let i = 0; i < BALL.maxCount; i++) {
    const id = newId('bl');
    defs.push({ id });
    balls[id] = { x: 400 + i, y: 400 };
  }
  const step0 = base.steps[0]!;
  return { ...base, cast: { ...base.cast, balls: defs }, steps: [{ ...step0, balls }] };
}

function useHarness(tool: ToolId, toasts: string[], erased: string[], locked?: ReadonlySet<string>) {
  const state = useEditorState();
  const dispatch = useEditorDispatch();
  const worldRef = useEditorWorld();
  const writer = useEditorWriter();
  // 무대 핸들 없음 → pxPerUnit = 1 (월드 px = CSS px).
  const stageRef = useRef<CourtStageHandle | null>(null);
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
    // §6.10c — 트레이 드롭은 이제 **치우기 함수에 위임**한다(소리·토스트·선택 해제는 그쪽
    // 몫이다). 여기서는 위임이 실제로 일어났는지를 기록하고, 판이 정말 비는지 보기 위해
    // 칩 치우기만 흉내 낸다 — 진짜 구현은 EditorWorkspace.eraseIds 다.
    onEraseIds: (ids) => {
      erased.push(...ids);
      for (const id of ids) if (isId(id, 'ch') || isId(id, 'bl') || isId(id, 'cn')) dispatch({ type: 'OBJECT_REMOVE', id: id as CastId, scope: 'onward' });
    },
    showToast: (m) => toasts.push(m),
    // 2026-09-03 — 지우기 도구가 잠긴 개체를 만났을 때를 재려고 열었다. 기본은 undefined 라
    // 기존 it 들의 문맥은 한 글자도 안 바뀐다(잠금은 꺼짐이 기본이다).
    locked,
    forceHandlesVisible: false,
    largeTargets: false,
  });
  // `dispatch` 를 함께 내보낸다(2026-09-03). 이 하네스는 도구를 **인자로** 받아 훅에 꽂으므로
  // 리듀서의 `state.tool` 과 두 벌이 된다 — 지우기 도구는 자기가 `TOOL_SET` 을 쏘는 유일한
  // 도구라, 그 발화를 재려면 두 벌을 먼저 맞춰 놓아야 한다(안 맞추면 '선택으로 빠졌다' 가
  // 처음부터 참이라 아무것도 안 재는 단언이 된다).
  return { state, dispatch, pointer };
}

function mount(drill: Drill, tool: ToolId = 'select', locked?: ReadonlySet<string>) {
  const toasts: string[] = [];
  const erased: string[] = [];
  const wrapper = ({ children }: { children: ReactNode }) => (
    <SettingsProvider>
      <EditorProvider drill={drill}>{children}</EditorProvider>
    </SettingsProvider>
  );
  const r = renderHook(() => useHarness(tool, toasts, erased, locked), { wrapper });
  return { ...r, toasts, erased };
}

let play: ReturnType<typeof vi.spyOn>;
let say: ReturnType<typeof vi.spyOn>;

/** 어느 신호가 몇 번 났는가. */
const kinds = (): string[] => play.mock.calls.map((c: unknown[]) => c[0] as string);

beforeEach(() => {
  // 실제 합성·진동은 이 층의 관심사가 아니다 — 어느 사건이 어느 신호를 부르는지만 본다.
  play = vi.spyOn(cues, 'play').mockImplementation(() => {});
  say = vi.spyOn(liveRegion, 'say').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("놓임 '탁'", () => {
  it('개체를 끌어다 놓으면 한 번 울린다', () => {
    const { result } = mount(makeDrill().drill);
    const ctrl = () => result.current.pointer.controller;

    act(() => void ctrl().onPointerDown(CHAIR_AT, META));
    act(() => ctrl().onPointerMove({ x: 260, y: 240 }, 16));
    expect(kinds()).not.toContain('drop'); // 아직 손을 떼지 않았다
    act(() => ctrl().onPointerUp(CLIENT));

    expect(kinds()).toEqual(['drop']);
  });

  it('pointercancel 에는 울리지 않는다 — 시스템 제스처에 뺏긴 것이지 놓은 것이 아니다', () => {
    const { result } = mount(makeDrill().drill);
    const ctrl = () => result.current.pointer.controller;

    act(() => void ctrl().onPointerDown(CHAIR_AT, META));
    act(() => ctrl().onPointerMove({ x: 260, y: 240 }, 16));
    act(() => ctrl().onPointerUp(null));

    expect(kinds()).not.toContain('drop');
    expect(kinds()).not.toContain('trayReturn');
  });

  it('배치 도구로 코트를 찍어 놓아도 울린다 — 경로가 달라도 같은 신호다', () => {
    const { result } = mount(createDrill({ courtMode: 'full', formation: '1-2-1', empty: true }), 'cone');
    act(() => void result.current.pointer.controller.onPointerDown({ x: 300, y: 300 }, META));
    expect(kinds()).toEqual(['drop']);
  });

  it('키보드 커서 배치도 같은 신호를 낸다(§7.5d)', () => {
    const { result } = mount(createDrill({ courtMode: 'full', formation: '1-2-1', empty: true }), 'ball');
    act(() => result.current.pointer.placeAtCursor({ x: 300, y: 300 }));
    expect(kinds()).toEqual(['drop']);
  });

  it('상한에 막혀 못 놓으면 침묵한다 — 토스트가 대신 말하므로 두 통보가 겹치지 않는다', () => {
    const { result, toasts } = mount(makeBallFullDrill(), 'ball');
    act(() => void result.current.pointer.controller.onPointerDown({ x: 300, y: 300 }, META));
    expect(kinds()).toEqual([]);
    expect(toasts).toHaveLength(1); // 대조군 — 아무 일도 안 일어난 것이 아니다
  });
});

describe('트레이 반환 — 치우기는 위임하고, 예고는 여기서 낸다(§6.10c)', () => {
  afterEach(() => {
    document.elementFromPoint = () => null;
  });

  /** 트레이 노드를 깔고 elementFromPoint 가 그것을 답하게 한다 — jsdom 에는 레이아웃이 없어
   *  이 스텁이 곧 "손이 트레이 위" 다(test/setup.ts 의 그 스텁을 덮는다). */
  function withTray(): HTMLElement {
    const tray = document.createElement('div');
    tray.setAttribute('data-tray', '');
    tray.innerHTML = '<div data-tray-hint></div>';
    document.body.appendChild(tray);
    document.elementFromPoint = () => tray;
    return tray;
  }

  // ★ 2026-08-16 계약 이동. 예전에는 이 경로가 스스로 `trayReturn` 을 울리고 `OBJECT_REMOVE`
  //   를 직접 쐈다. 지금은 **치우기 함수 하나**(메뉴·Delete 와 같은 것)에 위임하고, 소리는
  //   그 함수가 낸다 — 그래서 여기서 재는 것은 "위임했는가" 와 "놓임 '탁' 은 안 울렸는가" 다.
  it("트레이 위에서 놓으면 치우기에 위임하고 놓임 '탁' 은 나지 않는다", () => {
    const { drill, chairId } = makeDrill();
    const { result, erased } = mount(drill);
    const ctrl = () => result.current.pointer.controller;
    const tray = withTray();

    act(() => void ctrl().onPointerDown(CHAIR_AT, META));
    act(() => ctrl().onPointerMove({ x: 260, y: 240 }, 16));
    act(() => ctrl().onPointerUp(CLIENT));

    expect(erased).toEqual([chairId]);
    expect(kinds()).not.toContain('drop');
    // 대조군 — 실제로 개체가 판에서 빠졌다(신호만 다른 것이 아니다).
    expect(result.current.state.present.steps[0]!.chairs[chairId]).toBeUndefined();
    tray.remove();
  });

  // 예고음의 요점은 **경계를 넘을 때 한 번**이다. 매 프레임 울리면 그냥 소음이고, 나갈 때도
  // 울리면 손이 가장자리에서 흔들릴 때마다 딸깍거린다.
  it('트레이로 들어설 때 예고음이 한 번 난다 — 머물러 있는 동안은 조용하다', () => {
    const { result } = mount(makeDrill().drill);
    const ctrl = () => result.current.pointer.controller;
    const tray = withTray();

    act(() => void ctrl().onPointerDown(CHAIR_AT, META));
    act(() => ctrl().onPointerMove({ x: 260, y: 240 }, 16, CLIENT));
    expect(kinds()).toEqual(['trayArm']);
    act(() => ctrl().onPointerMove({ x: 262, y: 240 }, 32, CLIENT));
    act(() => ctrl().onPointerMove({ x: 264, y: 240 }, 48, CLIENT));
    expect(kinds()).toEqual(['trayArm']);
    act(() => ctrl().onPointerUp(CLIENT));
    tray.remove();
  });

  // 화면 좌표가 없으면 판정 자체가 불가능하다(트레이는 코트 밖 HTML 이다). 그때는 **예고를
  // 안 하는 것**이 맞다 — 틀린 예고는 없느니만 못하다.
  it('화면 좌표 없이 움직이면 예고하지 않는다', () => {
    const { result } = mount(makeDrill().drill);
    const ctrl = () => result.current.pointer.controller;
    const tray = withTray();

    act(() => void ctrl().onPointerDown(CHAIR_AT, META));
    act(() => ctrl().onPointerMove({ x: 260, y: 240 }, 16));
    expect(kinds()).toEqual([]);
    act(() => ctrl().onPointerUp(CLIENT));
    tray.remove();
  });

});

describe("막힘 '툭'", () => {
  // 이 하네스에는 물리 루프가 돌지 않아 개체가 제자리에 서 있다 — 실제 앱에서 칩이 벽·다른
  // 칩에 막혀 멎은 상태와 판정 입력이 같다(개체는 안 움직이는데 포인터만 멀어진다).
  it('개체가 멎은 채 손이 빠르게 멀어지면 울린다', () => {
    const { result } = mount(makeDrill().drill);
    const ctrl = () => result.current.pointer.controller;

    act(() => void ctrl().onPointerDown(CHAIR_AT, META));
    act(() => ctrl().onPointerMove({ x: 210, y: 240 }, 1000));
    act(() => ctrl().onPointerMove({ x: 230, y: 240 }, 1016));

    expect(kinds()).toContain('blocked');
    const [, intensity] = play.mock.calls.find((c: unknown[]) => c[0] === 'blocked')! as unknown[];
    expect(intensity as number).toBeGreaterThan(0);
    expect(intensity as number).toBeLessThanOrEqual(1);
  });

  it('앞 드래그의 표본이 다음 드래그로 새지 않는다 — 첫 프레임 유령 툭 금지', () => {
    const { result } = mount(makeDrill().drill);
    const ctrl = () => result.current.pointer.controller;

    act(() => void ctrl().onPointerDown(CHAIR_AT, META));
    act(() => ctrl().onPointerMove({ x: 500, y: 240 }, 1000));
    act(() => ctrl().onPointerUp(CLIENT));
    play.mockClear();

    // 같은 자리를 다시 잡고 한 프레임만 크게 움직인다 — 짝이 없으므로 판정하지 않는다.
    act(() => void ctrl().onPointerDown(CHAIR_AT, META));
    act(() => ctrl().onPointerMove({ x: 700, y: 240 }, 1016));
    expect(kinds()).not.toContain('blocked');
  });
});

describe('[D-7] 소리와 발화가 같은 사건을 두 번 통보하지 않는다', () => {
  it('놓임은 라이브 리전에 한 글자도 쓰지 않는다 — 잡을 때 한 번 말한 것이 전부다', () => {
    const { drill, chairId } = makeDrill();
    const { result } = mount(drill);
    const ctrl = () => result.current.pointer.controller;

    // 존 핸들을 잡으려면 먼저 그 휠체어가 선택돼 있어야 한다(buildHitContext.handlesVisible).
    act(() => void ctrl().onPointerDown(CHAIR_AT, META));
    act(() => ctrl().onPointerUp(CLIENT));
    expect(result.current.state.selection.has(chairId)).toBe(true);
    say.mockClear();
    play.mockClear();

    // ★ 대조군 — 이 흐름 안에서 같은 스파이가 실제로 울린다(스파이가 안 걸린 것이 아니다).
    act(() => void ctrl().onPointerDown(TOW_FRONT_HANDLE, META));
    expect(say).toHaveBeenCalledTimes(1);
    expect(say.mock.calls[0]![0]).toContain('잡음');

    act(() => ctrl().onPointerMove({ x: TOW_FRONT_HANDLE.x + 30, y: 240 }, 16));
    act(() => ctrl().onPointerUp(CLIENT));

    // 놓임은 소리로만 통보된다.
    expect(kinds()).toContain('drop');
    expect(say).toHaveBeenCalledTimes(1);
  });

  it('트레이 반환도 발화하지 않는다 — 소리와 토스트가 그 통보다', () => {
    const { result, erased } = mount(makeDrill().drill);
    const ctrl = () => result.current.pointer.controller;
    const tray = document.createElement('div');
    tray.setAttribute('data-tray', '');
    document.body.appendChild(tray);
    document.elementFromPoint = () => tray;

    act(() => void ctrl().onPointerDown(CHAIR_AT, META));
    act(() => ctrl().onPointerMove({ x: 260, y: 240 }, 16, CLIENT));
    say.mockClear();
    act(() => ctrl().onPointerUp(CLIENT));

    // 예고음은 났고(들어설 때 한 번), 치우기는 위임됐고, 발화는 없다.
    expect(kinds()).toEqual(['trayArm']);
    expect(erased).toHaveLength(1);
    expect(say).not.toHaveBeenCalled();
    document.elementFromPoint = () => null;
    tray.remove();
  });
});

// ── 지우기 도구 (2026-09-03) ────────────────────────────────────────────────────
// 소리 파일이면서 이 절이 여기 있는 이유: 이 하네스가 `onEraseIds` 위임을 이미 기록하고 있어
// (트레이 드롭 절이 쓰던 그 배열) 새 하네스를 세우면 위임 관례가 두 벌이 된다. 재는 것은
// 소리가 아니라 **어느 손짓이 어느 위임을 부르는가** 이고, 그것이 이 파일의 주제다.
describe('지우기 도구 — 클릭만, 연속, 잠긴 것은 남긴다', () => {
  /** 훅에 꽂은 도구와 리듀서의 도구를 맞춘다 — 이유는 useHarness 의 반환값 주석. */
  const armEraser = (result: { current: { dispatch: ReturnType<typeof useEditorDispatch> } }) => {
    act(() => result.current.dispatch({ type: 'TOOL_SET', tool: 'eraser' }));
  };

  it('개체를 찍으면 그 하나가 치우기 함수로 위임되고 **도구는 그대로다**(연속 삭제)', () => {
    const { chairId, drill } = makeDrill();
    const { result, erased } = mount(drill, 'eraser');
    armEraser(result);
    act(() => void result.current.pointer.controller.onPointerDown(CHAIR_AT, META));
    // 트레이 드롭·메뉴·Delete 와 **같은 함수**로 들어간다 — 소리·토스트·되돌리기가 입구마다
    // 갈리지 않게 하는 유일한 방법이다(EditorWorkspace.eraseIds).
    expect(erased).toEqual([chairId]);
    // 연속 삭제의 전부가 이 한 줄이다: 하나 지웠다고 select 로 돌아가지 않는다.
    expect(result.current.state.tool).toBe('eraser');
  });

  it('빈 곳을 찍으면 아무것도 안 지우고 **select 로 빠진다** — 세 출구 중 하나', () => {
    // 나머지 둘은 다른 파일이 잰다: 버튼 재클릭(ToolRail.test) · Esc(EditorStage 의 Escape 분기).
    const { result, erased } = mount(makeDrill().drill, 'eraser');
    armEraser(result);
    expect(result.current.state.tool, '대조군 — 재기 전에 이미 select 면 아무것도 안 재는 단언이다').toBe('eraser');
    act(() => void result.current.pointer.controller.onPointerDown({ x: 600, y: 180 }, META));
    expect(erased).toEqual([]);
    expect(result.current.state.tool).toBe('select');
  });

  it('잠긴 개체는 지우지 않고 **고르기만** 한다 — 잠금의 뜻이 하나로 남는다', () => {
    // 잠금은 "손으로 옮기는 것만 막는다" 이고(2026-08-14 기현 지시), 고르기는 열려 있어야
    // 개체 메뉴로 잠금을 풀 수 있다. 여기서 지워 버리면 잠금에 셋째 뜻이 생긴다.
    const { chairId, drill } = makeDrill();
    const { result, erased } = mount(drill, 'eraser', new Set([chairId]));
    armEraser(result);
    act(() => void result.current.pointer.controller.onPointerDown(CHAIR_AT, META));
    expect(erased).toEqual([]);
    expect([...result.current.state.selection]).toEqual([chairId]);
    // 대조군: 빠져나가지도 않았다 — 잠긴 것을 짚은 것은 '빈 곳' 이 아니다.
    expect(result.current.state.tool).toBe('eraser');
  });
});

describe('첫 사용자 제스처에서 무장한다', () => {
  it('pointerdown 이 arm() 을 부른다 — 놓는 순간에 처음 열면 첫 탁이 삼켜진다', () => {
    const arm = vi.spyOn(cues, 'arm').mockImplementation(() => {});
    const { result } = mount(makeDrill().drill);
    act(() => void result.current.pointer.controller.onPointerDown(CHAIR_AT, META));
    expect(arm).toHaveBeenCalled();
  });
});
