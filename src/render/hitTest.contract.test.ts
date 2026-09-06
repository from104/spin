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

  // 2026-09-06 — 표시 순서(z-order)가 들어오면서 이 자리가 한 번 뒤집힐 뻔했다. 계획서 결정 9 의
  // *"선택된 개체의 핸들 먼저"* 를 존 핸들까지 글자 그대로 적용하면 여기가 'zoneHandle' 이 된다.
  // 실측으로 되돌렸다: 존 핸들의 레버는 -22.5·0·22.5·45 px 이라 셋이 **차체 안**에 앉고
  // (translate 는 피벗 정확히 위), 반경 22 CSS px 이면 선택된 휠체어의 몸이 통째로 핸들 원에
  // 덮인다 — 올리는 순간 재탭 해제(useEditorPointer.tapDeselect.test.tsx)가 4건 빨개졌다.
  // 그래서 존 핸들만 몸통 **뒤**에 남았고(hitTest.ts 의 (다) 주석), 이 단언은 그대로 산다.
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
// ⚠️ 2026-09-06 — 마지막 문장("거리로 가른다")은 죽었다. 지금은 표시 순서가 가른다(아래 ★ 참고).
// 앞의 두 문장(앵커는 몸통보다 앞, 몸통은 선택과 무관)은 3단 표에서도 그대로 참이다.
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

  // ── ⚠️ 2026-09-06: 이 단언의 뜻이 뒤집혔다(PLAN-Z-ORDER 결정 9) ────────────────
  // 옛 제목·근거: *"★ 화살표와 획이 겹치면 **가까운 쪽**이 이긴다 — 개체 종류가 우선순위가
  // 아니다"*(2026-09-03). 그 전제는 *"겹친 자리에서 무엇이 이길지 정할 근거가 없다"* 였는데
  // 그 전제가 죽었다 — 이제 근거가 있다. 사용자가 [표시순서]로 정한 순서가 그것이고, 그 답은
  // 화면에 이미 그려져 있다. 거리로 가르면 **위에 그린 선을 짚어도 밑의 선이 잡혀** 순서
  // 기능이 통째로 거짓말이 된다.
  // 옛 근거의 뜻("개체 종류는 서열이 아니다")은 그대로 산다 — 아래는 같은 장면에서 순서만
  // 뒤집어 답이 따라 뒤집히는 것을 보인다. 종류가 정하는 것이라면 그럴 수 없다.
  it('★ 겹친 화살표·획은 **위에 있는 쪽**이 잡힌다 — 거리가 아니라 표시 순서다(⚠️ 2026-09-06 뒤집힘)', () => {
    const arrow = { id: 'ar_t1' as ArrowId, from: { x: 100, y: 100 }, ctrl: { x: 250, y: 100 }, to: { x: 400, y: 100 } };
    const id = strokeId(5);
    // 획을 화살표에서 4px 아래에 나란히 놓는다. 둘 다 허용 오차(1.7 + 6 = 7.7) 안이다.
    const scene: SceneSnapshot = {
      ...emptyScene(),
      arrows: [arrow],
      strokes: [{ id, points: [{ x: 100, y: 104 }, { x: 400, y: 104 }] }],
    };
    // 2차(관대) 패스가 답을 대신 내지 못하도록 지우기 도구로 잰다.
    const eraser: HitContext = { ...baseCtx, tool: 'eraser' };
    // 기본층은 획(아래) → 화살표(위). 획 쪽으로 1px 치우쳐 짚어도 위에 있는 화살표가 잡힌다.
    expect(hitTest({ x: 250, y: 103 }, scene, eraser)?.kind).toBe('arrow');
    // 획을 화살표 위로 올리면 **같은 두 자리의 답이 둘 다** 획이 된다.
    const raised: SceneSnapshot = { ...scene, order: [{ kind: 'arrow', id: arrow.id }, { kind: 'stroke', id }] };
    expect(hitTest({ x: 250, y: 101 }, raised, eraser)?.kind).toBe('stroke');
    expect(hitTest({ x: 250, y: 103 }, raised, eraser)?.kind).toBe('stroke');
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

// 2026-09-06 — 표시 순서(z-order)가 몸통 판정을 정한다(PLAN-Z-ORDER 결정 9). 여기서 재는 것은
// **판과 손이 같은 답을 내는가** 하나다: 화면에서 위에 그려진 것이 손에도 먼저 잡혀야 한다.
// 지우면 새는 실기 버그: 사용자가 [표시순서]로 개체를 앞으로 보냈는데 클릭은 뒤의 것을 잡는
// 상태 — 기능이 있는 채로 거짓말을 한다(옛 표는 종류 서열이 상수였으므로 이게 기본값이었다).
describe('표시 순서가 몸통 판정을 정한다(PLAN-Z-ORDER 결정 9)', () => {
  const chair = chairId(9);
  const ball = ballId(9);
  /** 공을 차체 안(피벗에서 앞으로 5px)에 놓는다 — 한 점이 둘 다에 걸린다. */
  const overlapping = (order?: SceneSnapshot['order']): SceneSnapshot => ({
    ...emptyScene(),
    chairs: [{ id: chair, pose: { x: 0, y: 0, theta: 0 } }],
    balls: [{ id: ball, p: { x: 5, y: 0 } }],
    order,
  });
  const tap = { x: 5, y: 0 };

  it('order 를 안 실은 스냅샷은 기본층으로 판정한다 — 공이 휠체어 위다(옛 드릴이 안 변한다)', () => {
    expect(hitTest(tap, overlapping(), baseCtx)).toEqual({ kind: 'ball', id: ball });
  });

  it('공을 휠체어 아래로 보내면 같은 자리를 눌러 휠체어가 잡힌다', () => {
    // 아래→위: 공, 휠체어.
    const order: SceneSnapshot['order'] = [
      { kind: 'ball', id: ball },
      { kind: 'chair', id: chair },
    ];
    expect(hitTest(tap, overlapping(order), baseCtx)).toEqual({ kind: 'chair', id: chair, s: expect.any(Number) });
  });

  it('order 에 안 적힌 개체도 잡힌다 — 목록과 판이 어긋나도 조용히 안 잡히는 것이 없다', () => {
    // 공만 적힌 목록. 휠체어는 목록에서 빠져 있다(캐스트가 지워졌는데 자세만 남은 고아 —
    // `fillPreset` 이 남기는 그것이 이 저장소의 반복 사고다, 계획서 결정 13).
    // 빠진 것은 **맨 위**로 친다(`sceneOrder` 규칙 ③). 목록을 곧이곧대로 따르면 휠체어가
    // 순서에 없다는 이유로 영영 안 잡혀 지울 수조차 없게 된다.
    const order: SceneSnapshot['order'] = [{ kind: 'ball', id: ball }];
    expect(hitTest(tap, overlapping(order), baseCtx)).toEqual({ kind: 'chair', id: chair, s: expect.any(Number) });
  });

  it('선택된 화살표의 앵커는 **위에 공이 놓여 있어도** 잡힌다 — 핸들은 몸통보다 앞이다', () => {
    const arrow = { id: 'ar_t9' as ArrowId, from: { x: 100, y: 100 }, ctrl: { x: 250, y: 100 }, to: { x: 400, y: 100 } };
    // 공을 from 앵커 **정확히 위**에 올린다. 기본층에서 공은 화살표보다 위라, 순서만 보면 공이다.
    const scene: SceneSnapshot = { ...emptyScene(), arrows: [arrow], balls: [{ id: ball, p: arrow.from }] };
    const picked: HitContext = { ...baseCtx, selectedArrowId: arrow.id };
    expect(hitTest(arrow.from, scene, picked)).toEqual({ kind: 'arrowHandle', id: arrow.id, which: 'from' });
    // 대조군 — 화살표를 안 고르면 앵커가 안 그려지므로 그 자리의 답은 공이다. 이게 없으면 위
    // 단언은 "공이 애초에 안 잡히는 자리였다" 와 구분되지 않는다.
    expect(hitTest(arrow.from, scene, baseCtx)).toEqual({ kind: 'ball', id: ball });
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
