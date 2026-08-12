// 2.2 인스펙터 오버레이·핀의 **배선** 확인 — 화면 끝(BoardScreen → EditorWorkspace)에서 본다.
// InspectorHost.test.tsx 는 껍데기의 계약을, 여기서는 그 껍데기가 실제 판·실제 prefs·실제
// InspectorPanel 과 이어져 있는지를 확인한다. 컨테이너 폭 측정(useContainerWidth)까지 포함이라
// 완료 판정 (c) 는 여기서만 끝까지 관측된다 — 호스트에 숫자를 직접 넣는 단위 테스트로는
// "그 숫자를 누가 재서 넣어 주는가" 가 비어 있다.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
import { loadPrefs, makeDefaultPrefs, PREFS_KEY } from '../../storage/prefs.ts';
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

/** jsdom 은 레이아웃을 하지 않아 모든 폭이 0 이다 — 그러면 컨테이너가 늘 "좁음" 으로 판정돼
 *  핀 경로가 **한 줄도 실행되지 않은 채** 스위트가 초록불이 된다(세로 레이아웃 테스트가
 *  matchMedia 를 스텁하는 것과 같은 이유). SVG 는 건드리지 않는다 — 코트 계측은 그쪽이다. */
function stubContainerWidth(px: number) {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: px,
    bottom: 800,
    width: px,
    height: 800,
    toJSON: () => ({}),
  } as DOMRect);
}

async function openBoard(prefs: Partial<ReturnType<typeof makeDefaultPrefs>> = {}) {
  localStorage.setItem(PREFS_KEY, JSON.stringify({ ...makeDefaultPrefs(), defaultCourtMode: 'full', ...prefs }));
  const user = userEvent.setup();
  render(<BoardScreen />, { wrapper: Wrapper });
  await waitFor(() => expect(screen.getByRole('navigation', { name: '도구' })).toBeInTheDocument());
  return { user, main: document.getElementById('main')! };
}

/** 흐름(레이아웃)에 참여하는 형제 수. 오버레이는 absolute 라 여기에 안 잡히고, 붙박이는 잡힌다. */
const inflowChildren = (main: HTMLElement) => [...main.children].filter((c) => (c as HTMLElement).style.position !== 'absolute').length;

beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('인스펙터 오버레이 (결정 ③A)', () => {
  it('기본은 접힘이고, [속성]으로 열어도 코트 상자를 나눠 갖는 형제가 늘지 않는다 (완료 판정 (a))', async () => {
    stubContainerWidth(1280);
    const { user, main } = await openBoard();
    const before = inflowChildren(main);

    await user.click(screen.getByRole('button', { name: '속성' }));

    expect(screen.getByRole('complementary', { name: '드릴 속성' })).toBeInTheDocument();
    expect(inflowChildren(main)).toBe(before);
  });

  it('대조군: [고정]을 누르면 그때는 형제가 늘고 312px 을 떼어 간다', async () => {
    // 이 대조군이 없으면 위 단언은 "형제 수를 세지 못하는 선택자" 로도 통과한다.
    stubContainerWidth(1280);
    const { user, main } = await openBoard();
    const before = inflowChildren(main);
    await user.click(screen.getByRole('button', { name: '속성' }));

    await user.click(screen.getByRole('button', { name: '고정' }));

    expect(inflowChildren(main)).toBe(before + 1);
    const panelId = screen.getByRole('button', { name: '속성' }).getAttribute('aria-controls')!;
    expect(document.getElementById(panelId)!.style.width).toBe('312px');
  });
});

describe('[고정] 핀 (완료 판정 (b)(c))', () => {
  it('컨테이너가 1100 미만이면 핀이 나오지 않는다', async () => {
    stubContainerWidth(1099);
    const { user } = await openBoard();
    await user.click(screen.getByRole('button', { name: '속성' }));
    expect(screen.queryByRole('button', { name: '고정' })).toBeNull();
  });

  it('1100 이상이면 나오고, 누르면 prefs 에 남는다', async () => {
    stubContainerWidth(1100);
    const { user } = await openBoard();
    await user.click(screen.getByRole('button', { name: '속성' }));

    expect(loadPrefs().inspectorPinned).toBe(false);
    await user.click(screen.getByRole('button', { name: '고정' }));
    expect(loadPrefs().inspectorPinned).toBe(true);
    expect(screen.getByRole('button', { name: '고정' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('핀을 켜 둔 사람은 판을 열자마자 인스펙터가 붙어 있다', async () => {
    stubContainerWidth(1280);
    await openBoard({ inspectorPinned: true });
    expect(screen.getByRole('complementary', { name: '드릴 속성' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '속성' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('핀 토글에 인스펙터가 재마운트되지 않는다 — 펼친 선수 카드가 그대로다 (완료 판정 (b))', async () => {
    stubContainerWidth(1280);
    const { user } = await openBoard();
    const inspector = await (async () => {
      await user.click(screen.getByRole('button', { name: '속성' }));
      return screen.getByRole('complementary', { name: '드릴 속성' });
    })();

    // 명단에서 한 명을 펼친다 — 이 펼침은 InspectorPanel 안의 useState 다(prefs 도 리듀서도 아니다).
    const row = within(inspector).getAllByRole('button', { expanded: false })[0]!;
    await user.click(row);
    expect(row).toHaveAttribute('aria-expanded', 'true');

    await user.click(screen.getByRole('button', { name: '고정' }));

    // ⚠️ 잡아 둔 `row` 로만 보면 안 된다 — 재마운트되면 그 노드는 문서에서 떨어져 나가되
    //    aria-expanded="true" 를 그대로 달고 있어서 단언이 **헛통과**한다(F6 실검으로 확인).
    //    문서에 붙어 있는지와, 살아 있는 DOM 에서 다시 찾은 값을 함께 본다.
    expect(row.isConnected).toBe(true);
    const live = within(screen.getByRole('complementary', { name: '드릴 속성' })).getAllByRole('button', { expanded: true });
    expect(live).toContain(row);
  });
});

describe('Esc 우선순위 — 판 위에서는 선택 해제, 시트 안에서는 시트, 모달이 있으면 모달', () => {
  it('도움말이 떠 있으면 Esc 는 도움말만 닫는다 — 속성은 열린 채다', async () => {
    stubContainerWidth(1280);
    const { user } = await openBoard();
    await user.click(screen.getByRole('button', { name: '속성' }));

    // Shift+? — 편집기 전역 단축키. 시트는 Escape 외에는 아무것도 가로채지 않는다.
    await user.keyboard('{Shift>}?{/Shift}');
    const help = await screen.findByRole('dialog', { name: '키보드 단축키' });

    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog', { name: '키보드 단축키' })).toBeNull());
    expect(help).not.toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: '드릴 속성' })).toBeInTheDocument();
  });

  it('그다음 Esc 는 속성을 닫고, 포커스는 [속성] 버튼으로 돌아온다', async () => {
    stubContainerWidth(1280);
    const { user } = await openBoard();
    await user.click(screen.getByRole('button', { name: '속성' }));

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('complementary', { name: '드릴 속성' })).toBeNull();
    expect(screen.getByRole('button', { name: '속성' })).toHaveFocus();
  });
});
