// §4.4 P2-4 — 반칙 판정 기하의 순수 계약. **차체는 점이 아니라 1.5 × 1.0 m 사각형**이라는
// 2026-08-13 기현님 지시(chairOverlap.ts 머리말)를 이 파일이 좌표로 붙잡는다.
//
// ⚠️ 여기서 가장 위험한 헛통과는 **"원으로 재도 통과하는 테스트"** 다. 피벗은 차체의 중심이
// 아니므로(뒤 0.3 m / 앞 1.2 m) **앞을 볼 때와 뒤를 볼 때 결과가 달라야** 한다. 그 비대칭을
// 직접 단언하지 않으면, 구현이 `hypot(dx,dy) <= r + 상수` 로 퇴화해도 전부 초록이다.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CHAIR } from '../core/constants.ts';
import { chairCorners } from './chair.ts';
import { chairInsideBounds, chairOverlapsCircle, chairOverlapsRect, chairPointDist2, TOUCH_EPS_PX } from './chairOverlap.ts';

const BACK = CHAIR.pivotToRearPx; // 7.5
const FRONT = CHAIR.pivotToFrontPx; // 30
const HALF_W = CHAIR.widthPx / 2; // 12.5

/** 찔러야 하는 방향 축. 축정렬(0·90·180·270)만 보면 회전 항이 통째로 죽은 구현도 통과한다 —
 *  그래서 아무 데도 안 걸치는 37° 를 함께 돌린다. */
const THETAS: Array<[string, number]> = [
  ['0°', 0],
  ['90°', Math.PI / 2],
  ['180°', Math.PI],
  ['270°', (3 * Math.PI) / 2],
  ['37°', (37 * Math.PI) / 180],
];

describe('chairOverlap — chairCorners 와 **같은 사각형**을 보는가', () => {
  it('네 꼭짓점이 정확히 hull 위에 있다 — 거리² 가 0 이다', () => {
    for (const [tag, theta] of THETAS) {
      const corners = chairCorners({ x: 300, y: 200, theta });
      for (const c of corners) {
        // 꼭짓점은 hull 의 경계 위 = 최단거리 0. 부동소수 오차만 허용한다.
        expect(chairPointDist2(300, 200, theta, c.x, c.y), `${tag} 꼭짓점 ${c.x},${c.y}`).toBeLessThan(1e-18);
        expect(chairOverlapsCircle(300, 200, theta, c.x, c.y, 0), tag).toBe(true);
        // 크기 0 인 사각형 = 점 검사. SAT 쪽도 같은 hull 을 본다는 뜻이다.
        expect(chairOverlapsRect(300, 200, theta, c.x, c.y, 0, 0), tag).toBe(true);
      }
    }
  });

  it('꼭짓점 **바깥**은 정확히 그만큼 멀다 — hull 이 실제로 거기서 끝난다', () => {
    // 꼭짓점에서 hull 중심 반대쪽으로 d 만큼 밀면 최단거리가 정확히 d 다(꼭짓점이 최근접점).
    const d = 0.4;
    for (const [tag, theta] of THETAS) {
      const ux = Math.cos(theta);
      const uy = Math.sin(theta);
      // hull 중심은 피벗 + 11.25·u 다(피벗이 아니다 — 이 값이 0 이면 대각선이 어긋난다).
      const hcx = 300 + ((FRONT - BACK) / 2) * ux;
      const hcy = 200 + ((FRONT - BACK) / 2) * uy;
      for (const c of chairCorners({ x: 300, y: 200, theta })) {
        const nx = c.x - hcx;
        const ny = c.y - hcy;
        const len = Math.hypot(nx, ny);
        const px = c.x + (nx / len) * d;
        const py = c.y + (ny / len) * d;
        expect(chairPointDist2(300, 200, theta, px, py), tag).toBeCloseTo(d * d, 9);
        expect(chairOverlapsCircle(300, 200, theta, px, py, d * 0.99), tag).toBe(false);
        expect(chairOverlapsCircle(300, 200, theta, px, py, d * 1.01), tag).toBe(true);
      }
    }
  });

  it('월드 AABB 도 chairCorners 와 일치한다 — SAT 의 월드축 support 검산', () => {
    for (const [tag, theta] of THETAS) {
      const corners = chairCorners({ x: 300, y: 200, theta });
      const minX = Math.min(...corners.map((c) => c.x));
      // 오른쪽 끝이 정확히 minX 인 사각형은 **닿는다**(접촉은 안이다).
      expect(chairOverlapsRect(300, 200, theta, minX - 50, 150, 50, 100), tag).toBe(true);
      // 0.1 px 더 물러나면 안 닿는다.
      expect(chairOverlapsRect(300, 200, theta, minX - 50.1, 150, 50, 100), tag).toBe(false);
    }
  });

  it('차체 안의 점은 거리 0 이다 — 공을 깔고 앉은 휠체어', () => {
    expect(chairPointDist2(300, 200, 0, 300, 200)).toBe(0); // 피벗
    expect(chairPointDist2(300, 200, 0, 300 + FRONT - 1, 200)).toBe(0);
    expect(chairOverlapsCircle(300, 200, 0, 310, 200, 0)).toBe(true); // r=0 이어도 겹친다
  });
});

describe('chairOverlap — 방향(theta) 이 결과를 바꾼다', () => {
  it('★ 앞을 볼 때와 뒤를 볼 때가 **다르다** — 대칭이면 원으로 재고 있는 것이다', () => {
    // 피벗에서 +x 로 20 px 떨어진 점. 차체가 +x 를 보면(θ=0) 앞범퍼 1.2 m 안이라 **차체 안**,
    // 반대로 −x 를 보면(θ=180°) 뒤로 0.3 m 뿐이라 12.5 px 밖이다.
    const p = 300 + 20;
    expect(chairPointDist2(300, 200, 0, p, 200)).toBe(0);
    expect(chairPointDist2(300, 200, Math.PI, p, 200)).toBeCloseTo((20 - BACK) * (20 - BACK), 6);
    expect(chairOverlapsCircle(300, 200, 0, p, 200, 1)).toBe(true);
    expect(chairOverlapsCircle(300, 200, Math.PI, p, 200, 1)).toBe(false);
    // 대조군 — 뒤쪽으로 재면 부호가 뒤집힌다(둘 다 틀린 상수를 쓰면 여기서 갈라진다).
    expect(chairPointDist2(300, 200, Math.PI, 300 - 20, 200)).toBe(0);
    expect(chairPointDist2(300, 200, 0, 300 - 20, 200)).toBeCloseTo((20 - BACK) * (20 - BACK), 9);
  });

  it('네 직각 방향이 앞 1.2 m / 뒤 0.3 m / 폭 1.0 m 를 따라 돈다', () => {
    // 각 방향에서 "앞쪽 끝 바로 안" 은 차체 안, "바로 밖" 은 밖이다.
    const cases: Array<[number, number, number]> = [
      [0, 1, 0],
      [Math.PI / 2, 0, 1],
      [Math.PI, -1, 0],
      [(3 * Math.PI) / 2, 0, -1],
    ];
    for (const [theta, ex, ey] of cases) {
      const inX = 300 + ex * (FRONT - 0.1);
      const inY = 200 + ey * (FRONT - 0.1);
      const outX = 300 + ex * (FRONT + 0.1);
      const outY = 200 + ey * (FRONT + 0.1);
      expect(chairPointDist2(300, 200, theta, inX, inY), `${theta} 앞 안쪽`).toBeLessThan(1e-9);
      expect(chairPointDist2(300, 200, theta, outX, outY), `${theta} 앞 바깥`).toBeCloseTo(0.01, 6);
      // 뒤쪽은 0.3 m 에서 끝난다.
      expect(chairPointDist2(300, 200, theta, 300 - ex * (BACK - 0.1), 200 - ey * (BACK - 0.1))).toBeLessThan(1e-9);
      expect(chairPointDist2(300, 200, theta, 300 - ex * (BACK + 0.1), 200 - ey * (BACK + 0.1))).toBeCloseTo(0.01, 6);
      // 측방은 좌우 대칭 0.5 m 다.
      expect(chairPointDist2(300, 200, theta, 300 - ey * (HALF_W - 0.1), 200 + ex * (HALF_W - 0.1))).toBeLessThan(1e-9);
      expect(chairPointDist2(300, 200, theta, 300 - ey * (HALF_W + 0.1), 200 + ex * (HALF_W + 0.1))).toBeCloseTo(0.01, 6);
    }
  });

  it('비스듬(37°)에서도 사각형이다 — 원이라면 못 가르는 두 점', () => {
    const theta = (37 * Math.PI) / 180;
    const ux = Math.cos(theta);
    const uy = Math.sin(theta);
    const vx = -uy;
    const vy = ux;
    // 축 방향 25 px(앞범퍼 1.2 m 안) vs 측방 25 px(폭 0.5 m 밖). 피벗에서 같은 거리다.
    const ax25x = 300 + 25 * ux;
    const ax25y = 200 + 25 * uy;
    const lat25x = 300 + 25 * vx;
    const lat25y = 200 + 25 * vy;
    expect(Math.hypot(ax25x - 300, ax25y - 200)).toBeCloseTo(25, 9);
    expect(Math.hypot(lat25x - 300, lat25y - 200)).toBeCloseTo(25, 9);
    expect(chairPointDist2(300, 200, theta, ax25x, ax25y)).toBeLessThan(1e-9); // 안
    expect(chairPointDist2(300, 200, theta, lat25x, lat25y)).toBeCloseTo((25 - HALF_W) ** 2, 6); // 밖
  });
});

describe('chairOverlap — 원(3 m 링) 접선과 한 뼘 차이', () => {
  const R = 75; // 3 m. 값 자체는 rules.ts 의 RING_R_PX 가 소유한다(여기선 기하만 본다).

  it('정확히 닿으면 **안이다** — 라인 위는 그 구역 안이다', () => {
    // 뒤를 보인 차체(θ=0)의 뒷변이 공에서 정확히 75 px: 피벗 = 공 + 75 + 7.5.
    const px = 100 + R + BACK;
    expect(chairOverlapsCircle(px, 200, 0, 100, 200, R)).toBe(true);
    expect(chairPointDist2(px, 200, 0, 100, 200)).toBeCloseTo(R * R, 6);
  });

  it('0.1 px 안쪽이면 겹치고 0.1 px 바깥이면 안 겹친다 — 앞/뒤 문턱이 다르다', () => {
    // ⓐ 뒤를 보인 차체: 문턱은 피벗 기준 75 + 7.5 = 82.5 px.
    expect(chairOverlapsCircle(100 + R + BACK - 0.1, 200, 0, 100, 200, R)).toBe(true);
    expect(chairOverlapsCircle(100 + R + BACK + 0.1, 200, 0, 100, 200, R)).toBe(false);
    // ⓑ 공을 마주 본 차체: 앞범퍼가 1.2 m 이므로 문턱이 75 + 30 = 105 px 로 **22.5 px 멀다**.
    expect(chairOverlapsCircle(100 + R + FRONT - 0.1, 200, Math.PI, 100, 200, R)).toBe(true);
    expect(chairOverlapsCircle(100 + R + FRONT + 0.1, 200, Math.PI, 100, 200, R)).toBe(false);
    // ★ 두 문턱 사이(피벗 90 px)는 **방향이 결과를 가른다**. 원으로 재면 둘이 같아진다.
    expect(chairOverlapsCircle(190, 200, 0, 100, 200, R)).toBe(false);
    expect(chairOverlapsCircle(190, 200, Math.PI, 100, 200, R)).toBe(true);
  });

  it('옛 판정(피벗 점)이 놓치던 1.2 m 가 정확히 이만큼이다', () => {
    // 피벗이 공에서 100 px(4 m) — 점 판정으로는 3 m 밖이다. 그러나 공을 마주 보면 앞범퍼가
    // 공에서 70 px 라 **3 m 안**이다. 이것이 지시서의 "최대 1.2 m 를 놓친다" 다.
    const pivotDist = 100;
    expect(pivotDist > R).toBe(true); // 점 판정이라면 '밖'
    expect(chairOverlapsCircle(100 + pivotDist, 200, Math.PI, 100, 200, R)).toBe(true);
    expect(chairPointDist2(100 + pivotDist, 200, Math.PI, 100, 200)).toBeCloseTo((pivotDist - FRONT) ** 2, 6);
  });
});

describe('chairOverlap — 축정렬 사각형(SAT)', () => {
  const ZONE = { x: 100, y: 100, w: 200, h: 150 };
  const hit = (x: number, y: number, theta: number): boolean => chairOverlapsRect(x, y, theta, ZONE.x, ZONE.y, ZONE.w, ZONE.h);

  it('앞범퍼가 변에 정확히 닿으면 안이다 — 0.01 px 물러나면 밖이다', () => {
    // θ=0, 피벗 x = ZONE.x − 30 → 앞범퍼가 정확히 ZONE.x. 값이 전부 이진수로 정확하다.
    expect(hit(ZONE.x - FRONT, 175, 0)).toBe(true);
    expect(hit(ZONE.x - FRONT - 0.01, 175, 0)).toBe(false);
    // 뒤를 보이면 문턱이 0.3 m 로 줄어든다(같은 변, 다른 방향).
    expect(hit(ZONE.x - BACK, 175, Math.PI)).toBe(true);
    expect(hit(ZONE.x - BACK - 0.01, 175, Math.PI)).toBe(false);
  });

  it('★ 모서리만 닿아도 안이다 — 꼭짓점 하나가 존 변에 정확히 놓인 배치', () => {
    // ⚠️ **세 각을 함께 돈다.** 45° 하나만 넣으면 TOUCH_EPS_PX 를 0 으로 되돌려도 통과한다
    //    (그 각의 부동소수 여유는 −2.8e-14 로 우연히 '안' 쪽이다). 37°·137° 는 +2.8e-14 ·
    //    +4.3e-14 로 '밖' 쪽이라, 여유가 없으면 정확한 접선이 뒤집힌다(chairOverlap.ts 실측표).
    for (const deg of [37, 45, 137]) {
      const theta = (deg * Math.PI) / 180;
      // hull 의 최소 x 는 chairCorners 에서 얻는다 — 판정과 **다른 출처**여야 검산이 된다.
      const dxMin = Math.min(...chairCorners({ x: 0, y: 0, theta }).map((c) => c.x));
      const cx = ZONE.x + ZONE.w - dxMin;
      const xs = chairCorners({ x: cx, y: 175, theta }).map((c) => c.x).sort((a, b) => a - b);
      expect(xs[0], `${deg}° 접점`).toBeCloseTo(ZONE.x + ZONE.w, 9); // 한 점만 변 위
      expect(xs[1], `${deg}° 나머지`).toBeGreaterThan(ZONE.x + ZONE.w + 1); // 나머지는 확실히 밖
      expect(hit(cx, 175, theta), `${deg}° 접촉`).toBe(true);
      // 0.1 px 만 더 물러나면 아무 데도 안 닿는다.
      expect(hit(cx + 0.1, 175, theta), `${deg}° 0.1 px 밖`).toBe(false);
    }
  });

  it('★ AABB 가 겹쳐도 차체 축이 갈라 놓으면 밖이다 — 사각형 SAT 인 증거', () => {
    // 45° 차체(피벗 300,200)의 월드 AABB 모서리 쪽에 작은 사각형을 둔다. AABB 로는 겹치는데
    // 차체의 측방(v) 축에서 분리된다 — AABB 검사로 퇴화한 구현이라면 여기서 빨개진다.
    const theta = Math.PI / 4;
    const corners = chairCorners({ x: 300, y: 200, theta });
    const minY = Math.min(...corners.map((c) => c.y));
    const maxX = Math.max(...corners.map((c) => c.x));
    const small = { x: maxX - 5, y: minY, w: 5, h: 5 };
    // AABB 로는 x·y 둘 다 겹친다.
    expect(small.x).toBeLessThan(maxX);
    expect(small.y + small.h).toBeGreaterThan(minY);
    expect(chairOverlapsRect(300, 200, theta, small.x, small.y, small.w, small.h)).toBe(false);
    // 대조군 — 같은 크기의 사각형을 차체 한가운데에 두면 당연히 겹친다.
    expect(chairOverlapsRect(300, 200, theta, 300, 200, small.w, small.h)).toBe(true);
  });

  it('차체가 존을 통째로 품어도, 존이 차체를 품어도 겹침이다', () => {
    const tiny = { x: 300, y: 200, w: 1, h: 1 };
    expect(chairOverlapsRect(299, 199.5, 0, tiny.x, tiny.y, tiny.w, tiny.h)).toBe(true);
    const huge = { x: -1000, y: -1000, w: 2000, h: 2000 };
    expect(chairOverlapsRect(0, 0, 1.234, huge.x, huge.y, huge.w, huge.h)).toBe(true);
  });

  // ── 2026-08-13 검증관 추가 — **SAT 의 반대 방향**을 아무도 안 재고 있었다 ────────────────────
  // 위 'AABB 가 겹쳐도 …' 는 SAT 의 **거짓** 쪽(분리 축을 찾아 '밖' 이라고 말하는 힘)만 잰다.
  // **참** 쪽 — *"꼭짓점은 하나도 서로 안 들어갔는데 변이 교차하니까 겹침"* — 은 아무 단언도
  // 없었다. 실측으로 확인했다: `chairOverlapsRect` 를 흔한 오구현인 **"꼭짓점 포함 검사만"**
  // (차체 꼭짓점 4개가 존 안인가 + 존 꼭짓점 4개가 차체 안인가)으로 통째로 바꿔도
  // **저장소 2661 테스트가 전건 초록이었다.** 아래 두 단언만이 그것을 잡는다.
  //
  // ⚠️ 지금의 `CourtDef.ruleZones` 로는 이 배치가 **안 나온다** — 골 지역이 최소 125 px 인데
  //    차체 대각선은 45.07 px 라 존을 가로지를 수가 없다. 그래도 못박는 이유:
  //    ① `chairOverlapsRect` 는 존 전용이 아니라 **일반 사각형** API 다(머리말이 SAT 이라고
  //       적어 뒀고, 크기 0 인 사각형까지 계약에 들어 있다).
  //    ② 세트피스 쪽에는 이미 **얇고 긴** 사각형 개념이 있다(인크로치먼트 마크·골라인 띠).
  //       그런 좁은 사각형에 이 함수를 한 번이라도 쓰는 날, 오구현은 **조용히 '안 걸림'** 이
  //       되고 그것은 화면에 아무 표시도 남기지 않는 실패다.
  it('★ 변만 교차해도 겹침이다 — 꼭짓점은 서로 하나도 안 들어간 배치(SAT 의 참 쪽)', () => {
    const chair = { x: 300, y: 200 };
    // θ=0 차체: x ∈ [292.5, 330], y ∈ [187.5, 212.5]. 존은 그보다 **좁고 길다**.
    const zone = { x: 300, y: 140, w: 10, h: 120 };
    for (const c of chairCorners({ ...chair, theta: 0 })) {
      const inZone = c.x >= zone.x && c.x <= zone.x + zone.w && c.y >= zone.y && c.y <= zone.y + zone.h;
      expect(inZone, `차체 꼭짓점 (${c.x},${c.y}) 이 존 안이면 이 케이스가 뜻을 잃는다`).toBe(false);
    }
    for (const p of [
      { x: zone.x, y: zone.y },
      { x: zone.x + zone.w, y: zone.y },
      { x: zone.x + zone.w, y: zone.y + zone.h },
      { x: zone.x, y: zone.y + zone.h },
    ]) {
      expect(chairPointDist2(chair.x, chair.y, 0, p.x, p.y), `존 꼭짓점 (${p.x},${p.y}) 이 차체 안`).toBeGreaterThan(1);
    }
    expect(chairOverlapsRect(chair.x, chair.y, 0, zone.x, zone.y, zone.w, zone.h), '십자로 교차하는데 못 잡았다').toBe(true);
    // 대조군 — 같은 존을 차체 오른쪽 끝 **밖**으로 밀면 정말로 안 겹친다(부재 단언이 헛것이 아니다).
    expect(chairOverlapsRect(chair.x, chair.y, 0, zone.x + 40, zone.y, zone.w, zone.h)).toBe(false);
  });

  it('★ 같은 것을 비스듬(37°)에서도 — 축정렬만 맞춘 구현이 빠져나가지 못하게', () => {
    const theta = (37 * Math.PI) / 180;
    const corners = chairCorners({ x: 300, y: 200, theta });
    const xs = corners.map((c) => c.x).sort((a, b) => a - b);
    const ys = corners.map((c) => c.y);
    // 꼭짓점 x 중 **가운데 둘 사이**의 세로 띠 — 어떤 차체 꼭짓점도 이 x 범위 안이 아니다.
    const zone = { x: xs[1]! + 0.5, y: Math.min(...ys) - 10, w: xs[2]! - xs[1]! - 1, h: Math.max(...ys) - Math.min(...ys) + 20 };
    expect(zone.w, '띠에 폭이 있어야 케이스가 성립한다').toBeGreaterThan(1);
    for (const c of corners) {
      const inZone = c.x >= zone.x && c.x <= zone.x + zone.w && c.y >= zone.y && c.y <= zone.y + zone.h;
      expect(inZone, `37° 차체 꼭짓점 (${c.x},${c.y}) 이 존 안`).toBe(false);
    }
    // 존 꼭짓점은 전부 차체 AABB 위·아래로 10 px 벗어나 있으므로 차체 안일 수 없다.
    for (const p of [
      { x: zone.x, y: zone.y },
      { x: zone.x + zone.w, y: zone.y },
      { x: zone.x + zone.w, y: zone.y + zone.h },
      { x: zone.x, y: zone.y + zone.h },
    ]) {
      expect(chairPointDist2(300, 200, theta, p.x, p.y), `존 꼭짓점 (${p.x},${p.y}) 이 차체 안`).toBeGreaterThan(1);
    }
    expect(chairOverlapsRect(300, 200, theta, zone.x, zone.y, zone.w, zone.h)).toBe(true);
    // 대조군 — 띠를 차체 오른쪽 밖(hullRadius 너머)으로 밀면 안 겹친다.
    expect(chairOverlapsRect(300, 200, theta, 300 + CHAIR.hullRadiusPx + 1, zone.y, zone.w, zone.h)).toBe(false);
  });

  it('네 방향 모두에서 완전히 벗어나면 밖이다 — 부재 단언이 헛것이 아님을 대조군이 잰다', () => {
    for (const [tag, theta] of THETAS) {
      // 차체 hull 반지름 상한은 32.5 px(CHAIR.hullRadiusPx) — 그보다 멀면 어떤 각도든 밖이다.
      const far = CHAIR.hullRadiusPx + 1;
      expect(hit(ZONE.x - far, 175, theta), `${tag} 왼쪽`).toBe(false);
      expect(hit(ZONE.x + ZONE.w + far, 175, theta), `${tag} 오른쪽`).toBe(false);
      expect(hit(200, ZONE.y - far, theta), `${tag} 위`).toBe(false);
      expect(hit(200, ZONE.y + ZONE.h + far, theta), `${tag} 아래`).toBe(false);
      // 대조군: 존 한가운데면 어느 각도에서든 안이다.
      expect(hit(200, 175, theta), `${tag} 중앙`).toBe(true);
    }
  });
});

describe('chairOverlap — 매 프레임 도는 코드라 **할당이 없다**', () => {
  const src = readFileSync('src/model/chairOverlap.ts', 'utf8');
  /** 주석을 걷어낸 **코드만**. 주석의 예시 문자열이 통과/실패를 좌우하면 그건 계약이 아니다
   *  (실제로 이 파일들의 머리말은 `chairCorners` 를 "부르면 안 되는 것" 으로 언급한다). */
  const codeOf = (p: string): string =>
    readFileSync(p, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

  it('판정 경로가 chairCorners 를 부르지 않는다 — 그건 객체 5개를 할당한다', () => {
    // chairCorners 는 Vec2 4개 + 배열 1개 = 프레임당 8대 × 공 개수만큼의 GC 를 만든다.
    // 되돌리면 정지한 판에서도 힙이 자란다(rules.ts 머리말 규율).
    expect(codeOf('src/model/chairOverlap.ts').includes('chairCorners')).toBe(false);
    expect(codeOf('src/model/rules.ts').includes('chairCorners')).toBe(false);
    // 대조군: 이 검사가 실재하는 호출을 잡을 수 있다 — chair.ts 의 코드에는 정말로 있다.
    expect(codeOf('src/model/chair.ts').includes('chairCorners')).toBe(true);
    expect(codeOf('src/physics/obb.ts').includes('chairHullCorners')).toBe(true);
  });

  it('함수 본문에 객체·배열 리터럴이 없다 — 형태 계약', () => {
    const code = codeOf('src/model/chairOverlap.ts').slice(codeOf('src/model/chairOverlap.ts').indexOf('export const TOUCH_EPS_PX'));
    expect(code.match(/=>\s*\(?\{/), '화살표가 객체를 돌려준다').toBeNull();
    expect(code.match(/return\s*[[{]/), '리터럴을 돌려준다').toBeNull();
    expect(code.match(/\bnew\s+\w/), 'new 로 무언가를 만든다').toBeNull();
    expect(code.match(/\.map\(|\.filter\(|\.slice\(/), '배열을 만든다').toBeNull();
  });

  it('시그니처가 숫자만 받고 숫자·불리언만 돌려준다', () => {
    const sigs = [...src.matchAll(/export function (\w+)\(([\s\S]*?)\):\s*(\w+)\s*\{/g)];
    expect(sigs.length).toBe(4); // dist2 · circle · rect · insideBounds(2026-08-17)
    for (const [, name, params, ret] of sigs) {
      const list = params!.split(',').map((s) => s.trim()).filter(Boolean);
      expect(list.length, `${name} 인자 없음`).toBeGreaterThan(0);
      for (const p of list) expect(p, `${name} 의 ${p}`).toMatch(/:\s*number$/);
      expect(['number', 'boolean'], `${name} 반환`).toContain(ret);
    }
    // 반환값이 실제로 원시값이다(객체를 감싸 돌려주지 않는다).
    const d = chairPointDist2(0, 0, 0.3, 5, 5);
    expect(Object(d) === d).toBe(false);
    expect(typeof chairOverlapsRect(0, 0, 0.3, 1, 1, 2, 2)).toBe('boolean');
  });

  it('접선 여유는 1e-9 px 뿐이다 — 0.01 px 를 좌우할 수 없다', () => {
    expect(TOUCH_EPS_PX).toBe(1e-9);
    // 이 값이 커지면 "에누리 없다" 가 무너진다. 0.001 px 밖은 여전히 밖이어야 한다.
    expect(chairOverlapsCircle(100 + 75 + BACK + 0.001, 200, 0, 100, 200, 75)).toBe(false);
  });
});

// 2026-08-17 — 세트피스 5 m 의 골키퍼 면제가 쓰는 **반대 방향 판정**.
// 기현 지시: *"골대 뒤는 완전히 나가야 면제"*. 위쪽 `chairOverlapsRect`(걸치면 안)와 한 이름으로
// 뭉치면 둘 중 하나가 조용히 상대 쪽 규약으로 끌려간다.
describe('chairInsideBounds — 통째로 안인가', () => {
  const AX = CHAIR.pivotToRearPx + CHAIR.pivotToFrontPx; // 차체 길이 37.5
  const HALF_W = CHAIR.widthPx / 2;

  it('넉넉한 상자 안이면 true, 한 뼘이라도 나가면 false', () => {
    // +x 를 보는 차체: x ∈ [−7.5, 30], y ∈ [−12.5, 12.5]
    expect(chairInsideBounds(0, 0, 0, -CHAIR.pivotToRearPx, CHAIR.pivotToFrontPx, -HALF_W, HALF_W)).toBe(true);
    expect(chairInsideBounds(0, 0, 0, -CHAIR.pivotToRearPx + 0.01, CHAIR.pivotToFrontPx, -HALF_W, HALF_W)).toBe(false);
    expect(chairInsideBounds(0, 0, 0, -CHAIR.pivotToRearPx, CHAIR.pivotToFrontPx - 0.01, -HALF_W, HALF_W)).toBe(false);
  });

  it('★ 걸치기만 하는 것은 안이 아니다 — chairOverlapsRect 와 정반대다', () => {
    // 차체 절반이 상자 밖으로 나간 배치.
    const args = [0, 0, 0, 5, 100, -100, 100] as const;
    expect(chairOverlapsRect(0, 0, 0, 5, -100, 95, 200)).toBe(true); // 겹치기는 한다
    expect(chairInsideBounds(...args)).toBe(false); // 그러나 통째로는 아니다
  });

  it('돌아가면 차지하는 폭이 달라진다 — AABB 로 재는 것이 정확하다', () => {
    // 45° 로 돌면 x·y 반폭이 (AX/2 + HALF_W)/√2 로 같아진다.
    const h = ((AX / 2 + HALF_W) * Math.SQRT1_2);
    const c = CHAIR.pivotToFrontPx - AX / 2; // 피벗 → 중심 거리
    const cx = c * Math.SQRT1_2;
    expect(chairInsideBounds(0, 0, Math.PI / 4, cx - h, cx + h, cx - h, cx + h)).toBe(true);
    expect(chairInsideBounds(0, 0, Math.PI / 4, cx - h + 0.01, cx + h, cx - h, cx + h)).toBe(false);
  });

  it('★ ±Infinity 는 끝이 없는 반평면이다 — 골라인 바깥이 그것이다', () => {
    expect(chairInsideBounds(0, 0, 0, -Infinity, CHAIR.pivotToFrontPx, -Infinity, Infinity)).toBe(true);
    // 대조군: 유한한 쪽은 여전히 잰다.
    expect(chairInsideBounds(0, 0, 0, -Infinity, CHAIR.pivotToFrontPx - 0.01, -Infinity, Infinity)).toBe(false);
  });
});
