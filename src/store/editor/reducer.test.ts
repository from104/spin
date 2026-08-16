// §10.7 store — editorRootReducer 조합 · selectStepIndex.
import { describe, expect, it } from 'vitest';
import { newId } from '../../core/ids.ts';
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

  // ⚠️ 이 항등은 **고정할 수 없는 도구에 한한다**(§6.10a). 배치 도구는 같은 것을 한 번 더
  //    주면 고정이 토글되므로 참조가 바뀐다 — 아래 '도구 고정' describe 가 그쪽을 본다.
  //    `freshState()` 의 도구는 `select` 라 여기서는 여전히 항등이다.
  it('항등 액션(고정 못 하는 도구를 같은 것으로 재지정)은 참조를 그대로 돌려준다', () => {
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
  it('히스토리를 쌓지 않고 비운다 — 그래야 코트를 두 번 이상 바꿀 수 있다', () => {
    // 회귀 방어: DRILL_LOAD 로 대신하면 past 에 한 칸 쌓여 "리셋 상태에서만 전환" 게이트가
    // 첫 전환 직후 스스로 닫힌다. 여기서 past 가 비어 있는지가 그 게이트의 전제다.
    let s = freshState();
    s = editorRootReducer(s, { type: 'OBJECT_ADD', kind: 'ball', at: { x: 100, y: 100 }, id: newId('bl') });
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

  it('고정할 수 없는 도구는 두 번 눌러도 안 잠긴다 — 선택·선수', () => {
    // 선택은 배치가 아니고, 선수는 칩마다 다른 사람이라 '연속' 이 성립하지 않는다.
    for (const tool of ['select', 'player'] as const) {
      const s1 = editorRootReducer(freshState(), { type: 'TOOL_SET', tool });
      expect(editorRootReducer(s1, { type: 'TOOL_SET', tool }).toolLock, tool).toBe(false);
    }
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
    ['FLAG_SET', { type: 'FLAG_SET', flag: 'locked', id: 'bl_1', on: true } as const],
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
