// 이동 앵커가 다른 손잡이를 비켜 앉는 산수(2026-09-14 기현님 실기: *"원, 사각형은 회전 앵커와
// 겹친다"*).
//
// 지우면 새는 것: **회전 손잡이가 통째로 안 눌린다.** 앵커는 손잡이들보다 위에 그려지고 잡는
// 원(r=22)이 투명하게 손을 먹으므로, 둘이 겹치면 회전이 도달 불가가 된다. 그런데 그 사고는
// 테스트가 전부 초록인 채로 지나간다 — 히트 순서는 SVG 페인터 규칙이지 순수 함수가 아니다.
// 그래서 **거리**만은 여기서 못박는다.
import { describe, expect, it } from 'vitest';
import { moveAnchorAvoidX } from './moveAnchorAvoid.ts';

const OPTS = { clearPx: 44, hitRadiusPx: 22 };
const STAGE = { left: 0, right: 1000 };
/** 가장 가까운 손잡이까지의 거리 — 단언을 사람 말로 읽히게 하는 헬퍼다. */
const clearance = (x: number, y: number, rivals: { x: number; y: number }[]) =>
  Math.min(...rivals.map((r) => Math.hypot(x - r.x, y - r.y)));

describe('moveAnchorAvoidX', () => {
  it('비킬 이유가 없으면 한 픽셀도 안 움직인다 — 오늘 화면과 같아야 회귀가 아니다', () => {
    expect(moveAnchorAvoidX(500, 300, [], STAGE, OPTS)).toBe(500);
    // 세로로 이미 44 넘게 떨어진 손잡이는 아예 제약이 아니다.
    expect(moveAnchorAvoidX(500, 300, [{ x: 500, y: 345 }], STAGE, OPTS)).toBe(500);
  });

  it('손잡이와 정확히 겹치면 44 만큼 옆으로 — 오른쪽으로 간다(좌우 동률의 고정 관례)', () => {
    const x = moveAnchorAvoidX(500, 300, [{ x: 500, y: 300 }], STAGE, OPTS);
    expect(x).toBeCloseTo(544, 6);
  });

  it('세로로 조금 어긋나 있으면 √(44²−dy²) 만큼만 비킨다 — 필요 이상 안 움직인다', () => {
    // 기본 배율 rect 가 이 모양이다: 앵커와 회전 손잡이가 세로로 1.5px 어긋나 거의 겹친다.
    const rivals = [{ x: 500, y: 301.5 }];
    const x = moveAnchorAvoidX(500, 300, rivals, STAGE, OPTS);
    expect(x - 500).toBeCloseTo(Math.sqrt(44 * 44 - 1.5 * 1.5), 5);
    expect(clearance(x, 300, rivals)).toBeGreaterThanOrEqual(43.999);
  });

  it('덜 움직이는 쪽을 고른다 — 손잡이가 오른쪽에 있으면 앵커는 왼쪽으로 간다', () => {
    // 손잡이가 앵커보다 30px 오른쪽: 왼쪽으로 14 가면 되고, 오른쪽으로는 74 를 가야 한다.
    const rivals = [{ x: 530, y: 300 }];
    const x = moveAnchorAvoidX(500, 300, rivals, STAGE, OPTS);
    expect(x).toBeCloseTo(486, 6);
    expect(clearance(x, 300, rivals)).toBeGreaterThanOrEqual(43.999);
  });

  // 2026-09-14 실기에서 실제로 난 사고: 회전 손잡이(세로 1.3px 어긋남) + 왼쪽 위 모서리 손잡이가
  // 함께 있을 때 앵커가 **왼쪽**으로 갔다. 원인은 √ 를 지난 후보의 거리가 43.99999999999999 라
  // «확보 실패» 로 떨어진 것이고, 차선 분기의 동점 처리가 달라 방향이 뒤집혔다.
  it('좌우가 똑같이 44 면 오른쪽 — √ 오차로 분기가 바뀌어 방향이 뒤집히면 안 된다', () => {
    const rivals = [
      { x: 652.8, y: 340.6 },
      { x: 560.8, y: 361.6 },
    ];
    const x = moveAnchorAvoidX(653, 339.3, rivals, { left: 110, right: 1200 }, OPTS);
    expect(x, '오른쪽으로 간다').toBeGreaterThan(653);
    expect(clearance(x, 339.3, rivals)).toBeGreaterThanOrEqual(43.999);
  });

  it('무대 밖으로는 안 나간다 — 오른쪽 끝에서는 왼쪽으로 비킨다', () => {
    const tight = { left: 0, right: 560 };
    const rivals = [{ x: 530, y: 300 }];
    const x = moveAnchorAvoidX(530, 300, rivals, tight, OPTS);
    expect(x).toBeLessThanOrEqual(tight.right - OPTS.hitRadiusPx);
    expect(x).toBeCloseTo(486, 6);
  });

  it('작은 도형처럼 손잡이가 빽빽하면 **가장 멀리 벌어지는** 자리로 간다 — 숫자가 깨지지 않는다', () => {
    // 폭 24px 짜리 사각형의 손잡이 셋이 앵커 둘레 44 안에 모두 들어온 꼴.
    const rivals = [
      { x: 488, y: 300 },
      { x: 512, y: 300 },
      { x: 500, y: 288 },
    ];
    const x = moveAnchorAvoidX(500, 300, rivals, { left: 470, right: 530 }, OPTS);
    expect(Number.isFinite(x)).toBe(true);
    expect(x).toBeGreaterThanOrEqual(470 + OPTS.hitRadiusPx);
    expect(x).toBeLessThanOrEqual(530 - OPTS.hitRadiusPx);
    // 44 를 못 벌더라도 **가만히 있는 것보다는 멀어야** 한다 — 차선이 차선다워야 한다.
    expect(clearance(x, 300, rivals)).toBeGreaterThanOrEqual(clearance(500, 300, rivals));
  });

  it('손잡이 여럿을 한꺼번에 피한다 — 하나만 피하고 다른 것에 앉으면 고친 것이 아니다', () => {
    const rivals = [
      { x: 500, y: 300 },
      { x: 544, y: 300 },
    ];
    const x = moveAnchorAvoidX(500, 300, rivals, STAGE, OPTS);
    expect(clearance(x, 300, rivals)).toBeGreaterThanOrEqual(43.999);
  });
});
