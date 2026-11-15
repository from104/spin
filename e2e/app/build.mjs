#!/usr/bin/env node
// app 층이 시험하는 Tauri 디버그 바이너리를 **필요할 때만** 굽는다: `src-tauri/target/e2e-app/spin`(Windows `spin.exe`).
// docs/PLAN-TEST-SUITE.md §11. (QCalc `feature/e2e-suite` 의 e2e/app/build.mjs 각색)
//
// 운영 프런트(dist/)를 품어야 한다. 그냥 `cargo build` 는 `custom-protocol` 기능이 빠져 devUrl(localhost:5173)을 여므로
// `tauri build --debug --no-bundle` 를 탄다 — 디버그(빠른 증분 컴파일·tauri-plugin-log 가 켜짐), 묶음 없음(deb·AppImage·MSI
// 안 만듦), **서명 없음**(묶음이 없으면 업데이터 서명도 없다 — 서명 키를 읽지 않는다).
//  1. dist/: e2e/support/serve.mjs --build-only (웹 층과 같다 — 입력이 바뀌었을 때만 `npm run build`)
//  2. beforeBuildCommand 를 끈 `tauri build --debug --no-bundle`(1 이 이미 했다). 웹 빌드라 TAURI_ENV_PLATFORM 이 없어
//     `SPIN_DESKTOP_*`(구글 클라이언트 시크릿)이 번들에 안 실린다(vite.config.ts) — 시험 바이너리에 비밀이 없다
//  3. target/debug/spin → target/e2e-app/spin 하드링크. `npm run tauri:dev` 가 target/debug/spin 을 devUrl 판으로 덮어써도
//     e2e 사본은 프런트를 품은 판으로 남는다(cargo 는 파일을 바꿔 끼우므로 링크가 살아남는다)
//
// 재사용 판정은 입력 **지문**이다(serve.mjs 와 같은 까닭 — mtime 을 보존하는 되돌리기가 옛 시각을 되살려도 낡은 바이너리를
// 쓰지 않게): dist 의 지문(dist/.e2e-inputs) + src-tauri 입력·package.json 의 (경로, mtime, 크기). 강제: --rebuild 또는 E2E_REBUILD=1.
// 로그: test-results/app-build-tauri.log
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, linkSync, mkdirSync, openSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const win = process.platform === 'win32';
const exe = win ? 'spin.exe' : 'spin';
const built = path.join(root, 'src-tauri/target/debug', exe);
const output = path.join(root, 'src-tauri/target/e2e-app', exe);
const stampFile = path.join(root, 'src-tauri/target/e2e-app/.e2e-inputs');
const force = process.argv.includes('--rebuild') || process.env.E2E_REBUILD === '1';

// 바이너리에 들어가는 것 — 프런트는 dist 지문 하나로 대신한다
const INPUTS = [
  'package.json', // tauri.conf.json 의 "version": "../package.json"
  'src-tauri/src',
  'src-tauri/capabilities',
  'src-tauri/icons',
  'src-tauri/build.rs',
  'src-tauri/Cargo.toml',
  'src-tauri/Cargo.lock',
  'src-tauri/tauri.conf.json',
];

function files(target, out = []) {
  if (!existsSync(target)) return out;
  const st = statSync(target);
  if (!st.isDirectory()) {
    out.push(`${path.relative(root, target)}\0${st.mtimeMs}\0${st.size}`);
    return out;
  }
  for (const entry of readdirSync(target, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    files(path.join(target, entry.name), out);
  }
  return out;
}

function run(cmd, args, log) {
  // Windows: npx 는 npx.cmd 라 셸만 띄울 수 있다(인자는 낱말뿐 — 명령줄에 JSON 을 싣지 않는다)
  const r = spawnSync(cmd, args, { cwd: root, stdio: ['ignore', log, log], shell: win });
  if (r.status !== 0) {
    console.error(`[app] ${cmd} ${args.join(' ')} 실패 (exit ${r.status}) — test-results/app-build-tauri.log`);
    process.exit(1);
  }
}

// 1. 프런트(재사용/빌드 한 줄은 serve.mjs 가 찍는다)
const spa = spawnSync(process.execPath, [path.join(root, 'e2e/support/serve.mjs'), '--build-only'], { cwd: root, stdio: 'inherit', env: process.env });
if (spa.status !== 0) process.exit(1);

// 2. 바이너리
/**
 * `tauri build --config` 덮어쓰기. Windows 는 WebView2 브라우저 인자를 시험 빌드가 직접 싣는다:
 * ⚠️ msedgedriver 는 WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS 로 `--remote-debugging-port=0` 을 넘기는데, 앱이 제 인자를
 * 넘기면(wry 는 늘 넘긴다) WebView2 가 그 변수를 무시한다 → "DevToolsActivePort file doesn't exist" 로 세션이 안 열린다
 * (2026-11-15 SPIN e2e-app windows 잡 · 같은 날 QCalc CI 3회차 진단 e2e/app/diag-windows.ts 와 같은 꼴).
 * additionalBrowserArgs 를 주면 wry 기본값이 통째로 빠지므로 그 기본값(wry 0.57 webview2/mod.rs)을 함께 적는다.
 * JSON merge patch 는 배열을 통째로 갈아 끼우므로 창 목록은 tauri.conf.json 의 것에 인자만 더한다.
 */
function configOverride() {
  const override = { build: { beforeBuildCommand: '' } };
  if (!win) return override;
  const conf = JSON.parse(readFileSync(path.join(root, 'src-tauri/tauri.conf.json'), 'utf8'));
  const additionalBrowserArgs = [
    // wry 기본값 — 미니 메뉴·SmartScreen 끄기, Tauri 가 켜는 autoplay
    '--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection',
    '--autoplay-policy=no-user-gesture-required',
    // msedgedriver 가 WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS 로 붙였을 것(app-msedgedriver.log)
    '--remote-debugging-port=0',
    '--enable-automation',
    '--allow-pre-commit-input',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-hang-monitor',
    '--disable-popup-blocking',
    '--disable-prompt-on-repost',
    '--no-first-run',
    '--test-type=webdriver',
  ].join(' ');
  override.app = { windows: conf.app.windows.map((w) => ({ ...w, additionalBrowserArgs })) };
  return override;
}
const overrideJson = JSON.stringify(configOverride());

const distStamp = path.join(root, 'dist/.e2e-inputs');
const fingerprint = createHash('sha1')
  .update(overrideJson)
  .update('\n')
  .update(existsSync(distStamp) ? readFileSync(distStamp, 'utf8').trim() : 'no-dist-stamp')
  .update('\n')
  .update(INPUTS.flatMap((i) => files(path.join(root, i))).sort().join('\n'))
  .digest('hex');
const previous = existsSync(stampFile) ? readFileSync(stampFile, 'utf8').trim() : '';
const stale = force ? '--rebuild' : !existsSync(output) ? 'e2e 바이너리 없음' : previous !== fingerprint ? '입력 지문 불일치' : null;
if (!stale) {
  console.log(`[app] ${path.relative(root, output)} 재사용 (강제: --rebuild)`);
  process.exit(0);
}
mkdirSync(path.join(root, 'test-results'), { recursive: true });
const log = openSync(path.join(root, 'test-results/app-build-tauri.log'), 'w');
console.log(`[app] Tauri 디버그 바이너리 굽기 (${stale})`);
const started = Date.now();
// 설정 덮어쓰기는 파일로 준다 — Windows 명령줄의 JSON 은 cmd.exe 에서 따옴표를 잃는다
const overrideFile = path.join(root, 'test-results/app-tauri-config.json');
writeFileSync(overrideFile, overrideJson);
run('npx', ['tauri', 'build', '--debug', '--no-bundle', '--config', win ? `"${overrideFile}"` : overrideFile], log);

// 3. 우리 몫의 링크
mkdirSync(path.dirname(output), { recursive: true });
rmSync(output, { force: true });
try {
  linkSync(built, output);
} catch {
  copyFileSync(built, output);
}
writeFileSync(stampFile, fingerprint + '\n');
console.log(`[app] ${path.relative(root, output)} 구움 ${((Date.now() - started) / 1000).toFixed(1)}s`);
