// §3.9/§3.10 검증 — 기본 배치 불변식, 하프 GK 미배치, cloneToCourt.
import { describe, expect, it } from 'vitest';
import { CHAIR, BALL } from '../core/constants.ts';
import { chairsOverlap } from '../physics/obb.ts';
import { COURT_MODES } from './court.ts';
import { chairCorners, poseFromStored, type ChairPose } from './chair.ts';
import { FORMATIONS, createDrill, defaultCast, defaultStep, cloneToCourt } from './defaults.ts';
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
