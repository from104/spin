// 문서형 도움말(HelpCenter) 섹션 정의 — docs/PLAN-HELP-TUTORIAL.md §B, PLAN-HELP-OVERHAUL §2.1.
//
// 이 파일은 **섹션의 뼈대만** 쥔다: 순서 · 이름(i18n 키) · [투어 다시 보기] 대상 · 화면→섹션
// 매핑. 본문은 여기 없다 — `helpContent.ko/en/ja.ts` 가 섹션 안의 주제(topic)와 블록을 쥔다.
//
// ── ⚠️ 2026-09-08: `HelpItem`·`NarrativeSection`·`HELP_NARRATIVE_SECTIONS` 폐기 ──────
// 원래 이 파일에는 섹션마다 `{term, desc}` i18n 키 쌍 목록이 있었다(그 근거는 "한 줄 항목이면
// 사전에 두는 편이 로케일 셋을 한자리에서 본다" 였다). 그 전제가 죽었다 — 항목이 한 줄이 아니라
// 문단·순서·표를 담아야 하는 설명서가 되면서 평면 사전에 담을 수 없게 됐고(PLAN-HELP-OVERHAUL
// F5), 로케일 셋이 사전 안에서 갈라져도 아무도 모르는 사고가 이미 났다([보드 설정] 개편이 ko
// 에만 반영). 대가: i18n `help.*` 본문 키 76개가 사라지고, 그만큼이 로케일별 콘텐츠 파일로
// 옮겨 갔다. 남은 `help.*` 키는 섹션 이름·투어 버튼·찾기 같은 **UI 문구**뿐이다.
//
// 섹션은 화면(TutorialScreenKey)과 대개 1:1 이지만 둘이 예외다: '세션' 은 튜토리얼 화면 키가
// 둘(sessions·sessionEditor)인데 도움말에서는 "세션을 어떻게 다루는가" 라는 한 이야기라 한
// 섹션으로 묶고 [투어 다시 보기] 버튼만 둘을 낸다(§B). '내보내기'(export)는 반대로 대응하는
// 화면이 아예 없다 — 편집·시연·세션 어디서나 나가는 길이라 한 섹션으로 승격했다
// (PLAN-HELP-OVERHAUL §2.1). '시작하기'·'설정·데이터'·'단축키'·'내보내기'는 특정 화면 하나에
// 매이지 않아 튜토리얼 재시작 버튼이 없다.
//
// 2026-09-09: '팀'(team) 섹션이 '세션' 다음에 들어왔다(docs/PLAN-TEAM.md 결정 23·16). 화면
// 하나(TutorialScreenKey 'team')와 1:1 이라 예외가 아니다 — 순서만 레일(`RAIL_ITEMS`)과 같게
// 맞춘다. 도움말 목차와 레일 순서가 어긋나면 "세 번째 칸" 같은 말이 두 화면에서 다른 것을
// 가리킨다.
import type { TutorialScreenKey } from '../../storage/prefs.ts';
import type { DictKey } from '../../i18n/ko.ts';

export type HelpSectionKey =
  | 'start'
  | 'board'
  | 'library'
  | 'editor'
  | 'sessions'
  | 'team'
  | 'present'
  | 'export'
  | 'rules'
  | 'settings'
  | 'shortcuts';

export const HELP_SECTION_ORDER: readonly HelpSectionKey[] = [
  'start',
  'board',
  'library',
  'editor',
  'sessions',
  'team',
  'present',
  'export',
  'rules',
  'settings',
  'shortcuts',
];

export const HELP_SECTION_LABEL_KEY: Record<HelpSectionKey, DictKey> = {
  start: 'help.section.start',
  board: 'help.section.board',
  library: 'help.section.library',
  editor: 'help.section.editor',
  sessions: 'help.section.sessions',
  team: 'help.section.team',
  present: 'help.section.present',
  export: 'help.section.export',
  rules: 'help.section.rules',
  settings: 'help.section.settings',
  shortcuts: 'help.section.shortcuts',
};

export interface HelpRestartTarget {
  screen: TutorialScreenKey;
  labelKey: DictKey;
}

/** 섹션 끝의 [이 화면 투어 다시 보기] 버튼들. 대응 화면이 없는 섹션은 빈 배열이다 — 버튼이
 *  아예 안 나온다(0개면 묶음 자체를 그리지 않는다). */
export const HELP_RESTART_TARGETS: Record<HelpSectionKey, readonly HelpRestartTarget[]> = {
  start: [],
  board: [{ screen: 'board', labelKey: 'help.board.restartButton' }],
  library: [{ screen: 'library', labelKey: 'help.library.restartButton' }],
  editor: [{ screen: 'editor', labelKey: 'help.editor.restartButton' }],
  sessions: [
    { screen: 'sessions', labelKey: 'help.sessions.restartListButton' },
    { screen: 'sessionEditor', labelKey: 'help.sessions.restartEditorButton' },
  ],
  team: [{ screen: 'team', labelKey: 'help.team.restartButton' }],
  present: [{ screen: 'present', labelKey: 'help.present.restartButton' }],
  export: [],
  rules: [{ screen: 'rules', labelKey: 'help.rules.restartButton' }],
  settings: [],
  shortcuts: [],
};

/** 지금 있는 화면(TutorialScreenKey) → 그에 맞는 도움말 섹션. HelpCenter 를 여는 쪽이
 *  "현재 화면에 맞는 섹션이 열린 채로 뜬다"(§B)를 구현할 때 쓴다. */
export function helpSectionForScreen(screen: TutorialScreenKey): HelpSectionKey {
  return screen === 'sessionEditor' ? 'sessions' : screen;
}
