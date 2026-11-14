#!/usr/bin/env node
// e2e 용 정적 서버 — Playwright `webServer` 가 띄운다. docs/PLAN-TEST-SUITE.md §2 (QCalc serve.mjs 각색).
//
// 1. dist/ 가 없거나 빌드 입력이 지난 빌드 뒤 바뀌었으면(또는 E2E_REBUILD=1) `npm run build`(tsc -b + vite build
//    + 프리렌더)로 다시 만든다. 판정은 입력 지문(경로·mtime·크기, dist/.e2e-inputs)이다 — 아래 fingerprint 주석.
//    낡은 dist/ 로 초록이 나오는 것이 이 스위트의 가장 조용한 거짓말이라 서버를 재사용하지 않고
//    (reuseExistingServer: false) 매번 판정한다.
// 2. dist/ 를 127.0.0.1:E2E_PORT(기본 4179)에서 내준다. 응답 순서는 운영 vhost(spin.atit.app)를 흉내 낸다:
//      파일 그대로 → `<경로>/index.html`(프리렌더 착지) → `/index.html`(`FallbackResource`, 200)
//    그래서 `/drills` 새로고침·`/rules/basics/` 프리렌더·없는 주소의 앱 fallback 이 운영과 같은 길을 탄다.
// 3. `/__e2e__/blank` 는 같은 출처의 빈 문서다 — 드라이버가 앱을 띄우기 전에 저장소를 심는 자리(seed).
//    fallback 이 앱을 내주기 전에 이 주소만 따로 가로챈다(앱이 돌면 저장소를 먼저 건드린다).
//
// 의존성 없이 node 내장 모듈만 쓴다. 빌드 로그는 test-results/e2e-build.log 로 남긴다.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  createReadStream,
  existsSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
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

/** 입력 파일 전부의 (경로, mtime, 크기) — 테스트 파일·점 파일은 뺀다 */
function inputFiles(target, out = []) {
  if (!existsSync(target)) return out;
  const st = statSync(target);
  if (!st.isDirectory()) {
    out.push({ file: path.relative(root, target), mtimeMs: st.mtimeMs, size: st.size });
    return out;
  }
  for (const entry of readdirSync(target, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || isTestFile(entry.name)) continue;
    inputFiles(path.join(target, entry.name), out);
  }
  return out;
}

const listInputs = () => BUILD_INPUTS.flatMap((input) => inputFiles(path.join(root, input)));

/**
 * 입력 지문 — 파일마다 (경로, mtime, 크기)를 이어 해시한다. "dist 보다 새 파일이 있나" 만 보면 **mtime 을 보존하는
 * 되돌리기**(cp -p·shutil.copy2·백업 복원)가 빌드보다 옛 시각을 되살려 낡은 dist 를 그대로 내준다 — 돌연변이 시험을
 * 되돌린 직후 실제로 그 돌연변이 빌드로 시험이 돌았다(2026-11-15). 지문은 시각이 뒤로 가도, 파일이 사라져도 바뀐다.
 */
const fingerprint = (files) =>
  createHash('sha1')
    .update(files.map((f) => `${f.file}\0${f.mtimeMs}\0${f.size}`).sort().join('\n'))
    .digest('hex');

/** 지문 도장 — serve.mjs 가 빌드하거나 확인한 dist 에 남긴다. vite 가 빌드마다 dist 를 비우므로 손으로 한 빌드 뒤에는 없다 */
const STAMP = path.join(dist, '.e2e-inputs');

function staleReason(files) {
  if (process.env.E2E_REBUILD === '1') return 'E2E_REBUILD=1';
  if (!existsSync(indexHtml)) return 'dist/ 없음';
  if (existsSync(STAMP)) {
    return readFileSync(STAMP, 'utf8').trim() === fingerprint(files) ? null : '빌드 입력이 지난 빌드 뒤 바뀜(지문 불일치)';
  }
  // 도장이 없는 dist(손으로 npm run build 한 것) — 시각으로만 판정한다
  const builtAt = statSync(indexHtml).mtimeMs;
  const hit = files.find((f) => f.mtimeMs > builtAt);
  return hit ? `${hit.file} 이(가) 빌드보다 새로움` : null;
}

// 지문은 빌드 **전에** 잰다 — 빌드하는 동안 입력이 또 바뀌면 남긴 도장이 지금 입력과 달라 다음 실행이 다시 빌드한다
const inputs = listInputs();
const reason = staleReason(inputs);
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
// 이번에 내줄 dist 가 어떤 입력에서 왔는지 남긴다
writeFileSync(STAMP, fingerprint(inputs));

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
  // 포트가 이미 쓰이면 스택 대신 한 줄로 말하고 끝낸다 — 요약에는 "no tests ran" 만 남아서 로그가 원인을 바로 말해야 한다
  .on('error', (error) => {
    console.error(`[e2e] 서버를 띄우지 못함(포트 ${port}): ${error.code ?? error.message} — 다른 프로세스가 쓰는 중이면 E2E_PORT 를 바꾼다`);
    process.exit(1);
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
