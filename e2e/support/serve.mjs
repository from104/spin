#!/usr/bin/env node
// e2e 용 정적 서버 — Playwright `webServer` 가 띄운다. docs/PLAN-TEST-SUITE.md §2 (QCalc serve.mjs 각색).
//
// 1. dist/ 가 없거나 빌드 입력보다 오래됐으면(또는 E2E_REBUILD=1) `npm run build`(tsc -b + vite build +
//    프리렌더)로 다시 만든다. 낡은 dist/ 로 초록이 나오는 것이 이 스위트의 가장 조용한 거짓말이라
//    서버를 재사용하지 않고(reuseExistingServer: false) 매번 판정한다.
// 2. dist/ 를 127.0.0.1:E2E_PORT(기본 4179)에서 내준다. 응답 순서는 운영 vhost(spin.atit.app)를 흉내 낸다:
//      파일 그대로 → `<경로>/index.html`(프리렌더 착지) → `/index.html`(`FallbackResource`, 200)
//    그래서 `/drills` 새로고침·`/rules/basics/` 프리렌더·없는 주소의 앱 fallback 이 운영과 같은 길을 탄다.
// 3. `/__e2e__/blank` 는 같은 출처의 빈 문서다 — 드라이버가 앱을 띄우기 전에 저장소를 심는 자리(seed).
//    fallback 이 앱을 내주기 전에 이 주소만 따로 가로챈다(앱이 돌면 저장소를 먼저 건드린다).
//
// 의존성 없이 node 내장 모듈만 쓴다. 빌드 로그는 test-results/e2e-build.log 로 남긴다.
import { spawnSync } from 'node:child_process';
import { createReadStream, existsSync, mkdirSync, openSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const dist = path.join(root, 'dist');
const indexHtml = path.join(dist, 'index.html');
const port = Number(process.env.E2E_PORT || 4179);

// 빌드 결과에 영향을 주는 입력들 — 이 중 하나라도 dist/index.html 보다 새로우면 다시 빌드한다.
// CHANGELOG*.md 는 변경 이력 모달이 원문을 `?raw` 로 굽고, scripts/prerender.mjs 는 프리렌더를 찍는다.
const BUILD_INPUTS = [
  'src',
  'public',
  'index.html',
  'vite.config.ts',
  'package.json',
  'scripts/prerender.mjs',
  ...readdirSync(root).filter((name) => /^CHANGELOG.*\.md$/.test(name)),
];

/** 테스트 파일은 번들에 안 들어간다 — 고쳐도 다시 빌드할 이유가 없다 */
const isTestFile = (name) => /\.test\.[cm]?[jt]sx?$/.test(name) || name === '__tests__';

/** target 아래에 builtAt 보다 새로 고친 파일이 하나라도 있으면 그 경로를 돌려준다 */
function newerThan(target, builtAt) {
  if (!existsSync(target)) return null;
  const st = statSync(target);
  if (!st.isDirectory()) return st.mtimeMs > builtAt ? target : null;
  for (const entry of readdirSync(target, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || isTestFile(entry.name)) continue;
    const hit = newerThan(path.join(target, entry.name), builtAt);
    if (hit) return hit;
  }
  return null;
}

function staleReason() {
  if (process.env.E2E_REBUILD === '1') return 'E2E_REBUILD=1';
  if (!existsSync(indexHtml)) return 'dist/ 없음';
  const builtAt = statSync(indexHtml).mtimeMs;
  for (const input of BUILD_INPUTS) {
    const hit = newerThan(path.join(root, input), builtAt);
    if (hit) return `${path.relative(root, hit)} 이(가) 빌드보다 새로움`;
  }
  return null;
}

const reason = staleReason();
if (reason) {
  mkdirSync(path.join(root, 'test-results'), { recursive: true });
  const logPath = path.join(root, 'test-results/e2e-build.log');
  const log = openSync(logPath, 'w');
  console.error(`[e2e] 운영 빌드 시작 (${reason}) — 로그: ${path.relative(root, logPath)}`);
  const started = Date.now();
  const r = spawnSync('npm', ['run', 'build'], { cwd: root, stdio: ['ignore', log, log] });
  if (r.status !== 0) {
    console.error(`[e2e] 운영 빌드 실패 (exit ${r.status}) — ${logPath}`);
    process.exit(1);
  }
  console.error(`[e2e] 운영 빌드 완료 ${((Date.now() - started) / 1000).toFixed(1)}s`);
} else {
  console.error('[e2e] 기존 dist/ 재사용 (강제 재빌드: E2E_REBUILD=1)');
}

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};

const BLANK_PATH = '/__e2e__/blank';
const BLANK = '<!doctype html><meta charset="utf-8"><title>e2e blank</title>';

/** dist 안의 일반 파일이면 그 경로, 아니면 null (dist 밖으로 나가는 경로는 거절) */
function fileIn(rel) {
  const file = path.join(dist, rel);
  if (file !== dist && !file.startsWith(dist + path.sep)) return null;
  return existsSync(file) && statSync(file).isFile() ? file : null;
}

/** 운영 vhost 순서: 파일 → <경로>/index.html → /index.html */
function resolve(urlPath) {
  const rel = urlPath.replace(/^\/+/, '');
  return (rel && fileIn(rel)) || fileIn(path.join(rel, 'index.html')) || indexHtml;
}

http
  .createServer((req, res) => {
    let urlPath;
    try {
      urlPath = decodeURIComponent((req.url || '/').split('?')[0] || '/');
    } catch {
      res.writeHead(400).end();
      return;
    }
    if (urlPath === BLANK_PATH) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(BLANK);
      return;
    }
    const file = resolve(urlPath);
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    // 읽기 실패(빌드 도중 지워진 파일 등)가 서버를 죽이면 이후 시험이 전부 '연결 거부' 로 번진다 — 이 응답만 끊는다
    createReadStream(file)
      .on('error', () => res.destroy())
      .pipe(res);
  })
  .listen(port, '127.0.0.1', () => {
    // Playwright 가 SIGKILL 로 죽으면 이 서버는 고아로 남는다 — test-suite.sh 가 다음 실행 전에 이 pid 파일로 정리한다
    mkdirSync(path.join(root, 'test-results'), { recursive: true });
    writeFileSync(path.join(root, 'test-results', '.e2e-server.pid'), String(process.pid));
    console.error(`[e2e] serving dist/ at http://127.0.0.1:${port}`);
  });
const cleanPid = () => rmSync(path.join(root, 'test-results', '.e2e-server.pid'), { force: true });
process.on('exit', cleanPid);
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => process.exit(0));
