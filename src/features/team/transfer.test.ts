// [팀] 파일 내보내기·가져오기의 회귀선(2026-09-09 · PLAN-TEAM.md 결정 13).
// 지우면 새는 실기 버그:
//  ① 팀 파일을 다시 열었는데 선수가 안 들어온다(왕복이 깨진 것을 화면에서만 알아차린다).
//  ② 같은 파일을 두 번 열면 팀이 두 벌이 된다 — 어느 쪽이 진짜인지 사용자가 못 가른다.
//  ③ 드릴 파일을 팀 화면에 넣었을 때 «지원하지 않는 형식» 이 떠, 멀쩡한 파일을 깨진 것으로 믿는다
//     (2026-08-26 실제 사고의 반대 방향).
import { describe, it, expect } from 'vitest';
import { exportOneTeam, importTeamFile } from './transfer.ts';
import { createTeam, getTeam, listTeams, putTeam } from '../../storage/teamRepo.ts';
import { addPlayer } from '../../model/team.ts';
import { exportTeamFile } from '../../storage/transfer.ts';
import { getDB } from '../../storage/db.ts';
import type { TeamId } from '../../core/ids.ts';

function fileOf(text: string, name = 'SPIN_team_x_20260909.spin.team.json'): File {
  return new File([text], name, { type: 'application/json' });
}

async function wipeTeams(): Promise<void> {
  await (await getDB()).clear('teams');
}

describe('importTeamFile', () => {
  it('내보낸 팀 파일을 다시 열면 선수까지 그대로 돌아온다', async () => {
    await wipeTeams();
    const t = await putTeam(addPlayer(await createTeam({ name: '동대문 클럽' }), '홍길동', 'PF2'));
    const text = await exportTeamFile(t).text();
    await wipeTeams();
    expect(await getTeam(t.id)).toBeUndefined(); // 대조군 — 정말 지워졌는지 먼저 본다

    expect(await importTeamFile(fileOf(text))).toEqual({ imported: 1, failed: 0, skipped: 0 });
    const back = await getTeam(t.id);
    expect(back?.name).toBe('동대문 클럽');
    expect(back?.players.map((p) => [p.name, p.klass])).toEqual([['홍길동', 'PF2']]);
  });

  it('같은 파일을 두 번 열어도 팀이 불어나지 않는다 (멱등) — 내용이 다르면 사본으로 남긴다', async () => {
    await wipeTeams();
    const t = await createTeam({ name: '멱등 팀' });
    const text = await exportTeamFile(t).text();
    await wipeTeams();

    await importTeamFile(fileOf(text));
    expect(await importTeamFile(fileOf(text))).toEqual({ imported: 0, failed: 0, skipped: 1 });
    expect(await listTeams()).toHaveLength(1);

    // 로컬에서 고친 뒤 같은 파일을 열면 «덮을까» 를 묻지 않고 사본으로 남긴다 — 되돌릴 수 있는
    // 쪽이 기본값이다. 이름이 로케일 문구로 붙는지도 여기서 본다(리포는 사전을 모른다).
    await putTeam({ ...(await getTeam(t.id))!, name: '이 기기에서 고친 이름' });
    expect(await importTeamFile(fileOf(text), 'en')).toEqual({ imported: 1, failed: 0, skipped: 0 });
    const teams = await listTeams();
    expect(teams).toHaveLength(2);
    expect(teams.map((x) => x.name).sort()).toEqual(['멱등 팀 (copy)', '이 기기에서 고친 이름']);
  });

  it('드릴 파일을 넣으면 [드릴 목록]으로, 기기 이사 파일은 [설정]으로 보낸다 — 「지원하지 않는」 이 아니다', async () => {
    const drillEnv = JSON.stringify({ spin: 'drill', envelope: 1, app: 'SPIN', exportedAt: Date.now(), payload: {} });
    await expect(importTeamFile(fileOf(drillEnv))).rejects.toThrow(/\[드릴 목록\]/);
    const backupEnv = JSON.stringify({ spin: 'backup', envelope: 1, app: 'SPIN', exportedAt: Date.now(), payload: {} });
    await expect(importTeamFile(fileOf(backupEnv))).rejects.toThrow(/\[설정\]/);
    // 대조군 — 진짜 모르는 종류는 일반 문구로 간다(아는 종류만 특별대우한다).
    const setEnv = JSON.stringify({ spin: 'drillSet', envelope: 1, app: 'SPIN', exportedAt: Date.now(), payload: {} });
    await expect(importTeamFile(fileOf(setEnv))).rejects.toThrow(/지원하지 않는 파일 형식/);
  });
});

describe('exportOneTeam', () => {
  it('없는 팀이면 던진다 — 조용히 빈 파일을 떨구지 않는다', async () => {
    await expect(exportOneTeam('tm_missing' as TeamId)).rejects.toThrow();
  });
});
