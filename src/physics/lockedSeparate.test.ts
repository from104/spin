// 잠긴 휠체어는 **기하 분리 폴백에서도** 안 움직인다.
//
// §4.2 P0-1 은 물리가 영영 못 푸는 겹침을 상한(PHYS.settleMaxMs)에서 기하로 1회 떼어 놓는다
// (`separateNow`). 그 경로는 물리를 안 거치므로 `isStatic` 이 아무것도 막아 주지 않는다 —
// 잠긴 칩도 그냥 새 좌표를 받아 쓴다. 그러면 "물리로는 안 밀리는데 정착할 때 옮겨져 있다"
// 가 되어, 잠금이 지키는 것이 좌표가 아니라 **좌표를 바꾸는 방법 하나**뿐인 셈이 된다.
//
// 겹침이 애초에 왜 생기는가: 끌어다 만드는 경로는 lockedBlocks.test 가 막았으므로, 여기서
// 재는 것은 **이미 겹친 채로 저장된 스텝**을 연 경우다(잠그기 전에 겹쳐 두고 잠그면 그대로
// 만들어진다). 칩 두 대가 들어갈 자리가 없는 판을 쓰는 이유는 loopLifecycle.test 와 같다 —
// 정규 코트에서는 물리가 120 프레임 안에 다 풀어 버려 폴백이 아예 안 돈다.
import { describe, expect, it } from 'vitest';
import { createPhysicsProbe } from '../test/helpers/physicsProbe.ts';
import type { ChairId } from '../core/ids.ts';

const chA = 'ch_a' as ChairId;
const chB = 'ch_b' as ChairId;

/** 물리가 못 푸는 겹침을 만들고 손을 뗀 뒤 루프가 멎을 때까지 흘린다. chB 의 최종 좌표를 준다. */
function settleInCrampedCourt(locked?: readonly string[]): { bx: number; by: number } {
  const p = createPhysicsProbe({
    court: { w: 60, h: 40 },
    chairs: [
      { id: chA, x: 20, y: 20 },
      { id: chB, x: 25, y: 20 },
    ],
    ...(locked ? { locked } : {}),
  });
  p.startDrag(chA);
  p.moveTo({ x: 25, y: 20 });
  p.stepFrames(10);
  p.endDrag();
  p.runUntilLoopStops({ maxFrames: 2000 });
  const b = p.api.read()[chB]!;
  const out = { bx: b.x, by: b.y };
  p.dispose();
  return out;
}

describe('잠긴 휠체어는 기하 분리 폴백에서도 안 움직인다', () => {
  it('대조군: 잠기지 않았으면 폴백이 실제로 옮긴다', () => {
    const { bx, by } = settleInCrampedCourt();
    // 이 단언이 깨지면 아래 ★ 는 "잠금이 지켰다" 가 아니라 "원래 아무도 안 옮긴다" 를 보고
    // 있는 것이라 뜻이 없다 — 폴백이 도는 배치인지부터 여기서 확인한다.
    expect(Math.hypot(bx - 25, by - 20), '폴백이 돌지 않는 배치다 — 이 파일은 아무것도 못 잰다').toBeGreaterThan(0.5);
  });

  it('★ 잠긴 칩은 폴백이 돌아도 처음 좌표 그대로다', () => {
    const { bx, by } = settleInCrampedCourt([chB]);
    expect(bx, '잠긴 칩이 기하 분리에 밀렸다 — 물리(static)와 기하가 다른 말을 하고 있다').toBeCloseTo(25, 6);
    expect(by, '잠긴 칩이 기하 분리에 밀렸다').toBeCloseTo(20, 6);
  });
});
