// physicsProbe 자기 검산 + P0-1 현상 고정. §5.8/§5.9/§5.11.
//
// 앞의 두 describe 는 **계기 자신**을 검산한다(자를 먼저 재는 일): 프레임↔substep 이 1:1 인가,
// 겹침 깊이가 해석적으로 맞는가. 뒤의 describe 가 본론이다.
//
// ⚠️ 마지막 describe 가 못박는 것은 **지금의 버그**다(P0-1). 손을 뗀 칩이 dynamic 으로 돌아온
// 직후, 겹침 12.50 px 를 안은 채 isSettled()===true 가 떠서 루프가 그 프레임에 죽는다 —
// 물리는 그 겹침을 풀 기회를 **한 substep 도** 얻지 못한다. 1.3 이 이 버그를 고치면 이 골든값
// (12.50 / 2.728 / "정지 후 0 substep")은 반드시 갱신해야 한다. 그때 갱신해야 할 것은 이
// 파일뿐이고 하네스(physicsProbe.ts)는 그대로다.
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
describe('P0-1 — 손을 뗀 그 프레임에 루프가 죽는다(겹친 채로)', () => {
  // 시나리오: 벽에 딱 붙여 세워 둔 칩(B) 위로 다른 칩(A)을 끌어다 놓고, 잠깐 멈췄다가 손을 뗀다.
  //
  //  · B 는 뒷면이 벽면(x=0)에 닿아 있다 → 피벗 x = 7.5
  //  · A 를 x=20 까지 끌면 A 의 뒷면은 x=12.5 → 벽과 A 사이 틈이 12.5 px 인데 B 는 37.5 px 다.
  //    초과분 25 px 이 **양쪽에 반씩** 갈려 A↔B 12.5 px / B↔벽 12.5 px 로 평형이 된다
  //    (드래그 중인 A 도 벽도 static = 무한질량이라 B 만 밀리고, 두 접촉이 대칭이다).
  //  · 그래서 손을 떼는 순간의 겹침은 해석적으로 정확히 CHAIR.widthPx/2 = 12.50 px 다.
  const DRAG_TO_X = 20;
  const HOLD_FRAMES = 140; // A 가 40 px 를 가는 데 69 substep + B 가 멎을 여유

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

  it('손을 떼기 직전: 12.50 px 겹친 채로 이미 isSettled()===true 다(속도만 보는 판정)', () => {
    const probe = draggedIntoWallChip();
    const last = probe.trace.at(-1)!;

    expect(last.poses[chA]!.x).toBeCloseTo(DRAG_TO_X, 6); // 목표에 도달해 멈춰 있다
    expect(last.depths[`${chA}|${chB}`]).toBeCloseTo(12.5, 6);
    expect(probe.chairSatDepth(chA, chB)).toBeCloseTo(12.5, 6); // 독립 경로 교차검증
    // ★ 12.5 px 이 겹쳐 있는데도 "정착" 이다 — allAtRest 는 속도만 본다(world.ts:221-225).
    expect(last.settled).toBe(true);
    expect(last.running).toBe(true); // 아직은 드래그가 루프를 붙들고 있다

    // 대조군: 마지막 행의 true 는 "처음부터 켜져 있던 상수" 가 아니다. 40 px 를 vLin 으로 가는
    // 데 70 프레임이 걸리고(40 ÷ 0.5787 = 69.1), 그중 B 가 실제로 밀리는 26~69 프레임은
    // isSettled()===false 였다. 손을 뗄 때의 true 는 "B 가 낀 채로 멎었다" 는 뜻이다.
    const arrived = probe.trace.findIndex((r) => Math.abs(r.poses[chA]!.x - DRAG_TO_X) < 1e-9);
    expect(arrived).toBe(70);
    const unsettled = probe.trace.filter((r) => !r.settled).map((r) => r.frame);
    expect([unsettled[0], unsettled.at(-1)]).toEqual([26, 69]);

    probe.dispose();
  });

  it('손을 떼면 그 프레임에 endDrag·requestSettle·stop 이 한꺼번에 일어난다', () => {
    const probe = draggedIntoWallChip();
    const releaseFrame = probe.frame(); // 다음에 기록될 프레임 = 릴리스가 완결될 프레임

    probe.endDrag();
    const framesToStop = probe.runUntilLoopStops({ maxFrames: 60 });

    // 릴리스 체이스는 목표에 이미 닿아 있어 첫 substep 에 끝난다(§5.11 |T−G| < 1px).
    expect(framesToStop).toBe(1);

    const end = probe.sessionEvents.find((e) => e.kind === 'endDrag')!;
    expect(end.id).toBe(chA);
    expect(end.frame).toBe(releaseFrame);

    // 같은 프레임에 requestSettle → (atRest 이므로) 즉시 stop. 그 사이에 낀 substep 은 없다.
    const tail = probe.loopEvents.filter((e) => e.frame === releaseFrame).map((e) => e.kind);
    expect(tail).toEqual(['settle', 'stop']);

    probe.dispose();
  });

  it('★ 겹침 12.50 px + isSettled()===true 로 루프가 죽고, 그 뒤 물리는 한 substep 도 못 돈다', () => {
    const probe = draggedIntoWallChip();
    probe.endDrag();
    probe.runUntilLoopStops({ maxFrames: 60 });

    // (1) 루프가 죽은 그 프레임 — 겹침과 "정착" 이 같은 행에 있다. 이것이 P0-1 의 물증이다.
    const dead = probe.trace.at(-1)!;
    expect(dead.substeps).toBe(1); // endDrag 를 품은 마지막 substep
    expect(dead.running).toBe(false);
    expect(dead.settled).toBe(true);
    expect(dead.depths[`${chA}|${chB}`]).toBeCloseTo(12.5, 6);

    // (2) 그 뒤로는 프레임을 아무리 흘려도 **한 substep 도 돌지 않는다** — rAF 가 없다.
    probe.stepFrames(30);
    const after = probe.trace.slice(dead.frame + 1);
    expect(after).toHaveLength(30);
    expect(after.reduce((s, r) => s + r.substeps, 0)).toBe(0);
    expect(after.every((r) => r.settled && !r.running)).toBe(true);
    expect(after.at(-1)!.depths[`${chA}|${chB}`]).toBeCloseTo(12.5, 6); // 겹침 그대로 방치

    // (3) 반사실: 루프가 딱 한 프레임만 더 돌았다면 겹침은 12.50 → 2.728 로 떨어졌다.
    //     푸는 데 필요한 것은 8.3 ms 한 조각뿐이었다.
    probe.forceSteps(1);
    const revived = probe.trace.at(-1)!;
    expect(revived.substeps).toBe(1);
    expect(revived.depths[`${chA}|${chB}`]).toBeCloseTo(2.728, 3);
    // 그리고 그 한 조각이 칩을 19.5 px 튀어나가게 한다 — 화면에서는 "손 떼자마자 순간이동" 이다.
    expect(revived.poses[chA]!.x - DRAG_TO_X).toBeCloseTo(19.544, 2);
    // 튀는 동안에는 속도가 붙어 isSettled() 가 비로소 false 가 된다(정지 → 이동 → 정지).
    expect(revived.settled).toBe(false);

    probe.dispose();
  });
});
