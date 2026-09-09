// 팀 모델 — 라인업 경고(규정 판정) · 복제의 id 재발급 · validateTeam 의 보정.
//
// **이 파일을 지우면 새는 실기 버그**: ① 규정을 잘못 세는 경고(미분류를 PF2 로 치면 심사를
// 아직 못 받은 팀이 영구히 노란 딱지를 달고, 하한을 4로 잡으면 2명 훈련이 매번 경고를 문다)
// ② 복제한 팀이 원본과 같은 `pl_` id 를 갖는 것 — 세션 참가자가 어느 팀 사람인지 모호해진다
// ③ 파일에서 온 라인업이 명단에 없는 선수를 가리켜 이름 없는 칸이 그려지는 것
// ④ 개인정보 필드가 정화기를 통과해 백업·인쇄물을 타고 흐르는 것.
//
// 라벨 문자열·항목 수는 재지 않는다(테스트 작성 규칙) — 여기서 보는 것은 전부 판정 결과다.
import { describe, expect, it } from 'vitest';
import {
  addPaletteColor,
  addPlayer,
  addStaff,
  duplicateTeam,
  emptyTeam,
  kitColors,
  lineupWarnings,
  playerSessionCounts,
  removePaletteColor,
  removePlayer,
  rosterCounts,
  setKit,
  TEAM_PALETTE_MAX,
  CURRENT_TEAM_SCHEMA,
  setLineup,
  updateStaff,
  type Team,
} from './team.ts';
import type { PFClass } from './roster.ts';
import { validateTeam, LIMITS } from './validate.ts';
import { migrateDoc, TEAM_MIGRATIONS } from './migrate.ts';
import { DEFAULT_TEAMS } from './defaults.ts';
import type { PlayerId } from '../core/ids.ts';

/** 등급 목록대로 선수를 채운 팀. `undefined` = 미분류. */
function teamWith(classes: (PFClass | undefined)[]): Team {
  let t = emptyTeam('ko');
  classes.forEach((k, i) => {
    t = addPlayer(t, `선수${i}`, k);
  });
  return t;
}
const idsOf = (t: Team): PlayerId[] => t.players.map((p) => p.id);

describe('lineupWarnings — 규정 판정(조사 §4.2 R1·R2·R5·R8)', () => {
  it('PF2 는 코트+벤치 합산 3명째에 경고한다 — 2명까지는 조용하다', () => {
    const t = teamWith(['PF2', 'PF2', 'PF1', 'PF1']);
    const [a, b, c, d] = idsOf(t);
    const two = setLineup(t, { court: [a!, b!, c!, d!], gk: d!, bench: [] });
    expect(lineupWarnings(two).some((w) => w.kind === 'pf2-over')).toBe(false);

    // 3번째 PF2 는 **벤치**에 있다 — 교체로 들어오는 선수도 경기 단위 셈에 들어간다(R5).
    const t3 = addPlayer(t, '교체PF2', 'PF2');
    const sub = idsOf(t3)[4]!;
    const three = setLineup(t3, { court: [a!, b!, c!, d!], gk: d!, bench: [sub] });
    expect(lineupWarnings(three)).toContainEqual({ kind: 'pf2-over', count: 3 });
  });

  it('미분류는 PF2 로도 PF1 로도 세지 않는다(R8)', () => {
    const t = teamWith(['PF2', 'PF2', undefined, undefined]);
    const [a, b, c, d] = idsOf(t);
    const l = setLineup(t, { court: [a!, b!, c!, d!], gk: a!, bench: [] });
    // 미분류 2명을 PF2 로 쳤다면 4명이 되어 경고가 떴을 것이다.
    expect(lineupWarnings(l).some((w) => w.kind === 'pf2-over')).toBe(false);
    expect(rosterCounts(t)).toEqual({ pf1: 0, pf2: 2, unclassified: 2 });
  });

  it('코트 위 2명 미만이면 경고한다 — 2명은 경고가 아니다(R2, "4명 미만" 이 아니다)', () => {
    const t = teamWith(['PF1', 'PF1', 'PF1']);
    const [a, b] = idsOf(t);
    expect(lineupWarnings(setLineup(t, { court: [a!], gk: a!, bench: [] }))).toContainEqual({ kind: 'under-min', count: 1 });
    expect(lineupWarnings(setLineup(t, { court: [a!, b!], gk: a!, bench: [] })).some((w) => w.kind === 'under-min')).toBe(false);
  });

  it('GK 는 코트 안의 한 명이어야 한다(R1) — 없거나 벤치에 있으면 경고', () => {
    const t = teamWith(['PF1', 'PF1', 'PF1']);
    const [a, b, c] = idsOf(t);
    expect(lineupWarnings(setLineup(t, { court: [a!, b!], bench: [c!] })).some((w) => w.kind === 'no-gk')).toBe(true);
    expect(lineupWarnings(setLineup(t, { court: [a!, b!], gk: c!, bench: [c!] })).some((w) => w.kind === 'no-gk')).toBe(true);
    expect(lineupWarnings(setLineup(t, { court: [a!, b!], gk: b!, bench: [c!] })).some((w) => w.kind === 'no-gk')).toBe(false);
  });

  it('라인업을 세우지 않은 팀에는 경고가 없다', () => {
    expect(lineupWarnings(teamWith(['PF2', 'PF2', 'PF2']))).toEqual([]);
  });
});

describe('팀 편집 헬퍼', () => {
  it('선수를 지우면 라인업에서도 빠진다 — 이름 없는 칸이 남지 않는다', () => {
    const t = teamWith(['PF1', 'PF1', 'PF1']);
    const [a, b, c] = idsOf(t);
    const withLineup = setLineup(t, { court: [a!, b!], gk: b!, bench: [c!] });
    const after = removePlayer(removePlayer(withLineup, b!), c!);
    expect(after.lineup).toEqual({ court: [a!], bench: [] }); // gk 키까지 사라진다
  });

  it('선임 코치를 지목하면 앞사람의 지목이 풀린다 — 팀당 1명', () => {
    let t = addStaff(addStaff(emptyTeam('ko'), '김코치', ['coach']), '이코치', ['assistantCoach']);
    const [s1, s2] = t.staff.map((s) => s.id);
    t = updateStaff(t, s1!, { isSeniorCoach: true });
    t = updateStaff(t, s2!, { isSeniorCoach: true });
    expect(t.staff.map((s) => s.isSeniorCoach === true)).toEqual([false, true]);
  });
});

describe('duplicateTeam — 선수·스태프 id 재발급(결정 20)', () => {
  it('팀·선수·스태프 id 가 전부 새로 발급되고 라인업·겸직이 새 id 로 다시 매핑된다', () => {
    let t = teamWith(['PF1', 'PF2']);
    const [a, b] = idsOf(t);
    t = setLineup(t, { court: [a!, b!], gk: a!, bench: [] });
    t = addStaff(t, '겸직코치', ['coach']);
    t = updateStaff(t, t.staff[0]!.id, { playerId: a! });

    const copy = duplicateTeam(t, { name: '2027 팀' });
    expect(copy.id).not.toBe(t.id);
    expect(copy.name).toBe('2027 팀');
    // 원본 id 와 **하나도 겹치지 않는다** — 겹치면 세션 participantIds 가 모호해진다.
    const before = new Set<string>([...idsOf(t), ...t.staff.map((s) => s.id)]);
    for (const id of [...idsOf(copy), ...copy.staff.map((s) => s.id)]) expect(before.has(id)).toBe(false);
    // 이름·등급은 그대로 따라온다(재발급되는 것은 id 뿐이다).
    expect(copy.players.map((p) => [p.name, p.klass])).toEqual(t.players.map((p) => [p.name, p.klass]));
    // 라인업·겸직이 **새 id** 를 가리킨다 — 옛 id 를 그대로 베끼면 통째로 고아가 된다.
    expect(copy.lineup).toEqual({ court: idsOf(copy), gk: idsOf(copy)[0], bench: [] });
    expect(copy.staff[0]!.playerId).toBe(idsOf(copy)[0]);
  });
});

describe('playerSessionCounts — 저장하지 않고 세션에서 계산한다(결정 10)', () => {
  it('한 세션에 중복으로 실린 선수도 1회, 남의 팀 id 는 세지 않는다', () => {
    const t = teamWith(['PF1', 'PF1']);
    const [a, b] = idsOf(t);
    const counts = playerSessionCounts(t, [
      { participantIds: [a!, a!, 'pl_남의팀' as PlayerId] },
      { participantIds: [a!, b!] },
      {}, // 참가자를 안 적은 세션
    ]);
    expect(counts.get(a!)).toBe(2);
    expect(counts.get(b!)).toBe(1);
    expect(counts.has('pl_남의팀' as PlayerId)).toBe(false);
  });
});

describe('validateTeam — 파일에서 온 문서 보정', () => {
  it('라인업을 명단의 부분집합으로 강제한다 — 유령 id·중복·코트 밖 GK 를 떨군다', () => {
    const v = validateTeam({
      name: '팀',
      players: [
        { id: 'pl_1', name: '가' },
        { id: 'pl_2', name: '나' },
      ],
      staff: [],
      lineup: { court: ['pl_1', 'pl_유령', 'pl_1'], gk: 'pl_2', bench: ['pl_1', 'pl_2'] },
    });
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.value.lineup).toEqual({ court: ['pl_1'], bench: ['pl_2'] });
    // gk 는 코트 밖이라 버려졌다 — 코트로 옮겨 주면 사용자가 세운 적 없는 라인업이 된다.
    expect(v.value.lineup?.gk).toBeUndefined();
  });

  it('주장·선임 코치는 각각 1명만 남는다', () => {
    const v = validateTeam({
      name: '팀',
      players: [
        { id: 'pl_1', name: '가', isCaptain: true },
        { id: 'pl_2', name: '나', isCaptain: true },
      ],
      staff: [
        { id: 'sf_1', name: 'A', roles: ['coach'], isSeniorCoach: true },
        { id: 'sf_2', name: 'B', roles: ['coach'], isSeniorCoach: true },
      ],
    });
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.value.players.map((p) => p.isCaptain === true)).toEqual([true, false]);
    expect(v.value.staff.map((s) => s.isSeniorCoach === true)).toEqual([true, false]);
  });

  it('중복 id 를 재발급하고 알 수 없는 등급·역할을 폐기한다', () => {
    const v = validateTeam({
      name: '팀',
      players: [
        { id: 'pl_1', name: '가', klass: 'PF3' },
        { id: 'pl_1', name: '나', klass: 'PF2' },
      ],
      staff: [{ id: 'sf_1', name: 'A', roles: ['coach', '주술사'] }],
    });
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(new Set(v.value.players.map((p) => p.id)).size).toBe(2);
    expect('klass' in v.value.players[0]!).toBe(false); // PF3 는 없는 등급 → 미분류
    expect(v.value.players[1]!.klass).toBe('PF2');
    expect(v.value.staff[0]!.roles).toEqual(['coach']);
  });

  it('개인정보 필드는 정화기를 통과하지 못한다(결정 6) · 팔레트는 #rrggbb 만 받는다', () => {
    const v = validateTeam({
      name: '팀',
      palette: ['red; background:url(x)', '#00ff00'],
      players: [{ id: 'pl_1', name: '가', phone: '010-0000-0000', guardian: '보호자', diagnosis: '진단명', birthYear: 2001 }],
    });
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    const p = v.value.players[0]!;
    for (const key of ['phone', 'guardian', 'diagnosis']) expect(key in p).toBe(false);
    expect(p.birthYear).toBe(2001); // 연도만은 남는다
    expect(v.value.palette).toEqual(['#00ff00']); // 형식 위반은 폐기, 성한 색만 남는다
  });

  it('선수·스태프 상한을 넘으면 뒤에서 자른다', () => {
    const many = (n: number, prefix: string) => Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i}`, name: `이름${i}`, roles: [] }));
    const v = validateTeam({ name: '팀', players: many(LIMITS.rosterMax + 5, 'pl_'), staff: many(LIMITS.staffMax + 5, 'sf_') });
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.value.players).toHaveLength(LIMITS.rosterMax);
    expect(v.value.staff).toHaveLength(LIMITS.staffMax);
  });

  it('미래 스키마는 거절한다 — 조용히 열어 필드를 잃지 않는다', () => {
    expect(validateTeam({ schemaVersion: 99, name: '팀' }).ok).toBe(false);
  });
});

// ── 팔레트 · 킷 (2026-09-09) ────────────────────────────────────────────────────
// **이 절을 지우면 새는 실기 버그**: ① 0.6.6 에서 만든 팀을 열면 색이 기본값으로 초기화되는 것
// (v1→v2 가 색 두 칸을 못 옮기면 정화기가 «팔레트 없음» 을 기본 팔레트로 채워 사용자 색이 증발한다)
// ② 팔레트에서 색 하나를 지웠을 뿐인데 남은 킷들이 조용히 옆 색을 입는 것
// ③ 파일이 가리키는 색 번호가 팔레트 밖일 때 화면이 색 없는 칸을 그리는 것.
describe('팔레트 · 킷', () => {
  it('v1(color·gkColor) 문서는 팔레트 두 색 + 홈 킷으로 올라오고, 옛 키는 남지 않는다', () => {
    const mig = migrateDoc({ schemaVersion: 1, id: 'tm_1', name: '옛 팀', color: '#112233', gkColor: '#445566', players: [], staff: [] }, TEAM_MIGRATIONS, CURRENT_TEAM_SCHEMA);
    expect(mig.ok).toBe(true);
    if (!mig.ok) return;
    expect(mig.doc.palette).toEqual(['#112233', '#445566']);
    expect(mig.doc.kits).toEqual({ home: { field: 0, gk: 1 } });
    expect('color' in mig.doc).toBe(false);
    expect('gkColor' in mig.doc).toBe(false);
    // 정화기까지 지나야 실제 저장본이다 — 옮긴 색이 여기서 기본값으로 되돌아가면 이주가 무의미하다.
    const v = validateTeam(mig.doc);
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(kitColors(v.value, 'home')).toEqual({ field: '#112233', gk: '#445566' });
  });

  it('팔레트 색을 지우면 그 색을 쓰던 킷은 0번으로, 뒤에 있던 색을 쓰던 킷은 한 칸 당겨진다', () => {
    let team = emptyTeam('ko'); // 팔레트 2색
    team = addPaletteColor(team, '#333333');
    team = addPaletteColor(team, '#444444');
    team = setKit(team, 'home', { field: 1, gk: 3 });
    team = setKit(team, 'away', { field: 2, gk: 0 });
    const after = removePaletteColor(team, 1);
    expect(after.palette).toHaveLength(3);
    // 홈 필드는 지운 색을 쓰고 있었다 → 0번. 홈 GK 는 3번이었으니 한 칸 당겨 2번.
    expect(after.kits.home).toEqual({ field: 0, gk: 2 });
    // 어웨이 필드는 2번이었으니 1번(= 지금의 '#333333'). 색이 바뀌지 않아야 한다.
    expect(kitColors(after, 'away')!.field).toBe('#333333');
    // 마지막 한 색은 못 뺀다 — 팔레트가 비면 킷이 가리킬 색이 없다.
    const one = removePaletteColor({ ...after, palette: ['#111111'] }, 0);
    expect(one.palette).toEqual(['#111111']);
  });

  it('팔레트는 4색에서 멈춘다', () => {
    let team = emptyTeam('ko');
    for (let i = 0; i < 5; i++) team = addPaletteColor(team, '#0000ff');
    expect(team.palette).toHaveLength(TEAM_PALETTE_MAX);
  });

  it('validate — 범위 밖 색 번호는 접고, 빈 팔레트는 기본 팔레트로 되살린다', () => {
    const v = validateTeam({ name: '팀', palette: ['#111111', '#222222'], kits: { home: { field: 7, gk: 9 }, ghost: { field: 0, gk: 0 } } });
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    // field 는 0번, gk 는 «다른 색» 이 있으므로 1번으로 접는다(GK 는 규정상 달라야 한다).
    expect(v.value.kits.home).toEqual({ field: 0, gk: 1 });
    expect('ghost' in v.value.kits).toBe(false); // 모르는 킷 종류는 화이트리스트가 버린다

    const empty = validateTeam({ name: '팀', palette: [] });
    expect(empty.ok).toBe(true);
    if (!empty.ok) return;
    expect(empty.value.palette).toEqual([DEFAULT_TEAMS.home.color, DEFAULT_TEAMS.home.gkColor]);
  });
});
