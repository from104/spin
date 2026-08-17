// §3.5 화살표 — defaultCtrl 편차, arrowPath 형식·반올림.
import { describe, expect, it } from 'vitest';
import { newId } from '../core/ids.ts';
import {
  ARROW_COLOR_CYCLE,
  ARROW_COLOR_NAMES,
  ARROW_STYLE,
  arrowColor,
  arrowColorName,
  arrowPath,
  cycleArrowColor,
  defaultCtrl,
  moveEndpoint,
  nudgeArrow,
  type Arrow,
} from './arrow.ts';

describe('defaultCtrl', () => {
  it('bow=30 일 때 t=0.5 편차가 30 ± 0.01 이다', () => {
    const from = { x: 0, y: 0 };
    const to = { x: 100, y: 0 };
    const ctrl = defaultCtrl(from, to, 30);
    // 2차 베지에 B(0.5) = 0.25·P0 + 0.5·C + 0.25·P1
    const bx = 0.25 * from.x + 0.5 * ctrl.x + 0.25 * to.x;
    const by = 0.25 * from.y + 0.5 * ctrl.y + 0.25 * to.y;
    const midX = (from.x + to.x) / 2;
    const midY = (from.y + to.y) / 2;
    const dev = Math.hypot(bx - midX, by - midY);
    expect(dev).toBeGreaterThanOrEqual(30 - 0.01);
    expect(dev).toBeLessThanOrEqual(30 + 0.01);
  });

  it('bow=0 또는 생략 시 직선 중점을 반환한다', () => {
    const from = { x: 10, y: 10 };
    const to = { x: 50, y: 90 };
    expect(defaultCtrl(from, to)).toEqual({ x: 30, y: 50 });
    expect(defaultCtrl(from, to, 0)).toEqual({ x: 30, y: 50 });
  });

  it('길이 0 구간에서도 안전하게 중점을 반환한다', () => {
    expect(defaultCtrl({ x: 5, y: 5 }, { x: 5, y: 5 }, 20)).toEqual({ x: 5, y: 5 });
  });
});

describe('arrowPath', () => {
  it('M… Q… 형식이고 좌표가 0.01 로 반올림된다', () => {
    const a: Arrow = {
      id: newId('ar'),
      from: { x: 1.23456, y: 2.34567 },
      ctrl: { x: 3.456789, y: 4.567891 },
      to: { x: 5.678912, y: 6.789123 },
    };
    const d = arrowPath(a);
    expect(d).toMatch(/^M-?\d+(\.\d+)?,-?\d+(\.\d+)? Q-?\d+(\.\d+)?,-?\d+(\.\d+)? -?\d+(\.\d+)?,-?\d+(\.\d+)?$/);
    expect(d).toBe('M1.23,2.35 Q3.46,4.57 5.68,6.79');
  });
});

describe('moveEndpoint', () => {
  it('from/to 만 바꾸고 나머지는 유지한다', () => {
    const a: Arrow = { id: newId('ar'), from: { x: 0, y: 0 }, ctrl: { x: 1, y: 1 }, to: { x: 2, y: 2 } };
    const moved = moveEndpoint(a, 'to', { x: 9, y: 9 });
    expect(moved.to).toEqual({ x: 9, y: 9 });
    expect(moved.from).toEqual(a.from);
    expect(moved.id).toBe(a.id);
  });
});

describe('nudgeArrow (§7.5c 키보드)', () => {
  const base = (): Arrow => ({
    id: newId('ar'),
    from: { x: 0, y: 0 },
    ctrl: { x: 50, y: -20 },
    to: { x: 100, y: 0 },
    color: '#abcdef',
  });

  it("'whole' 은 세 점을 함께 밀어 모양을 그대로 유지한다", () => {
    const a = base();
    const m = nudgeArrow(a, 'whole', { x: 2.5, y: -2.5 });
    expect(m.from).toEqual({ x: 2.5, y: -2.5 });
    expect(m.ctrl).toEqual({ x: 52.5, y: -22.5 });
    expect(m.to).toEqual({ x: 102.5, y: -2.5 });
    // 모양 유지 = 세 점의 상대 위치가 한 점도 안 변했다.
    expect({ x: m.ctrl.x - m.from.x, y: m.ctrl.y - m.from.y }).toEqual({ x: a.ctrl.x - a.from.x, y: a.ctrl.y - a.from.y });
    expect({ x: m.to.x - m.from.x, y: m.to.y - m.from.y }).toEqual({ x: a.to.x - a.from.x, y: a.to.y - a.from.y });
  });

  it("'to' 는 끝점 하나만 옮긴다 (from·ctrl 불변 — 핸들 드래그와 같은 의미)", () => {
    const a = base();
    const m = nudgeArrow(a, 'to', { x: 2.5, y: 0 });
    expect(m.to).toEqual({ x: 102.5, y: 0 });
    expect(m.from).toEqual(a.from);
    expect(m.ctrl).toEqual(a.ctrl);
  });

  it("'from' 과 'ctrl' 도 각각 그 점만 옮긴다", () => {
    const a = base();
    const f = nudgeArrow(a, 'from', { x: 0, y: 2.5 });
    expect(f.from).toEqual({ x: 0, y: 2.5 });
    expect(f.ctrl).toEqual(a.ctrl);
    expect(f.to).toEqual(a.to);
    const c = nudgeArrow(a, 'ctrl', { x: -2.5, y: 0 });
    expect(c.ctrl).toEqual({ x: 47.5, y: -20 });
    expect(c.from).toEqual(a.from);
    expect(c.to).toEqual(a.to);
  });

  it('id·kind·color 를 보존하고 원본을 건드리지 않는다', () => {
    const a = base();
    const snapshot = structuredClone(a);
    const m = nudgeArrow(a, 'whole', { x: 7, y: 7 });
    expect(m.id).toBe(a.id);
    expect(m.headTo).toBe(a.headTo);
    expect(m.color).toBe('#abcdef');
    expect(a).toEqual(snapshot); // 불변
  });

  it('델타 0 이면 좌표가 그대로다 (연산 자체가 값을 흔들지 않는다)', () => {
    const a = base();
    const m = nudgeArrow(a, 'whole', { x: 0, y: 0 });
    expect(m.from).toEqual(a.from);
    expect(m.ctrl).toEqual(a.ctrl);
    expect(m.to).toEqual(a.to);
  });
});

// 기현 지시 2026-08-17 — 굽힘점(ctrl) 반복 클릭의 색 순환. 포인터 쪽 계약은
// features/editor/arrowPointer.test.tsx 가 본다. 여기는 **값과 규약**만 본다.
describe('cycleArrowColor', () => {
  const line = (color?: string): Arrow => {
    const a: Arrow = { id: newId('ar'), from: { x: 0, y: 0 }, ctrl: { x: 50, y: 10 }, to: { x: 100, y: 0 } };
    return color === undefined ? a : { ...a, color };
  };

  it('★ 첫 값이 기본색이다 — 이게 어긋나면 한 바퀴 돌아도 기본으로 못 돌아온다', () => {
    expect(ARROW_COLOR_CYCLE[0]).toBe(ARROW_STYLE.color);
    expect(ARROW_COLOR_CYCLE).toHaveLength(3);
    // 하늘·노랑·빨강 셋 다 이름이 있어야 발화가 hex 를 낱글자로 읽지 않는다.
    for (const c of ARROW_COLOR_CYCLE) expect(ARROW_COLOR_NAMES[c]).toBeTruthy();
  });

  it('하늘 → 노랑 → 빨강 → 하늘', () => {
    const a1 = cycleArrowColor(line());
    expect(arrowColor(a1)).toBe(ARROW_COLOR_CYCLE[1]);
    const a2 = cycleArrowColor(a1);
    expect(arrowColor(a2)).toBe(ARROW_COLOR_CYCLE[2]);
    const a3 = cycleArrowColor(a2);
    expect(arrowColor(a3)).toBe(ARROW_STYLE.color);
  });

  it('기본색으로 돌아올 때 color 키를 **지운다** (undefined 를 넣는 것이 아니다)', () => {
    const back = cycleArrowColor(line(ARROW_COLOR_CYCLE[2]));
    expect(Object.hasOwn(back, 'color')).toBe(false);
    // 대조군: 도중에는 키가 실제로 있다.
    expect(Object.hasOwn(cycleArrowColor(line()), 'color')).toBe(true);
  });

  it('순환 밖의 색은 첫 값으로 간다 — cycleHead 와 같은 규약이다', () => {
    expect(arrowColor(cycleArrowColor(line('#123456')))).toBe(ARROW_STYLE.color);
  });

  it('색 말고는 아무것도 안 건드린다 — 좌표·화살촉이 그대로다', () => {
    const before: Arrow = { ...line(), headFrom: 'wide', headTo: 'none' };
    const after = cycleArrowColor(before);
    expect(after.from).toEqual(before.from);
    expect(after.ctrl).toEqual(before.ctrl);
    expect(after.to).toEqual(before.to);
    expect(after.headFrom).toBe('wide');
    expect(after.headTo).toBe('none');
  });

  it('arrowColorName — 모르는 색은 hex 대신 사람 말로 접는다', () => {
    expect(arrowColorName(line())).toBe('하늘');
    expect(arrowColorName(line('#123456'))).toBe('사용자 지정');
  });
});
