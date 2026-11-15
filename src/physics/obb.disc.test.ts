// 심플 모드의 벽 경계는 실물 차체가 아니라 **피벗 중심 원**이다(PLAN-SIMPLE-DRIVE 결정 A4 보강, 2026-11-16).
// 차체 기준이면 앞벽 앞에서 0.5 m 넘게 일찍 멈추고(앞 26 px) 뒤로는 원이 삐져나간다 — 그리고 회전해도 같아야 한다.
import { describe, expect, it } from 'vitest';
import { CHAIR } from '../core/constants.ts';
import { DISC_RADIUS_PX } from '../model/chairDisc.ts';
import { outOfBounds, pushChairIntoBounds } from './obb.ts';

const W = 825;
const H = 525;
const pose = (x: number, y: number, theta = 0) => ({ x, y, theta });

describe('벽 경계 — 원 기준', () => {
  it('오른쪽 벽: 원은 피벗이 벽에서 R 떨어지면 닿고, 차체는 앞 26 에서 닿는다', () => {
    const p = pose(W - DISC_RADIUS_PX - 0.5, 200);
    expect(outOfBounds(p, { w: W, h: H, disc: true }).depth).toBeLessThanOrEqual(0);
    expect(outOfBounds(p, { w: W, h: H }).depth).toBeGreaterThan(0); // 차체는 이미 벽 밖
    expect(pushChairIntoBounds(pose(W, 200), { w: W, h: H, disc: true }).x).toBeCloseTo(W - DISC_RADIUS_PX);
    expect(pushChairIntoBounds(pose(W, 200), { w: W, h: H }).x).toBeCloseTo(W - CHAIR.pivotToFrontPx);
  });
  it('왼쪽 벽: 원은 R 에서 멈춘다(차체는 뒤 6.5) — 그리고 돌려도 같다', () => {
    for (const theta of [0, Math.PI / 2, 1.1]) {
      expect(pushChairIntoBounds(pose(0, 200, theta), { w: W, h: H, disc: true }).x).toBeCloseTo(DISC_RADIUS_PX);
    }
  });
});
