// 0.6 커밋 6 — 엔진. 가짜 원격(메모리 파일맵)에 엔진 **두 대**(서로 다른 메모리 SyncStore)를
// 물려 2-기기 수렴을 검증한다: 생성 전파 · 양편집 최신 승 · 삭제 전파 · 삭제 후 편집 부활.
// 충돌 판정 자체는 plan.test.ts 가 표로 전수 검증했다 — 여기서 못박는 것은 "액션 실행과
// 부기(행·톰스톤)가 판정과 맞물려 실제로 **수렴**하는가" 다.
import { describe, expect, it, vi } from 'vitest';
import { createSyncEngine, type SyncDriveApi, type SyncPassResult } from './engine.ts';
import type { SyncStore } from './store.ts';
import type { SyncDocType } from '../storage/syncMeta.ts';
import type { SyncContainer } from './drive.ts';
import { subscribeSyncEvents, type SyncEvent } from '../storage/syncMeta.ts';
import { StorageError, STORAGE_ERROR_MESSAGES } from '../storage/errors.ts';

// ── 가짜 로컬 기기 — SyncStore 를 Map 으로 구현. 문서 자체는 {id, updatedAt, body} 다. ────

interface FakeDoc {
  id: string;
  updatedAt: number;
  body: string;
}

function memoryDevice() {
  const docs = new Map<string, FakeDoc>(); // key: type/id
  const tombs = new Map<string, number>();
  const rows = new Map<string, { lastSyncedAt: number; remoteFileId?: string }>();
  const key = (t: SyncDocType, id: string) => `${t}/${id}`;
  const store: SyncStore = {
    async listLocalDocs() {
      return [...docs.entries()].map(([k, d]) => {
        const [type, id] = [k.split('/')[0] as SyncDocType, k.slice(k.indexOf('/') + 1)];
        return { type, id, updatedAt: d.updatedAt };
      });
    },
    async listLocalTombs() {
      return [...tombs.entries()].map(([k, deletedAt]) => ({
        type: k.split('/')[0] as SyncDocType,
        id: k.slice(k.indexOf('/') + 1),
        deletedAt,
      }));
    },
    async listSyncRows() {
      return [...rows.entries()].map(([k, r]) => ({
        type: k.split('/')[0] as SyncDocType,
        id: k.slice(k.indexOf('/') + 1),
        lastSyncedAt: r.lastSyncedAt,
        remoteFileId: r.remoteFileId,
      }));
    },
    ensureWriterId: async () => writerId,
    getAccountEmail: async () => undefined,
    async markSynced(t, id, row) {
      rows.set(key(t, id), row);
    },
    async clearSyncRow(t, id) {
      rows.delete(key(t, id));
    },
    async clearTombstone(t, id) {
      tombs.delete(key(t, id));
    },
    async readDocForPush(t, id) {
      return docs.get(key(t, id));
    },
    async applyPull(t, id, doc, opts) {
      const incoming = doc as FakeDoc;
      const cur = docs.get(key(t, id));
      if (opts.expectedLocalUpdatedAt !== undefined && cur && cur.updatedAt !== opts.expectedLocalUpdatedAt) return 'conflict';
      docs.set(key(t, id), { ...incoming });
      return 'ok';
    },
    async deleteLocalForSync(t, id, deletedAt) {
      docs.delete(key(t, id));
      tombs.set(key(t, id), deletedAt);
      rows.delete(key(t, id));
    },
    async touchLastSyncAt() {
      /* 가짜 기기는 부기 안 함 */
    },
  };
  let writerId = 'w';
  // 사용자 조작을 흉내내는 헬퍼들
  return {
    store,
    docs,
    tombs,
    rows,
    setWriter(w: string) {
      writerId = w;
    },
    edit(t: SyncDocType, id: string, body: string, updatedAt: number) {
      docs.set(key(t, id), { id, updatedAt, body });
    },
    remove(t: SyncDocType, id: string, deletedAt: number) {
      docs.delete(key(t, id));
      tombs.set(key(t, id), deletedAt);
    },
    doc(t: SyncDocType, id: string) {
      return docs.get(key(t, id));
    },
  };
}

// ── 가짜 원격 — 컨테이너를 파일맵에 담고 목록은 appProperties 동형으로 파생한다. ─────────

function memoryDrive() {
  const files = new Map<string, SyncContainer>();
  let seq = 0;
  const api: SyncDriveApi = {
    async listAll() {
      return {
        files: [...files.entries()].map(([fileId, c]) => ({
          fileId,
          type: c.type,
          id: c.id,
          modifiedAt: c.modifiedAt,
          ...(c.deletedAt !== undefined ? { deletedAt: c.deletedAt } : {}),
          ...(c.writerId ? { writerId: c.writerId } : {}),
        })),
        unrecognized: [],
      };
    },
    async download(_t, fileId) {
      const c = files.get(fileId);
      if (!c) throw new StorageError('E_SYNC_REMOTE', STORAGE_ERROR_MESSAGES.E_SYNC_REMOTE(), { detail: 'HTTP 404' });
      return c;
    },
    async upload(_t, opts) {
      const fileId = opts.fileId ?? `f${++seq}`;
      files.set(fileId, opts.container);
      return { fileId };
    },
    async delete(_t, fileId) {
      files.delete(fileId);
    },
  };
  return { api, files };
}

const auth = () => ({ getToken: vi.fn(async () => 'tok'), invalidateToken: vi.fn() });

/** 두 기기를 조용해질 때까지 번갈아 돌린다 — 수렴하지 않으면 여기서 무한이 아니라 상한에 걸린다. */
async function settle(engines: Array<{ runOnce(): Promise<SyncPassResult | 'busy'> }>, maxRounds = 6): Promise<void> {
  for (let round = 0; round < maxRounds; round++) {
    let activity = 0;
    for (const e of engines) {
      const r = await e.runOnce();
      if (r !== 'busy') activity += r.pushed + r.pulled + r.deletedLocal + r.deletedRemote;
    }
    if (activity === 0) return;
  }
  throw new Error(`${maxRounds} 라운드에도 수렴하지 않았다`);
}

describe('2-기기 수렴', () => {
  it('생성 전파 — A 에서 만든 문서가 B 에 나타나고, 그 뒤로는 조용하다', async () => {
    const remote = memoryDrive();
    const A = memoryDevice();
    const B = memoryDevice();
    A.setWriter('wA');
    B.setWriter('wB');
    const eA = createSyncEngine(A.store, remote.api, auth());
    const eB = createSyncEngine(B.store, remote.api, auth());
    A.edit('drill', 'dr_1', 'A가 만든 드릴', 100);

    const first = (await eA.runOnce()) as SyncPassResult;
    expect(first.pushed).toBe(1);
    const second = (await eB.runOnce()) as SyncPassResult;
    expect(second.pulled).toBe(1);
    expect(B.doc('drill', 'dr_1')).toEqual({ id: 'dr_1', updatedAt: 100, body: 'A가 만든 드릴' });
    await settle([eA, eB]); // 에코 없음 — 즉시 조용
  });

  it('양편집 최신 승 — 서로 다른 문서는 둘 다 살고, 같은 문서는 늦은 쪽이 이긴다', async () => {
    const remote = memoryDrive();
    const A = memoryDevice();
    const B = memoryDevice();
    A.setWriter('wA');
    B.setWriter('wB');
    const eA = createSyncEngine(A.store, remote.api, auth());
    const eB = createSyncEngine(B.store, remote.api, auth());
    // 초기 페어링: 양쪽 각자 보유 — 문서별 합집합
    A.edit('drill', 'dr_mine', 'A만 가진 것', 10);
    B.edit('drill', 'dr_yours', 'B만 가진 것', 20);
    A.edit('drill', 'dr_both', 'A판(옛것)', 30);
    B.edit('drill', 'dr_both', 'B판(최신)', 40);
    await settle([eA, eB]);
    for (const dev of [A, B]) {
      expect(dev.doc('drill', 'dr_mine')?.body).toBe('A만 가진 것');
      expect(dev.doc('drill', 'dr_yours')?.body).toBe('B만 가진 것');
      expect(dev.doc('drill', 'dr_both')?.body).toBe('B판(최신)');
    }
  });

  it('삭제 전파 — A 의 삭제가 B 에 닿고, 원격에는 톰스톤 파일이 남는다(실삭제 아님)', async () => {
    const remote = memoryDrive();
    const A = memoryDevice();
    const B = memoryDevice();
    const eA = createSyncEngine(A.store, remote.api, auth());
    const eB = createSyncEngine(B.store, remote.api, auth());
    A.edit('drill', 'dr_1', '지워질 드릴', 100);
    await settle([eA, eB]);
    expect(B.doc('drill', 'dr_1')).toBeDefined();
    A.remove('drill', 'dr_1', 200);
    await settle([eA, eB]);
    expect(B.doc('drill', 'dr_1')).toBeUndefined();
    expect([...B.tombs.keys()]).toContain('drill/dr_1');
    const tombFiles = [...remote.files.values()].filter((c) => c.id === 'dr_1');
    expect(tombFiles).toHaveLength(1);
    expect(tombFiles[0]!.doc).toBeNull();
    expect(tombFiles[0]!.deletedAt).toBe(200);
  });

  it('삭제 후 편집 부활 — 삭제(t=200)보다 늦은 편집(t=300)이 이겨 양쪽 다 살아난다', async () => {
    const remote = memoryDrive();
    const A = memoryDevice();
    const B = memoryDevice();
    const eA = createSyncEngine(A.store, remote.api, auth());
    const eB = createSyncEngine(B.store, remote.api, auth());
    A.edit('drill', 'dr_1', '원본', 100);
    await settle([eA, eB]);
    A.remove('drill', 'dr_1', 200); // A 는 지웠다
    B.edit('drill', 'dr_1', 'B의 개정판', 300); // B 는 (아직 모른 채) 더 늦게 고쳤다
    await settle([eA, eB]);
    for (const dev of [A, B]) {
      expect(dev.doc('drill', 'dr_1')?.body).toBe('B의 개정판');
    }
    expect([...A.tombs.keys()]).not.toContain('drill/dr_1'); // 부활 pull 이 톰스톤을 정리했다
  });
});

describe('패스의 실패 처리', () => {
  it('토큰 실패(E_SYNC_AUTH)는 패스를 중단하고 auth-required 상태 + invalidateToken', async () => {
    const remote = memoryDrive();
    const A = memoryDevice();
    const deadAuth = {
      getToken: vi.fn(async () => {
        throw new StorageError('E_SYNC_AUTH', STORAGE_ERROR_MESSAGES.E_SYNC_AUTH());
      }),
      invalidateToken: vi.fn(),
    };
    const eA = createSyncEngine(A.store, remote.api, deadAuth);
    await expect(eA.runOnce()).rejects.toMatchObject({ code: 'E_SYNC_AUTH' });
    expect(eA.getStatus().state).toBe('auth-required');
    expect(deadAuth.invalidateToken).toHaveBeenCalled();
    eA.stop();
  });

  it('회선 실패(E_SYNC_NETWORK)는 offline 상태 — online 트리거가 다음 패스를 부른다', async () => {
    const A = memoryDevice();
    const offlineDrive: SyncDriveApi = {
      listAll: async () => {
        throw new StorageError('E_SYNC_NETWORK', STORAGE_ERROR_MESSAGES.E_SYNC_NETWORK());
      },
      download: async () => ({}),
      upload: async () => ({ fileId: 'x' }),
      delete: async () => {},
    };
    const eA = createSyncEngine(A.store, offlineDrive, auth());
    await expect(eA.runOnce()).rejects.toMatchObject({ code: 'E_SYNC_NETWORK' });
    expect(eA.getStatus().state).toBe('offline');
    eA.stop();
  });

  it('액션 하나의 실패는 그 문서만 건너뛴다 — 나머지는 진행되고 다음 패스가 줍는다', async () => {
    const remote = memoryDrive();
    const A = memoryDevice();
    let failures = 0;
    const flaky: SyncDriveApi = {
      ...remote.api,
      upload: async (t, opts) => {
        if (opts.container.id === 'dr_bad' && failures++ === 0) {
          throw new StorageError('E_SYNC_REMOTE', STORAGE_ERROR_MESSAGES.E_SYNC_REMOTE(), { detail: 'HTTP 500' });
        }
        return remote.api.upload(t, opts);
      },
    };
    const eA = createSyncEngine(A.store, flaky, auth());
    A.edit('drill', 'dr_ok', '멀쩡', 10);
    A.edit('drill', 'dr_bad', '한 번 실패', 20);
    const r1 = (await eA.runOnce()) as SyncPassResult;
    expect(r1.pushed).toBe(1);
    expect(r1.skipped).toBe(1);
    const r2 = (await eA.runOnce()) as SyncPassResult; // dirty 재유도 — 행이 없으니 다시 시도된다
    expect(r2.pushed).toBe(1);
    expect([...remote.files.values()].map((c) => c.id).sort()).toEqual(['dr_bad', 'dr_ok']);
    eA.stop();
  });

  it('CAS 충돌(패스 중 사용자 편집)은 skipped 로 세고 로컬을 덮지 않는다', async () => {
    const remote = memoryDrive();
    const A = memoryDevice();
    const B = memoryDevice();
    const eA = createSyncEngine(A.store, remote.api, auth());
    A.edit('drill', 'dr_1', 'A판', 100);
    await eA.runOnce();
    // B 는 옛 판(50)을 갖고 있는데, 계획 후 실행 전에 사용자가 60으로 고친 상황을 흉내낸다:
    // applyPull 의 CAS 기대값(50)과 어긋나 conflict 가 난다.
    B.edit('drill', 'dr_1', 'B의 편집(패스 중)', 50);
    const origApply = B.store.applyPull.bind(B.store);
    B.store.applyPull = async (t, id, doc, opts) => {
      B.edit('drill', 'dr_1', 'B의 편집(패스 중)', 60); // 실행 직전 사용자 편집
      return origApply(t, id, doc, opts);
    };
    const r = (await createSyncEngine(B.store, remote.api, auth()).runOnce()) as SyncPassResult;
    expect(r.skipped).toBe(1);
    expect(B.doc('drill', 'dr_1')?.body).toBe('B의 편집(패스 중)');
  });
});

describe('동시성·방송', () => {
  it('같은 엔진의 동시 runOnce 는 한쪽이 busy 다', async () => {
    const remote = memoryDrive();
    const A = memoryDevice();
    let release!: () => void;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const slowDrive: SyncDriveApi = {
      ...remote.api,
      listAll: async (t) => {
        await gate;
        return remote.api.listAll(t);
      },
    };
    const eA = createSyncEngine(A.store, slowDrive, auth());
    const p1 = eA.runOnce();
    const p2 = eA.runOnce();
    release();
    const [r1, r2] = await Promise.all([p1, p2]);
    expect([r1, r2].filter((r) => r === 'busy')).toHaveLength(1);
    eA.stop();
  });

  it("패스 종료 방송 {op:'pass'} — pulled 에는 내려받기와 로컬 삭제 반영이 함께 실린다", async () => {
    const remote = memoryDrive();
    const A = memoryDevice();
    const events: SyncEvent[] = [];
    const off = subscribeSyncEvents((e) => {
      if (e.op === 'pass') events.push(e);
    });
    await remote.api.upload('tok', { container: { sync: 1, type: 'drill', id: 'dr_r', modifiedAt: 5, writerId: 'wX', doc: { id: 'dr_r', updatedAt: 5, body: '원격 것' } } });
    const eA = createSyncEngine(A.store, remote.api, auth());
    await eA.runOnce();
    off();
    expect(events).toEqual([{ op: 'pass', pushed: 0, pulled: 1 }]);
    eA.stop();
  });
});
