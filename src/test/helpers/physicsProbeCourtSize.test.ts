// 6차 검증 — **계기 자체가 거짓말하지 않는가.**
//
// 6.4 는 `ProbeSetup.size` 를 더하면서 그 값을 `courtDefFor(mode, size)` 로 **벽·viewBox 에만**
// 이었고, `api.load(cast, step, mode)` 에는 넘기지 않았다. 그래서 `createPhysicsProbe({ size:
// '25x14' })` 로 세운 월드는 **벽은 25×14, 골대는 30×18** 인 잡종이 된다. 실측(2026-08-13):
// gp_2 가 (662.5, 137.5) 여야 하는데 (695, 187.5) 에 섰다 — x 787.5 가 벽(vbW 700)에 밀려
// 695 로 클램프된 것이고, y 는 30×18 의 값 그대로다.
//
// 왜 이것이 결함인가: 프로덕션 코드가 아니라 **하네스**이므로 사용자 피해는 0 이다. 그러나
// 이 하네스는 1.1~1.4 와 §6.4 물리 주장의 유일한 계기다. 다음 사람이 코트 크기와 물리를 함께
// 재려고 `size:` 를 쓰는 순간, 그 테스트는 "골대가 엉뚱한 데 선 판" 을 재면서 초록불을 준다
// (또는 이유를 알 수 없이 빨개진다). 이 저장소의 규율은 *"반증해 보고 초록이면 그 단언은
// 없는 것이다"* 인데, 계기가 틀리면 반증 자체가 헛것이 된다.
//
// ⚠️ 되돌리면 무엇이 깨지는가: `physicsProbe.ts` 의 `api.load(cast, step, mode, setup.size)`
//    에서 네 번째 인자를 빼면 아래 세 it 이 전부 빨개진다.
import { describe, expect, it } from 'vitest';
import { createPhysicsProbe } from './physicsProbe.ts';
import { GOAL_ID_PREFIX } from '../../physics/index.ts';
import { courtDefFor, COURT_SIZES } from '../../model/court.ts';

/** 그 크기로 세운 프로브에서 골포스트 좌표만 읽는다. */
function postsFrom(size: (typeof COURT_SIZES)[number] | undefined): Array<{ x: number; y: number }> {
  const probe = createPhysicsProbe({ mode: 'full', size, balls: [] });
  try {
    const snap = probe.api.read();
    const out: Array<{ x: number; y: number }> = [];
    for (let i = 0; ; i++) {
      const p = snap[`${GOAL_ID_PREFIX}${i}`];
      if (!p) break;
      out.push({ x: p.x, y: p.y });
    }
    return out;
  } finally {
    probe.dispose();
  }
}

describe('physicsProbe — setup.size 가 골대까지 간다 (계기 검정)', () => {
  it('대조군: 세 크기의 골포스트 좌표가 애초에 서로 다르다', () => {
    const keys = COURT_SIZES.map((s) => courtDefFor('full', s).goalPosts.map((p) => `${p.x},${p.y}`).join('|'));
    expect(new Set(keys).size).toBe(3);
  });

  it.each(COURT_SIZES)('%s — 프로브의 골대가 그 크기의 자리에 선다', (size) => {
    const got = postsFrom(size);
    const want = courtDefFor('full', size).goalPosts;
    expect(got).toHaveLength(want.length);
    for (let i = 0; i < want.length; i++) {
      expect(got[i]!.x, `gp_${i}.x`).toBeCloseTo(want[i]!.x, 6);
      expect(got[i]!.y, `gp_${i}.y`).toBeCloseTo(want[i]!.y, 6);
    }
  });

  it('25×14 의 골대가 **30×18 자리에 서 있지 않다** — 이 결함의 구체적 모습', () => {
    // 배선이 끊기면 gp_2 는 (787.5, 187.5) 에 선다 — 30×18 의 자리 그대로다. 프레임을 흘리면
    // 벽(vbW 700)에 밀려 (695, 187.5) 로 클램프된다. 위 it.each 로도 잡히지만, **무엇이 어떻게 틀렸는지**를
    // 다음 사람이 실패 메시지 하나로 알 수 있게 그 좌표를 이름으로 박아 둔다.
    const gp2 = postsFrom('25x14')[2]!;
    expect(gp2).toEqual({ x: 662.5, y: 137.5 });
    expect(gp2.y).not.toBe(courtDefFor('full', '30x18').goalPosts[2]!.y);
  });

  it('size 를 생략하면 30×18 이다 — 기존 호출자 전부의 동작이 안 바뀐다', () => {
    expect(postsFrom(undefined)).toEqual(courtDefFor('full', '30x18').goalPosts);
  });
});
