// 3.-2 — 좁은 창에서 84px 레일이 접혀 들어가는 **헤더 좌측 3칸 세그먼트**.
//
// 여기서 보는 것은 셋이다: (a) 레일과 **같은 계약**(같은 3항목·같은 aria-current·SCREEN_TO_RAIL)
// (b) 세로 예산 — 세그먼트가 헤더 52 안에 서는가 (c) 헤더 안에서의 자리(좌측 첫 칸).
// AppShell 층의 갈림(레일이냐 세그먼트냐, 폭 84 냐 0 이냐)은 AppShell.wiring.test.tsx 가 본다.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { AppNavAside, AppNavSegment } from './AppNavSegment.tsx';
import { AppRail } from './AppRail.tsx';
import { AppHeader } from './AppHeader.tsx';
import { AppNavProvider, useAppHistory } from './useAppHistory.ts';
import { SettingsProvider } from '../store/settings/SettingsProvider.tsx';
import { RAIL_ITEMS } from './screens.ts';
import { CHROME_ROWS } from './chromeBudget.ts';
import { HEADER_PAD_PX, headerContentMaxPx, headerPadCss, navSegmentHeightPx } from './navChrome.ts';

function Harness({ children }: { children: ReactNode }) {
  const nav = useAppHistory('board');
  return (
    <SettingsProvider>
      <AppNavProvider value={nav}>{children}</AppNavProvider>
    </SettingsProvider>
  );
}

beforeEach(() => {
  // useAppHistory 는 window.history.state 를 seed 로 쓴다 — 끊어두지 않으면 앞 테스트의
  // 화면이 새 테스트로 새어 들어온다(AppRail.test.tsx 와 같은 위생 규칙).
  window.history.replaceState(null, '');
  window.localStorage.clear();
});

const NAV_LABELS = ['보드', '드릴', '설정'] as const;

describe('AppNavSegment — 레일과 같은 계약', () => {
  it('3항목 + 현재 화면에 aria-current="page"', () => {
    render(<AppNavSegment />, { wrapper: Harness });
    const nav = screen.getByRole('navigation', { name: '주요 메뉴' });
    expect(within(nav).getAllByRole('button')).toHaveLength(3);
    expect(screen.getByRole('button', { name: '보드' })).toHaveAttribute('aria-current', 'page');
    for (const label of ['드릴', '설정']) {
      expect(screen.getByRole('button', { name: label })).not.toHaveAttribute('aria-current');
    }
    // 레일에서 빠진 것은 여기서도 없다 — 좁은 창이라고 목적지가 늘어나면 안 된다.
    expect(screen.queryByRole('button', { name: '시연' })).toBeNull();
    expect(screen.queryByRole('button', { name: '편집기' })).toBeNull();
  });

  it('시연 중에는 [드릴] 에 aria-current 가 붙는다 — SCREEN_TO_RAIL 을 레일과 공유한다', () => {
    window.history.replaceState({ screen: 'present', depth: 1 }, '');
    render(<AppNavSegment />, { wrapper: Harness });
    expect(screen.getByRole('button', { name: '드릴' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: '보드' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('button', { name: '설정' })).not.toHaveAttribute('aria-current');
  });

  it('칸을 클릭하면 useAppNav().go 가 실제로 불려 화면이 바뀐다', async () => {
    render(<AppNavSegment />, { wrapper: Harness });
    await userEvent.setup().click(screen.getByRole('button', { name: '설정' }));
    expect(window.history.state).toMatchObject({ screen: 'settings' });
  });

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

  it('버전이 함께 따라온다 — 좁은 창에서만 제보용 숫자가 사라지지 않는다', () => {
    const pkg = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf-8')) as { version: string };
    const { container } = render(<AppNavAside />, { wrapper: Harness });
    expect(container).toHaveTextContent(`v${pkg.version}`);
  });

  it('세그먼트에는 이동 3칸뿐이다 — 테마·버전은 거기 없다(오른 끝으로 갔다)', () => {
    const { container } = render(<AppNavSegment />, { wrapper: Harness });
    expect(screen.queryByRole('button', { name: /테마로 전환/ })).toBeNull();
    expect(container).not.toHaveTextContent(/^v\d/);
    expect(within(screen.getByRole('navigation', { name: '주요 메뉴' })).getAllByRole('button')).toHaveLength(3);
  });

  it('레일과 항목 이름이 글자 하나까지 같다', () => {
    // 좁은 창에서 라벨이 달라지면 스크린리더 사용자에게는 다른 앱이 된다. 한쪽만 고쳐도
    // 여기서 걸리도록 두 컴포넌트를 각각 렌더해 이름 목록을 대조한다.
    // 앞에서부터 RAIL_ITEMS 개수만 본다 — 레일은 테마 토글까지 <nav> 안에 넣는데(옛 구조)
    // 세그먼트는 그것을 내비 **밖**에 둔다. 테마 전환은 이동이 아니다.
    const names = (root: HTMLElement) =>
      within(within(root).getByRole('navigation', { name: '주요 메뉴' }))
        .getAllByRole('button')
        .slice(0, RAIL_ITEMS.length)
        .map((b) => b.textContent?.trim());
    const seg = render(<AppNavSegment />, { wrapper: Harness });
    const segNames = names(seg.container);
    seg.unmount();
    const rail = render(<AppRail />, { wrapper: Harness });
    expect(segNames).toEqual(names(rail.container));
    expect(segNames).toEqual([...NAV_LABELS]);
  });
});

describe('AppNavSegment — 세로 예산 (헤더 52 를 넘지 않는다)', () => {
  const headerRow = CHROME_ROWS.find((r) => r.id === 'appHeader')!;

  it('칸 높이(--hit 44) + 헤더 상하 여백 = 예산의 헤더 행 52 와 정확히 같다', () => {
    // 세로 합계 132 = 헤더 52 + 하단 바 64 + 코트 패딩 16. 여기서 한 픽셀만 넘쳐도 코트
    // 축척이 그만큼 줄어든다 — 그래서 '작으니까 괜찮다' 가 아니라 **등식**으로 못박는다.
    expect(headerRow.narrow).toBe(52);
    expect(navSegmentHeightPx(44)).toBe(44);
    expect(navSegmentHeightPx(44) + HEADER_PAD_PX.narrow.y * 2).toBe(headerRow.narrow);
    expect(navSegmentHeightPx(44)).toBeLessThanOrEqual(headerContentMaxPx(headerRow.narrow, true));
  });

  it('넓은 창의 여백은 그대로다 — 62 짜리 헤더에서 44 표적이 여유를 갖는다', () => {
    // 대조군. 좁은 쪽만 4 로 줄인 것이지 헤더 여백을 통째로 깎은 것이 아니다.
    expect(headerPadCss(false)).toBe('8px 24px');
    expect(headerPadCss(true)).toBe('4px 12px');
    expect(navSegmentHeightPx(44)).toBeLessThan(headerContentMaxPx(headerRow.wide, false));
  });

  it('세그먼트가 세로로 무엇도 덧붙이지 않는다 — 칸 높이가 곧 세그먼트 높이다', () => {
    // jsdom 은 레이아웃을 하지 않으므로 실측이 불가능하다. 대신 "높이를 늘리는 선언이
    // 없다" 를 본다: nav 컨테이너의 상하 여백·테두리가 비어 있고, 칸 높이는 --hit 파생이다.
    render(<AppNavSegment />, { wrapper: Harness });
    const nav = screen.getByRole('navigation', { name: '주요 메뉴' });
    expect(nav.style.paddingTop).toBe('');
    expect(nav.style.paddingBottom).toBe('');
    expect(nav.style.borderTopWidth).toBe('');
    expect(nav.style.borderBottomWidth).toBe('');
    for (const btn of within(nav).getAllByRole('button')) {
      expect(btn.style.minHeight).toBe('var(--hit)');
      // 폭 하한도 같은 값이다 — 아이콘만 남아도 44 밑으로 안 간다(§5.4).
      expect(btn.style.minWidth).toBe('var(--hit)');
    }
  });
});

describe('AppHeader — 좁은 창에서만 세그먼트를 좌측 첫 칸에 세운다', () => {
  it('narrow 면 헤더 첫 자식이 내비를 품고, 헤더 여백이 좁은 값으로 바뀐다', () => {
    render(<AppHeader narrow config={{ title: '전술판' }} />, { wrapper: Harness });
    const el = document.querySelector('header')!;
    const nav = screen.getByRole('navigation', { name: '주요 메뉴' });
    expect(el.contains(nav)).toBe(true);
    // 좌측 첫 칸 — 제목보다 앞이다. 키보드 순회가 헤더 → 판 순으로 흐르는 근거이기도 하다.
    expect(el.firstElementChild!.contains(nav)).toBe(true);
    expect(el.style.padding).toBe('4px 12px');
  });

  it('대조군: narrow 를 안 주면 헤더에 내비가 없다 — 레일이 지고 있다는 뜻이다', () => {
    render(<AppHeader config={{ title: '전술판' }} />, { wrapper: Harness });
    expect(screen.queryByRole('navigation', { name: '주요 메뉴' })).toBeNull();
    expect(document.querySelector('header')!.style.padding).toBe('8px 24px');
  });
});
