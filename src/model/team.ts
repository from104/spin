// 팀 문서 — [팀] 메뉴의 모델 정본 (2026-09-09 기현 지시: *"세션 다음에 «팀» 메뉴 신설 /
// 기본적으로 1개 팀 이상 관리 가능 / 드릴,세션에 종속되지 않음 / 기기 저장, 구글 드라이브
// 동기화, 파일 내보내기만 허용, 공유 링크 없음"*). 정본 문서는 `docs/PLAN-TEAM.md`.
//
// **한 줄 원칙**: 팀은 드릴·세션과 같은 급의 독립 문서다 — 명단은 팀 안으로 들어오고, 링크로는
// 절대 안 나간다. 그래서 `share/codec.ts` 의 `SharedDoc` 유니온에 팀을 **추가하지 않는다**
// (결정 12). 닫힌 유니온이 컴파일 타임 방어선이다 — 이 파일에 공유용 직렬화 함수를 만들면
// 그 방어선이 무너진다.
//
// ── 이 파일이 하지 않는 것 ────────────────────────────────────────────────────────
// - **저장을 모른다.** IDB 접근은 `storage/teamRepo.ts`, 검증·보정은 `model/validate.ts`.
//   여기 있는 것은 전부 순수 함수다(같은 입력 → 같은 출력, 부작용 0. 시각은 Date.now 를 쓴다).
// - **등급 상태(N/R/C)·장비 속도검사·경기 기록·출결 저장을 모른다**(결정 10). 출석은
//   `playerSessionCounts` 가 세션에서 **계산**할 뿐 저장하지 않는다 — SPIN 은 드릴 플래너다.
// - **드릴 안의 `TeamStyle`/`TeamSide` 와 무관하다**(결정 22). 저쪽은 판 위의 '진영'(홈/어웨이
//   두 칸 고정)이고 이쪽은 사람이 속한 조직이다. 이름만 같고 뜻이 다르다.
import type { PlayerId, StaffId, TeamId } from '../core/ids.ts';
import { newId } from '../core/ids.ts';
import type { Locale } from '../i18n/locale.ts';
import type { PFClass, Player } from './roster.ts';
import { DEFAULT_TEAMS } from './defaults.ts';

/** 팀 문서 스키마. 드릴·세션·로스터와 **다른 축**이다(migrate.ts 머리말) — 봉투
 *  `ENVELOPE_VERSION` 도, `DB_VERSION` 도 이 값과 무관하게 움직인다.
 *  v2(2026-09-09): 색 두 칸(`color`·`gkColor`) → 팔레트 + 킷 세트. */
export const CURRENT_TEAM_SCHEMA = 2;

/** 팔레트에 미리 고를 수 있는 색의 상한(2026-09-09 기현 지시: *"색 4개를 미리 선택하고
 *  배치하는식으로 (색 고른 갯수만큼 배치 가능 최대 4개)"*). 상한을 두는 이유: 팔레트가
 *  무한하면 «미리 고르고 배치한다» 가 그냥 «그때그때 색 고르기» 와 같아진다 — 고른 색이
 *  적어야 배치가 선택이 된다. */
export const TEAM_PALETTE_MAX = 4;

/** 킷 세트 종류. 홈·어웨이(색 충돌 시 갈아입는 벌)·중립(양 팀 모두와 겹칠 때 쓰는 제3의 벌).
 *  ⚠️ 드릴 안의 `TeamSide`('home'|'away' — 판 위의 진영)와 **글자만 같고 뜻이 다르다**(결정 22).
 *  저쪽은 코트의 두 진영이고 이쪽은 한 팀이 갈아입는 옷이다. */
export const TEAM_KIT_KINDS = ['home', 'away', 'neutral'] as const;
export type TeamKitKind = (typeof TEAM_KIT_KINDS)[number];

/** 킷 한 벌 = 필드 플레이어 색 + 골키퍼 색. 담는 값은 hex 가 아니라 **팔레트 인덱스**다.
 *  ★ 인덱스인 이유: 팔레트의 색 하나를 고치면 그 색을 쓰는 킷이 전부 따라와야 «미리 고르고
 *  배치한다» 가 성립한다. hex 사본을 담으면 색 한 번 바꾸는 데 세 세트를 각각 고쳐야 하고,
 *  그 순간 팔레트는 이름만 팔레트인 장식이 된다. */
export interface TeamKit {
  field: number;
  gk: number;
}

/** ⚠️ **홈은 지울 수 없다**(`setKit(t,'home',undefined)` 은 아무 일도 하지 않는다) — 킷이 하나도
 *  없으면 카드 견본·팀시트 킷 표가 그릴 것을 잃는다. 어웨이·중립은 있으면 쓰고 없으면 없는 것이다. */
export interface TeamKits {
  home: TeamKit;
  away?: TeamKit;
  neutral?: TeamKit;
}

/** 스태프 역할(FIPFA Technical Supplement 의 벤치 인원 목록). **복수 선택**이다 — 국내 팀은
 *  한 사람이 코치 겸 정비를 겸하는 일이 흔하다. 자격증 번호·유효기간은 만들지 않는다(결정 7). */
export const STAFF_ROLES = ['coach', 'assistantCoach', 'manager', 'doctor', 'carer', 'mechanic'] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export interface Staff {
  id: StaffId;
  name: string;
  roles: StaffRole[];
  /** 선임 코치 — 팀당 1명. 규정상 벤치 제재를 승계하는 사람이라 '역할' 이 아니라 '지목' 이다
   *  (역할이면 여럿이 될 수 있어야 하는데 승계자는 하나여야 한다). */
  isSeniorCoach?: boolean;
  /** 선수 겸직(코치 겸 선수). 같은 팀 `players[].id` 를 가리킨다 — 아니면 validate 가 떨군다. */
  playerId?: PlayerId;
  note?: string;
  createdAt: number;
  updatedAt: number;
}

/** 한 경기에 낼 구성. 코트 4칸(그중 GK 1) + 벤치.
 *  ⚠️ **저장은 팀당 하나다** — 경기별 기록이 아니라 "지금 이 팀의 기본 구성" 이다. 경기 기록을
 *  만들지 않기로 한 결정 10 의 연장이다. */
export interface Lineup {
  /** 코트 위. ≤4명이고 서로 다른 선수, 전부 팀 명단 안에 있어야 한다(R1·R4). */
  court: PlayerId[];
  /** 골키퍼 지정. **반드시 `court` 안의 한 명**이다(R1). */
  gk?: PlayerId;
  /** 교체 대기. `court` 와 겹치지 않고 역시 명단의 부분집합이다. 상한을 잠그지 않는다 —
   *  규정상 교체는 합의로 늘릴 수 있다(R3). */
  bench: PlayerId[];
}

export interface Team {
  schemaVersion: number;
  id: TeamId;
  name: string;
  shortName?: string;
  /** 필드 플레이어 색 · 골키퍼 색. 규정상 GK 는 다른 색이어야 한다(Laws). 지금까지 이 값을
   *  만드는 UI 가 0곳이었다(감사 B6 의 빚) — 팀 문서가 그 자리를 갖는다.
   *  ⚠️ 기본값의 출처는 **새 드릴이 태어나는 곳과 같아야 한다**(`DEFAULT_TEAMS.home`).
   *  여기에 hex 를 새로 적으면 "판 위의 우리 팀" 과 "팀 메뉴의 우리 팀" 이 다른 색이 된다.
   *
   *  ── ⚠️ 2026-09-09: 위 두 칸(`color`·`gkColor`)은 지시로 뒤집혔다 ─────────────────
   *  *"팀 색은 홈, 어웨이, 중립 세트 정할 수 있고. 색 4개를 미리 선택하고 배치하는식으로"* —
   *  한 벌뿐이던 색이 세 벌(홈·어웨이·중립)이 되면서 «색을 고르는 일»과 «색을 배치하는 일»이
   *  갈렸다. 그래서 두 필드는 아래 `palette` + `kits` 로 대체됐고(스키마 v1→v2), 위 문단이
   *  말하던 **기본값 출처 규칙은 그대로 산다** — `emptyTeam` 의 팔레트가 여전히
   *  `DEFAULT_TEAMS.home` 에서 온다. 대가: 색 한 벌을 읽던 자리가 `kitColors(team,'home')`
   *  한 번을 더 거친다(카드·팀시트·상세 세 곳). */
  /** 미리 고른 색 목록(#rrggbb, 1~`TEAM_PALETTE_MAX` 개). 킷은 이 배열의 **인덱스**를 가리킨다. */
  palette: string[];
  /** 배치. 배치할 수 있는 색은 팔레트에 고른 개수만큼이다(지시: *"색 고른 갯수만큼 배치 가능"*). */
  kits: TeamKits;
  league?: string;
  /** 시즌·연령대 라벨. 별도 계층을 만들지 않고 이 라벨 + [복제] 로 푼다(결정 20). */
  season?: string;
  note?: string;
  players: Player[];
  staff: Staff[];
  lineup?: Lineup;
  createdAt: number;
  updatedAt: number;
}

/** 팀 기본 이름 — 저장되는 **데이터**라 i18n 사전(`useT`)이 아니라 여기 산다. 사전 문자열은
 *  언어를 바꾸면 따라 바뀌는데, 한 번 저장된 팀 이름은 사용자가 고치기 전까지 그대로여야 한다. */
const DEFAULT_TEAM_NAME: Record<Locale, string> = {
  ko: '내 팀',
  en: 'My Team',
  ja: 'マイチーム',
};

export function defaultTeamName(locale: Locale = 'ko'): string {
  return DEFAULT_TEAM_NAME[locale];
}

/** 빈 팀 하나. 색은 새 드릴의 `teams.home` 과 같은 출처를 재사용한다(위 Team.palette 주석).
 *  팔레트 두 색으로 시작하는 이유: 규정상 GK 는 다른 색이어야 하므로(Laws) 처음부터 배치할
 *  색이 둘은 있어야 홈 킷이 «필드 0번 · GK 1번» 이라는 뜻을 가진다. */
export function emptyTeam(locale: Locale = 'ko'): Team {
  const now = Date.now();
  return {
    schemaVersion: CURRENT_TEAM_SCHEMA,
    id: newId('tm'),
    name: defaultTeamName(locale),
    palette: [DEFAULT_TEAMS.home.color, DEFAULT_TEAMS.home.gkColor],
    kits: { home: { field: 0, gk: 1 } },
    players: [],
    staff: [],
    createdAt: now,
    updatedAt: now,
  };
}

// ── 팔레트 · 킷 ──────────────────────────────────────────────────────────────────

/** 팔레트 인덱스 → 실제 색. 범위 밖이면 0번으로 접는다 — `validateTeam` 이 저장 경로에서 같은
 *  보정을 하지만 화면은 **저장되기 전 값도 그린다**(낙관적 반영). 두 곳이 다르게 접으면 저장
 *  전후로 색이 튄다. */
function paletteAt(palette: readonly string[], i: number): string {
  return palette[i] ?? palette[0] ?? DEFAULT_TEAMS.home.color;
}

/** 킷 한 벌의 실제 두 색. **없는 킷은 `undefined`** — 빈 킷을 기본색으로 채워 돌려주면 부르는
 *  쪽이 "어웨이를 안 만든 팀" 과 "어웨이가 홈과 같은 팀" 을 구분하지 못한다. */
export function kitColors(team: Team, kind: TeamKitKind): { field: string; gk: string } | undefined {
  const kit = team.kits[kind];
  if (!kit) return undefined;
  return { field: paletteAt(team.palette, kit.field), gk: paletteAt(team.palette, kit.gk) };
}

/** 팔레트에 색 하나를 더한다. 상한에서는 **아무 일도 하지 않는다**(예외를 던지지 않는다 — UI 가
 *  4개에서 [+ 색 추가] 를 감추므로 여기 도달하는 건 파일·테스트뿐이다). */
export function addPaletteColor(t: Team, color: string = DEFAULT_TEAMS.away.color): Team {
  if (t.palette.length >= TEAM_PALETTE_MAX) return t;
  return { ...t, palette: [...t.palette, color], updatedAt: Date.now() };
}

/** 팔레트의 색 하나를 갈아 끼운다 — 그 색을 쓰던 킷은 인덱스로 가리키므로 **전부 따라온다**. */
export function setPaletteColor(t: Team, index: number, color: string): Team {
  if (index < 0 || index >= t.palette.length) return t;
  return { ...t, palette: t.palette.map((c, i) => (i === index ? color : c)), updatedAt: Date.now() };
}

/** 팔레트에서 색 하나를 뺀다. **마지막 한 색은 못 뺀다** — 팔레트가 비면 킷이 가리킬 것이 없다.
 *
 *  ⚠️ 뺀 뒤 킷 슬롯을 다시 매기는 규칙 둘: (a) 지운 색을 쓰던 슬롯은 **0번**으로 돌린다
 *  (b) 지운 색 **뒤에** 있던 색을 쓰던 슬롯은 한 칸 당긴다. (b)를 빼먹으면 남은 킷들이 조용히
 *  옆 색을 입는다 — 지운 것은 하나인데 바뀐 것은 여럿인, 눈으로만 잡히는 종류의 사고다. */
export function removePaletteColor(t: Team, index: number): Team {
  if (index < 0 || index >= t.palette.length || t.palette.length <= 1) return t;
  const palette = t.palette.filter((_, i) => i !== index);
  const slot = (v: number): number => {
    if (v === index || v < 0 || v >= t.palette.length) return 0;
    return v > index ? v - 1 : v;
  };
  const remap = (k: TeamKit): TeamKit => ({ field: slot(k.field), gk: slot(k.gk) });
  const kits: TeamKits = { home: remap(t.kits.home) };
  for (const kind of TEAM_KIT_KINDS) {
    if (kind === 'home') continue;
    const k = t.kits[kind];
    if (k) kits[kind] = remap(k);
  }
  return { ...t, palette, kits, updatedAt: Date.now() };
}

/** 킷 한 벌을 놓거나 치운다. ⚠️ `kind==='home'` 에 `undefined` 를 주면 **무시한다**(TeamKits 주석). */
export function setKit(t: Team, kind: TeamKitKind, kit: TeamKit | undefined): Team {
  const now = Date.now();
  if (kit !== undefined) {
    return { ...t, kits: { ...t.kits, [kind]: { field: kit.field, gk: kit.gk } }, updatedAt: now };
  }
  if (kind === 'home') return t;
  const kits: TeamKits = { home: t.kits.home };
  for (const k of TEAM_KIT_KINDS) {
    if (k === 'home' || k === kind) continue;
    const v = t.kits[k];
    if (v) kits[k] = v;
  }
  return { ...t, kits, updatedAt: now };
}

// ── 순수 편집 헬퍼 ────────────────────────────────────────────────────────────────
// roster.ts 의 addPlayer/updatePlayer/removePlayer 와 **같은 모양**이다(스프레드 불변 갱신 +
// updatedAt 도장). 이름이 겹치는 것은 의도다 — 부르는 쪽이 로스터를 다루는지 팀을 다루는지는
// import 경로가 말한다.

export function addPlayer(t: Team, name: string, klass?: PFClass): Team {
  const now = Date.now();
  const p: Player = {
    id: newId('pl'),
    name,
    ...(klass !== undefined ? { klass } : {}),
    createdAt: now,
    updatedAt: now,
  };
  return { ...t, players: [...t.players, p], updatedAt: now };
}

/** id·시각은 패치로 못 바꾼다 — 그 둘은 문서의 정체성이고, 패치로 열어 두면 UI 의 오타 하나가
 *  선수를 통째로 다른 사람으로 만든다. */
export type PlayerPatch = Partial<Omit<Player, 'id' | 'createdAt' | 'updatedAt'>>;

export function updatePlayer(t: Team, id: PlayerId, patch: PlayerPatch): Team {
  const now = Date.now();
  return {
    ...t,
    players: t.players.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: now } : p)),
    updatedAt: now,
  };
}

/** ⚠️ 선수를 지워도 **라인업에서 자동으로 빼 준다** — 안 빼면 라인업이 명단의 부분집합이라는
 *  불변식(R4)이 깨지고, 화면은 이름 없는 칸을 그린다. 세션의 `participantIds` 는 건드리지
 *  않는다(그쪽은 "지워진 선수 id 가 남는 건 정상" 이라는 기존 교리 그대로다 — 결정 11). */
export function removePlayer(t: Team, id: PlayerId): Team {
  const now = Date.now();
  const next: Team = { ...t, players: t.players.filter((p) => p.id !== id), updatedAt: now };
  if (!next.lineup) return next;
  return { ...next, lineup: withoutPlayer(next.lineup, id) };
}

function withoutPlayer(l: Lineup, id: PlayerId): Lineup {
  const court = l.court.filter((p) => p !== id);
  return {
    court,
    ...(l.gk !== undefined && l.gk !== id ? { gk: l.gk } : {}),
    bench: l.bench.filter((p) => p !== id),
  };
}

export function addStaff(t: Team, name: string, roles: StaffRole[] = []): Team {
  const now = Date.now();
  const s: Staff = { id: newId('sf'), name, roles: [...roles], createdAt: now, updatedAt: now };
  return { ...t, staff: [...t.staff, s], updatedAt: now };
}

export type StaffPatch = Partial<Omit<Staff, 'id' | 'createdAt' | 'updatedAt'>>;

/** 선임 코치는 팀당 1명 — 여기서 켜면 나머지가 꺼진다. validateTeam 도 같은 규칙을 걸지만,
 *  **저장된 뒤에 고쳐지는 것과 누르는 순간 보이는 것은 다르다**: 화면이 두 명을 선임으로
 *  그렸다가 새로고침에서 조용히 하나가 사라지면 그건 버그로 읽힌다. */
export function updateStaff(t: Team, id: StaffId, patch: StaffPatch): Team {
  const now = Date.now();
  const promoting = patch.isSeniorCoach === true;
  return {
    ...t,
    staff: t.staff.map((s) => {
      if (s.id === id) return { ...s, ...patch, updatedAt: now };
      return promoting && s.isSeniorCoach === true ? { ...s, isSeniorCoach: false, updatedAt: now } : s;
    }),
    updatedAt: now,
  };
}

export function removeStaff(t: Team, id: StaffId): Team {
  return { ...t, staff: t.staff.filter((s) => s.id !== id), updatedAt: Date.now() };
}

/** 라인업 통째 교체. 정합성(부분집합·GK ∈ 코트·4칸)은 여기서 강제하지 않는다 — **입력을 막지
 *  않는 것**이 결정 8 이고, 어긋난 상태는 `lineupWarnings` 가 노랗게 말한다. 저장 경로의
 *  `validateTeam` 이 파일에서 온 쓰레기만 정리한다. */
export function setLineup(t: Team, lineup: Lineup | undefined): Team {
  const now = Date.now();
  if (lineup === undefined) {
    const { lineup: _drop, ...rest } = t;
    return { ...rest, updatedAt: now };
  }
  return { ...t, lineup, updatedAt: now };
}

/** 팀 복제 — **선수·스태프 id 를 새로 발급한다**(결정 20).
 *  ⚠️ 같은 `pl_` id 가 두 팀에 있으면 세션의 `participantIds` 가 어느 팀 사람인지 모호해진다.
 *  시즌·연령대를 별도 계층 대신 `season` 라벨 + 복제로 푸는 것이 이 함수의 존재 이유이므로,
 *  id 재발급을 빼면 그 해법 자체가 깨진다. 라인업은 새 id 로 **다시 매핑**한다(그냥 복사하면
 *  옛 id 를 가리켜 통째로 고아가 된다). */
export function duplicateTeam(t: Team, opts?: { name?: string }): Team {
  const now = Date.now();
  const src = structuredClone(t);
  const playerMap = new Map<PlayerId, PlayerId>();
  const players = src.players.map((p) => {
    const id = newId('pl');
    playerMap.set(p.id, id);
    return { ...p, id, createdAt: now, updatedAt: now };
  });
  const staff = src.staff.map((s) => {
    const playerId = s.playerId !== undefined ? playerMap.get(s.playerId) : undefined;
    const { playerId: _drop, ...rest } = s;
    return {
      ...rest,
      id: newId('sf'),
      ...(playerId !== undefined ? { playerId } : {}),
      createdAt: now,
      updatedAt: now,
    };
  });
  const remap = (ids: PlayerId[]): PlayerId[] => ids.map((id) => playerMap.get(id)).filter((id): id is PlayerId => id !== undefined);
  const gk = src.lineup?.gk !== undefined ? playerMap.get(src.lineup.gk) : undefined;
  return {
    ...src,
    id: newId('tm'),
    ...(opts?.name !== undefined ? { name: opts.name } : {}),
    players,
    staff,
    ...(src.lineup
      ? { lineup: { court: remap(src.lineup.court), ...(gk !== undefined ? { gk } : {}), bench: remap(src.lineup.bench) } }
      : {}),
    createdAt: now,
    updatedAt: now,
  };
}

// ── 라인업 경고 ──────────────────────────────────────────────────────────────────

/** 라인업이 규정과 어긋난 자리. **셈과 경고만 하고 입력은 막지 않는다**(결정 8) —
 *  훈련 중에는 규정을 일부러 벗어나 세우는 일이 흔하고, 앱이 그것을 못 하게 막으면 도구가
 *  아니라 심판이 된다(선례: `SessionEditorScreen` 의 참가자 경고).
 *
 *  - `pf2-over` (R5) — **경기 단위** PF2 인원이 2명을 넘었다. 코트 + 벤치를 합쳐 센다:
 *    교체로 들어오는 3번째 PF2 도 위반이기 때문이다. 3명째부터 뜬다.
 *  - `under-min` (R2) — 코트 위가 2명 미만이면 경기를 시작·속행할 수 없다.
 *    ⚠️ *"4명 미만이면 경기 불가"* 는 틀린 문구다(조사 §4.2 R2). 하한은 **2** 다.
 *  - `no-gk` (R1) — 코트 4칸 중 1명은 반드시 골키퍼다.
 *
 *  ⚠️ **여기 없는 경고**: 「코트 위 PF1 최소 2명」은 만들지 않는다 — 규정 근거가 없다.
 *  명단(스쿼드) 전체의 PF2 수도 경고가 아니다 — 스쿼드 편성에는 등급 조합 제한이 전혀
 *  없다(R6). 그래서 명단 헤더의 PF 칩은 **회색 정보 칩**이다(결정 9). */
export type LineupWarning = { kind: 'pf2-over'; count: number } | { kind: 'under-min'; count: number } | { kind: 'no-gk' };

/** ⚠️ 미분류(klass 없음) 선수는 PF1 로도 PF2 로도 세지 않는다(R8) — 미분류를 PF2 로 치면
 *  아직 심사를 못 받은 팀이 영구히 노란 경고를 달고 산다. */
export function countByClass(team: Team, ids: readonly PlayerId[]): { pf1: number; pf2: number; unclassified: number } {
  const byId = new Map(team.players.map((p) => [p.id, p]));
  let pf1 = 0;
  let pf2 = 0;
  let unclassified = 0;
  for (const id of ids) {
    const p = byId.get(id);
    if (!p) continue; // 명단에 없는 id 는 세지 않는다 — 셈에 넣으면 고아가 규정 위반을 만든다
    if (p.klass === 'PF1') pf1++;
    else if (p.klass === 'PF2') pf2++;
    else unclassified++;
  }
  return { pf1, pf2, unclassified };
}

/** 규정상 한 경기에 낼 수 있는 PF2 인원. `ruleConstants` 가 아니라 여기 두는 이유: 이 값을
 *  쓰는 곳이 라인업 판정 하나뿐이고, 코트 위 렌더링 규칙(`model/rules.ts`)과는 계산이 섞이면
 *  안 되는 다른 층이다(AGENTS §3 — 물리 상수와 규정 상수를 일부러 가르는 것과 같은 이유). */
export const MAX_PF2_PER_MATCH = 2;
/** 코트 위 최소 인원(R2). 이보다 적으면 경기를 시작·속행할 수 없다. */
export const MIN_COURT_PLAYERS = 2;

export function lineupWarnings(team: Team): LineupWarning[] {
  const l = team.lineup;
  if (!l) return []; // 라인업을 세우지 않은 팀에 대고 규정을 따지지 않는다
  const out: LineupWarning[] = [];
  const squad = countByClass(team, [...l.court, ...l.bench]);
  if (squad.pf2 > MAX_PF2_PER_MATCH) out.push({ kind: 'pf2-over', count: squad.pf2 });
  const onCourt = l.court.filter((id) => team.players.some((p) => p.id === id)).length;
  if (onCourt < MIN_COURT_PLAYERS) out.push({ kind: 'under-min', count: onCourt });
  if (l.gk === undefined || !l.court.includes(l.gk)) out.push({ kind: 'no-gk' });
  return out;
}

// ── 참가 세션 셈 ─────────────────────────────────────────────────────────────────

/** 선수별 «참가 세션 n회». **저장하지 않는다**(결정 10) — 출결 시스템이 아니라 세션의
 *  `participantIds` 에서 매번 계산하는 파생값이다. 저장하면 두 벌이 되고(AGENTS §3), 세션을
 *  지웠을 때 누가 카운터를 내려 줄지가 새 문제가 된다.
 *
 *  세션 쪽 타입을 import 하지 않고 필요한 모양만 받는 이유: `model/session.ts` 는 드릴 참조·
 *  구획까지 끌고 오는 무거운 모듈이라, 셈 하나 때문에 팀 모델이 세션 모델에 묶이면 안 된다. */
export function playerSessionCounts(team: Team, sessions: readonly { participantIds?: PlayerId[] }[]): Map<PlayerId, number> {
  const mine = new Set(team.players.map((p) => p.id));
  const out = new Map<PlayerId, number>();
  for (const p of team.players) out.set(p.id, 0);
  for (const s of sessions) {
    // 한 세션이 같은 선수를 두 번 실었어도 1회다 — 저장본이 중복을 담고 있을 수 있다.
    const seen = new Set<PlayerId>();
    for (const id of s.participantIds ?? []) {
      if (!mine.has(id) || seen.has(id)) continue;
      seen.add(id);
      out.set(id, (out.get(id) ?? 0) + 1);
    }
  }
  return out;
}

/** 명단 헤더의 회색 정보 칩(결정 9) — 활성 선수만 센다. 경고색을 쓰지 않는다: 스쿼드 편성에는
 *  등급 조합 제한이 전혀 없다(R6). */
export function rosterCounts(team: Team): { pf1: number; pf2: number; unclassified: number } {
  return countByClass(
    team,
    team.players.filter((p) => p.active !== false).map((p) => p.id),
  );
}
