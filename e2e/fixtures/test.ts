// Playwright `test` 확장 — 모든 웹 스펙은 @playwright/test 대신 이걸 쓴다. docs/PLAN-TEST-SUITE.md §2.
//
// 프로젝트별 옵션(playwright.config.ts 의 `use`)
// - capabilities : 이 프로젝트 드라이버가 가진 능력 — 시나리오 needs 와 비교해 건너뛴다
//
// 픽스처 `app` 은 외부 요청 차단을 건 PlaywrightApp 이다(앱은 아직 안 띄운 상태 — 실행기가 시나리오의
// seed 로 띄운다). QCalc 판의 `clipboardMode` 는 뺐다 — 지금 시나리오에 클립보드가 없다.
import { test as base } from '@playwright/test';

import type { Capability } from '../drivers/SpinApp.ts';
import { PlaywrightApp } from '../drivers/PlaywrightApp.ts';
import { blockExternal } from './network.ts';

export interface E2EOptions {
  capabilities: Capability[];
}

export const test = base.extend<E2EOptions & { app: PlaywrightApp }>({
  capabilities: [['pointer', 'keyboard', 'reload', 'netMock'], { option: true }],

  // 두 번째 인자를 관례 이름 `use` 로 두지 않는다 — oxlint 의 react-hooks 규칙이 React 의 `use` 훅으로 읽는다
  app: async ({ page, context, browserName, capabilities }, provide) => {
    const blocked = await blockExternal(context);
    await provide(new PlaywrightApp(page, context, { platform: `web-${browserName}`, capabilities, blocked }));
  },
});

export { expect } from '@playwright/test';
