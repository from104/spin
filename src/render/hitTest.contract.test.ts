// §10.7 render-stage 측 검증 — physics-world 의 hitTest()/zoneHandles() 계약을 소비자
// 관점에서 고정한다. render-stage 프로덕션 코드는 physics 를 "타입만" 의존하지만(§8),
// 이 테스트는 §10.7 체크리스트가 명시적으로 요구하는 항목이라 검증 목적의 런타임 import 를
// 허용한다(hitTest.ts/kinematics.ts 자체는 physics-kin/physics-world 소유이고 이 파일은
// 수정하지 않는다).
import { describe, expect, it } from 'vitest';
import type { ChairId, BallId } from '../core/ids.ts';
import { INTERACT } from '../core/constants.ts';
import type { ChairPose } from '../model/chair.ts';
import { grabFromLever, grabPoint } from '../physics/kinematics.ts';
import { hitTest, zoneHandles, forgivingRadius } from '../physics/index.ts';
import type { HitContext, SceneSnapshot } from '../physics/index.ts';

const chairId = (n: number) => `ch_t${n}` as ChairId;
const ballId = (n: number) => `bl_t${n}` as BallId;

const baseCtx: HitContext = {
  zones: { sTowRearMax: 0.12, sSpinMin: 0.32, sTowFrontMin: 0.85, grabPadPx: 10 },
  pxPerUnit: 1,
  pointerType: 'mouse',
  selectedChairId: null,
  selectedArrowId: null,
  handlesVisible: false,
  tool: 'select',
};

function emptyScene(): SceneSnapshot {
  return { chairs: [], balls: [], cones: [], notes: [], arrows: [] };
}

describe('hitTest 우선순위(§5.12) — render-stage 소비 관점', () => {
  it('저배율에서 공이 가드 앞 8px 에 있어도 차체 내부 탭은 휠체어를 반환한다(§6.5 상한 blocker)', () => {
    const chairA = chairId(1);
    const pose: ChairPose = { x: 0, y: 0, theta: 0 };
    // 가드 앞 8px = 앞끝(pivotToFrontPx=30)에서 8px 더 나간 지점.
    const ball = { id: ballId(1), p: { x: 38, y: 0 } };
    const scene: SceneSnapshot = { ...emptyScene(), chairs: [{ id: chairA, pose }], balls: [ball] };
    // pxPerUnit 을 낮춰(줌아웃) 상한 없이는 공의 히트원이 차체 안쪽까지 삼킬 배율을 만든다.
    const ctx: HitContext = { ...baseCtx, pxPerUnit: 0.25 };
    // 탭 지점: 차체 안쪽(front=30 이내)이면서 공과는 23px 떨어져 있어 캡(11.25)보다는 멀다.
    const tap = { x: 15, y: 0 };
    const uncappedBallRadius = 4.125 + INTERACT.pickPadCssPx / ctx.pxPerUnit; // 상한 없었다면
    expect(uncappedBallRadius).toBeGreaterThan(23); // 캡이 없었다면 공이 이겼을 상황임을 검산
    const hit = hitTest(tap, scene, ctx);
    expect(hit).toEqual({ kind: 'chair', id: chairA, s: expect.any(Number) });
  });

  it('선택된 휠체어의 존 핸들이 다른 휠체어 본체 탭을 가로채지 않는다(§5.12)', () => {
    const chairA = chairId(1);
    const chairB = chairId(2);
    const poseA: ChairPose = { x: 0, y: 0, theta: 0 };
    // B 의 피벗을 정확히 A 의 towFront 핸들 레버 위치에 겹쳐 놓는다 — 겹쳐도 OBB 우선순위가 이겨야 한다.
    const poseB: ChairPose = { x: INTERACT.handleLeverPx.towFront, y: 0, theta: 0 };
    const scene: SceneSnapshot = {
      ...emptyScene(),
      chairs: [
        { id: chairA, pose: poseA },
        { id: chairB, pose: poseB },
      ],
    };
    const ctx: HitContext = { ...baseCtx, pxPerUnit: 0.4, selectedChairId: chairA, handlesVisible: true };
    const tap = poseB; // B 의 피벗 = B 의 OBB 내부 & A 의 towFront 핸들 위치
    const hit = hitTest(tap, scene, ctx);
    expect(hit?.kind).toBe('chair');
    expect(hit?.id).toBe(chairB);
  });

  // 2026-09-03 — 지우기 도구가 돌아왔다. §9.4 F1 이 실검한 사고가 정확히 이 도구의 것이었으므로
  // (가드를 지우자 *"지우개가 18px 떨어진 공을 지운다"*), 그 가드를 도구 이름으로 다시 못박는다.
  // 값이 아니라 **null 이냐**를 재는 이유: null 은 '2차 패스를 아예 안 돈다' 는 뜻이고, 어떤
  // 반경 숫자를 적어 두면 그 숫자가 0 이든 44 든 2차 패스는 돌아 버린다.
  it('eraser 는 관대한 2차 패스가 없다 — 파괴 도구에 44px 반경을 주면 안 짚은 것이 사라진다(§9.4 F1)', () => {
    const eraseCtx: HitContext = { ...baseCtx, tool: 'eraser' };
    expect(forgivingRadius(eraseCtx)).toBeNull();
    // 대조군 둘 — 이 단언이 "늘 null" 로 고장 나 통과하는 것을 막는다.
    expect(forgivingRadius({ ...baseCtx, tool: 'select' })).toBeGreaterThan(0);
    expect(forgivingRadius({ ...baseCtx, tool: 'cone' })).toBeNull();
  });
});

describe('zoneHandles(pos) 와 grabFromLever→grabPoint 의 동치(§5.12 핸들 스냅 blocker)', () => {
  it('네 존 모두 핸들 렌더 위치와 래치 레버가 같은 값으로 귀결된다', () => {
    const pose: ChairPose = { x: 123.4, y: -56.7, theta: 0.831 };
    const handles = zoneHandles(pose, 1);
    for (const h of handles) {
      const latched = grabPoint(pose, grabFromLever(h.lever));
      expect(h.pos.x).toBeCloseTo(latched.x, 9);
      expect(h.pos.y).toBeCloseTo(latched.y, 9);
    }
  });
});
