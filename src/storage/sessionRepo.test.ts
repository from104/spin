// §10.6 sessionRepo. §4.5 — putSession 이 유일한 쓰기 경로이고 drillIds 를 무조건 재계산한다.
import { describe, it, expect } from 'vitest';
import { createSession, putSession, addDrillToSession, reorderSessionItems, listSessions, getSession, deleteSession, upcomingSession } from './sessionRepo.ts';
import { idbDrillRepo } from './drillRepo.ts';
import { newId } from '../core/ids.ts';
import type { TrainingSession, SessionItem } from '../model/session.ts';

async function makeDrill(title: string) {
  return idbDrillRepo.createDrill({ courtMode: 'full', title });
}

describe('putSession', () => {
  it('drillIds 를 items 에서 무조건 재계산한다 — 파일에서 온 값(잘못된/빈 값)을 신뢰하지 않는다', async () => {
    const d1 = await makeDrill('세션용 드릴1');
    const d2 = await makeDrill('세션용 드릴2');
    const item1: SessionItem = { id: newId('it'), drillId: d1.id, titleCache: d1.title, durationMinCache: d1.durationMin, categoryCache: d1.drillType };
    const item2: SessionItem = { id: newId('it'), drillId: d2.id, titleCache: d2.title, durationMinCache: d2.durationMin, categoryCache: d2.drillType };
    const raw: TrainingSession = {
      schemaVersion: 1,
      id: newId('se'),
      title: '파일에서 온 세션',
      items: [item1, item2],
      drillIds: [], // 파일이 거짓 정보를 담고 있어도
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const saved = await putSession(raw);
    expect(saved.drillIds.sort()).toEqual([d1.id, d2.id].sort());
  });

  it('중복 drillId 는 refDrillIds 로 중복 제거된다', async () => {
    const d = await makeDrill('중복 세션용');
    const item1: SessionItem = { id: newId('it'), drillId: d.id, titleCache: d.title, durationMinCache: d.durationMin, categoryCache: d.drillType };
    const item2: SessionItem = { id: newId('it'), drillId: d.id, titleCache: d.title, durationMinCache: d.durationMin, categoryCache: d.drillType };
    const s = await createSession({ title: '중복' });
    const saved = await putSession({ ...s, items: [item1, item2] });
    expect(saved.drillIds).toEqual([d.id]);
  });
});

describe('createSession / addDrillToSession / reorderSessionItems', () => {
  it('addDrillToSession 이 요약에서 캐시를 채운다', async () => {
    const d = await makeDrill('추가용 드릴');
    const s = await createSession({ title: '빈 세션' });
    const updated = await addDrillToSession(s.id, d.id);
    expect(updated.items).toHaveLength(1);
    expect(updated.items[0]!.titleCache).toBe(d.title);
    expect(updated.drillIds).toEqual([d.id]);
  });

  it('reorderSessionItems 가 순서를 바꾸고 drillIds 순서도 따라간다', async () => {
    const d1 = await makeDrill('순서1');
    const d2 = await makeDrill('순서2');
    let s = await createSession({ title: '순서 세션' });
    s = await addDrillToSession(s.id, d1.id);
    s = await addDrillToSession(s.id, d2.id);
    const reordered = await reorderSessionItems(s.id, 0, 1);
    expect(reordered.items.map((i) => i.drillId)).toEqual([d2.id, d1.id]);
    expect(reordered.drillIds).toEqual([d2.id, d1.id]);
  });
});

describe('resolveSession / listSessions / getSession', () => {
  it('드릴이 삭제돼도 세션은 저장되지 않고 로드 시 missing 이 파생된다', async () => {
    const d = await makeDrill('사라질 드릴');
    let s = await createSession({ title: '유령 참조' });
    s = await addDrillToSession(s.id, d.id);
    await idbDrillRepo.deleteDrill(d.id);

    const resolved = await getSession(s.id);
    expect(resolved?.missingCount).toBe(1);
    expect(resolved?.items[0]?.missing).toBe(true);

    // 같은 id 로 다시 만들면(=가져오기 복구) missing 이 풀린다 — 파일 저장 없이 파생이므로 가능.
    const restoredId = d.id;
    const restored = await idbDrillRepo.putDrill({ ...d, id: restoredId }, { touch: false });
    const resolvedAgain = await getSession(s.id);
    expect(resolvedAgain?.items[0]?.missing).toBe(false);
    void restored;
  });

  it('목록과 상세의 총 시간이 일치한다(ResolvedSession 에서만 계산)', async () => {
    const d = await makeDrill('시간 검증');
    let s = await createSession({ title: '시간 세션' });
    s = await addDrillToSession(s.id, d.id);

    const list = await listSessions();
    const inList = list.find((r) => r.session.id === s.id);
    const detail = await getSession(s.id);
    expect(inList?.totalMin).toBe(detail?.totalMin);
  });
});

describe('deleteSession', () => {
  it('삭제 후 조회되지 않는다', async () => {
    const s = await createSession({ title: '삭제될 세션' });
    await deleteSession(s.id);
    expect(await getSession(s.id)).toBeUndefined();
  });
});

describe('upcomingSession', () => {
  it('미래 일정 중 가장 가까운 세션을 고른다', async () => {
    // 이 describe 만 scheduledAt 을 쓰므로(다른 테스트는 미지정) 결정적으로 검증할 수 있다.
    const now = Date.now();
    await createSession({ title: '먼 미래', scheduledAt: now + 100000 });
    const near = await createSession({ title: '가까운 미래', scheduledAt: now + 1000 });
    const upcoming = await upcomingSession();
    expect(upcoming?.session.id).toBe(near.id);
  });

  it('과거 일정은 후보에서 제외된다', async () => {
    const now = Date.now();
    const past = await createSession({ title: '이미 지남', scheduledAt: now - 1000 });
    const upcoming = await upcomingSession();
    expect(upcoming?.session.id).not.toBe(past.id);
  });
});
