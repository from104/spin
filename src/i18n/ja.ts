// i18n C1 — ko.ts と同じキー集合(DictKey)を過不足なく持つ。キーが一つでも欠けるとコンパイル
// エラーになる(i18n/ko.ts のヘッダー参照)。
import type { DictKey } from './ko.ts';

export const ja: Record<DictKey, string> = {
  'settings.language.title': '言語',
  'settings.language.desc': 'メニューや画面で使う言語を選びます。自動はこの端末のブラウザ言語に従います。',
  'settings.language.auto': '自動',
};
