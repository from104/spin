// §6.4 — **물리 세계가 그 판의 코트 크기로 서는가.**
//
// 두 가지가 여기서만 관측된다.
//  ① **벽**: `createPhysicsWorld(vbW, vbH)` 의 인자. 25×14 판에서 벽이 825×525 에 서면 개체가
//     판 밖 여백 너머까지 굴러 나간다 — 화면에는 코트가 700×425 로 그려져 있으므로 "칩이
//     사라졌다" 로만 겪힌다.
//  ② **골대**: `world.load(..., size)`. 안 넘기면 공이 허공의 골대에 맞는다(physics 쪽 테스트가
//     load 를 직접 찌르고, 여기서는 **그 인자를 실제로 넘겨 주는 배선**을 본다).
//
// ⚠️ **마운트 직후만 재지 않는다.** 5차 검증관이 provider 테스트를 마운트 시점만 재는 바람에
//    배선 절단 반증이 둘 다 초록이었던 전례가 있다. 그래서 아래에는 축이 하나 더 있다 —
//    BOARD_SET 으로 **판을 갈아끼운 뒤** 다시 잰다.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, act } from '@testing-library/react';

/** createPhysicsWorld 가 받은 (폭, 높이). 원본에 그대로 위임하므로 물리는 진짜다. */
const worldSizes: Array<[number, number]> = [];
vi.mock('../../physics/index.ts', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../physics/index.ts')>();
  return {
    ...mod,
    createPhysicsWorld: (w: number, h: number, ...rest: unknown[]) => {
      worldSizes.push([w, h]);
      return (mod.createPhysicsWorld as unknown as (...a: unknown[]) => unknown)(w, h, ...rest);
    },
  };
});

const { EditorProvider, useEditorWorld, useEditorDispatch } = await import('./EditorProvider.tsx');
const { GOAL_ID_PREFIX } = await import('../../physics/index.ts');
const { createDrill } = await import('../../model/defaults.ts');
const { SettingsProvider } = await import('../settings/SettingsProvider.tsx');
const { courtDefFor, COURT_SIZES } = await import('../../model/court.ts');
type CourtSize = (typeof COURT_SIZES)[number];

let probe: {
  posts(): Array<{ x: number; y: number }>;
  swapTo(size: CourtSize): void;
} | null = null;

function Probe() {
  const worldRef = useEditorWorld();
  const dispatch = useEditorDispatch();
  probe = {
    posts() {
      const snap = worldRef.current?.read() ?? {};
      const out: Array<{ x: number; y: number }> = [];
      for (let i = 0; ; i++) {
        const p = snap[`${GOAL_ID_PREFIX}${i}`];
        if (!p) break;
        out.push({ x: p.x, y: p.y });
      }
      return out;
    },
    swapTo(size: CourtSize) {
      dispatch({ type: 'BOARD_SET', drill: createDrill({ courtMode: 'full', courtSize: size, empty: true }) });
    },
  };
  return null;
}

function mount(size: CourtSize) {
  render(
    // EditorProvider 는 물리 상한·존을 설정에서 읽는다 — 실제 Provider 를 쓴다(스텁 아님).
    <SettingsProvider>
      <EditorProvider drill={createDrill({ courtMode: 'full', courtSize: size, empty: true })}>
        <Probe />
      </EditorProvider>
    </SettingsProvider>,
  );
}

beforeEach(() => {
  worldSizes.length = 0;
  probe = null;
});
afterEach(cleanup);

describe('§6.4 EditorProvider — 물리 세계가 코트 크기를 따라간다', () => {
  it('대조군: 세 크기의 viewBox 가 애초에 서로 다르다', () => {
    expect(new Set(COURT_SIZES.map((s) => `${courtDefFor('full', s).vbW}×${courtDefFor('full', s).vbH}`)).size).toBe(3);
  });

  it.each(COURT_SIZES)('%s — 벽이 그 크기의 viewBox 로 선다', (size) => {
    const def = courtDefFor('full', size);
    mount(size);
    expect(worldSizes.at(-1)).toEqual([def.vbW, def.vbH]);
  });

  it.each(COURT_SIZES)('%s — 골대가 그 크기의 골라인에 선다', (size) => {
    const def = courtDefFor('full', size);
    mount(size);
    const posts = probe!.posts();
    expect(posts).toHaveLength(def.goalPosts.length);
    for (let i = 0; i < posts.length; i++) {
      expect(posts[i]!.x).toBeCloseTo(def.goalPosts[i]!.x, 6);
      expect(posts[i]!.y).toBeCloseTo(def.goalPosts[i]!.y, 6);
    }
  });

  it('⚠️ 마운트 뒤 **판을 갈아끼워도** 벽과 골대가 새 크기를 따라간다', () => {
    mount('30x18');
    const big = courtDefFor('full', '30x18');
    expect(worldSizes.at(-1)).toEqual([big.vbW, big.vbH]);

    act(() => probe!.swapTo('25x14'));

    const small = courtDefFor('full', '25x14');
    expect(worldSizes.at(-1), '판을 갈아끼웠는데 물리 세계가 옛 크기 그대로다').toEqual([small.vbW, small.vbH]);
    const posts = probe!.posts().map((p) => `${p.x},${p.y}`);
    for (const p of small.goalPosts) expect(posts).toContain(`${p.x},${p.y}`);
    for (const p of big.goalPosts) expect(posts).not.toContain(`${p.x},${p.y}`);
  });
});
