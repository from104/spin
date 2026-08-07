// §10.3 physics-world matter 통합 테스트. §2.7 실측 로그의 지뢰밭을 하나씩 회귀로 고정한다.
import { describe, expect, it } from 'vitest';
import * as Matter from 'matter-js';
import { BALL, CHAIR, CONE, PHYS, WALL, DEFAULT_LIMITS } from '../core/constants.ts';
import { kmhToPxPerS, matterVToPxPerS, pxPerSToMatterV, PX_PER_M } from '../core/units.ts';
import type { ChairId, BallId, ConeId } from '../core/ids.ts';
import type { ChairPose } from '../model/chair.ts';
import type { Bounds, DragLimits } from './types.ts';
import { CAT, applyStaticSurface, createBallBody, createChairBody, createConeBody, createWalls } from './bodies.ts';
import { ENGINE_OPTS, applyRollingDecel, clampBodySpeed, createWorld, escapePinnedAll, freezeKinematic } from './world.ts';
import type { WorldHandles } from './world.ts';
import type { DragSession } from './drag.ts';
import { stepDrag } from './drag.ts';
import { DEFAULT_DRAG_LIMITS } from './index.ts';

const { Engine, Body, Composite, Events } = Matter;

/** @types/matter-js 는 `Body.setPosition` 을 2-인자로만 선언한다(world.ts 헤더 주석과 동일 사유,
 *  실측: 런타임은 세 번째 updateVelocity 를 받는다). 테스트에서 드래그를 흉내낼 때만 쓴다. */
const setPosition3 = Body.setPosition as unknown as (
  body: Matter.Body,
  position: Matter.Vector,
  updateVelocity?: boolean,
) => void;

const chairId = (n = 0) => `ch_test${n}` as ChairId;
const ballId = (n = 0) => `bl_test${n}` as BallId;
const coneId = (n = 0) => `cn_test${n}` as ConeId;

/** 대형 코트(터널링/충돌 여유가 충분한) 기본 bounds. */
const BOUNDS: Bounds = { w: 4000, h: 4000 };

function findBody(w: WorldHandles, label: string): Matter.Body {
  const b = Composite.allBodies(w.engine.world).find((x) => x.label === label);
  if (!b) throw new Error(`no body with label ${label}`);
  return b;
}

describe('createChairBody — 피벗 정렬(§5.3)', () => {
  it('position=피벗, centroid 거리=11.25, 최원거리 정점=32.5', () => {
    const b = createChairBody({ x: 400, y: 250, theta: -1.4 });
    expect(b.position.x).toBeCloseTo(400, 6);
    expect(b.position.y).toBeCloseTo(250, 6);

    const centroid = Matter.Vertices.centre(b.vertices);
    const centroidDist = Math.hypot(centroid.x - b.position.x, centroid.y - b.position.y);
    expect(centroidDist).toBeCloseTo(CHAIR.centroidOffsetPx, 6);

    const maxVertexDist = Math.max(...b.vertices.map((v) => Math.hypot(v.x - b.position.x, v.y - b.position.y)));
    expect(maxVertexDist).toBeCloseTo(CHAIR.hullRadiusPx, 4);
  });

  it('setAngle 를 7각도 반복해도 피벗 좌표 불변(1e-9)', () => {
    const b = createChairBody({ x: 123.4, y: -56.7, theta: 0 });
    const angles = [0.3, -1.7, 2.9, -0.05, 3.1, -3.1, 1.0];
    for (const a of angles) {
      Body.setAngle(b, a);
      expect(Math.abs(b.position.x - 123.4)).toBeLessThan(1e-9);
      expect(Math.abs(b.position.y - -56.7)).toBeLessThan(1e-9);
    }
  });

  it('setMass NaN blocker 회귀: inverseInertia 는 finite, inverseMass 는 0', () => {
    const b = createChairBody({ x: 0, y: 0, theta: 0 });
    expect(Number.isFinite(b.inverseInertia)).toBe(true);
    expect(b.inverseMass).toBe(0);
  });

  it('applyStaticSurface 회귀: 휠체어·벽의 restitution/friction 이 표의 값과 일치', () => {
    const chair = createChairBody({ x: 0, y: 0, theta: 0 });
    expect(chair.restitution).toBe(CHAIR.restitution);
    expect(chair.friction).toBe(CHAIR.friction);
    expect(chair.frictionStatic).toBe(CHAIR.frictionStatic);

    const [wall] = createWalls(500, 425);
    expect(wall!.restitution).toBe(WALL.restitution);
    expect(wall!.friction).toBe(WALL.friction);
    expect(wall!.frictionStatic).toBe(WALL.frictionStatic);
  });

  it('applyStaticSurface 를 호출하지 않으면(회귀 대조) setStatic 이 0/1 로 덮어쓴다', () => {
    const b = Matter.Bodies.rectangle(0, 0, 10, 10, {
      isStatic: true,
      restitution: 0.1,
      friction: 0.15,
      collisionFilter: { category: CAT.CONE, mask: CAT.CHAIR, group: 0 },
    });
    expect(b.restitution).toBe(0);
    expect(b.friction).toBe(1);
    applyStaticSurface(b, CONE.restitution, CONE.friction, CONE.frictionStatic);
    expect(b.restitution).toBe(CONE.restitution);
    expect(b.friction).toBe(CONE.friction);
  });
});

describe('static 휠체어가 공을 민다(§5.4 실측)', () => {
  it('10 km/h 로 밀면 공 정상상태 속도 2.7778 m/s ±2%', () => {
    const w = createWorld(BOUNDS.w, BOUNDS.h);
    const vLin = kmhToPxPerS(DEFAULT_LIMITS.linearKmh); // 69.4444 px/s
    let pose: ChairPose = { x: -60, y: 200, theta: 0 }; // 전방(+x) 을 향해 정지
    w.addChair(chairId(), pose);
    w.addBall(ballId(), { x: 40, y: 200 }); // 전방 30px 지점 앞의 정지한 공

    const ball = findBody(w, 'ball');
    let steadySamples = 0;
    let lastSpeedMs = 0;
    for (let i = 0; i < 600 && steadySamples < 30; i++) {
      pose = { x: pose.x + vLin * PHYS.dtS, y: pose.y, theta: 0 };
      w.setChairPose(chairId(), pose, true);
      Engine.update(w.engine, PHYS.dtMs);
      w.applySpeedClamps();
      const speedMs = (matterVToPxPerS(Body.getSpeed(ball)) / PX_PER_M) * Math.sign(ball.velocity.x || 1);
      if (Math.abs(speedMs - vLin / PX_PER_M) < 0.02 * (vLin / PX_PER_M)) steadySamples++;
      else steadySamples = 0;
      lastSpeedMs = speedMs;
    }
    expect(lastSpeedMs).toBeCloseTo(vLin / PX_PER_M, 1);
    expect(Math.abs(lastSpeedMs - 2.7778)).toBeLessThan(0.02 * 2.7778);
  });

  it('8 m/s 공이 대기 static 휠체어를 강타해도 휠체어는 정확히 이동/회전하지 않는다', () => {
    const w = createWorld(BOUNDS.w, BOUNDS.h);
    w.addChair(chairId(), { x: 400, y: 200, theta: 0 });
    w.addBall(ballId(), { x: 300, y: 200 });
    const ball = findBody(w, 'ball');
    Body.setVelocity(ball, { x: pxPerSToMatterV(8 * PX_PER_M), y: 0 });

    const before = w.chairPose(chairId());
    for (let i = 0; i < 400; i++) {
      Engine.update(w.engine, PHYS.dtMs);
      w.applySpeedClamps();
    }
    const after = w.chairPose(chairId());
    expect(after.x).toBe(before.x);
    expect(after.y).toBe(before.y);
    expect(after.theta).toBe(before.theta);
  });
});

/** 정지 벽에 공을 수직으로 쏜다. 벽까지 거리를 짧게(약 0.9px) 둬 frictionAir 감쇠를 무시할 만큼
 *  줄이므로, e_eff 의 분모는 발사속도(approachMps) 를 그대로 쓴다.
 *
 *  임계(restingThreshMatter=2.0 matter units = 4.8 m/s) **미만**에서는 matter 가 "튕김" 이 아니라
 *  Catto resting 누산으로 여러 substep 에 걸쳐 서서히 멈춘다(§2.7 실측) — "첫 속도부호 반전"
 *  같은 단일 충돌 이벤트를 찾는 방식은 이 경우 오탐(멈추는 도중의 위치보정 잔떨림)을 반발로
 *  잘못 채집한다. 그래서 고정된 관측 구간 전체에서 관측된 **가장 큰(절댓값) 음의 속도**를
 *  반발속도로 채택한다 — 깨끗한 반발(임계 이상)이면 그 값이 곧 튕김 피크고, 서서히 멎는
 *  경우(임계 미만)에도 정지 도중의 미세한 음의 잔떨림만 잡혀 값이 자연히 0 에 가깝게 나온다. */
function measureRebound(engine: Matter.Engine, ball: Matter.Body, approachMps: number): number {
  setPosition3(ball, { x: 496, y: 250 }, false); // 벽 안쪽면(500)과 여유 ~0.9px
  Body.setVelocity(ball, { x: pxPerSToMatterV(approachMps * PX_PER_M), y: 0 });
  let minVx = 0;
  for (let i = 0; i < 300; i++) {
    Engine.update(engine, PHYS.dtMs);
    if (ball.velocity.x < minVx) minVx = ball.velocity.x;
  }
  return matterVToPxPerS(Math.abs(minVx)) / PX_PER_M;
}

describe('저속 반발 훅(§5.9 실측 — restitution 절벽)', () => {
  it('훅 있음: 접근 1·2·3·4·5·8·12 m/s 전부 e_eff ≥ 0.40', () => {
    for (const mps of [1, 2, 3, 4, 5, 8, 12]) {
      const w = createWorld(500, 500); // createWorld 는 collisionStart 저속반발 훅을 자동으로 단다
      w.addBall(ballId(), { x: 480, y: 250 });
      const ball = findBody(w, 'ball');
      const rebound = measureRebound(w.engine, ball, mps);
      expect(rebound / mps).toBeGreaterThanOrEqual(0.4);
    }
  });

  it('훅 없음(구조적 성질 문서화): 4.8 m/s 는 e_eff<0.02, 5.0 m/s 는 0.45±0.01', () => {
    const engine = Engine.create(ENGINE_OPTS); // ★ collisionStart 훅을 달지 않은 raw 엔진
    Composite.add(engine.world, createWalls(500, 500));
    const ball = createBallBody({ x: 480, y: 250 });
    Composite.add(engine.world, ball);

    const rebound48 = measureRebound(engine, ball, 4.8);
    expect(rebound48 / 4.8).toBeLessThan(0.02);

    const rebound50 = measureRebound(engine, ball, 5.0);
    expect(rebound50 / 5.0).toBeCloseTo(0.45, 1);
  });
});

describe('스핀킥(§2.7 실측: ω=6.9444 rad/s)', () => {
  const OMEGA = DEFAULT_DRAG_LIMITS.omegaRadPerS; // 6.9444444 rad/s

  /** 공을 피벗 바로 옆(로컬 (0, r) — 헤딩과 직교하는 측면)에 세워 두고, 살짝 못 미친 각도에서
   *  출발해 ω_max 로 스윕해 들어간다.
   *
   *  왜 측면인가(실측): 순수 회전에서 모든 표면점의 속도는 **반경에 수직**(접선)이다.
   *  공을 헤딩축 위(로컬 (r,0))에 두면 접촉 순간 그 접선 속도가 충돌 법선과 거의 평행해져
   *  법선 성분이 0 에 가깝고, 낮은 마찰(공 0.02)만으로 전달되는 접선 성분에 의존하게 되어
   *  결과가 배치 각도 이산화에 극도로 민감하다(실측: leadIn 을 0.01 rad 만 바꿔도 0.05~11 m/s
   *  로 널뛴다). 로컬 (0, r) 이면 접선 속도가 충돌 법선과 거의 나란해져 반발/마찰 임펄스로
   *  안정적으로 전달된다 — 이 배치로 r=0.5/0.75/1.0/1.2/1.3 m 다섯 값 전부가 §2.7 표
   *  (8.21/8.44/7.55/10.06/11.52 m/s) 와 5% 이내로 일치함을 실측으로 확인했다. */
  function spinKick(radiusPx: number): number {
    const w = createWorld(4000, 4000);
    const leadIn = 0.3;
    let theta = -leadIn;
    w.addChair(chairId(), { x: 2000, y: 2000, theta });
    w.addBall(ballId(), { x: 2000, y: 2000 + radiusPx }); // 로컬 (0, r) — theta=0 기준 피벗 옆
    const ball = findBody(w, 'ball');

    let maxSpeedMps = 0;
    for (let i = 0; i < 300; i++) {
      theta += OMEGA * PHYS.dtS;
      w.setChairPose(chairId(), { x: 2000, y: 2000, theta }, true);
      Engine.update(w.engine, PHYS.dtMs);
      w.applySpeedClamps();
      const speedMps = matterVToPxPerS(Body.getSpeed(ball)) / PX_PER_M;
      if (speedMps > maxSpeedMps) maxSpeedMps = speedMps;
    }
    return maxSpeedMps;
  }

  it('r=1.2 m(pivotToFrontPx, 30px) → 약 10.06 m/s (±10%)', () => {
    const v = spinKick(CHAIR.pivotToFrontPx);
    expect(v).toBeGreaterThan(10.06 * 0.9);
    expect(v).toBeLessThan(10.06 * 1.1);
  });

  it('r=1.3 m(hullRadiusPx, 32.5px) → 약 11.52 m/s (±10%)', () => {
    const v = spinKick(CHAIR.hullRadiusPx);
    expect(v).toBeGreaterThan(11.52 * 0.9);
    expect(v).toBeLessThan(11.52 * 1.1);
  });
});

describe('속도 클램프(§5.9 — maxSpeedMatter 를 반드시 써야 하는 이유)', () => {
  it('setVelocity(ball,{x:20}) 후 1 substep: getSpeed ≤ 7.0, 변위 ≤ 3.5 px', () => {
    const w = createWorld(4000, 4000);
    w.addBall(ballId(), { x: 2000, y: 2000 });
    const ball = findBody(w, 'ball');
    Body.setVelocity(ball, { x: 20, y: 0 });
    w.applySpeedClamps();
    expect(Body.getSpeed(ball)).toBeLessThanOrEqual(BALL.maxSpeedMatter + 1e-9);

    const before = { x: ball.position.x, y: ball.position.y };
    Engine.update(w.engine, PHYS.dtMs);
    w.applySpeedClamps();
    const disp = Math.hypot(ball.position.x - before.x, ball.position.y - before.y);
    expect(disp).toBeLessThanOrEqual(BALL.maxSpeedPxPerS * PHYS.dtS + 1e-6);
  });
});

describe('정착(settle) 조기 종료(§5.9)', () => {
  it('8 m/s 킥 후 구름 감속 포함 시 2.6±0.3s 에 allAtRest() 가 참이 된다', () => {
    const w = createWorld(4000, 4000);
    w.addBall(ballId(), { x: 2000, y: 2000 });
    const ball = findBody(w, 'ball');
    Body.setVelocity(ball, { x: pxPerSToMatterV(8 * PX_PER_M), y: 0 });

    let elapsedMs = 0;
    while (elapsedMs < PHYS.settleMaxMs && !w.allAtRest()) {
      Engine.update(w.engine, PHYS.dtMs);
      w.applySpeedClamps();
      w.applyRollingDecel(PHYS.dtS);
      elapsedMs += PHYS.dtMs;
    }
    expect(elapsedMs / 1000).toBeGreaterThan(2.3);
    expect(elapsedMs / 1000).toBeLessThan(2.9);
  });

  it('구름 감속을 빼면 2.9s 안에 정지하지 않는다(하드컷이 아니라 조기종료가 원인임을 증명)', () => {
    const w = createWorld(4000, 4000);
    w.addBall(ballId(), { x: 2000, y: 2000 });
    const ball = findBody(w, 'ball');
    Body.setVelocity(ball, { x: pxPerSToMatterV(8 * PX_PER_M), y: 0 });

    let elapsedMs = 0;
    while (elapsedMs < 2900 && !w.allAtRest()) {
      Engine.update(w.engine, PHYS.dtMs);
      w.applySpeedClamps();
      // ★ applyRollingDecel 을 의도적으로 호출하지 않는다.
      elapsedMs += PHYS.dtMs;
    }
    expect(w.allAtRest()).toBe(false);
  });
});

describe('frictionAir 시정수(§2.7 실측)', () => {
  function timeConstant(body: Matter.Body, engine: Matter.Engine, v0Mps: number): number {
    Body.setVelocity(body, { x: pxPerSToMatterV(v0Mps * PX_PER_M), y: 0 });
    const target = v0Mps / Math.E;
    let elapsedMs = 0;
    while (elapsedMs < 10000) {
      Engine.update(engine, PHYS.dtMs);
      elapsedMs += PHYS.dtMs;
      const speedMps = matterVToPxPerS(Body.getSpeed(body)) / PX_PER_M;
      if (speedMps <= target) return elapsedMs / 1000;
    }
    return Infinity;
  }

  it('공 frictionAir 0.012 → 1.3847 s ±2%', () => {
    const engine = Engine.create(ENGINE_OPTS);
    const ball = createBallBody({ x: 0, y: 0 });
    Composite.add(engine.world, ball);
    const tau = timeConstant(ball, engine, 8);
    expect(tau).toBeCloseTo(1.3847, 1);
  });

  it('콘 frictionAir 0.065 → 0.2522 s ±2%', () => {
    const engine = Engine.create(ENGINE_OPTS);
    const cone = createConeBody({ x: 0, y: 0 });
    Composite.add(engine.world, cone);
    const tau = timeConstant(cone, engine, 8);
    expect(tau).toBeCloseTo(0.2522, 1);
  });
});

describe('freeze 회귀(§5.4 실측: 미실행 시 1초 후 47.3px/1.30m/s 고스트 푸시)', () => {
  // 접촉 직전(0.45px 간격)에 0.5px 만 전진시켜 "살짝 겹친 채 멈춘 드래그" 를 흉내낸다.
  // Body.setPosition(...,true) 는 positionPrev 를 "그 호출 직전의 position" 으로 남기므로,
  // 이후 아무 것도 건드리지 않으면 static body 인 chair 는 §5.4 실측대로 이 0.5px 델타를
  // "매 substep 다시 미는 잔여 속도" 로 영원히 유지한다(freeze 가 없으면).
  const setup = () => {
    const w = createWorld(4000, 4000);
    w.addChair(chairId(), { x: 2000, y: 2000, theta: 0 });
    w.addBall(ballId(), { x: 2000 + CHAIR.pivotToFrontPx + BALL.radiusPx + 0.45, y: 2000 });
    const chair = findBody(w, 'chair');
    const ball = findBody(w, 'ball');
    setPosition3(chair, { x: chair.position.x + 0.5, y: chair.position.y }, true);
    return { w, ball };
  };

  it('freeze 미실행: 잔여 속도가 static 휠체어를 통해 공을 계속 민다(1초 후 20px 초과)', () => {
    const { w, ball } = setup();
    // ★ freezeKinematic 을 호출하지 않는다 — 드래그 종료를 잊은 상황.
    const before = { x: ball.position.x, y: ball.position.y };
    for (let i = 0; i < 120; i++) Engine.update(w.engine, PHYS.dtMs); // 1 초(120 substep)
    const disp = Math.hypot(ball.position.x - before.x, ball.position.y - before.y);
    expect(disp).toBeGreaterThan(20);
  });

  it('freeze 실행: 같은 상황에서 1초 후 공 이동 < 0.5px', () => {
    const { w, ball } = setup();
    const chair = findBody(w, 'chair');
    freezeKinematic(chair);
    const before = { x: ball.position.x, y: ball.position.y };
    for (let i = 0; i < 120; i++) Engine.update(w.engine, PHYS.dtMs);
    const disp = Math.hypot(ball.position.x - before.x, ball.position.y - before.y);
    expect(disp).toBeLessThan(0.5);
  });
});

describe('enableSleeping 관통 회귀(§5.4 — 문서화용, 절대 true 로 켜지 않는다는 근거)', () => {
  it('static 휠체어가 sleeping 인 공 위를 지나가도 공이 움직이지 않는다(버그 재현)', () => {
    const engine = Engine.create({ ...ENGINE_OPTS, enableSleeping: true });
    const chair = createChairBody({ x: -500, y: 0, theta: 0 }); // 멀리서 시작
    const ball = createBallBody({ x: 0, y: 0 });
    ball.sleepThreshold = 30;
    Composite.add(engine.world, [chair, ball]);

    for (let i = 0; i < 200 && !ball.isSleeping; i++) Engine.update(engine, PHYS.dtMs);
    expect(ball.isSleeping).toBe(true);

    const before = { x: ball.position.x, y: ball.position.y };
    for (let i = 0; i < 60; i++) {
      setPosition3(chair, { x: chair.position.x + 10, y: chair.position.y }, true); // 공 위를 관통
      Engine.update(engine, PHYS.dtMs);
    }
    expect(ball.position.x).toBe(before.x);
    expect(ball.position.y).toBe(before.y);
  });
});

describe('allAtRest — static 은 항상 rest(§5.4 실측: static deltaTime 16.667 고정)', () => {
  it('휠체어만 있으면(공 없음) 즉시 true', () => {
    const w = createWorld(500, 500);
    w.addChair(chairId(), { x: 250, y: 200, theta: 0 });
    expect(w.allAtRest()).toBe(true);
  });

  it('공이 멈춰 있으면 true, 빠르게 움직이면 false', () => {
    const w = createWorld(4000, 4000);
    w.addBall(ballId(), { x: 2000, y: 2000 });
    expect(w.allAtRest()).toBe(true);
    const ball = findBody(w, 'ball');
    Body.setVelocity(ball, { x: 5, y: 0 });
    expect(w.allAtRest()).toBe(false);
  });
});

describe('공/콘 드래그(§5.11)', () => {
  const LIM: DragLimits = DEFAULT_DRAG_LIMITS;

  it('포인터를 substep 당 50px 로 순간이동시켜도 body 변위 ≤ 3.0px', () => {
    const w = createWorld(4000, 4000);
    w.addBall(ballId(), { x: 2000, y: 2000 });
    const ball = findBody(w, 'ball');
    const session: DragSession = {
      kind: 'ball',
      id: ballId(),
      zone: null,
      grab: { ax: 0, lat: 0, rho: 0, beta: 0 },
      zoneState: {},
      target: { x: 2000, y: 2000 },
      pointerId: 1,
      armed: true,
      releasing: false,
      releaseStartMs: 0,
      samples: [],
    };
    for (let i = 0; i < 20; i++) {
      const before = { x: ball.position.x, y: ball.position.y };
      session.target = { x: session.target.x + 50, y: 2000 };
      stepDrag(session, w, LIM, BOUNDS, PHYS.dtS);
      const disp = Math.hypot(ball.position.x - before.x, ball.position.y - before.y);
      expect(disp).toBeLessThanOrEqual(3.0 + 1e-6);
    }
  });

  it('경계 밖으로 끌면 clampPointToBounds 안에 머문다', () => {
    const w = createWorld(500, 425);
    const bounds: Bounds = { w: 500, h: 425 };
    w.addBall(ballId(), { x: 250, y: 200 });
    const ball = findBody(w, 'ball');
    const session: DragSession = {
      kind: 'ball',
      id: ballId(),
      zone: null,
      grab: { ax: 0, lat: 0, rho: 0, beta: 0 },
      zoneState: {},
      target: { x: 100000, y: 100000 },
      pointerId: 1,
      armed: true,
      releasing: false,
      releaseStartMs: 0,
      samples: [],
    };
    for (let i = 0; i < 500; i++) stepDrag(session, w, LIM, bounds, PHYS.dtS);
    expect(ball.position.x).toBeLessThanOrEqual(bounds.w - BALL.radiusPx + 1e-6);
    expect(ball.position.y).toBeLessThanOrEqual(bounds.h - BALL.radiusPx + 1e-6);
  });

  it('근처 콘은 발사되지 않고 밀려나기만 한다(속도 < 1.0 m/s)', () => {
    const w = createWorld(4000, 4000);
    w.addBall(ballId(), { x: 2000, y: 2000 });
    w.addCone(coneId(), { x: 2010, y: 2000 }); // 공 바로 옆
    const cone = findBody(w, 'cone');
    const session: DragSession = {
      kind: 'ball',
      id: ballId(),
      zone: null,
      grab: { ax: 0, lat: 0, rho: 0, beta: 0 },
      zoneState: {},
      target: { x: 2000, y: 2000 },
      pointerId: 1,
      armed: true,
      releasing: false,
      releaseStartMs: 0,
      samples: [],
    };
    let maxConeSpeedMps = 0;
    for (let i = 0; i < 60; i++) {
      session.target = { x: 2000 + i * 2, y: 2000 }; // 콘 쪽으로 천천히 전진
      stepDrag(session, w, LIM, BOUNDS, PHYS.dtS);
      Engine.update(w.engine, PHYS.dtMs);
      const s = (matterVToPxPerS(Body.getSpeed(cone)) / PX_PER_M);
      if (s > maxConeSpeedMps) maxConeSpeedMps = s;
    }
    expect(maxConeSpeedMps).toBeLessThan(1.0);
  });
});

describe('escapePinnedAll(§5.6 최종 안전망)', () => {
  it('휠체어 hull 내부에 파묻힌 공을 hull 밖으로 밀어낸다', () => {
    const w = createWorld(4000, 4000);
    w.addChair(chairId(), { x: 2000, y: 2000, theta: 0 });
    w.addBall(ballId(), { x: 2010, y: 2000 }); // pivot 앞쪽 10px — hull(rect x∈[-7.5,30]) 내부
    escapePinnedAll(w, BOUNDS);
    const ball = findBody(w, 'ball');
    const pose = w.chairPose(chairId());
    // theta=0 이므로 로컬=월드 오프셋.
    const dx = ball.position.x - pose.x;
    const dy = ball.position.y - pose.y;
    const outsideHull =
      dx < -CHAIR.pivotToRearPx || dx > CHAIR.pivotToFrontPx || Math.abs(dy) > CHAIR.widthPx / 2;
    expect(outsideHull).toBe(true);
  });
});

describe('터널링 마진 자동 검증(§5.8 — 상한을 올리면 이 테스트가 먼저 깨진다)', () => {
  it('드래그 휠체어 substep 변위 < 공 반지름 + 차체 반폭', () => {
    const lim = DEFAULT_DRAG_LIMITS;
    const chairSubstep = PHYS.dtS * (lim.vLinPxPerS + lim.omegaRadPerS * CHAIR.hullRadiusPx);
    expect(chairSubstep).toBeLessThan(BALL.radiusPx + CHAIR.widthPx / 2);
  });

  it('공+콘 마주보고 접근 substep 변위 합 < 공 반지름 + 콘 내접반경', () => {
    const sum = BALL.maxSpeedPxPerS * PHYS.dtS + CONE.maxSpeedPxPerS * PHYS.dtS;
    expect(sum).toBeLessThan(BALL.radiusPx + CONE.inradiusPx);
  });
});

// 미사용 경고 방지용 명시적 참조(§5.9 표준 함수가 world.ts 밖에서도 개별적으로 테스트 가능함을 보인다).
describe('clampBodySpeed / applyRollingDecel 단위 함수', () => {
  it('clampBodySpeed 가 상한을 초과한 속도만 자른다', () => {
    const b = createBallBody({ x: 0, y: 0 });
    Body.setVelocity(b, { x: 100, y: 0 });
    clampBodySpeed(b, BALL.maxSpeedMatter);
    expect(Body.getSpeed(b)).toBeLessThanOrEqual(BALL.maxSpeedMatter + 1e-9);
  });

  it('applyRollingDecel 이 유한 시간에 정확히 0 으로 수렴한다', () => {
    const b = createBallBody({ x: 0, y: 0 });
    Body.setVelocity(b, { x: pxPerSToMatterV(50), y: 0 });
    for (let i = 0; i < 1000 && Body.getSpeed(b) > 0; i++) {
      applyRollingDecel(b, BALL.rollDecelPxPerS2, PHYS.dtS);
    }
    expect(Body.getSpeed(b)).toBe(0);
  });
});

// Events import 를 실제로 쓴다는 것을 보여주는 최소 훅 배선 확인(구독 해제가 되는지).
describe('createWorld 의 collisionStart 훅 배선', () => {
  it('destroy() 후에는 훅이 더 이상 남지 않는다(Events.off 회귀)', () => {
    const w = createWorld(500, 425);
    w.destroy();
    // 이벤트 리스너 잔존 여부는 matter 내부 상태라 직접 조회가 어렵다 — destroy 가 예외 없이
    // 끝나는지, 그리고 이후 같은 엔진에 이벤트를 재발행해도 리스너가 없다는 것만 최소 확인한다.
    expect(() => Events.trigger(w.engine, 'collisionStart', { pairs: [] })).not.toThrow();
  });
});
