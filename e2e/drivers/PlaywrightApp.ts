// PlaywrightApp — SpinApp 을 Playwright Page 위에 구현한 드라이버(웹 빌드용). docs/PLAN-TEST-SUITE.md §4.
//
// 선택자는 `data-testid`·기존 투어 닻(`data-tut`)·개체 id(`#obj-<id>`)만 쓴다. aria-label·보이는 문구는
// 번역되므로 선택자로 쓰지 않는다(e2e/README.md 「선택자 규칙」).
//
// 준비 판정: 부팅 마크(`#spin-boot`, index.html 이 첫 픽셀에 그린다)가 걷히고 `app-shell` 이 섰을 때다.
// 둘 다 React 만 만든다/걷는다 — 프리렌더 원문만 떠 있는 상태와 구별된다.
//
// 앱 주소에는 `?e2e=1` 을 붙인다 → 편집기 트리에 읽기 전용 다리(`window.__spinE2E`)가 선다. 쿼리는 앱이
// sessionStorage 걸쇠로 기억하므로(src/core/e2eMode.ts) 앱 안 이동·새로고침 뒤에도 켜져 있다.
import { test, type BrowserContext, type Page } from '@playwright/test';

import type { Capability, CourtObject, ScreenKey, SpinApp } from './SpinApp.ts';
import { applySeed, seedPayload, type SeedState } from '../fixtures/seed.ts';

/** 같은 출처의 빈 문서 — 앱을 띄우기 전에 저장소를 심는 자리 (e2e/support/serve.mjs 가 내준다) */
const BLANK_PATH = '/__e2e__/blank';

/** 앱 주소에 `e2e=1` 을 붙인다(이미 있으면 그대로). 해시는 뒤에 둔다 — `file:` 해시 라우터 꼴과 같다 */
function withE2E(route: string): string {
  const [beforeHash, hash = ''] = route.split('#');
  const [pathname, query = ''] = beforeHash!.split('?');
  const params = new URLSearchParams(query);
  params.set('e2e', '1');
  return `${pathname}?${params.toString()}${hash ? `#${hash}` : ''}`;
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

  private async waitReady(): Promise<void> {
    await this.page
      .waitForFunction(
        () => !document.getElementById('spin-boot') && !!document.querySelector('[data-testid="app-shell"]'),
        undefined,
        { timeout: 10_000 },
      )
      .catch((error: unknown) => {
        throw new Error(`앱이 준비되지 않음(${this.page.url()}) — 부팅 마크가 안 걷혔거나 app-shell 이 없다: ${String(error).split('\n')[0]}`);
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

  step<T>(title: string, body: () => Promise<T>): Promise<T> {
    return test.step(title, body);
  }
}
