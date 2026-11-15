// app 층의 Playwright globalSetup — 격리 데스크톱을 실행마다 한 번 띄우고 그 좌표를 E2E_APP_* 환경변수로 워커에 넘긴다.
// 돌려주는 함수가 거둔다. Linux: Xvfb + 사설 D-Bus(env-linux.ts). Windows: CI 러너의 데스크톱(env-windows.ts).
// docs/PLAN-TEST-SUITE.md §11. (QCalc `feature/e2e-suite` 의 e2e/app/global-setup.ts 각색)
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { missingTools as missingLinux, startLinuxEnv } from './env-linux.ts';
import { missingTools as missingWindows, startWindowsEnv } from './env-windows.ts';
import { DEFAULT_BINARY, isWindows, type AppEnv } from './platform.ts';
import { AppSession } from './session.ts';

/** test-results/ 의 로그 끝부분 — 오류 문구용 */
function tail(file: string, lines = 15): string {
  try {
    const text = readFileSync(file, 'utf8').trimEnd();
    return text ? text.split(/\r?\n/).slice(-lines).join('\n') : '(비었음)';
  } catch {
    return '(없음)';
  }
}

/**
 * 연기 시험: 시험 전에 WebDriver 세션을 한 번 연다(= 앱을 한 번 띄운다). 못 열면 모든 시험이 저마다의 시간 초과 뒤에
 * 같은 꼴로 실패한다(QCalc 첫 Windows CI: POST /session 65 × 30초, 34분) — 그 대신 층 전체를 지금 멈추고 드라이버 로그를 보인다.
 */
async function smokeSession(env: AppEnv, binary: string, out: string): Promise<void> {
  const session = new AppSession({ driverPort: env.driverPort, driverPid: env.driverPid, binary, profile: env.profile });
  const started = Date.now();
  try {
    await session.launch();
  } catch (error) {
    const logs = isWindows ? ['app-driver.log', 'app-driver-stderr.log', 'app-msedgedriver.log'] : ['app-driver.log', 'app-driver-stderr.log'];
    await session.close().catch(() => undefined);
    await env.stop().catch(() => undefined);
    throw new Error(
      `[app] 연기 시험: WebDriver 세션을 못 열었다(앱 띄우기, ${Math.round((Date.now() - started) / 1000)}s) — ` +
        `시험마다 같은 꼴로 실패하는 대신 app 층을 여기서 멈춘다.\n${String(error).split('\n')[0]}\n` +
        logs.map((log) => `--- test-results/${log} (끝) ---\n${tail(path.join(out, log))}`).join('\n'),
      { cause: error },
    );
  }
  console.log(`[app] 연기 시험: WebDriver 세션 ${((Date.now() - started) / 1000).toFixed(1)}s 만에 열림 (${session.origin})`);
  await session.close();
  // 시험들은 첫 설치 프로필을 기대한다(연기 실행이 이미 WebKit 저장소를 썼다)
  session.wipeProfile();
}

export default async function globalSetup(): Promise<() => Promise<void>> {
  if (process.platform !== 'linux' && !isWindows) throw new Error(`app 층은 아직 Linux·Windows 만 돈다 (호스트: ${process.platform})`);
  const binary = path.resolve(process.env.E2E_APP_BINARY ?? DEFAULT_BINARY);
  if (!existsSync(binary)) throw new Error(`앱 바이너리가 없다: ${binary} — 먼저: node e2e/app/build.mjs`);
  const missing = isWindows ? missingWindows() : missingLinux();
  if (missing.length) throw new Error(`app 층에 없는 것: ${missing.join(', ')}`);

  const out = path.resolve('test-results');
  const env: AppEnv = isWindows ? await startWindowsEnv({ logDir: out }) : await startLinuxEnv({ logDir: out });
  Object.assign(process.env, {
    E2E_APP_BINARY: binary,
    E2E_APP_DRIVER_PORT: String(env.driverPort),
    E2E_APP_DRIVER_PID: String(env.driverPid),
    E2E_APP_PROFILE: JSON.stringify(env.profile),
    E2E_APP_SESSION_ENV: JSON.stringify(env.env),
  });
  console.log(`[app] ${env.describe}`);
  await smokeSession(env, binary, out);

  return async () => {
    const { orphans } = await env.stop();
    writeFileSync(path.join(out, 'app-orphans.json'), JSON.stringify(orphans) + '\n');
    if (orphans.length) console.warn(`[app] 프로세스 나무를 벗어난 것을 끝냈다: ${orphans.join(', ')}`);
  };
}
