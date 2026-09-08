// §6.8 경로 ↔ 화면 대응의 **단일 출처** (구조 개편 C4, 2026-08-18 기현님 확정 — 질문 20문 ⑫).
//
// react-router 를 들이면서 "화면 키 + NavTarget" 이라는 기존 어휘는 그대로 두고, 그것을
// 해시 경로로 접고 펴는 순수 함수 둘만 만들었다 — useAppHistory(어댑터)·테스트가 공유한다.
// 여기가 갈라지면 go() 가 만든 주소를 새로고침이 못 읽는다.
//
// **[2026-09-02 뒤집힘] 왜 해시 라우터였는가**: 배포가 정적 파일 복사(vhost)라 SPA fallback
// 재작성 규칙이 없다 — BrowserRouter 는 `/drills` 새로고침에서 404 다. URL 공유가 제품
// 시나리오에 없으므로 (§6.8 원 근거 그대로) 해시의 미관 비용은 0 이고, 무설정이 정답이다.
//
// ⬆ **이 근거는 지금 둘 다 죽었다** — 근거를 지우지 않고 남기는 이유는, 다음 사람이 "왜 굳이
// 해시였지" 를 다시 파헤치지 않게 하기 위해서다.
//   ① *fallback 이 없다* — 있다. 배포처 vhost 에 `FallbackResource /index.html` 이 있고
//      `/library` 가 200 으로 뜬다(2026-09-01 실측). 이 전제는 AWS vhost 를 세운 날 죽었고
//      아무도 눈치채지 못한 채 남아 있었다.
//   ② *URL 공유가 제품 시나리오에 없다* — 검색 유입을 목표로 잡은 날 죽었다. 해시 뒤는
//      구글이 URL 로 세지 않아서, 규칙 해설 27장(9주제 × 3언어)이 통째로 색인 밖이었다.
// 지금은 BrowserRouter 이고, `file:`(Tauri·로컬 파일)만 해시로 남는다 — 거기서는 ①이 아직
// 참이다. 라우터 선택은 App.tsx 의 `createAppRouter`, 언어 접두사는 localePrefix.ts 가 쥔다.
//
// 경로 표 (C4 기초 + C5 세션 1급 합류):
//   /                      전술판 (자유 보드)          screen 'board' + {kind:'board'}
//   /drills                드릴 목록                    screen 'drills'
//   /sessions              세션 목록                    screen 'sessions'
//   /sessions/:sessionId   세션 편집 (C6)               screen 'sessions' + {kind:'session'}
//   /team                  팀 목록                      screen 'team'
//   /team/:teamId          팀 상세                      screen 'team' + {kind:'team'}
//   /drills/:drillId       드릴 편집                    screen 'board' + {kind:'drill'}
//   /present/drill/:id     드릴 시연                    screen 'present'
//   /present/session/:id   세션 시연                    screen 'present'
//   /present               시연 (대상 없음 — 빈 상태)
//   /rules                 규칙 카드 홈                  screen 'rules'
//   /rules/:topic          규칙 주제 상세(딥링크)         screen 'rules' + {kind:'rule', topic}
//   /rules/law-:N          (관용) 옛 조항 딥링크          위와 동일, topic:'rulebook' 으로 흡수
//   /rules/contested       (관용) 폐기된 옛 주제           위와 동일, topic:'restarts' 로 흡수
//   /settings              설정
//   /settings/privacy      개인정보처리방침              screen 'settings' + {kind:'legal', doc}
//   /settings/terms        서비스 약관                   위와 동일
//   /privacy · /terms      (관용) 공개·색인용 주소         위로 흡수 — 한 방향(아래 주석)
//   /s/:id                 공유 링크 착지                 screen 'drills' + {kind:'share', id}
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
      // C5 — 세션은 1급 화면이 됐다. 옛 "드릴 화면의 세션 탭/드로어" 대상은 세션 화면으로 접는다.
      if (target?.kind === 'session') return `/sessions/${target.id}`;
      if (target?.kind === 'tab' && target.tab === 'sessions') return '/sessions';
      // 공유 링크 착지(PLAN-SHARE-LINK 결정 9) — 새 화면을 만들지 않고 라이브러리 화면 위에
      // 가져오기 시트를 얹는다(`/privacy` 가 설정으로 접히는 것과 같은 수법).
      // ⚠️ **열쇠(`#` 뒤)는 여기 없다.** 프래그먼트는 라우터의 관할이 아니라(react-router 의
      //    location.hash 는 라우팅에 안 쓰인다) UI 가 `location.hash` 에서 직접 읽는다 —
      //    그래야 열쇠가 history state·prerender·SEO 어디에도 새지 않는다. 이 함수가 만드는
      //    주소에 열쇠가 없는 것은 누락이 아니라 계약이다(링크 전체는 share/link.ts 가 만든다).
      if (target?.kind === 'share') return `/s/${target.id}`;
      return '/drills';
    case 'sessions':
      // C6 — 세션 대상 = 전용 편집 화면(드릴의 /drills/:id 와 같은 꼴. 드로어 시절의 ?open= 은퇴)
      return target?.kind === 'session' ? `/sessions/${target.id}` : '/sessions';
    case 'team':
      // 세션의 목록↔상세와 같은 꼴(위 'sessions'). 단수 `/team` 인 것은 의도다 — 이 화면은
      // "팀들" 이 아니라 **[팀] 메뉴**이고, 레일 라벨(한국어 '팀')과 주소가 같은 말을 한다.
      return target?.kind === 'team' ? `/team/${target.id}` : '/team';
    case 'present':
      if (target?.kind === 'drill') return `/present/drill/${target.id}`;
      if (target?.kind === 'session') return `/present/session/${target.id}`;
      return '/present';
    case 'rules':
      return target?.kind === 'rule' ? `/rules/${target.topic}` : '/rules';
    case 'settings':
      // 법적 고지 문서는 설정의 하위 주소다(결정 1) — 앱 안에서 만들어지는 주소는 이 꼴
      // **하나뿐**이다. 공개 주소 `/privacy` 는 parsePath 가 받기만 하고 여기서 만들지
      // 않는다(그래야 헤더의 [← 설정으로] 가 어디로 되접을지가 한 가지로 정해진다).
      return target?.kind === 'legal' ? `/settings/${target.doc}` : '/settings';
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
      // C4 한 커밋 동안 쓰인 옛 쿼리 꼴 관용 — 세션 화면으로 접는다.
      const session = params.get('session');
      if (session) return { screen: 'sessions', target: { kind: 'session', id: session } };
      if (params.get('tab') === 'sessions') return { screen: 'sessions' };
      return { screen: 'drills' };
    }
    case 'sessions': {
      if (seg.length >= 2 && seg[1]!.length > 0) return { screen: 'sessions', target: { kind: 'session', id: seg[1]! } };
      const open = params.get('open'); // C5 한 커밋 동안의 드로어 주소 꼴 관용
      if (open) return { screen: 'sessions', target: { kind: 'session', id: open } };
      return { screen: 'sessions' };
    }
    case 'team': {
      if (seg.length >= 2 && seg[1]!.length > 0) return { screen: 'team', target: { kind: 'team', id: seg[1]! } };
      return { screen: 'team' };
    }
    case 'present': {
      if (seg[1] === 'drill' && seg[2]) return { screen: 'present', target: { kind: 'drill', id: seg[2] } };
      if (seg[1] === 'session' && seg[2]) return { screen: 'present', target: { kind: 'session', id: seg[2] } };
      return { screen: 'present' };
    }
    case 'rules': {
      if (!seg[1]) return { screen: 'rules' };
      // 관용: 2026-08-21 딥링크 형식(/rules/law-N) — 재설계 전 주소를 부록 주제로 흡수한다
      // (과거 형식을 되살리는 게 아니라, 남아 있을 수 있는 링크가 죽지 않게 하는 것뿐).
      if (/^law-\d+$/.test(seg[1])) return { screen: 'rules', target: { kind: 'rule', topic: 'rulebook' } };
      // 관용: 2026-08-31 9카드 개편에서 폐기된 주제(contested) — 그 콘텐츠가 간 곳(restarts)으로
      // 흡수한다. 없으면 북마크가 404 도 없이 조용히 카드 홈으로 떨어진다.
      if (seg[1] === 'contested') return { screen: 'rules', target: { kind: 'rule', topic: 'restarts' } };
      return { screen: 'rules', target: { kind: 'rule', topic: seg[1] } };
    }
    case 'settings': {
      // 결정 1 — 법적 고지는 설정 화면 안의 대상이다(새 화면 키를 만들지 않는다).
      const doc = seg[1];
      if (doc === 'privacy' || doc === 'terms') return { screen: 'settings', target: { kind: 'legal', doc } };
      // 모르는 하위 조각(`/settings/xyz`)은 그냥 설정이다 — 화면 단위로 축소한 "404 없음"
      // 교리(RulesScreen 이 모르는 주제에서 카드 홈으로 떨어지는 것과 같은 꼴).
      return { screen: 'settings' };
    }
    // 관용(**한 방향**): 검색엔진·구글 콘솔에 이미 나가 있는 공개 주소. 결정 4 — `robots.txt`
    // 가 `/settings` 를 통째로 막으므로 색인용 URL 은 `/privacy/`·`/terms/` 로 남기고, 사람이
    // 거기 착지하면 앱이 같은 문서를 앱 틀 안(설정 하위)에서 이어 보여 준다. 반대 방향은
    // 만들지 않는다(pathFor 는 `/settings/privacy` 만 낳는다) — 옛 `/rules/law-N` 흡수와 같은
    // 이유다: 주소를 되살리는 게 아니라 이미 나간 링크가 안 죽게 하는 것뿐.
    // 공유 링크 착지(PLAN-SHARE-LINK 결정 9). 화면은 라이브러리('drills')이고, 위에 뜨는
    // 가져오기 시트가 `location.hash` 의 열쇠로 내용을 연다.
    // ⚠️ id 꼴을 **여기서는 안 본다**(share/link.ts 는 본다). 오타 한 글자짜리 링크를 여기서
    //    떨구면 대문으로 조용히 떨어져 "링크가 없거나 만료됐습니다" 라는 알맞은 문구를 볼
    //    기회조차 없어진다 — 판정은 서버가 404 로 한다.
    case 's': {
      if (seg.length >= 2 && seg[1]!.length > 0) return { screen: 'drills', target: { kind: 'share', id: seg[1]! } };
      return { screen: 'drills' };
    }
    case 'privacy':
      return { screen: 'settings', target: { kind: 'legal', doc: 'privacy' } };
    case 'terms':
      return { screen: 'settings', target: { kind: 'legal', doc: 'terms' } };
    default:
      return { screen: 'board', target: { kind: 'board' } };
  }
}
