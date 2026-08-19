// 0.6 Drive 동기화 — 엔진이 로컬 저장소에 대해 아는 전부(SyncStore)와 그 실물 배선.
//
// 인터페이스로 가른 이유: 2-기기 수렴 테스트(engine.test.ts)는 **서로 다른 로컬**을 가진 엔진
// 두 개를 같은 가짜 원격에 물려야 하는데, fake-indexeddb 는 파일당 하나라 실물로는 기기를
// 두 개 만들 수 없다. 엔진은 이 인터페이스만 알고, 실물(createIdbSyncStore)은 여기서 리포에
// 배선한다.
//
// pull 쓰기의 관문: 원격 doc 은 **문서 원형**이라(자기 schemaVersion 포함) 백업 복원과 같은
// migrateDoc + validate 를 지난다. too-new(더 새 앱이 쓴 문서)는 invalid(손상)와 갈라
// 보고한다 — too-new 는 "앱 업데이트 필요" 안내 대상이고, 절대 다운그레이드해 쓰지 않는다.
import { getDB, beginWrite, endWrite, toStorageError } from '../storage/db.ts';
import { idbDrillRepo } from '../storage/drillRepo.ts';
import { putSession } from '../storage/sessionRepo.ts';
import { saveRoster } from '../storage/rosterRepo.ts';
import {
  deleteSyncDocRow,
  deleteTombstone,
  docRowKey,
  ensureWriterId,
  getSyncDeviceMeta,
  listSyncDocRows,
  listTombstones,
  putSyncDeviceMeta,
  putSyncDocRow,
  tombstoneRecord,
  type SyncDocRow,
  type SyncDocType,
} from '../storage/syncMeta.ts';
import { migrateDoc, DRILL_MIGRATIONS, SESSION_MIGRATIONS, ROSTER_MIGRATIONS } from '../model/migrate.ts';
import { CURRENT_DRILL_SCHEMA } from '../model/drill.ts';
import { CURRENT_SESSION_SCHEMA } from '../model/session.ts';
import { CURRENT_ROSTER_SCHEMA } from '../model/roster.ts';
import { validateDrill, validateSession, validateRoster } from '../model/validate.ts';
import { StorageError } from '../storage/errors.ts';
import type { PlanLocalDoc, PlanLocalTomb, PlanSyncRow } from './plan.ts';
import type { DrillId, SessionId } from '../core/ids.ts';

export type PullApplyResult = 'ok' | 'conflict' | 'invalid' | 'too-new';

export interface SyncStore {
  listLocalDocs(): Promise<PlanLocalDoc[]>;
  listLocalTombs(): Promise<PlanLocalTomb[]>;
  listSyncRows(): Promise<PlanSyncRow[]>;
  ensureWriterId(): Promise<string>;
  getAccountEmail(): Promise<string | undefined>;
  markSynced(type: SyncDocType, id: string, row: SyncDocRow): Promise<void>;
  clearSyncRow(type: SyncDocType, id: string): Promise<void>;
  clearTombstone(type: SyncDocType, id: string): Promise<void>;
  /** push 에 실을 원본. 백업(collectBackup)과 같은 규율로 **날것 그대로** — 손상본을 여기서
   *  거르면 다른 기기에서 고칠 기회까지 잃는다. 관문은 받는 쪽(applyPull)에 있다. */
  readDocForPush(type: SyncDocType, id: string): Promise<unknown>;
  /** 원격 문서를 로컬에 쓴다. expectedLocalUpdatedAt 은 CAS — 계획 후 실행 전의 사용자 편집을
   *  'conflict' 로 돌려주고 그 문서만 스킵된다(다음 패스가 재평가). */
  applyPull(type: SyncDocType, id: string, doc: unknown, opts: { expectedLocalUpdatedAt?: number }): Promise<PullApplyResult>;
  /** 원격 삭제의 로컬 반영: 문서를 지우고(이미 없으면 그대로) 톰스톤을 **원격 deletedAt** 로
   *  맞춘 뒤 행을 정리한다 — repo 삭제(Date.now() 톰스톤)를 쓰면 방금 받은 삭제가 "더 새
   *  삭제" 가 되어 에코 push 가 한 번 더 돈다(plan.ts deleteLocal 주석). */
  deleteLocalForSync(type: SyncDocType, id: string, deletedAt: number): Promise<void>;
  touchLastSyncAt(at: number): Promise<void>;
}

export function createIdbSyncStore(): SyncStore {
  return {
    async listLocalDocs() {
      const db = await getDB();
      const out: PlanLocalDoc[] = [];
      // 드릴은 요약(전량 메모리 로드가 이 앱의 기본 전략 — drillRepo 머리말)에서 시각만 뽑는다.
      for (const s of await db.getAll('drillSummaries')) out.push({ type: 'drill', id: s.id, updatedAt: s.updatedAt });
      for (const s of await db.getAll('sessions')) out.push({ type: 'session', id: s.id, updatedAt: s.updatedAt });
      // 명단은 저장된 적이 있을 때만 목록에 넣는다 — emptyRoster() 폴백(updatedAt 0)을 문서로
      // 취급하면 "빈 명단" 이 원격의 진짜 명단과 겨루게 된다. 없으면 원격 것이 pullCreate 로 온다.
      const rosterRec = await db.get('meta', 'roster');
      if (rosterRec) {
        const updatedAt = (rosterRec.value as { updatedAt?: number }).updatedAt;
        if (typeof updatedAt === 'number') out.push({ type: 'roster', id: 'roster', updatedAt });
      }
      return out;
    },
    listLocalTombs: listTombstones,
    async listSyncRows() {
      return (await listSyncDocRows()).map(({ type, id, row }) => ({ type, id, lastSyncedAt: row.lastSyncedAt, remoteFileId: row.remoteFileId }));
    },
    ensureWriterId,
    async getAccountEmail() {
      return (await getSyncDeviceMeta())?.accountEmail;
    },
    markSynced: putSyncDocRow,
    clearSyncRow: deleteSyncDocRow,
    clearTombstone: deleteTombstone,
    async readDocForPush(type, id) {
      const db = await getDB();
      if (type === 'drill') return db.get('drills', id as DrillId);
      if (type === 'session') return db.get('sessions', id as SessionId);
      return (await db.get('meta', 'roster'))?.value;
    },
    async applyPull(type, id, doc, opts) {
      const cas = opts.expectedLocalUpdatedAt !== undefined ? { expectedUpdatedAt: opts.expectedLocalUpdatedAt } : {};
      try {
        if (type === 'drill') {
          const mig = migrateDoc(doc, DRILL_MIGRATIONS, CURRENT_DRILL_SCHEMA);
          if (!mig.ok) return mig.reason === 'too-new' ? 'too-new' : 'invalid';
          const v = validateDrill(mig.doc);
          if (!v.ok) return 'invalid';
          if (v.value.id !== id) return 'invalid'; // 컨테이너 id 와 문서 id 가 어긋난 파일은 신뢰하지 않는다
          await idbDrillRepo.putDrill(v.value, { touch: false, ...cas });
          return 'ok';
        }
        if (type === 'session') {
          const mig = migrateDoc(doc, SESSION_MIGRATIONS, CURRENT_SESSION_SCHEMA);
          if (!mig.ok) return mig.reason === 'too-new' ? 'too-new' : 'invalid';
          const v = validateSession(mig.doc);
          if (!v.ok) return 'invalid';
          if (v.value.id !== id) return 'invalid';
          await putSession(v.value, { touch: false, ...cas });
          return 'ok';
        }
        const mig = migrateDoc(doc, ROSTER_MIGRATIONS, CURRENT_ROSTER_SCHEMA);
        if (!mig.ok) return mig.reason === 'too-new' ? 'too-new' : 'invalid';
        const v = validateRoster(mig.doc);
        if (!v.ok) return 'invalid';
        // 명단은 단일 문서 통저장 — saveRoster 는 updatedAt 을 건드리지 않으므로(들어온 값
        // 그대로) 원격 시각이 보존된다. CAS 는 없다: 마지막 승자 통짜 문서라 잃을 부분이 없다.
        await saveRoster(v.value);
        return 'ok';
      } catch (e) {
        if (e instanceof StorageError && e.code === 'E_CONFLICT') return 'conflict';
        throw e;
      }
    },
    async deleteLocalForSync(type, id, deletedAt) {
      if (type === 'roster') return; // 명단에는 삭제 경로가 없다(비우기도 put) — 올 수 없는 액션
      const db = await getDB();
      beginWrite();
      try {
        if (type === 'drill') {
          const tx = db.transaction(['drills', 'drillSummaries', 'meta'], 'readwrite');
          tx.objectStore('drills').delete(id as DrillId);
          tx.objectStore('drillSummaries').delete(id as DrillId);
          tx.objectStore('meta').put(tombstoneRecord('drill', id, deletedAt));
          tx.objectStore('meta').delete(docRowKey('drill', id));
          await tx.done;
        } else {
          const tx = db.transaction(['sessions', 'meta'], 'readwrite');
          tx.objectStore('sessions').delete(id as SessionId);
          tx.objectStore('meta').put(tombstoneRecord('session', id, deletedAt));
          tx.objectStore('meta').delete(docRowKey('session', id));
          await tx.done;
        }
      } catch (e) {
        throw toStorageError(e, 'E_DB_UNAVAILABLE');
      } finally {
        endWrite();
      }
    },
    async touchLastSyncAt(at) {
      const cur = await getSyncDeviceMeta();
      if (!cur) return; // writerId 도 없는 상태 — 패스가 돌았다면 있을 수밖에 없지만 방어
      await putSyncDeviceMeta({ ...cur, lastSyncAt: at });
    },
  };
}
