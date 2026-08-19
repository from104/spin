import { describe, it, expect } from 'vitest';
import { detectLocale, resolveLocale, SUPPORTED_LOCALES, DEFAULT_LOCALE, LOCALE_NAMES } from './locale.ts';

describe('detectLocale', () => {
  it('주 서브태그가 매치하면 그 언어다', () => {
    expect(detectLocale(['ko-KR', 'en-US'])).toBe('ko');
    expect(detectLocale(['ja'])).toBe('ja');
    expect(detectLocale(['en-US'])).toBe('en');
  });

  it('대소문자를 가리지 않는다', () => {
    expect(detectLocale(['KO-kr'])).toBe('ko');
  });

  it('첫 매치를 쓴다 — 지원 안 하는 언어가 먼저 와도 다음 태그를 본다', () => {
    expect(detectLocale(['fr-FR', 'ja-JP'])).toBe('ja');
  });

  it('매치가 없으면 DEFAULT_LOCALE(영어) 로 떨어진다', () => {
    expect(detectLocale(['fr-FR', 'de-DE'])).toBe(DEFAULT_LOCALE);
    expect(detectLocale([])).toBe(DEFAULT_LOCALE);
  });
});

describe('resolveLocale', () => {
  it("'auto' 는 navigator 배열로 감지한다", () => {
    expect(resolveLocale('auto', ['ja-JP'])).toBe('ja');
  });

  it("명시 값은 navigator 를 보지 않는다 — 감지를 우회하는 통로다", () => {
    expect(resolveLocale('en', ['ko-KR'])).toBe('en');
  });
});

describe('SUPPORTED_LOCALES / LOCALE_NAMES', () => {
  it('세 언어 각각 표기가 있다', () => {
    for (const loc of SUPPORTED_LOCALES) {
      expect(LOCALE_NAMES[loc]).toBeTruthy();
    }
  });
});
