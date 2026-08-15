// 자유 삼각형이 **저장·재적재를 살아남는가** (기현 지시 2026-08-15).
//
// shape.test.ts 는 순수 규칙(끌기·히트·손잡이)을 잰다. 여기서 재는 것은 그 규칙이 만든 모양이
// 파일을 한 바퀴 돌아도 그대로인가다 — 이 층이 없으면 화면에서는 자유롭게 그려지는데 저장했다
// 열면 정삼각형으로 되돌아가는, **가장 늦게 발견되는 부류**의 버그가 남는다.
//
// ⚠️ 실제로 그럴 뻔했다: 옛 정화기에 *"삼각형은 w!==h 면 짧은 변으로 맞춘다"* 는 접기가 있었고,
// 그것을 안 지웠으면 새 모델이 매 저장마다 무효가 됐다.
import { describe, expect, it } from 'vitest';
import { DRILL_MIGRATIONS, migrateDoc } from './migrate.ts';
import { CURRENT_DRILL_SCHEMA } from './drill.ts';
import { validateDrill } from './validate.ts';
import { SHAPE_DEFAULT_PX, triBBox, trianglePoints } from './shape.ts';
import { defaultDefense } from './rules.ts';
import type { TriPoints } from './shape.ts';

/** 자유롭게 그린(정삼각형이 아닌) 삼각형 하나. 한 각이 120° 를 넘는 납작한 모양이다. */
const FREE: TriPoints = [
  { x: -150, y: 20 },
  { x: 150, y: 20 },
  { x: 0, y: -40 },
];

const drillWith = (shapes: unknown[], schemaVersion = CURRENT_DRILL_SCHEMA) => ({
  schemaVersion,
  id: 'dr_tri',
  title: '삼각형',
  category: '',
  level: 'beginner',
  durationMin: 10,
  tags: [],
  courtMode: 'full',
  courtSize: '30x18',
  cast: { chairs: [], balls: [], cones: [] },
  steps: [{ id: 'st_1', name: '', note: '', chairs: {}, balls: {}, cones: {}, arrows: [], notes: [], shapes }],
});

const shapesOf = (doc: unknown) => (doc as { steps: Array<{ shapes: Array<Record<string, unknown>> }> }).steps[0]!.shapes;

describe('정화기 — 자유 삼각형은 접히지 않는다', () => {
  it('★ 꼭짓점이 그대로 살아남는다 — 옛 "정삼각형 접기" 가 남아 있으면 여기서 걸린다', () => {
    const v = validateDrill(drillWith([{ id: 'sh_1', kind: 'triangle', x: 400, y: 260, w: 300, h: 60, rot: 0, pts: FREE }]));
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    const s = v.value.steps[0]!.shapes[0]!;
    expect(s.pts, '정화기가 꼭짓점을 버렸다').toEqual(FREE);
    // w/h 는 **받아 적는 값**이라 경계상자로 덮인다 — 넣어 준 300×60 이 아니라 실제 300×60 이다.
    expect({ w: s.w, h: s.h }).toEqual(triBBox(FREE));
  });

  it('w/h 가 꼭짓점과 어긋나 있으면 꼭짓점이 이긴다', () => {
    const v = validateDrill(drillWith([{ id: 'sh_1', kind: 'triangle', x: 400, y: 260, w: 999, h: 7, rot: 0, pts: FREE }]));
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    const s = v.value.steps[0]!.shapes[0]!;
    expect(s.pts).toEqual(FREE);
    expect({ w: s.w, h: s.h }).toEqual(triBBox(FREE));
  });

  it('무게중심이 어긋나 있으면 되세우고, **화면상 자리는 안 바뀐다**', () => {
    // 세 점의 합이 (0,0) 이 아니다 — 손편집·옛 도구가 만들 수 있는 상태다.
    const off: TriPoints = [
      { x: 60, y: -40 },
      { x: -30, y: 50 },
      { x: 90, y: 50 },
    ];
    const v = validateDrill(drillWith([{ id: 'sh_1', kind: 'triangle', x: 400, y: 260, w: 120, h: 90, rot: 0, pts: off }]));
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    const s = v.value.steps[0]!.shapes[0]!;
    const sum = s.pts!.reduce((a, p) => ({ x: a.x + p.x, y: a.y + p.y }), { x: 0, y: 0 });
    expect(sum.x).toBeCloseTo(0, 9);
    expect(sum.y).toBeCloseTo(0, 9);
    // ★ 중심이 그만큼 옮겨졌으므로 꼭짓점의 **월드 좌표**는 하나도 안 움직인다.
    for (let i = 0; i < 3; i++) {
      expect(s.x + s.pts![i]!.x).toBeCloseTo(400 + off[i]!.x, 9);
      expect(s.y + s.pts![i]!.y).toBeCloseTo(260 + off[i]!.y, 9);
    }
  });

  it('한 줄로 선 꼭짓점은 정삼각형으로 되돌리고 수리로 알린다 — 안 보이는 도형은 못 지운다', () => {
    const line: TriPoints = [
      { x: -100, y: 0 },
      { x: 100, y: 0 },
      { x: 0, y: 0 },
    ];
    const v = validateDrill(drillWith([{ id: 'sh_1', kind: 'triangle', x: 400, y: 260, w: 120, h: 120, rot: 0, pts: line }]));
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.value.steps[0]!.shapes[0]!.pts).toEqual(trianglePoints(120));
    expect(v.repairs.some((r) => r.path === 'steps.shapes.pts'), '조용히 고쳤다').toBe(true);
  });

  it('망가진 pts 는 통째로 버리고 정삼각형으로 — 반쯤 맞는 삼각형을 만들지 않는다', () => {
    for (const bad of [[{ x: 1, y: 2 }], 'nope', [{ x: 1, y: 2 }, { x: 3, y: 4 }, { x: 'a', y: 6 }], [{ x: 0, y: Infinity }, { x: 1, y: 1 }, { x: 2, y: 2 }]]) {
      const v = validateDrill(drillWith([{ id: 'sh_1', kind: 'triangle', x: 400, y: 260, w: 120, h: 120, rot: 0, pts: bad }]));
      expect(v.ok).toBe(true);
      if (!v.ok) continue;
      expect(v.value.steps[0]!.shapes[0]!.pts).toEqual(trianglePoints(120));
    }
  });

  it('타원·사각형은 pts 를 안 받는다 — 있어도 무시한다(모양의 출처가 둘이 되면 안 된다)', () => {
    const v = validateDrill(drillWith([{ id: 'sh_1', kind: 'rect', x: 400, y: 260, w: 200, h: 80, rot: 0, pts: FREE }]));
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    const s = v.value.steps[0]!.shapes[0]!;
    expect(s.pts).toBeUndefined();
    expect({ w: s.w, h: s.h }).toEqual({ w: 200, h: 80 });
  });
});

describe('마이그레이션 v4→v5 — 옛 정삼각형이 꼭짓점을 받는다', () => {
  it('★ pts 가 없는 삼각형에 정삼각형 꼭짓점이 찍힌다', () => {
    const doc = drillWith([{ id: 'sh_1', kind: 'triangle', x: 400, y: 260, w: 160, h: 160, rot: 30 }], 4);
    const m = migrateDoc(doc, DRILL_MIGRATIONS, CURRENT_DRILL_SCHEMA);
    expect(m.ok).toBe(true);
    if (!m.ok) return;
    const s = shapesOf(m.doc)[0]!;
    // 옛 규약대로 **w 가 한 변**이다. min(w,h) 로 읽으면 13.4% 작아진다.
    expect(s.pts).toEqual(trianglePoints(160).map((p) => ({ x: p.x, y: p.y })));
    // h 는 이제 실제 높이다 — 옛 모델의 h(=한 변)는 어디에도 안 쓰이던 값이었다.
    expect(s.h).toBeCloseTo((160 * Math.sqrt(3)) / 2, 6);
    expect(s.rot, '다른 필드를 건드렸다').toBe(30);
  });

  it('이미 pts 가 있으면 손대지 않는다 — 두 번 돌아도 모양이 안 바뀐다', () => {
    const doc = drillWith([{ id: 'sh_1', kind: 'triangle', x: 400, y: 260, w: 300, h: 60, rot: 0, pts: FREE }], 4);
    const m = migrateDoc(doc, DRILL_MIGRATIONS, CURRENT_DRILL_SCHEMA);
    expect(m.ok).toBe(true);
    if (!m.ok) return;
    expect(shapesOf(m.doc)[0]!.pts).toEqual(FREE);
  });

  it('타원·사각형은 안 건드린다', () => {
    const doc = drillWith(
      [
        { id: 'sh_1', kind: 'rect', x: 400, y: 260, w: 200, h: 80, rot: 0 },
        { id: 'sh_2', kind: 'ellipse', x: 100, y: 100, w: 90, h: 40, rot: 0 },
      ],
      4,
    );
    const m = migrateDoc(doc, DRILL_MIGRATIONS, CURRENT_DRILL_SCHEMA);
    expect(m.ok).toBe(true);
    if (!m.ok) return;
    expect(shapesOf(m.doc)).toEqual(shapesOf(doc));
  });

  it('w 가 없는 삼각형도 죽지 않는다 — 기본 크기로 선다', () => {
    const doc = drillWith([{ id: 'sh_1', kind: 'triangle', x: 400, y: 260, rot: 0 }], 4);
    const m = migrateDoc(doc, DRILL_MIGRATIONS, CURRENT_DRILL_SCHEMA);
    expect(m.ok).toBe(true);
    if (!m.ok) return;
    expect(shapesOf(m.doc)[0]!.pts).toEqual(trianglePoints(SHAPE_DEFAULT_PX).map((p) => ({ x: p.x, y: p.y })));
  });

  it('★ 마이그레이션 → 정화기 왕복에서 모양이 한 번도 안 바뀐다', () => {
    const doc = drillWith([{ id: 'sh_1', kind: 'triangle', x: 400, y: 260, w: 300, h: 60, rot: 0, pts: FREE }], 4);
    const m = migrateDoc(doc, DRILL_MIGRATIONS, CURRENT_DRILL_SCHEMA);
    expect(m.ok).toBe(true);
    if (!m.ok) return;
    const v = validateDrill(m.doc);
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.value.steps[0]!.shapes[0]!.pts).toEqual(FREE);
  });
});

describe('마이그레이션 v5→v6 — 옛 드릴이 진영을 받는다', () => {
  const bare = (courtMode: string) => ({ ...drillWith([], 5), courtMode, defense: undefined });

  it('★ 진영이 없으면 기본 배치의 골키퍼 자리를 따른다', () => {
    // 풀은 홈 GK 가 왼쪽 골(ruleZones[0]), 하프는 원정 GK 만 놓인다 — 즉 이 값이 "지금까지
    // 판이 실제로 보이던 모습" 이다. 정화기의 폴백(`defaultDefense`)과 **같은 값**이라야
    // 마이그레이션을 지난 파일과 안 지난 파일이 다른 팀을 붉게 칠하지 않는다.
    for (const [mode, want] of [
      ['full', 'home'],
      ['half', 'away'],
      ['flat', 'home'],
    ] as const) {
      const m = migrateDoc(bare(mode), DRILL_MIGRATIONS, CURRENT_DRILL_SCHEMA);
      expect(m.ok).toBe(true);
      if (!m.ok) continue;
      expect((m.doc as { defense: string }).defense, mode).toBe(want);
      expect(defaultDefense(mode), `${mode}: 정화기 폴백과 갈라졌다`).toBe(want);
    }
  });

  it('이미 진영이 있으면 손대지 않는다', () => {
    const doc = { ...drillWith([], 5), courtMode: 'full', defense: 'away' };
    const m = migrateDoc(doc, DRILL_MIGRATIONS, CURRENT_DRILL_SCHEMA);
    expect(m.ok).toBe(true);
    if (!m.ok) return;
    expect((m.doc as { defense: string }).defense).toBe('away');
  });

  it('알 수 없는 코트 종류는 풀로 읽는다 — 손편집 파일이 죽지 않는다', () => {
    const m = migrateDoc({ ...drillWith([], 5), courtMode: 'nonsense' }, DRILL_MIGRATIONS, CURRENT_DRILL_SCHEMA);
    expect(m.ok).toBe(true);
    if (!m.ok) return;
    expect((m.doc as { defense: string }).defense).toBe('home');
  });

  it('★ 정화기도 같은 폴백을 쓴다 — 도장 없는 문서와 지난 문서가 같은 진영이다', () => {
    const raw = { ...drillWith([], CURRENT_DRILL_SCHEMA), courtMode: 'half', defense: undefined };
    const v = validateDrill(raw);
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.value.defense).toBe('away');
  });

  it('알 수 없는 진영 값은 기본값으로 접고 수리로 알린다', () => {
    const v = validateDrill({ ...drillWith([], CURRENT_DRILL_SCHEMA), courtMode: 'full', defense: 'nope' });
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.value.defense).toBe('home');
    expect(v.repairs.some((r) => r.path === 'defense'), '조용히 고쳤다').toBe(true);
  });
});
