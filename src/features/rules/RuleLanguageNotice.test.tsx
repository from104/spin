// 규칙 콘텐츠가 ko 전용이라는 사실을 화면이 **읽는 사람의 언어로** 말하는지 본다.
//
// 이 안내가 없으면 en/ja 사용자에게는 "버튼만 번역된 한국어 화면" 이 나가고, 그 사람은 이유를
// 알 길이 없다. 조용히 사라지기 쉬운 종류라(콘텐츠가 늘어난 것처럼 보이는 커밋에서 지워지면
// 아무 테스트도 안 깨진다) 여기서 못 박는다.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RulesScreen } from './RulesScreen.tsx';
import { RULE_CONTENT_LOCALES, hasRuleContentFor, ruleTopicsFor } from './ruleTopics.ts';
import { FIPFA_LAWS_PDF_URL } from './RuleLanguageNotice.tsx';
import { SUPPORTED_LOCALES, DEFAULT_LOCALE } from '../../i18n/locale.ts';
import type { Locale } from '../../i18n/locale.ts';
import { en } from '../../i18n/en.ts';
import { ja } from '../../i18n/ja.ts';
import { SettingsProvider } from '../../store/settings/SettingsProvider.tsx';
import { PREFS_KEY, makeDefaultPrefs } from '../../storage/prefs.ts';
import type { HomeNav } from '../home/nav.ts';

function nav(): HomeNav {
  return {
    newDrill: vi.fn(),
    openDrill: vi.fn(),
    goLibrary: vi.fn(),
    openSession: vi.fn(),
    presentDrill: vi.fn(),
    presentSession: vi.fn(),
    openRuleTopic: vi.fn(),
  };
}

/** 언어 설정은 SettingsProvider 가 쥐고 있고 기본은 `'auto'`(브라우저 따름)다 — 테스트에서
 *  로케일을 강제하려면 저장된 선호를 심어 놓고 마운트해야 한다.
 *  (`useT.test.tsx` 의 `seed()` 와 같은 관용구. 키를 손으로 적으면 조용히 안 먹는다.) */
function renderAt(locale: Locale, topic?: string) {
  window.localStorage.setItem(PREFS_KEY, JSON.stringify({ ...makeDefaultPrefs(), language: locale }));
  return render(
    <SettingsProvider>
      <RulesScreen topic={topic} nav={nav()} />
    </SettingsProvider>,
  );
}

const notice = () => screen.queryByTestId('rule-language-notice');

describe('규칙 화면 — 콘텐츠 언어 안내', () => {
  beforeEach(() => {
    window.localStorage.clear();
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: (q: string) => ({ matches: false, media: q, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => true }),
    });
  });

  it('콘텐츠가 있는 로케일(ko)에는 안 뜬다', () => {
    renderAt('ko');
    expect(notice()).toBeNull();
  });

  it('콘텐츠가 없는 로케일(en·ja)에는 카드 홈에서 뜬다', () => {
    for (const locale of SUPPORTED_LOCALES.filter((l) => !hasRuleContentFor(l))) {
      window.localStorage.clear();
      const { unmount } = renderAt(locale);
      expect(notice(), locale).not.toBeNull();
      unmount();
    }
  });

  it('주제 상세로 곧장 들어와도 뜬다 — 딥링크가 홈을 건너뛴다', () => {
    renderAt('en', 'two-on-one');
    expect(notice()).not.toBeNull();
    // 상세가 실제로 열린 상태여야 이 단언에 뜻이 있다(안내만 뜨고 본문이 없으면 다른 버그다).
    expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
  });

  it('읽는 사람의 언어로 말한다 — 한국어 안내를 영어 화면에 띄우지 않는다', () => {
    renderAt('en');
    expect(screen.getByText(en['rules.langNotice.title'])).toBeInTheDocument();
  });

  it('일본어 화면에는 일본어 안내가 뜬다', () => {
    renderAt('ja');
    expect(screen.getByText(ja['rules.langNotice.title'])).toBeInTheDocument();
  });

  it('FIPFA 영어 원문 주소를 함께 준다 — 안내만 하고 갈 곳을 안 주면 반쪽이다', () => {
    renderAt('en');
    expect(screen.getByText(FIPFA_LAWS_PDF_URL)).toBeInTheDocument();
  });

  it('기본 로케일이 콘텐츠 없는 언어라는 사실 자체가 이 안내의 존재 이유다', () => {
    // `DEFAULT_LOCALE = 'en'` 이라, 브라우저가 ko/ja 가 아닌 사람은 **처음부터** 이 상태로 들어온다.
    // 이 단언이 빨개지는 날(= 기본이 ko 가 되거나 en 콘텐츠가 생기는 날)은 안내의 전제가 바뀐 날이니
    // 이 파일 전체를 다시 볼 것.
    expect(hasRuleContentFor(DEFAULT_LOCALE)).toBe(false);
    expect(RULE_CONTENT_LOCALES).toEqual(['ko']);
  });

  it('콘텐츠가 없어도 화면은 비지 않는다 — ko 로 폴백해 9카드를 그대로 보여준다', () => {
    expect(ruleTopicsFor('en')).toEqual(ruleTopicsFor('ko'));
    renderAt('en');
    expect(screen.getAllByRole('button').length).toBeGreaterThan(8);
  });
});
