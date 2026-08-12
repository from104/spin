// OBB SAT · 충돌 해결 · 경계. §5.6. matter 의존 0.
import type { Vec2 } from '../core/units.ts';
import { CHAIR, CHAIR_SEP_PX, RESOLVE_ITERS } from '../core/constants.ts';
import type { ChairPose } from '../model/chair.ts';
import type { Bounds } from './types.ts';
import { unitFwd, lerpPose } from './kinematics.ts';

export interface SatResult {
  depth: number; // ≤ 0 → 분리
  axis: Vec2 | null;
}

// 휠체어 로컬 사각형(피벗 기준). §3.4 렌더 rect 와 동일: x∈[-7.5,30], y∈[-12.5,12.5].
const REAR = -CHAIR.pivotToRearPx;
const FRONT = CHAIR.pivotToFrontPx;
const HALF_W = CHAIR.widthPx / 2;

function chairAxes(theta: number): [Vec2, Vec2] {
  const u = unitFwd(theta);
  const v: Vec2 = { x: -u.y, y: u.x };
  return [u, v];
}

function chairHullCorners(p: ChairPose): [Vec2, Vec2, Vec2, Vec2] {
  const [u, v] = chairAxes(p.theta);
  const local: [Vec2, Vec2, Vec2, Vec2] = [
    { x: REAR, y: -HALF_W },
    { x: FRONT, y: -HALF_W },
    { x: FRONT, y: HALF_W },
    { x: REAR, y: HALF_W },
  ];
  return local.map((c) => ({
    x: p.x + c.x * u.x + c.y * v.x,
    y: p.y + c.x * u.y + c.y * v.y,
  })) as [Vec2, Vec2, Vec2, Vec2];
}

function projExtent(corners: readonly Vec2[], axis: Vec2): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  for (const c of corners) {
    const d = c.x * axis.x + c.y * axis.y;
    if (d < min) min = d;
    if (d > max) max = d;
  }
  return { min, max };
}

function centroidOf(corners: readonly Vec2[]): Vec2 {
  let x = 0;
  let y = 0;
  for (const c of corners) {
    x += c.x;
    y += c.y;
  }
  return { x: x / corners.length, y: y / corners.length };
}

/** 두 볼록다각형(코너+고유축)에 대한 최소침투벡터(MTV) SAT. marginPx 만큼 여유를 뺀다
 *  (=margin 안쪽 간격까지도 "겹침"으로 취급). axis 는 A→B 방향으로 정렬한다. */
function satBetween(
  cornersA: readonly Vec2[],
  axesA: readonly Vec2[],
  cornersB: readonly Vec2[],
  axesB: readonly Vec2[],
  marginPx: number,
): SatResult {
  let best = Infinity;
  let bestAxis: Vec2 | null = null;
  for (const axis of [...axesA, ...axesB]) {
    const a = projExtent(cornersA, axis);
    const b = projExtent(cornersB, axis);
    const overlap = Math.min(a.max, b.max) - Math.max(a.min, b.min) + marginPx;
    if (overlap <= 0) return { depth: overlap, axis: null };
    if (overlap < best) {
      best = overlap;
      bestAxis = axis;
    }
  }
  if (bestAxis) {
    const cA = centroidOf(cornersA);
    const cB = centroidOf(cornersB);
    const rel = { x: cB.x - cA.x, y: cB.y - cA.y };
    if (rel.x * bestAxis.x + rel.y * bestAxis.y < 0) {
      bestAxis = { x: -bestAxis.x, y: -bestAxis.y };
    }
  }
  return { depth: best, axis: bestAxis };
}

export function satOverlap(a: ChairPose, b: ChairPose, marginPx: number): SatResult {
  const cornersA = chairHullCorners(a);
  const cornersB = chairHullCorners(b);
  return satBetween(cornersA, chairAxes(a.theta), cornersB, chairAxes(b.theta), marginPx);
}

// minor 회귀(§10.4): 정확히 marginPx 만큼 떨어진 두 휠체어가 부동소수 오차(예: 2.3e-14)로
// "겹침" 판정을 받는 knife-edge 를 막는다. satBetween 의 조기 분리 판정(overlap<=0)은 그대로
// 두고(다른 축의 최솟값 추적에 영향 없음), 최종 겹침 여부만 엡실론 이상일 때로 좁힌다.
const OVERLAP_EPS_PX = 1e-9;

export function chairsOverlap(a: ChairPose, b: ChairPose, marginPx: number): boolean {
  return satOverlap(a, b, marginPx).depth > OVERLAP_EPS_PX;
}

/** 컨테이너(bounds)는 축정렬 사각형이므로 hull 의 x/y 투영만으로 포함 여부가 결정된다
 *  (교차하는 반평면 두 쌍의 교집합이라는 성질). 회전축 SAT 은 불필요하다. */
export function outOfBounds(p: ChairPose, b: Bounds): SatResult {
  const corners = chairHullCorners(p);
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const c of corners) {
    if (c.x < minX) minX = c.x;
    if (c.x > maxX) maxX = c.x;
    if (c.y < minY) minY = c.y;
    if (c.y > maxY) maxY = c.y;
  }
  const violations: SatResult[] = [
    { depth: -minX, axis: { x: -1, y: 0 } },
    { depth: maxX - b.w, axis: { x: 1, y: 0 } },
    { depth: -minY, axis: { x: 0, y: -1 } },
    { depth: maxY - b.h, axis: { x: 0, y: 1 } },
  ];
  let worst = violations[0]!;
  for (const v of violations) if (v.depth > worst.depth) worst = v;
  return worst.depth > 0 ? worst : { depth: worst.depth, axis: null };
}

/** 판 밖으로 밀려난 휠체어를 판 안으로 되민다(§4.2 P0-3 "판 밖은 존재하지 않는다").
 *  hull 이 정확히 경계에 닿는 지점까지만 옮기고, **각도는 건드리지 않는다**(안전망이 사용자가
 *  놓은 방향을 바꾸지 않는다 — separateOverlaps 와 같은 이유).
 *
 *  outOfBounds 처럼 hull 의 x/y 투영만 보면 되므로(축정렬 사각형) 네 면을 **한 번에** 민다 —
 *  가장 깊은 면 하나씩 반복해 밀면 모서리에 걸린 칩이 두 패스를 먹는다.
 *
 *  ⚠️ 이것은 §5.6 이 금지하는 "resolveMotion 뒤에 붙이는 clampPoseToBounds" 가 **아니다**.
 *  그건 드래그 경로(잡은 칩)의 이야기이고 — 거기 clamp 를 붙이면 spin 중 피벗이 밀려
 *  '제자리 회전' 계약이 깨진다 — 여기는 substep 이 끝난 뒤 도는 최종 안전망(escapePinnedAll)
 *  이다. 잡은 칩은 이 경로에 들어오지 않는다(world.ts 가 static 을 건너뛴다). */
export function pushChairIntoBounds(p: ChairPose, b: Bounds): Vec2 {
  const corners = chairHullCorners(p);
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const c of corners) {
    if (c.x < minX) minX = c.x;
    if (c.x > maxX) maxX = c.x;
    if (c.y < minY) minY = c.y;
    if (c.y > maxY) maxY = c.y;
  }
  // 판보다 큰 hull(회전한 차체가 안 들어가는 좁은 판)에서는 **왼쪽/위쪽 면을 우선**한다 —
  // 양쪽을 동시에 만족시킬 수 없으므로 어느 쪽이든 하나를 골라야 하고, 결정적이면 된다.
  let dx = 0;
  let dy = 0;
  if (maxX > b.w) dx = b.w - maxX;
  if (minX < 0) dx = -minX;
  if (maxY > b.h) dy = b.h - maxY;
  if (minY < 0) dy = -minY;
  return { x: p.x + dx, y: p.y + dy };
}

/** 벽 + 다른 휠체어 전부를 한 술어로 묶는다 — 별도 clampPoseToBounds 단계를 두면
 *  spin 중 피벗이 밀려 "제자리 회전" 계약이 깨진다(§5.6). 가장 심한(depth 최대) 위반을 반환. */
export function blockedAt(
  p: ChairPose,
  others: readonly ChairPose[],
  b: Bounds,
  margin: number,
): SatResult {
  let worst = outOfBounds(p, b);
  for (const o of others) {
    const r = satOverlap(p, o, margin);
    if (r.depth > worst.depth) worst = r;
  }
  return worst;
}

export function resolveMotion(
  from: ChairPose,
  to: ChairPose,
  others: readonly ChairPose[],
  bounds: Bounds,
  marginPx: number = CHAIR_SEP_PX,
  iters: number = RESOLVE_ITERS,
): ChairPose {
  const blocked = (p: ChairPose): boolean => blockedAt(p, others, bounds, marginPx).depth > 0;

  if (!blocked(to)) return to;

  if (blocked(from)) {
    // 이미 겹친 상태 — 탈출(깊이 감소)만 허용. 깊어지는 이동은 거부한다.
    const depthTo = blockedAt(to, others, bounds, marginPx).depth;
    const depthFrom = blockedAt(from, others, bounds, marginPx).depth;
    return depthTo <= depthFrom ? to : from;
  }

  // 6회 이분탐색으로 from(안전)→to(막힘) 경계를 찾는다.
  let lo = 0;
  let hi = 1;
  for (let k = 0; k < iters; k++) {
    const mid = (lo + hi) / 2;
    if (blocked(lerpPose(from, to, mid))) hi = mid;
    else lo = mid;
  }
  const stopped = lerpPose(from, to, lo);

  // 접선 슬라이드 — 막힌 축의 법선 성분만 제거해 나머지 이동(병진)은 허용한다.
  // 이게 없으면 이웃을 스쳐 지나가는 드래그가 진행률 2.3 %로 고착된다(실측, §5.6).
  const rest = { x: to.x - stopped.x, y: to.y - stopped.y };
  const n = blockedAt(to, others, bounds, marginPx).axis;
  if (!n) return stopped;
  const nd = rest.x * n.x + rest.y * n.y;
  const t = { x: rest.x - nd * n.x, y: rest.y - nd * n.y };
  const cand: ChairPose = { x: stopped.x + t.x, y: stopped.y + t.y, theta: to.theta };
  if (!blocked(cand)) return cand;

  let lo2 = 0;
  let hi2 = 1;
  for (let k = 0; k < iters; k++) {
    const mid = (lo2 + hi2) / 2;
    if (blocked(lerpPose(stopped, cand, mid))) hi2 = mid;
    else lo2 = mid;
  }
  return lerpPose(stopped, cand, lo2);
}

/** 점(원)과 회전 사각형의 관통 깊이·법선. 원 중심이 사각형 내부면 4면 중 가장 가까운 쪽으로,
 *  외부면 가장 가까운 점 방향으로 판정한다. */
function circleObbPush(
  p: Vec2,
  r: number,
  pose: ChairPose,
): { depth: number; normal: Vec2 } | null {
  const [u, v] = chairAxes(pose.theta);
  const relX = p.x - pose.x;
  const relY = p.y - pose.y;
  const lx = relX * u.x + relY * u.y;
  const ly = relX * v.x + relY * v.y;
  const cx = Math.min(Math.max(lx, REAR), FRONT);
  const cy = Math.min(Math.max(ly, -HALF_W), HALF_W);
  const inside = lx > REAR && lx < FRONT && ly > -HALF_W && ly < HALF_W;

  let nx: number;
  let ny: number;
  let dist: number;
  if (inside) {
    const dRight = FRONT - lx;
    const dLeft = lx - REAR;
    const dTop = HALF_W - ly;
    const dBottom = ly + HALF_W;
    const m = Math.min(dRight, dLeft, dTop, dBottom);
    if (m === dRight) {
      nx = 1;
      ny = 0;
    } else if (m === dLeft) {
      nx = -1;
      ny = 0;
    } else if (m === dTop) {
      nx = 0;
      ny = 1;
    } else {
      nx = 0;
      ny = -1;
    }
    dist = -m;
  } else {
    const dx = lx - cx;
    const dy = ly - cy;
    dist = Math.hypot(dx, dy);
    if (dist < 1e-9) {
      nx = 1;
      ny = 0;
    } else {
      nx = dx / dist;
      ny = dy / dist;
    }
  }
  const depth = r - dist;
  if (depth <= 0) return null;
  const worldN: Vec2 = { x: nx * u.x + ny * v.x, y: nx * u.y + ny * v.y };
  return { depth, normal: worldN };
}

export function clampPointToBounds(p: Vec2, r: number, b: Bounds): Vec2 {
  return {
    x: Math.min(Math.max(p.x, r), b.w - r),
    y: Math.min(Math.max(p.y, r), b.h - r),
  };
}

const ESCAPE_SLOP_PX = 0.01;
const ESCAPE_PASSES = 8;
// 압착 축 수직 방향(통로를 따라) 탐색 범위·정밀도. hullRadiusPx*2 는 어떤 두 장애물 사이든
// 휠체어 하나의 전체 길이(REAR..FRONT)를 벗어나기에 충분한 여유다(실측 근거는 fix 참고).
const ESCAPE_SEARCH_MAX_PX = CHAIR.hullRadiusPx * 2 + 8;
const ESCAPE_SEARCH_STEPS = 64;
const ESCAPE_SEARCH_REFINE_ITERS = 30;
// 두 법선의 내적이 이보다 작으면(즉 충분히 반대 방향이면) "압착"으로 간주한다.
const SQUEEZE_DOT_THRESHOLD = -0.3;

interface Push {
  depth: number;
  normal: Vec2;
}

/** escapePinned 이 다루는 장애물 하나(휠체어 OBB 또는 벽 한 면)를 균일하게 표현한다.
 *  hitAt 은 같은 장애물을 다른 위치에서 재평가할 수 있게 한다 — 압착 탐색이 "이 장애물이
 *  더 이상 막지 않는 지점"을 찾을 때 필요하다. */
interface Obstacle {
  hitAt(q: Vec2, r: number): Push | null;
}

function wallHitAt(q: Vec2, r: number, b: Bounds): Push | null {
  // 4면을 한 함수로 — 여러 면에 동시에 걸치면 가장 깊은 침투만 보고한다(코너 대응).
  const violations: Push[] = [];
  if (q.x < r) violations.push({ depth: r - q.x, normal: { x: 1, y: 0 } });
  if (q.x > b.w - r) violations.push({ depth: q.x - (b.w - r), normal: { x: -1, y: 0 } });
  if (q.y < r) violations.push({ depth: r - q.y, normal: { x: 0, y: 1 } });
  if (q.y > b.h - r) violations.push({ depth: q.y - (b.h - r), normal: { x: 0, y: -1 } });
  if (violations.length === 0) return null;
  let worst = violations[0]!;
  for (const v of violations) if (v.depth > worst.depth) worst = v;
  return worst;
}

function buildObstacles(chairs: readonly ChairPose[], bounds: Bounds): Obstacle[] {
  const obstacles: Obstacle[] = chairs.map((chair) => ({
    hitAt: (q, r) => circleObbPush(q, r, chair),
  }));
  obstacles.push({ hitAt: (q, r) => wallHitAt(q, r, bounds) });
  return obstacles;
}

interface ActiveHit extends Push {
  obstacle: Obstacle;
}

function activeHits(p: Vec2, r: number, obstacles: readonly Obstacle[]): ActiveHit[] {
  const hits: ActiveHit[] = [];
  for (const obstacle of obstacles) {
    const hit = obstacle.hitAt(p, r);
    if (hit) hits.push({ ...hit, obstacle });
  }
  return hits;
}

/** 서로 가장 반대 방향인(내적이 가장 음수인) 두 히트를 압착 쌍으로 고른다. 명확히 반대가
 *  아니면(SQUEEZE_DOT_THRESHOLD 미만이 없으면) null — 압착이 아니라 그냥 겹침이다. */
function findSqueezePair(hits: readonly ActiveHit[]): [ActiveHit, ActiveHit] | null {
  let bestDot = SQUEEZE_DOT_THRESHOLD;
  let pair: [ActiveHit, ActiveHit] | null = null;
  for (let i = 0; i < hits.length; i++) {
    for (let j = i + 1; j < hits.length; j++) {
      const dot = hits[i]!.normal.x * hits[j]!.normal.x + hits[i]!.normal.y * hits[j]!.normal.y;
      if (dot < bestDot) {
        bestDot = dot;
        pair = [hits[i]!, hits[j]!];
      }
    }
  }
  return pair;
}

/** 압착 쌍 중 하나라도 더 이상 막지 않는 지점인지(=압착이 풀렸는지) 확인한다. 나머지 잔여
 *  겹침(있다면)은 이후 패스의 단일 장애물 밀기가 안전하게(반대편 저항 없이) 처리한다. */
const pairBroken = (q: Vec2, r: number, pair: readonly [ActiveHit, ActiveHit]): boolean =>
  pair[0].obstacle.hitAt(q, r) === null || pair[1].obstacle.hitAt(q, r) === null;

/** 압착 축(pair[0].normal) 의 수직 방향(통로를 따라)으로 선형 탐색 + 이분정밀화해 탈출점을
 *  찾는다. 양쪽 방향을 모두 시도하고, 탐색 범위 안에서 찾지 못하면 null(호출자가 폴백). */
function searchTangentEscape(
  p: Vec2,
  r: number,
  pair: readonly [ActiveHit, ActiveHit],
): Vec2 | null {
  const axis = pair[0].normal;
  const t: Vec2 = { x: -axis.y, y: axis.x };
  for (const sign of [1, -1] as const) {
    const dir: Vec2 = { x: t.x * sign, y: t.y * sign };
    let lo = 0;
    let hi = -1;
    for (let i = 1; i <= ESCAPE_SEARCH_STEPS; i++) {
      const dist = (ESCAPE_SEARCH_MAX_PX * i) / ESCAPE_SEARCH_STEPS;
      const cand: Vec2 = { x: p.x + dir.x * dist, y: p.y + dir.y * dist };
      if (pairBroken(cand, r, pair)) {
        hi = dist;
        break;
      }
      lo = dist;
    }
    if (hi < 0) continue; // 이 방향으로는 탐색 범위 안에서 못 찾음 — 반대 방향 시도
    let loD = lo;
    let hiD = hi;
    for (let k = 0; k < ESCAPE_SEARCH_REFINE_ITERS; k++) {
      const mid = (loD + hiD) / 2;
      const cand: Vec2 = { x: p.x + dir.x * mid, y: p.y + dir.y * mid };
      if (pairBroken(cand, r, pair)) hiD = mid;
      else loD = mid;
    }
    return { x: p.x + dir.x * hiD, y: p.y + dir.y * hiD };
  }
  return null;
}

/** 최종 안전망: 두 휠체어(또는 휠체어·벽) 사이에 낀 점을 빼낸다. Resolver.solvePosition 은
 *  양쪽 static 에서 반대 임펄스를 받아 상쇄되므로 스스로 못 빠져나온다(§5.6).
 *
 *  압착(두 장애물이 반대 방향으로 동시에 침투) 이 감지되면 표면 법선(=압착 축) 이 아니라
 *  그 **수직** 방향(통로를 따라)으로 탐색해 빠져나간다 — 법선 방향 push 는 두 장애물 사이를
 *  영원히 왕복할 뿐 원리적으로 탈출할 수 없다(실측: 4패스든 50패스든 고정점에 멈춤).
 *  벽도 다른 장애물과 동일한 hitAt 계약으로 취급해 같은 해결기 안에서 함께 푼다 — push 뒤에
 *  별도 clampPointToBounds 를 걸면 서로 되돌리는 왕복이 생긴다(실측 D4). */
export function escapePinned(
  p: Vec2,
  r: number,
  chairs: readonly ChairPose[],
  bounds: Bounds,
): Vec2 {
  const obstacles = buildObstacles(chairs, bounds);
  let out: Vec2 = { x: p.x, y: p.y };
  for (let pass = 0; pass < ESCAPE_PASSES; pass++) {
    const hits = activeHits(out, r, obstacles);
    if (hits.length === 0) break;

    const pair = findSqueezePair(hits);
    if (pair) {
      const escaped = searchTangentEscape(out, r, pair);
      if (escaped) {
        out = escaped;
        continue;
      }
      // 탐색 범위 안에서 못 찾음(극단적으로 긴 통로) — 아래 단일-장애물 밀기로 폴백.
    }

    let worst = hits[0]!;
    for (const h of hits) if (h.depth > worst.depth) worst = h;
    out = {
      x: out.x + worst.normal.x * (worst.depth + ESCAPE_SLOP_PX),
      y: out.y + worst.normal.y * (worst.depth + ESCAPE_SLOP_PX),
    };
  }
  return out;
}

// 기하 분리 폴백의 패스 수. 칩이 셋 이상 얽히면 한 쌍을 떼면서 다른 쌍이 생기므로 한 패스로는
// 부족하고, 해가 없는 배치에서는 몇 패스를 돌든 남는다 — 4 는 "될 배치는 되고, 안 될 배치에
// 시간을 안 쓰는" 절충이다(이 함수는 상한에 닿았을 때 딱 한 번 불린다).
const SEPARATE_PASSES = 4;

/** pose 를 dir(단위벡터) 방향으로 **판 안에 머무는 한** 최대 dist 만큼 옮기고 실제로 옮긴
 *  거리를 돌려준다. 이미 판 밖이면 0 을 돌려준다 — 그건 아래 되밀기 단계가 따로 처리한다. */
function shiftWithin(p: ChairPose, dir: Vec2, dist: number, b: Bounds): number {
  const corners = chairHullCorners(p);
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const c of corners) {
    if (c.x < minX) minX = c.x;
    if (c.x > maxX) maxX = c.x;
    if (c.y < minY) minY = c.y;
    if (c.y > maxY) maxY = c.y;
  }
  let t = dist;
  if (dir.x < 0) t = Math.min(t, minX / -dir.x);
  else if (dir.x > 0) t = Math.min(t, (b.w - maxX) / dir.x);
  if (dir.y < 0) t = Math.min(t, minY / -dir.y);
  else if (dir.y > 0) t = Math.min(t, (b.h - maxY) / dir.y);
  if (!(t > 0)) return 0;
  p.x += dir.x * t;
  p.y += dir.y * t;
  return t;
}

/** 겹친 휠체어들을 **기하로** 떼어 놓는다(§4.2 P0-1 자가 분리의 폴백).
 *
 *  정상 경로는 matter 의 위치 해결이다. 이 함수는 상한(PHYS.settleMaxMs) 안에 물리가 겹침을
 *  못 푼 경우에만 **한 번** 불린다 — 칩 두 대가 들어갈 자리가 없는 판처럼 해가 아예 없는
 *  배치에서 루프가 영원히 돌지 않게 하는 안전망이다.
 *
 *  각 쌍을 최소침투벡터(MTV) 방향으로 **절반씩 양쪽으로** 민다. 한쪽만 밀려면 "누가 침범했나"
 *  를 알아야 하는데 여기까지 온 시점에는 속도가 이미 0 이라 알 방법이 없다. 다만 벽에 붙어
 *  물러설 자리가 없는 칩의 몫은 **상대에게 넘긴다** — 반씩 나눠 놓고 한쪽이 벽에 막히면 그
 *  절반이 통째로 버려져, P0-1 의 실제 배치(벽에 붙은 칩 위에 얹힌 칩)에서 겹침이 남는다.
 *
 *  각도는 건드리지 않는다. 회전 관성이 무한이라 물리도 칩을 돌리지 않고(§5.3), 사용자가 놓은
 *  방향을 안전망이 바꾸는 것은 "겹침을 푼다" 의 범위를 넘는다.
 *
 *  ⚠️ **최선을 다한 1회이지 보장이 아니다.** 해가 없는 배치에서는 겹침이 남는다. */
export function separateOverlaps(poses: readonly ChairPose[], bounds: Bounds): ChairPose[] {
  const out: ChairPose[] = poses.map((p) => ({ ...p }));
  for (let pass = 0; pass < SEPARATE_PASSES; pass++) {
    let moved = false;
    for (let i = 0; i < out.length; i++) {
      for (let j = i + 1; j < out.length; j++) {
        const a = out[i]!;
        const b = out[j]!;
        const r = satOverlap(a, b, 0);
        if (r.depth <= OVERLAP_EPS_PX || !r.axis) continue;
        // axis 는 satBetween 이 A→B 방향으로 정렬해 둔다. 딱 붙은 채로 끝나지 않게 슬롭을 얹는다.
        const need = r.depth + ESCAPE_SLOP_PX;
        const back: Vec2 = { x: -r.axis.x, y: -r.axis.y };
        const doneA = shiftWithin(a, back, need / 2, bounds);
        const doneB = shiftWithin(b, r.axis, need - doneA, bounds);
        if (doneA + doneB < need) shiftWithin(a, back, need - doneA - doneB, bounds);
        moved = true;
      }
    }
    // 들어올 때 이미 판 밖이던 칩(물리가 벽 너머로 밀어낸 경우)을 되민다. 안 하면 이 안전망이
    // P0-3(코트 밖 고착)을 그대로 남긴다.
    for (const p of out) {
      const v = outOfBounds(p, bounds);
      if (v.depth <= 0 || !v.axis) continue;
      // axis 는 바깥을 향한다 — 그만큼 되돌리면 hull 이 정확히 경계에 닿는다.
      p.x -= v.axis.x * v.depth;
      p.y -= v.axis.y * v.depth;
      moved = true;
    }
    if (!moved) break;
  }
  return out;
}
