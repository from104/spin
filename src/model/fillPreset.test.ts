// §5.4 C-3 — **[포메이션으로 채우기]가 코트 모드별로 무엇을 놓는가**를 표로 못박고 전수 순회한다.
//
// 계획서 5.4 완료 판정: *"3종 코트 × 포메이션 조합을 표로 못박고 각각 '전부 surface 안' 단언"*.
// 5.1 이 코트를 3단으로 늘렸으므로 실제 조합은 **(full 3단 + half + flat) × 포메이션 3 = 27** 이다.
// 손으로 쓴 it 은 조합이 늘면 반드시 빠지므로 **표를 순회**한다 — 코트나 포메이션이 하나 늘면
// 이 파일을 고치지 않아도 새 조합이 저절로 검사된다.
import { describe, expect, it } from 'vitest';
import { BALL, CHAIR } from '../core/constants.ts';
import type { Vec2 } from '../core/units.ts';
import { chairsOverlap } from '../physics/obb.ts';
import { COURT_MODES, COURT_SIZES, courtDefFor, isOnSurface, type CourtMode, type CourtSize } from './court.ts';
import { chairCorners, poseFromStored, type ChairPose } from './chair.ts';
import { createDrill, defaultStep, FORMATIONS, formationSlots, type FormationName } from './defaults.ts';
import { COURT_FILL_SPECS, applyPlacement, fillSummary, formationPlan } from './fillPreset.ts';
import type { Drill } from './drill.ts';

/** 원 중심(공)과 회전 사각형(차체) 사이의 표면 거리 — defaults.test.ts 와 같은 식이다. */
function ballGap(ball: Vec2, pose: ChairPose): number {
  const u = { x: Math.cos(pose.theta), y: Math.sin(pose.theta) };
  const v = { x: -u.y, y: u.x };
  const rx = ball.x - pose.x;
  const ry = ball.y - pose.y;
  const lx = rx * u.x + ry * u.y;
  const ly = rx * v.x + ry * v.y;
  const cx = Math.min(Math.max(lx, -CHAIR.pivotToRearPx), CHAIR.pivotToFrontPx);
  const cy = Math.min(Math.max(ly, -CHAIR.widthPx / 2), CHAIR.widthPx / 2);
  return Math.hypot(lx - cx, ly - cy) - BALL.radiusPx;
}

const seatKey = (team: string, number: string) => `${team}/${number}`;
const build = (mode: CourtMode, size: CourtSize, formation: FormationName): Drill =>
  createDrill({ courtMode: mode, courtSize: size, formation });

/** (mode, size, formation) 전수 조합. 표가 아니라 **축의 곱**이라 축이 늘면 저절로 커진다. */
const COMBOS = COURT_MODES.flatMap((mode) =>
  COURT_SIZES.flatMap((size) => FORMATIONS.map((formation) => ({ mode, size, formation }))),
);

describe('§5.4 C-3 [포메이션으로 채우기] — 코트 × 크기 × 포메이션 전수', () => {
  it('대조군 — 조합이 실제로 27개다(축이 하나 죽으면 여기가 먼저 빨개진다)', () => {
    expect(COMBOS).toHaveLength(27);
    expect(new Set(COMBOS.map((c) => `${c.mode}|${c.size}|${c.formation}`)).size).toBe(27);
    // 표가 코트 3종을 빠짐없이 덮는다.
    expect(Object.keys(COURT_FILL_SPECS).sort()).toEqual([...COURT_MODES].sort());
  });

  for (const { mode, size, formation } of COMBOS) {
    it(`${mode} · ${size} · ${formation}: 표대로 놓이고 전부 surface 안 · 겹침 없음`, () => {
      const spec = COURT_FILL_SPECS[mode];
      const d = build(mode, size, formation);
      const plan = formationPlan(d);

      // ① 대수 — 표가 말하는 그대로. 0대를 세고 통과하는 길을 막는다.
      const placed = d.cast.chairs.filter((c) => plan.chairs[c.id] !== undefined);
      expect(placed.length, '놓인 대수').toBe(spec.chairs);
      expect(spec.chairs).toBeGreaterThan(0);

      // ② **어느 자리가 비는가** — 표에 적힌 자리만 비고, 나머지는 전부 놓인다(양방향).
      const missing = d.cast.chairs.filter((c) => plan.chairs[c.id] === undefined).map((c) => seatKey(c.team, c.number));
      expect(missing.sort()).toEqual(spec.unplaced.map((u) => seatKey(u.team, u.number)).sort());

      // ③ 공
      expect(plan.ball !== null).toBe(spec.ball);

      // ④ **전부 surface 안** — 피벗만이 아니라 차체 hull 네 귀퉁이까지. 피벗만 재면
      //    골라인에 걸터앉은 배치가 통과한다(defaults.test.ts 와 같은 규율).
      for (const c of placed) {
        const p = plan.chairs[c.id]!;
        expect(isOnSurface(mode, p, size), `${seatKey(c.team, c.number)} pivot`).toBe(true);
        for (const corner of chairCorners(poseFromStored(p))) {
          expect(isOnSurface(mode, corner, size), `${seatKey(c.team, c.number)} corner`).toBe(true);
        }
      }
      if (plan.ball) expect(isOnSurface(mode, plan.ball, size), '공').toBe(true);

      // ⑤ 겹침 없음 · 공-가드 간격
      const poses = placed.map((c) => poseFromStored(plan.chairs[c.id]!));
      for (let i = 0; i < poses.length; i++) {
        for (let j = i + 1; j < poses.length; j++) {
          expect(chairsOverlap(poses[i]!, poses[j]!, 4), `${i}-${j}`).toBe(false);
        }
      }
      if (plan.ball) expect(Math.min(...poses.map((p) => ballGap(plan.ball!, p)))).toBeGreaterThanOrEqual(2 - 1e-6);
    });
  }

  // ── 표의 boolean 두 개는 **양쪽 다** 단언한다 ────────────────────────────────────────
  // "A 를 빼고 B 로 한다" 에서 A 만 단언했더니 B 를 통째로 주석 처리해도 전건 초록이었다는
  // 이 저장소의 실측이 있다. formationAware/sizeAware 는 그 형태의 문장이다.
  describe('formationAware — full 만 포메이션을 탄다', () => {
    for (const mode of COURT_MODES) {
      it(`${mode}: ${COURT_FILL_SPECS[mode].formationAware ? '포메이션마다 다르다' : '포메이션이 달라도 같다'}`, () => {
        const coords = FORMATIONS.map((f) => {
          const d = build(mode, '30x18', f);
          const plan = formationPlan(d);
          return d.cast.chairs.map((c) => JSON.stringify(plan.chairs[c.id] ?? null)).join('|');
        });
        if (COURT_FILL_SPECS[mode].formationAware) expect(new Set(coords).size).toBe(FORMATIONS.length);
        else expect(new Set(coords).size).toBe(1);
      });
    }
  });

  describe('sizeAware — full 만 코트 크기 3단을 탄다', () => {
    for (const mode of COURT_MODES) {
      it(`${mode}: ${COURT_FILL_SPECS[mode].sizeAware ? '크기마다 다르다' : '크기가 달라도 같다'}`, () => {
        const coords = COURT_SIZES.map((s) => {
          const d = build(mode, s, '1-2-1');
          const plan = formationPlan(d);
          return d.cast.chairs.map((c) => JSON.stringify(plan.chairs[c.id] ?? null)).join('|');
        });
        if (COURT_FILL_SPECS[mode].sizeAware) expect(new Set(coords).size).toBe(COURT_SIZES.length);
        else expect(new Set(coords).size).toBe(1);
      });
    }
  });

  // ⚠️ 이 대조군이 없으면 위 27개는 "surface 판정이 아무거나 통과시켜도" 전부 초록불이다.
  // 계획서 5.4 가 콕 집어 경고한 사고를 그대로 재현해 **실제로 빨간불이 나는 입력**을 보인다.
  it('대조군 — 풀 코트 표 좌표를 하프 코트에 그대로 놓으면 코트 밖이다 (계획서가 경고한 사고)', () => {
    const fullSlots = formationSlots('full', '1-2-1');
    const outside = fullSlots.filter((p) => !isOnSurface('half', p));
    expect(outside.length, '풀 좌표 8개 중 하프 경기면 밖').toBeGreaterThan(0);
    // 하프 viewBox(525×450) 자체를 벗어나는 자리도 있다 — 판 밖이다.
    const half = courtDefFor('half');
    expect(fullSlots.some((p) => p.x > half.vbW || p.y > half.vbH)).toBe(true);
    // 그런데 채우기가 실제로 놓는 하프 좌표는 하나도 안 나간다.
    const plan = formationPlan(build('half', '30x18', '1-2-1'));
    for (const p of Object.values(plan.chairs)) expect(isOnSurface('half', p!)).toBe(true);
  });

  it('채우기는 새 드릴의 기본 배치와 **같은 판**이다 (좌표를 두 곳에서 만들지 않는다)', () => {
    for (const { mode, size, formation } of COMBOS) {
      const d = build(mode, size, formation);
      const plan = formationPlan(d);
      const base = defaultStep(mode, formation, d.cast, size);
      for (const c of d.cast.chairs) {
        expect(plan.chairs[c.id], `${mode}/${size}/${formation}/${seatKey(c.team, c.number)}`).toEqual(base.chairs[c.id]);
      }
    }
  });

  it('fillSummary 는 표와 코트 정의에서 문장을 만든다', () => {
    expect(fillSummary('full')).toContain('풀 코트');
    expect(fillSummary('full')).toContain('8대');
    expect(fillSummary('half')).toContain('6대');
    expect(fillSummary('half')).toContain('포메이션 무관');
    expect(fillSummary('full')).toContain('포메이션대로');
  });
});

describe('§5.4 applyPlacement — 계획을 판에 앉힌다', () => {
  it('현재 스텝의 배치를 갈아 끼우고 공을 옮긴다', () => {
    const d = createDrill({ courtMode: 'full' });
    const cleared: Drill = { ...d, steps: [{ ...d.steps[0]!, chairs: {}, balls: {} }] };
    const next = applyPlacement(cleared, 0, formationPlan(d));
    expect(Object.keys(next.steps[0]!.chairs)).toHaveLength(8);
    const ballId = d.cast.balls[0]!.id;
    expect(next.steps[0]!.balls[ballId]).toEqual({ x: 412.5, y: 262.5 });
    // 대조군 — 원본은 그대로다(순수 함수).
    expect(Object.keys(cleared.steps[0]!.chairs)).toHaveLength(0);
  });

  it('캐스트에 공이 없으면(자유 전술판) 공을 만들어 놓는다', () => {
    // ⚠️ 이 갈래가 없으면 전술판에서 채우기가 **공 없는 판**을 놓는다. 전술판은 empty:true 로
    //    태어나 cast.balls 가 0개다(defaults.ts createDrill 주석).
    const board = createDrill({ courtMode: 'full', empty: true });
    expect(board.cast.balls).toHaveLength(0); // 대조군 — 전제가 실제로 성립한다
    const next = applyPlacement(board, 0, formationPlan(board));
    expect(next.cast.balls).toHaveLength(1);
    const id = next.cast.balls[0]!.id;
    expect(next.steps[0]!.balls[id]).toEqual({ x: 412.5, y: 262.5 });
    expect(Object.keys(next.steps[0]!.chairs)).toHaveLength(8);
  });

  it('화살표·메모·콘과 다른 스텝은 건드리지 않는다', () => {
    const d0 = createDrill({ courtMode: 'full' });
    const s0 = d0.steps[0]!;
    const withExtras: Drill = {
      ...d0,
      steps: [
        { ...s0, arrows: [{ id: 'ar_x' as never, from: { x: 100, y: 100 }, ctrl: { x: 150, y: 150 }, to: { x: 200, y: 200 } }], notes: [{ id: 'nt_x' as never, x: 50, y: 50, text: '메모' }] },
        { ...s0, id: 'st_second' as never, chairs: {}, balls: {} },
      ],
    };
    const next = applyPlacement(withExtras, 0, formationPlan(d0));
    expect(next.steps[0]!.arrows).toHaveLength(1);
    expect(next.steps[0]!.notes).toHaveLength(1);
    expect(next.steps[0]!.cones).toEqual(s0.cones);
    // 2번 스텝은 손대지 않는다 — 스텝은 저마다 한 장면이다.
    expect(next.steps[1]!.chairs).toEqual({});
    expect(next.steps).toHaveLength(2);
  });

  it('없는 스텝 번호면 원본 참조를 그대로 돌려준다', () => {
    const d = createDrill({ courtMode: 'full' });
    expect(applyPlacement(d, 7, formationPlan(d))).toBe(d);
  });
});
