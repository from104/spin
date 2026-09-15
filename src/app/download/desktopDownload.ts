// 「지금 이 기계에 맞는 데스크톱 앱 파일」 (2026-09-16 기현 지시:
// *"웹앱일 경우에 … 플랫폼에 맞는 다운로드 버튼 추가"*).
//
// 순수 함수만 둔다 — 화면은 `DownloadModal.tsx`, 버튼 자리는 `AppRail`·`AppNavSegment` 다.
// 그래야 «윈도우면 무슨 파일인가» 를 창을 띄우지 않고 잴 수 있다.
//
// ⚠️ **파일 이름은 CI 가 굽는 그 이름이어야 한다.** 여기 적은 꼴이 `desktop-release.yml` 의
// 산출물과 한 글자라도 어긋나면 링크가 404 인데, **화면에는 아무 표시도 안 난다** — 누르면
// 깃허브 404 페이지가 뜰 뿐이다. 그래서 이름의 근거를 하나하나 적어 둔다:
//   · 윈도우 `SPIN_{v}_x64_en-US.msi`   — Tauri WiX 기본 이름(로케일이 이름에 들어간다)
//   · 맥    `SPIN_{v}_universal.dmg`    — 인텔·애플 실리콘 공용 한 벌
//   · 리눅스 `SPIN-{v}-x86_64.AppImage` — ⚠️ **다른 둘과 꼴이 다르다.** AppImageHub 규약
//     (하이픈·`x86_64`)에 맞추려고 CI 가 업로드 뒤 이름을 고친다(`desktop-release.yml` 의
//     「AppImage 이름을 카탈로그 규약으로」). Tauri 원래 이름은 `SPIN_{v}_amd64.AppImage` 다.
//
// ⚠️ 버전은 웹 앱 자신의 `__APP_VERSION__` 을 쓴다. 릴리스 태그가 곧 그 버전이라 «지금 쓰는
// 웹과 같은 판» 을 받게 되는 것이 장점이고, 대가는 **데스크톱 릴리스 없이 웹만 배포한 회차에서
// 링크가 404** 라는 것이다. 그래서 모달이 릴리스 페이지로 가는 길을 함께 준다(그쪽은 항상 산다).
import { isTauriWebview } from '../../storage/files.ts';

export type DesktopPlatform = 'windows' | 'macos' | 'linux';

/** 이 기계의 데스크톱 운영체제. 셋 중 어느 것도 아니면(모바일·미상) `null`.
 *
 *  `null` 이면 버튼을 **아예 안 보인다** — 폰에서 `.msi` 를 권하는 것은 안내가 아니라 함정이다.
 *  판정은 `userAgentData.platform`(있으면 위조가 덜 된 값) → `userAgent` 순이다. */
export function desktopPlatform(ua: string, uaDataPlatform?: string): DesktopPlatform | null {
  const s = `${uaDataPlatform ?? ''} ${ua}`.toLowerCase();
  // ⚠️ 안드로이드가 먼저다 — 안드로이드 UA 에는 `linux` 가 들어 있어, 순서를 바꾸면
  //    폰에 AppImage 를 권하게 된다.
  if (/android|iphone|ipad|ipod/.test(s)) return null;
  if (/win/.test(s)) return 'windows';
  if (/mac/.test(s)) return 'macos';
  if (/linux|x11|cros/.test(s)) return 'linux';
  return null;
}

/** 브라우저 전역에서 읽은 실제 판정. 테스트는 위 순수 함수를 쓴다. */
export function currentDesktopPlatform(): DesktopPlatform | null {
  if (typeof navigator === 'undefined') return null;
  const data = (navigator as { userAgentData?: { platform?: string } }).userAgentData;
  return desktopPlatform(navigator.userAgent, data?.platform);
}

/** 이 화면에 다운로드 버튼을 둘 것인가.
 *
 *  둘 다 참이어야 한다: **웹앱이고**(데스크톱 앱 안에서 자기 자신을 받으라는 것은 말이 안 된다)
 *  **데스크톱 운영체제**일 것. */
export function showDesktopDownload(): boolean {
  return !isTauriWebview() && currentDesktopPlatform() !== null;
}

export interface DesktopAsset {
  platform: DesktopPlatform;
  /** 받는 파일 이름. 모달이 그대로 보여 준다 — 무엇이 떨어지는지 미리 알리려는 것이다. */
  fileName: string;
  url: string;
}

const ASSET: Record<DesktopPlatform, (v: string) => string> = {
  windows: (v) => `SPIN_${v}_x64_en-US.msi`,
  macos: (v) => `SPIN_${v}_universal.dmg`,
  linux: (v) => `SPIN-${v}-x86_64.AppImage`,
};

const RELEASE_BASE = 'https://github.com/from104/spin/releases';

/** 그 판의 릴리스 페이지. 파일 링크가 404 일 때의 도피처이자 «다른 형식(deb·rpm·exe)» 의 자리다. */
export const releasePageUrl = (version: string): string => `${RELEASE_BASE}/tag/v${version}`;

export function desktopAsset(platform: DesktopPlatform, version: string): DesktopAsset {
  const fileName = ASSET[platform](version);
  return { platform, fileName, url: `${RELEASE_BASE}/download/v${version}/${fileName}` };
}
