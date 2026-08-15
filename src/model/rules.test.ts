// §4.4 P2-4 — 규칙 판정의 순수 계약. 이 파일이 "무엇이 반칙인가" 의 진실 공급원이다
// (렌더·발화·프레임 루프는 전부 이 판정 결과를 옮기기만 한다).
//
// ⚠️ 2026-08-13 — 판정이 **피벗 점**에서 **차체 사각형**으로 바뀌었다(기현님 지시:
// *"정확하게 휠체어 경계선(사각형)이다. 에누리 없다. 역으로 수비 골키퍼가 골에리어에 조금만
// 걸쳐있어도 2-on-1 반칙 면제"*). 아래 케이스 중 **좌표를 손봐야 했던 것**들은 그 자리에
// "왜 값이 바뀌었나" 를 적어 뒀다 — 대조군을 잃지 않기 위해 지우지 않고 옮겼다.
// 차체는 피벗 뒤 0.3 m · 앞 1.2 m · 폭 1.0 m 이므로(`CHAIR`), 같은 피벗 좌표라도
// **방향에 따라 결과가 다르다.** 좌표를 다시 손볼 때는 그 사실부터 떠올릴 것.
/// <reference types="node" />
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  GOAL_AREA_MAX,
  RING_R_PX,
  RING_SAME_TEAM_MAX,
  TEAM_BIT,
  defaultDefense,
  defendedZones,
  inRect,
  ringViolation,
  teamsOfBits,
  zoneViolation,
  type DefendedZone,
  type RuleActor,
} from './rules.ts';
import { COURT_DEFS, COURT_MODES, COURT_SIZES, courtDefFor } from './court.ts';
import { chairOverlapsRect } from './chairOverlap.ts';
import { CHAIR } from '../core/constants.ts';
import { PX_PER_M } from '../core/units.ts';

const BALL = { x: 400, y: 260 };
/** 골 지역 하나(풀 코트 좌측). 예외 ① 검증에 쓴다. */
const GZ = COURT_DEFS.full.ruleZones[0]!;
/** 그 골 지역을 **홈이 지킨다**(= 풀 코트의 기본 진영). 2026-08-15 부터 판정 함수는 사각형이
 *  아니라 이 쌍을 받는다 — 골 지역 3인이 수비 팀에만 걸리고, 골키퍼 면제도 자기 골 지역에서만
 *  성립하기 때문이다. 옛 케이스들이 전부 home 을 수비로 두고 쓰였으므로 이것이 그때의 뜻이다. */
const GZ_HOME: DefendedZone = { rect: GZ, defender: 'home' };
/** 같은 사각형인데 **원정이 지키는** 경우. 진영이 판정을 뒤집는다는 것을 재는 대조군이다. */
const GZ_AWAY: DefendedZone = { rect: GZ, defender: 'away' };

/** 차체 치수. 좌표 리터럴을 쓰지 않기 위해 여기서만 이름을 붙인다(규칙 6). */
const BACK = CHAIR.pivotToRearPx; // 7.5 px = 0.3 m
const FRONT = CHAIR.pivotToFrontPx; // 30 px = 1.2 m
const HALF_W = CHAIR.widthPx / 2; // 12.5 px = 0.5 m
/** 뒤를 보인 차체가 링에 처음 걸리는 피벗 거리(= 3 m + 뒤 0.3 m). */
const REACH_BACK = RING_R_PX + BACK;
/** 공을 마주 본 차체가 링에 처음 걸리는 피벗 거리(= 3 m + 앞 1.2 m). 22.5 px 더 멀다. */
const REACH_FRONT = RING_R_PX + FRONT;

let seq = 0;
/** ⚠️ `theta` 기본값 0 은 **+x 를 보는 차체**다(앞범퍼가 오른쪽으로 1.2 m). 옛 케이스들이
 *  전부 이 기본값을 쓰므로, 아래에서 좌표가 바뀐 이유는 대개 "그 앞범퍼" 다. */
function actor(team: RuleActor['team'], x: number, y: number, isGk = false, theta = 0): RuleActor {
  seq += 1;
  return { id: `ch_${seq}`, team, isGk, x, y, theta };
}
/** 공에서 정확히 d 만큼 떨어진 점(수평). */
const at = (d: number): number => BALL.x + d;

describe('rules — 3 m 링(2-on-1)', () => {
  it('3 m 는 75 월드px 다 — 25 px/m 검산', () => {
    expect(RING_R_PX).toBe(75);
    expect(RING_R_PX / PX_PER_M).toBe(3);
  });

  it('같은 팀 2명 + 상대 1명이면 그 팀이 걸린다', () => {
    const bits = ringViolation(BALL, [actor('home', at(10), 260), actor('home', at(-10), 260), actor('away', at(20), 260)], [GZ_HOME]);
    expect(bits).toBe(TEAM_BIT.home);
    expect(teamsOfBits(bits)).toEqual(['home']);
  });

  it('[예외 ②] 상대가 3 m 안에 없으면 같은 팀이 몇이든 반칙이 아니다', () => {
    const mates = [actor('home', at(10), 260), actor('home', at(-10), 260), actor('home', 400, 250)];
    // 상대는 링 **밖**에 있다 — 이 상태가 패스 훈련의 기본 모양이다.
    // ⚠️ 옛 값은 피벗 90 px 이었다. 차체 판정에서는 +x 를 보는 차체의 **뒷면**이 공 쪽이므로
    //    문턱이 82.5 px 다 — 90 은 여전히 밖이지만 여유가 7.5 px 뿐이라, 문턱에서 파생한 값으로
    //    바꿔 "왜 밖인지" 를 좌표가 스스로 말하게 했다.
    expect(ringViolation(BALL, [...mates, actor('away', at(REACH_BACK + 10), 260)], [GZ_HOME])).toBe(0);
    // 대조군: 그 상대를 링 안으로 한 걸음 들이면 곧바로 켜진다.
    expect(ringViolation(BALL, [...mates, actor('away', at(REACH_BACK - 10), 260)], [GZ_HOME])).toBe(TEAM_BIT.home);
  });

  it('같은 팀이 1명뿐이면 상대가 몇이든 그 팀은 안 걸린다', () => {
    const bits = ringViolation(BALL, [actor('home', at(10), 260), actor('away', at(-10), 260), actor('away', at(20), 260)], [GZ_HOME]);
    expect(bits & TEAM_BIT.home).toBe(0);
    expect(bits & TEAM_BIT.away).toBe(TEAM_BIT.away); // 대조군 — 반대편은 조건을 채웠다
    expect(RING_SAME_TEAM_MAX).toBe(1); // 문턱이 상수로 노출돼 있다
  });

  it('양 팀이 동시에 조건을 채우면 두 비트가 다 선다', () => {
    const bits = ringViolation(
      BALL,
      [actor('home', at(10), 260), actor('home', at(-10), 260), actor('away', at(20), 260), actor('away', at(-20), 260)],
      [GZ_HOME],
    );
    expect(teamsOfBits(bits)).toEqual(['home', 'away']);
  });

  it('★ 경계: 차체가 3 m 선에 **닿으면** 안이고, 0.1 px 밖이면 밖이다', () => {
    // ⚠️ **이 케이스가 이번 변경의 심장이다.** 옛 판은 피벗이 정확히 75 px 일 때를 쟀다 —
    //    그 좌표는 이제 차체가 한참 안쪽이라(뒷면이 67.5 px) 경계를 못 찌른다. 그래서 문턱을
    //    차체 기준으로 옮겼다: 뒤를 보이면 82.5 px, 앞을 보이면 105 px.
    const mate = actor('home', at(-10), 260);
    const foe = actor('away', at(20), 260);
    const judge = (x: number, theta: number): number => ringViolation(BALL, [actor('home', x, 260, false, theta), mate, foe], [GZ_HOME]);
    // ⓐ 뒤를 보인 차체(θ=0) — 뒷면이 공에서 정확히 3 m.
    expect(judge(at(REACH_BACK), 0)).toBe(TEAM_BIT.home);
    expect(judge(at(REACH_BACK + 0.1), 0)).toBe(0);
    // ⓑ 공을 마주 본 차체(θ=180°) — 앞범퍼가 정확히 3 m. **22.5 px(0.9 m) 더 멀다.**
    expect(judge(at(REACH_FRONT), Math.PI)).toBe(TEAM_BIT.home);
    expect(judge(at(REACH_FRONT + 0.1), Math.PI)).toBe(0);
    // ★ 두 문턱 사이의 같은 좌표가 **방향으로 갈린다** — 원으로 재고 있다면 여기서 빨개진다.
    const between = at((REACH_BACK + REACH_FRONT) / 2);
    expect(judge(between, 0)).toBe(0);
    expect(judge(between, Math.PI)).toBe(TEAM_BIT.home);
  });

  it('거리는 유클리드다 — 축이 아니라 반지름으로 잰다', () => {
    // ⚠️ 옛 좌표는 피벗 (+54,+54) 였다. 차체 판정에서는 뒤·왼 꼭짓점이 (+46.5,+41.5) 라
    //    62.3 px = 링 **안**이 되어 이 케이스가 뜻을 잃었다. 그래서 **꼭짓점**을 (+60,+60) 에
    //    두도록 피벗을 옮겼다 — 축으로는 각각 75 안, 실제 거리는 84.9 로 밖이다.
    const corner = (d: number): RuleActor => actor('home', BALL.x + d + BACK, BALL.y + d + HALF_W);
    const others = [actor('home', at(-10), 260), actor('away', at(20), 260)];
    expect(ringViolation(BALL, [corner(60), ...others], [GZ_HOME])).toBe(0);
    // 대조군: 같은 축 좌표를 50 으로 줄이면 반지름 70.7 로 안이다(부재 단언이 헛것이 아니다).
    expect(ringViolation(BALL, [corner(50), ...others], [GZ_HOME])).toBe(TEAM_BIT.home);
  });

  it('[예외 ①] 골 지역 안의 골키퍼는 인원에서 빠진다', () => {
    // 공을 골 지역 앞에 두고 GK + 필드 1명 + 상대 1명 — 수비의 가장 흔한 모양이다.
    const ball = { x: GZ.x + GZ.w + 10, y: GZ.y + GZ.h / 2 };
    const gkIn = actor('home', GZ.x + GZ.w - 5, ball.y, true);
    const mate = actor('home', ball.x + 20, ball.y);
    const foe = actor('away', ball.x + 10, ball.y);
    expect(ringViolation(ball, [gkIn, mate, foe], [GZ_HOME])).toBe(0);
    // 대조군 A: **같은 골키퍼가 골 지역 밖으로 나오면** 예외가 사라지고 걸린다.
    // ⚠️ 옛 값은 존 오른쪽 변 +5 였다. 이제 그 자리는 차체 뒷부분(0.3 m)이 존에 걸려 **면제**다
    //    — 아래 '거짓 2-on-1' 블록이 바로 그 좌표를 따로 잰다. 진짜로 나온 것은 뒷면까지
    //    나왔을 때이므로 +BACK+0.1 로 옮겼다.
    const gkOut = actor('home', GZ.x + GZ.w + BACK + 0.1, ball.y, true);
    expect(ringViolation(ball, [gkOut, mate, foe], [GZ_HOME])).toBe(TEAM_BIT.home);
    // 대조군 B: 같은 자리라도 **골키퍼가 아니면** 예외가 아니다.
    const fieldIn = actor('home', GZ.x + GZ.w - 5, ball.y, false);
    expect(ringViolation(ball, [fieldIn, mate, foe], [GZ_HOME])).toBe(TEAM_BIT.home);
  });

  it('[예외 ①] 골키퍼를 빼고도 2명이 남으면 그대로 걸린다', () => {
    const ball = { x: GZ.x + GZ.w + 10, y: GZ.y + GZ.h / 2 };
    const gkIn = actor('home', GZ.x + GZ.w - 5, ball.y, true);
    const m1 = actor('home', ball.x + 20, ball.y);
    const m2 = actor('home', ball.x, ball.y + 20);
    expect(ringViolation(ball, [gkIn, m1, m2, actor('away', ball.x + 10, ball.y)], [GZ_HOME])).toBe(TEAM_BIT.home);
  });

  it('[예외 ①] 빠진 골키퍼도 "상대가 있는가" 에는 그대로 센다', () => {
    // away GK 가 골 지역 안에 있어도 home 입장에서는 **상대가 3 m 안에 있는 것**이다.
    const ball = { x: GZ.x + GZ.w - 20, y: GZ.y + GZ.h / 2 };
    const awayGk = actor('away', GZ.x + GZ.w - 30, ball.y, true);
    const pair = [actor('home', ball.x + 10, ball.y), actor('home', ball.x - 10, ball.y)];
    expect(ringViolation(ball, [...pair, awayGk], [GZ_HOME])).toBe(TEAM_BIT.home);
    // 대조군: 그 골키퍼를 링 밖으로 빼면 예외 ② 로 꺼진다.
    expect(ringViolation(ball, [...pair, actor('away', ball.x - 200, ball.y, true)], [GZ_HOME])).toBe(0);
  });

  it('골 지역이 없는 코트(flat)에서는 예외 ① 이 성립하지 않는다', () => {
    const gk = actor('home', at(10), 260, true);
    const mate = actor('home', at(-10), 260);
    const foe = actor('away', at(20), 260);
    expect(COURT_DEFS.flat.ruleZones).toHaveLength(0);
    expect(ringViolation(BALL, [gk, mate, foe], defendedZones(COURT_DEFS.flat.ruleZones, 'home'))).toBe(TEAM_BIT.home);
  });

  it('선수가 없으면 0 이다', () => {
    expect(ringViolation(BALL, [], [GZ_HOME])).toBe(0);
  });
});

// ── 2026-08-13 기현님 지시 — **차체 사각형 판정** ────────────────────────────────────────────
describe('rules — 판정은 점이 아니라 차체 사각형이다', () => {
  const mate = actor('home', at(-10), 260);
  const foe = actor('away', at(20), 260);
  const judge = (x: number, y: number, theta: number): number =>
    ringViolation(BALL, [actor('home', x, y, false, theta), mate, foe], [GZ_HOME]);

  it('★ 앞범퍼가 3 m 선을 밟으면 센다 — 피벗은 4 m 밖인데도', () => {
    // 공을 정면으로 마주 본 휠체어. 피벗은 100 px(4 m)로 링 밖이지만 앞범퍼는 70 px 다.
    const pivot = at(100);
    expect(Math.abs(pivot - BALL.x) > RING_R_PX, '피벗은 3 m 밖').toBe(true);
    expect(judge(pivot, 260, Math.PI)).toBe(TEAM_BIT.home);
    // 대조군 — 같은 자리에서 **등을 돌리면** 뒷면이 107.5 px 라 밖이다. 이 둘이 같아지면
    // 방향을 안 보고 있는 것이다(= 원으로 재고 있다).
    expect(judge(pivot, 260, 0)).toBe(0);
  });

  it('네 직각 방향 + 비스듬(37°) 전부에서 앞범퍼가 1.2 m 를 뻗는다', () => {
    for (const deg of [0, 90, 180, 270, 37]) {
      const theta = (deg * Math.PI) / 180;
      // 공을 **정면으로 보도록** 놓는다: 차체가 θ 를 보므로 공은 피벗 + d·u 에 있어야 한다
      // → 피벗 = 공 − d·u. d 를 REACH_FRONT(=105) 앞뒤로 0.1 px 만 흔든다.
      const inX = BALL.x - Math.cos(theta) * (REACH_FRONT - 0.1);
      const inY = BALL.y - Math.sin(theta) * (REACH_FRONT - 0.1);
      const outX = BALL.x - Math.cos(theta) * (REACH_FRONT + 0.1);
      const outY = BALL.y - Math.sin(theta) * (REACH_FRONT + 0.1);
      expect(judge(inX, inY, theta), `${deg}° 0.1 px 안`).toBe(TEAM_BIT.home);
      expect(judge(outX, outY, theta), `${deg}° 0.1 px 밖`).toBe(0);
    }
  });
});

describe('rules — 골키퍼 면제는 차체가 **조금이라도** 걸치면 성립한다', () => {
  // 기현님 문장 그대로: *"수비 골키퍼가 골에리어에 조금만 걸쳐있어도 2-on-1 반칙 면제"*.
  // 공은 골 지역 오른쪽 변 앞에 두고, 홈 = GK + 필드 1명, 원정 1명(예외 ② 충족).
  const ball = { x: GZ.x + GZ.w + 60, y: GZ.y + GZ.h / 2 };
  const mate = actor('home', ball.x + 20, ball.y);
  const foe = actor('away', ball.x + 10, ball.y);
  const withGk = (gk: RuleActor): number => ringViolation(ball, [gk, mate, foe], [GZ_HOME]);
  /** GK 가 링 안에 있는지부터 확인한다 — 링 밖이면 면제고 뭐고 애초에 안 세므로 헛통과다. */
  const gkInRing = (gk: RuleActor): boolean => ringViolation(ball, [gk, mate, actor('away', ball.x, ball.y)], []) !== 0;

  it('ⓐ 차체가 통째로 골 지역 안 → 면제', () => {
    const gk = actor('home', GZ.x + GZ.w - FRONT - 1, ball.y, true);
    expect(chairOverlapsRect(gk.x, gk.y, gk.theta, GZ.x, GZ.y, GZ.w, GZ.h)).toBe(true);
    expect(gkInRing(gk), 'GK 가 링 안에 있어야 이 케이스가 뜻을 갖는다').toBe(true);
    expect(withGk(gk)).toBe(0);
  });

  it('ⓑ 차체가 절반만 걸침(피벗은 **밖**) → 면제 — 옛 점 판정은 여기서 틀렸다', () => {
    const gk = actor('home', GZ.x + GZ.w + 5, ball.y, true);
    expect(inRect(GZ, gk.x, gk.y), '옛 판정이 보던 점은 존 밖이다').toBe(false);
    expect(chairOverlapsRect(gk.x, gk.y, gk.theta, GZ.x, GZ.y, GZ.w, GZ.h), '그런데 차체는 걸쳐 있다').toBe(true);
    expect(gkInRing(gk)).toBe(true);
    expect(withGk(gk)).toBe(0);
  });

  it('ⓒ 모서리만 닿음(45° 차체의 꼭짓점 하나) → 면제', () => {
    const theta = Math.PI / 4;
    // 존 오른쪽 변에 꼭짓점 하나만 정확히 얹는다. 나머지 세 꼭짓점은 전부 변 오른쪽이다.
    const dxMin = -Math.min(
      -BACK * Math.cos(theta) - -HALF_W * Math.sin(theta),
      FRONT * Math.cos(theta) - -HALF_W * Math.sin(theta),
      FRONT * Math.cos(theta) - HALF_W * Math.sin(theta),
      -BACK * Math.cos(theta) - HALF_W * Math.sin(theta),
    );
    const gk = actor('home', GZ.x + GZ.w + dxMin, GZ.y + GZ.h / 2, true, theta);
    expect(inRect(GZ, gk.x, gk.y)).toBe(false);
    expect(chairOverlapsRect(gk.x, gk.y, gk.theta, GZ.x, GZ.y, GZ.w, GZ.h)).toBe(true);
    // 이 GK 는 링 안이어야 한다 — 공을 그 차체 근처로 옮겨 잰다.
    const nearBall = { x: gk.x + 40, y: gk.y };
    expect(ringViolation(nearBall, [gk, actor('home', nearBall.x + 10, nearBall.y), actor('away', nearBall.x + 5, nearBall.y)], [GZ_HOME])).toBe(0);
    // 대조군: 0.1 px 만 물러나면 면제가 사라져 곧바로 붉어진다.
    const gkOff = actor('home', gk.x + 0.1, gk.y, true, theta);
    expect(chairOverlapsRect(gkOff.x, gkOff.y, gkOff.theta, GZ.x, GZ.y, GZ.w, GZ.h)).toBe(false);
    expect(ringViolation(nearBall, [gkOff, actor('home', nearBall.x + 10, nearBall.y), actor('away', nearBall.x + 5, nearBall.y)], [GZ_HOME])).toBe(TEAM_BIT.home);
  });

  it('ⓓ 차체가 통째로 밖 → 면제 아님(붉다)', () => {
    const gk = actor('home', GZ.x + GZ.w + BACK + 0.1, ball.y, true);
    expect(chairOverlapsRect(gk.x, gk.y, gk.theta, GZ.x, GZ.y, GZ.w, GZ.h)).toBe(false);
    expect(gkInRing(gk)).toBe(true);
    expect(withGk(gk)).toBe(TEAM_BIT.home);
  });

  it('★ 기현님 시나리오 — 골 지역에 걸친 골키퍼 + 수비 1명이면 **거짓 2-on-1 이 사라진다**', () => {
    // *"역으로 수비 골키퍼가 골에리어에 조금만 걸쳐있어도 2-on-1 반칙 면제이다"*
    // 배치: 공은 골 지역 오른쪽 변 밖, 홈 GK 는 피벗이 존 밖이지만 차체 뒤가 존에 걸쳐 있다.
    //       홈 수비 1명과 원정 공격 1명이 같은 링 안 — 옛 코드에서는 홈 2명이라 붉었다.
    const b = { x: GZ.x + GZ.w + 70, y: GZ.y + GZ.h / 2 };
    const gk = actor('home', GZ.x + GZ.w + 5, b.y, true);
    const back = actor('home', b.x + 20, b.y);
    const striker = actor('away', b.x + 10, b.y);
    // ① 옛 판정이 보던 것 — 점은 존 밖이다(= 면제 없음 → 홈 2명 → 붉음).
    expect(inRect(GZ, gk.x, gk.y)).toBe(false);
    // ② 셋 다 실제로 링 안이다(= "아무도 안 들어와서 깨끗" 이 아니다).
    for (const a of [gk, back, striker]) {
      expect(ringViolation(b, [a, actor('home', b.x, b.y), actor('away', b.x, b.y)], []) !== 0, `${a.id} 가 링 안`).toBe(true);
    }
    // ③ 새 판정은 깨끗하다.
    expect(ringViolation(b, [gk, back, striker], [GZ_HOME])).toBe(0);
    // ④ 대조군 — 그 골키퍼를 존에서 **완전히** 떼면 곧바로 붉어진다(면제만 사라진 것이다).
    const gkOut = actor('home', GZ.x + GZ.w + BACK + 0.1, b.y, true);
    expect(ringViolation(b, [gkOut, back, striker], [GZ_HOME])).toBe(TEAM_BIT.home);
  });

  it('코트 3크기 × 3모드 전부에서 같은 규율이다 — flat 은 예외 ① 이 꺼진 채 안 터진다', () => {
    for (const mode of COURT_MODES) {
      for (const size of COURT_SIZES) {
        const def = courtDefFor(mode, size);
        const zone = def.ruleZones[0];
        const tag = `${mode}/${size}`;
        if (!zone) {
          expect(mode, tag).toBe('flat');
          // 골 지역이 없다 = 면제가 없다. 빈 배열로도 터지지 않고 그냥 붉다.
          const b = { x: 200, y: 200 };
          expect(
            ringViolation(b, [actor('home', b.x + 10, b.y, true), actor('home', b.x - 10, b.y), actor('away', b.x + 20, b.y)], defendedZones(def.ruleZones, 'home')),
            tag,
          ).toBe(TEAM_BIT.home);
          continue;
        }
        // 존의 오른쪽 변에 차체 뒷부분만 걸친 GK. 피벗은 밖이고 차체는 안이다.
        const b = { x: zone.x + zone.w + 60, y: zone.y + zone.h / 2 };
        const gk = actor('home', zone.x + zone.w + 5, b.y, true);
        expect(inRect(zone, gk.x, gk.y), tag).toBe(false);
        // ⚠️ **진영을 입혀서 넘긴다**(2026-08-15). 홈 GK 의 면제는 **홈이 지키는** 존에서만
        //    성립하므로, 사각형만 넘기던 옛 호출은 이제 뜻이 없다.
        const zones = defendedZones(def.ruleZones, 'home');
        expect(ringViolation(b, [gk, actor('home', b.x + 20, b.y), actor('away', b.x + 10, b.y)], zones), tag).toBe(0);
        // 대조군 — 존에서 완전히 떼면 붉다.
        const gkOut = actor('home', zone.x + zone.w + BACK + 0.1, b.y, true);
        expect(ringViolation(b, [gkOut, actor('home', b.x + 20, b.y), actor('away', b.x + 10, b.y)], zones), tag).toBe(TEAM_BIT.home);
      }
    }
  });
});

describe('rules — 골 지역 3인', () => {
  const inZone = (i: number): RuleActor['x'] => GZ.x + 10 + i * 10;

  it('같은 팀 2명까지는 괜찮고 3명부터 걸린다', () => {
    const two = [actor('home', inZone(0), GZ.y + 10), actor('home', inZone(1), GZ.y + 10)];
    expect(zoneViolation(GZ_HOME, two)).toBe(0);
    expect(zoneViolation(GZ_HOME, [...two, actor('home', inZone(2), GZ.y + 10)])).toBe(TEAM_BIT.home);
    expect(GOAL_AREA_MAX).toBe(2);
  });

  it('골키퍼도 인원에 센다 — 링의 예외 ① 은 여기 적용되지 않는다', () => {
    const three = [
      actor('home', inZone(0), GZ.y + 10, true),
      actor('home', inZone(1), GZ.y + 10),
      actor('home', inZone(2), GZ.y + 10),
    ];
    expect(zoneViolation(GZ_HOME, three)).toBe(TEAM_BIT.home);
  });

  it('★ 공격은 제한이 없다 — 상대 골 지역에 몇 대가 들어가도 안 걸린다 (기현 지시 2026-08-15)', () => {
    // 골 앞 마무리 드릴의 기본 모양이다: **공격 3대**가 상대 골 지역에 들어간다.
    // 2026-08-15 이전에는 팀 무관으로 세어 이 판이 상시 붉었다 — 코치에게 없는 반칙을 가르쳤다.
    const attackers = [
      actor('away', inZone(0), GZ.y + 10),
      actor('away', inZone(1), GZ.y + 10),
      actor('away', inZone(2), GZ.y + 10),
      actor('away', inZone(3), GZ.y + 10),
    ];
    expect(zoneViolation(GZ_HOME, attackers), '공격이 걸렸다').toBe(0);
    // ★ 대조군 — **같은 좌표, 같은 인원인데 진영만 뒤집으면** 걸린다. 이 한 줄이 진영이
    //   판정을 정한다는 것의 전부다.
    expect(zoneViolation(GZ_AWAY, attackers)).toBe(TEAM_BIT.away);
  });

  it('수비와 공격이 섞여 있어도 **수비만** 센다', () => {
    const mixed = [
      actor('home', inZone(0), GZ.y + 10),
      actor('home', inZone(1), GZ.y + 10),
      actor('away', inZone(2), GZ.y + 10),
      actor('away', inZone(3), GZ.y + 10),
      actor('away', inZone(4), GZ.y + 10),
    ];
    // 공격 3대가 있어도 수비는 둘뿐이다.
    expect(zoneViolation(GZ_HOME, mixed)).toBe(0);
    // 대조군: 수비를 하나 더 들이면 그때 걸린다.
    expect(zoneViolation(GZ_HOME, [...mixed, actor('home', inZone(5), GZ.y + 10)])).toBe(TEAM_BIT.home);
  });

  it('반환 비트는 언제나 **그 존을 지키는 팀**이다 — 상대 비트가 설 길이 없다', () => {
    const four = [0, 1, 2, 3].map((i) => actor('away', inZone(i), GZ.y + 10));
    expect(zoneViolation(GZ_AWAY, four) & TEAM_BIT.home).toBe(0);
    expect(teamsOfBits(zoneViolation(GZ_AWAY, four))).toEqual(['away']);
  });

  it('존 밖의 선수는 세지 않는다', () => {
    // ⚠️ 옛 좌표는 **피벗이 1 px 밖**이었다(예: GZ.x + GZ.w + 1). 차체 판정에서는 그 넷이
    //    전부 존 **안**이다 — 차체가 걸쳐 있기 때문이고, 그게 이번 변경의 요점이다.
    //    그래서 "밖" 을 차체 기준으로 다시 잡았다: 각 변에서 차체 치수 + 1 px.
    const out = [
      actor('home', GZ.x + GZ.w + BACK + 1, GZ.y + 10), // 오른쪽 — 뒷면이 변 밖
      actor('home', GZ.x - FRONT - 1, GZ.y + 10), // 왼쪽 — 앞범퍼가 변 밖
      actor('home', GZ.x + 10, GZ.y - HALF_W - 1), // 위
      actor('home', GZ.x + 10, GZ.y + GZ.h + HALF_W + 1), // 아래
    ];
    expect(zoneViolation(GZ_HOME, out)).toBe(0);
    // 대조군 — 넷 다 2 px 씩 존 쪽으로 밀면 차체가 걸려 곧바로 3인 반칙이다.
    const nudged = [
      actor('home', GZ.x + GZ.w + BACK - 1, GZ.y + 10),
      actor('home', GZ.x - FRONT + 1, GZ.y + 10),
      actor('home', GZ.x + 10, GZ.y - HALF_W + 1),
      actor('home', GZ.x + 10, GZ.y + GZ.h + HALF_W - 1),
    ];
    expect(zoneViolation(GZ_HOME, nudged)).toBe(TEAM_BIT.home);
  });

  it('★ 옛 좌표(피벗이 1 px 밖)는 이제 **안**이다 — 차체가 걸쳐 있기 때문', () => {
    // 이 테스트가 대조군을 잃지 않게 한다: 위 케이스의 좌표를 바꾼 이유가 여기 남는다.
    const old = [
      actor('home', GZ.x + GZ.w + 1, GZ.y + 10),
      actor('home', GZ.x - 1, GZ.y + 10),
      actor('home', GZ.x + 10, GZ.y - 1),
    ];
    for (const a of old) expect(inRect(GZ, a.x, a.y), `${a.id} 의 피벗은 존 밖`).toBe(false);
    expect(zoneViolation(GZ_HOME, old)).toBe(TEAM_BIT.home);
  });

  it('경계선 위는 안이다 — 그리고 차체가 변에 **닿기만** 해도 안이다', () => {
    const online = [
      actor('home', GZ.x, GZ.y),
      actor('home', GZ.x + GZ.w, GZ.y + GZ.h),
      actor('home', GZ.x + GZ.w, GZ.y),
    ];
    expect(zoneViolation(GZ_HOME, online)).toBe(TEAM_BIT.home);
    // `inRect` 는 **점** 검사로 남아 있다(판정은 더 이상 쓰지 않는다 — setPiece.ts 가 쓴다).
    expect(inRect(GZ, GZ.x, GZ.y)).toBe(true);
    expect(inRect(GZ, GZ.x - 0.01, GZ.y)).toBe(false);
    // 차체 접선: 앞범퍼가 왼쪽 변에 **정확히** 닿는 자리는 안, 0.01 px 물러나면 밖이다.
    const touch = (dx: number): RuleActor[] => [
      actor('home', GZ.x - FRONT + dx, GZ.y + GZ.h / 2),
      actor('home', GZ.x - FRONT + dx, GZ.y + GZ.h / 2 + 30),
      actor('home', GZ.x - FRONT + dx, GZ.y + GZ.h / 2 + 60),
    ];
    expect(zoneViolation(GZ_HOME, touch(0))).toBe(TEAM_BIT.home);
    expect(zoneViolation(GZ_HOME, touch(-0.01))).toBe(0);
  });
});

// ── 축 열거 — **RuleActor 를 만드는 곳이 전부 방향을 싣는가** ─────────────────────────────────
// 2026-08-13 재편의 실패 형태 1번: "한 곳이라도 빠지면 그 화면만 옛 판정으로 그려진다."
// 컴파일러가 `RuleActor.theta` 필수로 절반을 막아 주지만, **새 생산자가 생겼다는 사실 자체**는
// 아무도 알려 주지 않는다. 이 테스트가 그 목록을 못박는다 — 넷째가 생기면 여기서 먼저 빨개져
// "그 화면도 방향을 싣고, 회전한 차체로 테스트했나" 를 묻는다.
describe('rules — RuleActor 생산자 전수 열거', () => {
  const producers = (dir: string): string[] => {
    const out: string[] = [];
    const walk = (d: string): void => {
      for (const e of readdirSync(d, { withFileTypes: true })) {
        const p = `${d}/${e.name}`;
        if (e.isDirectory()) walk(p);
        else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) {
          if (/\bRuleActor\b/.test(readFileSync(p, 'utf-8'))) out.push(p);
        }
      }
    };
    walk(dir);
    return out.sort();
  };

  it('생산자는 셋뿐이다 — 정의 1 + 라이브 오버레이 1 + PNG 1', () => {
    expect(producers('src')).toEqual([
      'src/features/export/buildStaticSvg.ts', // PNG — ruleActors()
      'src/model/rules.ts', // 정의
      'src/render/ruleOverlay.ts', // 편집·시연이 함께 쓰는 라이브 경로 — fillActors()
    ]);
  });

  it('두 생산자 모두 theta 를 싣는다', () => {
    for (const p of ['src/features/export/buildStaticSvg.ts', 'src/render/ruleOverlay.ts']) {
      expect(readFileSync(p, 'utf-8'), p).toMatch(/theta[:.]/);
    }
    // 대조군 — 같은 정규식이 방향을 안 싣는 파일에서는 안 걸린다(공허한 단언이 아니다).
    expect(/theta[:.]/.test('out.push({ id, team, isGk, x: c.x, y: c.y });')).toBe(false);
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

// ── 진영 (기현 지시 2026-08-15) ────────────────────────────────────────────────────────
// *"수비측이 우리편 골에리어에 3명이 못 들어가는 거지. 공격은 제한 없어."*
// rules.ts 머리말이 2026-08-13 에 *"모델에 어느 팀이 어느 골대를 지키는가가 없다"* 며 넓게
// 재고 있던 두 건이 여기서 좁혀진다.
describe('rules — 진영', () => {
  it('defendedZones: 0번 존이 defense, 나머지는 반대 팀', () => {
    const full = defendedZones(COURT_DEFS.full.ruleZones, 'home');
    expect(full.map((z) => z.defender)).toEqual(['home', 'away']);
    expect(defendedZones(COURT_DEFS.full.ruleZones, 'away').map((z) => z.defender)).toEqual(['away', 'home']);
    // 하프는 존이 하나 — 반대 팀은 지킬 골이 아예 없다(= 언제나 공격이다).
    expect(defendedZones(COURT_DEFS.half.ruleZones, 'away').map((z) => z.defender)).toEqual(['away']);
    // 플랫은 존이 없다. 진영 값과 무관하게 빈 배열이다.
    expect(defendedZones(COURT_DEFS.flat.ruleZones, 'home')).toEqual([]);
  });

  it('기본 진영은 **기본 배치의 골키퍼 자리**를 따른다', () => {
    // 풀: 홈 GK 가 왼쪽 골(x=75 = ruleZones[0]). 하프: 원정 GK 만 놓인다.
    expect(defaultDefense('full')).toBe('home');
    expect(defaultDefense('half')).toBe('away');
    // 플랫은 쓰이지 않지만 값은 정의돼 있어야 한다(진영 필드가 언제나 채워지므로).
    expect(defaultDefense('flat')).toBe('home');
  });

  it('★ 골키퍼 면제는 **자기 골 지역에서만** — 상대 골 지역에 파묻힌 GK 는 면제가 아니다', () => {
    // 2026-08-15 이전에는 '아무 골 지역' 이라 이 GK 가 면제를 받았다(rules.ts 머리말 (1)).
    const ball = { x: GZ.x + GZ.w + 10, y: GZ.y + GZ.h / 2 };
    const awayGkInside = actor('away', GZ.x + GZ.w - 5, ball.y, true);
    const mate = actor('away', ball.x + 20, ball.y);
    const foe = actor('home', ball.x + 10, ball.y);
    // 홈이 지키는 골 지역이다 — 원정 GK 는 여기서 면제가 없다.
    expect(zoneOwnerCase(GZ_HOME, [awayGkInside, mate, foe], ball)).toBe(TEAM_BIT.away);
    // ★ 대조군: **같은 좌표, 같은 인원인데 진영만 뒤집으면** 면제가 살아나 깨끗해진다.
    expect(zoneOwnerCase(GZ_AWAY, [awayGkInside, mate, foe], ball)).toBe(0);
  });

  it('진영을 뒤집어도 골키퍼가 **아니면** 아무것도 안 바뀐다 — 면제는 GK 전용이다', () => {
    const ball = { x: GZ.x + GZ.w + 10, y: GZ.y + GZ.h / 2 };
    const fieldInside = actor('away', GZ.x + GZ.w - 5, ball.y, false);
    const crew = [fieldInside, actor('away', ball.x + 20, ball.y), actor('home', ball.x + 10, ball.y)];
    expect(zoneOwnerCase(GZ_HOME, crew, ball)).toBe(TEAM_BIT.away);
    expect(zoneOwnerCase(GZ_AWAY, crew, ball)).toBe(TEAM_BIT.away);
  });
});

/** 존 하나만 놓고 그 진영으로 2-on-1 을 재는 축약. 진영이 판정을 뒤집는지만 보기 위한 것이다. */
function zoneOwnerCase(zone: DefendedZone, actors: RuleActor[], ball: { x: number; y: number }): number {
  return ringViolation(ball, actors, [zone]);
}
