// SpinApp — 시나리오가 앱을 다루는 유일한 창구(드라이버 중립 인터페이스). docs/PLAN-TEST-SUITE.md §4.
//
// 시나리오(e2e/scenarios/*.ts)는 이 인터페이스만 안다 — Playwright 를 import 하지 않는다(결정 4).
// 같은 시나리오를
//   - 웹 빌드: PlaywrightApp (e2e/drivers/PlaywrightApp.ts)
//   - Tauri 데스크톱: WdioApp (e2e/drivers/WdioApp.ts — tauri-driver 위 W3C WebDriver, 실제 앱 층 e2e/app)
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

/** 코트 위 점 — 경기면 사각형(`court-field`)의 0..1 비율. u 는 월드 x, v 는 월드 y 쪽이다(화면 회전과 무관).
 *  시나리오는 이것으로만 코트 자리를 말한다 — 앱 상수(PX_PER_M·여백)를 베끼지 않으려고(계획 결정 6) */
export interface CourtPoint {
  u: number;
  v: number;
}
/** 화면(클라이언트) px */
export interface ScreenPoint {
  x: number;
  y: number;
}
/** 월드(viewBox) 좌표 — 모델 자세(objects())가 이 단위다 */
export interface WorldPoint {
  x: number;
  y: number;
}
/** 누를 자리: 코트 점이거나 화면 점 */
export type PointerTarget = CourtPoint | ScreenPoint;
export const isCourtPoint = (p: PointerTarget): p is CourtPoint => 'u' in p;

/** 앱 주소에 `e2e=1` 을 붙인다(이미 있으면 그대로). 해시는 뒤에 둔다 — `file:` 해시 라우터 꼴과 같다. 두 드라이버 공통 */
export function withE2E(route: string): string {
  const [beforeHash, hash = ''] = route.split('#');
  const [pathname, query = ''] = beforeHash!.split('?');
  const params = new URLSearchParams(query);
  params.set('e2e', '1');
  return `${pathname}?${params.toString()}${hash ? `#${hash}` : ''}`;
}

export type TrayKind = 'chair' | 'ball' | 'cone';
export interface PlaceOptions {
  /** 'tap' = 트레이 칩을 눌러 들고 코트를 누른다 · 'drag' = 칩을 코트까지 끌어다 놓는다 */
  via: 'tap' | 'drag';
  /** 휠체어 팀 (기본 'home') */
  team?: 'home' | 'away';
}

/** 다리가 내는 스텝·재생 상태 */
export interface StepState {
  stepIndex: number;
  stepCount: number;
  playing: boolean;
}

/** 첫 방문 순서 기록(S3) — 문서가 열린 뒤 aria-modal 대화 상자들이 어떻게 섰는가. 드라이버가 문서마다 새로 잰다 */
export interface ModalLog {
  /** 한 순간에 함께 서 있던 aria-modal 의 최대 수 */
  max: number;
  /** 대화 상자가 처음 선 순서(data-testid, 없으면 'unnamed') */
  order: string[];
  /** 둘 이상이 함께 섰던 순간들('a+b') */
  overlaps: string[];
  /** 로더가 덮고 있는 동안(aria-busy) 처음 선 대화 상자 */
  underLoader: string[];
  /** 부팅·레일 로더 덮개(`.spin-loader`)가 한 순간이라도 DOM 에 섰는가 — 프리렌더 착지는 안 서야 한다(S2) */
  loaderSeen: boolean;
}

/** JS 를 돌리기 전의 프리렌더 정적 HTML 에서 읽은 것(S2) */
export interface PrerenderedPage {
  status: number;
  /** `<html lang>` */
  lang: string;
  /** `#root` 안 프리렌더 블록의 종류 표식(`data-seo-page`) — 블록이 없으면 null */
  seoPage: string | null;
  /** 프리렌더 블록의 첫 `<h1>` 글 */
  h1: string;
  /** 프리렌더 블록의 글자 수(태그 제외) */
  textChars: number;
}

/** 앱이 내려보낸 파일(S12) — 브라우저가 붙인 이름과 내용 */
export interface DownloadedFile {
  name: string;
  bytes: Uint8Array;
}

/** `data-tut` 닻 하나의 화면 상태(S9) — 번역되지 않는, 기존 투어 닻이다 */
export interface AnchorProbe {
  /** 그 닻을 가진 요소 수 */
  count: number;
  /** 첫 요소의 화면 상자 */
  rect: { left: number; top: number; right: number; bottom: number; width: number; height: number };
  /** 상자가 뷰포트 안에 통째로 있다 */
  inViewport: boolean;
  /** 상자 가운데에서 맨 위 요소가 이 요소(또는 그 자손)다 — 다른 것에 가려져 누를 수 없지 않다 */
  onTop: boolean;
}

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
 * - xwindow   : 앱의 네이티브 X 창(xwininfo·xprop)을 밖에서 읽을 수 있다 — 실제 앱 층의 Linux(Xvfb)만(e2e/app/native.ts)
 * - relaunch  : 앱을 끄고 **같은 저장소로** 다시 띄울 수 있다 — 실제 앱 층의 Linux 만(Windows 는 msedgedriver 가 세션마다 새 WebView2 프로필)
 */
export type Capability =
  | 'pointer'
  | 'touch'
  | 'keyboard'
  | 'reload'
  | 'resize'
  | 'download'
  | 'prerender'
  | 'netMock'
  | 'xwindow'
  | 'relaunch';

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
  /** data-testid 요소의 화면 상자(브라우저 레이아웃). 없으면 null */
  rectOf(testId: string): Promise<{ left: number; top: number; right: number; bottom: number } | null>;
  /** data-testid 요소가 스크롤 상자 안에서 잘려 있으면 보이게 굴린다(사람이 모달을 밀어 올리듯). 없으면 false */
  reveal(testId: string): Promise<boolean>;
  /** [드릴] 목록의 index 번째 카드를 열고 편집기가 설 때까지 기다린다 — 서랍이 비어 있으면 카드가 생길 때까지 기다린다 */
  openDrillCard(index: number): Promise<void>;
  /** 전술판의 머리띠 주 단추 [드릴로 편집] → 이름 대화 상자를 기본 이름으로 확정 → 새 드릴 편집기가 설 때까지.
   *  스텝·재생은 드릴에만 있다(전술판은 1스텝) — 새 드릴을 만드는 가장 짧은 사람의 길이다 (needs: keyboard) */
  saveBoardAsDrill(): Promise<void>;

  // ─── 코트 (3단계, 계획 §4) ─────────────────────────────────────────────
  /** 코트 표시 회전 — `court-stage[data-rot]` */
  courtRot(): Promise<0 | 90>;
  /** 코트 점 → 화면 점. 브라우저의 `getScreenCTM()` 으로 푼다(앱의 clientToWorld 와 독립인 판정자) */
  courtToScreen(pt: CourtPoint): Promise<ScreenPoint>;
  /** 월드 점(모델 자세) → 화면 점. 같은 CTM */
  worldToScreen(pt: WorldPoint): Promise<ScreenPoint>;
  /** 개체 `#obj-<id>` 의 실제 화면 bbox 중심. 없으면 null */
  objectCenter(id: string): Promise<ScreenPoint | null>;
  /** 개체 `#obj-<id>` 의 실제 화면 bbox. 없으면 null */
  objectBox(id: string): Promise<{ left: number; top: number; right: number; bottom: number } | null>;
  /** 누르기(포인터 능력이면 마우스, 터치 능력이면 터치) */
  tap(target: PointerTarget): Promise<void>;
  /** 마우스 휠 한 칸 묶음 — 커서를 target 에 두고 deltaY 만큼 굴린다(음수 = 위로 = 확대) (needs: pointer) */
  wheel(target: PointerTarget, deltaY: number): Promise<void>;
  /** 같은 자리를 빠르게 두 번 누른다(더블탭·더블클릭) — 앱의 더블 판정은 350ms·12px 안 두 번의 pointerdown 이다 */
  doubleTap(target: PointerTarget): Promise<void>;
  /** 끌기 — from 에서 눌러 to 까지 steps 번 나눠 옮기고 뗀다 */
  drag(from: PointerTarget, to: PointerTarget, options?: { steps?: number }): Promise<void>;
  /** 트레이에서 꺼내 코트에 놓고, 정착을 기다려 새로 생긴 개체의 id 를 돌려준다 */
  placeFromTray(kind: TrayKind, at: CourtPoint, options: PlaceOptions): Promise<string>;
  /** 트레이 칩을 눌러 들기만 한다(다음 코트 탭이 그 자리에 놓는다). 기다리지 않는다 */
  pickFromTray(kind: TrayKind, options?: Pick<PlaceOptions, 'team'>): Promise<void>;
  /** 화면이 다 섰다 — 다리 busy 가 내려가고 objects() 가 연속 두 프레임 같다. 고정 sleep 대신 이것을 기다린다 */
  settled(): Promise<void>;

  // ─── 편집 ─────────────────────────────────────────────────────────────
  undo(): Promise<void>;
  redo(): Promise<void>;
  /** 맨 뒤 틈의 [+] — 마지막 스텝을 복제해 뒤에 붙인다 */
  addStep(): Promise<void>;
  /** i 번째(0부터) 스텝 카드를 누른다 */
  selectStep(index: number): Promise<void>;
  /** 재생/일시정지 단추 */
  togglePlay(): Promise<void>;
  stepState(): Promise<StepState>;
  /** 저장소가 지금 모델을 들고 있는가 — 다리의 autosave */
  autosave(): Promise<string>;
  /** 키 조합 하나 (needs: keyboard) — Playwright 표기: 'ArrowRight', 'Control+z' */
  pressKey(chord: string): Promise<void>;
  /** 창 크기를 바꾸고 레이아웃이 따라올 때까지 기다린다 (needs: resize) */
  resize(width: number, height: number): Promise<void>;

  // ─── 대화 상자 ────────────────────────────────────────────────────────
  /** 지금 서 있는 aria-modal 대화 상자들의 data-testid */
  dialogs(): Promise<string[]>;
  /** data-testid 요소가 지금 문서에 있는가(대화 상자가 아닌 띄움 — 미세 조정 패드 등) */
  present(testId: string): Promise<boolean>;
  /** data-testid 요소가 자기 중심에서 맨 위에 있는가(다른 요소에 가려져 누를 수 없지 않은가) */
  onTop(testId: string): Promise<boolean>;
  /** 좁은 창의 접힌 스텝 목록을 연다(펼친 배치면 아무것도 안 한다). 열린 채로 둔다 */
  openStepList(): Promise<void>;
  /** data-testid 요소의 화면 중심(가려졌든 아니든). 없으면 null */
  centerOf(testId: string): Promise<ScreenPoint | null>;
  /** `<html lang>` — 언어 접두 주소·설정이 문서 언어에 닿았는가 */
  htmlLang(): Promise<string>;
  /** 화면에 보이는 글과 접근성 이름(aria-label·title·placeholder·alt) 전부 — 문서 전체(대화 상자 포함, 숨은 것 제외).
   *  언어 누수 점검용이다: 번역 키·소스 grep 이 못 보는 "렌더 결과" 의 글이다 */
  uiStrings(): Promise<{ text: string[]; names: string[] }>;
  /** `#root` 의 보이는 글(innerText) */
  rootText(): Promise<string>;
  /** 프리렌더 주소의 **JS 이전** 원문 — 페이지를 열지 않고 HTML 을 받아 읽는다 (needs: prerender) */
  prerendered(route: string): Promise<PrerenderedPage>;
  /** 뷰포트(창) 크기 — CSS px */
  viewportSize(): Promise<{ width: number; height: number }>;
  /** `data-tut` 닻의 화면 상태. 없으면 null */
  anchor(name: string): Promise<AnchorProbe | null>;
  /** `data-tut` 닻을 가진 요소(첫 것)를 누른다 */
  pressAnchor(name: string): Promise<void>;
  /** 가로로 넘치는 픽셀 — 문서가 뷰포트보다 얼마나 넓은가(0 이하면 가로 스크롤 없음) */
  horizontalOverflow(): Promise<number>;
  /** 이 문서가 열린 뒤의 대화 상자 기록 */
  modalLog(): Promise<ModalLog>;
  /** 대화 상자 안의 data-testid 단추를 누른다 */
  press(testId: string): Promise<void>;
  /** 작은 화면 안내에서 [다시 보지 않기] 를 켠다 */
  checkNoticeOptOut(): Promise<void>;
  /** trigger(앱 조작)가 내려보낸 파일 하나를 받아 이름과 바이트를 돌려준다 — 안 내려오면 오류 (needs: download) */
  download(trigger: () => Promise<void>): Promise<DownloadedFile>;

  /** 보고서에 단계로 남긴다 — Playwright 는 test.step, 다른 드라이버는 그냥 실행 */
  step<T>(title: string, body: () => Promise<T>): Promise<T>;
}
