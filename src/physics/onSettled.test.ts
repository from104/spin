// §4.2 P0-2 — `PhysicsWorldApi.onSettled` 정착 완료 통지의 물리 쪽 계약.
//
// 이 통지가 UI 의 정착 후 재커밋을 구동한다. 여기서 못박는 것은 **시점**이다: 손을 뗀
// 프레임이 아니라 릴리스 체이스가 끝나고 판이 다 선 프레임이어야 한다. 손 뗀 프레임에
// 알리면 재커밋이 다시 "손 떼던 순간의 자리" 를 쓰게 되어 고친 것이 없어진다.
//
// 0차 실측 하네스(physicsProbe)로 돌린다 — rAF·performance.now 를 결정적으로 흉내내므로
// "몇 번째 프레임에 왔나" 를 프레임 단위로 셀 수 있다.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPhysicsProbe } from '../test/helpers/physicsProbe.ts';
import type { PhysicsSnapshot } from './index.ts';
import type { ChairId } from '../core/ids.ts';

const chA = 'ch_a' as ChairId;
const Y = 262.5; // full 코트 세로 중앙
const FROM_X = 400;
const TO_X = 500;

afterEach(() => {
  vi.restoreAllMocks();
});

/** 칩 한 대를 100px 오른쪽으로 끌기 시작하고, 아직 한참 못 간 상태에서 멈춘 프로브. */
function draggingProbe() {
  const probe = createPhysicsProbe({ chairs: [{ id: chA, x: FROM_X, y: Y }] });
  probe.startDrag(chA);
  probe.moveTo({ x: TO_X, y: Y });
  probe.stepFrames(30); // 30 substep × 0.5787 = 17.4px — 목표까지 갈 길이 멀다
  return probe;
}

describe('onSettled — 정착 완료 통지', () => {
  it('드래그 중에는 오지 않는다', () => {
    const probe = draggingProbe();
    let hits = 0;
    probe.api.onSettled(() => {
      hits += 1;
    });
    probe.stepFrames(60);
    expect(hits).toBe(0);
    expect(probe.isRunning()).toBe(true);
    probe.dispose();
  });

  it('릴리스 체이스가 끝나 루프가 멎는 그 프레임에 **한 번** 온다', () => {
    const probe = draggingProbe();
    const seen: Array<{ frame: number; snap: PhysicsSnapshot }> = [];
    probe.api.onSettled((snap) => seen.push({ frame: probe.frame(), snap }));

    // 손을 뗀 시점의 좌표 — 목표(500)와 한참 다르다. 이 값이 통지에 실려 오면 고친 것이 없다.
    const atRelease = probe.api.read()[chA]!.x;
    expect(atRelease).toBeLessThan(TO_X - 60);

    probe.endDrag();
    expect(seen).toHaveLength(0); // 손 뗀 그 순간에는 아직 아무 일도 없다

    probe.runUntilLoopStops({ maxFrames: 400 });
    expect(seen).toHaveLength(1);

    // 루프가 멎은 프레임과 같은 프레임이다.
    expect(seen[0]!.frame).toBe(probe.trace.at(-1)!.frame);
    expect(probe.trace.at(-1)!.running).toBe(false);

    // 실린 좌표는 **체이스가 끝난 자리** 다(목표 1px 이내, §5.11 종료 조건).
    expect(seen[0]!.snap[chA]!.x).toBeGreaterThan(TO_X - 1.5);
    expect(seen[0]!.snap[chA]!.x).toBeCloseTo(probe.api.read()[chA]!.x, 9);

    // 그 뒤로 프레임을 아무리 흘려도 다시 오지 않는다(루프가 멎었으므로).
    probe.stepFrames(30);
    expect(seen).toHaveLength(1);
    probe.dispose();
  });

  it('구독을 해제하면 오지 않는다', () => {
    const probe = draggingProbe();
    let hits = 0;
    const off = probe.api.onSettled(() => {
      hits += 1;
    });
    off();
    probe.endDrag();
    probe.runUntilLoopStops({ maxFrames: 400 });
    expect(hits).toBe(0);
    probe.dispose();
  });

  it('dispose() 는 통지하지 않는다 — "판이 다 섰다" 이지 "루프가 꺼졌다" 가 아니다', () => {
    const probe = draggingProbe();
    let hits = 0;
    probe.api.onSettled(() => {
      hits += 1;
    });
    probe.dispose(); // 드래그 도중 화면을 떠난 경우
    expect(hits).toBe(0);
  });
});
