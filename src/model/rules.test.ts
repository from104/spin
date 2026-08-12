// §4.4 P2-4 — 규칙 판정의 순수 계약. 이 파일이 "무엇이 반칙인가" 의 진실 공급원이다
// (렌더·발화·프레임 루프는 전부 이 판정 결과를 옮기기만 한다).
import { describe, expect, it } from 'vitest';
import { GOAL_AREA_MAX, RING_R_PX, RING_SAME_TEAM_MAX, TEAM_BIT, inRect, ringViolation, teamsOfBits, zoneViolation, type RuleActor } from './rules.ts';
import { COURT_DEFS } from './court.ts';
import { PX_PER_M } from '../core/units.ts';

const BALL = { x: 400, y: 260 };
/** 골 지역 하나(풀 코트 좌측). 예외 ① 검증에 쓴다. */
const GZ = COURT_DEFS.full.ruleZones[0]!;

let seq = 0;
function actor(team: RuleActor['team'], x: number, y: number, isGk = false): RuleActor {
  seq += 1;
  return { id: `ch_${seq}`, team, isGk, x, y };
}
/** 공에서 정확히 d 만큼 떨어진 점(수평). */
const at = (d: number): number => BALL.x + d;

describe('rules — 3 m 링(2-on-1)', () => {
  it('3 m 는 75 월드px 다 — 25 px/m 검산', () => {
    expect(RING_R_PX).toBe(75);
    expect(RING_R_PX / PX_PER_M).toBe(3);
  });

  it('같은 팀 2명 + 상대 1명이면 그 팀이 걸린다', () => {
    const bits = ringViolation(BALL, [actor('home', at(10), 260), actor('home', at(-10), 260), actor('away', at(20), 260)], [GZ]);
    expect(bits).toBe(TEAM_BIT.home);
    expect(teamsOfBits(bits)).toEqual(['home']);
  });

  it('[예외 ②] 상대가 3 m 안에 없으면 같은 팀이 몇이든 반칙이 아니다', () => {
    const mates = [actor('home', at(10), 260), actor('home', at(-10), 260), actor('home', 400, 250)];
    // 상대는 링 **밖**(90px)에 있다 — 이 상태가 패스 훈련의 기본 모양이다.
    expect(ringViolation(BALL, [...mates, actor('away', at(90), 260)], [GZ])).toBe(0);
    // 대조군: 그 상대를 링 안으로 한 걸음 들이면 곧바로 켜진다.
    expect(ringViolation(BALL, [...mates, actor('away', at(70), 260)], [GZ])).toBe(TEAM_BIT.home);
  });

  it('같은 팀이 1명뿐이면 상대가 몇이든 그 팀은 안 걸린다', () => {
    const bits = ringViolation(BALL, [actor('home', at(10), 260), actor('away', at(-10), 260), actor('away', at(20), 260)], [GZ]);
    expect(bits & TEAM_BIT.home).toBe(0);
    expect(bits & TEAM_BIT.away).toBe(TEAM_BIT.away); // 대조군 — 반대편은 조건을 채웠다
    expect(RING_SAME_TEAM_MAX).toBe(1); // 문턱이 상수로 노출돼 있다
  });

  it('양 팀이 동시에 조건을 채우면 두 비트가 다 선다', () => {
    const bits = ringViolation(
      BALL,
      [actor('home', at(10), 260), actor('home', at(-10), 260), actor('away', at(20), 260), actor('away', at(-20), 260)],
      [GZ],
    );
    expect(teamsOfBits(bits)).toEqual(['home', 'away']);
  });

  it('경계: 정확히 3 m 는 안이고, 그보다 조금이라도 멀면 밖이다', () => {
    const inside = [actor('home', at(RING_R_PX), 260), actor('home', at(-10), 260), actor('away', at(20), 260)];
    expect(ringViolation(BALL, inside, [GZ])).toBe(TEAM_BIT.home);
    const outside = [actor('home', at(RING_R_PX + 0.01), 260), actor('home', at(-10), 260), actor('away', at(20), 260)];
    expect(ringViolation(BALL, outside, [GZ])).toBe(0);
  });

  it('거리는 유클리드다 — 축이 아니라 반지름으로 잰다', () => {
    // (54, 54) 는 x·y 각각은 75 안이지만 실제 거리는 76.4 로 링 밖이다.
    const diag = [actor('home', BALL.x + 54, BALL.y + 54), actor('home', at(-10), 260), actor('away', at(20), 260)];
    expect(ringViolation(BALL, diag, [GZ])).toBe(0);
  });

  it('[예외 ①] 골 지역 안의 골키퍼는 인원에서 빠진다', () => {
    // 공을 골 지역 앞에 두고 GK + 필드 1명 + 상대 1명 — 수비의 가장 흔한 모양이다.
    const ball = { x: GZ.x + GZ.w + 10, y: GZ.y + GZ.h / 2 };
    const gkIn = actor('home', GZ.x + GZ.w - 5, ball.y, true);
    const mate = actor('home', ball.x + 20, ball.y);
    const foe = actor('away', ball.x + 10, ball.y);
    expect(ringViolation(ball, [gkIn, mate, foe], [GZ])).toBe(0);
    // 대조군 A: **같은 골키퍼가 골 지역 밖으로 나오면** 예외가 사라지고 걸린다.
    const gkOut = actor('home', GZ.x + GZ.w + 5, ball.y, true);
    expect(ringViolation(ball, [gkOut, mate, foe], [GZ])).toBe(TEAM_BIT.home);
    // 대조군 B: 같은 자리라도 **골키퍼가 아니면** 예외가 아니다.
    const fieldIn = actor('home', GZ.x + GZ.w - 5, ball.y, false);
    expect(ringViolation(ball, [fieldIn, mate, foe], [GZ])).toBe(TEAM_BIT.home);
  });

  it('[예외 ①] 골키퍼를 빼고도 2명이 남으면 그대로 걸린다', () => {
    const ball = { x: GZ.x + GZ.w + 10, y: GZ.y + GZ.h / 2 };
    const gkIn = actor('home', GZ.x + GZ.w - 5, ball.y, true);
    const m1 = actor('home', ball.x + 20, ball.y);
    const m2 = actor('home', ball.x, ball.y + 20);
    expect(ringViolation(ball, [gkIn, m1, m2, actor('away', ball.x + 10, ball.y)], [GZ])).toBe(TEAM_BIT.home);
  });

  it('[예외 ①] 빠진 골키퍼도 "상대가 있는가" 에는 그대로 센다', () => {
    // away GK 가 골 지역 안에 있어도 home 입장에서는 **상대가 3 m 안에 있는 것**이다.
    const ball = { x: GZ.x + GZ.w - 20, y: GZ.y + GZ.h / 2 };
    const awayGk = actor('away', GZ.x + GZ.w - 30, ball.y, true);
    const pair = [actor('home', ball.x + 10, ball.y), actor('home', ball.x - 10, ball.y)];
    expect(ringViolation(ball, [...pair, awayGk], [GZ])).toBe(TEAM_BIT.home);
    // 대조군: 그 골키퍼를 링 밖으로 빼면 예외 ② 로 꺼진다.
    expect(ringViolation(ball, [...pair, actor('away', ball.x - 200, ball.y, true)], [GZ])).toBe(0);
  });

  it('골 지역이 없는 코트(flat)에서는 예외 ① 이 성립하지 않는다', () => {
    const gk = actor('home', at(10), 260, true);
    const mate = actor('home', at(-10), 260);
    const foe = actor('away', at(20), 260);
    expect(COURT_DEFS.flat.ruleZones).toHaveLength(0);
    expect(ringViolation(BALL, [gk, mate, foe], COURT_DEFS.flat.ruleZones)).toBe(TEAM_BIT.home);
  });

  it('선수가 없으면 0 이다', () => {
    expect(ringViolation(BALL, [], [GZ])).toBe(0);
  });
});

describe('rules — 골 지역 3인', () => {
  const inZone = (i: number): RuleActor['x'] => GZ.x + 10 + i * 10;

  it('같은 팀 2명까지는 괜찮고 3명부터 걸린다', () => {
    const two = [actor('home', inZone(0), GZ.y + 10), actor('home', inZone(1), GZ.y + 10)];
    expect(zoneViolation(GZ, two)).toBe(0);
    expect(zoneViolation(GZ, [...two, actor('home', inZone(2), GZ.y + 10)])).toBe(TEAM_BIT.home);
    expect(GOAL_AREA_MAX).toBe(2);
  });

  it('골키퍼도 인원에 센다 — 링의 예외 ① 은 여기 적용되지 않는다', () => {
    const three = [
      actor('home', inZone(0), GZ.y + 10, true),
      actor('home', inZone(1), GZ.y + 10),
      actor('home', inZone(2), GZ.y + 10),
    ];
    expect(zoneViolation(GZ, three)).toBe(TEAM_BIT.home);
  });

  it('팀별로 따로 센다 — 섞여 있는 6명은 아무도 안 걸린다', () => {
    const mixed = [
      actor('home', inZone(0), GZ.y + 10),
      actor('home', inZone(1), GZ.y + 10),
      actor('away', inZone(2), GZ.y + 10),
      actor('away', inZone(3), GZ.y + 10),
    ];
    expect(zoneViolation(GZ, mixed)).toBe(0);
    // 대조군: 한 팀만 한 명 더 들어오면 그 팀만 걸린다.
    expect(zoneViolation(GZ, [...mixed, actor('away', inZone(4), GZ.y + 10)])).toBe(TEAM_BIT.away);
  });

  it('존 밖의 선수는 세지 않는다', () => {
    const out = [
      actor('home', GZ.x + GZ.w + 1, GZ.y + 10),
      actor('home', GZ.x - 1, GZ.y + 10),
      actor('home', GZ.x + 10, GZ.y - 1),
      actor('home', GZ.x + 10, GZ.y + GZ.h + 1),
    ];
    expect(zoneViolation(GZ, out)).toBe(0);
  });

  it('경계선 위는 안이다', () => {
    const online = [
      actor('home', GZ.x, GZ.y),
      actor('home', GZ.x + GZ.w, GZ.y + GZ.h),
      actor('home', GZ.x + GZ.w, GZ.y),
    ];
    expect(zoneViolation(GZ, online)).toBe(TEAM_BIT.home);
    expect(inRect(GZ, GZ.x, GZ.y)).toBe(true);
    expect(inRect(GZ, GZ.x - 0.01, GZ.y)).toBe(false);
  });
});

describe('rules — teamsOfBits', () => {
  it('비트합을 팀 목록으로 편다', () => {
    expect(teamsOfBits(0)).toEqual([]);
    expect(teamsOfBits(TEAM_BIT.home)).toEqual(['home']);
    expect(teamsOfBits(TEAM_BIT.away)).toEqual(['away']);
    expect(teamsOfBits(TEAM_BIT.home | TEAM_BIT.away)).toEqual(['home', 'away']);
  });
});
