// i18n C1 — 새 Provider 를 만들지 않는다. SettingsProvider 가 이미 prefs.language 를 쥐고
// 있으므로, 이 훅은 그 위에 얹는 파생값일 뿐이다(App.tsx 머리말의 "god-context 금지"와 같은 결).
import { useSettingsState } from '../store/settings/SettingsProvider.tsx';
import { resolveLocale } from './locale.ts';
import type { Locale } from './locale.ts';

function browserLangs(): readonly string[] {
  if (typeof navigator === 'undefined') return [];
  if (navigator.languages && navigator.languages.length > 0) return navigator.languages;
  return navigator.language ? [navigator.language] : [];
}

export function useLocale(): Locale {
  const { prefs } = useSettingsState();
  return resolveLocale(prefs.language, browserLangs());
}
