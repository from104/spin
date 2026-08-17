// §3.11 썸네일. 색 없는 기하 요약만 만들고 픽셀은 만들지 않는다 — 색을 굽지 않아야 테마·팀
// 색을 바꿔도 썸네일이 즉시 따라온다. 첫 스텝에서 생성.
import { ARROW_COLOR_CYCLE, arrowColor } from './arrow.ts';
import type { Drill } from './drill.ts';
import type { CourtMode } from './court.ts';

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
      const p: ThumbSpec['arrows'][number]['p'] = [a.from.x, a.from.y, a.ctrl.x, a.ctrl.y, a.to.x, a.to.y];
      // 순환 밖의 색은 -1 이라 0(기본색)으로 접힌다 — `cycleArrowColor` 가 같은 규약이다.
      const c = ARROW_COLOR_CYCLE.indexOf(arrowColor(a));
      arrows.push(c > 0 ? { p, c } : { p });
    }
  }

  return { mode: d.courtMode, chairs, balls, cones, arrows };
}
