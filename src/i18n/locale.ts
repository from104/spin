// i18n C1 — 로케일 판정의 단일 출처. React 도 store 도 모르는 순수 리프 모듈이라(§8 레이어
// 원칙과 같은 결) storage/prefs.ts 를 포함해 어디서든 순환 없이 import 할 수 있다.
export const SUPPORTED_LOCALES = ['ko', 'en', 'ja'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

/** 매칭되는 지원 언어가 없을 때의 폴백(기현님 지시 2026-08-19). */
export const DEFAULT_LOCALE: Locale = 'en';

/** 언어 선택지에 쓰는 표기 — **번역하지 않는다.** "한국어"·"English"·"日本語" 는 그 언어 자체의
 *  고유명사라, 지금 켜진 UI 언어가 무엇이든 항상 이 표기 그대로 보여주는 게 표준 관례다
 *  (자기 모국어를 못 알아보는 사고를 막는다 — 예: 영어 UI 에서 "한국어" 항목이 "Korean" 으로
 *  바뀌면 한국어를 찾는 사용자가 그 줄을 못 알아볼 수 있다). */
export const LOCALE_NAMES: Record<Locale, string> = {
  ko: '한국어',
  en: 'English',
  ja: '日本語',
};

/** 지원 언어 중 하나로 확정하는 순수 함수 — `navigator` 를 직접 읽지 않고 배열을 받는다
 *  (테스트가 브라우저 환경 없이 그대로 부를 수 있게). 각 태그의 주 서브태그만 보고
 *  (`'ko-KR'` → `'ko'`), 지원 목록에 있는 첫 매치를 돌려준다. 매치가 없으면 `DEFAULT_LOCALE`. */
export function detectLocale(langs: readonly string[]): Locale {
  for (const tag of langs) {
    const primary = tag.split('-')[0]?.toLowerCase() ?? '';
    if ((SUPPORTED_LOCALES as readonly string[]).includes(primary)) {
      return primary as Locale;
    }
  }
  return DEFAULT_LOCALE;
}

/** prefs.language 값 하나를 실제 로케일로 편다. `'auto'` 가 아니면 그 값이 곧 답이라
 *  `navigator` 를 아예 보지 않는다 — 테스트가 명시 값으로 자동감지를 우회하는 통로다. */
export function resolveLocale(pref: 'auto' | Locale, langs: readonly string[]): Locale {
  return pref === 'auto' ? detectLocale(langs) : pref;
}
