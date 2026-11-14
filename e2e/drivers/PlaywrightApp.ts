// PlaywrightApp — SpinApp 을 Playwright Page 위에 구현한 드라이버(웹 빌드용). docs/PLAN-TEST-SUITE.md §4.
//
// 선택자는 `data-testid`·기존 투어 닻(`data-tut`)·개체 id(`#obj-<id>`)만 쓴다. aria-label·보이는 문구는
// 번역되므로 선택자로 쓰지 않는다(계획 §4 「선택자」).
//
// 준비 판정: 부팅 마크(`#spin-boot`, index.html 이 첫 픽셀에 그린다)가 걷히고 `app-shell` 이 섰고 로더가
// 덮고 있지 않을 때(`aria-busy` 없음 — 덮인 동안 열은 `inert` 라 누르기가 안 먹는다)이고, 로더 덮개
// (`.spin-loader`)가 퇴장 페이드까지 끝나 DOM 에서 빠졌을 때다 — 첫 실행 대화 상자들의 게이트는 `aria-busy`
// 가 아니라 이 "걷힘"(AppShell 의 coverSettled) 뒤에 판정한다. 넷 다 React 만 만든다/걷는다.
//
// 앱 주소에는 `?e2e=1` 을 붙인다 → 편집기 트리에 읽기 전용 다리(`window.__spinE2E`)가 선다. 쿼리는 앱이
// sessionStorage 걸쇠로 기억하므로(src/core/e2eMode.ts) 앱 안 이동·새로고침 뒤에도 켜져 있다.
//
// ── 좌표(계획 §4, 결정 6) ──────────────────────────────────────────────────────────────────
// 코트 점 `{u,v}` 는 `court-field`(경기면 사각형)의 getBBox() 비율로 월드 좌표가 되고, `court-world`
// (회전 변환이 걸린 <g>)의 getScreenCTM() 으로 화면 좌표가 된다. 줌·팬(viewBox)·90° 회전·UI 배율
// (`#spin-scale` 의 CSS transform)이 전부 브라우저가 계산한 행렬 안에 있다 — 앱은 jsdom 때문에 CTM 을
// 일부러 안 쓰므로(useStageMetrics.ts) 이 행렬은 앱 산술과 **독립인 판정자**다.
// ⚠️ CTM 이 조상의 CSS transform 을 반영하는지는 엔진마다 다를 수 있다(계획 §8 위험 2) — 3단계 첫 작업으로
//    세 프로젝트에서 "CTM 으로 푼 경기면 네 모서리의 외접 상자 == court-field 의 getBoundingClientRect" 를
//    UI 배율 100%·150% 에서 실증했다(e2e/scenarios/court.ts 의 S4 가 매 회차 같은 대조를 되풀이한다).
//
// ── 입력 ──────────────────────────────────────────────────────────────────────────────
// 마우스(`pointer` 능력)는 page.mouse. 터치(`touch` 능력)는 CDP `Input.dispatchTouchEvent` 로 보낸다 —
// 그래야 앱이 받는 포인터가 `pointerType: 'touch'` 다(page.mouse 는 터치 기기 에뮬레이션에서도 마우스다).
// WebKit 에는 CDP 가 없어 touch 능력은 chromium-mobile 만 갖는다.
import { readFile } from 'node:fs/promises';

import { test, type BrowserContext, type CDPSession, type Locator, type Page } from '@playwright/test';

import type {
  Capability,
  CourtObject,
  CourtPoint,
  DownloadedFile,
  ModalLog,
  AnchorProbe,
  PrerenderedPage,
  PlaceOptions,
  PointerTarget,
  ScreenKey,
  ScreenPoint,
  SpinApp,
  StepState,
  TrayKind,
  WorldPoint,
} from './SpinApp.ts';
import { isCourtPoint } from './SpinApp.ts';
import { applySeed, seedPayload, type SeedState } from '../fixtures/seed.ts';

/** 같은 출처의 빈 문서 — 앱을 띄우기 전에 저장소를 심는 자리 (e2e/support/serve.mjs 가 내준다) */
const BLANK_PATH = '/__e2e__/blank';

/** 화면이 다 서기를 기다리는 상한 — 손을 뗀 뒤 체이스(최대 4초)와 정착 상한을 넉넉히 덮는다 */
const SETTLE_TIMEOUT_MS = 10_000;

/** 앱 주소에 `e2e=1` 을 붙인다(이미 있으면 그대로). 해시는 뒤에 둔다 — `file:` 해시 라우터 꼴과 같다 */
function withE2E(route: string): string {
  const [beforeHash, hash = ''] = route.split('#');
  const [pathname, query = ''] = beforeHash!.split('?');
  const params = new URLSearchParams(query);
  params.set('e2e', '1');
  return `${pathname}?${params.toString()}${hash ? `#${hash}` : ''}`;
}

/**
 * 문서마다 먼저 심는 감시자 — aria-modal 대화 상자가 서고 지는 것을 DOM 변이마다 센다(S3 첫 방문 순서).
 * 변이 관찰자는 한 작업(task) 안의 변이를 묶어 받으므로, 같은 flush 에서 섰다 진 것은 못 본다 — 그것은
 * 화면에 그려지지도 않으므로 "어느 순간에도" 의 뜻에 맞는다. 직렬화되어 들어가므로 바깥 변수를 쓰지 않는다.
 */
export function installModalWatch(): void {
  const log = { max: 0, order: [] as string[], overlaps: [] as string[], underLoader: [] as string[], loaderSeen: false };
  (window as unknown as { __e2eModals: typeof log }).__e2eModals = log;
  const scan = () => {
    const dialogs = Array.from(document.querySelectorAll('[aria-modal="true"]'));
    const ids = dialogs.map((d) => d.getAttribute('data-testid') ?? 'unnamed');
    if (ids.length > log.max) log.max = ids.length;
    if (ids.length > 1) {
      const key = ids.join('+');
      if (!log.overlaps.includes(key)) log.overlaps.push(key);
    }
    const busy = !!document.querySelector('[aria-busy="true"]');
    if (document.querySelector('.spin-loader')) log.loaderSeen = true;
    for (const id of ids) {
      if (log.order.includes(id)) continue;
      log.order.push(id);
      if (busy) log.underLoader.push(id);
    }
  };
  new MutationObserver(scan).observe(document, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['aria-modal', 'aria-busy', 'class'],
  });
}

export interface PlaywrightAppOptions {
  platform: string;
  capabilities: Iterable<Capability>;
  /** 네트워크 픽스처가 끊은 주소가 쌓이는 배열(e2e/fixtures/network.ts) */
  blocked: string[];
}

export class PlaywrightApp implements SpinApp {
  readonly platform: string;
  readonly capabilities: ReadonlySet<Capability>;
  readonly page: Page;
  readonly context: BrowserContext;
  private readonly blocked: string[];
  private readonly errorLog: string[] = [];
  private cdp: CDPSession | null = null;

  constructor(page: Page, context: BrowserContext, options: PlaywrightAppOptions) {
    this.page = page;
    this.context = context;
    this.platform = options.platform;
    this.capabilities = new Set(options.capabilities);
    this.blocked = options.blocked;
    page.on('console', (msg) => {
      if (msg.type() === 'error') this.errorLog.push(`console: ${msg.text().split('\n')[0]}`);
    });
    page.on('pageerror', (error) => this.errorLog.push(`pageerror: ${String(error.message).split('\n')[0]}`));
  }

  private get touch(): boolean {
    return this.capabilities.has('touch');
  }

  private async waitReady(): Promise<void> {
    await this.page
      .waitForFunction(
        () =>
          !document.getElementById('spin-boot') &&
          !!document.querySelector('[data-testid="app-shell"]') &&
          !document.querySelector('[aria-busy="true"]') &&
          !document.querySelector('.spin-loader'),
        undefined,
        { timeout: 10_000 },
      )
      .catch((error: unknown) => {
        throw new Error(
          `앱이 준비되지 않음(${this.page.url()}) — 부팅 마크·app-shell·로더 덮개 중 하나: ${String(error).split('\n')[0]}`,
        );
      });
    await this.layoutStable();
  }

  /**
   * 레이아웃이 다 섰다 — 글꼴이 다 들어오고 화면 본문·코트 무대의 상자가 연속 두 프레임 같다.
   * 부팅 직후 글꼴이 늦게 들어오며 머리띠 높이가 바뀌어 무대가 4~5px 밀린다(chromium-mobile 실측 — 준비
   * 판정 뒤 60ms 까지 움직였다). 그 사이에 화면 점을 계산하고 누르면 손끝이 엇나가 앱 버그처럼 보인다.
   */
  private async layoutStable(): Promise<void> {
    await this.page
      .evaluate(async () => {
        await document.fonts.ready;
        const box = () =>
          ['#main', '[data-testid="court-stage"]']
            .map((sel) => document.querySelector(sel)?.getBoundingClientRect())
            .map((r) => (r ? `${r.x},${r.y},${r.width},${r.height}` : '-'))
            .join('|');
        const frames = () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        const deadline = performance.now() + 5_000;
        let prev = box();
        for (;;) {
          await frames();
          const next = box();
          if (next === prev) return;
          if (performance.now() > deadline) throw new Error(`레이아웃이 5초 안에 멈추지 않음 — 마지막 ${next}`);
          prev = next;
        }
      })
      .catch((error: unknown) => {
        throw new Error(`레이아웃 대기 실패(${this.page.url()}): ${String(error).split('\n')[0]}`);
      });
  }

  async seed(state?: SeedState): Promise<void> {
    await this.page.goto(BLANK_PATH);
    await this.page.evaluate(applySeed, seedPayload(state));
    await this.open(state?.route ?? '/');
  }

  async open(route: string): Promise<void> {
    await this.page.goto(withE2E(route));
    await this.waitReady();
  }

  async reload(): Promise<void> {
    await this.page.reload();
    await this.waitReady();
  }

  async path(): Promise<string> {
    return this.page.evaluate(() => location.pathname);
  }

  async screen(): Promise<ScreenKey> {
    const key = await this.page.locator('[data-testid="app-shell"]').getAttribute('data-screen', { timeout: 2_000 });
    return key as ScreenKey;
  }

  async objects(): Promise<CourtObject[]> {
    return this.page.evaluate(() => {
      const bridge = window.__spinE2E;
      if (!bridge) throw new Error('시험 다리(window.__spinE2E)가 없다 — 편집기가 안 떠 있거나 ?e2e=1 이 빠졌다');
      return bridge.objects();
    });
  }

  async errors(): Promise<string[]> {
    return [...this.errorLog];
  }

  async blockedRequests(): Promise<string[]> {
    return [...this.blocked];
  }

  async courtSize(): Promise<{ width: number; height: number } | null> {
    // 기다리지 않고 지금 값을 읽는다 — 기다림은 시나리오의 eventually 가 진다(없으면 30초 시험 제한까지 매달린다)
    return this.page.evaluate(() => {
      const el = document.querySelector('[data-testid="court-stage"]');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { width: r.width, height: r.height };
    });
  }

  async rectOf(testId: string): Promise<{ left: number; top: number; right: number; bottom: number } | null> {
    return this.page.evaluate((id) => {
      const el = document.querySelector(`[data-testid="${id}"]`);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    }, testId);
  }

  async openDrillCard(index: number): Promise<void> {
    // 카드의 첫 단추가 [열기]다(DrillCard·DrillRow 공통) — 기존 투어 닻 data-tut="library-card"
    const card = this.page.locator('[data-tut="library-card"]').nth(index).locator('button').first();
    await card.waitFor({ state: 'visible', timeout: 10_000 });
    await this.activate(card);
    await this.page.waitForFunction(() => window.__spinE2E?.surface === 'drill', undefined, { timeout: 10_000 });
    await this.waitReady();
  }

  async saveBoardAsDrill(): Promise<void> {
    await this.activate(this.page.locator('[data-tut="header-primary"]'));
    // 이름 칸이 첫 초점이다(SaveAsDrillDialog 의 initialFocusRef) — Enter 가 기본 이름으로 확정한다
    await this.page.waitForFunction(() => document.activeElement?.closest('[aria-modal="true"] form') != null);
    await this.page.keyboard.press('Enter');
    await this.page.waitForFunction(() => window.__spinE2E?.surface === 'drill', undefined, { timeout: 10_000 });
    await this.waitReady();
  }

  // ─── 코트 ────────────────────────────────────────────────────────────

  async courtRot(): Promise<0 | 90> {
    const rot = await this.page.locator('[data-testid="court-stage"]').getAttribute('data-rot', { timeout: 2_000 });
    return rot === '90' ? 90 : 0;
  }

  async courtToScreen(pt: CourtPoint): Promise<ScreenPoint> {
    return this.page.evaluate(({ u, v }) => {
      const field = document.querySelector<SVGGraphicsElement>('[data-testid="court-field"]');
      const world = document.querySelector<SVGGraphicsElement>('[data-testid="court-world"]');
      const ctm = world?.getScreenCTM();
      if (!field || !ctm) throw new Error('court-field/court-world 가 없다 — 편집기가 안 떠 있다');
      const b = field.getBBox();
      const p = new DOMPoint(b.x + u * b.width, b.y + v * b.height).matrixTransform(ctm);
      return { x: p.x, y: p.y };
    }, pt);
  }

  async worldToScreen(pt: WorldPoint): Promise<ScreenPoint> {
    return this.page.evaluate(({ x, y }) => {
      const ctm = document.querySelector<SVGGraphicsElement>('[data-testid="court-world"]')?.getScreenCTM();
      if (!ctm) throw new Error('court-world 가 없다 — 편집기가 안 떠 있다');
      const p = new DOMPoint(x, y).matrixTransform(ctm);
      return { x: p.x, y: p.y };
    }, pt);
  }

  async objectCenter(id: string): Promise<ScreenPoint | null> {
    return this.page.evaluate((objId) => {
      const el = document.getElementById(`obj-${objId}`);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }, id);
  }

  async objectBox(id: string): Promise<{ left: number; top: number; right: number; bottom: number } | null> {
    return this.page.evaluate((objId) => {
      const el = document.getElementById(`obj-${objId}`);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    }, id);
  }

  private async toScreen(target: PointerTarget): Promise<ScreenPoint> {
    return isCourtPoint(target) ? this.courtToScreen(target) : target;
  }

  private async session(): Promise<CDPSession> {
    if (!this.cdp) this.cdp = await this.context.newCDPSession(this.page);
    return this.cdp;
  }

  private async touchEvent(type: 'touchStart' | 'touchMove' | 'touchEnd', at?: ScreenPoint): Promise<void> {
    const cdp = await this.session();
    await cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: at ? [{ x: at.x, y: at.y, id: 1 }] : [],
    });
  }

  async tap(target: PointerTarget): Promise<void> {
    const at = await this.toScreen(target);
    if (this.touch) {
      await this.touchEvent('touchStart', at);
      await this.touchEvent('touchEnd');
    } else {
      await this.page.mouse.click(at.x, at.y);
    }
  }

  async wheel(target: PointerTarget, deltaY: number): Promise<void> {
    const at = await this.toScreen(target);
    await this.page.mouse.move(at.x, at.y);
    await this.page.mouse.wheel(0, deltaY);
  }

  async doubleTap(target: PointerTarget): Promise<void> {
    const at = await this.toScreen(target);
    await this.tap(at);
    await this.tap(at);
  }

  async drag(from: PointerTarget, to: PointerTarget, { steps = 12 }: { steps?: number } = {}): Promise<void> {
    const a = await this.toScreen(from);
    const b = await this.toScreen(to);
    const at = (k: number): ScreenPoint => ({ x: a.x + ((b.x - a.x) * k) / steps, y: a.y + ((b.y - a.y) * k) / steps });
    // 이동 사이에 한 프레임씩 쉰다 — 앱은 pointermove 를 rAF 로 흘려보내므로(§6.3) 한 프레임에 몰아 보내면
    // 실제 손과 다른 "순간이동" 이 된다. 프레임 대기는 시간이 아니라 브라우저의 다음 페인트라 고정 sleep 이 아니다.
    const frame = () => this.page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
    if (this.touch) {
      await this.touchEvent('touchStart', a);
      for (let k = 1; k <= steps; k++) {
        await frame();
        await this.touchEvent('touchMove', at(k));
      }
      // 사람 손가락은 놓을 자리에서 멈췄다가 뗀다. 움직이던 속도 그대로 떼면 브라우저 제스처 인식기가 플링으로
      // 읽고, 플링이 도는 동안의 **다음 탭은 플링 멈춤으로 먹혀 click 이 안 난다**(chromium-mobile 실측:
      // 트레이 끌기 직후 [드릴로 편집] 탭이 무반응). 멈춘 채 몇 프레임 머문 뒤 뗀다 — 속도 추적기는 마지막
      // 움직임 뒤 일정 시간(수십 ms) 새 표본이 없으면 손이 멈춘 것으로 본다. 두 프레임으로는 모자랐다(실측).
      for (let k = 0; k < 8; k++) await frame();
      await this.touchEvent('touchEnd');
    } else {
      await this.page.mouse.move(a.x, a.y);
      await this.page.mouse.down();
      for (let k = 1; k <= steps; k++) {
        await frame();
        const p = at(k);
        await this.page.mouse.move(p.x, p.y);
      }
      await frame();
      await this.page.mouse.up();
    }
  }

  private trayItem(kind: TrayKind, options: Pick<PlaceOptions, 'team'>): Locator {
    const id = kind === 'chair' ? `tray-item-chair-${options.team ?? 'home'}` : kind === 'cone' ? 'tray-item-cone-0' : 'tray-item-ball';
    return this.page.locator(`[data-testid="${id}"]`).first();
  }

  async placeFromTray(kind: TrayKind, at: CourtPoint, options: PlaceOptions): Promise<string> {
    const before = new Set((await this.objects()).map((o) => o.id));
    const item = this.trayItem(kind, options);
    await item.waitFor({ state: 'visible' });
    if (options.via === 'tap') {
      await this.pickFromTray(kind, options);
      await this.tap(at);
    } else {
      // 사람이 하듯 칩이 보이게 트레이를 굴린 뒤, 누를 자리에 정말 그 칩이 있는지 확인한다 — 머리띠 등에 가려진
      // 칩의 bbox 를 누르면 엉뚱한 단추가 눌리고 "놓았는데 안 생겼다" 로만 보인다(UI 배율 150% 탐침에서 겪었다)
      await item.scrollIntoViewIfNeeded();
      const box = await item.boundingBox();
      if (!box) throw new Error(`트레이 칩(${kind})이 화면에 없다`);
      const from = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      const hit = await item.evaluate((el, p) => el.contains(document.elementFromPoint(p.x, p.y)), from);
      if (!hit) throw new Error(`트레이 칩(${kind})이 다른 요소에 가려져 있다 — 누를 자리 (${from.x.toFixed(0)}, ${from.y.toFixed(0)})`);
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
    const deadline = Date.now() + SETTLE_TIMEOUT_MS;
    let last = '';
    for (;;) {
      const r = await this.page.evaluate(async () => {
        const bridge = window.__spinE2E;
        if (!bridge) return { ok: false, why: '다리 없음' };
        if (bridge.busy) return { ok: false, why: 'busy' };
        const a = JSON.stringify(bridge.objects());
        await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        if (bridge.busy) return { ok: false, why: 'busy' };
        return JSON.stringify(bridge.objects()) === a ? { ok: true, why: '' } : { ok: false, why: '자세가 바뀌는 중' };
      });
      if (r.ok) return;
      last = r.why;
      if (Date.now() > deadline) throw new Error(`화면이 ${SETTLE_TIMEOUT_MS}ms 안에 서지 않음 — 마지막 사유: ${last}`);
    }
  }

  // ─── 편집 ────────────────────────────────────────────────────────────

  private async activate(target: Locator): Promise<void> {
    if (this.touch) await target.tap();
    else await target.click();
  }

  async undo(): Promise<void> {
    await this.activate(this.page.locator('[data-testid="fn-undo"]'));
  }

  async redo(): Promise<void> {
    await this.activate(this.page.locator('[data-testid="fn-redo"]'));
  }

  async openStepList(): Promise<void> {
    const toggle = this.page.locator('[data-testid="step-list-toggle"]');
    if ((await toggle.count()) === 0) return; // 펼침 배치 — 늘 보인다
    if ((await toggle.getAttribute('aria-expanded')) !== 'true') await this.activate(toggle);
    await this.page.locator('[data-testid="step-card"]').first().waitFor({ state: 'visible' });
  }

  /** 좁은·세로 창에서는 스텝 목록이 접혀 [스텝 목록 열기] 뒤에 있다(StepSidebar 접힘 모드) — 사람이 하듯 열고,
   *  일을 마치면 닫는다(열린 목록은 코트를 덮는 오버레이라 그대로 두면 다음 끌기가 목록 위에서 시작한다).
   *  닫기는 **바깥 탭**으로 한다 — 같은 단추로 닫는 길은 열린 목록에 가려져 있다(S7b 가 붙잡은 앱 버그). */
  private async withStepList(body: () => Promise<void>): Promise<void> {
    const toggle = this.page.locator('[data-testid="step-list-toggle"]');
    if ((await toggle.count()) === 0) return body(); // 펼침 배치 — 늘 보인다
    await this.openStepList();
    await body();
    if ((await toggle.getAttribute('aria-expanded')) === 'true') {
      // 바깥 = 덮개(`data-sidebar-backdrop`, 기존 속성)가 맨 위이고 **그 아래에 누를 것이 없는** 점. 덮개는
      // pointerdown 에서 닫히므로, 터치의 뒤늦은 click 이 덮개가 사라진 자리 아래 단추에 떨어진다(S7c 가 붙잡은
      // 앱 버그 — 실측으로 [보드 설정]이 열렸다). 그래서 아래가 단추·입력이 아닌 점을 격자로 훑어 고른다.
      const outside = await this.page.evaluate(() => {
        const backdrop = document.querySelector<HTMLElement>('[data-sidebar-backdrop]');
        if (!backdrop) return null;
        const r = backdrop.getBoundingClientRect();
        const interactive = 'button, a, input, select, textarea, [role="button"], [role="radio"], [role="switch"]';
        for (let fy = 0.5; fy < 1; fy += 0.1) {
          for (let fx = 0.9; fx > 0; fx -= 0.1) {
            const x = r.x + r.width * fx;
            const y = r.y + r.height * fy;
            if (document.elementFromPoint(x, y) !== backdrop) continue;
            backdrop.style.pointerEvents = 'none';
            const beneath = document.elementFromPoint(x, y);
            backdrop.style.pointerEvents = '';
            if (!beneath?.closest(interactive)) return { x, y };
          }
        }
        return null;
      });
      if (!outside) throw new Error('스텝 목록 바깥(덮개)을 누를 자리가 없다');
      await this.tap(outside);
    }
    await this.page.waitForFunction(() => !document.querySelector('[data-testid="step-card"]'));
  }

  async addStep(): Promise<void> {
    // 맨 뒤 틈의 [+] — 기존 투어 닻(2026-08-30 부터 스텝을 늘리는 유일한 길)
    await this.withStepList(() => this.activate(this.page.locator('[data-tut="editor-add-step"] button').first()));
  }

  async selectStep(index: number): Promise<void> {
    await this.withStepList(() => this.activate(this.page.locator('[data-testid="step-card"]').nth(index)));
  }

  async togglePlay(): Promise<void> {
    await this.activate(this.page.locator('[data-testid="play-toggle"]'));
  }

  async stepState(): Promise<StepState> {
    return this.page.evaluate(() => {
      const bridge = window.__spinE2E;
      if (!bridge) throw new Error('시험 다리(window.__spinE2E)가 없다');
      return { stepIndex: bridge.stepIndex, stepCount: bridge.stepCount, playing: bridge.playing };
    });
  }

  async autosave(): Promise<string> {
    return this.page.evaluate(() => {
      const bridge = window.__spinE2E;
      if (!bridge) throw new Error('시험 다리(window.__spinE2E)가 없다');
      return bridge.autosave;
    });
  }

  async pressKey(chord: string): Promise<void> {
    await this.page.keyboard.press(chord);
  }

  async resize(width: number, height: number): Promise<void> {
    await this.page.setViewportSize({ width, height });
    // 레이아웃·회전 판정은 resize 이벤트 뒤 React 커밋으로 따라온다 — 무대 크기가 새 창에 맞을 때까지 기다린다
    await this.page.waitForFunction(
      ([w, h]) => window.innerWidth === w && window.innerHeight === h,
      [width, height] as const,
    );
    await this.layoutStable();
  }

  // ─── 대화 상자 ───────────────────────────────────────────────────────

  async dialogs(): Promise<string[]> {
    return this.page.evaluate(() =>
      Array.from(document.querySelectorAll('[aria-modal="true"]')).map((d) => d.getAttribute('data-testid') ?? 'unnamed'),
    );
  }

  async centerOf(testId: string): Promise<ScreenPoint | null> {
    const box = await this.page.locator(`[data-testid="${testId}"]`).first().boundingBox();
    return box ? { x: box.x + box.width / 2, y: box.y + box.height / 2 } : null;
  }

  async onTop(testId: string): Promise<boolean> {
    return this.page.evaluate((id) => {
      const el = document.querySelector(`[data-testid="${id}"]`);
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
    }, testId);
  }

  async present(testId: string): Promise<boolean> {
    return (await this.page.locator(`[data-testid="${testId}"]`).count()) > 0;
  }

  async htmlLang(): Promise<string> {
    return this.page.evaluate(() => document.documentElement.lang);
  }

  async uiStrings(): Promise<{ text: string[]; names: string[] }> {
    return this.page.evaluate(() => {
      const visible = (el: Element): boolean => {
        for (let n: Element | null = el; n; n = n.parentElement) {
          const s = getComputedStyle(n);
          if (s.display === 'none' || s.visibility === 'hidden') return false;
        }
        return true;
      };
      const text: string[] = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const s = (n.textContent ?? '').replace(/\s+/g, ' ').trim();
        const p = n.parentElement;
        if (s && p && !['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(p.tagName) && visible(p)) text.push(s);
      }
      const names: string[] = [];
      for (const el of Array.from(document.body.querySelectorAll('[aria-label], [title], [placeholder], [alt]'))) {
        if (!visible(el)) continue;
        for (const attr of ['aria-label', 'title', 'placeholder', 'alt']) {
          const v = el.getAttribute(attr);
          if (v) names.push(v);
        }
      }
      return { text, names };
    });
  }

  async rootText(): Promise<string> {
    return this.page.evaluate(() => document.getElementById('root')?.innerText ?? '');
  }

  async prerendered(route: string): Promise<PrerenderedPage> {
    const res = await this.context.request.get(route);
    const html = await res.text();
    const lang = /<html[^>]*\blang="([^"]*)"/.exec(html)?.[1] ?? '';
    const block = /<div class="seo-prerender"([^>]*)>([\s\S]*?)<\/div><\/div>/.exec(html);
    const seoPage = block ? (/data-seo-page="([^"]*)"/.exec(block[1]!)?.[1] ?? null) : null;
    const inner = block?.[2] ?? '';
    const h1 = (/<h1[^>]*>([\s\S]*?)<\/h1>/.exec(inner)?.[1] ?? '').replace(/<[^>]*>/g, '').trim();
    return { status: res.status(), lang, seoPage, h1, textChars: inner.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().length };
  }

  async viewportSize(): Promise<{ width: number; height: number }> {
    return this.page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }));
  }

  async anchor(name: string): Promise<AnchorProbe | null> {
    return this.page.evaluate((anchor) => {
      const all = document.querySelectorAll(`[data-tut="${anchor}"]`);
      const el = all[0];
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return {
        count: all.length,
        rect: { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height },
        inViewport: r.width > 0 && r.height > 0 && r.left >= 0 && r.top >= 0 && r.right <= window.innerWidth && r.bottom <= window.innerHeight,
        onTop: !!top && el.contains(top),
      };
    }, name);
  }

  async pressAnchor(name: string): Promise<void> {
    await this.activate(this.page.locator(`[data-tut="${name}"]`).first());
  }

  async horizontalOverflow(): Promise<number> {
    return this.page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth);
  }

  async modalLog(): Promise<ModalLog> {
    return this.page.evaluate(() => {
      const log = (window as unknown as { __e2eModals?: ModalLog }).__e2eModals;
      if (!log) throw new Error('대화 상자 감시자가 없다(e2e/fixtures/test.ts 의 addInitScript)');
      return JSON.parse(JSON.stringify(log)) as ModalLog;
    });
  }

  async press(testId: string): Promise<void> {
    await this.activate(this.page.locator(`[data-testid="${testId}"]`));
  }

  async checkNoticeOptOut(): Promise<void> {
    await this.activate(this.page.locator('[data-testid="small-screen-notice"] input[type="checkbox"]'));
  }

  async download(trigger: () => Promise<void>): Promise<DownloadedFile> {
    // Chromium 에는 저장 대화 상자(File System Access `showSaveFilePicker`)가 있고 앱은 그 길을 먼저 탄다
    // (src/storage/files.ts `downloadBlob`). 헤드리스에는 그 대화 상자를 띄울 OS 창이 없어 호출이 영영 안 돌아온다.
    // 그래서 **대화 상자 함수 하나만** 바꿔 끼워 "사람이 자리를 고르고 [저장] 을 눌렀다" 를 흉내 낸다 — 앱의 저장 코드
    // (createWritable → write → close)는 그대로 돌고, 쓰인 바이트를 그 자리에서 거둔다. 대화 상자가 없는 엔진
    // (WebKit)은 앱이 앵커 내려받기로 가므로 브라우저의 download 사건을 받는다.
    const viaPicker = await this.page.evaluate(() => {
      const w = window as unknown as { showSaveFilePicker?: unknown; __e2eSaved?: { name: string; b64: string } };
      if (typeof w.showSaveFilePicker !== 'function') return false;
      w.__e2eSaved = undefined;
      w.showSaveFilePicker = async (opts?: { suggestedName?: string }) => ({
        createWritable: async () => {
          const parts: BlobPart[] = [];
          return {
            write: async (data: BlobPart) => void parts.push(data),
            close: async () => {
              const bytes = new Uint8Array(await new Blob(parts).arrayBuffer());
              let bin = '';
              for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
              w.__e2eSaved = { name: opts?.suggestedName ?? '', b64: btoa(bin) };
            },
          };
        },
      });
      return true;
    });
    if (viaPicker) {
      await trigger();
      const saved = await this.page.waitForFunction(
        () => (window as unknown as { __e2eSaved?: { name: string; b64: string } }).__e2eSaved,
        null,
        { timeout: 15_000 },
      );
      const { name, b64 } = (await saved.jsonValue()) as { name: string; b64: string };
      return { name, bytes: new Uint8Array(Buffer.from(b64, 'base64')) };
    }
    // 기다림을 먼저 건다 — 누른 뒤에 걸면 빨리 끝난 내려받기를 놓친다. 상한은 굽기(2048px 캔버스)를 넉넉히 덮는다
    const [file] = await Promise.all([this.page.waitForEvent('download', { timeout: 15_000 }), trigger()]);
    const failure = await file.failure();
    if (failure) throw new Error(`내려받기 실패: ${failure}`);
    return { name: file.suggestedFilename(), bytes: new Uint8Array(await readFile(await file.path())) };
  }

  step<T>(title: string, body: () => Promise<T>): Promise<T> {
    return test.step(title, body);
  }
}
