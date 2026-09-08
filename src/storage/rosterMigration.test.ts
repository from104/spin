// 옛 단일 명단 → 팀 하나 이주 (PLAN-TEAM.md 결정 3).
//
// **이 파일을 지우면 새는 실기 버그**: ① 앱을 열 때마다 «내 팀» 이 하나씩 쌓이는 것
// ② 명단이 없는 새 기기에 빈 팀이 생기는 것 ③ 이주하며 `pl_` id 를 새로 발급해 옛 세션의
// 참가자가 통째로 «(지워진 선수)» 가 되는 것 ④ 이주가 옛 `roster` 레코드를 지워, 옛 버전
// 기기·옛 백업이 명단을 잃는 것.
import { beforeEach, describe, expect, it } from 'vitest';
import { getDB } from './db.ts';
import { loadRoster, saveRoster } from './rosterRepo.ts';
import { MIGRATED_TEAM_ID, migrateRosterToTeamOnce, ROSTER_MIGRATED_META_KEY } from './rosterMigration.ts';
import { listTeams, createTeam } from './teamRepo.ts';
import { addPlayer, emptyRoster } from '../model/roster.ts';

beforeEach(async () => {
  const db = await getDB();
  await Promise.all([db.clear('teams'), db.clear('meta')]);
});

describe('migrateRosterToTeamOnce', () => {
  it('옛 명단을 팀 하나로 옮기고 선수 id 를 그대로 지킨다', async () => {
    let r = addPlayer(emptyRoster(), '김선수', 'PF1');
    r = addPlayer(r, '이선수'); // 미분류
    const saved = await saveRoster(r);

    const out = await migrateRosterToTeamOnce({ locale: 'ko' });
    expect(out).toMatchObject({ migrated: true, reason: 'migrated' });

    const teams = await listTeams();
    expect(teams).toHaveLength(1);
    expect(teams[0]!.name).toBe('내 팀');
    // ⚠️ id 를 새로 발급하면 옛 세션의 participantIds 가 통째로 끊긴다.
    expect(teams[0]!.players.map((p) => p.id)).toEqual(saved.players.map((p) => p.id));
    expect(teams[0]!.players.map((p) => p.name)).toEqual(['김선수', '이선수']);
    expect(teams[0]!.players[0]!.klass).toBe('PF1');
    expect('klass' in teams[0]!.players[1]!).toBe(false);
  });

  // 2026-09-09(검수) — ⑤ 기기 두 대가 각자 이주해 «내 팀» 이 **두 벌** 생기고, 둘이 같은 `pl_`
  // id 를 공유하는 것. 이주는 로컬 IDB 만 보고 마운트 즉시 돌고 드라이브 첫 pull 은 그 뒤라
  // (App.tsx 의 순서), id 가 기기마다 다르면 동기화가 둘을 합칠 방법이 없다.
  it('이주 팀의 id 는 기기 무관한 고정값이다 — 두 기기가 각자 이주해도 같은 문서가 된다', async () => {
    await saveRoster(addPlayer(emptyRoster(), '김선수', 'PF1'));
    await migrateRosterToTeamOnce({ locale: 'ko' });
    expect((await listTeams())[0]!.id).toBe(MIGRATED_TEAM_ID);
  });

  it('로케일이 팀 기본 이름을 정한다', async () => {
    await saveRoster(addPlayer(emptyRoster(), 'Player', 'PF1'));
    await migrateRosterToTeamOnce({ locale: 'en' });
    expect((await listTeams())[0]!.name).toBe('My Team');
  });

  it('두 번 불러도 팀은 하나다 — 도장이 두 번째를 막는다', async () => {
    await saveRoster(addPlayer(emptyRoster(), '김선수', 'PF1'));
    await migrateRosterToTeamOnce({ locale: 'ko' });
    const again = await migrateRosterToTeamOnce({ locale: 'ko' });
    expect(again).toMatchObject({ migrated: false, reason: 'stamped' });
    expect(await listTeams()).toHaveLength(1);
  });

  it('빈 명단으로는 팀도 도장도 만들지 않는다 — 나중에 명단이 도착하면 그때 건넌다', async () => {
    const out = await migrateRosterToTeamOnce({ locale: 'ko' });
    expect(out).toMatchObject({ migrated: false, reason: 'empty-roster' });
    expect(await listTeams()).toHaveLength(0);
    const db = await getDB();
    expect(await db.get('meta', ROSTER_MIGRATED_META_KEY)).toBeUndefined();

    // 옛 기기에서 Drive 로 명단이 도착한 상황.
    await saveRoster(addPlayer(emptyRoster(), '늦게 온 선수', 'PF2'));
    expect(await migrateRosterToTeamOnce({ locale: 'ko' })).toMatchObject({ migrated: true });
  });

  it('이미 팀이 있으면 끼어들지 않는다', async () => {
    await saveRoster(addPlayer(emptyRoster(), '김선수', 'PF1'));
    await createTeam({ name: '내가 만든 팀' });
    const out = await migrateRosterToTeamOnce({ locale: 'ko' });
    expect(out).toMatchObject({ migrated: false, reason: 'teams-present' });
    expect((await listTeams()).map((t) => t.name)).toEqual(['내가 만든 팀']);
  });

  it('옛 roster 레코드를 지우지 않는다 — 읽기 전용으로 잔류한다(결정 3)', async () => {
    await saveRoster(addPlayer(emptyRoster(), '김선수', 'PF1'));
    await migrateRosterToTeamOnce({ locale: 'ko' });
    expect((await loadRoster()).players.map((p) => p.name)).toEqual(['김선수']);
  });
});
