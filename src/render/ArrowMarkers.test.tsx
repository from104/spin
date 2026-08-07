// §6.6 마커 id 유일성 · 케이싱 마커 검증.
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { ArrowMarkers } from './ArrowMarkers.tsx';

describe('ArrowMarkers', () => {
  it('uid 접두사로 케이싱 마커 1개 + 색상별 마커를 만든다', () => {
    const { container } = render(
      <svg>
        <defs>
          <ArrowMarkers uid="abc" colors={['#38bdf8', '#fbbf24']} />
        </defs>
      </svg>,
    );
    expect(container.querySelector('marker#abc-casing')).not.toBeNull();
    expect(container.querySelector('marker#abc-38bdf8')).not.toBeNull();
    expect(container.querySelector('marker#abc-fbbf24')).not.toBeNull();
    expect(container.querySelectorAll('marker')).toHaveLength(3);
  });

  it('색상이 없으면 케이싱 마커만 만든다', () => {
    const { container } = render(
      <svg>
        <defs>
          <ArrowMarkers uid="xyz" colors={[]} />
        </defs>
      </svg>,
    );
    expect(container.querySelectorAll('marker')).toHaveLength(1);
  });
});
