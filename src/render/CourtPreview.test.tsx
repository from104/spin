// 부록 A: courtPreview() 마크업 이식 검증.
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { CourtPreview } from './CourtPreview.tsx';

describe('CourtPreview', () => {
  it('full: viewBox 0 0 200 125, 외곽 rect + 하프라인 + 센터서클 + 골지역 path 2개', () => {
    const { container } = render(<CourtPreview mode="full" />);
    const svg = container.querySelector('svg')!;
    expect(svg).toHaveAttribute('viewBox', '0 0 200 125');
    expect(svg.querySelector('rect')).not.toBeNull();
    expect(svg.querySelector('circle[r="18"]')).not.toBeNull();
    expect(svg.querySelectorAll('path')).toHaveLength(2);
  });

  it('half: viewBox 0 0 125 150, 킥인 원(#c2410c) 2개', () => {
    const { container } = render(<CourtPreview mode="half" />);
    const svg = container.querySelector('svg')!;
    expect(svg).toHaveAttribute('viewBox', '0 0 125 150');
    expect(svg.querySelectorAll('circle[stroke="#c2410c"]')).toHaveLength(2);
  });

  it('flat: 점선 라운드 rect 하나만 그린다', () => {
    const { container } = render(<CourtPreview mode="flat" />);
    const svg = container.querySelector('svg')!;
    const rect = svg.querySelector('rect')!;
    expect(rect).toHaveAttribute('stroke-dasharray', '5 5');
    expect(svg.querySelectorAll('*')).toHaveLength(1);
  });
});
