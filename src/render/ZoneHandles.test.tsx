// §10.7 ZoneHandles — 핸들의 **월드 위치**가 physics-world 의 zoneHandles()(= model/chair.ts 의
// pointAtLever)와 같아야 한다. 지금 구조에서는 그게 계산 일치가 아니라 구조적으로 보장된다:
// 핸들을 차체 로컬 (lever, 0) 에 그리고 그룹이 칩과 같은 transform 을 받기 때문이다.
import { describe, expect, it } from 'vitest';
import { render as rtlRender } from '@testing-library/react';
import type { ReactElement } from 'react';
import { ZoneHandles } from './ZoneHandles.tsx';
import { createTransformWriter } from './transformWriter.ts';
import { CHAIR, INTERACT } from '../core/constants.ts';
import { DEG } from '../core/angle.ts';
import type { ChairPose } from '../model/chair.ts';
import type { ChairId } from '../core/ids.ts';
import { SettingsProvider } from '../store/settings/SettingsProvider.tsx';

const render = (ui: ReactElement) => rtlRender(ui, { wrapper: SettingsProvider });

const CH = 'ch_a' as ChairId;

/** "translate(x y) rotate(deg)" 를 파싱한다. */
function parseTransform(t: string): { x: number; y: number; deg: number } {
  const m = /translate\(([-\d.]+) ([-\d.]+)\) rotate\(([-\d.]+)\)/.exec(t);
  return { x: Number(m![1]), y: Number(m![2]), deg: Number(m![3]) };
}

describe('ZoneHandles', () => {
  it('chairId 가 null 이면 아무것도 그리지 않는다', () => {
    const writer = createTransformWriter();
    const { container } = render(
      <svg>
        <ZoneHandles chairId={null} writer={writer} pxPerUnit={1} activeZone={null} />
      </svg>,
    );
    expect(container.querySelectorAll('circle')).toHaveLength(0);
  });

  it('차체 밖 견인 가이드 둘만 그린다 — 차체 안에는 핸들이 없다', () => {
    const writer = createTransformWriter();
    const { container } = render(
      <svg>
        <ZoneHandles chairId={CH} writer={writer} pxPerUnit={1} activeZone={null} />
      </svg>,
    );
    const groups = Array.from(container.querySelectorAll('g[transform^="translate("]'));
    const locals = groups.map((g) => g.getAttribute('transform'));
    // 2026-08-11 기현 지시: 차체 안쪽 가이드는 없애고 앞뒤 바깥만 남긴다. 차체 두 구역은
    // 음영과 마우스 커서로 이미 표시되므로 같은 자리에 핸들까지 얹으면 등번호만 가린다.
    expect(groups).toHaveLength(2);
    for (const zone of ['towRear', 'towFront'] as const) {
      const lever = INTERACT.handleLeverPx[zone];
      expect(locals).toContain(`translate(${lever} 0)`);
      // 견인 가이드는 정의상 차체 **밖**이어야 한다(뒤끝 −7.5 ~ 앞범퍼 +30).
      expect(lever < -CHAIR.pivotToRearPx || lever > CHAIR.pivotToFrontPx).toBe(true);
    }
    for (const zone of ['translate', 'spin'] as const) {
      expect(locals).not.toContain(`translate(${INTERACT.handleLeverPx[zone]} 0)`);
    }
  });

  it('칩이 움직이면 핸들 그룹도 같은 transform 을 받아 따라간다 (회귀)', () => {
    // 예전에는 월드 좌표를 React useMemo 로 계산해 그렸고 deps 가 [selection] 이라,
    // 칩을 드래그해도 갱신되지 않아 핸들만 선택 시점 자리에 남았다("따로 논다").
    const writer = createTransformWriter();
    const { container } = render(
      <svg>
        <ZoneHandles chairId={CH} writer={writer} pxPerUnit={1} activeZone={null} />
      </svg>,
    );
    const root = container.querySelector('g[aria-hidden="true"]')!;

    const pose: ChairPose = { x: 137, y: 42, theta: Math.PI / 5 };
    writer.write(CH, pose.x, pose.y, pose.theta);

    const t = parseTransform(root.getAttribute('transform')!);
    expect(t.x).toBeCloseTo(pose.x, 1);
    expect(t.y).toBeCloseTo(pose.y, 1);
    expect(t.deg).toBeCloseTo(pose.theta * DEG, 1);
  });
});
