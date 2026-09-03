// §6.6 마커 id 유일성 · 화살촉 테두리 검증.
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { ARROW_CASING } from '../core/colors.ts';
import { ArrowMarkers } from './ArrowMarkers.tsx';

describe('ArrowMarkers', () => {
  // ⚠️ 2026-08-16 — 화살촉이 **좁은·넓은 둘**이 되면서 마커 수가 배로 늘었다(기현 지시:
  //    양 끝 앵커를 누르면 없음 → 좁은 → 넓은 순환). 케이싱 전용 마커는 **없다** — 같은 날
  //    떼었다(기현 신고: 화살촉 뒤로 검은 삼각형). 대비는 화살촉 자신의 stroke 가 맡는다.
  it('uid 접두사로 색상마다 2종을 만든다', () => {
    const { container } = render(
      <svg>
        <defs>
          <ArrowMarkers uid="abc" colors={['#38bdf8', '#fbbf24']} />
        </defs>
      </svg>,
    );
    for (const k of ['thin', 'wide']) {
      expect(container.querySelector(`marker#abc-38bdf8-${k}`), k).not.toBeNull();
      expect(container.querySelector(`marker#abc-fbbf24-${k}`), k).not.toBeNull();
      // 케이싱 마커를 되살리면 그 마커가 본선보다 굵은 선에 붙어 1.7배로 커진다(머리말).
      expect(container.querySelector(`marker#abc-casing-${k}`), k).toBeNull();
    }
    // 색 2종 × 2 = 4.
    expect(container.querySelectorAll('marker')).toHaveLength(4);
    // ★ 시작점 화살촉은 선을 **거슬러** 봐야 한다 — 이 속성이 빠지면 양쪽 화살표에서
    //   시작 쪽이 선 안쪽을 향해 뒤집힌다.
    for (const m of container.querySelectorAll('marker')) {
      expect(m.getAttribute('orient')).toBe('auto-start-reverse');
    }
    const thin = container.querySelector('marker#abc-38bdf8-thin')!;
    const wide = container.querySelector('marker#abc-38bdf8-wide')!;
    // 넓은 쪽은 **폭만** 크다 — 길이를 함께 키우면 선이 길어진 것처럼 읽힌다.
    expect(Number(wide.getAttribute('markerHeight'))).toBeGreaterThan(Number(thin.getAttribute('markerHeight')));
    const tipX = (m: Element): number => Number(m.querySelector('path')!.getAttribute('d')!.match(/L([\d.]+),/)![1]);
    expect(tipX(wide)).toBe(tipX(thin));
    // ★ 화살촉의 대비는 이 테두리 하나에 달렸다 — 빠지면 #38bdf8 가 코트 대비 2.49:1 로
    //   WCAG 1.4.11 미달인 채 코트 위에 뜬다.
    for (const m of [thin, wide]) {
      const p = m.querySelector('path')!;
      expect(p.getAttribute('stroke')).toBe(ARROW_CASING);
      expect(Number(p.getAttribute('stroke-width'))).toBeGreaterThan(0);
    }
  });
});
