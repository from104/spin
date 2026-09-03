// 3.-2 — 좁은 창에서 84px 레일이 접혀 들어가는 **헤더 좌측 3칸 세그먼트**.
//
// 여기서 보는 것은 셋이다: (a) 레일과 **같은 계약**(같은 3항목·같은 aria-current·SCREEN_TO_RAIL)
// (b) 세로 예산 — 세그먼트가 헤더 48 안에 서는가 (c) 헤더 안에서의 자리(좌측 첫 칸).
// AppShell 층의 갈림(레일이냐 세그먼트냐, 폭 84 냐 0 이냐)은 AppShell.wiring.test.tsx 가 본다.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { AppNavAside, AppNavSegment } from './AppNavSegment.tsx';
import { AppNavProvider, useAppHistory } from './useAppHistory.ts';
import { SettingsProvider } from '../store/settings/SettingsProvider.tsx';
import { CHROME_ROWS } from './chromeBudget.ts';
import { HEADER_PAD_PX, headerContentMaxPx, navSegmentHeightPx } from './navChrome.ts';
import { HelpTriggerProvider, usePublishHelpShow } from '../ui/help/HelpTriggerProvider.tsx';

/** 실제 화면이 usePublishHelpShow 로 등록하는 것을 흉내낸다 — 여기서는 관측만 한다. */
let shown = false;
function ShowHelpProbe() {
  usePublishHelpShow(() => {
    shown = true;
  });
  return null;
}

type HarnessProps = { children: ReactNode };
// C4(react-router) — useAppHistory 가 라우터 위의 어댑터가 되면서 하네스도 메모리 라우터로
// 세운다. 화면 시드는 window.history.state 가 아니라 **주소**(harnessPath)다.
let harnessPath = '/';
function NavBridge({ children }: HarnessProps) {
  const nav = useAppHistory('board');
  return <AppNavProvider value={nav}>{children}</AppNavProvider>;
}
function Harness({ children }: HarnessProps) {
  const router = useMemo(
    () => createMemoryRouter([{ path: '*', element: <NavBridge>{children}</NavBridge> }], { initialEntries: [harnessPath] }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  return (
    <SettingsProvider>
      <RouterProvider router={router} />
    </SettingsProvider>
  );
}

beforeEach(() => {
  harnessPath = '/';
  window.localStorage.clear();
  shown = false;
});

describe('AppNavSegment — 레일과 같은 계약', () => {
  it('테마 토글이 prefs.theme 을 반전시키고 localStorage 에 남긴다', async () => {
    // 좁은 창에서 테마 토글이 사라지면 체육관 조명 대응이 설정 화면 왕복으로만 가능해진다
    // (§3 표적 예산의 '헤더 6 = 내비 3 + 되돌리기/다시하기 2 + **테마 1**' 이 이 자리다).
    // ⚠️ 2026-08-14 — 테마·버전이 세그먼트에서 떨어져 **헤더 오른 끝**(AppNavAside)으로 갔다.
    // 넓은 창 레일이 그 모양이기 때문이다(이동은 맨 위, 이 둘은 맨 끝).
    render(<AppNavAside />, { wrapper: Harness });
    await userEvent.setup().click(screen.getByRole('button', { name: '라이트 테마로 전환' }));
    expect(screen.getByRole('button', { name: '다크 테마로 전환' })).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem('spin.prefs') ?? '{}').theme).toBe('light');
  });

  // §0.5 Phase 5 — 좁은 창에서는 [도움말]이 AppNavAside 에 함께 들어간다(테마·버전과 같은 자리).
  it('[도움말] 이 테마 앞(맨 앞)에 서고, 누르면 useHelpShow() 가 불린다', async () => {
    render(
      <HelpTriggerProvider>
        <ShowHelpProbe />
        <AppNavAside />
      </HelpTriggerProvider>,
      { wrapper: Harness },
    );
    const help = screen.getByRole('button', { name: '도움말' });
    const theme = screen.getByRole('button', { name: /테마로 전환/ });
    expect(help.compareDocumentPosition(theme) & Node.DOCUMENT_POSITION_FOLLOWING, '테마가 도움말보다 뒤다').toBeTruthy();

    await userEvent.setup().click(help);
    expect(shown).toBe(true);
  });

  it('버전이 함께 따라온다 — 좁은 창에서만 제보용 숫자가 사라지지 않는다', () => {
    const pkg = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf-8')) as { version: string };
    const { container } = render(<AppNavAside />, { wrapper: Harness });
    expect(container).toHaveTextContent(`v${pkg.version}`);
  });

  it('아이콘은 표적(--hit 44)보다 작다 — 크면 로고가 헤더 높이를 밀어 버린다', () => {
    // 헤더 한 줄이 48 이고 그 안에 44 짜리 표적이 선다. 레일에서 쓰는 42 를 그대로 가져오면
    // 여백 2 를 넘겨 헤더가 다시 두꺼워진다 — 이번 라운드에서 줄인 4px 을 도로 뱉는 셈이다.
    const { container } = render(<AppNavSegment />, { wrapper: Harness });
    const logo = container.querySelector('img')!;
    expect(Number(logo.getAttribute('height'))).toBeLessThan(44);
  });
});

describe('AppNavSegment — 세로 예산 (헤더 48 을 넘지 않는다)', () => {
  const headerRow = CHROME_ROWS.find((r) => r.id === 'appHeader')!;

  it('칸 높이(--hit 44) + 헤더 상하 여백 = 예산의 헤더 행 48 과 정확히 같다', () => {
    // 세로 합계 128 = 헤더 48 + 하단 바 64 + 코트 패딩 16. 여기서 한 픽셀만 넘쳐도 코트
    // 축척이 그만큼 줄어든다 — 그래서 '작으니까 괜찮다' 가 아니라 **등식**으로 못박는다.
    expect(headerRow.narrow).toBe(48);
    expect(navSegmentHeightPx(44)).toBe(44);
    expect(navSegmentHeightPx(44) + HEADER_PAD_PX.narrow.y * 2).toBe(headerRow.narrow);
    expect(navSegmentHeightPx(44)).toBeLessThanOrEqual(headerContentMaxPx(headerRow.narrow, true));
  });
});
