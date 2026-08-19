// i18n C1 — must carry exactly the keys `ko.ts` defines (DictKey). A missing key is a compile
// error, not a runtime fallback — that's the point (see i18n/ko.ts header).
import type { DictKey } from './ko.ts';

export const en: Record<DictKey, string> = {
  'settings.language.title': 'Language',
  'settings.language.desc': 'Choose the language for menus and screens. Auto follows this device’s browser language.',
  'settings.language.auto': 'Auto',
};
