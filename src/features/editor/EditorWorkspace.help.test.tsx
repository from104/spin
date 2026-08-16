// 3.9 [E-4] 완료 판정의 **배선** 확인 — `helpTriggerRef` 가 실제 요소에 연결됐는가(3.9 전에는
// 항상 null 이었다), StageControls 에 도움말 버튼이 섰는가, 그리고 닫힐 때 포커스가 **들어온
// 문에 맞는 곳으로** 돌아가는가. 마지막 것이 이 파일의 존재 이유다: 문이 둘(버튼·Shift+?)이라
// 컴포넌트 단위로는 "ref 를 넘겼다" 까지만 보이고, 어느 문에서 ref 가 채워지고 어느 문에서
// 비는지는 EditorWorkspace 의 배선을 끝까지 지나야 관측된다.
//
// ── 2026-08-16 (기현 지시): **버튼 문이 다시 얕아졌다** ───────────────────────────────
// 옛 기록(지우지 않는다): 2026-08-14 에 도움말 손잡이가 코트 위 묶음에서 하단 바 `[보기▾]`
// 팝오버 **안**으로 들어갔고, 그래서 "돌아갈 버튼이 도움말을 여는 순간 DOM 에서 사라진다"
// 는 문제가 생겼다(메뉴는 항목을 고르면 닫힌다). 복귀 대상을 [도움말] 항목이 아니라 **[보기]
// 버튼**으로 잡아야 Modal 의 isConnected 검사(ui/Modal.tsx:70)를 통과했다.
//
// 이제 [도움말]은 기능 바의 **상시 칸**이다. 트리거가 열려 있는 동안에도 제자리에 있으므로
// 그 우회가 통째로 없어졌다. 이 파일이 계속 존재하는 이유는 **문이 둘**이라는 사실 쪽이다:
// 버튼 문은 helpTriggerRef 를 채우고, Shift+? 문은 **비워** openedBy 폴백에 맡긴다. 어느 문에서
// 어느 쪽이 이기는지는 EditorWorkspace 의 배선을 끝까지 지나야 관측된다.
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

describe('도움말 버튼 — 기둥 상시 칸 (2026-08-16 이사)', () => {
  it('첫 화면에 있고, 한 번 누르면 도움말 다이얼로그가 열린다', async () => {
    await openBoard();
    // 옛 계약은 정반대였다 — *"첫 화면에는 없다(닫힌 팝오버는 DOM 에 없다)"*. 표적 하나를
    // 아끼려고 도움말을 메뉴 안에 넣었던 것을 2026-08-16 에 되물렸다: 길을 잃었을 때 여는
    // 문에 길찾기를 한 겹 더 얹는 거래였고, 그 한 칸은 [진영]이 코트 모달로 가며 되돌려받았다.
    const btn = helpButton();
    expect(btn.getAttribute('aria-haspopup')).toBe('dialog');
    fireEvent.click(btn);
    expect(await screen.findByRole('dialog', { name: '도움말' })).toBeInTheDocument();
  });

  it('버튼으로 열고 닫으면 포커스가 [도움말] 버튼으로 돌아온다 — returnFocusRef 성립', async () => {
    await openBoard();
    // ⚠️ 일부러 fireEvent.click 이다(userEvent 아님) — 다른 곳(확대)에 포커스를 둔 채 눌러
    // "클릭이 버튼에 포커스를 준다"(Safari 는 안 준다)에 기대지 않는다. 그래야 복귀가
    // openedBy 폴백이 아니라 **ref 경로**로 성립하는지가 갈린다: 폴백은 열던 순간의 포커스,
    // 즉 [확대]를 집는다.
    const zoomIn = screen.getByRole('button', { name: '확대' });
    zoomIn.focus();
    const help = helpButton();
    fireEvent.click(help);
    await screen.findByRole('dialog', { name: '도움말' });
    // 2026-08-16 — 트리거가 **살아 있다.** 팝오버 안이던 시절에는 여기서 false 였다.
    expect(help.isConnected).toBe(true);

    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('dialog', { name: '도움말' })).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(help));
    expect(document.activeElement).not.toBe(zoomIn);
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
