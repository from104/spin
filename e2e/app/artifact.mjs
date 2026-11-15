#!/usr/bin/env node
// app 층 **산출물 모드** 준비 — 지금 굽는 바이너리 대신 배송된 AppImage(자동 업데이트가 내려보내는 그 파일, 번들 WebKit·라이브러리째)를
// 띄울 수 있게 받고 풀어 둔다. docs/PLAN-TEST-SUITE.md §12.
//
//   node e2e/app/artifact.mjs <AppImage 경로 | 릴리스 태그(v0.6.13) | draft>
//
// - 태그·draft: 저장소(tauri.conf.json 업데이터 엔드포인트의 github.com/<owner>/<repo>)의 릴리스를 **목록에서** 찾는다 —
//   `GET /releases/tags/{tag}` 는 초안에 404 다(desktop-release.yml 의 같은 주석). draft = 가장 새 초안. 자산은 id 로 받는다
//   (`gh api -H 'Accept: application/octet-stream'`, 초안은 쓰기 권한 토큰에만 보인다). 받는 것: latest.json · *.sig 전부 ·
//   AppImage · deb · rpm(서명을 파일로 검증하려고). 큰 파일은 (id, 크기, 갱신 시각)이 같으면 다시 안 받는다.
// - AppImage 경로: 그 파일만(latest.json 검사는 건너뛴다 — 릴리스가 없다). 기대 버전 = package.json.
// - 풀기: `--appimage-extract`(FUSE 불필요) → squashfs-root. 띄우는 껍데기(launch.sh)는 받은 파일과 다른 자리에 쓴다.
//   NVIDIA 호스트에서는 번들 Mesa 가 /dev/dri 의 NVIDIA 렌더 노드를 집어 아무것도 못 그린다 — `bwrap --dev-bind / / --tmpfs /dev/dri`
//   로 가린다(소프트웨어 렌더로 간다, gofu 실측). /dev/dri 가 없거나(GitHub 러너) bwrap 이 안 돌면 가리지 않는다.
//   강제: E2E_APP_DRI_MASK=1 / 끄기: E2E_APP_DRI_MASK=0.
// - 결과: test-results/.app-artifact.json(명세) — scripts/test-suite.sh 가 E2E_APP_ARTIFACT 로 넘기고 global-setup 이 읽는다.
// 캐시: src-tauri/target/e2e-release/<태그|file-…>/ (git 이 무시하는 자리)
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, closeSync, existsSync, mkdirSync, openSync, readFileSync, readSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const spec = process.argv[2];
if (!spec) {
  console.error('쓰는 법: node e2e/app/artifact.mjs <AppImage 경로 | v0.6.13 | draft>');
  process.exit(2);
}
const fail = (message) => {
  console.error(`[artifact] ${message}`);
  process.exit(1);
};

const conf = JSON.parse(readFileSync(path.join(root, 'src-tauri/tauri.conf.json'), 'utf8'));
const endpoint = conf.plugins?.updater?.endpoints?.[0] ?? '';
const repoMatch = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/releases\//.exec(endpoint);
if (!repoMatch) fail(`업데이터 엔드포인트에서 GitHub 저장소를 못 읽었다: ${endpoint}`);
const repo = `${repoMatch[1]}/${repoMatch[2]}`;
const cacheRoot = path.join(root, 'src-tauri/target/e2e-release');

function gh(args, { output } = {}) {
  const out = output ? openSync(output, 'w') : 'pipe';
  const r = spawnSync('gh', args, { encoding: output ? undefined : 'utf8', stdio: ['ignore', out, 'pipe'], maxBuffer: 64 * 1024 * 1024 });
  if (output) closeSync(out);
  if (r.status !== 0) fail(`gh ${args.slice(0, 3).join(' ')} 실패: ${String(r.stderr ?? r.error).trim().split('\n')[0]}`);
  return r.stdout;
}

/** 자산 하나를 받는다 — 큰 파일은 같은 판이면 다시 안 받는다 */
function download(asset, dir, { always = false } = {}) {
  const file = path.join(dir, asset.name);
  const stamp = `${file}.e2e-asset`;
  const key = `${asset.id}\0${asset.size}\0${asset.updated_at}`;
  if (!always && existsSync(file) && existsSync(stamp) && readFileSync(stamp, 'utf8') === key && statSync(file).size === asset.size) return file;
  rmSync(stamp, { force: true });
  gh(['api', '-H', 'Accept: application/octet-stream', `repos/${repo}/releases/assets/${asset.id}`], { output: file });
  if (statSync(file).size !== asset.size) fail(`${asset.name} 크기가 다르다(받음 ${statSync(file).size}, 릴리스 ${asset.size})`);
  writeFileSync(stamp, key);
  return file;
}

let manifest;
if (spec.endsWith('.AppImage') || existsSync(spec)) {
  const appImage = path.resolve(spec);
  if (!existsSync(appImage)) fail(`AppImage 가 없다: ${appImage}`);
  const version = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).version;
  const id = createHash('sha1').update(appImage).digest('hex').slice(0, 12);
  manifest = { mode: 'file', repo, tag: null, version, draft: false, dir: path.join(cacheRoot, `file-${id}`), appImage, assets: [], files: {} };
} else {
  const releases = JSON.parse(gh(['api', `repos/${repo}/releases?per_page=100`]));
  const release = spec === 'draft' ? releases.find((r) => r.draft) : releases.find((r) => r.tag_name === spec);
  if (!release) fail(spec === 'draft' ? `${repo} 에 초안 릴리스가 없다` : `${repo} 에 ${spec} 릴리스가 없다(초안이면 쓰기 권한 토큰이 필요하다)`);
  const tag = release.tag_name;
  const dir = path.join(cacheRoot, tag.replace(/[^\w.-]/g, '_'));
  const assetsDir = path.join(dir, 'assets');
  mkdirSync(assetsDir, { recursive: true });
  const assets = release.assets.map((a) => ({ name: a.name, id: a.id, size: a.size, updated_at: a.updated_at }));
  const wanted = assets.filter((a) => a.name === 'latest.json' || a.name.endsWith('.sig') || /\.(AppImage|deb|rpm)$/.test(a.name));
  const appImages = wanted.filter((a) => a.name.endsWith('.AppImage'));
  if (appImages.length !== 1) fail(`${tag} 의 AppImage 자산이 ${appImages.length}개다(하나여야 한다)`);
  const files = {};
  for (const asset of wanted) {
    const small = asset.name === 'latest.json' || asset.name.endsWith('.sig');
    files[asset.name] = download(asset, assetsDir, { always: small });
  }
  console.log(`[artifact] ${repo} ${tag}${release.draft ? ' (초안)' : ''} — 자산 ${wanted.length}개 준비`);
  manifest = { mode: 'release', repo, tag, version: tag.replace(/^v/, ''), draft: release.draft, dir, appImage: files[appImages[0].name], assets, files };
}

// ── 풀기 ──
const { dir, appImage } = manifest;
const extractDir = path.join(dir, 'x');
const appDir = path.join(extractDir, 'squashfs-root');
const st = statSync(appImage);
const extractKey = `${appImage}\0${st.size}\0${st.mtimeMs}`;
const extractStamp = path.join(extractDir, '.e2e-extracted');
if (!existsSync(extractStamp) || readFileSync(extractStamp, 'utf8') !== extractKey) {
  rmSync(extractDir, { recursive: true, force: true });
  mkdirSync(extractDir, { recursive: true });
  // 실행하기 전에 정말 AppImage(type 2: ELF + 8번째 바이트부터 'AI\x02')인지 본다 — 아니면 `--appimage-extract` 를 모르는 실행 파일
  // (예: 구운 앱 바이너리 target/e2e-app/spin)이 **사용자의 진짜 환경·진짜 프로필**로 그대로 뜬다. 이 자리는 격리 세션 밖이다
  const head = Buffer.alloc(11);
  const fd = openSync(appImage, 'r');
  readSync(fd, head, 0, 11, 0);
  closeSync(fd);
  if (head.subarray(0, 4).toString('latin1') !== '\x7fELF' || head.subarray(8, 11).toString('latin1') !== 'AI\x02') {
    fail(`AppImage(type 2)가 아니다 — 실행하지 않는다: ${appImage}`);
  }
  chmodSync(appImage, 0o755);
  const r = spawnSync(appImage, ['--appimage-extract'], { cwd: extractDir, stdio: ['ignore', 'ignore', 'pipe'], encoding: 'utf8' });
  if (r.status !== 0 || !existsSync(path.join(appDir, 'AppRun'))) fail(`AppImage 를 못 풀었다(exit ${r.status}): ${String(r.stderr).trim().split('\n')[0]}`);
  writeFileSync(extractStamp, extractKey);
  console.log(`[artifact] 풀었다: ${path.relative(root, appDir)}`);
}
const exe = path.join(appDir, 'usr/bin/spin');
if (!existsSync(exe)) fail(`풀린 AppImage 에 usr/bin/spin 이 없다: ${appDir}`);

// ── /dev/dri 가리기 ──
const maskSetting = process.env.E2E_APP_DRI_MASK ?? 'auto';
let mask = false;
if (maskSetting === '1') mask = true;
else if (maskSetting === 'auto' && existsSync('/dev/dri')) {
  const probe = spawnSync('bwrap', ['--dev-bind', '/', '/', '--tmpfs', '/dev/dri', '--', 'true'], { stdio: 'ignore' });
  mask = probe.status === 0;
  if (!mask) console.warn('[artifact] /dev/dri 가 있는데 bwrap 이 안 돈다 — 가리지 않고 띄운다(NVIDIA 호스트면 빈 창일 수 있다)');
}
const q = (s) => `'${s.replace(/'/g, `'\\''`)}'`;
const launcher = path.join(dir, 'launch.sh');
writeFileSync(
  launcher,
  [
    '#!/bin/sh',
    '# e2e/app/artifact.mjs 가 쓴 껍데기 — tauri-driver(WebKitWebDriver)가 이것을 앱으로 띄운다',
    mask
      ? `exec bwrap --dev-bind / / --tmpfs /dev/dri -- ${q(path.join(appDir, 'AppRun'))} "$@"`
      : `exec ${q(path.join(appDir, 'AppRun'))} "$@"`,
    '',
  ].join('\n'),
);
chmodSync(launcher, 0o755);

manifest = { ...manifest, appDir, exe, launcher, mask };
mkdirSync(path.join(root, 'test-results'), { recursive: true });
writeFileSync(path.join(root, 'test-results/.app-artifact.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`[artifact] ${manifest.tag ?? path.basename(appImage)} → 기대 버전 ${manifest.version} · /dev/dri 가림 ${mask ? '예' : '아니오'}`);
