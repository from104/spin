// 로스터 저장소 (구조 개편 C3) — **meta 스토어의 레코드 하나**다(key 'roster').
//
// 새 IDB 스토어를 파지 않은 근거(model/roster.ts 머리말과 같은 판단): 단일 팀 단일 문서라
// 목록 쿼리·인덱스가 없고, 스토어를 파면 DB_VERSION 상승 + 멀티탭 blocked 처리가 따라온다.
// prefs(localStorage)를 안 쓴 근거: 동기 읽기가 필요 없고(테마 FOUC 류의 제약이 없다),
// 명단 30명 × 이름은 localStorage 용량·멀티탭 동기화 양쪽에서 IDB 가 낫다.
//
// 읽기는 처음부터 migrateDoc(ROSTER_MIGRATIONS) + validateRoster 관문을 지난다 — 지금은
// 체인이 비어 있지만, 관문이 있어야 미래의 필드 추가가 "그때의 참말" 을 적을 자리를 갖는다.
import { getDB, beginWrite, endWrite, toStorageError } from './db.ts';
import { migrateDoc, ROSTER_MIGRATIONS } from '../model/migrate.ts';
import { CURRENT_ROSTER_SCHEMA, emptyRoster, type Roster } from '../model/roster.ts';
import { validateRoster } from '../model/validate.ts';
import { postSyncEvent } from './syncMeta.ts';

const ROSTER_META_KEY = 'roster';

/** 없으면 빈 명단. 손상돼도 빈 명단 — 던지지 않는다(명단이 없다고 앱이 죽으면 안 된다).
 *  ⚠️ 손상본을 빈 명단으로 **되쓰지는 않는다** — 읽기 실패가 저장본을 지우는 앱이 되면
 *  일시적 버그 하나가 명단 전체를 날린다. 되쓰기는 다음 저장(saveRoster)이 자연히 한다. */
export async function loadRoster(): Promise<Roster> {
  try {
    const db = await getDB();
    const rec = await db.get('meta', ROSTER_META_KEY);
    if (!rec) return emptyRoster();
    const mig = migrateDoc(rec.value, ROSTER_MIGRATIONS, CURRENT_ROSTER_SCHEMA);
    if (!mig.ok) return emptyRoster();
    const v = validateRoster(mig.doc);
    return v.ok ? v.value : emptyRoster();
  } catch {
    return emptyRoster();
  }
}

/** 저장은 통째로 — 문서 하나라 부분 갱신이 없다. 검증을 지난 값을 되돌려준다. */
export async function saveRoster(r: Roster): Promise<Roster> {
  const v = validateRoster(r);
  const value: Roster = v.ok ? v.value : emptyRoster();
  const db = await getDB().catch((e) => {
    throw toStorageError(e, 'E_DB_UNAVAILABLE');
  });
  beginWrite();
  try {
    const tx = db.transaction('meta', 'readwrite');
    tx.store.put({ key: ROSTER_META_KEY, value });
    await tx.done;
  } catch (e) {
    throw toStorageError(e, 'E_DB_UNAVAILABLE');
  } finally {
    endWrite();
  }
  // 명단은 단일 문서라 id 를 'roster' 로 고정한다(syncMeta 의 SyncDocType 주석). 삭제 경로가
  // 없으므로(비우기도 put) 톰스톤은 애초에 생기지 않는다.
  postSyncEvent({ type: 'roster', id: ROSTER_META_KEY, op: 'put', updatedAt: value.updatedAt });
  return value;
}
