// 무리 이동의 벽 — 가장 먼저 닿는 개체가 무리 전체를 세운다(키보드 무리 이동·덩어리 끌기 공통, world.groupDelta).
// 지우면 새는 실기 버그: 칩마다 따로 벽에 넣으면 벽 쪽 칩만 멈추고 나머지가 계속 들어와 **간격(포메이션)이 무너진다**.
// 순간이동(상호작용 끔·심플 모드)에서는 엔진이 없어 공·콘도 판 밖으로 나갔다 — 무리에 섞여도 같은 규칙.
import { describe, expect, it } from 'vitest';
import { createPhysicsWorld } from './index.ts';
import type { DrillCast, DrillStep } from '../model/drill.ts';
import { BALL, CHAIR } from '../core/constants.ts';
import type { BallId, ChairId, StepId } from '../core/ids.ts';

const a = 'ch_a' as ChairId;
const b = 'ch_b' as ChairId;
const ball = 'bl_x' as BallId;
const cast: DrillCast = {
  chairs: [
    { id: a, team: 'home', number: '2', isGk: false },
    { id: b, team: 'home', number: '3', isGk: false },
  ],
  balls: [{ id: ball }],
  cones: [],
};

function world(disc: boolean) {
  const api = createPhysicsWorld(825, 525);
  api.setInteract(false);
  api.setDiscBounds(disc);
  const step: DrillStep = {
    id: 'st_x' as StepId,
    name: '',
    note: '',
    // 등을 왼쪽 벽 쪽으로(θ = 0) 한 줄 — a 가 벽에 가장 가깝다
    chairs: { [a]: { x: 40, y: 200, angleDeg: 0 }, [b]: { x: 140, y: 200, angleDeg: 0 } },
    balls: { [ball]: { x: 90, y: 260 } },
    cones: {},
    arrows: [],
    notes: [],
    shapes: [],
  };
  api.load(cast, step, 'full');
  return api;
}

describe('무리 이동 — 한 덩어리로 벽에 선다', () => {
  it('★ 평소: 왼쪽으로 100 이면 벽에 가장 가까운 칩(뒤 6.5)이 닿는 만큼만 — 무리 전체가 같은 양', () => {
    const api = world(false);
    const d = api.groupDelta([a, b, ball], { x: -100, y: 0 });
    api.dispose();
    expect(d.x).toBeCloseTo(-(40 - CHAIR.pivotToRearPx));
    expect(d.y).toBe(0);
  });
  it('심플: 원(반지름 12.5)이 먼저 닿는다', () => {
    const api = world(true);
    const d = api.groupDelta([a, b, ball], { x: -100, y: 0 });
    api.dispose();
    expect(d.x).toBeCloseTo(-(40 - 12.5));
  });
  it('공이 가장 먼저 닿으면 공이 세운다 — 공·콘도 판 밖으로 안 나간다', () => {
    const api = world(false);
    const d = api.groupDelta([b, ball], { x: 0, y: 400 });
    api.dispose();
    expect(d.y).toBeCloseTo(525 - BALL.radiusPx - 260);
  });
  it('벽에서 먼 쪽으로는 줄이지 않는다', () => {
    const api = world(false);
    expect(api.groupDelta([a, b, ball], { x: 30, y: -20 })).toEqual({ x: 30, y: -20 });
    api.dispose();
  });
  it('공 하나를 순간이동으로 판 밖에 놓으면 fitToBounds 가 반지름만큼 안으로 넣는다', () => {
    const api = world(false);
    api.setPose(ball, { x: -50, y: 260 });
    expect(api.fitToBounds(ball)).toBe(true);
    expect(api.read()[ball]!.x).toBeCloseTo(BALL.radiusPx);
    api.dispose();
  });
});
