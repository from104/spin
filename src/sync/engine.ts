// 0.6 Drive 동기화 — 엔진. 하는 일은 하나다: 스냅샷을 모아 planSync 에 넣고, 나온 액션을
// 실행하고, 결과를 부기하고 방송한다. 충돌 판정은 전부 plan.ts(순수), 저장소는 store.ts,
// 네트워크는 drive.ts, 토큰은 auth.ts — 엔진은 그 넷의 오케스트레이션만 안다.
//
// 실행권: Web Locks('spin.sync', ifAvailable) — 두 탭이 동시에 패스를 돌리지 않는다. 락을
// 못 잡으면 그냥 넘어간다(runOnce → 'busy'): 잡은 쪽이 같은 일을 하고 있고, dirty 는 상태가
// 아니라 재유도라 놓친 것은 다음 패스가 줍는다. Web Locks 가 없는 환경(구형)은 모듈 내
// 불리언으로 같은 탭 중복만 막는다 — 탭 간 중복 업로드는 최악이라도 같은 내용 덮어쓰기다.
//
// 실패 격리: 액션 하나의 실패는 그 문서만 스킵하고 패스는 계속 간다. 단 E_SYNC_AUTH 는
// 토큰이 죽은 것이라 남은 액션 전부가 같은 이유로 죽는다 — 패스를 중단하고 상태를
// 'auth-required' 로 바꾼다(설정 화면의 '재연결' 칩). E_SYNC_NETWORK 는 'offline' — online
// 이벤트가 다음 패스를 부른다. 그 밖(REMOTE·QUOTA)은 지수 백오프(2^n s, cap 60s)로 재시도.
import { StorageError, type StorageErrorCode } from '../storage/errors.ts';
import { postSyncEvent } from '../storage/syncMeta.ts';
import { planSync, type SyncAction } from './plan.ts';
import type { SyncStore } from './store.ts';
import { parseSyncContainer, SYNC_CONTAINER_VERSION, type SyncContainer } from './drive.ts';
import type { PlanRemoteFile } from './plan.ts';

/** drive.ts 의 네 호출 — 테스트가 메모리 가짜 원격으로 통째 대체한다. */
export interface SyncDriveApi {
  listAll(token: string): Promise<{ files: PlanRemoteFile[]; unrecognized: string[] }>;
  download(token: string, fileId: string): Promise<unknown>;
  upload(token: string, opts: { fileId?: string; container: SyncContainer }): Promise<{ fileId: string }>;
  delete(token: string, fileId: string): Promise<void>;
}

export interface SyncAuthApi {
  getToken(loginHint?: string): Promise<string>;
  invalidateToken(): void;
}

export interface SyncPassResult {
  pushed: number;
  pulled: number;
  deletedLocal: number;
  deletedRemote: number;
  /** CAS 충돌·invalid·too-new 로 이번 패스에서 건너뛴 문서 수 — 다음 패스가 재평가한다. */
  skipped: number;
  /** too-new 를 하나라도 만났다 — "앱을 업데이트하세요" 안내 대상. */
  sawTooNew: boolean;
}

export type SyncEngineState = 'idle' | 'running' | 'auth-required' | 'offline' | 'error';

export interface SyncEngineStatus {
  state: SyncEngineState;
  lastSyncAt?: number;
  lastResult?: SyncPassResult;
  lastErrorCode?: StorageErrorCode;
}

export interface SyncEngine {
  /** 한 패스. 'busy' = 다른 실행자가 돌고 있어 건너뜀(정상 — 다음 트리거가 줍는다). */
  runOnce(): Promise<SyncPassResult | 'busy'>;
  /** 디바운스 push 트리거(쓰기 방송·수동 버튼). */
  requestPass(): void;
  /** 디바운스를 취소하고 즉시 — visibilitychange:hidden 의 flush(useAutosave 전례). */
  flushNow(): Promise<void>;
  getStatus(): SyncEngineStatus;
  subscribeStatus(cb: (s: SyncEngineStatus) => void): () => void;
  /** 트리거 해제 + 대기 중 타이머 취소. 이미 도는 패스는 끝까지 간다(중간 중단이 더 위험). */
  stop(): void;
}

const DEBOUNCE_MS = 3_000;
const BACKOFF_BASE_MS = 1_000;
const BACKOFF_CAP_MS = 60_000;
/** 액션 동시 실행 상한 — Drive 가 병렬을 잘 받지만 3이면 충분히 겹치고 429 를 부르지 않는다. */
const CONCURRENCY = 3;

/** 패스 하나를 중단시키는 예외 표식(E_SYNC_AUTH·NETWORK) — 문서 단위 고립 대상이 아니다. */
class AbortPass extends Error {
  readonly cause2: StorageError;
  constructor(cause: StorageError) {
    super(cause.message);
    this.cause2 = cause;
  }
}

export function createSyncEngine(store: SyncStore, drive: SyncDriveApi, auth: SyncAuthApi): SyncEngine {
  let status: SyncEngineStatus = { state: 'idle' };
  const listeners = new Set<(s: SyncEngineStatus) => void>();
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  let backoffTimer: ReturnType<typeof setTimeout> | undefined;
  let backoffExp = 0;
  let stopped = false;
  let localRunning = false; // Web Locks 부재 환경의 같은 탭 이중 실행 방지

  function setStatus(next: SyncEngineStatus): void {
    status = next;
    for (const cb of listeners) {
      try {
        cb(status);
      } catch {
        /* 구독자 사정 */
      }
    }
  }

  async function executeAction(token: string, writerId: string, a: SyncAction, result: SyncPassResult): Promise<void> {
    switch (a.kind) {
      case 'pushCreate':
      case 'pushUpdate': {
        const doc = await store.readDocForPush(a.type, a.id);
        if (doc === undefined) {
          // 계획과 실행 사이에 로컬에서 지워졌다 — 다음 패스가 톰스톤으로 재평가한다.
          result.skipped++;
          return;
        }
        const container: SyncContainer = { sync: SYNC_CONTAINER_VERSION, type: a.type, id: a.id, modifiedAt: a.updatedAt, writerId, doc };
        const { fileId } = await drive.upload(token, { ...(a.kind === 'pushUpdate' ? { fileId: a.fileId } : {}), container });
        await store.markSynced(a.type, a.id, { lastSyncedAt: a.updatedAt, remoteFileId: fileId });
        result.pushed++;
        return;
      }
      case 'pushTomb': {
        const container: SyncContainer = {
          sync: SYNC_CONTAINER_VERSION,
          type: a.type,
          id: a.id,
          modifiedAt: a.deletedAt,
          deletedAt: a.deletedAt,
          writerId,
          doc: null,
        };
        await drive.upload(token, { fileId: a.fileId, container });
        // 삭제에 원격도 합의했다 — 행은 끝. 톰스톤 자체는 남는다(90일 GC 몫): 다른 기기가
        // 아직 안 봤을 수 있고, 지우면 그 기기의 옛 문서가 pullCreate 로 되살아난다.
        await store.clearSyncRow(a.type, a.id);
        result.deletedRemote++;
        return;
      }
      case 'pullCreate':
      case 'pullUpdate': {
        const body = await drive.download(token, a.fileId);
        const parsed = parseSyncContainer(body);
        if (!parsed.ok) {
          result.skipped++;
          if (parsed.reason === 'too-new') result.sawTooNew = true;
          return;
        }
        const applied = await store.applyPull(a.type, a.id, parsed.container.doc, {
          ...(a.kind === 'pullUpdate' && a.expectedLocalUpdatedAt !== undefined ? { expectedLocalUpdatedAt: a.expectedLocalUpdatedAt } : {}),
        });
        if (applied !== 'ok') {
          result.skipped++;
          if (applied === 'too-new') result.sawTooNew = true;
          return;
        }
        if (a.kind === 'pullUpdate' && a.clearTomb) await store.clearTombstone(a.type, a.id);
        await store.markSynced(a.type, a.id, { lastSyncedAt: a.modifiedAt, remoteFileId: a.fileId });
        result.pulled++;
        return;
      }
      case 'deleteLocal': {
        await store.deleteLocalForSync(a.type, a.id, a.deletedAt);
        result.deletedLocal++;
        return;
      }
      case 'markSynced': {
        await store.markSynced(a.type, a.id, { lastSyncedAt: a.at, remoteFileId: a.fileId });
        return;
      }
      case 'clearTomb': {
        await store.clearTombstone(a.type, a.id);
        return;
      }
      case 'clearRow': {
        await store.clearSyncRow(a.type, a.id);
        return;
      }
      case 'dropRemoteDup': {
        await drive.delete(token, a.fileId);
        return;
      }
    }
  }

  async function runPass(): Promise<SyncPassResult> {
    const email = await store.getAccountEmail();
    let token: string;
    try {
      token = await auth.getToken(email);
    } catch (e) {
      throw e instanceof StorageError ? new AbortPass(e) : e;
    }
    const writerId = await store.ensureWriterId();
    const { files } = await drive.listAll(token);
    const [localDocs, localTombs, syncRows] = await Promise.all([store.listLocalDocs(), store.listLocalTombs(), store.listSyncRows()]);
    const actions = planSync({ localDocs, localTombs, syncRows, remoteFiles: files, writerId });

    const result: SyncPassResult = { pushed: 0, pulled: 0, deletedLocal: 0, deletedRemote: 0, skipped: 0, sawTooNew: false };
    const queue = [...actions];
    let aborted: AbortPass | null = null;
    const worker = async (): Promise<void> => {
      for (;;) {
        const a = queue.shift();
        if (!a || aborted) return;
        try {
          await executeAction(token, writerId, a, result);
        } catch (e) {
          if (e instanceof StorageError && (e.code === 'E_SYNC_AUTH' || e.code === 'E_SYNC_NETWORK')) {
            // 토큰이 죽었거나 회선이 끊겼다 — 남은 액션 전부가 같은 이유로 죽는다. 중단.
            aborted = new AbortPass(e);
            return;
          }
          // 문서 단위 고립 — 이 문서만 다음 패스로 미룬다. 행이 안 갱신됐으므로 재유도가 줍는다.
          result.skipped++;
        }
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    if (aborted) throw aborted;
    await store.touchLastSyncAt(Date.now());
    return result;
  }

  async function runOnce(): Promise<SyncPassResult | 'busy'> {
    if (localRunning) return 'busy';
    const locks = (globalThis.navigator as { locks?: LockManager } | undefined)?.locks;
    const run = async (): Promise<SyncPassResult | 'busy'> => {
      localRunning = true;
      setStatus({ ...status, state: 'running' });
      try {
        const result = await runPass();
        backoffExp = 0;
        setStatus({ state: 'idle', lastSyncAt: Date.now(), lastResult: result });
        postSyncEvent({ op: 'pass', pushed: result.pushed, pulled: result.pulled + result.deletedLocal });
        return result;
      } catch (e) {
        const cause = e instanceof AbortPass ? e.cause2 : e instanceof StorageError ? e : undefined;
        if (cause?.code === 'E_SYNC_AUTH') {
          auth.invalidateToken();
          setStatus({ ...status, state: 'auth-required', lastErrorCode: cause.code });
        } else if (cause?.code === 'E_SYNC_NETWORK') {
          setStatus({ ...status, state: 'offline', lastErrorCode: cause.code });
        } else {
          setStatus({ ...status, state: 'error', lastErrorCode: cause?.code ?? 'E_SYNC_REMOTE' });
          scheduleBackoff();
        }
        throw e instanceof AbortPass ? e.cause2 : e;
      } finally {
        localRunning = false;
      }
    };
    if (locks) {
      // ifAvailable — 못 잡으면 즉시 null 콜백: 다른 탭이 돌고 있다. 건너뛴다.
      return locks.request('spin.sync', { ifAvailable: true }, async (lock) => (lock ? run() : ('busy' as const)));
    }
    return run();
  }

  function scheduleBackoff(): void {
    if (stopped) return;
    if (backoffTimer !== undefined) clearTimeout(backoffTimer);
    const delay = Math.min(BACKOFF_BASE_MS * 2 ** backoffExp, BACKOFF_CAP_MS);
    backoffExp = Math.min(backoffExp + 1, 6); // 2^6 = 64s > cap — 그 위로는 의미 없다
    backoffTimer = setTimeout(() => {
      backoffTimer = undefined;
      void runOnce().catch(() => {
        /* 상태로 이미 표면화 — 재시도는 scheduleBackoff 가 다시 건다 */
      });
    }, delay);
  }

  return {
    runOnce,
    requestPass() {
      if (stopped) return;
      if (debounceTimer !== undefined) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        debounceTimer = undefined;
        void runOnce().catch(() => {
          /* 상태로 표면화 */
        });
      }, DEBOUNCE_MS);
    },
    async flushNow() {
      if (debounceTimer !== undefined) {
        clearTimeout(debounceTimer);
        debounceTimer = undefined;
      }
      await runOnce().catch(() => {
        /* 상태로 표면화 */
      });
    },
    getStatus: () => status,
    subscribeStatus(cb) {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    stop() {
      stopped = true;
      if (debounceTimer !== undefined) clearTimeout(debounceTimer);
      if (backoffTimer !== undefined) clearTimeout(backoffTimer);
      debounceTimer = backoffTimer = undefined;
    },
  };
}
