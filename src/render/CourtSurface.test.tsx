// §6.6 코트 라인 존재·굵기 검증. 좌표는 court.ts/grid.ts 가 이미 검산했으므로 여기서는
// "프로토타입 마크업이 그대로 이식됐는가" + "variant 굵기표가 맞는가"만 본다.
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { CourtSurface } from './CourtSurface.tsx';

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

  it('킥인 원(#f5f5f5) 4개, 골 십자 2개를 그린다 — editor 굵기는 r=4/sw=1.5, cross sw=2.2', () => {
    const c = renderCourt('full', 'editor');
    const spots = c.querySelectorAll('g[fill="#f5f5f5"] > circle');
    expect(spots).toHaveLength(4);
    expect(spots[0].parentElement).toHaveAttribute('stroke-width', '1.5');
    spots.forEach((s) => expect(s).toHaveAttribute('r', '4'));
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
  it('editor: 외곽 path·하프라인·센터서클 호·골지역 1개·킥인 원 2개를 그리고 센터점은 없다', () => {
    const c = renderCourt('half', 'editor');
    expect(c.querySelector('path[d^="M25,25 L25,400"]')).not.toBeNull();
    expect(c.querySelector('path[d^="M175,25 A75,75"]')).not.toBeNull();
    const spots = c.querySelectorAll('g[fill="#f5f5f5"] > circle');
    expect(spots).toHaveLength(2);
    expect(c.querySelector('circle[fill="#ffffff"]')).toBeNull();
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
