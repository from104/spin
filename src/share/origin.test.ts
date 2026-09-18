// 「우리 도메인」이 네 곳에서 같은 값이어야 한다 — 상수 · 매니페스트 · 딥링크 브리지 · (배포의
// assetlinks). 한쪽만 고치면 링크가 앱에 안 오거나, 오는데 앱이 무시하거나, 공유가 엉뚱한
// 서버로 간다. 셋은 여기서 대조하고, assetlinks 는 배포물이라 PLAN-ANDROID §5 가 맡는다.
import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CANONICAL_WEB_HOST, CANONICAL_WEB_ORIGIN } from './origin.ts';
import { nativeWebOrigin, shareApiBase, shareLinkOrigin } from './api.ts';

const read = (p: string): string => readFileSync(resolve(process.cwd(), p), 'utf-8');

describe('도메인이 한 곳에서 온다', () => {
  it('AndroidManifest 의 App Links 호스트와 같다', () => {
    expect(read('src-android/app/src/main/AndroidManifest.xml')).toContain(`android:host="${CANONICAL_WEB_HOST}"`);
  });

  it('딥링크 브리지가 리터럴이 아니라 이 상수를 쓴다', () => {
    const src = read('src/platform/android/nativeBridge.ts');
    expect(src).toContain('const APP_LINK_HOST = CANONICAL_WEB_HOST;');
    // 리터럴로 되돌아가면 두 곳이 조용히 갈라진다 — 그 상태가 바로 이 파일이 막으려는 것이다.
    expect(src).not.toContain(`'${CANONICAL_WEB_HOST}'`);
  });

  it('출처는 호스트에서 조립된다 — 둘을 따로 적지 않는다', () => {
    expect(CANONICAL_WEB_ORIGIN).toBe(`https://${CANONICAL_WEB_HOST}`);
  });
});

describe('네이티브 셸에서만 배포처로 물러난다', () => {
  afterEach(() => {
    delete (globalThis as { Capacitor?: unknown }).Capacitor;
  });

  const asNative = (): void => {
    (globalThis as { Capacitor?: { isNativePlatform: () => boolean } }).Capacitor = { isNativePlatform: () => true };
  };

  it('웹에서는 여전히 상대 경로다 — 도메인 독립이 깨지지 않는다', () => {
    expect(nativeWebOrigin()).toBeUndefined();
    expect(shareApiBase()).toBe('/api/share');
  });

  it('네이티브 셸에서는 배포처를 쓴다 — https://localhost 로 새지 않는다', () => {
    asNative();
    expect(nativeWebOrigin()).toBe(CANONICAL_WEB_ORIGIN);
    expect(shareApiBase()).toBe(`${CANONICAL_WEB_ORIGIN}/api/share`);
    // 링크 앞에 붙는 출처도 같이 맞아야 App Links 가 그 링크를 도로 받아 간다.
    expect(shareLinkOrigin()).toBe(CANONICAL_WEB_ORIGIN);
  });

  it('env 가 있으면 env 가 이긴다 — 스테이징·자체 호스팅을 막지 않는다', () => {
    asNative();
    const env = import.meta.env as Record<string, unknown>;
    env.SPIN_ANDROID_WEB_ORIGIN = 'https://staging.example/';
    try {
      // 뒤 슬래시는 지워진다(프록시가 `//` 를 다른 경로로 셈한다).
      expect(nativeWebOrigin()).toBe('https://staging.example');
    } finally {
      delete env.SPIN_ANDROID_WEB_ORIGIN;
    }
  });
});
