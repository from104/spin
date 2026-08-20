// 문서형 도움말(HelpCenter) 섹션 정의 — docs/PLAN-HELP-TUTORIAL.md §B.
//
// 섹션은 화면(TutorialScreenKey)과 대개 1:1 이지만 '세션'은 예외다: 세션 목록과 세션 편집은
// 튜토리얼 화면 키가 둘(sessions·sessionEditor)인데 도움말에서는 "세션을 어떻게 다루는가"
// 라는 한 이야기라 한 섹션으로 묶고, [투어 다시 보기] 버튼만 둘을 낸다(§B "각 섹션 끝에
// [이 화면 투어 다시 보기]"). '시작하기'·'설정·데이터'·'단축키'는 특정 화면 하나에 매이지
// 않아 튜토리얼 재시작 버튼이 없다.
import type { TutorialScreenKey } from '../../storage/prefs.ts';
import type { DictKey } from '../../i18n/ko.ts';

export type HelpSectionKey = 'start' | 'board' | 'library' | 'editor' | 'sessions' | 'present' | 'settings' | 'shortcuts';

export const HELP_SECTION_ORDER: readonly HelpSectionKey[] = ['start', 'board', 'library', 'editor', 'sessions', 'present', 'settings', 'shortcuts'];

export const HELP_SECTION_LABEL_KEY: Record<HelpSectionKey, DictKey> = {
  start: 'help.section.start',
  board: 'help.section.board',
  library: 'help.section.library',
  editor: 'help.section.editor',
  sessions: 'help.section.sessions',
  present: 'help.section.present',
  settings: 'help.section.settings',
  shortcuts: 'help.section.shortcuts',
};

/** 지금 있는 화면(TutorialScreenKey) → 그에 맞는 도움말 섹션. HelpCenter 를 여는 쪽(Phase 5
 *  레일 배선)이 "현재 화면에 맞는 섹션이 열린 채로 뜬다"(§B)를 구현할 때 쓴다. */
export function helpSectionForScreen(screen: TutorialScreenKey): HelpSectionKey {
  return screen === 'sessionEditor' ? 'sessions' : screen;
}

export interface HelpItem {
  term: DictKey;
  desc: DictKey;
}

export interface HelpRestartTarget {
  screen: TutorialScreenKey;
  labelKey: DictKey;
}

export interface NarrativeSection {
  key: Exclude<HelpSectionKey, 'shortcuts'>;
  items: readonly HelpItem[];
  restartTargets: readonly HelpRestartTarget[];
}

export const HELP_NARRATIVE_SECTIONS: Record<Exclude<HelpSectionKey, 'shortcuts'>, NarrativeSection> = {
  start: {
    key: 'start',
    restartTargets: [],
    items: [
      { term: 'help.start.item1.term', desc: 'help.start.item1.desc' },
      { term: 'help.start.item2.term', desc: 'help.start.item2.desc' },
      { term: 'help.start.item3.term', desc: 'help.start.item3.desc' },
      { term: 'help.start.item4.term', desc: 'help.start.item4.desc' },
    ],
  },
  board: {
    key: 'board',
    restartTargets: [{ screen: 'board', labelKey: 'help.board.restartButton' }],
    items: [
      { term: 'help.board.item1.term', desc: 'help.board.item1.desc' },
      { term: 'help.board.item2.term', desc: 'help.board.item2.desc' },
      { term: 'help.board.item3.term', desc: 'help.board.item3.desc' },
      { term: 'help.board.item4.term', desc: 'help.board.item4.desc' },
    ],
  },
  library: {
    key: 'library',
    restartTargets: [{ screen: 'library', labelKey: 'help.library.restartButton' }],
    items: [
      { term: 'help.library.item1.term', desc: 'help.library.item1.desc' },
      { term: 'help.library.item2.term', desc: 'help.library.item2.desc' },
      { term: 'help.library.item3.term', desc: 'help.library.item3.desc' },
      { term: 'help.library.item4.term', desc: 'help.library.item4.desc' },
    ],
  },
  editor: {
    key: 'editor',
    restartTargets: [{ screen: 'editor', labelKey: 'help.editor.restartButton' }],
    items: [
      { term: 'help.editor.item1.term', desc: 'help.editor.item1.desc' },
      { term: 'help.editor.item2.term', desc: 'help.editor.item2.desc' },
      { term: 'help.editor.item3.term', desc: 'help.editor.item3.desc' },
      { term: 'help.editor.item4.term', desc: 'help.editor.item4.desc' },
      { term: 'help.editor.item5.term', desc: 'help.editor.item5.desc' },
    ],
  },
  sessions: {
    key: 'sessions',
    restartTargets: [
      { screen: 'sessions', labelKey: 'help.sessions.restartListButton' },
      { screen: 'sessionEditor', labelKey: 'help.sessions.restartEditorButton' },
    ],
    items: [
      { term: 'help.sessions.item1.term', desc: 'help.sessions.item1.desc' },
      { term: 'help.sessions.item2.term', desc: 'help.sessions.item2.desc' },
      { term: 'help.sessions.item3.term', desc: 'help.sessions.item3.desc' },
      { term: 'help.sessions.item4.term', desc: 'help.sessions.item4.desc' },
      { term: 'help.sessions.item5.term', desc: 'help.sessions.item5.desc' },
    ],
  },
  present: {
    key: 'present',
    restartTargets: [{ screen: 'present', labelKey: 'help.present.restartButton' }],
    items: [
      { term: 'help.present.item1.term', desc: 'help.present.item1.desc' },
      { term: 'help.present.item2.term', desc: 'help.present.item2.desc' },
      { term: 'help.present.item3.term', desc: 'help.present.item3.desc' },
      { term: 'help.present.item4.term', desc: 'help.present.item4.desc' },
    ],
  },
  settings: {
    key: 'settings',
    restartTargets: [],
    items: [
      { term: 'help.settings.item1.term', desc: 'help.settings.item1.desc' },
      { term: 'help.settings.item2.term', desc: 'help.settings.item2.desc' },
      { term: 'help.settings.item3.term', desc: 'help.settings.item3.desc' },
    ],
  },
};
