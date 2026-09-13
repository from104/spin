// 목록 다중 삭제의 저장소 계약(2026-09-14 기현님 지시 *"드릴, 세션 목록에서 선택해서 지우는 동작"*).
//
// 지우면 새는 것 셋:
// ① **한 트랜잭션**이 아니면 «절반만 지워진» 상태가 남고, 그 상태를 사람에게 설명할 길이 없다.
// ② 톰스톤이 빠지면 지운 것이 다른 기기에서 되살아난다(단건 삭제가 같은 이유로 tx 를 묶는다).
// ③ 되살리기가 `updatedAt` 을 안 밀면 **원격** 톰스톤이 이겨 다음 동기화가 다시 지운다 —
//    [되돌리기]를 누른 사람에게 거짓말이 된다. 이 창은 실제로 열린다(동기화 3초 < 토스트 8초).
import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { idbDrillRepo } from './drillRepo.ts';
import { getDB } from './db.ts';
import { tombstoneKey } from './syncMeta.ts';
import type { CreateDrillInit } from './drillRepo.ts';

const init: CreateDrillInit = { title: '드릴', courtMode: 'full', formation: '1-2-1' };

beforeEach(async () => {
  const db = await getDB();
  for (const store of ['drills', 'drillSummaries', 'meta'] as const) await db.clear(store);
});

describe('deleteDrills / restoreDrills', () => {
  it('셋을 한 번에 지우고 톰스톤 셋을 남긴다 — 삭제와 «지웠다는 기록» 이 따로 가면 안 된다', async () => {
    const ds = [await idbDrillRepo.createDrill(init), await idbDrillRepo.createDrill(init), await idbDrillRepo.createDrill(init)];
    await idbDrillRepo.deleteDrills(ds.map((d) => d.id));

    const db = await getDB();
    expect(await db.count('drills')).toBe(0);
    expect(await db.count('drillSummaries')).toBe(0);
    for (const d of ds) expect(await db.get('meta', tombstoneKey('drill', d.id)), d.id).toBeTruthy();
  });

  it('톰스톤의 `deletedAt` 을 묶음이 **공유**한다 — 되살릴 때 한 덩어리로 판단되게', async () => {
    const ds = [await idbDrillRepo.createDrill(init), await idbDrillRepo.createDrill(init)];
    await idbDrillRepo.deleteDrills(ds.map((d) => d.id));
    const db = await getDB();
    const stamps = await Promise.all(ds.map(async (d) => (await db.get('meta', tombstoneKey('drill', d.id)))?.value as { deletedAt: number }));
    expect(stamps[0]!.deletedAt).toBe(stamps[1]!.deletedAt);
  });

  it('되살리면 톰스톤이 사라지고 `updatedAt` 이 **삭제 시각보다 뒤**다 — 아니면 동기화가 다시 지운다', async () => {
    const ds = [await idbDrillRepo.createDrill(init), await idbDrillRepo.createDrill(init)];
    await idbDrillRepo.deleteDrills(ds.map((d) => d.id));
    const db = await getDB();
    const tomb = (await db.get('meta', tombstoneKey('drill', ds[0]!.id)))?.value as { deletedAt: number };

    const back = await idbDrillRepo.restoreDrills(ds);
    expect(back).toHaveLength(2);
    expect(await db.count('drills')).toBe(2);
    for (const d of ds) expect(await db.get('meta', tombstoneKey('drill', d.id)), d.id).toBeUndefined();
    for (const d of back) expect(d.updatedAt, '삭제 시각보다 뒤여야 원격 톰스톤을 이긴다').toBeGreaterThanOrEqual(tomb.deletedAt);
    // 요약도 함께 돌아온다 — 목록이 본문과 어긋나면 «되돌렸는데 안 보인다» 가 된다.
    expect(await db.count('drillSummaries')).toBe(2);
  });

  it('빈 배열은 아무 일도 안 한다 — 0개 선택에서 부르는 일이 실제로 생긴다', async () => {
    const d = await idbDrillRepo.createDrill(init);
    await idbDrillRepo.deleteDrills([]);
    expect(await idbDrillRepo.getDrill(d.id)).toBeTruthy();
    await expect(idbDrillRepo.restoreDrills([])).resolves.toEqual([]);
  });
});
