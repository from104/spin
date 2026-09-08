// 팀 저장소 — CAS 충돌 · 삭제 톰스톤 · 복제의 id 재발급이 저장을 왕복해도 살아 있는지.
//
// **이 파일을 지우면 새는 실기 버그**: ① 동기화 패스 중에 사용자가 고친 팀을 원격 값이 조용히
// 덮는 것(CAS) ② 삭제와 톰스톤이 따로 가서 다음 pull 이 지운 팀을 되살리는 것 ③ 손상 레코드
// 하나가 목록 전체를 못 읽게 만드는 것.
import { beforeEach, describe, expect, it } from 'vitest';
import { getDB } from './db.ts';
import { createTeam, deleteTeam, duplicateTeam, getTeam, listTeams, putTeam, restoreTeam } from './teamRepo.ts';
import { tombstoneKey } from './syncMeta.ts';
import { addPlayer } from '../model/team.ts';
import { StorageError } from './errors.ts';

beforeEach(async () => {
  const db = await getDB();
  await Promise.all([db.clear('teams'), db.clear('meta')]);
});

describe('teamRepo — 왕복', () => {
  it('만든 팀이 그대로 살아 돌아오고 목록은 최신 수정 순이다', async () => {
    const a = await createTeam({ name: '가팀' });
    const b = await createTeam({ name: '나팀' });
    expect((await getTeam(a.id))?.name).toBe('가팀');
    // b 를 나중에 고쳤으니 b 가 앞이다.
    const touched = await putTeam(addPlayer(b, '김선수', 'PF1'));
    const list = await listTeams();
    expect(list.map((t) => t.id)).toEqual([touched.id, a.id]);
    expect(list[0]!.players.map((p) => p.name)).toEqual(['김선수']);
  });

  it('손상 레코드는 건너뛸 뿐 목록 전체를 죽이지 않는다 — 저장본도 지우지 않는다', async () => {
    const good = await createTeam({ name: '멀쩡' });
    const db = await getDB();
    // 스키마가 미래인 문서 = validateTeam 이 거절하는 문서.
    await db.put('teams', { id: 'tm_broken', schemaVersion: 99, name: 'x', updatedAt: 1 } as never);
    expect((await listTeams()).map((t) => t.id)).toEqual([good.id]);
    expect(await db.get('teams', 'tm_broken' as never)).toBeDefined();
  });
});

describe('teamRepo — CAS(expectedUpdatedAt)', () => {
  it('기대한 시각과 다르면 E_CONFLICT 로 거절하고 저장본을 건드리지 않는다', async () => {
    const t = await createTeam({ name: '팀' });
    const stale = t.updatedAt;
    // 시각을 명시로 벌린다 — 같은 ms 안에 두 번 저장하면 Date.now() 가 같은 값을 준다
    // (실기에서는 사람이 두 번 고치는 사이가 1ms 보다 길지만, 테스트는 그 틈이 없다).
    await putTeam({ ...addPlayer(t, '먼저 쓴 사람'), updatedAt: stale + 1000 }, { touch: false });

    // 동기화 패스가 stale 을 기대하고 밀어 넣으려 한다 — 그 사이 사용자가 고쳤다.
    const err = await putTeam(addPlayer(t, '나중에 온 원격'), { expectedUpdatedAt: stale }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(StorageError);
    expect((err as StorageError).code).toBe('E_CONFLICT');
    expect((await getTeam(t.id))?.players.map((p) => p.name)).toEqual(['먼저 쓴 사람']);
  });

  it('기대한 시각이 맞으면 통과하고, touch:false 는 시각을 보존한다', async () => {
    const t = await createTeam({ name: '팀' });
    const next = { ...addPlayer(t, '가'), updatedAt: 12345 };
    const saved = await putTeam(next, { expectedUpdatedAt: t.updatedAt, touch: false });
    expect(saved.updatedAt).toBe(12345); // 원격 시각 보존 — 안 그러면 받은 것을 다시 올린다
  });
});

describe('teamRepo — 삭제·복구', () => {
  it('삭제는 톰스톤을 같은 트랜잭션에 남기고, 복구는 그 톰스톤을 걷는다', async () => {
    const t = await createTeam({ name: '팀' });
    const db = await getDB();
    await deleteTeam(t.id);
    expect(await getTeam(t.id)).toBeUndefined();
    expect((await db.get('meta', tombstoneKey('team', t.id)))?.value).toEqual({ deletedAt: expect.any(Number) });

    await restoreTeam(t);
    expect((await getTeam(t.id))?.name).toBe('팀');
    // 톰스톤이 남아 있으면 되살린 팀을 다음 동기화가 다시 지운다.
    expect(await db.get('meta', tombstoneKey('team', t.id))).toBeUndefined();
  });
});

describe('teamRepo — 복제', () => {
  it('복제본은 저장을 왕복해도 원본과 선수 id 를 공유하지 않는다', async () => {
    let t = await createTeam({ name: '원본' });
    t = await putTeam(addPlayer(addPlayer(t, '가', 'PF1'), '나', 'PF2'));
    const copy = await duplicateTeam(t.id, { name: '사본' });

    const saved = await getTeam(copy.id);
    expect(saved?.name).toBe('사본');
    expect(saved?.players.map((p) => p.name)).toEqual(['가', '나']);
    const originalIds = new Set((await getTeam(t.id))!.players.map((p) => p.id));
    for (const p of saved!.players) expect(originalIds.has(p.id)).toBe(false);
    expect((await listTeams()).length).toBe(2); // 원본은 그대로 남는다
  });
});
