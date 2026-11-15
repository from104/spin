// app 층의 Playwright `test` — 워커 하나에 앱 프로세스 하나(workers: 1)를 브라우저처럼 시험끼리 재사용하고, 시험마다
// 시드는 이동으로 심는다(WdioApp.seed). 시험이 앱을 끄거나 창 크기를 바꿀 수 있다 — 시험이 끝날 때마다 픽스처가 다음
// 시험이 떠 있는 앱·기본 창에서 시작하게 만든다. docs/PLAN-TEST-SUITE.md §11.
// (QCalc `feature/e2e-suite` 의 e2e/app/fixtures.ts 각색 — 클립보드 도우미·AT-SPI 능력 탐침은 뺐다)
import { test as base } from '@playwright/test';

import type { Capability } from '../drivers/SpinApp.ts';
import { APP_PLATFORM, isWindows, type ProfileDirs } from './platform.ts';
import { AppSession } from './session.ts';
import { TauriApp } from './tauri-app.ts';

/**
 * pointer·keyboard: WebDriver 입력 동작(WebKit 이 GTK 이벤트로 합성) · reload: 새로고침·재실행 · xwindow: Xvfb 의 X 창(Linux 만 —
 * Windows 러너의 화면 크기·DPI 는 우리가 정할 수 없어 창 크기를 단언하지 않는다).
 * 없는 것: touch(마우스뿐) · resize(앱 최소 900×600 아래로 못 줄인다 — 웹 시나리오의 휴대폰 크기를 정직하게 못 만든다) ·
 * netMock(요청 가로채기 없음) · download(저장은 네이티브 대화 상자) · prerender(웹 층의 몫)
 */
// relaunch: 끄고 같은 저장소로 다시 띄우기 — Windows 는 msedgedriver 가 세션마다 WebView2 를 새 임시 프로필로 띄워 없다
//   (2026-11-15 CI 진단, session.ts launch 의 주석). 같은 세션 안 새로고침 보존은 S8a·S8b 가 Windows 에서도 본다.
export const TAURI_CAPABILITIES: Capability[] = isWindows
  ? ['pointer', 'keyboard', 'reload']
  : ['pointer', 'keyboard', 'reload', 'xwindow', 'relaunch'];

/** 빌드의 정적 파일 — 앱과 같은 출처지만 앱 스크립트가 돌지 않는다(시드 자리). public/favicon-32.png */
export const BLANK_PATH = '/favicon-32.png';

interface Worker {
  tauri: {
    session: AppSession;
    /** 새 프로필로 처음 뜬 창의 웹뷰 크기 — 시험이 창을 바꿨는지 가르는 기준 */
    baseline: { width: number; height: number };
    profile: ProfileDirs;
    sessionEnv: NodeJS.ProcessEnv;
  };
}

const required = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} 가 없다 — app 층은 playwright.app.config.ts(globalSetup)로 돌린다`);
  return value;
};

export const test = base.extend<{ app: TauriApp }, Worker>({
  tauri: [
    // oxlint 의 react-hooks 규칙이 관례 이름 `use` 를 React 훅으로 읽는다 — e2e/fixtures/test.ts 와 같은 까닭으로 provide
    // oxlint-disable-next-line no-empty-pattern -- 의존이 없는 워커 픽스처
    async ({}, provide) => {
      const profile = JSON.parse(required('E2E_APP_PROFILE')) as ProfileDirs;
      const sessionEnv = JSON.parse(required('E2E_APP_SESSION_ENV')) as NodeJS.ProcessEnv;
      const session = new AppSession({
        driverPort: Number(required('E2E_APP_DRIVER_PORT')),
        driverPid: Number(required('E2E_APP_DRIVER_PID')),
        binary: required('E2E_APP_BINARY'),
        exe: required('E2E_APP_EXE'),
        profile,
      });
      await session.launch();
      const baseline = await session.wd.execute(() => ({ width: window.innerWidth, height: window.innerHeight }));
      await provide({ session, profile, sessionEnv, baseline });
      await session.close();
    },
    { scope: 'worker' },
  ],

  app: async ({ tauri }, provide, testInfo) => {
    if (!tauri.session.isRunning()) await tauri.session.relaunch();
    const app = new TauriApp({
      platform: APP_PLATFORM,
      capabilities: TAURI_CAPABILITIES,
      blankPath: BLANK_PATH,
      session: tauri.session,
      profile: tauri.profile,
      sessionEnv: tauri.sessionEnv,
      step: (title, body) => test.step(title, body),
    });
    await provide(app);

    const failed = testInfo.status !== testInfo.expectedStatus;
    if (failed) {
      if (tauri.session.isRunning()) {
        const png = await app.screenshotPng().catch(() => null);
        if (png) await testInfo.attach('screenshot', { body: png, contentType: 'image/png' });
      } else {
        testInfo.annotations.push({ type: 'app-exited', description: '시험 뒤 앱 프로세스가 떠 있지 않았다' });
      }
      await testInfo.attach('app.log (끝)', { body: app.appLog(), contentType: 'text/plain' });
    }
    // 다음 시험을 위해 기본 창의 떠 있는 앱을 남긴다
    let reset = !tauri.session.isRunning();
    if (!reset) {
      const size = await app.innerSize().catch(() => null);
      reset = !size || size.width !== tauri.baseline.width || size.height !== tauri.baseline.height;
    }
    if (reset) await tauri.session.relaunch({ fresh: true });
  },
});
