// §10.7 개별 오브젝트 컴포넌트 스모크 — ArrowPath 의 시각 계약(§6.6/§7.2)만 확인한다.
import { describe, expect, it } from 'vitest';
import { render as rtlRender } from '@testing-library/react';
import type { ReactElement } from 'react';
import { ArrowPath } from './ArrowPath.tsx';
import type { ArrowId } from '../../core/ids.ts';
import type { Arrow } from '../../model/arrow.ts';
import { SettingsProvider } from '../../store/settings/SettingsProvider.tsx';

const render = (ui: ReactElement) => rtlRender(ui, { wrapper: SettingsProvider });

describe('ArrowPath', () => {
  it('케이싱(halo) + 본선 + 포커스 링(outer/inner) 을 그리고 marker-end 를 uid 로 조립한다(§6.6/§7.2)', () => {
    const arrow: Arrow = { id: 'ar_1' as ArrowId, from: { x: 0, y: 0 }, ctrl: { x: 5, y: 0 }, to: { x: 10, y: 0 } };
    const { container } = render(
      <svg>
        <ArrowPath arrow={arrow} markerUid="myuid" selected={false} active={false} />
      </svg>,
    );
    const paths = container.querySelectorAll('#obj-ar_1 path');
    expect(paths).toHaveLength(4); // 케이싱 + 본선 + 포커스 outer + 포커스 inner
    // 케이싱은 불투명 검정이어야 §7.1 이 요구하는 3.93:1 이 실제로 나온다(알파 합성이면 2.75:1 로 미달).
    expect(paths[0]).toHaveAttribute('stroke', '#000000');
    // ⚠️ 2026-08-16 — 마커 id 에 화살촉 종류가 붙는다. 기본은 끝점 좁은 화살표 · 시작점 없음.
    expect(paths[1]).toHaveAttribute('marker-end', 'url(#myuid-38bdf8-thin)');
    expect(paths[1]!.hasAttribute('marker-start'), '기본 선에 시작 화살촉이 붙었다').toBe(false);
    // ★ 케이싱에는 화살촉을 **달지 않는다**(기현 신고 2026-08-16). 마커는 붙는 선의 굵기에
    //   비례해 커지므로, 본선보다 굵은 케이싱(5.8)에 같은 마커를 걸면 1.7배 검은 삼각형이
    //   화살촉 뒤로 비어져 나온다. 화살촉의 대비는 마커 자신의 stroke 가 맡는다.
    expect(paths[0]!.hasAttribute('marker-end'), '케이싱에 화살촉이 붙었다').toBe(false);
    expect(paths[0]!.hasAttribute('marker-start'), '케이싱에 화살촉이 붙었다').toBe(false);
    // ArrowPath 만 포커스 표시가 없던 결함(§7.2) — 다른 4종처럼 outer/inner 를 붙였는지 확인.
    expect(paths[2]).toHaveClass('focus-ind-outer');
    expect(paths[3]).toHaveClass('focus-ind-inner');
    expect(paths[2]).toHaveAttribute('d', paths[1]!.getAttribute('d'));
  });

  // 옛 계약(2026-08-16 이전): *"pass 화살표는 점선(9 9)을 쓴다."* 종류가 사라지면서 점선도
  // 함께 사라졌다 — 뜻을 나르는 것은 이제 **양 끝 화살촉**이다. 그 자리를 이 it 이 물려받는다.
  it('★ 양 끝 화살촉이 각자 마커를 고른다 — 없음 · 좁은 · 넓은', () => {
    const arrow: Arrow = {
      id: 'ar_2' as ArrowId,
      headFrom: 'wide',
      headTo: 'none',
      from: { x: 0, y: 0 },
      ctrl: { x: 5, y: 0 },
      to: { x: 10, y: 0 },
    };
    const { container } = render(
      <svg>
        <ArrowPath arrow={arrow} markerUid="uid" selected={false} active={false} />
      </svg>,
    );
    const main = container.querySelectorAll('#obj-ar_2 path')[1]!;
    expect(main).toHaveAttribute('marker-start', 'url(#uid-38bdf8-wide)');
    expect(main.hasAttribute('marker-end'), "headTo:'none' 인데 끝 화살촉이 붙었다").toBe(false);
    // 점선은 더 이상 없다 — 종류가 사라졌으므로 선은 언제나 실선이다.
    expect(main.hasAttribute('stroke-dasharray')).toBe(false);
  });
});
