// 기능 바의 **칸 수·구분선 수가 화면과 상수에서 같은가** (2026-08-15).
//
// ⚠️ **이 파일이 왜 생겼는가** — 진영 [진영] 칸을 더하면서 `FUNCTION_BAR_ITEMS` 를 12 로 둔 채
// 두었는데, 전체 테스트가 **그대로 초록**이었다. 그 상수는 장식이 아니다: 크롬 예산이 그것으로
// 기둥의 열 수를 계산하고(`functionBarColumnsAt`), 열 수가 코트 상자 폭을 정하며, 그 폭이
// `rotForFit` 의 1.08 문턱을 넘나들면 **판이 눕느냐 서느냐**가 갈린다. 즉 숫자 하나가 어긋나면
// 어떤 창 크기에서 판이 통째로 다른 방향으로 뜬다 — 그런데 그것을 재는 테스트가 없었다.
//
// 여기서 재는 것은 판정도 그림도 아니고 **두 숫자가 같은가** 뿐이다. 그래서 바를 실제로 그려
// 손잡이를 센다 — 상수를 상수로 대조하면 둘 다 틀린 채 초록이 된다.
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { FunctionBar } from './FunctionBar.tsx';
import { FUNCTION_BAR_DIVIDERS, FUNCTION_BAR_ITEMS } from './functionBarMetrics.ts';
import { SettingsProvider } from '../../store/settings/SettingsProvider.tsx';
import { ToastProvider } from '../../store/toast/ToastProvider.tsx';
import { createDrill } from '../../model/defaults.ts';
import { DEFAULT_TEAMS } from '../../model/defaults.ts';

const noop = () => {};

function mount(courtMode: 'full' | 'half' | 'flat' = 'full') {
  const drill = createDrill({ courtMode });
  return render(
    <SettingsProvider>
      <ToastProvider>
      <FunctionBar
        onZoomIn={noop}
        onZoomOut={noop}
        onZoomReset={noop}
        canUndo
        canRedo
        onUndo={noop}
        onRedo={noop}
        courtMode={courtMode}
        courtSize="30x18"
        courtLocked={false}
        onCourtModeChange={noop}
        onCourtSizeChange={noop}
        onLockedAttempt={noop}
        onResetGoals={noop}
        defense="home"
        teams={DEFAULT_TEAMS as typeof drill.teams}
        onToggleDefense={noop}
        onReset={noop}
        drill={drill}
        showGrid={false}
        onToggleGrid={noop}
        showRuleZones
        onToggleRuleZones={noop}
        onShowHelp={noop}
        onSaveAsDrill={noop}
      />
      </ToastProvider>
    </SettingsProvider>,
  );
}

/** 기둥에 **상시** 서는 손잡이. 팝오버(코트·보기)와 확인 모달은 닫혀 있으면 DOM 에 없다. */
const barItems = (root: HTMLElement): HTMLButtonElement[] => {
  const nav = root.querySelector('nav[data-function-bar]')!;
  return Array.from(nav.children).filter((el): el is HTMLButtonElement => el.tagName === 'BUTTON');
};

describe('기능 바 — 화면과 예산 상수가 같은 수를 센다', () => {
  it('★ 상시 칸 수가 FUNCTION_BAR_ITEMS 와 같다', () => {
    const { container } = mount();
    expect(barItems(container), '화면의 칸 수와 예산 상수가 어긋났다 — 코트 상자 폭이 틀리게 계산된다').toHaveLength(
      FUNCTION_BAR_ITEMS,
    );
  });

  it('구분선 수가 FUNCTION_BAR_DIVIDERS 와 같다', () => {
    const { container } = mount();
    const nav = container.querySelector('nav[data-function-bar]')!;
    const dividers = Array.from(nav.children).filter((el) => el.tagName === 'DIV' && el.getAttribute('aria-hidden') !== null);
    expect(dividers).toHaveLength(FUNCTION_BAR_DIVIDERS);
  });

  it('코트 종류가 바뀌어도 칸 수는 그대로다 — 표적이 사용 중에 사라지지 않는다(§8 점진 공개 금지)', () => {
    // 플랫 코트에서 [진영]·[골대] 는 **비활성**이 되지만 자리는 지킨다. 사라지면 아래 칸들의
    // 절대 위치가 통째로 밀려 §3 불변식 1(공간 기억)이 깨진다.
    for (const mode of ['full', 'half', 'flat'] as const) {
      const { container, unmount } = mount(mode);
      expect(barItems(container), `${mode}: 칸이 늘거나 줄었다`).toHaveLength(FUNCTION_BAR_ITEMS);
      unmount();
    }
  });

  it('플랫 코트에서 [진영]이 비활성이다 — 골 지역이 없어 진영이라는 개념이 없다', () => {
    const { container, unmount } = mount('flat');
    const side = barItems(container).find((b) => b.getAttribute('aria-label')?.startsWith('진영'))!;
    expect(side, '[진영] 칸을 못 찾았다').toBeTruthy();
    expect(side.disabled).toBe(true);
    unmount();
    // 대조군: 풀 코트에서는 눌린다.
    const full = mount('full');
    const on = barItems(full.container).find((b) => b.getAttribute('aria-label')?.startsWith('진영'))!;
    expect(on.disabled).toBe(false);
  });
});
