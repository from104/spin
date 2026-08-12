// 3.9 [E-4] 완료 판정의 **배선** 확인 — `helpTriggerRef` 가 실제 요소에 연결됐는가(3.9 전에는
// 항상 null 이었다), StageControls 에 도움말 버튼이 섰는가, 그리고 닫힐 때 포커스가 **들어온
// 문에 맞는 곳으로** 돌아가는가. 마지막 것이 이 파일의 존재 이유다: 문이 둘(버튼·Shift+?)이라
// 컴포넌트 단위로는 "ref 를 넘겼다" 까지만 보이고, 어느 문에서 ref 가 채워지고 어느 문에서
// 비는지는 EditorWorkspace 의 배선을 끝까지 지나야 관측된다.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { SettingsProvider } from '../../store/settings/SettingsProvider.tsx';
import { LibraryProvider } from '../../store/library/LibraryProvider.tsx';
import { ToastProvider } from '../../store/toast/ToastProvider.tsx';
import { AppNavProvider } from '../../app/useAppHistory.ts';
import type { AppHistoryApi } from '../../app/useAppHistory.ts';
import { AppHeader, HeaderProvider } from '../../app/AppHeader.tsx';
import { LiveRegion } from '../../ui/LiveRegion.tsx';
import { makeDefaultPrefs, PREFS_KEY } from '../../storage/prefs.ts';
import { BoardScreen } from '../board/BoardScreen.tsx';

function Wrapper({ children }: { children: ReactNode }) {
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

async function openBoard() {
  localStorage.setItem(PREFS_KEY, JSON.stringify({ ...makeDefaultPrefs(), defaultCourtMode: 'full' }));
  render(<BoardScreen />, { wrapper: Wrapper });
  await waitFor(() => expect(screen.getByRole('navigation', { name: '도구' })).toBeInTheDocument());
}

const helpButton = () => screen.getByRole('button', { name: '도움말' });

beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  localStorage.clear();
});

describe('3.9 도움말 버튼 — StageControls 의 일곱 번째 버튼', () => {
  it('버튼이 있고, 누르면 도움말 다이얼로그가 열린다', async () => {
    await openBoard();
    const btn = helpButton();
    expect(btn.getAttribute('aria-haspopup')).toBe('dialog');
    fireEvent.click(btn);
    expect(await screen.findByRole('dialog', { name: '도움말' })).toBeInTheDocument();
  });

  it('버튼으로 열고 닫으면 포커스가 그 버튼으로 돌아온다 — returnFocusRef 성립', async () => {
    await openBoard();
    // ⚠️ 일부러 fireEvent.click 이다(userEvent 아님). userEvent 는 클릭한 요소에 포커스를 줘서
    // Modal 의 openedBy 폴백만으로도 통과해 버린다 — Safari 가 정확히 그 폴백이 깨지는
    // 환경이다(클릭이 버튼에 포커스를 주지 않는다). 다른 곳에 포커스를 둔 채 클릭해,
    // 복귀가 **ref 경로**로만 성립함을 본다.
    screen.getByRole('button', { name: '축소' }).focus();
    fireEvent.click(helpButton());
    await screen.findByRole('dialog', { name: '도움말' });

    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('dialog', { name: '도움말' })).toBeNull());
    // openedBy(축소)가 아니라 도움말 버튼이다 — helpTriggerRef 가 실제 요소에 연결된 증거.
    await waitFor(() => expect(document.activeElement).toBe(helpButton()));
  });

  it('Shift+? 로 열면 닫을 때 **이전 포커스**로 돌아간다 — 버튼으로 끌려가지 않는다(반대 방향 대조군)', async () => {
    await openBoard();
    const user = userEvent.setup();
    const zoomIn = screen.getByRole('button', { name: '확대' });
    zoomIn.focus();
    await user.keyboard('{Shift>}?{/Shift}');
    await screen.findByRole('dialog', { name: '도움말' });

    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog', { name: '도움말' })).toBeNull());
    // 키보드 문에서는 helpTriggerRef 가 비워져 openedBy 폴백(확대)이 이겨야 한다. 이 대조군이
    // 없으면 "ref 를 항상 버튼으로 채우는" 구현 — 키보드 사용자를 매번 버튼으로 끌고 가는 —
    // 도 위 it 을 통과한다.
    await waitFor(() => expect(document.activeElement).toBe(zoomIn));
    expect(document.activeElement).not.toBe(helpButton());
  });
});
