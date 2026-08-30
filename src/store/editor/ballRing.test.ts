// §7 5.2 — 재탭 순환의 **리듀서 계약**(2026-08-13 기현님 실기 피드백 ③).
//
// 한 번의 `BALL_RETAP` 이 두 리듀서에서 갈라진다: drillReducer 는 원을 한 칸 돌리고,
// uiReducer 는 **순환의 마지막 칸에서만** 선택을 푼다. 2026-08-27 에 5 m 가 두 칸으로 늘었다
// (우리 공 / 상대 공 — 세트피스 소유):
//   탭① 3 m → 탭② 5 m(우리) → 탭③ 5 m(상대) → 탭④ 원 없음 + 선택 해제.
// 포인터에서 여기까지의 배선은 features/editor/useEditorPointer.tapDeselect.test.tsx 가 잰다.
import { describe, expect, it } from 'vitest';
import { createDrill } from '../../model/defaults.ts';
import { addBall } from '../../model/edits.ts';
import { ballRingOf, type BallRing, type Drill, type TeamSide } from '../../model/drill.ts';
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

/** v9 — 링은 스텝 소유다. **지금 편집 중인 스텝**(s.stepId)에서 읽는다: BALL_RETAP 이 바꾸는
 *  것도 그 스텝이므로, 이 헬퍼가 cast 를 보던 시절과 같은 것을 재려면 여기여야 한다. */
const rings = (s: EditorState): BallRing[] => {
  const step = s.present.steps.find((st) => st.id === s.stepId) ?? s.present.steps[0]!;
  return s.present.cast.balls.map((b) => ballRingOf(step, b.id));
};
const retap = (s: EditorState, id: BallId): EditorState => editorRootReducer(s, { type: 'BALL_RETAP', id });
const ownerOf = (s: EditorState, id: BallId): TeamSide | undefined =>
  (s.present.steps.find((st) => st.id === s.stepId) ?? s.present.steps[0]!).ballOwner?.[id];

describe('5.2 BALL_RETAP — 순환 다섯 칸(5 m 가 우리 공/상대 공 둘)', () => {
  it('없음 → 3 m → 5 m 까지는 선택이 유지된다', () => {
    const { s0, a } = setup();
    const s1 = retap(s0, a);
    expect(rings(s1)).toEqual(['3m', 'none']);
    expect(s1.selection.has(a)).toBe(true);
    const s2 = retap(s1, a);
    expect(rings(s2)).toEqual(['5m', 'none']);
    expect(s2.selection.has(a)).toBe(true);
  });

  it('5 m(우리) 다음 탭은 **소유만 넘긴다** — 원도 선택도 그대로다', () => {
    const { s0, a } = setup();
    const s3 = retap(retap(retap(s0, a), a), a);
    expect(rings(s3)).toEqual(['5m', 'none']);
    expect(ownerOf(s3, a)).toBe('away');
    // ★ 여기서 선택이 풀리면 소유를 넘긴 뒤 그 공을 계속 다룰 수 없다.
    expect(s3.selection.has(a)).toBe(true);
  });

  it('5 m(상대)에서 한 번 더 누르면 **원이 꺼지고 선택도 풀린다** — 순환이 닫힌다', () => {
    const { s0, a } = setup();
    const s4 = retap(retap(retap(retap(s0, a), a), a), a);
    expect(rings(s4)).toEqual(['none', 'none']);
    expect(ownerOf(s4, a), '원이 꺼지면 소유도 사라진다').toBeUndefined();
    expect(s4.selection.size).toBe(0);
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

  // ⚠️ v9(2026-08-27)에 뜻이 뒤집힌 케이스다. 원래는 "스텝을 옮겨도 상태가 남는다 — cast 에
  // 살기 때문이다" 였다. 이제 링은 스텝 소유이므로, **새 스텝이 상태를 물려받는 것은 복제
  // 때문**이다(duplicateStep 이 structuredClone 으로 스텝을 통째로 베낀다).
  // 결과는 같아 보이지만 이유가 다르고, 그 차이는 "빈 스텝을 새로 만들면 원이 없다" 에서 갈린다.
  it('스텝을 복제하면 원도 따라온다 — 스텝을 통째로 베끼기 때문이다', () => {
    const { s0, a } = setup();
    const s1 = retap(s0, a); // 3m
    const withStep = editorRootReducer(s1, { type: 'STEP_DUPLICATE', id: s1.present.steps[0]!.id });
    const moved = editorRootReducer(withStep, { type: 'STEP_SELECT', id: withStep.present.steps[1]!.id });
    expect(rings(moved)).toEqual(['3m', 'none']);
    const dup = editorRootReducer(moved, { type: 'STEP_DUPLICATE', id: moved.stepId });
    expect(rings(dup)).toEqual(['3m', 'none']);
    // ★ 그러나 **앞 스텝에서 끄면 뒤 스텝은 그대로다** — 이것이 cast 소유와 갈리는 자리다.
    const back = editorRootReducer(dup, { type: 'STEP_SELECT', id: dup.present.steps[0]!.id });
    const off = retap(retap(retap(back, a), a), a); // 3m → 5m → 5m(상대) → 없음
    expect(rings(off), '앞 스텝은 꺼졌고').toEqual(['none', 'none']);
    const later = editorRootReducer(off, { type: 'STEP_SELECT', id: off.present.steps[1]!.id });
    expect(rings(later), '뒤 스텝은 그대로 3 m 다').toEqual(['3m', 'none']);
  });
});
