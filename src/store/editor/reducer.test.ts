// §10.7 store — editorRootReducer 조합 · selectStepIndex.
import { describe, expect, it } from 'vitest';
import { createDrill } from '../../model/defaults.ts';
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

  it('항등 액션(같은 tool 재지정)은 참조를 그대로 돌려준다', () => {
    const s0 = freshState();
    const s1 = editorRootReducer(s0, { type: 'TOOL_SET', tool: s0.tool });
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

describe('drillReducer 위임 — 대표 경로', () => {
  it('OBJECT_ADD(ball) 이 현재 스텝에 공을 추가한다', () => {
    const s0 = freshState();
    const before = s0.present.cast.balls.length;
    const s1 = editorRootReducer(s0, { type: 'OBJECT_ADD', kind: 'ball', at: { x: 10, y: 10 } });
    expect(s1.present.cast.balls.length).toBe(before + 1);
  });

  it('META_SET 이 present 를 바꾼다', () => {
    const s0 = freshState();
    const s1 = editorRootReducer(s0, { type: 'META_SET', patch: { title: '새 이름' } });
    expect(s1.present.title).toBe('새 이름');
  });
});

describe('BOARD_SET — 자유 전술판 갈아끼우기 (§6.8)', () => {
  it('히스토리를 쌓지 않고 비운다 — 그래야 코트를 두 번 이상 바꿀 수 있다', () => {
    // 회귀 방어: DRILL_LOAD 로 대신하면 past 에 한 칸 쌓여 "리셋 상태에서만 전환" 게이트가
    // 첫 전환 직후 스스로 닫힌다. 여기서 past 가 비어 있는지가 그 게이트의 전제다.
    let s = freshState();
    s = editorRootReducer(s, { type: 'OBJECT_ADD', kind: 'ball', at: { x: 100, y: 100 } });
    expect(s.past.length).toBeGreaterThan(0); // 편집이 쌓였다

    const half = createDrill({ courtMode: 'half', formation: '1-2-1' });
    s = editorRootReducer(s, { type: 'BOARD_SET', drill: half });

    expect(s.past).toHaveLength(0);
    expect(s.future).toHaveLength(0);
    expect(s.present).toBe(half);
    expect(s.present.courtMode).toBe('half');
  });

  it('연달아 세 번 바꿔도 매번 past 가 비어 있다', () => {
    let s = freshState();
    for (const mode of ['half', 'flat', 'full'] as const) {
      s = editorRootReducer(s, { type: 'BOARD_SET', drill: createDrill({ courtMode: mode, formation: '1-2-1' }) });
      expect(s.past).toHaveLength(0);
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
