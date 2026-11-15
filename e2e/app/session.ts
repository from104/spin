// WebDriver 세션 하나 = 떠 있는 앱 프로세스 하나. 다시 띄우기 = 새 세션(tauri-driver 가 앱을 다시 띄운다).
// docs/PLAN-TEST-SUITE.md §11. (QCalc `feature/e2e-suite` 의 e2e/app/session.ts 각색 — WebdriverIO 대신 webdriver.ts)
//
// 앱 프로필(설정·WebKit/WebView2 저장소·캐시)은 env-linux.ts 가 만든 임시 폴더에 있다(Windows: 러너의 진짜
// %APPDATA%·%LOCALAPPDATA% 아래 앱 폴더, env-windows.ts). 한 워커의 모든 실행이 같은 프로필을 쓰므로 "다시 띄우기" 가
// 정말로 보존을 시험한다. `wipeProfile()` 이 첫 설치 상태를 준다.
import { readdirSync, readlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { WebDriverSession } from '../drivers/webdriver.ts';
import { recordPids, wipeAppData } from './env-windows.ts';
import { IDENTIFIER, isWindows, PROFILE_PREFIX, type ProfileDirs } from './platform.ts';
import { descendants, isAlive, terminate, waitExit } from './procs.ts';
import { treeOf } from './procs-win.ts';

export interface SessionOptions {
  driverPort: number;
  driverPid: number;
  binary: string;
  /** 앱 프로세스의 실제 실행 파일 — binary 가 껍데기(산출물 모드의 launch.sh)일 때만 다르다 */
  exe?: string;
  profile: ProfileDirs;
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class AppSession {
  readonly options: SessionOptions;
  private current: WebDriverSession | null = null;
  /** 예: 'tauri://localhost' — 실행마다 첫 문서에서 읽는다 */
  origin = '';
  launches = 0;
  /** Windows: 프로세스 목록 한 번이 약 1초라, 살아 있는 동안 앱 PID 를 기억한다 */
  private cachedPid: number | null = null;

  constructor(options: SessionOptions) {
    this.options = options;
  }

  get wd(): WebDriverSession {
    if (!this.current) throw new Error('앱이 떠 있지 않다(WebDriver 세션 없음)');
    return this.current;
  }

  async launch(): Promise<void> {
    this.current = await WebDriverSession.create(
      `http://127.0.0.1:${this.options.driverPort}`,
      {
        'tauri:options': {
          application: this.options.binary,
          // ⚠️ Windows: msedgedriver 는 세션마다 새 임시 프로필(scoped_dir)을 만들어 WEBVIEW2_USER_DATA_FOLDER 로 준다 —
          //   그러면 다시 띄울 때마다 WebView2 저장소(localStorage·IndexedDB)가 비어 N4 가 "껐다 켜니 판이 없다" 로 빨갛다
          //   (2026-11-15 e2e-app windows 잡). 앱이 실제로 쓰는 자리(%LOCALAPPDATA%\<id>, Tauri 의 data_directory)를
          //   --user-data-dir 로 고정한다 — 제가 만든 게 아니라 끝나도 지우지 않는다. 첫 설치 상태는 wipeAppData 가 준다.
          ...(isWindows ? { args: [`--user-data-dir=${path.join(this.options.profile.data, IDENTIFIER)}`] } : {}),
        },
      },
      // msedgedriver 는 WebView2 가 뜨기를 60초 기다린 뒤에야 제 오류로 답한다 — 짧게 끊으면 "시간 초과" 만 남고 그 오류가 가려진다
      isWindows ? 120_000 : 60_000,
    );
    // 첫 문서(tauri-driver 가 연 앱 주소)가 다 적재될 때까지 — 적재 중에 다른 주소로 가면 늦게 끝난 첫 적재가 그 문서를 덮는다
    // (gofu 실측: 시드의 빈 문서가 스크립트 도중 'unload' 로 사라졌다)
    const deadline = Date.now() + 30_000;
    while ((await this.current.execute(() => document.readyState).catch(() => 'loading')) !== 'complete') {
      if (Date.now() > deadline) throw new Error('앱의 첫 문서가 30초 안에 적재되지 않았다');
      await pause(50);
    }
    const url = new URL(await this.current.url());
    // tauri: 같은 특수하지 않은 스킴에서는 URL.origin 이 'null' 이다
    this.origin = `${url.protocol}//${url.host}`;
    this.launches++;
    this.cachedPid = null;
    if (isWindows) {
      const pid = this.appPid();
      if (pid) recordPids(path.resolve('test-results'), [pid, ...descendants(pid)]);
    }
  }

  /** 앱 프로세스의 PID(우리 tauri-driver 아래 WebKitWebDriver 의 자식), 없으면 null */
  appPid(): number | null {
    const binary = path.resolve(this.options.exe ?? this.options.binary);
    if (isWindows) {
      if (this.cachedPid !== null && isAlive(this.cachedPid)) return this.cachedPid;
      const wanted = binary.toLowerCase();
      const found = treeOf([this.options.driverPid]).find((p) => p.exe?.toLowerCase() === wanted);
      this.cachedPid = found?.pid ?? null;
      return this.cachedPid;
    }
    for (const pid of descendants(this.options.driverPid)) {
      try {
        // 다시 빌드한 뒤에는 실행 중인 판이 '(deleted)' 로 보인다
        if (readlinkSync(`/proc/${pid}/exe`).replace(/ \(deleted\)$/, '') === binary) return pid;
      } catch {
        // 끝났다
      }
    }
    return null;
  }

  isRunning(): boolean {
    return this.current !== null && this.appPid() !== null;
  }

  /** 세션을 끝낸다 — tauri-driver 가 앱을 죽인다(정상 종료가 아니다 — 나가는 길의 저장은 없다) */
  async close(): Promise<void> {
    const pid = this.appPid();
    // WebKit 의 네트워크·웹 프로세스는 앱보다 잠깐 더 살며 프로필에 쓴다
    const helpers = pid ? descendants(pid) : [];
    try {
      await this.current?.delete();
    } catch {
      // 앱이 이미 없을 수 있다
    }
    this.current = null;
    this.cachedPid = null;
    if (pid && !(await waitExit(pid, 5000))) await terminate([pid]);
    const deadline = Date.now() + 2000;
    while (helpers.some(isAlive) && Date.now() < deadline) await pause(50);
    await terminate(helpers);
  }

  /**
   * 사람이 창의 [X] 를 누른 것처럼 닫는다 — 마지막 창이 닫히면 앱이 스스로 끝난다(Tauri 의 정상 종료). 프로세스가
   * 끝나기를 기다린 뒤 죽은 세션을 거둔다. true = 상한 안에 끝났다
   */
  async closeWindow(timeoutMs = 10_000): Promise<boolean> {
    const pid = this.appPid();
    const helpers = pid ? descendants(pid) : [];
    await this.wd.closeWindow().catch((error: unknown) => {
      // 창과 함께 세션이 먼저 사라지기도 한다
      if (!/no such window|invalid session|ECONNREFUSED|socket|fetch failed|terminated/i.test(String(error))) throw error;
    });
    const exited = pid === null || (await waitExit(pid, timeoutMs));
    // 앱이 끝난 뒤에야 WebKit 하위 프로세스가 저장소를 닫는다 — 그들이 끝날 때까지 기다린다(지우거나 다시 띄우기 전에)
    const deadline = Date.now() + 5000;
    while (helpers.some(isAlive) && Date.now() < deadline) await pause(50);
    await this.close();
    return exited;
  }

  async relaunch({ fresh = false } = {}): Promise<void> {
    await this.close();
    if (fresh) this.wipeProfile();
    await this.launch();
  }

  /** 첫 설치 상태: 설정·데이터(WebKit 저장소·갱신 토큰)·캐시를 비운다. 앱이 안 떠 있을 때만 */
  wipeProfile(): void {
    if (isWindows) return wipeAppData(this.options.profile);
    const { root } = this.options.profile;
    // 이중 확인: 우리 임시 프로필 안만 지운다
    if (!path.resolve(root).startsWith(path.join(tmpdir(), PROFILE_PREFIX))) {
      throw new Error(`${root} 를 지우지 않는다: e2e 임시 프로필이 아니다`);
    }
    for (const dir of [this.options.profile.config, this.options.profile.data, this.options.profile.cache]) {
      // WebKit 하위 프로세스가 앱보다 잠깐 더 살며 저장소 파일을 쓸 수 있다(ENOTEMPTY)
      for (const entry of readdirSync(dir)) {
        rmSync(path.join(dir, entry), { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
      }
    }
  }
}
