// i18n C1 — 화면 문자열 사전 조회. `{{name}}` 치환만 지원하는 최소 구현이다 — 언어가 셋으로
// 고정돼 있어(ko/en/ja) ICU 복수화·네임스페이스 같은 i18next 급 기능은 애초에 쓸모가 없다
// (조사 결론, plan 참고).
import { useCallback } from 'react';
import { useLocale } from './useLocale.ts';
import { ko } from './ko.ts';
import { en } from './en.ts';
import { ja } from './ja.ts';
import type { DictKey } from './ko.ts';
import type { Locale } from './locale.ts';

const DICTS: Record<Locale, Record<DictKey, string>> = { ko, en, ja };

export type TFunction = (key: DictKey, params?: Record<string, string | number>) => string;

/** 훅이 아닌 일반 함수 — React 컴포넌트가 아닌 곳(예: app/announce.ts 의 순수 함수)에서
 *  로케일을 명시로 받아 번역할 때 쓴다. `useT()` 는 이 위에 얹은 얇은 껍데기다. */
export function translate(locale: Locale, key: DictKey, params?: Record<string, string | number>): string {
  const raw = DICTS[locale][key];
  if (!params) return raw;
  return raw.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => String(params[name] ?? ''));
}

export function useT(): TFunction {
  const locale = useLocale();
  return useCallback<TFunction>((key, params) => translate(locale, key, params), [locale]);
}
