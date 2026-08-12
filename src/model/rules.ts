// §4.4 P2-4 — 파워싸커 경기 규칙 **판정**. 순수 함수만 둔다(DOM·React·프레임 루프 없음).
//
// 근거는 FIPFA Laws 2025 원문 대조 노트(2ndBrain『FIPFA 공식 규격 (2025) — SPIN 대조』§4·§5).
// 계획서 §4.4 P2-4 한 줄 요약("같은 팀 둘이 3 m 안에 들어가면 붉어진다")보다 규칙이 좁다 —
// 요약대로 만들면 **패스 훈련에서 링이 상시 붉다**(같은 팀 둘이 공 근처에 있는 것은 반칙이
// 아니라 훈련의 기본 모양이다). 그래서 원문의 예외 둘을 그대로 넣는다:
//
//   · **2-on-1** (Law 11) — 인플레이 중 공 3 m 안에 같은 팀 2명 **그리고 상대 1명 이상**.
//     예외 ① 그 인원 중 **골 지역 안의 골키퍼**는 세지 않는다.
//     예외 ② 3 m 안에 **상대가 없으면** 성립하지 않는다.
//   · **골 지역 3인** (Law 11) — 골 지역 안에 같은 팀 3명 이상(골키퍼 포함).
//
// 두 군데서 규정보다 넓게 판정한다. 모델에 **어느 팀이 어느 골대를 지키는가가 없기 때문**이다
// (`CourtDef.ruleZones` 는 좌·우 사각형일 뿐이고 `ChairDef` 에도 방어 방향이 없다):
//   (1) 예외 ①의 '자기' 골 지역 → **아무 골 지역**으로 읽는다.
//   (2) 골 지역 3인의 '수비' 팀 → **팀 무관**으로 읽는다(3명이 몰리는 쪽은 사실상 수비다).
// 팀↔골대 배정을 지어내는 것보다 넓게 재고 그 사실을 적어 두는 편이 낫다 — 규칙을 잘못
// 가르치지 않는 것이 이 판의 목적이기 때문이다(계획서 §9-⑧ 센터 서클 판정과 같은 기준).
//
// 그리고 이 판정은 **경고이지 판결이 아니다.** 원문은 "위치 자체는 반칙이 아니고 두 번째
// 선수가 능동적 플레이에 관여할 때 성립" 이라고 못박는다 — 정지한 판에서 '관여'는 알 수 없다.
// 그래서 발화 문구도 '주의' 다(ruleOverlay.ts).
import { mToPx, type Vec2 } from '../core/units.ts';
import type { Rect } from './court.ts';
import type { TeamSide } from './drill.ts';

/** 3 m. 25 px/m 이므로 75 월드px — 우연히 지금 그려지는 센터 서클과 같은 반지름이다
 *  (계획서 §9-⑧: 그 원은 규정에 없어 5.3 에서 지운다. 링이 그 자리를 대신한다). */
export const RING_R_PX = mToPx(3);
const RING_R2 = RING_R_PX * RING_R_PX;

/** 2-on-1: 공 3 m 안의 같은 팀 인원이 이 수를 **넘으면** 주의(예외 ① 적용 후 인원). */
export const RING_SAME_TEAM_MAX = 1;
/** 골 지역: 한 존 안의 같은 팀 인원이 이 수를 **넘으면** 3인 반칙(골키퍼 포함). */
export const GOAL_AREA_MAX = 2;

/** 팀 비트. 판정은 **매 프레임** 돌므로 배열·객체를 만들어 돌려주지 않는다
 *  (transformWriter.ts §6.2 요건 3 과 같은 규율 — 정지한 판이 GC 를 만들지 않게). */
export const TEAM_BIT: Record<TeamSide, 1 | 2> = { home: 1, away: 2 };
export const TEAM_SIDES: readonly TeamSide[] = ['home', 'away'];

/** 판정에 필요한 것만 담은 선수 1명. 좌표는 **그 프레임의 실제 위치**다(모델 저장값이 아니라). */
export interface RuleActor {
  id: string;
  team: TeamSide;
  isGk: boolean;
  x: number;
  y: number;
}

/** 경계 위는 안이다 — 축구에서 라인 위는 언제나 그 구역 안이다. */
export function inRect(r: Rect, x: number, y: number): boolean {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

function inAnyRect(rects: readonly Rect[], x: number, y: number): boolean {
  for (const r of rects) if (inRect(r, x, y)) return true;
  return false;
}

/** 공 하나에 대한 2-on-1 판정. 반환은 **위반한 팀의 비트합**(0 = 깨끗함).
 *
 *  `goalAreas` 는 예외 ①(골 지역 안의 골키퍼는 세지 않는다) 에만 쓴다 — 빈 배열을 넘기면
 *  예외 ①이 꺼진 판정이 된다(플랫 코트에는 골 지역이 없다). */
export function ringViolation(ball: Vec2, actors: readonly RuleActor[], goalAreas: readonly Rect[]): number {
  // raw = 상대가 있는가(예외 ②) · counted = 반칙을 이루는 인원(예외 ① 적용 후)
  let rawHome = 0;
  let rawAway = 0;
  let countedHome = 0;
  let countedAway = 0;
  for (const a of actors) {
    const dx = a.x - ball.x;
    const dy = a.y - ball.y;
    if (dx * dx + dy * dy > RING_R2) continue;
    const exempt = a.isGk && inAnyRect(goalAreas, a.x, a.y);
    if (a.team === 'home') {
      rawHome++;
      if (!exempt) countedHome++;
    } else {
      rawAway++;
      if (!exempt) countedAway++;
    }
  }
  let bits = 0;
  if (countedHome > RING_SAME_TEAM_MAX && rawAway > 0) bits |= TEAM_BIT.home;
  if (countedAway > RING_SAME_TEAM_MAX && rawHome > 0) bits |= TEAM_BIT.away;
  return bits;
}

/** 골 지역 한 곳의 3인 반칙 판정. 반환은 위반한 팀의 비트합(0 = 깨끗함). */
export function zoneViolation(zone: Rect, actors: readonly RuleActor[]): number {
  let home = 0;
  let away = 0;
  for (const a of actors) {
    if (!inRect(zone, a.x, a.y)) continue;
    if (a.team === 'home') home++;
    else away++;
  }
  let bits = 0;
  if (home > GOAL_AREA_MAX) bits |= TEAM_BIT.home;
  if (away > GOAL_AREA_MAX) bits |= TEAM_BIT.away;
  return bits;
}

/** 비트합 → 팀 목록. **문구를 만들 때만** 부른다(위반 상태가 바뀐 순간뿐이라 배열을 만들어도 된다). */
export function teamsOfBits(bits: number): TeamSide[] {
  const out: TeamSide[] = [];
  for (const side of TEAM_SIDES) if (bits & TEAM_BIT[side]) out.push(side);
  return out;
}
