// 물리 스냅샷 → 스텝의 휠체어·공·콘 맵. **값이 실제로 바뀐 것만** 새 맵을 만든다 — 참조를 그대로 재사용해야
// PLACE_COMMIT·PLACE_SETTLE 리듀서의 무변화 no-op 가드(§6.7)가 작동해서, 그냥 잡았다 뗀 선택이나 아무것도
// 안 밀린 키보드 이동이 undo 스택·자동저장을 더럽히지 않는다.
//
// 드래그 커밋(useEditorPointer.commitPoses)과 키보드·[미세 조정] 이동의 정착 덧쓰기(EditorStage, 2026-11-16)가
// 함께 쓴다 — 두 벌이면 반올림·각도 저장 규칙이 한쪽만 바뀐다.
import { isId } from '../../core/ids.ts';
import type { BallId, ChairId, ConeId } from '../../core/ids.ts';
import type { PhysicsSnapshot } from '../../physics/index.ts';
import type { DrillStep } from '../../model/drill.ts';
import { poseToStored } from '../../model/chair.ts';

const round1 = (n: number): number => Math.round(n * 10) / 10;

export interface StepPoses {
  chairs: DrillStep['chairs'];
  balls: DrillStep['balls'];
  cones: DrillStep['cones'];
  changed: boolean;
}

/** `override` 는 그 개체 하나의 자리를 스냅샷 대신 쓴다(드래그의 정착 스냅 §4.3 P1-3). 각도는 스냅샷 그대로다. */
export function stepPosesFromSnapshot(
  snap: PhysicsSnapshot,
  step: DrillStep,
  override?: { id: string; x: number; y: number } | null,
): StepPoses {
  const posOf = (id: string, p: { x: number; y: number }): { x: number; y: number } => (override && id === override.id ? override : p);
  let chairs = step.chairs;
  let balls = step.balls;
  let cones = step.cones;
  let changed = false;
  for (const [id, p] of Object.entries(snap)) {
    if (isId(id, 'ch') && id in step.chairs) {
      const q = posOf(id, p);
      const stored = poseToStored({ x: q.x, y: q.y, theta: p.theta });
      const cur = step.chairs[id as ChairId]!;
      if (cur.x !== stored.x || cur.y !== stored.y || cur.angleDeg !== stored.angleDeg) {
        if (chairs === step.chairs) chairs = { ...step.chairs };
        chairs[id as ChairId] = stored;
        changed = true;
      }
    } else if (isId(id, 'bl') && id in step.balls) {
      const q = posOf(id, p);
      const x = round1(q.x);
      const y = round1(q.y);
      const cur = step.balls[id as BallId]!;
      if (cur.x !== x || cur.y !== y) {
        if (balls === step.balls) balls = { ...step.balls };
        balls[id as BallId] = { x, y };
        changed = true;
      }
    } else if (isId(id, 'cn') && id in step.cones) {
      const q = posOf(id, p);
      const x = round1(q.x);
      const y = round1(q.y);
      const cur = step.cones[id as ConeId]!;
      if (cur.x !== x || cur.y !== y) {
        if (cones === step.cones) cones = { ...step.cones };
        cones[id as ConeId] = { x, y };
        changed = true;
      }
    }
  }
  return { chairs, balls, cones, changed };
}
