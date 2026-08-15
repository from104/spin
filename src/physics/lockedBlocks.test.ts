// 잠긴 휠체어는 **다른 휠체어가 통과하지 못하는 장애물**이다 (기현 신고 2026-08-15:
// *"잠긴 칩은 다른 칩들이 통과 못해야 한다"*).
//
// ⚠️ 이 파일이 왜 필요한가 — 2026-08-15 새벽에 "잠긴 개체는 안 밀린다" 를 고치면서 잠김을
// `setBodyStatic(true)` 로 구현했고, 그 테스트(index/physicsProbe 쪽)는 **밀리는지만** 물었다.
// 그런데 끄는 칩도 `setChairDragging` 으로 static 이 되고, matter 의 Detector 는 **두 바디가
// 모두 static 이면 충돌 쌍을 아예 만들지 않는다.** 그래서 "안 밀린다" 는 지켜졌는데 그 대가로
// **통과**가 생겼다 — 잠금이 개체를 장애물이 아니라 유령으로 만든 셈이다.
//
// 여기서 재는 것은 그 통과다. 'push' 모드(drag.ts:'others' 가 빈 배열)는 그대로 두고, 잠긴
// 것만 기하 장애물로 되돌려 놓았는지 본다.
import { describe, expect, it } from 'vitest';
import { createPhysicsWorld } from './index.ts';
import type { HitResult } from './hitTest.ts';
import type { DrillCast, DrillStep } from '../model/drill.ts';
import { BALL, CONE, PHYS } from '../core/constants.ts';
import type { BallId, ChairId, ConeId, StepId } from '../core/ids.ts';

const mover = 'ch_mover' as ChairId;
const wall = 'ch_wall' as ChairId;

const cast: DrillCast = {
  chairs: [
    { id: mover, team: 'home', number: '2', isGk: false },
    { id: wall, team: 'away', number: '3', isGk: false },
  ],
  balls: [],
  cones: [],
};

/** 둘을 같은 y 에 세우고 x 로 200px 떼어 놓는다. 차체는 37.5×25 이므로 중심 간 37.5 에서 맞닿는다. */
const step = (over: Partial<DrillStep> = {}): DrillStep => ({
  id: 'st_x' as StepId,
  name: '',
  note: '',
  chairs: { [mover]: { x: 300, y: 300, angleDeg: 0 }, [wall]: { x: 500, y: 300, angleDeg: 0 } },
  balls: {},
  cones: {},
  arrows: [],
  notes: [],
  shapes: [],
  ...over,
});

/** mover 를 x=760 까지 **끌고 간다**. wall(500)을 지나쳐야만 닿는 목표다.
 *  드래그 속도에 상한이 있으므로 넉넉히 돌린다 — 도달하면 그 뒤 프레임은 제자리다. */
function dragMoverRight(over: Partial<DrillStep> = {}): { moverX: number; wallX: number } {
  const api = createPhysicsWorld(825, 525);
  api.load(cast, step(over), 'full');

  // ⚠️ s 는 **이동 구간**이어야 한다. 0.5 는 `classifyZone` 의 spin(앞 절반 = 제자리 회전)이라
  // 칩이 한 픽셀도 안 움직이고, 그러면 아래 단언들이 아무것도 안 재면서 초록이 된다(실제로 그랬다).
  const hit: HitResult = { kind: 'chair', id: mover, s: 0.25 };
  const handle = api.beginDrag(hit, { x: 300, y: 300 })!;
  expect(handle, '드래그 세션이 안 열렸다 — 이 테스트는 아무것도 못 잰다').not.toBeNull();

  let now = 0;
  for (let i = 0; i < 1400; i++) {
    now += PHYS.dtMs;
    handle.move({ x: 760, y: 300 }, now);
    api.step(PHYS.dtS);
  }
  handle.end();

  const snap = api.read();
  const out = { moverX: snap[mover]!.x, wallX: snap[wall]!.x };
  api.dispose();
  return out;
}

describe('잠긴 휠체어는 통과할 수 없다', () => {
  it('대조군: 잠기지 않았으면 끄는 칩이 상대를 **밀고 지나간다**', () => {
    const { moverX, wallX } = dragMoverRight();
    // 'push' 모드의 계약 그대로 — 막히는 게 아니라 밀어낸다. 이 단언이 깨지면 아래 ★ 는
    // "잠금이 막았다" 가 아니라 "원래 다 막힌다" 를 보고 있는 것이라 뜻이 없다.
    expect(moverX, '대조군인데 끄는 칩이 목표 근처까지 못 갔다 — push 모드가 죽었다').toBeGreaterThan(700);
    expect(wallX, '대조군인데 상대가 안 밀렸다').toBeGreaterThan(500);
  });

  it('★ 잠긴 칩은 넘어가지 못한다 — 끄는 칩이 그 앞에서 멈춘다', () => {
    const { moverX, wallX } = dragMoverRight({ locked: [wall] });
    // 맞닿는 지점은 중심 간 37.5 다. 잠긴 칩(500)의 왼쪽에 남아 있어야 한다.
    expect(moverX, '잠긴 칩을 통과했다 — static–static 이라 물리가 쌍을 안 만든다').toBeLessThan(500 - 37.5 + 1);
    // 그리고 잠긴 쪽은 한 픽셀도 안 움직인다(2026-08-15 앞 라운드의 계약).
    expect(wallX, '잠긴 칩이 밀렸다').toBeCloseTo(500, 3);
  });

  it('잠긴 칩을 지나쳐 **옆으로 돌아가는** 것은 여전히 된다 — 벽이 아니라 장애물이다', () => {
    // 접선 슬라이드(resolveMotion)가 살아 있는지. 막기만 하고 미끄러지지 않으면 붐비는 코트에서
    // 칩이 고착된다(§5.6 실측: 진행률 2.3% 고착).
    const api = createPhysicsWorld(825, 525);
    api.load(cast, step({ locked: [wall] }), 'full');
    const handle = api.beginDrag({ kind: 'chair', id: mover, s: 0.25 } as HitResult, { x: 300, y: 300 })!;
    let now = 0;
    for (let i = 0; i < 1400; i++) {
      now += PHYS.dtMs;
      // 잠긴 칩보다 한참 위를 겨냥한다 — 차체 폭 25 라 y 로 60 이면 넉넉히 비켜 간다.
      handle.move({ x: 760, y: 220 }, now);
      api.step(PHYS.dtS);
    }
    handle.end();
    const snap = api.read();
    expect(snap[mover]!.x, '비켜 갈 길이 있는데도 잠긴 칩 앞에서 멈췄다').toBeGreaterThan(700);
    expect(snap[wall]!.x, '비켜 가는데 잠긴 칩이 밀렸다').toBeCloseTo(500, 3);
    api.dispose();
  });
});

// ── 잠긴 공·콘 ────────────────────────────────────────────────────────────────────────
// 같은 static–static 함정이 원에도 있다. 잠기지 않은 공은 dynamic 이라 끄는 칩(static)이 밀지만,
// 잠그는 순간 static 이 되어 쌍이 사라진다 — 휠체어를 그 위로 그냥 끌고 지나가게 된다.
// 여기는 OBB 가 아니라 **원**으로 막는 경로(obb.CircleObstacle)를 잰다.
const ballId = 'bl_a' as BallId;
const coneId = 'cn_a' as ConeId;

const castWithPoints: DrillCast = {
  chairs: [{ id: mover, team: 'home', number: '2', isGk: false }],
  balls: [{ id: ballId }],
  cones: [{ id: coneId, colorIndex: 0 }],
};

/** 공은 길 위(x=500), 콘은 멀찍이 치워 둔다 — 한 번에 하나만 재려는 배치다. */
const pointStep = (over: Partial<DrillStep> = {}): DrillStep => ({
  id: 'st_p' as StepId,
  name: '',
  note: '',
  chairs: { [mover]: { x: 300, y: 300, angleDeg: 0 } },
  balls: { [ballId]: { x: 500, y: 300 } },
  cones: { [coneId]: { x: 500, y: 60 } },
  arrows: [],
  notes: [],
  shapes: [],
  ...over,
});

function dragMoverIntoBall(over: Partial<DrillStep> = {}): { moverX: number; ballX: number } {
  const api = createPhysicsWorld(825, 525);
  api.load(castWithPoints, pointStep(over), 'full');
  const handle = api.beginDrag({ kind: 'chair', id: mover, s: 0.25 } as HitResult, { x: 300, y: 300 })!;
  let now = 0;
  for (let i = 0; i < 1400; i++) {
    now += PHYS.dtMs;
    handle.move({ x: 760, y: 300 }, now);
    api.step(PHYS.dtS);
  }
  handle.end();
  const snap = api.read();
  const out = { moverX: snap[mover]!.x, ballX: snap[ballId]!.x };
  api.dispose();
  return out;
}

describe('잠긴 공도 통과할 수 없다 — 원 장애물', () => {
  it('대조군: 잠기지 않은 공은 밀려나고 칩은 지나간다', () => {
    const { moverX, ballX } = dragMoverIntoBall();
    expect(moverX, '대조군인데 칩이 못 갔다 — 잠기지 않은 공이 벽 노릇을 하고 있다').toBeGreaterThan(700);
    expect(ballX, '대조군인데 공이 안 밀렸다').toBeGreaterThan(500);
  });

  it('★ 잠긴 공 앞에서 멈춘다', () => {
    const { moverX, ballX } = dragMoverIntoBall({ locked: [ballId] });
    // 앞범퍼(피벗 +30)가 공 표면(500 − 4.125)에 닿는 지점이 상한이다.
    expect(moverX, '잠긴 공을 통과했다 — 원–OBB 경로가 안 걸렸다').toBeLessThan(500 - BALL.radiusPx - 30 + 1);
    expect(ballX, '잠긴 공이 밀렸다').toBeCloseTo(500, 3);
  });

  it('잠긴 **콘**도 똑같이 막는다 — 공 분기만 배선하고 끝내지 않았는지', () => {
    // 콘을 길 위로 옮기고 공은 치운다. 이 단언이 없으면 `kind === 'cone'` 가지를 통째로 지워도
    // 초록이다(반지름만 다르고 경로가 같아 눈으로는 안 갈린다).
    const api = createPhysicsWorld(825, 525);
    api.load(
      castWithPoints,
      pointStep({ balls: { [ballId]: { x: 500, y: 60 } }, cones: { [coneId]: { x: 500, y: 300 } }, locked: [coneId] }),
      'full',
    );
    const handle = api.beginDrag({ kind: 'chair', id: mover, s: 0.25 } as HitResult, { x: 300, y: 300 })!;
    let now = 0;
    for (let i = 0; i < 1400; i++) {
      now += PHYS.dtMs;
      handle.move({ x: 760, y: 300 }, now);
      api.step(PHYS.dtS);
    }
    handle.end();
    const snap = api.read();
    expect(snap[mover]!.x, '잠긴 콘을 통과했다').toBeLessThan(500 - CONE.radiusPx - 30 + 1);
    expect(snap[coneId]!.x, '잠긴 콘이 밀렸다').toBeCloseTo(500, 3);
    api.dispose();
  });

  it('잠긴 공은 **자기 크기만큼만** 막는다 — 옆 차선은 열려 있다', () => {
    // ⚠️ 처음에는 (300,300) 에서 (760,280) 으로 **대각선**으로 끌어 봤는데, 칩이 y 로 비켜나기
    //    전에 x 로 먼저 공에 닿아 막힌 자리(465.5)에 머물렀다 — 재려던 것(옆이 열려 있는가)이
    //    아니라 접선 슬라이드의 수렴 속도를 재고 있었다. 처음부터 옆 차선에 세우고 **직선**으로
    //    끈다.
    //    막히는 폭은 차체 반폭 12.5 + 공 반지름 4.125 + 여유 0.4 = 17.025 다. 30 이면 넉넉하다.
    const api = createPhysicsWorld(825, 525);
    api.load(castWithPoints, pointStep({ chairs: { [mover]: { x: 300, y: 270, angleDeg: 0 } }, locked: [ballId] }), 'full');
    const handle = api.beginDrag({ kind: 'chair', id: mover, s: 0.25 } as HitResult, { x: 300, y: 270 })!;
    let now = 0;
    for (let i = 0; i < 1400; i++) {
      now += PHYS.dtMs;
      handle.move({ x: 760, y: 270 }, now);
      api.step(PHYS.dtS);
    }
    handle.end();
    const snap = api.read();
    expect(snap[mover]!.x, '30px 옆 차선인데도 막혔다 — 원을 제 크기보다 크게 재고 있다').toBeGreaterThan(700);
    expect(snap[ballId]!.x, '스쳐 가는데 잠긴 공이 밀렸다').toBeCloseTo(500, 3);
    api.dispose();
  });
});
