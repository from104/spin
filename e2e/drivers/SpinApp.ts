// SpinApp — 시나리오가 앱을 다루는 유일한 창구(드라이버 중립 인터페이스). docs/PLAN-TEST-SUITE.md §4.
//
// 시나리오(e2e/scenarios/*.ts)는 이 인터페이스만 안다 — Playwright 를 import 하지 않는다(결정 4).
// 같은 시나리오를
//   - 웹 빌드: PlaywrightApp (e2e/drivers/PlaywrightApp.ts)
//   - Tauri 데스크톱: WebdriverIO/tauri-driver 어댑터 (뒤 단계)
//   - Android: Playwright `_android` 어댑터 (뒤 단계)
// 에서 그대로 돌리기 위해서다. 드라이버마다 할 수 있는 일이 달라서, 시나리오는 필요한 능력을
// `needs` 로 밝히고 드라이버는 `capabilities` 로 가진 능력을 밝힌다. 모자라면 실행기가 건너뛰고
// 그 이유를 보고서에 남긴다(e2e/web/run.ts).
//
// 구조(인터페이스 + Capability + `step`)는 QCalc `feature/e2e-suite` 의 CalcApp 에서 계승했다.
import type { E2EObject } from '../../src/app/e2e/bridgeContract.ts';
import type { SeedState } from '../fixtures/seed.ts';

/** 다리가 내는 개체 하나(모델 자세) — 정의는 앱의 bridgeContract.ts 한 곳이다 */
export type CourtObject = E2EObject;

/** 화면 키 — app-shell 의 data-screen (src/app/screens.ts 의 Screen) */
export type ScreenKey = 'board' | 'drills' | 'sessions' | 'team' | 'present' | 'rules' | 'settings';

/**
 * 드라이버 능력
 * - pointer   : 마우스 포인터(누르기·끌기·휠)를 보낸다
 * - touch     : 터치 포인터(`pointerType: 'touch'`)를 보낸다 — 웹 층에서는 CDP 가 있는 Chromium 뿐
 * - keyboard  : 앱 창에 키 조합(예: 'Control+z')을 보낼 수 있다
 * - reload    : 저장소를 유지한 채 앱을 다시 띄울 수 있다(새로고침 너머 보존)
 * - resize    : 창(뷰포트) 크기를 바꿀 수 있다
 * - download  : 앱이 내려보낸 파일을 받아 열어 볼 수 있다
 * - prerender : 프리렌더 정적 페이지를 JS 이전 원문으로 읽을 수 있다
 * - netMock   : HTTP 요청을 가로채 끊거나 기록할 수 있다
 */
export type Capability = 'pointer' | 'touch' | 'keyboard' | 'reload' | 'resize' | 'download' | 'prerender' | 'netMock';

export interface SpinApp {
  /** 보고서용 이름 — 예: 'web-chromium', 'tauri-linux', 'android' */
  readonly platform: string;
  readonly capabilities: ReadonlySet<Capability>;

  /** 저장소(localStorage·sessionStorage·IndexedDB)를 비우고 state 로 채운 뒤 앱을 띄워 준비될 때까지 기다린다 */
  seed(state?: SeedState): Promise<void>;
  /** 앱 안의 주소(`/drills` 등)로 직접 진입한다 — 주소창에 친 것과 같다 */
  open(route: string): Promise<void>;
  /** 저장소를 유지한 채 앱을 다시 띄운다 (needs: reload) */
  reload(): Promise<void>;

  /** 지금 주소의 경로(`location.pathname`) */
  path(): Promise<string>;
  /** 지금 화면 키 — `app-shell[data-screen]`. 번역되지 않는 유일한 "어느 화면인가" */
  screen(): Promise<ScreenKey>;
  /** 판 위 휠체어·공·콘의 **모델** 자세(시험 다리 `window.__spinE2E`). 편집기가 안 떠 있으면 오류 */
  objects(): Promise<CourtObject[]>;
  /** 문서가 열린 뒤 쌓인 콘솔 오류·잡히지 않은 예외(한 줄씩) */
  errors(): Promise<string[]>;
  /** 외부(127.0.0.1 밖)로 나가려다 끊긴 요청 주소 — 앱이 몰래 바깥을 부르면 여기 남는다 (needs: netMock) */
  blockedRequests(): Promise<string[]>;
  /** 코트 무대의 화면 크기(px). 무대가 없으면 null */
  courtSize(): Promise<{ width: number; height: number } | null>;

  /** 보고서에 단계로 남긴다 — Playwright 는 test.step, 다른 드라이버는 그냥 실행 */
  step<T>(title: string, body: () => Promise<T>): Promise<T>;
}
