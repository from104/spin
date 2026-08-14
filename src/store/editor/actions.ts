// §6.7 리듀서 액션. src/model/edits.ts(§3.7, Wave 2 완성) 의 편집 연산 20종과 1:1 대응한다.
// PLACE_COMMIT 의 chairs/balls/cones 필드는 계약서 스니펫에 타입이 적혀 있지 않다 — 드래그
// 정착 시점의 스텝 전체 pose 맵(PoseMap)을 그대로 담아 present 를 단방향 교체하는 용도이므로
// DrillStep 의 동명 필드와 같은 타입으로 채웠다(§6.7 "PLACE_COMMIT 은 이미 DOM/물리와 값이
// 같으므로 어떤 재동기화도 하지 않는다" 문단과 일관).
import type { ChairId, StepId, ArrowId, NoteId, CastId, BallId, ConeId, ShapeId } from '../../core/ids.ts';
import type { Vec2 } from '../../core/units.ts';
import type { Drill, ChairDef, NoteLabel, PoseMap } from '../../model/drill.ts';
import type { Shape } from '../../model/shape.ts';
import type { StoredChairPose } from '../../model/chair.ts';
import type { Arrow } from '../../model/arrow.ts';
import type { ToolId } from '../../physics/index.ts';

export type EditorAction =
  // UI (히스토리 제외)
  | { type: 'TOOL_SET'; tool: ToolId }
  | { type: 'CONE_SLOT_SET'; slot: 0 | 1 }
  | { type: 'SELECT_SET'; ids: string[] }
  | { type: 'SELECT_TOGGLE'; id: string }
  | { type: 'SELECT_CLEAR' }
  | { type: 'STEP_SELECT'; id: StepId } // ★ index 가 아니라 id
  | { type: 'SAVED'; at: number }
  | { type: 'COMMIT_BREAK' } // 키 리피트 경계
  // 자유 전술판 전용 — 판 갈아끼우기(코트 전환·초기화). 히스토리를 **쌓지 않고 비운다**.
  // DRILL_LOAD 로 대신할 수 없다: 그건 COMMIT 이라 past 에 한 칸 쌓이므로, 코트를 한 번
  // 바꾸는 순간 past.length > 0 이 되어 "리셋 상태에서만 전환" 게이트가 스스로 닫혀버린다
  // (두 번째 전환이 불가능해진다). 전환 결과는 언제나 그 코트의 기본 배치이므로 되돌릴
  // 과거가 있는 것 자체가 의미 없다.
  | { type: 'BOARD_SET'; drill: Drill }
  // 드릴 데이터 (히스토리 커밋)
  | { type: 'DRILL_LOAD'; drill: Drill }
  // §5.4 배치 프리셋([포메이션으로 채우기] · 세트피스 3종). `model/fillPreset.applyPlacement`
  // 가 만든 판을 통째로 앉힌다.
  //
  // ⚠️ **DRILL_LOAD 로 대신할 수 없다.** DRILL_LOAD 는 uiReducer 에서 stepId 를 첫 스텝으로
  //    되돌리고 선택·저장 기준선까지 리셋한다 — 3번 스텝에서 프리셋을 누르면 1번 스텝으로
  //    끌려간다. 이 액션은 uiReducer 에 갈래가 **없어서**(default 통과) 시점을 건드리지 않는다.
  // ⚠️ CHAIR_PLACE 8번으로 대신할 수도 없다: 되돌리기가 8칸이 되고 물리 월드가 8번 재생성된다.
  //    EPOCH_BUMP_TYPES 에 들어 있는 것이 중요하다 — 그래야 EditorProvider 가 world.load 로
  //    바디를 새 좌표에 다시 세우고 writeFrame 이 즉시 그린다(안 그러면 모델만 바뀌고 화면의
  //    칩은 옛 자리에 남는다).
  | { type: 'PRESET_APPLY'; drill: Drill }
  // ⚠️ patch 에 `{objective: undefined}` 같은 **명시적 undefined 를 실어 보내지 마라** —
  // drillReducer 가 `{...d, ...patch}` 로 얕게 병합하므로 그 키가 undefined 인 채 남고,
  // structuredClone(IDB)은 그것을 보존하는데 JSON 은 지운다(§3.7 omitKey 와 같은 함정).
  // 인스펙터는 언제나 구체값('' · 0 · [])을 보낸다.
  | {
      type: 'META_SET';
      patch: Partial<
        Pick<
          Drill,
          // 드릴 신원
          | 'title'
          | 'category'
          | 'level'
          | 'durationMin'
          | 'tags'
          | 'description'
          | 'formation'
          // §3.2 교육 필드 + §3.3 훈련량
          | 'objective'
          | 'coachingPoints'
          | 'playersNeeded'
          | 'equipment'
          | 'reps'
          | 'sets'
          | 'intervalSec'
        >
      >;
    }
  | { type: 'STEP_ADD'; afterIndex: number }
  | { type: 'STEP_DUPLICATE'; id: StepId }
  | { type: 'STEP_DELETE'; id: StepId }
  | { type: 'STEP_REORDER'; id: StepId; toIndex: number }
  | { type: 'STEP_META'; id: StepId; patch: { name?: string; note?: string; durationMs?: number } }
  | { type: 'OBJECT_ADD'; kind: 'ball' | 'cone'; at: Vec2; colorIndex?: 0 | 1 }
  | { type: 'OBJECT_REMOVE'; id: CastId; scope: 'onward' | 'thisStep' | 'everywhere' }
  | { type: 'CHAIR_PLACE'; id: ChairId; pose: StoredChairPose }
  | { type: 'CHAIR_DEF'; id: ChairId; patch: Partial<Omit<ChairDef, 'id' | 'team'>> }
  // §7 5.2 — **선택된 공을 그 자리에서 다시 탭했다**(2026-08-13, 기현님 실기 피드백 ③).
  // 액션이 '다음 상태' 를 싣지 않고 '사건' 만 싣는 이유: 순환의 다음 칸은 지금 값에서 나오고
  // (없음→3 m→5 m→없음), **5 m 에서만 선택도 함께 풀려야** 한다. 둘을 화면 쪽에서 계산하면
  // 읽고-쓰는 사이에 상태가 바뀌는 길이 열리고, 무엇보다 순환 규칙이 리듀서 밖으로 새 나가
  // 순수 함수로 단언할 수 없게 된다. 그래서 한 번의 dispatch 가 uiReducer(선택 해제)와
  // drillReducer(원 순환) 양쪽에서 갈라진다 — undo 한 칸, 저장 한 번.
  | { type: 'BALL_RETAP'; id: BallId }
  | { type: 'OBJECT_NUDGE'; id: CastId; d: Vec2; dTheta: number } // 키보드 미세조정
  | { type: 'PLACE_BEGIN' } // 드래그 시작: 히스토리 경계만
  | {
      type: 'PLACE_COMMIT';
      stepId: StepId;
      chairs: PoseMap<ChairId, StoredChairPose>;
      balls: PoseMap<BallId, Vec2>;
      cones: PoseMap<ConeId, Vec2>;
    } // 경계 닫기 (past 안 건드림)
  // ★ 정착 후 재커밋(§4.2 P0-2). PLACE_COMMIT 과 결과는 같지만 **의미가 다르다**: 손을 뗀
  // 시점이 아니라 물리가 다 선 시점의 좌표다. 경계를 새로 열지 않는 것은 PLACE_COMMIT 과
  // 같고(드래그 1회 = undo 1회), 추가로 자동저장 억제 창(settleHoldUntil)을 닫는다.
  | {
      type: 'PLACE_SETTLE';
      stepId: StepId;
      chairs: PoseMap<ChairId, StoredChairPose>;
      balls: PoseMap<BallId, Vec2>;
      cones: PoseMap<ConeId, Vec2>;
    }
  // 자동저장 억제 창을 연다(§4.2 A-5). 손을 뗀 시점에 걸고, 정착 재커밋이 닫는다 — 이게
  // 없으면 드래그 1회에 IDB CAS 쓰기가 두 번 나간다(디바운스 800ms < 정착 시간).
  | { type: 'SETTLE_ARM'; until: number }
  | { type: 'ARROW_SET'; arrow: Arrow }
  | { type: 'ARROW_REMOVE'; id: ArrowId }
  | { type: 'NOTE_SET'; note: NoteLabel }
  | { type: 'NOTE_REMOVE'; id: NoteId }
  // 작도 도형(2026-08-14). 화살표·메모와 **완전히 같은 모양**의 쌍이다 — 도형만 다른 규칙을
  // 갖게 하면 되돌리기·병합·자동저장 세 곳에 각각 예외가 생긴다.
  | { type: 'SHAPE_SET'; shape: Shape }
  | { type: 'SHAPE_REMOVE'; id: ShapeId }
  | { type: 'UNDO' }
  | { type: 'REDO' };

/** 드릴 데이터를 바꾸는 액션 전부(§6.7 COMMIT_TYPES) — withHistory 가 drillReducer 를 태우는 기준. */
export const COMMIT_TYPES: ReadonlySet<EditorAction['type']> = new Set([
  'DRILL_LOAD',
  'PRESET_APPLY',
  'META_SET',
  'STEP_ADD',
  'STEP_DUPLICATE',
  'STEP_DELETE',
  'STEP_REORDER',
  'STEP_META',
  'OBJECT_ADD',
  'OBJECT_REMOVE',
  'CHAIR_PLACE',
  'CHAIR_DEF',
  // 5.2 원 순환은 **드릴 내용**이라 되돌리기에 실린다 — `CHAIR_DEF`(개별 색·이름·역할)와 같은
  // 부류다. 실지 않으면 present 가 바뀔 길이 아예 없다(withHistory 는 COMMIT_TYPES 아닌 액션에
  // 대해 s 를 그대로 돌려준다) → 원이 화면에도 파일에도 남지 않는다.
  // COALESCE_TYPES 에는 **넣지 않는다**: 700ms 안의 두 탭이 한 칸으로 병합되면 "5 m 를 3 m 로
  // 되돌리려고 Ctrl+Z 를 눌렀는데 없음까지 갔다" 가 탭 속도에 따라 나온다.
  // EPOCH_BUMP_TYPES 에도 **넣지 않는다**: 개체가 하나도 안 움직였는데 물리 월드를 재생성하면
  // 탭 한 번에 판 전체가 다시 서고 진행 중이던 정착 통지가 유실된다.
  'BALL_RETAP',
  'OBJECT_NUDGE',
  'PLACE_COMMIT',
  'PLACE_SETTLE',
  'ARROW_SET',
  'ARROW_REMOVE',
  'NOTE_SET',
  'NOTE_REMOVE',
  'SHAPE_SET',
  'SHAPE_REMOVE',
]);

/** COALESCE_TYPES(§6.7) — 연속 입력을 700ms/5s 창 안에서 병합한다. */
export const COALESCE_TYPES: ReadonlySet<EditorAction['type']> = new Set([
  'META_SET',
  'STEP_META',
  'NOTE_SET',
  'ARROW_SET',
  // 도형은 끌면 매 프레임 SHAPE_SET 이 난다 — 병합 없이는 한 번 끄는 데 되돌리기 수십 칸이다.
  'SHAPE_SET',
  'OBJECT_NUDGE',
]);

/** epoch 를 증가시키는 액션(§6.7) — 구조 변경·시점 점프. */
export const EPOCH_BUMP_TYPES: ReadonlySet<EditorAction['type']> = new Set([
  'UNDO',
  'REDO',
  'DRILL_LOAD',
  'PRESET_APPLY',
  'STEP_ADD',
  'STEP_DUPLICATE',
  'STEP_DELETE',
  'STEP_REORDER',
  'OBJECT_ADD',
  'OBJECT_REMOVE',
  'CHAIR_PLACE',
]);
