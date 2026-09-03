// §3.6 presence · 재생 검증.
import { describe, expect, it } from 'vitest';
import { wrapPi } from '../core/angle.ts';
import { newId } from '../core/ids.ts';
import type { Vec2 } from '../core/units.ts';
import { createDrill } from './defaults.ts';
import { duplicateStep } from './edits.ts';
import { setPose } from './edits.ts';
import type { ChairPose } from './chair.ts';
import {
  drillTotalMs,
  effectiveStepMs,
  interpChair,
  interpolateSteps,
  presenceOf,
  sampleDrill,
  staticFrameOf,
} from './playback.ts';

describe('presenceOf', () => {
  it('4가지 경우를 정확히 분류한다', () => {
    expect(presenceOf(1, 2)).toBe('both');
    expect(presenceOf(1, undefined)).toBe('exit');
    expect(presenceOf(undefined, 2)).toBe('enter');
    expect(presenceOf(undefined, undefined)).toBe('absent');
  });
});

describe('interpChair', () => {
  it('e=0 이면 a 와 같다', () => {
    const a: ChairPose = { x: 10, y: 20, theta: 0.3 };
    const b: ChairPose = { x: 50, y: 80, theta: 1.7 };
    const r = interpChair(a, b, 0);
    expect(r.x).toBe(a.x);
    expect(r.y).toBe(a.y);
    expect(r.theta).toBe(a.theta);
  });

  it('e=1 이면 위치는 b, 각도를 wrap 하면 wrapPi(b.theta) 와 1e-12 이내로 같다', () => {
    // theta 는 런타임 연속값(unwrapped) 이므로 원시값 자체가 아니라 wrapPi 를 거친 뒤 비교한다.
    const a: ChairPose = { x: 10, y: 20, theta: 3.0 };
    const b: ChairPose = { x: 50, y: 80, theta: -3.0 };
    const r = interpChair(a, b, 1);
    expect(r.x).toBe(b.x);
    expect(r.y).toBe(b.y);
    expect(Math.abs(wrapPi(r.theta) - wrapPi(b.theta))).toBeLessThan(1e-12);
  });

  it('|P1-P0|=0 이면 위치가 e 전 구간에서 P0 로 고정된다', () => {
    const a: ChairPose = { x: 42, y: 17, theta: 0 };
    const b: ChairPose = { x: 42, y: 17, theta: Math.PI / 2 };
    for (const e of [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1]) {
      const r = interpChair(a, b, e);
      expect(r.x).toBeCloseTo(42, 9);
      expect(r.y).toBeCloseTo(17, 9);
    }
  });
});

describe('interpolateSteps', () => {
  it('출력 배열은 id 로 유일하다', () => {
    let d = createDrill({ courtMode: 'full', formation: '1-2-1' });
    d = duplicateStep(d, 0);
    const frame = interpolateSteps(d, d.steps[0]!, d.steps[1]!, 0.5);
    expect(new Set(frame.arrows.map((a) => a.id)).size).toBe(frame.arrows.length);
    expect(new Set(frame.notes.map((n) => n.id)).size).toBe(frame.notes.length);
    expect(new Set(frame.chairs.map((c) => c.id)).size).toBe(frame.chairs.length);
  });

  it('presence: exit 는 A 자세를 유지한 채 opacity 가 1→0', () => {
    let d = createDrill({ courtMode: 'full', formation: '1-2-1' });
    const id = d.cast.chairs[0]!.id;
    d = duplicateStep(d, 0); // 스텝1은 스텝0 복제
    // 스텝1에서만 제거.
    const steps = d.steps.slice();
    const chairs = { ...steps[1]!.chairs };
    delete (chairs as Record<string, unknown>)[id];
    steps[1] = { ...steps[1]!, chairs };
    d = { ...d, steps };
    const frame = interpolateSteps(d, d.steps[0]!, d.steps[1]!, 0.3);
    const rc = frame.chairs.find((c) => c.id === id);
    expect(rc).toBeDefined();
    expect(rc!.opacity).toBeCloseTo(0.7, 9);
  });
});

// 획(2026-09-03). 시연·PNG 는 스텝이 아니라 **프레임**을 소비하므로, 여기가 그 두 경로가 획을
// 보는 유일한 창이다. 지키는 것은 보간 규칙 하나 — 편집기 트윈(store/editor/tween.ts)이 키에
// 점 수를 넣어 구조적으로 얻는 그 판정을, 이쪽은 조건으로 적는다. 둘이 갈리면 같은 전환이
// 편집기와 시연에서 다르게 보인다.
describe('interpolateSteps — 자유 그리기 획', () => {
  const withStrokes = (aPts: Array<[number, number]>, bPts: Array<[number, number]>) => {
    let d = createDrill({ courtMode: 'full', formation: '1-2-1' });
    d = duplicateStep(d, 0);
    const id = newId('fh');
    const toPts = (ps: Array<[number, number]>): Vec2[] => ps.map(([x, y]) => ({ x, y }));
    const steps = d.steps.slice();
    steps[0] = { ...steps[0]!, strokes: [{ id, points: toPts(aPts) }] };
    steps[1] = { ...steps[1]!, strokes: [{ id, points: toPts(bPts), width: 2 }] };
    return { d: { ...d, steps }, id };
  };

  it('점 수가 같으면 점별로 보간한다', () => {
    const { d } = withStrokes([[0, 0], [100, 0]], [[0, 100], [100, 100]]);
    const s = interpolateSteps(d, d.steps[0]!, d.steps[1]!, 0.25).strokes[0]!;
    expect(s.points.map((p) => p.y)).toEqual([25, 25]);
    expect(s.points.map((p) => p.x)).toEqual([0, 100]); // x 는 안 움직인 축(대조군)
    expect(s.opacity).toBe(1);
  });

  it('★ 점 수가 다르면 보간하지 않고 to 로 스냅한다', () => {
    // 이으면 2번째 점이 3번째 점을 향해 기어간다 — 형체 불명의 애니메이션이 된다.
    const { d } = withStrokes([[0, 0], [100, 0]], [[0, 100], [50, 100], [100, 100]]);
    const s = interpolateSteps(d, d.steps[0]!, d.steps[1]!, 0.25).strokes[0]!;
    expect(s.points).toEqual([{ x: 0, y: 100 }, { x: 50, y: 100 }, { x: 100, y: 100 }]);
  });

  it('색·굵기·화살촉은 늘 to 쪽 값이다 — 화살표의 `...b` 와 같다', () => {
    const { d } = withStrokes([[0, 0], [100, 0]], [[0, 100], [100, 100]]);
    expect(interpolateSteps(d, d.steps[0]!, d.steps[1]!, 0.25).strokes[0]!.width).toBe(2);
    expect(d.steps[0]!.strokes![0]!.width, '대조군 — from 쪽은 기본 굵기였다').toBeUndefined();
  });

  it('등장·퇴장은 다른 개체와 같은 페이드다', () => {
    let d = createDrill({ courtMode: 'full', formation: '1-2-1' });
    d = duplicateStep(d, 0);
    const steps = d.steps.slice();
    steps[1] = { ...steps[1]!, strokes: [{ id: newId('fh'), points: [{ x: 0, y: 0 }, { x: 9, y: 9 }] }] };
    d = { ...d, steps };
    expect(interpolateSteps(d, d.steps[0]!, d.steps[1]!, 0.3).strokes[0]!.opacity).toBeCloseTo(0.3, 9);
    expect(interpolateSteps(d, d.steps[1]!, d.steps[0]!, 0.3).strokes[0]!.opacity).toBeCloseTo(0.7, 9);
  });

  it('획이 없는 스텝(키 자체가 없다)도 빈 배열로 나온다 — 프레임 필드는 늘 있다', () => {
    const d = createDrill({ courtMode: 'full', formation: '1-2-1' });
    expect(staticFrameOf(d, d.steps[0]!).strokes).toEqual([]);
    expect(sampleDrill({ ...d, steps: [] }, 0, { baseMs: 1000, transitionMs: 300, loop: false }).strokes).toEqual([]);
  });
});

describe('sampleDrill', () => {
  it('동일 입력 1000회가 비트 단위로 동일하다(결정성)', () => {
    let d = createDrill({ courtMode: 'full', formation: '1-2-1' });
    d = duplicateStep(d, 0);
    const opts = { baseMs: 1500, transitionMs: 600, loop: true };
    const first = sampleDrill(d, 777, opts);
    for (let i = 0; i < 1000; i++) {
      const again = sampleDrill(d, 777, opts);
      expect(again).toEqual(first);
    }
  });

  it('루프 상태에서 총 길이 시점은 마지막→첫 스텝 전환의 시작(t=0)이다', () => {
    let d = createDrill({ courtMode: 'full', formation: '1-2-1' });
    d = duplicateStep(d, 0);
    const opts = { baseMs: 1500, transitionMs: 600, loop: true };
    const total = drillTotalMs(d, opts.baseMs);
    const frame = sampleDrill(d, total, opts);
    expect(frame.stepIndex).toBe(0);
    expect(frame.t).toBeCloseTo(0, 9);
    // from=steps[last](=steps[1]) 이므로 chair 위치는 steps[1] 값과 같아야 한다(e=0 → interpChair(...)=A).
    const chairId = d.cast.chairs[0]!.id;
    const expected = d.steps[1]!.chairs[chairId]!;
    const rc = frame.chairs.find((c) => c.id === chairId)!;
    expect(rc.x).toBeCloseTo(expected.x, 6);
    expect(rc.y).toBeCloseTo(expected.y, 6);
  });

  it('루프 상태에서 총 길이 직후는 마지막↔첫 스텝 사이의 보간값이다', () => {
    let d = createDrill({ courtMode: 'full', formation: '1-2-1' });
    d = duplicateStep(d, 0);
    const chairId = d.cast.chairs[0]!.id;
    d = setPose(d, 1, chairId, { x: 999, y: 1, angleDeg: 0 }); // 두 스텝의 자세를 뚜렷이 다르게 만든다
    const opts = { baseMs: 1500, transitionMs: 600, loop: true };
    const total = drillTotalMs(d, opts.baseMs);
    const frame = sampleDrill(d, total + 300, opts); // 전환 도중
    const rc = frame.chairs.find((c) => c.id === chairId)!;
    const a = d.steps[1]!.chairs[chairId]!.x; // from = 마지막 스텝
    const b = d.steps[0]!.chairs[chairId]!.x; // to = 첫 스텝
    expect(rc.x).toBeGreaterThan(Math.min(a, b) - 1e-6);
    expect(rc.x).toBeLessThan(Math.max(a, b) + 1e-6);
    expect(rc.x).not.toBeCloseTo(a, 3);
  });

  it('non-loop: 총 길이를 넘는 시각은 마지막 스텝에 고정된다', () => {
    let d = createDrill({ courtMode: 'full', formation: '1-2-1' });
    d = duplicateStep(d, 0);
    const opts = { baseMs: 1500, transitionMs: 600, loop: false };
    const total = drillTotalMs(d, opts.baseMs);
    const frame = sampleDrill(d, total + 5000, opts);
    expect(frame.stepIndex).toBe(1);
    expect(frame.t).toBeCloseTo(1, 9);
  });
});

describe('sampleDrill — cut (사슬 끊긴 경계, 2026-08-17)', () => {
  it('cut 경계: 경계를 넘는 즉시(전환 도중 포함) 스텝 i+1(toStep) 포즈로 점프한다(보간 없음)', () => {
    let d = createDrill({ courtMode: 'full', formation: '1-2-1' });
    d = duplicateStep(d, 0);
    const chairId = d.cast.chairs[0]!.id;
    d = setPose(d, 1, chairId, { x: 999, y: 1, angleDeg: 0 }); // 두 스텝의 자세를 뚜렷이 다르게
    const steps = d.steps.slice();
    steps[1] = { ...steps[1]!, cut: true }; // 경계 0→1: "다음 스텝"(steps[1])이 진다
    d = { ...d, steps };
    const opts = { baseMs: 1500, transitionMs: 600, loop: false };
    const expected = d.steps[1]!.chairs[chairId]!;
    // 경계 바로 다음(t≈0, transitionMs 시작 직전)에도 이미 toStep 이어야 한다 — "그 경계만
    // 즉시 컷"이지 transitionMs 만큼 지연된 컷이 아니다(2026-08-17 결함 수정: 이전 구현은
    // 여기서 e=0 을 유지해 fromStep 이 transitionMs 동안 남아 있었다).
    const justAfter = sampleDrill(d, 1500 + 1, opts);
    const rcJustAfter = justAfter.chairs.find((c) => c.id === chairId)!;
    expect(rcJustAfter.x).toBe(expected.x);
    expect(rcJustAfter.y).toBe(expected.y);
    // 전환 도중(t≈0.5)에도 여전히 toStep 그대로 — 보간이 아예 없다.
    const mid = sampleDrill(d, 1500 + 300, opts);
    const rcMid = mid.chairs.find((c) => c.id === chairId)!;
    expect(rcMid.x).toBe(expected.x);
    expect(rcMid.y).toBe(expected.y);
  });

  it('cut 경계: enter 개체가 경계를 넘는 즉시 opacity=1 로 나타난다(팝, 지연 없음)', () => {
    let d = createDrill({ courtMode: 'full', formation: '1-2-1' });
    const enteringId = d.cast.chairs[0]!.id;
    d = duplicateStep(d, 0); // 스텝1은 스텝0 복제
    // 스텝0에서는 없다가 스텝1에서 등장(enter)하도록 만든다.
    let steps = d.steps.slice();
    const step0Chairs = { ...steps[0]!.chairs };
    delete (step0Chairs as Record<string, unknown>)[enteringId];
    steps[0] = { ...steps[0]!, chairs: step0Chairs };
    steps[1] = { ...steps[1]!, cut: true };
    d = { ...d, steps };
    const opts = { baseMs: 1500, transitionMs: 600, loop: false };
    // 경계 직후(전환 시작 직후)에도 이미 opacity=1 이어야 한다 — 팝은 경계에서 일어나지
    // transitionMs 끝에서 일어나지 않는다(2026-08-17 결함 수정).
    const justAfter = sampleDrill(d, 1500 + 1, opts);
    const rcJustAfter = justAfter.chairs.find((c) => c.id === enteringId);
    expect(rcJustAfter).toBeDefined();
    expect(rcJustAfter!.opacity).toBe(1);
    // 전환 도중(t≈0.5)에도 계속 opacity=1.
    const mid = sampleDrill(d, 1500 + 300, opts);
    const rcMid = mid.chairs.find((c) => c.id === enteringId);
    expect(rcMid).toBeDefined();
    expect(rcMid!.opacity).toBe(1);
  });

  it('cut 없는 경계: 기존 보간 동작이 그대로다(회귀 가드)', () => {
    let d = createDrill({ courtMode: 'full', formation: '1-2-1' });
    d = duplicateStep(d, 0);
    const chairId = d.cast.chairs[0]!.id;
    d = setPose(d, 1, chairId, { x: 999, y: 1, angleDeg: 0 });
    const opts = { baseMs: 1500, transitionMs: 600, loop: false };
    const frame = sampleDrill(d, 1500 + 300, opts); // 전환 도중, cut 없음
    const rc = frame.chairs.find((c) => c.id === chairId)!;
    const a = d.steps[0]!.chairs[chairId]!.x;
    const b = d.steps[1]!.chairs[chairId]!.x;
    // 컷이 아니므로 스텝0 값에 고정되지 않고 실제로 움직인다(휠체어는 Hermite 호이므로
    // 직선 범위를 벗어날 수 있어 상하한이 아니라 "정확히 a 가 아님"만 확인한다 — cut 이었다면
    // 위 첫 테스트처럼 rc.x 가 a 와 정확히 같았을 것).
    expect(rc.x).not.toBe(a);
    expect(rc.x).not.toBeCloseTo(a, 3);
    expect(rc.x).not.toBe(b);
  });

  it('cut 경계: 구간이 끝나는 순간(t=1)에도 여전히(계속) toStep 그대로다', () => {
    let d = createDrill({ courtMode: 'full', formation: '1-2-1' });
    d = duplicateStep(d, 0);
    const chairId = d.cast.chairs[0]!.id;
    d = setPose(d, 1, chairId, { x: 999, y: 1, angleDeg: 0 });
    const steps = d.steps.slice();
    steps[1] = { ...steps[1]!, cut: true };
    d = { ...d, steps };
    const opts = { baseMs: 1500, transitionMs: 600, loop: false };
    const frame = sampleDrill(d, 1500 + 600, opts); // 전환 끝 (t=1)
    const rc = frame.chairs.find((c) => c.id === chairId)!;
    expect(rc.x).toBe(d.steps[1]!.chairs[chairId]!.x);
  });
});

describe('effectiveStepMs / drillTotalMs', () => {
  it('durationMs override 가 있으면 그 값을, 없으면 baseMs 를 쓴다', () => {
    let d = createDrill({ courtMode: 'full', formation: '1-2-1' });
    d = duplicateStep(d, 0);
    const steps = d.steps.slice();
    steps[1] = { ...steps[1]!, durationMs: 999 };
    d = { ...d, steps };
    expect(effectiveStepMs(d.steps[0]!, 1500)).toBe(1500);
    expect(effectiveStepMs(d.steps[1]!, 1500)).toBe(999);
    expect(drillTotalMs(d, 1500)).toBe(1500 + 999);
  });
});
