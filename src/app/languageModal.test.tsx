// 언어 고르기 — 2026-09-02 에 설정 화면에서 **왼쪽 레일의 지구본**으로 옮겼다(기현 지시).
// 옛 검사는 SettingsScreen.test.tsx 의 '언어(i18n C1)' describe 였고, 여기가 그 자리를 잇는다.
//
// 레일에서 열어 고르는 **한 바퀴 전체**를 잰다. 모달만 따로 마운트해서 재면 이 개편에서 가장
// 깨지기 쉬운 자리 — *"레일 버튼이 실제로 이 모달을 여는가"* 와 *"도움말 위에 서는가"* — 가
// 통째로 검사 밖에 남는다. 그 둘이 어긋나도 모달 자체는 멀쩡히 동작하므로 눈에 안 띈다.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppRail } from './AppRail.tsx';
import { AppNavAside } from './AppNavSegment.tsx';
import { SettingsProvider } from '../store/settings/SettingsProvider.tsx';
import { HelpTriggerProvider } from '../ui/help/HelpTriggerProvider.tsx';
import { AppNavProvider } from './useAppHistory.ts';
import { loadPrefs } from '../storage/prefs.ts';
import type { AppHistoryApi } from './useAppHistory.ts';

const nav: AppHistoryApi = { screen: 'board', go: vi.fn(), back: vi.fn() };

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <SettingsProvider>
    <AppNavProvider value={nav}>
      <HelpTriggerProvider>{children}</HelpTriggerProvider>
    </AppNavProvider>
  </SettingsProvider>
);

const openModal = async () => {
  const user = userEvent.setup();
  render(<AppRail />, { wrapper });
  await user.click(screen.getByRole('button', { name: '언어' }));
  return { user, dialog: screen.getByRole('dialog') };
};

beforeEach(() => {
  localStorage.clear();
});

describe('언어 고르기 — 레일의 지구본', () => {
  it('레일 버튼이 모달을 연다', async () => {
    const { dialog } = await openModal();
    expect(within(dialog).getByRole('button', { name: '자동' })).toBeInTheDocument();
  });

  it('★ 순서가 자동 · 한국어 · English · 日本語 다 (기현 지시)', async () => {
    const { dialog } = await openModal();
    // 목록의 **세로 순서**가 지시로 정해진 값이다. `SUPPORTED_LOCALES` 를 그대로 펴면
    // 판정용 배열의 순서가 화면으로 새어 나오므로, 그것과 갈라 둔 것을 여기서 못박는다.
    const names = within(dialog)
      .getAllByRole('button')
      .map((b) => b.textContent?.trim())
      .filter((x): x is string => !!x && x !== '닫기');
    expect(names).toEqual(['자동', '한국어', 'English', '日本語']);
  });

  it("기본값은 '자동' 이고 그 줄에 표시가 선다", async () => {
    const { dialog } = await openModal();
    expect(within(dialog).getByRole('button', { name: '자동' })).toHaveAttribute('aria-current', 'true');
    expect(within(dialog).getByRole('button', { name: '한국어' })).not.toHaveAttribute('aria-current');
  });

  it('한국어를 고르면 저장되고 모달이 닫힌다', async () => {
    const { user, dialog } = await openModal();
    await user.click(within(dialog).getByRole('button', { name: '한국어' }));
    expect(loadPrefs().language).toBe('ko');
    expect(screen.queryByRole('dialog'), '한 번 누르면 끝나는 명령이다').toBeNull();
  });

  it('English 를 고르면 레일 글자가 곧바로 영어가 된다', async () => {
    const { user, dialog } = await openModal();
    await user.click(within(dialog).getByRole('button', { name: 'English' }));
    expect(loadPrefs().language).toBe('en');
    // 같은 버튼을 이제 영어 이름으로 찾을 수 있어야 한다 — 반영이 화면까지 갔다는 뜻이다.
    expect(screen.getByRole('button', { name: 'Language' })).toBeInTheDocument();
  });

  it('日本語를 고르면 prefs 에 ja 로 저장된다', async () => {
    const { user, dialog } = await openModal();
    await user.click(within(dialog).getByRole('button', { name: '日本語' }));
    expect(loadPrefs().language).toBe('ja');
  });

  it('★ 레일에서 [도움말] 바로 위에 선다 (기현 지시)', async () => {
    render(<AppRail />, { wrapper });
    const buttons = Array.from(document.querySelectorAll('nav button'));
    const lang = screen.getByRole('button', { name: '언어' });
    const help = screen.getByRole('button', { name: '도움말' });
    expect(buttons.indexOf(help) - buttons.indexOf(lang), '언어 다음이 곧 도움말이어야 한다').toBe(1);
  });

  // ⚠️ 좁은 창(태블릿)에는 AppRail 이 **아예 안 선다**(AppShell 의 `!narrow`). 설정 화면의
  //    언어 섹션을 뺐으므로, 여기 버튼이 빠지면 태블릿에서 언어를 바꿀 길이 통째로 사라진다.
  //    그런데 넓은 창 테스트는 전부 초록이라 눈에 안 띈다 — 그래서 따로 못박는다.
  it('★ 좁은 창(AppNavAside)에도 같은 문이 있다 — 태블릿이 주 대상 기기다', async () => {
    const user = userEvent.setup();
    render(<AppNavAside />, { wrapper });
    await user.click(screen.getByRole('button', { name: '언어' }));
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: '日本語' }));
    expect(loadPrefs().language).toBe('ja');
  });
});
