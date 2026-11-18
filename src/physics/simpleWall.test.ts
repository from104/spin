// 심플 모드의 벽(원 하나)과 안전망 — 원을 벽에 붙이고 그 판에서 손이 일한다(2026-11-19 「기본, 심플 모드 완전 분리」, PLAN-SIMPLE-DRIVE A7).
// 지우면 새는 실기 버그: (1) 심플에서 원을 벽까지 끌어 놓는 순간 안전망이 실물 차체 규칙으로 밀어 원이 벽에서 13.5 px 떨어진다
// (바둑돌을 벽에 못 붙인다), (2) 같은 판에서 **다른** 칩을 끌기만 해도 그 칩이 밀리고 드래그 정착 커밋이 스냅샷 전부를 드릴에 쓴다,
// (3) 평소 모드에서 뒤를 벽에 댄 칩(원 6 px 밖)을 심플에서 잡아 벽을 따라 끌면 원이 판 밖인 채 놓인다.
// ── 2026-11-19 개정: 옛 둘째 단언 「평소로 돌아가 다른 칩을 끌어도 그 자리(차체 13.5 px 밖인 채)」는 기현님 선택 *"복귀 때 판 안으로"*
// 로 계약이 바뀌었다 — 이제 심플을 끄는 순간 EditorProvider 가 그런 칩을 판 안으로 넣는다(EditorProvider.wallFit.test.tsx). 평소 모드에서
// 벽 밖 칩을 손으로 벽 따라 끄는 옛 셋째 단언도 같은 이유로 뜻을 잃어, 그 거울(심플에서 뒤를 댄 칩)로 바꿨다.
import { describe, expect, it } from 'vitest';
import { createPhysicsWorld } from './index.ts';
import type { DrillCast, DrillStep } from '../model/drill.ts';
import { CHAIR, PHYS } from '../core/constants.ts';
import type { ChairId, StepId } from '../core/ids.ts';
import { DISC_RADIUS_PX } from '../model/chairDisc.ts';

const mover = 'ch_mover' as ChairId;
const parked = 'ch_parked' as ChairId;
const W = 825;
const cast: DrillCast = {
  chairs: [
    { id: mover, team: 'home', number: '2', isGk: false },
    { id: parked, team: 'away', number: '3', isGk: false },
  ],
  balls: [],
  cones: [],
};

function drag(api: ReturnType<typeof createPhysicsWorld>, id: ChairId, from: { x: number; y: number }, to: { x: number; y: number }, s: number): void {
  const h = api.beginDrag({ kind: 'chair', id, s }, from)!;
  let now = 0;
  for (let i = 0; i < 1400; i++) {
    now += PHYS.dtMs;
    h.move(to, now);
    api.step(PHYS.dtS);
  }
  h.end();
  for (let i = 0; i < 240; i++) api.step(PHYS.dtS);
}

describe('심플 모드 — 원이 벽에 붙고, 손대지 않으면 그대로', () => {
  it('★ 원은 앞을 벽 쪽으로 두고도 벽까지 닿고, 다른 칩을 끌어도 그 자리 그대로다', () => {
    const api = createPhysicsWorld(W, 525);
    api.setInteract(false); // EditorProvider 의 심플 effect 와 같은 두 줄
    api.setDiscBounds(true);
    const step: DrillStep = {
      id: 'st_x' as StepId, name: '', note: '',
      // θ = 0 — 앞(+x)이 오른쪽 벽을 본다
      chairs: { [mover]: { x: 400, y: 300, angleDeg: 0 }, [parked]: { x: 300, y: 100, angleDeg: 0 } },
      balls: {}, cones: {}, arrows: [], notes: [], shapes: [],
    };
    api.load(cast, step, 'full');
    drag(api, parked, { x: 300, y: 100 }, { x: 900, y: 100 }, 0.5);
    const parkedX = api.read()[parked]!.x;
    expect(W - DISC_RADIUS_PX - parkedX).toBeLessThan(0.05); // 원이 벽에 닿았다(놓은 뒤 정착까지 지나도)

    drag(api, mover, { x: 400, y: 300 }, { x: 500, y: 300 }, 0.25);
    const snap = api.read();
    api.dispose();
    expect(snap[mover]!.x).toBeGreaterThan(450); // 전제: 다른 칩은 실제로 끌렸다
    expect(snap[parked]!.x).toBe(parkedX);
  });

  it('★ 평소에서 뒤를 벽에 댄 칩(원 6 px 밖)을 심플에서 **잡아 벽을 따라 끌면** 원 규칙으로 놓인다 — 원이 판 밖인 채 서지 않는다', () => {
    // 끌기 경계는 이미 판 밖인 출발 자세를 "더 나가지 않게"만 막는다 — 관대한 안전망까지 두면 손으로 옮긴 칩이 판 밖인 채 저장된다.
    // 잡았다 제자리에 놓은 것(탭)은 그대로다(simpleBounds.test.ts).
    const api = createPhysicsWorld(W, 525);
    api.setInteract(false);
    api.setDiscBounds(true);
    const x = CHAIR.pivotToRearPx; // 평소에서 뒤를 왼쪽 벽에 댄 자리
    api.load(cast, {
      id: 'st_x' as StepId, name: '', note: '',
      chairs: { [mover]: { x: 400, y: 300, angleDeg: 0 }, [parked]: { x, y: 100, angleDeg: 0 } },
      balls: {}, cones: {}, arrows: [], notes: [], shapes: [],
    }, 'full');
    drag(api, parked, { x, y: 100 }, { x, y: 400 }, 0.5);
    const p = api.read()[parked]!;
    api.dispose();
    expect(p.y).toBeGreaterThan(300); // 전제: 실제로 벽을 따라 끌렸다
    expect(p.x).toBeCloseTo(DISC_RADIUS_PX, 1);
  });
});
