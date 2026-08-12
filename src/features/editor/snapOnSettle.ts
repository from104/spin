// §4.3 P1-3 — **정착 스냅**. 물리가 다 선 뒤(§4.2 P0-2 정착 재커밋) 마지막에 한 번, 놓인
// 개체를 가까운 기준점에 붙인다. *'대충 놓아도 제자리에 딱 붙는다'* 가 발 마우스·입 젓가락
// 사용자에게 정밀 조준을 면제해 주는 유일한 장치다.
//
// ⚠️ 두 가지가 이 파일의 존재 이유이자 제약이다.
//  (1) **드래그 중에는 절대 부르지 않는다.** 체이스(§5.11)와 속도 제한 위에 스냅을 얹으면
//      따라오던 칩이 갑자기 튄다 — 스냅은 손이 떠난 뒤에만 일어나야 조용하다.
//  (2) **커밋 시점이 아니라 정착 시점이다**(A-6/E-1). 손을 뗀 순간에 걸면 뒤이은 정착
//      재커밋이 물리 좌표로 덮어써서 스냅이 통째로 무효화된다.
//
// 순수 함수다 — 물리도 리듀서도 모른다. 좌표는 전부 court.ts/grid.ts 에서 파생한다(리터럴
// 금지: 마진을 1.5 m 로 넓혔을 때 리터럴이 옛 자리에 남아 실제로 사고가 났다).
import type { Vec2 } from '../../core/units.ts';
import { INTERACT } from '../../core/constants.ts';
import type { CourtMode } from '../../model/court.ts';
import { COURT_DEFS } from '../../model/court.ts';
import { gridGeom } from '../../model/grid.ts';

/** 어디에 붙었는가. null 이면 문턱 안에 아무것도 없어 좌표를 그대로 둔 것이다. */
export type SnapTarget = 'spot' | 'slot' | 'grid' | 'line' | 'align';

/** Vec2 를 그대로 만족한다 — 호출자가 `{x,y}` 로 바로 쓸 수 있다. */
export interface SnapResult extends Vec2 {
  target: SnapTarget | null;
}

export interface SnapContext {
  mode: CourtMode;
  /** 화면 배율(CSS px per 월드 px). 6 CSS px 문턱을 월드 거리로 환산하는 데 쓴다. */
  pxPerUnit: number;
  /** ③ 축 정렬 후보가 되는 **이웃** 좌표. 자기 자신은 빼고 넣는다(자기 축에 붙는 것은 항등). */
  neighbors: readonly Vec2[];
  /** ④ 기본 포메이션 슬롯 좌표(그 코트·그 포메이션의 기본 배치). */
  slots: readonly Vec2[];
}

/** 코트별로 한 번만 계산하는 정적 후보. gridGeom 과 같은 모듈 레벨 캐시 관용구다(§6.4). */
interface CourtAnchors {
  /** ⑤ 세트피스 지점 — 골 십자·골포스트·코너컷 끝점. */
  spots: Vec2[];
  /** ① 격자선. 교차점은 (가장 가까운 vx, 가장 가까운 hy) 로 그때 만든다 — 후보를 전개하면
   *  flat 코트에서 418 점이 되는데, 축이 직교라 스캔 두 번이면 같은 답이 나온다. */
  gridX: readonly number[];
  gridY: readonly number[];
  /** ② 코트 라인·골 지역 경계 — 세로선(x)·가로선(y)으로 나눠 둔다. */
  lineX: number[];
  lineY: number[];
}

/** `'M37.5,62.5 L62.5,37.5'` 같은 코너컷 path 에서 끝점을 뽑는다. 좌표를 이 파일에 다시
 *  적지 않기 위한 파서다 — court.ts 가 유일한 출처여야 한다. */
function pathPoints(d: string): Vec2[] {
  const nums = d.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  const out: Vec2[] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) out.push({ x: nums[i]!, y: nums[i + 1]! });
  return out;
}

function computeAnchors(mode: CourtMode): CourtAnchors {
  const def = COURT_DEFS[mode];
  const g = gridGeom(mode);
  const spots: Vec2[] = [...def.spotMarks, ...def.goalPosts];
  for (const d of def.cornerCuts) spots.push(...pathPoints(d));

  const S = def.surface;
  const lineX = [S.x, S.x + S.w];
  const lineY = [S.y, S.y + S.h];
  // 하프라인 — full 은 세로 중앙선, half 는 경기면 위 변이라 이미 위에 들어 있다.
  if (mode === 'full') lineX.push(S.x + S.w / 2);
  for (const z of def.ruleZones) {
    lineX.push(z.x, z.x + z.w);
    lineY.push(z.y, z.y + z.h);
  }
  return { spots, gridX: g.vx, gridY: g.hy, lineX, lineY };
}

const anchorCache = new Map<CourtMode, CourtAnchors>();
function anchorsOf(mode: CourtMode): CourtAnchors {
  let a = anchorCache.get(mode);
  if (!a) {
    a = computeAnchors(mode);
    anchorCache.set(mode, a);
  }
  return a;
}

/** 값 배열에서 v 에 가장 가까운 것과 그 거리. 배열이 비면 null. */
function nearestOf(values: readonly number[], v: number): { at: number; d: number } | null {
  let best: { at: number; d: number } | null = null;
  for (const x of values) {
    const d = Math.abs(x - v);
    if (best === null || d < best.d) best = { at: x, d };
  }
  return best;
}

/**
 * 정착 좌표 `p` 를 가장 가까운 기준에 붙인다. 문턱은 화면 기준 `INTERACT.settleSnapCssPx`(6 CSS px).
 *
 * 판정 순서(둘로 나뉘는 것이 이 함수의 전부다):
 *  · **점 후보 먼저** — 세트피스 ⑤ → 포메이션 슬롯 ④ → 격자 교차점 ① 순으로 가장 가까운
 *    하나를 고르고, 문턱 안이면 **두 축 모두** 그 점으로 간다.
 *  · 점이 하나도 문턱 안에 없을 때만 **축 후보** — 코트 라인·골 지역 경계 ②, 이웃 축 정렬 ③.
 *    이쪽은 x·y 를 **따로** 본다(한 축만 걸리는 것이 정상이다).
 *
 * 점을 먼저 보는 이유: 점까지의 거리는 두 축 거리의 빗변이라 언제나 축 거리보다 크거나 같다.
 * 한 줄로 비교하면 격자 교차점은 그 교차점을 이루는 격자선·코트 라인에 **영원히 진다** —
 * ①·④·⑤ 가 후보 목록에 있는 의미가 사라진다.
 */
export function snapOnSettle(p: Vec2, ctx: SnapContext): SnapResult {
  // pxPerUnit 이 0 이거나 음수면(레이아웃 전 jsdom 등) 문턱이 무한대가 되어 판 전체가 한 점에
  // 빨려 들어간다 — 그럴 땐 스냅하지 않는다.
  if (!(ctx.pxPerUnit > 0)) return { x: p.x, y: p.y, target: null };
  const t = INTERACT.settleSnapCssPx / ctx.pxPerUnit;
  const a = anchorsOf(ctx.mode);

  // ── 점 후보 ────────────────────────────────────────────────────────────────────
  // 같은 거리면 먼저 담긴 쪽이 이긴다 — 구체적인 것(세트피스)부터 담는다.
  const points: Array<{ p: Vec2; target: SnapTarget }> = [];
  for (const s of a.spots) points.push({ p: s, target: 'spot' });
  for (const s of ctx.slots) points.push({ p: s, target: 'slot' });
  const gx = nearestOf(a.gridX, p.x);
  const gy = nearestOf(a.gridY, p.y);
  if (gx && gy) points.push({ p: { x: gx.at, y: gy.at }, target: 'grid' });

  let bestPoint: { p: Vec2; d: number; target: SnapTarget } | null = null;
  for (const c of points) {
    const d = Math.hypot(c.p.x - p.x, c.p.y - p.y);
    if (d <= t && (bestPoint === null || d < bestPoint.d)) bestPoint = { p: c.p, d, target: c.target };
  }
  if (bestPoint) return { x: bestPoint.p.x, y: bestPoint.p.y, target: bestPoint.target };

  // ── 축 후보 ────────────────────────────────────────────────────────────────────
  // 축은 x·y 를 따로 본다. 둘 다 걸리면 둘 다 붙는다(코트 라인 x + 이웃 y 같은 조합).
  const nx: number[] = [];
  const ny: number[] = [];
  for (const n of ctx.neighbors) {
    nx.push(n.x);
    ny.push(n.y);
  }
  const axis = (lines: readonly number[], neighbors: readonly number[], v: number): { at: number; target: SnapTarget } | null => {
    const line = nearestOf(lines, v);
    const near = nearestOf(neighbors, v);
    let best: { at: number; d: number; target: SnapTarget } | null = null;
    if (line && line.d <= t) best = { ...line, target: 'line' };
    if (near && near.d <= t && (best === null || near.d < best.d)) best = { ...near, target: 'align' };
    return best;
  };
  const sx = axis(a.lineX, nx, p.x);
  const sy = axis(a.lineY, ny, p.y);
  if (!sx && !sy) return { x: p.x, y: p.y, target: null };
  // 두 축이 서로 다른 종류에 걸리면 더 구체적인 쪽(코트 라인)을 대표로 보고한다.
  const target: SnapTarget = sx?.target === 'line' || sy?.target === 'line' ? 'line' : 'align';
  return { x: sx?.at ?? p.x, y: sy?.at ?? p.y, target };
}
