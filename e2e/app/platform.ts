// app 층이 호스트 OS 를 가로질러 함께 쓰는 것 — 프로필 모양, 환경 계약, 앱 식별자. docs/PLAN-TEST-SUITE.md §11.
// Linux(env-linux.ts): Xvfb + 사설 D-Bus + 임시 프로필. Windows(env-windows.ts): 러너의 데스크톱과 진짜 사용자별
// 앱 데이터 폴더(CI 전용). (QCalc `feature/e2e-suite` 의 e2e/app/platform.ts 각색)

/** src-tauri/tauri.conf.json 의 identifier — 앱 폴더 이름이다 */
export const IDENTIFIER = 'app.atit.spin';
export const isWindows = process.platform === 'win32';
/** Playwright 프로젝트 이름 = 실제 앱 드라이버의 SpinApp.platform */
export const APP_PLATFORM = isWindows ? 'tauri-windows' : 'tauri-linux';
/** e2e 바이너리(build.mjs 산출물) — Cargo 패키지 이름이 spin 이다 */
export const DEFAULT_BINARY = `src-tauri/target/e2e-app/${isWindows ? 'spin.exe' : 'spin'}`;
/** 임시 프로필 폴더 이름의 머리 — 지우기 전에 이 머리로 한 번 더 확인한다 */
export const PROFILE_PREFIX = 'spin-e2e-app-';

/**
 * 앱이 파일을 두는 자리. 앱 자신의 폴더는 `<dir>/<IDENTIFIER>` 다.
 * Linux: XDG_* 를 대신하는 임시 폴더 — `data` 아래에 WebKit 저장소(localStorage·IndexedDB)와 secret_store 의
 * 갱신 토큰 파일(app_data_dir)이 선다. Windows: %APPDATA%(config = app_data_dir) 와 %LOCALAPPDATA%(data = WebView2 저장소).
 */
export interface ProfileDirs {
  root: string;
  home: string;
  config: string;
  data: string;
  cache: string;
  runtime: string;
}

/** 떠 있는 격리 환경 — tauri-driver 가 듣고 있고, `env` 는 같은 세션에서 돌아야 하는 바깥 도구(xprop 등)용이다 */
export interface AppEnv {
  token: string;
  driverPort: number;
  driverPid: number;
  profile: ProfileDirs;
  env: NodeJS.ProcessEnv;
  /** 로그 한 줄 */
  describe: string;
  stop(): Promise<{ orphans: string[] }>;
}
