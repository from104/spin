// 3.9 [E-4] 완료 판정의 **배선** 확인 — `helpTriggerRef` 가 실제 요소에 연결됐는가(3.9 전에는
// 항상 null 이었다), StageControls 에 도움말 버튼이 섰는가, 그리고 닫힐 때 포커스가 **들어온
// 문에 맞는 곳으로** 돌아가는가. 마지막 것이 이 파일의 존재 이유다: 문이 둘(버튼·Shift+?)이라
// 컴포넌트 단위로는 "ref 를 넘겼다" 까지만 보이고, 어느 문에서 ref 가 채워지고 어느 문에서
// 비는지는 EditorWorkspace 의 배선을 끝까지 지나야 관측된다.
//
// ── 2026-08-14 (설계서 §5-P2): **버튼 문이 한 겹 깊어졌다** ────────────────────────────
// 도움말 손잡이는 코트 위 묶음에서 하단 바 `[보기▾]` 팝오버 **안**으로 들어갔다. 그래서 이
// 파일의 세 it 은 문의 **모양**만 바뀌고 묻는 것은 그대로다. 다만 한 가지가 새로 생겼다:
// 돌아갈 버튼이 도움말을 여는 순간 **DOM 에서 사라진다**(메뉴는 항목을 고르면 닫힌다).
// 그래서 복귀 대상이 [도움말] 항목이 아니라 **[보기] 버튼**이어야 하고, 그 배선이 틀리면
// Modal 의 isConnected 검사(ui/Modal.tsx:70)에 걸려 포커스가 **아무 데도 안 간다** —
// 아래 두 번째 it 이 정확히 그것을 잡는다.
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

const viewButton = () => screen.getByRole('button', { name: '보기' });
const helpButton = () => screen.getByRole('button', { name: '도움말' });
/** 도움말 손잡이는 이제 [보기] 팝오버 안이다 — 문을 여는 절차가 한 겹 늘었다. */
async function openViewMenu() {
  fireEvent.click(viewButton());
  await screen.findByRole('dialog', { name: '보기' });
}

beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  localStorage.clear();
});

describe('3.9 도움말 버튼 — [보기] 팝오버의 세 번째 항목 (2026-08-14 이사)', () => {
  it('버튼이 있고, 누르면 도움말 다이얼로그가 열린다', async () => {
    await openBoard();
    // 첫 화면에는 없다 — 닫힌 팝오버는 DOM 에 아예 없고, 그것이 예산 −1 의 실체다.
    expect(screen.queryByRole('button', { name: '도움말' })).toBeNull();
    await openViewMenu();
    const btn = helpButton();
    expect(btn.getAttribute('aria-haspopup')).toBe('dialog');
    fireEvent.click(btn);
    expect(await screen.findByRole('dialog', { name: '도움말' })).toBeInTheDocument();
    // 메뉴는 항목을 고르면 닫힌다 — 두 모달이 겹치면 Esc 가 **먼저 등록된 바깥쪽**을 닫는다.
    expect(screen.queryByRole('dialog', { name: '보기' })).toBeNull();
  });

  it('버튼으로 열고 닫으면 포커스가 [보기] 버튼으로 돌아온다 — returnFocusRef 성립', async () => {
    await openBoard();
    // ⚠️ 일부러 fireEvent.click 이다(userEvent 아님) — 다른 곳(격자)에 포커스를 둔 채 눌러
    // "클릭이 버튼에 포커스를 준다"(Safari 는 안 준다)에 기대지 않는다.
    // ⚠️ 다만 **이 it 이 증명하는 것은 "ref 경로로만 성립한다" 가 아니다**(2026-08-14 반증
    // 실험으로 확인): 팝오버가 닫히면서 자기 returnFocusRef 로 [보기] 에 포커스를 되돌려
    // 놓으므로, EditorWorkspace 의 helpTriggerRef 를 비워도 openedBy 폴백이 같은 버튼을
    // 집어 초록으로 남는다. 여기서 실제로 못박는 것은 **결과**다 — 도움말이 닫히면 포커스가
    // [보기] 버튼에 있고 <body> 로 떨어지지 않는다. 그 결과가 깨지는 진짜 배선 두 가지
    // (팝오버가 안 닫힌다 · 복귀 대상이 떼어진 항목이다)는 각각 반증으로 빨간불을 확인했다.
    await openViewMenu();
    screen.getByRole('button', { name: '격자 표시 전환' }).focus();
    const help = helpButton();
    fireEvent.click(help);
    await screen.findByRole('dialog', { name: '도움말' });
    // 트리거였던 항목은 팝오버와 함께 **떼어졌다**. isConnected 검사(Modal.tsx:70) 때문에
    // 여기에 ref 를 걸어 두면 복귀가 통째로 사라진다 — 그 오배선을 아래 단언이 잡는다.
    expect(help.isConnected).toBe(false);

    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('dialog', { name: '도움말' })).toBeNull());
    // openedBy 폴백(격자)이 아니라 [보기] 버튼이다 — helpTriggerRef 가 살아 있는 요소에 연결된 증거.
    await waitFor(() => expect(document.activeElement).toBe(viewButton()));
    expect(document.activeElement).not.toBe(document.body);
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
    expect(document.activeElement).not.toBe(viewButton());
  });
});
