// §6.6 코트 라인 존재·굵기 검증. 좌표는 court.ts/grid.ts 가 이미 검산했으므로 여기서는
// "프로토타입 마크업이 그대로 이식됐는가" + "variant 굵기표가 맞는가"만 본다.
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { CourtSurface } from './CourtSurface.tsx';
import { COURT_DEFS } from '../model/court.ts';

function renderCourt(mode: 'full' | 'half' | 'flat', variant: 'editor' | 'present' | 'thumb') {
  return render(
    <svg>
      <CourtSurface mode={mode} variant={variant} />
    </svg>,
  ).container;
}

describe('FullCourtLines', () => {
  it('editor: 외곽선 rect·하프라인·센터서클·모서리컷 4개·골지역 2개를 그린다', () => {
    const c = renderCourt('full', 'editor');
    const outline = c.querySelector('rect[width="750"][height="450"]');
    expect(outline).not.toBeNull();
    expect(outline).toHaveAttribute('stroke-width', '3');
    expect(c.querySelector('line[x1="400"]')).not.toBeNull();
    expect(c.querySelector('circle[r="75"]')).not.toBeNull();
    // 모서리컷 4개 + 골지역 2개 = path 6개 (골십자 X표시 path 는 stroke-linecap=round 인 별도 g)
    const straightPaths = c.querySelectorAll('g[stroke-linecap="butt"] > path');
    expect(straightPaths).toHaveLength(6);
  });

  it('editor: 골 십자 2개는 그리되 골대 원은 그리지 않는다 (§5.4)', () => {
    // 편집기에서 골대는 물리 바디라 ObjectLayer 가 그린다 — 휠체어에 밀리기 때문이다.
    // 코트 라인이 같은 자리에 정적 원을 또 그리면 밀린 골대와 원위치 표시가 겹쳐 두 개로 보인다.
    const c = renderCourt('full', 'editor');
    expect(c.querySelectorAll('g[fill="#f5f5f5"] > circle')).toHaveLength(0);
    const crossGroup = Array.from(c.querySelectorAll('g')).find((g) => g.getAttribute('stroke-width') === '2.2');
    expect(crossGroup?.querySelectorAll('path')).toHaveLength(2);
  });

  it('present variant 는 굵기표대로 3.2/3/2.4/r4.4·sw1.6/r5 를 쓴다', () => {
    const c = renderCourt('full', 'present');
    expect(c.querySelector('rect[width="750"]')).toHaveAttribute('stroke-width', '3.2');
    const spots = c.querySelectorAll('g[fill="#f5f5f5"] > circle');
    expect(spots).toHaveLength(4);
    spots.forEach((s) => expect(s).toHaveAttribute('r', '4.4'));
    expect(c.querySelector('circle[r="5"][fill="#ffffff"]')).not.toBeNull();
  });

  it('thumb variant 는 골 십자·킥인 원을 그리지 않고 센터점 r=2 만 남는다', () => {
    const c = renderCourt('full', 'thumb');
    expect(c.querySelector('rect[width="750"]')).toHaveAttribute('stroke-width', '4');
    expect(c.querySelectorAll('g[fill="#f5f5f5"] > circle')).toHaveLength(0);
    expect(c.querySelector('circle[r="2"][fill="#ffffff"]')).not.toBeNull();
  });
});

describe('HalfCourtLines', () => {
  it('editor: 외곽 path·하프라인·센터서클 호·골지역 1개를 그리고 골대 원·센터점은 없다 (§5.4)', () => {
    const c = renderCourt('half', 'editor');
    expect(c.querySelector('path[d^="M25,25 L25,400"]')).not.toBeNull();
    expect(c.querySelector('path[d^="M175,25 A75,75"]')).not.toBeNull();
    expect(c.querySelectorAll('g[fill="#f5f5f5"] > circle')).toHaveLength(0);
    expect(c.querySelector('circle[fill="#ffffff"]')).toBeNull();
  });

  it('present 에는 골대 원 2개가 그대로 남는다 — 시연·썸네일은 물리가 돌지 않는다', () => {
    const c = renderCourt('half', 'present');
    expect(c.querySelectorAll('g[fill="#f5f5f5"] > circle')).toHaveLength(2);
  });
});

// 감사 2026-08-08 minor #7 회귀 — COURT_DEFS.goalPosts/cornerCuts/spotMarks 를 courtLines
// 컴포넌트가 실제로 읽는지 확인한다. 리터럴 좌표로 되돌아가면(진실 공급원이 다시 둘로 갈라지면)
// COURT_DEFS 값을 바꿔도 렌더가 따라가지 않으므로 이 테스트가 깨진다.
describe('courtLines — COURT_DEFS 가 단일 진실 공급원이다(minor #7)', () => {
  it('COURT_DEFS.full.goalPosts 를 바꾸면 골대 원 중심도 따라간다', () => {
    const original = COURT_DEFS.full.goalPosts;
    COURT_DEFS.full.goalPosts = [{ x: 999, y: 888 }, ...original.slice(1)];
    try {
      // editor 는 이제 정적 원을 안 그리므로 present 로 본다(§5.4).
      const c = renderCourt('full', 'present');
      expect(c.querySelector('g[fill="#f5f5f5"] > circle[cx="999"][cy="888"]')).not.toBeNull();
    } finally {
      COURT_DEFS.full.goalPosts = original;
    }
  });

  it('COURT_DEFS.half.cornerCuts 를 바꾸면 모서리컷 path 도 따라간다', () => {
    const original = COURT_DEFS.half.cornerCuts;
    COURT_DEFS.half.cornerCuts = ['M1,2 L3,4', ...original.slice(1)];
    try {
      const c = renderCourt('half', 'editor');
      expect(c.querySelector('path[d="M1,2 L3,4"]')).not.toBeNull();
    } finally {
      COURT_DEFS.half.cornerCuts = original;
    }
  });

  it('COURT_DEFS.full.spotMarks 를 바꾸면 골 십자 위치도 따라간다', () => {
    const original = COURT_DEFS.full.spotMarks;
    COURT_DEFS.full.spotMarks = [{ x: 200, y: 300 }, original[1]!];
    try {
      const c = renderCourt('full', 'editor'); // editor: dy=3, dx=3.5 → M196.5,297 L203.5,303 ...
      expect(c.querySelector('path[d="M196.5,297 L203.5,303 M203.5,297 L196.5,303"]')).not.toBeNull();
    } finally {
      COURT_DEFS.full.spotMarks = original;
    }
  });
});

describe('FlatCourtLines', () => {
  it('세 variant 모두 아무것도 그리지 않는다("라인 없음")', () => {
    for (const variant of ['editor', 'present', 'thumb'] as const) {
      const c = renderCourt('flat', variant);
      expect(c.querySelectorAll('svg > *').length).toBe(0);
    }
  });
});
