// §3 seed 드릴 — **심는 장치**의 계약(3.8). 무엇을 심든 규칙은 넷이다:
// ① 한 번만 심는다 ② 지운 것을 되살리지 않는다 ③ 판(자유 전술판)을 건드리지 않는다
// ④ 마이그레이션과 충돌하지 않는다.
//
// ⚠️ 2026-09-06 — 심는 것이 손코딩 3벌에서 **규칙 화면 장면 22벌**로 바뀌었다(기현 지시,
// docs/PLAN-SEED-FROM-RULES.md). 여기서 지운 단언은 그 3벌의 **본문**을 전제하던 것들이다:
// 난이도가 초·중·고 하나씩 · 교육 필드 7종이 채워져 있음 · 스텝 메모에 `\n조작: ` 도막이 있음.
// 규칙 장면에는 그런 것이 없다(교육 필드는 비어 있고 설명은 코트 위 쪽지로 한다). 문서가 온전히
// 심기는가는 `features/rules/ruleScenes.test.ts` 의 「첫 실행 시드」 절이 22벌 전부에 대해 잰다.
//
// idbDrillRepo 는 파일 전체가 하나의 fake-indexeddb 를 공유하므로 **매 테스트마다 비운다** —
// 안 그러면 자물쇠 ②(같은 id 가 이미 있으면 안 심는다)가 앞 테스트의 잔여물을 보고
// 뒤 테스트를 통째로 헛통과시킨다.
import { describe, it, expect, beforeEach } from 'vitest';
import { defaultSeedDrills, seedDrillsOnce } from './seed.ts';
import { idbDrillRepo, memoryDrillRepo, type DrillRepo } from './drillRepo.ts';
import { BOARD_KEY, loadBoard } from './board.ts';
import { seedRuleDrills, SEED_EPOCH } from '../features/rules/ruleScenes.ts';
import { TUTORIAL_DRILL_ID } from '../model/tutorialDrill.ts';
import { CURRENT_DRILL_SCHEMA } from '../model/drill.ts';

/** 심는 수를 하드코딩하지 않는다 — 장면이 늘거나 줄면 여기가 따라간다(개수 자체를 못 박는 것은
 *  `ruleScenes.test.ts` 의 *"RULE_SCENE_IDS 는 정확히 22개다"* 한 줄이다).
 *
 *  첫 실행에 심는 전량 = 따라하기 1 + 규칙 장면 22.
 *  ⚠️ 2026-09-16(T7) — 전에는 `seedRuleDrills().length` 였다. */
const SEED_COUNT = defaultSeedDrills('ko').length;

async function wipe(repo: DrillRepo): Promise<void> {
  for (const s of await repo.listDrillSummaries()) await repo.deleteDrill(s.id);
}

beforeEach(async () => {
  await wipe(idbDrillRepo);
  await wipe(memoryDrillRepo);
  localStorage.clear();
});

describe('seedDrillsOnce — 자물쇠 ① 도장', () => {
  it('도장이 없으면 규칙 장면 전량을 심는다', async () => {
    const out = await seedDrillsOnce(idbDrillRepo, { seeded: false });
    expect(out).toEqual({ seeded: true, count: SEED_COUNT, reason: 'planted' });
    expect(await idbDrillRepo.countDrills()).toBe(SEED_COUNT);
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
    expect(await idbDrillRepo.countDrills()).toBe(SEED_COUNT + 1);
  });
});

describe('seedDrillsOnce — 자물쇠 ② 중복 방지', () => {
  it('도장이 없어도 두 번째 심기는 막힌다 (localStorage 가 죽은 기기)', async () => {
    await seedDrillsOnce(idbDrillRepo, { seeded: false });
    const out = await seedDrillsOnce(idbDrillRepo, { seeded: false });
    expect(out).toEqual({ seeded: false, count: 0, reason: 'already-present' });
    expect(await idbDrillRepo.countDrills()).toBe(SEED_COUNT);
  });

  it('id 가 하나만 겹쳐도 막는다 — 반쪽만 심어 놓는 것이 가장 나쁘다', async () => {
    await idbDrillRepo.putDrill(seedRuleDrills()[3]!, { touch: false });

    const out = await seedDrillsOnce(idbDrillRepo, { seeded: false });
    expect(out.reason).toBe('already-present');
    expect(await idbDrillRepo.countDrills()).toBe(1);
  });

  it('**제목만** 같은 남의 드릴은 막지 않는다 — 열쇠는 제목이 아니라 id 다', async () => {
    // ⚠️ 2026-09-06 열쇠 교체(계획 결정 5)의 실제 대가를 재는 자리다. 제목으로 재던 시절, 자기
    // 드릴을 우연히 시드와 같은 이름으로 지은 사람은 **기본 드릴을 영영 못 받았다.** id 는
    // 사용자가 정할 수 없으므로 그 사고가 없다.
    const clash = seedRuleDrills()[0]!.title;
    await idbDrillRepo.createDrill({ courtMode: 'full', title: clash });
    const out = await seedDrillsOnce(idbDrillRepo, { seeded: false });
    expect(out.reason).toBe('planted');
    expect(await idbDrillRepo.countDrills()).toBe(SEED_COUNT + 1);
  });
});

describe('seedDrillsOnce — 심은 것이 온전한가', () => {
  it('심은 시각이 고정 시각 그대로다 — putDrill 이 기계 시계로 덮으면 동기화가 편집을 잃는다', async () => {
    // touch:false 계약. 덮이면 목록 정렬이 무너지는 것은 눈에 보이지만, 더 나쁜 것은 안 보이는
    // 쪽이다 — 나중에 첫 실행한 기기의 **손 안 댄 시드**가 LWW 로 다른 기기의 편집을 이긴다.
    // ⚠️ 2026-09-16(T7) — 옛 단언은 `max(updatedAt) === SEED_EPOCH` 였다. 따라하기 드릴이
    // 그보다 1분 뒤에 앉으면서 그 최대값이 바뀐 것이고, **계약은 그대로다**: 심는 시각은 전부
    // 코드가 정한 고정값이고 기계 시계가 아니다. 그래서 최대값 하나가 아니라 **집합 전체**를
    // 기대값과 맞춘다 — 그래야 어느 한 벌만 기계 시계로 덮여도 잡힌다.
    await seedDrillsOnce(idbDrillRepo, { seeded: false });
    const list = await idbDrillRepo.listDrillSummaries();
    expect(list).toHaveLength(SEED_COUNT);
    const expected = defaultSeedDrills('ko').map((d) => d.updatedAt).sort((a, b) => a - b);
    expect(list.map((s) => s.updatedAt).sort((a, b) => a - b)).toEqual(expected);
    expect(Math.max(...list.map((s) => s.updatedAt)), '맨 위는 따라하기(에폭 + 1분)다').toBe(
      SEED_EPOCH + 60_000,
    );
  });

  it('목록 기본 정렬(updatedAt 내림차순) — 맨 위가 따라하기 드릴이고 그 아래가 카드 순서다', async () => {
    // ⚠️ 2026-09-16(T7) — 옛 제목은 *"맨 위가 카드 1 의 첫 장면이다"* 였다. 그 근거(2026-09-06
    // 기현 지시로 시드를 규칙 장면으로 교체, PLAN-SEED-FROM-RULES)는 **지금도 살아 있다** —
    // 규칙 22벌의 **자기들끼리의 순서**는 카드 순 그대로다. 바뀐 것은 그 위에 한 벌이 더 올라온
    // 것뿐이다: 처음 앱을 연 사람이 가장 먼저 마주치는 카드가 규칙 장면이면 «내 훈련을 이렇게
    // 만든다» 를 보여 줄 기회를 놓친다(storage/seed.ts 의 `defaultSeedDrills` 머리말).
    await seedDrillsOnce(idbDrillRepo, { seeded: false });
    const list = await idbDrillRepo.listDrillSummaries();
    expect(list[0]?.id, '따라하기가 맨 위가 아니다').toBe(TUTORIAL_DRILL_ID);
    expect(list.slice(1).map((s) => s.id), '규칙 장면끼리의 순서는 카드 순 그대로다').toEqual(
      seedRuleDrills().map((d) => d.id),
    );
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
    expect((await seedDrillsOnce(memoryDrillRepo, { seeded: false })).count).toBe(SEED_COUNT);
    expect((await seedDrillsOnce(memoryDrillRepo, { seeded: false })).reason).toBe('already-present');
    expect(await memoryDrillRepo.countDrills()).toBe(SEED_COUNT);
  });

  it('심을 것이 없으면 조용히 아무것도 안 한다', async () => {
    const out = await seedDrillsOnce(idbDrillRepo, { seeded: false, drills: [] });
    expect(out.count).toBe(0);
    expect(await idbDrillRepo.countDrills()).toBe(0);
  });
});
