// §10.3 physics-world 통합 테스트가 쓰는 matter 엔진 헬퍼. src/physics/{world,bodies}.ts
// (physics-world 소유, Wave 2)에 의존하지 않는다 — test-fixtures 는 Wave 1 이라 그 파일들이
// 아직 없을 수 있고, §8 의존 표에도 이 모듈의 의존은 없다(matter-js 는 프로젝트 의존성).
// 여기 담는 것은 엔진 생성·스테핑·정지 판정 같은 범용 배관이고, §5.3/§5.4 의 정확한 body 생성
// 레시피(피벗 오프셋, 표면계수 복원 등)는 physics-world 자신의 테스트가 자기 코드로 검증한다.
import * as Matter from 'matter-js';

const { Engine, Body, Bodies, Composite } = Matter;

/** §5.4 ENGINE_OPTS 와 동일 값. 여기서 다시 적는 이유: physics-world 가 아직 없어도
 *  world.test.ts 가 독립적으로 엔진을 띄워볼 수 있어야 한다. */
export const TEST_ENGINE_OPTS: Matter.IEngineDefinition = {
  gravity: { x: 0, y: 0, scale: 0 },
  enableSleeping: false,
  positionIterations: 6,
  velocityIterations: 4,
  constraintIterations: 2,
};

export function createTestEngine(opts: Partial<Matter.IEngineDefinition> = {}): Matter.Engine {
  return Engine.create({ ...TEST_ENGINE_OPTS, ...opts });
}

export function addBodies(engine: Matter.Engine, ...bodies: Matter.Body[]): void {
  Composite.add(engine.world, bodies);
}

export function removeBody(engine: Matter.Engine, body: Matter.Body): void {
  Composite.remove(engine.world, body);
}

/** 고정 timestep 으로 n 스텝 전진시킨다. §5.8 의 dtMs(=1000/120) 를 기본값으로 쓴다. */
export function stepEngine(engine: Matter.Engine, steps: number, dtMs = 1000 / 120): void {
  for (let i = 0; i < steps; i++) Engine.update(engine, dtMs);
}

/** static 은 항상 rest 로 간주한다 — §5.4 allAtRest 와 같은 판정 기준(단위: px per 16.667ms). */
export function allAtRestTest(bodies: readonly Matter.Body[], eps: number): boolean {
  return bodies.every((b) => b.isStatic || Body.getSpeed(b) < eps);
}

/** predicate 가 참이 될 때까지(또는 maxMs 도달까지) 엔진을 전진시키고 경과 ms 를 반환한다.
 *  §10.3 의 "정착 조기 종료" 처럼 도달 시각 자체를 재는 테스트에 쓴다. */
export function runUntil(
  engine: Matter.Engine,
  predicate: () => boolean,
  maxMs: number,
  dtMs = 1000 / 120,
): number {
  let elapsedMs = 0;
  while (elapsedMs < maxMs) {
    Engine.update(engine, dtMs);
    elapsedMs += dtMs;
    if (predicate()) return elapsedMs;
  }
  return elapsedMs;
}

/** @types/matter-js(0.20 대응 미흡)에는 `positionPrev`/`anglePrev`가 없고 `speed` 등은
 *  readonly 로 선언돼 있다 — 전부 실제로는 런타임에 존재하고 쓰기 가능한 필드다(matter-js
 *  0.20.0 소스 `body/Body.js` 확인). 이 파일 안에서만 쓰는 좁은 확장 타입으로 캐스트한다. */
interface MutableMatterBody {
  positionPrev: { x: number; y: number };
  anglePrev: number;
  velocity: { x: number; y: number };
  speed: number;
  angularVelocity: number;
  angularSpeed: number;
}

/** §5.4 freezeKinematic 과 동일 식. 드래그 종료 직후 잔여 속도를 완전히 지운다. */
export function freezeBody(body: Matter.Body): void {
  const b = body as unknown as MutableMatterBody;
  b.positionPrev.x = body.position.x;
  b.positionPrev.y = body.position.y;
  b.anglePrev = body.angle;
  b.velocity.x = 0;
  b.velocity.y = 0;
  b.speed = 0;
  b.angularVelocity = 0;
  b.angularSpeed = 0;
}

/** matter 속도 단위(px per 16.667ms) ↔ px/s. src/core/units.ts 의 matterVToPxPerS 와 동일 식이지만
 *  이 파일은 core 를 import 하지 않는다(위 헤더 주석 참조). */
export const matterVToPxPerS = (v: number): number => v * 60;
export const pxPerSToMatterV = (v: number): number => v / 60;

/** 최소 static 사각형 body — 순수 충돌/정착 시나리오(마찰·감쇠·터널링 등)에 쓰는 범용 장애물.
 *  §5.3 의 정확한 휠체어 생성 레시피(피벗 정렬)가 필요한 테스트는 physics-world 자신의
 *  createChairBody 를 직접 써야 한다 — 이 헬퍼는 그걸 대체하지 않는다. */
export function createTestStaticBody(
  x: number,
  y: number,
  w: number,
  h: number,
  opts: Matter.IChamferableBodyDefinition = {},
): Matter.Body {
  return Bodies.rectangle(x, y, w, h, { ...opts, isStatic: true });
}

export function createTestCircleBody(
  x: number,
  y: number,
  radius: number,
  opts: Matter.IBodyDefinition = {},
): Matter.Body {
  return Bodies.circle(x, y, radius, opts);
}
