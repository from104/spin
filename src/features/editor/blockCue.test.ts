// §4.3 P1-4 막힘 '툭' 판정(순수). 조건이 셋 AND 로 묶여 있으므로 **하나씩 따로** 찌른다 —
// 한 번에 둘을 틀리게 만들면 다른 조건이 대신 걸러 주어 무엇이 잡혔는지 알 수 없다.
import { describe, expect, it } from 'vitest';
import { blockCueLimits, initialBlockCue, stepBlockCue } from './blockCue.ts';
import type { BlockCueLimits, BlockCueSample, BlockCueState } from './blockCue.ts';

/** 배율 1 = 월드 px 이 곧 CSS px. 리시 문턱은 호출부(useEditorPointer)와 같은 4 CSS px. */
const LIM: BlockCueLimits = blockCueLimits(1, 4);

/** 표본을 순서대로 먹이고 매 프레임의 세기를 돌려준다(울리지 않은 프레임은 null). */
function feed(samples: BlockCueSample[], lim: BlockCueLimits = LIM, from: BlockCueState = initialBlockCue) {
  let state = from;
  const impacts: Array<number | null> = [];
  for (const s of samples) {
    const r = stepBlockCue(state, s, lim);
    state = r.state;
    impacts.push(r.impact);
  }
  return { state, impacts, fired: impacts.filter((i) => i !== null).length };
}

/** 개체가 (100,100) 에 **멎어 있고** 손만 멀어지는 표본 열. gap 은 16ms 마다 `perFrame` 씩 는다. */
function stuckRun(perFrame: number, frames: number, startGap: number = 6): BlockCueSample[] {
  const out: BlockCueSample[] = [];
  for (let i = 0; i < frames; i++) {
    out.push({ gapPx: startGap + perFrame * i, at: { x: 100, y: 100 }, nowMs: 1000 + 16 * i });
  }
  return out;
}

describe('stepBlockCue — 울리는 조건 셋을 하나씩', () => {
  it('첫 표본은 판정하지 않는다 — 속도를 잴 짝이 없다', () => {
    const r = stepBlockCue(initialBlockCue, { gapPx: 500, at: { x: 100, y: 100 }, nowMs: 1000 }, LIM);
    expect(r.impact).toBeNull();
    expect(r.state.prev).not.toBeNull();
  });

  it('개체가 멎고 손이 떠나면 울린다', () => {
    // 16ms 에 6px = 375 px/s > minRel(150). gap 은 이미 리시 문턱(4) 위.
    expect(feed(stuckRun(6, 3)).fired).toBe(1);
  });

  it('① 뒤처지지 않았으면 안 울린다 — 리시 문턱 안에서는 상대속도가 아무리 커도 조용하다', () => {
    // gap 이 0 → 3.9 로 는다. 상대속도는 243 px/s 로 문턱을 넘지만 gap 이 리시 안이다.
    const r = feed([
      { gapPx: 0, at: { x: 100, y: 100 }, nowMs: 1000 },
      { gapPx: 3.9, at: { x: 100, y: 100 }, nowMs: 1016 },
    ]);
    expect(r.fired).toBe(0);
    // 대조군 — gap 만 문턱 위로 올리면 같은 상대속도가 울린다.
    expect(
      feed([
        { gapPx: 4.1, at: { x: 100, y: 100 }, nowMs: 1000 },
        { gapPx: 8, at: { x: 100, y: 100 }, nowMs: 1016 },
      ]).fired,
    ).toBe(1);
  });

  it('② 개체가 따라오고 있으면 안 울린다 — 속도 제한 지연은 막힘이 아니다', () => {
    // 개체가 16ms 에 2px(=125 px/s) 움직인다: still(30 px/s) 위 → 막힘이 아니다.
    const r = feed([
      { gapPx: 6, at: { x: 100, y: 100 }, nowMs: 1000 },
      { gapPx: 12, at: { x: 102, y: 100 }, nowMs: 1016 },
    ]);
    expect(r.fired).toBe(0);
    // 대조군 — 이동량만 0 으로 바꾸면(다른 값은 그대로) 울린다.
    expect(
      feed([
        { gapPx: 6, at: { x: 100, y: 100 }, nowMs: 1000 },
        { gapPx: 12, at: { x: 100, y: 100 }, nowMs: 1016 },
      ]).fired,
    ).toBe(1);
  });

  it('③ 천천히 벌어지는 것은 안 울린다 — 손떨림과 구별되지 않는다', () => {
    // 16ms 에 1px = 62.5 px/s < minRel(150).
    expect(feed(stuckRun(1, 4)).fired).toBe(0);
    // 대조군 — 벌어지는 속도만 올리면 울린다.
    expect(feed(stuckRun(4, 2)).fired).toBe(1);
  });

  it('가까워지는 중에는 절대 안 울린다 — 상대속도가 음수다', () => {
    expect(
      feed([
        { gapPx: 40, at: { x: 100, y: 100 }, nowMs: 1000 },
        { gapPx: 20, at: { x: 100, y: 100 }, nowMs: 1016 },
      ]).fired,
    ).toBe(0);
  });
});

describe('stepBlockCue — 한 번만 울린다', () => {
  it('벽에 대고 계속 미는 동안 매 프레임 울리지 않는다', () => {
    const r = feed(stuckRun(6, 12));
    expect(r.fired).toBe(1);
    expect(r.impacts.findIndex((i) => i !== null)).toBe(1); // 두 번째 표본에서 한 번 (첫 표본은 짝이 없다)
  });

  it('개체가 따라잡으면 재무장하고 다음 막힘에 다시 울린다', () => {
    const first = feed(stuckRun(6, 4));
    expect(first.fired).toBe(1);
    expect(first.state.armed).toBe(false);

    // 손이 되돌아와 gap 이 리시 문턱 안으로 들어온다 = 막힘이 풀렸다.
    const relaxed = feed([{ gapPx: 2, at: { x: 100, y: 100 }, nowMs: 1100 }], LIM, first.state);
    expect(relaxed.state.armed).toBe(true);

    const second = feed(stuckRun(6, 3).map((s) => ({ ...s, nowMs: s.nowMs + 200 })), LIM, relaxed.state);
    expect(second.fired).toBe(1);
  });

  it('재무장 전에는 조건이 다시 충족돼도 조용하다 — 대조군은 재무장한 같은 열이 울리는 것', () => {
    const first = feed(stuckRun(6, 3));
    const again = feed(stuckRun(6, 3).map((s) => ({ ...s, nowMs: s.nowMs + 500 })), LIM, first.state);
    expect(again.fired).toBe(0);
    const armedAgain = feed(stuckRun(6, 3).map((s) => ({ ...s, nowMs: s.nowMs + 500 })), LIM, initialBlockCue);
    expect(armedAgain.fired).toBe(1);
  });
});

describe('stepBlockCue — 표본 간격', () => {
  it('간격이 200ms 를 넘으면 판정하지 않는다 — 손을 멈췄다 다시 움직인 프레임의 유령 툭', () => {
    const r = feed([
      { gapPx: 6, at: { x: 100, y: 100 }, nowMs: 1000 },
      { gapPx: 200, at: { x: 100, y: 100 }, nowMs: 1400 },
    ]);
    expect(r.fired).toBe(0);
    // 대조군 — 같은 벌어짐을 정상 간격으로 주면 울린다.
    expect(
      feed([
        { gapPx: 6, at: { x: 100, y: 100 }, nowMs: 1000 },
        { gapPx: 200, at: { x: 100, y: 100 }, nowMs: 1016 },
      ]).fired,
    ).toBe(1);
  });

  it('같은 시각·거꾸로 가는 시각은 판정하지 않는다 — 0 으로 나누지 않는다', () => {
    expect(
      feed([
        { gapPx: 6, at: { x: 100, y: 100 }, nowMs: 1000 },
        { gapPx: 60, at: { x: 100, y: 100 }, nowMs: 1000 },
        { gapPx: 120, at: { x: 100, y: 100 }, nowMs: 990 },
      ]).fired,
    ).toBe(0);
  });
});

describe('stepBlockCue — 세기는 상대속도에 비례한다', () => {
  it('빠르게 떠날수록 세다', () => {
    const soft = feed(stuckRun(4, 2)).impacts[1]!;
    const hard = feed(stuckRun(10, 2)).impacts[1]!;
    expect(soft).toBeGreaterThan(0);
    expect(hard).toBeGreaterThan(soft);
  });

  it('세기는 0..1 안이고 상한에서 멈춘다', () => {
    const huge = feed(stuckRun(400, 2)).impacts[1]!;
    expect(huge).toBe(1);
    for (const per of [4, 6, 10, 20, 60]) {
      const i = feed(stuckRun(per, 2)).impacts[1]!;
      expect(i, `perFrame=${per}`).toBeGreaterThanOrEqual(0);
      expect(i, `perFrame=${per}`).toBeLessThanOrEqual(1);
    }
  });

  it('문턱을 갓 넘긴 막힘은 거의 0 이다 — 살짝 걸린 것이 벽에 박은 것과 같은 소리를 내지 않는다', () => {
    // 16ms 에 2.5px = 156.25 px/s, minRel(150) 바로 위.
    const i = feed(stuckRun(2.5, 2)).impacts[1]!;
    expect(i).toBeGreaterThan(0);
    expect(i).toBeLessThan(0.02);
  });
});

describe('blockCueLimits — 화면 눈금이다', () => {
  it('배율이 오르면 월드 문턱은 반비례로 줄어든다 — 줌이 조작 규칙을 바꾸지 않는다', () => {
    const a = blockCueLimits(1, 4);
    const b = blockCueLimits(2, 4);
    expect(b.leashPx).toBeCloseTo(a.leashPx / 2, 10);
    expect(b.stillPxPerS).toBeCloseTo(a.stillPxPerS / 2, 10);
    expect(b.minRelPxPerS).toBeCloseTo(a.minRelPxPerS / 2, 10);
    expect(b.fullRelPxPerS).toBeCloseTo(a.fullRelPxPerS / 2, 10);
  });

  it('리시 문턱은 호출자가 준 값을 그대로 쓴다 — 화면의 리시와 소리가 같은 순간에 난다', () => {
    expect(blockCueLimits(1, 4).leashPx).toBe(4);
    expect(blockCueLimits(2, 9).leashPx).toBe(4.5);
  });

  it('배율 0·음수는 1 로 접는다 — 무대가 아직 안 재어졌을 때 무한대가 나오면 안 된다', () => {
    expect(blockCueLimits(0, 4)).toEqual(blockCueLimits(1, 4));
    expect(blockCueLimits(-3, 4)).toEqual(blockCueLimits(1, 4));
    expect(Number.isFinite(blockCueLimits(0, 4).minRelPxPerS)).toBe(true);
  });

  it('같은 배율에서 문턱 순서가 지켜진다 — still < minRel < fullRel', () => {
    const l = blockCueLimits(0.8914, 4);
    expect(l.stillPxPerS).toBeLessThan(l.minRelPxPerS);
    expect(l.minRelPxPerS).toBeLessThan(l.fullRelPxPerS);
  });
});
