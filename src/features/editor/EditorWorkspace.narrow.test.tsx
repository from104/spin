// 2.3 크롬 예산의 **배선** 확인 — 창이 좁아지면 판이 실제로 넓어지는가.
import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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

/** jsdom 에는 matchMedia 가 없다. 안 깔면 두 boolean 이 **둘 다 false** 로 굳어 좁은 경로가
 *  한 줄도 실행되지 않은 채 스위트가 초록불이 된다(BoardScreen.test.tsx 의 stubOrientation 과
 *  같은 이유). 질의마다 다른 답을 줘야 한다 — 하나로 뭉뚱그리면 세로 테스트가 덤으로 좁아진다. */
function stubMedia({ portrait, narrow }: { portrait: boolean; narrow: boolean }) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (q: string) => ({
      matches: q.includes('portrait') ? portrait : q.includes('max-width') ? narrow : false,
      media: q,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => true,
    }),
  });
}

afterEach(() => {
  delete (window as unknown as { matchMedia?: unknown }).matchMedia;
});

async function openBoard() {
  // tutorialsSeen.board 를 미리 채운다 — 안 그러면 첫 렌더에 자유 전술판 튜토리얼 스포트라이트가
  // 자동으로 뜨면서 이 파일의 "바이트 동일" DOM 해시 비교가 매번 깨진다(§0.5, tutorialSteps.ts).
  localStorage.setItem(
    PREFS_KEY,
    JSON.stringify({ ...makeDefaultPrefs(), tutorialsSeen: { board: true } }),
  );
  render(<BoardScreen />, { wrapper: Wrapper });
  await waitFor(() => expect(screen.getByRole('navigation', { name: '도구' })).toBeInTheDocument());
  const main = document.getElementById('main')!;
  // ⚠️ TransformWriter 는 React 밖에서 rAF 로 `transform` 을 직접 쓴다(§6.1 규칙 1). 첫 프레임
  //    전에 DOM 을 읽으면 골대·개체에 그 속성이 통째로 없어서 해시가 흔들린다 — 파일 하나만
  //    돌릴 때는 늘 맞다가 전체 스위트(부하)에서만 가끔 빠졌다. 판이 한 번 그려진 뒤에 읽는다.
  await waitFor(() => expect(main.querySelector('.goal-post')).toHaveAttribute('transform'));
  return main;
}

/** 코트를 감싼 상자(패딩을 먹는 그 상자) 하나. 여러 개가 잡히면 엉뚱한 노드를 보고 있는
 *  것이므로 개수까지 단언한다 — 선택자가 낡으면 조용히 다른 div 를 검사하게 된다. */
function courtWrapper(main: HTMLElement): HTMLElement {
  const hits = [...main.querySelectorAll('div')].filter(
    (d) => d.style.alignItems === 'center' && d.style.justifyContent === 'center' && d.style.padding !== '',
  );
  expect(hits, '코트 래퍼 선택자가 낡았다').toHaveLength(1);
  return hits[0]!;
}

describe('narrow === true — 크롬 예산의 코트 래퍼 행', () => {
  it('세로 판정과 좁음 판정은 서로 섞이지 않는다', async () => {
    // 세로로 세운 큰 태블릿(예: 27인치를 돌린 창)은 세로지만 좁지 않다. 하나로 묶으면 여기서
    // 크롬이 걷혀 버린다.
    stubMedia({ portrait: true, narrow: false });
    const main = await openBoard();
    // 2026-08-14 — 전술판의 main 은 언제나 row 다. 세로 판정은 판 덩어리의 축이 말한다.
    expect(document.querySelector<HTMLElement>('[data-board]')!.style.flexDirection, '세로 판정은 여전히 살아 있어야 한다').toBe('row');
    expect(courtWrapper(main).style.padding).toBe('20px 24px');
  });

  it('가로로 눕힌 좁은 기기 — 좁지만 세로가 아니다', async () => {
    stubMedia({ portrait: false, narrow: true });
    const main = await openBoard();
    expect(main.style.flexDirection).toBe('row');
    expect(courtWrapper(main).style.padding).toBe('8px 12px');
  });
});
