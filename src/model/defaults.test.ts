// §3.9/§3.10 검증 — 기본 배치 불변식, 하프 GK 미배치, cloneToCourt.
import { describe, expect, it } from 'vitest';
import { CHAIR, BALL } from '../core/constants.ts';
import { chairsOverlap } from '../physics/obb.ts';
import { COURT_MODES, COURT_SIZES, DEFAULT_COURT_SIZE, courtDefFor, isOnSurface } from './court.ts';
import { chairCorners, poseFromStored, type ChairPose } from './chair.ts';
import { FORMATIONS, createDrill, defaultCast, defaultStep, cloneToCourt, formationSlots } from './defaults.ts';
import type { Vec2 } from '../core/units.ts';

// 원 중심(ball)과 회전 사각형(chair hull) 사이의 표면 거리. 전체 hull 기준이라
// "볼가드"(전방 좁은 띠) 한정 거리보다 항상 작거나 같다 — 이 값이 ≥2 면 실제 가드 거리도 ≥2 다.
function ballSurfaceGapToChair(ball: Vec2, pose: ChairPose): number {
  const u = { x: Math.cos(pose.theta), y: Math.sin(pose.theta) };
  const v = { x: -u.y, y: u.x };
  const rx = ball.x - pose.x;
  const ry = ball.y - pose.y;
  const lx = rx * u.x + ry * u.y;
  const ly = rx * v.x + ry * v.y;
  const cx = Math.min(Math.max(lx, -CHAIR.pivotToRearPx), CHAIR.pivotToFrontPx);
  const cy = Math.min(Math.max(ly, -CHAIR.widthPx / 2), CHAIR.widthPx / 2);
  const dist = Math.hypot(lx - cx, ly - cy);
  return dist - BALL.radiusPx;
}

describe('기본 배치 불변식 (createDrill 직후, §3.9)', () => {
  for (const formation of FORMATIONS) {
    for (const mode of COURT_MODES) {
      it(`${mode} · ${formation}: OBB 겹침 없음(≥4px) · 공-가드 간격(≥2px) · viewBox 내부`, () => {
        const d = createDrill({ courtMode: mode, formation });
        const step = d.steps[0]!;
        const chairPoses = d.cast.chairs
          .map((c) => step.chairs[c.id])
          .filter((p): p is NonNullable<typeof p> => p !== undefined)
          .map(poseFromStored);

        // 최소 간격 ≥ 4px: chairsOverlap 은 depth = trueOverlap + marginPx 로 판정하므로
        // marginPx=4 를 주면 "실제 간격 < 4px"(=아직 겹침 판정)를 잡아낸다.
        for (let i = 0; i < chairPoses.length; i++) {
          for (let j = i + 1; j < chairPoses.length; j++) {
            expect(chairsOverlap(chairPoses[i]!, chairPoses[j]!, 4)).toBe(false);
          }
        }

        // 모든 hull 이 viewBox 안.
        const { vbW, vbH } = { vbW: d.courtMode === 'full' ? 800 : 500, vbH: d.courtMode === 'full' ? 500 : 425 };
        for (const pose of chairPoses) {
          for (const c of chairCorners(pose)) {
            expect(c.x).toBeGreaterThanOrEqual(-1e-6);
            expect(c.x).toBeLessThanOrEqual(vbW + 1e-6);
            expect(c.y).toBeGreaterThanOrEqual(-1e-6);
            expect(c.y).toBeLessThanOrEqual(vbH + 1e-6);
          }
        }

        // 공 표면 ↔ 가장 가까운 가드 ≥ 2px.
        for (const ball of d.cast.balls) {
          const bp = step.balls[ball.id];
          if (!bp) continue;
          const minGap = Math.min(...chairPoses.map((p) => ballSurfaceGapToChair(bp, p)));
          expect(minGap).toBeGreaterThanOrEqual(2 - 1e-6);
        }
      });
    }
  }
});

// ── §5.1 코트 크기 3단 — 기본 배치도 함께 옮겨진다 ──────────────────────────────────────────
//
// 완료 판정 원문: *"30×18 기준 좌표를 25×14 코트에 그대로 놓으면 선수가 코트 밖에 선다.
// 각 코트마다 '전부 surface 안' 을 단언하라."*
describe('§5.1 기본 배치가 코트 크기 3단을 따라간다', () => {
  for (const size of COURT_SIZES) {
    for (const formation of FORMATIONS) {
      it(`full ${size} · ${formation}: 8대 전부 surface 안(차체 네 귀퉁이까지) · 겹침 없음 · 공-가드 ≥2px`, () => {
        const d = createDrill({ courtMode: 'full', courtSize: size, formation });
        const step = d.steps[0]!;
        const poses = d.cast.chairs.map((c) => step.chairs[c.id]).filter((p): p is NonNullable<typeof p> => p !== undefined);
        expect(poses).toHaveLength(8); // 대조군 — 0대를 재고 통과하는 것을 막는다

        for (const p of poses) {
          // 피벗만이 아니라 **차체 hull 네 귀퉁이**가 전부 경기면 안이다. 피벗만 재면
          // 골라인에 걸터앉은 배치가 통과한다.
          expect(isOnSurface('full', p, size), `pivot ${JSON.stringify(p)}`).toBe(true);
          for (const c of chairCorners(poseFromStored(p))) {
            expect(isOnSurface('full', c, size), `corner ${JSON.stringify(c)}`).toBe(true);
          }
        }

        const chairPoses = poses.map(poseFromStored);
        for (let i = 0; i < chairPoses.length; i++) {
          for (let j = i + 1; j < chairPoses.length; j++) {
            expect(chairsOverlap(chairPoses[i]!, chairPoses[j]!, 4), `${i}-${j}`).toBe(false);
          }
        }

        for (const ball of d.cast.balls) {
          const bp = step.balls[ball.id];
          if (!bp) continue;
          expect(isOnSurface('full', bp, size)).toBe(true);
          expect(Math.min(...chairPoses.map((p) => ballSurfaceGapToChair(bp, p)))).toBeGreaterThanOrEqual(2 - 1e-6);
        }
      });
    }
  }

  // ⚠️ 이 대조군이 없으면 위 스위트는 "비례 사상이 아무 일도 안 해도" 전부 초록불일 수 있다 —
  // 30×18 좌표가 우연히 작은 코트에도 들어갈 수 있기 때문이다. 실제로는 안 들어간다:
  it('대조군 — 30×18 표 좌표를 그대로 25×14 에 놓으면 코트 밖이다', () => {
    const big = formationSlots('full', '1-2-1', '30x18');
    const outside = big.filter((p) => !isOnSurface('full', p, '25x14'));
    // away GK(x=750) 를 비롯해 여러 자리가 25×14 경기면(37.5..662.5) 밖으로 나간다.
    expect(outside.length).toBeGreaterThan(0);
    expect(big.some((p) => p.x > courtDefFor('full', '25x14').surface.x + courtDefFor('full', '25x14').surface.w)).toBe(true);
    // 그런데 옮겨 놓은 좌표는 하나도 안 나간다.
    const moved = formationSlots('full', '1-2-1', '25x14');
    expect(moved).toHaveLength(big.length);
    expect(moved.filter((p) => !isOnSurface('full', p, '25x14'))).toHaveLength(0);
    // 그리고 실제로 **다른 좌표**다(항등 사상이라 통과한 것이 아니다).
    expect(moved).not.toEqual(big);
  });

  it('기본 크기(30×18)의 좌표는 한 픽셀도 안 움직인다 — 기존 드릴이 달라 보이지 않는다', () => {
    // §9 ② 부기의 핵심. 표를 그대로 돌려주는 조기 반환이 살아 있어야 한다.
    for (const formation of FORMATIONS) {
      expect(formationSlots('full', formation, '30x18'), formation).toEqual(formationSlots('full', formation));
    }
    const d = createDrill({ courtMode: 'full', formation: '1-2-1' });
    const homeGk = d.cast.chairs.find((c) => c.team === 'home' && c.isGk)!;
    const awayGk = d.cast.chairs.find((c) => c.team === 'away' && c.isGk)!;
    expect(d.steps[0]!.chairs[homeGk.id]).toMatchObject({ x: 75, y: 262.5 });
    expect(d.steps[0]!.chairs[awayGk.id]).toMatchObject({ x: 750, y: 262.5 });
    expect(d.steps[0]!.balls[d.cast.balls[0]!.id]).toEqual({ x: 412.5, y: 262.5 });
    expect(d.courtSize).toBe('30x18');
  });

  it('공은 세 단 모두 경기면 한가운데다', () => {
    for (const size of COURT_SIZES) {
      const d = createDrill({ courtMode: 'full', courtSize: size });
      const s = courtDefFor('full', size).surface;
      const bp = d.steps[0]!.balls[d.cast.balls[0]!.id]!;
      expect(bp.x, size).toBeCloseTo(s.x + s.w / 2, 6);
      expect(bp.y, size).toBeCloseTo(s.y + s.h / 2, 6);
    }
    // 대조군 — 세 코트의 한가운데가 같은 자리였다면 위 루프는 아무것도 안 재는 것이다.
    const centers = COURT_SIZES.map((size) => {
      const d = createDrill({ courtMode: 'full', courtSize: size });
      return d.steps[0]!.balls[d.cast.balls[0]!.id]!.x;
    });
    expect(new Set(centers).size).toBe(3);
  });

  it('하프·플랫은 크기 3단을 따라가지 않는다 — 어떤 크기를 줘도 배치가 같다', () => {
    for (const mode of ['half', 'flat'] as const) {
      const base = defaultStep(mode, '1-2-1', defaultCast());
      for (const size of COURT_SIZES) {
        const cast = defaultCast();
        const step = defaultStep(mode, '1-2-1', cast, size);
        // id 는 매번 새로 나므로 좌표만 비교한다.
        expect(Object.values(step.chairs).map((p) => ({ x: p!.x, y: p!.y })), `${mode} ${size}`).toEqual(
          Object.values(base.chairs).map((p) => ({ x: p!.x, y: p!.y })),
        );
      }
    }
  });

  it('courtSize 를 안 주면 30×18 이고, 준 값은 드릴에 남는다', () => {
    expect(createDrill({ courtMode: 'full' }).courtSize).toBe(DEFAULT_COURT_SIZE);
    for (const size of COURT_SIZES) {
      expect(createDrill({ courtMode: 'full', courtSize: size }).courtSize).toBe(size);
      // 하프·플랫도 **들고 다닌다** — 풀로 돌아왔을 때 고른 크기가 사라지면 안 된다.
      expect(createDrill({ courtMode: 'half', courtSize: size }).courtSize).toBe(size);
    }
  });
});

describe('§5.1 cloneToCourt 와 코트 크기', () => {
  it('크기를 바꾸면 새 드릴이 되고 배치가 그 크기의 기본값으로 리셋된다', () => {
    const d = createDrill({ courtMode: 'full', formation: '1-2-1' });
    const small = cloneToCourt(d, 'full', '25x14');
    expect(small).not.toBe(d);
    expect(small.courtSize).toBe('25x14');
    expect(small.courtMode).toBe('full');
    expect(small.title).toContain('25 × 14 m');
    expect(small.description).toContain('코트 전환');
    // 배치가 새 코트 안에 있다(옛 좌표를 그대로 들고 오지 않았다).
    for (const p of Object.values(small.steps[0]!.chairs)) {
      expect(isOnSurface('full', p!, '25x14')).toBe(true);
    }
    // 대조군 — 원본은 그대로다.
    expect(d.courtSize).toBe('30x18');
  });

  it('크기·모드가 둘 다 그대로면 동일 참조를 돌려준다 (헛클론 방지)', () => {
    const d = createDrill({ courtMode: 'full', courtSize: '28x15' });
    expect(cloneToCourt(d, 'full')).toBe(d);
    expect(cloneToCourt(d, 'full', '28x15')).toBe(d);
    // 대조군 — 크기가 다르면 클론이다.
    expect(cloneToCourt(d, 'full', '30x18')).not.toBe(d);
  });

  it('풀 → 하프 → 풀 왕복에서 고른 크기가 살아남는다', () => {
    const d = createDrill({ courtMode: 'full', courtSize: '28x15' });
    const half = cloneToCourt(d, 'half');
    expect(half.courtSize).toBe('28x15'); // 하프에서는 판을 안 바꾸지만 값은 들고 있다
    const back = cloneToCourt(half, 'full');
    expect(back.courtSize).toBe('28x15');
    const s = courtDefFor('full', '28x15').surface;
    for (const p of Object.values(back.steps[0]!.chairs)) {
      expect(p!.x).toBeLessThanOrEqual(s.x + s.w);
    }
  });

  it('하프↔플랫 항등 전환도 크기를 잃지 않는다', () => {
    const d = createDrill({ courtMode: 'half', courtSize: '25x14' });
    const flat = cloneToCourt(d, 'flat');
    expect(flat.courtSize).toBe('25x14');
    expect(flat.steps[0]!.chairs).toEqual(d.steps[0]!.chairs); // 항등은 그대로다
  });
});

describe('하프 코트 기본 배치', () => {
  it('홈 GK 는 cast 에 있고 pose 에는 없다', () => {
    const cast = defaultCast();
    const step = defaultStep('half', '1-2-1', cast);
    const homeGk = cast.chairs.find((c) => c.team === 'home' && c.isGk);
    expect(homeGk).toBeDefined();
    expect(step.chairs[homeGk!.id]).toBeUndefined();
  });
});

describe('cloneToCourt', () => {
  it('full → half: 좌표를 옮기지 않고 배치를 리셋하며 heading 이 90/270 이다', () => {
    const d = createDrill({ courtMode: 'full', formation: '1-2-1' });
    const cloned = cloneToCourt(d, 'half');
    expect(cloned.id).not.toBe(d.id);
    expect(cloned.courtMode).toBe('half');
    expect(cloned.steps).toHaveLength(1);
    const step = cloned.steps[0]!;
    for (const c of cloned.cast.chairs) {
      const pose = step.chairs[c.id];
      if (!pose) continue; // half 홈 GK
      const expectedHeading = c.team === 'home' ? 90 : 270;
      // 저장형 angleDeg 는 [-180,180) 로 랩되므로(270°→-90°) 같은 방식으로 랩해서 비교한다.
      const wrap = (deg: number): number => ((((deg + 180) % 360) + 360) % 360) - 180;
      expect(Math.abs(wrap(pose.angleDeg) - wrap(expectedHeading))).toBeLessThan(1e-6);
    }
    expect(cloned.description).toContain('코트 전환');
  });

  it('half ↔ flat: 좌표·각도가 항등 변환된다', () => {
    const d = createDrill({ courtMode: 'half', formation: '1-2-1' });
    const cloned = cloneToCourt(d, 'flat');
    expect(cloned.courtMode).toBe('flat');
    expect(cloned.id).not.toBe(d.id);
    expect(cloned.steps[0]!.chairs).toEqual(d.steps[0]!.chairs);
  });

  it('같은 코트로 전환하면 동일 참조를 반환한다', () => {
    const d = createDrill({ courtMode: 'full' });
    expect(cloneToCourt(d, 'full')).toBe(d);
  });
});

// ── 빈 코트 (§6.8 자유 전술판, 2026-08-10 기현 지시) ──────────────────────────────────────
describe('createDrill({ empty: true }) — 전술판용 빈 코트', () => {
  it('코트에 아무것도 놓여 있지 않다', () => {
    const d = createDrill({ courtMode: 'full', empty: true });
    const s = d.steps[0]!;
    expect(Object.keys(s.chairs)).toHaveLength(0);
    expect(Object.keys(s.balls)).toHaveLength(0);
    expect(Object.keys(s.cones)).toHaveLength(0);
  });

  it('선수 8명은 명단에 남는다 — 비었다고 팀까지 없어지면 안 된다', () => {
    const d = createDrill({ courtMode: 'full', empty: true });
    expect(d.cast.chairs).toHaveLength(8);
  });

  it('⚠️ 공은 cast 에서도 뺀다 — 놓지도 못하는 유령이 10개 상한을 먹는다', () => {
    // 공 도구는 addBall 로 **새** 공을 만든다(edits.ts). 미배치인 채 cast 에만 남은 공은
    // 어떤 UI 로도 놓을 수 없는데 LIMITS.maxBalls 에는 계속 잡힌다.
    const d = createDrill({ courtMode: 'full', empty: true });
    expect(d.cast.balls).toHaveLength(0);
  });

  it('empty 를 안 주면 예전처럼 기본 포메이션이 깔린다 (드릴 편집 쪽은 그대로다)', () => {
    const d = createDrill({ courtMode: 'full' });
    expect(Object.keys(d.steps[0]!.chairs).length).toBeGreaterThan(0);
    expect(d.cast.balls).toHaveLength(1);
  });
});
