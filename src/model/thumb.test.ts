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
import {
  STROKE_WIDTH_DEFAULT,
  cycleStrokeColor,
  cycleStrokeWidth,
  strokeColor,
  strokeWidthIndexOf,
  type Stroke,
} from './stroke.ts';
import { buildStepThumb, THUMB_CAPS, thumbSequence } from './thumb.ts';

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

// 획(2026-09-03). 화살표와 같은 규약을 따르는지 — 색·굵기는 값이 아니라 **첨자**이고,
// 기본값이면 키를 안 넣는다 — 그리고 점 수에 상한이 서는지를 잰다.
describe('buildStepThumb — 자유 그리기 획', () => {
  const withStrokes = (strokes: Stroke[]): Drill => {
    const base = createDrill({ courtMode: 'full', formation: '1-2-1' });
    return { ...base, steps: [{ ...base.steps[0]!, strokes }] };
  };
  // 지그재그 — 직선이면 RDP 가 2점으로 접어 상한 검사가 무의미해진다.
  const zigzag = (n: number): Stroke => ({
    id: newId('fh'),
    points: Array.from({ length: n }, (_, i) => ({ x: i * 20, y: i % 2 === 0 ? 0 : 40 })),
  });

  it('점은 평탄한 좌표 열이고, 개수는 THUMB_CAPS 로 잘린다', () => {
    const [s] = buildStepThumb(withStrokes([zigzag(80)]), 0).strokes!;
    expect(s).toBeDefined();
    expect(s!.p.length % 2, '평탄한 좌표 열이라 길이는 짝수다').toBe(0);
    expect(s!.p.length / 2).toBeLessThanOrEqual(THUMB_CAPS.strokePoints);
    expect(s!.p.length / 2).toBeGreaterThanOrEqual(2); // 두 점이 안 되면 칩에서 선이 아니다
  });

  it('기본 색·굵기면 키를 안 넣는다 — arrows 의 `c` 와 같은 규약', () => {
    const plain = buildStepThumb(withStrokes([zigzag(5)]), 0).strokes![0]!;
    expect(Object.hasOwn(plain, 'c'), '기본색인데 첨자가 실렸다').toBe(false);
    expect(Object.hasOwn(plain, 'w'), '기본 굵기인데 첨자가 실렸다').toBe(false);
  });

  it('바꾼 색·굵기는 hex/px 가 아니라 첨자로 실리고, 풀면 원래 값이 나온다', () => {
    const src = cycleStrokeWidth(cycleStrokeColor(zigzag(5)));
    const styled = buildStepThumb(withStrokes([src]), 0).strokes![0]!;
    expect(typeof styled.c, '색을 구우면 테마·팀색을 바꿔도 썸네일이 안 따라온다').toBe('number');
    expect(ARROW_COLOR_CYCLE[styled.c!]).toBe(strokeColor(src));
    expect(styled.w).toBe(strokeWidthIndexOf(src));
    expect(styled.w, '대조군 — 기본 굵기였다면 위 케이스처럼 키가 없어야 한다').not.toBe(STROKE_WIDTH_DEFAULT);
  });

  it('획 수는 캡까지만 싣고, 없으면 키 자체가 없다', () => {
    const many = Array.from({ length: THUMB_CAPS.strokes + 2 }, () => zigzag(4));
    expect(buildStepThumb(withStrokes(many), 0).strokes).toHaveLength(THUMB_CAPS.strokes);
    expect(buildStepThumb(withStrokes([]), 0).strokes).toBeUndefined();
  });
});

// 개체 표시 순서(2026-09-06, PLAN-Z-ORDER 결정 12). 요약은 id 를 안 담으므로 순서를 **평탄 목록의
// 첨자 순열**로 나른다 — 그 부호화와 복호화가 서로 맞는지, 목록 없는 스텝은 키가 없는지를 잰다.
describe('buildStepThumb — 표시 순서(z)', () => {
  const rect: Shape = { id: newId('sh'), kind: 'rect', x: 300, y: 250, w: 100, h: 60, rot: 0 };
  const withOrder = (): { drill: Drill; chairId: string } => {
    const base = createDrill({ courtMode: 'full', formation: '1-2-1' });
    const chair = base.cast.chairs[0]!;
    const step = {
      ...base.steps[0]!,
      chairs: { [chair.id]: { x: 300, y: 250, angleDeg: 0 } },
      balls: {},
      cones: {},
      arrows: [],
      notes: [],
      shapes: [rect],
    };
    return { drill: { ...base, steps: [step] }, chairId: chair.id };
  };

  it('★ 도형을 휠체어 위로 올리면 요약이 그 차례를 싣고, 목록이 없으면 키 자체가 없다', () => {
    // 지우면 새는 버그: 카드만 판과 다른 순서로 그려진다(순서를 바꾼 스텝에서만, 겹친 둘의 앞뒤가
    // 뒤집혀서). 키 없음 쪽을 지우면 옛 요약과 모양이 갈려 재구축 없이도 되쓰기가 는다.
    const { drill, chairId } = withOrder();
    expect(Object.hasOwn(buildStepThumb(drill, 0), 'z')).toBe(false);
    // 평탄 목록은 기본층 순서 [도형, 휠체어] = [0, 1]. 도형을 위로 올렸으니 [1, 0].
    const t = buildStepThumb({ ...drill, steps: [{ ...drill.steps[0]!, zOrder: [chairId, rect.id] }] }, 0);
    expect(t.z).toEqual([1, 0]);
    expect(thumbSequence(t.z, 2)).toEqual([1, 0]);
  });

  it('순열이 배열과 어긋나도 개체가 사라지지 않는다 — 범위 밖·중복은 버리고 빠진 것은 맨 위', () => {
    // 지우면 새는 버그: 캡을 바꾼 뒤 옛 요약의 순열이 새 배열 길이와 어긋나면 카드에서 개체가
    // 조용히 빠지거나(첨자 누락) 같은 것이 두 번 그려진다(중복).
    expect(thumbSequence([2, 9, -1, 2], 4)).toEqual([2, 0, 1, 3]);
    expect(thumbSequence(undefined, 3)).toEqual([0, 1, 2]);
  });
});
