// §3.11 썸네일. 색 없는 기하 요약만 만들고 픽셀은 만들지 않는다 — 색을 굽지 않아야 테마·팀
// 색을 바꿔도 썸네일이 즉시 따라온다. 첫 스텝에서 생성.
import { ARROW_COLOR_CYCLE, arrowColor } from './arrow.ts';
import type { Drill } from './drill.ts';
import type { CourtMode } from './court.ts';
import type { Shape } from './shape.ts';

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
}

/** `noteChars` 만 개수가 아니라 **글자 수**다 — 위 `notes` 주석의 근거. */
export const THUMB_CAPS = { chairs: 8, balls: 4, cones: 8, arrows: 3, shapes: 6, notes: 6, noteChars: 24 } as const;

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

  if (step) {
    for (const def of d.cast.chairs) {
      if (chairs.length >= THUMB_CAPS.chairs) break;
      const pose = step.chairs[def.id];
      if (!pose) continue;
      chairs.push({ x: pose.x, y: pose.y, a: pose.angleDeg, t: def.team === 'home' ? 0 : 1, g: def.isGk ? 1 : 0 });
    }
    for (const def of d.cast.balls) {
      if (balls.length >= THUMB_CAPS.balls) break;
      const p = step.balls[def.id];
      if (!p) continue;
      balls.push([p.x, p.y]);
    }
    for (const def of d.cast.cones) {
      if (cones.length >= THUMB_CAPS.cones) break;
      const p = step.cones[def.id];
      if (!p) continue;
      cones.push([p.x, p.y, def.colorIndex]);
    }
    for (const a of step.arrows) {
      if (arrows.length >= THUMB_CAPS.arrows) break;
      const p: ThumbSpec['arrows'][number]['p'] = [a.from.x, a.from.y, a.ctrl.x, a.ctrl.y, a.to.x, a.to.y];
      // 순환 밖의 색은 -1 이라 0(기본색)으로 접힌다 — `cycleArrowColor` 가 같은 규약이다.
      const c = ARROW_COLOR_CYCLE.indexOf(arrowColor(a));
      arrows.push(c > 0 ? { p, c } : { p });
    }
    // ⚠️ `?? []` — 도형·메모 필드는 2026-08-14/그 이전에 생겼고 그 길을 안 지난 스텝 객체(옛
    // 저장본·테스트 픽스처)에는 키가 없다(`ShapeLayer.tsx` 가 같은 방어를 한다).
    for (const s of step.shapes ?? []) {
      if (shapes.length >= THUMB_CAPS.shapes) break;
      // 깊은 복사다. 얕게 담으면 삼각형의 꼭짓점 배열을 드릴 본문과 **공유**해서, 판에서 도형을
      // 끌 때 이미 저장된 요약의 썸네일까지 같이 움직인다(그리고 그건 저장 없이 일어난다).
      shapes.push(structuredClone(s));
    }
    for (const n of step.notes ?? []) {
      if (notes.length >= THUMB_CAPS.notes) break;
      const e: NonNullable<ThumbSpec['notes']>[number] = { x: n.x, y: n.y, t: n.text.slice(0, THUMB_CAPS.noteChars) };
      if (n.size !== undefined) e.s = n.size;
      if (n.color !== undefined) e.c = n.color;
      if (n.align !== undefined) e.a = n.align;
      notes.push(e);
    }
  }

  return {
    mode: d.courtMode,
    chairs,
    balls,
    cones,
    arrows,
    ...(shapes.length > 0 ? { shapes } : {}),
    ...(notes.length > 0 ? { notes } : {}),
  };
}
