// 겹침 문지기(`bounds.ts`)가 **정본 치수를 실제로 따라가는지**, 그리고 스텝에 없는 개체를
// 세지 않는지 재는 곳. 정본 계획서 `docs/PLAN-Z-ORDER.md` 결정 6.
//
// 여기 있는 단언은 전부 "지우면 [표시순서] 메뉴가 조용히 거짓말을 한다" 로 이어진다:
// 겹치는데 안 겹쳤다고 하면 **가려진 개체를 영영 못 꺼내고**(이 기능의 존재 이유), 스텝에
// 없는 개체를 세면 안 보이는 것 때문에 항목이 켜져 눌러도 화면이 안 바뀐다.
//
// ⚠️ **숫자를 소스에서 베껴 오지 않는다**(AGENTS.md 「쓰지 않는 것」). 차체 폭 25 나 칩 폭 32
// 같은 리터럴로 상자를 대조하면 그 검사는 상수를 옮겨 적은 자기증명이 된다. 대신 **성질**을
// 잰다: 회전하면 가로·세로가 바뀐다, 글이 길면 칩이 넓어진다, ctrl 을 옮기면 상자가 커진다.
import { describe, expect, it } from 'vitest';
import { aabbIntersects, objectBounds, overlappingIds } from './bounds.ts';
import type { AABB } from './bounds.ts';
import type { ArrowId, BallId, ChairId, ConeId, NoteId, ShapeId, StepId, StrokeId } from '../core/ids.ts';
import type { DrillCast, DrillStep } from '../model/drill.ts';

const w = (b: AABB | null): number => (b ? b.maxX - b.minX : NaN);
const h = (b: AABB | null): number => (b ? b.maxY - b.minY : NaN);

const chA = 'ch_a' as ChairId;
const chB = 'ch_b' as ChairId;
const blA = 'bl_a' as BallId;
const cnA = 'cn_a' as ConeId;

const emptyStep = (over: Partial<DrillStep> = {}): DrillStep => ({
  id: 'se_1' as StepId,
  name: '',
  note: '',
  chairs: {},
  balls: {},
  cones: {},
  arrows: [],
  notes: [],
  shapes: [],
  ...over,
});

const cast = (over: Partial<DrillCast> = {}): DrillCast => ({
  chairs: [],
  balls: [],
  cones: [],
  ...over,
});

describe('objectBounds — 회전한 휠체어', () => {
  it('0° 와 90° 에서 상자의 가로·세로가 서로 바뀐다 — 회전이 반영되지 않으면 옆으로 선 휠체어에 가린 개체를 못 꺼낸다', () => {
    const front = objectBounds('chair', { x: 100, y: 100, theta: 0 });
    const side = objectBounds('chair', { x: 100, y: 100, theta: Math.PI / 2 });
    // 차체는 정사각형이 아니다(앞뒤 1.5 m × 폭 1.0 m) — 그러므로 90° 돌리면 두 변이 맞바뀐다.
    expect(w(front)).toBeCloseTo(h(side), 6);
    expect(h(front)).toBeCloseTo(w(side), 6);
    // 그리고 실제로 **다른 값**이어야 한다. 이 줄이 없으면 상자를 정사각형으로 잘못 만들어도
    // 위 두 단언이 통과한다(가로=세로면 맞바꿔도 같다).
    expect(w(front)).toBeGreaterThan(h(front));
  });

  it('상자 중심이 피벗보다 앞에 있다 — 차체는 피벗을 중심으로 대칭이 아니다(앞 1.2 m · 뒤 0.3 m)', () => {
    const b = objectBounds('chair', { x: 100, y: 100, theta: 0 })!;
    // 정면(θ=0)에서 +x 가 앞이다. 피벗(100)에서 앞쪽 여유가 뒤쪽보다 커야 한다 —
    // 피벗을 중심으로 대칭인 상자를 만들면 앞범퍼에 가린 개체가 겹침 목록에서 빠진다.
    expect(b.maxX - 100).toBeGreaterThan(100 - b.minX);
  });
});

describe('objectBounds — 메모 칩은 글을 따라간다', () => {
  it('글이 길수록 칩이 넓어지고, 줄이 늘면 높아진다 — 고정 반지름으로 재면 긴 메모가 덮은 개체를 못 꺼낸다', () => {
    const at = { id: 'nt_1' as NoteId, x: 0, y: 0 };
    const short = objectBounds('note', { ...at, text: '가' });
    const long = objectBounds('note', { ...at, text: '아주 긴 메모 한 줄' });
    const twoLines = objectBounds('note', { ...at, text: '가\n나' });
    expect(w(long)).toBeGreaterThan(w(short));
    expect(h(twoLines)).toBeGreaterThan(h(short));
    // 한 줄짜리는 높이가 같다 — 폭 계산이 높이까지 흔들면 짧은 메모의 상자가 제멋대로 커진다.
    expect(h(long)).toBeCloseTo(h(short), 6);
  });

  it('상자가 앵커를 가운데 둔다 — 칩은 좌상단이 아니라 중심이 앵커다(§3.5)', () => {
    const b = objectBounds('note', { id: 'nt_1' as NoteId, x: 50, y: 40, text: '아주 긴 메모' })!;
    expect((b.minX + b.maxX) / 2).toBeCloseTo(50, 6);
    expect((b.minY + b.maxY) / 2).toBeCloseTo(40, 6);
  });
});

describe('objectBounds — 화살표는 굽힘점을 포함한다', () => {
  it('ctrl 을 밖으로 밀면 상자가 커진다 — 끝점 둘만 재면 크게 굽은 화살표의 배가 겹침에서 빠진다', () => {
    const from = { x: 0, y: 0 };
    const to = { x: 100, y: 0 };
    const straight = objectBounds('arrow', { id: 'ar_1' as ArrowId, from, ctrl: { x: 50, y: 0 }, to });
    const bowed = objectBounds('arrow', { id: 'ar_1' as ArrowId, from, ctrl: { x: 50, y: 80 }, to });
    expect(h(bowed)).toBeGreaterThan(h(straight));
    expect(bowed!.maxY).toBeGreaterThan(straight!.maxY);
  });

  it('선폭 반만큼 부푼다 — 0 폭 선으로 재면 굵은 선끼리 스치는 겹침을 놓친다', () => {
    const p = { x: 0, y: 0 };
    const b = objectBounds('arrow', { id: 'ar_1' as ArrowId, from: p, ctrl: p, to: p })!;
    expect(b.maxX - b.minX).toBeGreaterThan(0);
  });
});

describe('objectBounds — 획은 굵기를 따라간다', () => {
  it('굵은 획(width 2)의 상자가 가는 획(width 0)보다 크다 — 굵기를 무시하면 나란히 그은 두 선의 겹침이 안 잡힌다', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ];
    const thin = objectBounds('stroke', { id: 'fh_1' as StrokeId, points, width: 0 });
    const thick = objectBounds('stroke', { id: 'fh_1' as StrokeId, points, width: 2 });
    expect(h(thick)).toBeGreaterThan(h(thin));
  });

  it('점이 0개면 null — 상자 없음과 0×0 상자는 다르다(원점에 있지도 않은 획이 원점의 개체와 겹친 것이 된다)', () => {
    expect(objectBounds('stroke', { id: 'fh_1' as StrokeId, points: [] })).toBeNull();
  });
});

describe('objectBounds — 도형은 회전을 포함한다', () => {
  it('45° 돌린 직사각형의 상자가 안 돌린 것보다 넓다 — 회전을 빼먹으면 비스듬한 도형의 모서리가 겹침에서 빠진다', () => {
    const base = { id: 'sh_1' as ShapeId, kind: 'rect' as const, x: 0, y: 0, w: 100, h: 40 };
    const flat = objectBounds('shape', { ...base, rot: 0 });
    const tilted = objectBounds('shape', { ...base, rot: 45 });
    expect(h(tilted)).toBeGreaterThan(h(flat));
    expect(w(tilted)).toBeLessThan(w(flat));
  });
});

describe('aabbIntersects — 접촉 경계', () => {
  it('변이 정확히 맞닿으면 겹침이다 — 딱 붙여 놓은 두 개체 사이에서 [한 단계 앞으로]가 죽으면 안 된다', () => {
    const a: AABB = { minX: 0, minY: 0, maxX: 10, maxY: 10 };
    const touch: AABB = { minX: 10, minY: 0, maxX: 20, maxY: 10 };
    const apart: AABB = { minX: 10.001, minY: 0, maxX: 20, maxY: 10 };
    expect(aabbIntersects(a, touch)).toBe(true);
    expect(aabbIntersects(a, apart)).toBe(false);
    // 한 축만 겹치는 것은 겹침이 아니다 — 축 하나를 빼먹은 판정은 판을 통째로 겹친 것으로 본다.
    expect(aabbIntersects(a, { minX: 0, minY: 20, maxX: 10, maxY: 30 })).toBe(false);
  });
});

describe('overlappingIds', () => {
  it('그 스텝에 포즈가 없는 캐스트 개체는 세지 않는다 — 안 보이는 휠체어 때문에 항목이 켜지면 눌러도 화면이 안 바뀐다', () => {
    const c = cast({
      chairs: [
        { id: chA, team: 'home', number: '2', isGk: false },
        { id: chB, team: 'home', number: '3', isGk: false },
      ],
    });
    // 같은 자리에 겹쳐 세운 두 대. chB 는 **이 스텝에만** 포즈가 있다/없다로 갈린다.
    const both = emptyStep({
      chairs: { [chA]: { x: 100, y: 100, angleDeg: 0 }, [chB]: { x: 100, y: 100, angleDeg: 0 } },
    });
    const onlyA = emptyStep({ chairs: { [chA]: { x: 100, y: 100, angleDeg: 0 } } });
    expect(overlappingIds(both, c, chA)).toEqual(new Set([chB]));
    expect(overlappingIds(onlyA, c, chA)).toEqual(new Set());
  });

  it('스텝에 없는 id 를 물으면 빈 집합 — 지운 개체를 물었을 때 다른 개체가 딸려 나오면 안 된다', () => {
    const c = cast({ balls: [{ id: blA }] });
    const step = emptyStep({ balls: { [blA]: { x: 0, y: 0 } } });
    expect(overlappingIds(step, c, 'bl_gone')).toEqual(new Set());
  });

  it('종류를 가리지 않고 모은다 — 공·콘·메모·화살표·도형·획이 한 목록이라야 층을 넘어 순서를 바꿀 수 있다', () => {
    const c = cast({ balls: [{ id: blA }], cones: [{ id: cnA, colorIndex: 0 }] });
    const step = emptyStep({
      balls: { [blA]: { x: 0, y: 0 } },
      cones: { [cnA]: { x: 0, y: 0 } },
      notes: [{ id: 'nt_1' as NoteId, x: 0, y: 0, text: '가' }],
      arrows: [{ id: 'ar_1' as ArrowId, from: { x: 0, y: 0 }, ctrl: { x: 0, y: 0 }, to: { x: 0, y: 0 } }],
      shapes: [{ id: 'sh_1' as ShapeId, kind: 'rect', x: 0, y: 0, w: 40, h: 40, rot: 0 }],
      strokes: [{ id: 'fh_1' as StrokeId, points: [{ x: 0, y: 0 }] }],
    });
    expect(overlappingIds(step, c, blA)).toEqual(new Set([cnA, 'nt_1', 'ar_1', 'sh_1', 'fh_1']));
    // 자기 자신은 결과에 없다 — 있으면 [한 단계 앞으로]가 자기를 자기 위로 보내려 든다.
    expect(overlappingIds(step, c, blA).has(blA)).toBe(false);
  });

  it('잠긴·무시된 개체도 포함한다 — 나를 가린 것이 잠겼다는 이유로 순서를 못 바꾸면 그 상황이야말로 못 빠져나온다', () => {
    const c = cast({
      chairs: [
        { id: chA, team: 'home', number: '2', isGk: false },
        { id: chB, team: 'away', number: '3', isGk: false },
      ],
    });
    const step = emptyStep({
      chairs: { [chA]: { x: 100, y: 100, angleDeg: 0 }, [chB]: { x: 100, y: 100, angleDeg: 0 } },
      locked: [chB],
      ignored: [chB],
    });
    expect(overlappingIds(step, c, chA)).toEqual(new Set([chB]));
  });

  it('멀리 떨어진 개체는 안 센다 — 전부 겹쳤다고 답하면 문지기가 아무것도 안 막는다', () => {
    const c = cast({ balls: [{ id: blA }], cones: [{ id: cnA, colorIndex: 0 }] });
    const step = emptyStep({ balls: { [blA]: { x: 0, y: 0 } }, cones: { [cnA]: { x: 500, y: 500 } } });
    expect(overlappingIds(step, c, blA)).toEqual(new Set());
  });
});
