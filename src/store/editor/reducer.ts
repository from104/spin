// §6.7 상태 관리 — UI 리듀서 합성. editorRootReducer 는 계약서 스니펫을 그대로 옮긴다
// (필수 — 안 하면 도구 버튼이 눌리지 않는다).
import { isId } from '../../core/ids.ts';
import type { StepId, CastId } from '../../core/ids.ts';
import { radToStoredDeg, storedDegToRad } from '../../core/angle.ts';
import type { Drill } from '../../model/drill.ts';
import {
  addBall,
  addCone,
  placeChair,
  updateChairDef,
  setPose,
  removeFromStepOnward,
  removeFromThisStepOnly,
  removeEverywhere,
  addStepAfter,
  duplicateStep,
  deleteStep,
  moveStep,
  setArrow,
  removeArrow,
  setNote,
  removeNote,
} from '../../model/edits.ts';
import type { EditorAction } from './actions.ts';
import type { HistoryState } from './history.ts';
import { withHistory } from './history.ts';
import type { ToolId } from '../../physics/index.ts';

export interface EditorState extends HistoryState {
  stepId: StepId;
  tool: ToolId;
  coneSlot: 0 | 1;
  selection: ReadonlySet<string>;
  savedAt: number | null;
  baselineUpdatedAt: number;
}

/** §6.7: "현재 스텝의 소유자는 EditorState.stepId 하나뿐이다. index 는 파생한다." */
export const selectStepIndex = (s: EditorState): number => {
  const i = s.present.steps.findIndex((st) => st.id === s.stepId);
  return i < 0 ? 0 : i;
};

export function initEditorState(drill: Drill): EditorState {
  return {
    past: [],
    present: drill,
    future: [],
    lastCommit: null,
    epoch: 0,
    stepId: drill.steps[0]!.id,
    tool: 'select',
    coneSlot: 0,
    selection: new Set<string>(),
    savedAt: null,
    baselineUpdatedAt: drill.updatedAt,
  };
}

function toggleSet(s: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(s);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

function setsEqual(a: ReadonlySet<string>, b: readonly string[]): boolean {
  if (a.size !== b.length) return false;
  for (const id of b) if (!a.has(id)) return false;
  return true;
}

/** TOOL_SET / SELECT_* / STEP_SELECT / SAVED / COMMIT_BREAK(항등 통과) 등 히스토리에
 *  들어가지 않는 UI 상태만 다룬다. 나머지 액션은 항등(같은 참조)으로 통과시킨다. */
export function uiReducer(s: EditorState, a: EditorAction): EditorState {
  switch (a.type) {
    case 'TOOL_SET':
      return a.tool === s.tool ? s : { ...s, tool: a.tool };
    case 'CONE_SLOT_SET':
      return a.slot === s.coneSlot ? s : { ...s, coneSlot: a.slot };
    case 'SELECT_SET':
      return setsEqual(s.selection, a.ids) ? s : { ...s, selection: new Set(a.ids) };
    case 'SELECT_TOGGLE':
      return { ...s, selection: toggleSet(s.selection, a.id) };
    case 'SELECT_CLEAR':
      return s.selection.size === 0 ? s : { ...s, selection: new Set<string>() };
    case 'STEP_SELECT':
      return a.id === s.stepId ? s : { ...s, stepId: a.id };
    case 'SAVED':
      // 저장 성공 시각. 그 시점의 present.updatedAt 을 새 기준선으로 삼는다(§4.5/4.3 낙관적
      // 동시성의 expectedUpdatedAt 비교 기준을 갱신 — 안 그러면 저장 직후 자기 자신의 쓰기를
      // "다른 탭에서 수정됨" 으로 오판한다).
      return { ...s, savedAt: a.at, baselineUpdatedAt: s.present.updatedAt };
    case 'DRILL_LOAD':
      return {
        ...s,
        stepId: a.drill.steps[0]!.id,
        tool: 'select',
        selection: new Set<string>(),
        savedAt: null,
        baselineUpdatedAt: a.drill.updatedAt,
      };
    case 'STEP_DELETE': {
      // ★ 불변식 4(§6.7): 삭제되는 스텝이 지금 선택된 스텝일 때만 재지정한다. 다른 스텝을
      // 지우는 경우 stepId 는 이미 유효하므로 손대지 않는다.
      if (s.present.steps.length <= 1 || a.id !== s.stepId) return s;
      const idx = s.present.steps.findIndex((st) => st.id === a.id);
      if (idx < 0) return s;
      const survivors = s.present.steps.filter((st) => st.id !== a.id);
      const nextIdx = Math.min(idx, survivors.length - 1);
      return { ...s, stepId: survivors[nextIdx]!.id };
    }
    default:
      return s;
  }
}

/** 드릴 데이터 리듀서. EditorState 전체를 받는다 — OBJECT_ADD 등 다수 액션이 "현재 스텝"
 *  (s.stepId 로 파생한 index) 을 필요로 한다. 전부 model/edits.ts(§3.7) 순수 함수 위임. */
export function drillReducer(s: EditorState, a: EditorAction): Drill {
  const d = s.present;
  const i = selectStepIndex(s);

  switch (a.type) {
    case 'DRILL_LOAD':
      return a.drill;
    case 'META_SET':
      return { ...d, ...a.patch };
    case 'STEP_ADD':
      return addStepAfter(d, a.afterIndex);
    case 'STEP_DUPLICATE': {
      const idx = d.steps.findIndex((st) => st.id === a.id);
      return idx < 0 ? d : duplicateStep(d, idx);
    }
    case 'STEP_DELETE': {
      const idx = d.steps.findIndex((st) => st.id === a.id);
      return idx < 0 ? d : deleteStep(d, idx);
    }
    case 'STEP_REORDER': {
      const idx = d.steps.findIndex((st) => st.id === a.id);
      return idx < 0 ? d : moveStep(d, idx, a.toIndex);
    }
    case 'STEP_META': {
      const idx = d.steps.findIndex((st) => st.id === a.id);
      if (idx < 0) return d;
      const step = d.steps[idx]!;
      const next = { ...step, ...a.patch };
      if (next.name === step.name && next.note === step.note && next.durationMs === step.durationMs) return d;
      const steps = d.steps.slice();
      steps[idx] = next;
      return { ...d, steps };
    }
    case 'OBJECT_ADD':
      return a.kind === 'ball' ? addBall(d, i, a.at) : addCone(d, i, a.at, a.colorIndex ?? 0);
    case 'OBJECT_REMOVE':
      if (a.scope === 'onward') return removeFromStepOnward(d, i, a.id);
      if (a.scope === 'thisStep') return removeFromThisStepOnly(d, i, a.id);
      return removeEverywhere(d, a.id);
    case 'CHAIR_PLACE':
      return placeChair(d, i, a.id, a.pose);
    case 'CHAIR_DEF':
      return updateChairDef(d, a.id, a.patch);
    case 'OBJECT_NUDGE':
      return applyNudge(d, i, a.id, a.d, a.dTheta);
    case 'PLACE_COMMIT': {
      const idx = d.steps.findIndex((st) => st.id === a.stepId);
      if (idx < 0) return d;
      const step = d.steps[idx]!;
      if (step.chairs === a.chairs && step.balls === a.balls && step.cones === a.cones) return d; // 동일 참조 — no-op
      const steps = d.steps.slice();
      steps[idx] = { ...step, chairs: a.chairs, balls: a.balls, cones: a.cones };
      return { ...d, steps };
    }
    case 'ARROW_SET':
      return setArrow(d, i, a.arrow);
    case 'ARROW_REMOVE':
      return removeArrow(d, i, a.id);
    case 'NOTE_SET':
      return setNote(d, i, a.note);
    case 'NOTE_REMOVE':
      return removeNote(d, i, a.id);
    default:
      return d;
  }
}

function applyNudge(d: Drill, i: number, id: CastId, delta: { x: number; y: number }, dTheta: number): Drill {
  const step = d.steps[i];
  if (!step) return d;
  if (isId(id, 'ch')) {
    const cur = step.chairs[id];
    if (!cur) return d;
    const angleDeg = radToStoredDeg(storedDegToRad(cur.angleDeg) + dTheta);
    return setPose(d, i, id, { x: cur.x + delta.x, y: cur.y + delta.y, angleDeg });
  }
  if (isId(id, 'bl')) {
    const cur = step.balls[id];
    if (!cur) return d;
    return setPose(d, i, id, { x: cur.x + delta.x, y: cur.y + delta.y });
  }
  const cur = step.cones[id];
  if (!cur) return d;
  return setPose(d, i, id, { x: cur.x + delta.x, y: cur.y + delta.y });
}

/** §6.7 그대로 — 이 조합이 없으면 도구 버튼이 눌리지 않는다. */
export function editorRootReducer(s: EditorState, a: EditorAction): EditorState {
  const ui = uiReducer(s, a);
  const h = withHistory(drillReducer)(ui, a);
  return h === ui ? ui : { ...ui, ...h };
}
