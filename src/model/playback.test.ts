// §3.6 presence · 재생 검증.
import { describe, expect, it } from 'vitest';
import { wrapPi } from '../core/angle.ts';
import { createDrill } from './defaults.ts';
import { addStepAfter } from './edits.ts';
import { setPose } from './edits.ts';
import type { ChairPose } from './chair.ts';
import {
  drillTotalMs,
  effectiveStepMs,
  interpChair,
  interpolateSteps,
  presenceOf,
  sampleDrill,
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
    d = addStepAfter(d, 0);
    const frame = interpolateSteps(d, d.steps[0]!, d.steps[1]!, 0.5);
    expect(new Set(frame.arrows.map((a) => a.id)).size).toBe(frame.arrows.length);
    expect(new Set(frame.notes.map((n) => n.id)).size).toBe(frame.notes.length);
    expect(new Set(frame.chairs.map((c) => c.id)).size).toBe(frame.chairs.length);
  });

  it('presence: exit 는 A 자세를 유지한 채 opacity 가 1→0', () => {
    let d = createDrill({ courtMode: 'full', formation: '1-2-1' });
    const id = d.cast.chairs[0]!.id;
    d = addStepAfter(d, 0); // 스텝1은 스텝0 복제
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

describe('sampleDrill', () => {
  it('동일 입력 1000회가 비트 단위로 동일하다(결정성)', () => {
    let d = createDrill({ courtMode: 'full', formation: '1-2-1' });
    d = addStepAfter(d, 0);
    const opts = { baseMs: 1500, transitionMs: 600, loop: true };
    const first = sampleDrill(d, 777, opts);
    for (let i = 0; i < 1000; i++) {
      const again = sampleDrill(d, 777, opts);
      expect(again).toEqual(first);
    }
  });

  it('루프 상태에서 총 길이 시점은 마지막→첫 스텝 전환의 시작(t=0)이다', () => {
    let d = createDrill({ courtMode: 'full', formation: '1-2-1' });
    d = addStepAfter(d, 0);
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
    d = addStepAfter(d, 0);
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
    d = addStepAfter(d, 0);
    const opts = { baseMs: 1500, transitionMs: 600, loop: false };
    const total = drillTotalMs(d, opts.baseMs);
    const frame = sampleDrill(d, total + 5000, opts);
    expect(frame.stepIndex).toBe(1);
    expect(frame.t).toBeCloseTo(1, 9);
  });
});

describe('effectiveStepMs / drillTotalMs', () => {
  it('durationMs override 가 있으면 그 값을, 없으면 baseMs 를 쓴다', () => {
    let d = createDrill({ courtMode: 'full', formation: '1-2-1' });
    d = addStepAfter(d, 0);
    const steps = d.steps.slice();
    steps[1] = { ...steps[1]!, durationMs: 999 };
    d = { ...d, steps };
    expect(effectiveStepMs(d.steps[0]!, 1500)).toBe(1500);
    expect(effectiveStepMs(d.steps[1]!, 1500)).toBe(999);
    expect(drillTotalMs(d, 1500)).toBe(1500 + 999);
  });
});
