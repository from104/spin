// §7.3/§4.4 P2-3 회귀 — 스텝 사진 뭉치의 터치 타깃과 바 높이.
//
// 이 파일의 원래 감사 evidence: `TransportBar.tsx` 의 스텝 노드가 `flex:1, height:6` 이라 실제
// 클릭 영역이 6px 였다. 그 뒤 2.4 가 히트 래퍼를 `var(--hit)` 로 올렸고, 2.10 이 트랙 자체를
// **칩 줄**로 바꿨다. 지키려는 것은 계속 같다 — **손잡이가 44 밑으로 내려가지 않는다.**
//
// 2.10 에서 사라진 것: `clampTimelineHit`(트랙을 n−1 로 나눠 24px 미만이면 노드를 접던 규칙).
// 칩은 고정 크기고 줄이 가로로 구르므로 스텝이 몇 장이든 줄지 않는다 — 아래 '19장' 테스트가
// 옛 규칙이라면 노드가 0개였을 자리에서 19개를 요구한다.
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { TransportBar } from './TransportBar.tsx';
import { stepChipBoxPx, stepChipWidthCss, transportBarHeightPx } from './bottomBarMetrics.ts';
import { createDrill } from '../../model/defaults.ts';
import { addStepAfter } from '../../model/edits.ts';
import { LIMITS } from '../../model/validate.ts';
import type { Drill } from '../../model/drill.ts';
import { SettingsProvider } from '../../store/settings/SettingsProvider.tsx';

// 하단 바에 속도 제한 스위치가 들어가면서 설정 컨텍스트가 필요해졌다.
const wrapper = ({ children }: { children: ReactNode }) => <SettingsProvider>{children}</SettingsProvider>;

function makeDrill(n: number, courtMode: 'full' | 'half' = 'full'): Drill {
  let d = createDrill({ courtMode });
  for (let i = 1; i < n; i++) d = addStepAfter(d, i - 1);
  return d;
}

const noop = () => {};

function renderBar(d: Drill, over: Partial<Parameters<typeof TransportBar>[0]> = {}) {
  const props = {
    drill: d,
    stepId: d.steps[0]!.id,
    onSelectStep: noop,
    onReorderStep: noop,
    onAddStep: noop,
    playing: false,
    onTogglePlay: noop,
    speed: 1 as const,
    onCycleSpeed: noop,
    ...over,
  };
  return render(<TransportBar {...props} />, { wrapper });
}

describe('스텝 칩 히트 영역 (§5.4 완료 판정 ≥44)', () => {
  it('칩 상자는 --hit 파생이다 — 높이·최소폭이 var(--hit), 폭은 코트 비율 calc', () => {
    renderBar(makeDrill(4));
    const chips = screen.getAllByRole('tab');
    expect(chips).toHaveLength(4);
    for (const chip of chips) {
      // 회귀 포인트: 과거엔 6px 였고, 2.4 이후로도 44 리터럴이면 큰 터치 타깃에서 안 자란다.
      expect(chip.style.height).toBe('var(--hit)');
      expect(chip.style.minHeight).toBe('var(--hit)');
      expect(chip.style.minWidth).toBe('var(--hit)');
      expect(chip.style.width).toBe('calc(var(--hit) * 1.571)');
      expect(chip.style.width).toBe(stepChipWidthCss('full')); // 식과 문자열을 함께 건다
    }
    // 기본값(--hit 44)에서의 실제 픽셀. jsdom 은 calc(var()) 를 계산하지 못하므로 픽셀은 식으로 검산한다.
    expect(stepChipBoxPx(44, 'full')).toEqual({ w: 69, h: 44 });
  });

  it('하프 코트 드릴이면 칩도 하프 비율이다', () => {
    renderBar(makeDrill(2, 'half'));
    expect(screen.getAllByRole('tab')[0]!.style.width).toBe('calc(var(--hit) * 1.167)');
  });

  it('19장이어도 칩이 19개다 — 옛 규칙(트랙 430 기준 n≥19)이면 0개였다', () => {
    renderBar(makeDrill(19));
    const chips = screen.getAllByRole('tab');
    expect(chips).toHaveLength(19);
    for (const chip of chips) expect(chip.style.height).toBe('var(--hit)');
    // 노드를 접고 남기던 대체 경로(진행 바)는 더 필요 없다.
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    // 이동 수단은 그대로 남는다 — 칩 줄이 이전/다음을 대체하는 것이 아니다.
    expect(screen.getByRole('button', { name: '이전 스텝' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '다음 스텝' })).toBeInTheDocument();
  });

  it('칩은 자기 자리와 총 장수를 말한다 — 라벨줄을 흡수했으므로 여기가 유일한 출처다', () => {
    const d = makeDrill(3);
    renderBar(d, { stepId: d.steps[1]!.id });
    const chips = screen.getAllByRole('tab');
    expect(chips.map((c) => c.getAttribute('aria-posinset'))).toEqual(['1', '2', '3']);
    expect(chips.map((c) => c.getAttribute('aria-setsize'))).toEqual(['3', '3', '3']);
    expect(chips.map((c) => c.getAttribute('aria-selected'))).toEqual(['false', 'true', 'false']);
    expect(chips[1]).toHaveAccessibleName(/^스텝 2/);
  });

  it('칩을 누르면 그 스텝이 선택된다', async () => {
    const onSelectStep = vi.fn();
    const d = makeDrill(3);
    renderBar(d, { onSelectStep });
    await userEvent.click(screen.getAllByRole('tab')[2]!);
    expect(onSelectStep).toHaveBeenCalledWith(d.steps[2]!.id);
  });
});

describe('바 높이 ≤64 (§5.2 예산 132)', () => {
  it('한 줄뿐이고 그 줄 높이가 재생 버튼(= --hit + 4)이다', () => {
    renderBar(makeDrill(3));
    const bar = screen.getByRole('tablist', { name: '스텝' }).closest('div[style*="border-top"]') as HTMLElement;
    expect(bar.style.padding).toBe('7px 24px 8px'); // 라벨줄을 흡수한 값(12/15 → 7/8)
    const row = bar.firstElementChild as HTMLElement;
    expect(row.style.height).toBe('calc(var(--hit) + 4px)');
    // 문자열 → 픽셀 검산. border 1 + 7 + 48 + 8 = 64.
    expect(transportBarHeightPx(44)).toBe(64);
  });

  it('재생 버튼의 +4px 위계는 그대로다 — 이전/다음은 var(--hit)', () => {
    renderBar(makeDrill(3));
    for (const name of ['이전 스텝', '다음 스텝', '한 장 더 찍기']) {
      const btn = screen.getByRole('button', { name });
      expect(btn.style.width, name).toBe('var(--hit)');
      expect(btn.style.height, name).toBe('var(--hit)');
    }
    const play = screen.getByRole('button', { name: '재생' });
    expect(play.style.width).toBe('calc(var(--hit) + 4px)');
    expect(play.style.height).toBe('calc(var(--hit) + 4px)');
  });
});

describe('[한 장 더 찍기]', () => {
  it('버튼 하나로 지금 판을 한 장 더 찍는다', async () => {
    const onAddStep = vi.fn();
    renderBar(makeDrill(2), { onAddStep });
    await userEvent.click(screen.getByRole('button', { name: '한 장 더 찍기' }));
    expect(onAddStep).toHaveBeenCalledTimes(1);
  });

  it('상한(60장)에서는 잠기고 이유를 말한다 — 넘겨 봐야 저장 때 뒤에서 잘린다', async () => {
    const onAddStep = vi.fn();
    renderBar(makeDrill(LIMITS.maxSteps), { onAddStep });
    const btn = screen.getByRole('button', { name: '한 장 더 찍기' });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('title', expect.stringContaining(String(LIMITS.maxSteps)));
    await userEvent.click(btn);
    expect(onAddStep).not.toHaveBeenCalled();
  });

  // 위의 "안 불렸다" 가 '배선이 아예 없어서' 통과하는 것이 아님을 보이는 대조군이다.
  it('대조군: 59장에서는 열려 있고 실제로 발화한다', async () => {
    const onAddStep = vi.fn();
    renderBar(makeDrill(LIMITS.maxSteps - 1), { onAddStep });
    const btn = screen.getByRole('button', { name: '한 장 더 찍기' });
    expect(btn).toBeEnabled();
    await userEvent.click(btn);
    expect(onAddStep).toHaveBeenCalledTimes(1);
  });
});
