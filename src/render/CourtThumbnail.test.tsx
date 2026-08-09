// §3.11 썸네일 렌더 검증: viewBox 가 COURT_DEFS[mode] 그대로인지, ThumbSpec 오브젝트가
// 콘→화살표→휠체어→공 순서로 그려지는지 확인한다.
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { CourtThumbnail } from './CourtThumbnail.tsx';
import type { ThumbSpec } from '../model/thumb.ts';

describe('CourtThumbnail', () => {
  it('mode 별 viewBox 는 COURT_DEFS 의 vbW/vbH 그대로다', () => {
    const { container: full } = render(<CourtThumbnail mode="full" />);
    expect(full.querySelector('svg')).toHaveAttribute('viewBox', '0 0 825 525');
    const { container: half } = render(<CourtThumbnail mode="half" />);
    expect(half.querySelector('svg')).toHaveAttribute('viewBox', '0 0 525 450');
  });

  it('thumb 이 없으면 코트만 그리고 오브젝트 레이어는 없다', () => {
    const { container } = render(<CourtThumbnail mode="full" />);
    expect(container.querySelectorAll('circle[r="6"]')).toHaveLength(0);
  });

  it('thumb 이 있으면 콘·화살표·휠체어·공을 이 순서로 그린다(§3.5 레이어 순서)', () => {
    const thumb: ThumbSpec = {
      mode: 'full',
      chairs: [{ x: 100, y: 100, a: 0, t: 0, g: 0 }],
      balls: [[200, 200]],
      cones: [[50, 50, 0]],
      arrows: [{ p: [10, 10, 20, 20, 30, 30], k: 'move' }],
    };
    const { container } = render(<CourtThumbnail mode="full" thumb={thumb} />);
    const groups = container.querySelectorAll('svg > g');
    const layer = groups[groups.length - 1]!; // 코트 라인 g 다음에 오는 마지막 g 가 오브젝트 레이어다
    const tags = Array.from(layer.children).map((el) => el.tagName.toLowerCase());
    expect(tags).toEqual(['path', 'path', 'circle', 'circle']); // 콘(path), 화살표(path), 휠체어(circle), 공(circle)
  });
});
