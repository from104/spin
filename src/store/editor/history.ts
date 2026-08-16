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
    case 'SHAPE_SET':
      // 도형 **하나**를 기준으로 병합한다 — 도형 A 를 끌다가 B 를 끌면 두 칸이어야 한다.
      return `SHAPE_SET:${a.shape.id}`;
    case 'OBJECT_NUDGE':
      return `OBJECT_NUDGE:${a.id}`;
    case 'GROUP_NUDGE':
      // 무리의 **구성**이 키다 — 넷을 끌다가 손을 떼고 다른 셋을 끌면 두 칸이어야 한다.
      // 정렬하는 이유: 같은 무리인데 Set 순회 순서가 달라졌다고 되돌리기가 갈리면 안 된다.
      return `GROUP_NUDGE:${[...a.ids].sort().join(',')}`;
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
    // 전술판 갈아끼우기 — past/future 를 **비운다**(쌓지 않는다). 이유는 actions.ts 의
    // BOARD_SET 주석 참고. epoch 을 올려 물리 월드를 즉시 새 코트로 재구성시킨다.
    if (a.type === 'BOARD_SET') {
      return { ...s, past: [], present: a.drill, future: [], lastCommit: null, epoch: s.epoch + 1 };
    }
    // 드래그 세션: PLACE_BEGIN 이 경계를 열고(past 에 push, present 불변), PLACE_COMMIT 이
    // past 를 건드리지 않고 present 만 교체한다 — 드래그 1회 = undo 1회(§6.7).
    if (a.type === 'PLACE_BEGIN') {
      return { ...s, past: pushPast(s.past, s.present), future: [], lastCommit: null };
    }
    // PLACE_SETTLE 은 PLACE_COMMIT 과 **정확히 같은 히스토리 거동**을 갖는다(§4.2 P0-2):
    // past 를 건드리지 않고 present 만 교체한다. 정착은 사용자의 두 번째 편집이 아니라 같은
    // 드래그의 뒤늦은 결과이므로 undo 한 번에 통째로 되돌아가야 한다.
    // ★ epoch 도 절대 올리지 않는다(A-4). 올리면 EditorProvider 가 world.load 로 바디를 전량
    //   재생성하고 → 다시 정착 → 다시 PLACE_SETTLE 로 **무한 루프**가 된다.
    if (a.type === 'PLACE_COMMIT' || a.type === 'PLACE_SETTLE') {
      const next = reducer(s, a);
      return next === s.present ? s : { ...s, present: next };
    }
    if (!COMMIT_TYPES.has(a.type)) return s;

    const next = reducer(s, a);
    if (next === s.present) return s; // 변화 없음 — 히스토리·리렌더 억제

    // ⚠ 이 Set 은 PLACE_COMMIT·PLACE_SETTLE 을 통제하지 못한다 — 위의 조기 분기가 둘을 먼저
    //   가로채므로 여기까지 오지 않는다. [A-4] epoch 불변을 실제로 지키는 자리는 그 분기다.
    //   (2026-08-12 검증관 FV-1: Set 에 'PLACE_SETTLE' 을 넣어도 아무 테스트도 빨간불이 안 됐다.)
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
