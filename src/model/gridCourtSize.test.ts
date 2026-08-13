// §6.4 — **gridGeom 의 모듈 레벨 캐시가 코트 크기를 구분하는가.**
//
// 이 파일이 따로 있는 이유: grid.test.ts 는 파일 맨 위에서 `gridGeom('full')` 을 한 번 부르므로
// 캐시가 이미 30×18 로 데워진 상태에서 시작한다. 캐시 사고는 **"먼저 무엇을 요청했는가"** 에만
// 나타나므로, 데운 순서를 통제하지 못하면 어떤 단언도 이 결함에 닿지 못한다.
// 그래서 여기서는 매 테스트마다 `vi.resetModules()` 로 **캐시가 빈 모듈**을 새로 들여온다.
//
// ⚠️ 이 파일이 잡는 결함(2026-08-13 이전 실재): 캐시 키가 `CourtMode` 뿐이라, 30×18 판을 한 번
//    그린 뒤 25×14 를 열면 격자가 **첫 코트 것**으로 굳었다(칸 폭 125 px 對 104.17 px).
//    격자는 스냅 앵커(snapOnSettle)·키보드 배치 커서·내보낸 그림까지 흘러가므로, 한 번 어긋나면
//    "칩이 엉뚱한 자리에 붙는다" 로만 겪히고 원인은 안 보인다.
import { describe, expect, it, vi } from 'vitest';
import { courtDefFor, COURT_SIZES, type CourtSize } from './court.ts';
import type { GridGeom } from './grid.ts';

type GridGeomFn = (mode: 'full' | 'half' | 'flat', size?: CourtSize) => GridGeom;

/** 캐시가 **비어 있는** gridGeom 을 새로 들여온다. 이 파일의 전제다. */
async function freshGridGeom(): Promise<GridGeomFn> {
  vi.resetModules();
  return (await import('./grid.ts')).gridGeom as GridGeomFn;
}

/** 기대값은 리터럴이 아니라 court.ts 에서 다시 계산한다(규칙 10 — 좌표 리터럴 금지). */
function expectedVx(size: CourtSize): number[] {
  const { cols, cellW, origin } = courtDefFor('full', size).grid;
  return Array.from({ length: cols + 1 }, (_, i) => origin.x + i * cellW);
}
function expectedHy(size: CourtSize): number[] {
  const { rows, cellH, origin } = courtDefFor('full', size).grid;
  return Array.from({ length: rows + 1 }, (_, j) => origin.y + j * cellH);
}

describe('§6.4 gridGeom — 세 크기가 각각 자기 격자를 갖는다', () => {
  it('대조군: 세 크기의 격자선이 애초에 서로 다르다 (같으면 아래 단언들이 전부 헛것이다)', () => {
    const sets = COURT_SIZES.map((s) => expectedVx(s).join(','));
    expect(new Set(sets).size).toBe(3);
    // 칸 **수**는 셋 다 같다 — 코치가 쓰는 말('b2 로')이 코트마다 달라지면 안 된다(court.ts 주석).
    for (const s of COURT_SIZES) expect(courtDefFor('full', s).grid.cols).toBe(6);
  });

  it.each(COURT_SIZES)('%s 를 **처음** 요청하면 그 크기의 격자가 나온다', async (size) => {
    const gridGeom = await freshGridGeom();
    const g = gridGeom('full', size);
    expect(g.vx).toEqual(expectedVx(size));
    expect(g.hy).toEqual(expectedHy(size));
  });

  it('30×18 로 데운 캐시가 25×14 요청에 새지 않는다', async () => {
    const gridGeom = await freshGridGeom();
    const warm = gridGeom('full', '30x18'); // ← 캐시를 A 로 데운다
    expect(warm.vx).toEqual(expectedVx('30x18')); // 대조군: 데우기 자체는 옳았다
    const cold = gridGeom('full', '25x14');
    expect(cold.vx).toEqual(expectedVx('25x14'));
    expect(cold.hy).toEqual(expectedHy('25x14'));
    expect(cold.vx).not.toEqual(warm.vx);
  });

  it('반대 순서도 같다 — 25×14 로 데운 뒤 30×18 을 요청한다', async () => {
    const gridGeom = await freshGridGeom();
    const warm = gridGeom('full', '25x14');
    expect(warm.vx).toEqual(expectedVx('25x14'));
    const cold = gridGeom('full', '30x18');
    expect(cold.vx).toEqual(expectedVx('30x18'));
    expect(cold.hy).toEqual(expectedHy('30x18'));
    expect(cold.vx).not.toEqual(warm.vx);
  });

  it('셋을 연달아 요청해도 각자 자기 값을 지킨다 (세 칸의 이름·중심까지)', async () => {
    const gridGeom = await freshGridGeom();
    const got = COURT_SIZES.map((s) => gridGeom('full', s));
    for (let i = 0; i < COURT_SIZES.length; i++) {
      const size = COURT_SIZES[i]!;
      const { cellW, cellH, origin } = courtDefFor('full', size).grid;
      const b2 = got[i]!.cells.find((c) => c.text === 'b2')!;
      expect(b2.x).toBeCloseTo(origin.x + cellW * 1.5, 6);
      expect(b2.y).toBeCloseTo(origin.y + cellH * 1.5, 6);
    }
    // 셋의 b2 중심이 서로 다르다 — "같은 판을 세 번 돌려받은 것" 이 아니다.
    expect(new Set(got.map((g) => g.cells.find((c) => c.text === 'b2')!.x)).size).toBe(3);
  });

  it('캐시는 여전히 산다 — 같은 (mode,size) 는 같은 객체다', async () => {
    const gridGeom = await freshGridGeom();
    expect(gridGeom('full', '28x15')).toBe(gridGeom('full', '28x15'));
  });

  it('대조군: half·flat 은 크기 3단을 따라가지 않는다 (court.ts 주석 근거 셋)', async () => {
    const gridGeom = await freshGridGeom();
    for (const mode of ['half', 'flat'] as const) {
      const a = gridGeom(mode, '30x18');
      const b = gridGeom(mode, '25x14');
      expect(b.vx).toEqual(a.vx);
      expect(b.hy).toEqual(a.hy);
    }
  });

  it('size 를 생략하면 30×18 이다 — 크기를 모르는 옛 호출부가 그대로 돈다', async () => {
    const gridGeom = await freshGridGeom();
    expect(gridGeom('full').vx).toEqual(expectedVx('30x18'));
  });

  it('깨진 크기 문자열은 캐시를 오염시키지 않고 기본으로 접힌다', async () => {
    const gridGeom = await freshGridGeom();
    const junk = gridGeom('full', 'nope' as CourtSize);
    expect(junk.vx).toEqual(expectedVx('30x18'));
    expect(junk).toBe(gridGeom('full', '30x18')); // 같은 항목을 나눠 쓴다(항목이 둘로 늘지 않는다)
  });
});
