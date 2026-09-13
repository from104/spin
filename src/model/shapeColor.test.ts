// 도형 색 순환(2026-09-14 기현님 지시 — *"반투명한 흰, 하늘, 노랑, 주황 4개의 색으로"*,
// *"붉은색 대신 주황으로"*).
//
// 지우면 새는 것 셋:
// ① 기본색으로 돌아올 때 **키를 안 지우면** 옛 저장본과 새 저장본의 모양이 갈린다 — 나중에
//    기본색을 옮기는 날 «되돌려 둔 것만» 옛 색으로 남는다(획의 같은 규약이 같은 이유로 있다).
// ② 순환 밖 색(남이 보낸 파일)에서 «다음» 을 셀 수 없다. 기본색으로 보내면 사람이 색을 잃은
//    줄 알고, 그대로 두면 순환이 멈춘다.
// ③ 팔레트에 빨강이 섞이면 판 위에서 이미 뜻을 가진 색과 부딪힌다(기현님이 주황으로 바꾼 이유).
import { describe, expect, it } from 'vitest';
import { SHAPE_COLOR_CHOICES } from '../core/colors.ts';
import { SHAPE_COLOR, cycleShapeColor, shapeColor } from './shape.ts';
import type { Shape } from './shape.ts';
import type { ShapeId } from '../core/ids.ts';
import { setShape } from './edits.ts';
import { createDrill } from './defaults.ts';

const box = (color?: string): Shape => ({
  id: 'sh_1' as ShapeId,
  kind: 'rect',
  x: 0,
  y: 0,
  w: 100,
  h: 60,
  rot: 0,
  ...(color === undefined ? {} : { color }),
});

describe('도형 색', () => {
  it('팔레트는 흰·하늘·노랑·**주황** 넷이고 첫 값이 기본이다 — 빨강은 없다', () => {
    expect(SHAPE_COLOR_CHOICES).toEqual(['#ffffff', '#38bdf8', '#fde047', '#f97316']);
    expect(SHAPE_COLOR).toBe('#ffffff');
    expect(SHAPE_COLOR_CHOICES).not.toContain('#ef4444');
  });

  it('키가 없으면 기본색으로 읽는다 — 옛 저장본·규칙 장면이 그 모양이다', () => {
    expect(shapeColor(box())).toBe('#ffffff');
    expect(shapeColor(box('#38bdf8'))).toBe('#38bdf8');
  });

  it('한 바퀴 돌면 **키가 사라진다** — 색을 되돌린 도형이 옛 저장본과 같은 모양이라야 한다', () => {
    let s = box();
    expect(cycleShapeColor(s).color).toBe('#38bdf8');
    s = cycleShapeColor(s);
    expect(cycleShapeColor(s).color).toBe('#fde047');
    s = cycleShapeColor(s);
    expect(cycleShapeColor(s).color).toBe('#f97316');
    s = cycleShapeColor(s);
    const back = cycleShapeColor(s);
    expect(back.color, '기본색으로 돌아오면 키를 남기지 않는다').toBeUndefined();
    expect('color' in back).toBe(false);
  });

  it('순환 밖 색은 **두 번째 색**으로 간다 — 기본색으로 보내면 색을 잃은 것처럼 보인다', () => {
    expect(cycleShapeColor(box('#123456')).color).toBe('#38bdf8');
  });

  it('색만 바뀐다 — 자리·크기·회전은 그대로', () => {
    const before = box('#38bdf8');
    const after = cycleShapeColor(before);
    expect({ x: after.x, y: after.y, w: after.w, h: after.h, rot: after.rot }).toEqual({ x: 0, y: 0, w: 100, h: 60, rot: 0 });
  });
});

// 2026-09-14 기현님 실기 *"도형의 색이 안 바뀜"* 의 원인. `setShape` 의 «변한 것 없음» 가드가
// 색을 안 봐서, 색만 바뀐 편집이 리듀서에서 통째로 버려졌다 — 손잡이를 눌러도 화면이 그대로였다.
// 그 가드는 이미 같은 함정을 한 번 겪고 주석까지 달아 둔 자리다(`pts` 를 안 보던 시절).
describe('setShape — 색만 바뀐 편집을 버리지 않는다', () => {
  const base = createDrill({ courtMode: 'full', formation: '1-2-1', empty: true });
  const shape: Shape = { id: 'sh_1' as ShapeId, kind: 'rect', x: 0, y: 0, w: 100, h: 60, rot: 0 };
  const withShape = setShape(base, 0, shape);

  it('색을 더하면 반영된다 — 이 줄이 빨개지면 회전 손잡이 탭이 다시 죽은 것이다', () => {
    const next = setShape(withShape, 0, { ...shape, color: '#38bdf8' });
    expect(next.steps[0]!.shapes[0]!.color).toBe('#38bdf8');
    expect(next, '새 드릴 객체가 나와야 화면이 다시 그려진다').not.toBe(withShape);
  });

  it('색을 지우는 것도 편집이다 — 한 바퀴 돌아 기본색으로 오는 길이 그것이다', () => {
    const colored = setShape(withShape, 0, { ...shape, color: '#38bdf8' });
    const back = setShape(colored, 0, shape);
    expect(back.steps[0]!.shapes[0]!.color).toBeUndefined();
    expect(back).not.toBe(colored);
  });

  it('대조군 — 아무것도 안 바뀌면 **같은 객체**를 돌려준다(불필요한 리렌더를 막는 가드다)', () => {
    expect(setShape(withShape, 0, shape)).toBe(withShape);
  });
});
