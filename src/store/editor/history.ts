// §6.7 히스토리. 리듀서가 표준 불변 갱신(변경 경로만 새 객체)을 하므로 스냅샷 = 이전 루트
// 참조를 push — 딥카피 0회.
import type { Drill } from '../../model/drill.ts';
import type { EditorAction } from './actions.ts';
import { COMMIT_TYPES, COALESCE_TYPES, EPOCH_BUMP_TYPES } from './actions.ts';


export interface HistoryState {
  past: Drill[];
  present: Drill;
  future: Drill[];
  lastCommit: { key: string; at: number; runStart: number } | null;
  epoch: number; // 구조 변경·시점 점프에만 증가
}

export const HISTORY_LIMIT = 50;
export const COALESCE_MS = 700;
export const COALESCE_RUN_MAX_MS = 5000;

function pushPast(past: Drill[], entry: Drill): Drill[] {
  const next = past.length >= HISTORY_LIMIT ? past.slice(past.length - HISTORY_LIMIT + 1) : past.slice();
  next.push(entry);
  return next;
}

/** coalesce 키 = `${type}:${id}`. META_SET 은 액션 자체에 id 가 없어 드릴 id 로 대신한다
 *  (한 편집 세션 안에서는 present.id 가 바뀌지 않으므로 유일 키로 충분하다). */
function coalesceKeyOf(a: EditorAction, drillId: string): string | null {
  if (!COALESCE_TYPES.has(a.type)) return null;
  switch (a.type) {
    case 'META_SET':
      return `META_SET:${drillId}`;
    case 'STEP_META':
      return `STEP_META:${a.id}`;
    case 'NOTE_SET':
      return `NOTE_SET:${a.note.id}`;
    case 'ARROW_SET':
      return `ARROW_SET:${a.arrow.id}`;
    case 'OBJECT_NUDGE':
      return `OBJECT_NUDGE:${a.id}`;
    default:
      return null;
  }
}

/** `withHistory(drillReducer)(ui, a)` 형태로 쓴다. `reducer` 는 EditorState 전체(=S)를 받아
 *  새 Drill 을 반환한다 — OBJECT_ADD 등 다수 액션이 "현재 스텝"(s.stepId 로 파생) 을 필요로 해
 *  Drill 만으로는 부족하기 때문이다(§3.7 편집 연산 시그니처가 스텝 index 를 요구). */
export function withHistory<S extends HistoryState>(reducer: (s: S, a: EditorAction) => Drill) {
  return (s: S, a: EditorAction): S => {
    if (a.type === 'UNDO') {
      if (s.past.length === 0) return s;
      const past = s.past.slice(0, -1);
      const present = s.past[s.past.length - 1]!;
      const future = [s.present, ...s.future];
      return { ...s, past, present, future, lastCommit: null, epoch: s.epoch + 1 };
    }
    if (a.type === 'REDO') {
      if (s.future.length === 0) return s;
      const [present, ...future] = s.future;
      const past = pushPast(s.past, s.present);
      return { ...s, past, present: present!, future, lastCommit: null, epoch: s.epoch + 1 };
    }
    if (a.type === 'COMMIT_BREAK') {
      return s.lastCommit === null ? s : { ...s, lastCommit: null };
    }
    // 드래그 세션: PLACE_BEGIN 이 경계를 열고(past 에 push, present 불변), PLACE_COMMIT 이
    // past 를 건드리지 않고 present 만 교체한다 — 드래그 1회 = undo 1회(§6.7).
    if (a.type === 'PLACE_BEGIN') {
      return { ...s, past: pushPast(s.past, s.present), future: [], lastCommit: null };
    }
    if (a.type === 'PLACE_COMMIT') {
      const next = reducer(s, a);
      return next === s.present ? s : { ...s, present: next };
    }
    if (!COMMIT_TYPES.has(a.type)) return s;

    const next = reducer(s, a);
    if (next === s.present) return s; // 변화 없음 — 히스토리·리렌더 억제

    const epoch = EPOCH_BUMP_TYPES.has(a.type) ? s.epoch + 1 : s.epoch;
    const key = coalesceKeyOf(a, s.present.id);
    const now = Date.now();
    const canCoalesce =
      key !== null &&
      s.lastCommit !== null &&
      s.lastCommit.key === key &&
      now - s.lastCommit.at <= COALESCE_MS &&
      now - s.lastCommit.runStart <= COALESCE_RUN_MAX_MS;

    if (canCoalesce) {
      // 같은 키가 이어지는 동안은 past 에 새 엔트리를 밀지 않고 present 만 교체(병합).
      return { ...s, present: next, future: [], lastCommit: { key: key!, at: now, runStart: s.lastCommit!.runStart }, epoch };
    }
    const past = pushPast(s.past, s.present);
    return { ...s, past, present: next, future: [], lastCommit: key ? { key, at: now, runStart: now } : null, epoch };
  };
}
