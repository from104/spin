// §6.8/§7.5a "<nav aria-label='주요 메뉴'>" + aria-current="page". 레일 클릭이 실제로 useAppNav().go
// 를 호출해 화면을 바꾸는지, 테마 토글이 SettingsProvider 로 영속화되는지 확인한다.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { AppRail } from './AppRail.tsx';
import { AppNavProvider, useAppHistory } from './useAppHistory.ts';
import { SettingsProvider } from '../store/settings/SettingsProvider.tsx';

function Harness({ children }: { children: ReactNode }) {
  const nav = useAppHistory('home');
  return (
    <SettingsProvider>
      <AppNavProvider value={nav}>{children}</AppNavProvider>
    </SettingsProvider>
  );
}

beforeEach(() => {
  window.history.replaceState(null, '');
  window.localStorage.clear();
});

describe('AppRail', () => {
  it('4개 화면 링크 + aria-current="page" 를 현재 화면에 표시한다', () => {
    render(
      <Harness>
        <AppRail />
      </Harness>,
    );
    const nav = screen.getByRole('navigation', { name: '주요 메뉴' });
    expect(nav).toBeInTheDocument();
    // 2026-08-09 재편: 대문 라벨은 '전술판' 이 됐고 '편집기' 는 레일에서 사라졌다
    // (드릴 편집은 전술판과 같은 자리에 뜬다 — screens.ts 주석).
    expect(screen.getByRole('button', { name: '전술판' })).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByRole('button', { name: '편집기' })).toBeNull();
    for (const label of ['목록', '시연', '설정']) {
      expect(screen.getByRole('button', { name: label })).not.toHaveAttribute('aria-current');
    }
  });

  it('레일 버튼을 클릭하면 useAppNav().go 가 실제로 불려 화면이 바뀐다', async () => {
    render(
      <Harness>
        <AppRail />
      </Harness>,
    );
    await userEvent.setup().click(screen.getByRole('button', { name: '설정' }));
    expect(window.history.state).toMatchObject({ screen: 'settings' });
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
