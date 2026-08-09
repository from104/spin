// 엔진 생성 · 개체 관리 · 포즈 read/write · freeze · 저속반발 훅. §5.4, §5.9.
import * as Matter from 'matter-js';
import { PHYS, BALL, CONE, GOAL } from '../core/constants.ts';
import type { Vec2 } from '../core/units.ts';
import type { ChairPose } from '../model/chair.ts';
import type { ChairId, BallId, ConeId, CastId } from '../core/ids.ts';
import type { Bounds, PoseBuffer } from './types.ts';
import { escapePinned } from './obb.ts';
import { createChairBody, createBallBody, createConeBody, createGoalPostBody, createWalls } from './bodies.ts';

const { Engine, Body, Composite, Events } = Matter;

/** @types/matter-js 는 `Body.setPosition`/`setAngle` 을 2-인자로만 선언하지만 런타임(0.20.0
 *  소스 `body/Body.js`)은 세 번째 `updateVelocity` 를 받는다(§5.4 가 이 인자로 스핀킥을
 *  성립시킨다) — 타입만 넓혀 다시 캐스트한다. `any` 를 쓰지 않기 위해 명시적 함수 타입을 거친다. */
type SetPositionFn = (body: Matter.Body, position: Matter.Vector, updateVelocity?: boolean) => void;
type SetAngleFn = (body: Matter.Body, angle: number, updateVelocity?: boolean) => void;
const setPosition3 = Body.setPosition as unknown as SetPositionFn;
const setAngle3 = Body.setAngle as unknown as SetAngleFn;

export const ENGINE_OPTS: Matter.IEngineDefinition = {
  gravity: { x: 0, y: 0, scale: 0 },
  enableSleeping: false, // ★ 절대 true 금지 — static 휠체어는 sleeping 인 상대와 충돌검사를 안 한다(§5.4 실측)
  positionIterations: PHYS.positionIterations,
  velocityIterations: PHYS.velocityIterations,
  constraintIterations: PHYS.constraintIterations,
};

/** @types/matter-js(0.20 대응 미흡)에는 없지만 런타임에는 존재·쓰기 가능한 필드
 *  (matter-js 0.20.0 소스 body/Body.js 확인). freezeKinematic 안에서만 쓰는 좁은 확장 타입. */
interface MutableMatterBody {
  positionPrev: { x: number; y: number };
  anglePrev: number;
  velocity: { x: number; y: number };
  speed: number;
  angularVelocity: number;
  angularSpeed: number;
}

/** 드래그 종료 시 필수(§5.4 실측: 미실행 시 1초 후 공이 47.3 px/1.30 m/s 이동).
 *  positionPrev/anglePrev 까지 현재값으로 맞춰야 다음 substep 의 Verlet 적분이 0 속도로 시작한다. */
export function freezeKinematic(b: Matter.Body): void {
  const m = b as unknown as MutableMatterBody;
  m.positionPrev.x = b.position.x;
  m.positionPrev.y = b.position.y;
  m.anglePrev = b.angle;
  m.velocity.x = 0;
  m.velocity.y = 0;
  m.speed = 0;
  m.angularVelocity = 0;
  m.angularSpeed = 0;
}

/** matter 속도 단위는 px per 16.667ms(§2.2) — maxMatter 는 반드시 BALL/CONE 의 `maxSpeedMatter`
 *  를 쓴다. `maxSpeedPxPerS` 를 그대로 넘기면 18,000 px/s 가 되어 안전밸브가 통째로 죽는다(실측). */
export function clampBodySpeed(b: Matter.Body, maxMatter: number): void {
  const v = Body.getVelocity(b);
  const s = Math.hypot(v.x, v.y);
  if (s > maxMatter) Body.setVelocity(b, { x: (v.x * maxMatter) / s, y: (v.y * maxMatter) / s });
}

/** 유한 시간 내 정확히 0 이 되는 쿨롱 구름 감속. frictionAir 만으로는 지수 꼬리가 끝없다(§5.9). */
export function applyRollingDecel(b: Matter.Body, decelPxPerS2: number, dtS: number): void {
  const dec = (decelPxPerS2 / 60) * dtS; // px/s² → matter units(px/16.667ms) per substep
  const v = Body.getVelocity(b);
  const s = Math.hypot(v.x, v.y);
  if (s <= 0) return;
  const ns = Math.max(0, s - dec);
  Body.setVelocity(b, { x: (v.x * ns) / s, y: (v.y * ns) / s });
}

export interface WorldHandles {
  readonly engine: Matter.Engine;
  addChair(id: ChairId, pose: ChairPose): void;
  addBall(id: BallId, p: Vec2): void;
  addCone(id: ConeId, p: Vec2): void;
  /** 골대 포스트. cast 가 아니므로 CastId 가 아닌 합성 id(`gp_0` …)를 쓴다 — 드릴 모델에
   *  저장되지 않고 코트 정의에서만 나온다(§5.4 GOAL). */
  addGoalPost(id: string, p: Vec2): void;
  remove(id: CastId): void;
  setChairPose(id: ChairId, pose: ChairPose, driven: boolean): void;
  setPoint(id: CastId, p: Vec2, driven: boolean): void;
  freeze(id: CastId): void;
  chairPose(id: ChairId): ChairPose;
  otherChairPoses(exceptId: ChairId): ChairPose[];
  readPoses(out: PoseBuffer): void;
  /** static 은 항상 rest 로 간주한다. 단위: px per 16.667 ms */
  allAtRest(eps?: number): boolean;
  applySpeedClamps(): void; // 매 substep 후 호출
  applyRollingDecel(dtS: number): void;
  destroy(): void;
  /** ★ §5.13 최소 계약(WorldHandles 자체)에는 없는 확장 — drag.ts(§5.11 stepDrag 공·콘)가
   *  매 substep 현재 위치를 읽어야 하는데 WorldHandles 는 원래 pose read 를 휠체어에만
   *  제공한다. WorldHandles 는 physics-world 내부 전용 타입(다른 모듈은 PhysicsWorldApi 만
   *  본다)이라 여기서 넓혀도 §8 조립 계약을 깨지 않는다. */
  pointOf(id: CastId): Vec2;
}

export function createWorld(courtW: number, courtH: number): WorldHandles {
  const engine = Engine.create(ENGINE_OPTS);
  const bodies = new Map<CastId, Matter.Body>();
  const walls = createWalls(courtW, courtH);
  Composite.add(engine.world, walls);

  // §5.9 저속 반발 훅. Resolver._restingThresh(=2.0 matter units=120 px/s=4.8 m/s, dt 무관)
  // 미만의 접근속도는 restitution 이 무시된다(실측) — lowSpeedBounceMinMatter 이상 구간만 보정한다.
  Events.on(engine, 'collisionStart', ({ pairs }) => {
    for (const p of pairs) {
      const ball = p.bodyA.label === 'ball' ? p.bodyA : p.bodyB.label === 'ball' ? p.bodyB : null;
      if (!ball) continue;
      const other = ball === p.bodyA ? p.bodyB : p.bodyA;
      if (other.label === 'ball') continue;
      let n = p.collision.normal;
      if (p.collision.bodyA !== ball) n = { x: -n.x, y: -n.y };
      const v = Body.getVelocity(ball);
      const vn = v.x * n.x + v.y * n.y;
      if (vn < -PHYS.lowSpeedBounceMinMatter && vn >= -PHYS.restingThreshMatter) {
        const j = -(1 + BALL.restitution) * vn;
        Body.setVelocity(ball, { x: v.x + n.x * j, y: v.y + n.y * j });
      }
    }
  });

  const requireChair = (id: ChairId): Matter.Body => {
    const b = bodies.get(id);
    if (!b) throw new Error(`unknown chair id: ${id}`);
    return b;
  };

  const handles: WorldHandles = {
    engine,
    addChair(id, pose) {
      const b = createChairBody(pose);
      bodies.set(id, b);
      Composite.add(engine.world, b);
    },
    addBall(id, p) {
      const b = createBallBody(p);
      bodies.set(id, b);
      Composite.add(engine.world, b);
    },
    addCone(id, p) {
      const b = createConeBody(p);
      bodies.set(id, b);
      Composite.add(engine.world, b);
    },
    addGoalPost(id, p) {
      const b = createGoalPostBody(p);
      bodies.set(id as CastId, b);
      Composite.add(engine.world, b);
    },
    remove(id) {
      const b = bodies.get(id);
      if (!b) return;
      Composite.remove(engine.world, b);
      bodies.delete(id);
    },
    setChairPose(id, pose, driven) {
      const b = requireChair(id);
      // §5.4: Engine.update 직전에 이 순서로 호출해야 Resolver.solveVelocity 가 position−positionPrev
      // 로 계산하는 접촉점 속도(스핀킥)가 물리적으로 맞게 나온다. θ 는 연속값을 그대로 넘긴다(seam 튐 방지).
      setPosition3(b, { x: pose.x, y: pose.y }, driven);
      setAngle3(b, pose.theta, driven);
    },
    setPoint(id, p, driven) {
      const b = bodies.get(id);
      if (!b) return;
      setPosition3(b, p, driven);
      // driven=false(드래그 중 갱신)는 §5.11 실측대로 setPosition(false) 뒤에도 반드시
      // setVelocity({0,0}) 을 이어서 호출해야 한다 — setPosition(false) 는 새 임펄스를 주입하지
      // 않을 뿐 기존 잔여 속도를 지우지는 않는다(positionPrev 를 같은 델타로만 이동시킨다).
      if (!driven) Body.setVelocity(b, { x: 0, y: 0 });
    },
    freeze(id) {
      const b = bodies.get(id);
      if (b) freezeKinematic(b);
    },
    chairPose(id) {
      const b = requireChair(id);
      return { x: b.position.x, y: b.position.y, theta: b.angle };
    },
    otherChairPoses(exceptId) {
      const out: ChairPose[] = [];
      for (const [id, b] of bodies) {
        if (id === exceptId || b.label !== 'chair') continue;
        out.push({ x: b.position.x, y: b.position.y, theta: b.angle });
      }
      return out;
    },
    readPoses(out) {
      const { ids, data } = out;
      for (let i = 0; i < ids.length; i++) {
        const b = bodies.get(ids[i] as CastId);
        if (!b) continue;
        data[i * 3] = b.position.x;
        data[i * 3 + 1] = b.position.y;
        data[i * 3 + 2] = b.angle;
      }
    },
    allAtRest(eps = PHYS.restSpeedMatter) {
      // static(휠체어·벽) 은 항상 rest — deltaTime 이 16.667 로 고정돼 getSpeed 가 dynamic 의
      // 2배로 나온다(실측). Composite.allBodies 로 벽까지 포함해 순회해도 static 은 항상 통과한다.
      return Composite.allBodies(engine.world).every((b) => b.isStatic || Body.getSpeed(b) < eps);
    },
    applySpeedClamps() {
      for (const b of bodies.values()) {
        if (b.isStatic) continue;
        const max = b.label === 'ball' ? BALL.maxSpeedMatter : b.label === 'cone' ? CONE.maxSpeedMatter : undefined;
        if (max !== undefined) clampBodySpeed(b, max);
      }
    },
    applyRollingDecel(dtS) {
      for (const b of bodies.values()) {
        if (b.isStatic) continue;
        const decel =
          b.label === 'ball' ? BALL.rollDecelPxPerS2 : b.label === 'cone' ? CONE.rollDecelPxPerS2 : undefined;
        if (decel !== undefined) applyRollingDecel(b, decel, dtS);
      }
    },
    destroy() {
      Composite.clear(engine.world, false);
      Events.off(engine, 'collisionStart');
    },
    pointOf(id) {
      const b = bodies.get(id);
      if (!b) throw new Error(`unknown body id: ${id}`);
      return { x: b.position.x, y: b.position.y };
    },
  };

  return handles;
}

/** §5.6 최종 안전망(escapePinned)을 월드 전체 dynamic body 에 적용한다. 매 substep 의
 *  `Engine.update` 직후 호출한다(§5.8 loop 의사코드 `escapePinnedAll()`). WorldHandles 가
 *  otherChairPoses 를 특정 id 기준으로만 주므로, 여기서는 engine 을 직접 순회해 "모든" 휠체어
 *  포즈를 모은다. */
export function escapePinnedAll(w: WorldHandles, bounds: Bounds): void {
  const allChairs: ChairPose[] = [];
  for (const b of Composite.allBodies(w.engine.world)) {
    if (b.label === 'chair') allChairs.push({ x: b.position.x, y: b.position.y, theta: b.angle });
  }
  for (const b of Composite.allBodies(w.engine.world)) {
    if (b.isStatic) continue;
    // 골대도 포함한다(§5.4): dynamic 이 된 이상 휠체어와 벽 사이에 낄 수 있는데, 그러면
    // Resolver 가 양쪽에서 반대 임펄스를 받아 상쇄되어 스스로 못 빠져나온다 — 공·콘과 같은 사정이다.
    const radius =
      b.label === 'ball' ? BALL.radiusPx : b.label === 'cone' ? CONE.radiusPx : b.label === 'goal' ? GOAL.radiusPx : undefined;
    if (radius === undefined) continue;
    const p = { x: b.position.x, y: b.position.y };
    const out = escapePinned(p, radius, allChairs, bounds);
    if (out.x !== p.x || out.y !== p.y) setPosition3(b, out, false);
  }
}
