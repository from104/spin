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
import { newId } from '../../core/ids.ts';
import type { DrillId } from '../../core/ids.ts';
import { BoardScreen } from '../board/BoardScreen.tsx';
import { BOARD_TUTORIAL_STEPS, EDITOR_TUTORIAL_STEPS } from './tutorialSteps.ts';
import type { TutorialStep } from '../../ui/tutorial/types.ts';

/** 지금 DOM 에 대상이 있는 단계 수 — `useTutorial.start()` 의 필터와 같은 셈이다. */
function visibleCount(steps: readonly TutorialStep[]): number {
  return steps.filter((s) => document.querySelector(`[data-tut="${s.target}"]`) !== null).length;
}

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
  // 스텝을 2장으로 만든다. `editor-gap` 단계가 가리키는 **내부 틈**(사슬 버튼이 사는 자리)은
  // 스텝이 둘 이상일 때만 생기고, 1장짜리로 두면 그 대상 하나 때문에 자동 시작이 재시도
  // 상한(AUTOSTART_MAX_FRAMES=20 프레임)을 다 쓴 뒤에야 뜬다 — 부하가 걸린 러너에서 그
  // 기다림이 findBy 의 기본 대기(1s)를 넘어 간헐적으로 빨간불이 났다.
  const first = created.steps[0]!;
  const two = await repo.putDrill({ ...created, steps: [first, { ...first, id: newId('st') }] }, { touch: false });
  stageTarget = { kind: 'drill', drillId: two.id };
  const user = userEvent.setup();
  render(<EditorScreen />, { wrapper: Wrapper });
  await waitFor(() => expect(screen.getByRole('navigation', { name: '도구' })).toBeInTheDocument());
  return { user };
}

describe('드릴 편집 튜토리얼 — 자동 시작·순서·건너뛰기', () => {
  it('처음 여는 화면에서 자동으로 뜨고, 첫 단계부터 끝까지 [다음]으로 이어진다', async () => {
    const { user } = await openDrill();
    const dialog = await screen.findByRole('dialog', { name: '화면 안내' });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText('스텝 사이드바')).toBeInTheDocument();
    // 총 수는 소스의 배열 길이가 아니라 **지금 화면에 실제로 있는 앵커 수**로 센다 —
    // 빈 화면 가드(useTutorial 의 계약)가 없는 대상의 단계를 걸러 내므로 둘이 다를 수 있고,
    // 길이를 손으로 적으면 단계를 하나 더할 때마다 이 파일이 같이 틀린다.
    const total = visibleCount(EDITOR_TUTORIAL_STEPS);
    expect(total).toBeGreaterThan(1);
    expect(screen.getByText(`1/${total} 단계`)).toBeInTheDocument();

    for (let i = 1; i < total; i++) {
      await user.click(screen.getByRole('button', { name: '다음' }));
      await waitFor(() => expect(screen.getByText(`${i + 1}/${total} 단계`)).toBeInTheDocument());
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

  it('처음 여는 화면에서 자동으로 뜨고, 첫 단계부터 끝까지 [다음]으로 이어진다', async () => {
    const { user } = await openBoard();
    await screen.findByRole('dialog', { name: '화면 안내' });
    expect(screen.getByText('트레이')).toBeInTheDocument();
    const total = visibleCount(BOARD_TUTORIAL_STEPS);
    expect(total).toBeGreaterThan(1);
    expect(screen.getByText(`1/${total} 단계`)).toBeInTheDocument();

    for (let i = 1; i < total; i++) {
      await user.click(screen.getByRole('button', { name: '다음' }));
      await waitFor(() => expect(screen.getByText(`${i + 1}/${total} 단계`)).toBeInTheDocument());
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
