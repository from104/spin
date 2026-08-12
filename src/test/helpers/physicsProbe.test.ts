// physicsProbe 자기 검산 + P0-1 현상 고정. §5.8/§5.9/§5.11.
//
// 앞의 두 describe 는 **계기 자신**을 검산한다(자를 먼저 재는 일): 프레임↔substep 이 1:1 인가,
// 겹침 깊이가 해석적으로 맞는가. 뒤의 describe 가 본론이다.
//
// 2026-08-12(1.3): 마지막 describe 는 원래 **버그를 계약으로** 굳혀 놓았다 — 손을 뗀 칩이
// dynamic 으로 돌아온 직후 겹침을 안은 채 isSettled()===true 가 떠서 루프가 그 프레임에 죽고,
// 물리는 겹침을 풀 기회를 한 substep 도 얻지 못했다. 자가 분리를 넣으면서 그 골든을 **고친
// 뒤의 동작**으로 갱신했다: 겹침은 그대로 재현되고(원인은 여전히 거기 있다), 그 뒤가
// "0 substep 으로 방치" 에서 "다음 두 substep 에 풀린다" 로 바뀐다.
//
// 2026-08-12(1.4): 그 배치의 **목표점**을 x=20 → x=30 으로 옮겼다. 옛 배치의 겹침 12.50 은
// 밀린 칩이 벽을 12.5 px 파고든 상태(=P0-3 그 자체)에서 나온 값이라, 판 밖 고착을 고치면
// 재현되지 않는다. 골든은 15.00 → 3.073 → 0 으로 다시 쟀다. 하네스(physicsProbe.ts)는
// 1.3 에서도 1.4 에서도 한 줄도 바뀌지 않았다 — 계기가 아니라 판이 바뀐 것이다.
// 루프 계약 자체(상한 8초·기하 분리 폴백·쥔 칩 제외)는 physics/selfSeparate.test.ts 가 본다.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPhysicsProbe } from './physicsProbe.ts';
import { CHAIR, DEFAULT_LIMITS, PHYS } from '../../core/constants.ts';
import { kmhToPxPerS } from '../../core/units.ts';
import type { ChairId } from '../../core/ids.ts';

const chA = 'ch_a' as ChairId;
const chB = 'ch_b' as ChairId;

/** 코트 왼쪽 벽의 안쪽 면은 정확히 x=0 이다(§5.7 — 벽은 viewBox 테두리 바깥에 붙는다). */
const WALL_X = 0;
const Y = 262.5; // full 코트 세로 중앙

afterEach(() => {
  vi.restoreAllMocks(); // probe.dispose() 가 이미 되돌리지만, 도중에 실패해도 새지 않게.
});

describe('physicsProbe 자기 검산 — 클럭', () => {
  it('한 프레임 = 정확히 한 substep = PHYS.dtMs', () => {
    const probe = createPhysicsProbe({ chairs: [{ id: chA, x: 400, y: Y }] });
    probe.startDrag(chA);
    probe.moveTo({ x: 700, y: Y }); // 1초로는 못 닿는 먼 목표 — 내내 최고속으로 끌린다
    probe.stepFrames(60);

    // 0번 행은 "아무것도 돌기 전" 이고, 이후 60 행이 각각 정확히 한 번씩 돌아야 한다.
    expect(probe.trace).toHaveLength(61);
    expect(probe.trace[0]!.substeps).toBe(0);
    expect(probe.trace.slice(1).map((r) => r.substeps)).toEqual(new Array(60).fill(1));
    expect(probe.trace.at(-1)!.tMs).toBeCloseTo(60 * PHYS.dtMs, 6);

    // 60 substep × (69.4444 px/s ÷ 120) = 34.7222 px. 한도(§2.6)를 그대로 재현한다.
    const moved = probe.trace.at(-1)!.poses[chA]!.x - 400;
    expect(moved).toBeCloseTo((60 * kmhToPxPerS(DEFAULT_LIMITS.linearKmh)) / 120, 4);
    expect(moved).toBeCloseTo(34.7222, 4);

    probe.dispose();
  });
});

describe('physicsProbe 자기 검산 — 겹침 깊이 계기', () => {
  // 휠체어 hull 은 피벗 기준 x∈[-7.5,30], y∈[-12.5,12.5] 다(§3.4). 같은 y 에 두고 x 로만
  // 어긋나게 놓으면 겹침 깊이는 산수로 나온다 — 계기를 그 값에 맞춰 본다.
  const setup = (gap: number) => ({
    chairs: [
      { id: chA, x: CHAIR.pivotToRearPx + gap, y: Y }, // 뒷면이 x=gap
      { id: chB, x: WALL_X + CHAIR.pivotToRearPx, y: Y }, // 앞면이 x=37.5
    ],
    watch: [[chA, chB]] as ReadonlyArray<readonly [string, string]>,
  });

  it('맞물린 두 휠체어 — matter 경로와 obb.satOverlap 경로가 같은 값을 준다', () => {
    // A 뒷면 x=25, B 앞면 x=37.5 → 겹침 12.5. 가로 겹침(12.5)이 세로 겹침(25)보다 작으므로
    // SAT 의 최소축은 x 다.
    const probe = createPhysicsProbe(setup(25));
    expect(probe.depthBetween(chA, chB)).toBeCloseTo(12.5, 9);
    expect(probe.chairSatDepth(chA, chB)).toBeCloseTo(12.5, 9);
    expect(probe.trace[0]!.depths[`${chA}|${chB}`]).toBeCloseTo(12.5, 9);
    probe.dispose();
  });

  it('떨어져 있으면 0 (두 경로 모두)', () => {
    const probe = createPhysicsProbe(setup(40)); // A 뒷면 x=40, B 앞면 x=37.5 → 2.5 px 간격
    expect(probe.depthBetween(chA, chB)).toBe(0);
    expect(probe.chairSatDepth(chA, chB)).toBe(0);
    probe.dispose();
  });
});

// ── 본론 ────────────────────────────────────────────────────────────────────────────
describe('P0-1 — 손을 떼면 겹침이 풀릴 때까지 루프가 남는다', () => {
  // 시나리오: 벽에 딱 붙여 세워 둔 칩(B) 위로 다른 칩(A)을 끌어다 놓고, 잠깐 멈췄다가 손을 뗀다.
  //
  //  · B 는 뒷면이 벽면(x=0)에 닿아 있다 → 피벗 x = 7.5, 앞면 x = 37.5
  //  · A 를 x=30 까지 끌면 A 의 뒷면은 x=22.5 → 겹침은 37.5 − 22.5 = **15.00 px** 다.
  //  · B 는 한 픽셀도 안 움직인다: 왼쪽은 벽이고, 벽 너머로 밀려나는 것은 §4.2 P0-3 의
  //    안전망(escapePinnedAll → pushChairIntoBounds)이 매 substep 되돌린다. 그래서 겹침이
  //    해석적으로 딱 떨어진다.
  //
  // 2026-08-12(1.4) 이전에는 여기가 `x=20` 이었고 겹침이 12.50 이었다 — 그 12.50 은 **밀린 B 가
  // 피벗 x=-5(차체 뒤끝 -12.5)까지 벽을 파고든 채 평형에 든 결과**였다. P0-3 을 고치면서 그
  // 배치 자체가 성립하지 않게 됐으므로(B 가 판 안에 남는다) 목표점을 옮겨 다시 잡았다.
  const DRAG_TO_X = 30;
  const HOLD_FRAMES = 140; // A 가 30 px 를 가는 데 52 substep + B 가 멎을 여유

  function draggedIntoWallChip() {
    const probe = createPhysicsProbe({
      chairs: [
        { id: chA, x: 60, y: Y }, // B 와 떨어진 곳에서 출발
        { id: chB, x: WALL_X + CHAIR.pivotToRearPx, y: Y },
      ],
      watch: [[chA, chB]],
    });
    probe.startDrag(chA);
    probe.moveTo({ x: DRAG_TO_X, y: Y });
    probe.stepFrames(HOLD_FRAMES);
    return probe;
  }

  it('손을 떼기 직전: 15.00 px 겹친 채로 이미 isSettled()===true 다(속도만 보는 판정)', () => {
    const probe = draggedIntoWallChip();
    const last = probe.trace.at(-1)!;

    expect(last.poses[chA]!.x).toBeCloseTo(DRAG_TO_X, 6); // 목표에 도달해 멈춰 있다
    expect(last.depths[`${chA}|${chB}`]).toBeCloseTo(15, 6);
    expect(probe.chairSatDepth(chA, chB)).toBeCloseTo(15, 6); // 독립 경로 교차검증
    // ★ 15 px 이 겹쳐 있는데도 "정착" 이다 — allAtRest 는 속도만 본다(world.ts:221-225).
    expect(last.settled).toBe(true);
    expect(last.running).toBe(true); // 아직은 드래그가 루프를 붙들고 있다

    // 대조군: 마지막 행의 true 는 "처음부터 켜져 있던 상수" 가 아니다. 30 px 를 vLin 으로 가는
    // 데 52 프레임이 걸리고(30 ÷ 0.5787 = 51.8), 그중 B 가 실제로 밀리는 26~52 프레임은
    // isSettled()===false 였다. 손을 뗄 때의 true 는 "B 가 낀 채로 멎었다" 는 뜻이다.
    const arrived = probe.trace.findIndex((r) => Math.abs(r.poses[chA]!.x - DRAG_TO_X) < 1e-9);
    expect(arrived).toBe(52);
    const unsettled = probe.trace.filter((r) => !r.settled).map((r) => r.frame);
    expect([unsettled[0], unsettled.at(-1)]).toEqual([26, 52]);

    probe.dispose();
  });

  it('손을 떼면 그 프레임에 endDrag·requestSettle 이 일어나지만 stop 은 따라붙지 않는다', () => {
    const probe = draggedIntoWallChip();
    const releaseFrame = probe.frame(); // 다음에 기록될 프레임 = 릴리스가 완결될 프레임

    probe.endDrag();
    const framesToStop = probe.runUntilLoopStops({ maxFrames: 60 });

    // 릴리스 체이스 자체는 목표에 이미 닿아 있어 첫 substep 에 끝난다(§5.11 |T−G| < 1px).
    const end = probe.sessionEvents.find((e) => e.kind === 'endDrag')!;
    expect(end.id).toBe(chA);
    expect(end.frame).toBe(releaseFrame);

    // 하지만 판은 아직 서지 않았다 — 15.00 px 이 겹쳐 있으므로 루프가 3 프레임 더 남는다.
    // (고치기 전에는 이 값이 1 이었고, 그 1 이 곧 P0-1 이었다.)
    expect(framesToStop).toBe(3);

    // 릴리스 프레임의 루프 사건은 settle 뿐이다.
    const tail = probe.loopEvents.filter((e) => e.frame === releaseFrame).map((e) => e.kind);
    expect(tail).toEqual(['settle']);
    // stop 은 그 3 프레임의 **마지막** 프레임에 온다(릴리스 프레임 자신이 그중 첫 프레임이다).
    const stop = probe.loopEvents.find((e) => e.kind === 'stop')!;
    expect(stop.frame).toBe(releaseFrame + 2);

    probe.dispose();
  });

  it('★ 겹침 15.00 px 는 손을 뗀 뒤 두 substep 만에 3.073 → 0 으로 풀린다', () => {
    const probe = draggedIntoWallChip();
    const releaseFrame = probe.frame();
    probe.endDrag();

    // (1) 릴리스 프레임: 겹침 15.00 과 "정착"(속도 0)이 같은 행에 있다. **원인은 그대로다** —
    //     allAtRest 는 여전히 겹침을 못 본다. 달라진 것은 그 판정이 루프를 끄지 못한다는 것뿐이다.
    probe.stepFrames(1);
    const held = probe.trace.at(-1)!;
    expect(held.frame).toBe(releaseFrame);
    expect(held.substeps).toBe(1); // endDrag 를 품은 substep
    expect(held.settled).toBe(true);
    expect(held.running).toBe(true); // ★ 고치기 전에는 여기가 false 였다
    expect(held.depths[`${chA}|${chB}`]).toBeCloseTo(15, 6);

    // (2) 다음 프레임 — 위치 해결이 처음으로 돈다. 15.00 → 3.073, A 가 11.9 px 물러난다.
    //     ★ 그 11.9 px 동안에도 isSettled() 는 **참**이다: matter 의 위치 해결은 positionPrev
    //     까지 같이 옮겨 속도를 만들지 않는다(Resolver.postSolvePosition). 이 한 줄이 1.3 의
    //     전제 그 자체다 — 속도만 보는 판정은 이 움직임을 원리적으로 못 본다.
    probe.stepFrames(1);
    const first = probe.trace.at(-1)!;
    expect(first.substeps).toBe(1);
    expect(first.depths[`${chA}|${chB}`]).toBeCloseTo(3.073, 3);
    expect(first.poses[chA]!.x - DRAG_TO_X).toBeCloseTo(11.927, 2);
    expect(first.settled).toBe(true);

    // (3) 그 다음 프레임에 겹침이 0 이 된다. 푸는 데 필요했던 것은 8.3 ms 두 조각뿐이었다.
    probe.stepFrames(1);
    const dead = probe.trace.at(-1)!;
    expect(dead.depths[`${chA}|${chB}`]).toBe(0);

    // (4) 겹침이 0 이 된 그 프레임에 루프가 멎는다 — 붙들고 있던 것이 겹침뿐이었기 때문이다.
    expect(dead.frame).toBe(releaseFrame + 2); // 릴리스 프레임 포함 3 프레임의 마지막
    expect(dead.running).toBe(false);
    expect(dead.settled).toBe(true);

    // (5) 그 뒤로는 프레임을 아무리 흘려도 한 substep 도 돌지 않는다 — 다 선 판이다.
    probe.stepFrames(30);
    const after = probe.trace.slice(dead.frame + 1);
    expect(after.reduce((s, r) => s + r.substeps, 0)).toBe(0);
    expect(after.at(-1)!.depths[`${chA}|${chB}`]).toBe(0);

    probe.dispose();
  });
});
