// 부록 A: courtPreview() 마크업 이식 검증.
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { CourtPreview } from './CourtPreview.tsx';

describe('CourtPreview', () => {
  it('full: viewBox 0 0 200 125, 외곽 rect + 하프라인 + 골지역 path 2개', () => {
    const { container } = render(<CourtPreview mode="full" />);
    const svg = container.querySelector('svg')!;
    expect(svg).toHaveAttribute('viewBox', '0 0 200 125');
    expect(svg.querySelector('rect')).not.toBeNull();
    expect(svg.querySelector('line')).not.toBeNull(); // 하프라인
    expect(svg.querySelectorAll('path')).toHaveLength(2);
  });

  it('half: viewBox 0 0 125 150, 킥인 원(#c2410c) 2개', () => {
    const { container } = render(<CourtPreview mode="half" />);
    const svg = container.querySelector('svg')!;
    expect(svg).toHaveAttribute('viewBox', '0 0 125 150');
    expect(svg.querySelectorAll('circle[stroke="#c2410c"]')).toHaveLength(2);
  });

  it('⚠️ 5.3: 미니맵에도 센터 서클이 없다 — 코트를 고르는 자리가 규칙을 가르치는 첫 자리다', () => {
    // full 은 r=18 원, half 는 A18.5 반원이었다(둘 다 3 m 센터 서클의 축소판). §9 결정 ⑧ 으로
    // 지웠고, 되살아나면 코치가 판을 열기도 전에 없는 선을 배운다.
    const full = render(<CourtPreview mode="full" />).container;
    expect(full.querySelector('circle')).toBeNull();
    const half = render(<CourtPreview mode="half" />).container;
    const halfDs = Array.from(half.querySelectorAll('path')).map((p) => p.getAttribute('d') ?? '');
    expect(halfDs.length).toBe(2); // 대조군: 훑을 path 가 실제로 있다(외곽 + 골지역)
    for (const d of halfDs) expect(d).not.toMatch(/[Aa]\d/);
    // 대조군 — 부재 단언이 아무 데나 참이 아니다: half 의 킥인 원은 그대로 2개다.
    expect(half.querySelectorAll('circle')).toHaveLength(2);
  });

  it('flat: 점선 라운드 rect 하나만 그린다', () => {
    const { container } = render(<CourtPreview mode="flat" />);
    const svg = container.querySelector('svg')!;
    const rect = svg.querySelector('rect')!;
    expect(rect).toHaveAttribute('stroke-dasharray', '5 5');
    expect(svg.querySelectorAll('*')).toHaveLength(1);
  });
});
