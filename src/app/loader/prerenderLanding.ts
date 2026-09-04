// 이번 페이지 로드가 **프리렌더 페이지에 착지했는가** — 부팅 로더 면제 판정
// (PLAN-0-6-3-LOADER-NOTICE 결정 13).
//
// 검색으로 `/ja/rules/two-on-one` 같은 주소에 들어온 사람은 **이미 읽을 것을 보고 있다.**
// 그 글을 1.5초 스플래시로 덮는 것은 후퇴이고, LCP 도 본문이 아니라 로더 마크로 바뀐다.
// 라우트 이름(`nav.screen === 'rules'`)이 아니라 "지금 화면에 이미 읽을 것이 그려져 있는가" 를
// 보는 쪽이 정확하다 — 같은 rules 화면이라도 앱 안에서 이동해 온 것은 덮을 것이 없기 때문이다.
//
// ⚠️ **읽는 시점이 계약이다.** `createRoot().render()` 가 `#root` 의 자식을 통째로 지우므로,
// 이 모듈은 `main.tsx` 가 `createRoot` 를 부르기 **전에** 평가돼야 한다(모듈 최상위 1회 판정 =
// import 시점 평가). 이 상수를 함수로 바꾸거나 지연 평가로 옮기면 판정이 항상 false 가 되고,
// 그 실패는 조용하다 — 프리렌더 33장이 스플래시에 덮이는데 에러는 안 난다.
//
// SSR·테스트처럼 `document` 가 없는 환경에서는 false 다(면제 없음 = 평소 경로).

/** 프리렌더 본문(`.seo-prerender`)이 깔린 채로 이번 로드가 시작됐는가. 모듈 최상위 1회 판정. */
export const LANDED_ON_PRERENDER: boolean =
  typeof document !== 'undefined' && document.querySelector('.seo-prerender') !== null;
