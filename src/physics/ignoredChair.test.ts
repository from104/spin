// '무시' 한 휠체어는 **물리 월드에 없다** (2026-08-14 기현 지시).
//
// 기현님 표현: *"무시(흐리게, 상호작용안함)"*. 잠김이 *"고정되어 상호작용은 하는"* 과
// 대비되므로, 여기서 '상호작용' 은 UI 가 아니라 **물리**다 — 공이 통과해야 한다.
//
// ⚠️ 이 파일이 필요한 이유: 화면 테스트는 흐릿함과 포인터 차단까지만 잰다. 물리 배선을
// 지우고 돌려 보니 그 테스트가 **그대로 초록**이었다(2026-08-14 반증). 흐리기만 하고 body 를
// 두면 "안 보이는데 부딪히는 유령" 이 되는데, 그것이 정확히 못 잡히던 상태다.
import { describe, expect, it } from 'vitest';
import { createPhysicsWorld } from './index.ts';
import type { DrillCast, DrillStep } from '../model/drill.ts';
import type { ChairId, BallId, StepId } from '../core/ids.ts';

const chA = 'ch_a' as ChairId;
const chB = 'ch_b' as ChairId;
const blA = 'bl_a' as BallId;

const cast: DrillCast = {
  chairs: [
    { id: chA, team: 'home', number: '2', isGk: false },
    { id: chB, team: 'away', number: '3', isGk: false },
  ],
  balls: [{ id: blA }],
  cones: [],
};

const step = (over: Partial<DrillStep> = {}): DrillStep => ({
  id: 'st_x' as StepId,
  name: '',
  note: '',
  chairs: { [chA]: { x: 300, y: 300, angleDeg: 0 }, [chB]: { x: 500, y: 300, angleDeg: 0 } },
  balls: { [blA]: { x: 400, y: 300 } },
  cones: {},
  arrows: [],
  notes: [],
  shapes: [],
  ...over,
});

const load = (s: DrillStep) => {
  const api = createPhysicsWorld(825, 525);
  api.load(cast, s, 'full');
  return api;
};

describe('무시 — 월드에서 빠진다', () => {
  it('대조군: 무시하지 않으면 두 휠체어가 모두 물리에 있다', () => {
    const snap = load(step()).read();
    expect(snap[chA]).toBeDefined();
    expect(snap[chB]).toBeDefined();
  });

  it('★ 무시한 휠체어는 스냅샷에 **아예 없다** — body 가 안 만들어졌다', () => {
    const snap = load(step({ ignored: [chB] })).read();
    expect(snap[chA], '엉뚱한 쪽이 빠졌다').toBeDefined();
    expect(snap[chB], '무시했는데 물리에 남아 있다 — 안 보이는데 부딪히는 유령이다').toBeUndefined();
  });

  it('둘 다 무시하면 둘 다 없다 — 목록을 하나만 읽고 있지 않다', () => {
    const snap = load(step({ ignored: [chA, chB] })).read();
    expect(snap[chA]).toBeUndefined();
    expect(snap[chB]).toBeUndefined();
  });

  it('무시는 **공·콘에는 안 쓴다** — 휠체어 목록만 본다(기현 지시)', () => {
    // 정화기가 공 id 를 걸러내지만, 물리가 그걸 믿고 있다는 것을 여기서도 못박는다.
    const snap = load(step({ ignored: [blA as unknown as ChairId] })).read();
    expect(snap[blA], '공이 무시 목록 때문에 사라졌다').toBeDefined();
  });
});

describe('잠김 — 공·콘은 고정되되 부딪힌다', () => {
  it('잠긴 공은 휠체어가 밀어도 **안 움직인다**', () => {
    const w = load(step({ locked: [blA] }));
    const before = w.read()[blA]!;
    // 휠체어를 공 자리로 밀어 넣는다 — 잠기지 않았다면 공이 튕겨 나간다.
    w.setPose(chA, { x: 395, y: 300, theta: 0 });
    for (let i = 0; i < 30; i++) w.step(1 / 60);
    const after = w.read()[blA]!;
    expect(Math.hypot(after.x - before.x, after.y - before.y), '잠근 공이 밀려났다').toBeLessThan(0.5);
  });

  it('대조군: 안 잠근 공은 같은 조작에서 실제로 밀린다', () => {
    const w = load(step());
    const before = w.read()[blA]!;
    w.setPose(chA, { x: 395, y: 300, theta: 0 });
    for (let i = 0; i < 30; i++) w.step(1 / 60);
    const after = w.read()[blA]!;
    expect(Math.hypot(after.x - before.x, after.y - before.y), '대조군이 안 움직이면 위 단언이 공짜다').toBeGreaterThan(1);
  });
});

// ── 잠긴 **휠체어** (기현 신고 2026-08-15: *"잠긴 개체가 다른 개체에 안 밀려야 된다"*) ──
//
// ⚠️ 이 describe 가 늦게 생긴 이유를 적어 둔다. 2026-08-14 의 `load` 는 잠김을 **공·콘에만**
// 적용하고, 주석에 *"휠체어는 원래 static 이라 잠금이 물리를 안 바꾼다"* 고 단언해 두었다.
// 그 단언이 틀렸다 — 휠체어가 static 이 되는 것은 **끄는 동안뿐**이고(`setChairDragging`),
// 평소에는 dynamic 이라 옆 칩이 밀고 들어오면 그대로 밀려났다. 잘못된 주석이 테스트가 없어야
// 할 이유처럼 쓰인 자리다.
describe('잠김 — 휠체어도 안 밀린다', () => {
  const pushInto = (s: DrillStep) => {
    const w = load(s);
    const before = w.read()[chA]!;
    // chB 를 chA 자리로 밀어 넣는다.
    // ⚠️ 차체 길이는 37.5 px 이라 **40 px 떨어뜨려 놓으면 애초에 안 닿는다**(첫 시도의 대조군이
    //    0 px 로 나온 이유가 이것이다). 320 까지 밀어 넣어 확실히 겹치게 한다.
    for (let k = 0; k <= 40; k++) {
      w.setPose(chB, { x: Math.max(320, 500 - k * 6), y: 300, theta: 0 });
      w.step(1 / 60);
    }
    for (let k = 0; k < 20; k++) w.step(1 / 60); // 밀린 뒤 정착까지
    const after = w.read()[chA]!;
    return Math.hypot(after.x - before.x, after.y - before.y);
  };

  it('★ 잠근 휠체어는 다른 휠체어가 밀고 들어와도 제자리다', () => {
    expect(pushInto(step({ locked: [chA] })), '잠근 칩이 밀려났다').toBeLessThan(0.5);
  });

  it('대조군: 안 잠근 같은 휠체어는 같은 조작에서 실제로 밀린다', () => {
    expect(pushInto(step()), '대조군이 안 밀리면 위 단언이 공짜다').toBeGreaterThan(1);
  });

  it('잠근 쪽만 고정된다 — 미는 쪽(chB)은 목록에 없으므로 그대로 움직인다', () => {
    const w = load(step({ locked: [chA] }));
    w.setPose(chB, { x: 460, y: 300, theta: 0 });
    for (let i = 0; i < 10; i++) w.step(1 / 60);
    expect(w.read()[chB]!.x, '미는 쪽까지 굳었다 — 잠금 목록을 안 보고 전부 static 으로 만든 것이다').toBeCloseTo(460, 0);
  });
});
