// 로스터 (구조 개편 C3) — meta 스토어 왕복·검증·백업 복원 정책.
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { getDB } from './db.ts';
import { loadRoster, saveRoster } from './rosterRepo.ts';
import { addPlayer, emptyRoster, removePlayer, updatePlayer, CURRENT_ROSTER_SCHEMA } from '../model/roster.ts';
import { validateRoster, LIMITS } from '../model/validate.ts';
import { collectBackup, restoreBackup, parseSpinFile, exportBackupFile } from './transfer.ts';

beforeEach(async () => {
  const db = await getDB();
  await Promise.all([db.clear('drills'), db.clear('drillSummaries'), db.clear('sessions'), db.clear('meta')]);
});

describe('rosterRepo — meta 스토어 왕복', () => {
  it('저장한 명단이 그대로 되살아난다 — 없으면 빈 명단', async () => {
    expect((await loadRoster()).players).toEqual([]);
    let r = addPlayer(emptyRoster(), '김선수', 'PF1');
    r = addPlayer(r, '이선수'); // 미분류
    await saveRoster(r);
    const back = await loadRoster();
    expect(back.players.map((p) => p.name)).toEqual(['김선수', '이선수']);
    expect(back.players[0]!.klass).toBe('PF1');
    expect('klass' in back.players[1]!).toBe(false); // 미분류 = 키 없음
    expect(back.schemaVersion).toBe(CURRENT_ROSTER_SCHEMA);
  });

  it('손상 레코드는 빈 명단으로 읽히지만 저장본을 지우지는 않는다', async () => {
    const db = await getDB();
    await db.put('meta', { key: 'roster', value: '고장난 문자열' });
    expect((await loadRoster()).players).toEqual([]);
    // 되쓰지 않았다 — 다음 저장 전까지 원본이 남아 사람이 고칠 기회가 있다.
    const rec = await db.get('meta', 'roster');
    expect(rec?.value).toBe('고장난 문자열');
  });

  it('편집 헬퍼 — 수정·제거', () => {
    let r = addPlayer(emptyRoster(), '박선수', 'PF2');
    const id = r.players[0]!.id;
    r = updatePlayer(r, id, { name: '박주장', klass: 'PF1' });
    expect(r.players[0]!.name).toBe('박주장');
    expect(r.players[0]!.klass).toBe('PF1');
    expect(removePlayer(r, id).players).toEqual([]);
  });
});

describe('validateRoster', () => {
  it('이름 없는 선수는 버리고, 모르는 클래스는 미분류로 접고, 상한을 지킨다', () => {
    const raw = {
      schemaVersion: 1,
      players: [
        { id: 'pl_1', name: '유효', klass: 'PF1' },
        { id: 'pl_2', name: '   ' }, // 공백뿐 — 버림
        { id: 'pl_3', name: '모르는 클래스', klass: 'PF3' },
        ...Array.from({ length: 40 }, (_, i) => ({ id: `pl_x${i}`, name: `여분 ${i}` })),
      ],
      updatedAt: 5,
    };
    const v = validateRoster(raw);
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.value.players.length).toBe(LIMITS.rosterMax);
    expect(v.value.players[0]!.name).toBe('유효');
    expect('klass' in v.value.players[1]!).toBe(false); // PF3 → 미분류
    expect(v.value.players.some((p) => p.name.trim().length === 0)).toBe(false);
  });
});

describe('백업 봉투의 로스터 (ENVELOPE_VERSION 1 유지)', () => {
  it('명단이 있으면 백업에 실리고, 빈 명단은 키를 생략한다', async () => {
    expect('roster' in (await collectBackup())).toBe(false);
    await saveRoster(addPlayer(emptyRoster(), '백업 선수', 'PF2'));
    const p = await collectBackup();
    expect(p.roster?.players[0]!.name).toBe('백업 선수');
  });

  it('복원 auto — 로컬이 비어 있으면 복원, 이미 있으면 kept-local', async () => {
    await saveRoster(addPlayer(emptyRoster(), '보낼 선수'));
    const file = parseSpinFile(await exportBackupFile(await collectBackup()).text());
    // 로컬을 비우고 복원 → restored
    await saveRoster(emptyRoster());
    const r1 = await restoreBackup(file);
    expect(r1.roster).toBe('restored');
    expect((await loadRoster()).players[0]!.name).toBe('보낼 선수');
    // 로컬에 다른 명단 → kept-local (남의 백업이 내 팀을 덮지 않는다)
    await saveRoster(addPlayer(emptyRoster(), '내 팀 선수'));
    const r2 = await restoreBackup(file);
    expect(r2.roster).toBe('kept-local');
    expect((await loadRoster()).players[0]!.name).toBe('내 팀 선수');
    // replace 를 명시하면 덮는다
    const r3 = await restoreBackup(file, { roster: 'replace' });
    expect(r3.roster).toBe('restored');
    expect((await loadRoster()).players[0]!.name).toBe('보낼 선수');
  });

  it('구 백업(roster 키 없음)은 none-in-file — 조용히 정상', async () => {
    const file = parseSpinFile(await exportBackupFile(await collectBackup()).text());
    expect(file.spin === 'backup' && 'roster' in file.payload).toBe(false);
    const r = await restoreBackup(file);
    expect(r.roster).toBe('none-in-file');
  });
});
