// §6.8 화면 골격 — 5개 화면 키와 그 표시 이름. react-router 미도입(§6.8 근거: 화면 5개·중첩
// 라우트 0·URL 공유가 제품 시나리오에 없음). 이 파일은 상수만 담고 로직은 useAppHistory.ts 로 뺀다.

export type Screen = 'home' | 'library' | 'editor' | 'present' | 'settings';

export const SCREEN_ORDER: readonly Screen[] = ['home', 'library', 'editor', 'present', 'settings'];

/** 레일 내비게이션 라벨(프로토타입 navDefs 그대로 — 목록 화면 키는 'library'지만 레일 라벨은 '목록'). */
export const SCREEN_NAV_LABELS: Record<Screen, string> = {
  home: '대문',
  library: '목록',
  editor: '편집기',
  present: '시연',
  settings: '설정',
};

/** 헤더 기본 타이틀·부제(프로토타입 `titles` 그대로). 드릴이 로드되면 화면이 §7.6 이하 헤더
 *  컨텍스트로 실제 제목을 덮어쓴다 — 여기 값은 아직 아무 화면도 헤더를 채우지 않았을 때의
 *  대체값이자 §7.6 라이브 리전 "{화면명} 화면" 발표에 쓰는 화면명이다. */
export const SCREEN_TITLES: Record<Screen, string> = {
  home: '대문',
  library: '드릴 라이브러리',
  editor: '편집기',
  present: '시연 모드',
  settings: '설정',
};

export const SCREEN_SUBTITLES: Record<Screen, string> = {
  home: '오늘의 훈련 현황과 빠른 시작',
  library: '저장된 드릴을 열어 편집하거나 시연하세요',
  editor: '',
  present: '팀 앞에서 드릴을 단계별로 보여주세요',
  settings: '앱 동작과 팀 기본값',
};
