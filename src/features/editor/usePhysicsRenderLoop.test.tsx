// §4.4 P2-4 — 렌더 펌프가 **한 프레임을 한 번만 읽어** 자세와 규칙 판정에 함께 준다는 계약.
// 판정 쪽에서 `read()` 를 한 번 더 부르면 물리 루프(§5.8, 앱 rAF 와 별개 인스턴스)가 그 사이에
// 한 스텝을 돌 수 있어 링 위치와 색이 한 프레임씩 어긋난다.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePhysicsRenderLoop } from './usePhysicsRenderLoop.ts';
import type { EditorWorldRef } from '../../store/editor/EditorProvider.tsx';
import type { PhysicsSnapshot, PhysicsWorldApi } from '../../physics/index.ts';
import type { TransformWriter } from '../../render/transformWriter.ts';
import type { RuleOverlayApi } from '../../render/ruleOverlay.ts';

// rafLoop.test.ts 와 같은 관용구 — 핸들로 관리해야 취소가 실제로 큐에서 빠진다.
let pending: Array<{ id: number; cb: (t: number) => void }> = [];
let seq = 0;
let now = 0;

function flushFrame(): void {
  const due = pending;
  pending = [];
  now += 16;
  for (const p of due) p.cb(now);
}

beforeEach(() => {
  pending = [];
  seq = 0;
  now = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
    seq += 1;
    pending.push({ id: seq, cb: cb as (t: number) => void });
    return seq;
  });
  vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation((h: number) => {
    pending = pending.filter((p) => p.id !== h);
  });
});
afterEach(() => {
  vi.restoreAllMocks();
});

function fakeWorld(): { ref: EditorWorldRef; reads: number; snapshots: PhysicsSnapshot[] } {
  const snapshots: PhysicsSnapshot[] = [];
  let reads = 0;
  const api = {
    read(): PhysicsSnapshot {
      reads += 1;
      // **매번 새 객체**를 돌려준다(실제 readSnapshot 과 같다) — 그래야 "같은 스냅샷을
      // 두 소비자가 받았는가" 를 참조 동일성으로 잴 수 있다.
      const snap: PhysicsSnapshot = { bl_1: { x: reads, y: 0, theta: 0 } };
      snapshots.push(snap);
      return snap;
    },
  } as unknown as PhysicsWorldApi;
  return {
    ref: { current: api } as EditorWorldRef,
    get reads() {
      return reads;
    },
    snapshots,
  };
}

function fakeWriter(): TransformWriter & { frames: unknown[] } {
  const frames: unknown[] = [];
  return {
    frames,
    register: vi.fn(),
    registerCounter: vi.fn(),
    registerFollower: vi.fn(),
    write: vi.fn(),
    writeFrame: (f: unknown) => {
      frames.push(f);
    },
    setHeld: vi.fn(),
    snapshot: vi.fn(),
    clear: vi.fn(),
  } as unknown as TransformWriter & { frames: unknown[] };
}

function fakeRules(): RuleOverlayApi & { frames: unknown[] } {
  const frames: unknown[] = [];
  return {
    frames,
    setContext: vi.fn(),
    registerRing: vi.fn(),
    registerZone: vi.fn(),
    write: (f: unknown) => {
      frames.push(f);
    },
    clear: vi.fn(),
  } as unknown as RuleOverlayApi & { frames: unknown[] };
}

describe('usePhysicsRenderLoop', () => {
  it('한 프레임을 한 번만 읽어 자세와 규칙 판정에 **같은 객체**로 준다', () => {
    const world = fakeWorld();
    const writer = fakeWriter();
    const rules = fakeRules();
    renderHook(() => usePhysicsRenderLoop(world.ref, writer, rules));
    flushFrame();
    expect(world.reads).toBe(1);
    expect(writer.frames).toHaveLength(1);
    expect(rules.frames).toHaveLength(1);
    expect(rules.frames[0]).toBe(writer.frames[0]); // 참조 동일 — 두 번 읽지 않았다
    flushFrame();
    expect(world.reads).toBe(2);
    expect(rules.frames[1]).toBe(writer.frames[1]);
    expect(rules.frames[1]).not.toBe(rules.frames[0]); // 대조군: 프레임은 실제로 갱신된다
  });

  it('규칙 오버레이 없이도 돈다 — 인자는 선택이다', () => {
    const world = fakeWorld();
    const writer = fakeWriter();
    renderHook(() => usePhysicsRenderLoop(world.ref, writer));
    flushFrame();
    expect(writer.frames).toHaveLength(1);
  });

  it('월드가 아직 없으면 아무도 부르지 않는다', () => {
    const writer = fakeWriter();
    const rules = fakeRules();
    renderHook(() => usePhysicsRenderLoop({ current: null } as EditorWorldRef, writer, rules));
    flushFrame();
    expect(writer.frames).toHaveLength(0);
    expect(rules.frames).toHaveLength(0);
  });

  it('언마운트하면 구독이 끊긴다', () => {
    const world = fakeWorld();
    const writer = fakeWriter();
    const rules = fakeRules();
    const { unmount } = renderHook(() => usePhysicsRenderLoop(world.ref, writer, rules));
    flushFrame();
    unmount();
    flushFrame();
    expect(rules.frames).toHaveLength(1);
  });
});
