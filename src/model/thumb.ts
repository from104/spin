// §3.11 썸네일. 색 없는 기하 요약만 만들고 픽셀은 만들지 않는다 — 색을 굽지 않아야 테마·팀
// 색을 바꿔도 썸네일이 즉시 따라온다. 첫 스텝에서 생성.
import type { Drill } from './drill.ts';
import type { CourtMode } from './court.ts';

export interface ThumbSpec {
  mode: CourtMode;
  chairs: Array<{ x: number; y: number; a: number; t: 0 | 1; g: 0 | 1 }>; // a=deg, t: 0=home 1=away
  balls: Array<[number, number]>;
  cones: Array<[number, number, 0 | 1]>;
  /** D5 와 일관되게 path 문자열이 아니라 제어점을 담는다. `d` 는 렌더 시 arrowPath 로 생성. */
  arrows: Array<{ p: [number, number, number, number, number, number] }>; // from,ctrl,to
}

export const THUMB_CAPS = { chairs: 8, balls: 4, cones: 8, arrows: 3 } as const;

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
      arrows.push({ p: [a.from.x, a.from.y, a.ctrl.x, a.ctrl.y, a.to.x, a.to.y] });
    }
  }

  return { mode: d.courtMode, chairs, balls, cones, arrows };
}
