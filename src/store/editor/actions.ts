// §6.7 리듀서 액션. src/model/edits.ts(§3.7, Wave 2 완성) 의 편집 연산 20종과 1:1 대응한다.
// PLACE_COMMIT 의 chairs/balls/cones 필드는 계약서 스니펫에 타입이 적혀 있지 않다 — 드래그
// 정착 시점의 스텝 전체 pose 맵(PoseMap)을 그대로 담아 present 를 단방향 교체하는 용도이므로
// DrillStep 의 동명 필드와 같은 타입으로 채웠다(§6.7 "PLACE_COMMIT 은 이미 DOM/물리와 값이
// 같으므로 어떤 재동기화도 하지 않는다" 문단과 일관).
import type { ChairId, StepId, ArrowId, NoteId, CastId, BallId, ConeId } from '../../core/ids.ts';
import type { Vec2 } from '../../core/units.ts';
import type { Drill, ChairDef, NoteLabel, PoseMap } from '../../model/drill.ts';
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
  // 드릴 데이터 (히스토리 커밋)
  | { type: 'DRILL_LOAD'; drill: Drill }
  | {
      type: 'META_SET';
      patch: Partial<Pick<Drill, 'title' | 'category' | 'level' | 'durationMin' | 'tags' | 'description' | 'formation'>>;
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
  | { type: 'OBJECT_NUDGE'; id: CastId; d: Vec2; dTheta: number } // 키보드 미세조정
  | { type: 'PLACE_BEGIN' } // 드래그 시작: 히스토리 경계만
  | {
      type: 'PLACE_COMMIT';
      stepId: StepId;
      chairs: PoseMap<ChairId, StoredChairPose>;
      balls: PoseMap<BallId, Vec2>;
      cones: PoseMap<ConeId, Vec2>;
    } // 경계 닫기 (past 안 건드림)
  | { type: 'ARROW_SET'; arrow: Arrow }
  | { type: 'ARROW_REMOVE'; id: ArrowId }
  | { type: 'NOTE_SET'; note: NoteLabel }
  | { type: 'NOTE_REMOVE'; id: NoteId }
  | { type: 'UNDO' }
  | { type: 'REDO' };

/** 드릴 데이터를 바꾸는 액션 전부(§6.7 COMMIT_TYPES) — withHistory 가 drillReducer 를 태우는 기준. */
export const COMMIT_TYPES: ReadonlySet<EditorAction['type']> = new Set([
  'DRILL_LOAD',
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
  'OBJECT_NUDGE',
  'PLACE_COMMIT',
  'ARROW_SET',
  'ARROW_REMOVE',
  'NOTE_SET',
  'NOTE_REMOVE',
]);

/** COALESCE_TYPES(§6.7) — 연속 입력을 700ms/5s 창 안에서 병합한다. */
export const COALESCE_TYPES: ReadonlySet<EditorAction['type']> = new Set([
  'META_SET',
  'STEP_META',
  'NOTE_SET',
  'ARROW_SET',
  'OBJECT_NUDGE',
]);

/** epoch 를 증가시키는 액션(§6.7) — 구조 변경·시점 점프. */
export const EPOCH_BUMP_TYPES: ReadonlySet<EditorAction['type']> = new Set([
  'UNDO',
  'REDO',
  'DRILL_LOAD',
  'STEP_ADD',
  'STEP_DUPLICATE',
  'STEP_DELETE',
  'STEP_REORDER',
  'OBJECT_ADD',
  'OBJECT_REMOVE',
  'CHAIR_PLACE',
]);
