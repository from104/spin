// §3.11 썸네일. 색 없는 기하 요약만 만들고 픽셀은 만들지 않는다 — 색을 굽지 않아야 테마·팀
// 색을 바꿔도 썸네일이 즉시 따라온다. 첫 스텝에서 생성.
import { ARROW_COLOR_CYCLE, arrowColor } from './arrow.ts';
import { STROKE_WIDTH_DEFAULT, simplifyPoints, strokeColor, strokeWidthIndexOf } from './stroke.ts';
import type { Drill } from './drill.ts';
import type { CourtMode } from './court.ts';
import type { Shape } from './shape.ts';
import type { Vec2 } from '../core/units.ts';
import { DEFAULT_TIERS, sceneOrder } from './zOrder.ts';
import type { SceneKind } from './zOrder.ts';

export interface ThumbSpec {
  mode: CourtMode;
  chairs: Array<{ x: number; y: number; a: number; t: 0 | 1; g: 0 | 1 }>; // a=deg, t: 0=home 1=away
  balls: Array<[number, number]>;
  cones: Array<[number, number, 0 | 1]>;
  /** D5 와 일관되게 path 문자열이 아니라 제어점을 담는다. `d` 는 렌더 시 arrowPath 로 생성.
   *
   *  `c` = `ARROW_COLORS`(core/colors.ts) 의 **첨자**. 색 hex 가 아닌 것은 콘의 `colorIndex`·
   *  휠체어의 `t` 와 같은 규약이다 — 이 파일 머리말의 "색을 굽지 않는다".
   *
   *  ⚠️ 기본색(첨자 0)일 때는 **키를 넣지 않는다.** 그래야 `SUMMARY_BUILD` 를 올리지 않아도
   *  된다: 이 필드가 생기기 전(2026-08-17 이전)에 저장된 화살표는 색을 지정할 방법이 아예
   *  없었으므로 **전부 기본색**이고, 옛 요약의 '없음' 은 정보 부족이 아니라 **참인 기본값**이다
   *  (`summary.ts` 의 `courtSize` 가 같은 논증으로 build 를 안 올렸다). */
  arrows: Array<{ p: [number, number, number, number, number, number]; c?: number }>; // from,ctrl,to
  /** 작도 도형(2026-08-17 기현님 지시 *"도형, 메모 등도 잡혀야지"*). **모델 객체를 그대로**
   *  담는다 — 도형의 색은 사용자 데이터가 아니라 상수 하나(`SHAPE_COLOR`)라 이 파일 머리말의
   *  "색을 굽지 않는다" 에 걸리지 않는다. 그래서 썸네일이 `ShapeLayer` 를 그대로 재사용하고,
   *  그리는 코드가 다섯 곳으로 갈라지지 않는다(`ShapeLayer.tsx` 머리말이 그 계약이다).
   *
   *  ⚠️ 비어 있으면 **키를 넣지 않는다** — 옛 요약과 모양이 같아야 쓸데없는 되쓰기가 없다. */
  shapes?: Shape[];
  /** 메모(2026-08-17). 크기·색·정렬은 사용자 데이터라 값이 있을 때만 담고(없으면 렌더가 기본값을
   *  쓴다), 본문은 `THUMB_CAPS.noteChars` 로 자른다 — 요약은 목록을 그리기 위한 작은 레코드인데
   *  600자 메모 여덟 개를 실으면 성격이 바뀐다. 썸네일의 글자는 2~3 px 라 읽히는 것이 아니라
   *  '여기 쪽지가 있다' 는 질감이다(그래서 자른 것이 화면에서 손실로 보이지 않는다). */
  notes?: Array<{ x: number; y: number; t: string; s?: number; c?: string; a?: 'start' | 'middle' | 'end' }>;
  /** 자유 그리기 획(2026-09-03). `p` 는 **평탄한 좌표 열**([x0,y0,x1,y1,…])이다 — 44px 칩
   *  하나에 열두 점짜리 획 셋이면 `{x,y}` 객체 서른여섯 개가 IDB 에 앉는데, 요약은 목록을
   *  그리기 위한 작은 레코드다(위 `notes` 주석과 같은 규율).
   *
   *  ⚠️ 색은 hex 가 아니라 `ARROW_COLORS` 의 **첨자**이고(화살표와 같은 규약), 굵기도 px 가
   *  아니라 `STROKE_WIDTHS` 의 첨자다 — 이 파일 머리말의 "색을 굽지 않는다" 가 굵기에도 똑같이
   *  걸린다(값을 손보면 옛 요약만 옛 굵기로 남는다).
   *
   *  ⚠️ 기본값(색 첨자 0 · 굵기 첨자 `STROKE_WIDTH_DEFAULT`)일 때는 키를 넣지 않는다 —
   *  `arrows.c` 와 같은 이유다. 비어 있으면 `strokes` 키 자체를 안 만든다. */
  strokes?: Array<{ p: number[]; c?: number; w?: number }>;
  /** 개체 표시 순서(2026-09-06, `docs/PLAN-Z-ORDER.md` 결정 12 — 썸네일도 판과 같은 순서다).
   *  위 배열들을 **기본층 순서**(`DEFAULT_TIERS`: 도형→콘→획→화살표→휠체어→공→메모)로 이어 붙인
   *  평탄 목록의 **첨자 순열**(아래→위)이다. 요약은 개체 id 를 안 담으므로(작은 레코드 규율)
   *  id 목록 대신 자리로 순서를 나른다 — 종류 코드를 따로 두지 않는 이유는 평탄 목록의 자리가
   *  이미 종류를 말하기 때문이다. 푸는 쪽은 `thumbSequence` 하나다.
   *
   *  ⚠️ 기본층과 같으면 키를 넣지 않는다 — `arrows.c` 와 같은 논증이라 `SUMMARY_BUILD` 를 안
   *  올린다: 이 필드가 생기기 전의 요약은 전부 순서를 정한 적 없는 드릴(v10 이하)의 것이라
   *  '없음' 은 정보 부족이 아니라 **참인 기본값**이다. 캡에 잘린 개체는 순열에서도 빠진다. */
  z?: number[];
}

/** 요약의 개체를 그릴 차례(평탄 목록 첨자, 아래→위). `z` 가 없으면 항등(= 기본층).
 *  범위 밖·중복·정수 아닌 첨자는 버리고, 순열에 없는 첨자는 **맨 위**에 붙인다(`sceneOrder`
 *  규칙 ③과 같은 처리) — 요약 레코드는 오래 살아서, 캡을 바꾼 뒤 옛 순열이 새 배열 길이와
 *  어긋나도 개체가 조용히 사라지면 안 된다. */
export function thumbSequence(z: readonly number[] | undefined, n: number): number[] {
  const identity = Array.from({ length: n }, (_, i) => i);
  if (!z || z.length === 0) return identity;
  const seen = new Set<number>();
  const out: number[] = [];
  for (const i of z) {
    if (!Number.isInteger(i) || i < 0 || i >= n || seen.has(i)) continue;
    seen.add(i);
    out.push(i);
  }
  for (const i of identity) if (!seen.has(i)) out.push(i);
  return out;
}

/** `noteChars` 만 개수가 아니라 **글자 수**다 — 위 `notes` 주석의 근거.
 *  `strokePoints` 도 개수가 아니라 **한 획의 점 수**다(같은 형태의 예외). */
export const THUMB_CAPS = {
  chairs: 8,
  balls: 4,
  cones: 8,
  arrows: 3,
  shapes: 6,
  notes: 6,
  noteChars: 24,
  strokes: 3,
  strokePoints: 12,
} as const;

/** 썸네일용 단순화 허용 오차(px). 본문의 `STROKE_SIMPLIFY_EPSILON_PX`(1.5)보다 네 배 거칠다 —
 *  44px 칩에서 획은 몇 픽셀짜리 흔적이라 굽이 하나하나가 아니라 **어디서 어디로 갔는가**만
 *  읽힌다. 그래도 못 줄인 획은 아래 `thinTo` 가 균등하게 솎는다(RDP 는 점 수를 보장하지 않는다). */
export const THUMB_STROKE_EPSILON_PX = 6;

/** 양 끝을 지킨 채 균등 간격으로 `max` 점까지 솎는다. RDP 뒤에도 점이 남는 획(빽빽한 곡선)의
 *  마지막 방어선이다 — 여기서 잘라 두어야 요약 하나의 크기에 상한이 선다. */
function thinTo(pts: readonly Vec2[], max: number): Vec2[] {
  if (pts.length <= max) return pts.slice();
  const out: Vec2[] = [];
  for (let i = 0; i < max; i += 1) {
    out.push(pts[Math.round((i * (pts.length - 1)) / (max - 1))]!);
  }
  return out;
}

/** 드릴 요약(목록 카드)용 — 첫 스텝. */
export function buildThumb(d: Drill): ThumbSpec {
  return buildStepThumb(d, 0);
}

/** 스텝 **한 장**의 요약. 트랜스포트의 사진 뭉치가 스텝마다 이걸 그린다(§4.4 P2-3).
 *  캡(THUMB_CAPS)은 목록 카드와 같은 값을 쓴다 — 44px 칩에서는 더더욱 다 안 보인다. */
export function buildStepThumb(d: Drill, i: number): ThumbSpec {
  const step = d.steps[i];
  const chairs: ThumbSpec['chairs'] = [];
  const balls: ThumbSpec['balls'] = [];
  const cones: ThumbSpec['cones'] = [];
  const arrows: ThumbSpec['arrows'] = [];
  const shapes: Shape[] = [];
  const notes: NonNullable<ThumbSpec['notes']> = [];
  const strokes: NonNullable<ThumbSpec['strokes']> = [];
  // 요약에 **실린** 개체의 id 를 종류별로 같은 차례로 적어 둔다 — 아래 `z` 순열을 만들 때만 쓰고
  // 요약에는 안 실린다(캡에 잘린 것은 여기에도 없다).
  const idsByKind: Record<SceneKind, string[]> = { shape: [], cone: [], stroke: [], arrow: [], chair: [], ball: [], note: [] };

  if (step) {
    for (const def of d.cast.chairs) {
      if (chairs.length >= THUMB_CAPS.chairs) break;
      const pose = step.chairs[def.id];
      if (!pose) continue;
      chairs.push({ x: pose.x, y: pose.y, a: pose.angleDeg, t: def.team === 'home' ? 0 : 1, g: def.isGk ? 1 : 0 });
      idsByKind.chair.push(def.id);
    }
    for (const def of d.cast.balls) {
      if (balls.length >= THUMB_CAPS.balls) break;
      const p = step.balls[def.id];
      if (!p) continue;
      balls.push([p.x, p.y]);
      idsByKind.ball.push(def.id);
    }
    for (const def of d.cast.cones) {
      if (cones.length >= THUMB_CAPS.cones) break;
      const p = step.cones[def.id];
      if (!p) continue;
      cones.push([p.x, p.y, def.colorIndex]);
      idsByKind.cone.push(def.id);
    }
    for (const a of step.arrows) {
      if (arrows.length >= THUMB_CAPS.arrows) break;
      const p: ThumbSpec['arrows'][number]['p'] = [a.from.x, a.from.y, a.ctrl.x, a.ctrl.y, a.to.x, a.to.y];
      // 순환 밖의 색은 -1 이라 0(기본색)으로 접힌다 — `cycleArrowColor` 가 같은 규약이다.
      const c = ARROW_COLOR_CYCLE.indexOf(arrowColor(a));
      arrows.push(c > 0 ? { p, c } : { p });
      idsByKind.arrow.push(a.id);
    }
    // ⚠️ `?? []` — 도형·메모 필드는 2026-08-14/그 이전에 생겼고 그 길을 안 지난 스텝 객체(옛
    // 저장본·테스트 픽스처)에는 키가 없다(`ShapeLayer.tsx` 가 같은 방어를 한다).
    for (const s of step.shapes ?? []) {
      if (shapes.length >= THUMB_CAPS.shapes) break;
      // 깊은 복사다. 얕게 담으면 삼각형의 꼭짓점 배열을 드릴 본문과 **공유**해서, 판에서 도형을
      // 끌 때 이미 저장된 요약의 썸네일까지 같이 움직인다(그리고 그건 저장 없이 일어난다).
      shapes.push(structuredClone(s));
      idsByKind.shape.push(s.id);
    }
    for (const n of step.notes ?? []) {
      if (notes.length >= THUMB_CAPS.notes) break;
      const e: NonNullable<ThumbSpec['notes']>[number] = { x: n.x, y: n.y, t: n.text.slice(0, THUMB_CAPS.noteChars) };
      if (n.size !== undefined) e.s = n.size;
      if (n.color !== undefined) e.c = n.color;
      if (n.align !== undefined) e.a = n.align;
      notes.push(e);
      idsByKind.note.push(n.id);
    }
    // 획도 `?? []` — 필드가 optional 이라 v10 이전 스텝 객체에는 키가 없다(drill.ts 주석).
    for (const s of step.strokes ?? []) {
      if (strokes.length >= THUMB_CAPS.strokes) break;
      const pts = thinTo(simplifyPoints(s.points, THUMB_STROKE_EPSILON_PX), THUMB_CAPS.strokePoints);
      if (pts.length < 2) continue; // 두 점이 안 되면 칩에서 선이 아니다
      const p: number[] = [];
      for (const q of pts) p.push(q.x, q.y);
      const e: NonNullable<ThumbSpec['strokes']>[number] = { p };
      // 순환 밖의 색은 -1 이라 0(기본색)으로 접힌다 — arrows 의 `c` 와 같은 규약이다.
      const c = ARROW_COLOR_CYCLE.indexOf(strokeColor(s));
      if (c > 0) e.c = c;
      const w = strokeWidthIndexOf(s);
      if (w !== STROKE_WIDTH_DEFAULT) e.w = w;
      strokes.push(e);
      idsByKind.stroke.push(s.id);
    }
  }

  // 표시 순서 → 평탄 목록 첨자 순열. 목록이 없는 스텝은 아예 안 만든다(기본층 = 항등이라 키가
  // 없어야 옛 요약과 모양이 같다). 목록이 있어도 결과가 항등이면 역시 안 싣는다.
  let z: number[] | undefined;
  if (step?.zOrder && step.zOrder.length > 0) {
    const flat: string[] = [];
    for (const kind of DEFAULT_TIERS) flat.push(...idsByKind[kind]);
    const at = new Map(flat.map((id, i) => [id, i]));
    const seq: number[] = [];
    for (const ref of sceneOrder(step, d.cast)) {
      const i = at.get(ref.id);
      if (i !== undefined) seq.push(i);
    }
    if (seq.length !== flat.length || seq.some((v, i) => v !== i)) z = seq;
  }

  return {
    mode: d.courtMode,
    chairs,
    balls,
    cones,
    arrows,
    ...(shapes.length > 0 ? { shapes } : {}),
    ...(notes.length > 0 ? { notes } : {}),
    ...(strokes.length > 0 ? { strokes } : {}),
    ...(z ? { z } : {}),
  };
}
