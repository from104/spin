// physics-world 공개 진입점(createPhysicsWorld) 회귀. §5.8/§5.11 감사 지적을 고정한다.
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as Matter from 'matter-js';
import { createPhysicsWorld, DEFAULT_DRAG_LIMITS, GOAL_ID_PREFIX } from './index.ts';
import * as dragModule from './drag.ts';
import * as loopModule from './loop.ts';
import { BALL, CHAIR, PHYS } from '../core/constants.ts';
import type { ChairId, BallId, StepId } from '../core/ids.ts';
import type { DrillCast, DrillStep } from '../model/drill.ts';
import type { HitResult } from './hitTest.ts';
import type { CourtMode } from '../model/court.ts';
import { COURT_DEFS } from '../model/court.ts';

const chA = 'ch_a' as ChairId;
const chB = 'ch_b' as ChairId;
const blA = 'bl_a' as BallId;
const mode: CourtMode = 'full';

function makeCast(): DrillCast {
  return {
    chairs: [
      { id: chA, team: 'home', number: '2', isGk: false },
      { id: chB, team: 'home', number: '3', isGk: false },
    ],
    balls: [{ id: blA }],
    cones: [],
  };
}

function makeStep(): DrillStep {
  return {
    id: 'st_x' as StepId,
    name: '',
    note: '',
    chairs: {
      [chA]: { x: 300, y: 300, angleDeg: 0 },
      [chB]: { x: 900, y: 900, angleDeg: 0 },
    },
    // world.test.ts 의 §5.4 freeze 회귀와 동일한 배치: chA 바로 앞, 접촉 직전(0.45px 간격).
    // (이후 chA 를 +0.5px 옮기면 그 회귀와 동일하게 0.05px 겹친다.)
    balls: { [blA]: { x: 300 + CHAIR.pivotToFrontPx + BALL.radiusPx + 0.45, y: 300 } },
    cones: {},
    arrows: [],
    notes: [],
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('beginDrag 세션 덮어쓰기 (major 회귀: §5.11 "다시 탭" 시 이전 세션을 endDrag)', () => {
  it('드래그(또는 릴리스 체이스) 도중 다른 대상을 잡으면 이전 세션이 endDrag(freeze) 로 정상 종료된다', () => {
    // world.ts 의 freezeKinematic 은 §5.4 실측대로 "미실행 시 1초 후 47.3px 고스트 푸시" 를
    // 이미 world.test.ts 가 기전 수준에서 고정해 뒀다 — 여기서는 그 재현이 아니라 index.ts 의
    // beginDrag 가 세션을 덮어쓸 때 실제로 endDrag 를 호출하는지(=배선)를 직접 검증한다.
    // (물리 레벨 재현은 부적합: 드래그가 진짜로 공에 닿을 만큼 움직이면 그 자체가 정상적인
    // "스핀킥" 충격을 주므로, freeze 유무와 무관하게 공이 실제로 움직여 신호가 오염된다.)
    const endDragSpy = vi.spyOn(dragModule, 'endDrag');

    const api = createPhysicsWorld(4000, 4000);
    api.load(makeCast(), makeStep(), mode);

    const hitA: HitResult = { kind: 'chair', id: chA, s: 0.2 };
    const handleA = api.beginDrag(hitA, { x: 300, y: 300 });
    expect(handleA).not.toBeNull();
    expect(endDragSpy).not.toHaveBeenCalled(); // 첫 드래그 시작 — 종료할 이전 세션 없음

    // handle.end() 를 부르지 않고(=릴리스 체이스에 들어가지도 않고) 곧바로 다른 대상(chB)을
    // 잡는다 — "endDrag 없는 덮어쓰기" 를 그대로 재현한다.
    const hitB: HitResult = { kind: 'chair', id: chB, s: 0.2 };
    const handleB = api.beginDrag(hitB, { x: 900, y: 900 });
    expect(handleB).not.toBeNull();

    expect(endDragSpy).toHaveBeenCalledTimes(1); // ★ 이전(chA) 세션이 정상 종료됐어야 한다
    const [endedSession] = endDragSpy.mock.calls[0]!;
    expect(endedSession.id).toBe(chA);

    api.dispose();
  });

  it('릴리스 체이스 중에 새로 잡아도 체이스 세션이 endDrag 로 종료된다(§5.11 "다시 탭")', () => {
    const endDragSpy = vi.spyOn(dragModule, 'endDrag');

    const api = createPhysicsWorld(4000, 4000);
    api.load(makeCast(), makeStep(), mode);

    const hitA: HitResult = { kind: 'chair', id: chA, s: 0.2 };
    const handleA = api.beginDrag(hitA, { x: 300, y: 300 })!;
    handleA.move({ x: 900, y: 300 }, 0); // 멀리 있는 목표 — 1 substep 으론 못 따라잡아 체이스가 남는다
    handleA.end(); // beginRelease — releasing=true, 아직 releaseDone 아님(목표까지 멀다)
    api.step(PHYS.dtS);
    expect(endDragSpy).not.toHaveBeenCalled(); // 체이스가 아직 진행 중이어야 이 테스트가 의미 있다

    const hitB: HitResult = { kind: 'chair', id: chB, s: 0.2 };
    api.beginDrag(hitB, { x: 900, y: 900 });

    expect(endDragSpy).toHaveBeenCalledTimes(1);
    expect(endDragSpy.mock.calls[0]![0].id).toBe(chA);

    api.dispose();
  });
});

describe('공개 step(dtS) 가변 dt 가드 (major 회귀: §5.8 "Engine.update 에 가변 dt 금지")', () => {
  it('step(0.05) 처럼 50ms 를 넣어도 Matter.Engine.update 는 항상 고정 dt(PHYS.dtMs)만 받는다', () => {
    const api = createPhysicsWorld(4000, 4000);
    api.load(makeCast(), makeStep(), mode);

    const spy = vi.spyOn(Matter.Engine, 'update');
    spy.mockClear();

    api.step(0.05); // 고정 dt(8.3333ms) 의 6배 — 이 값을 그대로 넣으면 그 프레임 속도가 3배가 된다(실측)

    expect(spy.mock.calls.length).toBeGreaterThan(0);
    for (const call of spy.mock.calls) {
      expect(call[1]).toBeCloseTo(PHYS.dtMs, 9);
    }

    api.dispose();
  });
});

describe('정착 취소 배선 (blocker 회귀: §5.8 "정착 대기 중 새 드래그가 루프를 멈추면 안 된다")', () => {
  it('beginDrag 가 loop.cancelSettle() 을 부른다', () => {
    // 재감사가 지적한 커버리지 공백을 메운다: index.ts 의 cancelSettle 한 줄을 지워도
    // 전체 테스트가 통과했다. loop.test.ts 는 createLoop 단독 동작만 보므로,
    // 여기서는 index.ts 가 그것을 실제로 호출하는지(=배선)를 고정한다.
    // 증상: 이 호출이 없으면 이전 릴리스가 남긴 settleDeadline 이 살아 있다가, 굴러가던 공이
    // 멎어 atRest() 가 참이 되는 순간 loop.stop() 이 걸려 드래그 중인 휠체어가 얼어붙는다.
    let cancelCount = 0;
    const realCreateLoop = loopModule.createLoop;
    vi.spyOn(loopModule, 'createLoop').mockImplementation((o) => {
      const loop = realCreateLoop(o);
      return {
        ...loop,
        cancelSettle: () => {
          cancelCount += 1;
          loop.cancelSettle();
        },
      };
    });

    const api = createPhysicsWorld(4000, 4000);
    api.load(makeCast(), makeStep(), mode);

    expect(cancelCount).toBe(0);

    const hit: HitResult = { kind: 'chair', id: chA, zone: 'translate', s: 0.2 };
    api.beginDrag(hit, { x: 300, y: 300 });

    expect(cancelCount).toBeGreaterThan(0);

    api.dispose();
  });
});

// ── 골대 원위치 (§5.4, 2026-08-10 기현 합의) ──────────────────────────────────────────────
describe('resetGoals — 순간이동이 아니라 밀고 들어간다', () => {
  const DEF = COURT_DEFS[mode];

  function loaded() {
    const w = createPhysicsWorld(DEF.vbW, DEF.vbH);
    w.load(makeCast(), makeStep(), mode);
    return w;
  }
  const run = (w: ReturnType<typeof createPhysicsWorld>, n: number) => {
    for (let i = 0; i < n; i++) w.step(PHYS.dtS);
  };
  const goal0 = (w: ReturnType<typeof createPhysicsWorld>) => w.read()[`${GOAL_ID_PREFIX}0`]!;

  it('코트 정의의 골대가 스냅샷에 들어온다 — 여기 없으면 화면이 따라오지 못한다', () => {
    const w = loaded();
    const snap = w.read();
    const home = COURT_DEFS[mode].goalPosts;
    expect(home.length).toBeGreaterThan(0);
    home.forEach((p, i) => {
      const s = snap[`${GOAL_ID_PREFIX}${i}`];
      expect(s, `${GOAL_ID_PREFIX}${i} 가 스냅샷에 없다`).toBeDefined();
      expect(s!.x).toBeCloseTo(p.x, 3);
      expect(s!.y).toBeCloseTo(p.y, 3);
    });
    w.dispose();
  });

  it('밀린 골대를 원위치로 되돌린다', () => {
    const w = loaded();
    const home = COURT_DEFS[mode].goalPosts[0]!;
    // 휠체어로 밀지 않고 직접 옮겨 놓는다(이 테스트의 관심사는 복귀다).
    w.setPose(`${GOAL_ID_PREFIX}0` as never, { x: home.x + 60, y: home.y + 40 });
    run(w, 5);
    expect(w.goalsDisplaced()).toBe(true);

    w.resetGoals();
    run(w, 120); // 1초
    const g = goal0(w);
    expect(Math.hypot(g.x - home.x, g.y - home.y)).toBeLessThan(1);
    expect(w.goalsDisplaced()).toBe(false);
    w.dispose();
  });

  it('원위치 자리에 개체가 있어도 끝까지 돌아간다 — 막다른 길이 없다', () => {
    // 합의한 동작: 거부하거나 순간이동하지 않고, 구동해 밀어내고 마지막에 스냅한다.
    const w = loaded();
    const home = COURT_DEFS[mode].goalPosts[0]!;
    w.setPose(`${GOAL_ID_PREFIX}0` as never, { x: home.x + 80, y: home.y });
    w.setPose(blA, { x: home.x, y: home.y }); // 원위치 정중앙에 공을 놓는다
    run(w, 5);

    w.resetGoals();
    run(w, 240); // 2초 — 상한(0.5초)을 훨씬 넘겨 스냅까지 확인
    const g = goal0(w);
    // 4 px 인 이유: 복귀 자체는 정확히 끝나지만(스냅), 밀려난 공이 굴러다니다 골대를 다시
    // 살짝 건드린다. 그 정도 흔들림은 골대 계약이 이미 허용하는 범위다(최고속 직격 8 px 미만,
    // §5.4). 여기서 1 px 을 요구하면 공의 구름 성질이 바뀔 때마다 이 테스트가 깨진다 —
    // 실제로 2026-08-10 구름 재조정에서 그렇게 깨졌다.
    expect(Math.hypot(g.x - home.x, g.y - home.y)).toBeLessThan(4);

    // 공은 비켜났다(같은 자리에 겹쳐 있지 않다).
    const ball = w.read()[blA]!;
    expect(Math.hypot(ball.x - home.x, ball.y - home.y)).toBeGreaterThan(1);
    w.dispose();
  });
});

// ⚠️ 기현 실기 신고(2026-08-10): "원래 자리에 오브젝트 있으면 복귀 못함. 오브젝트를 못
// 밀어냄. 복귀 버튼 2~3번 눌러야 동작."
//
// 위 '개체가 있어도 끝까지 돌아간다' 테스트는 자리에 **공**을 놓아서 통과했다. 공은 dynamic
// 이라 골대가 밀어낸다. 그런데 **휠체어는 isStatic 이라 무한 질량**이다 — 골대가 휠체어를
// 미는 것은 벽을 미는 것과 같아서, 밀어 넣으면 리졸버가 도로 뱉어내고 강제 스냅해도 즉시
// 다시 뱉어낸다. 그래서 눌러도 안 되는 것처럼 보인다.
describe('resetGoals — 원위치에 휠체어가 있는 경우 (기현 실기 신고 재현)', () => {
  const DEF = COURT_DEFS[mode];

  it('휠체어가 원위치를 막고 있으면 골대는 거기로 못 간다', () => {
    const w = createPhysicsWorld(DEF.vbW, DEF.vbH);
    const home = DEF.goalPosts[0]!;
    const cast = makeCast();
    const step = makeStep();
    // chA 를 골대 원위치 정중앙에 세운다.
    step.chairs[chA] = { x: home.x, y: home.y, angleDeg: 0 };
    w.load(cast, step, mode);

    w.setPose(`${GOAL_ID_PREFIX}0` as never, { x: home.x + 80, y: home.y });
    for (let i = 0; i < 5; i++) w.step(PHYS.dtS);

    w.resetGoals();
    for (let i = 0; i < 240; i++) w.step(PHYS.dtS); // 2초 — 상한 0.5초를 훨씬 넘긴다

    const g = w.read()[`${GOAL_ID_PREFIX}0`]!;
    const dist = Math.hypot(g.x - home.x, g.y - home.y);
    // 휠체어가 static 인 한 여기 들어갈 수 없다. 이 테스트는 "들어간다" 를 요구하지 않는다 —
    // **거짓으로 성공했다고 보고하지 않는지**를 못박는다.
    expect(dist).toBeGreaterThan(1);
    expect(w.goalsDisplaced()).toBe(true);
    w.dispose();
  });

  it('막혀 있으면 resetGoals 가 그 사실을 알려준다 — 조용히 실패하지 않는다', () => {
    // 이게 없으면 사용자는 "버튼이 고장났나" 하며 계속 누른다(실제로 그랬다).
    const w = createPhysicsWorld(DEF.vbW, DEF.vbH);
    const home = DEF.goalPosts[0]!;
    const step = makeStep();
    step.chairs[chA] = { x: home.x, y: home.y, angleDeg: 0 };
    w.load(makeCast(), step, mode);
    expect(w.resetGoals().blocked).toBeGreaterThan(0);
    w.dispose();
  });

  it('막는 것이 없으면 blocked 는 0 이다', () => {
    const w = createPhysicsWorld(DEF.vbW, DEF.vbH);
    w.load(makeCast(), makeStep(), mode);
    expect(w.resetGoals().blocked).toBe(0);
    w.dispose();
  });
});

describe('setLimits — 살아 있는 월드의 속도 상한 (하단 스위치)', () => {
  /** 전방 견인 핸들을 멀리 끌고 n substep 진행시킨 뒤 이동량을 잰다. */
  function travel(api: ReturnType<typeof createPhysicsWorld>, substeps: number): number {
    const before = api.read()[chA]!.x;
    for (let i = 0; i < substeps; i++) api.step(PHYS.dtS);
    return api.read()[chA]!.x - before;
  }

  it('상한을 풀면 같은 시간에 훨씬 멀리 간다', () => {
    const api = createPhysicsWorld(4000, 4000);
    api.load(makeCast(), makeStep(), mode);

    // 판 오른쪽 멀리를 목표로 잡는다 — 상한이 걸리면 그 속도로만 접근한다.
    const hit: HitResult = { kind: 'chair', id: chA, zone: 'translate', s: 0.3 };
    const h = api.beginDrag(hit, { x: 300, y: 300 })!;
    h.move({ x: 3000, y: 300 }, performance.now());
    h.move({ x: 3000, y: 300 }, performance.now() + 20); // arm

    const limited = travel(api, 120); // 1초
    expect(limited).toBeGreaterThan(0);
    // 기본 상한 69.4444 px/s → 1초에 그 언저리. 여유를 둬도 100px 을 넘지 않는다.
    expect(limited).toBeLessThan(100);

    // 드래그 도중에 상한을 푼다 — 스위치를 누르는 그 상황이다.
    api.setLimits({ vLinPxPerS: 1e6, omegaRadPerS: 1e4 });
    const unlimited = travel(api, 120);

    expect(unlimited).toBeGreaterThan(limited * 5);
    api.dispose();
  });

  it('상한을 다시 걸면 즉시 느려진다', () => {
    const api = createPhysicsWorld(4000, 4000);
    api.load(makeCast(), makeStep(), mode);
    const hit: HitResult = { kind: 'chair', id: chA, zone: 'translate', s: 0.3 };
    const h = api.beginDrag(hit, { x: 300, y: 300 })!;
    h.move({ x: 3000, y: 300 }, performance.now());
    h.move({ x: 3000, y: 300 }, performance.now() + 20);

    api.setLimits({ vLinPxPerS: 1e6, omegaRadPerS: 1e4 });
    const fast = travel(api, 12);
    api.setLimits(DEFAULT_DRAG_LIMITS);
    const slow = travel(api, 12);

    expect(slow).toBeLessThan(fast);
    api.dispose();
  });
});
