// i18n C1 — 번역 원본. 이 파일이 `DictKey` 의 단일 출처다 — en.ts/ja.ts 는 이 파일의 키 집합과
// 정확히 같아야 하고(하나라도 빠지면 컴파일 에러), 여기 없는 키는 애초에 존재할 수 없다.
// 키는 '화면영역.요소' 점 표기 평면 구조 — 화면별 커밋마다 이 세 파일에 함께 늘어난다.
export const ko = {
  'settings.language.title': '언어',
  'settings.language.desc': '메뉴와 화면에 쓸 언어를 고릅니다. 자동은 이 기기의 브라우저 언어를 따릅니다.',
  'settings.language.auto': '자동',
} as const;

export type DictKey = keyof typeof ko;
