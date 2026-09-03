// 버전 번호 → 변경 내역 모달 (2026-09-03, 기현 지시). 레일 버튼이 실제로 여는 한 바퀴와
// 좌우 넘기기를 잰다 — languageModal.test.tsx 와 같은 이유로 모달만 따로 마운트하지 않는다.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppRail } from './AppRail.tsx';
import { SettingsProvider } from '../store/settings/SettingsProvider.tsx';
import { HelpTriggerProvider } from '../ui/help/HelpTriggerProvider.tsx';
import { AppNavProvider } from './useAppHistory.ts';
import type { AppHistoryApi } from './useAppHistory.ts';

const nav: AppHistoryApi = { screen: 'board', go: vi.fn(), back: vi.fn() };

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <SettingsProvider>
    <AppNavProvider value={nav}>
      <HelpTriggerProvider>{children}</HelpTriggerProvider>
    </AppNavProvider>
  </SettingsProvider>
);

const openModal = async () => {
  const user = userEvent.setup();
  render(<AppRail />, { wrapper });
  await user.click(screen.getByRole('button', { name: /변경 내역/ }));
  return { user, dialog: screen.getByRole('dialog') };
};

beforeEach(() => {
  localStorage.clear();
});

describe('변경 내역 모달 — 레일의 버전 번호', () => {
  it('레일의 버전 버튼이 모달을 연다', async () => {
    const { dialog } = await openModal();
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText(`v${__APP_VERSION__}`)).toBeInTheDocument();
  });

  it('[이전 버전]을 누르면 더 오래된 버전으로 넘어간다', async () => {
    const { user, dialog } = await openModal();
    const older = within(dialog).getByRole('button', { name: /이전 버전/ });
    expect(older).not.toBeDisabled();
    await user.click(older);
    expect(within(dialog).queryByText(`v${__APP_VERSION__}`)).toBeNull();
  });

  it('이번 버전이 목록에서 가장 최신이면 [다음 버전]은 꺼져 있다', async () => {
    // CHANGELOG.md 의 맨 위 절(Unreleased 제외)이 package.json 의 버전과 같다는 전제 —
    // 지금 저장소가 그렇다. 어긋나면 이 실패가 "더 최신 절이 생겼는데 버전을 안 올렸다" 는
    // 신호이지, 이 테스트의 결함이 아니다.
    const { dialog } = await openModal();
    expect(within(dialog).getByRole('button', { name: /다음 버전/ })).toBeDisabled();
  });

  it('[이전 버전]으로 한 번 넘긴 뒤 [다음 버전]으로 되돌아온다', async () => {
    const { user, dialog } = await openModal();
    await user.click(within(dialog).getByRole('button', { name: /이전 버전/ }));
    await user.click(within(dialog).getByRole('button', { name: /다음 버전/ }));
    expect(within(dialog).getByText(`v${__APP_VERSION__}`)).toBeInTheDocument();
  });

  it('닫았다 다시 열면 이번 버전으로 돌아와 있다 — 넘겨 보던 자리를 기억하지 않는다', async () => {
    const user = userEvent.setup();
    render(<AppRail />, { wrapper });
    await user.click(screen.getByRole('button', { name: /변경 내역/ }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /이전 버전/ }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();

    await user.click(screen.getByRole('button', { name: /변경 내역/ }));
    expect(within(screen.getByRole('dialog')).getByText(`v${__APP_VERSION__}`)).toBeInTheDocument();
  });

  it('[Unreleased] 절은 넘기기 목록에 없다 — 아직 안 나간 절이다', async () => {
    const { user, dialog } = await openModal();
    // 맨 끝(가장 오래된 버전)까지 눌러도 "Unreleased" 라는 글자가 한 번도 안 뜬다.
    for (let i = 0; i < 20; i++) {
      const older = within(dialog).getByRole('button', { name: /이전 버전/ });
      if ((older as HTMLButtonElement).disabled) break;
      await user.click(older);
    }
    expect(within(dialog).queryByText('Unreleased')).toBeNull();
    expect(within(dialog).queryByText('v Unreleased')).toBeNull();
  });
});
