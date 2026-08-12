// 1.5 — 루프 수명 불변식(§4.2 알려진 이슈 #2 "편집 중 멈춤"). §5.8/§5.11.
//
// 1.1~1.4 가 `substep()` 안의 호출 순서를 세 번(정착 통지 · 정착 술어 · 판 밖 안전망), 루프의
// 종료 조건을 두 번 건드렸다. 그래서 개별 기능이 아니라 **수명 그 자체**를 한 파일에서 본다:
//
//   ① 드래그 1회 = 루프 start 1 / stop 1 — 짝이 맞는가, 엇갈리지 않는가
//   ② 손을 뗀 뒤에는 반드시 멎는가 (상한 8초 안에)
//   ③ 손을 떼기 전에는 절대 안 멎는가  ← ②만 있으면 "다 멈추네" 로 통과해 버린다
//   ④ rAF 체인이 갈라지지 않는가 (한 프레임에 콜백 2개 = 브라우저 멈춤의 고전적 원인)
//
// ③ 이 이 파일의 본론이다. **실제로 재현된 멈춤**이 거기 있었다: 드래그 도중 [골대 원위치] 를
// 누르면(태블릿에서 두 번째 손가락으로 누르면 된다 — 스테이지의 포인터 캡처는 SVG 밖 버튼을
// 막지 않는다) `resetGoals` 가 정착 구간을 열고, 손이 멈춰 있는 그 프레임의 정착 술어가
// `allAtRest()===true` 를 보고 루프를 꺼 버린다. 그 뒤로는 손을 아무리 움직여도 칩이 따라오지
// 않고, 손을 떼도 `endDrag` 가 영영 안 돌아 칩이 static 인 채로 남는다(이웃이 밀 수도 없다).
// loop.ts:11-14 가 `cancelSettle` 주석에 적어 둔 바로 그 사고인데, 그 방어는 "새 드래그가
// 시작될 때 옛 구간을 닫는다" 쪽만 막고 "드래그 도중 새 구간이 열리는" 쪽은 비어 있었다.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPhysicsProbe } from '../test/helpers/physicsProbe.ts';
import type { PhysicsProbe, LoopEvent } from '../test/helpers/physicsProbe.ts';
import { PHYS } from '../core/constants.ts';
import type { BallId, CastId, ChairId, StepId } from '../core/ids.ts';

const chA = 'ch_a' as ChairId;
const chB = 'ch_b' as ChairId;
const blA = 'bl_a' as BallId;
const Y = 262.5; // full 코트 세로 중앙

afterEach(() => {
  vi.restoreAllMocks(); // probe.dispose() 가 이미 되돌리지만, 도중에 실패해도 새지 않게.
});

/** start/stop 전이만 남긴 축약 — settle/cancelSettle 은 '구간 요청' 이지 '루프 생사' 가 아니다. */
const lifeOf = (events: readonly LoopEvent[]): string[] =>
  events.filter((e) => e.kind === 'start' || e.kind === 'stop').map((e) => e.kind);

/** 이 프로브가 살아 있는 동안 rAF 체인이 한 번도 갈라지지 않았는가.
 *  loop.ts 의 재예약 지점은 frame() 꼬리 하나뿐이므로 정상값은 0 아니면 1 이다. */
function expectSingleRafChain(p: PhysicsProbe): void {
  const worst = Math.max(...p.trace.map((r) => r.rafPending));
  expect(worst).toBeLessThanOrEqual(1);
  // 체인이 갈라지면 한 프레임에 substep 이 여러 번 도는 것으로도 새어 나온다(누산기를 공유하
  // 므로 두 번째 콜백은 0 번 돌지만, 갈라진 체인이 서로 다른 누산 상태를 가지면 그렇지 않다).
  expect(Math.max(...p.trace.map((r) => r.substeps))).toBeLessThanOrEqual(1);
}

describe('드래그 1회 = 루프 start 1 / stop 1', () => {
  it('한 번 끌고 놓으면 start 1 · stop 1 이고 그 순서다', () => {
    const p = createPhysicsProbe({ chairs: [{ id: chA, x: 200, y: Y }] });
    p.startDrag(chA);
    p.moveTo({ x: 300, y: Y });
    p.stepFrames(30);
    p.endDrag();
    p.runUntilLoopStops({ maxFrames: 2000 });

    expect(lifeOf(p.loopEvents)).toEqual(['start', 'stop']);
    expect(p.isRunning()).toBe(false);
    // 멎은 루프는 rAF 콜백을 물고 있지 않다 — 물고 있으면 "죽은 척하는 루프" 다.
    expect(p.rafPending()).toBe(0);
    expectSingleRafChain(p);
    p.dispose();
  });

  it('연속 3회 — start/stop 이 3쌍이고 한 번도 엇갈리지 않는다', () => {
    const p = createPhysicsProbe({ chairs: [{ id: chA, x: 200, y: Y }, { id: chB, x: 400, y: Y }] });
    for (let i = 0; i < 3; i++) {
      p.startDrag(chA);
      p.moveTo({ x: 250 + i * 30, y: Y });
      p.stepFrames(20);
      p.endDrag();
      p.runUntilLoopStops({ maxFrames: 2000 });
    }
    expect(lifeOf(p.loopEvents)).toEqual(['start', 'stop', 'start', 'stop', 'start', 'stop']);
    expectSingleRafChain(p);
    p.dispose();
  });

  it('손을 안 뗀 채 다른 칩을 잡으면 루프는 한 번도 죽지 않는다(start 1 · stop 1)', () => {
    const p = createPhysicsProbe({ chairs: [{ id: chA, x: 200, y: Y }, { id: chB, x: 400, y: Y }] });
    p.startDrag(chA);
    p.moveTo({ x: 260, y: Y });
    p.stepFrames(10);
    p.startDrag(chB); // 앞 세션은 index.ts:423-426 이 endDrag 로 정리한다
    p.moveTo({ x: 460, y: Y });
    p.stepFrames(10);
    p.endDrag();
    p.runUntilLoopStops({ maxFrames: 2000 });

    expect(lifeOf(p.loopEvents)).toEqual(['start', 'stop']);
    // 버려진 세션은 정착 구간을 열지 않는다 — 열면 그 구간이 새 드래그 도중에 만료된다.
    expect(p.sessionEvents.filter((e) => e.kind === 'endDrag').map((e) => e.id)).toEqual([chA, chB]);
    expectSingleRafChain(p);
    p.dispose();
  });

  it('정착 대기 중 새 드래그 — cancelSettle 이 걸리고, 두 번째 드래그가 끝나기 전에는 stop 이 없다', () => {
    const p = createPhysicsProbe({ chairs: [{ id: chA, x: 200, y: Y }, { id: chB, x: 400, y: Y }] });
    p.startDrag(chA);
    p.moveTo({ x: 300, y: Y });
    p.stepFrames(30);
    p.endDrag();
    p.stepFrames(3); // 아직 릴리스 체이스 / 정착 대기 중이다
    const secondDownAt = p.frame();
    p.startDrag(chB);
    p.moveTo({ x: 500, y: Y });
    p.stepFrames(10);
    const secondUpAt = p.frame();
    p.endDrag();
    p.runUntilLoopStops({ maxFrames: 3000 });

    expect(lifeOf(p.loopEvents)).toEqual(['start', 'stop']);
    // §5.8 blocker 회귀: 두 번째 드래그가 진행되는 동안 루프가 멎으면 칩이 손 밑에서 언다.
    const stop = p.loopEvents.find((e) => e.kind === 'stop')!;
    expect(stop.frame).toBeGreaterThan(secondUpAt);
    expect(p.loopEvents.some((e) => e.kind === 'cancelSettle' && e.frame === secondDownAt)).toBe(true);
    expectSingleRafChain(p);
    p.dispose();
  });

  it('빠른 연타 20회 — start 수와 stop 수가 같고 마지막에 멎는다', () => {
    const p = createPhysicsProbe({ chairs: [{ id: chA, x: 200, y: Y }, { id: chB, x: 400, y: Y }] });
    for (let i = 0; i < 20; i++) {
      p.startDrag(chA);
      p.moveTo({ x: 210 + i, y: Y });
      p.stepFrames(1);
      p.endDrag();
      p.stepFrames(1);
    }
    p.runUntilLoopStops({ maxFrames: 3000 });

    const life = lifeOf(p.loopEvents);
    expect(life.filter((k) => k === 'start')).toHaveLength(life.filter((k) => k === 'stop').length);
    expect(life.at(-1)).toBe('stop');
    // 짝이 맞는 것만으로는 부족하다 — 순서도 봐야 한다(stop 없이 start 가 두 번 오면 체인이 둘).
    let depth = 0;
    for (const k of life) {
      depth += k === 'start' ? 1 : -1;
      expect(depth === 0 || depth === 1).toBe(true);
    }
    expect(depth).toBe(0);
    expectSingleRafChain(p);
    p.dispose();
  });
});

describe('손을 뗀 뒤에는 반드시 멎는다', () => {
  it('물리가 영영 못 푸는 겹침이어도 상한(8초) 안에 멎는다', () => {
    // 칩 두 대가 들어갈 자리가 없는 판. 정규 코트에는 이런 배치가 없다(physicsProbe.court 주석).
    const p = createPhysicsProbe({ court: { w: 60, h: 40 }, chairs: [{ id: chA, x: 20, y: 20 }, { id: chB, x: 25, y: 20 }] });
    p.startDrag(chA);
    p.moveTo({ x: 25, y: 20 });
    p.stepFrames(10);
    p.endDrag();
    const frames = p.runUntilLoopStops({ maxFrames: 2000 });

    // 상한은 시각 기준이라 프레임 수로 못 박지 않는다 — "8초를 넘기지 않는다" 만 본다.
    expect(frames * PHYS.dtMs).toBeLessThanOrEqual(PHYS.settleMaxMs + PHYS.dtMs * 2);
    expect(lifeOf(p.loopEvents)).toEqual(['start', 'stop']);
    expectSingleRafChain(p);
    p.dispose();
  });

  it('휠체어 16대를 한 점에 쌓아도 멎는다', () => {
    const chairs = Array.from({ length: 16 }, (_, i) => ({ id: `ch_${i}` as ChairId, x: 400 + i * 0.01, y: Y }));
    const p = createPhysicsProbe({ chairs });
    p.startDrag('ch_0' as ChairId);
    p.moveTo({ x: 410, y: Y });
    p.stepFrames(10);
    p.endDrag();
    p.runUntilLoopStops({ maxFrames: 2000 });

    expect(lifeOf(p.loopEvents)).toEqual(['start', 'stop']);
    expectSingleRafChain(p);
    p.dispose();
  });

  it('드래그 도중 스텝이 바뀌어도(load) 도는 루프가 남지 않는다', () => {
    const p = createPhysicsProbe({ chairs: [{ id: chA, x: 200, y: Y }] });
    p.startDrag(chA);
    p.moveTo({ x: 600, y: Y });
    p.stepFrames(5);
    expect(p.isRunning()).toBe(true);

    p.api.load(
      { chairs: [{ id: chA, team: 'home', number: '2', isGk: false }], balls: [], cones: [] },
      { id: 'st_next' as StepId, name: '', note: '', chairs: { [chA]: { x: 300, y: Y, angleDeg: 0 } }, balls: {}, cones: {}, arrows: [], notes: [] },
      'full',
    );
    p.stepFrames(5);

    expect(p.isRunning()).toBe(false);
    expect(p.rafPending()).toBe(0);
    expect(p.trace.slice(-5).every((r) => r.substeps === 0)).toBe(true);
    p.dispose();
  });

  it('dispose 하면 rAF 를 놓는다', () => {
    const p = createPhysicsProbe({ chairs: [{ id: chA, x: 200, y: Y }] });
    p.startDrag(chA);
    p.moveTo({ x: 600, y: Y });
    p.stepFrames(5);
    expect(p.rafPending()).toBe(1);
    p.api.dispose(); // 컴포넌트 언마운트 경로(EditorProvider 의 정리 함수)
    expect(p.rafPending()).toBe(0);
    p.dispose();
  });
});

describe('손을 떼기 전에는 절대 안 멎는다', () => {
  it('손을 안 떼면 1500 프레임(12.5초) 뒤에도 루프가 살아 있다', () => {
    // 위 describe 가 "다 멈추네" 로 통과하지 못하게 하는 대조군이다.
    const p = createPhysicsProbe({ chairs: [{ id: chA, x: 200, y: Y }] });
    p.startDrag(chA);
    p.moveTo({ x: 210, y: Y }); // 곧 도달한다 = 속도 0 = allAtRest()===true 인 채로 계속 잡고 있다
    p.stepFrames(1500);

    expect(p.isRunning()).toBe(true);
    expect(lifeOf(p.loopEvents)).toEqual(['start']); // stop 이 한 번도 없다
    expectSingleRafChain(p);
    p.dispose();
  });

  it('★ 드래그 도중 [골대 원위치] 를 눌러도 루프가 죽지 않고 칩이 계속 따라온다', () => {
    // 재현 경로(알려진 이슈 #2): 태블릿에서 한 손가락으로 칩을 잡은 채 다른 손가락으로 판
    // 하단 [골대 원위치] 를 누른다. 스테이지의 setPointerCapture 는 SVG **밖** 버튼을 막지
    // 않으므로 실제로 눌린다.
    const p = createPhysicsProbe({ chairs: [{ id: chA, x: 200, y: Y }] });
    p.startDrag(chA);
    p.moveTo({ x: 205, y: Y });
    p.stepFrames(30); // 목표에 도달 — 손은 멈춰 있고 판 위의 모든 것이 속도 0 이다
    expect(p.trace.at(-1)!.settled).toBe(true);

    p.api.resetGoals();
    p.stepFrames(5);
    expect(p.isRunning()).toBe(true); // 고치기 전에는 여기서 이미 죽어 있었다

    const before = p.trace.at(-1)!.poses[chA]!.x;
    p.moveTo({ x: 600, y: Y });
    p.stepFrames(60);
    const after = p.trace.at(-1)!.poses[chA]!.x;
    expect(after).toBeGreaterThan(before + 30); // 60 substep × 0.5787 px = 34.7 px
    expect(lifeOf(p.loopEvents)).toEqual(['start']);

    // 손을 떼면 평소대로 정착하고 멎는다 — 얼렸던 것을 녹인 게 아니라 애초에 안 얼린다.
    p.endDrag();
    p.runUntilLoopStops({ maxFrames: 3000 });
    expect(lifeOf(p.loopEvents)).toEqual(['start', 'stop']);
    expect(p.sessionEvents.some((e) => e.kind === 'endDrag')).toBe(true);
    expectSingleRafChain(p);
    p.dispose();
  });

  it('★ 릴리스 체이스 중 [골대 원위치] 를 눌러도 체이스가 끊기지 않는다', () => {
    // 이쪽이 더 나쁘다: 체이스가 끊기면 endDrag 가 영영 안 돌아 칩이 static 으로 남고(이웃이
    // 밀 수도 없다) 정착 통지가 안 와 자동저장 억제 창도 안 닫힌다(§4.2 A-5).
    const p = createPhysicsProbe({ chairs: [{ id: chA, x: 200, y: Y }] });
    const seen: number[] = [];
    p.api.onSettled(() => seen.push(p.frame()));
    p.startDrag(chA);
    p.moveTo({ x: 600, y: Y }); // 속도 제한 때문에 손을 떼도 한참 더 달려야 한다
    p.stepFrames(20);
    p.endDrag();
    p.stepFrames(3);
    expect(p.sessionEvents.some((e) => e.kind === 'endDrag')).toBe(false); // 아직 체이스 중

    p.api.resetGoals();
    p.runUntilLoopStops({ maxFrames: 3000 });

    expect(p.sessionEvents.filter((e) => e.kind === 'endDrag')).toHaveLength(1);
    expect(seen).toHaveLength(1); // 정착 통지가 정확히 한 번 온다
    expect(lifeOf(p.loopEvents)).toEqual(['start', 'stop']);
    p.dispose();
  });

  it('드래그가 없을 때의 [골대 원위치] 는 여전히 정착 구간을 열고 스스로 멎는다', () => {
    // 위 두 건의 수정이 "resetGoals 가 정착을 아예 안 연다" 로 새지 않게 하는 대조군.
    const p = createPhysicsProbe({ chairs: [{ id: chA, x: 200, y: Y }], balls: [{ id: blA, x: 400, y: Y }] });
    p.api.setPose('gp_0' as CastId, { x: 300, y: 300 }); // 골대를 밀어낸 상태로 만든다
    expect(p.api.goalsDisplaced()).toBe(true);

    const seen: number[] = [];
    p.api.onSettled(() => seen.push(p.frame()));
    p.api.resetGoals();
    expect(p.loopEvents.some((e) => e.kind === 'settle')).toBe(true);
    p.runUntilLoopStops({ maxFrames: 2000 });

    expect(p.api.goalsDisplaced()).toBe(false);
    expect(seen).toHaveLength(1);
    expect(lifeOf(p.loopEvents)).toEqual(['start', 'stop']);
    expectSingleRafChain(p);
    p.dispose();
  });
});
