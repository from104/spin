// §4.4 P2-4 — 반칙 판정의 기하. **차체는 점이 아니라 1.3 × 0.8 m 사각형이다**(2026-08-29 실측).
//
// 2026-08-13 기현님(파워체어 풋볼 국제 활동 도메인 전문가) 지시:
//   *"2-on-1 반칙, 골에리어 반칙 휠체어 침범 여부는 정확하게 휠체어 경계선(사각형)이다.
//     에누리 없다. 역으로 수비 골키퍼가 골에리어에 조금만 걸쳐있어도 2-on-1 반칙 면제이다."*
//
// 그 전까지 `rules.ts` 는 전부 **피벗 점 하나**로 쟀다. 피벗은 차체의 중심도 아니다 —
// `CHAIR.pivotToRearPx` 7.5 / `CHAIR.pivotToFrontPx` 30 (25 px = 1 m 이므로 뒤로 0.3 m,
// **앞으로 1.2 m**), 폭 `CHAIR.widthPx` 25(= 1.0 m). 그래서 옛 판정은 **최대 1.2 m 를 놓쳤다**:
// 공을 정면으로 마주 본 휠체어가 앞범퍼로 3 m 선을 밟고 있어도 피벗은 4.2 m 밖이라 안 셌다.
// 그리고 그 오차는 **골키퍼 면제에서 반대 방향으로 아프다** — 면제를 못 받아 *없는* 2-on-1 이
// 붉게 떴다.
//
// 두 요구는 **판정 하나**로 같이 성립한다: *차체 사각형이 영역과 조금이라도 겹치면 그 영역
// 안이다.* 위반 쪽은 "3 m 원에 걸치면 센다", 면제 쪽은 "골 지역에 걸치면 면제" 다.
//
// ⚠️ **할당 없이 쓴다.** `rules.ts` 머리말이 *"판정은 매 프레임 돌므로 배열·객체를 만들어
// 돌려주지 않는다"* 를 못박았다. `chair.ts` 의 `chairCorners` 는 **객체 5개를 할당**하므로
// (Vec2 4개 + 배열 1개) 판정 경로에서 부르면 안 된다. 그래서 이 파일의 함수는 **숫자만 받고
// 숫자·불리언만 돌려준다** — 객체 리터럴도, 배열도, `new` 도 없다. 그 형태 자체를
// chairOverlap.test.ts 가 소스로 붙잡는다.
//
// 여기서 보는 사각형은 `chairCorners`(chair.ts:64) · `obb.ts` 의 hull 과 **같은 사각형**이다
// (로컬 x ∈ [−7.5, 30], y ∈ [−12.5, 12.5]). 그 일치를 chairOverlap.test.ts 가 네 꼭짓점으로
// 직접 잰다 — 세 곳이 각자 차체를 정의하면 "물리는 부딪히는데 반칙은 아니다" 가 된다.
import { CHAIR } from '../core/constants.ts';

/** 피벗에서 **뒤**로(0.3 m). 로컬 축 좌표로는 −BACK_PX 가 뒷변이다. */
const BACK_PX = CHAIR.pivotToRearPx;
/** 피벗에서 **앞**으로(1.2 m). 옛 점 판정이 놓치던 거리가 정확히 이 값이다. */
const FRONT_PX = CHAIR.pivotToFrontPx;
const HALF_W = CHAIR.widthPx / 2;
/** hull 중심은 피벗이 아니다 — 피벗보다 **앞으로 9.75 px**(0.39 m) 나가 있다.
 *  이 한 줄이 "앞을 볼 때와 뒤를 볼 때 결과가 다르다" 의 전부다. 0 으로 두면 판정이 좌우
 *  대칭이 되어 사각형이 아니라 원으로 재는 것과 같아진다. */
const AX_MID = (FRONT_PX - BACK_PX) / 2;
/** 축 방향 반길이(= 1.5 m 의 반). */
const AX_HALF = (FRONT_PX + BACK_PX) / 2;

/** **접선은 안이다.** 축구에서 라인 위는 언제나 그 구역 안이고(`rules.ts` 의 `inRect` 가 이미
 *  그렇게 적어 뒀다), 기현님 지시도 *"조금만 걸쳐있어도"* 다. 그런데 회전한 차체의 **정확한**
 *  접선은 부동소수 마지막 자리에서 뒤집힌다. 실측(꼭짓점 하나를 사각형 변에 정확히 얹은 배치,
 *  SAT 여유 = |중심거리| − support 합):
 *      θ= 30°  +1.421e-14      θ= 37°  +2.842e-14      θ= 45°  −2.842e-14
 *      θ= 60°  −1.421e-14      θ=137°  **+4.263e-14**  θ=200°  −1.421e-14
 *  **양수면 '밖'** 이다 — 즉 여유가 0 이면 37°·137° 에서 정확한 접선이 밖으로 뒤집힌다.
 *  그래서 **겹침 쪽으로** 이만큼 준다. 1e-9 px = 4e-11 m — 실측 오차의 2만 배 위이고 판정을
 *  좌우하는 최소 눈금(0.01 px = 0.4 mm)의 1000만 분의 1 이라, "에누리 없다" 를 어기는 값이
 *  아니라 에누리 없음이 부동소수 때문에 뒤집히지 않게 하는 값이다.
 *  0 으로 되돌리면 chairOverlap.test.ts 의 '모서리만 닿아도 안이다' 가 θ=37°·137° 에서
 *  빨개진다(45° 만 넣어 두면 통과한다 — 그래서 그 테스트는 세 각을 함께 돈다). */
export const TOUCH_EPS_PX = 1e-9;

/** 차체 사각형에서 점 (px, py) 까지의 **최단거리²**(px²). 점이 차체 안이면 **0** 이다.
 *
 *  수법: 점을 차체 로컬 프레임으로 옮기고(`chair.ts` 의 `projectGrab` 과 같은 식 —
 *  `ax` = 축 방향, `lat` = 측방, 부호 규약도 같다) 로컬 사각형 구간에 **클램프**한 뒤
 *  클램프 전후의 차를 잰다. sqrt 가 필요 없고, 안쪽이면 자연히 0 이 나온다. */
export function chairPointDist2(
  chairX: number,
  chairY: number,
  theta: number,
  px: number,
  py: number,
): number {
  const ux = Math.cos(theta);
  const uy = Math.sin(theta);
  const rx = px - chairX;
  const ry = py - chairY;
  const ax = rx * ux + ry * uy;
  const lat = ux * ry - uy * rx; // v = (−uy, ux) 에 투영한 것과 같다(chairCorners 의 v)
  const qa = ax < -BACK_PX ? -BACK_PX : ax > FRONT_PX ? FRONT_PX : ax;
  const ql = lat < -HALF_W ? -HALF_W : lat > HALF_W ? HALF_W : lat;
  const da = ax - qa;
  const dl = lat - ql;
  return da * da + dl * dl;
}

/** 차체 사각형 ∩ 원(중심 (px,py), 반지름 r). **접선 포함**.
 *  공이 차체 안이면 거리 0 이라 r 이 얼마든 겹친다 — 그것이 옳다(공을 깔고 앉은 휠체어). */
export function chairOverlapsCircle(
  chairX: number,
  chairY: number,
  theta: number,
  px: number,
  py: number,
  r: number,
): boolean {
  const lim = r + TOUCH_EPS_PX;
  return chairPointDist2(chairX, chairY, theta, px, py) <= lim * lim;
}

/** 차체 사각형 ∩ **축정렬** 사각형(골 지역 같은 `Rect`). **접촉 포함**.
 *
 *  SAT — 두 볼록다각형은 축 4개(월드 x·y, 차체 u·v)에서 투영 구간이 **하나라도 분리되면**
 *  겹치지 않는다. 사각형 둘이라 이 4축이면 충분하다(각 사각형의 면 법선 2개씩).
 *  `obb.ts` 의 `satOverlap` 과 같은 수법이지만 그쪽은 ChairPose × ChairPose 전용이고 코너
 *  배열을 **할당**한다 — 여기서는 중심·반지름(support) 형태로 접어 스칼라만 쓴다.
 *
 *  rw·rh 가 0 이어도 옳게 돈다(= 점이 차체 안인가). 꼭짓점 검증이 그 성질을 쓴다. */
export function chairOverlapsRect(
  chairX: number,
  chairY: number,
  theta: number,
  rectX: number,
  rectY: number,
  rectW: number,
  rectH: number,
): boolean {
  const ux = Math.cos(theta);
  const uy = Math.sin(theta);
  const aux = ux < 0 ? -ux : ux;
  const auy = uy < 0 ? -uy : uy;
  const rhx = rectW / 2;
  const rhy = rectH / 2;
  // 중심 사이 벡터. 차체 중심은 피벗 + AX_MID·u 다(피벗이 아니다).
  const dx = chairX + AX_MID * ux - (rectX + rhx);
  const dy = chairY + AX_MID * uy - (rectY + rhy);
  const adx = dx < 0 ? -dx : dx;
  const ady = dy < 0 ? -dy : dy;
  // ① 월드 x — 차체 support = AX_HALF|ux| + HALF_W|vx| = AX_HALF|ux| + HALF_W|uy|
  if (adx > AX_HALF * aux + HALF_W * auy + rhx + TOUCH_EPS_PX) return false;
  // ② 월드 y
  if (ady > AX_HALF * auy + HALF_W * aux + rhy + TOUCH_EPS_PX) return false;
  // ③ 차체 u — 사각형 support = rhx|ux| + rhy|uy|
  const du = dx * ux + dy * uy;
  if ((du < 0 ? -du : du) > AX_HALF + rhx * aux + rhy * auy + TOUCH_EPS_PX) return false;
  // ④ 차체 v = (−uy, ux)
  const dv = dy * ux - dx * uy;
  if ((dv < 0 ? -dv : dv) > HALF_W + rhx * auy + rhy * aux + TOUCH_EPS_PX) return false;
  return true;
}

/** 차체 사각형이 축 정렬 경계 **안에 통째로** 들어가 있는가(접선 포함).
 *
 *  ⚠️ 위 `chairOverlapsRect` 와 **정반대 질문**이다. 저쪽은 *"조금이라도 걸치는가"*, 이쪽은
 *  *"한 귀퉁이도 밖에 없는가"* 다. 세트피스 5 m 의 골키퍼 면제가 이걸 쓴다 —
 *  기현 지시 2026-08-17: *"골대 뒤는 **완전히 나가야** 면제"*. 두 판정을 한 이름으로 뭉치면
 *  "걸치기만 해도 면제" 로 조용히 되돌아간다(2026-08-13 의 골 지역 면제가 그 규약이라 더 위험하다).
 *
 *  경계가 **축 정렬**이라 차체의 AABB 만 보면 정확하다: 회전한 사각형이 축 정렬 상자 안에
 *  있을 필요충분조건은 네 꼭짓점이 모두 안인 것이고, 그것은 곧 AABB 가 안이라는 뜻이다.
 *  ±Infinity 를 넣으면 그 방향은 끝이 없는 반평면이 된다(`court.ts` 의 `GoalMouth`).
 *
 *  ⚠️ 할당 0 — 이 파일의 규율이다(머리말). 숫자만 받고 불리언만 돌려준다. */
export function chairInsideBounds(
  chairX: number,
  chairY: number,
  theta: number,
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
): boolean {
  const ux = Math.cos(theta);
  const uy = Math.sin(theta);
  const aux = ux < 0 ? -ux : ux;
  const auy = uy < 0 ? -uy : uy;
  // 차체 중심은 피벗이 아니다 — 피벗 + AX_MID·u (위 chairOverlapsRect 와 같은 식).
  const cx = chairX + AX_MID * ux;
  const cy = chairY + AX_MID * uy;
  const hx = AX_HALF * aux + HALF_W * auy;
  const hy = AX_HALF * auy + HALF_W * aux;
  return (
    cx - hx >= minX - TOUCH_EPS_PX && cx + hx <= maxX + TOUCH_EPS_PX && cy - hy >= minY - TOUCH_EPS_PX && cy + hy <= maxY + TOUCH_EPS_PX
  );
}
