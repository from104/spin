// PlaywrightApp — SpinApp 을 Playwright Page 위에 구현한 드라이버(웹 빌드용). docs/PLAN-TEST-SUITE.md §4.
//
// 선택자는 `data-testid`·기존 투어 닻(`data-tut`)·개체 id(`#obj-<id>`)만 쓴다. aria-label·보이는 문구는
// 번역되므로 선택자로 쓰지 않는다(e2e/README.md 「선택자 규칙」).
//
// 준비 판정: 부팅 마크(`#spin-boot`, index.html 이 첫 픽셀에 그린다)가 걷히고 화면의 `<main id="main">` 이
// 섰을 때다. 마크를 걷는 것은 React(AppShell·AppLoaderOverlay)뿐이라 프리렌더 원문만 떠 있는 상태와
// 구별된다.
import { test, type BrowserContext, type Page } from '@playwright/test';

import type { Capability, SpinApp } from './SpinApp.ts';
import { applySeed, seedPayload, type SeedState } from '../fixtures/seed.ts';

/** 같은 출처의 빈 문서 — 앱을 띄우기 전에 저장소를 심는 자리 (e2e/support/serve.mjs 가 내준다) */
const BLANK_PATH = '/__e2e__/blank';

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
      .waitForFunction(() => !document.getElementById('spin-boot') && !!document.getElementById('main'), undefined, {
        timeout: 10_000,
      })
      .catch((error: unknown) => {
        throw new Error(`앱이 준비되지 않음(${this.page.url()}) — 부팅 마크가 안 걷혔거나 <main id="main"> 이 없다: ${String(error).split('\n')[0]}`);
      });
  }

  async seed(state?: SeedState): Promise<void> {
    await this.page.goto(BLANK_PATH);
    await this.page.evaluate(applySeed, seedPayload(state));
    await this.open(state?.route ?? '/');
  }

  async open(route: string): Promise<void> {
    await this.page.goto(route);
    await this.waitReady();
  }

  async reload(): Promise<void> {
    await this.page.reload();
    await this.waitReady();
  }

  async path(): Promise<string> {
    return this.page.evaluate(() => location.pathname);
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
      const el = document.querySelector('[data-tut="editor-court"]');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { width: r.width, height: r.height };
    });
  }

  step<T>(title: string, body: () => Promise<T>): Promise<T> {
    return test.step(title, body);
  }
}
