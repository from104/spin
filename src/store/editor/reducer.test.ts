// §10.7 store — editorRootReducer 조합 · selectStepIndex.
import { describe, expect, it } from 'vitest';
import { newId } from '../../core/ids.ts';
import { createDrill } from '../../model/defaults.ts';
import { LIMITS } from '../../model/validate.ts';
import type { Drill } from '../../model/drill.ts';
import { editorRootReducer, initEditorState, selectStepIndex } from './reducer.ts';
import type { EditorState } from './reducer.ts';

function freshState(): EditorState {
  const d: Drill = createDrill({ courtMode: 'full', formation: '1-2-1' });
  return initEditorState(d);
}

describe('editorRootReducer — UI 액션', () => {
  it('TOOL_SET 이 실제로 상태를 바꾼다(withHistory 가 삼키지 않는다)', () => {
    const s0 = freshState();
    const s1 = editorRootReducer(s0, { type: 'TOOL_SET', tool: 'ball' });
    expect(s1).not.toBe(s0);
    expect(s1.tool).toBe('ball');
    expect(s1.present).toBe(s0.present); // 드릴 데이터는 안 건드림
  });

  it('SELECT_SET/SELECT_TOGGLE/SELECT_CLEAR 가 selection 을 바꾼다', () => {
    const s0 = freshState();
    const s1 = editorRootReducer(s0, { type: 'SELECT_SET', ids: ['a', 'b'] });
    expect([...s1.selection]).toEqual(['a', 'b']);
    const s2 = editorRootReducer(s1, { type: 'SELECT_TOGGLE', id: 'a' });
    expect([...s2.selection]).toEqual(['b']);
    const s3 = editorRootReducer(s2, { type: 'SELECT_CLEAR' });
    expect(s3.selection.size).toBe(0);
  });

  it('STEP_SELECT 이 stepId 를 바꾼다', () => {
    const s0 = freshState();
    let d = s0.present;
    const withStep2 = editorRootReducer(s0, { type: 'STEP_ADD', afterIndex: 0 });
    d = withStep2.present;
    const newStepId = d.steps[1]!.id;
    const s2 = editorRootReducer(withStep2, { type: 'STEP_SELECT', id: newStepId });
    expect(s2.stepId).toBe(newStepId);
    expect(s2).not.toBe(withStep2);
  });

  // ⚠️ 이 항등은 **고정할 수 없는 도구에 한한다**(§6.10a). 고정되는 도구는 같은 것을 한 번 더
  //    주면 고정이 토글되므로 참조가 바뀐다 — 아래 '도구 고정' describe 가 그쪽을 본다.
  //    2026-08-16: 예전에는 `freshState()` 의 기본 도구(select)로 이 항등을 봤는데, 선택
  //    도구가 '모아 고르기' 로 고정되면서(§6.10b) 더는 항등이 아니다. 남은 비고정 도구는
  //    `player` 하나다 — 칩마다 다른 사람이라 '연속' 이 성립하지 않는다.
  it('항등 액션(고정 못 하는 도구를 같은 것으로 재지정)은 참조를 그대로 돌려준다', () => {
    const s0 = editorRootReducer(freshState(), { type: 'TOOL_SET', tool: 'player' });
    const s1 = editorRootReducer(s0, { type: 'TOOL_SET', tool: 'player' });
    expect(s1).toBe(s0);
  });

  it('SAVED 는 baselineUpdatedAt 을 실제 저장된 시각(a.at)으로 재기준한다 — ' +
    's.present.updatedAt 은 로컬 편집으로 절대 안 바뀌므로 그걸 쓰면 두 번째 저장부터 ' +
    '거짓 E_CONFLICT 가 난다(회귀 고정)', () => {
    const s0 = freshState();
    const originalUpdatedAt = s0.present.updatedAt;
    const savedAt = originalUpdatedAt + 12345; // putDrill 이 실제로 찍은 새 시각(예시)
    const s1 = editorRootReducer(s0, { type: 'SAVED', at: savedAt });
    expect(s1.savedAt).toBe(savedAt);
    expect(s1.baselineUpdatedAt).toBe(savedAt); // present.updatedAt(불변)이 아니라 a.at 이어야 한다
    expect(s1.baselineUpdatedAt).not.toBe(s1.present.updatedAt);
  });
});

describe('selectStepIndex', () => {
  it('없는 stepId 에는 0 을 반환한다', () => {
    const s0 = freshState();
    const bogus: EditorState = { ...s0, stepId: 'st_doesnotexist' as EditorState['stepId'] };
    expect(selectStepIndex(bogus)).toBe(0);
  });
  it('존재하는 stepId 의 인덱스를 반환한다', () => {
    const s0 = freshState();
    const withStep2 = editorRootReducer(s0, { type: 'STEP_ADD', afterIndex: 0 });
    const s1 = editorRootReducer(withStep2, { type: 'STEP_SELECT', id: withStep2.present.steps[1]!.id });
    expect(selectStepIndex(s1)).toBe(1);
  });
});

describe('STEP_DELETE — 불변식 4: stepId 재지정', () => {
  it('현재 선택 스텝을 지우면 steps[min(idx, len-1)] 로 재지정된다', () => {
    let s = freshState();
    s = editorRootReducer(s, { type: 'STEP_ADD', afterIndex: 0 }); // 2 steps
    s = editorRootReducer(s, { type: 'STEP_ADD', afterIndex: 1 }); // 3 steps
    const ids = s.present.steps.map((st) => st.id);
    s = editorRootReducer(s, { type: 'STEP_SELECT', id: ids[2]! }); // 마지막(3번째) 선택
    const s2 = editorRootReducer(s, { type: 'STEP_DELETE', id: ids[2]! });
    expect(s2.present.steps).toHaveLength(2);
    expect(s2.stepId).toBe(s2.present.steps[1]!.id); // min(2, 2-1)=1 → 남은 마지막 스텝
    expect(s2.present.steps.some((st) => st.id === s2.stepId)).toBe(true);
  });

  it('선택하지 않은 다른 스텝을 지우면 stepId 는 그대로다', () => {
    let s = freshState();
    s = editorRootReducer(s, { type: 'STEP_ADD', afterIndex: 0 }); // 2 steps
    const firstId = s.present.steps[0]!.id;
    const secondId = s.present.steps[1]!.id;
    s = editorRootReducer(s, { type: 'STEP_SELECT', id: firstId });
    const s2 = editorRootReducer(s, { type: 'STEP_DELETE', id: secondId });
    expect(s2.stepId).toBe(firstId);
    expect(s2.present.steps).toHaveLength(1);
  });

  it('스텝이 1개뿐이면 no-op(동일 참조)이다', () => {
    const s0 = freshState();
    const s1 = editorRootReducer(s0, { type: 'STEP_DELETE', id: s0.stepId });
    expect(s1).toBe(s0);
  });
});

// §복제(기현님 확정 2026-08-17) — STEP_DUPLICATE 에 `toIndex` 가 늘었다. StepSidebar 의
// 카드 복제 버튼·틈(gap) g≥1 의 + 는 toIndex 없이(기본 = 바로 뒤) 이 액션을 부르고,
// 맨 앞 틈(g=0) 만 toIndex:0 을 싣는다 — actions.ts STEP_DUPLICATE 주석·StepSidebar.tsx
// gapDuplicateSpec 이 그 규칙의 정본이다. 여기서는 리듀서가 그 계약을 실제로 지키는지만 본다.
describe('STEP_DUPLICATE — toIndex (§복제)', () => {
  it('카드 복제 버튼: toIndex 없이 부르면 바로 뒤(기본값)에 꽂힌다', () => {
    let s = freshState();
    s = editorRootReducer(s, { type: 'STEP_ADD', afterIndex: 0 }); // A, B
    const [aId, bId] = s.present.steps.map((st) => st.id);
    const s2 = editorRootReducer(s, { type: 'STEP_DUPLICATE', id: aId! });
    const ids = s2.present.steps.map((st) => st.id);
    expect(ids).toHaveLength(3);
    expect(ids[0]).toBe(aId); // 원본 A 는 그대로 0번
    expect(ids[1]).not.toBe(aId);
    expect(ids[1]).not.toBe(bId); // 1번은 A 의 복제본(새 id)
    expect(ids[2]).toBe(bId); // B 는 한 칸 밀림
  });

  it('틈 g(g≥1) 의 +: 위 스텝(g-1)의 복제가 그 자리 g 에 꽂힌다 — 기본값이 이미 g 다', () => {
    let s = freshState();
    s = editorRootReducer(s, { type: 'STEP_ADD', afterIndex: 0 });
    s = editorRootReducer(s, { type: 'STEP_ADD', afterIndex: 1 }); // A, B, C
    const [aId, bId, cId] = s.present.steps.map((st) => st.id);
    // 틈 2(카드 1 과 2 사이) → 위 스텝은 index 1 = B
    const s2 = editorRootReducer(s, { type: 'STEP_DUPLICATE', id: bId! });
    const ids = s2.present.steps.map((st) => st.id);
    expect(ids).toHaveLength(4);
    expect(ids[0]).toBe(aId);
    expect(ids[1]).toBe(bId); // 원본 B
    expect(ids[2]).not.toBe(bId);
    expect(ids[2]).not.toBe(cId); // 2번은 B 의 복제본 — 정확히 틈 2 자리
    expect(ids[3]).toBe(cId); // C 는 한 칸 밀림
  });

  it('맨 앞 틈(g=0) 의 +: toIndex:0 으로 첫 스텝의 복제가 맨 앞에 꽂힌다', () => {
    const s0 = freshState();
    const firstId = s0.present.steps[0]!.id;
    const s1 = editorRootReducer(s0, { type: 'STEP_DUPLICATE', id: firstId, toIndex: 0 });
    const ids = s1.present.steps.map((st) => st.id);
    expect(ids).toHaveLength(2);
    expect(ids[0]).not.toBe(firstId); // 복제본이 맨 앞(0)
    expect(ids[1]).toBe(firstId); // 원본은 뒤로 밀림
  });

  it('undo 한 번으로 복제 전 상태(참조까지)로 돌아간다', () => {
    const s0 = freshState();
    const before = s0.present;
    const firstId = s0.present.steps[0]!.id;
    const s1 = editorRootReducer(s0, { type: 'STEP_DUPLICATE', id: firstId });
    expect(s1.present.steps).toHaveLength(2);
    const s2 = editorRootReducer(s1, { type: 'UNDO' });
    expect(s2.present.steps).toHaveLength(1);
    expect(s2.present).toBe(before);
  });
});

// ④ 사슬 토글(기현님 확정 2026-08-17) — STEP_META 의 patch.cut. `cut:true` 는 그 스텝을
// 앞 스텝과 끊고, `cut:false` 는 **키 자체를 지운다**(actions.ts STEP_META 주석·drill.ts
// 교리: cut 은 리터럴 true 만 정의역, `cut:false` 저장은 validate.ts 정화기가 버린다).
describe('STEP_META — patch.cut (§사슬)', () => {
  it('cut:true 를 실으면 그 스텝에 cut:true 가 저장된다', () => {
    let s = freshState();
    s = editorRootReducer(s, { type: 'STEP_ADD', afterIndex: 0 }); // A, B
    const bId = s.present.steps[1]!.id;
    const s2 = editorRootReducer(s, { type: 'STEP_META', id: bId, patch: { cut: true } });
    expect(s2.present.steps[1]!.cut).toBe(true);
    expect(s2.present).not.toBe(s.present);
  });

  it('cut:false 는 값을 false 로 저장하지 않는다 — 키 자체가 사라진다(undefined, false 아님)', () => {
    let s = freshState();
    s = editorRootReducer(s, { type: 'STEP_ADD', afterIndex: 0 });
    const bId = s.present.steps[1]!.id;
    s = editorRootReducer(s, { type: 'STEP_META', id: bId, patch: { cut: true } });
    expect(s.present.steps[1]!.cut).toBe(true);
    const s2 = editorRootReducer(s, { type: 'STEP_META', id: bId, patch: { cut: false } });
    expect(s2.present.steps[1]!.cut).toBeUndefined();
    expect('cut' in s2.present.steps[1]!).toBe(false); // false 로 남는 것과 키가 없는 것은 다르다
  });

  // 옛 STEP_META 항등 판정("name/note/durationMs 만 같으면 d 그대로 반환")이 cut 을 안 봐서
  // 아무 일도 안 일어나던 결함의 회귀 고정 — cut 만 바뀌어도 반드시 present 가 갱신돼야 한다.
  it('cut 만 바뀌어도(name/note/durationMs 는 그대로) present 참조가 바뀐다', () => {
    let s = freshState();
    s = editorRootReducer(s, { type: 'STEP_ADD', afterIndex: 0 });
    const bId = s.present.steps[1]!.id;
    const before = s.present;
    const s2 = editorRootReducer(s, { type: 'STEP_META', id: bId, patch: { cut: true } });
    expect(s2.present).not.toBe(before);
    expect(s2.present.steps[1]!.cut).toBe(true);
  });

  it('없는 스텝 id 는 조용히 무시한다(항등)', () => {
    const s0 = freshState();
    const s1 = editorRootReducer(s0, { type: 'STEP_META', id: 'st_없음' as never, patch: { cut: true } });
    expect(s1.present).toBe(s0.present);
  });

  it('undo 한 번으로 cut 토글 전 상태(참조까지)로 돌아간다', () => {
    let s = freshState();
    s = editorRootReducer(s, { type: 'STEP_ADD', afterIndex: 0 });
    const bId = s.present.steps[1]!.id;
    const before = s.present;
    const s1 = editorRootReducer(s, { type: 'STEP_META', id: bId, patch: { cut: true } });
    expect(s1.present.steps[1]!.cut).toBe(true);
    const s2 = editorRootReducer(s1, { type: 'UNDO' });
    expect(s2.present).toBe(before);
    expect(s2.present.steps[1]!.cut).toBeUndefined();
  });

  // ⚠️ STEP_META 는 COALESCE_TYPES 다(같은 스텝 id 로 700ms 안에 이어지면 한 칸으로 병합 —
  // 텍스트 필드와 같은 취급). 사슬 재토글도 그 규칙을 그대로 타므로, "두 번째 토글이 첫
  // 토글과 별개 조작이다" 를 보이려면 그 사이에 COMMIT_BREAK(키 리피트 경계와 같은 장치,
  // history.ts)를 끼워야 한다 — 안 끼우면 아래 두 커밋이 병합돼 undo 한 번에 최초 상태로
  // 건너뛰고, 이 테스트는 그 잘못된 동작(중간 상태 유실)을 놓치게 된다.
  it('cut:false → true → undo 왕복도 정확히 되짚는다(별개 조작 — 사이에 COMMIT_BREAK)', () => {
    let s = freshState();
    s = editorRootReducer(s, { type: 'STEP_ADD', afterIndex: 0 });
    const bId = s.present.steps[1]!.id;
    s = editorRootReducer(s, { type: 'STEP_META', id: bId, patch: { cut: true } });
    const cutOn = s.present;
    s = editorRootReducer(s, { type: 'COMMIT_BREAK' });
    const s2 = editorRootReducer(s, { type: 'STEP_META', id: bId, patch: { cut: false } });
    expect(s2.present.steps[1]!.cut).toBeUndefined();
    const s3 = editorRootReducer(s2, { type: 'UNDO' });
    expect(s3.present).toBe(cutOn); // 참조까지 복원 — dedupe 가 새 객체를 안 만든다는 증거
    expect(s3.present.steps[1]!.cut).toBe(true);
  });
});

// ⑤ 다중 선택(기현님 확정 2026-08-17, PLAN-STEP-EDITING.md §다중 선택) — 일괄 이동·복제·삭제.
// 선택 상태(체크된 카드) 자체는 StepSidebar 로컬(ephemeral)이라 여기서는 다루지 않는다 —
// 리듀서가 보는 것은 "선택된 id 묶음" 뿐이다(StepSidebar.select.test.tsx 가 화면 쪽을 본다).
describe('STEPS_MOVE — 일괄 이동, 상대 순서 보존 (§다중 선택)', () => {
  it('흩어진 두 스텝(A·C)을 나머지 뒤(toIndex=나머지 길이)로 옮기면 한 덩어리로 뭉친다', () => {
    let s = freshState();
    s = editorRootReducer(s, { type: 'STEP_ADD', afterIndex: 0 });
    s = editorRootReducer(s, { type: 'STEP_ADD', afterIndex: 1 });
    s = editorRootReducer(s, { type: 'STEP_ADD', afterIndex: 2 }); // A B C D
    const [aId, bId, cId, dId] = s.present.steps.map((st) => st.id);
    const s2 = editorRootReducer(s, { type: 'STEPS_MOVE', ids: [aId!, cId!], toIndex: 2 });
    expect(s2.present.steps.map((st) => st.id)).toEqual([bId, dId, aId, cId]);
  });

  it('undo 한 번으로 이동 전 상태(참조까지)로 돌아간다', () => {
    let s = freshState();
    s = editorRootReducer(s, { type: 'STEP_ADD', afterIndex: 0 });
    s = editorRootReducer(s, { type: 'STEP_ADD', afterIndex: 1 }); // A B C
    const before = s.present;
    const [aId, , cId] = s.present.steps.map((st) => st.id);
    const s1 = editorRootReducer(s, { type: 'STEPS_MOVE', ids: [aId!, cId!], toIndex: 1 });
    expect(s1.present.steps).toHaveLength(3);
    const s2 = editorRootReducer(s1, { type: 'UNDO' });
    expect(s2.present).toBe(before); // 단일 STEP_REORDER 를 여러 번 dispatch 했다면 undo 한 번에 안 돌아온다
  });

  it('빈 ids 는 항등이다 — 히스토리에도 안 쌓인다', () => {
    const s0 = freshState();
    const s1 = editorRootReducer(s0, { type: 'STEPS_MOVE', ids: [], toIndex: 0 });
    expect(s1).toBe(s0);
  });

  it('이미 이웃해 있던 선택을 같은 자리에 도로 놓으면(무변경) undo 스택이 안 늘어난다', () => {
    let s = freshState();
    s = editorRootReducer(s, { type: 'STEP_ADD', afterIndex: 0 }); // A B
    const before = s;
    const [aId, bId] = s.present.steps.map((st) => st.id);
    // A,B 를 통째로 골라 toIndex 0(나머지 없음이라 유일한 자리)에 도로 놓는다 — 순서 불변.
    const s2 = editorRootReducer(s, { type: 'STEPS_MOVE', ids: [aId!, bId!], toIndex: 0 });
    expect(s2.present.steps.map((st) => st.id)).toEqual([aId, bId]);
    expect(s2.past).toBe(before.past); // 새 past 엔트리가 안 쌓였다 — moveSteps 의 항등 반환 덕
  });
});

describe('STEPS_DUPLICATE — 일괄 복제, 마지막 선택 뒤에 상대 순서대로 (§다중 선택)', () => {
  it('선택한 두 스텝(A·C)의 사본이 마지막 선택(C) 뒤에 상대 순서대로 꽂힌다', () => {
    let s = freshState();
    s = editorRootReducer(s, { type: 'STEP_ADD', afterIndex: 0 });
    s = editorRootReducer(s, { type: 'STEP_ADD', afterIndex: 1 }); // A B C
    const [aId, bId, cId] = s.present.steps.map((st) => st.id);
    const s2 = editorRootReducer(s, { type: 'STEPS_DUPLICATE', ids: [aId!, cId!] });
    const ids = s2.present.steps.map((st) => st.id);
    expect(ids).toHaveLength(5);
    expect(ids[0]).toBe(aId);
    expect(ids[1]).toBe(bId);
    expect(ids[2]).toBe(cId); // 원본 C — 마지막 선택
    expect(ids[3]).not.toBe(aId);
    expect(ids[3]).not.toBe(cId); // A 의 복제본
    expect(ids[4]).not.toBe(aId);
    expect(ids[4]).not.toBe(cId); // C 의 복제본 — 상대 순서(A 앞, C 뒤) 보존
  });

  it('정원을 넘기면 원본 그대로(항등) 돌려준다', () => {
    let s = freshState();
    while (s.present.steps.length < LIMITS.maxSteps) {
      s = editorRootReducer(s, { type: 'STEP_ADD', afterIndex: s.present.steps.length - 1 });
    }
    const before = s.present;
    const ids = s.present.steps.map((st) => st.id);
    const s2 = editorRootReducer(s, { type: 'STEPS_DUPLICATE', ids: [ids[0]!] });
    expect(s2.present).toBe(before);
  });

  it('undo 한 번으로 복제 전 상태(참조까지)로 돌아간다', () => {
    let s = freshState();
    s = editorRootReducer(s, { type: 'STEP_ADD', afterIndex: 0 });
    const before = s.present;
    const ids = s.present.steps.map((st) => st.id);
    const s1 = editorRootReducer(s, { type: 'STEPS_DUPLICATE', ids });
    expect(s1.present.steps).toHaveLength(4);
    const s2 = editorRootReducer(s1, { type: 'UNDO' });
    expect(s2.present).toBe(before);
  });
});

describe('STEPS_DELETE — 일괄 삭제, 최소 1장 가드 + stepId 이관 (§다중 선택)', () => {
  it('선택 묶음이 지워지고, 현재 스텝이 그 안에 있었으면 남는 스텝으로 옮긴다', () => {
    let s = freshState();
    s = editorRootReducer(s, { type: 'STEP_ADD', afterIndex: 0 });
    s = editorRootReducer(s, { type: 'STEP_ADD', afterIndex: 1 }); // A B C
    const [aId, bId, cId] = s.present.steps.map((st) => st.id);
    s = editorRootReducer(s, { type: 'STEP_SELECT', id: bId! }); // 지금 스텝 = B(삭제 묶음에 포함)
    const s2 = editorRootReducer(s, { type: 'STEPS_DELETE', ids: [aId!, bId!] });
    expect(s2.present.steps.map((st) => st.id)).toEqual([cId]);
    expect(s2.stepId).toBe(cId); // 뒤쪽 생존자(C)로 이관 — 기존 STEP_DELETE 의 "뒤 이웃 우선" 규칙
  });

  it('뒤쪽에 생존자가 없으면(맨 뒤까지 지워짐) 앞쪽 생존자로 옮긴다', () => {
    let s = freshState();
    s = editorRootReducer(s, { type: 'STEP_ADD', afterIndex: 0 });
    s = editorRootReducer(s, { type: 'STEP_ADD', afterIndex: 1 }); // A B C
    const [aId, bId, cId] = s.present.steps.map((st) => st.id);
    s = editorRootReducer(s, { type: 'STEP_SELECT', id: cId! }); // 지금 스텝 = C(맨 뒤)
    const s2 = editorRootReducer(s, { type: 'STEPS_DELETE', ids: [bId!, cId!] });
    expect(s2.present.steps.map((st) => st.id)).toEqual([aId]);
    expect(s2.stepId).toBe(aId);
  });

  it('현재 스텝이 삭제 묶음 밖이면 stepId 를 안 건드린다(불변식 4 그대로)', () => {
    let s = freshState();
    s = editorRootReducer(s, { type: 'STEP_ADD', afterIndex: 0 });
    s = editorRootReducer(s, { type: 'STEP_ADD', afterIndex: 1 }); // A B C
    const [aId, bId, cId] = s.present.steps.map((st) => st.id);
    s = editorRootReducer(s, { type: 'STEP_SELECT', id: cId! });
    const s2 = editorRootReducer(s, { type: 'STEPS_DELETE', ids: [aId!, bId!] });
    expect(s2.stepId).toBe(cId); // 그대로
  });

  it('전량 선택(최소 1장 가드)이면 항등 — present 도 stepId 도 안 바뀐다', () => {
    let s = freshState();
    s = editorRootReducer(s, { type: 'STEP_ADD', afterIndex: 0 }); // A B
    const before = s;
    const ids = s.present.steps.map((st) => st.id);
    const s2 = editorRootReducer(s, { type: 'STEPS_DELETE', ids });
    expect(s2.present).toBe(before.present);
    expect(s2.stepId).toBe(before.stepId);
    expect(s2.past).toBe(before.past); // 히스토리에도 안 쌓인다
  });

  it('undo 한 번으로 삭제 전 상태(참조·stepId 까지)로 돌아간다', () => {
    let s = freshState();
    s = editorRootReducer(s, { type: 'STEP_ADD', afterIndex: 0 });
    s = editorRootReducer(s, { type: 'STEP_ADD', afterIndex: 1 }); // A B C
    const before = s.present;
    const beforeStepId = s.stepId; // A
    const [, bId] = s.present.steps.map((st) => st.id);
    s = editorRootReducer(s, { type: 'STEP_SELECT', id: bId! });
    const s1 = editorRootReducer(s, { type: 'STEPS_DELETE', ids: [bId!] });
    expect(s1.present.steps).toHaveLength(2);
    const s2 = editorRootReducer(s1, { type: 'UNDO' });
    expect(s2.present).toBe(before);
    // ⚠️ UNDO 는 stepId 를 되돌리지 않는다(history.ts — Drill 스냅샷만 되짚는다, EditorState
    // 의 UI 필드는 그대로다) — 그래서 여기서는 삭제 **전** stepId(A)가 아니라 삭제가 이관한
    // stepId(C, 생존자)가 그대로 남는다. 이 단언은 그 사실을 박제해 회귀를 잡는다.
    expect(s2.stepId).not.toBe(beforeStepId);
  });
});

describe('drillReducer 위임 — 대표 경로', () => {
  it('OBJECT_ADD(ball) 이 현재 스텝에 공을 추가한다', () => {
    const s0 = freshState();
    const before = s0.present.cast.balls.length;
    const s1 = editorRootReducer(s0, { type: 'OBJECT_ADD', kind: 'ball', at: { x: 10, y: 10 }, id: newId('bl') });
    expect(s1.present.cast.balls.length).toBe(before + 1);
  });

  it('META_SET 이 present 를 바꾼다', () => {
    const s0 = freshState();
    const s1 = editorRootReducer(s0, { type: 'META_SET', patch: { title: '새 이름' } });
    expect(s1.present.title).toBe('새 이름');
  });
});

describe('BOARD_SET — 자유 전술판 갈아끼우기 (§6.8)', () => {
  // ⚠️ 2026-08-28 뒤집힘. 여기 있던 두 케이스는 *"히스토리를 쌓지 않고 **비운다** — 그래야
  //    코트를 두 번 이상 바꿀 수 있다"* 와 *"연달아 세 번 바꿔도 매번 past 가 비어 있다"* 였고,
  //    근거는 *"DRILL_LOAD 로 대신하면 past 에 한 칸 쌓여 '리셋 상태에서만 전환' 게이트가 첫
  //    전환 직후 스스로 닫힌다"* 였다. 그 게이트가 히스토리 대신 **판 위 개체**를 세게 되면서
  //    전제가 사라졌고, 기현님 지시로 코트 전환도 되돌릴 수 있는 편집이 됐다.
  it('past 에 쌓는다 — 코트 전환도 되돌릴 수 있는 편집이다', () => {
    let s = freshState();
    s = editorRootReducer(s, { type: 'OBJECT_ADD', kind: 'ball', at: { x: 100, y: 100 }, id: newId('bl') });
    const before = s.present;

    const half = createDrill({ courtMode: 'half', formation: '1-2-1' });
    s = editorRootReducer(s, { type: 'BOARD_SET', drill: half });

    expect(s.present).toBe(half);
    expect(s.present.courtMode).toBe('half');
    expect(s.future).toHaveLength(0); // 새 분기라 redo 는 끊긴다
    // 되돌리면 **코트까지** 돌아온다 — courtMode 가 present(Drill) 안에 있어서다.
    const undone = editorRootReducer(s, { type: 'UNDO' });
    expect(undone.present).toBe(before);
    expect(undone.present.courtMode).toBe('full');
  });

  it('연달아 세 번 바꾸면 세 칸이 쌓여 하나씩 거슬러 올라간다', () => {
    let s = freshState();
    const base = s.past.length;
    for (const mode of ['half', 'flat', 'full'] as const) {
      s = editorRootReducer(s, { type: 'BOARD_SET', drill: createDrill({ courtMode: mode, formation: '1-2-1' }) });
      expect(s.present.courtMode).toBe(mode);
    }
    expect(s.past).toHaveLength(base + 3);
    for (const mode of ['flat', 'half'] as const) {
      s = editorRootReducer(s, { type: 'UNDO' });
      expect(s.present.courtMode).toBe(mode);
    }
  });

  it('stepId·선택·도구를 새 판 기준으로 되돌린다', () => {
    let s = freshState();
    s = editorRootReducer(s, { type: 'TOOL_SET', tool: 'ball' });
    s = editorRootReducer(s, { type: 'SELECT_SET', ids: ['ch_x'] });
    const oldStepId = s.stepId;

    const next = createDrill({ courtMode: 'flat', formation: '1-2-1' });
    s = editorRootReducer(s, { type: 'BOARD_SET', drill: next });

    expect(s.stepId).toBe(next.steps[0]!.id);
    expect(s.stepId).not.toBe(oldStepId);
    expect(s.tool).toBe('select');
    expect(s.selection.size).toBe(0);
    // selectStepIndex 가 0 으로 떨어져 무증상으로 가려지지 않는지 — 실제로 찾아져야 한다.
    expect(next.steps.findIndex((st) => st.id === s.stepId)).toBe(0);
  });

  it('epoch 을 올린다 — 물리 월드가 새 코트로 재구성되는 신호', () => {
    const s0 = freshState();
    const s1 = editorRootReducer(s0, { type: 'BOARD_SET', drill: createDrill({ courtMode: 'half' }) });
    expect(s1.epoch).toBe(s0.epoch + 1);
  });
});

// §6.10a 도구 고정 — **수명**이 전부다. 켜는 법(같은 도구 두 번)보다 **꺼지는 법**을 더
// 촘촘히 본다: 이 기능의 유일한 고장 방식은 "켠 적 없는데 켜져 있다"이기 때문이다.
describe('§6.10a 도구 고정 — 연속 배치', () => {
  const armed = (tool: 'cone' | 'note' = 'cone') => {
    const s = editorRootReducer(freshState(), { type: 'TOOL_SET', tool });
    return editorRootReducer(s, { type: 'TOOL_SET', tool });
  };

  it('같은 배치 도구를 두 번 = 고정, 세 번 = 해제', () => {
    const s0 = freshState();
    const s1 = editorRootReducer(s0, { type: 'TOOL_SET', tool: 'cone' });
    expect(s1.toolLock, '한 번은 고를 뿐이다').toBe(false);
    const s2 = editorRootReducer(s1, { type: 'TOOL_SET', tool: 'cone' });
    expect(s2.toolLock).toBe(true);
    expect(s2.tool, '고정이 도구를 바꾸지는 않는다').toBe('cone');
    const s3 = editorRootReducer(s2, { type: 'TOOL_SET', tool: 'cone' });
    expect(s3.toolLock, '같은 조작이 켜고 끈다 — 푸는 법을 따로 배우지 않는다').toBe(false);
  });

  it('고정할 수 없는 도구는 두 번 눌러도 안 잠긴다 — 선수', () => {
    // 2026-08-16 §6.10b — 예전에는 `select` 도 여기 있었다. 지금 선택 도구는 고정되고 그
    // 고정이 '모아 고르기' 다. 남은 것은 `player` 하나 — 칩마다 다른 사람이라 '연속' 이라는
    // 말 자체가 성립하지 않는다.
    const s1 = editorRootReducer(freshState(), { type: 'TOOL_SET', tool: 'player' });
    expect(editorRootReducer(s1, { type: 'TOOL_SET', tool: 'player' }).toolLock).toBe(false);
  });

  it('다른 도구로 옮기면 고정은 따라오지 않는다', () => {
    const s = editorRootReducer(armed(), { type: 'TOOL_SET', tool: 'note' });
    expect(s.tool).toBe('note');
    expect(s.toolLock).toBe(false);
  });

  it('PLACED — 고정이 아니면 선택 도구로 돌아가고 방금 놓은 것이 선택된다', () => {
    const s1 = editorRootReducer(freshState(), { type: 'TOOL_SET', tool: 'cone' });
    const s2 = editorRootReducer(s1, { type: 'PLACED', id: 'cn_x' });
    expect(s2.tool).toBe('select');
    expect([...s2.selection]).toEqual(['cn_x']);
  });

  it('PLACED — 고정이면 도구가 그대로 남는다(그래서 연속으로 놓인다)', () => {
    const s = editorRootReducer(armed(), { type: 'PLACED', id: 'cn_x' });
    expect(s.tool).toBe('cone');
    expect(s.toolLock).toBe(true);
    expect([...s.selection], '고정 중에도 마지막에 놓은 것은 선택된다').toEqual(['cn_x']);
  });

  it.each([
    ['UNDO', { type: 'UNDO' } as const],
    ['REDO', { type: 'REDO' } as const],
    ['SELECT_CLEAR (Esc)', { type: 'SELECT_CLEAR' } as const],
    ['SELECT_SET (사람이 다른 개체를 고름)', { type: 'SELECT_SET', ids: ['bl_1'] as string[] } as const],
    ['SELECT_TOGGLE', { type: 'SELECT_TOGGLE', id: 'bl_1' } as const],
    ['OBJECT_NUDGE (방향키 미세조정)', { type: 'OBJECT_NUDGE', id: 'bl_1' as never, d: { x: 1, y: 0 }, dTheta: 0 } as const],
    ['PLACE_BEGIN (개체를 끌기 시작)', { type: 'PLACE_BEGIN' } as const],
    ['ARROW_REMOVE', { type: 'ARROW_REMOVE', id: 'ar_1' as never } as const],
    ['FLAG_SET', { type: 'FLAG_SET', flag: 'locked', ids: ['bl_1'] as string[], on: true } as const],
  ])('다른 동작이 끼면 즉시 풀린다 — %s (기현 지시 2026-08-16)', (_name, action) => {
    expect(armed().toolLock).toBe(true); // 대조군 — 애초에 잠겨 있었다
    expect(editorRootReducer(armed(), action).toolLock).toBe(false);
  });

  it.each([
    ['CONE_SLOT_SET (콘 색 바꿔 가며 깔기)', { type: 'CONE_SLOT_SET', slot: 1 } as const],
    ['SAVED (자동저장)', { type: 'SAVED', at: 1 } as const],
    ['SETTLE_ARM (물리 정착)', { type: 'SETTLE_ARM', until: 1 } as const],
    ['COMMIT_BREAK (키 리피트 경계)', { type: 'COMMIT_BREAK' } as const],
  ])('연속 동작·뒷정리는 고정을 살려 둔다 — %s', (_name, action) => {
    expect(editorRootReducer(armed(), action).toolLock).toBe(true);
  });

  it('판을 새로 열면 고정은 꺼져 있다 — 켠 적 없는 모드를 물려받지 않는다', () => {
    expect(freshState().toolLock).toBe(false);
    expect(editorRootReducer(armed(), { type: 'BOARD_SET', drill: freshState().present }).toolLock).toBe(false);
  });
});

// §6.10b 모아 고르기 — 선택 도구의 고정. 배치 고정과 **모양은 같고 술어만 다르다**:
// 저쪽이 '놓기가 아닌 동작' 에 풀리듯 이쪽은 '고르기가 아닌 동작' 에 풀린다.
// 손가락에는 수식키가 없어서, 이 모드가 곧 터치의 Shift 다.
describe('§6.10b 모아 고르기 — 선택 도구의 고정', () => {
  const gathering = () => {
    // 기본 도구가 이미 select 라 한 번만 눌러도 '같은 도구 재입력' 이다.
    const s = editorRootReducer(freshState(), { type: 'TOOL_SET', tool: 'select' });
    expect(s.toolLock, '한 번은 토글이다 — 기본 도구가 select 이므로').toBe(true);
    return s;
  };

  it('선택 도구를 한 번 더 = 모아 고르기, 한 번 더 = 해제', () => {
    const s1 = gathering();
    expect(s1.tool).toBe('select');
    expect(editorRootReducer(s1, { type: 'TOOL_SET', tool: 'select' }).toolLock).toBe(false);
  });

  it.each([
    ['SELECT_SET (사각형으로 훑기·같은 것 전부)', { type: 'SELECT_SET', ids: ['bl_1'] as string[] } as const],
    ['SELECT_TOGGLE (하나 더하기·빼기)', { type: 'SELECT_TOGGLE', id: 'bl_1' } as const],
    ['SELECT_CLEAR (빈 곳 탭)', { type: 'SELECT_CLEAR' } as const],
    ['SAVED (자동저장)', { type: 'SAVED', at: 1 } as const],
    ['COMMIT_BREAK', { type: 'COMMIT_BREAK' } as const],
  ])('고르는 동안은 살아 있다 — %s', (_name, action) => {
    expect(editorRootReducer(gathering(), action).toolLock).toBe(true);
  });

  it.each([
    ['GROUP_NUDGE (모은 것을 옮김)', { type: 'GROUP_NUDGE', ids: ['bl_1'] as string[], d: { x: 1, y: 0 } } as const],
    ['OBJECT_REMOVE (지움)', { type: 'OBJECT_REMOVE', id: 'bl_1' as never, scope: 'onward' } as const],
    ['UNDO', { type: 'UNDO' } as const],
    ['FLAG_SET (잠금)', { type: 'FLAG_SET', flag: 'locked', ids: ['bl_1'] as string[], on: true } as const],
    ['CHAIR_PLACE (트레이에서 칩을 놓음)', { type: 'CHAIR_PLACE', id: 'ch_1' as never, pose: { x: 0, y: 0, angleDeg: 0 } } as const],
  ])('고르기가 아닌 동작이 끼면 즉시 풀린다 — %s', (_name, action) => {
    expect(editorRootReducer(gathering(), action).toolLock).toBe(false);
  });

  // ★ 목록이 도구별로 갈리는 이유. 하나로 합치면 아래 둘 중 하나가 반드시 거짓이 된다.
  it('허용 목록은 도구마다 다르다 — 콘을 깔던 중의 SELECT_SET 은 고정을 푼다', () => {
    const cone = editorRootReducer(
      editorRootReducer(freshState(), { type: 'TOOL_SET', tool: 'cone' }),
      { type: 'TOOL_SET', tool: 'cone' },
    );
    expect(cone.toolLock).toBe(true);
    expect(editorRootReducer(cone, { type: 'SELECT_SET', ids: ['bl_1'] }).toolLock).toBe(false);
    // 같은 액션이 모아 고르기에서는 살려 둔다(위 it.each) — 그것이 갈래를 나눈 값이다.
  });
});
