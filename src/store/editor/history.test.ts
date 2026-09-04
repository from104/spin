// §10.7 store — undo/redo 경계, coalesce, epoch, PLACE_BEGIN/PLACE_COMMIT.
import { describe, expect, it } from 'vitest';
import { newId } from '../../core/ids.ts';
import { createDrill } from '../../model/defaults.ts';
import type { Drill } from '../../model/drill.ts';
import { editorRootReducer, initEditorState } from './reducer.ts';
import type { EditorState } from './reducer.ts';
import { HISTORY_LIMIT } from './history.ts';

function freshState(): EditorState {
  const d: Drill = createDrill({ courtMode: 'full', formation: '1-2-1' });
  return initEditorState(d);
}

function firstChairId(s: EditorState): string {
  return s.present.cast.chairs[0]!.id;
}

describe('OBJECT_NUDGE — coalesce', () => {
  it('30회 연속 → past 증가분 1', () => {
    let s = freshState();
    const id = firstChairId(s) as never;
    for (let i = 0; i < 30; i++) {
      s = editorRootReducer(s, { type: 'OBJECT_NUDGE', id, d: { x: 1, y: 0 }, dTheta: 0 });
    }
    expect(s.past).toHaveLength(1);
  });

  it('COMMIT_BREAK 후 30회 → 증가분 1 (총 past.length === 2)', () => {
    let s = freshState();
    const id = firstChairId(s) as never;
    for (let i = 0; i < 30; i++) {
      s = editorRootReducer(s, { type: 'OBJECT_NUDGE', id, d: { x: 1, y: 0 }, dTheta: 0 });
    }
    expect(s.past).toHaveLength(1);
    s = editorRootReducer(s, { type: 'COMMIT_BREAK' });
    for (let i = 0; i < 30; i++) {
      s = editorRootReducer(s, { type: 'OBJECT_NUDGE', id, d: { x: 1, y: 0 }, dTheta: 0 });
    }
    expect(s.past).toHaveLength(2);
  });

  it('30회 이동 후 undo 1회로 원위치로 복원된다', () => {
    let s = freshState();
    const id = firstChairId(s) as never;
    const before = s.present.steps[0]!.chairs[id as never];
    for (let i = 0; i < 30; i++) {
      s = editorRootReducer(s, { type: 'OBJECT_NUDGE', id, d: { x: 1, y: 0 }, dTheta: 0 });
    }
    const undone = editorRootReducer(s, { type: 'UNDO' });
    expect(undone.present.steps[0]!.chairs[id as never]).toEqual(before);
    expect(undone.future).toHaveLength(1);
  });
});

describe('PLACE_BEGIN + PLACE_COMMIT', () => {
  it('한 쌍 = undo 1회', () => {
    let s = freshState();
    const id = firstChairId(s) as never;
    const step0 = s.present.steps[0]!;
    const before = step0.chairs[id as never]!;
    s = editorRootReducer(s, { type: 'PLACE_BEGIN' });
    expect(s.past).toHaveLength(1);
    const movedChairs = { ...step0.chairs, [id]: { x: before.x + 50, y: before.y, angleDeg: before.angleDeg } };
    const s2 = editorRootReducer(s, {
      type: 'PLACE_COMMIT',
      stepId: step0.id,
      chairs: movedChairs as never,
      balls: step0.balls,
      cones: step0.cones,
    });
    expect(s2.past).toHaveLength(1); // PLACE_COMMIT 은 past 를 건드리지 않는다
    expect(s2.present.steps[0]!.chairs[id as never]).toEqual({ x: before.x + 50, y: before.y, angleDeg: before.angleDeg });

    const undone = editorRootReducer(s2, { type: 'UNDO' });
    expect(undone.past).toHaveLength(0);
    expect(undone.present.steps[0]!.chairs[id as never]).toEqual(before); // 드래그 1회 = undo 1회로 원복
  });
});

// §4.2 P0-2 — 정착 후 재커밋. 손을 뗀 뒤 물리가 계속 굴러가 최종 좌표가 달라지므로 커밋이
// 한 번 더 필요한데, 그것이 두 번째 undo 단계가 되면 사용자는 되돌리기를 두 번 눌러야 한다.
describe('PLACE_SETTLE — 경계를 다시 열지 않는 재커밋', () => {
  function moved(s: EditorState, id: string, dx: number) {
    const step0 = s.present.steps[0]!;
    const before = step0.chairs[id as never]!;
    return { ...step0.chairs, [id]: { x: before.x + dx, y: before.y, angleDeg: before.angleDeg } };
  }

  it('PLACE_BEGIN → PLACE_COMMIT → PLACE_SETTLE 은 그래도 undo 1회다', () => {
    let s = freshState();
    const id = firstChairId(s);
    const step0 = s.present.steps[0]!;
    const before = step0.chairs[id as never]!;

    s = editorRootReducer(s, { type: 'PLACE_BEGIN' });
    s = editorRootReducer(s, { type: 'PLACE_COMMIT', stepId: step0.id, chairs: moved(s, id, 10) as never, balls: step0.balls, cones: step0.cones });
    s = editorRootReducer(s, { type: 'PLACE_SETTLE', stepId: step0.id, chairs: moved(s, id, 140) as never, balls: step0.balls, cones: step0.cones });

    expect(s.past).toHaveLength(1); // 재커밋이 경계를 열면 2가 된다
    expect(s.present.steps[0]!.chairs[id as never]!.x).toBe(before.x + 150);

    const undone = editorRootReducer(s, { type: 'UNDO' });
    expect(undone.present.steps[0]!.chairs[id as never]).toEqual(before);
    expect(undone.past).toHaveLength(0);
  });

  it('[A-4] epoch 을 올리지 않는다 — 올리면 world.load → 재정착 → 무한 루프다', () => {
    let s = freshState();
    const id = firstChairId(s);
    const step0 = s.present.steps[0]!;
    const e0 = s.epoch;
    s = editorRootReducer(s, { type: 'PLACE_SETTLE', stepId: step0.id, chairs: moved(s, id, 40) as never, balls: step0.balls, cones: step0.cones });
    expect(s.epoch).toBe(e0);
  });

  it('좌표가 그대로여도 자동저장 억제 창(settleHoldUntil)은 닫는다 (A-5)', () => {
    // 통지가 왔는데 창이 안 닫히면 저장이 마감(체이스+정착 상한)까지 밀린다.
    let s = freshState();
    const step0 = s.present.steps[0]!;
    s = editorRootReducer(s, { type: 'SETTLE_ARM', until: 1_700_000_000_000 });
    expect(s.settleHoldUntil).toBe(1_700_000_000_000);

    const same = editorRootReducer(s, { type: 'PLACE_SETTLE', stepId: step0.id, chairs: step0.chairs, balls: step0.balls, cones: step0.cones });
    expect(same.settleHoldUntil).toBe(0);
    expect(same.present).toBe(s.present); // 드릴은 손대지 않는다(무변화 no-op 가드)
    expect(same.past).toHaveLength(0);
  });
});

describe('epoch — 구조 변경·시점 점프에만 증가', () => {
  it('META_SET/STEP_META/PLACE_COMMIT/OBJECT_NUDGE 는 epoch 를 증가시키지 않는다', () => {
    let s = freshState();
    const e0 = s.epoch;
    s = editorRootReducer(s, { type: 'META_SET', patch: { title: 'x' } });
    expect(s.epoch).toBe(e0);
    s = editorRootReducer(s, { type: 'STEP_META', id: s.stepId, patch: { name: 'y' } });
    expect(s.epoch).toBe(e0);
    const id = firstChairId(s) as never;
    s = editorRootReducer(s, { type: 'OBJECT_NUDGE', id, d: { x: 1, y: 1 }, dTheta: 0 });
    expect(s.epoch).toBe(e0);
    const step0 = s.present.steps[0]!;
    s = editorRootReducer(s, { type: 'PLACE_COMMIT', stepId: step0.id, chairs: { ...step0.chairs } as never, balls: step0.balls, cones: step0.cones });
    expect(s.epoch).toBe(e0);
  });

  it('UNDO/REDO/DRILL_LOAD/STEP_DUPLICATE/OBJECT_ADD/CHAIR_PLACE 는 epoch 를 증가시킨다', () => {
    let s = freshState();
    const e0 = s.epoch;
    s = editorRootReducer(s, { type: 'OBJECT_ADD', kind: 'ball', at: { x: 5, y: 5 }, id: newId('bl') });
    expect(s.epoch).toBe(e0 + 1);
    s = editorRootReducer(s, { type: 'STEP_DUPLICATE', id: s.present.steps[0]!.id });
    expect(s.epoch).toBe(e0 + 2);
    const undone = editorRootReducer(s, { type: 'UNDO' });
    expect(undone.epoch).toBe(e0 + 3);
    const redone = editorRootReducer(undone, { type: 'REDO' });
    expect(redone.epoch).toBe(e0 + 4);
  });
});

describe('HISTORY_LIMIT — past 는 50개를 넘지 않는다', () => {
  it('COMMIT_BREAK 로 매번 새 항목을 만들며 50회 초과해도 길이가 50에 고정된다', () => {
    let s = freshState();
    for (let i = 0; i < HISTORY_LIMIT + 10; i++) {
      s = editorRootReducer(s, { type: 'COMMIT_BREAK' }); // lastCommit 리셋으로 매번 새 push 유도
      s = editorRootReducer(s, { type: 'META_SET', patch: { durationMin: 10 + i } });
    }
    expect(s.past.length).toBeLessThanOrEqual(HISTORY_LIMIT);
  });
});

describe('UNDO/REDO 경계', () => {
  it('past 가 비어 있으면 UNDO 는 no-op(동일 참조)', () => {
    const s0 = freshState();
    expect(editorRootReducer(s0, { type: 'UNDO' })).toBe(s0);
  });
  it('future 가 비어 있으면 REDO 는 no-op(동일 참조)', () => {
    const s0 = freshState();
    expect(editorRootReducer(s0, { type: 'REDO' })).toBe(s0);
  });
  it('새 커밋은 future 를 비운다', () => {
    let s = freshState();
    s = editorRootReducer(s, { type: 'META_SET', patch: { title: 'a' } });
    const undone = editorRootReducer(s, { type: 'UNDO' });
    expect(undone.future).toHaveLength(1);
    const next = editorRootReducer(undone, { type: 'META_SET', patch: { title: 'b' } });
    expect(next.future).toHaveLength(0);
  });
});
