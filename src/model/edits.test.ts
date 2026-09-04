// §3.7 편집 연산 검증 — 원본 불변, 동일 참조 반환, 팀당 상한, setPose 오버로드, omitKey.
import { describe, expect, it } from 'vitest';
import { newId } from '../core/ids.ts';
import type { ChairId } from '../core/ids.ts';
import { createDrill } from './defaults.ts';
import {
  addBall,
  addChair,
  addCone,
  deleteStep,
  duplicateStep,
  moveStep,
  omitKey,
  placeChair,
  removeArrow,
  removeFromStepOnward,
  removeFromThisStepOnly,
  removeNote,
  setArrow,
  setNote,
  setPose,
  setShape,
  setStepFlag,
  updateChairDef,
} from './edits.ts';
import type { Drill } from './drill.ts';
import type { Shape } from './shape.ts';
import type { ShapeId } from '../core/ids.ts';

function freshDrill(): Drill {
  return createDrill({ courtMode: 'full', formation: '1-2-1' });
}

describe('addBall', () => {
  it('stepIndex 이후에만 pose 를 삽입한다', () => {
    let d = freshDrill();
    d = duplicateStep(d, 0); // 이제 스텝 2개
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
    d = duplicateStep(d, 0);
    expect(d.steps).toHaveLength(2);
    const d2 = deleteStep(d, 1);
    expect(d2.steps).toHaveLength(1);
  });
});

describe('placeChair', () => {
  it('cast 에 있는 휠체어를 stepIndex..끝 에 배치한다 (하프 코트 홈 GK — D7 실사용례)', () => {
    let d = createDrill({ courtMode: 'half', formation: '1-2-1' });
    d = duplicateStep(d, 0); // 스텝 2개, 둘 다 홈 GK pose 없음(§3.9)
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
    d2 = setArrow(d2, 0, { id: arrowId, from: { x: 0, y: 0 }, ctrl: { x: 1, y: 1 }, to: { x: 2, y: 2 } });
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

describe('removeFromStepOnward / removeFromThisStepOnly', () => {
  it('removeFromStepOnward 는 이 스텝부터 끝까지 제거한다', () => {
    let d = freshDrill();
    d = duplicateStep(d, 0);
    const id = d.cast.chairs[0]!.id;
    const d2 = removeFromStepOnward(d, 1, id);
    expect(d2.steps[0]!.chairs[id]).toBeDefined();
    expect(d2.steps[1]!.chairs[id]).toBeUndefined();
  });

  it('removeFromThisStepOnly 는 그 스텝만 제거한다', () => {
    let d = freshDrill();
    d = duplicateStep(d, 0);
    const id = d.cast.chairs[0]!.id;
    const d2 = removeFromThisStepOnly(d, 0, id);
    expect(d2.steps[0]!.chairs[id]).toBeUndefined();
    expect(d2.steps[1]!.chairs[id]).toBeDefined();
  });
});

describe('duplicateStep — 화살표/메모 id 보존(D6 크로스페이드)', () => {
  it('arrows/notes 의 id 를 그대로 유지한다', () => {
    let d = freshDrill();
    const arrowId = newId('ar');
    d = setArrow(d, 0, { id: arrowId, from: { x: 0, y: 0 }, ctrl: { x: 1, y: 1 }, to: { x: 2, y: 2 } });

    const viaDup = duplicateStep(d, 0);
    expect(viaDup.steps[1]!.arrows[0]!.id).toBe(arrowId);
    expect(viaDup.steps[1]!.id).not.toBe(viaDup.steps[0]!.id);
    expect(viaDup.steps[1]!.name).toBe(viaDup.steps[0]!.name);
  });
});

describe('moveStep', () => {
  it('범위를 벗어나거나 from===to 면 동일 참조', () => {
    let d = freshDrill();
    d = duplicateStep(d, 0);
    expect(moveStep(d, 0, 0)).toBe(d);
    expect(moveStep(d, 0, 5)).toBe(d);
  });

  it('정상 이동', () => {
    let d = freshDrill();
    d = duplicateStep(d, 0);
    d = duplicateStep(d, 1);
    const ids = d.steps.map((s) => s.id);
    const moved = moveStep(d, 0, 2);
    expect(moved.steps.map((s) => s.id)).toEqual([ids[1], ids[2], ids[0]]);
  });
});

// 2026-08-10 공개판 제보(서권일): "공 10개 다 넣고 지우개로 지우면 공 배치가 안 됩니다".
// 삭제가 스텝의 pose 만 지우고 cast 는 그대로 두어, 보이지 않는 개체가 상한을 계속 차지했다.
// 배치 상한은 `cast.balls.length` 를 세므로(useEditorPointer 의 ballMax) 10/10 에서 굳는다.
describe('유령 cast 정리 — 어디에도 없는 개체는 명단에서 사라진다', () => {
  it('지우개로 마지막 pose 를 지우면 cast 에서도 빠진다 → 다시 놓을 수 있다', () => {
    let d = freshDrill();
    // 기본 드릴에 공 1개가 이미 있다. 상한(10)까지 채운다.
    while (d.cast.balls.length < 10) d = addBall(d, 0, { x: 100, y: 100 });
    expect(d.cast.balls).toHaveLength(10);

    for (const b of [...d.cast.balls]) d = removeFromStepOnward(d, 0, b.id);

    expect(d.cast.balls, '지운 공이 유령으로 남아 상한을 계속 차지한다').toHaveLength(0);
    // 상한이 풀렸는지 = 실제 증상의 해소
    d = addBall(d, 0, { x: 200, y: 200 });
    expect(d.cast.balls).toHaveLength(1);
  });

  it('다른 스텝에 pose 가 남아 있으면 cast 에 남는다', () => {
    let d = freshDrill();
    d = duplicateStep(d, 0);
    d = addBall(d, 0, { x: 50, y: 50 });
    const id = d.cast.balls[d.cast.balls.length - 1]!.id;

    d = removeFromThisStepOnly(d, 0, id);

    expect(d.steps[0]!.balls[id]).toBeUndefined();
    expect(d.steps[1]!.balls[id], '이 스텝만 삭제인데 뒤 스텝까지 지워졌다').toBeDefined();
    expect(d.cast.balls.some((b) => b.id === id), '아직 쓰이는 공을 명단에서 버렸다').toBe(true);
  });

  it('콘도 같이 정리된다 (상한이 없어 증상만 안 보일 뿐 같은 결함)', () => {
    let d = freshDrill();
    d = addCone(d, 0, { x: 60, y: 60 }, 0);
    const id = d.cast.cones[0]!.id;
    d = removeFromStepOnward(d, 0, id);
    expect(d.cast.cones).toHaveLength(0);
  });

  it('스텝 삭제로 유일한 pose 가 사라져도 유령이 남지 않는다', () => {
    let d = freshDrill();
    d = duplicateStep(d, 0);
    // 스텝 1 에만 공을 놓는다(addBall 은 i 이후에만 채운다).
    d = addBall(d, 1, { x: 70, y: 70 });
    const id = d.cast.balls[d.cast.balls.length - 1]!.id;
    expect(d.steps[0]!.balls[id]).toBeUndefined();

    d = deleteStep(d, 1);

    expect(d.cast.balls.some((b) => b.id === id), '스텝 삭제가 유령 공을 남겼다').toBe(false);
  });

  it('휠체어는 pose 가 없어도 명단에 남는다 — 미배치 선수는 의도된 상태다', () => {
    let d = freshDrill();
    const id = d.cast.chairs[0]!.id;
    const before = d.cast.chairs.length;

    d = removeFromStepOnward(d, 0, id);

    expect(d.steps[0]!.chairs[id]).toBeUndefined();
    expect(d.cast.chairs, '코트에서 뺀 선수가 명단에서 사라졌다').toHaveLength(before);
  });
});

// ── 상태 플래그는 개체와 **함께 사라진다** (기현 지시 2026-08-15) ──────────────────────────
//
// *"칩이 트레이에 들어가면 잠긴 상태, 무시 상태가 꺼져야 한다."*
// 트레이 반환은 `OBJECT_REMOVE(scope:'onward')` 이므로 아래 첫 단언이 그 경로다.
//
// ⚠️ 안 지우면 플래그가 **id 로 살아남는다**: 잠긴 칩을 뺐다 다시 놓으면 잠긴 채로 나오고,
// 무시된 칩은 코트 밖이라 메뉴조차 못 열어 되돌릴 문이 없다.
describe('제거하면 잠김·무시 플래그도 함께 지워진다', () => {
  const lockedIgnored = (d: Drill, i: number, id: string) => ({
    locked: d.steps[i]!.locked?.includes(id) ?? false,
    ignored: (d.steps[i]!.ignored as readonly string[] | undefined)?.includes(id) ?? false,
  });

  it('★ 트레이 반환(removeFromStepOnward)이 두 플래그를 다 끈다', () => {
    let d = freshDrill();
    const id = d.cast.chairs[0]!.id;
    d = setStepFlag(d, 0, 'locked', id, true);
    d = setStepFlag(d, 0, 'ignored', id, true);
    expect(lockedIgnored(d, 0, id), '대조군: 켜지지도 않았다').toEqual({ locked: true, ignored: true });

    const after = removeFromStepOnward(d, 0, id);
    expect(lockedIgnored(after, 0, id), '칩은 나갔는데 플래그가 남았다 — 다시 놓으면 잠긴 채로 나온다').toEqual({
      locked: false,
      ignored: false,
    });
  });

  it('빈 목록이면 **키 자체가 없다** — setStepFlag 와 같은 규칙이라야 저장본 표현이 하나다', () => {
    let d = freshDrill();
    const id = d.cast.chairs[0]!.id;
    d = setStepFlag(d, 0, 'locked', id, true);
    const after = removeFromStepOnward(d, 0, id);
    expect(after.steps[0]!.locked, '빈 배열이 저장본에 눌러앉는다').toBeUndefined();
  });

  it('다른 개체의 플래그는 **안 건드린다**', () => {
    let d = freshDrill();
    const a = d.cast.chairs[0]!.id;
    const b = d.cast.chairs[1]!.id;
    d = setStepFlag(d, 0, 'locked', a, true);
    d = setStepFlag(d, 0, 'locked', b, true);
    const after = removeFromStepOnward(d, 0, a);
    expect(after.steps[0]!.locked, '남의 잠금까지 풀렸다').toEqual([b]);
  });

  it('스텝마다 따로다 — 0번에서 빼도 1번 스텝의 플래그는 그 스텝의 것이다', () => {
    let d = duplicateStep(freshDrill(), 0);
    const id = d.cast.chairs[0]!.id;
    d = setStepFlag(d, 1, 'locked', id, true);
    // 0번만 제거하면(this step only) 1번 스텝은 손대지 않는다.
    const after = removeFromThisStepOnly(d, 0, id);
    expect(after.steps[1]!.locked, '엉뚱한 스텝의 잠금이 풀렸다').toEqual([id]);
  });

  it('메뉴의 [삭제]도 이후 스텝의 플래그를 지운다', () => {
    // ⚠️ 2026-08-16 정정 — 이 테스트는 `removeEverywhere` 를 부르며 "메뉴의 [삭제]" 라고
    // 적고 있었지만, 메뉴는 그 함수를 **한 번도 부른 적이 없다**(ObjectMenu → onEraseIds →
    // scope 'onward'). 지우개 도구를 걷어내며 확인해 보니 `removeEverywhere` 는 어디서도
    // 디스패치되지 않는 죽은 가지였고, 함께 제거했다. 이제 실제 경로로 잰다.
    let d = duplicateStep(freshDrill(), 0);
    const id = d.cast.chairs[0]!.id;
    d = setStepFlag(d, 0, 'locked', id, true);
    d = setStepFlag(d, 1, 'ignored', id, true);
    const after = removeFromStepOnward(d, 0, id);
    expect(after.steps[0]!.locked).toBeUndefined();
    expect(after.steps[1]!.ignored).toBeUndefined();
  });
});

describe('setShape — 무변경 판정', () => {
  it('★ 경계상자가 그대로인 꼭짓점 이동도 **변경으로 잡힌다**', () => {
    // 한 꼭짓점을 밑변을 따라 미끄러뜨리면 x/y·회전·경계상자가 전부 그대로다. `pts` 를 안 보면
    // 이 편집이 "변한 것 없음" 으로 통째로 버려져, 화면에서는 손잡이만 따라오고 도형은 안 바뀐다.
    const base: Shape = {
      id: 'sh_1' as ShapeId,
      kind: 'triangle',
      x: 400,
      y: 260,
      w: 200,
      h: 60,
      rot: 0,
      pts: [
        { x: -100, y: 20 },
        { x: 100, y: 20 },
        { x: 0, y: -40 },
      ],
    };
    let d = setShape(freshDrill(), 0, base);
    expect(d.steps[0]!.shapes).toHaveLength(1);
    const slid: Shape = { ...base, pts: [{ x: -100, y: 20 }, { x: 100, y: 20 }, { x: 60, y: -40 }] };
    // 대조군 — 이 편집은 w/h/x/y/rot 을 한 글자도 안 바꾼다.
    expect({ w: slid.w, h: slid.h, x: slid.x, y: slid.y, rot: slid.rot }).toEqual({ w: base.w, h: base.h, x: base.x, y: base.y, rot: base.rot });
    const after = setShape(d, 0, slid);
    expect(after, '꼭짓점만 바뀐 편집이 버려졌다').not.toBe(d);
    expect(after.steps[0]!.shapes[0]!.pts![2]).toEqual({ x: 60, y: -40 });
  });

  it('정말 같은 도형은 같은 참조를 돌려준다 — 무변경 판정 자체는 살아 있다', () => {
    const base: Shape = { id: 'sh_1' as ShapeId, kind: 'rect', x: 400, y: 260, w: 200, h: 60, rot: 0 };
    const d = setShape(freshDrill(), 0, base);
    expect(setShape(d, 0, { ...base })).toBe(d);
  });
});
