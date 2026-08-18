// §6.8 경로 ↔ 화면 대응의 **단일 출처** (구조 개편 C4, 2026-08-18 기현님 확정 — 질문 20문 ⑫).
//
// react-router 를 들이면서 "화면 키 + NavTarget" 이라는 기존 어휘는 그대로 두고, 그것을
// 해시 경로로 접고 펴는 순수 함수 둘만 만들었다 — useAppHistory(어댑터)·테스트가 공유한다.
// 여기가 갈라지면 go() 가 만든 주소를 새로고침이 못 읽는다.
//
// **왜 해시 라우터인가**: 배포가 정적 파일 복사(vhost)라 SPA fallback 재작성 규칙이 없다 —
// BrowserRouter 는 `/drills` 새로고침에서 404 다. URL 공유가 제품 시나리오에 없으므로
// (§6.8 원 근거 그대로) 해시의 미관 비용은 0 이고, 무설정이 정답이다.
//
// 경로 표 (C4 — 기존 4화면. '/sessions' 는 2차 C5 에서 합류한다):
//   /                      전술판 (자유 보드)          screen 'board' + {kind:'board'}
//   /drills                드릴 목록                    screen 'drills' (+?tab=sessions ?session=id)
//   /drills/:drillId       드릴 편집                    screen 'board' + {kind:'drill'}
//   /present/drill/:id     드릴 시연                    screen 'present'
//   /present/session/:id   세션 시연                    screen 'present'
//   /present               시연 (대상 없음 — 빈 상태)
//   /settings              설정
//
// ⚠️ '/drills/:id' 의 화면 키가 'drills' 가 아니라 'board' 인 것은 2026-08-09 재편 그대로다:
// 자유 전술판과 드릴 편집은 같은 자리(board)에 뜨고, 무엇이 떠 있는지는 StageTarget 이 정한다.
// URL 이 그 StageTarget 의 저장소가 됐을 뿐, 화면 키의 뜻은 안 바꿨다 — railFor·announceFor·
// showHeader 판정이 전부 그 뜻 위에 서 있다.
import type { Screen } from './screens.ts';
import type { NavTarget } from './useAppHistory.ts';

export interface ParsedRoute {
  screen: Screen;
  target?: NavTarget;
}

/** 화면 키 + 대상 → 경로(해시 뒤의 pathname+search). */
export function pathFor(screen: Screen, target?: NavTarget): string {
  switch (screen) {
    case 'board':
      return target?.kind === 'drill' ? `/drills/${target.id}` : '/';
    case 'drills':
      if (target?.kind === 'session') return `/drills?session=${target.id}`;
      if (target?.kind === 'tab' && target.tab === 'sessions') return '/drills?tab=sessions';
      return '/drills';
    case 'present':
      if (target?.kind === 'drill') return `/present/drill/${target.id}`;
      if (target?.kind === 'session') return `/present/session/${target.id}`;
      return '/present';
    case 'settings':
      return '/settings';
  }
}

/** 경로 → 화면 키 + 대상. 모르는 경로는 **전술판**이다 — 대문이 안 뜨는 것이 최악이라
 *  (board.ts 의 그 교리) 404 화면을 만들지 않는다. */
export function parsePath(pathname: string, search: string = ''): ParsedRoute {
  const seg = pathname.replace(/\/+$/, '').split('/').filter(Boolean);
  if (seg.length === 0) return { screen: 'board', target: { kind: 'board' } };
  const params = new URLSearchParams(search);
  switch (seg[0]) {
    case 'drills': {
      if (seg.length >= 2 && seg[1]!.length > 0) return { screen: 'board', target: { kind: 'drill', id: seg[1]! } };
      const session = params.get('session');
      if (session) return { screen: 'drills', target: { kind: 'session', id: session } };
      if (params.get('tab') === 'sessions') return { screen: 'drills', target: { kind: 'tab', tab: 'sessions' } };
      return { screen: 'drills' };
    }
    case 'present': {
      if (seg[1] === 'drill' && seg[2]) return { screen: 'present', target: { kind: 'drill', id: seg[2] } };
      if (seg[1] === 'session' && seg[2]) return { screen: 'present', target: { kind: 'session', id: seg[2] } };
      return { screen: 'present' };
    }
    case 'settings':
      return { screen: 'settings' };
    default:
      return { screen: 'board', target: { kind: 'board' } };
  }
}
