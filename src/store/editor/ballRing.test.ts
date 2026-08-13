// §7 5.2 — 재탭 순환의 **리듀서 계약**(2026-08-13 기현님 실기 피드백 ③).
//
// 한 번의 `BALL_RETAP` 이 두 리듀서에서 갈라진다: drillReducer 는 원을 한 칸 돌리고,
// uiReducer 는 **5 m 였을 때만** 선택을 푼다. 그래서 순환의 네 칸이 여기서 전부 관측된다:
//   탭① 선택(원 없음) → 탭② 3 m → 탭③ 5 m → 탭④ 원 없음 + 선택 해제.
// 포인터에서 여기까지의 배선은 features/editor/useEditorPointer.tapDeselect.test.tsx 가 잰다.
import { describe, expect, it } from 'vitest';
import { createDrill } from '../../model/defaults.ts';
import { addBall } from '../../model/edits.ts';
import { ballRingOf, type BallRing, type Drill } from '../../model/drill.ts';
import type { BallId } from '../../core/ids.ts';
import { COMMIT_TYPES, COALESCE_TYPES, EPOCH_BUMP_TYPES } from './actions.ts';
import { editorRootReducer, initEditorState } from './reducer.ts';
import type { EditorState } from './reducer.ts';

/** 공 두 개짜리 판. 하나짜리면 전역 상태 구현으로도 전부 통과한다. */
function setup(): { s0: EditorState; a: BallId; b: BallId } {
  const base: Drill = createDrill({ courtMode: 'full', formation: '1-2-1' });
  const two = addBall(base, 0, { x: 500, y: 300 });
  const [a, b] = two.cast.balls.map((x) => x.id);
  const s0 = initEditorState(two);
  return { s0: { ...s0, selection: new Set([a!]) }, a: a!, b: b! };
}

const rings = (s: EditorState): BallRing[] => s.present.cast.balls.map(ballRingOf);
const retap = (s: EditorState, id: BallId): EditorState => editorRootReducer(s, { type: 'BALL_RETAP', id });

describe('5.2 BALL_RETAP — 순환 네 칸', () => {
  it('없음 → 3 m → 5 m 까지는 선택이 유지된다', () => {
    const { s0, a } = setup();
    const s1 = retap(s0, a);
    expect(rings(s1)).toEqual(['3m', 'none']);
    expect(s1.selection.has(a)).toBe(true);
    const s2 = retap(s1, a);
    expect(rings(s2)).toEqual(['5m', 'none']);
    expect(s2.selection.has(a)).toBe(true);
  });

  it('5 m 에서 한 번 더 누르면 **원이 꺼지고 선택도 풀린다** — 순환이 닫힌다', () => {
    const { s0, a } = setup();
    const s3 = retap(retap(retap(s0, a), a), a);
    expect(rings(s3)).toEqual(['none', 'none']);
    expect(s3.selection.size).toBe(0);
  });

  it('★ 공마다 따로 저장된다 — 한 공을 5 m 로 둔 채 다른 공을 3 m 로 만들 수 있다', () => {
    const { s0, a, b } = setup();
    const s2 = retap(retap(s0, a), a); // a = 5m
    const s3 = editorRootReducer(s2, { type: 'SELECT_SET', ids: [b] });
    const s4 = retap(s3, b); // b = 3m
    expect(rings(s4)).toEqual(['5m', '3m']);
    // b 를 눌렀는데 a 의 선택 해제 규칙이 끼어들지 않는다(a 가 5 m 라도).
    expect(s4.selection.has(b)).toBe(true);
  });

  it('선택 해제 판정은 **순환 이전** 값으로 한다 — 3 m→5 m 탭에서 선택이 풀리면 안 된다', () => {
    const { s0, a } = setup();
    const s1 = retap(s0, a); // 3m
    const s2 = retap(s1, a); // 5m — 이 순간 present 는 5m 가 되지만 선택은 남는다
    expect(rings(s2)[0]).toBe('5m');
    expect(s2.selection.size).toBe(1);
  });

  it('없는 공 id 면 아무 일도 없다 — 같은 참조를 돌려준다', () => {
    const { s0 } = setup();
    expect(retap(s0, 'bl_nope' as BallId)).toBe(s0);
  });
});

describe('5.2 BALL_RETAP — 되돌리기·물리와의 관계', () => {
  it('되돌리기에 실린다 — Ctrl+Z 한 번이 한 칸을 되돌린다', () => {
    const { s0, a } = setup();
    const s2 = retap(retap(s0, a), a); // 5m
    expect(s2.past.length).toBe(s0.past.length + 2);
    const u1 = editorRootReducer(s2, { type: 'UNDO' });
    expect(rings(u1)).toEqual(['3m', 'none']);
    const u2 = editorRootReducer(u1, { type: 'UNDO' });
    expect(rings(u2)).toEqual(['none', 'none']);
    // 다시하기도 대칭이다.
    expect(rings(editorRootReducer(u2, { type: 'REDO' }))).toEqual(['3m', 'none']);
  });

  it('epoch 을 올리지 않는다 — 개체가 안 움직였는데 물리 월드를 다시 세우면 안 된다', () => {
    const { s0, a } = setup();
    expect(retap(s0, a).epoch).toBe(s0.epoch);
    expect(EPOCH_BUMP_TYPES.has('BALL_RETAP')).toBe(false);
  });

  it('COMMIT 이되 COALESCE 는 아니다 — 탭 속도가 되돌리기 칸 수를 바꾸면 안 된다', () => {
    expect(COMMIT_TYPES.has('BALL_RETAP')).toBe(true);
    expect(COALESCE_TYPES.has('BALL_RETAP')).toBe(false);
    // 실측: 연속 두 번이면 past 가 정확히 2 칸 는다(병합되면 1 이다).
    const { s0, a } = setup();
    expect(retap(retap(s0, a), a).past.length - s0.past.length).toBe(2);
  });

  it('스텝을 옮겨도 상태가 남는다 — cast 에 살기 때문이다', () => {
    const { s0, a } = setup();
    const s1 = retap(s0, a); // 3m
    const withStep = editorRootReducer(s1, { type: 'STEP_ADD', afterIndex: 0 });
    const moved = editorRootReducer(withStep, { type: 'STEP_SELECT', id: withStep.present.steps[1]!.id });
    expect(rings(moved)).toEqual(['3m', 'none']);
    // 스텝을 복제해도 마찬가지다(복제는 스텝을 늘릴 뿐 cast 를 건드리지 않는다).
    const dup = editorRootReducer(moved, { type: 'STEP_DUPLICATE', id: moved.stepId });
    expect(rings(dup)).toEqual(['3m', 'none']);
  });
});
