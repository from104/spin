// 드릴 편집·자유 전술판 튜토리얼(§0.5, Phase 2·3) 배선 확인 — 대상이 실제 DOM 순서대로
// 스포트라이트에 걸리는지, 건너뛰면 prefs.tutorialsSeen 이 화면별로 따로 찍혀 다음 방문엔
// 자동으로 안 뜨는지.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { SettingsProvider } from '../../store/settings/SettingsProvider.tsx';
import { LibraryProvider } from '../../store/library/LibraryProvider.tsx';
import { ToastProvider } from '../../store/toast/ToastProvider.tsx';
import { AppNavProvider } from '../../app/useAppHistory.ts';
import type { AppHistoryApi } from '../../app/useAppHistory.ts';
import { AppHeader, HeaderProvider } from '../../app/AppHeader.tsx';
import { LiveRegion } from '../../ui/LiveRegion.tsx';
import { resolveDrillRepo } from '../../storage/drillRepo.ts';
import { makeDefaultPrefs, PREFS_KEY, loadPrefs } from '../../storage/prefs.ts';
import type { DrillId } from '../../core/ids.ts';
import { BoardScreen } from '../board/BoardScreen.tsx';
import { BOARD_TUTORIAL_STEPS, EDITOR_TUTORIAL_STEPS } from './tutorialSteps.ts';

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

function BoardWrapper({ children }: { children: ReactNode }) {
  const nav: AppHistoryApi = { screen: 'board', go: () => {}, back: () => {} };
  return (
    <SettingsProvider>
      <LibraryProvider>
        <ToastProvider>
          <HeaderProvider>
            <AppNavProvider value={nav}>
              <AppHeader />
              {children}
            </AppNavProvider>
          </HeaderProvider>
          <LiveRegion />
        </ToastProvider>
      </LibraryProvider>
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

describe('자유 전술판 튜토리얼 — 화면 키가 달라 드릴 편집과 따로 논다', () => {
  async function openBoard() {
    const user = userEvent.setup();
    render(<BoardScreen />, { wrapper: BoardWrapper });
    await waitFor(() => expect(screen.getByRole('navigation', { name: '도구' })).toBeInTheDocument());
    return { user };
  }

  it('처음 여는 화면에서 자동으로 뜨고, 5단계가 계획서 순서대로 나온다', async () => {
    const { user } = await openBoard();
    await screen.findByRole('dialog', { name: '화면 안내' });
    expect(screen.getByText('1/5 단계')).toBeInTheDocument();
    expect(screen.getByText('트레이')).toBeInTheDocument();
    expect(BOARD_TUTORIAL_STEPS).toHaveLength(5);

    for (let i = 1; i < BOARD_TUTORIAL_STEPS.length; i++) {
      await user.click(screen.getByRole('button', { name: '다음' }));
      await waitFor(() => expect(screen.getByText(`${i + 1}/5 단계`)).toBeInTheDocument());
    }
    await user.click(screen.getByRole('button', { name: '완료' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '화면 안내' })).toBeNull());
    expect(loadPrefs().tutorialsSeen.board).toBe(true);
    // 드릴 편집 쪽 플래그는 안 건드린다 — 화면마다 따로 찍힌다.
    expect(loadPrefs().tutorialsSeen.editor).toBeUndefined();
  });

  it('드릴 편집을 이미 봤어도 자유 전술판 튜토리얼은 따로 뜬다', async () => {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ ...makeDefaultPrefs(), tutorialsSeen: { editor: true } }));
    await openBoard();
    expect(await screen.findByRole('dialog', { name: '화면 안내' })).toBeInTheDocument();
  });
});
