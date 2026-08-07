// §7.3 회귀 — 스텝 타임라인 터치 타깃. 시각 6px 막대는 유지하되 히트 영역은 44px(hard floor 24px)
// 이어야 한다(WCAG 2.5.8). 감사 evidence: TransportBar.tsx:114-133 각 <button role="tab"> 이
// flex:1,height:6 이라 실제 클릭 영역이 6px 였다.
import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TransportBar, clampTimelineHit } from './TransportBar.tsx';
import type { DrillStep } from '../../model/drill.ts';
import type { StepId } from '../../core/ids.ts';

function makeSteps(n: number): DrillStep[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `st_${i}` as StepId,
    name: `스텝${i}`,
    note: '',
    chairs: {},
    balls: {},
    cones: {},
    arrows: [],
    notes: [],
  }));
}

function mockTrackWidth(px: number) {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    width: px,
    height: 44,
    top: 0,
    left: 0,
    right: px,
    bottom: 44,
    x: 0,
    y: 0,
    toJSON() {},
  } as DOMRect);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('clampTimelineHit (§7.3 min(44, track/(n-1)))', () => {
  it('스텝이 1개면 항상 44 를 반환한다(클램프 불필요)', () => {
    expect(clampTimelineHit(0, 1)).toBe(44);
    expect(clampTimelineHit(1000, 1)).toBe(44);
  });

  it('여유가 있으면 44 로 상한 클램프된다', () => {
    expect(clampTimelineHit(700, 8)).toBe(44); // 700/7=100 → 44
  });

  it('DESIGN.md §7.3 "트랙 430 기준 n≥19" 컷오프와 정확히 일치한다', () => {
    expect(clampTimelineHit(430, 18)).toBeCloseTo(25.294, 2); // 430/17, 24 이상 → 표시
    expect(clampTimelineHit(430, 19)).toBeCloseTo(23.888, 2); // 430/18, 24 미만 → 중단
  });
});

describe('TransportBar 스텝 타임라인 히트 영역', () => {
  const noop = () => {};

  it('여유 있는 트랙에서는 role=tab 버튼을 렌더하고 히트 높이가 44px 다', () => {
    mockTrackWidth(700);
    const steps = makeSteps(4);
    render(
      <TransportBar steps={steps} stepId={steps[0]!.id} onSelectStep={noop} playing={false} onTogglePlay={noop} speed={1} onCycleSpeed={noop} />,
    );
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(4);
    for (const tab of tabs) {
      expect(tab.style.height).toBe('44px'); // 회귀 포인트: 과거엔 6px 이었다
    }
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('히트 폭이 24px 미만으로 떨어지면 노드 렌더를 중단하고 progressbar 만 남긴다', () => {
    mockTrackWidth(430); // iPad 11" 트랙 기준(§7.3)
    const steps = makeSteps(19); // 430/18 ≈ 23.9px < 24
    render(
      <TransportBar steps={steps} stepId={steps[0]!.id} onSelectStep={noop} playing={false} onTogglePlay={noop} speed={1} onCycleSpeed={noop} />,
    );
    expect(screen.queryAllByRole('tab')).toHaveLength(0);
    const bar = screen.getByRole('progressbar', { name: '스텝 진행' });
    expect(bar).toHaveAttribute('aria-valuemax', '19');
    // 스텝 이동은 이전/다음 버튼에 위임된다 — 여전히 존재하고 동작 가능해야 한다.
    expect(screen.getByRole('button', { name: '이전 스텝' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '다음 스텝' })).toBeInTheDocument();
  });
});
