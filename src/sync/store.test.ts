// 0.6 커밋 6 — createIdbSyncStore(실물 배선, fake-indexeddb). 여기서 못박는 것:
// ① 로컬 문서 목록의 구성(드릴 요약·세션·명단 — 명단은 저장된 적 있을 때만)
// ② pull 관문(migrate+validate, id 불일치 거절, CAS conflict) ③ deleteLocalForSync 가
// 원격 deletedAt 을 그대로 물려받고 행을 정리함 ④ push 원본이 날것 그대로임.
import { describe, expect, it } from 'vitest';
import { createIdbSyncStore } from './store.ts';
import { idbDrillRepo } from '../storage/drillRepo.ts';
import { createSession, getSession } from '../storage/sessionRepo.ts';
import { saveRoster } from '../storage/rosterRepo.ts';
import { emptyRoster, addPlayer } from '../model/roster.ts';
import { listTombstones } from '../storage/syncMeta.ts';
import type { Drill } from '../model/drill.ts';

const store = createIdbSyncStore();

describe('listLocalDocs', () => {
  it('드릴·세션은 시각과 함께 나오고, 명단은 저장된 적이 있을 때만 나온다', async () => {
    const before = await store.listLocalDocs();
    // 이 파일의 다른 테스트와 공유 DB 라 "roster 가 없다" 는 이 시점(첫 실행)에만 참이다.
    expect(before.some((d) => d.type === 'roster')).toBe(false);

    const d = await idbDrillRepo.createDrill({ courtMode: 'full', title: '목록 드릴' });
    const s = await createSession({ title: '목록 세션' });
    const r = await saveRoster(addPlayer(emptyRoster(), '선수1'));
    const docs = await store.listLocalDocs();
    expect(docs).toContainEqual({ type: 'drill', id: d.id, updatedAt: d.updatedAt });
    expect(docs).toContainEqual({ type: 'session', id: s.id, updatedAt: s.updatedAt });
    expect(docs).toContainEqual({ type: 'roster', id: 'roster', updatedAt: r.updatedAt });
  });
});

describe('applyPull — 관문', () => {
  it('유효한 드릴 원형은 touch:false 로 쓰여 원격 시각이 보존된다', async () => {
    const base = await idbDrillRepo.createDrill({ courtMode: 'full', title: '풀 대상' });
    const incoming: Drill = { ...structuredClone(base), title: '원격 개정판', updatedAt: base.updatedAt + 1000 };
    const res = await store.applyPull('drill', base.id, incoming, { expectedLocalUpdatedAt: base.updatedAt });
    expect(res).toBe('ok');
    const after = await idbDrillRepo.getDrill(base.id);
    expect(after?.title).toBe('원격 개정판');
    expect(after?.updatedAt).toBe(base.updatedAt + 1000); // 에코 루프 방지의 전제
  });

  it('CAS 가 어긋나면 conflict — 로컬을 덮지 않는다', async () => {
    const base = await idbDrillRepo.createDrill({ courtMode: 'full', title: 'CAS 대상' });
    const incoming: Drill = { ...structuredClone(base), title: '늦게 온 원격판', updatedAt: base.updatedAt + 1000 };
    const res = await store.applyPull('drill', base.id, incoming, { expectedLocalUpdatedAt: base.updatedAt - 1 });
    expect(res).toBe('conflict');
    expect((await idbDrillRepo.getDrill(base.id))?.title).toBe('CAS 대상');
  });

  it('손상 문서는 invalid, 컨테이너 id 와 문서 id 불일치도 invalid', async () => {
    const base = await idbDrillRepo.createDrill({ courtMode: 'full', title: '불일치 대상' });
    expect(await store.applyPull('drill', base.id, { garbage: true }, {})).toBe('invalid');
    const other: Drill = { ...structuredClone(base) }; // id 는 base 것인데 다른 id 로 주장
    expect(await store.applyPull('drill', 'dr_someone_else', other, {})).toBe('invalid');
  });

  it('더 새 스키마의 문서는 too-new — 절대 다운그레이드해 쓰지 않는다', async () => {
    const base = await idbDrillRepo.createDrill({ courtMode: 'full', title: 'too-new 대상' });
    const future = { ...structuredClone(base), schemaVersion: 99 };
    expect(await store.applyPull('drill', base.id, future, {})).toBe('too-new');
    expect((await idbDrillRepo.getDrill(base.id))?.title).toBe('too-new 대상');
  });
});

describe('deleteLocalForSync — 원격 삭제의 로컬 반영', () => {
  it('문서를 지우고 톰스톤을 원격 deletedAt 로 맞추며 행을 정리한다', async () => {
    const d = await idbDrillRepo.createDrill({ courtMode: 'full', title: '원격에서 지워진 드릴' });
    await store.markSynced('drill', d.id, { lastSyncedAt: d.updatedAt, remoteFileId: 'f1' });
    const remoteDeletedAt = d.updatedAt + 5000;
    await store.deleteLocalForSync('drill', d.id, remoteDeletedAt);
    expect(await idbDrillRepo.getDrill(d.id)).toBeUndefined();
    const tomb = (await listTombstones()).find((t) => t.id === d.id);
    expect(tomb?.deletedAt).toBe(remoteDeletedAt); // Date.now() 가 아니다 — 에코 push 방지
    expect((await store.listSyncRows()).some((r) => r.id === d.id)).toBe(false);
  });

  it('세션도 같은 계약이다', async () => {
    const s = await createSession({ title: '원격에서 지워진 세션' });
    await store.deleteLocalForSync('session', s.id, 12345);
    expect(await getSession(s.id)).toBeUndefined();
    expect((await listTombstones()).find((t) => t.id === s.id)?.deletedAt).toBe(12345);
  });
});

describe('readDocForPush', () => {
  it('저장된 원형을 날것 그대로 돌려준다(백업과 같은 규율 — 관문은 받는 쪽에)', async () => {
    const d = await idbDrillRepo.createDrill({ courtMode: 'full', title: '푸시 원본' });
    const raw = (await store.readDocForPush('drill', d.id)) as Drill;
    expect(raw.id).toBe(d.id);
    expect(raw.title).toBe('푸시 원본');
    expect(await store.readDocForPush('drill', 'dr_missing')).toBeUndefined();
  });
});
