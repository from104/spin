// i18n C1 — must carry exactly the keys `ko.ts` defines (DictKey). A missing key is a compile
// error, not a runtime fallback — that's the point (see i18n/ko.ts header).
import type { DictKey } from './ko.ts';

export const en: Record<DictKey, string> = {
  'settings.language.title': 'Language',
  'settings.language.desc': 'Choose the language for menus and screens. Auto follows this device’s browser language.',
  'settings.language.auto': 'Auto',

  // C2 — app chrome (rail, header, shared widgets)
  'common.close': 'Close',
  'a11y.skipToContent': 'Skip to main content',
  'app.nav.mainMenu': 'Main menu',
  'app.theme.toggleToLight': 'Switch to light theme',
  'app.theme.toggleToDark': 'Switch to dark theme',
  'app.theme.toggleTitle': 'Toggle theme',
  'app.header.newDrill': 'New Drill',
  'app.header.newSession': 'New Session',
  'app.header.drillSearchLabel': 'Search drills',
  'app.header.drillSearchPlaceholder': 'Search drills…',
  'app.header.drillNameLabel': 'Drill name',
  'app.header.drillNameEditButton': 'Drill name: {{title}}. Press to edit',
  'app.header.drillNameEditHint': 'Press to edit the name.',
  'app.header.drillDescLabel': 'Drill description',
  'app.header.courtSwitchAriaLabel': 'Court shape',
  'app.header.courtSwitchLockedAriaLabel': 'Court shape (locked)',
  'app.header.courtSwitchLockedHint': 'The court shape can’t be changed after the drill is created.',
  'app.announce.freeBoard': 'Free tactics board',
  'app.announce.drillEdit': 'Editing drill',
  'app.announce.drillEditTitled': 'Editing drill: {{title}}',
  'app.announce.drillList': 'Drill list',
  'app.announce.sessionList': 'Session list',
  'app.announce.presentMode': 'Presentation mode',
  'app.announce.presentTitled': 'Presenting: {{title}}',
  'app.announce.settings': 'Settings',
};
