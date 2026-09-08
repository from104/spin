// 로스터 — 팀 선수 명단 (2026-08-18 구조 개편, 질문 20문 ⑬·⑰: 단일 팀).
//
// **왜 단일 문서인가**: 팀은 하나(질문 ⑰)라 목록 쿼리·인덱스가 필요 없다. 그래서 저장도
// 새 IDB 스토어가 아니라 meta 스토어의 레코드 하나다(storage/rosterRepo.ts) — 스토어를 파면
// DB_VERSION 상승 + onupgradeneeded + 멀티탭 blocked 처리가 따라오는데 문서 하나에 과하다.
//
// ── ⚠️ 2026-09-09: 위 두 문단의 전제가 죽었다(기현 지시 — [팀] 메뉴 신설) ─────────────
// *"기본적으로 1개 팀 이상 관리 가능 / 드릴,세션에 종속되지 않음"* → 팀은 여럿이고, 명단은
// 팀 문서 안으로 들어갔다(`model/team.ts` 의 `Team.players`, 저장은 `teams` 스토어 ·
// `DB_VERSION 2`). 즉 *"목록 쿼리·인덱스가 없다"* 가 거짓이 됐고, 위 문단이 아껴 두었던
// DB_VERSION 상승 비용은 `PLAN-TEAM.md` 결정 2 에서 실제로 청구됐다.
// **근거를 지우지 않는 이유**: 단일 문서 판단은 그때(팀 하나) 옳았고, `Roster`·`rosterRepo`
// 는 아직 살아 있다 — 이주(결정 3)를 마친 뒤에도 **읽기 전용으로 잔류**시켜 옛 버전 기기·옛
// 백업이 명단을 잃지 않게 한다. 새 UI 는 이 문서에 **쓰지 않는다**(철거는 다음 릴리스 후보).
// **`Player` 타입과 `pl_` id 는 그대로 재사용한다** — 세션의 `participantIds` 가 이 id 를
// 가리키므로, 타입을 새로 파면 옛 세션의 참가자가 통째로 끊긴다(결정 1).
//
// **PF 클래스**: 파워체어 풋볼의 선수 분류(PF1 중증 / PF2 경증). 경기 규정상 **한 경기에 PF2 를
// 2명 넘게 낼 수 없다**(FIPFA Laws p.36 — 교체로 들어오는 3번째도 위반). 제재는 즉시 중단 ·
// 해당 선수 제외 · **선수와 코치 옐로카드 2장** · 상대 간접프리킥이다.
//   ⚠️ 2026-09-09 정정: 옛 문구는 *"동시 출전 최대 2명 … 위반 시 페널티"* 였다. 둘 다 틀렸다 —
//   제약은 *동시*가 아니라 **경기 단위**이고(교체를 포함해 센다), 제재는 페널티킥이 아니라
//   간접프리킥이다. 파워체어 풋볼에 페널티킥이라는 재개 방식 자체가 없다.
//   반대로 **명단(스쿼드) 편성에는 등급 조합 제한이 전혀 없다** — 명단 층은 셈만 보여주고
//   막지 않는다(PLAN-TEAM.md 결정 9, 조사 §4.2 R5·R6·R7).
// optional 인 이유: 분류 심사를 아직 안 받은 선수가 현실에 흔하다 — 없음 = 미분류.
// 미분류는 위 계산에서 **PF1 로도 PF2 로도 세지 않는다**(조사 §4.2 R8).
import type { PlayerId } from '../core/ids.ts';
import { newId } from '../core/ids.ts';

export const CURRENT_ROSTER_SCHEMA = 1;

export const PF_CLASSES = ['PF1', 'PF2'] as const;
export type PFClass = (typeof PF_CLASSES)[number];

/** ⚠️ **추가 필드는 전부 선택(optional)이다** — 옛 명단(2026-09-09 이전에 저장된 `Roster`)이
 *  아무 필드도 안 갖고 있어도 그대로 유효해야 하고, 이주(rosterMigration.ts)가 없는 값을
 *  지어내지 않기 때문이다. 값이 없으면 **키를 만들지 않는다**(validate.ts sanitizeText 주석의
 *  함정과 같다: `{note: undefined}` 는 IDB 왕복에서 살고 JSON 왕복에서 죽는다).
 *
 *  ⚠️ **여기에 만들지 않는 필드**(PLAN-TEAM.md 결정 6, 조사 §3.2): 성별 · 정확한 생년월일 ·
 *  사진 · 연락처 · 진단명 · 보호자. 개인정보는 **필드를 만들지 않는 것**이 가장 강한 보호다 —
 *  필드가 있으면 언젠가 채워지고, 채워지면 백업·동기화·인쇄물을 타고 흐른다. `birthYear` 가
 *  연도만인 것도 같은 이유다(연령대 분류에는 연도면 족하다). `note` 는 자유 입력이라 막을 수
 *  없으므로 입력칸 아래에 «의료·연락처 등 개인정보는 적지 마세요» 안내를 붙인다. */
export interface Player {
  id: PlayerId;
  name: string; // ≤40자 (LIMITS.playerNameLen)
  klass?: PFClass; // 없음 = 미분류
  /** 등번호 0~99. 없음 = 미지정(0 이 유효한 등번호라 0 을 '미지정'으로 쓸 수 없다). */
  number?: number;
  /** 주장. 팀당 1명 — validateTeam 이 둘째부터 떨군다. */
  isCaptain?: boolean;
  /** 골키퍼 **선호**. GK 는 경기 중 바뀌는 지정이라(Laws) 고정 속성이 아니다 — 라인업의
   *  `gk` 가 실제 지정이고 이 값은 그 자리를 채울 때의 힌트일 뿐이다. */
  preferredGk?: boolean;
  /** 없거나 true = 활성. false = 명단에서 감춤(지우지 않고 숨긴다 — 지우면 그 선수를 가리키던
   *  세션 `participantIds` 가 «(지워진 선수)» 가 된다). */
  active?: boolean;
  /** 연도만. 정확한 생년월일은 만들지 않는다(위 ⚠️). */
  birthYear?: number;
  /** 축구용 파워체어 기종(Strike Force, Quickie 등). 장비 속도검사·인증 기록은 만들지 않는다. */
  chairModel?: string;
  /** ≤200자 (LIMITS.playerNoteLen). 개인정보 금지 안내를 입력칸 아래에 둔다. */
  note?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Roster {
  schemaVersion: number;
  players: Player[]; // ≤30명 (LIMITS.rosterMax)
  updatedAt: number;
}

export function emptyRoster(): Roster {
  return { schemaVersion: CURRENT_ROSTER_SCHEMA, players: [], updatedAt: 0 };
}

// ── 순수 편집 헬퍼 — 설정 화면(3차)과 세션 참가자 체크가 같은 함수를 쓴다 ──────────────────

export function addPlayer(r: Roster, name: string, klass?: PFClass): Roster {
  const now = Date.now();
  const p: Player = { id: newId('pl'), name, ...(klass !== undefined ? { klass } : {}), createdAt: now, updatedAt: now };
  return { ...r, players: [...r.players, p], updatedAt: now };
}

export function updatePlayer(r: Roster, id: PlayerId, patch: Partial<Pick<Player, 'name' | 'klass'>>): Roster {
  const now = Date.now();
  return {
    ...r,
    players: r.players.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: now } : p)),
    updatedAt: now,
  };
}

export function removePlayer(r: Roster, id: PlayerId): Roster {
  return { ...r, players: r.players.filter((p) => p.id !== id), updatedAt: Date.now() };
}
