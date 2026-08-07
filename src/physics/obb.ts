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

export function chairsOverlap(a: ChairPose, b: ChairPose, marginPx: number): boolean {
  return satOverlap(a, b, marginPx).depth > 0;
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
const ESCAPE_PASSES = 4;

/** 최종 안전망: 두 휠체어(또는 휠체어·벽) 사이에 낀 점을 압착 축 수직 방향으로 밀어낸다.
 *  Resolver.solvePosition 은 양쪽 static 에서 반대 임펄스를 받아 상쇄되므로 스스로 못 빠져나온다
 *  (§5.6). 여러 장애물에 동시에 눌린 경우를 위해 몇 패스 반복한다. */
export function escapePinned(
  p: Vec2,
  r: number,
  chairs: readonly ChairPose[],
  bounds: Bounds,
): Vec2 {
  let out: Vec2 = { x: p.x, y: p.y };
  for (let pass = 0; pass < ESCAPE_PASSES; pass++) {
    let moved = false;
    for (const chair of chairs) {
      const hit = circleObbPush(out, r, chair);
      if (hit) {
        out = {
          x: out.x + hit.normal.x * (hit.depth + ESCAPE_SLOP_PX),
          y: out.y + hit.normal.y * (hit.depth + ESCAPE_SLOP_PX),
        };
        moved = true;
      }
    }
    const clamped = clampPointToBounds(out, r, bounds);
    if (clamped.x !== out.x || clamped.y !== out.y) moved = true;
    out = clamped;
    if (!moved) break;
  }
  return out;
}
