// 포인터 → 대상/존 판정, 존 핸들 배치. §5.12.
import type { Vec2 } from '../core/units.ts';
import { CHAIR, BALL, CONE, NOTE, INTERACT } from '../core/constants.ts';
import type { ChairId, BallId, ConeId, NoteId, ArrowId } from '../core/ids.ts';
import type { ChairPose, DragZone, ZoneConfig } from '../model/chair.ts';
import { chairCorners, projectGrab, pointAtLever } from '../model/chair.ts';
import type { ArrowKind } from '../model/arrow.ts';
import { ARROW_STYLES } from '../model/arrow.ts';

/** §6.10 편집기 도구 8종의 key. 원 소유자는 store/screen-editor(Wave 3/4)지만, hitTest 의
 *  `HitContext` 시그니처가 §5.12 계약에 `tool: ToolId` 로 이미 못박혀 있고 physics-world 는
 *  Wave 2 라 그 모듈들이 아직 없다. 의존 그래프(§9)상 store 가 physics-world 를 의존하므로
 *  여기서 정의해 두면 store 가 그대로 import 해 쓸 수 있다(반대 방향 의존은 없다). */
// 2026-08-14 — 작도 도형 3종이 늘었다. 도구 id 는 물리(hitTest)가 소유하지만 도형 자체는
// 물리 바디가 아니다: 휠체어를 막지도, 공을 튕기지도 않는 **표시**다. 그래서 이 목록에만 있고
// 아래 히트테스트에는 도형 분기가 없다 — 도형의 히트 판정은 SVG 이벤트가 직접 한다.
export type ToolId =
  | 'select'
  | 'route'
  | 'pass'
  | 'ball'
  | 'cone'
  | 'player'
  | 'note'
  | 'erase'
  | 'shapeEllipse'
  | 'shapeTriangle'
  | 'shapeRect';

/** §5.12/§6.5 가 참조하는 히트 반경 상한. 값의 출처는 §6.5(render-stage 소유 `hitRadius.ts`)지만
 *  그 파일은 별도 Wave(3)의 별도 모듈 소유라 physics-world 가 import 할 수 없다(의존 방향 위반).
 *  숫자 자체는 계약값이므로 여기 독립적으로 복제해 둔다 — 값을 바꿀 땐 §6.5 도 함께 바꿔야 한다.
 *
 *  ⚠️ 이 상한은 **1차(엄격) 패스에만** 걸린다. 2차 패스에 걸면 저배율에서 두 패스의 반경이
 *  똑같아져(예: 공, s=0.663 에서 둘 다 11.25) 2단 히트가 통째로 무의미해진다 — 관대한 패스가
 *  가장 필요한 배율이 하필 상한이 물리는 배율이다.
 *
 *  note 22: 메모는 휠체어(21.25)와 자리를 다투지 않으므로(§4.3 P1-2) 상한을 12.5 에서 올려
 *  저배율의 잘림을 없앴다. 값 22 는 `NOTE.ringRadiusPx`(선택 링 반지름)와 **같아야 한다** —
 *  §4.3 P1-5 로 메모가 실제로 그려지는 쪽지 칩이 되면서, 상한이 링보다 작으면 "링 안을
 *  눌렀는데 안 잡힌다" 가 되기 때문이다. 칩 외접원(NOTE.hitRadiusPx = 20)보다 크므로
 *  어떤 배율에서도 상한이 칩 **안쪽**을 자르지 않는다. */
const HIT_R_MAX_PX = { chair: 21.25, ball: 11.25, cone: 8.75, note: 22 } as const;

export interface HitResult {
  kind: 'chair' | 'ball' | 'cone' | 'note' | 'arrow' | 'arrowHandle' | 'zoneHandle';
  id: string;
  s?: number; // chair 직접 드래그: 축 방향 정규 위치
  zone?: DragZone; // zoneHandle
  which?: 'from' | 'ctrl' | 'to'; // arrowHandle
}

export interface HitContext {
  zones: ZoneConfig;
  pxPerUnit: number;
  pointerType: string;
  selectedChairId: ChairId | null;
  selectedArrowId: ArrowId | null;
  handlesVisible: boolean;
  tool: ToolId;
  /** §7.3 히트 타깃(CSS px). 기본 `INTERACT.hitTargetCssPx`(44), "큰 터치 타깃" 설정에서 56.
   *  **2차 패스 반경에만** 쓴다 — 1차 패스는 지금까지와 한 픽셀도 달라지지 않는다.
   *  선택 사항인 이유: 히트 결과가 이 값에 좌우되는 건 2차 패스뿐이라, 값을 모르는 호출부는
   *  기본 44 로 두면 예전과 같은 판정을 받는다(테스트 픽스처도 그대로 쓸 수 있다). */
  hitCssPx?: number;
}

/** hitTest 가 필요로 하는 장면의 최소 스냅샷. 물리 world 의 현재 포즈(휠체어)와 공/콘 좌표,
 *  그리고 model 이 담고 있는 메모·화살표를 한 프레임 분 그러모은 것 — 이 타입도 model 이 아니라
 *  physics-world 가 정의한다(model 은 순수 데이터 스키마만 소유하고, "이번 프레임에 무엇이
 *  어디 있는지"를 조립하는 건 물리/렌더 경계의 일이라 §8 어디에도 소유자가 없다). */
export interface SceneSnapshot {
  chairs: ReadonlyArray<{ id: ChairId; pose: ChairPose }>;
  balls: ReadonlyArray<{ id: BallId; p: Vec2 }>;
  cones: ReadonlyArray<{ id: ConeId; p: Vec2 }>;
  notes: ReadonlyArray<{ id: NoteId; p: Vec2 }>;
  arrows: ReadonlyArray<{ id: ArrowId; kind: ArrowKind; from: Vec2; ctrl: Vec2; to: Vec2 }>;
}

export function zoneHandles(
  pose: ChairPose,
  pxPerUnit: number,
): Array<{ zone: DragZone; lever: number; pos: Vec2; hitR: number; viewR: number }> {
  const zones: DragZone[] = ['towRear', 'translate', 'spin', 'towFront'];
  return zones.map((zone) => {
    const lever = INTERACT.handleLeverPx[zone];
    return {
      zone,
      lever,
      pos: pointAtLever(pose, lever),
      hitR: INTERACT.handleHitRadiusCssPx / pxPerUnit,
      viewR: INTERACT.handleViewRadiusCssPx / pxPerUnit,
    };
  });
}

/** 2존 모드(= 핸들 전용 조작)가 걸려 있는가. §5.12 계약의 그 함수이고, 5.5 이전까지
 *  **소비처가 0** 이던 죽은 배선이다(2026-08-13 rg 실측: 정의 1 + re-export 1 + 호출 1,
 *  그 호출의 결과를 읽는 곳 0).
 *
 *  ⚠️ 2026-08-13(5.5, 결정 ④) **자동 배율 문턱을 뗐다.** 예전 식은
 *  `forced || (pointerType === 'touch' && pxPerUnit < INTERACT.zoneDirectMinPxPerUnit)` 였고
 *  그 상수는 1.28 이다. 되살리면 안 되는 이유는 둘이다.
 *   ① 실측 배율 분포(7인치 0.663 · narrow 0.891 · PC 핀 0.899 · PC 오버레이 1.151 ·
 *      27인치 1.675)가 문턱 1.28 을 여러 번 넘나든다 — 그대로 두면 **줌이 조작 규칙을
 *      바꾸는 사고**가 된다(§9-④).
 *   ② 7인치 태블릿은 0.663 이라 문턱이 **늘** 참이다. 즉 자동 분기를 남기면 결정 ④ 의
 *      *"2존 기본 OFF"* 가 하필 이 앱의 1순위 기기에서만 거짓말이 된다.
 *
 *  두 인자를 지우지 않고 남긴 이유: 이 함수의 계약(§5.12)과 호출부를 그대로 두면서,
 *  *"배율과 포인터 종류를 무엇으로 넣어도 답이 안 바뀐다"* 를 **단언 가능한 성질**로 만들기
 *  위해서다. `src/physics/twoZone.test.ts` 의 그 매트릭스가 자동 문턱의 부활을 막는 자물쇠다 —
 *  지우면 다음 사람이 ①②를 모른 채 한 줄로 되돌려 놓는다. */
export const handlesVisible = (_pxPerUnit: number, _pointerType: string, forced: boolean): boolean => forced;

const dist = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y);

/** 픽 반지름(자기 반지름 + CSS px 패드를 월드 단위로 환산, §6.5 상한으로 캡). */
function pickRadius(ownRadiusPx: number, cap: number, pxPerUnit: number): number {
  return Math.min(ownRadiusPx + INTERACT.pickPadCssPx / pxPerUnit, cap);
}

/** 볼록사각형(순서 있는 4점) 내부 판정 — 부호 있는 외적이 전부 같은 부호면 내부. */
function pointInConvexQuad(p: Vec2, quad: readonly Vec2[]): boolean {
  let sign = 0;
  for (let i = 0; i < quad.length; i++) {
    const a = quad[i]!;
    const b = quad[(i + 1) % quad.length]!;
    const cross = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
    if (cross !== 0) {
      const s = cross > 0 ? 1 : -1;
      if (sign === 0) sign = s;
      else if (s !== sign) return false;
    }
  }
  return true;
}

function distPointToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const len2 = abx * abx + aby * aby;
  let t = len2 > 0 ? ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2 : 0;
  t = Math.min(1, Math.max(0, t));
  return Math.hypot(p.x - (a.x + abx * t), p.y - (a.y + aby * t));
}

function bezierPoint(from: Vec2, ctrl: Vec2, to: Vec2, t: number): Vec2 {
  const mt = 1 - t;
  return {
    x: mt * mt * from.x + 2 * mt * t * ctrl.x + t * t * to.x,
    y: mt * mt * from.y + 2 * mt * t * ctrl.y + t * t * to.y,
  };
}

/** 2차 베지에 곡선까지의 최단거리 근사(16 세그먼트 폴리라인 샘플링). 화살표 stroke 히트에만 쓴다. */
function distPointToQuadBezier(p: Vec2, from: Vec2, ctrl: Vec2, to: Vec2): number {
  let min = Infinity;
  let prev = from;
  for (let i = 1; i <= 16; i++) {
    const cur = bezierPoint(from, ctrl, to, i / 16);
    const d = distPointToSegment(p, prev, cur);
    if (d < min) min = d;
    prev = cur;
  }
  return min;
}

/** §5.12 우선순위 5: 휠체어 hull + grabPadPx. body frame 축정렬 박스 확장(형상을 기하학적으로
 *  부풀리지 않고 body frame ax/lat 경계만 pad 만큼 넓힌다 — projectGrab 과 같은 좌표계라 값이
 *  일관된다). */
function chairPadHit(pose: ChairPose, p: Vec2, pad: number): { ax: number; lat: number; s: number } | null {
  const g = projectGrab(pose, p);
  const rear = -CHAIR.pivotToRearPx - pad;
  const front = CHAIR.pivotToFrontPx + pad;
  const halfW = CHAIR.widthPx / 2 + pad;
  if (g.ax < rear || g.ax > front) return null;
  if (Math.abs(g.lat) > halfW) return null;
  return g;
}

/** 한 패스가 쓰는 반경 묶음(전부 월드 px). **우선순위 표는 두 패스가 완전히 같고, 이 숫자만
 *  다르다** — 그게 2단 히트(§4.3 P1-2)의 전부다. */
interface PickRadii {
  ball: number;
  cone: number;
  note: number;
  /** 휠체어 hull 을 body frame 에서 넓히는 패드(우선순위 5) */
  chairPad: number;
  /** 화살표 핸들·존 핸들 반경(우선순위 3·4) */
  handle: number;
  /** 화살표 stroke 반두께에 더하는 여유(우선순위 6) */
  arrowPad: number;
}

/** 1차(엄격) 패스 — **지금까지의 유일한 패스이고, 한 픽셀도 바뀌지 않았다.** */
function strictRadii(ctx: HitContext): PickRadii {
  const s = ctx.pxPerUnit;
  return {
    ball: pickRadius(BALL.radiusPx, HIT_R_MAX_PX.ball, s),
    cone: pickRadius(CONE.radiusPx, HIT_R_MAX_PX.cone, s),
    // 메모의 자기 반지름은 0 이 아니다(§4.3 P1-5): 이제 32×24 쪽지 칩이 실제로 그려지고,
    // 그 칩의 외접원이 20 이다. 0 이면 s=1 에서 픽 원이 6 px — 칩 안을 눌러도 안 잡혔다.
    note: pickRadius(NOTE.hitRadiusPx, HIT_R_MAX_PX.note, s),
    chairPad: ctx.zones.grabPadPx,
    handle: INTERACT.handleHitRadiusCssPx / s,
    arrowPad: INTERACT.pickPadCssPx / s,
  };
}

/** 2차(관대) 패스의 월드 반경. **2차 패스를 돌지 않는 상황이면 null** 이다 — 곧 '호출 0회'.
 *
 *  [A-2] `tool === 'select'` 에서만 돈다. `eraseAt` 이 같은 hitTest 를 부르므로(§4.3 P1-2)
 *  무조건 돌리면 지우개가 **반경 22 CSS px 짜리 파괴 도구**가 된다 — 파괴적 동작에 수식키를
 *  요구하는 규칙(useEditorKeyboard.ts, WCAG 2.1.4)과 정면 충돌이다. 배치 도구도 같다:
 *  44 CSS px 안에 뭔가 있으면 콘을 나란히 못 놓게 된다.
 *
 *  [D-4] "큰 터치 타깃" 설정이 켜지면 호출부가 `hitCssPx = 56` 을 넣어 반경도 함께 커진다.
 *  그래야 그 설정 설명문이 코트 위에서도 사실이 된다.
 *
 *  배율이 0 이하면(무대 측정 전) 반경이 Infinity 가 되어 판 위 아무거나 잡힌다 — 그럴 바엔
 *  2차 패스를 걸지 않는다. */
export function forgivingRadius(ctx: HitContext): number | null {
  if (ctx.tool !== 'select') return null;
  if (!(ctx.pxPerUnit > 0)) return null;
  return (ctx.hitCssPx ?? INTERACT.hitTargetCssPx) / 2 / ctx.pxPerUnit;
}

/** §5.12 우선순위 표. 반경만 주입받는다(위 PickRadii 주석 참고). */
function scanPass(p: Vec2, scene: SceneSnapshot, ctx: HitContext, r: PickRadii): HitResult | null {
  const { pxPerUnit } = ctx;

  // 1) 공 / 콘 / 메모 — 자기 픽 반지름. 여러 후보 중 가장 가까운 것을 고른다.
  let best: { kind: 'ball' | 'cone' | 'note'; id: string; d: number } | null = null;
  for (const b of scene.balls) {
    const d = dist(p, b.p);
    if (d <= r.ball && (!best || d < best.d)) best = { kind: 'ball', id: b.id, d };
  }
  for (const c of scene.cones) {
    const d = dist(p, c.p);
    if (d <= r.cone && (!best || d < best.d)) best = { kind: 'cone', id: c.id, d };
  }
  for (const n of scene.notes) {
    const d = dist(p, n.p);
    if (d <= r.note && (!best || d < best.d)) best = { kind: 'note', id: n.id, d };
  }
  if (best) return { kind: best.kind, id: best.id };

  // 2) 어떤 휠체어든 정확한 OBB 본체(pad 없음). 반경과 무관하므로 2차 패스에서는 절대
  //    새로 걸리지 않는다 — 그래도 표를 통째로 유지해야 "같은 우선순위" 가 참이 된다.
  for (const c of scene.chairs) {
    if (pointInConvexQuad(p, chairCorners(c.pose))) return { kind: 'chair', id: c.id, s: projectGrab(c.pose, p).s };
  }

  // 3) 선택된 화살표의 핸들(from/ctrl/to).
  if (ctx.selectedArrowId) {
    const a = scene.arrows.find((x) => x.id === ctx.selectedArrowId);
    if (a) {
      const candidates: Array<{ which: 'from' | 'ctrl' | 'to'; pt: Vec2 }> = [
        { which: 'from', pt: a.from },
        { which: 'ctrl', pt: a.ctrl },
        { which: 'to', pt: a.to },
      ];
      let nearest: { which: 'from' | 'ctrl' | 'to'; d: number } | null = null;
      for (const c of candidates) {
        const d = dist(p, c.pt);
        if (d <= r.handle && (!nearest || d < nearest.d)) nearest = { which: c.which, d };
      }
      if (nearest) return { kind: 'arrowHandle', id: a.id, which: nearest.which };
    }
  }

  // 4) 선택된 휠체어의 존 핸들(표시 중일 때만, 최근접 1개).
  if (ctx.handlesVisible && ctx.selectedChairId) {
    const c = scene.chairs.find((x) => x.id === ctx.selectedChairId);
    if (c) {
      const handles = zoneHandles(c.pose, pxPerUnit);
      let nearest: { zone: DragZone; d: number } | null = null;
      for (const h of handles) {
        const d = dist(p, h.pos);
        if (d <= r.handle && (!nearest || d < nearest.d)) nearest = { zone: h.zone, d };
      }
      if (nearest) return { kind: 'zoneHandle', id: c.id, zone: nearest.zone };
    }
  }

  // 5) 휠체어 hull + 패드 — 후보가 여럿이면 |lat| 최소.
  let padBest: { id: string; s: number; lat: number } | null = null;
  for (const c of scene.chairs) {
    const g = chairPadHit(c.pose, p, r.chairPad);
    if (g && (!padBest || Math.abs(g.lat) < Math.abs(padBest.lat))) padBest = { id: c.id, s: g.s, lat: g.lat };
  }
  if (padBest) return { kind: 'chair', id: padBest.id, s: padBest.s };

  // 6) 화살표 stroke.
  let arrowBest: { id: string; d: number } | null = null;
  for (const a of scene.arrows) {
    const tol = ARROW_STYLES[a.kind].width / 2 + r.arrowPad;
    const d = distPointToQuadBezier(p, a.from, a.ctrl, a.to);
    if (d <= tol && (!arrowBest || d < arrowBest.d)) arrowBest = { id: a.id, d };
  }
  if (arrowBest) return { kind: 'arrow', id: arrowBest.id };

  return null;
}

/** §5.12 히트테스트 — **2단(엄격 → 관대)**, §4.3 P1-2.
 *
 *  1차는 예전 그대로다. 1차가 **아무것도 반환하지 않았을 때만** 같은 표를 화면 기준
 *  히트 타깃(기본 44 CSS px = 반경 22/s 월드)으로 한 번 더 훑는다. "빗나감 → 선택 해제" 가
 *  (select 도구에서) "빗나감 → 44 CSS px 안의 가장 앞선 후보" 로 바뀌는 것이 이 변화의 전부다.
 *
 *  §6.5 blocker 를 밟지 않는 근거: blocker 는 *"저배율에서 공 히트 원이 휠체어보다 커져
 *  볼 캐리어를 영영 못 잡는다"* 인데, 그 시나리오에서는 **1차가 이미 휠체어를 반환하므로
 *  2차가 실행되지 않는다**(hitTest.contract.test.ts 첫 it 이 그 근거를 붙잡고 있다). */
export function hitTest(p: Vec2, scene: SceneSnapshot, ctx: HitContext): HitResult | null {
  const strict = scanPass(p, scene, ctx, strictRadii(ctx));
  if (strict) return strict;

  const r = forgivingRadius(ctx);
  if (r === null) return null;
  return scanPass(p, scene, ctx, { ball: r, cone: r, note: r, chairPad: r, handle: r, arrowPad: r });
}
