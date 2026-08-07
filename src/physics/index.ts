// physics-world 공개 진입점. §5.13 "UI 가 의존하는 최소 계약"(PhysicsWorldApi)을 조립해서 만든다.
// UI(store 이상)는 이 파일에서만 import 한다 — matter-js 를 직접 보지 않는다.
import * as Matter from 'matter-js';
import type { Vec2 } from '../core/units.ts';
import { kmhToPxPerS } from '../core/units.ts';
import { CHAIR, DEFAULT_LIMITS, DEFAULT_ZONES, PHYS } from '../core/constants.ts';
import type { ChairId, CastId } from '../core/ids.ts';
import type { ChairPose, DragZone } from '../model/chair.ts';
import { classifyZone, poseFromStored, projectGrab } from '../model/chair.ts';
import type { DrillCast, DrillStep } from '../model/drill.ts';
// ★ 타입 전용 의존. §8 의 physics-world 의존 목록에는 court 가 없지만, PhysicsWorldApi.load()
// 시그니처(§5.13)가 CourtMode 를 요구한다 — physics-kin 이 이미 "core, (타입만) court" 로 같은
// 예외를 인정받았다(§8). 런타임 값(COURT_DEFS 등)은 쓰지 않는다: 코트 픽셀 크기는
// createPhysicsWorld(courtW, courtH) 생성 시점에 호출자가 넘긴다(벽은 그때 이미 고정).
import type { CourtMode } from '../model/court.ts';

import type { DragLimits, Bounds } from './types.ts';
import { createWorld, escapePinnedAll } from './world.ts';
import type { WorldHandles } from './world.ts';
import { createLoop } from './loop.ts';
import type { PhysicsLoop } from './loop.ts';
import {
  beginDrag as beginDragSession,
  beginRelease,
  endDrag,
  releaseDone,
  stepDrag,
  updateDragTarget,
} from './drag.ts';
import type { DragSession } from './drag.ts';
import type { HitContext, HitResult } from './hitTest.ts';

export { CAT, applyStaticSurface, createChairBody, createBallBody, createConeBody, createWalls } from './bodies.ts';
export { ENGINE_OPTS, createWorld, freezeKinematic, clampBodySpeed, applyRollingDecel, escapePinnedAll } from './world.ts';
export type { WorldHandles } from './world.ts';
export { createLoop } from './loop.ts';
export type { PhysicsLoop } from './loop.ts';
export {
  beginDrag,
  updateDragTarget,
  stepDrag,
  beginRelease,
  releaseDone,
  endDrag,
} from './drag.ts';
export type { DragSession } from './drag.ts';
export { hitTest, zoneHandles, handlesVisible } from './hitTest.ts';
export type { HitResult, HitContext, SceneSnapshot, ToolId } from './hitTest.ts';

/** §2.6 유도값과 정확히 일치(검산): kmhToPxPerS(10) = 69.4444444,
 *  kmhToPxPerS(30)/CHAIR.pivotToFrontPx(=30) = 6.9444444. bumperKmh 는 "앞범퍼 선속도" 이므로
 *  ω = v_bumper / r_bumper 로 유도한다. PhysicsWorldApi 는 사용자별 vLin/ω 설정을 받는 인자가
 *  없으므로(§5.13 계약 그대로) 기본 한도를 여기 상수로 둔다 — store(Wave 3)가 설정을 반영하려면
 *  createPhysicsWorld 의 세 번째 인자로 오버라이드하면 된다. */
export const DEFAULT_DRAG_LIMITS: DragLimits = {
  vLinPxPerS: kmhToPxPerS(DEFAULT_LIMITS.linearKmh),
  omegaRadPerS: kmhToPxPerS(DEFAULT_LIMITS.bumperKmh) / CHAIR.pivotToFrontPx,
};

export interface PhysicsSnapshot {
  [id: string]: { x: number; y: number; theta: number };
}
export interface DragHandle {
  readonly zone: DragZone | null;
  move(worldPt: Vec2, nowMs: number): void;
  end(): void;
}
export interface PhysicsWorldApi {
  load(cast: DrillCast, step: DrillStep, mode: CourtMode): void;
  step(dtS: number): void;
  read(out?: PhysicsSnapshot): PhysicsSnapshot;
  beginDrag(hit: HitResult, grabWorld: Vec2): DragHandle | null;
  zoneAt(id: ChairId, worldPt: Vec2): DragZone | null;
  isSettled(): boolean;
  dispose(): void;
}

const DRAGGABLE_KINDS: ReadonlySet<HitResult['kind']> = new Set(['chair', 'zoneHandle', 'ball', 'cone']);

/** beginDrag 내부에서 쓰는 최소 HitContext. 여기서 필요한 건 zones(존 경계) 뿐이다 —
 *  drag.beginDrag 는 hit.kind==='chair' 일 때만 ctx.zones 로 classifyZone 을 다시 계산하고,
 *  나머지 필드(pxPerUnit·pointerType·…)는 UI 히트테스트 우선순위 판단에만 쓰여 여기서는
 *  읽히지 않는다(hitTest() 자체는 render-stage 가 별도로 호출한다). */
function internalHitContext(): HitContext {
  return {
    zones: DEFAULT_ZONES,
    pxPerUnit: 1,
    pointerType: 'mouse',
    selectedChairId: null,
    selectedArrowId: null,
    handlesVisible: false,
    tool: 'select',
  };
}

export function createPhysicsWorld(
  courtW: number,
  courtH: number,
  limits: DragLimits = DEFAULT_DRAG_LIMITS,
): PhysicsWorldApi {
  const bounds: Bounds = { w: courtW, h: courtH };
  const world: WorldHandles = createWorld(courtW, courtH);
  const kindOf = new Map<CastId, 'chair' | 'ball' | 'cone'>();
  let session: DragSession | null = null;
  // major 회귀(§5.8): 공개 step(dtS) 에 넘어온 가변 dt 를 Engine.update 에 그대로 넣지 않기
  // 위한 고정-timestep 누산기(loop.ts 의 프레임 누산 로직과 동일한 패턴). substep() 자신은
  // 인자를 무시하고 항상 PHYS.dtS/dtMs 만 쓴다 — 내부 루프(loop.start())는 이미 항상 고정 dt 로
  // 호출하지만, 공개 계약(§5.13 step(dtS))에는 그 보장이 없었다(50ms 를 넣으면 그 프레임에
  // 모든 속도가 3배가 되는 실측 버그).
  let stepAccMs = 0;

  function substep(_dtS: number): void {
    if (session) stepDrag(session, world, limits, bounds, PHYS.dtS);
    Matter.Engine.update(world.engine, PHYS.dtMs);
    world.applySpeedClamps();
    world.applyRollingDecel(PHYS.dtS);
    escapePinnedAll(world, bounds);
    if (session?.releasing && releaseDone(session, world, performance.now())) {
      const done = session;
      session = null;
      endDrag(done, world);
      loop.requestSettle(PHYS.settleMaxMs);
    }
  }

  const loop: PhysicsLoop = createLoop({
    step: substep,
    render: () => {}, // 렌더 보간은 render-stage 소관 — read() 를 직접 호출해 읽어간다.
    atRest: () => world.allAtRest(),
  });

  const api: PhysicsWorldApi = {
    load(cast, step, _mode) {
      for (const id of kindOf.keys()) world.remove(id);
      kindOf.clear();
      session = null;
      loop.stop();

      for (const c of cast.chairs) {
        const sp = step.chairs[c.id];
        if (!sp) continue; // 미배치 선수 — body 없음
        world.addChair(c.id, poseFromStored(sp));
        kindOf.set(c.id, 'chair');
      }
      for (const bd of cast.balls) {
        const p = step.balls[bd.id];
        if (!p) continue;
        world.addBall(bd.id, p);
        kindOf.set(bd.id, 'ball');
      }
      for (const cd of cast.cones) {
        const p = step.cones[cd.id];
        if (!p) continue;
        world.addCone(cd.id, p);
        kindOf.set(cd.id, 'cone');
      }
    },

    step(dtS) {
      // §5.8: 가변 dt 를 그대로 엔진에 넣지 않는다. loop.ts 와 동일한 고정-substep 누산.
      stepAccMs += dtS * 1000;
      let n = 0;
      while (stepAccMs >= PHYS.dtMs && n < PHYS.maxSubsteps) {
        substep(PHYS.dtS);
        stepAccMs -= PHYS.dtMs;
        n++;
      }
      if (n === PHYS.maxSubsteps) stepAccMs = 0; // 밀린 시간은 버린다(몰아치기 금지, loop.ts 와 동일)
    },

    read(out) {
      const snap: PhysicsSnapshot = out ?? {};
      for (const [id, kind] of kindOf) {
        if (kind === 'chair') {
          const p = world.chairPose(id as ChairId);
          snap[id] = { x: p.x, y: p.y, theta: p.theta };
        } else {
          const p = world.pointOf(id);
          snap[id] = { x: p.x, y: p.y, theta: 0 };
        }
      }
      return snap;
    },

    beginDrag(hit, grabWorld) {
      if (!DRAGGABLE_KINDS.has(hit.kind)) return null;

      // major 회귀(§5.11 "사용자가 다시 탭" 종료 조건): 이전 세션(드래그 중이든 릴리스
      // 체이스 중이든)을 endDrag 없이 덮어쓰면 버려진 대상이 마지막 substep 의 잔여 속도를
      // 유지한 static body 로 남아 고스트 푸시를 일으킨다(§5.4/§2.7 실측). 새 세션을 만들기
      // 전에 반드시 정상 종료(freeze)시킨다.
      if (session) {
        endDrag(session, world);
        session = null;
      }
      // blocker 회귀(§5.8): 이전 릴리스가 requestSettle 을 걸어 둔 채였다면 그 데드라인을
      // 지운다 — 안 하면 새 드래그 도중 공이 잠깐 멎는 순간 루프가 스스로 stop 되어 버린다.
      loop.cancelSettle();

      const pose: ChairPose =
        hit.kind === 'ball' || hit.kind === 'cone'
          ? { ...world.pointOf(hit.id as CastId), theta: 0 }
          : world.chairPose(hit.id as ChairId);

      session = beginDragSession(hit, grabWorld, internalHitContext(), pose);
      loop.start();

      const handle: DragHandle = {
        get zone() {
          return session?.zone ?? null;
        },
        move(worldPt, nowMs) {
          if (session) updateDragTarget(session, worldPt, nowMs);
        },
        end() {
          if (session) beginRelease(session, performance.now());
        },
      };
      return handle;
    },

    zoneAt(id, worldPt) {
      if (kindOf.get(id) !== 'chair') return null;
      const pose = world.chairPose(id);
      return classifyZone(projectGrab(pose, worldPt).s, DEFAULT_ZONES);
    },

    isSettled() {
      return world.allAtRest();
    },

    dispose() {
      loop.stop();
      world.destroy();
      kindOf.clear();
      session = null;
    },
  };

  return api;
}
