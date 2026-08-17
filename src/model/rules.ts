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
// ── ✅ 2026-08-15 — 아래 "넓게 판정한다" 두 건이 **해소됐다** ──────────────────────────────
// 기현님 지시로 `Drill.defense`(진영 — ruleZones[0] 을 지키는 팀)가 생겼다. 그 아래 문단이
// *"고칠 수 있게 되는 날의 조건"* 으로 적어 둔 바로 그것이다. 지금 상태:
//   (1) 예외 ①의 '자기' 골 지역 → **자기 팀이 지키는 골 지역**으로 정확히 잰다(`chairInOwnGoalArea`).
//   (2) 골 지역 3인의 '수비' 팀 → **그 존을 지키는 팀만** 센다(`zoneViolation`). 공격은 제한 없다.
// 옛 문단은 지우지 않는다 — 왜 한동안 넓게 쟀는지, 무엇이 있어야 좁힐 수 있는지의 기록이다.
// (2) 의 옛 추정 *"3명이 몰리는 쪽은 사실상 수비다"* 가 특히 위험했다: 골 앞 마무리 드릴은
// **공격 3대**가 골 지역에 들어가는 것이 정상이라, 그 판이 상시 붉었다.
//
// ── 옛 기록 (2026-08-13) ────────────────────────────────────────────────────────────────
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
import { chairInsideBounds, chairOverlapsCircle, chairOverlapsRect } from './chairOverlap.ts';
import type { CourtMode, GoalMouth, Rect } from './court.ts';
import type { BallRing, TeamSide } from './drill.ts';

/** 3 m. 25 px/m 이므로 75 월드px — 옛 센터 서클과 우연히 반지름이 같았다. 그 원은 규정에
 *  없어 5.3 이 지웠고(§9 결정 ⑧), 3 m 감각은 **공을 따라다니는 이 링**이 대신한다. */
export const RING_R_PX = mToPx(3);

/** 5 m — 세트피스에서 수비가 떨어져 있어야 하는 거리이고, 3 m(2-on-1 + 세트볼)와 함께
 *  파워싸커에 실재하는 두 번째 거리다(2026-08-13, 기현님 실기 피드백 ③).
 *
 *  ⚠️ 2026-08-13~08-17 사이 이 값은 **표시 전용**이었고 여기 *"판정에는 절대 쓰지 않는다"* 고
 *  적혀 있었다. 2026-08-17 기현 지시로 이 원에 **자기 판정**이 생겼다(아래 `fiveMeterViolation`).
 *  옛 경고가 실제로 금지한 것은 그대로 살아 있다: **`ringViolation`(2-on-1)은 언제나
 *  `RING_R_PX`(3 m)로만 잰다.** 화면에 5 m 원을 켜 놨다고 2-on-1 판정 반경이 5 m 가 되면
 *  규칙을 잘못 가르치게 된다 — 그것과 "5 m 에는 5 m 짜리 규칙이 따로 있다" 는 다른 이야기다.
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

/** 진영의 기본값 — 드릴에 `defense` 가 없을 때(옛 파일·손편집) 읽는 값.
 *
 *  근거는 기본 배치의 GK 자리다(`defaults.ts`): 풀 코트는 홈 GK 가 x=75(**왼쪽** 골 = zone 0),
 *  하프 코트는 **원정** GK 만 배치되고 홈 GK 는 아예 안 놓인다. 즉 이 두 값이 "지금까지 판이
 *  실제로 보이던 모습" 이다 — 마이그레이션이 옛 드릴에 찍는 값도 같다. */
export function defaultDefense(mode: CourtMode): TeamSide {
  return mode === 'half' ? 'away' : 'home';
}

/** 존 하나와 그 존을 **지키는 팀**. 판정 함수들이 이 쌍으로 받는다 — 사각형만 넘기던 옛
 *  시그니처로는 "이 골 지역이 누구 것인가" 를 물을 수가 없었다(rules.ts 머리말의 그 구멍). */
export interface DefendedZone {
  rect: Rect;
  defender: TeamSide;
}

/** 코트의 골 지역들에 진영을 입힌다. `zones[0]` 이 `defense`, 나머지는 반대 팀이다.
 *  플랫 코트는 존이 없으므로 빈 배열이다(진영 값과 무관하게). */
export function defendedZones(zones: readonly Rect[], defense: TeamSide): DefendedZone[] {
  const other: TeamSide = defense === 'home' ? 'away' : 'home';
  return zones.map((rect, i) => ({ rect, defender: i === 0 ? defense : other }));
}

/** 골대 뒤 면제 구역 + **그 골대를 지키는 팀**. `DefendedZone` 과 같은 꼴이지만 담는 것이
 *  사각형이 아니라 반평면 경계값이다(`model/court.ts` 의 `GoalMouth`). */
export interface DefendedMouth {
  mouth: GoalMouth;
  defender: TeamSide;
}

/** `defendedZones` 와 **같은 규약**으로 진영을 입힌다 — `[0]` 이 `defense`, 나머지는 반대 팀.
 *  두 배열의 순서가 같다는 것이 `court.ts` 의 `goalMouths` 가 못박은 계약이다. */
export function defendedMouths(mouths: readonly GoalMouth[], defense: TeamSide): DefendedMouth[] {
  const other: TeamSide = defense === 'home' ? 'away' : 'home';
  return mouths.map((mouth, i) => ({ mouth, defender: i === 0 ? defense : other }));
}

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

/** 차체 사각형이 **자기 팀이 지키는** 골 지역에 조금이라도 걸치면 true(접촉 포함).
 *  예외 ①(골 지역 안의 골키퍼)이 이걸 쓴다 — 기현님 지시의 *"조금만 걸쳐있어도 면제"* 다.
 *
 *  ⚠️ 2026-08-15 — `defender === a.team` 조건이 **새로 생겼다.** 그 전에는 진영 데이터가 없어
 *  *"아무 골 지역"* 으로 읽었고(rules.ts 머리말 (1)), 그래서 상대 골 지역까지 밀고 들어간
 *  골키퍼가 2-on-1 에서 면제를 받았다. 규정은 자기 골 지역에 있는 수비 골키퍼만 면제한다. */
function chairInOwnGoalArea(zones: readonly DefendedZone[], a: RuleActor): boolean {
  for (const z of zones) {
    if (z.defender !== a.team) continue;
    if (chairOverlapsRect(a.x, a.y, a.theta, z.rect.x, z.rect.y, z.rect.w, z.rect.h)) return true;
  }
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
export function ringViolation(ball: Vec2, actors: readonly RuleActor[], goalAreas: readonly DefendedZone[]): number {
  // raw = 상대가 있는가(예외 ②) · counted = 반칙을 이루는 인원(예외 ① 적용 후)
  let rawHome = 0;
  let rawAway = 0;
  let countedHome = 0;
  let countedAway = 0;
  for (const a of actors) {
    if (!chairOverlapsCircle(a.x, a.y, a.theta, ball.x, ball.y, RING_R_PX)) continue;
    const exempt = a.isGk && chairInOwnGoalArea(goalAreas, a);
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
 *  ⚠️ **수비 팀만 센다**(2026-08-15 기현 지시: *"수비측이 우리편 골에리어에 3명이 못 들어가는
 *  거지. 공격은 제한 없어."*). Law 11 은 골 지역 인원 제한을 **수비 측에만** 건다 — 공격이
 *  상대 골 지역에 몇 대가 들어가든 반칙이 아니다.
 *
 *  그 전(2026-08-13~15)에는 진영 데이터가 없어 **팀 무관**으로 재고 있었다(rules.ts 머리말 (2):
 *  *"3명이 몰리는 쪽은 사실상 수비다"*). 그 추정은 실제 훈련에서 자주 틀린다 — 골 앞 마무리
 *  드릴은 **공격 3대**가 골 지역에 들어가는 것이 훈련의 기본 모양이고, 그때 판이 붉어지면
 *  코치에게 없는 반칙을 가르치게 된다.
 *
 *  ⚠️ 링과 **같은 정의**다 — 차체 사각형이 존에 조금이라도 걸치면 그 존 안이다. 점으로
 *  되돌리면 차체가 절반 들어가 있어도 피벗이 밖이면 안 세어, 골 지역에 실제로 4대가 들어찬
 *  판이 하얗게 남는다. */
export function zoneViolation(zone: DefendedZone, actors: readonly RuleActor[]): number {
  let count = 0;
  for (const a of actors) {
    if (a.team !== zone.defender) continue; // 공격은 제한 없다
    if (!chairOverlapsRect(a.x, a.y, a.theta, zone.rect.x, zone.rect.y, zone.rect.w, zone.rect.h)) continue;
    count++;
  }
  return count > GOAL_AREA_MAX ? TEAM_BIT[zone.defender] : 0;
}

/* ── 세트피스 5 m 제한 (기현 지시 2026-08-17) ────────────────────────────────────────────
 *
 * 규정: 골킥·킥인·킥오프·직접/간접 프리킥·코너킥·페널티킥에서 **수비 측은 공에서 5 m 밖**에
 * 있어야 한다. 문제는 판이 경기 상황을 모른다는 것이다 — 정지한 그림에 "지금은 코너킥" 이라는
 * 정보가 없다. 그래서 기현님이 **약속**을 정하셨다:
 *
 *   ① 공에 **5 m 원이 켜져 있으면** 그 공은 세트피스 상황이다.
 *   ② 그때 **수비 측**이 원에 조금이라도 걸치면 경고한다(2-on-1 과 같은 붉은 링).
 *   ③ 누가 수비인가 — **풀 코트는 왼쪽 진영, 하프 코트는 깃발 색 진영.**
 *   ④ 수비 골키퍼는 **자기 골대 사이 골라인 뒤**에 있으면 면제.
 *
 * ★ ③ 의 두 문장은 코드에서 **한 값**이다: `Drill.defense` 는 `ruleZones[0]` 을 지키는 팀이고,
 *   풀 코트의 `ruleZones[0]` 이 왼쪽이며(court.ts), 하프 코트는 존이 하나라 그것이 곧 깃발이
 *   그려지는 진영이다(render/sideFlags.ts). 모드로 분기할 자리가 없다.
 *
 * ⚠️ 이 판정은 위쪽 `RING_5M_R_PX` 의 *"판정에는 절대 쓰지 않는다"* 를 **뒤집는 것이 아니다.**
 *    그 경고가 금지한 것은 "5 m 원을 켜 놨으니 **2-on-1** 을 5 m 로 재는 것" 이다. 2-on-1 은
 *    지금도 언제나 3 m 다 — 여기 있는 것은 **다른 규칙**이고, 그래서 반경도 문구도 따로다. */

/** 이 원이 켜진 공은 어느 규칙으로 재는가.
 *
 *  ⚠️ **5 m 원인 공에는 2-on-1 을 걸지 않는다.** 5 m 원은 위 약속상 *"지금은 세트피스"* 라는
 *  뜻인데, 세트피스는 공이 아직 인플레이가 아니라 2-on-1(Law 11, *인플레이 중*)이 성립하지
 *  않는다. 둘 다 걸면 재개 장면에서 *"2-on-1 주의"* 라고 말하게 되고, 그것은 이 파일 머리말이
 *  금지한 **없는 반칙을 가르치는 일**이다.
 *
 *  결정을 함수 하나에 둔 이유: 판정 소비자가 둘(화면 `render/ruleOverlay.ts` · PNG
 *  `features/export/buildStaticSvg.ts`)이라, 각자 `ring === '5m'` 을 적으면 한쪽만 고친 날
 *  **그림에서만 다른 규칙**이 돈다. */
export function ruleForRing(ring: BallRing): 'twoOnOne' | 'fiveMeter' {
  return ring === '5m' ? 'fiveMeter' : 'twoOnOne';
}

/** 차체가 **자기 팀이 지키는** 골대 뒤로 완전히 나가 있는가. 예외 ④ 가 이걸 쓴다.
 *
 *  ⚠️ **`chairInOwnGoalArea` 와 판정이 정반대다.** 저쪽은 *걸치면* 안이고(2026-08-13 지시),
 *  이쪽은 *완전히 나가야* 뒤다(2026-08-17 지시: *"골대 뒤는 완전히 나가야 면제"*).
 *  한 함수로 뭉치면 둘 중 하나가 조용히 상대 쪽 규약으로 끌려간다. */
function chairBehindOwnGoalLine(mouths: readonly DefendedMouth[], a: RuleActor): boolean {
  for (const m of mouths) {
    if (m.defender !== a.team) continue;
    if (chairInsideBounds(a.x, a.y, a.theta, m.mouth.minX, m.mouth.maxX, m.mouth.minY, m.mouth.maxY)) return true;
  }
  return false;
}

/** 세트피스 5 m 제한. 반환은 **위반한 팀의 비트**(0 = 깨끗함) — 걸리는 것은 수비뿐이다.
 *
 *  `defense` 가 null 이면 판정하지 않는다(플랫 코트 — 골대도 진영도 없어 약속 ③ 이 뜻을
 *  잃는다). `mouths` 는 예외 ④ 에만 쓴다: **골라인 바깥 반평면 ∩ 6 m**이지 골 지역이 아니다
 *  (`model/court.ts` 의 `goalMouths`).
 *
 *  ⚠️ 면제 문턱이 2-on-1 의 골키퍼 면제와 **다르다**. 저기는 골 지역에 *걸치기만 해도* 면제고
 *  (2026-08-13), 여기는 골라인을 *완전히 넘어가야* 면제다(2026-08-17). 같은 '골키퍼 면제' 라는
 *  이름에 끌려 문턱을 맞추지 마라 — 재개 상황의 골키퍼는 골문 안으로 물러나 있어야 한다는
 *  뜻이고, 골 지역에 나와 서 있으면 그도 5 m 밖으로 빠져야 한다. */
export function fiveMeterViolation(
  ball: Vec2,
  actors: readonly RuleActor[],
  defense: TeamSide | null,
  mouths: readonly DefendedMouth[],
): number {
  if (defense === null) return 0;
  for (const a of actors) {
    if (a.team !== defense) continue; // 공격(= 공을 차는 쪽)은 제한 없다
    if (!chairOverlapsCircle(a.x, a.y, a.theta, ball.x, ball.y, RING_5M_R_PX)) continue;
    if (a.isGk && chairBehindOwnGoalLine(mouths, a)) continue; // 예외 ④
    return TEAM_BIT[defense];
  }
  return 0;
}

/** 공 하나의 링 판정 — **어느 규칙인지는 원이 정한다**(`ruleForRing`). 소비자 둘이 이 함수
 *  하나를 지나므로 화면과 PNG 가 갈라질 자리가 없다. 반환은 위반한 팀의 비트합이다. */
export function ballRingViolation(
  ring: BallRing,
  ball: Vec2,
  actors: readonly RuleActor[],
  goalAreas: readonly DefendedZone[],
  mouths: readonly DefendedMouth[],
  defense: TeamSide | null,
): number {
  return ruleForRing(ring) === 'fiveMeter' ? fiveMeterViolation(ball, actors, defense, mouths) : ringViolation(ball, actors, goalAreas);
}

/** 비트합 → 팀 목록. **문구를 만들 때만** 부른다(위반 상태가 바뀐 순간뿐이라 배열을 만들어도 된다). */
export function teamsOfBits(bits: number): TeamSide[] {
  const out: TeamSide[] = [];
  for (const side of TEAM_SIDES) if (bits & TEAM_BIT[side]) out.push(side);
  return out;
}
