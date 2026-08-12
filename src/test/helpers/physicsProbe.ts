// 0차 0.2 — 물리 실측 하네스. 헤드리스로 월드를 세우고 **프레임마다 한 행**을 찍는다:
// 각 개체의 좌표·각도(api.read()), 지정한 쌍의 겹침 깊이, 루프 start/stop 전이, isSettled().
// "언제 멎었나 / 멎었을 때 판이 유효했나" 를 같은 행에서 볼 수 있게 하는 것이 이 파일의 전부다.
//
// matterHarness.ts 에 얹지 않고 별도 파일로 만든 이유: 그 파일의 헤더가 "src/physics/{world,
// bodies}.ts 에 의존하지 않는다" 를 명시한 의도적 독립 배관인데(Wave 1), 이 하네스는 반대로
// PhysicsWorldApi·PHYS·bodies 의 **생성 레시피 그 자체**에 의존해야 한다(재려는 것이 그 계약이다).
// 다만 stepEngine/runUntil/allAtRestTest 의 시그니처 관용구는 그대로 따랐다.
//
// ── src 를 한 줄도 고치지 않기 위해 쓴 우회로 세 가지 ──────────────────────────────────
//  (1) 루프 생사: PhysicsLoop.isRunning() 은 있지만 PhysicsWorldApi 가 노출하지 않는다.
//      index.test.ts:131-142 의 관용구(createLoop 스파이 데코레이터)로 실제 loop 를 감싸 붙든다.
//      ★ loop.ts 의 **자동 stop**(정착 조기 종료, loop.ts:44-48)은 클로저 내부 stop() 이라
//      데코레이터에 걸리지 않는다 — 그래서 start/stop 은 호출이 아니라 **프레임마다 isRunning()
//      을 폴링한 전이**로 기록한다. requestSettle/cancelSettle 만 호출 그대로 찍는다.
//  (2) substep 수: 한 substep 은 Matter.Engine.update 를 정확히 한 번 부른다(index.ts:195).
//      index.test.ts:110 의 관용구대로 그 호출을 세어 "이 프레임에 몇 번 돌았나" 를 얻는다.
//  (3) 겹침 깊이: 월드의 실제 body 에 닿을 구멍이 없다(engine 미노출). api.read() 포즈로
//      physics/bodies.ts 의 **같은 생성 레시피**로 버릴 바디를 떠서 Matter.Collision.collides
//      로 잰다 — 레시피가 같으므로 실제 월드의 형상과 일치한다(휠체어끼리는 obb.satOverlap
//      으로 교차검증할 수 있다: chairSatDepth()).
//
// rAF/performance.now 는 loop.test.ts:8-31 의 관용구대로 결정적으로 흉내낸다. 목킹 없이 jsdom
// 실 rAF 를 두면 await 하는 순간 프레임이 몰래 끼어들어 이중 스텝이 된다.
//
// ⚠️ 이 하네스가 지금 못박고 있는 것은 **버그다**(P0-1: endDrag 직후 겹친 채로 루프가 죽고
// isSettled()===true). 1.3 이 그 버그를 고치면 physicsProbe.test.ts 의 골든값(깊이·프레임 수)은
// 반드시 갱신해야 한다 — 하네스 자체(이 파일)는 그대로 쓸 수 있게 만들었다.
import * as Matter from 'matter-js';
import { vi } from 'vitest';
import { PHYS } from '../../core/constants.ts';
import type { Vec2 } from '../../core/units.ts';
import type { BallId, CastId, ChairId, ConeId, StepId } from '../../core/ids.ts';
import type { ChairPose } from '../../model/chair.ts';
import type { CourtMode } from '../../model/court.ts';
import { COURT_DEFS } from '../../model/court.ts';
import type { DrillCast, DrillStep } from '../../model/drill.ts';
import { createBallBody, createChairBody, createConeBody, createGoalPostBody } from '../../physics/bodies.ts';
import { satOverlap } from '../../physics/obb.ts';
import * as dragModule from '../../physics/drag.ts';
import * as loopModule from '../../physics/loop.ts';
import type { PhysicsLoop } from '../../physics/loop.ts';
import type { DragLimits } from '../../physics/types.ts';
import type { HitResult } from '../../physics/hitTest.ts';
import { createPhysicsWorld, GOAL_ID_PREFIX } from '../../physics/index.ts';
import type { DragHandle, PhysicsSnapshot, PhysicsWorldApi } from '../../physics/index.ts';

export type ProbeKind = 'chair' | 'ball' | 'cone' | 'goal';

export interface ProbeChair {
  id: ChairId;
  x: number;
  y: number;
  angleDeg?: number;
}
export interface ProbePoint {
  id: BallId | ConeId;
  x: number;
  y: number;
}

export interface ProbeSetup {
  /** 코트 모드. 벽·골대는 여기서 나온다(기본 'full' = 825×525). */
  mode?: CourtMode;
  chairs?: readonly ProbeChair[];
  balls?: readonly ProbePoint[];
  cones?: readonly ProbePoint[];
  limits?: DragLimits;
  /** 매 프레임 깊이를 잴 쌍. 나중에 watch() 로 더 붙일 수 있다. */
  watch?: ReadonlyArray<readonly [string, string]>;
}

/** 프레임 한 행 — 이 하네스의 산출물 전부가 여기 들어 있다. */
export interface ProbeFrame {
  frame: number;
  /** 가상 클럭(ms). 프레임당 PHYS.dtMs(+FRAME_SLACK_MS) 씩 흐른다. */
  tMs: number;
  /** 이 프레임에 실제로 돈 substep 수. 루프가 멎어 있으면 0 이다. */
  substeps: number;
  /** 프레임이 끝난 시점의 loop.isRunning(). */
  running: boolean;
  /** 프레임이 끝난 시점의 api.isSettled(). */
  settled: boolean;
  /** api.read() 스냅샷(이 행 전용 사본). 골대(gp_*)도 들어 있다. */
  poses: PhysicsSnapshot;
  /** watch 한 쌍의 겹침 깊이(px). 분리돼 있으면 0. 키는 `a|b`. */
  depths: Record<string, number>;
}

export type LoopEventKind = 'start' | 'stop' | 'settle' | 'cancelSettle';
export interface LoopEvent {
  /** 이 사건이 일어난(또는 곧 기록될) 프레임 번호. */
  frame: number;
  tMs: number;
  kind: LoopEventKind;
}

export type SessionEventKind = 'beginDrag' | 'release' | 'endDrag';
export interface SessionEvent {
  frame: number;
  tMs: number;
  kind: SessionEventKind;
  id: string;
}

export interface PhysicsProbe {
  /** 감싸고 있는 실제 공개 API. 하네스가 안 감싼 계약을 직접 부를 때 쓴다. */
  readonly api: PhysicsWorldApi;
  readonly trace: readonly ProbeFrame[];
  readonly loopEvents: readonly LoopEvent[];
  readonly sessionEvents: readonly SessionEvent[];
  /** 다음에 기록될 프레임 번호(= 지금까지 기록한 행 수). */
  frame(): number;
  tMs(): number;
  isRunning(): boolean;
  /** 겹침을 매 프레임 기록할 쌍을 추가한다. 이미 등록된 쌍이면 무시한다. */
  watch(a: string, b: string): void;
  /** 지금 이 순간의 겹침 깊이(px). 분리돼 있으면 0. */
  depthBetween(a: string, b: string): number;
  /** 휠체어↔휠체어 전용 교차검증 경로 — matter 가 아니라 obb.satOverlap(margin 0)로 잰다. */
  chairSatDepth(a: ChairId, b: ChairId): number;
  /** pointerdown. grabWorld 기본값은 대상의 현재 위치(휠체어는 피벗)다. */
  startDrag(id: CastId, grabWorld?: Vec2, s?: number): void;
  moveTo(worldPt: Vec2): void;
  /** pointerup(= DragHandle.end()). 실제 drag.endDrag(freeze + dynamic 복귀)는 몇 substep 뒤
   *  릴리스 체이스가 끝날 때 일어난다 — sessionEvents 의 'endDrag' 가 그 프레임이다. */
  endDrag(): void;
  /** rAF 프레임을 n 번 흘린다(앱과 같은 구동 경로). 루프가 멎어 있으면 아무것도 돌지 않지만
   *  그 사실도 한 행으로 기록한다(substeps 0). */
  stepFrames(n: number): void;
  /** 루프와 무관하게 api.step(PHYS.dtS) 로 substep 을 강제한다 — "루프가 한 프레임만 더 돌았다면"
   *  을 재는 반사실 도구다. 루프가 살아 있는 동안 쓰면 이중 구동이 되니 섞지 말 것. */
  forceSteps(n: number): void;
  /** 정착까지 프레임을 흘리고 걸린 프레임 수를 반환한다. 초과하면 던진다. */
  runUntilSettled(o?: { maxFrames?: number }): number;
  /** 루프가 멎을 때까지 프레임을 흘리고 걸린 프레임 수를 반환한다. 초과하면 던진다. */
  runUntilLoopStops(o?: { maxFrames?: number }): number;
  /** 사람이 읽는 표. 실패 메시지나 조사 리포트에 그대로 붙일 용도. */
  formatTrace(): string;
  dispose(): void;
}

const pairKey = (a: string, b: string): string => `${a}|${b}`;

/** 프레임당 시간 전진량에 얹는 티끌. 정확히 PHYS.dtMs 씩만 더하면 loop.ts 의 누산기가
 *  `acc += (now − last)` 에서 1 ULP(≈1.8e-15 ms) 씩 모자라거나 남아, **어떤 프레임은 substep 이
 *  0 번, 다음 프레임은 2 번** 돈다(실측: 30 프레임 중 3 번). 프레임과 substep 이 1:1 이 아니면
 *  "이 프레임에 몇 번 돌았나" 라는 관측 자체가 흐려지므로, 부동소수 오차보다 크고 dtMs 보다는
 *  까마득히 작은 값을 얹어 항상 정확히 1 substep 이 되게 못박는다(1200 프레임을 흘려도 누적
 *  1.2e-6 ms — dtMs 의 1/7,000,000). */
const FRAME_SLACK_MS = 1e-9;

/** api.read() 가 준 포즈로 **버릴 바디**를 뜬다. physics/bodies.ts 의 생성 레시피를 그대로
 *  쓰므로(피벗 setCentre 오프셋 포함) 실제 월드의 형상과 정점까지 같다. */
function throwawayBody(kind: ProbeKind, pose: ChairPose): Matter.Body {
  switch (kind) {
    case 'chair':
      return createChairBody(pose);
    case 'ball':
      return createBallBody(pose);
    case 'cone':
      return createConeBody(pose);
    case 'goal':
      return createGoalPostBody(pose);
  }
}

/** 월드를 세우고 프레임 0(아무것도 돌기 전)을 한 행 찍은 프로브를 돌려준다.
 *
 *  ⚠️ 전역(performance.now·rAF·Matter.Engine.update)과 모듈(loop.createLoop·drag.endDrag)에
 *  스파이를 건다. **한 번에 하나만 살려 둘 것** — 겹쳐 만들면 뒤엣것이 앞엣것의 클럭을 가로챈다.
 *  다 쓰면 반드시 dispose() 한다(스파이를 전부 되돌린다). */
export function createPhysicsProbe(setup: ProbeSetup = {}): PhysicsProbe {
  const mode: CourtMode = setup.mode ?? 'full';
  const def = COURT_DEFS[mode];
  const chairs = setup.chairs ?? [];
  const balls = setup.balls ?? [];
  const cones = setup.cones ?? [];

  // ── 결정적 클럭 (loop.test.ts:8-31 관용구) ────────────────────────────────────────
  let nowMs = 0;
  let rafSeq = 0;
  let pending: Array<{ id: number; cb: (t: number) => void }> = [];

  const nowSpy = vi.spyOn(performance, 'now').mockImplementation(() => nowMs);
  const rafSpy = vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
    rafSeq += 1;
    pending.push({ id: rafSeq, cb: cb as (t: number) => void });
    return rafSeq;
  });
  // 실 rAF 와 같게 **실제로 큐에서 뺀다** — no-op 으로 두면 멎은 루프가 대기 콜백을 든 채로
  // 남아 "살아 있는 것처럼" 보인다(loop.frame() 이 !running 으로 되돌긴 하지만 관측이 흐려진다).
  const cafSpy = vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation((id: number) => {
    pending = pending.filter((p) => p.id !== id);
  });

  // ── substep 계수: 한 substep = Engine.update 한 번 ───────────────────────────────
  let substepsThisFrame = 0;
  const realEngineUpdate = Matter.Engine.update;
  const engineSpy = vi
    .spyOn(Matter.Engine, 'update')
    .mockImplementation((...args: Parameters<typeof realEngineUpdate>) => {
      substepsThisFrame += 1;
      return realEngineUpdate(...args);
    });

  const trace: ProbeFrame[] = [];
  const loopEvents: LoopEvent[] = [];
  const sessionEvents: SessionEvent[] = [];
  const watched = new Map<string, readonly [string, string]>();
  const kindOf = new Map<string, ProbeKind>();
  let frame = 0;

  // ── 루프 붙들기 (index.test.ts:131-142 관용구) ───────────────────────────────────
  const realCreateLoop = loopModule.createLoop;
  let loop: PhysicsLoop | null = null;
  const isRunning = (): boolean => loop?.isRunning() ?? false;
  let lastRunning = false;

  /** isRunning() 전이만 이벤트로 남긴다. 루프의 자동 stop(정착 조기 종료)은 클로저 내부
   *  호출이라 데코레이터로는 안 잡히고, 이 폴링으로만 잡힌다. */
  function syncLoop(): void {
    const now = isRunning();
    if (now === lastRunning) return;
    lastRunning = now;
    loopEvents.push({ frame, tMs: nowMs, kind: now ? 'start' : 'stop' });
  }

  const loopSpy = vi.spyOn(loopModule, 'createLoop').mockImplementation((o) => {
    const real = realCreateLoop(o);
    loop = real;
    return {
      start: () => {
        real.start();
        syncLoop();
      },
      stop: () => {
        real.stop();
        syncLoop();
      },
      isRunning: () => real.isRunning(),
      requestSettle: (ms?: number) => {
        loopEvents.push({ frame, tMs: nowMs, kind: 'settle' });
        real.requestSettle(ms);
        syncLoop();
      },
      cancelSettle: () => {
        loopEvents.push({ frame, tMs: nowMs, kind: 'cancelSettle' });
        real.cancelSettle();
      },
    };
  });

  // ── 세션 전이 붙들기 (index.test.ts:59 관용구) ──────────────────────────────────
  const realEndDrag = dragModule.endDrag;
  const endDragSpy = vi
    .spyOn(dragModule, 'endDrag')
    .mockImplementation((...args: Parameters<typeof realEndDrag>) => {
      sessionEvents.push({ frame, tMs: nowMs, kind: 'endDrag', id: args[0].id });
      realEndDrag(...args);
    });

  // ── 월드 ────────────────────────────────────────────────────────────────────────
  const cast: DrillCast = {
    chairs: chairs.map((c, i) => ({ id: c.id, team: 'home', number: String(i + 2), isGk: false })),
    balls: balls.map((b) => ({ id: b.id as BallId })),
    cones: cones.map((c) => ({ id: c.id as ConeId, colorIndex: 0 })),
  };
  const step: DrillStep = {
    id: 'st_probe' as StepId,
    name: '',
    note: '',
    chairs: Object.fromEntries(chairs.map((c) => [c.id, { x: c.x, y: c.y, angleDeg: c.angleDeg ?? 0 }])),
    balls: Object.fromEntries(balls.map((b) => [b.id, { x: b.x, y: b.y }])),
    cones: Object.fromEntries(cones.map((c) => [c.id, { x: c.x, y: c.y }])),
    arrows: [],
    notes: [],
  };

  const api = createPhysicsWorld(def.vbW, def.vbH, setup.limits);
  api.load(cast, step, mode);

  for (const c of chairs) kindOf.set(c.id, 'chair');
  for (const b of balls) kindOf.set(b.id, 'ball');
  for (const c of cones) kindOf.set(c.id, 'cone');
  def.goalPosts.forEach((_p, i) => kindOf.set(`${GOAL_ID_PREFIX}${i}`, 'goal'));

  let handle: DragHandle | null = null;
  let draggingId: CastId | null = null;

  function requireKind(id: string): ProbeKind {
    const k = kindOf.get(id);
    if (!k) throw new Error(`physicsProbe: 월드에 없는 id(${id})`);
    return k;
  }

  function depthBetween(a: string, b: string): number {
    const snap = api.read();
    const pa = snap[a];
    const pb = snap[b];
    if (!pa || !pb) throw new Error(`physicsProbe: 스냅샷에 없는 id(${!pa ? a : b})`);
    const hit = Matter.Collision.collides(throwawayBody(requireKind(a), pa), throwawayBody(requireKind(b), pb));
    return hit ? hit.depth : 0;
  }

  function pushRow(substeps: number): void {
    const depths: Record<string, number> = {};
    for (const [key, pair] of watched) depths[key] = depthBetween(pair[0], pair[1]);
    trace.push({
      frame,
      tMs: nowMs,
      substeps,
      running: isRunning(),
      settled: api.isSettled(),
      poses: api.read(),
      depths,
    });
    frame += 1;
  }

  function flushOneFrame(): void {
    substepsThisFrame = 0;
    const due = pending;
    pending = [];
    nowMs += PHYS.dtMs + FRAME_SLACK_MS;
    for (const p of due) p.cb(nowMs);
  }

  const probe: PhysicsProbe = {
    api,
    trace,
    loopEvents,
    sessionEvents,
    frame: () => frame,
    tMs: () => nowMs,
    isRunning,
    watch(a, b) {
      const key = pairKey(a, b);
      if (!watched.has(key)) watched.set(key, [a, b]);
    },
    depthBetween,
    chairSatDepth(a, b) {
      for (const id of [a, b]) {
        // obb.satOverlap 은 두 인자를 모두 휠체어 hull 로 본다 — 공·콘을 넣으면 조용히 틀린
        // 값이 나온다(그쪽은 애초에 matter 경로로 재야 한다).
        if (requireKind(id) !== 'chair') throw new Error(`physicsProbe: 휠체어가 아니다(${id})`);
      }
      const snap = api.read();
      const pa = snap[a];
      const pb = snap[b];
      if (!pa || !pb) throw new Error(`physicsProbe: 스냅샷에 없는 id(${!pa ? a : b})`);
      // marginPx=0 — 순수 겹침만 본다(CHAIR_SEP_PX 를 넣으면 깊이가 그만큼 부풀려진다).
      const out = satOverlap(pa, pb, 0);
      return Math.max(0, out.depth);
    },
    startDrag(id, grabWorld, s) {
      const kind = requireKind(id);
      // 골대는 cast 가 아니라 코트 정의에서 오고 HitResult 에 그런 종류가 아예 없다 — 잡을 수
      // 없는 것을 잡으려 한 것이므로 여기서 끊는다(api.beginDrag 라면 조용히 null 을 준다).
      if (kind === 'goal') throw new Error(`physicsProbe: 골대는 드래그 대상이 아니다(${id})`);
      const snap = api.read();
      const p = snap[id]!;
      const grab = grabWorld ?? { x: p.x, y: p.y };
      // s 기본값 0.2 — DEFAULT_ZONES 에서 'translate'(차체 뒤 절반) 이다.
      const hit: HitResult = kind === 'chair' ? { kind: 'chair', id, s: s ?? 0.2 } : { kind, id };
      handle = api.beginDrag(hit, grab);
      if (!handle) throw new Error(`physicsProbe: beginDrag 가 거절했다(${id})`);
      draggingId = id;
      sessionEvents.push({ frame, tMs: nowMs, kind: 'beginDrag', id });
      syncLoop();
    },
    moveTo(worldPt) {
      if (!handle) throw new Error('physicsProbe: 진행 중인 드래그가 없다');
      handle.move(worldPt, nowMs);
    },
    endDrag() {
      if (!handle) throw new Error('physicsProbe: 진행 중인 드래그가 없다');
      sessionEvents.push({ frame, tMs: nowMs, kind: 'release', id: draggingId ?? '' });
      handle.end();
      handle = null;
      draggingId = null;
    },
    stepFrames(n) {
      for (let i = 0; i < n; i++) {
        flushOneFrame();
        syncLoop();
        pushRow(substepsThisFrame);
      }
    },
    forceSteps(n) {
      for (let i = 0; i < n; i++) {
        substepsThisFrame = 0;
        nowMs += PHYS.dtMs + FRAME_SLACK_MS;
        api.step(PHYS.dtS);
        syncLoop();
        pushRow(substepsThisFrame);
      }
    },
    runUntilSettled(o) {
      const maxFrames = o?.maxFrames ?? 1200; // 10초 @120Hz
      const from = frame;
      for (let i = 0; i < maxFrames; i++) {
        if (api.isSettled()) return frame - from;
        probe.stepFrames(1);
      }
      throw new Error(`physicsProbe: ${maxFrames} 프레임 안에 정착하지 않았다\n${probe.formatTrace()}`);
    },
    runUntilLoopStops(o) {
      const maxFrames = o?.maxFrames ?? 1200;
      const from = frame;
      for (let i = 0; i < maxFrames; i++) {
        if (!isRunning()) return frame - from;
        probe.stepFrames(1);
      }
      throw new Error(`physicsProbe: ${maxFrames} 프레임 안에 루프가 멎지 않았다\n${probe.formatTrace()}`);
    },
    formatTrace() {
      const head = `frame     t(ms) sub run settled ${[...watched.keys()].join(' ')}`;
      const rows = trace.map((r) => {
        const d = [...watched.keys()].map((k) => (r.depths[k] ?? 0).toFixed(2)).join(' ');
        return `${String(r.frame).padStart(5)} ${r.tMs.toFixed(1).padStart(9)} ${String(r.substeps).padStart(3)} ${
          r.running ? ' ● ' : ' ○ '
        } ${r.settled ? '  ✓   ' : '  ✗   '} ${d}`;
      });
      const ev = loopEvents.map((e) => `  loop  f${e.frame} ${e.kind}`);
      const se = sessionEvents.map((e) => `  drag  f${e.frame} ${e.kind}${e.id ? ` ${e.id}` : ''}`);
      return [head, ...rows, ...ev, ...se].join('\n');
    },
    dispose() {
      api.dispose();
      endDragSpy.mockRestore();
      loopSpy.mockRestore();
      engineSpy.mockRestore();
      cafSpy.mockRestore();
      rafSpy.mockRestore();
      nowSpy.mockRestore();
    },
  };

  for (const [a, b] of setup.watch ?? []) probe.watch(a, b);
  pushRow(0); // 프레임 0 = 아무것도 돌기 전의 초기 상태

  return probe;
}
