// §5.4 C-2 — **세트피스 시작 배치 프리셋**. 규정(FIPFA Laws 2025)과 배치가 맞는지 잰다.
//
// 축 열거: 코트 3종(full/half/flat) × 코트 크기 3단(30x18/28x15/25x14) × 세트피스 3종
// (킥인/코너킥/골 클리어런스) × 포메이션 3종 — 전수로 돈다. "어느 축을 안 찔렀나" 가 이
// 저장소가 실제로 겪은 헛통과 1형태다(구현자 셋이 세로 배치만 찔렀다).
import { describe, expect, it } from 'vitest';
import { BALL, CHAIR } from '../core/constants.ts';
import { mToPx, type Vec2 } from '../core/units.ts';
import { storedDegToRad, wrapPi } from '../core/angle.ts';
import { chairsOverlap } from '../physics/obb.ts';
import { COURT_SIZES, courtDefFor, isOnSurface, type CourtMode, type CourtSize } from './court.ts';
import { chairCorners, poseFromStored } from './chair.ts';
import { createDrill, defaultStep, FORMATIONS, type FormationName } from './defaults.ts';
import { inRect, RING_R_PX } from './rules.ts';
import { applyPlacement } from './fillPreset.ts';
import { CLEAR_PX, SET_PIECE_DEFS, SET_PIECE_KINDS, setPieceGeometry, setPieceKindsFor, setPiecePlan } from './setPiece.ts';
import type { ChairDef, Drill } from './drill.ts';

const dist = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y);
const build = (mode: CourtMode, size: CourtSize, formation: FormationName): Drill =>
  createDrill({ courtMode: mode, courtSize: size, formation });
const seat = (c: ChairDef) => `${c.team}/${c.number}`;

/** 라인 코트(세트피스가 있는 코트) 조합 — flat 은 따로 본다. */
const LINE_COMBOS = (['full', 'half'] as const).flatMap((mode) =>
  COURT_SIZES.flatMap((size) => SET_PIECE_KINDS.map((kind) => ({ mode, size, kind }))),
);

describe('§5.4 C-2 세트피스 — 어느 코트가 무엇을 갖는가', () => {
  it('플랫 코트에는 세트피스가 **하나도 없다**(라인이 없어 기준점이 없다) · 라인 코트는 3종 다', () => {
    expect(setPieceKindsFor('flat')).toEqual([]);
    for (const mode of ['full', 'half'] as const) {
      expect(setPieceKindsFor(mode), mode).toEqual([...SET_PIECE_KINDS]);
    }
    // 뒷문장에도 단언한다 — flat 은 계획도 기하도 null 이어야 한다(그냥 빈 계획이 아니다).
    for (const kind of SET_PIECE_KINDS) {
      const d = build('flat', '30x18', '1-2-1');
      expect(setPiecePlan(d, kind), kind).toBeNull();
      expect(setPieceGeometry(d, kind), kind).toBeNull();
    }
    // 대조군 — flat 코트에도 개체는 있다(코트가 비어서 null 인 것이 아니다).
    expect(build('flat', '30x18', '1-2-1').cast.chairs).toHaveLength(8);
  });

  it('이격 거리의 **기준점이 상황마다 다르다** — 코너킥만 공이 아니다', () => {
    expect(SET_PIECE_DEFS.kickIn.ref).toBe('ball');
    expect(SET_PIECE_DEFS.goalClearance.ref).toBe('ball');
    expect(SET_PIECE_DEFS.corner.ref).toBe('cornerTriangle');
    // 표가 실제로 두 종류를 갖는다 — 하나로 뭉치면 여기가 먼저 빨개진다.
    expect(new Set(SET_PIECE_KINDS.map((k) => SET_PIECE_DEFS[k].ref)).size).toBe(2);
    expect(SET_PIECE_DEFS.corner.law).toBe('Law 17');
    expect(CLEAR_PX).toBe(mToPx(5));
  });
});

describe('§5.4 C-2 세트피스 배치 — 코트 × 크기 × 종류 × 포메이션 전수', () => {
  it('대조군 — 라인 코트 조합이 실제로 18개다', () => {
    expect(LINE_COMBOS).toHaveLength(18);
  });

  for (const { mode, size, kind } of LINE_COMBOS) {
    it(`${mode} · ${size} · ${SET_PIECE_DEFS[kind].label}: 규정 이격 · 전부 판 안 · 겹침 없음`, () => {
      for (const formation of FORMATIONS) {
        const tag = `${mode}/${size}/${kind}/${formation}`;
        const d = build(mode, size, formation);
        const def = courtDefFor(mode, size);
        const geom = setPieceGeometry(d, kind)!;
        const plan = setPiecePlan(d, kind)!;
        expect(geom, tag).not.toBeNull();
        expect(plan, tag).not.toBeNull();
        expect(plan.ball, tag).not.toBeNull();

        const placed = d.cast.chairs.filter((c) => plan.chairs[c.id] !== undefined);
        // 대조군 — 0대를 재고 통과하는 길을 막는다. 기본 배치와 **같은 대수**를 유지한다
        // (프리셋이 사람을 잃거나 만들지 않는다).
        const base = defaultStep(mode, formation, d.cast, size);
        expect(placed.length, `${tag} 대수`).toBe(Object.keys(base.chairs).length);
        expect(placed.length).toBeGreaterThanOrEqual(6);

        const ball = plan.ball!;
        // ① 상대(물러서는 팀)는 **기준점**에서 5 m 이상. 여유를 주지 않는다 — 미달은 미달이다.
        const guards = placed.filter((c) => c.team === geom.guard);
        expect(guards.length, `${tag} 상대 인원`).toBeGreaterThanOrEqual(2);
        for (const c of guards) {
          expect(dist(plan.chairs[c.id]!, geom.ref), `${tag} ${seat(c)} → 기준점`).toBeGreaterThanOrEqual(CLEAR_PX);
        }

        // ② 키커 외 우리 팀은 공에서 3 m 이상(Law 8 세트볼) — 공 3 m 안은 **정확히 1명**이다.
        const inRing = placed.filter((c) => dist(plan.chairs[c.id]!, ball) < RING_R_PX);
        expect(inRing.map(seat), `${tag} 공 3 m 안`).toHaveLength(1);
        expect(inRing[0]!.team, `${tag} 그 1명은 재개하는 팀`).toBe(geom.restart);
        // 골 클리어런스는 GK 가 찬다(다른 둘은 필드 플레이어).
        expect(inRing[0]!.isGk, `${tag} 키커가 GK 인가`).toBe(kind === 'goalClearance');

        // ③ 키커는 공을 마주 보고, 가드와 공 사이가 2 px 이상 떨어져 있다.
        const kicker = poseFromStored(plan.chairs[inRing[0]!.id]!);
        const wanted = Math.atan2(ball.y - kicker.y, ball.x - kicker.x);
        // ⚠️ 랩(−180 ↔ 180)을 건너 비교해야 한다 — 하프 코트 킥인의 키커가 정확히 180° 라
        //    단순 뺄셈으로 재면 2π 가 나온다(2026-08-13 실측).
        expect(Math.abs(wrapPi(storedDegToRad(plan.chairs[inRing[0]!.id]!.angleDeg) - wanted)), `${tag} 키커 방향`).toBeLessThan(0.02);
        expect(dist(kicker, ball) - CHAIR.pivotToFrontPx - BALL.radiusPx, `${tag} 공-가드`).toBeGreaterThanOrEqual(2 - 1e-6);

        // ④ 전부 경기면 안(피벗) · 차체 hull 은 viewBox 안. 세트피스는 라인 밖 대기도
        //    허용되는 배치라 hull 까지 surface 를 요구하지 않는다 — 판(viewBox) 밖은 금지다.
        for (const c of placed) {
          const p = plan.chairs[c.id]!;
          expect(isOnSurface(mode, p, size), `${tag} ${seat(c)} pivot`).toBe(true);
          for (const corner of chairCorners(poseFromStored(p))) {
            expect(corner.x, `${tag} ${seat(c)} hull x`).toBeGreaterThanOrEqual(-1e-6);
            expect(corner.x).toBeLessThanOrEqual(def.vbW + 1e-6);
            expect(corner.y).toBeGreaterThanOrEqual(-1e-6);
            expect(corner.y).toBeLessThanOrEqual(def.vbH + 1e-6);
          }
        }
        expect(isOnSurface(mode, ball, size), `${tag} 공`).toBe(true);

        // ⑤ 겹침 없음(OBB, 여유 4 px).
        const poses = placed.map((c) => poseFromStored(plan.chairs[c.id]!));
        for (let i = 0; i < poses.length; i++) {
          for (let j = i + 1; j < poses.length; j++) {
            expect(chairsOverlap(poses[i]!, poses[j]!, 4), `${tag} ${seat(placed[i]!)}-${seat(placed[j]!)}`).toBe(false);
          }
        }

        // ⑥ **원호가 실제로 돌았다.** 상대 필드 플레이어 전원이 정확히 5 m 선 위에 있다.
        //    (하나라도 자리를 못 찾아 제자리에 남으면 여기서 걸린다.)
        const outfield = guards.filter((c) => !c.isGk);
        const onArc = outfield.filter((c) => dist(plan.chairs[c.id]!, geom.ref) <= CLEAR_PX + 0.3);
        expect(onArc.length, `${tag} 5 m 선 위`).toBe(outfield.length);

        // ⑦ 상대 **GK 는 골문에 남는다** — 기본 배치 그대로이고, 이미 5 m 밖이다.
        for (const c of guards) {
          if (!c.isGk) continue;
          expect(plan.chairs[c.id], `${tag} ${seat(c)} 골문`).toEqual(base.chairs[c.id]);
          expect(dist(plan.chairs[c.id]!, geom.ref), `${tag} ${seat(c)} → 기준점`).toBeGreaterThan(CLEAR_PX);
        }

        // ⑧ 공은 규정 자리다.
        if (kind === 'goalClearance') {
          // Law 16 — 공은 **골 지역 안**. 페널티 마크(골라인 3.5 m)가 골 지역(깊이 5 m) 안이라
          // spotMarks 를 그대로 쓴다. 좌표를 새로 만들지 않았다는 것까지 확인한다.
          expect(def.ruleZones.some((z) => inRect(z, ball.x, ball.y)), `${tag} 골 지역 안`).toBe(true);
          expect(def.spotMarks.some((s) => dist(s, ball) < 1e-6), `${tag} spotMarks 파생`).toBe(true);
        } else if (kind === 'corner') {
          // Law 17 — 공은 코너 삼각형 안(꼭짓점에서 1 m 이내), 기준점은 **꼭짓점**이다.
          const s = def.surface;
          const corners: Vec2[] = [
            { x: s.x, y: s.y },
            { x: s.x + s.w, y: s.y },
            { x: s.x + s.w, y: s.y + s.h },
            { x: s.x, y: s.y + s.h },
          ];
          expect(corners.some((c) => dist(c, geom.ref) < 1e-6), `${tag} 기준점이 경기면 모서리`).toBe(true);
          expect(dist(ball, geom.ref), `${tag} 공-꼭짓점`).toBeGreaterThan(0);
          expect(dist(ball, geom.ref)).toBeLessThanOrEqual(mToPx(1));
        } else {
          // Law 15 — 공은 **터치라인 위**. 경기면 테두리 위이면서 골라인이 아니다.
          const s = def.surface;
          const onBorder =
            Math.min(Math.abs(ball.x - s.x), Math.abs(ball.x - (s.x + s.w)), Math.abs(ball.y - s.y), Math.abs(ball.y - (s.y + s.h))) < 1e-6;
          expect(onBorder, `${tag} 공이 라인 위`).toBe(true);
          for (const post of def.goalPosts) {
            const onGoalLine = Math.abs(ball.x - post.x) < 1e-6 || Math.abs(ball.y - post.y) < 1e-6;
            expect(onGoalLine, `${tag} 공이 골라인 위면 안 된다`).toBe(false);
          }
          expect(geom.ref, `${tag} 킥인 기준점은 공`).toEqual(ball);
        }
      }
    });
  }
});

describe('§5.4 C-2 — 코너킥의 5 m 는 **공이 아니라 코너 삼각형**에서 잰다 (Law 17)', () => {
  // ⚠️ 이것이 이 항목의 핵심 단언이다. 두 기준을 하나로 뭉치면(=공 기준으로 재면) 실제로
  // 위반이 되는 수비수가 존재한다는 것을 **지목해서** 보인다 — 그 사람이 없으면 이 구분은
  // 테스트로 확인 불가능한 말장난이다.
  for (const mode of ['full', 'half'] as const) {
    for (const size of COURT_SIZES) {
      it(`${mode} · ${size}: 코너 기준으로는 합법인데 공 기준으로는 5 m 미달인 수비수가 있다`, () => {
        const d = build(mode, size, '1-2-1');
        const geom = setPieceGeometry(d, 'corner')!;
        const plan = setPiecePlan(d, 'corner')!;
        expect(dist(geom.ball, geom.ref), '공과 기준점이 다른 점이다').toBeGreaterThan(1);

        // ⚠️ 기준점을 `geom.ref` 에서 읽으면 **자기 자신으로 자기를 재는 것**이다 —
        //    구현이 코너 대신 공에서 재도 그 값이 함께 움직여 통과한다. 그래서 꼭짓점을
        //    코트 정의에서 **따로** 구한다(공에서 가장 가까운 경기면 모서리).
        const s = courtDefFor(mode, size).surface;
        const vertex = [
          { x: s.x, y: s.y },
          { x: s.x + s.w, y: s.y },
          { x: s.x + s.w, y: s.y + s.h },
          { x: s.x, y: s.y + s.h },
        ].reduce((a, b) => (dist(a, geom.ball) <= dist(b, geom.ball) ? a : b));

        const guards = d.cast.chairs.filter((c) => c.team === geom.guard && plan.chairs[c.id]);
        const legalByCorner = guards.filter((c) => dist(plan.chairs[c.id]!, vertex) >= CLEAR_PX);
        const illegalByBall = legalByCorner.filter((c) => dist(plan.chairs[c.id]!, geom.ball) < CLEAR_PX);
        expect(legalByCorner.length, '코너 기준으로는 전원 합법').toBe(guards.length);
        expect(illegalByBall.length, '공 기준으로 재면 미달이 되는 사람').toBeGreaterThan(0);
        expect(geom.ref, '기하가 말하는 기준점도 그 꼭짓점이다').toEqual(vertex);
      });
    }
  }
});

describe('§5.4 C-2 — 프리셋이 실제로 판을 바꾼다 · 되풀이해도 같다', () => {
  it('대조군 — 기본 포메이션을 그대로 돌려주지 않는다(키커 + 상대 필드 전원이 움직인다)', () => {
    for (const { mode, size, kind } of LINE_COMBOS) {
      const d = build(mode, size, '1-2-1');
      const base = defaultStep(mode, '1-2-1', d.cast, size);
      const plan = setPiecePlan(d, kind)!;
      const moved = d.cast.chairs.filter((c) => {
        const a = base.chairs[c.id];
        const b = plan.chairs[c.id];
        return a && b && (a.x !== b.x || a.y !== b.y);
      });
      const geom = setPieceGeometry(d, kind)!;
      const guardOutfield = d.cast.chairs.filter((c) => c.team === geom.guard && !c.isGk && base.chairs[c.id]).length;
      expect(moved.length, `${mode}/${size}/${kind}`).toBeGreaterThanOrEqual(guardOutfield + 1);
    }
  });

  it('같은 드릴에 두 번 부르면 한 글자도 다르지 않다(무작위 없음)', () => {
    for (const { mode, size, kind } of LINE_COMBOS) {
      const d = build(mode, size, '1-2-1');
      expect(setPiecePlan(d, kind)).toEqual(setPiecePlan(d, kind));
    }
  });

  it('코트 크기 3단이 세트피스를 따라 움직인다 — 세 크기의 공 자리가 서로 다르다', () => {
    // 대조군: 같은 판을 세 번 센 것이 아니다. 하프는 크기를 안 타므로 **같아야** 한다(뒷문장).
    for (const kind of SET_PIECE_KINDS) {
      const fullBalls = COURT_SIZES.map((s) => JSON.stringify(setPiecePlan(build('full', s, '1-2-1'), kind)!.ball));
      expect(new Set(fullBalls).size, `full ${kind}`).toBe(3);
      const halfBalls = COURT_SIZES.map((s) => JSON.stringify(setPiecePlan(build('half', s, '1-2-1'), kind)!.ball));
      expect(new Set(halfBalls).size, `half ${kind}`).toBe(1);
    }
  });

  it('세 세트피스는 서로 다른 판이다 — 공이 세 군데다', () => {
    for (const mode of ['full', 'half'] as const) {
      const balls = SET_PIECE_KINDS.map((k) => JSON.stringify(setPiecePlan(build(mode, '30x18', '1-2-1'), k)!.ball));
      expect(new Set(balls).size, mode).toBe(3);
    }
  });

  it('자유 전술판(공 없는 캐스트)에 앉히면 공이 생긴다', () => {
    const board = createDrill({ courtMode: 'full', empty: true });
    expect(board.cast.balls).toHaveLength(0); // 전제 확인
    const plan = setPiecePlan(board, 'corner')!;
    const next = applyPlacement(board, 0, plan);
    expect(next.cast.balls).toHaveLength(1);
    expect(next.steps[0]!.balls[next.cast.balls[0]!.id]).toEqual(plan.ball);
    expect(Object.keys(next.steps[0]!.chairs)).toHaveLength(8);
  });

  it('골 클리어런스를 차는 팀 — 풀은 우리 팀, 하프는 그 골대를 지키는 상대다', () => {
    // 규칙 하나("그 골대를 지키는 팀이 찬다")가 두 코트를 덮는지 본다. 하프 코트에는 홈 골대가
    // 아예 없다(HALF_POSITIONS 가 away GK 만 골문에 세운다).
    expect(setPieceGeometry(build('full', '30x18', '1-2-1'), 'goalClearance')!.restart).toBe('home');
    expect(setPieceGeometry(build('half', '30x18', '1-2-1'), 'goalClearance')!.restart).toBe('away');
    // 코너킥·킥인은 두 코트 모두 우리 팀이 찬다.
    for (const mode of ['full', 'half'] as const) {
      expect(setPieceGeometry(build(mode, '30x18', '1-2-1'), 'corner')!.restart, mode).toBe('home');
      expect(setPieceGeometry(build(mode, '30x18', '1-2-1'), 'kickIn')!.restart, mode).toBe('home');
    }
  });
});

describe('§5.4 C-2 — 코너킥 인크로치먼트 마크(5.2)와의 대조', () => {
  it('수비 GK 는 두 마크 사이(골 중앙 4 m 통로) 안에 있고, 코너에서 이미 5 m 밖이다', () => {
    // Law 17 은 골 지역 안 수비수에게 5 m 예외를 주고 *"1 m 마크 뒤"* 라고만 적는다.
    // ⚠️ 이 프리셋은 **그 예외에 기대지 않는다** — 기본 배치의 수비 GK 는 세 크기 전부에서
    // 이미 5 m 밖이기 때문이다(실측 7.11~9.12 m). 예외가 필요한 배치를 만들게 되면 그때
    // encroachMarks 를 쓰면 된다. 그 사실을 숫자로 붙잡아 둔다.
    for (const size of COURT_SIZES) {
      const d = build('full', size, '1-2-1');
      const def = courtDefFor('full', size);
      const geom = setPieceGeometry(d, 'corner')!;
      const plan = setPiecePlan(d, 'corner')!;
      const gk = d.cast.chairs.find((c) => c.team === geom.guard && c.isGk)!;
      const p = plan.chairs[gk.id]!;
      const m = dist(p, geom.ref) / mToPx(1);
      expect(m, `${size} GK-코너`).toBeGreaterThan(5);
      expect(m).toBeLessThan(10);
      // 마크의 시작점(포스트 안쪽 1 m)은 4개다 — 그중 이 골대 쪽 둘 사이에 GK 가 있다.
      const insets = def.encroachMarks
        .map((dd) => dd.match(/-?\d+(?:\.\d+)?/g)!.slice(0, 2).map(Number))
        .map(([x, y]) => ({ x: x!, y: y! }))
        .filter((q) => Math.abs(q.x - p.x) < 200);
      expect(insets, `${size} 이 골대 쪽 마크`).toHaveLength(2);
      const ys = insets.map((q) => q.y).sort((a, b) => a - b);
      expect(p.y, `${size} GK 가 4 m 통로 안`).toBeGreaterThanOrEqual(ys[0]!);
      expect(p.y).toBeLessThanOrEqual(ys[1]!);
      // 대조군 — 통로는 실제로 4 m 다(마크가 포스트 안쪽 1 m 라는 5.2 의 계산과 일치).
      expect(ys[1]! - ys[0]!).toBeCloseTo(mToPx(4), 6);
    }
  });
});
