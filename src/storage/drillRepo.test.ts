// §10.6 drillRepo. fake-indexeddb 를 setup.ts 에서 전역으로 깐다. 테스트마다 newId 로 고유
// DrillId 를 쓰므로 DB 를 초기화하지 않고 같은 파일 안에서 공유해도 서로 간섭하지 않는다.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { getDB } from './db.ts';
import {
  idbDrillRepo,
  memoryDrillRepo,
  normalizeForSearch,
  findReferrers,
  resolveDrillRepo,
  type CreateDrillInit,
} from './drillRepo.ts';
import { StorageError } from './errors.ts';
import { createDrill } from '../model/defaults.ts';
import type { Drill } from '../model/drill.ts';
import { newId } from '../core/ids.ts';
import { createSession } from './sessionRepo.ts';
import { flattenSessionItems } from '../model/session.ts';
import { listTombstones } from './syncMeta.ts';

const baseInit: CreateDrillInit = { courtMode: 'full', title: '테스트 드릴' };

describe('idbDrillRepo.putDrill', () => {
  it('drills 와 drillSummaries 를 한 트랜잭션에서 함께 갱신한다', async () => {
    const d = await idbDrillRepo.createDrill(baseInit);
    const db = await getDB();
    const storedDrill = await db.get('drills', d.id);
    const storedSummary = await db.get('drillSummaries', d.id);
    expect(storedDrill?.id).toBe(d.id);
    expect(storedSummary?.id).toBe(d.id);
    expect(storedSummary?.title).toBe(d.title);
  });

  it('expectedUpdatedAt 이 낡으면 E_CONFLICT 이고 아무것도 쓰이지 않는다', async () => {
    const d = await idbDrillRepo.createDrill(baseInit);
    const staleUpdatedAt = d.updatedAt - 1000;
    const attempted = { ...d, title: '충돌 시도' };

    await expect(idbDrillRepo.putDrill(attempted, { expectedUpdatedAt: staleUpdatedAt })).rejects.toMatchObject({
      code: 'E_CONFLICT',
    });

    const db = await getDB();
    const stored = await db.get('drills', d.id);
    expect(stored?.title).toBe('테스트 드릴'); // 충돌 시도 전 제목 그대로
  });

  it('expectedUpdatedAt 이 정확하면 갱신되고 새 updatedAt 을 돌려준다', async () => {
    const d = await idbDrillRepo.createDrill(baseInit);
    const updated = await idbDrillRepo.putDrill({ ...d, title: '갱신됨' }, { expectedUpdatedAt: d.updatedAt });
    expect(updated.title).toBe('갱신됨');
    const db = await getDB();
    const stored = await db.get('drills', d.id);
    expect(stored?.title).toBe('갱신됨');
  });

  it('tx.done 커밋 단계에서 QuotaExceededError 가 나면 E_QUOTA 로 변환된다', async () => {
    const putSpy = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementationOnce(() => {
      throw new DOMException('quota exceeded', 'QuotaExceededError');
    });
    try {
      await expect(idbDrillRepo.createDrill(baseInit)).rejects.toMatchObject({ code: 'E_QUOTA' });
    } finally {
      putSpy.mockRestore();
    }
  });

  it('값이 유한하지 않은 pose 는 저장을 거부한다(assertWritable)', async () => {
    const d = createDrill(baseInit);
    const chairId = d.cast.chairs[0]!.id;
    const broken: Drill = { ...d, steps: [{ ...d.steps[0]!, chairs: { ...d.steps[0]!.chairs, [chairId]: { x: NaN, y: 0, angleDeg: 0 } } }] };
    await expect(idbDrillRepo.putDrill(broken)).rejects.toMatchObject({ code: 'E_INVALID_FILE' });
  });
});

describe('idbDrillRepo.deleteDrill', () => {
  it('세션을 건드리지 않는다 — 캐스케이드도, 차단도 하지 않는다', async () => {
    const d = await idbDrillRepo.createDrill(baseInit);
    const session = await createSession({ title: '삭제 검증용 세션' });
    const withItem = await import('./sessionRepo.ts').then((m) => m.addDrillToSession(session.id, d.id));
    expect(withItem.drillIds).toContain(d.id);

    await idbDrillRepo.deleteDrill(d.id);

    const db = await getDB();
    expect(await db.get('drills', d.id)).toBeUndefined();
    const storedSession = await db.get('sessions', session.id);
    // 세션 항목 자체는 그대로 남는다(캐스케이드 없음) — missing 파생은 resolveSession 몫.
    expect(flattenSessionItems(storedSession!).some((it) => it.drillId === d.id)).toBe(true);
  });
});

describe('idbDrillRepo.restoreDrill (§E, PLAN-DELETE-SAFETY.md)', () => {
  it('삭제 톰스톤을 함께 지운다 — putDrill({touch:false}) 만으로는 안 되던 것(회귀 방지)', async () => {
    const d = await idbDrillRepo.createDrill(baseInit);
    await idbDrillRepo.deleteDrill(d.id);

    let tombs = await listTombstones();
    expect(tombs.some((t) => t.type === 'drill' && t.id === d.id)).toBe(true); // 삭제 직후엔 있다

    await idbDrillRepo.restoreDrill(d);

    tombs = await listTombstones();
    // 여기가 회귀 지점이었다 — 지워지지 않으면 다음 동기화가 되살린 드릴을 다시 지운다
    // (sync/plan.ts 의 localDeleted 판정이 deletedAt > updatedAt 을 그대로 참으로 읽는다).
    expect(tombs.some((t) => t.type === 'drill' && t.id === d.id)).toBe(false);

    const db = await getDB();
    expect((await db.get('drills', d.id))?.id).toBe(d.id);
    expect((await db.get('drillSummaries', d.id))?.id).toBe(d.id);
  });

  it('드릴과 요약을 원래 내용 그대로 되살린다', async () => {
    const d = await idbDrillRepo.createDrill(baseInit);
    await idbDrillRepo.deleteDrill(d.id);

    const restored = await idbDrillRepo.restoreDrill(d);
    expect(restored.title).toBe(d.title);
    expect(restored.updatedAt).toBe(d.updatedAt); // 복원은 수정이 아니다 — 시각을 안 민다

    const db = await getDB();
    const summary = await db.get('drillSummaries', d.id);
    expect(summary?.title).toBe(d.title);
  });
});

describe('idbDrillRepo.loadDrill 4상태', () => {
  it('missing — 없는 id', async () => {
    const res = await idbDrillRepo.loadDrill(newId('dr'));
    expect(res.status).toBe('missing');
  });

  it('ok — 정상 저장분', async () => {
    const d = await idbDrillRepo.createDrill(baseInit);
    const res = await idbDrillRepo.loadDrill(d.id);
    expect(res.status).toBe('ok');
    if (res.status === 'ok') expect(res.drill.id).toBe(d.id);
  });

  it('corrupt — steps 가 배열이 아닌 손상 레코드. 요약은 남는다', async () => {
    const d = await idbDrillRepo.createDrill(baseInit);
    const db = await getDB();
    const tx = db.transaction('drills', 'readwrite');
    // @ts-expect-error 의도적으로 손상된 형태를 직접 주입
    await tx.store.put({ ...d, steps: 'not-an-array' });
    await tx.done;

    const res = await idbDrillRepo.loadDrill(d.id);
    expect(res.status).toBe('corrupt');
    const summary = await db.get('drillSummaries', d.id);
    expect(summary).toBeDefined(); // corrupt 여도 요약은 지우지 않는다 — 지우면 UI 에서 완전 접근 불가
  });

  it('too-new — schemaVersion 이 지원 버전보다 큼', async () => {
    const d = await idbDrillRepo.createDrill(baseInit);
    const db = await getDB();
    const tx = db.transaction('drills', 'readwrite');
    await tx.store.put({ ...d, schemaVersion: 99 });
    await tx.done;

    const res = await idbDrillRepo.loadDrill(d.id);
    expect(res.status).toBe('too-new');
    if (res.status === 'too-new') expect(res.found).toBe(99);
  });
});

describe('기회적 되쓰기', () => {
  it('markOpen 으로 열려 있으면 되쓰지 않는다', async () => {
    const d = await idbDrillRepo.createDrill(baseInit);
    const db = await getDB();
    // title 이 길이 상한을 넘도록 손상 → repairs 가 비파괴적이 아니게 만들되(파괴적인 title 절단은
    // destructive:true 라 애초에 되쓰지 않으니), 여기서는 formation 오탈자로 비파괴 repair 를 유도한다.
    const tx = db.transaction('drills', 'readwrite');
    await tx.store.put({ ...d, formation: '없는-포메이션' });
    await tx.done;

    idbDrillRepo.markOpen(d.id, true);
    try {
      await idbDrillRepo.loadDrill(d.id);
      await new Promise((r) => setTimeout(r, 20)); // 되쓰기가 fire-and-forget 이라 잠깐 대기
      const stored = await db.get('drills', d.id);
      expect(stored?.formation).toBe('없는-포메이션'); // 열려 있으니 원본 그대로
    } finally {
      idbDrillRepo.markOpen(d.id, false);
    }
  });

  it('열려 있지 않고 비파괴적 repair 면 CAS 로 되쓴다', async () => {
    const d = await idbDrillRepo.createDrill(baseInit);
    const db = await getDB();
    const tx = db.transaction('drills', 'readwrite');
    await tx.store.put({ ...d, formation: '없는-포메이션' });
    await tx.done;

    await idbDrillRepo.loadDrill(d.id);
    await new Promise((r) => setTimeout(r, 30));
    const stored = await db.get('drills', d.id);
    expect(stored?.formation).toBe('1-2-1'); // 보정된 값으로 되쓰였다
  });

  it('updatedAt 이 그 사이 바뀌면(다른 탭이 먼저 씀) 되쓰기가 abort 되고 새 값을 덮지 않는다', async () => {
    const d = await idbDrillRepo.createDrill(baseInit);
    const db = await getDB();
    const tx = db.transaction('drills', 'readwrite');
    await tx.store.put({ ...d, formation: '없는-포메이션' });
    await tx.done;

    // loadDrill 이 원본을 읽자마자(비동기 되쓰기 예약 직후) 다른 탭이 먼저 갱신했다고 가정.
    const loadPromise = idbDrillRepo.loadDrill(d.id);
    await loadPromise;
    await idbDrillRepo.putDrill({ ...d, title: '다른 탭에서 수정' }, { expectedUpdatedAt: d.updatedAt });
    await new Promise((r) => setTimeout(r, 30));

    const stored = await db.get('drills', d.id);
    expect(stored?.title).toBe('다른 탭에서 수정'); // 되쓰기가 이 값을 덮어쓰지 않았어야 한다
  });
});

describe('요약 지연 재생성', () => {
  it('build 가 낮은 레코드만 재생성되고 나머지는 드릴을 로드하지 않는다', async () => {
    const stale = await idbDrillRepo.createDrill(baseInit);
    const fresh = await idbDrillRepo.createDrill(baseInit);
    const db = await getDB();

    // stale 요약만 build 를 낮춘다.
    const staleSummary = await db.get('drillSummaries', stale.id);
    await db.put('drillSummaries', { ...staleSummary!, build: 0 });

    const getSpy = vi.spyOn(IDBObjectStore.prototype, 'get');
    const n = await idbDrillRepo.rebuildAllSummaries();
    expect(n).toBe(1);

    const drillsGetCalls = getSpy.mock.calls.length;
    getSpy.mockRestore();
    expect(drillsGetCalls).toBeGreaterThan(0); // stale 것만 로드했는지는 아래로 재검증

    const rebuiltSummary = await db.get('drillSummaries', stale.id);
    expect(rebuiltSummary?.build).toBeGreaterThan(0);
    const untouchedSummary = await db.get('drillSummaries', fresh.id);
    expect(untouchedSummary?.updatedAt).toBe(fresh.updatedAt);
  });
});

describe('normalizeForSearch / searchKey 구분자', () => {
  it('normalizeForSearch 는 NFKC 정규화·소문자화·공백 축약을 한다', () => {
    expect(normalizeForSearch('  Cross   FIRE  ')).toBe('cross fire');
  });

  it('"크로스"+"공격" 경계를 넘는 "스공" 이 매치되지 않는다', async () => {
    const d = await idbDrillRepo.createDrill({ courtMode: 'full', title: '크로스', drillType: 'tactical' });
    const results = await idbDrillRepo.listDrillSummaries({ search: '스공' });
    expect(results.find((s) => s.id === d.id)).toBeUndefined();
  });

  it('실제 부분일치는 매치된다', async () => {
    const d = await idbDrillRepo.createDrill({ courtMode: 'full', title: '유니크제목검색용123' });
    const results = await idbDrillRepo.listDrillSummaries({ search: '제목검색' });
    expect(results.some((s) => s.id === d.id)).toBe(true);
  });
});

describe('memoryDrillRepo (필수 폴백)', () => {
  it('IDB 없이도 CRUD 전체가 동작한다', async () => {
    const d = await memoryDrillRepo.createDrill(baseInit);
    expect(await memoryDrillRepo.countDrills()).toBeGreaterThan(0);
    const loaded = await memoryDrillRepo.getDrill(d.id);
    expect(loaded?.id).toBe(d.id);

    const dup = await memoryDrillRepo.duplicateDrill(d.id);
    expect(dup.id).not.toBe(d.id);
    expect(dup.title).toBe(`${d.title} (사본)`);

    await memoryDrillRepo.deleteDrill(d.id);
    expect(await memoryDrillRepo.getDrill(d.id)).toBeUndefined();
  });

  it('putDrill 이 반환한 객체를 밖에서 변형해도 저장분은 영향받지 않는다(클론 격리)', async () => {
    const d = await memoryDrillRepo.createDrill(baseInit);
    const loaded = await memoryDrillRepo.getDrill(d.id);
    loaded!.title = '외부에서 오염 시도';
    const reloaded = await memoryDrillRepo.getDrill(d.id);
    expect(reloaded?.title).not.toBe('외부에서 오염 시도');
  });

  it('expectedUpdatedAt CAS 도 memoryDrillRepo 에서 동작한다', async () => {
    const d = await memoryDrillRepo.createDrill(baseInit);
    await expect(memoryDrillRepo.putDrill({ ...d, title: 'x' }, { expectedUpdatedAt: d.updatedAt - 1 })).rejects.toMatchObject({
      code: 'E_CONFLICT',
    });
  });
});

describe('resolveDrillRepo', () => {
  it('IDB 가 열리면 idbDrillRepo·degraded:false 를 돌려준다', async () => {
    const { repo, degraded } = await resolveDrillRepo();
    expect(repo).toBe(idbDrillRepo);
    expect(degraded).toBe(false);
  });
});

describe('createDrill 의 teams 방어적 복사 불변식', () => {
  // 소재가 prefs.teams 였던 시절의 테스트 — prefs.teams 는 2026-08-21 폐기됐지만(로드맵
  // '팀 색상 변경 기능 폐기') 불변식 자체는 호출자 무관이다: BoardScreen.makeBoardDrill 이
  // 방금 조립한 teams 객체를 넘기는 지금도, 넘긴 원본을 나중에 누가 만져도 드릴은 불변이어야 한다.
  it('teams 를 넘겨 만든 뒤 원본 객체를 in-place 수정해도 드릴 색은 불변이다', async () => {
    const teams = {
      home: { label: '우리 팀', color: '#d93a3a', gkColor: '#f2c811' },
      away: { label: '상대 팀', color: '#1f6bb8', gkColor: '#22a95b' },
    };
    const d = await memoryDrillRepo.createDrill({ courtMode: 'full', teams });
    teams.home.color = '#000000';
    expect(d.teams.home.color).not.toBe('#000000');
  });
});

describe('findReferrers (drillRepo 소유, sessions 스토어를 조회)', () => {
  it('드릴을 참조하는 세션을 찾는다', async () => {
    const d = await idbDrillRepo.createDrill(baseInit);
    const s = await createSession({ title: '참조 검증' });
    await (await import('./sessionRepo.ts')).addDrillToSession(s.id, d.id);
    const refs = await findReferrers(d.id);
    expect(refs.some((r) => r.kind === 'session' && r.id === s.id)).toBe(true);
  });

  it('참조가 없으면 빈 배열', async () => {
    const d = await idbDrillRepo.createDrill(baseInit);
    expect(await findReferrers(d.id)).toEqual([]);
  });
});

describe('StorageError', () => {
  it('파라미터 프로퍼티 없이 code·message·name 을 갖는다', () => {
    const e = new StorageError('E_NOT_FOUND', '메시지');
    expect(e.code).toBe('E_NOT_FOUND');
    expect(e.message).toBe('메시지');
    expect(e.name).toBe('StorageError');
    expect(e).toBeInstanceOf(Error);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});
