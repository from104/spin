// 2026-08-14 선행 수리 (설계서 §7 표) — 색 스와치 aria-label 을 **렌더된 DOM 에서** 확인한다.
// "그려져 있다 ≠ 보인다" 규율: 소스 텍스트 검사(InspectorPanel.hit.test.ts)만으로는 이름 맵이
// undefined 를 돌려줘 라벨이 통째로 사라지는 경우를 못 잡는다 — 스크린리더가 실제로 받는
// 접근성 이름으로 단언한다. 하네스는 InspectorPanel.playerName.test.tsx 의 관례를 그대로 따른다.
//
// **`empty: true` 드릴로 연다** — 기본 배치 드릴은 8대가 전부 코트에 나가 있어도 명단(인스펙터)은
// 있지만, playerName 테스트와 같은 조건으로 맞춰 하네스 차이로 인한 우연 통과를 없앤다.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { SettingsProvider } from '../../store/settings/SettingsProvider.tsx';
import { ToastProvider } from '../../store/toast/ToastProvider.tsx';
import { AppNavProvider } from '../../app/useAppHistory.ts';
import type { AppHistoryApi } from '../../app/useAppHistory.ts';
import { AppHeader, HeaderProvider } from '../../app/AppHeader.tsx';
import { LiveRegion } from '../../ui/LiveRegion.tsx';
import { resolveDrillRepo } from '../../storage/drillRepo.ts';
import { TEAM_COLOR_CHOICES, TEAM_COLOR_NAMES } from '../../core/colors.ts';
import type { DrillId } from '../../core/ids.ts';

let stageTarget: { kind: 'drill'; drillId: DrillId } = { kind: 'drill', drillId: 'dr_none' as DrillId };
vi.mock('../../app/AppShell.tsx', () => ({
  useStageTarget: () => stageTarget,
}));

const { EditorScreen } = await import('./EditorScreen.tsx');

function Wrapper({ children }: { children: ReactNode }) {
  const nav: AppHistoryApi = { screen: 'board', go: () => {}, back: () => {} };
  return (
    <SettingsProvider>
      <ToastProvider>
        <HeaderProvider>
          <AppNavProvider value={nav}>
            <AppHeader />
            {children}
          </AppNavProvider>
        </HeaderProvider>
        <LiveRegion />
      </ToastProvider>
    </SettingsProvider>
  );
}

beforeEach(() => {
  localStorage.clear();
  stageTarget = { kind: 'drill', drillId: 'dr_none' as DrillId };
});

/** 빈 판 드릴을 열고 인스펙터를 편 뒤, 명단에서 '우리 팀 2' 를 펼친다. */
async function openRoster() {
  const { repo } = await resolveDrillRepo();
  const created = await repo.createDrill({ courtMode: 'full', empty: true });
  stageTarget = { kind: 'drill', drillId: created.id };
  const user = userEvent.setup();
  render(<EditorScreen />, { wrapper: Wrapper });
  await waitFor(() => expect(screen.getByRole('navigation', { name: '도구' })).toBeInTheDocument());
  await user.click(screen.getByRole('button', { name: '속성' }));
  await screen.findByRole('complementary', { name: '드릴 속성' });
  await user.click(screen.getByRole('button', { name: /우리 팀 2/ }));
  return user;
}

describe('색 스와치 접근성 이름 — 스크린리더는 hex 가 아니라 색 이름을 듣는다', () => {
  it('스와치 4개가 전부 한국어 이름으로 잡히고, hex 를 이름으로 내건 버튼은 없다', async () => {
    await openRoster();
    for (const c of TEAM_COLOR_CHOICES) {
      // getByRole 은 접근성 이름으로 찾는다 — aria-label 이 undefined 로 사라져도 여기서 잡힌다.
      expect(screen.getByRole('button', { name: TEAM_COLOR_NAMES[c] })).toBeInTheDocument();
    }
    // 대조군: 수리 전 상태(aria-label={c})라면 이 질의가 4개를 찾는다.
    expect(screen.queryAllByRole('button', { name: /^#[0-9a-f]{6}$/i })).toEqual([]);
  });

  it("명단 행 터치 타깃이 var(--hit) 를 따른다 — 44 하드코딩이면 큰 터치 타깃 설정이 안 먹는다", async () => {
    await openRoster();
    const row = screen.getByRole('button', { name: /우리 팀 2/ });
    expect(row.style.minHeight).toBe('var(--hit)');
  });
});
