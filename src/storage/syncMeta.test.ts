// 0.6 커밋 1 — 동기화 부기(syncMeta)와 리포 이음매(톰스톤 tx·putSession 옵션·변경 방송).
// 여기서 못박는 것: ① 삭제와 톰스톤이 **같은 트랜잭션**의 결과로 함께 존재한다 ② touch:false 가
// 시각을 보존한다(에코 루프 방지의 전제) ③ CAS 가 E_CONFLICT 를 던진다 ④ 방송이 같은 탭
// 구독자에게 동기로 닿는다. 엔진(커밋 6)은 이 네 가지 위에 선다.
import { describe, it, expect } from 'vitest';
import {
  clearSyncDocRows,
  deleteSyncDocRow,
  deleteTombstone,
  ensureWriterId,
  getSyncDeviceMeta,
  getSyncDocRow,
  listSyncDocRows,
  listTombstones,
  postSyncEvent,
  putSyncDeviceMeta,
  putSyncDocRow,
  subscribeSyncEvents,
  type SyncEvent,
} from './syncMeta.ts';
import { idbDrillRepo } from './drillRepo.ts';
import { createSession, putSession, deleteSession, getSession } from './sessionRepo.ts';
import { saveRoster } from './rosterRepo.ts';
import { emptyRoster } from '../model/roster.ts';
import { StorageError } from './errors.ts';
import { newId } from '../core/ids.ts';

/** 다음 동기 액션 동안의 방송을 모은다 — dispatch 가 동기라 await 이 필요 없다. */
async function collect(run: () => Promise<unknown>): Promise<SyncEvent[]> {
  const got: SyncEvent[] = [];
  const off = subscribeSyncEvents((e) => got.push(e));
  try {
    await run();
  } finally {
    off();
  }
  return got;
}

describe('syncMeta — 문서행·톰스톤·기기행 CRUD', () => {
  it('문서행 왕복 — put/get/list/delete, 키 파싱이 type·id 를 되돌린다', async () => {
    const id = newId('dr');
    await putSyncDocRow('drill', id, { lastSyncedAt: 111, remoteFileId: 'f1' });
    expect(await getSyncDocRow('drill', id)).toEqual({ lastSyncedAt: 111, remoteFileId: 'f1' });
    const rows = await listSyncDocRows();
    expect(rows.find((r) => r.id === id)).toEqual({ type: 'drill', id, row: { lastSyncedAt: 111, remoteFileId: 'f1' } });
    await deleteSyncDocRow('drill', id);
    expect(await getSyncDocRow('drill', id)).toBeUndefined();
  });

  it('clearSyncDocRows 는 문서행만 지운다 — 톰스톤은 남는다(계정 교체 시 삭제 사실은 여전히 참)', async () => {
    const dr = newId('dr');
    const se = newId('se');
    await putSyncDocRow('drill', dr, { lastSyncedAt: 1 });
    await putSyncDocRow('session', se, { lastSyncedAt: 2 });
    // 톰스톤을 실제 삭제 경로로 만든다(직접 put 헬퍼는 노출하지 않는다 — 리포 tx 가 유일한 생산자).
    const d = await idbDrillRepo.createDrill({ courtMode: 'full', title: '지울 드릴' });
    await idbDrillRepo.deleteDrill(d.id);
    await clearSyncDocRows();
    expect(await listSyncDocRows()).toEqual([]);
    expect((await listTombstones()).some((t) => t.type === 'drill' && t.id === d.id)).toBe(true);
    await deleteTombstone('drill', d.id); // 뒷정리 겸 삭제 API 검증
    expect((await listTombstones()).some((t) => t.id === d.id)).toBe(false);
  });

  it('ensureWriterId 는 한 번 만들면 그대로다 — 재호출·직접 조회가 같은 값', async () => {
    const w1 = await ensureWriterId();
    const w2 = await ensureWriterId();
    expect(w2).toBe(w1);
    expect((await getSyncDeviceMeta())?.writerId).toBe(w1);
    // accountEmail 을 얹어도 writerId 는 유지된다
    await putSyncDeviceMeta({ writerId: w1, accountEmail: 'coach@example.com' });
    expect(await ensureWriterId()).toBe(w1);
  });
});

describe('syncMeta — 변경 방송', () => {
  it('같은 탭 구독자에게 동기로 닿고, 해지 후에는 닿지 않으며, 구독자 예외가 발신을 깨지 않는다', () => {
    const got: SyncEvent[] = [];
    const offThrow = subscribeSyncEvents(() => {
      throw new Error('구독자 사정');
    });
    const off = subscribeSyncEvents((e) => got.push(e));
    postSyncEvent({ type: 'drill', id: 'dr_x', op: 'put', updatedAt: 5 });
    expect(got).toEqual([{ type: 'drill', id: 'dr_x', op: 'put', updatedAt: 5 }]);
    off();
    offThrow();
    postSyncEvent({ type: 'drill', id: 'dr_y', op: 'put', updatedAt: 6 });
    expect(got).toHaveLength(1);
  });
});

describe('리포 이음매 — 삭제가 톰스톤을 남기고 쓰기가 방송된다', () => {
  it('deleteDrill: 드릴·요약이 지워지고 같은 tx 의 톰스톤이 남으며 delete 가 방송된다', async () => {
    const d = await idbDrillRepo.createDrill({ courtMode: 'full', title: '삭제 전파 드릴' });
    const events = await collect(() => idbDrillRepo.deleteDrill(d.id));
    expect(await idbDrillRepo.getDrill(d.id)).toBeUndefined();
    const tomb = (await listTombstones()).find((t) => t.type === 'drill' && t.id === d.id);
    expect(tomb).toBeDefined();
    expect(events).toEqual([{ type: 'drill', id: d.id, op: 'delete', deletedAt: tomb!.deletedAt }]);
  });

  it('deleteSession: 세션이 지워지고 톰스톤·방송이 남는다', async () => {
    const s = await createSession({ title: '삭제 전파 세션' });
    const events = await collect(() => deleteSession(s.id));
    expect(await getSession(s.id)).toBeUndefined();
    const tomb = (await listTombstones()).find((t) => t.type === 'session' && t.id === s.id);
    expect(tomb).toBeDefined();
    expect(events).toEqual([{ type: 'session', id: s.id, op: 'delete', deletedAt: tomb!.deletedAt }]);
  });

  it('putDrill·saveRoster 가 put 을 방송한다', async () => {
    const events = await collect(async () => {
      const d = await idbDrillRepo.createDrill({ courtMode: 'full', title: '방송 드릴' });
      await saveRoster(emptyRoster());
      return d;
    });
    expect(events.map((e) => (e.op === 'pass' ? 'pass' : `${e.type}/${e.op}`))).toEqual(['drill/put', 'roster/put']);
  });
});

describe('putSession — touch/CAS 옵션(putDrill 과 같은 계약)', () => {
  it('기본값은 현행과 동일 — updatedAt 을 새로 찍는다', async () => {
    const s = await createSession({ title: '터치 기본' });
    const before = s.updatedAt;
    await new Promise((r) => setTimeout(r, 2)); // Date.now() 가 갈리도록
    const next = await putSession({ ...s, title: '고침' });
    expect(next.updatedAt).toBeGreaterThan(before);
  });

  it('touch:false 는 주어진 updatedAt 을 그대로 보존한다 — pull 에코 루프 방지의 전제', async () => {
    const s = await createSession({ title: '터치 보존' });
    const frozen = 1_700_000_000_000;
    const next = await putSession({ ...s, updatedAt: frozen }, { touch: false });
    expect(next.updatedAt).toBe(frozen);
    expect((await getSession(s.id))?.session.updatedAt).toBe(frozen);
  });

  it('expectedUpdatedAt 이 어긋나면 E_CONFLICT — 저장본은 그대로다', async () => {
    const s = await createSession({ title: 'CAS 세션' });
    await expect(putSession({ ...s, title: '뺏길 뻔' }, { expectedUpdatedAt: s.updatedAt - 1 })).rejects.toMatchObject({
      code: 'E_CONFLICT',
    });
    expect((await getSession(s.id))?.session.title).toBe('CAS 세션');
    // 맞으면 통과한다
    const ok = await putSession({ ...s, title: '정상 갱신' }, { expectedUpdatedAt: s.updatedAt });
    expect(ok.title).toBe('정상 갱신');
    expect(StorageError).toBeDefined(); // import 사용 고정(회귀 시 타입 검증에 걸리도록)
  });
});
