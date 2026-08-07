// §10.7 "interpolateSteps 결과를 목 writer 에 흘려 트윈이 from→to 로 진행함을 확인" — 여기서는
// startTween/poseFrame(§6.7 frameSync 가 쓰는 순수 조각)을 목 writer + 수동 구동 raf 로 검증한다.
import { describe, expect, it } from 'vitest';
import { newId } from '../../core/ids.ts';
import type { DrillStep } from '../../model/drill.ts';
import { poseFrame, startTween } from './tween.ts';
import type { PoseXYT, RafAdd, TweenWriter } from './tween.ts';

function emptyStep(): DrillStep {
  return { id: newId('st'), name: 's', note: '', chairs: {}, balls: {}, cones: {}, arrows: [], notes: [] };
}

function makeFakeRaf(): { add: RafAdd; tick(dtMs: number): void; unsubCount: number } {
  let fn: ((dtMs: number, nowMs: number) => void) | null = null;
  let now = 0;
  let unsubCount = 0;
  const add: RafAdd = (f) => {
    fn = f;
    return () => {
      unsubCount++;
      fn = null;
    };
  };
  return {
    add,
    tick(dtMs: number) {
      now += dtMs;
      fn?.(dtMs, now);
    },
    get unsubCount() {
      return unsubCount;
    },
  };
}

function makeWriter(): { writer: TweenWriter; frames: Array<Record<string, PoseXYT>> } {
  const frames: Array<Record<string, PoseXYT>> = [];
  return { writer: { writeFrame: (f) => frames.push(f) }, frames };
}

describe('poseFrame', () => {
  it('휠체어는 저장각(deg)을 rad 로, 공/콘은 theta=0 으로 평탄화한다', () => {
    const chId = newId('ch');
    const blId = newId('bl');
    const step = emptyStep();
    step.chairs[chId] = { x: 10, y: 20, angleDeg: 90 };
    step.balls[blId] = { x: 1, y: 2 };
    const frame = poseFrame(step);
    expect(frame[chId]).toEqual({ x: 10, y: 20, theta: expect.closeTo(Math.PI / 2, 6) });
    expect(frame[blId]).toEqual({ x: 1, y: 2, theta: 0 });
  });
});

describe('startTween', () => {
  it('ms<=0 이면 즉시 to 를 한 번 writeFrame 한다(트윈 없음)', () => {
    const { writer, frames } = makeWriter();
    const raf = makeFakeRaf();
    const from = { a: { x: 0, y: 0, theta: 0 } };
    const to = { a: { x: 10, y: 0, theta: 0 } };
    startTween(from, to, 0, (t) => t, raf.add, writer);
    expect(frames).toHaveLength(1);
    expect(frames[0]).toEqual(to);
  });

  it('from→to 로 선형 진행하고 t=1 에서 정확히 to 로 끝나며 구독을 해지한다', () => {
    const { writer, frames } = makeWriter();
    const raf = makeFakeRaf();
    const from = { p: { x: 0, y: 0, theta: 0 } };
    const to = { p: { x: 100, y: 0, theta: 0 } };
    startTween(from, to, 100, (t) => t, raf.add, writer);
    raf.tick(50); // t=0.5
    expect(frames[0]!.p!.x).toBeCloseTo(50, 5);
    raf.tick(50); // t=1.0
    expect(frames[1]!.p).toEqual({ x: 100, y: 0, theta: 0 });
    expect(raf.unsubCount).toBe(1);
    raf.tick(50); // 더 이상 콜백이 안 걸려 있어야 한다
    expect(frames).toHaveLength(2);
  });

  it('cancel() 하면 이후 프레임을 쓰지 않는다', () => {
    const { writer, frames } = makeWriter();
    const raf = makeFakeRaf();
    const handle = startTween({ p: { x: 0, y: 0, theta: 0 } }, { p: { x: 10, y: 0, theta: 0 } }, 100, (t) => t, raf.add, writer);
    raf.tick(20);
    expect(frames).toHaveLength(1);
    handle.cancel();
    expect(raf.unsubCount).toBe(1);
    raf.tick(20);
    expect(frames).toHaveLength(1); // 취소 후 더 안 쓴다
  });

  it('한쪽에만 있는 id 는 있는 쪽 값을 그대로 쓴다(등장/퇴장)', () => {
    const { writer, frames } = makeWriter();
    const raf = makeFakeRaf();
    startTween({ exitOnly: { x: 1, y: 1, theta: 0 } }, { enterOnly: { x: 9, y: 9, theta: 0 } }, 10, (t) => t, raf.add, writer);
    raf.tick(10);
    const last = frames[frames.length - 1]!;
    expect(last.exitOnly).toEqual({ x: 1, y: 1, theta: 0 });
    expect(last.enterOnly).toEqual({ x: 9, y: 9, theta: 0 });
  });
});
