// [물리·상호작용] 켬의 키보드·방향판 이동(sweepTo)도 벽에서 선다 — 2026-11-17 기현님 "객체들이 키보드로 이동하면 코트 가장자리를 넘어감".
// 지우면 새는 실기 버그: 쓸기 동안 쥔 칩은 static 이라 Matter 벽도 안전망(escapePinnedAll)도 막지 않았고, 공·콘은 마지막에 손이 보낸
// 자리(판 밖)에 그대로 세워졌다. 휠체어 쪽은 e2e S18e 가 화면으로 잰다 — 여기는 공·콘(점) 갈래와 휠체어의 기하를 함께 잰다.
import { describe, expect, it } from 'vitest';
import { createPhysicsWorld } from './index.ts';
import { outOfBounds } from './obb.ts';
import type { DrillCast, DrillStep } from '../model/drill.ts';
import { BALL, CONE } from '../core/constants.ts';
import type { BallId, ChairId, ConeId, StepId } from '../core/ids.ts';

const ch = 'ch_a' as ChairId;
const bl = 'bl_x' as BallId;
const cn = 'cn_x' as ConeId;
const cast: DrillCast = { chairs: [{ id: ch, team: 'home', number: '2', isGk: false }], balls: [{ id: bl }], cones: [{ id: cn, colorIndex: 0 }] };

function sweptOut() {
  const api = createPhysicsWorld(825, 525);
  api.setInteract(true);
  const step: DrillStep = {
    id: 'st_x' as StepId,
    name: '',
    note: '',
    chairs: { [ch]: { x: 100, y: 100, angleDeg: 0 } },
    balls: { [bl]: { x: 100, y: 260 } },
    cones: { [cn]: { x: 100, y: 400 } },
    arrows: [],
    notes: [],
    shapes: [],
  };
  api.load(cast, step, 'full');
  // 한 번에 판 밖까지(왼쪽 −200) — 키를 누르고 있는 것과 같다
  expect(api.sweepTo([{ id: ch, pose: { x: -200, y: 100, theta: 0 } }], 0.2)).toBe(true);
  expect(api.sweepTo([{ id: bl, pose: { x: -200, y: 260, theta: 0 } }], 0.2)).toBe(true);
  expect(api.sweepTo([{ id: cn, pose: { x: -200, y: 400, theta: 0 } }], 0.2)).toBe(true);
  const s = api.read();
  api.dispose();
  return s;
}

describe('쓸기(sweepTo)도 벽에서 선다', () => {
  it('★ 휠체어는 차체가 판 안 — 쥔 칩은 static 이라 Matter 벽이 막지 않는다', () => {
    const p = sweptOut()[ch]!;
    expect(outOfBounds(p, { w: 825, h: 525 }).depth).toBeLessThanOrEqual(1e-6);
  });
  it('★ 공·콘은 반지름만큼 안에 선다 — 마지막에 손이 보낸 자리(판 밖)로 세우지 않는다', () => {
    const s = sweptOut();
    expect(s[bl]!.x).toBeGreaterThanOrEqual(BALL.radiusPx - 1e-6);
    expect(s[cn]!.x).toBeGreaterThanOrEqual(CONE.radiusPx - 1e-6);
  });
});
