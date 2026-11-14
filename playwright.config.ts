// Playwright — 운영 웹 빌드(dist/)를 로컬 정적 서버로 띄워 시나리오를 돌린다. docs/PLAN-TEST-SUITE.md §1·§2.
//
//   npm run test:e2e                              # 3개 프로젝트 전부
//   npm run test:e2e -- --project=webkit-desktop
//   E2E_REBUILD=1 npm run test:e2e                # dist/ 강제 재빌드
//
// 대상이 dev 서버가 아니라 **운영 빌드**인 이유(결정 3): 프리렌더 페이지·청크 분할·`FallbackResource
// /index.html` 셋은 빌드에만 있다. 빌드가 낡았는지는 serve.mjs 가 입력 지문으로 판정한다.
//
// 프로젝트 셋(결정 2) — 셋 다 실제 셸의 근사다(실기 대체가 아니다, 계획 §9):
//   chromium-desktop  1280×800(src-tauri/tauri.conf.json 기본 창) ≈ Windows WebView2
//   webkit-desktop    1280×800 ≈ Linux WebKitGTK · Safari. 터치 에뮬레이션이 없어 마우스만
//   chromium-mobile   Pixel 7 세로·터치 ≈ Android WebView. 작은 화면 안내 + 좁은 배치 + 코트 90° 회전이
//                     한꺼번에 서는 최악 조건이다
import { defineConfig, devices } from '@playwright/test';

import type { E2EOptions } from './e2e/fixtures/test.ts';

// QCalc 의 4178 과 겹치지 않게 4179 — 두 저장소의 스위트를 한 기계에서 동시에 돌 수 있다
const PORT = Number(process.env.E2E_PORT || 4179);
const DESKTOP_VIEWPORT = { width: 1280, height: 800 };

export default defineConfig<E2EOptions>({
  testDir: './e2e/web',
  testMatch: '**/*.spec.ts',
  outputDir: 'test-results/e2e-artifacts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0, // 흔들리는 시험은 숨기지 않고 드러낸다(결정 7)
  ...(process.env.CI ? { workers: 2 } : {}),
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: [
    ['list'],
    ['junit', { outputFile: 'test-results/e2e-junit.xml' }],
    ['json', { outputFile: 'test-results/e2e-report.json' }],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    // 언어 자동 감지가 시드(language: 'ko')와 같은 답을 내게 한다 — fresh 프로필도 한국어로 뜬다
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
  },
  webServer: {
    command: 'node e2e/support/serve.mjs',
    url: `http://127.0.0.1:${PORT}/index.html`,
    env: { E2E_PORT: String(PORT) },
    timeout: 300_000, // 빌드가 필요하면 그 시간까지
    reuseExistingServer: false, // 낡은 빌드를 내주는 서버를 재사용하지 않는다
    stdout: 'ignore',
    stderr: 'pipe',
  },
  projects: [
    {
      name: 'chromium-desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: DESKTOP_VIEWPORT,
        capabilities: ['pointer', 'keyboard', 'reload', 'resize', 'download', 'prerender', 'netMock'],
      },
    },
    {
      name: 'webkit-desktop',
      use: {
        ...devices['Desktop Safari'],
        viewport: DESKTOP_VIEWPORT,
        capabilities: ['pointer', 'keyboard', 'reload', 'resize', 'download', 'prerender', 'netMock'],
      },
    },
    {
      // 터치는 CDP `Input.dispatchTouchEvent` 로 보낸다 — WebKit 에는 그 길이 없어 touch 는 여기만 갖는다
      name: 'chromium-mobile',
      use: {
        ...devices['Pixel 7'],
        capabilities: ['touch', 'keyboard', 'reload', 'netMock'],
      },
    },
  ],
});
