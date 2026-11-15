// TauriApp — WdioApp 에 실제 데스크톱 앱만 가진 것을 더한다: Tauri 명령(IPC)·네이티브 창·앱 프로세스·디스크의 프로필.
// 앱 전용 시나리오(native.ts)가 이것을 쓰고, 공유 시나리오는 SpinApp 부분만 본다. docs/PLAN-TEST-SUITE.md §11.
// (QCalc `feature/e2e-suite` 의 e2e/app/tauri-app.ts 각색 — 클립보드·AT-SPI 는 SPIN 에 시나리오가 없어 뺐다)
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { test } from '@playwright/test';

import { WdioApp, type WdioAppOptions } from '../drivers/WdioApp.ts';
import type { DecodedPng } from '../support/png.ts';
import { captureRoot } from './xwd.ts';
import { IDENTIFIER, isWindows, type ProfileDirs } from './platform.ts';
import type { AppSession } from './session.ts';

export { IDENTIFIER };

export interface NativeWindow {
  id: string;
  title: string;
  width: number;
  height: number;
  /** 루트 창 안의 자리(창 관리자가 없는 Xvfb 에서는 장식이 없다 — 웹뷰의 왼쪽 위) */
  x: number;
  y: number;
}

export interface TauriAppOptions extends Omit<WdioAppOptions, 'session' | 'origin'> {
  session: AppSession;
  profile: ProfileDirs;
  /** 격리 세션의 환경(Linux: DISPLAY·사설 버스) — 바깥 도구(xprop 등)용 */
  sessionEnv: NodeJS.ProcessEnv;
}

type Envelope = { ok: true; value: unknown } | { ok: false; error: string };

export class TauriApp extends WdioApp {
  readonly session: AppSession;
  readonly profile: ProfileDirs;
  readonly sessionEnv: NodeJS.ProcessEnv;

  constructor(options: TauriAppOptions) {
    super({ ...options, session: () => options.session.wd, origin: () => options.session.origin });
    this.session = options.session;
    this.profile = options.profile;
    this.sessionEnv = options.sessionEnv;
  }

  /** Tauri 명령을 페이지의 IPC 다리로 부른다(@tauri-apps/api 의 invoke() 가 하는 일). 거절되면 그 문구로 던진다 */
  async invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
    const r = await this.js(
      async ({ cmd, cmdArgs }: { cmd: string; cmdArgs?: Record<string, unknown> }): Promise<Envelope> => {
        const internals = (window as unknown as { __TAURI_INTERNALS__?: { invoke: (c: string, a?: unknown) => Promise<unknown> } })
          .__TAURI_INTERNALS__;
        if (!internals) return { ok: false, error: '이 문서에 __TAURI_INTERNALS__ 가 없다' };
        try {
          const value = await internals.invoke(cmd, cmdArgs);
          return { ok: true, value: value === undefined ? null : value };
        } catch (error) {
          return { ok: false, error: typeof error === 'string' ? error : String((error as Error)?.message ?? error) };
        }
      },
      { cmd: command, cmdArgs: args },
    );
    if (!r.ok) throw new Error(`invoke ${command} 거절: ${r.error}`);
    return r.value as T;
  }

  /** CSS 뷰포트 = 웹뷰 내용 크기 */
  innerSize(): Promise<{ width: number; height: number }> {
    return this.viewportSize();
  }

  /** WebDriver 로 창 크기를 청한다 — GTK 가 앱의 최소 크기 힌트를 그 요청에 건다 */
  async requestWindowSize(width: number, height: number): Promise<void> {
    await this.wd.setWindowRect({ width, height });
  }

  /** X 도구용 환경: 시험 디스플레이, UTF-8 출력 */
  private get xEnv(): NodeJS.ProcessEnv {
    return { ...this.sessionEnv, LC_ALL: 'C.UTF-8' };
  }

  /**
   * Xvfb 디스플레이의 최상위 X 창 중 WM_CLASS 가 spin 인 것 — DOM 이 아니라 네이티브의 눈이다.
   * 같은 클래스의 GTK 10×10 대표(client leader) 창은 뺀다.
   */
  nativeWindows(): NativeWindow[] {
    const tree = execFileSync('xwininfo', ['-root', '-tree'], { env: this.xEnv, encoding: 'utf8' });
    // '     0x200004 "SPIN": ("spin" "Spin")  1280x800+0+0  +0+0' (이름이 이스케이프되거나 없을 수 있다). 끝의 +x+y 가 루트 기준 자리
    return [...tree.matchAll(/^\s+(0x[0-9a-f]+) (?:"(.*?)"|\(has no name\)): \("([^"]*)" "([^"]*)"\)\s+(\d+)x(\d+)[+-]-?\d+[+-]-?\d+\s+\+(-?\d+)\+(-?\d+)/gm)]
      .filter((m) => /^spin$/i.test(m[3]!) && Number(m[5]) > 50)
      .map((m) => ({ id: m[1]!, title: m[2] ?? '', width: Number(m[5]), height: Number(m[6]), x: Number(m[7]), y: Number(m[8]) }));
  }

  /** X 서버의 화면 전체(xwd) — 디스플레이에 정말 나간 화소(xwd.ts 머리말) */
  xScreenshot(): DecodedPng {
    return captureRoot(this.xEnv);
  }

  /** X 창 속성 하나의 xprop 출력(예: WM_NORMAL_HINTS, _NET_WM_NAME) */
  nativeProp(windowId: string, prop: string): string {
    return execFileSync('xprop', ['-id', windowId, prop], { env: this.xEnv, encoding: 'utf8' });
  }

  appPid(): number | null {
    return this.session.appPid();
  }

  /** 앱 데이터 폴더(app_data_dir) — Linux $XDG_DATA_HOME/<id>, Windows %APPDATA%\<id> */
  get appDataDir(): string {
    return path.join(isWindows ? this.profile.config : this.profile.data, IDENTIFIER);
  }

  /** 앱 데이터 폴더의 파일 경로(있든 없든) */
  dataPath(name: string): string {
    return path.join(this.appDataDir, name);
  }

  /** 앱 자신의 로그 끝부분(tauri-plugin-log, 디버그 빌드만) — app_log_dir: Linux $XDG_DATA_HOME/<id>/logs, Windows %LOCALAPPDATA%\<id>\logs */
  appLog(lines = 60): string {
    const dir = path.join(this.profile.data, IDENTIFIER, 'logs');
    if (!existsSync(dir)) return '(앱 로그 없음)';
    return readdirSync(dir)
      .map((name) => readFileSync(path.join(dir, name), 'utf8'))
      .join('\n')
      .split('\n')
      .slice(-lines)
      .join('\n');
  }

  /** 사람이 창을 닫듯 끝낸다(정상 종료 — WebKit 이 저장소를 닫는다) 그리고 프로세스가 끝나기를 기다린다 */
  async closeWindow(): Promise<void> {
    await this.harvestErrors();
    if (!(await this.session.closeWindow())) throw new Error('창을 닫았는데 앱이 끝나지 않았다');
  }

  /**
   * 시드의 지우기가 막혔다 — 앱을 같은 프로필로 다시 띄우면 연결을 쥔 프로세스째 사라진다. 숨기지 않는다:
   * 시험 보고서에 `harness` 표식으로 남기고 로그에도 찍는다(retries 0 원칙 — 흔들림은 드러낸다, 결정 7).
   */
  protected override async recoverStuckSeed(reason: string): Promise<void> {
    const note = `시드 지우기가 막혀 앱을 다시 띄움 — ${reason}`;
    console.warn(`[e2e] ${note}`);
    try {
      test.info().annotations.push({ type: 'harness', description: note });
    } catch {
      // 시험 밖(전역 준비 등)에서 불렸다 — 로그만 남는다
    }
    await this.relaunch();
  }

  /** 같은 프로필로 다시 띄운다(fresh = 첫 설치 프로필). 문서는 아직 안 연다 — open/seed 가 연다 */
  async relaunch({ fresh = false } = {}): Promise<void> {
    await this.session.relaunch({ fresh });
  }

  /** 지금 실행에서 저장소를 건드리지 않고 e2e 주소를 연다 */
  async openE2E(route = '/'): Promise<void> {
    await this.open(route);
  }

  /** 지금 문서의 스크린샷(PNG) */
  async screenshotPng(): Promise<Buffer> {
    return Buffer.from(await this.wd.screenshot(), 'base64');
  }
}
