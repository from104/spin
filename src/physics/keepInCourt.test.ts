// §4.2 P0-3 — 판 밖은 존재하지 않는다(밀려난 개체가 코트 밖에 고착되지 않는다).
//
// 잡은 칩은 판 밖으로 못 나간다 — drag.ts:90 의 resolveMotion 이 bounds 를 막는다. 그런데
// **밀려나는 쪽** 칩에는 그 보장이 없었다: 드래그 중인 칩은 static, 벽도 static 이라 그 사이에
// 낀 칩은 §5.6 이 말하는 임펄스 상쇄에 걸리고, matter 는 넘치는 만큼을 양쪽에 **반씩** 나눠
// 준다 — 그 절반이 곧 벽 너머다. 실측(1.4 이전): 벽에 뒷면을 붙여 세워 둔 칩 위로 다른 칩을
// x=20 까지 끌면 밀린 칩이 피벗 **x=-5**(차체 뒤끝 -12.5)로 나가 그대로 굳었다.
//
// 고친 자리는 `escapePinnedAll`(world.ts) 한 곳이다. 그 함수는 `label==='chair'` 를 radius
// undefined 로 건너뛰고 있었다 — 휠체어는 원이 아니라 OBB 라 원 기준 탈출(escapePinned)에
// 태울 수 없었기 때문이다. 그래서 hull 기준으로 되미는 `pushChairIntoBounds` 를 obb.ts 에
// 따로 두고, 매 substep 그것을 통과시킨다.
//
// 0차 실측 하네스(physicsProbe)로 돌린다 — 판정이 "정착 후 한 시점" 이 아니라 "드래그 내내
// 단 한 프레임도" 이므로 프레임 전수를 볼 수 있어야 한다.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPhysicsProbe } from '../test/helpers/physicsProbe.ts';
import { outOfBounds } from './obb.ts';
import { COURT_DEFS } from '../model/court.ts';
import { CHAIR } from '../core/constants.ts';
import type { ChairId } from '../core/ids.ts';
import type { Bounds } from './types.ts';

const chA = 'ch_a' as ChairId;
const chB = 'ch_b' as ChairId;

const FULL: Bounds = { w: COURT_DEFS.full.vbW, h: COURT_DEFS.full.vbH };
const Y = 262.5; // full 코트 세로 중앙
/** 1.4 이전에 밀린 칩이 굳었던 자리를 만드는 목표점. A 뒷면이 x=12.5 라 B(37.5 길이)가
 *  들어갈 자리가 12.5 px 밖에 없다 — 초과분 25 px 이 반씩 갈려 B 가 x=-5 로 나갔다. */
const DRAG_TO_X = 20;

afterEach(() => {
  vi.restoreAllMocks();
});

/** 벽에 뒷면을 붙여 세워 둔 칩(B) 위로 다른 칩(A)을 끌어다 놓는다. */
function crushAgainstWall(dragToX = DRAG_TO_X) {
  const probe = createPhysicsProbe({
    chairs: [
      { id: chA, x: 60, y: Y },
      { id: chB, x: CHAIR.pivotToRearPx, y: Y },
    ],
    watch: [[chA, chB]],
  });
  probe.startDrag(chA);
  probe.moveTo({ x: dragToX, y: Y });
  probe.stepFrames(140);
  return probe;
}

/** 두 칩 모두 hull 전체가 판 안인가. 가장 심한 위반 깊이를 돌려준다(≤0 이면 판 안). */
const worstOut = (poses: Record<string, { x: number; y: number; theta: number }>): number =>
  Math.max(outOfBounds(poses[chA]!, FULL).depth, outOfBounds(poses[chB]!, FULL).depth);

describe('P0-3 — 밀린 칩이 판 밖으로 나가지 않는다', () => {
  it('★ x=-5 재현 시나리오: 정착 후 차체 전체가 viewBox 안이다', () => {
    const probe = crushAgainstWall();
    const held = probe.api.read()[chB]!;

    // ★ 완료 판정. 고치기 전에는 여기가 x=-5(뒷면 -12.5)였다.
    expect(held.x).toBeGreaterThan(0);
    expect(outOfBounds(held, FULL).depth).toBeLessThanOrEqual(0);
    // 벽에 막혀 물러설 자리가 없으므로 뒷면이 벽면(x=0)에 정확히 닿은 채로 선다.
    expect(held.x).toBeCloseTo(CHAIR.pivotToRearPx, 9);
    expect(probe.trace.at(-1)!.settled).toBe(true); // 그 자리에서 실제로 멎어 있다

    // 손을 뗀 뒤 정착까지 진행해도 마찬가지다(안전망이 정착 좌표를 만들어 낸 것이 아니다).
    probe.endDrag();
    probe.runUntilLoopStops({ maxFrames: 1200 });
    expect(worstOut(probe.api.read())).toBeLessThanOrEqual(0);

    probe.dispose();
  });

  it('쥐고 있는 동안에도 단 한 프레임도 판 밖에 있지 않다', () => {
    // "정착 후" 만 보면 늦다 — 손 떼는 순간의 스냅샷이 곧 모델에 커밋되는 좌표다(§4.2 P0-2).
    const probe = crushAgainstWall();
    const outside = probe.trace.filter((r) => worstOut(r.poses) > 1e-9).map((r) => r.frame);
    expect(outside).toEqual([]);
    probe.dispose();
  });

  it('차체 위로 완전히 올라타도 — 겹침은 남을지언정 판 밖으로는 안 나간다', () => {
    // A 를 x=20 보다 더 밀어붙이면 겹침이 차체 폭을 넘어 SAT 최소축이 세로로 뒤집히고, 그때
    // matter 가 B 를 옆으로 뱉어낸다. 어느 쪽이든 판 밖은 아니어야 한다.
    const probe = crushAgainstWall(0);
    expect(worstOut(probe.api.read())).toBeLessThanOrEqual(0);
    probe.endDrag();
    probe.runUntilLoopStops({ maxFrames: 1200 });
    expect(worstOut(probe.api.read())).toBeLessThanOrEqual(0);
    probe.dispose();
  });

  it('판 밖 좌표로 저장돼 있던 스텝도 첫 substep 에 판 안으로 돌아온다', () => {
    // 이 버그가 살아 있던 동안 저장된 드릴에는 x=-5 같은 좌표가 실제로 들어 있다(손 떼는
    // 순간의 스냅샷이 그대로 커밋되므로). 안전망이 매 substep 도는 덕에 그런 스텝은 열자마자
    // 스스로 낫는다 — 판정 시점을 "드래그" 로 좁히지 않는 이유다.
    const probe = createPhysicsProbe({ chairs: [{ id: chB, x: -5, y: Y }] });
    expect(outOfBounds(probe.api.read()[chB]!, FULL).depth).toBeCloseTo(12.5, 9); // 전제
    probe.forceSteps(1);
    expect(probe.api.read()[chB]!.x).toBeCloseTo(CHAIR.pivotToRearPx, 9);
    probe.dispose();
  });

  it('쥔 칩은 안전망이 옮기지 않는다 — 손이 있는 동안에는 손이 권위다', () => {
    // 잡은 칩은 static 이고 판 밖을 막는 것은 drag.ts 의 resolveMotion 이다. 안전망이 여기
    // 끼어들면 사용자가 쥐고 있는 칩이 손 밑에서 빠져나간다.
    const probe = createPhysicsProbe({ chairs: [{ id: chB, x: -5, y: Y }] });
    probe.startDrag(chB);
    probe.stepFrames(5);
    expect(probe.api.read()[chB]!.x).toBe(-5); // 한 픽셀도 안 옮겨졌다
    // 손을 떼면 그때 낫는다.
    probe.endDrag();
    probe.runUntilLoopStops({ maxFrames: 300 });
    expect(outOfBounds(probe.api.read()[chB]!, FULL).depth).toBeLessThanOrEqual(0);
    probe.dispose();
  });

  it('판 안에 있는 칩은 안전망이 한 픽셀도 건드리지 않는다', () => {
    // 대조군: 겹치지도 벽에 닿지도 않는 배치에서는 이웃 칩의 좌표가 부동소수까지 그대로다.
    const probe = createPhysicsProbe({
      chairs: [
        { id: chA, x: 300, y: Y },
        { id: chB, x: 500, y: Y },
      ],
    });
    const before = probe.api.read()[chB]!;
    probe.startDrag(chA);
    probe.moveTo({ x: 340, y: Y });
    probe.stepFrames(120);
    const after = probe.api.read()[chB]!;
    expect(after).toEqual(before);
    probe.dispose();
  });
});
