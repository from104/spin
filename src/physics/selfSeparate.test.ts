// §4.2 P0-1 — 겹친 휠체어가 스스로 벌어진다(알려진 이슈 #1).
//
// 원인은 판정식이 부실한 것이 아니라 **루프가 죽는 타이밍**이었다. `endDrag` 는 substep 의
// `Engine.update` **뒤에** 칩을 dynamic 으로 되돌리고 곧바로 requestSettle 을 거는데, 그
// 프레임 말미의 정지 판정이 `allAtRest()===true` 를 보고 즉시 stop() 한다 — 칩이 dynamic 이
// 된 뒤의 `Engine.update` 가 **한 번도** 실행되지 않는다. matter 의 위치 해결
// (Resolver.postSolvePosition)은 positionPrev 까지 같이 옮겨 **속도를 만들지 않으므로**,
// 속도만 보는 allAtRest 는 겹침 해소를 원리적으로 볼 수 없다. 판정식에 눈이 없었던 것이다.
//
// 그래서 고친 자리는 `allAtRest` 가 아니라(그 뜻은 §5.9 조기 종료 골든이 기대고 있다)
// createLoop 에 넘기는 **정착 술어**다: 겹침이 남아 있는 동안만 루프를 붙잡고, 상한
// (PHYS.settleMaxMs)에 닿으면 기하 분리를 1회 강제하고 끝낸다.
//
// 0차 실측 하네스(physicsProbe)로 돌린다 — rAF·performance.now 를 결정적으로 흉내내므로
// "몇 번째 프레임에 멎었나" 를 프레임 단위로 셀 수 있다.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPhysicsProbe } from '../test/helpers/physicsProbe.ts';
import * as obbModule from './obb.ts';
import { outOfBounds, satOverlap } from './obb.ts';
import type { PhysicsSnapshot } from './index.ts';
import { CHAIR, PHYS } from '../core/constants.ts';
import type { ChairId } from '../core/ids.ts';

const chA = 'ch_a' as ChairId;
const chB = 'ch_b' as ChairId;
const PAIR = `${chA}|${chB}`;

/** 코트 왼쪽 벽의 안쪽 면은 정확히 x=0 이다(§5.7). */
const WALL_X = 0;
const Y = 262.5; // full 코트 세로 중앙
const DRAG_TO_X = 30;
const HOLD_FRAMES = 140;

afterEach(() => {
  vi.restoreAllMocks();
});

/** physicsProbe.test.ts 의 P0-1 배치 그대로: 벽에 뒷면을 붙여 세워 둔 칩(B) 위로 다른
 *  칩(A)을 끌어다 놓고, 잠깐 멈춘 상태. B 앞면 x=37.5 · A 뒷면 x=22.5 라 겹침은 해석적으로
 *  정확히 15.00 px 다. B 가 벽 너머로 밀려나지 않는 것은 §4.2 P0-3 의 안전망이 매 substep
 *  되돌리기 때문이다(1.4 이전에는 B 가 피벗 x=-5 까지 나갔고, 그때의 겹침은 12.50 이었다). */
function draggedIntoWallChip() {
  const probe = createPhysicsProbe({
    chairs: [
      { id: chA, x: 60, y: Y },
      { id: chB, x: WALL_X + CHAIR.pivotToRearPx, y: Y },
    ],
    watch: [[chA, chB]],
  });
  probe.startDrag(chA);
  probe.moveTo({ x: DRAG_TO_X, y: Y });
  probe.stepFrames(HOLD_FRAMES);
  return probe;
}

describe('P0-1 — 손을 떼면 겹침이 풀릴 때까지 루프가 남는다', () => {
  it('★ 벽에 붙은 칩 위에 놓고 손을 떼면 스스로 벌어진다 — 정착 후 겹침 0', () => {
    const probe = draggedIntoWallChip();
    expect(probe.depthBetween(chA, chB)).toBeCloseTo(15, 6); // 전제: 손 뗄 때 15.00 겹쳐 있다

    probe.endDrag();
    // 3 프레임. 내역: 겹침이 루프를 붙잡는 릴리스 프레임 + 위치 해결이 도는 2 프레임.
    // (속도는 내내 0 이다 — 위치 해결은 속도를 만들지 않으므로 루프를 붙드는 것은 겹침뿐이다.)
    expect(probe.runUntilLoopStops({ maxFrames: 300 })).toBe(3);

    // ★ 완료 판정: 두 경로(matter Collision / obb SAT) 모두에서 겹침이 0 이다.
    expect(probe.depthBetween(chA, chB)).toBe(0);
    expect(probe.chairSatDepth(chA, chB)).toBe(0);
    // 벽에 붙은 쪽은 물러설 자리가 없으므로 밀려난 것은 얹힌 쪽이다.
    expect(probe.api.read()[chA]!.x).toBeGreaterThan(DRAG_TO_X + 10);
    expect(probe.trace.at(-1)!.settled).toBe(true);

    probe.dispose();
  });

  it('손 뗀 그 프레임에는 멎지 않는다 — 15.00 px 겹침이 루프를 붙잡는다', () => {
    const probe = draggedIntoWallChip();
    const releaseFrame = probe.frame(); // 릴리스 체이스가 완결될 프레임

    probe.endDrag();
    probe.stepFrames(1);

    const row = probe.trace.at(-1)!;
    expect(row.frame).toBe(releaseFrame);
    expect(row.substeps).toBe(1); // endDrag 를 품은 그 substep
    expect(row.depths[PAIR]).toBeCloseTo(15, 6);
    // 속도로만 보면 완벽한 정지다 — allAtRest 의 뜻은 그대로 두었다.
    expect(row.settled).toBe(true);
    // ★ 그런데도 루프는 살아 있다. 이 한 줄이 1.3 의 전부다(고치기 전에는 false 였다).
    expect(row.running).toBe(true);

    // 그 프레임의 루프 사건은 settle 뿐이다 — stop 이 따라붙지 않는다.
    expect(probe.loopEvents.filter((e) => e.frame === releaseFrame).map((e) => e.kind)).toEqual(['settle']);

    probe.dispose();
  });

  it('정착 통지에 실려 오는 스냅샷이 이미 벌어진 좌표다 (P0-2 재커밋과 맞물린다)', () => {
    const probe = draggedIntoWallChip();
    const seen: PhysicsSnapshot[] = [];
    probe.api.onSettled((snap) => seen.push(snap));

    probe.endDrag();
    probe.runUntilLoopStops({ maxFrames: 300 });

    expect(seen).toHaveLength(1);
    const a = seen[0]![chA]!;
    const b = seen[0]![chB]!;
    // 통지 좌표로 다시 재도 겹치지 않는다 — 재커밋이 겹친 좌표를 모델에 쓰는 일이 없다.
    expect(satOverlap(a, b, 0).depth).toBeLessThanOrEqual(0);
    expect(a.x).toBeGreaterThan(DRAG_TO_X + 10); // 손 떼던 자리에 머물지 않는다

    probe.dispose();
  });

  it('겹침이 없으면 손 뗀 그 프레임에 그대로 멎는다 — 붙잡기는 겹쳤을 때만 걸린다', () => {
    // 같은 배치에서 목표만 바꾼다: B 에 닿지 않는 자리로 끌고 손을 뗀다.
    const probe = createPhysicsProbe({
      chairs: [
        { id: chA, x: 60, y: Y },
        { id: chB, x: WALL_X + CHAIR.pivotToRearPx, y: Y },
      ],
      watch: [[chA, chB]],
    });
    probe.startDrag(chA);
    probe.moveTo({ x: 80, y: Y });
    probe.stepFrames(60);
    expect(probe.depthBetween(chA, chB)).toBe(0); // 전제: 겹치지 않았다

    probe.endDrag();
    // 릴리스 체이스는 목표에 이미 닿아 있어 첫 substep 에 끝나고(§5.11), 붙잡을 겹침이
    // 없으므로 그 프레임에 멎는다 — 정착이 한 프레임도 늦어지지 않는다.
    expect(probe.runUntilLoopStops({ maxFrames: 60 })).toBe(1);

    probe.dispose();
  });
});

describe('P0-1 — 붙잡지 않는 것들', () => {
  it('손이 쥐고 있는 칩의 겹침은 붙잡지 않는다 — 그건 사용자가 만들고 있는 겹침이다', () => {
    const probe = draggedIntoWallChip(); // 손은 그대로 쥐고 있다
    const separate = vi.spyOn(obbModule, 'separateOverlaps');
    expect(probe.depthBetween(chA, chB)).toBeCloseTo(15, 6);

    // 쥔 채로 [골대 원위치] 를 누른다(태블릿에서 두 번째 손가락으로 누르면 실제로 눌린다).
    probe.api.resetGoals();
    // 2026-08-12(1.5): 이 테스트는 원래 `runUntilLoopStops(...)<5` 를 단언했다 — 즉 **드래그
    // 도중에 루프가 죽는 것**을 전제로 서 있었고, 위 주석이 그것을 "resetGoals 의 오래된
    // §5.8 위험이고 1.3 의 범위가 아니다" 로 미뤄 두었다. 1.5 가 그 위험을 닫았다(드래그
    // 세션이 살아 있으면 정착 구간을 아예 열지 않는다) — 그래서 루프는 이제 안 죽는다.
    //
    // 이 it 이 재려던 것("쥔 칩을 겹침 감시에서 빼지 않으면 8초를 태우고 사용자가 쥐고 있는
    // 칩을 기하로 옮겨 버린다")은 그대로 살아 있고, 오히려 **더 세게** 잴 수 있게 됐다:
    // 8 초(960 프레임)를 실제로 넘겨 놓고도 아무 일이 없어야 한다.
    const beyondSettleMax = Math.ceil(PHYS.settleMaxMs / PHYS.dtMs) + 20;
    probe.stepFrames(beyondSettleMax);
    expect(probe.isRunning()).toBe(true); // 손이 판 위에 있는 동안은 루프가 산다
    expect(separate).not.toHaveBeenCalled();
    expect(probe.api.read()[chA]!.x).toBeCloseTo(DRAG_TO_X, 6); // 쥔 칩은 제자리
    expect(probe.depthBetween(chA, chB)).toBeCloseTo(15, 6);

    probe.dispose();
  });

  it('matter 가 접촉을 slop(0.025 px)만큼 파묻힌 채로 재우는 것은 겹침이 아니다', () => {
    // 문턱(PHYS.overlapRestPx)이 왜 0 일 수 없는지에 대한 물증. 칩 9대를 구석에 쌓아 두면
    // 서로 밀어내다가 **정확히 0.025 px 파묻힌 채로** 선다(Body.slop 0.05 × slopDampen 0.5).
    const chairs = Array.from({ length: 9 }, (_, i) => ({
      id: `ch_${i}` as ChairId,
      x: 30 + (i % 3) * 3,
      y: 30 + Math.floor(i / 3) * 3,
    }));
    const probe = createPhysicsProbe({ chairs });
    probe.forceSteps(300);

    let worst = 0;
    for (let i = 0; i < chairs.length; i++) {
      for (let j = i + 1; j < chairs.length; j++) {
        const d = probe.chairSatDepth(chairs[i]!.id, chairs[j]!.id);
        if (d > worst) worst = d;
      }
    }
    expect(worst).toBeCloseTo(0.025, 6);
    expect(worst).toBeGreaterThan(0); // ★ 0 이 아니다 — 문턱이 0 이면 여기서 매번 8초를 태운다
    expect(worst).toBeLessThan(PHYS.overlapRestPx);

    // 그래서 이 판은 "다 선 판" 이다: 정착 구간을 열어도 상한을 태우지 않고 곧 멎는다.
    probe.api.resetGoals();
    expect(probe.runUntilLoopStops({ maxFrames: 200 })).toBeLessThan(120);

    probe.dispose();
  });
});

describe('P0-1 — 상한 8초와 기하 분리 폴백', () => {
  // 칩(폭 25)이 두 대 들어갈 수 없는 40 px 짜리 판. 물리가 아무리 밀어도 겹침이 남는다 —
  // 정규 코트에는 이런 배치가 없어서(실측: 16대를 한 점에 쌓아도 120 프레임 안에 slop 까지
  // 풀린다) 하네스의 판 크기 탈출구로 만든다.
  const COURT = { w: 60, h: 40 };

  it('겹침이 영영 안 풀리는 배치에서도 8초 안에 반드시 멎고, 나가기 전에 기하로 한 번 뗀다', () => {
    const probe = createPhysicsProbe({
      court: COURT,
      chairs: [
        { id: chA, x: 30, y: 20 },
        { id: chB, x: 30, y: 20 },
      ],
      watch: [[chA, chB]],
    });
    // 먼저 물리에게 실컷 기회를 준다 — 그래도 겹친 대치 상태로 굳는다. 물리가 서로를
    // 판 밖으로 밀어내면 §4.2 P0-3 의 안전망이 매 substep 되돌리므로(1.4), 대치 상태는
    // **판이 허락하는 최솟값 10 px** 그대로다(1.4 이전에는 둘 다 2.5 px 씩 판 밖으로 나간
    // 채 4.99 px 로 굳었다 — 겹침이 더 얕아 보였던 것은 판 밖으로 새어 나간 만큼이다).
    probe.forceSteps(30);
    expect(probe.chairSatDepth(chA, chB)).toBeCloseTo(2 * CHAIR.widthPx - COURT.h, 6);
    expect(probe.trace.at(-1)!.settled).toBe(true); // 속도로는 이미 정지다

    const separate = vi.spyOn(obbModule, 'separateOverlaps');
    probe.api.resetGoals(); // 정착 구간을 연다
    const frames = probe.runUntilLoopStops({ maxFrames: 1200 });

    // ★ 상한에 딱 맞춰 멎는다. 무릎 위 태블릿에서 이 상한이 없으면 rAF 가 영원히 돈다.
    expect(frames).toBe(Math.round(PHYS.settleMaxMs / PHYS.dtMs));
    expect(frames * PHYS.dtMs).toBeCloseTo(PHYS.settleMaxMs, 6);

    // 나가기 전에 기하 분리를 **정확히 한 번** 강제한다(매 프레임 부르면 그게 곧 물리의 대체다).
    expect(separate).toHaveBeenCalledTimes(1);

    // 해가 없는 배치라 겹침은 남지만, 폴백은 판이 허락하는 최솟값까지 떼어 놓고
    // 두 칩 모두 판 안에 둔다(안전망이 P0-3 을 스스로 만들지 않는다).
    const snap = probe.api.read();
    expect(probe.chairSatDepth(chA, chB)).toBeCloseTo(2 * CHAIR.widthPx - COURT.h, 6);
    for (const id of [chA, chB]) {
      expect(outOfBounds(snap[id]!, COURT).depth).toBeLessThanOrEqual(1e-9);
    }

    probe.dispose();
  });
});
