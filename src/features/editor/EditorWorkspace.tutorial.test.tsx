// 드릴 편집 튜토리얼(§0.5, Phase 2) 배선 확인 — 대상 8개가 실제 DOM 순서대로 스포트라이트에
// 걸리는지, 건너뛰면 prefs.tutorialsSeen.editor 가 찍혀 다음 방문엔 자동으로 안 뜨는지, 그리고
// 자유 전술판(mode='board')은 아직 이 튜토리얼과 무관한지(Phase 3 몫, 화면 키가 다르다).
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
import { makeDefaultPrefs, PREFS_KEY, loadPrefs } from '../../storage/prefs.ts';
import type { DrillId } from '../../core/ids.ts';
import { EDITOR_TUTORIAL_STEPS } from './tutorialSteps.ts';

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

async function openDrill() {
  const { repo } = await resolveDrillRepo();
  const created = await repo.createDrill({ courtMode: 'full', formation: '1-2-1' });
  stageTarget = { kind: 'drill', drillId: created.id };
  const user = userEvent.setup();
  render(<EditorScreen />, { wrapper: Wrapper });
  await waitFor(() => expect(screen.getByRole('navigation', { name: '도구' })).toBeInTheDocument());
  return { user };
}

describe('드릴 편집 튜토리얼 — 자동 시작·순서·건너뛰기', () => {
  it('처음 여는 화면에서 자동으로 뜨고, 8단계가 계획서 순서대로 나온다', async () => {
    const { user } = await openDrill();
    const dialog = await screen.findByRole('dialog', { name: '화면 안내' });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText('1/8 단계')).toBeInTheDocument();
    expect(screen.getByText('스텝 사이드바')).toBeInTheDocument();
    expect(EDITOR_TUTORIAL_STEPS).toHaveLength(8);

    for (let i = 1; i < EDITOR_TUTORIAL_STEPS.length; i++) {
      await user.click(screen.getByRole('button', { name: '다음' }));
      await waitFor(() => expect(screen.getByText(`${i + 1}/8 단계`)).toBeInTheDocument());
    }
    // 마지막 단계 [완료] — 닫히고 prefs 에 찍힌다.
    await user.click(screen.getByRole('button', { name: '완료' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '화면 안내' })).toBeNull());
    expect(loadPrefs().tutorialsSeen.editor).toBe(true);
  });

  it('건너뛰면 다시 열어도 자동으로 안 뜬다', async () => {
    const { user } = await openDrill();
    await screen.findByRole('dialog', { name: '화면 안내' });
    await user.click(screen.getByRole('button', { name: '건너뛰기' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '화면 안내' })).toBeNull());
    expect(loadPrefs().tutorialsSeen.editor).toBe(true);

    // 저장된 값 위에 다시 렌더(재방문 시뮬레이션) — 이미 seen 이라 안 뜬다.
    localStorage.setItem(PREFS_KEY, JSON.stringify({ ...makeDefaultPrefs(), tutorialsSeen: { editor: true } }));
    stageTarget = { kind: 'drill', drillId: 'dr_none' as DrillId };
    render(<EditorScreen />, { wrapper: Wrapper });
    await waitFor(() => expect(screen.getAllByRole('navigation', { name: '도구' }).length).toBeGreaterThan(0));
    expect(screen.queryByRole('dialog', { name: '화면 안내' })).toBeNull();
  });
});
