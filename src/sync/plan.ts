// 0.6 Drive 동기화 — 충돌 판정의 전부가 이 순수 함수 안에 있다. I/O 0, Date.now() 0.
//
// 엔진(engine.ts)은 "로컬·원격 스냅샷을 모아 planSync 에 넣고, 나온 액션을 실행한다" 뿐이다.
// 판정을 순수 함수로 가둔 이유: 동기화 버그의 값은 데이터 유실이고, 유실 시나리오는 네트워크
// 없이 표(plan.test.ts)로 전수 검증할 수 있어야 한다.
//
// 규칙(계획서 §알고리즘, 승인 2026-08-20):
//   L = 로컬 톰스톤.deletedAt ?? 로컬 문서.updatedAt      (없으면 -∞)
//   R = 원격 톰스톤.deletedAt ?? 원격 문서.modifiedAt     (없으면 -∞)
//   원격 없음:  로컬이 톰스톤이면 clearTomb, 산 문서면 pushCreate
//   로컬 없음:  원격이 톰스톤이면 clearRow(행이 있을 때만), 산 문서면 pullCreate
//   둘 다 있음: 승자 = max(L,R). 동률은 writerId 사전순 큰 쪽 — 어느 기기에서 계산해도
//               같은 답이 나오는 결정적 수렴이 목적이다(누가 이기느냐 자체는 중요하지 않다).
//     로컬 승:  로컬이 톰스톤이면 pushTomb, 아니면 pushUpdate
//     원격 승:  원격이 톰스톤이면 deleteLocal, 아니면 pullUpdate
//     같음(같은 상태): 행(lastSyncedAt)이 어긋나 있으면 markSynced 로 부기만 맞춘다
//
// "dirty 플래그" 는 어디에도 없다 — 이 함수는 매 패스 전체 스냅샷에서 할 일을 재유도한다.
// 그래서 이전 패스가 어디서 끊겼든(크래시·토큰 만료·탭 닫힘) 다음 패스가 반드시 줍는다.
import type { SyncDocType } from '../storage/syncMeta.ts';

export interface PlanLocalDoc {
  type: SyncDocType;
  id: string;
  updatedAt: number;
}

export interface PlanLocalTomb {
  type: SyncDocType;
  id: string;
  deletedAt: number;
}

export interface PlanSyncRow {
  type: SyncDocType;
  id: string;
  lastSyncedAt: number;
  remoteFileId?: string;
}

/** files.list 가 appProperties 로 돌려주는 원격 파일 하나의 요약 — 본문 없이 이것만으로
 *  계획을 세운다(본문 다운로드는 pull 로 확정된 문서만). */
export interface PlanRemoteFile {
  fileId: string;
  type: SyncDocType;
  id: string;
  /** 문서의 수정 시각(appProperties.m) — Drive 자체의 modifiedTime 이 아니다. */
  modifiedAt: number;
  /** 있으면 이 파일은 톰스톤(doc:null)이다(appProperties.d). */
  deletedAt?: number;
  /** 마지막으로 쓴 기기(appProperties.w). 동률 tie-break 에만 쓴다. */
  writerId?: string;
}

export type SyncAction =
  /** 원격에 없던 문서를 새 파일로 올린다. 성공 시 행 {lastSyncedAt:updatedAt, remoteFileId:새 id}. */
  | { kind: 'pushCreate'; type: SyncDocType; id: string; updatedAt: number }
  /** 기존 원격 파일을 로컬 문서로 갱신한다(원격이 톰스톤이었다면 부활). */
  | { kind: 'pushUpdate'; type: SyncDocType; id: string; updatedAt: number; fileId: string }
  /** 기존 원격 파일을 doc:null 톰스톤으로 갱신한다 — 파일 삭제가 아니다("없음=미업로드 신규" 와의 모호성 제거). */
  | { kind: 'pushTomb'; type: SyncDocType; id: string; deletedAt: number; fileId: string }
  /** 원격 문서를 내려받아 로컬에 새로 쓴다. */
  | { kind: 'pullCreate'; type: SyncDocType; id: string; modifiedAt: number; fileId: string }
  /** 원격 문서로 로컬을 덮는다. expectedLocalUpdatedAt 은 CAS — 계획 후 실행 전에 사용자가
   *  편집했으면 그 문서만 스킵된다. clearTomb 는 "로컬 톰스톤 위로의 부활" 표식. */
  | { kind: 'pullUpdate'; type: SyncDocType; id: string; modifiedAt: number; fileId: string; expectedLocalUpdatedAt?: number; clearTomb?: boolean }
  /** 원격 삭제를 로컬에 반영한다: 문서를 지우고(이미 없으면 그대로) 로컬 톰스톤 시각을
   *  원격 deletedAt 로 맞춘다 — repo 삭제(Date.now() 톰스톤)를 그대로 쓰면 방금 받은 삭제가
   *  "더 새 삭제" 가 되어 에코 push 가 한 번 더 돈다. */
  | { kind: 'deleteLocal'; type: SyncDocType; id: string; deletedAt: number; fileId: string }
  /** 전송 없음 — 행(lastSyncedAt·remoteFileId)만 맞춘다. */
  | { kind: 'markSynced'; type: SyncDocType; id: string; at: number; fileId: string }
  /** 원격에 아무것도 없다 — 지역 톰스톤 정리(전파할 곳이 없다: 업로드 전에 지웠거나 GC 뒤). */
  | { kind: 'clearTomb'; type: SyncDocType; id: string }
  /** 로컬에 아무것도 없고 원격은 톰스톤 — 남은 행 정리. */
  | { kind: 'clearRow'; type: SyncDocType; id: string }
  /** 같은 (type,id) 의 원격 중복 파일 중 옛것 — 실삭제한다(동시 pushCreate 레이스의 산물). */
  | { kind: 'dropRemoteDup'; type: SyncDocType; id: string; fileId: string };

export interface PlanInputs {
  localDocs: readonly PlanLocalDoc[];
  localTombs: readonly PlanLocalTomb[];
  syncRows: readonly PlanSyncRow[];
  remoteFiles: readonly PlanRemoteFile[];
  /** 이 기기의 writerId (syncMeta.ensureWriterId). */
  writerId: string;
}

const keyOf = (type: SyncDocType, id: string): string => `${type}/${id}`;

/** 원격 파일의 유효 시각 — 톰스톤이면 deletedAt. */
const remoteAt = (f: PlanRemoteFile): number => f.deletedAt ?? f.modifiedAt;

export function planSync(inputs: PlanInputs): SyncAction[] {
  const docs = new Map<string, PlanLocalDoc>();
  for (const d of inputs.localDocs) docs.set(keyOf(d.type, d.id), d);
  const tombs = new Map<string, PlanLocalTomb>();
  for (const t of inputs.localTombs) tombs.set(keyOf(t.type, t.id), t);
  const rows = new Map<string, PlanSyncRow>();
  for (const r of inputs.syncRows) rows.set(keyOf(r.type, r.id), r);

  // 같은 (type,id) 의 원격 중복 파일 — 두 기기가 동시에 pushCreate 하면 생긴다. 최신 하나만
  // 남기고(동률은 fileId 사전순 큰 쪽 — 역시 결정적이기만 하면 된다) 나머지는 실삭제 대상.
  const remote = new Map<string, PlanRemoteFile>();
  const dups: PlanRemoteFile[] = [];
  for (const f of inputs.remoteFiles) {
    const k = keyOf(f.type, f.id);
    const cur = remote.get(k);
    if (!cur) {
      remote.set(k, f);
      continue;
    }
    const fWins = remoteAt(f) > remoteAt(cur) || (remoteAt(f) === remoteAt(cur) && f.fileId > cur.fileId);
    if (fWins) {
      dups.push(cur);
      remote.set(k, f);
    } else {
      dups.push(f);
    }
  }

  const keys = new Set<string>([...docs.keys(), ...tombs.keys(), ...remote.keys()]);
  const actions: SyncAction[] = [];

  for (const k of [...keys].sort()) {
    const doc = docs.get(k);
    const tomb = tombs.get(k);
    const row = rows.get(k);
    const rem = remote.get(k);

    // 로컬 상태 하나로 접기. 문서와 톰스톤이 동시에 있는 것은 정상 상태가 아니지만(부활 pull
    // 성공과 톰스톤 정리 사이의 크래시 창) 일어날 수 있다 — 그때는 더 최신 쪽이 이 기기의
    // 진의다. 계획서의 `deletedAt ?? updatedAt` 보다 이 쪽이 엄격히 안전하다(오래된 톰스톤이
    // 방금 부활한 문서를 다시 지우는 사고를 막는다).
    const type = (doc ?? tomb ?? rem)!.type;
    const id = (doc ?? tomb ?? rem)!.id;
    const localDeleted = tomb !== undefined && (doc === undefined || tomb.deletedAt > doc.updatedAt);
    const L = doc === undefined && tomb === undefined ? undefined : localDeleted ? tomb!.deletedAt : doc!.updatedAt;

    if (rem === undefined) {
      if (L === undefined) continue; // 있을 수 없지만(keys 는 셋의 합집합) 타입 좁히기 겸 방어
      actions.push(localDeleted ? { kind: 'clearTomb', type, id } : { kind: 'pushCreate', type, id, updatedAt: L });
      continue;
    }

    const R = remoteAt(rem);
    const remoteDeleted = rem.deletedAt !== undefined;

    if (L === undefined) {
      if (remoteDeleted) {
        if (row) actions.push({ kind: 'clearRow', type, id });
      } else {
        actions.push({ kind: 'pullCreate', type, id, modifiedAt: rem.modifiedAt, fileId: rem.fileId });
      }
      continue;
    }

    // 둘 다 있음 — 같은 상태면 부기만, 아니면 최신 승.
    if (L === R && localDeleted === remoteDeleted) {
      if (localDeleted) {
        // 삭제에 합의 — 행은 더 이상 필요 없다(톰스톤 자체의 정리는 엔진의 90일 GC 몫).
        if (row) actions.push({ kind: 'clearRow', type, id });
      } else if (!row || row.lastSyncedAt !== L || row.remoteFileId !== rem.fileId) {
        actions.push({ kind: 'markSynced', type, id, at: L, fileId: rem.fileId });
      }
      continue;
    }

    // 동률인데 상태가 다르면(같은 ms 에 한쪽은 편집, 한쪽은 삭제) writerId 사전순 큰 쪽.
    // 원격 writerId 가 없거나(구버전 파일) 우리 자신이면 로컬 승 — 우리 로컬이 우리의 최신이다.
    const localWins = L > R || (L === R && !(rem.writerId !== undefined && rem.writerId !== inputs.writerId && rem.writerId > inputs.writerId));

    if (localWins) {
      actions.push(
        localDeleted
          ? { kind: 'pushTomb', type, id, deletedAt: L, fileId: rem.fileId }
          : { kind: 'pushUpdate', type, id, updatedAt: L, fileId: rem.fileId },
      );
    } else if (remoteDeleted) {
      actions.push({ kind: 'deleteLocal', type, id, deletedAt: rem.deletedAt!, fileId: rem.fileId });
    } else {
      actions.push({
        kind: 'pullUpdate',
        type,
        id,
        modifiedAt: rem.modifiedAt,
        fileId: rem.fileId,
        ...(doc !== undefined && !localDeleted ? { expectedLocalUpdatedAt: doc.updatedAt } : {}),
        ...(localDeleted ? { clearTomb: true } : {}),
      });
    }
  }

  for (const f of dups.sort((a, b) => (a.fileId < b.fileId ? -1 : 1))) {
    actions.push({ kind: 'dropRemoteDup', type: f.type, id: f.id, fileId: f.fileId });
  }

  return actions;
}
