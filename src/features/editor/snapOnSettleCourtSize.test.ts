// §6.4 — **정착 스냅의 앵커 캐시가 코트 크기를 구분하는가.**
//
// snapOnSettle.test.ts 와 따로 있는 이유는 gridCourtSize.test.ts 와 같다: `anchorCache` 는 모듈
// 레벨이라 **먼저 무엇을 요청했는가**가 결과를 바꾸는데, 기존 파일은 맨 위에서 이미 풀 코트를
// 한 번 데운다. 데운 순서를 통제하려면 `vi.resetModules()` 로 모듈째 새로 들여와야 한다.
//
// ⚠️ 이 파일이 잡는 결함(2026-08-13 이전 실재): 캐시 키가 `CourtMode` 뿐이라 30×18 판을 한 번
//    만진 뒤 25×14 를 열면 스냅 앵커가 **첫 코트 것**으로 굳었다. 스냅은 발 마우스·입 젓가락
//    사용자에게 정밀 조준을 면제해 주는 유일한 장치인데(snapOnSettle.ts 머리말), 그 오답은
//    "대충 놓으면 엉뚱한 자리로 빨려 들어간다" 라 **기능이 없는 것보다 나쁘다**.
import { describe, expect, it, vi } from 'vitest';
import { courtDefFor, COURT_SIZES, type CourtSize } from '../../model/court.ts';
import type { SnapContext, SnapResult } from './snapOnSettle.ts';
import type { Vec2 } from '../../core/units.ts';

type SnapFn = (p: Vec2, ctx: SnapContext) => SnapResult;

/** 앵커 캐시가 **비어 있는** snapOnSettle 을 새로 들여온다. */
async function freshSnap(): Promise<SnapFn> {
  vi.resetModules();
  return (await import('./snapOnSettle.ts')).snapOnSettle as SnapFn;
}

/** 배율 1 = 월드 1px 이 화면 1px. 문턱이 그대로 6 월드 px 이라 산수가 눈에 보인다. */
const base = { pxPerUnit: 1, neighbors: [] as Vec2[], slots: [] as Vec2[] };

/** 그 크기의 **왼쪽 위 골포스트**. 좌표는 리터럴이 아니라 court.ts 에서 뽑는다(규칙 10). */
function leftTopPost(size: CourtSize): Vec2 {
  return courtDefFor('full', size).goalPosts[0]!;
}
/** 그 포스트에서 대각 2.5 px(빗변 2.5 < 6) 벗어난 지점 — 문턱 안이다. */
function nearPost(p: Vec2): Vec2 {
  return { x: p.x + 2, y: p.y - 1.5 };
}

describe('§6.4 snapOnSettle — 앵커가 그 판의 코트 크기에서 나온다', () => {
  it('대조군: 세 크기의 왼쪽 골포스트가 애초에 서로 다른 자리다', () => {
    const ys = COURT_SIZES.map((s) => leftTopPost(s).y);
    expect(new Set(ys).size).toBe(3);
  });

  it.each(COURT_SIZES)('%s — 골포스트에 붙는다 (캐시가 빈 상태에서 처음 요청)', async (size) => {
    const snapOnSettle = await freshSnap();
    const post = leftTopPost(size);
    const out = snapOnSettle(nearPost(post), { ...base, mode: 'full', size });
    expect(out.target).toBe('spot');
    expect([out.x, out.y]).toEqual([post.x, post.y]);
  });

  it('30×18 로 데운 캐시가 25×14 의 스냅을 오염시키지 않는다', async () => {
    const snapOnSettle = await freshSnap();
    const big = leftTopPost('30x18');
    // ① 캐시를 30×18 로 데운다. 이 호출 자체는 옳아야 한다(대조군).
    const warm = snapOnSettle(nearPost(big), { ...base, mode: 'full', size: '30x18' });
    expect([warm.target, warm.x, warm.y]).toEqual(['spot', big.x, big.y]);

    // ② 같은 모듈에서 25×14 를 묻는다.
    const small = leftTopPost('25x14');
    const out = snapOnSettle(nearPost(small), { ...base, mode: 'full', size: '25x14' });
    expect(out.target).toBe('spot');
    expect([out.x, out.y]).toEqual([small.x, small.y]);

    // ③ **대조군**: 같은 좌표를 30×18 로 물으면 골포스트가 아니다(= 위 단언이 우연이 아니다).
    //    거기서는 x=37.5 경기면 왼쪽 변만 걸려 'line' 이고 y 는 손대지 않는다.
    const wrong = snapOnSettle(nearPost(small), { ...base, mode: 'full', size: '30x18' });
    expect(wrong.target).not.toBe('spot');
    expect(wrong.y).toBe(nearPost(small).y);
  });

  it('반대 순서도 같다 — 25×14 로 데운 뒤 30×18 을 묻는다', async () => {
    const snapOnSettle = await freshSnap();
    const small = leftTopPost('25x14');
    const warm = snapOnSettle(nearPost(small), { ...base, mode: 'full', size: '25x14' });
    expect([warm.target, warm.x, warm.y]).toEqual(['spot', small.x, small.y]);

    const big = leftTopPost('30x18');
    const out = snapOnSettle(nearPost(big), { ...base, mode: 'full', size: '30x18' });
    expect(out.target).toBe('spot');
    expect([out.x, out.y]).toEqual([big.x, big.y]);

    const wrong = snapOnSettle(nearPost(big), { ...base, mode: 'full', size: '25x14' });
    expect(wrong.target).not.toBe('spot');
  });

  it('격자 교차점도 크기를 따라간다 — 앵커의 절반은 gridGeom 에서 온다', async () => {
    const snapOnSettle = await freshSnap();
    snapOnSettle({ x: 400, y: 260 }, { ...base, mode: 'full', size: '30x18' }); // 데우기
    const { cellW, cellH, origin } = courtDefFor('full', '28x15').grid;
    const cross = { x: origin.x + cellW * 2, y: origin.y + cellH * 2 };
    const out = snapOnSettle({ x: cross.x + 2, y: cross.y - 2 }, { ...base, mode: 'full', size: '28x15' });
    expect(out.target).toBe('grid');
    expect(out.x).toBeCloseTo(cross.x, 6);
    expect(out.y).toBeCloseTo(cross.y, 6);
  });

  it('size 를 생략하면 30×18 이다 — 크기를 모르는 옛 호출부가 그대로 돈다', async () => {
    const snapOnSettle = await freshSnap();
    const big = leftTopPost('30x18');
    const out = snapOnSettle(nearPost(big), { ...base, mode: 'full' });
    expect([out.target, out.x, out.y]).toEqual(['spot', big.x, big.y]);
  });

  it('대조군: half 는 크기를 따라가지 않는다 — 두 크기가 같은 답을 준다', async () => {
    const snapOnSettle = await freshSnap();
    const post = courtDefFor('half').goalPosts[0]!;
    const a = snapOnSettle(nearPost(post), { ...base, mode: 'half', size: '30x18' });
    const b = snapOnSettle(nearPost(post), { ...base, mode: 'half', size: '25x14' });
    expect([a.target, a.x, a.y]).toEqual(['spot', post.x, post.y]);
    expect([b.target, b.x, b.y]).toEqual([a.target, a.x, a.y]);
  });
});
