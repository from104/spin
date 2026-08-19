// i18n C1 — ko.ts と同じキー集合(DictKey)を過不足なく持つ。キーが一つでも欠けるとコンパイル
// エラーになる(i18n/ko.ts のヘッダー参照)。
import type { DictKey } from './ko.ts';

export const ja: Record<DictKey, string> = {
  'settings.language.title': '言語',
  'settings.language.desc': 'メニューや画面で使う言語を選びます。自動はこの端末のブラウザ言語に従います。',
  'settings.language.auto': '自動',

  // C2 — アプリ全体のクロム(レール・ヘッダー・共通ウィジェット)
  'common.close': '閉じる',
  'a11y.skipToContent': '本文へスキップ',
  'app.nav.mainMenu': 'メインメニュー',
  'app.theme.toggleToLight': 'ライトテーマに切り替え',
  'app.theme.toggleToDark': 'ダークテーマに切り替え',
  'app.theme.toggleTitle': 'テーマ切り替え',
  'app.header.newDrill': '新規ドリル',
  'app.header.newSession': '新規セッション',
  'app.header.drillSearchLabel': 'ドリル検索',
  'app.header.drillSearchPlaceholder': 'ドリルを検索…',
  'app.header.drillNameLabel': 'ドリル名',
  'app.header.drillNameEditButton': 'ドリル名: {{title}}。押して編集',
  'app.header.drillNameEditHint': '押すと名前を編集できます。',
  'app.header.drillDescLabel': 'ドリルの説明',
  'app.header.courtSwitchAriaLabel': 'コート形状',
  'app.header.courtSwitchLockedAriaLabel': 'コート形状(変更不可)',
  'app.header.courtSwitchLockedHint': 'コート形状はドリル作成後は変更できません。',
  'app.announce.freeBoard': 'フリー戦術ボード',
  'app.announce.drillEdit': 'ドリル編集',
  'app.announce.drillEditTitled': 'ドリル編集: {{title}}',
  'app.announce.drillList': 'ドリル一覧',
  'app.announce.sessionList': 'セッション一覧',
  'app.announce.presentMode': 'プレゼンモード',
  'app.announce.presentTitled': 'プレゼン: {{title}}',
  'app.announce.settings': '設定',
};
