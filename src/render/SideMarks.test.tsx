// 진영 표시 — 골라인 뒤 점 둘 (기현 지시 2026-08-15).
//
// jsdom 은 픽셀을 안 그리므로 **볼 수 없는 것은 좌표와 순서로 잰다**(2026-08-15 §함정 ①의 교훈).
// 여기서 재는 것 넷: ① 존마다 점이 둘인가 ② 골라인 **바깥**인가 ③ viewBox 를 안 넘는가
// ④ 색이 그 진영 팀의 골키퍼/일반 색인가. 넷 중 어느 하나가 틀리면 화면에서는 "점이 안 보인다"
// 또는 "엉뚱한 팀 색" 으로 나타나는데, 둘 다 마크업 존재 여부로는 안 잡힌다.
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { SideMarks, SIDE_DOT_GAP_PX, SIDE_DOT_R_PX, SIDE_DOT_SPACING_PX } from './SideMarks.tsx';
import { COURT_MODES, COURT_SIZES, courtDefFor } from '../model/court.ts';
import { DEFAULT_TEAMS } from '../model/defaults.ts';
import type { CourtMode, CourtSize } from '../model/court.ts';
import type { TeamSide } from '../model/drill.ts';

function marks(mode: CourtMode, defense: TeamSide = 'home', size?: CourtSize) {
  const { container } = render(
    <svg>
      <SideMarks mode={mode} size={size} teams={DEFAULT_TEAMS as Parameters<typeof SideMarks>[0]['teams']} defense={defense} />
    </svg>,
  );
  return {
    groups: Array.from(container.querySelectorAll('g[data-side-mark]')),
    circles: Array.from(container.querySelectorAll('circle')),
    root: container.querySelector('g[data-side-marks]'),
  };
}

const num = (el: Element, a: string): number => Number(el.getAttribute(a));

describe('진영 표시 — 개수와 자리', () => {
  it('풀 코트는 존이 둘이라 그룹 둘 · 점 넷', () => {
    const m = marks('full');
    expect(m.groups).toHaveLength(2);
    expect(m.circles).toHaveLength(4);
  });

  it('하프 코트는 골이 하나 — 그룹 하나 · 점 둘', () => {
    const m = marks('half', 'away');
    expect(m.groups).toHaveLength(1);
    expect(m.circles).toHaveLength(2);
  });

  it('★ 플랫 코트에는 아무것도 안 그린다 — 진영이라는 개념이 없다', () => {
    const m = marks('flat');
    expect(m.root, '플랫에 진영 표시가 그려졌다').toBeNull();
    expect(m.circles).toHaveLength(0);
  });

  it('★ 점은 골라인 **바깥**에 있다 — 안에 있으면 코트 그림을 가린다', () => {
    const def = courtDefFor('full');
    const m = marks('full');
    const left = m.circles.filter((c) => num(c, 'cx') < def.vbW / 2);
    expect(left).toHaveLength(2);
    for (const c of left) {
      // 경기면 왼쪽 변보다 왼쪽(= 판 밖 여백)이다.
      expect(num(c, 'cx'), '점이 경기면 안으로 들어왔다').toBeLessThan(def.surface.x);
    }
    // 하프 코트의 골라인은 **아래쪽**이다 — 좌우로 잡고 있으면 여기서 걸린다.
    const half = courtDefFor('half');
    for (const c of marks('half', 'away').circles) {
      expect(num(c, 'cy'), '하프에서 점이 경기면 위로 갔다').toBeGreaterThan(half.surface.y + half.surface.h);
    }
  });

  it('★ 어느 코트에서도 viewBox 를 안 넘는다 — 넘으면 그냥 잘린다', () => {
    for (const mode of COURT_MODES) {
      for (const size of COURT_SIZES) {
        const def = courtDefFor(mode, size);
        for (const c of marks(mode, 'home', size).circles) {
          const tag = `${mode}/${size}`;
          expect(num(c, 'cx') - SIDE_DOT_R_PX, tag).toBeGreaterThanOrEqual(0);
          expect(num(c, 'cy') - SIDE_DOT_R_PX, tag).toBeGreaterThanOrEqual(0);
          expect(num(c, 'cx') + SIDE_DOT_R_PX, tag).toBeLessThanOrEqual(def.vbW);
          expect(num(c, 'cy') + SIDE_DOT_R_PX, tag).toBeLessThanOrEqual(def.vbH);
        }
      }
    }
  });

  it('★ 두 점이 **골라인과 나란하다** — 골라인에서 같은 거리다', () => {
    // 세로 골라인(풀)이면 x 가 같고, 가로 골라인(하프)이면 y 가 같다. 처음에는 바깥으로
    // 겹쳐 나가게 놓았었다(기현 지시로 뒤집힘) — 그때는 이 단언이 정반대였다.
    const full = courtDefFor('full');
    const left = marks('full').circles.filter((c) => num(c, 'cx') < full.vbW / 2);
    expect(left.map((c) => num(c, 'cx'))).toEqual([full.surface.x - SIDE_DOT_GAP_PX, full.surface.x - SIDE_DOT_GAP_PX]);

    const half = courtDefFor('half');
    const line = half.surface.y + half.surface.h;
    const hs = marks('half', 'away').circles;
    expect(hs.map((c) => num(c, 'cy'))).toEqual([line + SIDE_DOT_GAP_PX, line + SIDE_DOT_GAP_PX]);
  });

  it('두 점이 서로 안 겹친다 — 골라인을 따라 지름보다 넓게 벌어진다', () => {
    expect(SIDE_DOT_SPACING_PX).toBeGreaterThan(SIDE_DOT_R_PX * 2);
    // 하프(가로 골라인) — x 로 벌어진다.
    const hs = marks('half', 'away').circles;
    expect(Math.abs(num(hs[0]!, 'cx') - num(hs[1]!, 'cx'))).toBeCloseTo(SIDE_DOT_SPACING_PX, 6);
    // 풀(세로 골라인) — y 로 벌어진다.
    const left = marks('full').circles.filter((c) => num(c, 'cx') < courtDefFor('full').vbW / 2);
    expect(Math.abs(num(left[0]!, 'cy') - num(left[1]!, 'cy'))).toBeCloseTo(SIDE_DOT_SPACING_PX, 6);
  });
});

describe('진영 표시 — 색이 곧 진영이다', () => {
  it('★ 골키퍼 점이 언제나 **먼저**다 — 세로 골라인이면 위, 가로면 왼쪽', () => {
    // 색을 못 가리는 사람에게 남는 유일한 비색 채널이다. 순서가 뒤집히면 여기서 걸린다.
    // 가로 골라인(하프) — 왼쪽이 골키퍼.
    const hs = [...marks('half', 'away').circles].sort((a, b) => num(a, 'cx') - num(b, 'cx'));
    expect(hs[0]!.getAttribute('fill'), '가로 골라인에서 왼쪽이 골키퍼가 아니다').toBe(DEFAULT_TEAMS.away.gkColor);
    expect(hs[1]!.getAttribute('fill')).toBe(DEFAULT_TEAMS.away.color);
    // 세로 골라인(풀) — 위가 골키퍼. 왼쪽·오른쪽 골 **둘 다** 같은 규칙이라야 한다.
    const full = courtDefFor('full');
    for (const side of ['left', 'right'] as const) {
      const half2 = full.vbW / 2;
      const cs = marks('full').circles
        .filter((c) => (side === 'left' ? num(c, 'cx') < half2 : num(c, 'cx') > half2))
        .sort((a, b) => num(a, 'cy') - num(b, 'cy'));
      const team = side === 'left' ? DEFAULT_TEAMS.home : DEFAULT_TEAMS.away;
      expect(cs[0]!.getAttribute('fill'), `${side}: 위가 골키퍼가 아니다`).toBe(team.gkColor);
      expect(cs[1]!.getAttribute('fill'), `${side}: 아래가 일반 선수가 아니다`).toBe(team.color);
    }
  });

  it('★ 진영을 뒤집으면 양쪽 색이 맞바뀐다 — 이 표시가 곧 진영이다', () => {
    const homeLeft = marks('full', 'home');
    const awayLeft = marks('full', 'away');
    expect(homeLeft.groups.map((g) => g.getAttribute('data-side-mark'))).toEqual(['home', 'away']);
    expect(awayLeft.groups.map((g) => g.getAttribute('data-side-mark'))).toEqual(['away', 'home']);
    // 색까지 실제로 따라간다(그룹 속성만 바뀌고 색은 그대로인 배선을 막는다).
    const leftFillsOf = (m: ReturnType<typeof marks>) =>
      m.circles
        .filter((c) => num(c, 'cx') < courtDefFor('full').vbW / 2)
        .sort((a, b) => num(a, 'cy') - num(b, 'cy'))
        .map((c) => c.getAttribute('fill'));
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
