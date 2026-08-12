// 3.2/3.3 — **저장소에 이미 들어 있는 v1 레코드**가 읽히는 순간 v2 로 올라온다.
//
// src/model/drillV2.test.ts 는 migrateDoc 을 직접 부르지만, 실제 사용자의 파일이 지나는 길은
// `idbLoadDrill` → `loadDrillFromRaw`(migrate → validate) 다. 그 사이 어느 이음매가 끊겨도
// 모델 단위 테스트는 전부 초록불이므로 여기서 한 줄로 본다 — IDB 에 v1 을 넣고, 열고, 되쓰기까지.
import { describe, expect, it, vi } from 'vitest';
// tsconfig 에 resolveJsonModule 이 없어(다른 모듈 소유 설정) migrate.test.ts 와 같은 `?raw` 로 읽는다.
import drillV1Raw from '../test/fixtures/drill.v1.json?raw';
import { getDB } from './db.ts';
import { idbDrillRepo } from './drillRepo.ts';
import { newId } from '../core/ids.ts';
import type { Drill } from '../model/drill.ts';
import type { DrillId } from '../core/ids.ts';

const v1: Record<string, unknown> = JSON.parse(drillV1Raw);

/** 파일에서 온 날것을 그대로 스토어에 넣는다 — v1 은 **정상 문서**라 손상 주입(@ts-expect-error)이
 *  아니라 타입만 벗긴다. */
async function seedV1(extra: Record<string, unknown> = {}): Promise<DrillId> {
  const id = newId('dr');
  const db = await getDB();
  const tx = db.transaction('drills', 'readwrite');
  await tx.store.put({ ...v1, ...extra, id } as unknown as Drill);
  await tx.done;
  return id;
}

describe('3.2/3.3 v1 레코드 열기', () => {
  it('새 교육 필드는 기본값으로 채워지고 기존 내용은 하나도 안 잃는다', async () => {
    const id = await seedV1();
    idbDrillRepo.markOpen(id, true); // 되쓰기를 막아 이 it 은 '읽기' 만 본다
    try {
      const res = await idbDrillRepo.loadDrill(id);
      expect(res.status).toBe('ok');
      if (res.status !== 'ok') return;

      // (1) 새 필드 — 일곱 개를 따로 본다.
      expect(res.drill.objective).toBe('');
      expect(res.drill.coachingPoints).toEqual([]);
      expect(res.drill.equipment).toBe('');
      expect(res.drill.playersNeeded).toBe(0);
      expect(res.drill.reps).toBe(0);
      expect(res.drill.sets).toBe(0);
      expect(res.drill.intervalSec).toBe(0);

      // (2) 기존 내용 — 제목·설명·태그·본문(스텝/화살표/메모)·명단이 그대로다.
      expect(res.drill.title).toBe(v1.title);
      expect(res.drill.description).toBe(v1.description);
      expect(res.drill.tags).toEqual(v1.tags);
      expect(res.drill.durationMin).toBe(v1.durationMin);
      expect(res.drill.steps).toHaveLength((v1.steps as unknown[]).length);
      expect(res.drill.steps[1]?.arrows.length).toBeGreaterThan(0);
      expect(res.drill.steps[1]?.notes[0]?.text).toBe('패스 타이밍 강조');
      expect(res.drill.cast.chairs).toHaveLength((((v1.cast as Record<string, unknown>).chairs) as unknown[]).length);

      // (3) 무엇이 일어났는지 남는다 — 마이그레이션은 비파괴 repair 로 기록된다.
      expect(res.repairs.some((r) => r.path === 'schemaVersion' && r.message.includes('v1→v2'))).toBe(true);
      expect(res.repairs.every((r) => !r.destructive)).toBe(true);
    } finally {
      idbDrillRepo.markOpen(id, false);
    }
  });

  it('기회적 되쓰기가 저장된 레코드 자체를 v2 로 올린다 — 다음 열기부터는 마이그레이션이 없다', async () => {
    const id = await seedV1();
    const first = await idbDrillRepo.loadDrill(id);
    expect(first.status).toBe('ok');

    const db = await getDB();
    await vi.waitFor(async () => {
      const stored = await db.get('drills', id);
      expect(stored?.schemaVersion).toBe(2); // 되쓰기는 fire-and-forget 이라 기다린다(행 없음 — 실패는 단언 실패다)
    });
    const stored = await db.get('drills', id);
    expect(stored?.objective).toBe('');
    expect(stored?.title).toBe(v1.title); // 되쓰기가 내용을 갈아엎지 않았다

    const second = await idbDrillRepo.loadDrill(id);
    expect(second.status).toBe('ok');
    if (second.status !== 'ok') return;
    expect(second.repairs).toHaveLength(0); // 두 번째 열기는 아무것도 고칠 게 없다
  });

  it('v1 파일이 이미 값을 갖고 있었다면(수기 편집·미래 파일) 그 값을 덮어쓰지 않는다', async () => {
    const id = await seedV1({ objective: '수기로 적어 둔 목적', reps: 3, sets: 2, intervalSec: 45, playersNeeded: 6 });
    idbDrillRepo.markOpen(id, true);
    try {
      const res = await idbDrillRepo.loadDrill(id);
      expect(res.status).toBe('ok');
      if (res.status !== 'ok') return;
      expect(res.drill.objective).toBe('수기로 적어 둔 목적');
      expect(res.drill.reps).toBe(3);
      expect(res.drill.sets).toBe(2);
      expect(res.drill.intervalSec).toBe(45);
      expect(res.drill.playersNeeded).toBe(6);
      // 대조군 — 비어 있던 자리는 여전히 기본값이다.
      expect(res.drill.equipment).toBe('');
    } finally {
      idbDrillRepo.markOpen(id, false);
    }
  });
});

describe('3.2/3.3 새로 만든 드릴의 IDB 왕복', () => {
  it('putDrill → loadDrill 로 일곱 필드가 전부 살아 돌아온다', async () => {
    const d = await idbDrillRepo.createDrill({ courtMode: 'full', title: '왕복 검증' });
    await idbDrillRepo.putDrill({
      ...d,
      objective: '측면 전개',
      coachingPoints: ['받기 전에 몸을 연다', '패스는 낮게'],
      playersNeeded: 6,
      equipment: '공 2 · 콘 6',
      reps: 3,
      sets: 2,
      intervalSec: 60,
    });

    const res = await idbDrillRepo.loadDrill(d.id);
    expect(res.status).toBe('ok');
    if (res.status !== 'ok') return;
    expect(res.drill.objective).toBe('측면 전개');
    expect(res.drill.coachingPoints).toEqual(['받기 전에 몸을 연다', '패스는 낮게']);
    expect(res.drill.playersNeeded).toBe(6);
    expect(res.drill.equipment).toBe('공 2 · 콘 6');
    expect(res.drill.reps).toBe(3);
    expect(res.drill.sets).toBe(2);
    expect(res.drill.intervalSec).toBe(60);
  });
});
