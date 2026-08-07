// §3.7 편집 연산 검증 — 원본 불변, 동일 참조 반환, 팀당 상한, setPose 오버로드, omitKey.
import { describe, expect, it } from 'vitest';
import { newId } from '../core/ids.ts';
import type { ChairId } from '../core/ids.ts';
import { createDrill } from './defaults.ts';
import {
  addBall,
  addChair,
  addCone,
  addStepAfter,
  deleteStep,
  duplicateStep,
  moveStep,
  omitKey,
  placeChair,
  propagateForward,
  removeArrow,
  removeEverywhere,
  removeFromStepOnward,
  removeFromThisStepOnly,
  removeNote,
  setArrow,
  setNote,
  setPose,
  updateChairDef,
} from './edits.ts';
import type { Drill } from './drill.ts';

function freshDrill(): Drill {
  return createDrill({ courtMode: 'full', formation: '1-2-1' });
}

describe('addBall', () => {
  it('stepIndex 이후에만 pose 를 삽입한다', () => {
    let d = freshDrill();
    d = addStepAfter(d, 0); // 이제 스텝 2개
    const before = structuredClone(d);
    const d2 = addBall(d, 1, { x: 10, y: 10 });
    const id = d2.cast.balls[d2.cast.balls.length - 1]!.id;
    expect(d2.steps[0]!.balls[id]).toBeUndefined();
    expect(d2.steps[1]!.balls[id]).toEqual({ x: 10, y: 10 });
    expect(d).toEqual(before); // 원본 불변
  });
});

describe('deleteStep', () => {
  it('마지막 1개는 지우지 않는다(no-op, 동일 참조)', () => {
    const d = freshDrill();
    expect(d.steps).toHaveLength(1);
    expect(deleteStep(d, 0)).toBe(d);
  });

  it('여러 스텝이면 지운다', () => {
    let d = freshDrill();
    d = addStepAfter(d, 0);
    expect(d.steps).toHaveLength(2);
    const d2 = deleteStep(d, 1);
    expect(d2.steps).toHaveLength(1);
  });
});

describe('placeChair', () => {
  it('cast 에 있는 휠체어를 stepIndex..끝 에 배치한다 (하프 코트 홈 GK — D7 실사용례)', () => {
    let d = createDrill({ courtMode: 'half', formation: '1-2-1' });
    d = addStepAfter(d, 0); // 스텝 2개, 둘 다 홈 GK pose 없음(§3.9)
    const gk = d.cast.chairs.find((c) => c.team === 'home' && c.isGk)!;
    expect(d.steps[0]!.chairs[gk.id]).toBeUndefined();
    expect(d.steps[1]!.chairs[gk.id]).toBeUndefined();

    const d1 = placeChair(d, 1, gk.id, { x: 2, y: 2, angleDeg: 0 });
    expect(d1.steps[0]!.chairs[gk.id]).toBeUndefined();
    expect(d1.steps[1]!.chairs[gk.id]).toEqual({ x: 2, y: 2, angleDeg: 0 });
    // 스텝 1은 이미 배치돼 있으므로 다시 배치하면 no-op(동일 참조).
    expect(placeChair(d1, 1, gk.id, { x: 9, y: 9, angleDeg: 0 })).toBe(d1);

    // 아직 배치 안 된 스텝(0)에는 배치된다(그 이후 스텝도 함께 갱신).
    const d2 = placeChair(d1, 0, gk.id, { x: 3, y: 3, angleDeg: 0 });
    expect(d2.steps[0]!.chairs[gk.id]).toEqual({ x: 3, y: 3, angleDeg: 0 });
  });

  it('cast 에 없는 id 는 no-op', () => {
    const d = freshDrill();
    expect(placeChair(d, 0, 'ch_ghost' as ChairId, { x: 0, y: 0, angleDeg: 0 })).toBe(d);
  });
});

describe('addChair — 팀당 4 초과 방지', () => {
  it('이미 4명인 팀에는 추가되지 않는다(원본 그대로 반환)', () => {
    const d = freshDrill(); // home/away 각 4명으로 시작
    const homeCount = d.cast.chairs.filter((c) => c.team === 'home').length;
    expect(homeCount).toBe(4);
    const d2 = addChair(d, 0, { team: 'home', number: '5', isGk: false }, { x: 0, y: 0, angleDeg: 0 });
    expect(d2).toBe(d);
  });
});

describe('updateChairDef', () => {
  it('team 은 패치 타입에서 애초에 제외된다(팀 불변)', () => {
    const d = freshDrill();
    const id = d.cast.chairs[0]!.id;
    const before = d.cast.chairs[0]!.team;
    const d2 = updateChairDef(d, id, { name: '새이름' });
    expect(d2.cast.chairs.find((c) => c.id === id)!.team).toBe(before);
    expect(d2.cast.chairs.find((c) => c.id === id)!.name).toBe('새이름');
  });

  it('존재하지 않는 id 는 동일 참조 반환', () => {
    const d = freshDrill();
    expect(updateChairDef(d, 'ch_ghost' as ChairId, { name: 'x' })).toBe(d);
  });
});

describe('setPose 오버로드', () => {
  it('휠체어 id 에 Vec2({x,y})를 넣으면 타입 에러', () => {
    const d = freshDrill();
    const id = d.cast.chairs[0]!.id;
    // @ts-expect-error angleDeg 없는 Vec2 는 ChairId 오버로드를 만족하지 못한다
    setPose(d, 0, id, { x: 1, y: 1 });
  });

  it('같은 값을 다시 쓰면 동일 참조를 반환한다', () => {
    const d = freshDrill();
    const id = d.cast.chairs[0]!.id;
    const cur = d.steps[0]!.chairs[id]!;
    expect(setPose(d, 0, id, { ...cur })).toBe(d);
  });
});

describe('모든 편집 연산은 원본을 변경하지 않는다', () => {
  it('addCone/setArrow/setNote 후에도 원본이 그대로다', () => {
    const d = freshDrill();
    const snapshot = structuredClone(d);
    const arrowId = newId('ar');
    const noteId = newId('nt');
    let d2 = addCone(d, 0, { x: 5, y: 5 }, 0);
    d2 = setArrow(d2, 0, { id: arrowId, kind: 'move', from: { x: 0, y: 0 }, ctrl: { x: 1, y: 1 }, to: { x: 2, y: 2 } });
    d2 = setNote(d2, 0, { id: noteId, x: 3, y: 3, text: '메모' });
    d2 = removeArrow(d2, 0, arrowId);
    d2 = removeNote(d2, 0, noteId);
    expect(d).toEqual(snapshot);
    expect(d2).not.toBe(d);
  });
});

describe('omitKey', () => {
  it('결과에 키가 없다', () => {
    const m = { ch_a: { x: 1, y: 1, angleDeg: 0 } };
    const result = omitKey(m, 'ch_a');
    expect('ch_a' in result).toBe(false);
  });

  it('키가 없으면 동일 참조 반환', () => {
    const m: Record<string, { x: number; y: number; angleDeg: number }> = { ch_a: { x: 1, y: 1, angleDeg: 0 } };
    expect(omitKey(m, 'ch_b')).toBe(m);
  });
});

describe('removeFromStepOnward / removeFromThisStepOnly / removeEverywhere / propagateForward', () => {
  it('removeFromStepOnward 는 이 스텝부터 끝까지 제거한다', () => {
    let d = freshDrill();
    d = addStepAfter(d, 0);
    const id = d.cast.chairs[0]!.id;
    const d2 = removeFromStepOnward(d, 1, id);
    expect(d2.steps[0]!.chairs[id]).toBeDefined();
    expect(d2.steps[1]!.chairs[id]).toBeUndefined();
  });

  it('removeFromThisStepOnly 는 그 스텝만 제거한다', () => {
    let d = freshDrill();
    d = addStepAfter(d, 0);
    const id = d.cast.chairs[0]!.id;
    const d2 = removeFromThisStepOnly(d, 0, id);
    expect(d2.steps[0]!.chairs[id]).toBeUndefined();
    expect(d2.steps[1]!.chairs[id]).toBeDefined();
  });

  it('removeEverywhere 는 cast 와 전 스텝에서 지운다', () => {
    let d = freshDrill();
    d = addStepAfter(d, 0);
    const id = d.cast.chairs[0]!.id;
    const d2 = removeEverywhere(d, id);
    expect(d2.cast.chairs.some((c) => c.id === id)).toBe(false);
    expect(d2.steps[0]!.chairs[id]).toBeUndefined();
    expect(d2.steps[1]!.chairs[id]).toBeUndefined();
  });

  it('propagateForward 는 이후 스텝에 현재 pose 를 고정 전파한다', () => {
    let d = freshDrill();
    d = addStepAfter(d, 0);
    const id = d.cast.chairs[0]!.id;
    const pose = { x: 111, y: 222, angleDeg: 33 };
    d = setPose(d, 0, id, pose);
    const d2 = propagateForward(d, 0, id);
    expect(d2.steps[1]!.chairs[id]).toEqual(pose);
  });
});

describe('duplicateStep vs addStepAfter — 화살표/메모 id 보존(D6 크로스페이드)', () => {
  it('두 연산 모두 arrows/notes 의 id 를 그대로 유지한다', () => {
    let d = freshDrill();
    const arrowId = newId('ar');
    d = setArrow(d, 0, { id: arrowId, kind: 'move', from: { x: 0, y: 0 }, ctrl: { x: 1, y: 1 }, to: { x: 2, y: 2 } });

    const viaAdd = addStepAfter(d, 0);
    expect(viaAdd.steps[1]!.arrows[0]!.id).toBe(arrowId);
    expect(viaAdd.steps[1]!.id).not.toBe(viaAdd.steps[0]!.id);
    expect(viaAdd.steps[1]!.name).toBe('스텝 2');

    const viaDup = duplicateStep(d, 0);
    expect(viaDup.steps[1]!.arrows[0]!.id).toBe(arrowId);
    expect(viaDup.steps[1]!.id).not.toBe(viaDup.steps[0]!.id);
    expect(viaDup.steps[1]!.name).toBe(viaDup.steps[0]!.name);
  });
});

describe('moveStep', () => {
  it('범위를 벗어나거나 from===to 면 동일 참조', () => {
    let d = freshDrill();
    d = addStepAfter(d, 0);
    expect(moveStep(d, 0, 0)).toBe(d);
    expect(moveStep(d, 0, 5)).toBe(d);
  });

  it('정상 이동', () => {
    let d = freshDrill();
    d = addStepAfter(d, 0);
    d = addStepAfter(d, 1);
    const ids = d.steps.map((s) => s.id);
    const moved = moveStep(d, 0, 2);
    expect(moved.steps.map((s) => s.id)).toEqual([ids[1], ids[2], ids[0]]);
  });
});
