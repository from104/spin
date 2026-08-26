// 진영 표시 — 골라인 뒤 **깃발 둘** (기현 지시 2026-08-15, 모양은 2026-08-16 에 두 번 바뀜).
//
// jsdom 은 픽셀을 안 그리므로 **볼 수 없는 것은 좌표와 순서로 잰다**(2026-08-15 §함정 ①의 교훈).
// 여기서 재는 것 여섯: ① 존마다 깃발이 둘인가 ② 골라인 **바깥**인가 ③ 골라인에서 정확히
// 0.5 m 인가 ④ viewBox 를 안 넘는가 ⑤ 페넌트가 정삼각형이고 꼭짓점이 오른쪽인가 ⑥ 색이 그
// 진영 팀의 골키퍼/일반 색인가. 어느 하나가 틀리면 화면에서는 "깃발이 안 보인다" 또는 "엉뚱한
// 팀 색" 으로 나타나는데, 둘 다 마크업 존재 여부로는 안 잡힌다.
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { SideMarks } from './SideMarks.tsx';
// 상수·좌표식은 2026-08-17 에 `sideFlags.ts` 로 떼었다 — PNG 내보내기가 같은 값을 읽어야
// 해서다(그 파일 머리말). 여기서 재는 것은 여전히 **그려진 결과**다.
import {
  SIDE_FLAG_GAP_PX,
  SIDE_FLAG_H_PX,
  SIDE_FLAG_POLE_PX,
  SIDE_FLAG_SIDE_PX,
  SIDE_FLAG_SPACING_PX,
  SIDE_FLAG_TAIL_PX,
} from './sideFlags.ts';
import { COURT_MODES, COURT_SIZES, courtDefFor } from '../model/court.ts';
import { DEFAULT_TEAMS } from '../model/defaults.ts';
import type { CourtMode, CourtSize } from '../model/court.ts';
import type { TeamSide } from '../model/drill.ts';
import { StageRotProvider } from './stageRot.tsx';
import type { StageRot } from './useStageMetrics.ts';

type Pt = { x: number; y: number };
const num = (el: Element, a: string): number => Number(el.getAttribute(a));

/** 페넌트 세 점. `points="x,y x,y x,y"` 를 숫자로 되돌린다 — 앞 둘이 깃대 쪽 변, 셋째가 꼭짓점. */
function corners(poly: Element): Pt[] {
  return poly
    .getAttribute('points')!
    .trim()
    .split(/\s+/)
    .map((pair) => {
      const [x, y] = pair.split(',').map(Number);
      return { x: x!, y: y! };
    });
}

interface Flag {
  role: string;
  fill: string;
  /** 페넌트 세 점. */
  pts: Pt[];
  /** 깃대 두 끝. **여백을 먹는 것은 이쪽이 더 길다** — 가장자리 검사는 이것까지 봐야 한다. */
  pole: [Pt, Pt];
  /** 깃발 전체(페넌트 + 깃대)의 점 다섯. */
  all: Pt[];
  /** 페넌트 무게중심 — 깃발이 어느 골 옆인지 가르고 둘 사이 간격을 잴 때 쓴다. */
  at: Pt;
  /** 되돌림 회전(`transform`). 회전이 없으면 `null` 이다. */
  upright: string | null;
}

/** `transform="rotate(θ cx cy)"` 를 점 하나에 실제로 적용한다.
 *
 *  jsdom 은 SVG transform 을 계산하지 않으므로 좌표만 읽으면 **되돌림이 없는 것과 같은 값**이
 *  나온다 — 그대로 재면 "돌려도 0.5 m" 를 못 지키는 코드도 초록불이 된다. 그래서 여기서 손으로
 *  먹인다. `rotate(-90 cx cy)`: (x,y) → (cx + (y−cy), cy − (x−cx)). */
function applyTransform(t: string | null, p: Pt): Pt {
  if (!t) return p;
  const m = /^rotate\((-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)\)$/.exec(t);
  if (!m) throw new Error(`못 읽는 transform: ${t}`);
  const [th, cx, cy] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const rad = (th * Math.PI) / 180;
  const [dx, dy] = [p.x - cx, p.y - cy];
  return { x: cx + dx * Math.cos(rad) - dy * Math.sin(rad), y: cy + dx * Math.sin(rad) + dy * Math.cos(rad) };
}

function marks(mode: CourtMode, defense: TeamSide = 'home', size?: CourtSize, rot: StageRot = 0) {
  const { container } = render(
    <StageRotProvider rot={rot}>
      <svg>
        <SideMarks mode={mode} size={size} teams={DEFAULT_TEAMS as Parameters<typeof SideMarks>[0]['teams']} defense={defense} />
      </svg>
    </StageRotProvider>,
  );
  const flags: Flag[] = Array.from(container.querySelectorAll('g[data-side-flag]')).map((g) => {
    const poly = g.querySelector('polygon')!;
    const line = g.querySelector('line')!;
    const pts = corners(poly);
    const pole: [Pt, Pt] = [
      { x: num(line, 'x1'), y: num(line, 'y1') },
      { x: num(line, 'x2'), y: num(line, 'y2') },
    ];
    return {
      role: g.getAttribute('data-side-flag')!,
      fill: poly.getAttribute('fill')!,
      upright: g.getAttribute('transform'),
      pts,
      pole,
      all: [...pts, ...pole],
      at: { x: pts.reduce((s, p) => s + p.x, 0) / 3, y: pts.reduce((s, p) => s + p.y, 0) / 3 },
    };
  });
  return {
    groups: Array.from(container.querySelectorAll('g[data-side-mark]')),
    flags,
    circles: Array.from(container.querySelectorAll('circle')),
    texts: Array.from(container.querySelectorAll('text')),
    root: container.querySelector('g[data-side-marks]'),
  };
}

describe('진영 표시 — 개수와 자리', () => {
  it('풀 코트는 존이 둘이라 그룹 둘 · 깃발 넷', () => {
    const m = marks('full');
    expect(m.groups).toHaveLength(2);
    expect(m.flags).toHaveLength(4);
  });

  it('하프 코트는 골이 하나 — 그룹 하나 · 깃발 둘', () => {
    const m = marks('half', 'away');
    expect(m.groups).toHaveLength(1);
    expect(m.flags).toHaveLength(2);
  });

  // ★ 2026-08-16 기현 지시: *"진영 표시 원이 직관적으로 공과 혼돈할 수있으니"*. 판 위에서
  //   원은 이미 공이다 — 진영 표시에 원이 하나라도 돌아오면 그 혼동이 그대로 돌아온다.
  it('★ 원은 하나도 없다 — 공과 헷갈리지 않는 것이 이 모양의 존재 이유다', () => {
    for (const mode of COURT_MODES) expect(marks(mode).circles, mode).toHaveLength(0);
  });

  // ★ 같은 날 두 번째 지시: *"글자를 지우고 … 플래이어 종류는 휠체어 칩을 보면 직관적으로
  //   알 수 있다."* 글자를 되살리려면 먼저 "칩을 보고도 모르는 무엇을 그 글자가 말하는가" 에
  //   답해야 한다 — 이 단언이 그 물음을 강제한다.
  it('★ 글자는 없다 — 골키퍼가 누구인지는 코트 위 칩이 이미 말한다', () => {
    for (const mode of COURT_MODES) expect(marks(mode).texts, mode).toHaveLength(0);
  });

  it('★ 플랫 코트에는 아무것도 안 그린다 — 진영이라는 개념이 없다', () => {
    const m = marks('flat');
    expect(m.root, '플랫에 진영 표시가 그려졌다').toBeNull();
    expect(m.flags).toHaveLength(0);
  });

  it('★ 깃발은 골라인 **바깥**에 있다 — 안에 있으면 코트 그림을 가린다', () => {
    const def = courtDefFor('full');
    const left = marks('full').flags.filter((f) => f.at.x < def.vbW / 2);
    expect(left).toHaveLength(2);
    for (const f of left) {
      // 페넌트·깃대의 점 **전부**가 경기면 왼쪽 변보다 왼쪽(= 판 밖 여백)이다. 한 점만 재면
      // 꼭짓점만 밖에 있고 깃대가 라인을 물고 있는 배치를 놓친다.
      for (const p of f.all) expect(p.x, '깃발이 경기면 안으로 들어왔다').toBeLessThan(def.surface.x);
    }
    // 하프 코트의 골라인은 **아래쪽**이다 — 좌우로 잡고 있으면 여기서 걸린다.
    const half = courtDefFor('half');
    for (const f of marks('half', 'away').flags) {
      for (const p of f.all) expect(p.y, '하프에서 깃발이 경기면 위로 갔다').toBeGreaterThan(half.surface.y + half.surface.h);
    }
  });

  it('★ 어느 코트에서도 viewBox 를 안 넘는다 — 넘으면 그냥 잘린다', () => {
    // 여백은 골라인 바깥 1.5 m = 37.5 월드 px 뿐이다. 0.5 m 를 띄우고 나면 25 가 남는데,
    // 그 25 를 먹는 길이가 골라인 방향마다 다르다 — 세로 골라인은 페넌트 **높이**(12.1),
    // 가로 골라인은 **깃대 길이**(19). 깃대 쪽이 상한을 정하므로 그것부터 못 박는다.
    expect(SIDE_FLAG_GAP_PX + SIDE_FLAG_POLE_PX).toBeLessThanOrEqual(1.5 * 25);
    expect(SIDE_FLAG_GAP_PX + SIDE_FLAG_H_PX).toBeLessThanOrEqual(1.5 * 25);
    for (const mode of COURT_MODES) {
      for (const size of COURT_SIZES) {
        const def = courtDefFor(mode, size);
        for (const f of marks(mode, 'home', size).flags) {
          const tag = `${mode}/${size}`;
          for (const p of f.all) {
            expect(p.x, tag).toBeGreaterThanOrEqual(0);
            expect(p.y, tag).toBeGreaterThanOrEqual(0);
            expect(p.x, tag).toBeLessThanOrEqual(def.vbW);
            expect(p.y, tag).toBeLessThanOrEqual(def.vbH);
          }
        }
      }
    }
  });

  // ★ 2026-08-16 기현 지시: *"깃발은 정삼각형에 꼭지점이 다 오른쪽을 향할것."*
  it('★ 어느 골·어느 코트에서도 페넌트가 **정삼각형**이고 **꼭짓점이 오른쪽**이다', () => {
    const len = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
    for (const mode of ['full', 'half'] as const) {
      for (const f of marks(mode).flags) {
        const [p0, p1, p2] = f.pts as [Pt, Pt, Pt];
        const tag = `${mode}/${f.role}`;
        // 정삼각형 — 세 변이 같다. 한 변만 재면 이등변이 통과한다.
        for (const s of [len(p0, p1), len(p1, p2), len(p2, p0)]) expect(s, tag).toBeCloseTo(SIDE_FLAG_SIDE_PX, 6);
        // 꼭짓점은 **오른쪽**. 깃대 쪽 두 점은 같은 x 에 서고 셋째 점만 그보다 오른쪽이다.
        expect(p0.x, tag).toBeCloseTo(p1.x, 6);
        expect(p2.x - p0.x, tag).toBeCloseTo(SIDE_FLAG_H_PX, 6);
      }
    }
  });

  // ★ 2026-08-16 기현 지시: *"깃발 깃대를 표현하자."* 삼각형만 있으면 화살촉으로도 읽힌다 —
  //   깃대에 매달린 삼각형은 깃발 말고 다른 것으로 안 읽힌다.
  it('★ 깃대가 있다 — 세로로 서고, 페넌트보다 길고, 페넌트가 그 **위쪽**에 매달린다', () => {
    for (const mode of ['full', 'half'] as const) {
      for (const f of marks(mode).flags) {
        const [a, b] = f.pole;
        const tag = `${mode}/${f.role}`;
        expect(a.x, tag).toBeCloseTo(b.x, 6); // 세로
        expect(Math.abs(b.y - a.y), tag).toBeCloseTo(SIDE_FLAG_POLE_PX, 6);
        // 페넌트의 깃대 쪽 변이 깃대 위에 얹혀 있고, 그 위 끝이 깃대의 위 끝이다.
        const top = Math.min(a.y, b.y);
        expect(f.pts[0]!.x, tag).toBeCloseTo(a.x, 6);
        expect(Math.min(f.pts[0]!.y, f.pts[1]!.y), tag).toBeCloseTo(top, 6);
        // ★ 페넌트 **아래로** 맨 대가 남는다 — 이것이 화면에서 '깃대' 로 보이는 전부다.
        //   0 이 되면 깃대가 페넌트에 완전히 가려 *"깃발 깃대를 표현하자"* 가 없던 일이 된다.
        const shown = Math.max(a.y, b.y) - Math.max(f.pts[0]!.y, f.pts[1]!.y);
        expect(shown, `${tag}: 드러난 깃대`).toBeCloseTo(SIDE_FLAG_TAIL_PX, 6);
        expect(SIDE_FLAG_TAIL_PX).toBeGreaterThan(0);
      }
    }
  });

  // ★ 2026-08-16 기현 지시: *"골라인과는 0.5미터 떨어져 둘것."* 어느 점이 골라인에 가장
  //   가까운지는 방향마다 다르다 — 왼쪽 골은 페넌트 꼭짓점, 오른쪽 골은 깃대, 하프는 깃대 위 끝.
  //   재는 것은 언제나 **가장 가까운 점**이다.
  it('★ 골라인에서 정확히 0.5 m 떨어진다', () => {
    expect(SIDE_FLAG_GAP_PX).toBe(0.5 * 25);
    const full = courtDefFor('full');
    const mid = full.vbW / 2;
    const fs = marks('full').flags;
    for (const f of fs.filter((x) => x.at.x < mid)) {
      expect(Math.max(...f.all.map((p) => p.x)), '왼쪽 골').toBeCloseTo(full.surface.x - SIDE_FLAG_GAP_PX, 6);
    }
    for (const f of fs.filter((x) => x.at.x > mid)) {
      expect(Math.min(...f.all.map((p) => p.x)), '오른쪽 골').toBeCloseTo(full.surface.x + full.surface.w + SIDE_FLAG_GAP_PX, 6);
    }
    const half = courtDefFor('half');
    const line = half.surface.y + half.surface.h;
    for (const f of marks('half', 'away').flags) {
      expect(Math.min(...f.all.map((p) => p.y)), '하프').toBeCloseTo(line + SIDE_FLAG_GAP_PX, 6);
    }
  });

  it('두 깃발이 서로 안 겹친다 — 골라인을 따라 깃대 길이보다 넓게 벌어진다', () => {
    expect(SIDE_FLAG_SPACING_PX).toBeGreaterThan(SIDE_FLAG_POLE_PX);
    // 하프(가로 골라인) — x 로 벌어진다.
    const hs = marks('half', 'away').flags;
    expect(Math.abs(hs[0]!.at.x - hs[1]!.at.x)).toBeCloseTo(SIDE_FLAG_SPACING_PX, 6);
    // 풀(세로 골라인) — y 로 벌어진다.
    const left = marks('full').flags.filter((f) => f.at.x < courtDefFor('full').vbW / 2);
    expect(Math.abs(left[0]!.at.y - left[1]!.at.y)).toBeCloseTo(SIDE_FLAG_SPACING_PX, 6);
  });
});

describe('진영 표시 — 색이 곧 진영이다', () => {
  it('★ 골키퍼 깃발이 언제나 **먼저**다 — 세로 골라인이면 위, 가로면 왼쪽', () => {
    // 글자를 뺀 뒤로 이 순서가 두 깃발을 가르는 **유일한 비색 채널**이다. 뒤집히면 여기서 걸린다.
    // 가로 골라인(하프) — 왼쪽이 골키퍼.
    const hs = [...marks('half', 'away').flags].sort((a, b) => a.at.x - b.at.x);
    expect(hs[0]!.role, '가로 골라인에서 왼쪽이 골키퍼가 아니다').toBe('gk');
    expect(hs[0]!.fill).toBe(DEFAULT_TEAMS.away.gkColor);
    expect(hs[1]!.fill).toBe(DEFAULT_TEAMS.away.color);
    // 세로 골라인(풀) — 위가 골키퍼. 왼쪽·오른쪽 골 **둘 다** 같은 규칙이라야 한다.
    const full = courtDefFor('full');
    for (const side of ['left', 'right'] as const) {
      const mid = full.vbW / 2;
      const fs = marks('full')
        .flags.filter((f) => (side === 'left' ? f.at.x < mid : f.at.x > mid))
        .sort((a, b) => a.at.y - b.at.y);
      const team = side === 'left' ? DEFAULT_TEAMS.home : DEFAULT_TEAMS.away;
      expect(fs[0]!.fill, `${side}: 위가 골키퍼가 아니다`).toBe(team.gkColor);
      expect(fs[1]!.fill, `${side}: 아래가 일반 선수가 아니다`).toBe(team.color);
    }
  });

  it('★ 진영을 뒤집으면 양쪽 색이 맞바뀐다 — 이 표시가 곧 진영이다', () => {
    const homeLeft = marks('full', 'home');
    const awayLeft = marks('full', 'away');
    expect(homeLeft.groups.map((g) => g.getAttribute('data-side-mark'))).toEqual(['home', 'away']);
    expect(awayLeft.groups.map((g) => g.getAttribute('data-side-mark'))).toEqual(['away', 'home']);
    // 색까지 실제로 따라간다(그룹 속성만 바뀌고 색은 그대로인 배선을 막는다).
    const leftFillsOf = (m: ReturnType<typeof marks>) =>
      m.flags
        .filter((f) => f.at.x < courtDefFor('full').vbW / 2)
        .sort((a, b) => a.at.y - b.at.y)
        .map((f) => f.fill);
    expect(leftFillsOf(homeLeft)).toEqual([DEFAULT_TEAMS.home.gkColor, DEFAULT_TEAMS.home.color]);
    expect(leftFillsOf(awayLeft)).toEqual([DEFAULT_TEAMS.away.gkColor, DEFAULT_TEAMS.away.color]);
  });

  it('진영을 안 넘기면 기본값을 쓴다 — 풀은 홈이 왼쪽, 하프는 원정이 그 골', () => {
    const { container } = render(
      <svg>
        <SideMarks mode="full" teams={DEFAULT_TEAMS as Parameters<typeof SideMarks>[0]['teams']} />
      </svg>,
    );
    expect(Array.from(container.querySelectorAll('g[data-side-mark]')).map((g) => g.getAttribute('data-side-mark'))).toEqual([
      'home',
      'away',
    ]);
    const half = render(
      <svg>
        <SideMarks mode="half" teams={DEFAULT_TEAMS as Parameters<typeof SideMarks>[0]['teams']} />
      </svg>,
    );
    expect(half.container.querySelector('g[data-side-mark]')!.getAttribute('data-side-mark')).toBe('away');
  });
});

// ── §6.4 표시 회전 (기현 지시 2026-08-27) ───────────────────────────────────────────────
// *"화면 폭에 의해서 코트가 90도 회전하면 골대뒤의 깃발도 90도 회전해야함"* — 판이 돌아도
// 깃발은 **화면에서** 제 모양(깃대 세로 · 꼭짓점 오른쪽)을 지켜야 한다는 뜻이다. 격자 라벨이
// 글자를 되돌려 세우는 것과 같은 규칙이고, 그래서 같은 헬퍼(`uprightAt`)를 쓴다.
//
// ⚠️ 이 블록이 없으면 회귀가 조용하다: 되돌림은 **판 회전 안**에서 상쇄되는 값이라, 빠져도
//    깃발은 여전히 골라인 뒤 제자리에 그려진다. 달라지는 것은 화면에서의 방향뿐이고 그것을
//    보는 것은 사람뿐이다.
describe('진영 표시 — 판이 돌아도 화면에서는 제 모양이다 (§6.4)', () => {
  it('★ 90° 회전이면 깃발마다 되돌림이 붙는다 — 중심은 그 깃발의 상자 중심이다', () => {
    const fs = marks('full', 'home', undefined, 90).flags;
    expect(fs).toHaveLength(4);
    for (const f of fs) {
      // 중심이 딴 점이면 깃발이 제자리에서 도는 대신 옆으로 밀린다(아래 0.5 m 검사가 그 감시자다).
      expect(f.upright).toMatch(/^rotate\(-90 -?[\d.]+ -?[\d.]+\)$/);
    }
  });

  it('회전이 없으면 transform 자체가 없다 — PNG·인쇄가 예전 그대로인 이유', () => {
    for (const f of marks('full').flags) expect(f.upright).toBeNull();
    // 불필요한 transform 은 렌더 품질만 깎는다(uprightAt 이 undefined 를 주는 근거).
    for (const f of marks('half', 'away').flags) expect(f.upright).toBeNull();
  });

  it('★ 되돌려도 골라인에서 정확히 0.5 m 다 — 상자의 두 변이 맞바뀌므로 자리를 다시 잡는다', () => {
    // 되돌리면 바깥으로 뻗는 길이가 페넌트 높이(12.1)에서 깃대 길이(19)로 바뀐다. 자리를
    // 안 고치면 깃발이 골라인 쪽으로 3.45 파고든다 — 여기서 잡는 것이 정확히 그것이다.
    const full = courtDefFor('full');
    const mid = full.vbW / 2;
    const fs = marks('full', 'home', undefined, 90).flags.map((f) => ({
      ...f,
      moved: f.all.map((p) => applyTransform(f.upright, p)),
      center: applyTransform(f.upright, f.at),
    }));
    for (const f of fs.filter((x) => x.center.x < mid)) {
      expect(Math.max(...f.moved.map((p) => p.x)), '왼쪽 골').toBeCloseTo(full.surface.x - SIDE_FLAG_GAP_PX, 6);
    }
    for (const f of fs.filter((x) => x.center.x > mid)) {
      expect(Math.min(...f.moved.map((p) => p.x)), '오른쪽 골').toBeCloseTo(full.surface.x + full.surface.w + SIDE_FLAG_GAP_PX, 6);
    }
  });

  it('★ 되돌려도 viewBox 를 안 넘는다 — 여백 37.5 는 깃대(19)+간격(12.5)=31.5 를 견딘다', () => {
    for (const mode of COURT_MODES) {
      for (const size of [undefined, ...COURT_SIZES]) {
        const def = courtDefFor(mode, size as CourtSize | undefined);
        for (const f of marks(mode, 'home', size as CourtSize | undefined, 90).flags) {
          for (const p of f.all.map((q) => applyTransform(f.upright, q))) {
            expect(p.x, `${mode}/${size ?? '기본'} x`).toBeGreaterThanOrEqual(0);
            expect(p.x, `${mode}/${size ?? '기본'} x`).toBeLessThanOrEqual(def.vbW);
            expect(p.y, `${mode}/${size ?? '기본'} y`).toBeGreaterThanOrEqual(0);
            expect(p.y, `${mode}/${size ?? '기본'} y`).toBeLessThanOrEqual(def.vbH);
          }
        }
      }
    }
  });
});
