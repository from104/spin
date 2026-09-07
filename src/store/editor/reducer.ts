// §6.7 상태 관리 — UI 리듀서 합성. editorRootReducer 는 계약서 스니펫을 그대로 옮긴다
// (필수 — 안 하면 도구 버튼이 눌리지 않는다).
import { isId } from '../../core/ids.ts';
import type { StepId, CastId, BallId, ConeId } from '../../core/ids.ts';
import { radToStoredDeg, storedDegToRad } from '../../core/angle.ts';
import type { Drill, DrillStep } from '../../model/drill.ts';
import { ballRingOf } from '../../model/drill.ts';
import { nudgeArrow } from '../../model/arrow.ts';
import { nudgeStroke } from '../../model/stroke.ts';
import {
  addBall,
  cycleBallRing,
  addCone,
  placeChair,
  updateChairDef,
  setPose,
  removeFromStepOnward,
  removeFromThisStepOnly,
  duplicateStep,
  deleteStep,
  moveStep,
  moveSteps,
  duplicateSteps,
  deleteSteps,
  clearStep,
  setArrow,
  removeArrow,
  setNote,
  removeNote,
  removeShape,
  removeStroke,
  setShape,
  setStroke,
  setStepFlag,
} from '../../model/edits.ts';
import { moveZ } from '../../model/zOrder.ts';
import { overlappingIds } from '../../physics/bounds.ts';
import type { EditorAction } from './actions.ts';
import type { HistoryState } from './history.ts';
import { withHistory } from './history.ts';
import type { ToolId } from '../../physics/index.ts';

export interface EditorState extends HistoryState {
  stepId: StepId;
  tool: ToolId;
  /** 배치 도구를 **연속으로** 쓰는 중인가(§6.10a).
   *
   *  기본은 1회용이다 — 하나 놓으면 선택 도구로 돌아가고 방금 놓은 것이 선택된다. 놓자마자
   *  자리를 고치는 것이 놓자마자 하나 더 놓는 것보다 훨씬 잦기 때문이다. 콘을 여덟 개 깔 때는
   *  그 기본이 손해라, 같은 도구를 한 번 더 눌러 이 깃발을 켠다.
   *
   *  ⚠️ **꺼짐이 기본인 상태다.** 켜진 채 남는 것이 이 기능의 유일한 고장 방식이므로, 수명은
   *  `KEEPS_TOOL_LOCK` **허용 목록**으로 정한다(거부 목록이 아니다 — 새 액션이 생겼을 때
   *  빠뜨리면 허용 목록은 고정이 일찍 풀리고, 거부 목록은 영영 안 풀린다). */
  toolLock: boolean;
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
    // 고정은 **저장하지 않고 물려주지도 않는다** — 판을 열자마자 켜져 있는 모드는 화면에
    // 표시가 있어도 "내가 켠 적 없는" 모드라, 모드 오류의 원인인 '안 보이는 모드' 와 같다.
    toolLock: false,
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

/** 고정할 수 있는 도구(§6.10a·§6.10b) — 문장 하나로 정리된다:
 *  **"도구를 한 번 더 누르면 그 도구를 계속 쓴다."**
 *  놓기 도구에는 *계속 놓는다*(연속 배치), 선택 도구에는 *계속 고른다*(모아 고르기)다.
 *
 *  `select` 가 여기 있는 이유는 터치다(§6.10b). 가산 선택은 `Shift`/`⌘` 로만 열리는데
 *  **손가락에는 수식키가 없어서**, 터치에서는 이미 고른 것에 하나를 더할 방법이 아예 없었다
 *  — 고무줄 사각형을 한 번에 정확히 맞히지 못하면 처음부터 다시 훑는 수밖에 없었다.
 *  명시적 모드는 그 자리를 메우면서 새 관용구를 만들지 않는다: 손짓도 배지도 이미 있는 것이다.
 *
 *  `player` 는 칩마다 다른 사람이라서 빠진다 — 선수는 하나 놓을 때마다 트레이에서 다음 칩을
 *  골라야 하므로 '연속' 이라는 말 자체가 성립하지 않는다. */
export const LOCKABLE_TOOLS: ReadonlySet<ToolId> = new Set<ToolId>([
  'select',
  'ball',
  'cone',
  'note',
  'line',
  'shapeEllipse',
  'shapeTriangle',
  'shapeRect',
  // 2026-09-03 — 자유 그리기. **고정의 뜻이 가장 또렷한 도구다**: 판에 손으로 덧그리는 일은
  // 한 획으로 끝나는 법이 거의 없어서(동선 하나에 곡선 서넛), 고정이 없으면 획마다 도구를
  // 다시 골라야 한다. `KEEPS_PLACE_LOCK` 의 `STROKE_SET` 이 그 고정을 캡처마다 살려 준다.
  'freehand',
  //
  // ⚠️ `'eraser'` 는 **넣지 않는다**(PLAN 결정 8) — 연속 삭제는 도구의 성질이지 고정이 아니고,
  //    고정에 넣으면 파괴 모드가 잠긴 채 남는다.
]);

/** 어느 고정에서든 살아남는 액션 — **사용자가 낸 것이 아니기 때문에** 그렇다.
 *  자동저장·키 리피트 경계·물리 정착 뒷정리는 사용자가 손댄 적 없는데도 시각과 무관하게
 *  날아온다. 이걸로 고정이 풀리면 "가만히 뒀는데 풀렸다" 가 된다. */
const KEEPS_ANY_LOCK: readonly EditorAction['type'][] = ['TOOL_SET', 'SAVED', 'COMMIT_BREAK', 'SETTLE_ARM', 'PLACE_SETTLE'];

/** 배치 도구의 고정을 **살려 두는** 액션(§6.10a). 여기 없는 액션이 하나라도 오면 고정은 즉시
 *  풀린다(기현 지시 2026-08-16: *"연속 동작까지만 유효하고 다른 동작을 하면 바로 꺼지게"*).
 *
 *  ⚠️ `SELECT_SET` 은 **일부러 뺐다** — 배치가 내는 선택은 `PLACED` 로 따로 다니므로, 여기
 *  남는 `SELECT_SET` 은 사람이 다른 개체를 고른 것이고 그건 '다른 동작' 이다. */
const KEEPS_PLACE_LOCK: ReadonlySet<EditorAction['type']> = new Set<EditorAction['type']>([
  ...KEEPS_ANY_LOCK,
  'PLACED',
  // 배치가 내는 커밋. 도형·메모·화살표는 편집에도 같은 액션을 쓰지만, 그 편집은 선택 도구로
  // 하는 것이라 배치 도구가 고정된 동안에는 올 일이 없다.
  'OBJECT_ADD',
  'CHAIR_PLACE',
  'NOTE_SET',
  'SHAPE_SET',
  'ARROW_SET',
  // 획 캡처가 끝날 때마다 난다(2026-09-03). ⚠️ **없으면 획 하나를 그을 때마다 고정이 풀린다** —
  // 자유 그리기는 연속으로 여러 획을 긋는 도구라 그러면 고정이 아무 뜻이 없다.
  'STROKE_SET',
  // 콘 색을 바꿔 가며 까는 것은 한 가지 연속 동작이다.
  'CONE_SLOT_SET',
]);

/** 선택 도구의 고정(= 모아 고르기)을 **살려 두는** 액션(§6.10b). 규칙의 모양은 배치 고정과
 *  똑같고 술어만 갈린다 — 배치 고정이 *놓기가 아닌 동작*에 풀리듯, 이쪽은 *고르기가 아닌
 *  동작*에 풀린다. 그래서 모아 놓은 것을 옮기거나 지우는 순간 모드는 제 할 일을 다한 것이다.
 *
 *  목록이 도구별로 갈리는 것이 핵심이다. 하나로 합치면 `SELECT_SET` 이 들어가야 하고, 그러면
 *  **콘을 깔던 중에 다른 개체를 고르는 것**까지 배치 고정을 살려 두게 된다 — 갈래를 나누는
 *  비용이 그 조용한 오작동보다 싸다. */
const KEEPS_SELECT_LOCK: ReadonlySet<EditorAction['type']> = new Set<EditorAction['type']>([
  ...KEEPS_ANY_LOCK,
  'SELECT_SET',
  'SELECT_TOGGLE',
  'SELECT_CLEAR',
]);

/** TOOL_SET / SELECT_* / STEP_SELECT / SAVED / COMMIT_BREAK(항등 통과) 등 히스토리에
 *  들어가지 않는 UI 상태만 다룬다. 나머지 액션은 항등(같은 참조)으로 통과시킨다.
 *
 *  도구 고정의 수명은 **여기 바깥 껍질 한 곳**이 정한다 — 갈래마다 적으면 새 갈래가 생길 때
 *  빠뜨리기 때문이다(위 `KEEPS_PLACE_LOCK` 주석). */
export function uiReducer(s: EditorState, a: EditorAction): EditorState {
  const next = uiReducerInner(s, a);
  if (!next.toolLock) return next;
  // 어떤 목록을 보는가는 **고정된 도구**가 정한다 — 고정의 뜻이 도구마다 다르기 때문이다.
  const keeps = next.tool === 'select' ? KEEPS_SELECT_LOCK : KEEPS_PLACE_LOCK;
  if (!keeps.has(a.type)) return { ...next, toolLock: false };
  return next;
}

function uiReducerInner(s: EditorState, a: EditorAction): EditorState {
  switch (a.type) {
    // 같은 도구를 한 번 더 = **고정 토글**(§6.10a). 개편 전에는 여기가 항등 통과라 아무 일도
    // 안 났다 — 빈 자리였으므로 새 뜻을 얹어도 빼앗는 것이 없다.
    case 'TOOL_SET': {
      if (a.tool !== s.tool) return { ...s, tool: a.tool, toolLock: false };
      if (!LOCKABLE_TOOLS.has(a.tool)) return s;
      return { ...s, toolLock: !s.toolLock };
    }
    // 개체를 새로 놓았다 — 방금 놓은 것을 고르고, 고정이 아니면 선택 도구로 돌아간다.
    // 되돌리기로 지운 뒤에도 선택만 남는 일은 없다: UNDO 는 고정을 풀고, 사라진 id 를 든
    // 선택은 이미 다른 곳(사라진 개체 선택)과 같은 방식으로 무시된다.
    case 'PLACED': {
      const tool = s.toolLock ? s.tool : 'select';
      return { ...s, selection: new Set([a.id]), tool };
    }
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
      // v9 — 링은 스텝 소유다. 지금 편집 중인 스텝에서 읽는다(`s.stepId`).
      // 순환의 **마지막 칸**에서만 풀린다 — 2026-08-27 에 5 m 가 두 칸(우리 공/상대 공)으로
      // 늘면서, 예전의 "5 m 면 해제" 는 소유를 넘기는 중간 탭에서 선택을 빼앗게 됐다.
      const step = s.present.steps.find((st) => st.id === s.stepId);
      if (!step || ballRingOf(step, a.id) !== '5m' || step.ballOwner?.[a.id] !== 'away') return s;
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
    // ⑤ 다중 선택 — 일괄 삭제(기현님 확정 2026-08-17). STEP_DELETE 의 불변식 4 를 여러 개
    // 지우는 경우로 일반화한 것이다: 지금 스텝이 삭제 묶음에 없으면 손대지 않는다(이미 유효).
    // 있으면 **뒤쪽에서 먼저 생존자를 찾고, 없으면 앞쪽**으로 — 단일 삭제의 "min(idx,
    // survivors.length-1)"(뒤 이웃 우선, 끝이면 남은 마지막 것)과 정확히 같은 규칙을 여럿
    // 지워도 옳게 답하도록 일반화했다(연속으로 여러 스텝이 지워져도 그 다음 첫 생존자를 찾는다).
    // 전량 삭제(가드에 걸려 실제로는 안 일어난다 — deleteSteps 가 원본을 그대로 돌려준다)는
    // 루프 두 개가 다 실패해 맨 끝 `return s` 로 안전하게 빠진다.
    case 'STEPS_DELETE': {
      const idSet = new Set(a.ids);
      if (!idSet.has(s.stepId)) return s;
      const idx = s.present.steps.findIndex((st) => st.id === s.stepId);
      if (idx < 0) return s;
      for (let i = idx + 1; i < s.present.steps.length; i++) {
        const st = s.present.steps[i]!;
        if (!idSet.has(st.id)) return { ...s, stepId: st.id };
      }
      for (let i = idx - 1; i >= 0; i--) {
        const st = s.present.steps[i]!;
        if (!idSet.has(st.id)) return { ...s, stepId: st.id };
      }
      return s;
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
    case 'META_SET': {
      // C7(2026-08-18) — **명시적 undefined 는 "키를 지워라"** 다. 얕은 병합만 하던 시절에는
      // undefined 가 키로 남아 structuredClone(IDB)이 보존하고 JSON 이 지우는 두 얼굴 문서를
      // 만들었다(actions.ts 의 그 경고). 이제 지우므로 메타 시트가 situation(선택 필드)을
      // '미지정' 으로 되돌릴 수 있다 — validate 화이트리스트의 "없음 = 키 생략" 교리와 정합.
      const next = { ...d, ...a.patch };
      for (const k of Object.keys(a.patch)) {
        if ((a.patch as Record<string, unknown>)[k] === undefined) delete (next as unknown as Record<string, unknown>)[k];
      }
      return next;
    }
    case 'STEP_DUPLICATE': {
      const idx = d.steps.findIndex((st) => st.id === a.id);
      return idx < 0 ? d : duplicateStep(d, idx, a.toIndex);
    }
    case 'STEP_DELETE': {
      const idx = d.steps.findIndex((st) => st.id === a.id);
      return idx < 0 ? d : deleteStep(d, idx);
    }
    case 'STEP_REORDER': {
      const idx = d.steps.findIndex((st) => st.id === a.id);
      return idx < 0 ? d : moveStep(d, idx, a.toIndex);
    }
    // ⑤ 다중 선택(기현님 확정 2026-08-17) — 세 갈래 모두 순수 함수(edits.ts)에 그대로 위임한다.
    // 정원·최소 1장 가드는 그 함수들 안에 있다(사이드바 버튼이 미리 잠그지만 여기가 마지막 문).
    case 'STEPS_MOVE':
      return moveSteps(d, a.ids, a.toIndex);
    case 'STEPS_DUPLICATE':
      return duplicateSteps(d, a.ids);
    case 'STEPS_DELETE':
      return deleteSteps(d, a.ids);
    case 'STEP_CLEAR': {
      const idx = d.steps.findIndex((st) => st.id === a.id);
      return idx < 0 ? d : clearStep(d, idx);
    }
    case 'STEP_META': {
      const idx = d.steps.findIndex((st) => st.id === a.id);
      if (idx < 0) return d;
      const step = d.steps[idx]!;
      // cut 은 나머지 필드와 병합 방식이 다르다 — `{...step, cut: a.patch.cut}` 로 얕게
      // 섞으면 `cut: false` 가 그대로 저장돼 버린다(DrillStep.cut 은 리터럴 true 만 정의역,
      // actions.ts STEP_META 주석). `false` 는 **키 삭제 명령**으로 따로 해석한다
      // (model/edits.ts stripStepFlags 의 `delete patched[flag]` 와 같은 관례).
      // `seamless`(2026-09-08 딜레이 없는 연결)도 정확히 같은 부류다 — 리터럴 `true` 만
      // 정의역이고 `false` 는 키 삭제 명령이다(model/stepLink.ts stepLinkPatch).
      const { cut: cutCmd, seamless: seamlessCmd, ...rest } = a.patch;
      let next: DrillStep = { ...step, ...rest };
      if (cutCmd !== undefined) {
        if (cutCmd) {
          next = { ...next, cut: true };
        } else if ('cut' in next) {
          next = { ...next };
          delete next.cut;
        }
      }
      if (seamlessCmd !== undefined) {
        if (seamlessCmd) {
          next = { ...next, seamless: true };
        } else if ('seamless' in next) {
          next = { ...next };
          delete next.seamless;
        }
      }
      // ⚠️ cut·seamless 도 비교에 넣어야 한다 — 안 넣으면 "연결 방식만 바뀌고 name/note/
      // durationMs 는 그대로" 인 흔한 경우(틈 버튼 그 자체)가 매번 항등 판정에 걸려 아무 일도
      // 안 일어난다.
      if (
        next.name === step.name &&
        next.note === step.note &&
        next.durationMs === step.durationMs &&
        next.cut === step.cut &&
        next.seamless === step.seamless
      ) {
        return d;
      }
      const steps = d.steps.slice();
      steps[idx] = next;
      return { ...d, steps };
    }
    case 'OBJECT_ADD':
      return a.kind === 'ball'
        ? addBall(d, i, a.at, a.id as BallId)
        : addCone(d, i, a.at, a.colorIndex ?? 0, a.id as ConeId);
    case 'OBJECT_REMOVE':
      return a.scope === 'onward' ? removeFromStepOnward(d, i, a.id) : removeFromThisStepOnly(d, i, a.id);
    case 'CHAIR_PLACE':
      return placeChair(d, i, a.id, a.pose);
    case 'CHAIR_DEF':
      return updateChairDef(d, a.id, a.patch);
    // 5.2 — 순환 규칙 자체는 순수 함수(model/edits.cycleBallRing)에 있다. v9 부터 **그 스텝의**
    // 그 공 하나만 바뀐다(i = 지금 편집 중인 스텝 인덱스, 이 리듀서가 이미 받고 있다).
    case 'BALL_RETAP':
      return cycleBallRing(d, i, a.id);
    case 'OBJECT_NUDGE':
      return applyNudge(d, i, a.id, a.d, a.dTheta);
    case 'GROUP_NUDGE':
      return applyGroupNudge(d, i, a.ids, a.d);
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
    case 'STROKE_SET':
      return setStroke(d, i, a.stroke);
    case 'STROKE_REMOVE':
      return removeStroke(d, i, a.id);
    case 'FLAG_SET':
      // 여럿이면 접어 넣는다 — 히스토리에는 이 액션 한 칸만 남는다(actions.ts 주석).
      return a.ids.reduce((acc, id) => setStepFlag(acc, i, a.flag, id, a.on), d);
    // 표시 순서(2026-09-06, PLAN-Z-ORDER 결정 5·8). 규칙은 전부 순수 함수 두 개에 있다 —
    // 여기서 계산하는 것은 **아무것도 없다**(겹침 문지기도 `moveZ` 가 스스로 다시 본다).
    //
    // ★ 겹침 집합을 **이 자리에서** 뜬다: 메뉴를 연 시점의 겹침을 액션에 실어 보내면, 메뉴가
    //   열린 채 다른 창(되돌리기·자동 정착)이 판을 바꿨을 때 낡은 문지기로 순서가 바뀐다.
    // ★ 불가능하면 `moveZ` 가 **같은 step 참조**를 돌려주고, 그때 d 를 그대로 돌려준다 —
    //   `history.ts` 의 `next === s.present` 가 그것을 보고 undo 스택에 안 쌓는다(PLACE_COMMIT
    //   의 동일 참조 no-op 과 같은 규약). 새 배열을 만들어 돌려주면 disabled 항목을 눌러도
    //   되돌리기 칸이 늘어난다.
    case 'Z_ORDER': {
      const step = d.steps[i];
      if (!step) return d;
      const next = moveZ(step, d.cast, a.id, a.op, overlappingIds(step, d.cast, a.id));
      if (next === step) return d;
      const steps = d.steps.slice();
      steps[i] = next;
      return { ...d, steps };
    }
    default:
      return d;
  }
}

/** 고른 것을 통째로 평행이동(§6.10b). **회전은 없다** — 여럿을 한꺼번에 돌리려면 무리의
 *  중심이라는 새 개념이 필요한데, 그 중심이 무엇인지(경계상자? 무게중심?)에 답이 하나로
 *  안 나온다. 하나만 고르면 종전대로 돌릴 수 있으니 잃는 것도 없다.
 *
 *  잠긴 개체는 여기서 거르지 않는다 — 애초에 명단에 안 담아 보낸다(부르는 쪽이 잠김을 안다). */
function applyGroupNudge(d: Drill, i: number, ids: readonly string[], delta: { x: number; y: number }): Drill {
  let out = d;
  for (const id of ids) {
    if (isId(id, 'ch') || isId(id, 'bl') || isId(id, 'cn')) {
      out = applyNudge(out, i, id as CastId, delta, 0);
      continue;
    }
    const step = out.steps[i];
    if (!step) continue;
    if (isId(id, 'nt')) {
      const n = step.notes.find((x) => x.id === id);
      if (n) out = setNote(out, i, { ...n, x: n.x + delta.x, y: n.y + delta.y });
    } else if (isId(id, 'ar')) {
      const ar = step.arrows.find((x) => x.id === id);
      // 세 점을 함께 민다 — 포인터의 몸통 드래그·키보드 이동과 **같은 함수**라 셋이 안 갈린다.
      if (ar) out = setArrow(out, i, nudgeArrow(ar, 'whole', delta));
    } else if (isId(id, 'sh')) {
      const sh = step.shapes?.find((x) => x.id === id);
      if (sh) out = setShape(out, i, { ...sh, x: sh.x + delta.x, y: sh.y + delta.y });
    } else if (isId(id, 'fh')) {
      const fh = step.strokes?.find((x) => x.id === id);
      // 점 전부를 함께 민다 — 화살표의 'whole' 과 같은 뜻이고, 같은 함수를 포인터의 몸통
      // 드래그도 쓴다(그래야 키보드와 마우스가 안 갈린다 — §7.5 의 요구).
      if (fh) out = setStroke(out, i, nudgeStroke(fh, delta));
    }
  }
  return out;
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
