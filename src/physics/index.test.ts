// physics-world 공개 진입점(createPhysicsWorld) 회귀. §5.8/§5.11 감사 지적을 고정한다.
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as Matter from 'matter-js';
import { createPhysicsWorld } from './index.ts';
import * as dragModule from './drag.ts';
import * as loopModule from './loop.ts';
import { BALL, CHAIR, PHYS } from '../core/constants.ts';
import type { ChairId, BallId, StepId } from '../core/ids.ts';
import type { DrillCast, DrillStep } from '../model/drill.ts';
import type { HitResult } from './hitTest.ts';
import type { CourtMode } from '../model/court.ts';

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
