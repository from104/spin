// §6.8 화면 골격 — 4개 화면 키와 그 표시 이름. react-router 미도입(§6.8 근거: 화면이 몇 개
// 안 되고 중첩 라우트 0·URL 공유가 제품 시나리오에 없음). 이 파일은 상수만 담고 로직은
// useAppHistory.ts 로 뺀다.
//
// 2026-08-09 재편: `editor` 를 별도 화면 키에서 **없앴다**. 자유 전술판과 드릴 편집은 같은
// 컴포넌트(EditorWorkspace)이고 둘 다 `home` 자리에 뜬다 — 무엇이 떠 있는지는 화면 키가
// 아니라 AppShell 의 StageTarget(board | drill)이 정한다. 화면 키로 갈랐더니 "대문에 판이
// 상시 떠 있다" 는 요구와 어긋났다(드릴을 열 때마다 판이 있던 자리를 다른 화면이 덮는다).

export type Screen = 'home' | 'library' | 'present' | 'settings';

export const SCREEN_ORDER: readonly Screen[] = ['home', 'library', 'present', 'settings'];

/** 레일 내비게이션 라벨(목록 화면 키는 'library'지만 레일 라벨은 '목록'). */
export const SCREEN_NAV_LABELS: Record<Screen, string> = {
  home: '전술판',
  library: '목록',
  present: '시연',
  settings: '설정',
};

/** 헤더 기본 타이틀·부제. 드릴이나 전술판이 로드되면 화면이 §7.6 이하 헤더 컨텍스트로 실제
 *  제목을 덮어쓴다 — 여기 값은 아직 아무 화면도 헤더를 채우지 않았을 때의 대체값이자
 *  §7.6 라이브 리전 "{화면명} 화면" 발표에 쓰는 화면명이다. */
export const SCREEN_TITLES: Record<Screen, string> = {
  home: '전술판',
  library: '드릴 라이브러리',
  present: '시연 모드',
  settings: '설정',
};

export const SCREEN_SUBTITLES: Record<Screen, string> = {
  home: '',
  library: '저장된 드릴을 열어 편집하거나 시연하세요',
  present: '팀 앞에서 드릴을 단계별로 보여주세요',
  settings: '앱 동작과 팀 기본값',
};
