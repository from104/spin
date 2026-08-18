// §3 seed 드릴 — **심는 장치**의 계약(3.8). 내용이 무엇이든(아직 승인 전이다) 규칙은 넷이다:
// ① 한 번만 심는다 ② 지운 것을 되살리지 않는다 ③ 판(자유 전술판)을 건드리지 않는다
// ④ 마이그레이션과 충돌하지 않는다.
//
// idbDrillRepo 는 파일 전체가 하나의 fake-indexeddb 를 공유하므로 **매 테스트마다 비운다** —
// 안 그러면 자물쇠 ②(같은 제목이 이미 있으면 안 심는다)가 앞 테스트의 잔여물을 보고
// 뒤 테스트를 통째로 헛통과시킨다.
import { describe, it, expect, beforeEach } from 'vitest';
import { seedDrillsOnce } from './seed.ts';
import { idbDrillRepo, memoryDrillRepo, type DrillRepo } from './drillRepo.ts';
import { BOARD_KEY, loadBoard } from './board.ts';
import { buildSeedDrills } from '../model/seedDrills.ts';
import { SEED_DRILL_SPECS } from '../model/seedDrillContent.ts';
import { CURRENT_DRILL_SCHEMA } from '../model/drill.ts';

async function wipe(repo: DrillRepo): Promise<void> {
  for (const s of await repo.listDrillSummaries()) await repo.deleteDrill(s.id);
}

beforeEach(async () => {
  await wipe(idbDrillRepo);
  await wipe(memoryDrillRepo);
  localStorage.clear();
});

describe('seedDrillsOnce — 자물쇠 ① 도장', () => {
  it('도장이 없으면 세 개를 심는다', async () => {
    const out = await seedDrillsOnce(idbDrillRepo, { seeded: false });
    expect(out).toEqual({ seeded: true, count: 3, reason: 'planted' });
    expect(await idbDrillRepo.countDrills()).toBe(3);
  });

  it('도장이 있으면 한 개도 심지 않는다', async () => {
    const out = await seedDrillsOnce(idbDrillRepo, { seeded: true });
    expect(out).toEqual({ seeded: false, count: 0, reason: 'stamped' });
    expect(await idbDrillRepo.countDrills()).toBe(0);
  });

  it('**지운 뒤에도** 도장이 있으면 되살아나지 않는다 — 이 앱이 지키기로 한 바로 그 약속', async () => {
    await seedDrillsOnce(idbDrillRepo, { seeded: false });
    for (const s of await idbDrillRepo.listDrillSummaries()) await idbDrillRepo.deleteDrill(s.id);
    expect(await idbDrillRepo.countDrills()).toBe(0);

    const again = await seedDrillsOnce(idbDrillRepo, { seeded: true });
    expect(again.seeded).toBe(false);
    expect(await idbDrillRepo.countDrills()).toBe(0);
  });

  it('도장은 목록이 비었는지를 보지 않는다 — 남의 드릴만 있는 목록에도 심는다', async () => {
    await idbDrillRepo.createDrill({ courtMode: 'full', title: '내가 만든 드릴' });
    const out = await seedDrillsOnce(idbDrillRepo, { seeded: false });
    expect(out.seeded).toBe(true);
    expect(await idbDrillRepo.countDrills()).toBe(4);
  });
});

describe('seedDrillsOnce — 자물쇠 ② 중복 방지', () => {
  it('도장이 없어도 같은 제목이 이미 있으면 안 심는다 (localStorage 가 죽은 기기)', async () => {
    await seedDrillsOnce(idbDrillRepo, { seeded: false });
    const out = await seedDrillsOnce(idbDrillRepo, { seeded: false });
    expect(out).toEqual({ seeded: false, count: 0, reason: 'already-present' });
    expect(await idbDrillRepo.countDrills()).toBe(3);
  });

  it('제목이 하나만 겹쳐도 막는다 — 반쪽만 심어 놓는 것이 가장 나쁘다', async () => {
    const only = buildSeedDrills(SEED_DRILL_SPECS.slice(1, 2), Date.now());
    await idbDrillRepo.putDrill(only[0]!, { touch: false });

    const out = await seedDrillsOnce(idbDrillRepo, { seeded: false });
    expect(out.reason).toBe('already-present');
    expect(await idbDrillRepo.countDrills()).toBe(1);
  });

  it('제목이 하나도 안 겹치면 통과한다 — 대조군(②가 늘 막는 것이 아님을 보인다)', async () => {
    await idbDrillRepo.createDrill({ courtMode: 'full', title: '전혀 다른 제목' });
    const out = await seedDrillsOnce(idbDrillRepo, { seeded: false });
    expect(out.reason).toBe('planted');
  });
});

describe('seedDrillsOnce — 심은 것이 온전한가', () => {
  it('세 개가 목록 요약에 뜨고 난이도가 초·중·고 하나씩이다', async () => {
    await seedDrillsOnce(idbDrillRepo, { seeded: false });
    const list = await idbDrillRepo.listDrillSummaries();
    expect(list).toHaveLength(3);
    expect(new Set(list.map((s) => s.level))).toEqual(new Set(['초급', '중급', '고급']));
  });

  it('목록 기본 정렬(updatedAt 내림차순)에서 초급이 맨 위다', async () => {
    await seedDrillsOnce(idbDrillRepo, { seeded: false });
    const list = await idbDrillRepo.listDrillSummaries();
    expect(list.map((s) => s.level)).toEqual(['초급', '중급', '고급']);
  });

  it('IDB 왕복에서 4상태 로더가 ok 이고 파괴적 보정이 0건이다', async () => {
    await seedDrillsOnce(idbDrillRepo, { seeded: false });
    for (const s of await idbDrillRepo.listDrillSummaries()) {
      const load = await idbDrillRepo.loadDrill(s.id);
      expect(load.status).toBe('ok');
      if (load.status !== 'ok') continue;
      expect(load.repairs.filter((r) => r.destructive)).toEqual([]);
    }
  });

  it('교육 필드가 저장 왕복에서 증발하지 않는다 — validate.ts 화이트리스트 조립부', async () => {
    await seedDrillsOnce(idbDrillRepo, { seeded: false });
    const [first] = await idbDrillRepo.listDrillSummaries();
    const load = await idbDrillRepo.loadDrill(first!.id);
    expect(load.status).toBe('ok');
    if (load.status !== 'ok') return;
    expect(load.drill.objective!.length).toBeGreaterThan(0);
    expect(load.drill.coachingPoints!.length).toBeGreaterThan(0);
    expect(load.drill.playersNeeded).toBeGreaterThan(0);
    expect(load.drill.equipment!.length).toBeGreaterThan(0);
    // v8 — 분류 유형·경기 상황도 같은 화이트리스트를 지난다(씨앗 3종은 전부 situation 을 갖는다).
    expect(load.drill.drillType.length).toBeGreaterThan(0);
    expect(load.drill.situation).toBeDefined();
  });

  it('스텝 메모가 조작 설명까지 통째로 살아남는다 — 시연이 읽어 줄 대본이다', async () => {
    await seedDrillsOnce(idbDrillRepo, { seeded: false });
    const [first] = await idbDrillRepo.listDrillSummaries();
    const load = await idbDrillRepo.loadDrill(first!.id);
    expect(load.status).toBe('ok');
    if (load.status !== 'ok') return;
    for (const s of load.drill.steps) expect(s.note).toContain('\n조작: ');
  });
});

describe('seedDrillsOnce — 마이그레이션·판 불변', () => {
  it('심은 문서의 schemaVersion 이 현행이라 읽을 때 마이그레이션이 한 단계도 안 돈다', async () => {
    await seedDrillsOnce(idbDrillRepo, { seeded: false });
    for (const s of await idbDrillRepo.listDrillSummaries()) {
      const raw = (await idbDrillRepo.getRawDrill(s.id)) as { schemaVersion: number };
      expect(raw.schemaVersion).toBe(CURRENT_DRILL_SCHEMA);
      const load = await idbDrillRepo.loadDrill(s.id);
      expect(load.status).toBe('ok');
      if (load.status !== 'ok') continue;
      expect(load.repairs.filter((r) => r.path === 'schemaVersion')).toEqual([]);
    }
  });

  it('**판(자유 전술판)을 건드리지 않는다** — 2026-08-10 "전술판은 빈 코트로 시작한다"', async () => {
    localStorage.setItem(BOARD_KEY, 'SENTINEL');
    await seedDrillsOnce(idbDrillRepo, { seeded: false });
    expect(localStorage.getItem(BOARD_KEY)).toBe('SENTINEL');
    // 대조군 — 판을 안 만들었으면 loadBoard 는 여전히 null 이다(seed 가 판을 심지 않는다).
    localStorage.removeItem(BOARD_KEY);
    await wipe(idbDrillRepo);
    await seedDrillsOnce(idbDrillRepo, { seeded: false });
    expect(loadBoard()).toBeNull();
  });

  it('열화 모드(메모리 리포지토리)에서도 같은 규칙이다', async () => {
    expect((await seedDrillsOnce(memoryDrillRepo, { seeded: false })).count).toBe(3);
    expect((await seedDrillsOnce(memoryDrillRepo, { seeded: false })).reason).toBe('already-present');
    expect(await memoryDrillRepo.countDrills()).toBe(3);
  });

  it('심을 것이 없으면(스펙 0개) 조용히 아무것도 안 한다', async () => {
    const out = await seedDrillsOnce(idbDrillRepo, { seeded: false, drills: [] });
    expect(out.count).toBe(0);
    expect(await idbDrillRepo.countDrills()).toBe(0);
  });
});
