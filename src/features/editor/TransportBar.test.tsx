// §7.3/§4.4 P2-3 — 재생 트랜스포트의 터치 타깃과 바 높이.
//
// 2026-08-17 재편(PLAN-STEP-EDITING.md 구현 순서 ②) — 스텝 칩·재정렬·추가는 StepSidebar.tsx
// 로 전부 이사했다(그 계약은 StepSidebar.test.tsx·StepSidebar.reorder.test.tsx 가 잇는다).
// 이 파일에 남는 것은 **재생 전담**이 된 뒤에도 유효한 것들뿐이다: 바 높이(64)의 유일한
// 출처가 여전히 재생 버튼(--hit + 4)이라는 것, 그리고 재생·속도 컨트롤 자체의 동작.
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { TransportBar } from './TransportBar.tsx';
import { transportBarHeightPx } from './bottomBarMetrics.ts';
import { SettingsProvider } from '../../store/settings/SettingsProvider.tsx';

// 하단 바에 속도 제한 스위치가 들어가면서 설정 컨텍스트가 필요해졌다.
const wrapper = ({ children }: { children: ReactNode }) => <SettingsProvider>{children}</SettingsProvider>;

const noop = () => {};

function renderBar(over: Partial<Parameters<typeof TransportBar>[0]> = {}) {
  const props = {
    playing: false,
    onTogglePlay: noop,
    canPlay: true,
    speed: 1 as const,
    onCycleSpeed: noop,
    ...over,
  };
  return render(<TransportBar {...props} />, { wrapper });
}

describe('바 높이 ≤64 (§5.2 예산 132)', () => {
  it('한 줄뿐이고 그 줄 높이가 재생 버튼(= --hit + 4)이다', () => {
    renderBar();
    const bar = screen.getByRole('button', { name: '재생' }).closest('div[style*="border-top"]') as HTMLElement;
    expect(bar.style.padding).toBe('7px 24px 8px');
    const row = bar.firstElementChild as HTMLElement;
    expect(row.style.height).toBe('calc(var(--hit) + 4px)');
    // 문자열 → 픽셀 검산. border 1 + 7 + 48 + 8 = 64.
    expect(transportBarHeightPx(44)).toBe(64);
  });

  it('재생 버튼은 --hit + 4 를 유지한다 — 칩이 없어져도 바 높이 출처는 안 바뀐다', () => {
    renderBar();
    const play = screen.getByRole('button', { name: '재생' });
    expect(play.style.width).toBe('calc(var(--hit) + 4px)');
    expect(play.style.height).toBe('calc(var(--hit) + 4px)');
  });
});

describe('재생 토글', () => {
  it('playing 에 따라 라벨과 아이콘이 바뀐다', () => {
    const { rerender } = renderBar({ playing: false });
    expect(screen.getByRole('button', { name: '재생' })).toBeInTheDocument();
    rerender(
      <SettingsProvider>
        <TransportBar playing onTogglePlay={noop} canPlay speed={1} onCycleSpeed={noop} />
      </SettingsProvider>,
    );
    expect(screen.getByRole('button', { name: '일시정지' })).toBeInTheDocument();
  });

  it('누르면 onTogglePlay 가 나간다', async () => {
    const onTogglePlay = vi.fn();
    renderBar({ onTogglePlay });
    await userEvent.click(screen.getByRole('button', { name: '재생' }));
    expect(onTogglePlay).toHaveBeenCalledTimes(1);
  });

  it('canPlay=false 면 잠긴다 — 스텝이 하나뿐일 때 헛손질을 막는 UX(없어도 안전은 useStepPlayback 이 진다)', async () => {
    const onTogglePlay = vi.fn();
    renderBar({ canPlay: false, onTogglePlay });
    const play = screen.getByRole('button', { name: '재생' });
    expect(play).toBeDisabled();
    await userEvent.click(play);
    expect(onTogglePlay).not.toHaveBeenCalled();
  });
});

describe('재생 속도', () => {
  it('누르면 다음 배수로 순환하라고 말하고, 누르면 onCycleSpeed 가 나간다', async () => {
    const onCycleSpeed = vi.fn();
    renderBar({ speed: 1, onCycleSpeed });
    const btn = screen.getByRole('button', { name: '재생 속도 1배. 눌러서 2배로 변경' });
    await userEvent.click(btn);
    expect(onCycleSpeed).toHaveBeenCalledTimes(1);
  });
});

describe('viewControls', () => {
  it('바 맨 끝에 그대로 렌더한다', () => {
    renderBar({ viewControls: <button type="button">보기</button> });
    expect(screen.getByRole('button', { name: '보기' })).toBeInTheDocument();
  });
});
