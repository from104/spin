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
  ARROW_ROTATE_GAP_PX,
  arrowMid,
  arrowRotateHandlePoint,
  rotateArrowAbout,
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
    // 하늘·노랑·빨강 셋 다 이름이 있어야 발화가 hex 를 낱글자로 읽지 않는다(세 로케일 전부).
    for (const c of ARROW_COLOR_CYCLE) {
      expect(ARROW_COLOR_NAMES.ko[c]).toBeTruthy();
      expect(ARROW_COLOR_NAMES.en[c]).toBeTruthy();
      expect(ARROW_COLOR_NAMES.ja[c]).toBeTruthy();
    }
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
    expect(arrowColorName(line(), 'ko')).toBe('하늘');
    expect(arrowColorName(line('#123456'), 'ko')).toBe('사용자 지정');
  });
});

// ── 회전 앵커 (기현 지시 2026-08-18: "화살표 객체에 회전 앵커를 넣자") ─────────────────────

describe('rotateArrowAbout', () => {
  const A = (over: Partial<Arrow> = {}): Arrow => ({
    id: newId('ar'),
    from: { x: 100, y: 200 },
    ctrl: { x: 200, y: 150 },
    to: { x: 300, y: 200 },
    ...over,
  });

  it('90°(화면 시계방향, y-down) — 세 점이 전부 축 둘레로 돈다', () => {
    const a = A();
    const r = rotateArrowAbout(a, { x: 200, y: 200 }, Math.PI / 2);
    // (100,200) → 축 기준 (-100,0) → 시계 90° → (0,-100)…이 아니라 y-down 에서 (0,+?):
    // (x,y)→(-y,x) 이므로 (-100,0)→(0,-100). 절대좌표 (200,100).
    expect(r.from.x).toBeCloseTo(200, 9);
    expect(r.from.y).toBeCloseTo(100, 9);
    expect(r.to.x).toBeCloseTo(200, 9);
    expect(r.to.y).toBeCloseTo(300, 9);
    expect(r.ctrl.x).toBeCloseTo(250, 9);
    expect(r.ctrl.y).toBeCloseTo(200, 9);
  });

  it('축이 arrowMid 면 mid 는 제자리다 — "제자리에서 돈다" 의 기계적 증인', () => {
    const a = A();
    const c = arrowMid(a);
    const r = rotateArrowAbout(a, c, 1.234);
    expect(arrowMid(r).x).toBeCloseTo(c.x, 9);
    expect(arrowMid(r).y).toBeCloseTo(c.y, 9);
  });

  it('모양만 돈다 — id·화살촉·색은 그대로다', () => {
    const a: Arrow = { ...A(), headFrom: 'wide', headTo: 'none', color: '#ef4444' };
    const r = rotateArrowAbout(a, { x: 0, y: 0 }, 0.5);
    expect(r.id).toBe(a.id);
    expect(r.headFrom).toBe('wide');
    expect(r.headTo).toBe('none');
    expect(r.color).toBe('#ef4444');
  });

  it('0 라디안은 좌표가 그대로다(부동소수 오차 없이 항등은 아니어도 값은 같다)', () => {
    const a = A();
    const r = rotateArrowAbout(a, { x: 50, y: 50 }, 0);
    expect(r.from.x).toBeCloseTo(a.from.x, 12);
    expect(r.from.y).toBeCloseTo(a.from.y, 12);
  });
});

describe('arrowRotateHandlePoint', () => {
  const A = (ctrl: { x: number; y: number }): Arrow => ({
    id: newId('ar'),
    from: { x: 100, y: 200 },
    ctrl,
    to: { x: 300, y: 200 },
    ...{},
  });

  it('곧은 화살표(동쪽 진행) — mid 에서 진행방향 오른쪽(+y)으로 GAP 만큼', () => {
    const a = A({ x: 200, y: 200 });
    const p = arrowRotateHandlePoint(a);
    const mid = arrowMid(a); // (200,200)
    expect(p.x).toBeCloseTo(mid.x, 9);
    expect(p.y).toBeCloseTo(mid.y + ARROW_ROTATE_GAP_PX, 9);
  });

  it('굽힘의 반대쪽에 앉는다 — ctrl 이 오른쪽(+y)이면 앵커는 왼쪽(-y)', () => {
    const a = A({ x: 200, y: 260 }); // 아래(오른쪽)로 굽힘
    const p = arrowRotateHandlePoint(a);
    expect(p.y).toBeLessThan(arrowMid(a).y); // mid 보다 위 = 굽힘 반대
  });

  it('ctrl 이 왼쪽(-y)이면 앵커는 오른쪽(+y) — 어느 쪽이든 굽힘을 피한다', () => {
    const a = A({ x: 200, y: 140 });
    const p = arrowRotateHandlePoint(a);
    expect(p.y).toBeGreaterThan(arrowMid(a).y);
  });

  it('mid 에서의 거리는 언제나 GAP 이다', () => {
    for (const ctrl of [{ x: 200, y: 200 }, { x: 200, y: 300 }, { x: 150, y: 120 }]) {
      const a = A(ctrl);
      const p = arrowRotateHandlePoint(a);
      const mid = arrowMid(a);
      expect(Math.hypot(p.x - mid.x, p.y - mid.y)).toBeCloseTo(ARROW_ROTATE_GAP_PX, 9);
    }
  });

  it('퇴화(세 점이 한 자리) — 위(-y)로 눕는다', () => {
    const q = { x: 40, y: 40 };
    const a: Arrow = { id: newId('ar'), from: { ...q }, ctrl: { ...q }, to: { ...q } };
    const p = arrowRotateHandlePoint(a);
    expect(p.x).toBeCloseTo(40, 9);
    expect(p.y).toBeCloseTo(40 - ARROW_ROTATE_GAP_PX, 9);
  });

  it('강체 회전을 따라 함께 돈다 — 드래그 중 앵커가 편을 바꾸지 않는 근거', () => {
    const a = A({ x: 200, y: 260 });
    const c = arrowMid(a);
    const r = rotateArrowAbout(a, c, Math.PI / 3);
    const before = arrowRotateHandlePoint(a);
    const rotated = rotateArrowAbout({ ...a, from: before, ctrl: before, to: before }, c, Math.PI / 3).from;
    const after = arrowRotateHandlePoint(r);
    expect(after.x).toBeCloseTo(rotated.x, 9);
    expect(after.y).toBeCloseTo(rotated.y, 9);
  });
});
