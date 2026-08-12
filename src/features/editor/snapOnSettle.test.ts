// §4.3 P1-3 정착 스냅 — 후보 5종이 각각 실제로 잡히는가, 그리고 문턱이 **화면 기준**인가.
//
// 좌표는 전부 풀 코트(COURT_DEFS.full)에서 나온 것이고, 기대값도 리터럴이 아니라 같은 출처에서
// 뽑아 쓴다 — 마진이 다시 바뀌면 이 테스트가 함께 따라가야 하지 옛 좌표를 붙들면 안 된다.
import { describe, expect, it } from 'vitest';
import { snapOnSettle } from './snapOnSettle.ts';
import { INTERACT } from '../../core/constants.ts';
import { COURT_DEFS } from '../../model/court.ts';
import { gridGeom } from '../../model/grid.ts';
import { formationSlots } from '../../model/defaults.ts';

const FULL = COURT_DEFS.full;
const GRID = gridGeom('full');

/** 배율 1 = 월드 1px 이 화면 1px. 문턱이 그대로 6 월드 px 이 되어 산수가 읽힌다. */
const base = { mode: 'full' as const, pxPerUnit: 1, neighbors: [], slots: [] };

describe('snapOnSettle — 후보 5종', () => {
  it('① 격자 교차점에 붙는다', () => {
    // vx=287.5 / hy=307.5 교차점에서 대각으로 2.5px 씩 벗어난 지점(빗변 3.54 < 6).
    const gx = GRID.vx[2]!;
    const gy = GRID.hy[3]!;
    const out = snapOnSettle({ x: gx + 2.5, y: gy - 2.5 }, base);
    expect(out.target).toBe('grid');
    expect([out.x, out.y]).toEqual([gx, gy]);
  });

  it('② 코트 라인·골 지역 경계에 붙는다 — 걸린 축만 움직인다', () => {
    // 골 지역(ruleZone) 아래 경계 y=362.5. x 쪽에는 6px 안에 아무것도 없다.
    const zoneBottom = FULL.ruleZones[0]!.y + FULL.ruleZones[0]!.h;
    const out = snapOnSettle({ x: 500, y: zoneBottom - 2.5 }, base);
    expect(out.target).toBe('line');
    expect(out.y).toBe(zoneBottom);
    expect(out.x).toBe(500); // 세로선은 문턱 밖 — x 는 손대지 않는다
  });

  it('③ 이웃 칩의 축에 정렬된다', () => {
    // 이웃은 y 가 한참 떨어져 있어도 **x 축 정렬**만은 걸린다(그게 축 정렬의 쓸모다).
    const out = snapOnSettle({ x: 500, y: 250 }, { ...base, neighbors: [{ x: 503, y: 100 }] });
    expect(out.target).toBe('align');
    expect([out.x, out.y]).toEqual([503, 250]);
  });

  it('④ 기본 포메이션 슬롯에 붙는다', () => {
    const slots = formationSlots('full', '1-2-1');
    const slot = slots.find((s) => s.x === 364.5 && s.y === 262.5)!;
    const out = snapOnSettle({ x: slot.x + 1.5, y: slot.y + 1.5 }, { ...base, slots });
    expect(out.target).toBe('slot');
    expect([out.x, out.y]).toEqual([slot.x, slot.y]);
  });

  it('⑤ 세트피스 지점(골 십자)에 붙는다', () => {
    const spot = FULL.spotMarks[0]!; // 왼쪽 골 십자
    const out = snapOnSettle({ x: spot.x + 2, y: spot.y - 1.5 }, base);
    expect(out.target).toBe('spot');
    expect([out.x, out.y]).toEqual([spot.x, spot.y]);
  });

  it('세트피스에는 골포스트·코너컷 끝점도 들어간다 (court.ts 파생 — 리터럴 금지)', () => {
    const post = FULL.goalPosts[0]!;
    const atPost = snapOnSettle({ x: post.x + 1, y: post.y + 1 }, base);
    expect([atPost.x, atPost.y]).toEqual([post.x, post.y]);

    // 'M37.5,62.5 L62.5,37.5' 의 뒤쪽 끝점 (62.5, 37.5).
    const cut = { x: 62.5, y: 37.5 };
    const atCut = snapOnSettle({ x: cut.x - 1, y: cut.y + 1 }, base);
    expect(atCut.target).toBe('spot');
    expect([atCut.x, atCut.y]).toEqual([cut.x, cut.y]);
  });
});

describe('snapOnSettle — 문턱', () => {
  it('문턱(6 CSS px) 밖이면 좌표를 그대로 둔다', () => {
    const gx = GRID.vx[2]!;
    const gy = GRID.hy[3]!;
    const out = snapOnSettle({ x: gx + 10.5, y: gy - 2.5 }, base);
    expect(out.target).toBeNull();
    expect([out.x, out.y]).toEqual([gx + 10.5, gy - 2.5]);
  });

  it('문턱은 **화면 기준**이다 — 확대하면 같은 월드 거리가 문턱 밖이 된다', () => {
    // 배율 1 에서는 붙던 3.54 월드 px 이, 배율 2 에서는 7.07 CSS px 이라 문턱(6)을 넘는다.
    const gx = GRID.vx[2]!;
    const gy = GRID.hy[3]!;
    const p = { x: gx + 2.5, y: gy - 2.5 };
    expect(snapOnSettle(p, base).target).toBe('grid');
    expect(snapOnSettle(p, { ...base, pxPerUnit: 2 }).target).toBeNull();
    expect(INTERACT.settleSnapCssPx).toBe(6);
  });

  it('배율이 0 이면(레이아웃 전) 스냅하지 않는다 — 문턱이 무한대가 되면 판이 한 점으로 빨린다', () => {
    const out = snapOnSettle({ x: 500, y: 250 }, { ...base, pxPerUnit: 0 });
    expect(out.target).toBeNull();
    expect([out.x, out.y]).toEqual([500, 250]);
  });

  it('점 후보는 축 후보를 이긴다 — 격자 교차점이 자기 격자선에 지면 ①이 죽은 규칙이 된다', () => {
    // 경기면 왼쪽 위 모서리는 격자 교차점이면서 코트 라인 두 개가 만나는 점이기도 하다.
    // 한 줄로 비교하면 축 거리(2.5)가 빗변(3.54)보다 늘 작아 line 이 이기고, 그러면 y 는
    // 영영 안 붙는다.
    const cx = FULL.surface.x;
    const cy = FULL.surface.y;
    const out = snapOnSettle({ x: cx + 2.5, y: cy + 2.5 }, base);
    expect(out.target).toBe('grid');
    expect([out.x, out.y]).toEqual([cx, cy]);
  });
});
