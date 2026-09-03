// §10.7 render-stage 측 검증 — physics-world 의 hitTest()/zoneHandles() 계약을 소비자
// 관점에서 고정한다. render-stage 프로덕션 코드는 physics 를 "타입만" 의존하지만(§8),
// 이 테스트는 §10.7 체크리스트가 명시적으로 요구하는 항목이라 검증 목적의 런타임 import 를
// 허용한다(hitTest.ts/kinematics.ts 자체는 physics-kin/physics-world 소유이고 이 파일은
// 수정하지 않는다).
import { describe, expect, it } from 'vitest';
import type { ChairId, BallId, ArrowId, StrokeId } from '../core/ids.ts';
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
  return { chairs: [], balls: [], cones: [], notes: [], arrows: [], strokes: [] };
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

// 2026-09-03 — 자유 그리기 획이 히트 표에 합류했다. 화살표와 **같은 두 자리**를 쓴다:
// 앵커는 우선순위 3(선택된 하나만), 몸통은 우선순위 6(선 몸통). 여기서 재는 것은 그 두 자리와,
// 6번 칸이 두 개체를 **거리로** 가른다는 새 규칙이다.
describe('획(자유 그리기) 히트 — 화살표와 같은 자리, 같은 규칙', () => {
  const strokeId = (n: number) => `fh_t${n}` as StrokeId;
  /** 수평 3점 획. 앵커는 (300,350)·(400,350)·(448,350)(회전은 끝 접선 +x 로 GAP 만큼 바깥). */
  const PTS = [
    { x: 300, y: 350 },
    { x: 350, y: 350 },
    { x: 400, y: 350 },
  ];

  it('몸통은 **고르지 않아도** 잡힌다 — 우선순위 6 은 선택과 무관하다', () => {
    const id = strokeId(1);
    const scene: SceneSnapshot = { ...emptyScene(), strokes: [{ id, points: PTS }] };
    // 획 위의 점. 두 앵커에서 25px 떨어져 있어 핸들 반경(22) 밖이다.
    expect(hitTest({ x: 325, y: 350 }, scene, baseCtx)).toEqual({ kind: 'stroke', id });
  });

  it('점 사이의 **선분 위**도 잡힌다 — 저장된 점만 표적이면 긴 획의 대부분이 안 잡힌다', () => {
    const id = strokeId(2);
    // 점이 둘뿐이고 300px 떨어져 있다. 그 한가운데는 어느 점에서도 150px 이다.
    const scene: SceneSnapshot = { ...emptyScene(), strokes: [{ id, points: [{ x: 100, y: 100 }, { x: 400, y: 100 }] }] };
    expect(hitTest({ x: 250, y: 100 }, scene, { ...baseCtx, tool: 'eraser' })).toEqual({ kind: 'stroke', id });
  });

  it('선택하면 앵커가 몸통을 이긴다 — 우선순위 3 이 6 보다 앞이다', () => {
    const id = strokeId(3);
    const scene: SceneSnapshot = { ...emptyScene(), strokes: [{ id, points: PTS }] };
    const ctx: HitContext = { ...baseCtx, selectedStrokeId: id };
    // 끝점은 획 **위**이기도 하다 — 앵커 갈래가 없으면 여기서 'stroke' 가 나온다.
    expect(hitTest({ x: 400, y: 350 }, scene, ctx)).toEqual({ kind: 'strokeHandle', id, grip: 'to' });
    expect(hitTest({ x: 300, y: 350 }, scene, ctx)).toEqual({ kind: 'strokeHandle', id, grip: 'from' });
    // 회전 앵커는 획이 지나간 적 없는 자리(끝에서 48px 바깥)라 몸통과 다투지 않는다.
    expect(hitTest({ x: 448, y: 350 }, scene, ctx)).toEqual({ kind: 'strokeHandle', id, grip: 'rotate' });
  });

  it('안 고른 획의 앵커 자리는 **빈 코트**다 — 앵커는 화면에 그려진 것만 잡힌다', () => {
    const id = strokeId(4);
    const scene: SceneSnapshot = { ...emptyScene(), strokes: [{ id, points: PTS }] };
    // 회전 앵커 자리. 선택 게이트가 없으면 여기서 strokeHandle 이 나온다.
    expect(hitTest({ x: 448, y: 350 }, scene, baseCtx)).toBeNull();
  });

  it('★ 화살표와 획이 겹치면 **가까운 쪽**이 이긴다 — 개체 종류가 우선순위가 아니다', () => {
    const arrow = { id: 'ar_t1' as ArrowId, from: { x: 100, y: 100 }, ctrl: { x: 250, y: 100 }, to: { x: 400, y: 100 } };
    const id = strokeId(5);
    // 획을 화살표에서 4px 아래에 나란히 놓는다. 둘 다 허용 오차(1.7 + 6 = 7.7) 안이다.
    const scene: SceneSnapshot = {
      ...emptyScene(),
      arrows: [arrow],
      strokes: [{ id, points: [{ x: 100, y: 104 }, { x: 400, y: 104 }] }],
    };
    // 획 쪽으로 1px 치우친 자리 → 획. 화살표 쪽으로 치우치면 화살표.
    expect(hitTest({ x: 250, y: 103 }, scene, { ...baseCtx, tool: 'eraser' })?.kind).toBe('stroke');
    expect(hitTest({ x: 250, y: 101 }, scene, { ...baseCtx, tool: 'eraser' })?.kind).toBe('arrow');
  });

  it('허용 오차 밖은 여전히 빈 코트다 — 몸통 판정이 반경 없는 자석이 아니다', () => {
    const id = strokeId(6);
    const scene: SceneSnapshot = { ...emptyScene(), strokes: [{ id, points: PTS }] };
    // 오차는 ARROW_STYLE.width/2 + pickPadCssPx/pxPerUnit = 1.7 + 6 = 7.7.
    // 지우기 도구로 잰다 — select 는 2차(관대) 패스가 있어 1차 한계를 가려 버린다.
    const eraser: HitContext = { ...baseCtx, tool: 'eraser' };
    expect(hitTest({ x: 325, y: 350 + 7 }, scene, eraser)).not.toBeNull();
    expect(hitTest({ x: 325, y: 350 + 9 }, scene, eraser)).toBeNull();
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
