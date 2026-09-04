// §10.4 physics-kin 충돌 해결 골든/회귀 테스트.
import { describe, expect, it } from 'vitest';
import { CHAIR, CHAIR_SEP_PX } from '../core/constants.ts';
import type { Vec2 } from '../core/units.ts';
import type { ChairPose } from '../model/chair.ts';
import { unitFwd } from './kinematics.ts';
import {
  chairsOverlap,
  clampPointToBounds,
  escapePinned,
  outOfBounds,
  pushChairIntoBounds,
  resolveMotion,
  satOverlap,
  separateOverlaps,
} from './obb.ts';
import type { Bounds } from './types.ts';

const BOUNDS: Bounds = { w: 2000, h: 2000 };

describe('resolveMotion', () => {
  it('접촉 직전 정지, 최종 겹침 없음', () => {
    const from: ChairPose = { x: 100, y: 100, theta: 0 };
    const obstacle: ChairPose = { x: 160, y: 100, theta: 0 };
    const to: ChairPose = { x: 175, y: 100, theta: 0 }; // obstacle 를 깊이 관통하는 목표
    const result = resolveMotion(from, to, [obstacle], BOUNDS);
    expect(chairsOverlap(result, obstacle, CHAIR_SEP_PX)).toBe(false);
    expect(result.x).toBeGreaterThan(from.x);
    expect(result.x).toBeLessThan(to.x);
  });

  it('시작 포즈가 이미 겹치면: 깊이 감소는 허용, 깊어지는 이동은 거부', () => {
    const obstacle: ChairPose = { x: 0, y: 0, theta: 0 };
    const from: ChairPose = { x: 15, y: 0, theta: 0 };
    expect(chairsOverlap(from, obstacle, CHAIR_SEP_PX)).toBe(true); // 전제: from 이 이미 겹침

    const shallower: ChairPose = { x: 20, y: 0, theta: 0 }; // 더 멀어짐 → 깊이 감소, 여전히 겹침
    const deeper: ChairPose = { x: 10, y: 0, theta: 0 }; // 더 파고듦 → 깊이 증가
    expect(chairsOverlap(shallower, obstacle, CHAIR_SEP_PX)).toBe(true);
    expect(chairsOverlap(deeper, obstacle, CHAIR_SEP_PX)).toBe(true);
    expect(satOverlap(shallower, obstacle, CHAIR_SEP_PX).depth).toBeLessThan(
      satOverlap(from, obstacle, CHAIR_SEP_PX).depth,
    );
    expect(satOverlap(deeper, obstacle, CHAIR_SEP_PX).depth).toBeGreaterThan(
      satOverlap(from, obstacle, CHAIR_SEP_PX).depth,
    );

    expect(resolveMotion(from, shallower, [obstacle], BOUNDS)).toEqual(shallower);
    expect(resolveMotion(from, deeper, [obstacle], BOUNDS)).toEqual(from);
  });

  it("spin 궤적(P 고정)에 대해서도 P' === P (부동소수 완전 일치)", () => {
    const from: ChairPose = { x: 5, y: 5, theta: 0 };
    const to: ChairPose = { x: 5, y: 5, theta: 1.2 }; // 위치 불변, 회전만
    const obstacle: ChairPose = { x: 5, y: 5, theta: 0.6 }; // 회전 스윕이 반드시 겹치도록 근접 배치
    const result = resolveMotion(from, to, [obstacle], BOUNDS);
    expect(result.x).toBe(from.x);
    expect(result.y).toBe(from.y);
  });

  it('접선 슬라이드 (major 회귀) — 이웃 휠체어를 스치는 드래그 진행률 ≥ 90%', () => {
    // §5.6 실측: 이분탐색만이면 진행률 2.3%. 접선 슬라이드가 있으면 100.0%.
    const obstacle: ChairPose = { x: 100, y: 100, theta: 0 };
    let from: ChairPose = { x: 100, y: 100 - (CHAIR.widthPx + CHAIR_SEP_PX), theta: 0 }; // 딱 붙어 시작
    expect(chairsOverlap(from, obstacle, CHAIR_SEP_PX)).toBe(false);

    const totalDx = 400;
    const totalDy = 30;
    const seconds = 5;
    const dt = 1 / 120;
    const steps = Math.round(seconds / dt);
    const vx = totalDx / seconds;
    const vy = totalDy / seconds;
    const start = from;
    for (let k = 0; k < steps; k++) {
      const to: ChairPose = { x: from.x + vx * dt, y: from.y + vy * dt, theta: 0 };
      from = resolveMotion(from, to, [obstacle], BOUNDS);
    }
    const progress = (from.x - start.x) / totalDx;
    expect(progress).toBeGreaterThanOrEqual(0.9);
    expect(chairsOverlap(from, obstacle, CHAIR_SEP_PX)).toBe(false);
  });
});

describe('경계', () => {
  it('임의 θ 20개에서 hull 이 viewBox 안이면 outOfBounds 가 분리를 보고한다', () => {
    const bounds: Bounds = { w: 200, h: 200 };
    // hullRadiusPx(32.5) 이내에 있도록 중앙에 배치 → 어떤 회전에도 200×200 밖으로 안 나간다
    for (let i = 0; i < 20; i++) {
      const theta = (i / 20) * Math.PI * 2 - Math.PI;
      const pose: ChairPose = { x: 100, y: 100, theta };
      expect(outOfBounds(pose, bounds).depth).toBeLessThanOrEqual(0);
    }
  });

  it('hull 이 실제로 벗어나면 양의 depth 를 보고한다', () => {
    const bounds: Bounds = { w: 200, h: 200 };
    const pose: ChairPose = { x: 195, y: 100, theta: 0 }; // 전방 범퍼가 오른쪽 벽 밖으로
    const r = outOfBounds(pose, bounds);
    expect(r.depth).toBeGreaterThan(0);
    expect(r.axis).not.toBeNull();
  });
});

describe('pushChairIntoBounds (§4.2 P0-3 판 밖 고착 방지)', () => {
  const bounds: Bounds = { w: 400, h: 300 };
  /** hull 이 판을 벗어난 깊이(≤0 이면 판 안). */
  const out = (p: ChairPose): number => outOfBounds(p, bounds).depth;

  it('판 안이면 한 픽셀도 움직이지 않는다 — 임의 θ 20개에서 안전 no-op', () => {
    for (let i = 0; i < 20; i++) {
      const theta = (i / 20) * Math.PI * 2 - Math.PI;
      // hullRadiusPx(27.86) 이내로 안쪽에 두면 어떤 회전에도 판을 안 벗어난다.
      const pose: ChairPose = { x: 200, y: 150, theta };
      expect(pushChairIntoBounds(pose, bounds)).toEqual({ x: 200, y: 150 });
    }
  });

  it('왼쪽 벽을 파고든 칩을 hull 이 정확히 경계에 닿는 지점까지 되민다 (P0-3 실측 배치)', () => {
    // 실측: 드래그 중인 static 칩과 벽 사이에 낀 칩이 피벗 x=-5 로 나갔다.
    // (차체 뒤끝 = -5 − pivotToRearPx = -11.5. 2026-08-29 실측 전에는 -12.5 였다 — 배치는
    //  그대로 두고 전제 숫자만 차체를 따라 옮긴다. 이 테스트가 보는 것은 깊이 값이 아니라
    //  *되민 뒤에 뒷면이 정확히 x=0 에 닿는가* 이고, 그 단언은 상수 파생이라 안 바뀐다.)
    const pinned: ChairPose = { x: -5, y: 262.5, theta: 0 };
    expect(out(pinned)).toBeCloseTo(11.5, 9); // 전제: 11.5 px 나가 있다
    const fixed = pushChairIntoBounds(pinned, bounds);
    expect(fixed).toEqual({ x: CHAIR.pivotToRearPx, y: 262.5 }); // 뒷면이 x=0 에 닿는다
    expect(out({ ...fixed, theta: 0 })).toBeCloseTo(0, 12); // 더도 덜도 아니게
  });

  it('모서리에 두 면을 동시에 침범해도 **한 번에** 푼다', () => {
    const corner: ChairPose = { x: -3, y: -4, theta: 0 };
    const fixed = pushChairIntoBounds(corner, bounds);
    expect(fixed).toEqual({ x: CHAIR.pivotToRearPx, y: CHAIR.widthPx / 2 });
    expect(out({ ...fixed, theta: 0 })).toBeCloseTo(0, 12);
  });

  it('피벗이 아니라 hull 로 판정한다 — 회전한 차체는 피벗이 판 안이어도 밖으로 나간다', () => {
    // θ=π/2 → 차체가 세로로 선다. 피벗 y=5 는 판 안이지만 뒷면(로컬 -7.5)이 y=-2.5 로 나간다.
    const spun: ChairPose = { x: 200, y: 5, theta: Math.PI / 2 };
    expect(out(spun)).toBeGreaterThan(0);
    const fixed = pushChairIntoBounds(spun, bounds);
    expect(fixed.x).toBe(200); // 나가지 않은 축은 그대로
    expect(fixed.y).toBeCloseTo(CHAIR.pivotToRearPx, 9);
    expect(out({ ...fixed, theta: spun.theta })).toBeLessThanOrEqual(1e-9);
  });

  it('오른쪽·아래 벽도 같은 방식으로 — 되민 뒤 hull 이 경계에 닿는다', () => {
    const far: ChairPose = { x: bounds.w - 10, y: bounds.h + 5, theta: 0 };
    const fixed = pushChairIntoBounds(far, bounds);
    expect(fixed).toEqual({ x: bounds.w - CHAIR.pivotToFrontPx, y: bounds.h - CHAIR.widthPx / 2 });
    expect(out({ ...fixed, theta: 0 })).toBeCloseTo(0, 12);
  });
});

describe('chairsOverlap 부동소수 knife-edge (minor 회귀)', () => {
  it('정확히 CHAIR_SEP_PX 만큼 떨어진 두 휠체어는 겹침이 아니다', () => {
    // 실측(감사): 이 간격에서 satOverlap(...).depth = 2.275957200481571e-14 (엄밀히는 0이어야
    // 할 부동소수 잔차) — depth>0 로만 판정하면 "겹침"으로 잘못 보고한다.
    const a: ChairPose = { x: 500, y: 500, theta: 0 };
    const b: ChairPose = { x: 500, y: 500 + CHAIR.widthPx + CHAIR_SEP_PX, theta: 0 };
    expect(chairsOverlap(a, b, CHAIR_SEP_PX)).toBe(false);
  });
});

describe('clampPointToBounds', () => {
  it('반지름을 고려한다 (공 중심이 벽면에 정확히 닿지 않는다)', () => {
    const bounds: Bounds = { w: 100, h: 100 };
    const r = 5;
    const clamped = clampPointToBounds({ x: -10, y: 200 }, r, bounds);
    expect(clamped.x).toBe(r);
    expect(clamped.y).toBe(bounds.h - r);
    expect(clamped.x).not.toBe(0);
    expect(clamped.y).not.toBe(bounds.h);
  });
});

// escapePinned 검증에 쓰는 점~회전사각형 최소거리(음수 = 내부 침투 깊이). 프로덕션 코드(obb.ts)와
// 독립적으로 결과를 재확인하기 위한 테스트 전용 구현이다.
function distToChairRect(p: Vec2, pose: ChairPose): number {
  const u = unitFwd(pose.theta);
  const v: Vec2 = { x: -u.y, y: u.x };
  const relX = p.x - pose.x;
  const relY = p.y - pose.y;
  const lx = relX * u.x + relY * u.y;
  const ly = relX * v.x + relY * v.y;
  const rear = -CHAIR.pivotToRearPx;
  const front = CHAIR.pivotToFrontPx;
  const half = CHAIR.widthPx / 2;
  const cx = Math.min(Math.max(lx, rear), front);
  const cy = Math.min(Math.max(ly, -half), half);
  const inside = lx > rear && lx < front && ly > -half && ly < half;
  if (inside) return -Math.min(front - lx, lx - rear, half - ly, ly + half);
  return Math.hypot(lx - cx, ly - cy);
}

describe('escapePinned', () => {
  it('blocker 회귀(§5.6): 통로 폭 < 공 지름인 두 휠체어 사이에 실제로 낀 공을 빼낸다', () => {
    // §10.4 문구 그대로: 두 휠체어 사이(통로 폭 = CHAIR_SEP_PX+0.1 ≈ 0.5px, 공 지름
    // 8.25px 보다 훨씬 좁다) 한가운데 공을 두고 어느 OBB 와도 안 겹치는 지점으로 밀어내는지
    // 검증한다. bounds 중앙 근처에 배치해 clampPointToBounds 단계가 개입하지 않게 한다.
    const a: ChairPose = { x: 500, y: 500, theta: 0 };
    const b: ChairPose = { x: 500, y: 500 + CHAIR.widthPx + CHAIR_SEP_PX + 0.1, theta: 0 };
    expect(chairsOverlap(a, b, CHAIR_SEP_PX)).toBe(false); // 휠체어끼리는 안 겹침(통로만 좁음)

    const ballR = 4.125; // BALL.radiusPx
    // 두 휠체어가 마주보는 긴 변 사이 틈의 정중앙 — 어느 한쪽에 치우치지 않고 양쪽 모두에 낀 점.
    const gapY = (500 + CHAIR.widthPx / 2 + (500 + CHAIR.widthPx + CHAIR_SEP_PX + 0.1 - CHAIR.widthPx / 2)) / 2;
    const pinned: Vec2 = { x: 510, y: gapY };
    expect(distToChairRect(pinned, a)).toBeLessThan(ballR); // 전제: a 와 겹침
    expect(distToChairRect(pinned, b)).toBeLessThan(ballR); // 전제: b 와도 겹침(=진짜 압착)

    const out = escapePinned(pinned, ballR, [a, b], BOUNDS);
    expect(distToChairRect(out, a)).toBeGreaterThanOrEqual(ballR - 1e-6);
    expect(distToChairRect(out, b)).toBeGreaterThanOrEqual(ballR - 1e-6);
  });

  it('blocker 회귀(§5.6): 휠체어와 벽 사이에 낀 공도 빼낸다(법선 push→clamp 왕복 금지)', () => {
    // 벽에 바짝 붙은 휠체어 — 벽이 미는 방향(+x)과 휠체어가 미는 방향(-x)이 정확히 반대라
    // 예전 구현은 두 지점 사이를 왕복했다(실측 D4).
    const bounds: Bounds = { w: 2000, h: 2000 };
    const chair: ChairPose = { x: 10, y: 500, theta: 0 };
    const ballR = 4.125;
    const pinned: Vec2 = { x: 3, y: 500 }; // 벽(x<r)과 휠체어 rear 근처(x=3, local lx=-7) 모두 침범
    expect(pinned.x).toBeLessThan(ballR); // 전제: 벽과 겹침
    expect(distToChairRect(pinned, chair)).toBeLessThan(ballR); // 전제: 휠체어와도 겹침

    const out = escapePinned(pinned, ballR, [chair], bounds);
    expect(out.x).toBeGreaterThanOrEqual(ballR - 1e-6); // 벽 밖(안쪽)
    expect(out.x).toBeLessThanOrEqual(bounds.w - ballR + 1e-6);
    expect(out.y).toBeGreaterThanOrEqual(-1e-6);
    expect(out.y).toBeLessThanOrEqual(bounds.h + 1e-6);
    expect(distToChairRect(out, chair)).toBeGreaterThanOrEqual(ballR - 1e-6); // 휠체어 밖
  });

  it('겹치지 않는 점은 그대로 반환한다(안전 no-op)', () => {
    const a: ChairPose = { x: 0, y: 0, theta: 0 };
    const far: Vec2 = { x: 500, y: 500 };
    const out = escapePinned(far, 4.125, [a], BOUNDS);
    expect(out).toEqual(far);
  });
});

describe('separateOverlaps (§4.2 P0-1 기하 분리 폴백)', () => {
  const worst = (poses: readonly ChairPose[]): number => {
    let d = 0;
    for (let i = 0; i < poses.length; i++) {
      for (let j = i + 1; j < poses.length; j++) {
        const o = satOverlap(poses[i]!, poses[j]!, 0).depth;
        if (o > d) d = o;
      }
    }
    return d;
  };

  it('겹치지 않은 칩들은 한 픽셀도 움직이지 않는다(안전 no-op)', () => {
    const poses: ChairPose[] = [
      { x: 100, y: 100, theta: 0 },
      { x: 200, y: 100, theta: 0 },
      { x: 100, y: 200, theta: Math.PI / 2 },
    ];
    expect(separateOverlaps(poses, BOUNDS)).toEqual(poses);
  });

  it('맞물린 두 칩을 떼어 놓는다 — 최소침투축으로 절반씩', () => {
    // A 뒷면 x=525, B 앞면 x=532.5 → 겹침 7.5. 세로 겹침(20)보다 작으므로 최소축은 x 다.
    const poses: ChairPose[] = [
      { x: 500 + CHAIR.pivotToRearPx + 25, y: 500, theta: 0 },
      { x: 500 + CHAIR.pivotToRearPx, y: 500, theta: 0 },
    ];
    expect(worst(poses)).toBeCloseTo(7.5, 9); // 전제
    const out = separateOverlaps(poses, BOUNDS);
    expect(worst(out)).toBeLessThanOrEqual(0);
    // 양쪽이 정확히 같은 만큼, 서로 반대로, x 축으로만 움직인다.
    expect(out[0]!.x - poses[0]!.x).toBeCloseTo(3.755, 9);
    expect(poses[1]!.x - out[1]!.x).toBeCloseTo(3.755, 9);
    expect(out[0]!.y).toBe(poses[0]!.y);
    expect(out[1]!.y).toBe(poses[1]!.y);
  });

  it('벽에 막혀 물러설 자리가 없는 칩의 몫은 상대가 받는다 (P0-1 의 실제 배치)', () => {
    // 뒷면을 왼쪽 벽에 붙인 칩(피벗 6.5) 위에 다른 칩이 7.5 px 얹혀 있다. 반씩 나누면
    // 벽 쪽 절반이 통째로 버려져 겹침이 남는다 — 그래서 남은 몫을 상대에게 넘긴다.
    const poses: ChairPose[] = [
      { x: CHAIR.pivotToRearPx + 25, y: 500, theta: 0 },
      { x: CHAIR.pivotToRearPx, y: 500, theta: 0 },
    ];
    const out = separateOverlaps(poses, BOUNDS);
    expect(worst(out)).toBeLessThanOrEqual(0);
    expect(out[1]!).toEqual(poses[1]!); // 벽 쪽 칩은 한 픽셀도 안 움직인다
    expect(out[0]!.x - poses[0]!.x).toBeCloseTo(7.51, 9); // 전부 반대쪽이 물러난다
  });

  it('각도는 건드리지 않는다 — 안전망이 사용자가 놓은 방향을 바꾸지 않는다', () => {
    const poses: ChairPose[] = [
      { x: 500, y: 500, theta: 0.7 },
      { x: 505, y: 505, theta: -1.2 },
    ];
    const out = separateOverlaps(poses, BOUNDS);
    expect(worst(poses)).toBeGreaterThan(0); // 전제: 실제로 겹쳐 있다
    expect(out.map((p) => p.theta)).toEqual([0.7, -1.2]);
  });

  it('떼어 놓느라 판 밖으로 나가지는 않는다 — 벽에 붙은 쌍', () => {
    // 왼쪽 벽에 뒷면을 붙인 칩(피벗 7.5) 위에 다른 칩을 얹는다. 왼쪽으로 밀 자리가 없다.
    const bounds: Bounds = { w: 400, h: 400 };
    const poses: ChairPose[] = [
      { x: CHAIR.pivotToRearPx, y: 200, theta: 0 },
      { x: CHAIR.pivotToRearPx + 8, y: 200, theta: 0 },
    ];
    const out = separateOverlaps(poses, bounds);
    expect(worst(out)).toBeLessThanOrEqual(0);
    for (const p of out) expect(outOfBounds(p, bounds).depth).toBeLessThanOrEqual(1e-9);
  });

  it('해가 없는 배치에서는 겹침이 남는다 — 보장이 아니라 최선의 1회다', () => {
    // 세로 40 px 판에 폭 25 px 칩 두 대 = 50 px. 둘 다 판 안에 두려면 최소 10 px 은 겹친다.
    const bounds: Bounds = { w: 400, h: 40 };
    const poses: ChairPose[] = [
      { x: 200, y: 20, theta: 0 },
      { x: 200, y: 20, theta: 0 },
    ];
    const out = separateOverlaps(poses, bounds);
    expect(worst(out)).toBeCloseTo(2 * CHAIR.widthPx - bounds.h, 6); // 기하가 허락하는 최솟값
    for (const p of out) expect(outOfBounds(p, bounds).depth).toBeLessThanOrEqual(1e-9);
    // 무한 루프에 빠지지 않고 유한 패스로 끝난다는 것 자체가 이 함수의 계약이다.
    expect(out).toHaveLength(2);
  });
});
