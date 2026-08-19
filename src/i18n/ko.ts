// i18n C1 — 번역 원본. 이 파일이 `DictKey` 의 단일 출처다 — en.ts/ja.ts 는 이 파일의 키 집합과
// 정확히 같아야 하고(하나라도 빠지면 컴파일 에러), 여기 없는 키는 애초에 존재할 수 없다.
// 키는 '화면영역.요소' 점 표기 평면 구조 — 화면별 커밋마다 이 세 파일에 함께 늘어난다.
export const ko = {
  'settings.language.title': '언어',
  'settings.language.desc': '메뉴와 화면에 쓸 언어를 고릅니다. 자동은 이 기기의 브라우저 언어를 따릅니다.',
  'settings.language.auto': '자동',

  // C2 — 앱 크롬(레일·헤더·공용 위젯)
  'common.close': '닫기',
  'a11y.skipToContent': '본문으로 건너뛰기',
  'app.nav.mainMenu': '주요 메뉴',
  'app.theme.toggleToLight': '라이트 테마로 전환',
  'app.theme.toggleToDark': '다크 테마로 전환',
  'app.theme.toggleTitle': '테마 전환',
  'app.header.newDrill': '새 드릴',
  'app.header.newSession': '새 세션',
  'app.header.drillSearchLabel': '드릴 검색',
  'app.header.drillSearchPlaceholder': '드릴 검색…',
  'app.header.drillNameLabel': '드릴 이름',
  'app.header.drillNameEditButton': '드릴 이름: {{title}}. 눌러서 수정',
  'app.header.drillNameEditHint': '눌러서 이름을 고칩니다.',
  'app.header.drillDescLabel': '드릴 설명',
  'app.header.courtSwitchAriaLabel': '코트 형태',
  'app.header.courtSwitchLockedAriaLabel': '코트 형태(변경 불가)',
  'app.header.courtSwitchLockedHint': '코트 형태는 드릴을 만든 뒤에는 바꿀 수 없습니다.',
  'app.announce.freeBoard': '자유 전술판',
  'app.announce.drillEdit': '드릴 편집',
  'app.announce.drillEditTitled': '드릴 편집: {{title}}',
  'app.announce.drillList': '드릴 목록',
  'app.announce.sessionList': '세션 목록',
  'app.announce.presentMode': '시연 모드',
  'app.announce.presentTitled': '시연: {{title}}',
  'app.announce.settings': '설정',
} as const;

export type DictKey = keyof typeof ko;
