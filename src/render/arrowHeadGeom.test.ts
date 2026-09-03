// 화살촉 기하가 **식이 된 뒤에도 옛 리터럴 그대로**인지(2026-09-03) + 굵기 축이 실제로
// 케이싱을 보정하는지.
//
// ⚠️ 이 파일의 기대값은 `arrowHeadGeom` 을 돌려 만든 것이 **아니다** — 2026-08-16~09-02 의
//    `ArrowMarkers.tsx` / `buildStaticSvg.ts` 에 리터럴로 적혀 있던 숫자를 손으로 옮겨 적었다.
//    식이 자기 자신을 베끼면 "값이 안 바뀌었다" 를 증명할 수 없다.
import { describe, expect, it } from 'vitest';
import { ARROW_STYLE } from '../model/arrow.ts';
import { STROKE_WIDTHS } from '../model/stroke.ts';
import { ARROW_HEAD_CASING_PX, arrowHeadGeom, arrowMarkerId } from './arrowHeadGeom.ts';

/** 옛 소스에서 그대로 옮긴 값(git d80ab8e 시점의 `HEADS` · `HEAD_CASING_W` · `refX`). */
const LEGACY = {
  thin: { d: 'M0.353,0.353 L6.853,3.553 L0.353,6.753 z', w: 7.21, h: 7.11, refY: 3.553 },
  wide: { d: 'M0.353,0.353 L6.853,5.853 L0.353,11.353 z', w: 7.21, h: 11.71, refY: 5.853 },
} as const;
const LEGACY_REF_X = 5.353;
const LEGACY_CASING_W = 0.71;

describe('기본 굵기에서는 옛 리터럴과 한 글자도 다르지 않다', () => {
  it.each(['thin', 'wide'] as const)('%s 촉의 d·뷰포트·기준점·테두리', (kind) => {
    const g = arrowHeadGeom(kind, ARROW_STYLE.width);
    expect(g.d).toBe(LEGACY[kind].d);
    expect(g.markerWidth).toBe(LEGACY[kind].w);
    expect(g.markerHeight).toBe(LEGACY[kind].h);
    expect(g.refX).toBe(LEGACY_REF_X);
    expect(g.refY).toBe(LEGACY[kind].refY);
    expect(g.casingWidth).toBe(LEGACY_CASING_W);
  });

  it('굵기를 안 넘기면 화살표 굵기다 — 화살표 호출부가 굵기를 몰라도 되게', () => {
    expect(arrowHeadGeom('thin')).toEqual(arrowHeadGeom('thin', ARROW_STYLE.width));
  });
});

describe('굵기 축 — 마커가 선 굵기 배율로 그려지는 것을 되돌린다', () => {
  // 마커는 `markerUnits` 기본값이 `strokeWidth` 라 붙는 선 굵기만큼 확대된다. 그래서
  // 마커 좌표계의 테두리 두께 × 선 굵기 = **화면 두께**이고, 그 값이 굵기와 무관하게
  // 일정해야 촉의 검은 테가 선의 검은 테와 같은 두께로 보인다.
  it.each(STROKE_WIDTHS)('굵기 %s 에서 촉 테두리의 화면 두께가 목표값과 같다', (w) => {
    const g = arrowHeadGeom('thin', w);
    expect((g.casingWidth * w) / 2).toBeCloseTo(ARROW_HEAD_CASING_PX, 1);
  });

  it('보정이 없으면 어긋난다 — 위 단언이 무엇을 잡는지(대조군)', () => {
    // 기본 굵기용 기하를 가는 획(2.4)·굵은 획(5.2)에 그대로 돌려 쓴 경우.
    const shared = arrowHeadGeom('thin', ARROW_STYLE.width).casingWidth;
    expect((shared * STROKE_WIDTHS[0]) / 2).not.toBeCloseTo(ARROW_HEAD_CASING_PX, 1);
    expect((shared * STROKE_WIDTHS[2]) / 2).not.toBeCloseTo(ARROW_HEAD_CASING_PX, 1);
  });

  // 마커 뷰포트는 (0,0)~(w,h) 밖을 **잘라낸다**. 테두리는 경로 바깥으로 절반이 나가므로,
  // 경로가 그 절반만큼 안쪽에서 시작하고 코 끝도 그만큼 여유를 두어야 촉의 검은 테가 안 깎인다.
  //
  // 예산은 0 이 아니라 **0.05 화면 px** 다. 좌표는 소수 3자리, 두께는 2자리로 끊는데(옛
  // 리터럴을 그대로 재현하려는 자릿수다 — arrowHeadGeom 머리말) 그 두 반올림이 서로
  // 반대로 튈 수 있어 마커 좌표계에서 천분위 오차가 남는다. 화면으로 환산하면 굵기 5.2 에서도
  // 0.006 px 라 눈에 닿지 않는다. 예산이 0 이면 이 테스트는 반올림을 재는 테스트가 된다.
  const CLIP_BUDGET_PX = 0.05;
  it.each(STROKE_WIDTHS)('굵기 %s 에서 촉 테두리가 마커 뷰포트 밖으로 잘리지 않는다', (w) => {
    const g = arrowHeadGeom('thin', w);
    const half = g.casingWidth / 2;
    const budget = CLIP_BUDGET_PX / w; // 화면 px → 마커 좌표계
    // 좌·상: 경로가 half 이상 안쪽에서 시작해야 한다.
    const [x0, y0] = g.d.slice(1).split(' ')[0]!.split(',').map(Number) as [number, number];
    expect(x0).toBeGreaterThanOrEqual(half - budget);
    expect(y0).toBeGreaterThanOrEqual(half - budget);
    // 우: 코 끝 + half 가 뷰포트 폭 안이어야 한다.
    const noseX = Number(g.d.split('L')[1]!.split(',')[0]);
    expect(noseX + half).toBeLessThanOrEqual(g.markerWidth + budget);
  });

  it('보정이 없으면 예산을 넘어 잘린다 — 위 예산이 헐렁해서 통과한 것이 아님을 보인다', () => {
    // 기본 굵기용 좌표를 가는 획(2.4)에 그대로 쓰면 필요한 여백은 0.5, 있는 여백은 0.353 —
    // 화면으로 0.35 px 가 깎인다(예산의 일곱 배).
    const legacyPad = 0.353;
    const need = ARROW_HEAD_CASING_PX / STROKE_WIDTHS[0];
    expect((need - legacyPad) * STROKE_WIDTHS[0]).toBeGreaterThan(CLIP_BUDGET_PX);
  });
});

describe('marker id — 기본 굵기는 접미가 없다', () => {
  it('화살표가 쓰던 id 가 굵기 축이 생겨도 그대로다', () => {
    expect(arrowMarkerId('u1', '#38bdf8', 'thin')).toBe('u1-38bdf8-thin');
    expect(arrowMarkerId('u1', '#38bdf8', 'thin', ARROW_STYLE.width)).toBe('u1-38bdf8-thin');
  });

  it('기본이 아닌 굵기는 서로, 그리고 기본과 다른 id 를 받는다', () => {
    const ids = STROKE_WIDTHS.map((w) => arrowMarkerId('u1', '#38bdf8', 'thin', w));
    expect(new Set(ids).size).toBe(STROKE_WIDTHS.length);
    // 기본 굵기(첨자 1)만 화살표와 마커를 **함께 쓴다** — 중복 정의를 안 만드는 것이 규약이다.
    expect(ids[1]).toBe('u1-38bdf8-thin');
  });

  it("이름색(`#` 없음)의 앞 글자를 먹지 않는다 — 옛 `slice(1)` 이 틀리던 자리", () => {
    expect(arrowMarkerId('u1', 'tomato', 'wide')).toBe('u1-tomato-wide');
  });
});
