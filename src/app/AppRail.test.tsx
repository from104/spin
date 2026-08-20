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
let harnessRouter: ReturnType<typeof createMemoryRouter> | null = null;
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
  harnessRouter = router;
  return (
    <SettingsProvider>
      <RouterProvider router={router} />
    </SettingsProvider>
  );
}

beforeEach(() => {
  harnessPath = '/';
  harnessRouter = null;
  window.localStorage.clear();
  shown = false;
});

describe('AppRail', () => {
  it('3개 레일 링크 + aria-current="page" 를 현재 화면에 표시한다', () => {
    render(
      <Harness>
        <AppRail />
      </Harness>,
    );
    const nav = screen.getByRole('navigation', { name: '주요 메뉴' });
    expect(nav).toBeInTheDocument();
    // 2026-08-09 재편: '편집기' 는 레일에서 사라졌다(드릴 편집은 판과 같은 자리에 뜬다).
    // 2026-08-12 재편(계획서 2.1): 라벨이 [보드][드릴][설정] 3단이 됐고 '시연' 도 빠졌다 —
    // 레일로 시연에 들어와 봤자 대상이 없어 빈 화면만 뜨는 자리였다.
    expect(screen.getByRole('button', { name: '보드' })).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByRole('button', { name: '편집기' })).toBeNull();
    expect(screen.queryByRole('button', { name: '시연' })).toBeNull();
    expect(screen.queryByRole('button', { name: '전술판' })).toBeNull();
    for (const label of ['드릴', '설정']) {
      expect(screen.getByRole('button', { name: label })).not.toHaveAttribute('aria-current');
    }
  });

  it('시연 중에는 [드릴] 에 aria-current 가 붙는다 — 레일에 없는 화면이 남의 자리를 빌린다', () => {
    // 레일이 StageTarget 을 모른 채 화면 키만 보고 접는 것이 계약이다(SCREEN_TO_RAIL).
    // 이 매핑이 없으면 시연 중에는 세 버튼 어디에도 현재 표시가 없다.
    harnessPath = '/present';
    render(
      <Harness>
        <AppRail />
      </Harness>,
    );
    expect(screen.getByRole('button', { name: '드릴' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: '보드' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('button', { name: '설정' })).not.toHaveAttribute('aria-current');
  });

  it('레일 버튼을 클릭하면 useAppNav().go 가 실제로 불려 화면이 바뀐다', async () => {
    render(
      <Harness>
        <AppRail />
      </Harness>,
    );
    await userEvent.setup().click(screen.getByRole('button', { name: '설정' }));
    expect(harnessRouter!.state.location.pathname).toBe('/settings');
  });

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

  it('가운데 원을 그리지 않는다 — FIPFA Laws 2025 에 센터 서클이 없다', () => {
    // 코트 그림에서 걷어낸 것(5차)을 아이콘이 도로 가르치면 안 된다. 흔한 축구 아이콘을
    // 주워 오면 거의 반드시 <circle> 이 딸려 온다.
    render(<AppRail />, { wrapper: Harness });
    const svg = screen.getByRole('button', { name: '보드' }).querySelector('svg');
    expect(svg?.querySelectorAll('circle')).toHaveLength(0);
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

  it('42×42 이고 **벡터**다 — 200% 배율에서 코트의 흰 파선이 살아남는 유일한 길', () => {
    render(<AppRail />, { wrapper: Harness });
    const logo = screen.getByRole('navigation', { name: '주요 메뉴' }).querySelector('img')!;
    expect(logo.getAttribute('width')).toBe('42');
    expect(logo.getAttribute('height')).toBe('42');
    expect(logo.getAttribute('src')!.endsWith('.svg'), '래스터로 되돌아갔다').toBe(true);
    // 마크가 **원**이라 자를 모서리가 없다. 라운드를 걸면 원의 상하좌우가 미세하게 깎인다.
    expect(logo.style.borderRadius).toBe('');
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
