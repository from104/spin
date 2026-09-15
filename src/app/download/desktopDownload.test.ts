// 「어느 기계에 무슨 파일을 권하는가」 (2026-09-16).
//
// 지우면 새는 것 셋 — 셋 다 **화면에는 아무 표시도 안 나는** 고장이다:
// ① 안드로이드에 `.msi` 를 권한다. 안드로이드 UA 에는 `linux` 가 들어 있어서, 판정 순서를
//    한 줄만 바꾸면 폰 사용자에게 데스크톱 설치 파일을 들이민다.
// ② 파일 이름이 CI 가 굽는 것과 어긋나 링크가 404 가 된다. 누르면 깃허브 404 페이지가 뜰 뿐
//    앱은 멀쩡하다. 특히 리눅스는 **다른 둘과 꼴이 다르다**(하이픈·x86_64) — AppImageHub 규약에
//    맞추려고 CI 가 업로드 뒤 이름을 고치기 때문이다. 그 비대칭이 이 테스트의 주된 이유다.
// ③ 데스크톱 앱 안에서 버튼이 뜬다(자기 자신을 받으라는 말).
//
// ⚠️ 여기 적은 이름은 `desktop-release.yml` 이 굽는 것과 **같아야** 한다. 한쪽을 바꾸면 이
//    테스트가 빨개지는 것이 계약이다 — 빨개지면 양쪽을 같이 본다.
import { describe, expect, it } from 'vitest';
import { desktopAsset, desktopPlatform, releasePageUrl } from './desktopDownload.ts';

const UA = {
  win: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36',
  mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15',
  linux: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/131 Safari/537.36',
  android: 'Mozilla/5.0 (Linux; Android 14; SM-A360) AppleWebKit/537.36 Chrome/131 Mobile Safari/537.36',
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
  ipad: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
};

describe('플랫폼 판정', () => {
  it('데스크톱 셋을 가른다', () => {
    expect(desktopPlatform(UA.win)).toBe('windows');
    expect(desktopPlatform(UA.mac)).toBe('macos');
    expect(desktopPlatform(UA.linux)).toBe('linux');
  });

  it('⚠️ 안드로이드는 **리눅스가 아니다** — UA 에 "Linux" 가 들어 있어도 null 이다', () => {
    expect(desktopPlatform(UA.android), '폰에 AppImage 를 권하고 있다').toBeNull();
  });

  it('⚠️ 아이폰·아이패드는 **맥이 아니다** — UA 에 "Mac OS X" 가 들어 있어도 null 이다', () => {
    expect(desktopPlatform(UA.iphone)).toBeNull();
    expect(desktopPlatform(UA.ipad)).toBeNull();
  });

  it('모르는 기계에는 아무것도 안 권한다', () => {
    expect(desktopPlatform('CustomBot/1.0')).toBeNull();
    expect(desktopPlatform('')).toBeNull();
  });

  it('userAgentData.platform 이 있으면 그것도 본다 — 최신 크로미움은 UA 를 줄여 준다', () => {
    expect(desktopPlatform('Mozilla/5.0 (Unknown)', 'Windows')).toBe('windows');
    expect(desktopPlatform('Mozilla/5.0 (Unknown)', 'macOS')).toBe('macos');
  });
});

describe('받을 파일', () => {
  // ⚠️ 이름을 **리터럴로** 적는다. 구현과 같은 식을 여기서 다시 조립하면 둘 다 틀려도 초록이다.
  it('CI 가 굽는 이름 그대로다 — 리눅스만 꼴이 다른 것이 요점이다', () => {
    expect(desktopAsset('windows', '0.6.9').fileName).toBe('SPIN_0.6.9_x64_en-US.msi');
    expect(desktopAsset('macos', '0.6.9').fileName).toBe('SPIN_0.6.9_universal.dmg');
    // 하이픈 · x86_64 — AppImageHub 규약(다른 둘은 밑줄 · amd64 계열)
    expect(desktopAsset('linux', '0.6.9').fileName).toBe('SPIN-0.6.9-x86_64.AppImage');
  });

  it('주소는 그 버전의 릴리스 태그를 가리킨다 — 웹과 같은 판을 받게 된다', () => {
    expect(desktopAsset('linux', '0.6.9').url).toBe(
      'https://github.com/from104/spin/releases/download/v0.6.9/SPIN-0.6.9-x86_64.AppImage',
    );
    expect(releasePageUrl('0.6.9')).toBe('https://github.com/from104/spin/releases/tag/v0.6.9');
  });

  it('버전이 바뀌면 이름과 주소가 함께 따라간다 — 어느 한쪽만 굳으면 404 다', () => {
    const a = desktopAsset('windows', '1.0.0');
    expect(a.fileName).toContain('1.0.0');
    expect(a.url).toContain('/v1.0.0/');
    expect(a.url.endsWith(a.fileName), '주소 끝이 그 파일 이름이어야 한다').toBe(true);
  });
});
