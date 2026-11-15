// 심플 모드의 벽 경계는 **원 ∪ 실물 차체** — 둘 다 판 안에 들어와야 한다(PLAN-SIMPLE-DRIVE 결정 A4 보강).
// ⚠️ 원 기준만 쓰면 앞벽에 붙인 자세가 실물 차체로는 판 밖(앞 13.5 px)이다 — 심플 모드는 기기 표시 설정일 뿐인데
// 그 자세가 드릴에 **저장**돼, 심플을 끈 기기·공유받은 사람이 차체가 코트 밖에 걸친 판을 연다(2026-11-16 검수).
// 그래서 뒤·옆은 원이(R 12.5 > 뒤 6.5), 앞은 차체가(26 > 12.5) 경계를 정한다.
import { describe, expect, it } from 'vitest';
import { CHAIR } from '../core/constants.ts';
import { DISC_RADIUS_PX } from '../model/chairDisc.ts';
import { outOfBounds, pushChairIntoBounds } from './obb.ts';

const W = 825;
const H = 525;
const pose = (x: number, y: number, theta = 0) => ({ x, y, theta });

describe('벽 경계 — 원 ∪ 실물 차체', () => {
  const disc = { w: W, h: H, disc: true };
  it('★ 저장 유출 방지: 심플 모드 클램프를 통과한 자세는 심플을 꺼도(차체 기준) 판 안이다', () => {
    for (const theta of [0, Math.PI / 4, Math.PI / 2, Math.PI, 1.1]) {
      for (const [x, y] of [[W, 200], [0, 200], [300, 0], [300, H], [W, H], [0, 0]] as const) {
        const pushed = pushChairIntoBounds(pose(x, y, theta), disc);
        const q = pose(pushed.x, pushed.y, theta);
        expect(outOfBounds(q, { w: W, h: H }).depth, `θ=${theta} (${x},${y})`).toBeLessThanOrEqual(1e-6);
        expect(outOfBounds(q, disc).depth).toBeLessThanOrEqual(1e-6);
      }
    }
  });
  it('원도 뒤로 안 삐져나간다: 왼쪽 벽에서 피벗은 R 이상(차체 뒤 6.5 보다 넓다)', () => {
    expect(pushChairIntoBounds(pose(0, 200, 0), disc).x).toBeCloseTo(DISC_RADIUS_PX);
  });
  it('앞은 차체가 정한다: 오른쪽 벽에서 피벗은 앞 26 에서 멈춘다(앞벽 틈은 감수)', () => {
    expect(pushChairIntoBounds(pose(W, 200, 0), disc).x).toBeCloseTo(W - CHAIR.pivotToFrontPx);
  });
});
