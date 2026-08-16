// §6.10b 통째로 옮기기 — `GROUP_NUDGE`.
//
// 포인터의 덩어리 드래그와 키보드의 무리 이동이 **같은 액션 하나**로 모인다. 그래서 여기가
// 초록이면 두 입력이 같은 결과를 낸다는 뜻이고, 갈라진 규칙이 생길 자리가 없다.
//
// jsdom 에는 레이아웃이 없어 코트 좌표가 전부 0 이다 — 그래서 "끌었더니 함께 갔다" 는 마운트
// 테스트로 재지 않고, **델타가 종류를 가리지 않고 먹는가**를 리듀서에서 잰다.
import { describe, expect, it } from 'vitest';
import { createDrill } from '../../model/defaults.ts';
import type { Drill } from '../../model/drill.ts';
import { newId } from '../../core/ids.ts';
import type { ArrowId, BallId, ChairId, NoteId, ShapeId } from '../../core/ids.ts';
import { editorRootReducer, initEditorState } from './reducer.ts';
import type { EditorState } from './reducer.ts';

const AR = 'ar_g1' as ArrowId;
const NT = 'nt_g1' as NoteId;
const SH = 'sh_g1' as ShapeId;

/** 휠체어·공·메모·화살표·도형이 한 스텝에 다 있는 판. 섞인 무리를 재는 것이 이 액션의 요지다. */
function loaded(): { s: EditorState; chairId: ChairId } {
  const d: Drill = createDrill({ courtMode: 'full', formation: '1-2-1' });
  let s = initEditorState(d);
  const chairId = Object.keys(s.present.steps[0]!.chairs)[0]! as ChairId;
  s = editorRootReducer(s, { type: 'OBJECT_ADD', kind: 'ball', at: { x: 100, y: 100 }, id: newId('bl') });
  s = editorRootReducer(s, { type: 'NOTE_SET', note: { id: NT, x: 200, y: 200, text: '메모' } });
  s = editorRootReducer(s, { type: 'ARROW_SET', arrow: { id: AR, from: { x: 10, y: 10 }, ctrl: { x: 20, y: 20 }, to: { x: 30, y: 30 } } });
  s = editorRootReducer(s, { type: 'SHAPE_SET', shape: { id: SH, kind: 'rect', x: 300, y: 300, w: 40, h: 20, rot: 0 } });
  return { s, chairId };
}

const step = (s: EditorState) => s.present.steps[0]!;
const D = { x: 5, y: -3 };

describe('GROUP_NUDGE — 종류를 가리지 않는다', () => {
  it('휠체어·공·메모·화살표·도형이 **같은 델타**로 함께 간다', () => {
    const { s, chairId } = loaded();
    const before = step(s);
    const ballId = Object.keys(before.balls)[0]! as BallId;
    const ids = [chairId, ballId, NT, AR, SH];

    const after = step(editorRootReducer(s, { type: 'GROUP_NUDGE', ids, d: D }));

    expect(after.chairs[chairId]!.x - before.chairs[chairId]!.x).toBeCloseTo(D.x);
    expect(after.chairs[chairId]!.y - before.chairs[chairId]!.y).toBeCloseTo(D.y);
    expect(after.balls[ballId]!.x - before.balls[ballId]!.x).toBeCloseTo(D.x);
    const n0 = before.notes.find((n) => n.id === NT)!;
    const n1 = after.notes.find((n) => n.id === NT)!;
    expect([n1.x - n0.x, n1.y - n0.y]).toEqual([D.x, D.y]);
    const a1 = after.arrows.find((a) => a.id === AR)!;
    // 세 점이 **함께** 간다 — 모양이 안 변한다는 뜻이다(몸통 드래그·키보드와 같은 함수).
    expect(a1.from).toEqual({ x: 15, y: 7 });
    expect(a1.ctrl).toEqual({ x: 25, y: 17 });
    expect(a1.to).toEqual({ x: 35, y: 27 });
    const sh1 = after.shapes.find((x) => x.id === SH)!;
    expect([sh1.x, sh1.y]).toEqual([305, 297]);
  });

  it('휠체어의 **각도는 안 건드린다** — 무리에는 회전이 없다', () => {
    const { s, chairId } = loaded();
    const before = step(s).chairs[chairId]!.angleDeg;
    const after = step(editorRootReducer(s, { type: 'GROUP_NUDGE', ids: [chairId], d: D }));
    expect(after.chairs[chairId]!.angleDeg).toBe(before);
  });

  it('판에 없는 id 는 조용히 지나간다 — 사라진 개체가 남은 선택을 깨지 않는다', () => {
    const { s, chairId } = loaded();
    const out = editorRootReducer(s, { type: 'GROUP_NUDGE', ids: [chairId, 'bl_ghost', 'nt_ghost'], d: D });
    expect(step(out).chairs[chairId]!.x - step(s).chairs[chairId]!.x).toBeCloseTo(D.x);
  });

  // ★ 이 액션이 따로 있는 가장 큰 이유. OBJECT_NUDGE 를 개수만큼 보내면 여기가 깨진다.
  it('한 번 끈 것은 되돌리기 **한 칸**이다 — 개체 수만큼 쌓이지 않는다', () => {
    const { s, chairId } = loaded();
    const ballId = Object.keys(step(s).balls)[0]! as BallId;
    const ids = [chairId, ballId, NT];
    const x0 = step(s).chairs[chairId]!.x;

    // 한 번의 드래그 = 매 프레임 GROUP_NUDGE. 병합(COALESCE_TYPES)이 한 칸으로 접는다.
    let out = s;
    for (let i = 0; i < 6; i++) out = editorRootReducer(out, { type: 'GROUP_NUDGE', ids, d: { x: 1, y: 0 } });
    expect(step(out).chairs[chairId]!.x - x0).toBeCloseTo(6);

    const undone = editorRootReducer(out, { type: 'UNDO' });
    expect(step(undone).chairs[chairId]!.x, 'Ctrl+Z 한 번이면 통째로 돌아온다').toBeCloseTo(x0);
  });

  it('무리의 **구성**이 바뀌면 병합하지 않는다 — 넷을 끌다 셋을 끌면 두 칸이다', () => {
    const { s, chairId } = loaded();
    const ballId = Object.keys(step(s).balls)[0]! as BallId;
    const x0 = step(s).chairs[chairId]!.x;

    let out = editorRootReducer(s, { type: 'GROUP_NUDGE', ids: [chairId, ballId], d: { x: 4, y: 0 } });
    out = editorRootReducer(out, { type: 'GROUP_NUDGE', ids: [chairId], d: { x: 4, y: 0 } });
    expect(step(out).chairs[chairId]!.x - x0).toBeCloseTo(8);

    const undone = editorRootReducer(out, { type: 'UNDO' });
    expect(step(undone).chairs[chairId]!.x - x0, '뒤 무리만 물린다').toBeCloseTo(4);
  });

  it('순서만 다른 같은 무리는 **한 칸**이다 — Set 순회 순서가 되돌리기를 가르면 안 된다', () => {
    const { s, chairId } = loaded();
    const ballId = Object.keys(step(s).balls)[0]! as BallId;
    const x0 = step(s).chairs[chairId]!.x;

    let out = editorRootReducer(s, { type: 'GROUP_NUDGE', ids: [chairId, ballId], d: { x: 4, y: 0 } });
    out = editorRootReducer(out, { type: 'GROUP_NUDGE', ids: [ballId, chairId], d: { x: 4, y: 0 } });

    const undone = editorRootReducer(out, { type: 'UNDO' });
    expect(step(undone).chairs[chairId]!.x).toBeCloseTo(x0);
  });
});
