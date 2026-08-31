// 도해를 **영어로 렌더해서 한국어가 남았는지 DOM 에서 직접 잰다.**
//
// ⚠️ 이 파일이 존재하는 이유가 곧 그 방식의 근거다. 2026-08-31 에 도해 다국어를 두 번 랜딩했는데
// 두 번 다 빠뜨린 자리가 있었고, 두 번 다 **grep 으로 골라 고쳤기** 때문이다:
//   1회차 — 여러 줄 JSX 텍스트 노드를 정규식이 못 잡아 `농구 코트` 콜아웃·범례·판정 문구가 남았다.
//   2회차 — `COURT_SIZE_LABELS.ko` 하드코딩과 `FloorPanel` 의 prop 문자열이 남았다.
// 기현님이 화면을 보고 두 번 다 알려 주셨다. 소스를 훑는 검사로는 이 종류를 못 잡는다 —
// **렌더된 결과**를 봐야 한다. 그래서 여기서는 텍스트 노드와 `aria-label` 을 전부 긁어 센다.
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { RuleFigure } from '../RuleFigure.tsx';
import { RULE_FIGURE_IDS } from './ids.ts';
import { SettingsProvider } from '../../../store/settings/SettingsProvider.tsx';
import { PREFS_KEY, makeDefaultPrefs } from '../../../storage/prefs.ts';
import { SUPPORTED_LOCALES } from '../../../i18n/locale.ts';
import type { Locale } from '../../../i18n/locale.ts';

const HANGUL = /[가-힣]/;

/** 렌더된 도해에서 사람이 읽게 되는 문자열을 전부 모은다 — 보이는 글자 **와** 스크린리더가
 *  읽는 `aria-label`. 후자를 빼면 "화면은 영어인데 읽어 주는 말은 한국어" 를 놓친다. */
function renderedStrings(locale: Locale, id: (typeof RULE_FIGURE_IDS)[number]): string[] {
  window.localStorage.setItem(PREFS_KEY, JSON.stringify({ ...makeDefaultPrefs(), language: locale }));
  const { container, unmount } = render(
    <SettingsProvider>
      <RuleFigure id={id} />
    </SettingsProvider>,
  );
  const out: string[] = [];
  container.querySelectorAll('*').forEach((el) => {
    const aria = el.getAttribute('aria-label');
    if (aria) out.push(aria);
    el.childNodes.forEach((n) => {
      if (n.nodeType === Node.TEXT_NODE && n.textContent?.trim()) out.push(n.textContent.trim());
    });
  });
  unmount();
  window.localStorage.clear();
  return out;
}

describe('조항 도해 — 로케일', () => {
  // ko 가 아닌 로케일 **전부**를 돈다 — 로케일이 늘어도 검사가 저절로 따라온다(2026-08-31 ja 추가).
  const OTHERS = SUPPORTED_LOCALES.filter((l) => l !== 'ko');
  it.each(OTHERS.flatMap((l) => RULE_FIGURE_IDS.map((id) => [l, id] as const)))(
    '%s 로케일의 %s 도해에 한국어가 한 글자도 안 남는다',
    (locale, id) => {
      const leftovers = renderedStrings(locale, id).filter((s) => HANGUL.test(s));
      expect(leftovers, `${locale}/${id}: 번역 안 된 문자열`).toEqual([]);
    },
  );

  it.each(RULE_FIGURE_IDS)('%s 도해는 한국어에서 그대로 한국어다', (id) => {
    // 반대 방향도 잰다 — 안 그러면 "전부 영어로 하드코딩" 이라는 회귀가 위 단언을 통과한다.
    expect(renderedStrings('ko', id).some((s) => HANGUL.test(s)), id).toBe(true);
  });
});
