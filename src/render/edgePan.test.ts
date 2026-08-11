// 고무줄 선택 중 화면 가장자리 자동 밀기(§6.4). 속도 곡선만 순수 함수로 떼어 시험한다 —
// 적용(판 밀기 + 포인터 아래 월드 좌표 재환산)은 CourtStage 의 rAF tick 몫이다.
import { describe, expect, it } from 'vitest';
import { edgePanVelocity } from './useStageMetrics.ts';
import { INTERACT } from '../core/constants.ts';

const RECT = { left: 100, top: 50, right: 900, bottom: 650 };
const BAND = INTERACT.edgePanBandPx;
const MAX = INTERACT.edgePanMaxPxPerS;
const v = (x: number, y: number) => edgePanVelocity(RECT, { x, y }, BAND, MAX);

describe('edgePanVelocity — 가장자리 띠 안에서만 민다', () => {
  it('한가운데서는 움직이지 않는다', () => {
    expect(v(500, 350)).toEqual({ x: 0, y: 0 });
  });

  it('띠 바깥이면 가장자리 근처라도 0 이다', () => {
    // 띠에 **들어서야** 걸린다. 아니면 판 위를 지나기만 해도 시야가 흘러 조준을 잃는다.
    expect(v(RECT.left + BAND + 1, 350).x).toBe(0);
    expect(v(RECT.right - BAND - 1, 350).x).toBe(0);
  });

  it('가장자리에 닿는 순간은 0 에서 시작한다 — 튀지 않는다', () => {
    // 선형이면 띠에 들어서는 순간 이미 속도가 붙어 판이 홱 움직인다.
    expect(v(RECT.left + BAND, 350).x).toBeCloseTo(0, 9);
    expect(Math.abs(v(RECT.left + BAND - 2, 350).x)).toBeLessThan(MAX * 0.01);
  });

  it('띠 끝(가장자리 선상)에서 최고 속도다', () => {
    expect(v(RECT.left, 350).x).toBeCloseTo(-MAX, 6);
    expect(v(RECT.right, 350).x).toBeCloseTo(MAX, 6);
    expect(v(500, RECT.top).y).toBeCloseTo(-MAX, 6);
    expect(v(500, RECT.bottom).y).toBeCloseTo(MAX, 6);
  });

  it('상자 밖으로 나가도 최고 속도에서 멈춘다', () => {
    // 손이 화면 밖으로 많이 나갔다고 판이 더 빨리 달아나면 되돌아올 수 없다.
    expect(v(RECT.left - 500, 350).x).toBeCloseTo(-MAX, 6);
    expect(v(RECT.right + 500, 350).x).toBeCloseTo(MAX, 6);
  });

  it('모서리에서는 두 축이 함께 걸린다', () => {
    const corner = v(RECT.left, RECT.top);
    expect(corner.x).toBeCloseTo(-MAX, 6);
    expect(corner.y).toBeCloseTo(-MAX, 6);
  });

  it('부호는 포인터가 간 쪽이다 — 판을 손으로 미는 것과 반대다', () => {
    // 판 밀기는 "잡은 판이 손을 따라온다"(부호 반전), 가장자리 밀기는 "창이 손을 따라간다".
    expect(v(RECT.left + 4, 350).x).toBeLessThan(0);
    expect(v(RECT.right - 4, 350).x).toBeGreaterThan(0);
  });

  it('띠 폭이 0 이면 아무 일도 없다 — 0 나눗셈으로 NaN 이 새지 않는다', () => {
    expect(edgePanVelocity(RECT, { x: RECT.left, y: RECT.top }, 0, MAX)).toEqual({ x: 0, y: 0 });
  });
});

describe('상수', () => {
  it('띠가 손가락 하나보다 넓다', () => {
    // 좁으면 태블릿에서 가장자리를 스치기만 해도 걸리거나, 도달 전에 손이 화면 밖으로 나간다.
    expect(INTERACT.edgePanBandPx).toBeGreaterThanOrEqual(48);
  });

  it('최고 속도로 풀 코트를 1초 안팎에 훑는다', () => {
    // 너무 느리면 가장자리에 손을 대고 기다리는 시간이 되고, 너무 빠르면 지나쳐 버린다.
    expect(INTERACT.edgePanMaxPxPerS).toBeGreaterThan(400);
    expect(INTERACT.edgePanMaxPxPerS).toBeLessThan(2000);
  });
});
