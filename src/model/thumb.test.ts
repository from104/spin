// §3.11 썸네일 요약 — **색을 굽지 않는다**(thumb.ts 머리말). 화살표 색이 3단이 된 뒤
// (기현 지시 2026-08-17) 그 규약이 실제로 지켜지는지를 여기서 잰다: 요약에 들어가는 것은
// hex 가 아니라 `ARROW_COLORS` 의 **첨자**여야 한다. 첨자를 색으로 푸는 쪽은
// render/CourtThumbnail.test.tsx 가 본다.
import { describe, expect, it } from 'vitest';
import { newId } from '../core/ids.ts';
import { createDrill } from './defaults.ts';
import { ARROW_COLOR_CYCLE } from './arrow.ts';
import type { Arrow } from './arrow.ts';
import type { Drill, NoteLabel } from './drill.ts';
import type { Shape } from './shape.ts';
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

// 2026-08-17 기현님 지시 *"도형, 메모 등도 잡혀야지"*. 화살표 색과 달리 이 둘은 **없음이 참이
// 아니다** — 도형·메모를 가진 옛 드릴의 요약에도 키가 없으므로, 이 필드가 생긴 것과 함께
// SUMMARY_BUILD 가 2 로 올랐고 재구축 경로에 호출자가 붙었다(summary.ts · LibraryProvider).
describe('buildStepThumb — 도형·메모도 싣는다', () => {
  const rect = (x: number, y: number): Shape => ({ id: newId('sh'), kind: 'rect', x, y, w: 100, h: 60, rot: 0 });
  const note = (over: Partial<NoteLabel> = {}): NoteLabel => ({ id: newId('nt'), x: 10, y: 20, text: '앞으로', ...over });
  const withStep = (over: Partial<Drill['steps'][number]>): Drill => {
    const base = createDrill({ courtMode: 'full', formation: '1-2-1' });
    return { ...base, steps: [{ ...base.steps[0]!, ...over }] };
  };

  it('★ 도형이 있으면 기하 그대로 담고, 없으면 키를 만들지 않는다', () => {
    const t = buildStepThumb(withStep({ shapes: [rect(200, 150)] }), 0);
    expect(t.shapes).toEqual([expect.objectContaining({ kind: 'rect', x: 200, y: 150, w: 100, h: 60 })]);
    expect(Object.hasOwn(buildStepThumb(withStep({ shapes: [] }), 0), 'shapes')).toBe(false);
  });

  it('★ 도형은 **깊은 복사**다 — 판에서 도형을 끌 때 저장된 썸네일이 따라 움직이면 안 된다', () => {
    const s = rect(200, 150);
    const t = buildStepThumb(withStep({ shapes: [s] }), 0);
    s.x = 999;
    expect(t.shapes![0]!.x).toBe(200);
  });

  it('★ 메모는 본문·자리를 담고 기본값(크기·색·정렬)은 키를 만들지 않는다', () => {
    const t = buildStepThumb(withStep({ notes: [note()] }), 0);
    expect(t.notes).toEqual([{ x: 10, y: 20, t: '앞으로' }]);
    const styled = buildStepThumb(withStep({ notes: [note({ size: 20, color: '#ff0000', align: 'start' })] }), 0);
    expect(styled.notes).toEqual([{ x: 10, y: 20, t: '앞으로', s: 20, c: '#ff0000', a: 'start' }]);
  });

  it('★ 긴 메모는 글자 수로 자른다 — 요약은 목록을 그리는 작은 레코드다', () => {
    const long = 'ㄱ'.repeat(THUMB_CAPS.noteChars + 40);
    const t = buildStepThumb(withStep({ notes: [note({ text: long })] }), 0);
    expect(t.notes![0]!.t).toHaveLength(THUMB_CAPS.noteChars);
  });

  it('캡을 넘는 도형·메모는 잘린다', () => {
    const shapes = Array.from({ length: THUMB_CAPS.shapes + 3 }, (_, i) => rect(i * 10, 100));
    const notes = Array.from({ length: THUMB_CAPS.notes + 3 }, (_, i) => note({ x: i * 10 }));
    const t = buildStepThumb(withStep({ shapes, notes }), 0);
    expect(t.shapes).toHaveLength(THUMB_CAPS.shapes);
    expect(t.notes).toHaveLength(THUMB_CAPS.notes);
  });

  it('★ 키가 없는 옛 스텝 객체(도형·메모 필드 이전)에도 안 터진다', () => {
    const base = createDrill({ courtMode: 'full', formation: '1-2-1' });
    const old = { ...base.steps[0]! } as Record<string, unknown>;
    delete old.shapes;
    delete old.notes;
    const t = buildStepThumb({ ...base, steps: [old as unknown as Drill['steps'][number]] }, 0);
    expect(Object.hasOwn(t, 'shapes')).toBe(false);
    expect(Object.hasOwn(t, 'notes')).toBe(false);
  });
});
