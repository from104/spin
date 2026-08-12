// 4.6 — 팀 표식의 단일 출처. 여기서 다루는 것은 "표식이 **팀 소속에서만** 나오는가" 다.
// 세 경로(화면·PNG·인쇄)에 실제로 그려지는지는 teamMonochrome.test.tsx 가 본다.
import { describe, expect, it } from 'vitest';
import type { ChairId } from '../core/ids.ts';
import type { ChairDef, TeamSide, TeamStyle } from '../model/drill.ts';
import { DEFAULT_TEAMS } from '../model/defaults.ts';
import { CHAIR_STROKE_W, TEAM_PATTERNS, teamMarkFor, teamPatternFor } from './teamMark.ts';

const TEAMS: Record<TeamSide, TeamStyle> = { home: { ...DEFAULT_TEAMS.home }, away: { ...DEFAULT_TEAMS.away } };
const def = (team: TeamSide, over: Partial<ChairDef> = {}): ChairDef => ({ id: 'ch_1' as ChairId, team, number: '4', isGk: false, ...over });

describe('teamPatternFor — 색이 아닌 채널', () => {
  it('두 팀의 패턴은 모든 항목에서 갈린다', () => {
    const home = teamPatternFor('home');
    const away = teamPatternFor('away');
    expect(home.strokeDash).toBeUndefined();
    expect(away.strokeDash).toBe('5 3');
    expect(home.guardFill).not.toBe(away.guardFill);
  });

  it('패턴 표는 얼어 있다 — 렌더 도중 누가 바꾸면 두 팀이 뒤섞인다', () => {
    expect(Object.isFrozen(TEAM_PATTERNS)).toBe(true);
    expect(Object.isFrozen(TEAM_PATTERNS.away)).toBe(true);
    // 대조군: 얼지 않은 객체는 이 단언을 통과하지 못한다(단언 자체가 항상 참이 아님을 보인다).
    expect(Object.isFrozen({ ...TEAM_PATTERNS.away })).toBe(false);
  });
});

describe('teamMarkFor — 표식은 색 규칙과 독립이다', () => {
  it('골키퍼도 자기 팀 표식을 그대로 단다', () => {
    // GK 는 팀 색 대신 GK 색을 쓴다(§3.5) — 색 채널이 이미 팀에서 벗어나는 자리다.
    // 그래서 표식이 `isGk` 가 아니라 `team` 에서 나와야 GK 가 어느 편인지 남는다.
    expect(teamMarkFor(def('home', { isGk: true, number: 'G' }), TEAMS).strokeDash).toBeUndefined();
    expect(teamMarkFor(def('away', { isGk: true, number: 'G' }), TEAMS).strokeDash).toBe('5 3');
    expect(teamMarkFor(def('away', { isGk: true }), TEAMS).guardFill).toBe(teamMarkFor(def('away'), TEAMS).guardFill);
    // 대조군: 색은 GK 에서 실제로 달라진다(위 단언이 "아무것도 안 변해서 통과"가 아님).
    expect(teamMarkFor(def('away', { isGk: true }), TEAMS).fill).not.toBe(teamMarkFor(def('away'), TEAMS).fill);
  });

  it('개별 색 지정은 표식을 덮어쓰지 못한다', () => {
    const home = teamMarkFor(def('home', { color: '#7c5cd6' }), TEAMS);
    const away = teamMarkFor(def('away', { color: '#7c5cd6' }), TEAMS);
    expect(home.fill).toBe(away.fill); // 색 채널은 완전히 무너졌다
    expect(home.strokeDash).not.toBe(away.strokeDash); // 그래도 팀은 갈린다
    expect(home.guardFill).not.toBe(away.guardFill);
  });

  it('테두리 굵기는 ChairChip 의 2.2 와 같다', () => {
    expect(CHAIR_STROKE_W).toBe(2.2);
    expect(teamMarkFor(def('home'), TEAMS).strokeWidth).toBe(CHAIR_STROKE_W);
    expect(teamMarkFor(def('away'), TEAMS).strokeWidth).toBe(CHAIR_STROKE_W);
  });
});
