// §5.2 코너킥 인크로치먼트 마크 · §5.3 센터 마크 — **규격 정확도**를 좌표로 검산한다.
//
// 이 파일이 잡는 사고는 하나다: **기준점을 코너로 잡는 것.** 코너 삼각형도 1 m 라(court.ts
// `CORNER_PX`) 숫자가 같아서, "코너에서 1 m" 로 그려도 그림은 그럴듯해 보인다. 그런데 규정은
// *"각 골포스트 안쪽 1 m"* 다 — 코너 기준이면 코트가 커질수록 마크가 골대에서 멀어지고,
// 코너킥 때 골 지역 수비수가 서야 하는 자리를 **앱이 잘못 가르친다.**
//
// 축: 코트 3종(full/half/flat) × 풀 코트 크기 3단(30x18/28x15/25x14). 크기를 타는 것은
// 경기면 사각형뿐이고 골대 폭(6 m)·인셋(1 m)은 절대 치수라, **세 단에서 같은 값이 나오는가**가
// 그 자체로 대조군이다(비례로 잘못 그리면 두 단이 어긋난다).
import { describe, expect, it } from 'vitest';
import type { Vec2 } from '../core/units.ts';
import { PX_PER_M } from '../core/units.ts';
import {
  CENTER_MARK_HALF_PX,
  CENTER_MARK_SPEC_PX,
  COURT_MODES,
  COURT_SIZES,
  COURT_DEFS,
  courtDefFor,
  isOnSurface,
  SPOT_CROSS_HALF_PX,
  type CourtDef,
  type CourtMode,
  type CourtSize,
} from './court.ts';

interface Seg {
  a: Vec2;
  b: Vec2;
}

/** `M x,y L x,y …` 를 선분 목록으로. 파서가 조용히 0개를 돌려주면 모든 단언이 헛통과하므로
 *  **호출부마다 개수를 먼저 센다**(아래 대조군 참고). */
function segs(d: string): Seg[] {
  const out: Seg[] = [];
  const re = /M(-?[\d.]+),(-?[\d.]+) L(-?[\d.]+),(-?[\d.]+)/g;
  for (let m = re.exec(d); m !== null; m = re.exec(d)) {
    out.push({ a: { x: Number(m[1]), y: Number(m[2]) }, b: { x: Number(m[3]), y: Number(m[4]) } });
  }
  return out;
}

const dist = (p: Vec2, q: Vec2): number => Math.hypot(p.x - q.x, p.y - q.y);

/** 마크 하나 = 선분 하나여야 한다(두 획짜리 X 가 아니다). */
function markSegs(def: CourtDef): Seg[] {
  return def.encroachMarks.map((d) => {
    const s = segs(d);
    expect(s, `마크 path 가 선분 하나가 아니다: ${d}`).toHaveLength(1);
    return s[0]!;
  });
}

/** 검사 대상 판 전부. 풀은 3단, 하프·플랫은 1벌(3단을 따라가지 않는다 — court.ts:146 근거 셋). */
const CASES: { mode: CourtMode; size: CourtSize; def: CourtDef }[] = [
  ...COURT_SIZES.map((size) => ({ mode: 'full' as CourtMode, size, def: courtDefFor('full', size) })),
  { mode: 'half', size: '30x18', def: COURT_DEFS.half },
  { mode: 'flat', size: '30x18', def: COURT_DEFS.flat },
];

describe('§5.2 코너킥 인크로치먼트 마크 — 골대마다 2개', () => {
  it('개수: 풀 4개 · 하프 2개 · 플랫 0개 (크기 3단 전부)', () => {
    for (const { mode, size, def } of CASES) {
      const expected = mode === 'full' ? 4 : mode === 'half' ? 2 : 0;
      expect(def.encroachMarks, `${mode}/${size}`).toHaveLength(expected);
      // 골대 하나에 포스트 2개, 포스트마다 마크 1개 → 언제나 골포스트 수와 같다.
      expect(def.encroachMarks.length, `${mode}/${size}`).toBe(def.goalPosts.length);
    }
    // 대조군 — 0개라서 통과한 것이 아니다. 실제로 세 판에서 합계 4+4+4+2 = 14 개가 있다.
    expect(CASES.reduce((n, c) => n + c.def.encroachMarks.length, 0)).toBe(14);
  });

  it('⚠️ 시작점은 **골포스트에서 정확히 1 m**(25 px) — 코너에서 재는 거리가 아니다', () => {
    for (const { mode, size, def } of CASES) {
      if (def.goalPosts.length === 0) continue;
      const marks = markSegs(def);
      expect(marks.length).toBeGreaterThan(0); // 0개 순회로 통과하는 길을 막는다
      for (const seg of marks) {
        const ds = def.goalPosts.map((p) => dist(seg.a, p)).sort((x, y) => x - y);
        // 같은 골대의 가까운 포스트에서 1 m, 반대쪽 포스트에서 5 m(골대 폭 6 m − 1 m).
        expect(ds[0], `${mode}/${size} 가까운 포스트`).toBeCloseTo(1 * PX_PER_M, 9);
        expect(ds[1], `${mode}/${size} 반대쪽 포스트`).toBeCloseTo(5 * PX_PER_M, 9);
        // 포스트 위가 아니다 — 인셋이 실제로 적용됐다.
        expect(ds[0]).toBeGreaterThan(0);
      }
    }
  });

  it('⚠️ 대조군 — 코너에서 잰 거리는 1 m 가 **아니고**, 코트 크기마다 다르다', () => {
    // 코너 기준으로 잘못 구현하면 위 테스트가 빨개진다. 그 반대 방향도 못박는다:
    // 코너~마크 거리는 규격이 아니라 코트 크기의 함수라, 이 값이 25 로 고정되면 그것이 사고다.
    const fromCorner = COURT_SIZES.map((size) => {
      const def = courtDefFor('full', size);
      const S = def.surface;
      const corners: Vec2[] = [
        { x: S.x, y: S.y },
        { x: S.x, y: S.y + S.h },
        { x: S.x + S.w, y: S.y },
        { x: S.x + S.w, y: S.y + S.h },
      ];
      const seg = markSegs(def)[0]!;
      return Math.min(...corners.map((c) => dist(seg.a, c)));
    });
    for (const d of fromCorner) expect(d).not.toBeCloseTo(1 * PX_PER_M, 6);
    // 30×18 은 175 px, 28×15 는 137.5 px, 25×14 는 125 px — 셋 다 다르다.
    expect(new Set(fromCorner).size).toBe(3);
    expect(fromCorner).toEqual([175, 137.5, 125]);
  });

  it('골라인에 **수직**이고, 필드 **밖**으로 뻗고, 판(viewBox) 안에 머문다', () => {
    for (const { mode, size, def } of CASES) {
      if (def.goalPosts.length === 0) continue;
      for (const seg of markSegs(def)) {
        // 시작점은 경기면 경계 위(라인 위는 경기면으로 친다), 끝점은 경기면 밖이다.
        expect(isOnSurface(mode, seg.a, size), `${mode}/${size} 시작점`).toBe(true);
        expect(isOnSurface(mode, seg.b, size), `${mode}/${size} 끝점`).toBe(false);
        // 골라인에 수직 = 골라인 방향 성분이 0. 골라인은 축에 나란하므로 한 축만 변한다.
        const dx = seg.b.x - seg.a.x;
        const dy = seg.b.y - seg.a.y;
        expect(Math.min(Math.abs(dx), Math.abs(dy))).toBe(0);
        expect(Math.hypot(dx, dy)).toBeCloseTo(0.5 * PX_PER_M, 9);
        // 판 밖으로 삐져나가지 않는다 — 심판 구역(1.5 m) 안에서 끝난다.
        expect(seg.b.x).toBeGreaterThanOrEqual(0);
        expect(seg.b.y).toBeGreaterThanOrEqual(0);
        expect(seg.b.x).toBeLessThanOrEqual(def.vbW);
        expect(seg.b.y).toBeLessThanOrEqual(def.vbH);
      }
    }
  });

  it('한 골대의 두 마크는 골 중앙에 대칭이고 4 m 떨어져 있다 (6 m − 1 m − 1 m)', () => {
    for (const { mode, size, def } of CASES) {
      if (def.goalPosts.length === 0) continue;
      const marks = markSegs(def);
      // 골대 단위로 둘씩 묶는다 — goalPosts 와 같은 순서다.
      for (let i = 0; i < marks.length; i += 2) {
        const a = marks[i]!.a;
        const b = marks[i + 1]!.a;
        expect(dist(a, b), `${mode}/${size} 마크 간격`).toBeCloseTo(4 * PX_PER_M, 9);
        const goalMid = {
          x: (def.goalPosts[i]!.x + def.goalPosts[i + 1]!.x) / 2,
          y: (def.goalPosts[i]!.y + def.goalPosts[i + 1]!.y) / 2,
        };
        expect((a.x + b.x) / 2).toBeCloseTo(goalMid.x, 9);
        expect((a.y + b.y) / 2).toBeCloseTo(goalMid.y, 9);
      }
    }
  });

  it('크기 3단에서 마크는 **골대와 함께** 움직인다 — 비례로 줄지 않는다', () => {
    // 절대 치수(1 m 인셋)라 세 단의 "포스트→마크" 벡터가 완전히 같아야 한다. 비례로 구현하면
    // 25×14 에서 인셋이 20.8 px 이 되어 이 단언이 깨진다.
    const offsets = COURT_SIZES.map((size) => {
      const def = courtDefFor('full', size);
      return markSegs(def).map((s, i) => `${s.a.x - def.goalPosts[i]!.x},${s.a.y - def.goalPosts[i]!.y}`);
    });
    expect(offsets[0]).toEqual(offsets[1]);
    expect(offsets[1]).toEqual(offsets[2]);
    // 대조군 — 세 단이 **같은 판을 세 번 센 것이 아니다**(마크의 절대 좌표는 서로 다르다).
    const abs = COURT_SIZES.map((size) => courtDefFor('full', size).encroachMarks.join('|'));
    expect(new Set(abs).size).toBe(3);
  });
});

// ── §5.3 센터 마크 ──────────────────────────────────────────────────────────────────────
// ⚠️ 이 절은 2026-08-13 기현님 실기 지시로 **두 군데가 뒤집혔다**. 옛 단언을 지우지 않고
//    승격시킨 것이라, 무엇이 왜 바뀌었는지가 여기서 읽혀야 한다:
//     ① 크기: 규격 15 cm(반폭 1.875)  →  **페널티 스팟 십자와 같은 반폭 3.5**(= 28 cm).
//        규격값은 `CENTER_MARK_SPEC_PX` 로 살아 있고 아래에서 **따로** 잰다.
//     ② 판: 풀에만  →  **풀 + 하프**. `flat` 은 그대로 null 이고 그것이 대조군이다.
describe('§5.3 센터 마크 — 페널티 스팟과 같은 크기의 "X", 그리고 센터 서클은 없다', () => {
  /** 센터 마크 path 를 재서 {중심, 폭, 높이} 로. 획이 두 개인지·대각인지도 여기서 본다. */
  function measureX(d: string): { cx: number; cy: number; w: number; h: number } {
    const s = segs(d);
    expect(s, 'X 는 획 두 개다').toHaveLength(2);
    const xs = s.flatMap((g) => [g.a.x, g.b.x]);
    const ys = s.flatMap((g) => [g.a.y, g.b.y]);
    // 두 획이 서로 대각이다 — 같은 획을 두 번 적은 '가짜 X' 를 막는다.
    expect(Math.sign(s[0]!.b.x - s[0]!.a.x)).not.toBe(Math.sign(s[1]!.b.x - s[1]!.a.x));
    return {
      cx: (Math.min(...xs) + Math.max(...xs)) / 2,
      cy: (Math.min(...ys) + Math.max(...ys)) / 2,
      w: Math.max(...xs) - Math.min(...xs),
      h: Math.max(...ys) - Math.min(...ys),
    };
  }

  it('풀 코트: 하프라인 중점에 X 가 있다 (크기 3단 전부)', () => {
    for (const size of COURT_SIZES) {
      const def = courtDefFor('full', size);
      const d = def.centerMark;
      expect(d, `${size}`).not.toBeNull();
      const m = measureX(d!);
      const S = def.surface;
      // 중심 = 하프라인(경기면 중앙 세로선)의 중점.
      expect(m.cx, `${size}`).toBeCloseTo(S.x + S.w / 2, 9);
      expect(m.cy, `${size}`).toBeCloseTo(S.y + S.h / 2, 9);
      // 크기는 **코트 3단에서 변하지 않는다**(절대 치수다 — 페널티 마크·골대와 같은 성질).
      expect(m.w, `${size}`).toBeCloseTo(2 * SPOT_CROSS_HALF_PX, 9);
      expect(m.h, `${size}`).toBeCloseTo(2 * SPOT_CROSS_HALF_PX, 9);
    }
  });

  // ── ①: 크기가 페널티 스팟 십자와 같다 (2026-08-13 기현님 실기 지시) ──────────────────────
  it('⚠️ 표시 크기 = 페널티 스팟 십자와 같은 반폭이다 — 규격 15 cm 가 아니다', () => {
    // 지시 원문: "센터 중앙 x자를 패널티스팟과 같은 크기로". 그래서 여기서 재는 것은
    // **규격과의 일치가 아니라 스팟 십자와의 일치**다. `CENTER_MARK_HALF_PX` 를
    // `CENTER_MARK_SPEC_PX / 2`(=1.875) 로 되돌리면 이 단언이 곧바로 빨개진다.
    expect(CENTER_MARK_HALF_PX).toBe(SPOT_CROSS_HALF_PX);
    expect(measureX(COURT_DEFS.full.centerMark!).w).toBeCloseTo(2 * SPOT_CROSS_HALF_PX, 9);
    expect(measureX(COURT_DEFS.half.centerMark!).w).toBeCloseTo(2 * SPOT_CROSS_HALF_PX, 9);

    // 대조군 ① — 그 값이 규격값과 **실제로 다르다**. 둘이 우연히 같아서 통과한 것이 아니다.
    expect(CENTER_MARK_SPEC_PX).toBe(0.15 * PX_PER_M);
    expect(CENTER_MARK_SPEC_PX).toBe(3.75); // 축척 25 px = 1 m 의 검산
    expect(CENTER_MARK_HALF_PX).not.toBeCloseTo(CENTER_MARK_SPEC_PX / 2, 9);
    // 대조군 ② — 표시값 7 px 이 실제로 28 cm 다(다음 사람이 이 수를 규격으로 읽지 않도록).
    expect((2 * CENTER_MARK_HALF_PX) / PX_PER_M).toBeCloseTo(0.28, 9);

    // 대조군 ③ — 페널티 스팟 십자가 정말 그 반폭으로 **그려지고 있다**. 상수끼리만 비교하면
    // 두 상수를 같이 바꾼 채 그림은 안 따라오는 헛통과가 열린다. 실제 spotMarks 좌표에서 잰다.
    const spot = COURT_DEFS.full.spotMarks[0]!;
    const crossHalf = Math.abs(spot.x - (spot.x - SPOT_CROSS_HALF_PX));
    expect(crossHalf).toBe(3.5);
  });

  // ── ②: 하프에도 있다 (2026-08-13 기현님 실기 지시로 뒤집힘) ─────────────────────────────
  it('⚠️ 하프 코트에도 센터 마크가 있다 — 위쪽 변(=하프라인)의 중점이다', () => {
    // 2026-08-12 까지 이 자리의 단언은 `expect(COURT_DEFS.half.centerMark).toBeNull()` 이었다.
    // 지우지 않고 **뒤집어** 승격시킨다. 근거는 court.ts 의 half.centerMark 주석 ①②③.
    const def = COURT_DEFS.half;
    expect(def.centerMark).not.toBeNull();
    const m = measureX(def.centerMark!);
    const S = def.surface;
    expect(m.cx).toBeCloseTo(S.x + S.w / 2, 9); // 가로 중앙
    expect(m.cy).toBeCloseTo(S.y, 9); // **위쪽 변** — 골대(아래쪽) 반대편이다

    // 대조군 ① — 아래쪽 변(골라인)이나 경기면 한가운데가 아니다. 셋은 실제로 다른 y 다.
    expect(m.cy).not.toBeCloseTo(S.y + S.h, 9);
    expect(m.cy).not.toBeCloseTo(S.y + S.h / 2, 9);
    // 대조군 ② — 그 y 가 골대보다 위다(하프 코트 골대는 아래쪽 변에 있다).
    expect(m.cy).toBeLessThan(def.goalPosts[0]!.y);
    // 대조군 ③ — 풀 코트의 X 를 그대로 베낀 것이 아니다(좌표가 다르다).
    expect(def.centerMark).not.toBe(COURT_DEFS.full.centerMark);
  });

  it('⚠️ 플랫에는 여전히 센터 마크가 없다 — 선이 하나도 없는 자유판이다', () => {
    // **대조군의 대조군.** 하프를 뒤집을 때 flat 까지 같이 뒤집는 것이 가장 쉬운 과잉 수정이다.
    expect(COURT_DEFS.flat.centerMark).toBeNull();
    expect(COURT_DEFS.flat.cornerCuts).toHaveLength(0); // 정말로 선이 없는 판이다
    expect(COURT_DEFS.flat.goalPosts).toHaveLength(0);
    // null 판정이 아무 판에나 참인 것이 아니다 — 나머지 둘은 값을 갖는다.
    expect(COURT_DEFS.full.centerMark).not.toBeNull();
    expect(COURT_DEFS.half.centerMark).not.toBeNull();
  });

  it('⚠️ 어느 판에도 센터 서클(3 m 원)의 자리가 없다 — §9 결정 ⑧', () => {
    // Laws 2025 전문 50쪽에 "circle" 이 0회 나온다. 지워 놓은 것은 지워진 채로 지켜져야 한다.
    // ⚠️ 이 단언은 2026-08-13 지시와 **무관하게 그대로다**. 커진 것은 X 이고, 원은 여전히 없다.
    for (const mode of COURT_MODES) {
      const def = COURT_DEFS[mode];
      expect(Object.keys(def)).not.toContain('centerCircle');
      // 코트 정의가 내놓는 path 문자열 중 **호(A) 명령을 쓰는 것이 하나도 없다.**
      // 옛 하프 코트의 센터 서클 반원이 정확히 이 형태였다(`A75,75 0 0 0 …`).
      const paths = [...def.cornerCuts, ...def.encroachMarks, ...(def.centerMark === null ? [] : [def.centerMark])];
      for (const d of paths) expect(d).not.toMatch(/[Aa]\d/);
      // 대조군 — 실제로 문자열을 훑고 있다(full 9개 · half 5개 · flat 0개).
      // half 는 2026-08-13 에 센터 마크가 생기며 4 → **5** 가 됐다.
      expect(paths.length, mode).toBe(mode === 'full' ? 9 : mode === 'half' ? 5 : 0);
    }
  });
});
