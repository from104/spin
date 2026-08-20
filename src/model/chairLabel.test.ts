// §7 3.4 — 선수를 뭐라고 부를 것인가. 세 화면(인스펙터 명단 · 트레이 손잡이 · 시연 자막)과
// 4차 PDF 가 **같은 함수**를 읽는지가 이 항목의 전부라, 규칙 자체는 여기서 순수 함수로 못박는다.
import { describe, expect, it } from 'vitest';
import { chairName, hasChairName, namedRosterOf, numberedName } from './chairLabel.ts';
import type { TeamSide, TeamStyle } from './drill.ts';

const TEAMS: Record<TeamSide, TeamStyle> = {
  home: { label: '우리 팀', color: '#d93a3a', gkColor: '#f2c811' },
  away: { label: '상대', color: '#1f6bb8', gkColor: '#22a95b' },
};

describe('chairName — 명단 한 줄이 읽는 이름', () => {
  it('실명이 있으면 실명으로 읽는다', () => {
    expect(chairName({ team: 'home', number: '2', isGk: false, name: '김민수' }, TEAMS)).toBe('김민수');
  });

  it('이름이 없으면 팀 라벨 + 등번호', () => {
    expect(chairName({ team: 'home', number: '2', isGk: false }, TEAMS)).toBe('우리 팀 2');
    expect(chairName({ team: 'away', number: '4', isGk: false, name: '' }, TEAMS)).toBe('상대 4');
  });

  it('골키퍼의 폴백은 등번호 G 가 아니라 GK 다 — 칩에 이미 G 가 찍혀 있다', () => {
    expect(chairName({ team: 'home', number: 'G', isGk: true }, TEAMS)).toBe('우리 팀 GK');
  });

  it('공백만 적힌 이름은 이름이 아니다 — `name || …` 로는 폴백이 막혀 빈 줄이 된다', () => {
    expect(chairName({ team: 'away', number: '3', isGk: false, name: '   ' }, TEAMS)).toBe('상대 3');
  });

  it('팀 라벨을 바꾼 드릴은 폴백도 그 라벨로 따라온다 — 라벨을 리터럴로 적지 않았다는 증거', () => {
    const teams: Record<TeamSide, TeamStyle> = {
      home: { ...TEAMS.home, label: '노란들판' },
      away: TEAMS.away,
    };
    expect(chairName({ team: 'home', number: '4', isGk: false }, teams)).toBe('노란들판 4');
  });
});

describe('numberedName — 등번호와 사람을 잇는 표기(트레이 · 시연 범례)', () => {
  it('이름이 있으면 번호 뒤에 붙인다', () => {
    expect(numberedName('2', '김민수')).toBe('2번 김민수');
  });

  it('이름이 없으면 **번호만** 이다 — 기존 트레이 손잡이 이름과 한 글자도 달라지면 안 된다', () => {
    // '2번 선수 배치' 를 세는 ToolRail.test.tsx 가 이 계약 위에 서 있다.
    expect(numberedName('2')).toBe('2번');
    expect(numberedName('G', '')).toBe('G번');
    expect(numberedName('4', '  ')).toBe('4번');
  });
});

describe('hasChairName', () => {
  it('빈 문자열·공백·없음은 전부 거짓', () => {
    expect(hasChairName({})).toBe(false);
    expect(hasChairName({ name: '' })).toBe(false);
    expect(hasChairName({ name: ' \n ' })).toBe(false);
  });

  it('한 글자라도 있으면 참', () => {
    expect(hasChairName({ name: '수' })).toBe(true);
  });
});

// §0.5 미배송 빚(2026-08-20) — 인쇄·PNG 가 시연 범례와 같은 값을 읽는지가 이 함수의 전부다.
describe('namedRosterOf — 인쇄·PNG 가 시연 범례와 공유하는 단일 출처', () => {
  it('실명을 적은 선수만, 번호 순서 그대로 나열한다', () => {
    const chairs = [
      { team: 'home' as const, number: '2', isGk: false, name: '김민수' },
      { team: 'home' as const, number: '3', isGk: false }, // 이름 없음 — 빠진다
      { team: 'away' as const, number: '4', isGk: false, name: '  ' }, // 공백뿐 — 빠진다
      { team: 'away' as const, number: 'G', isGk: true, name: '이수현' },
    ];
    expect(namedRosterOf(chairs)).toEqual(['2번 김민수', 'G번 이수현']);
  });

  it('아무도 이름을 안 적었으면 빈 배열', () => {
    expect(namedRosterOf([{ team: 'home' as const, number: '2', isGk: false }])).toEqual([]);
  });
});
