// §6.7 상태 관리 — UI 리듀서 합성. editorRootReducer 는 계약서 스니펫을 그대로 옮긴다
// (필수 — 안 하면 도구 버튼이 눌리지 않는다).
import { isId } from '../../core/ids.ts';
import type { StepId, CastId } from '../../core/ids.ts';
import { radToStoredDeg, storedDegToRad } from '../../core/angle.ts';
import type { Drill } from '../../model/drill.ts';
import { ballRingOf } from '../../model/drill.ts';
import {
  addBall,
  cycleBallRing,
  addCone,
  placeChair,
  updateChairDef,
  setPose,
  removeFromStepOnward,
  removeFromThisStepOnly,
  addStepAfter,
  duplicateStep,
  deleteStep,
  moveStep,
  setArrow,
  removeArrow,
  setNote,
  removeNote,
  removeShape,
  setShape,
  setStepFlag,
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
  /** 자동저장 억제 창의 마감 시각(epoch ms). 0 이면 억제 없음. §4.2 A-5.
   *
   *  손을 뗀 순간 열리고(SETTLE_ARM) 정착 재커밋이 닫는다(PLACE_SETTLE). useAutosave 는 이
   *  시각까지 디바운스 타이머를 미뤄, 드래그 1회가 IDB CAS 쓰기 **1회**가 되게 한다.
   *  절대 시각인 것이 중요하다 — 정착 통지가 영영 안 와도(스텝 전환으로 world.load 가
   *  끼어들면 그렇게 된다) 마감이 지나면 스스로 풀린다. 불리언 깃발이면 그때 영구히 잠긴다. */
  settleHoldUntil: number;
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
    settleHoldUntil: 0,
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
    case 'SETTLE_ARM':
      return a.until === s.settleHoldUntil ? s : { ...s, settleHoldUntil: a.until };
    case 'PLACE_SETTLE':
      // 정착이 끝났으니 자동저장 억제 창을 닫는다. 좌표가 하나도 안 바뀌었어도(드릴 리듀서가
      // no-op 로 통과하는 경우) 창은 반드시 닫아야 한다 — 안 그러면 저장이 마감까지 밀린다.
      return s.settleHoldUntil === 0 ? s : { ...s, settleHoldUntil: 0 };
    // §7 5.2 — 재탭 순환의 **네 번째 칸**. 없음 → 3 m → 5 m 까지는 선택을 유지하고, 5 m 에서
    // 한 번 더 누르면 원이 꺼지면서(drillReducer) 선택도 풀린다. 그래야 기현님이 적은 "순환"
    // 이 닫힌다 — 유지로 두면 5 m 인 공은 재탭할 때마다 즉시 해제만 되어 원을 끌 길이 없다.
    //
    // ⚠️ 여기서 읽는 `s.present` 는 **순환 이전** 값이다(editorRootReducer 가 uiReducer 를
    // 먼저 돌린다). '5m' 을 '없음' 으로 바꿔 읽으면 3 m→5 m 탭에서 선택이 풀린다.
    // ⚠️ 상태를 5 m 로 **남긴 채** 해제하고 싶으면 순환을 타지 않는 세 경로를 쓴다:
    // Esc · 빈 코트 탭 · 다른 개체 선택. Esc 가 어느 개체든 즉시 해제인 것은 그대로다.
    case 'BALL_RETAP': {
      const def = s.present.cast.balls.find((b) => b.id === a.id);
      if (!def || ballRingOf(def) !== '5m') return s;
      return s.selection.size === 0 ? s : { ...s, selection: new Set<string>() };
    }
    case 'STEP_SELECT':
      return a.id === s.stepId ? s : { ...s, stepId: a.id };
    case 'SAVED':
      // 저장 성공 시각(a.at)은 useAutosave 가 putDrill 응답으로 받은 *실제 저장된* updatedAt 이다
      // — 이 값을 새 기준선으로 삼는다(§4.5/4.3 낙관적 동시성의 expectedUpdatedAt 비교 기준 갱신).
      // s.present.updatedAt 은 쓰면 안 된다: 로컬 편집 리듀서(model/edits.ts)는 updatedAt 을
      // 절대 건드리지 않으므로(§6.7) present.updatedAt 은 드릴을 처음 연 시점 값에 영구히 고정돼
      // 있다 — 그걸 기준선으로 삼으면 두 번째 자동저장부터 항상 낡은 값과 비교해 매번 거짓
      // E_CONFLICT 가 난다(회귀: useAutosave.test.tsx '연속 두 번 저장…').
      return { ...s, savedAt: a.at, baselineUpdatedAt: a.at };
    case 'DRILL_LOAD':
    case 'BOARD_SET':
      // 판이 통째로 바뀌므로 stepId 를 새 드릴의 것으로 옮긴다 — 안 옮기면 selectStepIndex 가
      // 못 찾아 0 으로 떨어지고(무증상), 선택은 사라진 개체 id 를 계속 들고 있게 된다.
      return {
        ...s,
        stepId: a.drill.steps[0]!.id,
        tool: 'select',
        selection: new Set<string>(),
        savedAt: null,
        baselineUpdatedAt: a.drill.updatedAt,
        // 판이 통째로 바뀌면 물리 월드도 재생성된다 — 진행 중이던 정착의 통지는 영영 오지
        // 않으므로 억제 창을 여기서 닫는다(마감까지 저장을 미룰 이유가 없다).
        settleHoldUntil: 0,
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
    // §5.4 배치 프리셋 — 이미 다 만들어진 판을 그대로 앉힌다. 좌표를 만드는 일은 순수 함수
    // (model/fillPreset.ts · model/setPiece.ts)가 하고 여기서는 아무것도 계산하지 않는다:
    // 성질(전부 surface 안 · 5 m 이격 · 겹침 없음)이 리듀서 안에 있으면 단언이 닿지 않는다.
    case 'PRESET_APPLY':
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
      return a.scope === 'onward' ? removeFromStepOnward(d, i, a.id) : removeFromThisStepOnly(d, i, a.id);
    case 'CHAIR_PLACE':
      return placeChair(d, i, a.id, a.pose);
    case 'CHAIR_DEF':
      return updateChairDef(d, a.id, a.patch);
    // 5.2 — 순환 규칙 자체는 순수 함수(model/edits.cycleBallRing)에 있다. 그 공 하나만 바뀐다.
    case 'BALL_RETAP':
      return cycleBallRing(d, a.id);
    case 'OBJECT_NUDGE':
      return applyNudge(d, i, a.id, a.d, a.dTheta);
    // 정착 재커밋(PLACE_SETTLE)은 좌표 교체라는 점에서 PLACE_COMMIT 과 완전히 같다 —
    // 다른 것은 히스토리 거동이 아니라 **시점**뿐이라 드릴 리듀서는 한 갈래를 공유한다.
    case 'PLACE_COMMIT':
    case 'PLACE_SETTLE': {
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
    case 'SHAPE_SET':
      return setShape(d, i, a.shape);
    case 'SHAPE_REMOVE':
      return removeShape(d, i, a.id);
    case 'FLAG_SET':
      return setStepFlag(d, i, a.flag, a.id, a.on);
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
