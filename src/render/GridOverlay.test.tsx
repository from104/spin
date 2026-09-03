// §3.3 격자 렌더 검증. 좌표 정확성은 model/grid.test.ts 가 이미 검산했으므로 여기서는
// "그 좌표대로 선·라벨이 실제로 그려지는가" + "aria-hidden/pointer-events:none 필수 규약"만 본다.
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { GridOverlay } from './GridOverlay.tsx';

function renderGrid(mode: 'full' | 'half' | 'flat', showLabels = true) {
  return render(
    <svg>
      <GridOverlay mode={mode} showLabels={showLabels} />
    </svg>,
  ).container;
}

describe('GridOverlay', () => {
  it('루트 <g> 는 aria-hidden + pointer-events:none 이 필수다(§3.3)', () => {
    const c = renderGrid('full');
    const root = c.querySelector('g');
    expect(root).toHaveAttribute('aria-hidden', 'true');
    expect(root).toHaveAttribute('pointer-events', 'none');
  });

  it('flat: 강조선(.34) 존재, 칸 라벨 대신 축 헤더(a..u / 1..18)를 그린다', () => {
    const c = renderGrid('flat');
    const major = c.querySelector('g[opacity="0.34"]');
    expect(major).not.toBeNull();
    // major.vx 5개 + major.hy 4개 = line 9개
    expect(major!.querySelectorAll('line')).toHaveLength(5 + 4);

    // 1 m 격자는 378칸이고 한 칸이 25×25px 뿐이라 칸마다 라벨을 얹으면 판독 불가 노이즈다.
    // 스프레드시트식 축 헤더로 대신한다 — "b4" 로 칸을 지목하는 것은 그대로 된다.
    expect(c.querySelectorAll('.grid-cell-label')).toHaveLength(0);
    const axis = c.querySelectorAll('.grid-axis-label');
    expect(axis).toHaveLength(21 + 18); // 열 a..u + 행 1..18
    expect(axis[0]).toHaveTextContent('a');
    expect(axis[axis.length - 1]).toHaveTextContent('18');
  });

  it('showLabels=false 면 세 모드 모두 라벨 텍스트가 하나도 그려지지 않는다(설정 "격자 칸 라벨 표시" 토글 배선, major #1)', () => {
    for (const mode of ['full', 'half', 'flat'] as const) {
      const c = renderGrid(mode, false);
      expect(c.querySelectorAll('text')).toHaveLength(0);
      // 선(격자 자체)은 showGrid 소관이라 showLabels 와 무관하게 계속 그려져야 한다.
      expect(c.querySelectorAll('line').length).toBeGreaterThan(0);
    }
  });
});
