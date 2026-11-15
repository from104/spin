// Playwright 를 **app 층**의 실행기로 — 실제 Tauri 데스크톱 앱을 WebDriver 로 다룬다(tauri-driver + e2e/drivers/WdioApp.ts).
// Playwright 는 브라우저를 띄우지 않는다. 안내: e2e/README.md 「app 층」, 정본 docs/PLAN-TEST-SUITE.md §11.
//
//   scripts/test-suite.sh --layer app                 # 필요하면 빌드 + 이 OS 에서 돌기
//   npm run test:e2e:app -- -g "S4"                   # 돌기만 (바이너리가 있어야 한다: node e2e/app/build.mjs)
//   scripts/test-suite.sh --layer app --artifact v0.6.13   # 배송된 AppImage·릴리스 검사(§12)
// (QCalc `feature/e2e-suite` 의 playwright.app.config.ts 각색)
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/app',
  // 산출물 모드(§12, E2E_APP_ARTIFACT — scripts/test-suite.sh --artifact)는 배송된 AppImage 와 그 릴리스만, 아니면 구운 바이너리의 전부
  testMatch: process.env.E2E_APP_ARTIFACT ? 'artifact.spec.ts' : ['native.spec.ts', 'shared.spec.ts'],
  outputDir: 'test-results/app-artifacts',
  globalSetup: './e2e/app/global-setup.ts',
  // 앱 창 하나, 디스플레이 하나: 시험은 하나씩
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0, // 흔들리는 시험은 숨기지 않고 드러낸다(결정 7)
  timeout: 60_000,
  reporter: [
    ['list'],
    ['junit', { outputFile: 'test-results/app-junit.xml' }],
    ['json', { outputFile: 'test-results/app-report.json' }],
    ['html', { outputFolder: 'test-results/app-html-report', open: 'never' }],
  ],
  // 프로젝트 이름 = 호스트의 드라이버 플랫폼(e2e/app/platform.ts APP_PLATFORM)
  projects: [{ name: process.platform === 'win32' ? 'tauri-windows' : 'tauri-linux' }],
});
