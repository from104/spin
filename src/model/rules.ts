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
// ⚠️ 2026-08-13 재조사(기현님이 *"**수비** 골키퍼"* 라고 하셔서 다시 팠다). **여전히 못 한다** —
// 모델에서 방어 골대를 알아낼 방법이 없다는 것이 조사 결과다. 근거 넷:
//   ① `homeHeadingDeg`/`awayHeadingDeg` 는 90/270 이고 **세 코트 모드 전부 같은 값**이다.
//      court.ts 가 그 자리에 *"골대가 좌우에 있으니 공격 축을 따르면 0°/180°(가로)가 맞지만,
//      판을 짤 때 필요한 것은 … 누가 어디에 있는가"* 라고 적어 뒀다 — 이것은 **첫 배치의
//      보기 방향**이지 공격 축이 아니다. 게다가 코치가 칩을 돌리는 순간 사라지는 값이다.
//   ② `FULL_POSITIONS`(defaults.ts) 는 홈 GK 를 x=75(좌측 골), 원정 GK 를 x=750(우측 골)에
//      둔다. 그러나 **하프 코트는 골대가 하나뿐이고 그 하나를 지키는 기본 GK 가 `away`** 다
//      (`HALF_POSITIONS.away.G`, 홈 GK 는 아예 배치되지 않는다). 즉 "홈은 좌측" 이라는 규칙이
//      모드를 건너 성립하지 않는다.
//   ③ 그 좌표는 **기본 배치일 뿐** 문서에 저장되지 않는다. 드릴에 남는 것은 좌표·각도뿐이라,
//      코치가 양 팀을 맞바꿔 놓은 판과 그러지 않은 판이 모델에서 구별되지 않는다.
//   ④ 자유 전술판(flat)에는 골 지역 자체가 없고, 하프·풀에서도 코치는 아무 데나 놓을 수 있다.
// 그래서 "가장 가까운 골 지역이 자기 골" 같은 추정을 넣으면, 공격 진영에 파묻힌 골키퍼가
// 상대 골 지역에서 면제를 받는다. **넓게 재고 사실을 적어 둔다** — 지어내지 않는다.
// 고칠 수 있게 되는 날의 조건: `ChairDef` 또는 `Drill` 에 "이 팀이 지키는 골대" 가 실제로
// 저장될 때다(예: 팀별 방어 골대 인덱스). 그때 바꿀 곳은 아래 `ringViolation` 의 `goalAreas`
// 인자 하나뿐이다.
//
// 그리고 이 판정은 **경고이지 판결이 아니다.** 원문은 "위치 자체는 반칙이 아니고 두 번째
// 선수가 능동적 플레이에 관여할 때 성립" 이라고 못박는다 — 정지한 판에서 '관여'는 알 수 없다.
// 그래서 발화 문구도 '주의' 다(ruleOverlay.ts).
import { mToPx, type Vec2 } from '../core/units.ts';
import { chairOverlapsCircle, chairOverlapsRect } from './chairOverlap.ts';
import type { Rect } from './court.ts';
import type { BallRing, TeamSide } from './drill.ts';

/** 3 m. 25 px/m 이므로 75 월드px — 옛 센터 서클과 우연히 반지름이 같았다. 그 원은 규정에
 *  없어 5.3 이 지웠고(§9 결정 ⑧), 3 m 감각은 **공을 따라다니는 이 링**이 대신한다. */
export const RING_R_PX = mToPx(3);

/** 5 m — **표시 전용**이다(2026-08-13, 기현님 실기 피드백 ③). 세트피스에서 상대가 떨어져
 *  있어야 하는 거리이고, 3 m(2-on-1 + 세트볼)와 함께 파워싸커에 실재하는 두 번째 거리다.
 *
 *  ⚠️ **판정에는 절대 쓰지 않는다.** 아래 `ringViolation` 은 언제나 `RING_R_PX`(3 m)로만 잰다 —
 *  화면에 5 m 원을 켜 놨다고 2-on-1 판정 반경이 5 m 가 되면 규칙을 잘못 가르치게 된다.
 *  (2026-08-13 에 `RING_R2` 상수가 사라졌다 — 거리²를 직접 비교하던 자리를 차체 사각형
 *  판정 `chairOverlapsCircle(…, RING_R_PX)` 이 대신한다. 반지름은 여전히 이 파일이 소유한다.)
 *  ⚠️ **이 원 하나로 모든 세트피스를 덮지 않는다.** 5 m 의 기준점이 상황마다 다르기 때문이다:
 *  킥오프·프리킥·킥인·골킥은 **공**, 페널티킥은 **페널티 마크**, 코너킥은 **코너 삼각형**.
 *  여기서 만드는 것은 *공을 따라다니는* 원이라 공 기준 상황(앞의 넷)에만 맞는다. */
export const RING_5M_R_PX = mToPx(5);

/** 표시 반지름표. 'none' 은 그릴 것이 없다는 뜻으로 null 이다(0 이 아니다 — 0 은 점을 그린다).
 *  링을 그리는 세 화면(편집 CourtStage · 시연 PresentStage · PNG buildStaticSvg)이 전부 이
 *  함수 하나에서 반지름을 얻는다. 리터럴을 새로 박으면 25 px = 1 m 축척이 갈라진다. */
export function ringRadiusPx(ring: BallRing): number | null {
  if (ring === '3m') return RING_R_PX;
  if (ring === '5m') return RING_5M_R_PX;
  return null;
}

/** 2-on-1: 공 3 m 안의 같은 팀 인원이 이 수를 **넘으면** 주의(예외 ① 적용 후 인원). */
export const RING_SAME_TEAM_MAX = 1;
/** 골 지역: 한 존 안의 같은 팀 인원이 이 수를 **넘으면** 3인 반칙(골키퍼 포함). */
export const GOAL_AREA_MAX = 2;

/** 팀 비트. 판정은 **매 프레임** 돌므로 배열·객체를 만들어 돌려주지 않는다
 *  (transformWriter.ts §6.2 요건 3 과 같은 규율 — 정지한 판이 GC 를 만들지 않게). */
export const TEAM_BIT: Record<TeamSide, 1 | 2> = { home: 1, away: 2 };
export const TEAM_SIDES: readonly TeamSide[] = ['home', 'away'];

/** 판정에 필요한 것만 담은 선수 1명. 좌표는 **그 프레임의 실제 위치**다(모델 저장값이 아니라).
 *
 *  ⚠️ `theta`(rad)가 없으면 안 된다. 2026-08-13 부터 판정은 피벗 점이 아니라 **1.5 × 1.0 m
 *  차체 사각형**으로 재고(chairOverlap.ts 머리말), 사각형은 방향 없이는 만들어지지 않는다.
 *  이 필드를 옵셔널로 풀면 어느 화면 하나가 조용히 "언제나 +x 를 보는 차체" 로 판정한다. */
export interface RuleActor {
  id: string;
  team: TeamSide;
  isGk: boolean;
  x: number;
  y: number;
  theta: number;
}

/** 경계 위는 안이다 — 축구에서 라인 위는 언제나 그 구역 안이다.
 *
 *  ⚠️ **점 검사다. 반칙 판정은 더 이상 이것을 쓰지 않는다**(2026-08-13). 차체는 점이 아니라
 *  사각형이라 `chairOverlapsRect` 로 잰다 — 이름을 갈라 둔 이유가 그것이다. 여기 남은 이유는
 *  판정 밖의 소비처들이다: `setPiece.ts:353`(공 자리가 경기면 안인가) 와 `setPiece.test.ts`.
 *  그쪽은 **점의 문제**가 맞으므로 뜻을 바꾸지 않는다. */
export function inRect(r: Rect, x: number, y: number): boolean {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

/** 차체 사각형이 이 사각형들 중 하나라도 **조금이라도** 걸치면 true(접촉 포함).
 *  예외 ①(골 지역 안의 골키퍼)이 이걸 쓴다 — 기현님 지시의 *"조금만 걸쳐있어도 면제"* 다. */
function chairInAnyRect(rects: readonly Rect[], a: RuleActor): boolean {
  for (const r of rects) if (chairOverlapsRect(a.x, a.y, a.theta, r.x, r.y, r.w, r.h)) return true;
  return false;
}

/** 공 하나에 대한 2-on-1 판정. 반환은 **위반한 팀의 비트합**(0 = 깨끗함).
 *
 *  `goalAreas` 는 예외 ①(골 지역 안의 골키퍼는 세지 않는다) 에만 쓴다 — 빈 배열을 넘기면
 *  예외 ①이 꺼진 판정이 된다(플랫 코트에는 골 지역이 없다).
 *
 *  ⚠️ **"3 m 안" 은 피벗이 아니라 차체 사각형이 3 m 원에 걸치는가**다(2026-08-13 기현님 지시:
 *  *"정확하게 휠체어 경계선(사각형)이다. 에누리 없다"*). 점으로 되돌리면 공을 마주 본 휠체어가
 *  앞범퍼로 선을 밟고 있어도 **최대 1.2 m 를 놓친다**(= `CHAIR.pivotToFrontPx` 30 px). */
export function ringViolation(ball: Vec2, actors: readonly RuleActor[], goalAreas: readonly Rect[]): number {
  // raw = 상대가 있는가(예외 ②) · counted = 반칙을 이루는 인원(예외 ① 적용 후)
  let rawHome = 0;
  let rawAway = 0;
  let countedHome = 0;
  let countedAway = 0;
  for (const a of actors) {
    if (!chairOverlapsCircle(a.x, a.y, a.theta, ball.x, ball.y, RING_R_PX)) continue;
    const exempt = a.isGk && chairInAnyRect(goalAreas, a);
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

/** 골 지역 한 곳의 3인 반칙 판정. 반환은 위반한 팀의 비트합(0 = 깨끗함).
 *
 *  ⚠️ 링과 **같은 정의**다 — 차체 사각형이 존에 조금이라도 걸치면 그 존 안이다. 점으로
 *  되돌리면 차체가 절반 들어가 있어도 피벗이 밖이면 안 세어, 골 지역에 실제로 4대가 들어찬
 *  판이 하얗게 남는다. */
export function zoneViolation(zone: Rect, actors: readonly RuleActor[]): number {
  let home = 0;
  let away = 0;
  for (const a of actors) {
    if (!chairOverlapsRect(a.x, a.y, a.theta, zone.x, zone.y, zone.w, zone.h)) continue;
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
