// `?e2e=1` — 자동 시험 모드 판정의 단일 출처. docs/PLAN-TEST-SUITE.md §3·결정 5.
//
// 이 플래그가 하는 일은 **하나뿐이다**: 편집기 트리 안에 읽기 전용 다리(`window.__spinE2E`,
// src/app/e2e/installE2EBridge.ts)를 세운다. 첫 실행 잡음(로더·안내·투어·소리·언어)을 끄지 않는다 —
// 그것들은 이미 prefs 도장으로 제어되므로 시험은 상태를 **심어서** 지운다(e2e/fixtures/seed.ts).
// ⚠️ 이 플래그에 "기능을 끄는" 분기를 붙이지 마라. 그 순간 시험이 보는 길과 이용자가 받는 길이
//    갈라져 배송 경로가 사각지대가 된다(AGENTS.md §6 `loaderMinMs` 의 교훈). 유일하게 예정된 예외는
//    app 층 단계의 데스크톱 업데이트 확인(`useDesktopUpdate.ts`)이다(계획 §3 표).
//
// 판정은 모듈 최상위에서 **한 번** 한다. 쿼리는 첫 진입 주소에만 붙어 있고 앱 안 이동(router.navigate)·
// 새로고침 주소에서는 사라지므로, 본 순간 sessionStorage 에 걸쇠를 건다 — 같은 탭 안에서는 계속 켜져
// 있고 탭을 닫으면 사라진다. `file:`(해시 라우터)에서는 `index.html?e2e=1#/` 로 준다.
const LATCH_KEY = 'spin.e2e';

function detect(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (new URLSearchParams(window.location.search).get('e2e') === '1') {
      window.sessionStorage.setItem(LATCH_KEY, '1');
      return true;
    }
    return window.sessionStorage.getItem(LATCH_KEY) === '1';
  } catch {
    // sessionStorage 를 막은 브라우저(프라이빗 모드 일부) — 시험 모드는 이용자에게 없는 것이 기본이다
    return false;
  }
}

export const E2E_MODE: boolean = detect();
