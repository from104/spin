// useLocale/useT 가 실제로 SettingsProvider 의 prefs.language 를 읽어 사전을 고르는지 —
// 순수 함수 단위 조각(locale.test.ts)이 이미 본 detectLocale/resolveLocale 자체가 아니라
// **배선**을 본다.
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SettingsProvider } from '../store/settings/SettingsProvider.tsx';
import { PREFS_KEY, makeDefaultPrefs } from '../storage/prefs.ts';
import type { Preferences } from '../storage/prefs.ts';
import { useT } from './useT.ts';
import { useLocale } from './useLocale.ts';

function Probe() {
  const t = useT();
  const locale = useLocale();
  return <div data-testid="probe">{`${locale}:${t('settings.language.title')}`}</div>;
}

function seed(language: Preferences['language']) {
  localStorage.setItem(PREFS_KEY, JSON.stringify({ ...makeDefaultPrefs(), language }));
}

beforeEach(() => {
  localStorage.clear();
});

describe('useT/useLocale — 실제 렌더 배선', () => {
  it("'auto' 는 테스트 환경 고정값(ko-KR, test/setup.ts)대로 'ko' 로 떨어진다", () => {
    seed('auto');
    render(<Probe />, { wrapper: SettingsProvider });
    expect(screen.getByTestId('probe')).toHaveTextContent('ko:언어');
  });

  it("명시 값 'en' 은 navigator 를 보지 않고 그대로 영어 사전을 쓴다", () => {
    seed('en');
    render(<Probe />, { wrapper: SettingsProvider });
    expect(screen.getByTestId('probe')).toHaveTextContent('en:Language');
  });

  it("명시 값 'ja' 는 그대로 일본어 사전을 쓴다", () => {
    seed('ja');
    render(<Probe />, { wrapper: SettingsProvider });
    expect(screen.getByTestId('probe')).toHaveTextContent('ja:言語');
  });
});
