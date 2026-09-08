// 옛 단일 명단 → 팀 하나 이주 ([팀] 메뉴, 2026-09-09 · PLAN-TEAM.md 결정 3).
//
// 0.6.6 까지 선수 명단은 meta 스토어의 레코드 하나였다(`storage/rosterRepo.ts`). [팀] 메뉴가
// 들어오며 명단은 팀 문서 안으로 옮겨 갔다 — 이 파일은 **그 사이를 한 번 건너는 다리**다.
//
// ── 지키는 것 셋 ──────────────────────────────────────────────────────────────────
// ① **한 번만 건넌다.** 도장은 meta 의 `rosterMigratedAt`. `prefs` 가 아니라 meta 인 이유:
//    prefs 는 localStorage 라 사파리 프라이빗 모드에서 증발한다(seed.ts 자물쇠 ②의 그 함정).
//    명단이 사는 곳과 도장이 사는 곳이 같아야, 명단이 살아 있는 기기에서 도장도 살아 있다.
// ② **`roster` 를 지우지 않는다.** 읽기 전용으로 잔류시킨다 — 옛 버전 기기가 같은 Drive 를
//    보거나 옛 백업을 복원할 때 명단을 잃지 않게. 새 UI 는 roster 에 **쓰지 않는다**
//    (그래서 두 벌이 갈라지지 않는다 — 한쪽은 얼어 있다). 철거는 다음 릴리스 후보.
// ③ **teams 가 비어 있을 때만 만든다.** 이미 팀을 만든 사람에게 «내 팀» 이 끼어들면 안 된다.
// ④ **이주 팀의 id 는 기기 무관한 고정값**(`MIGRATED_TEAM_ID`) — 아래 상수 주석.
//
// ⚠️ **빈 명단으로는 팀을 만들지 않고 도장도 찍지 않는다.** 도장을 찍어 버리면, 나중에 옛
// 기기에서 Drive 로 명단이 도착해도 영영 이주하지 않는다. 안 찍으면 다음 기동이 다시 본다 —
// 그때도 teams 가 비어 있을 때만 만들므로 중복 위험은 ③이 이미 막고 있다.
import { getDB, beginWrite, endWrite } from './db.ts';
import { loadRoster } from './rosterRepo.ts';
import { putTeam } from './teamRepo.ts';
import { emptyTeam, type Team } from '../model/team.ts';
import type { TeamId } from '../core/ids.ts';
import type { Locale } from '../i18n/locale.ts';

/** meta 스토어의 도장 키. 값은 이주한 시각(ms) — 언제 건넜는지가 나중에 사고를 볼 때 유일한
 *  단서라 boolean 이 아니라 시각을 적는다. */
export const ROSTER_MIGRATED_META_KEY = 'rosterMigratedAt';

/** 이주로 만드는 팀의 **고정 id**(⚠️ 2026-09-09 검수, PLAN-TEAM 결정 3·20).
 *
 *  `newId('tm')` 이면 기기마다 다른 id 가 나온다. 0.6.6 을 쓰던 사람은 흔히 기기 두 대에 같은
 *  roster 를 동기화해 두는데, 이주는 **로컬 IDB 만 보고 마운트 즉시** 돌고(App.tsx 의
 *  `<MigrateRosterToTeam/>`) 드라이브 첫 pull 은 네트워크 뒤라 — B 기기는 A 의 팀을 받기 전에
 *  자기 팀을 만든다. 그러면 «내 팀» 이 두 벌 생기고, 둘이 **같은 `pl_` id 를 공유**한다(결정 20 이
 *  막으려던 바로 그 상태: 세션의 `participantIds` 가 어느 팀인지 모호해진다).
 *
 *  id 를 고정하면 두 기기가 만든 것이 동기화에게 **같은 문서**로 보여 `updatedAt` 비교(LWW)로
 *  하나로 수렴한다. 어느 쪽이 이겨도 무해하다 — 선수 배열은 같은 roster 에서 왔다.
 *  `isId` 의 형식(`^[0-9a-z_]+$`, 길이 4~64)을 통과하는 값이어야 한다. */
export const MIGRATED_TEAM_ID = 'tm_migrated_roster' as TeamId;

export type RosterMigrationReason =
  /** 실제로 팀 하나를 만들었다. */
  | 'migrated'
  /** 도장이 이미 찍혀 있다(자물쇠 ①). */
  | 'stamped'
  /** 팀이 이미 있다(자물쇠 ③). */
  | 'teams-present'
  /** 옛 명단에 선수가 0명 — 만들 것이 없다. 도장도 찍지 않는다(위 ⚠️). */
  | 'empty-roster';

export interface RosterMigrationOutcome {
  migrated: boolean;
  /** 만든 팀(만들었을 때만). */
  team?: Team;
  reason: RosterMigrationReason;
}

async function isStamped(): Promise<boolean> {
  const db = await getDB();
  return (await db.get('meta', ROSTER_MIGRATED_META_KEY)) !== undefined;
}

async function stamp(at: number): Promise<void> {
  const db = await getDB();
  beginWrite();
  try {
    const tx = db.transaction('meta', 'readwrite');
    tx.store.put({ key: ROSTER_MIGRATED_META_KEY, value: at });
    await tx.done;
  } finally {
    endWrite();
  }
}

/** 앱 기동에서 한 번 부른다(App.tsx, 시드 **다음**).
 *
 *  **순서가 계약이다: 팀 저장 → 도장**(seed.ts 와 같은 규율). 도장을 먼저 찍으면 저장이 실패한
 *  기기에서 명단이 영영 팀으로 오지 않는다. 반대 순서의 위험(도장을 못 찍어 다음 실행에 또
 *  이주)은 자물쇠 ③(teams 가 비어 있을 때만)이 받는다.
 *
 *  `locale` 은 만드는 팀의 **기본 이름**에만 쓴다. 선수 데이터는 로케일과 무관하다. */
export async function migrateRosterToTeamOnce(opts?: { locale?: Locale }): Promise<RosterMigrationOutcome> {
  if (await isStamped()) return { migrated: false, reason: 'stamped' };

  const db = await getDB();
  if ((await db.count('teams')) > 0) return { migrated: false, reason: 'teams-present' };

  const roster = await loadRoster();
  if (roster.players.length === 0) return { migrated: false, reason: 'empty-roster' };

  // ⚠️ 선수 배열을 **그대로** 옮긴다 — `pl_` id 를 새로 발급하면 옛 세션의 `participantIds`
  // 가 통째로 «(지워진 선수)» 가 된다(결정 1: id 를 그대로 써야 세션이 안 끊긴다).
  // 새 선택 필드(등번호·주장·GK 선호…)는 **지어내지 않는다** — 옛 명단에 없던 사실이다.
  const team: Team = { ...emptyTeam(opts?.locale), id: MIGRATED_TEAM_ID, players: roster.players.map((p) => ({ ...p })) };
  const saved = await putTeam(team, { touch: false });
  await stamp(Date.now());
  return { migrated: true, team: saved, reason: 'migrated' };
}
