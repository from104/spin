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
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FunctionBar } from './FunctionBar.tsx';
import { FUNCTION_BAR_DIVIDERS, FUNCTION_BAR_DIVIDERS_DRILL, FUNCTION_BAR_ITEMS, FUNCTION_BAR_ITEMS_DRILL } from './functionBarMetrics.ts';
import { SettingsProvider } from '../../store/settings/SettingsProvider.tsx';
import { ToastProvider } from '../../store/toast/ToastProvider.tsx';
import { createDrill } from '../../model/defaults.ts';
import { DEFAULT_TEAMS } from '../../model/defaults.ts';

const noop = () => {};

function mount(
  courtMode: 'full' | 'half' | 'flat' = 'full',
  over: { onToggleDefense?: () => void; mode?: 'board' | 'drill' } = {},
) {
  const drill = createDrill({ courtMode });
  return render(
    <SettingsProvider>
      <ToastProvider>
      <FunctionBar
        mode={over.mode}
        showGridLabels
        stepIndex={0}
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
        onToggleDefense={over.onToggleDefense ?? noop}
        onReset={noop}
        drill={drill}
        showGrid={false}
        onToggleGrid={noop}
        showRuleZones
        onToggleRuleZones={noop}
        onSaveAsDrill={noop}
        stepEmpty={false}
        // [정보]는 드릴 모드에서 **항상 온다**(EditorScreen 이 언제나 넘긴다) — 예산 상수
        // FUNCTION_BAR_ITEMS_DRILL 이 그 전제 위에 서 있으므로 여기서도 넘긴다.
        onDrillInfo={noop}
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
    // 플랫 코트에서 [골대] 는 뜻이 옅어지지만 자리는 지킨다. 사라지면 아래 칸들의 절대 위치가
    // 통째로 밀려 §3 불변식 1(공간 기억)이 깨진다.
    for (const mode of ['full', 'half', 'flat'] as const) {
      const { container, unmount } = mount(mode);
      expect(barItems(container), `${mode}: 칸이 늘거나 줄었다`).toHaveLength(FUNCTION_BAR_ITEMS);
      unmount();
    }
  });

  // ── 2026-08-16 기현 지시 — [진영]이 기둥에서 [코트] 모달 안으로 들어갔다 ────────────
  // 옛 계약(지우지 않는다): 기둥에서는 **플랫에서도 칸이 사라지지 않고 disabled** 였다. 자리를
  // 지켜야 아래 칸들의 절대 위치가 안 밀리기 때문이었다(§3 불변식 1). 모달 안에는 지킬 절대
  // 위치가 없으므로 그 근거가 함께 없어졌고, 대신 크기 3단이 이미 세워 둔 계약을 따른다 —
  // *"골라도 안 변하는 컨트롤은 거짓말이다"* → 버튼 대신 사실을 적는다.
  describe('[진영]·[표시]·[이동]·[골대]는 이제 [보드 설정] 모달 안이다', () => {
    const openCourt = async (mode: 'full' | 'half' | 'flat') => {
      const r = mount(mode);
      await userEvent.setup().click(screen.getByRole('button', { name: '보드 설정' }));
      return r;
    };

    it('기둥에는 [진영] 칸이 없다 — 접힌 것은 표적 예산 밖이다', () => {
      const { container } = mount('full');
      expect(barItems(container).some((b) => b.getAttribute('aria-label')?.startsWith('진영'))).toBe(false);
      expect(screen.queryByRole('button', { name: /^진영 바꾸기/ }), '모달을 안 열었는데 보인다').toBeNull();
    });

    it('모달을 열면 [진영 바꾸기]가 있고 누르면 뒤집기가 불린다', async () => {
      const onToggleDefense = vi.fn();
      const r = mount('full', { onToggleDefense });
      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: '보드 설정' }));

      const btn = screen.getByRole('button', { name: /^진영 바꾸기/ });
      // 이름 규칙(WCAG 2.5.3) — 화면 글자가 접근성 이름의 부분 문자열이어야 한다.
      expect(btn.getAttribute('aria-label')).toContain(btn.textContent!.trim());
      await user.click(btn);
      expect(onToggleDefense).toHaveBeenCalledTimes(1);
      // 고르고 나서도 **안 닫힌다** — 되뒤집을 수 있어야 한다(형태·크기와 다른 점).
      expect(screen.getByRole('button', { name: /^진영 바꾸기/ })).toBeInTheDocument();
      r.unmount();
    });

    it('플랫 코트에서는 버튼 대신 사실을 적는다 — 골 지역이 없어 진영이 없다', async () => {
      const { unmount } = await openCourt('flat');
      expect(screen.queryByRole('button', { name: /^진영 바꾸기/ })).toBeNull();
      expect(screen.getByText(/골 지역이 없어 진영이 없습니다/)).toBeInTheDocument();
      unmount();
      // 대조군: 하프 코트에는 버튼이 선다(플랫만 특별하다).
      await openCourt('half');
      expect(screen.getByRole('button', { name: /^진영 바꾸기/ })).toBeInTheDocument();
    });
  });

  // ── 드릴 편집 — [저장] 칸이 없다(2026-08-20) ──────────────────────────────────────
  // board 모드의 위 테스트들과 같은 이유로 존재한다: 상수만 바꾸고 화면을 안 재면 어긋나도
  // 아무도 안 잡는다. FUNCTION_BAR_ITEMS_DRILL 을 12 → 11 로 낮추면서 구분선도 4 → 3 으로
  // 같이 낮췄는데(FUNCTION_BAR_DIVIDERS_DRILL), 그 둘이 실제 화면과 맞는지는 이 블록이 유일한
  // 대조다 — chromeBudget.test.ts 는 이 두 상수를 실측 픽셀로만 간접 검증한다.
  describe('드릴 편집 — [저장] 칸·구분선이 board 보다 하나씩 적다', () => {
    it('★ 칸 수가 FUNCTION_BAR_ITEMS_DRILL 과 같다', () => {
      const { container } = mount('full', { mode: 'drill' });
      expect(barItems(container), '드릴 편집 화면의 칸 수와 예산 상수가 어긋났다').toHaveLength(FUNCTION_BAR_ITEMS_DRILL);
    });

    it('구분선 수가 FUNCTION_BAR_DIVIDERS_DRILL 과 같다', () => {
      const { container } = mount('full', { mode: 'drill' });
      const nav = container.querySelector('nav[data-function-bar]')!;
      const dividers = Array.from(nav.children).filter((el) => el.tagName === 'DIV' && el.getAttribute('aria-hidden') !== null);
      expect(dividers).toHaveLength(FUNCTION_BAR_DIVIDERS_DRILL);
    });

    it('[저장] 칸이 없다 — 자동저장뿐이라 뜻이 없어진 칸이라 걷어냈다', () => {
      const { container } = mount('full', { mode: 'drill' });
      expect(barItems(container).some((b) => b.getAttribute('aria-label')?.includes('저장'))).toBe(false);
    });

    it('대조군: board 모드에는 [저장] 칸이 있다', () => {
      const { container } = mount('full', { mode: 'board' });
      expect(barItems(container).some((b) => b.getAttribute('aria-label')?.includes('저장'))).toBe(true);
    });

    // ★ 2026-08-28 기현 지시 — 헤더 제목 옆 ⓘ 가 여기로 왔다.
    it('[드릴 정보] 칸이 있다 — 헤더 ⓘ 의 후계', () => {
      const { container } = mount('full', { mode: 'drill' });
      const info = barItems(container).find((b) => b.getAttribute('aria-label') === '드릴 정보');
      expect(info, '드릴 편집 기능 바에 [드릴 정보] 칸이 없다').toBeTruthy();
      expect(info!.getAttribute('aria-haspopup')).toBe('dialog');
    });

    it('대조군: board 모드에는 [드릴 정보] 칸이 없다 — 전술판에는 열 메타가 없다', () => {
      const { container } = mount('full', { mode: 'board' });
      expect(barItems(container).some((b) => b.getAttribute('aria-label') === '드릴 정보')).toBe(false);
    });
  });
});
