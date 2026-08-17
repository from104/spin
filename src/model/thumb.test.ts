// §3.11 썸네일 요약 — **색을 굽지 않는다**(thumb.ts 머리말). 화살표 색이 3단이 된 뒤
// (기현 지시 2026-08-17) 그 규약이 실제로 지켜지는지를 여기서 잰다: 요약에 들어가는 것은
// hex 가 아니라 `ARROW_COLORS` 의 **첨자**여야 한다. 첨자를 색으로 푸는 쪽은
// render/CourtThumbnail.test.tsx 가 본다.
import { describe, expect, it } from 'vitest';
import { newId } from '../core/ids.ts';
import { createDrill } from './defaults.ts';
import { ARROW_COLOR_CYCLE } from './arrow.ts';
import type { Arrow } from './arrow.ts';
import type { Drill } from './drill.ts';
import { buildStepThumb, THUMB_CAPS } from './thumb.ts';

const line = (color?: string): Arrow => {
  const a: Arrow = { id: newId('ar'), from: { x: 0, y: 0 }, ctrl: { x: 50, y: 10 }, to: { x: 100, y: 0 } };
  return color === undefined ? a : { ...a, color };
};

function withArrows(arrows: Arrow[]): Drill {
  const base = createDrill({ courtMode: 'full', formation: '1-2-1' });
  return { ...base, steps: [{ ...base.steps[0]!, arrows }] };
}

describe('buildStepThumb — 화살표 색은 첨자로 싣는다', () => {
  it('★ 기본색은 키를 아예 안 넣는다 — 그래서 SUMMARY_BUILD 를 안 올려도 된다', () => {
    const [a] = buildStepThumb(withArrows([line()]), 0).arrows;
    expect(a).toBeDefined();
    expect(Object.hasOwn(a!, 'c'), '기본색인데 첨자가 실렸다').toBe(false);
  });

  it('지정한 색은 hex 가 아니라 첨자다 — 색값을 고치면 저장된 카드도 함께 따라와야 한다', () => {
    const t = buildStepThumb(withArrows([line(ARROW_COLOR_CYCLE[1]), line(ARROW_COLOR_CYCLE[2])]), 0);
    expect(t.arrows.map((a) => a.c)).toEqual([1, 2]);
    // 대조군: 어디에도 hex 가 새겨지지 않았다.
    expect(JSON.stringify(t)).not.toContain(ARROW_COLOR_CYCLE[1]);
  });

  it('순환 밖의 색은 0(기본색)으로 접힌다 — cycleArrowColor 와 같은 규약이다', () => {
    const [a] = buildStepThumb(withArrows([line('#123456')]), 0).arrows;
    expect(Object.hasOwn(a!, 'c')).toBe(false);
  });

  it('좌표는 그대로다 — 색을 실으면서 from/ctrl/to 가 어긋나지 않았다', () => {
    const [a] = buildStepThumb(withArrows([line(ARROW_COLOR_CYCLE[2])]), 0).arrows;
    expect(a!.p).toEqual([0, 0, 50, 10, 100, 0]);
  });

  it('캡을 넘는 화살표는 잘린다 (대조군 — 색 때문에 캡이 풀린 게 아니다)', () => {
    const many = Array.from({ length: THUMB_CAPS.arrows + 2 }, () => line(ARROW_COLOR_CYCLE[1]));
    expect(buildStepThumb(withArrows(many), 0).arrows).toHaveLength(THUMB_CAPS.arrows);
  });
});
