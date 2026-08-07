// §10.7 ZoneHandles — 렌더 위치가 physics-world 의 zoneHandles() 와 같은 함수
// (model/chair.ts 의 pointAtLever)에서 나오는지는 hitTest.contract.test.ts 가 이미 검증한다.
// 여기서는 이 컴포넌트 자신의 표시 조건·핸들 4개 배치만 스모크한다.
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { ZoneHandles } from './ZoneHandles.tsx';
import { pointAtLever } from '../model/chair.ts';
import { INTERACT } from '../core/constants.ts';
import type { ChairPose } from '../model/chair.ts';

describe('ZoneHandles', () => {
  it('visible=false 또는 pose=null 이면 아무것도 그리지 않는다', () => {
    const { container: c1 } = render(
      <svg>
        <ZoneHandles pose={null} pxPerUnit={1} visible={true} activeZone={null} />
      </svg>,
    );
    expect(c1.querySelectorAll('circle')).toHaveLength(0);

    const pose: ChairPose = { x: 0, y: 0, theta: 0 };
    const { container: c2 } = render(
      <svg>
        <ZoneHandles pose={pose} pxPerUnit={1} visible={false} activeZone={null} />
      </svg>,
    );
    expect(c2.querySelectorAll('circle')).toHaveLength(0);
  });

  it('4개 존 핸들을 pointAtLever 와 동일한 위치에 그린다', () => {
    const pose: ChairPose = { x: 10, y: 20, theta: Math.PI / 6 };
    const { container } = render(
      <svg>
        <ZoneHandles pose={pose} pxPerUnit={1} visible={true} activeZone={null} />
      </svg>,
    );
    const groups = container.querySelectorAll('g[transform^="translate"]');
    expect(groups).toHaveLength(4);
    for (const zone of ['towRear', 'translate', 'spin', 'towFront'] as const) {
      const lever = INTERACT.handleLeverPx[zone];
      const expected = pointAtLever(pose, lever);
      const match = Array.from(groups).some((g) => g.getAttribute('transform') === `translate(${expected.x} ${expected.y})`);
      expect(match).toBe(true);
    }
  });
});
