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
import { COURT_MODES, COURT_SIZES, COURT_DEFS, courtDefFor, isOnSurface, type CourtDef, type CourtMode, type CourtSize } from './court.ts';

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

describe('§5.3 센터 마크 — 15 cm "X" 하나, 그리고 센터 서클은 없다', () => {
  it('풀 코트: 하프라인 중점에 X 가 있다 (크기 3단 전부)', () => {
    for (const size of COURT_SIZES) {
      const def = courtDefFor('full', size);
      const d = def.centerMark;
      expect(d, `${size}`).not.toBeNull();
      const s = segs(d!);
      expect(s, 'X 는 획 두 개다').toHaveLength(2);
      const xs = s.flatMap((g) => [g.a.x, g.b.x]);
      const ys = s.flatMap((g) => [g.a.y, g.b.y]);
      const S = def.surface;
      // 중심 = 하프라인(경기면 중앙 세로선)의 중점.
      expect((Math.min(...xs) + Math.max(...xs)) / 2).toBeCloseTo(S.x + S.w / 2, 9);
      expect((Math.min(...ys) + Math.max(...ys)) / 2).toBeCloseTo(S.y + S.h / 2, 9);
      // 크기 = 15 cm. ⚠️ 이 숫자가 커지면 그것은 다시 '규정에 없는 원' 으로 가는 길이다.
      expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(0.15 * PX_PER_M, 9);
      expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(0.15 * PX_PER_M, 9);
      expect(0.15 * PX_PER_M).toBe(3.75); // 축척 25 px = 1 m 의 검산
      // 두 획이 서로 대각이다 — 같은 획을 두 번 적은 '가짜 X' 를 막는다.
      expect(Math.sign(s[0]!.b.x - s[0]!.a.x)).not.toBe(Math.sign(s[1]!.b.x - s[1]!.a.x));
    }
  });

  it('하프·플랫에는 센터 마크가 없다 — 하프라인을 그리지 않는 판이다', () => {
    expect(COURT_DEFS.half.centerMark).toBeNull();
    expect(COURT_DEFS.flat.centerMark).toBeNull();
    // 대조군 — null 판정이 아무 필드에나 참인 것이 아니다.
    expect(COURT_DEFS.full.centerMark).not.toBeNull();
  });

  it('⚠️ 어느 판에도 센터 서클(3 m 원)의 자리가 없다 — §9 결정 ⑧', () => {
    // Laws 2025 전문 50쪽에 "circle" 이 0회 나온다. 지워 놓은 것은 지워진 채로 지켜져야 한다.
    for (const mode of COURT_MODES) {
      const def = COURT_DEFS[mode];
      expect(Object.keys(def)).not.toContain('centerCircle');
      // 코트 정의가 내놓는 path 문자열 중 **호(A) 명령을 쓰는 것이 하나도 없다.**
      // 옛 하프 코트의 센터 서클 반원이 정확히 이 형태였다(`A75,75 0 0 0 …`).
      const paths = [...def.cornerCuts, ...def.encroachMarks, ...(def.centerMark === null ? [] : [def.centerMark])];
      for (const d of paths) expect(d).not.toMatch(/[Aa]\d/);
      // 대조군 — 실제로 문자열을 훑고 있다(full 6개 · half 4개 · flat 0개).
      expect(paths.length).toBe(mode === 'full' ? 9 : mode === 'half' ? 4 : 0);
    }
  });
});
