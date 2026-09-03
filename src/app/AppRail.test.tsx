// §6.8/§7.5a "<nav aria-label='주요 메뉴'>" + aria-current="page". 레일 클릭이 실제로 useAppNav().go
// 를 호출해 화면을 바꾸는지, 테마 토글이 SettingsProvider 로 영속화되는지 확인한다.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { AppRail } from './AppRail.tsx';
import { AppNavProvider, useAppHistory } from './useAppHistory.ts';
import { SettingsProvider } from '../store/settings/SettingsProvider.tsx';
import { PREFS_KEY, makeDefaultPrefs } from '../storage/prefs.ts';
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

describe('AppRail', () => {
  it('테마 토글이 prefs.theme 을 반전시키고 localStorage 에 남긴다', async () => {
    render(
      <Harness>
        <AppRail />
      </Harness>,
    );
    const toggle = screen.getByRole('button', { name: '라이트 테마로 전환' }); // 기본 dark
    await userEvent.setup().click(toggle);
    expect(screen.getByRole('button', { name: '다크 테마로 전환' })).toBeInTheDocument();
    const saved = JSON.parse(window.localStorage.getItem('spin.prefs') ?? '{}');
    expect(saved.theme).toBe('light');
  });

  // §0.5 Phase 5 — [도움말]이 테마 토글 바로 위, 레일 맨 끝 쪽에 상시 칸으로 선다.
  it('[도움말] 이 테마 토글 바로 앞(위)에 서고, 누르면 useHelpShow() 가 불린다', async () => {
    render(
      <Harness>
        <HelpTriggerProvider>
          <ShowHelpProbe />
          <AppRail />
        </HelpTriggerProvider>
      </Harness>,
    );
    const help = screen.getByRole('button', { name: '도움말' });
    const theme = screen.getByRole('button', { name: /테마로 전환/ });
    expect(help.compareDocumentPosition(theme) & Node.DOCUMENT_POSITION_FOLLOWING, '테마가 도움말보다 뒤(아래)다').toBeTruthy();

    await userEvent.setup().click(help);
    expect(shown).toBe(true);
  });
});

describe('버전 표시', () => {
  it('레일 하단에 package.json 의 버전을 그대로 보여준다', () => {
    // 값의 출처를 package.json 하나로 묶어 둔 것을 못박는다 — 화면에 리터럴로 박으면
    // 릴리스 때 반드시 어긋나고, 어긋나도 아무 테스트가 빨간불이 되지 않는다.
    // vitest 는 프로젝트 루트에서 돈다. import.meta.url 은 변환 단계에서 file: 스킴이
    // 아니어서 못 쓴다.
    const pkg = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf-8')) as { version: string };
    render(<AppRail />, { wrapper: Harness });
    const nav = screen.getByRole('navigation', { name: '주요 메뉴' });
    expect(nav).toHaveTextContent(`v${pkg.version}`);
  });
});

describe('보드 아이콘', () => {
  // 2026-08-12 재편은 화면 키를 `home`→`board` 로 개명하면서 **그림은 집을 그대로 뒀다**.
  // 이름만 바뀐 것을 아무도 못 잡은 이유는 아이콘에 단언이 하나도 없었기 때문이라 여기서 건다.
  it('집이 아니라 코트를 그린다 — 외곽선 + 하프웨이 선 + 골 지역 둘', () => {
    render(<AppRail />, { wrapper: Harness });
    const svg = screen.getByRole('button', { name: '보드' }).querySelector('svg');
    expect(svg).not.toBeNull();

    // 집에는 <rect> 가 없다(지붕 + ㄷ자 벽, path 둘뿐) — 되돌리면 이 줄부터 빨개진다.
    expect(svg?.querySelectorAll('rect')).toHaveLength(1);

    const ds = [...(svg?.querySelectorAll('path') ?? [])].map((p) => p.getAttribute('d'));
    expect(ds).toHaveLength(2);
    expect(ds).toContain('M12 5.5v13'); // 하프웨이 선 — 가로 정중앙(2 + 20/2)
    expect(ds.some((d) => d?.includes('h4v6') && d.includes('h-4v6'))).toBe(true); // 골 지역 ㄷ자 둘
  });
});

// 2026-08-14 — 로고를 'SP' 두 글자에서 기현님이 주신 앱 아이콘으로 바꿨다. 아이콘에 단언이
// 하나도 없어서 레일 첫 항목이 이름만 바뀐 채 집 모양으로 몇 주를 남아 있던 일이 있었다
// (그 수리가 IconBoard 다). 같은 일이 로고에서 되풀이되지 않게 여기서 못박는다.
describe('레일 로고', () => {
  it('앱 아이콘 이미지이고, 스크린리더에는 안 읽힌다', () => {
    render(<AppRail />, { wrapper: Harness });
    const nav = screen.getByRole('navigation', { name: '주요 메뉴' });
    const logo = nav.querySelector('img')!;
    expect(logo, '로고 이미지가 없다 — 글자 로고로 되돌아갔나').toBeTruthy();
    expect(logo.getAttribute('src')).toBe('/logo.svg');
    // 바로 아래 'SPIN' 워드마크가 같은 것을 한 번 더 말한다 — 둘 다 읽히면 "SP SPIN" 이 된다.
    expect(logo.getAttribute('alt')).toBe('');
    expect(logo.getAttribute('aria-hidden')).toBe('true');
  });

  it('prefs.language 를 English 로 두면 레일 라벨·테마 버튼이 실제로 영어로 바뀐다(i18n C2)', () => {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ ...makeDefaultPrefs(), language: 'en' }));
    render(<AppRail />, { wrapper: Harness });
    expect(screen.getByRole('navigation', { name: 'Main menu' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Board' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Drills' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
    // 기본은 다크 테마다 — 그러면 "전환" 문구는 라이트로 가는 쪽이다.
    expect(screen.getByRole('button', { name: 'Switch to light theme' })).toBeInTheDocument();
  });
});
