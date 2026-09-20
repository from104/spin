// 이동 앵커가 **다른 손잡이를 비켜 앉는** 산수. 순수 함수 하나뿐이다(DOM·SVG·React 없음).
// 2026-09-14 기현님 실기: *"원, 사각형은 회전 앵커와 겹친다."*
//
// ── 왜 겹칠 수밖에 없었나 ───────────────────────────────────────────────────────────
// 회전 손잡이는 **월드 고정**이다(도형 중심에서 h/2 + 16 월드 px 위 — model/shape.ts). 이동
// 앵커는 **화면 고정**이다(상자 위 모서리에서 21 CSS px 위). 둘의 화면 거리는
// `|21 − 15·pxPerUnit|` 이라 **배율 하나(≈1.4)에서 정확히 0** 이고, 기본 배율이 그 근처다.
// 상수를 어떻게 고르든 어느 배율에서는 겹친다 — 손잡이를 옮겨도 마찬가지다(월드 상수 하나로
// 모든 배율의 화면 44px 을 살 수 없다). 그래서 **자리를 매번 다시 고르는** 수밖에 없다.
//
// ── 왜 가로로만 비키나 ──────────────────────────────────────────────────────────────
// 세로(중앙 위 / 자리 없으면 중앙 아래)는 기현님이 *"적절하다"* 고 판정한 규칙이다. 이 함수가
// `x` **하나만** 돌려주는 것이 그 불가침을 테스트가 아니라 **구조로** 지키는 방법이다 —
// 세로를 건드리려면 시그니처를 바꿔야 하고, 그러면 이 머리말을 읽게 된다.
//
// ── 왜 44 인가 ──────────────────────────────────────────────────────────────────────
// 앵커는 다른 손잡이보다 **위에** 그려지고 잡는 원(r=22)이 투명하게 손을 먹는다. 중심이
// 44(= 22+22) 떨어져야 상대 손잡이의 **잡는 원 전체**가 앵커 밖에 남는다. 33(= 22+11)이면
// «보이는 점은 눌린다» 까지만 참이고, 그 자리를 정확히 조준해야 한다는 뜻이라 표적이 실질적으로
// 줄어든다 — 이 앱의 표적 하한(--hit 44)을 스스로 깨는 값이다.

export interface AnchorRival {
  /** 화면(클라이언트) CSS px. */
  x: number;
  y: number;
}

export interface AvoidOpts {
  /** 앵커 중심과 손잡이 중심이 벌려야 할 최소 거리. `2 × handleHitRadiusCssPx`. */
  clearPx: number;
  /** 앵커의 잡는 원 반지름 — 무대 안으로 물리는 데 쓴다(placement 와 같은 값이라야 한다). */
  hitRadiusPx: number;
}

/**
 * 앵커의 가로 자리를 고른다. 세로(`y`)는 **읽기만** 한다.
 *
 * 규칙:
 * ① 어느 손잡이와도 `clearPx` 를 벌고 있으면 `x0` 그대로 — 오늘과 픽셀이 같다.
 * ② 못 벌면, 벌 수 있는 자리 중 **`x0` 에서 가장 덜 움직이는** 곳. 같으면 오른쪽.
 * ③ 무대(stage) 밖으로는 안 나간다. 물린 뒤에도 못 벌면 **가장 멀리 벌어지는** 자리(차선).
 *
 * ②가 «중앙 위» 라는 지시에 가장 가까운 답이다 — 정해진 구석으로 보내면 덜 겹치지만 지시에서
 * 더 멀어진다. ③의 차선이 도는 경우(좁은 창·손잡이가 빽빽한 작은 도형)에는 겹침이 남을 수
 * 있고, 그때도 **몸통 드래그**라는 길이 그대로 있다.
 */
export function moveAnchorAvoidX(
  x0: number,
  y: number,
  rivals: readonly AnchorRival[],
  stage: { left: number; right: number },
  opts: AvoidOpts,
): number {
  const { clearPx, hitRadiusPx } = opts;
  if (rivals.length === 0) return x0;

  const lo = stage.left + hitRadiusPx;
  const hi = stage.right - hitRadiusPx;
  const clampX = (v: number): number => (hi < lo ? lo : Math.min(hi, Math.max(lo, v)));

  /** 가장 가까운 손잡이까지의 거리. 클수록 좋다. */
  const clearance = (x: number): number => {
    let m = Infinity;
    for (const r of rivals) m = Math.min(m, Math.hypot(x - r.x, y - r.y));
    return m;
  };

  // ⚠️ 부동소수점 여유. 후보는 `x = r.x ± √(clear² − dy²)` 로 만들므로 그 자리의 실제 거리는
  // **정확히 clear** 여야 하는데, 제곱근을 거치면 43.99999999999999 가 나오는 조합이 있다.
  // 여유가 없으면 그 후보가 «확보 실패» 로 떨어져 차선 분기로 새고, 차선은 고르는 규칙이 달라
  // 앵커가 반대쪽으로 간다(2026-09-14 실기에서 실제로 왼쪽으로 갔다). 1e-9 은 화면 px 기준으로
  // 무의미하게 작고 배정밀도 오차보다는 훨씬 크다.
  const EPS = 1e-9;
  if (clearance(x0) >= clearPx - EPS) return x0;

  // 후보는 **금지구간의 양 끝**뿐이다. 그 사이 어디에 서도 더 나을 수 없고(거리가 단조),
  // 그 밖은 이미 자유로우니 끝점보다 멀 이유가 없다 — 그래서 훑지 않고 끝점만 센다.
  const candidates: number[] = [clampX(x0)];
  for (const r of rivals) {
    const dy = Math.abs(y - r.y);
    if (dy >= clearPx) continue;
    const w = Math.sqrt(clearPx * clearPx - dy * dy);
    candidates.push(clampX(r.x - w), clampX(r.x + w));
  }

  // 고르는 규칙을 **한 곳**에 모은다. 예전에는 자유·차선이 각자 다른 동점 처리를 갖고 있어서,
  // 위 EPS 하나에 걸려 분기가 바뀌면 앵커가 좌우로 뒤집혔다.
  //   ① 확보한 후보가 못 한 후보를 언제나 이긴다.
  //   ② 확보한 것들끼리는 **덜 움직이는** 쪽(«중앙 위» 에 가까운 쪽).
  //   ③ 못 한 것들끼리는 **더 벌어지는** 쪽(차선다운 차선).
  //   ④ 그래도 같으면 **오른쪽**. 임의 관례지만 한쪽으로 고정해야 같은 판에서 앵커가 안 뛴다.
  let best = candidates[0]!;
  let bestClear = clearance(best);
  for (const c of candidates) {
    const cl = clearance(c);
    const cFree = cl >= clearPx - EPS;
    const bFree = bestClear >= clearPx - EPS;
    let better: boolean;
    if (cFree !== bFree) better = cFree;
    else if (cFree) {
      const d = Math.abs(c - x0);
      const bd = Math.abs(best - x0);
      better = d < bd - EPS || (Math.abs(d - bd) <= EPS && c > best);
    } else {
      better = cl > bestClear + EPS || (Math.abs(cl - bestClear) <= EPS && c > best);
    }
    if (better) {
      best = c;
      bestClear = cl;
    }
  }
  return best;
}
