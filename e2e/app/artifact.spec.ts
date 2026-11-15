// 산출물 모드(§12) — 배송된 AppImage 와 그 릴리스. `scripts/test-suite.sh --layer app --artifact <v0.6.13 | draft | AppImage 경로>`.
// docs/PLAN-TEST-SUITE.md §12. 이 스펙은 E2E_APP_ARTIFACT 가 있을 때만 돈다(playwright.app.config.ts).
//
// 지우면 새는 배송 사고(로컬 디버그 바이너리 + 시스템 WebKit 으로는 안 보이는 것):
//  R1  latest.json 이 다른 판·없는 자산을 가리킨다 — 업데이터가 404 로 조용히 죽는다(v0.6.11 이 AppImage 이름을 고친 뒤
//      옛 이름을 가리킨 채로 나갈 뻔했다, desktop-release.yml 주석)
//  R2  리눅스 묶음(AppImage·deb·rpm)의 서명이 tauri.conf.json 의 공개 키로 안 풀린다 — 업데이터가 받은 파일을 버린다
//  R3  다른 플랫폼의 latest.json 서명이 올린 .sig 와 다르다(다른 회차의 서명이 섞였다)
//  N1–N3  번들 WebKit·라이브러리째로 AppImage 가 뜨고 판을 그리고, 태그 버전을 말하고, 업데이터 확인이 돈다(받기·설치는 절대 안 함)
import { readFileSync } from 'node:fs';

import { test } from '@playwright/test';

import { check } from '../scenarios/kit.ts';
import { parsePublicKey, verifyMinisign } from './minisign.ts';
import native from './native.ts';
import { artifactManifest } from './platform.ts';
import { runGroup } from './run.ts';

interface LatestJson {
  version: string;
  platforms: Record<string, { url: string; signature: string }>;
}

const manifest = artifactManifest();
const conf = JSON.parse(readFileSync('src-tauri/tauri.conf.json', 'utf8')) as { plugins: { updater: { pubkey: string } } };
/** 파일로 서명을 검증하는 묶음 — 리눅스 셋(받아 둔 것). 나머지는 .sig 자산과 맞댄다 */
const VERIFY_BY_FILE = /\.(AppImage|deb|rpm)$/;

test.describe('release', () => {
  test.skip(manifest?.mode !== 'release', '릴리스가 아니라 AppImage 파일 하나 — latest.json 이 없다');
  const latest = (): LatestJson => {
    const file = manifest!.files['latest.json'];
    check(!!file, '릴리스에 latest.json 자산이 없다');
    return JSON.parse(readFileSync(file, 'utf8')) as LatestJson;
  };
  const assetName = (url: string): string => decodeURIComponent(new URL(url).pathname.split('/').pop() ?? '');

  test('R1 latest.json 이 이 릴리스를 가리킨다', () => {
    const doc = latest();
    check(doc.version.replace(/^v/, '') === manifest!.version, `latest.json 의 version 이 태그 ${manifest!.tag} 와 다르다`, doc.version);
    const names = new Set(manifest!.assets.map((a) => a.name));
    const prefix = `https://github.com/${manifest!.repo}/releases/download/${manifest!.tag}/`;
    const entries = Object.entries(doc.platforms);
    check(entries.length > 0, 'latest.json 에 플랫폼이 없다');
    for (const [platform, entry] of entries) {
      check(entry.url.startsWith(prefix), `${platform}: 주소가 이 릴리스(${prefix})가 아니다`, entry.url);
      check(names.has(assetName(entry.url)), `${platform}: 가리키는 자산이 릴리스에 없다`, assetName(entry.url));
    }
  });

  test('R2 리눅스 묶음 서명이 공개 키로 풀린다', () => {
    const doc = latest();
    const key = parsePublicKey(conf.plugins.updater.pubkey);
    const linux = Object.entries(doc.platforms).filter(([, e]) => VERIFY_BY_FILE.test(assetName(e.url)));
    check(linux.some(([, e]) => assetName(e.url).endsWith('.AppImage')), 'latest.json 에 AppImage 항목이 없다');
    const verified = new Map<string, Buffer>();
    for (const [platform, entry] of linux) {
      const name = assetName(entry.url);
      const file = manifest!.files[name];
      check(!!file, `${platform}: ${name} 을 받지 못했다`);
      const bytes = verified.get(name) ?? readFileSync(file);
      verified.set(name, bytes);
      const why = verifyMinisign(bytes, entry.signature, key);
      check(why === null, `${platform}: ${name} 의 서명 — ${why}`);
    }
    // 판정자 자체 검증 — AppImage 를 다른 묶음의 서명으로 풀면 **반드시** 떨어져야 한다(검증이 늘 통과하는 고장이면 여기서 빨갛다)
    const appImage = [...verified.keys()].find((n) => n.endsWith('.AppImage'))!;
    const other = linux.find(([, e]) => assetName(e.url) !== appImage)?.[1];
    check(!!other, '맞댈 다른 리눅스 묶음이 없다(AppImage 하나뿐)');
    check(verifyMinisign(verified.get(appImage)!, other.signature, key) !== null, `${appImage} 이 다른 묶음의 서명으로 풀렸다 — 검증기가 아무것이나 통과시킨다`);
  });

  test('R3 다른 묶음의 서명 = 올린 .sig', () => {
    const doc = latest();
    const notes: string[] = [];
    for (const [platform, entry] of Object.entries(doc.platforms)) {
      const name = assetName(entry.url);
      const sigFile = manifest!.files[`${name}.sig`];
      if (VERIFY_BY_FILE.test(name)) {
        // 파일로 검증했다(R2). .sig 가 같은 이름으로 없으면 적어만 둔다 — 업데이터는 latest.json 의 서명만 쓴다
        if (!sigFile) notes.push(`${platform}: ${name}.sig 없음`);
        continue;
      }
      check(!!sigFile, `${platform}: ${name}.sig 자산이 없다`);
      check(readFileSync(sigFile, 'utf8').trim() === entry.signature.trim(), `${platform}: latest.json 서명이 ${name}.sig 와 다르다`);
    }
    if (notes.length) test.info().annotations.push({ type: 'note', description: [...new Set(notes)].join(' · ') });
  });
});

runGroup(native, { only: ['N1', 'N2', 'N3'] });
