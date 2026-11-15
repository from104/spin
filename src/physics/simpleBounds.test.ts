// 심플 모드는 **기기 표시 설정**이다 — 켜기만 했는데 저장된 자세가 바뀌면 안 된다(PLAN-SIMPLE-DRIVE 결정 A1·A4).
// 지우면 새는 실기 버그: 평소 모드에서 뒤를 왼쪽 벽에 붙인 휠체어(피벗 x = 뒤 6.5 px)는 원 기준(반지름 12.5)으로는 6 px
// "판 밖"이다. 매 substep 의 안전망(escapePinnedAll)이 원 규칙을 쓰면, 심플 모드에서 **다른** 개체를 끌기만 해도 그 칩이
// 6 px 밀리고, 드래그 정착 커밋(useEditorPointer commitPoses → stepPosesFromSnapshot)이 스냅샷 전부를 드릴에 쓴다 —
// 사용자가 손대지 않은 칩의 저장 좌표가 바뀌고 되돌리기 칸에 섞인다. 원 규칙은 **손이 옮기는 칩**(drag.ts resolveMotion)만 진다.
import { describe, expect, it } from 'vitest';
import { createPhysicsWorld } from './index.ts';
import type { HitResult } from './hitTest.ts';
import type { DrillCast, DrillStep } from '../model/drill.ts';
import { CHAIR, PHYS } from '../core/constants.ts';
import type { ChairId, StepId } from '../core/ids.ts';
import { DISC_RADIUS_PX } from '../model/chairDisc.ts';

const mover = 'ch_mover' as ChairId;
const wall = 'ch_wall' as ChairId;
const REAR = CHAIR.pivotToRearPx; // 뒤를 왼쪽 벽에 붙인 피벗 x (θ = 0)

const cast: DrillCast = {
  chairs: [
    { id: mover, team: 'home', number: '2', isGk: false },
    { id: wall, team: 'away', number: '3', isGk: false },
  ],
  balls: [],
  cones: [],
};

/** 심플 모드에서 grab 을 (from → to) 로 끌고 놓은 뒤의 피벗 x 들. */
function afterDrag(grab: ChairId, from: { x: number; y: number }, to: { x: number; y: number }): { moverX: number; wallX: number } {
  const api = createPhysicsWorld(825, 525);
  api.setInteract(false);
  api.setDiscBounds(true);
  const step: DrillStep = {
    id: 'st_x' as StepId,
    name: '',
    note: '',
    chairs: { [mover]: { x: 400, y: 300, angleDeg: 0 }, [wall]: { x: REAR, y: 100, angleDeg: 0 } },
    balls: {},
    cones: {},
    arrows: [],
    notes: [],
    shapes: [],
  };
  api.load(cast, step, 'full');
  const hit: HitResult = { kind: 'chair', id: grab, s: 0.25 };
  const handle = api.beginDrag(hit, from)!;
  let now = 0;
  for (let i = 0; i < 1400; i++) {
    now += PHYS.dtMs;
    handle.move(to, now);
    api.step(PHYS.dtS);
  }
  handle.end();
  for (let i = 0; i < 120; i++) api.step(PHYS.dtS);
  const snap = api.read();
  api.dispose();
  return { moverX: snap[mover]!.x, wallX: snap[wall]!.x };
}

describe('심플 모드 — 손대지 않은 칩의 저장 자세는 그대로', () => {
  it('★ 다른 칩을 끌어도 벽에 붙은 칩은 한 픽셀도 안 움직인다', () => {
    expect(afterDrag(mover, { x: 400, y: 300 }, { x: 600, y: 300 }).wallX).toBe(REAR);
  });
  it('벽에 붙은 칩 자신을 잡았다 그 자리에 놓아도(선택 탭) 안 움직인다', () => {
    expect(afterDrag(wall, { x: REAR, y: 100 }, { x: REAR, y: 100 }).wallX).toBe(REAR);
  });
  it('손이 옮기는 칩은 여전히 원 규칙(A4): 왼쪽 벽까지 끌면 피벗은 반지름에서 멈춘다', () => {
    expect(afterDrag(mover, { x: 400, y: 300 }, { x: -50, y: 300 }).moverX).toBeCloseTo(DISC_RADIUS_PX, 1);
  });
});
