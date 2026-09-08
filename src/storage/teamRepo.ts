// 팀 저장소 ([팀] 메뉴, 2026-09-09 · PLAN-TEAM.md 결정 2) — `teams` 스토어(DB_VERSION 2).
//
// **왜 팀마다 문서인가**(rosterRepo 의 '단일 문서' 판단을 뒤집은 자리): 팀이 여럿이 되는 순간
// 목록 정렬·부분 갱신이 생기고, 한 덩어리 레코드면 한 팀이 깨질 때 전부를 잃는다. 문서를 가르면
// 손상은 그 팀 하나로 갇히고, 동기화가 팀 하나를 파일 하나로 밀 수 있다.
// **요약 스토어는 없다** — `sessionRepo` 와 같은 패턴이다(db.ts 의 `teams` 주석).
//
// 계약은 `drillRepo`/`sessionRepo` 와 같은 모양으로 맞춘다. 같아야 하는 것 넷:
//  ① 모든 쓰기가 `putTeam` 하나를 지난다 — 검증(validateTeam)을 우회하는 put 을 노출하지 않는다.
//  ② `opts.touch:false` 는 pull·복원 전용(원격 시각 보존 — 안 그러면 받은 것을 다시 올리는
//     에코 루프가 생긴다), `opts.expectedUpdatedAt` 은 CAS(패스 중 사용자가 고쳤으면 그 문서만
//     E_CONFLICT 로 스킵).
//  ③ 삭제는 톰스톤을 **같은 트랜잭션**에 쓴다 — 따로 가면 그 사이 크래시에서 다른 기기가 이
//     삭제를 영영 모르고, 다음 pull 이 지운 팀을 '원격에만 있는 신규' 로 오판해 되살린다.
//  ④ 쓰기 성공 **뒤에**(트랜잭션 밖) `postSyncEvent`.
//
// ⚠️ **공유 링크 경로를 만들지 않는다**(결정 12, 기현 지시 *"공유 링크 없음"*). 이 파일에서
// `share/` 를 import 하는 순간 그 울타리가 무너진다 — 팀은 기기 저장·Drive 동기화·파일
// 내보내기로만 나간다.
import { getDB, beginWrite, endWrite, toStorageError } from './db.ts';
import { StorageError, STORAGE_ERROR_MESSAGES } from './errors.ts';
import { migrateDoc, TEAM_MIGRATIONS } from '../model/migrate.ts';
import { CURRENT_TEAM_SCHEMA, duplicateTeam as duplicateTeamDoc, emptyTeam, type Team } from '../model/team.ts';
import { validateTeam } from '../model/validate.ts';
import type { TeamId } from '../core/ids.ts';
import type { Locale } from '../i18n/locale.ts';
import { postSyncEvent, tombstoneRecord, tombstoneKey } from './syncMeta.ts';

/** 읽기 관문 — migrateDoc + validateTeam. 못 읽는 레코드는 **버리지 않고 건너뛴다**:
 *  ⚠️ 손상본을 지우거나 빈 팀으로 되쓰지 않는다(rosterRepo 와 같은 규율). 읽기 실패가 저장본을
 *  지우는 앱이 되면 일시적 버그 하나가 명단 전체를 날린다. */
function loadTeamFromRaw(raw: unknown): Team | null {
  const mig = migrateDoc(raw, TEAM_MIGRATIONS, CURRENT_TEAM_SCHEMA);
  if (!mig.ok) return null;
  const v = validateTeam(mig.doc);
  return v.ok ? v.value : null;
}

/** 최신 수정 순. 팀은 최대 20개(LIMITS.teamMax)라 전량 읽기가 싸다. */
export async function listTeams(): Promise<Team[]> {
  const db = await getDB();
  const all: unknown[] = await db.getAllFromIndex('teams', 'by_updatedAt');
  const out: Team[] = [];
  for (const raw of all) {
    const t = loadTeamFromRaw(raw);
    if (t) out.push(t);
  }
  return out.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getTeam(id: TeamId): Promise<Team | undefined> {
  const db = await getDB();
  const raw: unknown = await db.get('teams', id);
  if (raw === undefined) return undefined;
  return loadTeamFromRaw(raw) ?? undefined;
}

/** 유일한 쓰기 경로. 검증을 지난 값을 저장하고 **그 값을** 돌려준다 — 호출자가 화면에 들고 있는
 *  객체와 저장본이 갈라지지 않게(보정이 일어났으면 화면도 보정된 값을 봐야 한다). */
export async function putTeam(t: Team, opts?: { touch?: boolean; expectedUpdatedAt?: number }): Promise<Team> {
  const v = validateTeam(t);
  if (!v.ok) throw new StorageError('E_INVALID_FILE', STORAGE_ERROR_MESSAGES.E_INVALID_FILE());
  const next: Team = { ...v.value, ...(opts?.touch === false ? {} : { updatedAt: Date.now() }) };
  const db = await getDB().catch((e) => {
    throw toStorageError(e, 'E_DB_UNAVAILABLE');
  });
  beginWrite();
  try {
    const tx = db.transaction('teams', 'readwrite');
    if (opts?.expectedUpdatedAt !== undefined) {
      const cur = await tx.store.get(t.id);
      if (cur && cur.updatedAt !== opts.expectedUpdatedAt) {
        tx.abort();
        // abort 는 tx.done 을 reject 시킨다 — 삼키지 않으면 unhandled rejection 이 난다.
        await tx.done.catch(() => {});
        throw new StorageError('E_CONFLICT', STORAGE_ERROR_MESSAGES.E_CONFLICT());
      }
    }
    tx.store.put(next);
    await tx.done;
  } catch (e) {
    throw toStorageError(e, 'E_DB_UNAVAILABLE');
  } finally {
    endWrite();
  }
  postSyncEvent({ type: 'team', id: next.id, op: 'put', updatedAt: next.updatedAt });
  return next;
}

/** 새 팀. `emptyTeam` 이 매긴 시각을 지켜야(touch:false) createdAt === updatedAt 이 성립한다. */
export async function createTeam(init?: { name?: string; locale?: Locale }): Promise<Team> {
  const base = emptyTeam(init?.locale);
  const t: Team = init?.name !== undefined && init.name.trim().length > 0 ? { ...base, name: init.name } : base;
  return putTeam(t, { touch: false });
}

export async function deleteTeam(id: TeamId): Promise<void> {
  const db = await getDB();
  const deletedAt = Date.now();
  beginWrite();
  try {
    // 톰스톤은 **같은 트랜잭션**(위 머리말 ③). 세션은 건드리지 않는다 — 팀이 지워진 세션도
    // 「지워진 참조 id 가 남는 건 정상」 교리 그대로다(결정 11).
    const tx = db.transaction(['teams', 'meta'], 'readwrite');
    tx.objectStore('teams').delete(id);
    tx.objectStore('meta').put(tombstoneRecord('team', id, deletedAt));
    await tx.done;
  } catch (e) {
    throw toStorageError(e, 'E_DB_UNAVAILABLE');
  } finally {
    endWrite();
  }
  postSyncEvent({ type: 'team', id, op: 'delete', deletedAt });
}

/** 삭제 [실행 취소] 전용(결정 15 · PLAN-DELETE-SAFETY.md) — `restoreSession` 과 대칭.
 *  put 과 톰스톤 삭제를 한 트랜잭션에 묶는다 — 안 묶으면 되살린 팀을 다음 동기화가 다시 지운다.
 *  ⚠️ `putTeam` 을 그대로 못 부른다(meta 스토어를 같은 트랜잭션에 못 낀다). */
export async function restoreTeam(t: Team): Promise<Team> {
  const v = validateTeam(t);
  if (!v.ok) throw new StorageError('E_INVALID_FILE', STORAGE_ERROR_MESSAGES.E_INVALID_FILE());
  const next = v.value;
  const db = await getDB().catch((e) => {
    throw toStorageError(e, 'E_DB_UNAVAILABLE');
  });
  beginWrite();
  try {
    const tx = db.transaction(['teams', 'meta'], 'readwrite');
    tx.objectStore('teams').put(next);
    tx.objectStore('meta').delete(tombstoneKey('team', next.id));
    await tx.done;
  } catch (e) {
    throw toStorageError(e, 'E_DB_UNAVAILABLE');
  } finally {
    endWrite();
  }
  postSyncEvent({ type: 'team', id: next.id, op: 'put', updatedAt: next.updatedAt });
  return next;
}

/** 복제 — 선수·스태프 id 재발급은 순수 함수(`model/team.ts duplicateTeam`)가 한다.
 *  ⚠️ 재발급을 여기서 다시 구현하지 않는다: 두 벌이 되면 한쪽만 고쳐질 때 같은 `pl_` id 가
 *  두 팀에 생기고, 세션의 `participantIds` 가 어느 팀 사람인지 모호해진다(결정 20). */
export async function duplicateTeam(id: TeamId, opts?: { name?: string }): Promise<Team> {
  const src = await getTeam(id);
  if (!src) throw new StorageError('E_NOT_FOUND', STORAGE_ERROR_MESSAGES.E_NOT_FOUND());
  return putTeam(duplicateTeamDoc(src, opts), { touch: false });
}
