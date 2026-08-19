// i18n C1 — LocaleEffects 가 실제로 <html lang> 을 반영하는지. ThemeEffects 테스트
// (themeEffects.cues.test.tsx)와 같은 자리·같은 패턴.
import { beforeEach, describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { LocaleEffects } from './App.tsx';
import { SettingsProvider } from '../store/settings/SettingsProvider.tsx';
import { makeDefaultPrefs, PREFS_KEY } from '../storage/prefs.ts';
import type { Preferences } from '../storage/prefs.ts';

function seed(language: Preferences['language']) {
  localStorage.setItem(PREFS_KEY, JSON.stringify({ ...makeDefaultPrefs(), language }));
}

beforeEach(() => {
  localStorage.clear();
});

describe('LocaleEffects — <html lang>', () => {
  it("'auto' 는 테스트 환경 고정값(ko-KR, test/setup.ts)대로 lang='ko' 를 심는다", () => {
    seed('auto');
    render(
      <SettingsProvider>
        <LocaleEffects />
      </SettingsProvider>,
    );
    expect(document.documentElement.lang).toBe('ko');
  });

  it("명시 값 'ja' 는 navigator 와 무관하게 그대로 lang='ja' 를 심는다", () => {
    seed('ja');
    render(
      <SettingsProvider>
        <LocaleEffects />
      </SettingsProvider>,
    );
    expect(document.documentElement.lang).toBe('ja');
  });
});
