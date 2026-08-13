// §6.4 — **골대가 그 판의 코트 크기를 따라 서는가.**
//
// 골대는 드릴에 저장되지 않고 코트 정의에서 온다(§5.4 GOAL). 그래서 `world.load` 가 크기를
// 안 받으면 25×14 판에서도 골포스트가 30×18 자리(y=187.5/337.5, x=787.5)에 선다 — 경기면
// 오른쪽 끝이 662.5 인 판에서 x=787.5 는 **판 밖**이고, 공은 그 허공의 골대에 맞고 튄다.
// 화면(FullCourtLines)은 크기를 따라 그리므로 "보이지 않는 벽" 이 되어 더 나쁘다.
import { describe, expect, it } from 'vitest';
import { createPhysicsWorld, GOAL_ID_PREFIX } from './index.ts';
import { courtDefFor, COURT_SIZES, type CourtSize } from '../model/court.ts';
import type { DrillCast, DrillStep } from '../model/drill.ts';
import type { StepId } from '../core/ids.ts';

const EMPTY_CAST: DrillCast = { chairs: [], balls: [], cones: [] };
const EMPTY_STEP: DrillStep = {
  id: 'st_1' as StepId,
  name: '스텝 1',
  note: '',
  chairs: {},
  balls: {},
  cones: {},
  arrows: [],
  notes: [],
};

/** 그 크기의 판을 세우고 골포스트 좌표만 읽는다. 벽(vbW/vbH)도 같은 정의에서 온다. */
function goalPostsIn(size: CourtSize | undefined, mode: 'full' | 'half' | 'flat' = 'full'): Array<{ x: number; y: number }> {
  const def = courtDefFor(mode, size);
  const world = createPhysicsWorld(def.vbW, def.vbH);
  try {
    world.load(EMPTY_CAST, EMPTY_STEP, mode, size);
    const snap = world.read();
    const out: Array<{ x: number; y: number }> = [];
    for (let i = 0; ; i++) {
      const p = snap[`${GOAL_ID_PREFIX}${i}`];
      if (!p) break;
      out.push({ x: p.x, y: p.y });
    }
    return out;
  } finally {
    world.dispose();
  }
}

describe('§6.4 물리 — 골대가 코트 크기 3단을 따라간다', () => {
  it('대조군: 세 크기의 골포스트 좌표가 애초에 서로 다르다', () => {
    const keys = COURT_SIZES.map((s) => courtDefFor('full', s).goalPosts.map((p) => `${p.x},${p.y}`).join('|'));
    expect(new Set(keys).size).toBe(3);
    // 셋 다 골대는 4개(2골대 × 포스트 2개)다 — **개수로는 사고가 드러나지 않는다.**
    for (const s of COURT_SIZES) expect(courtDefFor('full', s).goalPosts).toHaveLength(4);
  });

  it.each(COURT_SIZES)('%s — 물리 바디가 그 크기의 골포스트 자리에 선다', (size) => {
    const def = courtDefFor('full', size);
    const got = goalPostsIn(size);
    expect(got).toHaveLength(def.goalPosts.length);
    for (let i = 0; i < def.goalPosts.length; i++) {
      expect(got[i]!.x).toBeCloseTo(def.goalPosts[i]!.x, 6);
      expect(got[i]!.y).toBeCloseTo(def.goalPosts[i]!.y, 6);
    }
  });

  it('25×14 판에는 30×18 의 골대 자리가 **하나도 없다** — 허공의 골대가 남지 않는다', () => {
    const got = goalPostsIn('25x14').map((p) => `${p.x},${p.y}`);
    for (const p of courtDefFor('full', '30x18').goalPosts) {
      expect(got, '30×18 골대가 25×14 판에 남아 있다 — 공이 판 밖에서 튄다').not.toContain(`${p.x},${p.y}`);
    }
    // 대조군: 같은 비교 방식이 옳은 좌표는 실제로 찾아낸다.
    for (const p of courtDefFor('full', '25x14').goalPosts) expect(got).toContain(`${p.x},${p.y}`);
  });

  it('골대는 경기면 골라인 위에 선다 — 세 크기 전부(판 밖으로 나가지 않는다)', () => {
    for (const size of COURT_SIZES) {
      const def = courtDefFor('full', size);
      for (const p of goalPostsIn(size)) {
        expect(p.x, `${size}: 골포스트 x 가 viewBox 밖`).toBeGreaterThanOrEqual(0);
        expect(p.x, `${size}: 골포스트 x 가 viewBox 밖`).toBeLessThanOrEqual(def.vbW);
        expect(p.y, `${size}: 골포스트 y 가 viewBox 밖`).toBeGreaterThanOrEqual(0);
        expect(p.y, `${size}: 골포스트 y 가 viewBox 밖`).toBeLessThanOrEqual(def.vbH);
        // 골라인(경기면 좌우 변) 위다.
        expect([def.surface.x, def.surface.x + def.surface.w]).toContain(p.x);
      }
    }
  });

  it('size 를 생략하면 30×18 이다 — 크기를 모르는 옛 호출부가 그대로 돈다', () => {
    const got = goalPostsIn(undefined).map((p) => `${p.x},${p.y}`);
    for (const p of courtDefFor('full', '30x18').goalPosts) expect(got).toContain(`${p.x},${p.y}`);
  });

  it('대조군: half 는 크기를 따라가지 않는다 (골대 2개, 두 크기가 같은 자리)', () => {
    const a = goalPostsIn('30x18', 'half');
    const b = goalPostsIn('25x14', 'half');
    expect(a).toHaveLength(2);
    expect(b).toEqual(a);
  });
});
