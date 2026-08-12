// §6.8 화면 골격 — 4개 화면 키와 그 표시 이름. react-router 미도입(§6.8 근거: 화면이 몇 개
// 안 되고 중첩 라우트 0·URL 공유가 제품 시나리오에 없음). 이 파일은 상수만 담고 로직은
// useAppHistory.ts 로 뺀다.
//
// 2026-08-09 재편: `editor` 를 별도 화면 키에서 **없앴다**. 자유 전술판과 드릴 편집은 같은
// 컴포넌트(EditorWorkspace)이고 둘 다 `board` 자리에 뜬다 — 무엇이 떠 있는지는 화면 키가
// 아니라 AppShell 의 StageTarget(board | drill)이 정한다. 화면 키로 갈랐더니 "대문에 판이
// 상시 떠 있다" 는 요구와 어긋났다(드릴을 열 때마다 판이 있던 자리를 다른 화면이 덮는다).
//
// 2026-08-12 재편(계획서 2.1): `home`→`board`, `library`→`drills` **개명만** 한다. 화면 키를
// 늘리지도 줄이지도 않았다 — `SCREEN_ORDER` 는 여전히 4개고 위 2026-08-09 결정은 그대로다.
// 달라진 것은 **레일이 화면 키와 1:1 이 아니게 된 것**뿐이다: `present` 는 화면 키로 남되
// 레일에서는 빠지고, 시연 중 활성은 SCREEN_TO_RAIL 이 [드릴]로 접는다.

export type Screen = 'board' | 'drills' | 'present' | 'settings';

export const SCREEN_ORDER: readonly Screen[] = ['board', 'drills', 'present', 'settings'];

/** 레일에 실제로 서는 항목. 화면 키의 **부분집합**이다 — `present` 는 레일에 없다.
 *  시연은 목록/카드에서 들어가는 것이지 "빈 시연 화면으로 이동" 은 목적지가 아니었다
 *  (레일로 들어오면 대상이 없어 *"시연할 드릴을 목록에서 선택하세요"* 만 뜬다). */
export type RailKey = 'board' | 'drills' | 'settings';

export const RAIL_ITEMS: readonly RailKey[] = ['board', 'drills', 'settings'];

/** 지금 화면에서 레일의 **어느 항목**이 `aria-current="page"` 인가. AppRail 이 StageTarget 을
 *  모른 채 화면 키만 보고 판정할 수 있게 명시적 상수 맵으로 접는다(계획서 2.1 원칙 3) —
 *  레일이 편집기 내부 상태에 결합되는 것을 막는다. 시연 중 활성은 [드릴]이다. */
export const SCREEN_TO_RAIL: Record<Screen, RailKey> = {
  board: 'board',
  drills: 'drills',
  present: 'drills',
  settings: 'settings',
};

/** 개명 전 키 → 신 키. 사용자가 열어 둔 탭의 `history.state` 에는 옛 키가 그대로 들어 있으므로
 *  (useAppHistory 의 readNavEntry 가 이 표로 접는다) 지우면 그 탭들의 뒤로가기 이력이 통째로
 *  무효가 된다. **한시적 관용 경로**다 — 배포 후 한 사이클이 지나면 없앤다. */
export const LEGACY_SCREEN_KEYS: Readonly<Record<string, Screen>> = {
  home: 'board',
  library: 'drills',
};

/** 레일 내비게이션 라벨. 화면 키와 다른 문구인 것들이 있다(present 는 레일에 없지만 §7.6
 *  발표·헤더가 쓰므로 값은 유지한다). */
export const SCREEN_NAV_LABELS: Record<Screen, string> = {
  board: '보드',
  drills: '드릴',
  present: '시연',
  settings: '설정',
};

/** 헤더 기본 타이틀·부제. 드릴이나 전술판이 로드되면 화면이 §7.6 이하 헤더 컨텍스트로 실제
 *  제목을 덮어쓴다 — 여기 값은 아직 아무 화면도 헤더를 채우지 않았을 때의 대체값이다.
 *  §7.6 라이브 리전 발표문은 이 표가 아니라 announce.ts 의 announceFor 가 만든다 —
 *  "무엇이 열렸는가" 는 화면 키만으로는 말할 수 없기 때문이다(계획서 2.4). */
export const SCREEN_TITLES: Record<Screen, string> = {
  board: '전술판',
  drills: '드릴 라이브러리',
  present: '시연 모드',
  settings: '설정',
};

export const SCREEN_SUBTITLES: Record<Screen, string> = {
  board: '',
  drills: '저장된 드릴을 열어 편집하거나 시연하세요',
  present: '팀 앞에서 드릴을 단계별로 보여주세요',
  settings: '앱 동작과 팀 기본값',
};
