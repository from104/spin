// 드래그 세션(래치) 관리, substep 구동, 릴리스 체이스. §5.11.
import type { Vec2 } from '../core/units.ts';
import { INTERACT, CHAIR_SEP_PX, RESOLVE_ITERS, BALL, CONE } from '../core/constants.ts';
import type { ChairPose, DragZone } from '../model/chair.ts';
import { classifyZone } from '../model/chair.ts';
import type { CastId, ChairId } from '../core/ids.ts';
import { isId } from '../core/ids.ts';
import type { Bounds, DragLimits, GrabLatch, KinInput, ZoneState } from './types.ts';
import { grabFrom, grabFromLever, grabPoint, clampMag, stepZone } from './kinematics.ts';
import { resolveMotion, clampPointToBounds } from './obb.ts';
import type { CircleObstacle } from './obb.ts';
import type { WorldHandles } from './world.ts';
import type { HitContext, HitResult } from './hitTest.ts';

export interface DragSession {
  kind: 'chair' | 'ball' | 'cone';
  id: CastId;
  zone: DragZone | null; // ★ pointerdown 시 래치, 이후 불변
  grab: GrabLatch; // ★ 래치 (ball/cone 은 rho=0, ax/lat = 포인터-바디 오프셋)
  zoneState: ZoneState;
  target: Vec2;
  pointerId: number;
  armed: boolean;
  releasing: boolean;
  releaseStartMs: number;
  samples: Array<{ t: number; p: Vec2 }>; // 릴리스 속도 산출용 최근 3개
}

/** §5.2 완전 래치. hit.kind 가 'chair'/'zoneHandle' 이면 `pose` 는 그 휠체어의 현재 포즈,
 *  'ball'/'cone' 이면 `pose` 는 대상의 현재 위치를 담은 값(theta 는 쓰지 않는다 — 공/콘은
 *  회전하지 않으므로 grabFrom(theta=0, …) 이 곧 월드축 그대로의 ax/lat 오프셋과 같아진다).
 *  pointerId 는 호출자가 이어서 채운다(포인터 이벤트가 이 함수 시그니처 밖에 있다). */
export function beginDrag(hit: HitResult, world: Vec2, ctx: HitContext, pose: ChairPose): DragSession {
  const base = {
    target: world,
    pointerId: -1,
    armed: false,
    releasing: false,
    releaseStartMs: 0,
    samples: [] as Array<{ t: number; p: Vec2 }>,
  };

  if (hit.kind === 'chair') {
    // hitTest() 는 kind:'chair' 히트에 항상 s 를 채운다(§5.12 우선순위 2·5).
    //
    // ⚠️ `hit.zone` 이 있으면 그것이 **이긴다** — 2존 모드(§9 결정 ④ · 5.5)가 차체 전체를
    // 한 존으로 합치는 유일한 통로다(physics/twoZone.ts:applyTwoZone). 이 `??` 를 지우고
    // 언제나 classifyZone 을 부르면 토글이 켜져 있어도 앞 절반이 계속 제자리 회전이 된다.
    // hitTest() 는 차체 히트에 zone 을 채우지 않으므로, 아무도 입히지 않은 히트는
    // 지금까지와 한 글자도 다르지 않게 s 로 갈린다.
    const zone = hit.zone ?? classifyZone(hit.s!, ctx.zones);
    return { kind: 'chair', id: hit.id as ChairId, zone, grab: grabFrom(pose, world), zoneState: {}, ...base };
  }
  if (hit.kind === 'zoneHandle') {
    const zone = hit.zone!;
    return {
      kind: 'chair',
      id: hit.id as ChairId,
      zone,
      grab: grabFromLever(INTERACT.handleLeverPx[zone]),
      zoneState: {},
      ...base,
    };
  }
  if (hit.kind === 'ball' || hit.kind === 'cone') {
    const grab: GrabLatch = { ax: world.x - pose.x, lat: world.y - pose.y, rho: 0, beta: 0 };
    return { kind: hit.kind, id: hit.id as CastId, zone: null, grab, zoneState: {}, ...base };
  }
  throw new Error(`beginDrag: 드래그 불가능한 히트 종류(${hit.kind})`);
}

export function updateDragTarget(s: DragSession, world: Vec2, nowMs: number): void {
  s.target = world;
  s.samples.push({ t: nowMs, p: world });
  if (s.samples.length > 3) s.samples.shift();
}

const objectRadius = (kind: 'ball' | 'cone'): number => (kind === 'ball' ? BALL.radiusPx : CONE.radiusPx);

/** 끄는 동안 **기하로 막아야 하는** 휠체어들의 포즈 — 잠긴 칩이다.
 *
 *  왜 물리에 못 맡기는가: 끄는 칩은 `setChairDragging` 으로 static 이 되고 잠긴 칩도 static 인데,
 *  matter 는 **static–static 쌍을 아예 충돌 후보로 만들지 않는다**(Detector 가 두 바디 모두
 *  isStatic 이면 건너뛴다). 그래서 아래 'push' 모드가 이웃을 물리에 맡긴 채로 두면 잠긴 칩만
 *  통과한다(기현 신고 2026-08-15: *"잠긴 칩은 다른 칩들이 통과 못해야 한다"*).
 *
 *  잠기지 **않은** 이웃은 여전히 이 배열에 안 들어간다 — 그쪽은 dynamic 이라 물리가 밀어내고,
 *  기하로 같이 막으면 "밀린다" 가 다시 "벽에 막힌다" 로 돌아간다(아래 'push' 모드 주석). */
export interface DragBlockers {
  /** 잠긴 휠체어 — OBB 로 막는다. */
  chairs: readonly ChairPose[];
  /** 잠긴 공·콘 — 원으로 막는다. 휠체어와 형상이 달라 목록을 따로 든다(obb.CircleObstacle). */
  circles: readonly CircleObstacle[];
}

const NO_BLOCKERS: DragBlockers = { chairs: [], circles: [] };

export function stepDrag(
  s: DragSession,
  w: WorldHandles,
  lim: DragLimits,
  b: Bounds,
  dtS: number,
  blockers: DragBlockers = NO_BLOCKERS,
): void {
  if (s.kind === 'chair') {
    const chairId = s.id as ChairId;
    const cur = w.chairPose(chairId);
    const input: KinInput = { pose: cur, grab: s.grab, target: s.target, dt: dtS };
    const raw = stepZone(s.zone!, input, lim, s.zoneState);
    // ★ 'push' 모드(§5.4, 2026-08-10): 다른 휠체어를 **기하로 막지 않는다**. 빈 배열이다.
    //
    // 예전에는 여기서 SAT 로 이웃 칩에 닿기 직전까지 잘라냈다 — 휠체어끼리 물리 충돌이
    // 아예 없었기 때문에(static–static + 마스크 제외) 기하가 그 일을 대신했다. 그래서 느낌이
    // "밀린다" 가 아니라 "벽에 막힌다" 였다.
    //
    // 이제 대기 칩이 dynamic 이므로 겹침은 물리가 푼다(밀려난다). 여기서 계속 잘라내면
    // 잡은 칩이 이웃에 닿는 순간 멈춰서, 아무리 dynamic 으로 만들어도 미는 장면이 나오지
    // 않는다 — 그래서 이 둘은 한 조각으로 같이 바뀌어야 했다.
    //
    // 경계(벽)는 그대로 막는다: 코트 밖으로 나가는 것은 물리가 풀어 줄 문제가 아니다.
    // **잠긴 칩도 벽과 같은 편이다** — 밀려나지 않기로 한 것이므로 물리가 풀어 줄 수 없다
    // (`blockers` 머리말). 잠기지 않은 이웃은 여전히 빈 배열 쪽에 남는다.
    const fin = resolveMotion(cur, raw, blockers.chairs, b, CHAIR_SEP_PX, RESOLVE_ITERS, blockers.circles);
    w.setChairPose(chairId, fin, /* driven */ true);
    return;
  }

  // 공 / 콘 — §5.11 참조 구현 그대로. 래치 오프셋(ax,lat)을 보존한 채 목표점을 따라가되
  // substep 당 변위를 pointDragMaxPxPerSubstep 으로 클램프하고, updateVelocity:false + 명시적
  // setVelocity({0,0}) 으로 발사 없이 밀어내기만 하게 한다(§5.11 실측).
  const cur = w.pointOf(s.id);
  const radius = objectRadius(s.kind);
  let target: Vec2 = { x: s.target.x - s.grab.ax, y: s.target.y - s.grab.lat };
  target = clampPointToBounds(target, radius, b);
  const d = clampMag({ x: target.x - cur.x, y: target.y - cur.y }, INTERACT.pointDragMaxPxPerSubstep);
  w.setPoint(s.id, { x: cur.x + d.x, y: cur.y + d.y }, /* driven */ false);
}

export function beginRelease(s: DragSession, nowMs: number): void {
  s.releasing = true;
  s.releaseStartMs = nowMs;
}

/** 체이스 중인 "잡은 점" 의 현재 위치. 휠체어는 grabPoint(회전 반영), 공/콘은 오프셋을 되더한
 *  좌표(회전이 없으므로 오프셋이 곧 잡은점 - 바디위치)다. */
function currentGrabPoint(s: DragSession, w: WorldHandles): Vec2 {
  if (s.kind === 'chair') return grabPoint(w.chairPose(s.id as ChairId), s.grab);
  const p = w.pointOf(s.id);
  return { x: p.x + s.grab.ax, y: p.y + s.grab.lat };
}

/** 종료 조건(§5.11): |T−G| < 1px 또는 경과 > releaseChaseMs. */
export function releaseDone(s: DragSession, w: WorldHandles, nowMs: number): boolean {
  const g = currentGrabPoint(s, w);
  if (Math.hypot(s.target.x - g.x, s.target.y - g.y) < 1) return true;
  return nowMs - s.releaseStartMs > INTERACT.releaseChaseMs;
}

/** §5.10 생명주기: 체이스 종료 → freezeKinematic. settle 예약(loop.requestSettle)은 이 함수를
 *  부르는 오케스트레이터(index.ts) 몫이다 — endDrag 자체는 world 에 대한 단발 커밋만 한다. */
export function endDrag(s: DragSession, w: WorldHandles): void {
  w.freeze(s.id);
  // 손을 뗐으니 이 칩도 다시 밀릴 수 있는 몸이 된다(§5.4 'push' 모드).
  if (isId(s.id, 'ch')) w.setChairDragging(s.id as ChairId, false);
}
