// 진영 표시 — 골라인 뒤 **삼각 깃발 둘** (기현 지시 2026-08-15, 모양 교체 2026-08-16).
//
// jsdom 은 픽셀을 안 그리므로 **볼 수 없는 것은 좌표와 순서로 잰다**(2026-08-15 §함정 ①의 교훈).
// 여기서 재는 것 여섯: ① 존마다 깃발이 둘인가 ② 골라인 **바깥**인가 ③ viewBox 를 안 넘는가
// ④ 색이 그 진영 팀의 골키퍼/일반 색인가 ⑤ 글자가 G/P 이고 배경색 위에서 읽히는가
// ⑥ 판이 돌아도 글자가 바로 서는가. 넷 중 어느 하나가 틀리면 화면에서는 "깃발이 안 보인다"
// 또는 "엉뚱한 팀 색" 으로 나타나는데, 둘 다 마크업 존재 여부로는 안 잡힌다.
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import {
  SideMarks,
  SIDE_FLAG_BASE_PX,
  SIDE_FLAG_HALF_PX,
  SIDE_FLAG_LEN_PX,
  SIDE_FLAG_SPACING_PX,
} from './SideMarks.tsx';
import { StageRotProvider } from './stageRot.tsx';
import { COURT_MODES, COURT_SIZES, courtDefFor } from '../model/court.ts';
import { inkFor } from '../core/colors.ts';
import { DEFAULT_TEAMS } from '../model/defaults.ts';
import type { CourtMode, CourtSize } from '../model/court.ts';
import type { TeamSide } from '../model/drill.ts';
import type { StageRot } from './useStageMetrics.ts';

const num = (el: Element, a: string): number => Number(el.getAttribute(a));

/** 삼각형 세 점. `points="x,y x,y x,y"` 를 숫자로 되돌린다 — 앞 둘이 깃대, 셋째가 꼭짓점이다. */
function corners(poly: Element): Array<{ x: number; y: number }> {
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
  letter: string;
  fill: string;
  ink: string;
  /** 글자 앵커 = 삼각형 안의 한 점. 깃발이 어느 골 옆인지 가를 때 이 좌표로 센다. */
  at: { x: number; y: number };
  pts: Array<{ x: number; y: number }>;
  text: Element;
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
    const text = g.querySelector('text')!;
    return {
      role: g.getAttribute('data-side-flag')!,
      letter: text.textContent!,
      fill: poly.getAttribute('fill')!,
      ink: text.getAttribute('fill')!,
      at: { x: num(text, 'x'), y: num(text, 'y') },
      pts: corners(poly),
      text,
    };
  });
  return {
    groups: Array.from(container.querySelectorAll('g[data-side-mark]')),
    flags,
    circles: Array.from(container.querySelectorAll('circle')),
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
      // 세 점 **전부** 경기면 왼쪽 변보다 왼쪽(= 판 밖 여백)이다. 한 점만 재면 꼭짓점만
      // 밖에 있고 밑변이 라인을 물고 있는 배치를 놓친다.
      for (const p of f.pts) expect(p.x, '깃발이 경기면 안으로 들어왔다').toBeLessThan(def.surface.x);
    }
    // 하프 코트의 골라인은 **아래쪽**이다 — 좌우로 잡고 있으면 여기서 걸린다.
    const half = courtDefFor('half');
    for (const f of marks('half', 'away').flags) {
      for (const p of f.pts) expect(p.y, '하프에서 깃발이 경기면 위로 갔다').toBeGreaterThan(half.surface.y + half.surface.h);
    }
  });

  it('★ 어느 코트에서도 viewBox 를 안 넘는다 — 넘으면 그냥 잘린다', () => {
    // 여백은 골라인 바깥 1.5 m = 37.5 월드 px 뿐이다. 깃대(5) + 길이(30) = 35 가 그 안에
    // 들어가는지를 **모든 코트·크기**에서 확인한다 — 한 조합만 넘어도 그 판에서는 잘린다.
    expect(SIDE_FLAG_BASE_PX + SIDE_FLAG_LEN_PX).toBeLessThanOrEqual(1.5 * 25);
    for (const mode of COURT_MODES) {
      for (const size of COURT_SIZES) {
        const def = courtDefFor(mode, size);
        for (const f of marks(mode, 'home', size).flags) {
          const tag = `${mode}/${size}`;
          for (const p of f.pts) {
            expect(p.x, tag).toBeGreaterThanOrEqual(0);
            expect(p.y, tag).toBeGreaterThanOrEqual(0);
            expect(p.x, tag).toBeLessThanOrEqual(def.vbW);
            expect(p.y, tag).toBeLessThanOrEqual(def.vbH);
          }
        }
      }
    }
  });

  it('★ 깃대가 **골라인과 나란하다** — 밑변 두 점이 골라인에서 같은 거리다', () => {
    // 깃대를 골라인에 대고 꼭짓점을 판 밖으로 보내는 것이 이 모양의 배치 규칙이다. 뒤집으면
    // (꼭짓점이 골라인 쪽) 글자가 앉을 넓은 자리가 라인 위로 올라간다.
    const full = courtDefFor('full');
    const f = marks('full').flags.find((x) => x.at.x < full.vbW / 2)!;
    const [s1, s2, tip] = f.pts as [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }];
    expect(s1.x).toBeCloseTo(full.surface.x - SIDE_FLAG_BASE_PX, 6);
    expect(s2.x).toBeCloseTo(full.surface.x - SIDE_FLAG_BASE_PX, 6);
    expect(tip.x).toBeCloseTo(full.surface.x - SIDE_FLAG_BASE_PX - SIDE_FLAG_LEN_PX, 6);
    expect(Math.abs(s1.y - s2.y)).toBeCloseTo(SIDE_FLAG_HALF_PX * 2, 6);

    // 하프(가로 골라인) — 같은 식이 축만 바꿔 돈다.
    const half = courtDefFor('half');
    const line = half.surface.y + half.surface.h;
    const hf = marks('half', 'away').flags[0]!;
    expect(hf.pts.map((p) => p.y)).toEqual([line + SIDE_FLAG_BASE_PX, line + SIDE_FLAG_BASE_PX, line + SIDE_FLAG_BASE_PX + SIDE_FLAG_LEN_PX]);
  });

  it('두 깃발이 서로 안 겹친다 — 골라인을 따라 밑변 폭보다 넓게 벌어진다', () => {
    expect(SIDE_FLAG_SPACING_PX).toBeGreaterThan(SIDE_FLAG_HALF_PX * 2);
    // 하프(가로 골라인) — x 로 벌어진다.
    const hs = marks('half', 'away').flags;
    expect(Math.abs(hs[0]!.at.x - hs[1]!.at.x)).toBeCloseTo(SIDE_FLAG_SPACING_PX, 6);
    // 풀(세로 골라인) — y 로 벌어진다.
    const left = marks('full').flags.filter((f) => f.at.x < courtDefFor('full').vbW / 2);
    expect(Math.abs(left[0]!.at.y - left[1]!.at.y)).toBeCloseTo(SIDE_FLAG_SPACING_PX, 6);
  });
});

describe('진영 표시 — 글자가 색을 대신 읽어 준다', () => {
  // ★ 2026-08-16 기현 지시: *"안에 G,P 표기해서."* 색만으로 가르던 때는 색맹·강한 조명·
  //   빛바랜 프로젝터에서 두 깃발이 그냥 같은 깃발 둘이었다.
  it('★ 골키퍼는 G, 일반 선수는 P 다', () => {
    const m = marks('half', 'away');
    expect(m.flags.map((f) => f.role)).toEqual(['gk', 'field']);
    expect(m.flags.map((f) => f.letter)).toEqual(['G', 'P']);
  });

  it('★ 글자색은 깃발색 위에서 읽히는 쪽으로 뒤집힌다 — 칩 등번호와 같은 함수다', () => {
    // 흰 글자를 박아 두면 노랑·연두 팀에서 글자가 사라진다. `inkFor` 가 그 임계를 갖는다.
    for (const f of marks('full').flags) expect(f.ink, f.fill).toBe(inkFor(f.fill));
  });

  it('★ 판이 90° 돌아도 글자는 바로 선다 — 누운 G/P 는 안 읽힌다', () => {
    const flat = marks('full', 'home', undefined, 0);
    expect(flat.flags[0]!.text.getAttribute('transform'), '안 돌았는데 transform 이 붙었다').toBeNull();
    for (const f of marks('full', 'home', undefined, 90).flags) {
      expect(f.text.getAttribute('transform')).toBe(`rotate(-90 ${f.at.x} ${f.at.y})`);
    }
  });
});

describe('진영 표시 — 색이 곧 진영이다', () => {
  it('★ 골키퍼 깃발이 언제나 **먼저**다 — 세로 골라인이면 위, 가로면 왼쪽', () => {
    // 글자가 생긴 뒤로도 이 순서를 지킨다 — 판 전체를 훑을 때는 글자보다 자리가 먼저 읽힌다.
    // 가로 골라인(하프) — 왼쪽이 골키퍼.
    const hs = [...marks('half', 'away').flags].sort((a, b) => a.at.x - b.at.x);
    expect(hs[0]!.role, '가로 골라인에서 왼쪽이 골키퍼가 아니다').toBe('gk');
    expect(hs[0]!.fill).toBe(DEFAULT_TEAMS.away.gkColor);
    expect(hs[1]!.fill).toBe(DEFAULT_TEAMS.away.color);
    // 세로 골라인(풀) — 위가 골키퍼. 왼쪽·오른쪽 골 **둘 다** 같은 규칙이라야 한다.
    const full = courtDefFor('full');
    for (const side of ['left', 'right'] as const) {
      const half2 = full.vbW / 2;
      const fs = marks('full')
        .flags.filter((f) => (side === 'left' ? f.at.x < half2 : f.at.x > half2))
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
