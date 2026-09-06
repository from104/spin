// 규칙 화면을 **영어로 통째로 렌더해서** 한국어가 남았는지 DOM 에서 잰다.
//
// ⚠️ 소스를 훑는 검사(rg)로는 이 종류를 못 잡는다. 2026-08-31 도해·장면 다국어에서 세 번
// 빠뜨렸고 세 번 다 기현님이 화면을 보고 알려 주셨다 — 여러 줄 JSX 텍스트, `COURT_SIZE_LABELS.ko`
// 하드코딩, 컴포넌트에 넘기는 prop 문자열, 그리고 화면에 안 보이는 `aria-label`.
// 그래서 여기서는 **9장을 전부 열어 보고** 텍스트 노드와 aria-label 을 긁는다.
//
// 장면(보드) 안의 글자는 여기서 안 잰다 — 그쪽은 `sceneText.ts` 오버레이가 담당하고
// `buildRuleScene(id, 'en')` 으로 따로 검산한다(장면 마운트는 무겁고 비동기 재생이 얽힌다).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RulesScreen } from './RulesScreen.tsx';
import { ruleTopicsFor } from './ruleTopics.ts';
import { SettingsProvider } from '../../store/settings/SettingsProvider.tsx';
import { PREFS_KEY, makeDefaultPrefs } from '../../storage/prefs.ts';
import type { HomeNav } from '../home/nav.ts';
import { SUPPORTED_LOCALES } from '../../i18n/locale.ts';
import type { Locale } from '../../i18n/locale.ts';

const HANGUL = /[가-힣]/;

/** 장면 블록은 마운트가 무겁고(PlaybackProvider + PresentStage) 이 테스트의 대상도 아니다.
 *  글자만 재려는 것이므로 껍데기로 바꾼다 — 그 안의 글자는 `sceneText.ts` 쪽에서 검산한다. */
vi.mock('./RuleSceneBlock.tsx', () => ({ RuleSceneBlock: () => null }));

function nav(onOpen: (k?: string) => void): HomeNav {
  return {
    newDrill: vi.fn(),
    openDrill: vi.fn(),
    goLibrary: vi.fn(),
    openSession: vi.fn(),
    presentDrill: vi.fn(),
    presentSession: vi.fn(),
    openRuleTopic: onOpen,
    openLegal: vi.fn(),
  };
}

function korean(root: HTMLElement): string[] {
  const out: string[] = [];
  root.querySelectorAll('*').forEach((el) => {
    const aria = el.getAttribute('aria-label');
    if (aria && HANGUL.test(aria)) out.push(aria);
    el.childNodes.forEach((n) => {
      const t = n.nodeType === Node.TEXT_NODE ? n.textContent?.trim() : '';
      if (t && HANGUL.test(t)) out.push(t);
    });
  });
  return [...new Set(out)];
}

const OTHERS = SUPPORTED_LOCALES.filter((l) => l !== 'ko');

describe('규칙 화면 — ko 가 아닌 로케일에 한국어가 남지 않는다', () => {
  beforeEach(() => {
    window.localStorage.clear();
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: (q: string) => ({ matches: false, media: q, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => true }),
    });
  });

  const seed = (locale: Locale) =>
    window.localStorage.setItem(PREFS_KEY, JSON.stringify({ ...makeDefaultPrefs(), language: locale }));

  it.each(OTHERS)('%s — 카드 홈', (locale) => {
    seed(locale);
    const { container } = render(
      <SettingsProvider>
        <RulesScreen nav={nav(() => {})} />
      </SettingsProvider>,
    );
    expect(korean(container), `${locale} 카드 홈에 번역 안 된 문자열`).toEqual([]);
  });

  it.each(OTHERS.flatMap((l) => ruleTopicsFor(l).map((t) => [l, t.key] as const)))('%s — %s 카드 상세', async (locale, key) => {
    seed(locale);
    const { container } = render(
      <SettingsProvider>
        <RulesScreen topic={key} nav={nav(() => {})} />
      </SettingsProvider>,
    );
    // 재개 비교표는 **좁은 화면일 때만** 모든 열을 펼치므로, 넓은 화면에서는 선택된 열만 뜬다.
    // 열을 하나씩 눌러 전 열의 셀을 화면에 올린 뒤 잰다 — 안 그러면 여섯 열이 안 잡힌다.
    const cols = screen.queryAllByRole('button').filter((b) => b.getAttribute('aria-pressed') !== null);
    for (const c of cols) await userEvent.click(c);
    expect(korean(container), `${locale}/${key} 카드에 번역 안 된 문자열`).toEqual([]);
  });
});
