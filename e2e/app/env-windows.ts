// Windows 의 Tauri 앱 — CI 전용(GitHub 의 windows-latest 러너, 대화형 데스크톱 세션). docs/PLAN-TEST-SUITE.md §11.
// (QCalc `feature/e2e-suite` 의 e2e/app/env-windows.ts 각색 — ⚠️ gofu 에서는 돌릴 수 없어 GitHub 러너에서만 검증된다)
//
//  - Xvfb·D-Bus 가 없다: 앱은 러너의 데스크톱에 진짜 창을 연다.
//  - tauri-driver → msedgedriver(--native-driver) → 앱(WebView2). msedgedriver 는 러너의 WebView2 런타임과 같은 판이어야
//    해서 워크플로가 msedgedriver-tool 로 받아 SPIN_E2E_NATIVE_DRIVER 에 경로를 넣는다.
//  - **데이터 격리가 안 된다**: Tauri/WebView2 는 앱 폴더를 환경변수가 아니라 Known Folder API 로 찾는다
//    (%APPDATA%\app.atit.spin = app_data_dir — secret_store 의 갱신 토큰, %LOCALAPPDATA%\app.atit.spin = WebView2 저장소).
//    그래서 CI=true(또는 SPIN_E2E_ALLOW_REAL_PROFILE=1)가 아니면 시작을 거부하고, 그 두 폴더**만** 실행 전·새 프로필
//    재실행 때·끝난 뒤 지운다.
//  - 프로세스는 PID 로 추적한다(procs-win.ts): tauri-driver 와 그 나무를 test-results/.app-run.json 에 적고
//    `taskkill /T /F /PID` 로 끝낸다.
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';

import { IDENTIFIER, type AppEnv, type ProfileDirs } from './platform.ts';
import { MARKER, describePid, isAlive, terminate } from './procs.ts';
import { listProcesses, treeOf } from './procs-win.ts';
import { freePort, waitHttp, which } from './util.ts';

/** 둑: 이 층은 앱의 진짜 사용자별 폴더를 지우므로 버리는 CI 기계에서만 돈다 */
export function assertDisposableMachine(): void {
  if (process.env.CI === 'true' || process.env.SPIN_E2E_ALLOW_REAL_PROFILE === '1') return;
  throw new Error(
    `Windows app 층은 %APPDATA%\\${IDENTIFIER} 와 %LOCALAPPDATA%\\${IDENTIFIER} 를 지운다(Tauri/WebView2 는 다른 곳으로 돌릴 수 없다) — ` +
      'CI(CI=true)에서 돌리거나, SPIN 데이터가 필요 없는 기계에서만 SPIN_E2E_ALLOW_REAL_PROFILE=1 을 준다.',
  );
}

function appDataDirs(): { config: string; data: string } {
  const config = process.env.APPDATA;
  const data = process.env.LOCALAPPDATA;
  if (!config || !data) throw new Error('%APPDATA% / %LOCALAPPDATA% 가 없다');
  return { config, data };
}

export function windowsProfile(): ProfileDirs {
  const { config, data } = appDataDirs();
  return { root: config, home: homedir(), config, data, cache: data, runtime: tmpdir() };
}

/** 앱 자기 폴더만 지운다(%APPDATA% / %LOCALAPPDATA% 의 다른 것은 안 건드린다). 앱이 안 떠 있을 때만 */
export function wipeAppData(profile: ProfileDirs = windowsProfile()): void {
  assertDisposableMachine();
  for (const base of new Set([profile.config, profile.data])) {
    const dir = path.join(base, IDENTIFIER);
    // 이중 확인: 사용자별 앱 데이터 폴더 바로 아래의 식별자 폴더가 아니면 절대 안 지운다
    if (path.basename(dir) !== IDENTIFIER || path.dirname(dir) !== base) throw new Error(`${dir} 를 지우지 않는다`);
    // WebView2 보조 프로세스가 앱보다 잠깐 더 살며 파일을 쥐고 있을 수 있다
    rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
  }
}

export function nativeDriverPath(): string | null {
  const fromEnv = process.env.SPIN_E2E_NATIVE_DRIVER;
  if (fromEnv) return existsSync(fromEnv) ? fromEnv : null;
  return which('msedgedriver');
}

export function tauriDriverPath(): string | null {
  if (process.env.TAURI_DRIVER) return process.env.TAURI_DRIVER;
  const cargoBin = path.join(homedir(), '.cargo', 'bin', 'tauri-driver.exe');
  return which('tauri-driver') ?? (existsSync(cargoBin) ? cargoBin : null);
}

/**
 * tauri-driver 는 msedgedriver 의 stdout 을 버리고 로그 옵션도 안 준다 — 세션 요청이 매달리면 흔적이 없다(QCalc 첫 CI:
 * POST /session 65번 "Request timed out", 빈 드라이버 로그). `--verbose --log-path` 를 덧붙이는 .cmd 껍데기를 대신 넘긴다.
 */
function loggedNativeDriver(nativeDriver: string, logDir: string): string {
  const wrapper = path.join(logDir, 'msedgedriver-logged.cmd');
  const log = path.join(logDir, 'app-msedgedriver.log');
  writeFileSync(wrapper, `@"${nativeDriver}" %* --verbose "--log-path=${log}"\r\n`);
  return wrapper;
}

export function missingTools(): string[] {
  const missing: string[] = [];
  if (!tauriDriverPath()) missing.push('tauri-driver (cargo install tauri-driver --locked)');
  if (!nativeDriverPath()) missing.push('WebView2 와 같은 판의 msedgedriver (SPIN_E2E_NATIVE_DRIVER=<msedgedriver.exe 경로>)');
  return missing;
}

const RUN_FILE = '.app-run.json';

/** 실행기가 죽은 뒤 test-suite.sh 가 끝낼 PID(그 PID 만, 그리고 우리 이미지 이름일 때만 — sweep-windows.mjs) */
export function recordPids(logDir: string, pids: number[]): void {
  const file = path.join(logDir, RUN_FILE);
  try {
    const run = JSON.parse(readFileSync(file, 'utf8')) as { pids?: number[] };
    run.pids = [...new Set([...(run.pids ?? []), ...pids])];
    writeFileSync(file, JSON.stringify(run) + '\n');
  } catch {
    // 실행 파일은 사고 복구용 보조일 뿐이다
  }
}

export async function startWindowsEnv({ logDir }: { logDir: string }): Promise<AppEnv> {
  assertDisposableMachine();
  const driverBin = tauriDriverPath();
  const nativeDriver = nativeDriverPath();
  if (!driverBin || !nativeDriver) throw new Error(`없음: ${missingTools().join(', ')}`);

  const token = randomUUID();
  const profile = windowsProfile();
  mkdirSync(logDir, { recursive: true });
  writeFileSync(path.join(logDir, RUN_FILE), JSON.stringify({ token, profile: null, pids: [] }) + '\n');
  wipeAppData(profile);

  const env: NodeJS.ProcessEnv = { ...process.env, [MARKER]: token };
  const log = (name: string) => openSync(path.join(logDir, `app-${name}.log`), 'w');
  const stop = async () => {
    // tauri-driver 아래 나무 전체(msedgedriver·앱·WebView2 보조)를 한 번에 찍고 끝낸다
    const tree = driver.pid ? treeOf([driver.pid]).map((p) => p.pid) : [];
    const described = new Map(listProcesses().map((p) => [p.pid, `${p.pid} ${p.name}`]));
    await terminate([...tree].reverse());
    const orphans = tree.filter(isAlive).map((pid) => described.get(pid) ?? describePid(pid));
    if (process.env.E2E_KEEP_PROFILE !== '1') {
      try {
        wipeAppData(profile);
      } catch (error) {
        console.warn(`[app] 앱 데이터 폴더를 못 지웠다: ${String(error)}`);
      }
    }
    return { orphans };
  };

  const [driverPort, nativePort] = [await freePort(), await freePort()];
  const driver = spawn(
    driverBin,
    ['--port', String(driverPort), '--native-port', String(nativePort), '--native-driver', loggedNativeDriver(nativeDriver, logDir)],
    { env, stdio: ['ignore', log('driver'), log('driver-stderr')], windowsHide: true },
  );
  if (!driver.pid) throw new Error('tauri-driver 가 뜨지 않았다');
  recordPids(logDir, [driver.pid]);
  try {
    await waitHttp(`http://127.0.0.1:${driverPort}/status`, 30_000);
    recordPids(
      logDir,
      treeOf([driver.pid]).map((p) => p.pid),
    ); // tauri-driver 가 벌써 띄웠다면 msedgedriver 도
  } catch (error) {
    await stop();
    throw error;
  }

  return {
    token,
    driverPort,
    driverPid: driver.pid,
    profile,
    env,
    describe: `Windows 데스크톱 세션, 앱 데이터 ${path.join(profile.config, IDENTIFIER)}`,
    stop,
  };
}
