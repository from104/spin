// 개체 겹침의 **문지기** — 월드 px AABB 하나로 "이 둘이 겹치는가" 만 답한다.
// 정본 계획서: `docs/PLAN-Z-ORDER.md` 결정 6 (§2 「겹침(B)」).
//
// ── 왜 AABB 인가 (결정 6) ────────────────────────────────────────────────────────────
// 표시순서 메뉴의 [한 단계 앞으로]는 *"내 위에 있으면서 나와 겹치는 가장 가까운 것"* 바로
// 위로 간다. 겹치는 것이 그 방향에 없으면 항목이 disabled 된다 — 즉 이 판정의 유일한 쓸모는
// **메뉴 항목을 켜고 끄는 것**이다. 그래서 정확한 기하(SAT·베지에 근사)가 아니라 문지기다:
//   · 오탐(안 겹치는데 겹친다) 의 대가 = 눌러도 화면이 안 바뀐다.
//   · 미탐(겹치는데 안 겹친다) 의 대가 = **가려진 개체를 영영 못 꺼낸다.**
// 뒤쪽이 훨씬 비싸므로 **오탐 쪽에 선다.** 경계가 정확히 맞닿는 경우도 겹침으로 친다.
//
// ── ⚠️ 치수는 가져다 쓴다. 복사 금지 ────────────────────────────────────────────────
// 이 파일에는 차체 크기·공 반지름·칩 폭 같은 숫자 리터럴이 **하나도 없다.** 전부 정본에서
// 온다: 휠체어 `model/chair.ts` 의 `chairCorners`(= `chairOverlap.ts`·`obb.ts` 의 hull 과 같은
// 사각형), 공·콘 `core/constants.ts` 의 `BALL.viewRadiusPx`·`CONE.viewWidthPx/viewHeightPx`,
// 메모 `render/objects/noteChip.ts`, 화살표 `model/arrow.ts` 의 `ARROW_STYLE.width`,
// 획 `model/stroke.ts` 의 `STROKE_WIDTHS`, 도형 `model/shape.ts` 의 `shapeSize`·`SHAPE_STROKE_PX`.
// 여기서 한 벌 더 적으면 "판에서는 겹쳐 보이는데 메뉴는 안 겹쳤다고 한다" 가 된다.
//
// ⚠️ **physics → render 의존이 하나 생긴다**(`noteChip.ts`). `hitTest.ts` 는 같은 상황에서
// 값을 복제했지만(그쪽 `HIT_R_MAX_PX` 주석), 그건 **숫자 상수 4개**였고 이쪽은 자동 줄바꿈·
// 줄 수 상한이 들어간 **함수 두 개**다 — 복제하면 그 알고리즘까지 두 벌이 되어 긴 메모에서
// 조용히 갈라진다. 이 모듈은 매 프레임 도는 물리 루프가 아니라 **메뉴를 열 때 한 번** 도는
// 편집기 경로이므로 계층을 한 칸 넘는 값이 복제보다 싸다.
//
// ── 알려진 근사 ─────────────────────────────────────────────────────────────────────
// · 2차 베지에는 from/ctrl/to 의 볼록껍질 안에 통째로 들어간다 — 세 점의 AABB 는 곡선의
//   AABB 를 **반드시 덮는다**(오탐 쪽).
// · 메모 칩은 판이 돌아도 `upright` 라 안 돈다(§6.4). 여기서는 칩 상자를 축정렬로 재므로
//   판을 90° 돌린 상태에서는 실제 화면 칩보다 가로·세로가 뒤바뀌어 잡힌다. 문지기라 무해하다.
// · 도형은 회전 전 경계상자의 네 꼭짓점을 돌려 감싼다 — 타원·삼각형에서는 실제 면보다 넓다.
import { BALL, CONE } from '../core/constants.ts';
import type { Vec2 } from '../core/units.ts';
import { chairCorners, poseFromStored } from '../model/chair.ts';
import type { ChairPose } from '../model/chair.ts';
import { ARROW_STYLE } from '../model/arrow.ts';
import type { Arrow } from '../model/arrow.ts';
import { strokeWidthOf } from '../model/stroke.ts';
import type { Stroke } from '../model/stroke.ts';
import { SHAPE_STROKE_PX, shapeSize } from '../model/shape.ts';
import type { Shape } from '../model/shape.ts';
import type { DrillCast, DrillStep, NoteLabel } from '../model/drill.ts';
import { NOTE_DEFAULT_SIZE_PX, noteChipHeightPx, noteChipWidthPx } from '../render/objects/noteChip.ts';

/** 월드 px 축정렬 경계상자. `min <= max` 는 늘 참이다(만드는 자리가 여기뿐이다). */
export interface AABB {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** 개체 종류 — 표시순서(z-order)의 대상 7종(결정 4). 골대·규칙존·격자는 개체가 아니라 없다. */
export type BoundsKind = 'cone' | 'stroke' | 'arrow' | 'chair' | 'ball' | 'note' | 'shape';

/** 종류마다 `objectBounds` 가 받는 개체의 모양.
 *
 *  휠체어만 `ChairPose`(theta rad, 런타임형)인 것에 주의 — 스텝이 쥔 것은 `StoredChairPose`
 *  (angleDeg)이므로 `poseFromStored` 로 풀어서 넣는다(`overlappingIds` 가 그렇게 한다).
 *  각도 변환을 이 파일이 또 적으면 `chair.ts` 의 랩·반올림 규약이 두 벌이 된다. */
export interface BoundsInput {
  cone: Vec2;
  ball: Vec2;
  chair: ChairPose;
  note: NoteLabel;
  arrow: Arrow;
  stroke: Stroke;
  shape: Shape;
}

/** 두 상자가 겹치는가. **경계가 정확히 맞닿아도 겹침이다**(머리말: 문지기는 오탐 쪽에 선다).
 *  `<` 로 바꾸면 딱 붙여 놓은 두 개체 사이에서 [한 단계 앞으로]가 조용히 disabled 된다. */
export function aabbIntersects(a: AABB, b: AABB): boolean {
  return a.minX <= b.maxX && b.minX <= a.maxX && a.minY <= b.maxY && b.minY <= a.maxY;
}

/** 점 목록의 AABB. 목록이 비면 `null`(상자를 만들 수 없다 — 상자 없음과 0×0 상자는 다르다). */
function boxOfPoints(pts: readonly Vec2[], pad: number): AABB | null {
  if (pts.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return null; // 깨진 좌표 하나가 판 전체를 덮는 상자가 되면 안 된다
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad };
}

/** 중심 ± 반너비·반높이. */
function boxAround(c: Vec2, halfW: number, halfH: number): AABB | null {
  if (!Number.isFinite(c.x) || !Number.isFinite(c.y)) return null;
  return { minX: c.x - halfW, minY: c.y - halfH, maxX: c.x + halfW, maxY: c.y + halfH };
}

/** 개체 하나의 월드 px AABB. 기하를 만들 수 없으면 `null`(점 0개짜리 획, 깨진 좌표).
 *
 *  ⚠️ 종류에 따라 `obj` 의 타입이 다르다 — `BoundsInput` 이 그 짝을 강제한다. */
export function objectBounds<K extends BoundsKind>(kind: K, obj: BoundsInput[K]): AABB | null {
  switch (kind) {
    case 'chair': {
      // 회전 hull 의 네 꼭짓점 → AABB. `chairCorners` 가 차체 사각형의 정본이고,
      // `chairOverlap.ts` 머리말이 *"세 곳이 각자 차체를 정의하면 물리는 부딪히는데 반칙은
      // 아니다가 된다"* 로 그 일치를 못박았다. 그래서 여기서도 그 함수를 부른다 —
      // 회전이 반영되는 것도 이 한 줄에서 공짜로 따라온다(정면 1.5×1.0, 90° 회전 1.0×1.5).
      return boxOfPoints(chairCorners(obj as ChairPose), 0);
    }
    case 'ball':
      return boxAround(obj as Vec2, BALL.viewRadiusPx, BALL.viewRadiusPx);
    case 'cone': {
      // 콘 삼각형은 위아래가 비대칭이다 — 꼭지가 −viewWidthPx/2, 밑변이 그보다 viewHeightPx
      // 아래. 이 파생은 `features/export/buildStaticSvg.ts` 의 `CONE_TRI_D` 와 같은 식이다.
      const p = obj as Vec2;
      const half = CONE.viewWidthPx / 2;
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return null;
      return { minX: p.x - half, minY: p.y - half, maxX: p.x + half, maxY: p.y - half + CONE.viewHeightPx };
    }
    case 'note': {
      const n = obj as NoteLabel;
      const size = n.size ?? NOTE_DEFAULT_SIZE_PX;
      return boxAround({ x: n.x, y: n.y }, noteChipWidthPx(n.text, size) / 2, noteChipHeightPx(n.text, size) / 2);
    }
    case 'arrow': {
      const a = obj as Arrow;
      // ctrl 을 넣는 것이 핵심이다 — 굽은 화살표는 from·to 를 잇는 상자 **밖으로** 부푼다.
      // 세 점의 AABB 는 2차 베지에의 볼록껍질을 덮으므로 곡선을 놓치지 않는다.
      return boxOfPoints([a.from, a.ctrl, a.to], ARROW_STYLE.width / 2);
    }
    case 'stroke': {
      const s = obj as Stroke;
      return boxOfPoints(s.points, strokeWidthOf(s) / 2);
    }
    case 'shape': {
      const s = obj as Shape;
      // 회전 전 경계상자(삼각형은 `shapeSize` 가 꼭짓점에서 뽑는다)의 네 꼭짓점을 `rot` 만큼
      // 돌린 뒤 감싼다. rot 은 **도(度)·시계방향**이고 SVG `rotate()` 와 부호가 같다
      // (`model/shape.ts` 좌표 규약). 그려지는 외곽선 두께의 반만큼 부풀린다.
      const { w, h } = shapeSize(s);
      const rad = (s.rot * Math.PI) / 180;
      const co = Math.cos(rad);
      const si = Math.sin(rad);
      const hw = w / 2;
      const hh = h / 2;
      const corners: Vec2[] = [];
      for (const sx of [-1, 1] as const) {
        for (const sy of [-1, 1] as const) {
          const lx = sx * hw;
          const ly = sy * hh;
          corners.push({ x: s.x + lx * co - ly * si, y: s.y + lx * si + ly * co });
        }
      }
      return boxOfPoints(corners, SHAPE_STROKE_PX / 2);
    }
    default:
      return null;
  }
}

/** `overlappingIds` 가 한 스텝을 훑어 만드는 목록의 원소. */
interface Entry {
  id: string;
  box: AABB;
}

/** 이 스텝에 **실제로 보이는** 개체 전부의 (id, AABB). 종류 순서는 뜻이 없다(Set 으로 나간다).
 *
 *  ⚠️ 캐스트 개체(휠체어·공·콘)는 **cast 정의 + 그 스텝의 포즈**가 둘 다 있어야 센다.
 *  `model/thumb.ts` 가 쓰는 것과 같은 규약이다 — 스텝에 포즈가 없는 개체는 그 스텝에 안
 *  보이므로 겹칠 수가 없고, 포즈만 있고 cast 정의가 없는 것은 고아다(결정 13). */
function stepEntries(step: DrillStep, cast: DrillCast): Entry[] {
  const out: Entry[] = [];
  const push = (id: string, box: AABB | null): void => {
    if (box) out.push({ id, box });
  };
  for (const def of cast.chairs) {
    const stored = step.chairs[def.id];
    if (stored) push(def.id, objectBounds('chair', poseFromStored(stored)));
  }
  for (const def of cast.balls) {
    const p = step.balls[def.id];
    if (p) push(def.id, objectBounds('ball', p));
  }
  for (const def of cast.cones) {
    const p = step.cones[def.id];
    if (p) push(def.id, objectBounds('cone', p));
  }
  for (const a of step.arrows) push(a.id, objectBounds('arrow', a));
  for (const s of step.strokes ?? []) push(s.id, objectBounds('stroke', s));
  // `?? []` — 키 없는 옛 스텝 객체 방어(`model/zOrder.ts` 의 `baseOrder` 와 같은 이유).
  for (const n of step.notes ?? []) push(n.id, objectBounds('note', n));
  for (const s of step.shapes ?? []) push(s.id, objectBounds('shape', s));
  return out;
}

/** `id` 와 AABB 가 겹치는 **같은 스텝의 다른 개체** id 전부(7종 통틀어).
 *
 *  · `id` 가 그 스텝에 없으면 빈 집합 — 부르는 쪽이 "겹치는 게 없다" 와 같이 다루면 된다
 *    ([표시순서] 가 통째로 disabled 된다).
 *  · **잠김(locked)·무시(ignored) 는 걸러내지 않는다.** 이 기능의 목적이 *가려진 것을 꺼내는
 *    것*인데, 나를 가리고 있는 것이 하필 잠긴 개체라고 해서 [한 단계 앞으로]가 죽으면 그
 *    상황이야말로 못 빠져나온다. 잠금은 **이동**을 막는 것이지 표시순서를 막는 것이 아니다.
 *  · 자기 자신은 결과에 없다. */
export function overlappingIds(step: DrillStep, cast: DrillCast, id: string): Set<string> {
  const entries = stepEntries(step, cast);
  const me = entries.find((e) => e.id === id);
  const out = new Set<string>();
  if (!me) return out;
  for (const e of entries) {
    if (e.id !== id && aabbIntersects(me.box, e.box)) out.add(e.id);
  }
  return out;
}
