// Linux 의 격리 데스크톱 — Tauri 앱이 사용자 세션·사용자 데이터에 하나도 닿지 않게. docs/PLAN-TEST-SUITE.md §11.
// (QCalc `feature/e2e-suite` 의 e2e/app/env-linux.ts 각색 — 아래 ★ 는 SPIN 실기(2026-11-15 gofu)에서 더한 것)
//
//  - 빈 번호의 Xvfb(`-displayfd`). 화면 1920×1080 — 기본 창 1280×800(tauri.conf.json)이 넉넉히 들어간다.
//  - 사설 D-Bus 세션 버스. ★ 그 위에 비밀 저장소(gnome-keyring-daemon --components=secrets)를 잠금 풀린 채 먼저 띄운다 —
//    없으면 버스가 깨운 xdg-desktop-portal 이 org.freedesktop.secrets 를 120초 기다리고, 그동안 WebDriver 세션 생성이
//    시간 초과로 죽는다(gofu 실측).
//  - 버리는 HOME / XDG_CONFIG_HOME / XDG_DATA_HOME / XDG_CACHE_HOME / XDG_RUNTIME_DIR 를 임시 폴더 하나 아래에.
//    ★ 사용자의 진짜 프로필(~/.local/share/app.atit.spin)에는 구글 갱신 토큰(secret_store.rs)과 IndexedDB 가 있다 —
//    시험이 그 자리에 쓰면 정보가 사라진다. 그래서 XDG_* 를 **반드시** 임시 폴더로 돌리고, 시작 때 한 번 더 확인한다.
//  - WAYLAND_DISPLAY 를 지우고 ★ GDK_BACKEND=x11 — 안 주면 GTK3 가 `wayland-0` 소켓을 스스로 찾아 창이 사용자의 진짜
//    데스크톱에 뜬다(gofu 실측).
//  - ★ 소프트웨어 렌더: NVIDIA 호스트에서 시스템 WebKit 빌드는 Mesa(llvmpipe)·합성 끔·DMA-BUF 끔·샌드박스 끔으로만
//    Xvfb 에 그린다. 이 넷은 **시험 전용**이다(배송 앱은 건드리지 않는다).
//  - tauri-driver(→ WebKitWebDriver → 앱)를 빈 포트에.
//
// 모든 프로세스는 실행 표지(procs.ts)를 지니므로, 정리(그리고 실행기가 죽은 뒤 scripts/test-suite.sh)는 이번 실행이
// 띄운 것만 정확히 끝낸다.
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, openSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';

import { PROFILE_PREFIX, type AppEnv, type ProfileDirs } from './platform.ts';
import { MARKER, describePid, descendants, markedPids, terminate } from './procs.ts';
import { freePort, waitHttp, which } from './util.ts';

export const SCREEN = { width: 1920, height: 1080 };

const MESA_EGL = '/usr/share/glvnd/egl_vendor.d/50_mesa.json';

function firstLine(stream: NodeJS.ReadableStream, what: string, timeoutMs = 10_000): Promise<string> {
  return new Promise((resolve, reject) => {
    let buf = '';
    const timer = setTimeout(() => reject(new Error(`${what}: ${timeoutMs}ms 안에 아무것도 안 찍었다`)), timeoutMs);
    stream.on('data', (chunk: Buffer) => {
      buf += chunk.toString();
      const nl = buf.indexOf('\n');
      if (nl >= 0) {
        clearTimeout(timer);
        resolve(buf.slice(0, nl).trim());
      }
    });
    stream.on('end', () => {
      clearTimeout(timer);
      reject(new Error(`${what}: 아무것도 안 찍고 끝났다`));
    });
  });
}

export function tauriDriverPath(): string | null {
  if (process.env.TAURI_DRIVER) return process.env.TAURI_DRIVER;
  const cargoBin = path.join(homedir(), '.cargo/bin/tauri-driver');
  return which('tauri-driver') ?? (existsSync(cargoBin) ? cargoBin : null);
}

/** 없는 호스트 도구(설치 안내 꼴) — 비었으면 층을 돌릴 수 있다 */
export function missingTools(): string[] {
  const missing: string[] = [];
  if (!which('Xvfb')) missing.push('Xvfb (apt: xvfb)');
  if (!which('dbus-daemon')) missing.push('dbus-daemon (apt: dbus)');
  if (!which('gnome-keyring-daemon')) missing.push('gnome-keyring-daemon (apt: gnome-keyring)');
  if (!which('WebKitWebDriver')) missing.push('WebKitWebDriver (apt: webkit2gtk-driver)');
  if (!which('xprop') || !which('xwininfo')) missing.push('xprop·xwininfo (apt: x11-utils)');
  if (!which('xwd')) missing.push('xwd (apt: x11-apps)');
  if (!tauriDriverPath()) missing.push('tauri-driver (cargo install tauri-driver --locked)');
  return missing;
}

export function makeProfile(root: string): ProfileDirs {
  const dirs: ProfileDirs = {
    root,
    home: path.join(root, 'home'),
    config: path.join(root, 'config'),
    data: path.join(root, 'data'),
    cache: path.join(root, 'cache'),
    runtime: path.join(root, 'runtime'),
  };
  for (const dir of Object.values(dirs)) mkdirSync(dir, { recursive: true });
  chmodSync(dirs.runtime, 0o700); // XDG_RUNTIME_DIR 는 나만 읽어야 한다
  return dirs;
}

/** 앱이 볼 XDG 자리가 전부 이번 임시 프로필 안인가 — 하나라도 밖이면 시작하지 않는다(사용자 데이터 보호의 마지막 둑) */
export function assertIsolated(env: NodeJS.ProcessEnv, profile: ProfileDirs): void {
  const inside = (p: string | undefined) => !!p && path.resolve(p).startsWith(path.resolve(profile.root) + path.sep);
  const bad = ['HOME', 'XDG_CONFIG_HOME', 'XDG_DATA_HOME', 'XDG_CACHE_HOME', 'XDG_RUNTIME_DIR'].filter((k) => !inside(env[k]));
  if (bad.length || !path.basename(profile.root).startsWith(PROFILE_PREFIX)) {
    throw new Error(`격리 실패 — 임시 프로필(${profile.root}) 밖을 가리키는 변수: ${bad.join(', ') || '(프로필 이름)'}`);
  }
}

export async function startLinuxEnv({ logDir }: { logDir: string }): Promise<AppEnv> {
  const token = randomUUID();
  const profile = makeProfile(mkdtempSync(path.join(tmpdir(), PROFILE_PREFIX)));
  mkdirSync(logDir, { recursive: true });
  // test-suite.sh 가 실행 뒤 이것을 읽어, 죽은 실행기가 남긴 것을 쓸어 낸다
  writeFileSync(path.join(logDir, '.app-run.json'), JSON.stringify({ token, profile: profile.root }) + '\n');

  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const key of [
    'WAYLAND_DISPLAY',
    'WAYLAND_SOCKET',
    'DISPLAY',
    'XAUTHORITY',
    'DBUS_SESSION_BUS_ADDRESS',
    'AT_SPI_BUS_ADDRESS',
    'SESSION_MANAGER',
    'GNOME_KEYRING_CONTROL',
    'SSH_AUTH_SOCK',
    // 패키지·셸 판정(main.rs 의 AppImage 갈래, 업데이터의 설치 경로)이 "보통 실행" 을 봐야 한다 — APPIMAGE 가 남으면
    // 업데이터가 그 파일을 갈아 끼우는 길이 열린다(시험은 받기·설치를 절대 안 부르지만 길 자체를 닫아 둔다)
    'APPIMAGE',
    'APPDIR',
    'SNAP',
    'SNAP_NAME',
    'FLATPAK_ID',
    'SPIN_FORCE_X11',
    // 웨일랜드 데스크톱의 입력기 설정은 X 디스플레이에 맞지 않는다 — GTK_IM_MODULE=wayland + GDK_BACKEND=x11 은 웹뷰를 만들다
    // SIGSEGV 로 죽는 쌍이다(main.rs 머리말). 앱이 스스로 떼지만, 시험 환경은 처음부터 싣지 않는다
    'GTK_IM_MODULE',
    'XMODIFIERS',
    'QT_IM_MODULE',
    'QT_IM_MODULES',
    'GTK_MODULES',
  ])
    delete env[key];
  Object.assign(env, {
    [MARKER]: token,
    HOME: profile.home,
    XDG_CONFIG_HOME: profile.config,
    XDG_DATA_HOME: profile.data,
    XDG_CACHE_HOME: profile.cache,
    XDG_RUNTIME_DIR: profile.runtime,
    XDG_SESSION_TYPE: 'x11',
    GDK_BACKEND: 'x11',
    GTK_USE_PORTAL: '0',
    NO_AT_BRIDGE: '1',
    // 언어 자동 감지가 시드(language: 'ko')와 같은 답을 내게 — 웹 층의 locale: 'ko-KR' 과 같은 뜻
    LANG: 'ko_KR.UTF-8',
    LANGUAGE: 'ko',
    // 소프트웨어 렌더(시험 전용) — 머리말 ★
    LIBGL_ALWAYS_SOFTWARE: '1',
    __GLX_VENDOR_LIBRARY_NAME: 'mesa',
    WEBKIT_DISABLE_COMPOSITING_MODE: '1',
    WEBKIT_DISABLE_DMABUF_RENDERER: '1',
    WEBKIT_DISABLE_SANDBOX_THIS_IS_DANGEROUS: '1',
    ...(existsSync(MESA_EGL) ? { __EGL_VENDOR_LIBRARY_FILENAMES: MESA_EGL } : {}),
  });
  assertIsolated(env, profile);

  const started: ChildProcess[] = [];
  const log = (name: string) => openSync(path.join(logDir, `app-${name}.log`), 'w');
  const stop = async () => {
    // 자식 먼저: 앱·WebKitWebDriver 는 tauri-driver 아래, 버스가 깨운 데몬은 dbus-daemon 아래에 있다
    const tree = started.flatMap((child) => (child.pid ? [...descendants(child.pid), child.pid] : []));
    await terminate(tree.reverse());
    // 나무를 벗어난 것(두 번 fork 한 gnome-keyring-daemon 등)도 표지는 지녔다
    const orphans = markedPids(token);
    const described = orphans.map(describePid);
    await terminate(orphans);
    if (process.env.E2E_KEEP_PROFILE !== '1') rmSync(profile.root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    return { orphans: described };
  };

  try {
    // ── Xvfb ──
    const xvfb = spawn(
      'Xvfb',
      ['-displayfd', '3', '-screen', '0', `${SCREEN.width}x${SCREEN.height}x24`, '-nolisten', 'tcp', '-noreset'],
      { env, stdio: ['ignore', 'ignore', log('xvfb'), 'pipe'] },
    );
    started.push(xvfb);
    env.DISPLAY = `:${await firstLine(xvfb.stdio[3] as NodeJS.ReadableStream, 'Xvfb')}`;

    // ── 사설 세션 버스 ──
    const dbus = spawn('dbus-daemon', ['--session', '--nofork', '--nopidfile', '--print-address=1'], {
      env,
      stdio: ['ignore', 'pipe', log('dbus')],
    });
    started.push(dbus);
    env.DBUS_SESSION_BUS_ADDRESS = await firstLine(dbus.stdout!, 'dbus-daemon');

    // ── 비밀 저장소(빈 암호로 잠금 해제) — 스스로 fork 해 물러나므로 표지로만 거둔다 ──
    const keyring = spawnSync('gnome-keyring-daemon', ['--unlock', '--components=secrets'], {
      env,
      input: '',
      encoding: 'utf8',
      timeout: 15_000,
    });
    writeFileSync(path.join(logDir, 'app-keyring.log'), `${keyring.stdout ?? ''}${keyring.stderr ?? ''}exit ${keyring.status}\n`);
    if (keyring.status !== 0) throw new Error(`gnome-keyring-daemon 이 뜨지 않음(exit ${keyring.status}) — test-results/app-keyring.log`);

    // ── tauri-driver → WebKitWebDriver ──
    const driverBin = tauriDriverPath();
    if (!driverBin) throw new Error('tauri-driver 가 없다 (cargo install tauri-driver --locked)');
    const [driverPort, nativePort] = [await freePort(), await freePort()];
    const driver = spawn(driverBin, ['--port', String(driverPort), '--native-port', String(nativePort)], {
      env,
      stdio: ['ignore', log('driver'), log('driver-stderr')],
    });
    started.push(driver);
    await waitHttp(`http://127.0.0.1:${driverPort}/status`, 15_000);

    return {
      token,
      driverPort,
      driverPid: driver.pid!,
      profile,
      env,
      describe: `격리 세션: DISPLAY=${env.DISPLAY}, 프로필 ${profile.root}`,
      stop,
    };
  } catch (error) {
    await stop();
    throw error;
  }
}
