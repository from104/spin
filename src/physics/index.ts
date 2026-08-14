// physics-world 공개 진입점. §5.13 "UI 가 의존하는 최소 계약"(PhysicsWorldApi)을 조립해서 만든다.
// UI(store 이상)는 이 파일에서만 import 한다 — matter-js 를 직접 보지 않는다.
import * as Matter from 'matter-js';
import type { Vec2 } from '../core/units.ts';
import { kmhToPxPerS } from '../core/units.ts';
import { CHAIR, DEFAULT_LIMITS, DEFAULT_ZONES, GOAL, PHYS } from '../core/constants.ts';
import type { ChairId, CastId } from '../core/ids.ts';
import { isId } from '../core/ids.ts';
import type { ChairPose, DragZone, ZoneConfig } from '../model/chair.ts';
import { classifyZone, poseFromStored, projectGrab } from '../model/chair.ts';
import type { DrillCast, DrillStep } from '../model/drill.ts';
// ★ §8 의 physics-world 의존 목록에는 court 가 없지만, PhysicsWorldApi.load() 시그니처(§5.13)가
// CourtMode 를 요구한다 — physics-kin 이 이미 "core, (타입만) court" 로 같은 예외를 인정받았다(§8).
// 런타임 값은 **골포스트 좌표 하나뿐**이다(§5.4 GOAL: 골대는 드릴이 아니라 코트 정의에서 온다).
// 코트 픽셀 크기(벽)는 여전히 createPhysicsWorld(courtW, courtH) 생성 시점에 호출자가 넘긴다.
// 조회는 반드시 `courtDefFor(mode, size)` 로 한다 — `COURT_DEFS[mode]` 는 풀 코트를 언제나
// 30×18 로 읽으므로 25×14 판에서 골대가 경기면 밖에 선다(§6.4).
import type { CourtMode, CourtSize } from '../model/court.ts';
import { courtDefFor } from '../model/court.ts';

import type { DragLimits, Bounds } from './types.ts';
import { createWorld, escapePinnedAll } from './world.ts';
import { escapePinned, satOverlap, separateOverlaps } from './obb.ts';
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
import { grabPoint as grabPointOf } from './kinematics.ts';

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
export { hitTest, forgivingRadius, zoneHandles, handlesVisible } from './hitTest.ts';
export type { HitResult, HitContext, SceneSnapshot, ToolId } from './hitTest.ts';
export { applyTwoZone, twoZoneViewConfig, TWO_ZONE_BODY } from './twoZone.ts';

/** §2.6 유도값과 정확히 일치(검산): kmhToPxPerS(10) = 69.4444444,
 *  kmhToPxPerS(30)/CHAIR.pivotToFrontPx(=30) = 6.9444444. bumperKmh 는 "앞범퍼 선속도" 이므로
 *  ω = v_bumper / r_bumper 로 유도한다. PhysicsWorldApi 는 사용자별 vLin/ω 설정을 받는 인자가
 *  없으므로(§5.13 계약 그대로) 기본 한도를 여기 상수로 둔다 — store(Wave 3)가 설정을 반영하려면
 *  createPhysicsWorld 의 세 번째 인자로 오버라이드하면 된다. */
export const DEFAULT_DRAG_LIMITS: DragLimits = {
  vLinPxPerS: kmhToPxPerS(DEFAULT_LIMITS.linearKmh),
  omegaRadPerS: kmhToPxPerS(DEFAULT_LIMITS.bumperKmh) / CHAIR.pivotToFrontPx,
};

/** 골대 포스트 id 접두사. cast 가 아니므로 CastId 체계(ch_/bl_/cn_)와 섞이지 않게 따로 둔다. */
export const GOAL_ID_PREFIX = 'gp_';

export interface PhysicsSnapshot {
  [id: string]: { x: number; y: number; theta: number };
}
/** 정착 완료 통지의 수신자. 인자는 **정착이 끝난 그 순간의** 스냅샷이다(§4.2 P0-2). */
export type SettleListener = (snapshot: PhysicsSnapshot) => void;
export interface DragHandle {
  readonly zone: DragZone | null;
  /** 지금 잡고 있는 지점(앵커)의 월드 좌표. 리시(연결선)는 피벗이 아니라 여기서 나가야 한다 —
   *  로프는 실제로 이 점에 묶여 있고(§5.5 C), 피벗에서 그리면 어느 존을 잡았든 똑같아 보인다. */
  readonly grabPoint: Vec2 | null;
  move(worldPt: Vec2, nowMs: number): void;
  end(): void;
}
export interface PhysicsWorldApi {
  /** §6.4 — `size` 는 **골대를 어디에 세우는가**를 정한다(§5.1 코트 크기 3단).
   *  ⚠️ 빼먹으면 25×14 판에서도 골포스트가 30×18 자리(y=187.5/337.5)에 서서, 공이
   *  **경기면 밖 허공의 골대**에 맞고 튄다. 생략하면 30×18 — `courtDefFor` 와 같은 규약이다. */
  load(cast: DrillCast, step: DrillStep, mode: CourtMode, size?: CourtSize): void;
  step(dtS: number): void;
  read(out?: PhysicsSnapshot): PhysicsSnapshot;
  /** 물리를 거치지 않은 권위 있는 재배치(키보드 이동 등)를 바디에 밀어 넣는다.
   *  이걸 안 하면 상태와 물리가 어긋나 다음 드래그가 개체를 옛 자리로 되돌린다.
   *  순간이동이지 던지기가 아니므로 잔여 속도는 지운다. */
  setPose(id: CastId, pose: { x: number; y: number; theta?: number }): void;
  /** 속도 상한을 살아 있는 월드에 즉시 반영한다(설정 토글용).
   *  드래그 도중에 바꿔도 안전하다 — stepDrag 는 매 substep 이 값을 새로 읽고, 세션 상태에는
   *  vLin/ω 가 저장돼 있지 않다. 다만 §5.11 릴리스 체이스가 진행 중이면 남은 거리를 새 속도로
   *  마저 달린다(이전 속도로 계산된 목표점은 그대로다). */
  setLimits(next: DragLimits): void;
  /** 휠체어 드래그 **존 경계**를 살아 있는 월드에 즉시 반영한다(설정 → 물리 슬라이더 3종).
   *
   *  ⚠️ 2026-08-13 5차 검증에서 고친 결함이다. 이 통로가 없던 동안 `internalHitContext()` 가
   *  `DEFAULT_ZONES` 를 **하드코딩**해서, 설정의 '후방 견인 경계 / 제자리 회전 시작 / 전방 견인
   *  시작' 을 옮겨도 실제 드래그 판정은 언제나 기본값으로 갈렸다. 음영·커서만
   *  `prefs.physics.zones` 를 따라 움직였으므로 **판이 "여기는 제자리 회전" 이라고 칠해 놓은
   *  곳을 잡으면 평행 이동이 되는** 상태였다(2존 모드와 정확히 같은 종류의 거짓말이다).
   *  되돌리면 physics/zonesWiring.test.ts 가 빨개진다. */
  setZones(next: ZoneConfig): void;
  beginDrag(hit: HitResult, grabWorld: Vec2): DragHandle | null;
  zoneAt(id: ChairId, worldPt: Vec2): DragZone | null;
  isSettled(): boolean;
  /** **정착 완료 통지**(§4.2 P0-2). requestSettle 로 열린 정착 구간이 스스로 닫히는 순간 —
   *  릴리스 체이스가 끝나고 판 위의 모든 것이 멎은 그 프레임 — 에 한 번 불린다. 반환값은 구독
   *  해제 함수다.
   *
   *  왜 필요한가: `handle.end()` 는 릴리스 체이스(최대 4초)를 **시작만** 한다. 그 직후에 읽은
   *  스냅샷은 "손 떼던 순간의 자리" 이지 "칩이 실제로 선 자리" 가 아니다 — 속도 제한이 켜져
   *  있으면 선속 69.4 px/s 라 코트 횡단에 10초가 걸린다. 이 통지가 없으면 화면과 모델이
   *  영구히 어긋나고, 스텝을 넘겼다 돌아오는 순간(world.load) 칩이 옛 자리로 되돌아간다.
   *
   *  ⚠️ 통지는 **드래그 전용이 아니다**. `resetGoals()` 도 정착을 요청하므로 그쪽 정착에도
   *  불린다 — "이번 통지가 내 드래그의 것인가" 는 구독자가 판단한다(한 번 쓰고 바로 해제하는
   *  일회성 구독이 가장 안전하다). */
  onSettled(cb: SettleListener): () => void;
  /** `골대 원위치`. 순간이동이 아니라 **0.5초 동안 구동해 밀고 들어간다** — 그 자리에 개체가
   *  있으면 물리로 비켜내고, 상한을 넘으면 정확한 좌표로 스냅한다(남은 겹침은 escapePinned).
   *  순간이동으로 하면 낀 개체가 튀어나가듯 빠져 버그처럼 보이고, 거부하면 버튼이 안 듣는
   *  막다른 길이 된다(기현과 합의, 2026-08-10).
   *
   *  ⚠️ 밀어낼 수 있는 것은 **dynamic 인 것뿐**이다(공·콘). 휠체어는 `isStatic` 이라 무한
   *  질량이어서 골대가 밀 수 없다 — 벽을 미는 것과 같다. 그 경우 원위치로 못 가므로
   *  `blocked` 로 알린다. 조용히 실패하면 사용자는 버튼이 고장난 줄 알고 계속 누른다
   *  (실제로 그렇게 신고됐다). 휠체어를 dynamic 으로 바꾸면 이 제약은 사라진다. */
  resetGoals(): { blocked: number };
  /** 골대가 원위치에서 벗어나 있는가.
   *
   *  ⚠️ **"버튼 활성 판단용" 이라고 적혀 있었지만 production 호출부가 0 이다**(2026-08-13
   *  6차 검증관 실측 — 호출부는 index.test.ts·loopLifecycle.test.ts 뿐이다). 약속한 용도가
   *  한 번도 배선된 적이 없으므로 문장을 사실로 고친다. **일부러 안 쓰는 것**이기도 하다:
   *  이것으로 [골대 원위치] 를 켜고 끄면 (a) React 가 모르는 물리 상태를 프레임마다 폴링해야
   *  하고(§6.1 규칙 1) (b) 표적이 사용 중에 상태를 바꿔 §8 점진 공개 금지에 걸린다. 실제
   *  버튼(InspectorPanel.GoalResetField)은 판 상태가 아니라 **코트 종류**로 판정한다.
   *  즉 지금 이 함수는 **테스트 전용 관측구**다 — 지우려면 그 두 테스트가 골대 이동을 다른
   *  방법으로 관측할 수 있어야 한다. */
  goalsDisplaced(): boolean;
  dispose(): void;
}

const DRAGGABLE_KINDS: ReadonlySet<HitResult['kind']> = new Set(['chair', 'zoneHandle', 'ball', 'cone']);

/** beginDrag 내부에서 쓰는 최소 HitContext. 여기서 필요한 건 zones(존 경계) 뿐이다 —
 *  drag.beginDrag 는 hit.kind==='chair' 일 때만 ctx.zones 로 classifyZone 을 다시 계산하고,
 *  나머지 필드(pxPerUnit·pointerType·…)는 UI 히트테스트 우선순위 판단에만 쓰여 여기서는
 *  읽히지 않는다(hitTest() 자체는 render-stage 가 별도로 호출한다).
 *
 *  ⚠️ `zones` 를 인자로 받는다 — 예전에는 `DEFAULT_ZONES` 리터럴이었고, 그것이 설정 슬라이더를
 *  통째로 무효화하던 자리다(setZones 주석의 실측 참고). 기본값을 남겨 둔 이유는 이 함수를
 *  부르는 자리가 월드 안뿐이라 항상 실제 값이 넘어오지만, 인자 없이 부르면 예전과 같은
 *  동작이 되도록 해 호출부를 하나라도 빠뜨렸을 때 **조용히 다른 값**이 되지 않게 하기 위해서다. */
function internalHitContext(zones: ZoneConfig = DEFAULT_ZONES): HitContext {
  return {
    zones,
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
  initialLimits: DragLimits = DEFAULT_DRAG_LIMITS,
  initialZones: ZoneConfig = DEFAULT_ZONES,
): PhysicsWorldApi {
  // 상수가 아니라 가변 홀더다 — setLimits 로 살아 있는 월드의 상한을 바꾼다.
  let limits: DragLimits = initialLimits;
  // 존 경계도 같은 이유로 가변 홀더다 — setZones 로 살아 있는 월드의 판정 경계를 바꾼다.
  // ⚠️ 이 변수가 없으면 설정의 물리 슬라이더 3종이 화면(음영)만 바꾸고 판정은 못 바꾼다.
  let zones: ZoneConfig = initialZones;
  const bounds: Bounds = { w: courtW, h: courtH };
  const world: WorldHandles = createWorld(courtW, courtH);
  const kindOf = new Map<CastId, 'chair' | 'ball' | 'cone' | 'goal'>();
  /** 골대 포스트의 **원위치**. 코트 정의에서 오고 드릴에는 저장되지 않는다(§5.4 GOAL). */
  const goalHome: Array<{ id: string; p: Vec2 }> = [];
  /** 0 이 아니면 복귀 구동 중. 이 시각을 넘기면 스냅한다. */
  let goalReturnUntilMs = 0;
  /** 이번 복귀에서 휠체어에 막힌 골대들. */
  const blockedHomes = new Set<string>();
  let session: DragSession | null = null;
  /** 정착 구간의 상한 **시각**(§4.2 P0-1). 0 이면 구간이 열려 있지 않다. loop 안의
   *  settleDeadline 과 같은 값이지만 그쪽은 밖에서 읽을 수 없고, 겹침 감시가 "상한에 닿았나"
   *  를 스스로 알아야 기하 분리 폴백을 그 프레임에 끼워 넣을 수 있다. */
  let settleUntilMs = 0;
  /** 정착 완료 통지 구독자(§4.2 P0-2). 통지 중에 해제해도 안전하도록 복사해서 순회한다. */
  const settleListeners = new Set<SettleListener>();
  // major 회귀(§5.8): 공개 step(dtS) 에 넘어온 가변 dt 를 Engine.update 에 그대로 넣지 않기
  // 위한 고정-timestep 누산기(loop.ts 의 프레임 누산 로직과 동일한 패턴). substep() 자신은
  // 인자를 무시하고 항상 PHYS.dtS/dtMs 만 쓴다 — 내부 루프(loop.start())는 이미 항상 고정 dt 로
  // 호출하지만, 공개 계약(§5.13 step(dtS))에는 그 보장이 없었다(50ms 를 넣으면 그 프레임에
  // 모든 속도가 3배가 되는 실측 버그).
  let stepAccMs = 0;

  /** 원위치가 휠체어에 막혀 있는가. 휠체어는 static 이라 골대가 밀어낼 수 없으므로, 막혀
   *  있으면 아무리 밀어도 못 들어간다 — 강제로 스냅하면 리졸버가 즉시 도로 뱉어내고 골대는
   *  다시 "벗어난" 상태가 된다(그래서 버튼을 여러 번 눌러야 하는 것처럼 보였다). */
  function homeBlockedByChair(home: Vec2): boolean {
    const chairs: ChairPose[] = [];
    for (const [id, kind] of kindOf) if (kind === 'chair') chairs.push(world.chairPose(id as ChairId));
    const out = escapePinned(home, GOAL.radiusPx, chairs, bounds);
    return out.x !== home.x || out.y !== home.y;
  }

  /** 원위치 복귀를 한 substep 만큼 진행한다. 구동(driven=true)이라 접촉면 속도가 물리적으로
   *  전달되어 길에 있는 개체를 자연스럽게 밀어낸다 — 순간이동에는 없는 성질이다. */
  function driveGoalsHome(): void {
    if (goalReturnUntilMs === 0) return;
    const stepPx = (GOAL.returnPxPerS * PHYS.dtMs) / 1000;
    let allHome = true;
    for (const g of goalHome) {
      if (blockedHomes.has(g.id)) continue; // 못 들어갈 곳으로 계속 밀면 제자리걸음만 한다
      const cur = world.pointOf(g.id as CastId);
      const dx = g.p.x - cur.x;
      const dy = g.p.y - cur.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= stepPx) {
        world.setPoint(g.id as CastId, g.p, true);
        continue;
      }
      allHome = false;
      world.setPoint(g.id as CastId, { x: cur.x + (dx / dist) * stepPx, y: cur.y + (dy / dist) * stepPx }, true);
    }
    // 상한을 넘기면 스냅한다 — 벽에 낀 휠체어 때문에 영원히 미는 상태에 갇히지 않게.
    if (allHome || performance.now() >= goalReturnUntilMs) {
      for (const g of goalHome) {
        // 막힌 곳에는 스냅하지 않는다 — 넣어도 리졸버가 즉시 뱉어내고, 그 튐이 버그로 보인다.
        if (!blockedHomes.has(g.id)) world.setPoint(g.id as CastId, g.p, false);
        world.freeze(g.id as CastId);
      }
      blockedHomes.clear();
      goalReturnUntilMs = 0;
    }
  }

  function substep(_dtS: number): void {
    if (session) stepDrag(session, world, limits, bounds, PHYS.dtS);
    driveGoalsHome();
    Matter.Engine.update(world.engine, PHYS.dtMs);
    world.applySpeedClamps();
    world.applyRollingDecel(PHYS.dtS);
    if (session?.releasing && releaseDone(session, world, performance.now())) {
      const done = session;
      session = null;
      endDrag(done, world);
      openSettle();
    }
    // ★ 안전망은 endDrag **뒤에** 돈다(§4.2 P0-3). 이 순서가 아니면 손을 뗀 그 프레임에
    // dynamic 으로 돌아온 칩이 안전망을 한 번도 못 받는다 — escapePinnedAll 은 static(=쥔)
    // 칩을 건너뛰고, 정착 술어는 그 프레임에 루프를 끌 수 있기 때문이다. 판 밖에 있던 칩을
    // 잡았다 그 자리에 놓으면 판 밖에 그대로 굳는다(1.3 이 Engine.update 와 endDrag 사이에서
    // 겪은 것과 정확히 같은 종류의 프레임 경계 문제다).
    escapePinnedAll(world, bounds);
  }

  /** api.read() 의 알맹이. 정착 통지가 `api` 객체 리터럴보다 먼저 만들어지는 loop 안에서
   *  스냅샷을 떠야 해서 따로 뺐다. */
  function readSnapshot(out?: PhysicsSnapshot): PhysicsSnapshot {
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
  }

  function notifySettled(): void {
    if (settleListeners.size === 0) return;
    const snap = readSnapshot();
    for (const cb of [...settleListeners]) cb(snap);
  }

  /** 정착 구간을 연다. loop 의 데드라인과 겹침 감시의 상한을 **같은 값**으로 맞추는 것이
   *  이 함수의 전부다 — `loop.requestSettle` 을 직접 부르면 상한이 어긋나 기하 분리 폴백이
   *  영영 안 돌거나(내 상한이 더 늦다) 물리에 기회를 덜 준다(더 이르다).
   *
   *  ★ 손이 아직 판 위에 있으면(잡고 있든 릴리스 체이스 중이든) **구간을 열지 않고 루프만
   *  살린다**(§4.2 알려진 이슈 #2, 1.5 재현). 정착 술어는 "속도 0" 이면 참이 되는데 드래그
   *  중에는 손이 멈춘 순간이 곧 속도 0 이라, 구간이 열려 있으면 그 프레임에 루프가 죽고
   *  칩이 손 밑에서 얼어붙는다 — 그 뒤로는 손을 아무리 움직여도 substep 이 안 돌고, 손을
   *  떼도 `releaseDone` 이 평가되지 않아 `endDrag` 가 영영 안 온다(칩이 static 으로 남아
   *  이웃도 못 민다). loop.ts 의 `cancelSettle` 주석이 적어 둔 바로 그 사고인데, 그쪽 방어는
   *  "새 드래그가 **옛** 구간을 닫는다" 만 막았고 "드래그 도중 **새** 구간이 열리는" 쪽은
   *  비어 있었다. 실제 경로: 한 손가락으로 칩을 잡은 채 다른 손가락으로 [골대 원위치] 를
   *  누르는 것(스테이지의 포인터 캡처는 SVG 밖 버튼을 막지 않는다).
   *
   *  이 가지로 새는 것은 없다: 이 함수를 부르는 두 곳 중 substep 의 릴리스 종료 경로는
   *  `session = null` 을 먼저 하고 부르므로 늘 아래로 내려가고, `resetGoals` 쪽은 드래그가
   *  끝나는 그 프레임에 어차피 정착 구간이 열려 골대 복귀까지 함께 덮는다. */
  function openSettle(): void {
    if (session) {
      loop.start();
      return;
    }
    settleUntilMs = performance.now() + PHYS.settleMaxMs;
    loop.requestSettle(PHYS.settleMaxMs);
  }

  /** 정착 구간을 닫는다(새 드래그가 시작될 때). §5.8 blocker 회귀 참조. */
  function closeSettle(): void {
    settleUntilMs = 0;
    loop.cancelSettle();
  }

  /** 손이 쥐고 있지 않은 휠체어들의 현재 포즈.
   *
   *  드래그 중인 칩을 빼는 이유: 그 칩은 static 이라 물리가 밀어낼 수 없고, 그 겹침은
   *  사용자가 지금 손으로 만들고 있는 것이다(손을 떼면 endDrag 가 dynamic 으로 되돌려 그때
   *  물리가 푼다). 빼지 않으면 칩을 이웃에 붙여 쥐고 있는 동안 판이 영영 안 서고(resetGoals
   *  가 정착 구간을 여는 경우), 상한이 지나면 **사용자가 쥐고 있는 칩을 기하로 옮겨 버린다.** */
  function unheldChairs(): Array<{ id: ChairId; pose: ChairPose }> {
    const out: Array<{ id: ChairId; pose: ChairPose }> = [];
    for (const [id, kind] of kindOf) {
      if (kind !== 'chair' || session?.id === id) continue;
      out.push({ id: id as ChairId, pose: world.chairPose(id as ChairId) });
    }
    return out;
  }

  /** 서로 겹친 쌍이 하나라도 있는가. margin 0 — 순수 겹침만 본다(CHAIR_SEP_PX 를 넣으면
   *  나란히 선 두 칩이 영영 "겹침" 이 된다). 문턱이 왜 0 이 아닌지는 PHYS.overlapRestPx 참조. */
  function anyOverlap(chairs: ReadonlyArray<{ pose: ChairPose }>): boolean {
    for (let i = 0; i < chairs.length; i++) {
      for (let j = i + 1; j < chairs.length; j++) {
        if (satOverlap(chairs[i]!.pose, chairs[j]!.pose, 0).depth > PHYS.overlapRestPx) return true;
      }
    }
    return false;
  }

  /** 기하 분리 1회 — 상한에 닿았을 때만 부른다. 물리에도 되먹여야 곧바로 뜨는 정착 통지의
   *  스냅샷과 화면이 같아진다(driven=false — 밀어낸 것이지 던진 것이 아니다). */
  function separateNow(chairs: ReadonlyArray<{ id: ChairId; pose: ChairPose }>): void {
    const fixed = separateOverlaps(
      chairs.map((c) => c.pose),
      bounds,
    );
    chairs.forEach((c, i) => {
      const p = fixed[i]!;
      if (p.x === c.pose.x && p.y === c.pose.y) return;
      world.setChairPose(c.id, p, false);
      world.freeze(c.id);
    });
  }

  /** loop 에 넘기는 정착 술어(§4.2 P0-1 겹친 휠체어 자가 분리).
   *
   *  `world.allAtRest()` 의 뜻은 **그대로 둔다** — 그건 "속도가 0 인가" 이고 §5.9 조기 종료
   *  골든이 정확히 그 뜻에 기대고 있다. 문제는 그 판정이 겹침을 **원리적으로 볼 수 없다**는
   *  것이다: matter 의 위치 해결(Resolver.postSolvePosition)은 positionPrev 까지 같이 옮겨
   *  속도를 만들지 않으므로, 12.5 px 겹친 두 칩도 속도로는 완벽한 정지다. 그래서 endDrag 가
   *  칩을 dynamic 으로 되돌린 그 프레임 끝에서 곧바로 stop() 이 걸려 **위치 해결이 한 번도
   *  못 돌았다**(실측: 한 substep 만 더 돌면 12.50 → 2.728, 두 번이면 0).
   *
   *  그래서 겹침이 남아 있는 동안 루프를 붙잡는다. 상한은 정착 구간과 같은 PHYS.settleMaxMs
   *  이고, 상한에 닿으면 기하 분리를 1회 강제하고 끝낸다 — 해가 없는 배치(칩 두 대가 안
   *  들어가는 좁은 판)에서 무릎 위 태블릿의 배터리를 태우지 않는다.
   *
   *  ※ 공개 `isSettled()` 는 여기 얽히지 않는다. 그건 §5.13 계약 그대로 "속도가 0 인가" 이고,
   *    "판이 다 섰다" 를 밖에 알리는 신호는 onSettled 통지다. */
  function settleReady(): boolean {
    if (performance.now() < settleUntilMs) {
      // 정상 경로: 속도가 0 이고(기존 판정 그대로) 겹침도 없어야 판이 다 선 것이다.
      return world.allAtRest() && !anyOverlap(unheldChairs());
    }
    // 상한 도달. 루프는 어차피 이 프레임에 멎는다(loop 의 데드라인이 같은 값이다) — 나가기
    // 전에 남은 겹침을 기하로 한 번 푼다. 안 그러면 8 초를 태우고도 겹친 채로 끝난다.
    // (정착 구간은 openSettle 로만 열기 때문에, 이 술어가 불리는 동안 settleUntilMs 는 항상
    //  살아 있다 — 0 인 채로 여기 오는 경로는 없다.)
    const chairs = unheldChairs();
    if (anyOverlap(chairs)) separateNow(chairs);
    return true;
  }

  const loop: PhysicsLoop = createLoop({
    step: substep,
    render: () => {}, // 렌더 보간은 render-stage 소관 — read() 를 직접 호출해 읽어간다.
    atRest: settleReady,
    onSettle: notifySettled,
  });

  const api: PhysicsWorldApi = {
    load(cast, step, mode, size) {
      for (const id of kindOf.keys()) world.remove(id);
      kindOf.clear();
      session = null;
      settleUntilMs = 0;
      loop.stop();

      // 2026-08-14 — 스텝의 상태 플래그를 여기서 읽는다.
      //  · **무시**된 휠체어는 body 를 아예 안 만든다 → 공이 통과하고 아무것도 안 밀린다.
      //    (투명도만 낮추고 body 를 두면 "안 보이는데 부딪히는" 유령이 된다.)
      //  · **잠김**은 세 종류 모두 static 이다 — 잠긴 것은 **아무것에도 안 밀린다.**
      //    ⚠️ 2026-08-14 에는 여기 *"휠체어는 원래 static 이라 잠금이 물리를 안 바꾼다"* 고
      //    적혀 있었고, 그것이 틀렸다(기현 신고 2026-08-15: *"잠긴 개체가 다른 개체에 안
      //    밀려야 된다"*). 휠체어가 static 이 되는 것은 **끄는 동안뿐**이다
      //    (`setChairDragging`) — 평소에는 dynamic 이라(bodies.ts 의 'push' 모드) 다른 칩이
      //    밀고 들어오면 그대로 밀려났다. 잘못된 주석이 테스트가 없어야 할 이유처럼 쓰였다.
      const ignored = new Set<string>(step.ignored ?? []);
      const locked = new Set<string>(step.locked ?? []);

      for (const c of cast.chairs) {
        const sp = step.chairs[c.id];
        if (!sp) continue; // 미배치 선수 — body 없음
        if (ignored.has(c.id)) continue; // 무시 — 월드에 없다
        world.addChair(c.id, poseFromStored(sp));
        kindOf.set(c.id, 'chair');
        if (locked.has(c.id)) world.setBodyStatic(c.id, true);
      }
      for (const bd of cast.balls) {
        const p = step.balls[bd.id];
        if (!p) continue;
        world.addBall(bd.id, p);
        kindOf.set(bd.id, 'ball');
        if (locked.has(bd.id)) world.setBodyStatic(bd.id, true);
      }
      for (const cd of cast.cones) {
        const p = step.cones[cd.id];
        if (!p) continue;
        world.addCone(cd.id, p);
        kindOf.set(cd.id, 'cone');
        if (locked.has(cd.id)) world.setBodyStatic(cd.id, true);
      }
      // 골대는 cast 가 아니라 **코트 정의**에서 온다(드릴에 저장되지 않는다, §5.4 GOAL).
      goalHome.length = 0;
      goalReturnUntilMs = 0;
      courtDefFor(mode, size).goalPosts.forEach((p, i) => {
        const id = `${GOAL_ID_PREFIX}${i}`;
        world.addGoalPost(id, p);
        kindOf.set(id as CastId, 'goal');
        goalHome.push({ id, p });
      });
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
      return readSnapshot(out);
    },

    setLimits(next) {
      limits = next;
    },

    setZones(next) {
      zones = next;
    },

    setPose(id, pose) {
      const kind = kindOf.get(id);
      if (!kind) return;
      if (kind === 'chair') {
        world.setChairPose(id as ChairId, { x: pose.x, y: pose.y, theta: pose.theta ?? 0 }, false);
      } else {
        world.setPoint(id, { x: pose.x, y: pose.y }, false);
      }
      // driven=false 는 임펄스를 주입하지 않을 뿐 잔여 속도를 지우지 않는다(§5.11 실측).
      // 키보드 이동 뒤에 개체가 스스로 미끄러지면 안 되므로 확실히 멈춘다.
      world.freeze(id);
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
      closeSettle();

      const pose: ChairPose =
        hit.kind === 'ball' || hit.kind === 'cone'
          ? { ...world.pointOf(hit.id as CastId), theta: 0 }
          : world.chairPose(hit.id as ChairId);

      session = beginDragSession(hit, grabWorld, internalHitContext(zones), pose);
      // 잡은 칩은 손의 권위를 갖는다 — static 이라야 §5.4 골든값(공 밀기·스핀킥)이 유지된다.
      // 대기 중인 칩만 dynamic 이어서 밀린다(world.setChairDragging 주석).
      if (isId(session.id, 'ch')) world.setChairDragging(session.id as ChairId, true);
      loop.start();

      const handle: DragHandle = {
        get zone() {
          return session?.zone ?? null;
        },
        get grabPoint() {
          if (!session) return null;
          const cur: ChairPose =
            session.kind === 'chair'
              ? world.chairPose(session.id as ChairId)
              : { ...world.pointOf(session.id), theta: 0 };
          return grabPointOf(cur, session.grab);
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
      return classifyZone(projectGrab(pose, worldPt).s, zones);
    },

    resetGoals() {
      if (goalHome.length === 0) return { blocked: 0 };
      blockedHomes.clear();
      for (const g of goalHome) {
        if (homeBlockedByChair(g.p)) blockedHomes.add(g.id);
      }
      goalReturnUntilMs = performance.now() + GOAL.returnMaxMs;
      openSettle();
      return { blocked: blockedHomes.size };
    },

    goalsDisplaced() {
      return goalHome.some((g) => {
        const cur = world.pointOf(g.id as CastId);
        return Math.hypot(cur.x - g.p.x, cur.y - g.p.y) > 0.5;
      });
    },

    isSettled() {
      return world.allAtRest();
    },

    onSettled(cb) {
      settleListeners.add(cb);
      return () => settleListeners.delete(cb);
    },

    dispose() {
      loop.stop();
      world.destroy();
      kindOf.clear();
      settleListeners.clear();
      session = null;
      settleUntilMs = 0;
    },
  };

  return api;
}
