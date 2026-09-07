// §0.5 Phase 5(레일 도움말 일원화) 배선 확인 — 자유 전술판(BoardScreen) 기준.
//
// ── 옛 기록(지우지 않는다) ───────────────────────────────────────────────────────────
// 2026-08-14: 도움말 손잡이가 코트 위 묶음 → 하단 바 `[보기▾]` 팝오버 안으로. 2026-08-16:
// [보기] 서랍 밖으로 나와 FunctionBar 의 **기둥 상시 칸**이 됐다 — 이 시절엔 "문이 둘"
// (버튼·Shift+?)이라 돌아갈 포커스도 둘이었다.
//
// 2026-08-20(§0.5 Phase 5): FunctionBar 자기 [도움말] 칸이 **아예 없어졌다** — 레일(AppRail·
// AppNavAside, EditorWorkspace 트리 밖)의 상시 칸 하나로 일원화됐다. "문이 둘" 복잡함도
// 함께 없어졌다: 레일 버튼도 Shift+? 도 이제 CenterModal 의 openedBy 폴백(열던 순간의
// 포커스로 돌아간다) 하나로 충분하다. 이 파일이 보는 것은 둘이다 — ① HelpTriggerProvider
// 로 레일이 "지금 이 화면" 의 도움말을 열 수 있는가(usePublishHelpShow 배선), ② Shift+?
// 로 열고 닫으면 포커스가 이전 자리로 돌아가는가.
import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
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
import { HelpTriggerProvider, useHelpShow } from '../../ui/help/HelpTriggerProvider.tsx';
import { BoardScreen } from '../board/BoardScreen.tsx';

/** 레일 [도움말] 버튼을 흉내낸다 — 실제 AppRail 은 이 화면(EditorWorkspace) 트리 밖에서
 *  useHelpShow() 를 부를 뿐이다. AppRail 자체를 마운트하지 않는 이유는 이 파일의 관심이
 *  "등록·조회가 맞물리는가" 뿐이라, 레일의 레이아웃·아이콘까지 끌어올 이유가 없어서다. */
function FakeRailHelpButton() {
  const showHelp = useHelpShow();
  return (
    <button type="button" onClick={showHelp}>
      레일 도움말
    </button>
  );
}

function Wrapper({ children }: { children: ReactNode }) {
  const nav: AppHistoryApi = { screen: 'board', go: () => {}, back: () => {} };
  return (
    <SettingsProvider>
      <LibraryProvider>
        <ToastProvider>
          <HeaderProvider>
            <AppNavProvider value={nav}>
              <HelpTriggerProvider>
                <FakeRailHelpButton />
                <AppHeader />
                {children}
              </HelpTriggerProvider>
            </AppNavProvider>
          </HeaderProvider>
          <LiveRegion />
        </ToastProvider>
      </LibraryProvider>
    </SettingsProvider>
  );
}

async function openBoard() {
  // 자유 전술판 튜토리얼이 자동 시작하면(§0.5) 스포트라이트가 Esc·포커스를 가로채 아래
  // 배선 테스트가 깨진다 — "이미 봤다" 상태로 시작한다.
  localStorage.setItem(
    PREFS_KEY,
    JSON.stringify({ ...makeDefaultPrefs(), tutorialsSeen: { board: true } }),
  );
  render(<BoardScreen />, { wrapper: Wrapper });
  await waitFor(() => expect(screen.getByRole('navigation', { name: '도구' })).toBeInTheDocument());
}

beforeEach(() => {
  localStorage.clear();
});

describe('도움말 — 레일 일원화 (§0.5 Phase 5)', () => {
  it('레일 [도움말] 을 누르면 지금 화면(자유 전술판)의 HelpCenter 가 열린다', async () => {
    await openBoard();
    expect(screen.queryByRole('dialog', { name: '도움말' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: '레일 도움말' }));
    const dialog = await screen.findByRole('dialog', { name: '도움말' });
    expect(dialog).toBeInTheDocument();
    // initialSection='board' — "자유 전술판" 섹션이 열린 채 떠야 한다.
    // ⚠️ 도움말 **본문 문장**을 셀렉터로 쓰지 않는다. 옛 단언은 폐기된 `help.board.item*`
    // 값("작도")을 물고 있어 콘텐츠 모델 교체(2026-09-08, PLAN-HELP-OVERHAUL 결정 1)로
    // 죽었다 — 이 테스트가 재려는 것은 "레일 [도움말] → 지금 화면 섹션이 선다" 는 배선이지
    // 본문 문장이 아니다. 섹션 제목은 i18n `help.section.*` 라벨이라 본문이 어떻게 바뀌어도
    // 안 흔들린다. 목차에 같은 이름의 버튼이 있으므로 heading 역할로 좁힌다.
    expect(within(dialog).getByRole('heading', { name: '자유 전술판' })).toBeInTheDocument();
  });

  it('Shift+? 로 열고 Esc 로 닫으면 열기 전 포커스로 돌아간다', async () => {
    await openBoard();
    const zoomIn = screen.getByRole('button', { name: '확대' });
    zoomIn.focus();

    await userEvent.keyboard('{Shift>}?{/Shift}');
    await screen.findByRole('dialog', { name: '도움말' });

    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '도움말' })).toBeNull());
    expect(document.activeElement).toBe(zoomIn);
  });
});
