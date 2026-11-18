// 심플 모드의 벽 경계는 **원 하나**다 — 원이 어느 쪽으로든 벽에 닿는다(PLAN-SIMPLE-DRIVE 결정 A4, 2026-11-19 개정).
// 지우면 새는 실기 버그: 원 ∪ 실물 차체(옛 계약)로 돌아가면 심플 모드에서 앞을 벽 쪽으로 둔 원이 벽에서 13.5 px 떨어져 서고
// (보이지 않는 차체 앞이 먼저 닿는다), 반대로 원만 보는 자리에서 차체 규칙이 새면 바둑돌을 벽에 붙일 수 없다.
//
// ── ⚠️ 2026-11-19: 이 파일의 옛 머리말 「원 ∪ 실물 차체 — 둘 다 판 안」(저장 유출 방지: 원만 쓰면 앞벽에 붙인 자세가 실물
// 차체로는 판 밖이 저장된다)은 기현님 지시 *"기본, 심플 모드 완전 분리"* 로 뒤집혔다. 대가는 obb.ts boundsHull 주석.
// 그 유출이 평소 모드에서 손대지 않은 칩을 옮기지 않게 하는 것은 안전망의 관대한 규칙(pushChairIntoEither)이 진다.
import { describe, expect, it } from 'vitest';
import { CHAIR } from '../core/constants.ts';
import { DISC_RADIUS_PX } from '../model/chairDisc.ts';
import { pushChairIntoBounds, pushChairIntoEither } from './obb.ts';

const W = 825;
const H = 525;
const R = DISC_RADIUS_PX;
const pose = (x: number, y: number, theta = 0) => ({ x, y, theta });

describe('심플 모드 벽 경계 = 원', () => {
  const disc = { w: W, h: H, disc: true };
  it('★ 어느 방향을 보고 있든 네 벽 모두 피벗이 반지름에서 멈춘다(틈 0)', () => {
    for (const theta of [0, Math.PI / 4, Math.PI / 2, Math.PI, 1.1]) {
      expect(pushChairIntoBounds(pose(W, 200, theta), disc).x, `θ=${theta} 오른쪽`).toBeCloseTo(W - R);
      expect(pushChairIntoBounds(pose(0, 200, theta), disc).x, `θ=${theta} 왼쪽`).toBeCloseTo(R);
      expect(pushChairIntoBounds(pose(300, 0, theta), disc).y, `θ=${theta} 위`).toBeCloseTo(R);
      expect(pushChairIntoBounds(pose(300, H, theta), disc).y, `θ=${theta} 아래`).toBeCloseTo(H - R);
    }
  });
});

describe('안전망의 관대한 경계 — 원·차체 중 하나라도 판 안이면 둔다', () => {
  const b = { w: W, h: H };
  it('심플에서 앞을 벽에 댄 원(차체는 판 밖)도, 평소에서 뒤를 벽에 댄 차체(원은 판 밖)도 그대로', () => {
    const discParked = pose(W - R, 200, 0);
    const bodyParked = pose(CHAIR.pivotToRearPx, 200, 0);
    expect(pushChairIntoEither(discParked, b)).toEqual({ x: discParked.x, y: discParked.y });
    expect(pushChairIntoEither(bodyParked, b)).toEqual({ x: bodyParked.x, y: bodyParked.y });
  });
  it('둘 다 판 밖이면 덜 옮기는 쪽으로 민다 — 앞이 벽 너머인 칩은 원 기준(반지름)까지만', () => {
    expect(pushChairIntoEither(pose(W, 200, 0), b).x).toBeCloseTo(W - R);
  });
});
