// body 생성. §5.3. matter 실측(§2.7)이 강제하는 생성 순서를 그대로 코드로 옮긴다.
import * as Matter from 'matter-js';
import type { Vec2 } from '../core/units.ts';
import { CHAIR, BALL, CONE, GOAL, WALL } from '../core/constants.ts';
import type { ChairPose } from '../model/chair.ts';

const { Body, Bodies } = Matter;

export const CAT = { CHAIR: 0x0001, BALL: 0x0002, CONE: 0x0004, WALL: 0x0008, GOAL: 0x0010 } as const;

/** `setStatic` 이 만드는 `_original` 은 @types/matter-js 에 없다(런타임에는 존재 — Body.js 확인).
 *  restore 경로(§5.3 applyStaticSurface)에서만 쓰는 좁은 확장 타입. */
interface BodyWithOriginal {
  _original?: { restitution: number; friction: number };
}

/** setStatic 이 restitution=0 / friction=1 로 강제 덮어쓰므로 body 생성 직후 호출해 표의
 *  실제 값으로 되돌린다(§2.7 실측). 되돌리지 않으면 콘↔휠체어 마찰이 0.15 대신 0.40 이 된다. */
export function applyStaticSurface(b: Matter.Body, e: number, mu: number, muS: number): void {
  b.restitution = e;
  b.friction = mu;
  b.frictionStatic = muS;
  const orig = (b as unknown as BodyWithOriginal)._original;
  if (orig) {
    orig.restitution = e;
    orig.friction = mu;
  }
}

/** body.position === 피벗 P 가 되도록 만든다. 이 순서를 절대 바꾸지 말 것(§5.3):
 *  1) 각도 0 에서 centroid 를 피벗 앞쪽 off 에 놓고 생성 (mass/density 절대 넘기지 않는다 —
 *     static + setMass 는 inertia=NaN, §2.7 실측)
 *  2) setCentre(relative:true) 로 기준점을 피벗으로 되돌림 — 이 오프셋은 월드 좌표라 각도 0
 *     에서 해야 로컬=월드로 정확하다(θ≠0 에서 하면 최대 13 px 이탈, 실측)
 *  3) 마지막에 회전 — 이제 피벗 기준으로 회전된다
 *  4) setStatic 이 덮어쓴 표면계수를 되돌린다 */
export function createChairBody(pose: ChairPose): Matter.Body {
  const off = CHAIR.centroidOffsetPx;
  const b = Bodies.rectangle(pose.x + off, pose.y, CHAIR.lengthPx, CHAIR.widthPx, {
    isStatic: true,
    label: 'chair',
    collisionFilter: { category: CAT.CHAIR, mask: CAT.BALL | CAT.CONE | CAT.WALL | CAT.GOAL, group: 0 },
  });
  Body.setCentre(b, { x: -off, y: 0 }, true);
  if (pose.theta !== 0) Body.setAngle(b, pose.theta);
  applyStaticSurface(b, CHAIR.restitution, CHAIR.friction, CHAIR.frictionStatic);
  return b;
}

/** `Bodies.circle(r=4.125)` 는 `sides = ceil(max(10,min(maxSides,radius)))` 라 항상 10각형이
 *  나온다(실측, §2.7) — `Bodies.polygon` 을 직접 쓴다. `polySides`/`polyRadiusPx` 는
 *  core/constants.ts 에 이미 외접/내접 평균으로 보정된 값이 있으므로 여기서 재계산하지 않는다.
 *  관성을 Infinity 로 두는 이유(§5.3): matter 에 구름 마찰이 없어 공 스핀이 렌더에 반영되지
 *  않고, 정지 중 휠체어 충돌로 저절로 도는 것을 막고, 시뮬을 "병진 + 명령 회전"으로 결정화한다.
 *  `Body.setInertia` 는 반드시 `Body.setMass` 다음에 호출한다(setMass 가 관성을 재스케일한다). */
/** `circleRadius` 는 Body 인스턴스의 실제 프로퍼티(런타임에 존재, `Bodies.circle` 이 채운다)지만
 *  @types/matter-js 의 `IChamferableBodyDefinition` 옵션 타입에는 없다 — 생성 옵션이 아니라
 *  생성 후 직접 대입한다. */
export function createBallBody(p: Vec2): Matter.Body {
  const b = Bodies.polygon(p.x, p.y, BALL.polySides, BALL.polyRadiusPx, {
    label: 'ball',
    restitution: BALL.restitution,
    friction: BALL.friction,
    frictionStatic: BALL.frictionStatic,
    frictionAir: BALL.frictionAir,
    collisionFilter: {
      category: CAT.BALL,
      mask: CAT.CHAIR | CAT.CONE | CAT.WALL | CAT.BALL | CAT.GOAL,
      group: 0,
    },
  });
  b.circleRadius = BALL.radiusPx;
  Body.setMass(b, BALL.massKg);
  Body.setInertia(b, Infinity);
  return b;
}

export function createConeBody(p: Vec2): Matter.Body {
  const b = Bodies.polygon(p.x, p.y, CONE.polySides, CONE.polyRadiusPx, {
    label: 'cone',
    restitution: CONE.restitution,
    friction: CONE.friction,
    frictionStatic: CONE.frictionStatic,
    frictionAir: CONE.frictionAir,
    collisionFilter: {
      category: CAT.CONE,
      mask: CAT.CHAIR | CAT.BALL | CAT.WALL | CAT.CONE | CAT.GOAL,
      group: 0,
    },
  });
  b.circleRadius = CONE.radiusPx;
  Body.setMass(b, CONE.massKg);
  Body.setInertia(b, Infinity);
  return b;
}

/** 골대 포스트. **static 이 아니다** — 실제 코트에서도 휠체어에 밀리도록 만들어져 있다
 *  (안 밀리면 안전 사고가 난다, §5.4 GOAL 주석). 공에는 밀리지 않아야 하므로 질량과 마찰을
 *  둘 다 크게 잡는다. 회전은 막는다(setInertia Infinity) — 포스트가 빙글빙글 도는 것은
 *  실물에도 없고 화면에서도 산만하다. */
export function createGoalPostBody(p: Vec2): Matter.Body {
  const b = Bodies.polygon(p.x, p.y, GOAL.polySides, GOAL.radiusPx, {
    label: 'goal',
    restitution: GOAL.restitution,
    friction: GOAL.friction,
    frictionStatic: GOAL.frictionStatic,
    frictionAir: GOAL.frictionAir,
    collisionFilter: {
      category: CAT.GOAL,
      mask: CAT.CHAIR | CAT.BALL | CAT.CONE | CAT.WALL,
      group: 0,
    },
  });
  b.circleRadius = GOAL.radiusPx;
  Body.setMass(b, GOAL.massKg);
  Body.setInertia(b, Infinity);
  return b;
}

/** §5.7 — 물리 벽은 코트 라인이 아니라 viewBox 테두리에만. 내측면이 (0,0)-(w,h) 와 정확히
 *  일치하도록 두께 WALL.thicknessPx 를 바깥으로 배치하고, 모서리 누출을 막기 위해 길이를
 *  양끝으로 두께만큼 더 늘린다. */
export function createWalls(w: number, h: number): Matter.Body[] {
  const t = WALL.thicknessPx;
  const defs: Array<{ x: number; y: number; ww: number; hh: number }> = [
    { x: w / 2, y: -t / 2, ww: w + 2 * t, hh: t }, // top
    { x: w / 2, y: h + t / 2, ww: w + 2 * t, hh: t }, // bottom
    { x: -t / 2, y: h / 2, ww: t, hh: h + 2 * t }, // left
    { x: w + t / 2, y: h / 2, ww: t, hh: h + 2 * t }, // right
  ];
  return defs.map(({ x, y, ww, hh }) => {
    const b = Bodies.rectangle(x, y, ww, hh, {
      isStatic: true,
      label: 'wall',
      collisionFilter: { category: CAT.WALL, mask: CAT.CHAIR | CAT.BALL | CAT.CONE, group: 0 },
    });
    applyStaticSurface(b, WALL.restitution, WALL.friction, WALL.frictionStatic);
    return b;
  });
}
