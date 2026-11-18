// WdioApp — SpinApp 을 W3C WebDriver 세션 위에 구현한 드라이버(실제 데스크톱 앱용). docs/PLAN-TEST-SUITE.md §11.
//
//   tauri-driver → WebKitWebDriver(Linux) / msedgedriver(Windows) → Tauri 웹뷰
//
// 이름은 QCalc `feature/e2e-suite` 의 WdioApp 을 따랐지만 WebdriverIO 는 안 쓴다 — 노드 fetch 위의 최소 클라이언트
// (e2e/drivers/webdriver.ts, 거기 머리말에 이유). 판정(준비·정착·좌표·가림)은 PlaywrightApp 과 **같은 페이지 함수**
// (e2e/drivers/page-functions.ts)를 쓴다 — 웹과 앱의 차이가 판정의 차이가 아니라 앱의 차이이게.
//
// 웹 드라이버와 다른 점
// - 누르기·끌기는 WebDriver 포인터 동작(진짜 입력 이벤트 — WebKit 이 GTK 이벤트로 합성)이다. 누를 자리는 페이지 안에서
//   "보이고·멈췄고·자기 중심에서 맨 위" 일 때까지 기다려 잰다(hitPointInPage) — Playwright 의 click() 이 하는 판정이다.
// - 요청 가로채기가 없다 → `netMock` 없음. 문서보다 먼저 심는 스크립트(addInitScript)도 없다 → 대화 상자 첫 방문 기록
//   (`modalLog`)이 없고, 콘솔 오류는 **준비된 뒤부터** 문서 안 기록기로 모은다(`errors()` — 부팅 중 오류는 못 본다).
// - 저장(download)은 네이티브 대화 상자(save_bytes_dialog)라 못 받는다. 프리렌더 원문도 웹 층의 몫이다.
// - 시드는 앱이 아닌 같은 출처 문서(`blankPath`, 빌드의 정적 파일)에서 심는다 — 앱 스크립트가 돌기 전에.
//
// 세션은 바뀔 수 있다(앱 재실행) — 세션·출처는 늘 getter 로 읽는다.
import type {
  AnchorProbe,
  Capability,
  CourtObject,
  CourtPoint,
  DownloadedFile,
  ModalLog,
  PlaceOptions,
  PointerTarget,
  PrerenderedPage,
  ScreenKey,
  ScreenPoint,
  SpinApp,
  StepState,
  TrayKind,
  WorldPoint,
  DragOptions,
} from './SpinApp.ts';
import { isCourtPoint, withE2E } from './SpinApp.ts';
import {
  anchorInPage,
  appReadyInPage,
  autosaveInPage,
  courtRotInPage,
  courtSizeInPage,
  courtToScreenInPage,
  dialogsInPage,
  focusInModalFormInPage,
  hitPointInPage,
  horizontalOverflowInPage,
  layoutStableInPage,
  nextFrameInPage,
  objectBoxInPage,
  objectCenterInPage,
  objectsInPage,
  onTopInPage,
  rectOfInPage,
  revealInPage,
  screenKeyInPage,
  settleProbeInPage,
  stepListOutsideInPage,
  stepStateInPage,
  surfaceInPage,
  uiStringsInPage,
  viewportSizeInPage,
  worldToScreenInPage,
} from './page-functions.ts';
import { KEY_CODES, type ActionSequence, type WebDriverSession } from './webdriver.ts';
import { applySeed, seedPayload, type SeedState } from '../fixtures/seed.ts';

/** 화면이 다 서기를 기다리는 상한 — PlaywrightApp 과 같다 */
// 물리 정착 상한 PHYS.settleMaxMs(20 s, 2026-11-18 공 감속 영상 실측)보다 길어야 한다 — 공이 구르는 동안은 busy 다.
const SETTLE_TIMEOUT_MS = 25_000;

export interface WdioAppOptions {
  platform: string;
  capabilities: Iterable<Capability>;
  /** 지금 WebDriver 세션 — 앱을 다시 띄우면 바뀐다 */
  session: () => WebDriverSession;
  /** 앱 문서의 출처 — Linux 'tauri://localhost', Windows 'http://tauri.localhost' */
  origin: () => string;
  /** 같은 출처이지만 앱이 아닌 문서(앱 스크립트가 안 돈다) — 저장소를 심는 자리 */
  blankPath: string;
  /** 보고서 단계 — @playwright/test 아래에서는 test.step */
  step?: <T>(title: string, body: () => Promise<T>) => Promise<T>;
}

const MODIFIERS = new Set(['Control', 'Shift', 'Alt', 'Meta']);

/** 조건이 참이 될 때까지 50ms 간격으로 다시 잰다(고정 sleep 이 아니라 조건 기다림). 읽는 중 예외는 기다리는 동안 삼킨다 */
async function until<T>(label: string, read: () => Promise<T>, ok: (v: T) => boolean, timeout: number): Promise<T> {
  const deadline = Date.now() + timeout;
  let last: T | undefined;
  let lastError: unknown;
  for (;;) {
    try {
      last = await read();
      lastError = undefined;
      if (ok(last)) return last;
    } catch (error) {
      lastError = error;
    }
    if (Date.now() > deadline) {
      const got = lastError ? `오류: ${String(lastError).split('\n')[0]}` : JSON.stringify(last);
      throw new Error(`${label}: ${timeout}ms 안에 서지 않음 — 마지막 ${got}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

/** 문서 안 오류 기록기 — 잡히지 않은 오류·거절·console.error 를 모은다. 문서마다 한 번 */
const installErrorRecorderInPage = (): void => {
  const w = window as unknown as { __e2eErrors?: string[] };
  if (w.__e2eErrors) return;
  const errors: string[] = (w.__e2eErrors = []);
  window.addEventListener('error', (e) => errors.push(`pageerror: ${String(e.message).split('\n')[0]}`));
  window.addEventListener('unhandledrejection', (e) => errors.push(`pageerror: ${String(e.reason).split('\n')[0]}`));
  const original = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    errors.push(`console: ${args.map(String).join(' ').split('\n')[0]}`);
    original(...args);
  };
};
const recordedErrorsInPage = (): string[] => (window as unknown as { __e2eErrors?: string[] }).__e2eErrors ?? [];

export class WdioApp implements SpinApp {
  readonly platform: string;
  readonly capabilities: ReadonlySet<Capability>;
  protected readonly options: WdioAppOptions;
  /** 떠난 문서들에서 거둔 오류 */
  private readonly errorLog: string[] = [];

  constructor(options: WdioAppOptions) {
    this.options = options;
    this.platform = options.platform;
    this.capabilities = new Set(options.capabilities);
  }

  get wd(): WebDriverSession {
    return this.options.session();
  }

  /** 페이지 안에서 fn(...args) — 앱 전용 시나리오도 쓴다(e2e/app/native.ts) */
  js<A extends unknown[], R>(fn: (...args: A) => R | Promise<R>, ...args: A): Promise<R> {
    return this.wd.execute(fn, ...args);
  }

  protected url(route: string): string {
    return `${this.options.origin()}${route}`;
  }

  private unsupported(what: string, capability: string): never {
    throw new Error(`${what}: 드라이버(${this.platform})에 없는 능력(${capability}) — 시나리오의 needs 에 밝혀 두면 실행기가 건너뛴다`);
  }

  // ─── 문서 ────────────────────────────────────────────────────────────

  /**
   * 문서를 떠나기 전에: 이 문서의 오류 기록을 거두고, 이 문서가 뒤로/앞으로 캐시(bfcache)에 들어가지 못하게 unload 듣개를 단다.
   * ⚠️ WebKit 은 IndexedDB 연결을 가진 문서를 bfcache 에 **연결째** 보관한다 — 그러면 다음 문서(시드의 빈 문서)의
   * `deleteDatabase` 가 성공도 `blocked` 도 없이 영영 기다린다(gofu 실측 2026-11-15: 새 프로필로 막 뜬 앱에서 시드가
   * 스크립트 상한 20초로 죽었다). unload 듣개가 있는 문서는 WebKit(iOS 밖)과 Chromium 모두 bfcache 에 넣지 않으므로
   * 문서가 정말 내려가며 연결을 닫는다. 앱을 바꾸는 스위치가 아니라 떠나는 문서에 시험이 다는 표시다.
   */
  protected async harvestErrors(): Promise<void> {
    const found = await this.js(() => {
      window.addEventListener('unload', () => undefined);
      return (window as unknown as { __e2eErrors?: string[] }).__e2eErrors ?? [];
    }).catch(() => [] as string[]);
    this.errorLog.push(...found);
  }

  protected async waitReady(): Promise<void> {
    try {
      await until('앱 준비(부팅 마크·app-shell·로더 덮개)', () => this.js(appReadyInPage), Boolean, 15_000);
      await this.js(layoutStableInPage);
    } catch (error) {
      const where = await this.wd.url().catch((e: unknown) => `(주소를 못 읽음: ${String(e).slice(0, 80)})`);
      throw new Error(`앱이 준비되지 않음(${where}) — ${String(error).split('\n')[0]}`, { cause: error });
    }
    await this.js(installErrorRecorderInPage);
  }

  /** 다른 주소로 간다 — 문서 적재가 끝날 때까지(WebDriver 의 normal 적재 전략). 주소를 다시 맞대지는 않는다:
   *  앱이 스스로 주소를 고쳐 쓴다(App.tsx 의 옛 주소 이전·AppShell 의 replaceState) */
  protected async navigate(route: string): Promise<void> {
    await this.harvestErrors();
    await this.wd.navigate(this.url(route));
  }

  async seed(state?: SeedState): Promise<void> {
    await this.seedOnBlank(state);
    await this.open(state?.route ?? '/');
  }

  private async seedOnBlank(state: SeedState | undefined, recovered = false): Promise<void> {
    await this.navigate(this.options.blankPath);
    // 정적 파일이 아니라 앱(index.html fallback)이 떴다면 거기서 심으면 앱이 먼저 저장소를 건드린다 — 그 자리에서 멈춘다
    const isApp = await this.js(() => !!document.getElementById('root'));
    if (isApp) throw new Error(`seed: ${this.options.blankPath} 가 정적 파일이 아니라 앱을 내줬다 — blankPath 를 빌드에 있는 파일로`);
    try {
      await this.js(applySeed, seedPayload(state));
    } catch (error) {
      // 지우기가 막힌 것은 앱이 아니라 시험 문서의 사정이다(앞 문서의 연결이 안 닫힘) — 한 번만 되살리고, 또 막히면 그대로 던진다
      if (recovered || !String(error).includes('SEED_DB_STUCK')) throw error;
      await this.recoverStuckSeed(String(error).split('\n')[0]);
      await this.seedOnBlank(state, true);
    }
  }

  /** 시드의 지우기가 막혔을 때 — 저장소를 쥔 프로세스를 끊어 줄 수 있는 드라이버만 되살린다. 기본은 그대로 던진다 */
  protected async recoverStuckSeed(reason: string): Promise<void> {
    throw new Error(reason);
  }

  async open(route: string): Promise<void> {
    await this.navigate(withE2E(route));
    await this.waitReady();
  }

  async reload(): Promise<void> {
    await this.harvestErrors();
    await this.wd.refresh();
    await this.waitReady();
  }

  async path(): Promise<string> {
    return this.js(() => location.pathname);
  }

  async screen(): Promise<ScreenKey> {
    return (await until('app-shell[data-screen]', () => this.js(screenKeyInPage), (v) => v !== null, 2_000)) as ScreenKey;
  }

  async objects(): Promise<CourtObject[]> {
    return this.js(objectsInPage);
  }

  async errors(): Promise<string[]> {
    return [...this.errorLog, ...(await this.js(recordedErrorsInPage).catch(() => [] as string[]))];
  }

  async blockedRequests(): Promise<string[]> {
    return this.unsupported('blockedRequests', 'netMock');
  }

  async courtSize(): Promise<{ width: number; height: number } | null> {
    return this.js(courtSizeInPage);
  }

  async rectOf(testId: string): Promise<{ left: number; top: number; right: number; bottom: number } | null> {
    return this.js(rectOfInPage, testId);
  }

  async reveal(testId: string): Promise<boolean> {
    return this.js(revealInPage, testId);
  }

  async openDrillCard(index: number): Promise<void> {
    // 카드의 첫 단추가 [열기]다(DrillCard·DrillRow 공통) — 기존 투어 닻 data-tut="library-card"
    await this.activate('[data-tut="library-card"]', { index, inner: 'button', timeout: 10_000 });
    await until('드릴 편집기', () => this.js(surfaceInPage), (s) => s === 'drill', 10_000);
    await this.waitReady();
  }

  async saveBoardAsDrill(): Promise<void> {
    await this.activate('[data-tut="header-primary"]');
    // 이름 칸이 첫 초점이다(SaveAsDrillDialog 의 initialFocusRef) — Enter 가 기본 이름으로 확정한다
    await until('이름 대화 상자의 첫 초점', () => this.js(focusInModalFormInPage), Boolean, 5_000);
    await this.pressKey('Enter');
    await until('드릴 편집기', () => this.js(surfaceInPage), (s) => s === 'drill', 10_000);
    await this.waitReady();
  }

  // ─── 코트 ────────────────────────────────────────────────────────────

  async courtRot(): Promise<0 | 90> {
    const rot = await until('court-stage[data-rot]', () => this.js(courtRotInPage), (v) => v !== null, 2_000);
    return rot === '90' ? 90 : 0;
  }

  async courtToScreen(pt: CourtPoint): Promise<ScreenPoint> {
    return this.js(courtToScreenInPage, pt);
  }

  async worldToScreen(pt: WorldPoint): Promise<ScreenPoint> {
    return this.js(worldToScreenInPage, pt);
  }

  async objectCenter(id: string): Promise<ScreenPoint | null> {
    return this.js(objectCenterInPage, id);
  }

  async objectBox(id: string): Promise<{ left: number; top: number; right: number; bottom: number } | null> {
    return this.js(objectBoxInPage, id);
  }

  private async toScreen(target: PointerTarget): Promise<ScreenPoint> {
    return isCourtPoint(target) ? this.courtToScreen(target) : target;
  }

  /** 마우스 동작 열 하나 — 좌표는 뷰포트 CSS px(정수로 반올림 — WebDriver 가 정수를 요구한다) */
  private mouse(actions: Array<Record<string, unknown>>): ActionSequence {
    return { type: 'pointer', id: 'mouse', parameters: { pointerType: 'mouse' }, actions };
  }

  private moveTo(p: ScreenPoint): Record<string, unknown> {
    return { type: 'pointerMove', origin: 'viewport', x: Math.round(p.x), y: Math.round(p.y), duration: 0 };
  }

  async tap(target: PointerTarget): Promise<void> {
    const at = await this.toScreen(target);
    await this.wd.performActions([
      this.mouse([this.moveTo(at), { type: 'pointerDown', button: 0 }, { type: 'pointerUp', button: 0 }]),
    ]);
  }

  async wheel(target: PointerTarget, deltaY: number): Promise<void> {
    const at = await this.toScreen(target);
    await this.wd.performActions([this.mouse([this.moveTo(at)])]);
    await this.wd.performActions([
      {
        type: 'wheel',
        id: 'wheel',
        actions: [{ type: 'scroll', origin: 'viewport', x: Math.round(at.x), y: Math.round(at.y), deltaX: 0, deltaY: Math.round(deltaY), duration: 0 }],
      },
    ]);
  }

  async doubleTap(target: PointerTarget): Promise<void> {
    const at = await this.toScreen(target);
    await this.tap(at);
    await this.tap(at);
  }

  async drag(from: PointerTarget, to: PointerTarget, { steps = 12, whileHeld }: DragOptions = {}): Promise<void> {
    const a = await this.toScreen(from);
    const b = await this.toScreen(to);
    const at = (k: number): ScreenPoint => ({ x: a.x + ((b.x - a.x) * k) / steps, y: a.y + ((b.y - a.y) * k) / steps });
    // 이동 사이에 한 프레임씩 쉰다(PlaywrightApp.drag 와 같은 이유 — 앱은 pointermove 를 rAF 로 흘려보낸다).
    // 입력 상태(누른 단추)는 동작 호출 사이에도 이어진다(W3C 「input state」) — 끝에 releaseActions 로 비운다
    const frame = () => this.js(nextFrameInPage);
    await this.wd.performActions([this.mouse([this.moveTo(a), { type: 'pointerDown', button: 0 }])]);
    try {
      for (let k = 1; k <= steps; k++) {
        await frame();
        await this.wd.performActions([this.mouse([this.moveTo(at(k))])]);
      }
      await frame();
      try {
        await whileHeld?.();
      } finally {
        await this.wd.performActions([this.mouse([{ type: 'pointerUp', button: 0 }])]);
      }
    } finally {
      await this.wd.releaseActions().catch(() => undefined);
    }
  }

  private trayItem(kind: TrayKind, options: Pick<PlaceOptions, 'team'>): string {
    const id = kind === 'chair' ? `tray-item-chair-${options.team ?? 'home'}` : kind === 'cone' ? 'tray-item-cone-0' : 'tray-item-ball';
    return `[data-testid="${id}"]`;
  }

  async placeFromTray(kind: TrayKind, at: CourtPoint, options: PlaceOptions): Promise<string> {
    const before = new Set((await this.objects()).map((o) => o.id));
    if (options.via === 'tap') {
      await this.pickFromTray(kind, options);
      await this.tap(at);
    } else {
      // 칩이 보이고 그 자리에서 맨 위일 때의 중심에서 끈다 — 가려진 칩의 상자를 누르면 엉뚱한 단추가 눌린다
      const from = await this.hitPoint(this.trayItem(kind, options));
      await this.drag(from, at, { steps: 16 });
    }
    await this.settled();
    const added = (await this.objects()).filter((o) => !before.has(o.id) && o.kind === kind);
    if (added.length !== 1) throw new Error(`트레이에서 ${kind} 를 놓았는데 새 개체가 ${added.length}개`);
    return added[0]!.id;
  }

  async pickFromTray(kind: TrayKind, options: Pick<PlaceOptions, 'team'> = {}): Promise<void> {
    await this.activate(this.trayItem(kind, options));
  }

  async settled(): Promise<void> {
    await until('화면 정착(다리 busy·자세 두 프레임)', () => this.js(settleProbeInPage), (r) => r.ok, SETTLE_TIMEOUT_MS);
  }

  // ─── 편집 ────────────────────────────────────────────────────────────

  /** 누를 수 있을 때까지 기다린 자리(page-functions.ts hitPointInPage) */
  private async hitPoint(selector: string, { index = 0, inner, timeout = 10_000 }: { index?: number; inner?: string; timeout?: number } = {}): Promise<ScreenPoint> {
    const r = await until(`누를 자리 ${selector}${inner ? ` ${inner}` : ''} [${index}]`, () => this.js(hitPointInPage, { selector, index, inner }), (v) => v.point !== null, timeout);
    return r.point!;
  }

  /** 사람이 누르듯 — 보이고 멈췄고 맨 위일 때 그 중심을 마우스로 누른다 */
  protected async activate(selector: string, options: { index?: number; inner?: string; timeout?: number } = {}): Promise<void> {
    await this.tap(await this.hitPoint(selector, options));
  }

  async undo(): Promise<void> {
    await this.activate('[data-testid="fn-undo"]');
  }

  async redo(): Promise<void> {
    await this.activate('[data-testid="fn-redo"]');
  }

  private async attr(selector: string, name: string): Promise<string | null> {
    return this.js(({ s, n }) => document.querySelector(s)?.getAttribute(n) ?? null, { s: selector, n: name });
  }

  private async count(selector: string): Promise<number> {
    return this.js((s) => document.querySelectorAll(s).length, selector);
  }

  async openStepList(): Promise<void> {
    const toggle = '[data-testid="step-list-toggle"]';
    if ((await this.count(toggle)) === 0) return; // 펼침 배치 — 늘 보인다
    if ((await this.attr(toggle, 'aria-expanded')) !== 'true') await this.activate(toggle);
    await this.hitPoint('[data-testid="step-card"]');
  }

  /** PlaywrightApp.withStepList 와 같다 — 접힌 목록이면 열고, 일을 마치면 바깥 탭으로 닫는다 */
  private async withStepList(body: () => Promise<void>): Promise<void> {
    const toggle = '[data-testid="step-list-toggle"]';
    if ((await this.count(toggle)) === 0) return body();
    await this.openStepList();
    await body();
    if ((await this.attr(toggle, 'aria-expanded')) === 'true') {
      const outside = await this.js(stepListOutsideInPage);
      if (!outside) throw new Error('스텝 목록 바깥(덮개)을 누를 자리가 없다');
      await this.tap(outside);
    }
    await until('스텝 목록 닫힘', () => this.count('[data-testid="step-card"]'), (n) => n === 0, 5_000);
  }

  async addStep(): Promise<void> {
    // 맨 뒤 틈의 [+] — 기존 투어 닻(2026-08-30 부터 스텝을 늘리는 유일한 길)
    await this.withStepList(() => this.activate('[data-tut="editor-add-step"]', { inner: 'button' }));
  }

  async selectStep(index: number): Promise<void> {
    await this.withStepList(() => this.activate('[data-testid="step-card"]', { index }));
  }

  async togglePlay(): Promise<void> {
    await this.activate('[data-testid="play-toggle"]');
  }

  async stepState(): Promise<StepState> {
    return this.js(stepStateInPage);
  }

  async autosave(): Promise<string> {
    return this.js(autosaveInPage);
  }

  async pressKey(chord: string): Promise<void> {
    // Playwright 표기: 'Control+z' · 'ArrowRight' · 'x'. 단독 '+' 는 키 '+'
    const parts = chord === '+' ? ['+'] : chord.split('+');
    const key = parts.pop()!;
    for (const mod of parts) if (!MODIFIERS.has(mod)) throw new Error(`pressKey: 모르는 조합키 ${mod} (${chord})`);
    const code = KEY_CODES[key] ?? (key.length === 1 ? key : undefined);
    if (!code) throw new Error(`pressKey: 모르는 키 ${key} (${chord})`);
    const down = [...parts.map((m) => KEY_CODES[m]!), code];
    await this.wd.performActions([
      {
        type: 'key',
        id: 'keyboard',
        actions: [...down.map((value) => ({ type: 'keyDown', value })), ...[...down].reverse().map((value) => ({ type: 'keyUp', value }))],
      },
    ]);
  }

  async keyDown(key: string): Promise<void> {
    await this.wd.performActions([{ type: 'key', id: 'keyboard', actions: [{ type: 'keyDown', value: this.keyValue(key) }] }]);
  }

  async keyUp(key: string): Promise<void> {
    await this.wd.performActions([{ type: 'key', id: 'keyboard', actions: [{ type: 'keyUp', value: this.keyValue(key) }] }]);
  }

  /** Playwright 표기 한 키 → WebDriver 키 값(pressKey 와 같은 표). */
  private keyValue(key: string): string {
    const code = KEY_CODES[key] ?? (key.length === 1 ? key : undefined);
    if (!code) throw new Error(`keyDown/keyUp: 모르는 키 ${key}`);
    return code;
  }

  async resize(width: number, height: number): Promise<void> {
    // 창 바깥 크기를 청한다 — 창 관리자가 없는 Xvfb 에서는 바깥 = 웹뷰다. 앱의 최소 크기(tauri.conf.json minWidth·minHeight)
    // 아래로는 GTK 가 줄이지 않으므로 'resize' 능력은 주지 않는다(웹 시나리오의 휴대폰 크기를 정직하게 못 만든다)
    await this.wd.setWindowRect({ width, height });
    await until('창 크기', () => this.js(viewportSizeInPage), (s) => s.width === width && s.height === height, 5_000);
    await this.js(layoutStableInPage);
  }

  // ─── 대화 상자 ───────────────────────────────────────────────────────

  async dialogs(): Promise<string[]> {
    return this.js(dialogsInPage);
  }

  async present(testId: string): Promise<boolean> {
    return (await this.count(`[data-testid="${testId}"]`)) > 0;
  }

  async onTop(testId: string): Promise<boolean> {
    return this.js(onTopInPage, testId);
  }

  async centerOf(testId: string): Promise<ScreenPoint | null> {
    const box = await this.rectOf(testId);
    return box ? { x: (box.left + box.right) / 2, y: (box.top + box.bottom) / 2 } : null;
  }

  async htmlLang(): Promise<string> {
    return this.js(() => document.documentElement.lang);
  }

  async uiStrings(): Promise<{ text: string[]; names: string[] }> {
    return this.js(uiStringsInPage);
  }

  async rootText(): Promise<string> {
    return this.js(() => document.getElementById('root')?.innerText ?? '');
  }

  async prerendered(_route: string): Promise<PrerenderedPage> {
    return this.unsupported('prerendered', 'prerender');
  }

  async viewportSize(): Promise<{ width: number; height: number }> {
    return this.js(viewportSizeInPage);
  }

  async anchor(name: string): Promise<AnchorProbe | null> {
    return this.js(anchorInPage, name);
  }

  async pressAnchor(name: string): Promise<void> {
    await this.activate(`[data-tut="${name}"]`);
  }

  async horizontalOverflow(): Promise<number> {
    return this.js(horizontalOverflowInPage);
  }

  async modalLog(): Promise<ModalLog> {
    // 첫 방문 기록은 앱 스크립트보다 먼저 감시자를 심어야 선다 — WebDriver classic 에는 그 길(addInitScript)이 없다
    throw new Error(`modalLog: 드라이버(${this.platform})는 문서보다 먼저 스크립트를 심을 수 없다 — 웹 층의 몫이다`);
  }

  async press(testId: string): Promise<void> {
    await this.activate(`[data-testid="${testId}"]`);
  }

  async checkNoticeOptOut(): Promise<void> {
    await this.activate('[data-testid="small-screen-notice"] input[type="checkbox"]');
  }

  async download(_trigger: () => Promise<void>): Promise<DownloadedFile> {
    return this.unsupported('download', 'download');
  }

  step<T>(title: string, body: () => Promise<T>): Promise<T> {
    return this.options.step ? this.options.step(title, body) : body();
  }
}
