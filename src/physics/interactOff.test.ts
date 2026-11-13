// [보드 설정] '물리·상호작용' 끔(2026-11-13 기현님 지시) — 잡은 칩은 이웃을 밀지도, 이웃에 막히지도
// 않고 겹쳐 지나간다. 켬 쪽(밀고 지나간다)의 대조군은 lockedBlocks.test.ts 의 첫 it 가 이미 잰다.
import { describe, expect, it } from 'vitest';
import { createPhysicsWorld } from './index.ts';
import type { HitResult } from './hitTest.ts';
import type { DrillCast, DrillStep } from '../model/drill.ts';
import { PHYS } from '../core/constants.ts';
import type { BallId, ChairId, StepId } from '../core/ids.ts';

const mover = 'ch_mover' as ChairId;
const wall = 'ch_wall' as ChairId;
const ball = 'bl_x' as BallId;

const cast: DrillCast = {
  chairs: [
    { id: mover, team: 'home', number: '2', isGk: false },
    { id: wall, team: 'away', number: '3', isGk: false },
  ],
  balls: [{ id: ball }],
  cones: [],
};

/** mover(300) 를 x=760 까지 끈다 — 길에 공(420)과 휠체어(500)가 서 있다. */
function dragThrough(locked: boolean): { moverX: number; wallX: number; ballX: number } {
  const api = createPhysicsWorld(825, 525);
  api.setInteract(false);
  const step: DrillStep = {
    id: 'st_x' as StepId,
    name: '',
    note: '',
    chairs: { [mover]: { x: 300, y: 300, angleDeg: 0 }, [wall]: { x: 500, y: 300, angleDeg: 0 } },
    balls: { [ball]: { x: 420, y: 300 } },
    cones: {},
    arrows: [],
    notes: [],
    shapes: [],
    ...(locked ? { locked: [wall] } : {}),
  };
  api.load(cast, step, 'full');
  // s 는 이동 구간이어야 한다(lockedBlocks.test.ts 의 같은 경고 — spin 이면 칩이 안 움직인다).
  const hit: HitResult = { kind: 'chair', id: mover, s: 0.25 };
  const handle = api.beginDrag(hit, { x: 300, y: 300 })!;
  let now = 0;
  for (let i = 0; i < 1400; i++) {
    now += PHYS.dtMs;
    handle.move({ x: 760, y: 300 }, now);
    api.step(PHYS.dtS);
  }
  handle.end();
  for (let i = 0; i < 120; i++) api.step(PHYS.dtS);
  const snap = api.read();
  const out = { moverX: snap[mover]!.x, wallX: snap[wall]!.x, ballX: snap[ball]!.x };
  api.dispose();
  return out;
}

describe('물리·상호작용 끔 — 겹쳐 지나간다', () => {
  it('잡은 칩이 공·휠체어를 밀지 않고 목표까지 간다 — 이웃은 한 픽셀도 안 움직인다', () => {
    const { moverX, wallX, ballX } = dragThrough(false);
    expect(moverX).toBeGreaterThan(700);
    expect(wallX).toBe(500);
    expect(ballX).toBe(420);
  });

  it('잠긴 칩도 막지 않는다 — 막는 것 역시 상호작용이다', () => {
    const { moverX, wallX } = dragThrough(true);
    expect(moverX).toBeGreaterThan(700);
    expect(wallX).toBe(500);
  });
});
