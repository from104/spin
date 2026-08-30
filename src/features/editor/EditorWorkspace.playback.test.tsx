// 2026-08-20 §D·F — 편집 화면의 공용 재생 묶음(PlaybackControls) 배선과, 끝 스텝에서
// [재생]을 누르면 처음으로 되감고 재생하는 계약. 하단 줄 구성(노트+재생 묶음, ⓘ·[시연]이
// 헤더로 빠진 것)은 EditorWorkspace.notePanel.test.tsx 가 이미 본다 — 여기서는 재생 묶음
// 자체의 **배선**만 본다.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { SettingsProvider } from '../../store/settings/SettingsProvider.tsx';
import { ToastProvider } from '../../store/toast/ToastProvider.tsx';
import { AppNavProvider } from '../../app/useAppHistory.ts';
import type { AppHistoryApi } from '../../app/useAppHistory.ts';
import { AppHeader, HeaderProvider } from '../../app/AppHeader.tsx';
import { LiveRegion } from '../../ui/LiveRegion.tsx';
import { resolveDrillRepo } from '../../storage/drillRepo.ts';
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

async function openDrill() {
  const { repo } = await resolveDrillRepo();
  const created = await repo.createDrill({ courtMode: 'full', formation: '1-2-1' });
  stageTarget = { kind: 'drill', drillId: created.id };
  const user = userEvent.setup();
  render(<EditorScreen />, { wrapper: Wrapper });
  await waitFor(() => expect(screen.getByRole('navigation', { name: '도구' })).toBeInTheDocument());
  return { user, drillId: created.id };
}

const sidebarCards = () => within(screen.getByRole('navigation', { name: '스텝 목록' })).getAllByRole('button', { name: /^스텝 \d+$/ });

/** 스텝 한 장 늘리기 — **목록 끝 틈의 [+]**. 2026-08-30 기현 지시로 [한 장 더 찍기] 버튼이
 *  없어지면서 이것이 스텝을 늘리는 유일한 길이 됐다.
 *  옛 버튼과 마찬가지로 **누르면 새 장이 선택된다**(EditorWorkspace 의 duplicateStepAt). */
async function addStepAtEnd(user: { click(el: Element): Promise<void> }): Promise<void> {
  const n = sidebarCards().length;
  await user.click(screen.getByRole('button', { name: `스텝 ${n} 을 복제해 바로 뒤에 넣기` }));
}

describe('편집 화면 — 공용 재생 묶음(2026-08-20 §D)', () => {
  it('재생 묶음 5개가 코트 아래(노트 옆)에 산다', async () => {
    await openDrill();
    await addStepAtEnd(userEvent); // canPlay 조건(스텝 2장 이상)
    expect(screen.getByRole('button', { name: /^반복/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '이전 스텝' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '재생' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '다음 스텝' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^재생 속도/ })).toBeInTheDocument();
  });

  it('스텝이 1장뿐이면 재생이 잠긴다 — canPlay 계약', async () => {
    await openDrill();
    expect(screen.getByRole('button', { name: '재생' })).toBeDisabled();
  });

  // §F — 끝 스텝에서 [재생] = 처음으로 되감고 재생. loop 설정과 무관하다.
  it('끝 스텝에서 [재생] 을 누르면 첫 스텝으로 되감고 재생한다(loop 꺼짐, §F)', async () => {
    const { user } = await openDrill();
    await addStepAtEnd(user); // 2장째, 그 장(끝 스텝)이 선택된다
    expect(sidebarCards()[1]).toHaveAttribute('aria-current', 'step');

    await user.click(screen.getByRole('button', { name: '재생' }));
    expect(await screen.findByRole('button', { name: '일시정지' })).toBeInTheDocument();
    await waitFor(() => expect(sidebarCards()[0]).toHaveAttribute('aria-current', 'step'));
  });

  it('끝 스텝에서 [재생] — 반복이 켜져 있어도 같은 되감기가 일어난다(loop 켜짐, §F)', async () => {
    const { user } = await openDrill();
    await addStepAtEnd(user);
    expect(sidebarCards()[1]).toHaveAttribute('aria-current', 'step');

    const loopBtn = screen.getByRole('button', { name: /^반복/ });
    if (loopBtn.getAttribute('aria-pressed') !== 'true') await user.click(loopBtn);
    expect(screen.getByRole('button', { name: /^반복/ })).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: '재생' }));
    await waitFor(() => expect(sidebarCards()[0]).toHaveAttribute('aria-current', 'step'));
  });

  it('중간 스텝에서 [재생]은 되감지 않는다 — 대조군(끝 스텝일 때만 되감는다)', async () => {
    const { user } = await openDrill();
    await addStepAtEnd(user); // 2장
    await addStepAtEnd(user); // 3장
    await user.click(sidebarCards()[1]!); // 가운데(2번째)로 이동 — 끝이 아니다

    await user.click(screen.getByRole('button', { name: '재생' }));
    expect(await screen.findByRole('button', { name: '일시정지' })).toBeInTheDocument();
    // 되감지 않았다 — 여전히 2번째 카드가 현재다(자동 재생이 아직 다음 스텝으로 안 넘어간
    // 짧은 창).
    expect(sidebarCards()[1]).toHaveAttribute('aria-current', 'step');
  });
});
