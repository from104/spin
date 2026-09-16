// 안드로이드 브리지 회귀(PLAN-ANDROID 결정 9·12). jsdom 이 잴 수 있는 것만 본다(결정 23).
//
// 지우면 새는 것 셋:
//  ① 딥링크의 **해시**를 떨구면 착지 시트가 정상 링크에 "열쇠가 맞지 않습니다" 를 띄운다.
//     열쇠는 서버에 없고 `#` 뒤에만 있다(share/link.ts).
//  ② 로케일 접두(`/ja/s/…`)를 안 걷으면 라우터가 `ja` 를 첫 조각으로 읽어 대문으로 떨어진다 —
//     일본어 페이지에서 복사한 링크만 조용히 안 열린다.
//  ③ 첫 화면 뒤로가기에서 `minimizeApp()` 대신 아무것도 안 하거나 `exitApp()` 이 불리면,
//     앱이 안 닫히거나 반대로 죽는다(결정 12). 실기 A-9 의 jsdom 쪽 절반이다.
//  ④ 찬 시작의 딥링크를 **두 번** 태우면(보관 이벤트 + `getLaunchUrl()`) 히스토리에 칸이 하나
//     더 끼어, 착지 화면의 뒤로가기가 헛돌고 지운 열쇠가 주소에 되살아난다. 2026-09-17 검수
//     전까지 이 파일은 정반대(«찬 시작은 getLaunchUrl 로만 온다»)를 고정하고 있었다.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deepLinkPath, mountNativeBridge } from './nativeBridge.ts';

type Listener = (ev: never) => void;

const listeners = new Map<string, Listener>();
const removed: string[] = [];
const minimizeApp = vi.fn().mockResolvedValue(undefined);
const getLaunchUrl = vi.fn<() => Promise<{ url: string } | undefined>>();

/** **보관 이벤트**(retainUntilConsumed). 실물에서 찬 시작의 딥링크가 오는 길이다: 런치 인텐트를
 *  받은 AppPlugin 이 이벤트를 쥐고 있다가(`AppPlugin.java:142-154`) JS 가 첫 리스너를 거는 순간
 *  넘긴다(`Plugin.java:626-640`). **한 번만** 넘어간다 — 넘긴 뒤에는 지워진다. */
const retained = new Map<string, unknown>();

vi.mock('@capacitor/app', () => ({
  App: {
    addListener: (name: string, fn: Listener) => {
      listeners.set(name, fn);
      const held = retained.get(name);
      if (held !== undefined) {
        retained.delete(name);
        (fn as (e: unknown) => void)(held);
      }
      return Promise.resolve({
        remove: () => {
          removed.push(name);
          listeners.delete(name);
          return Promise.resolve();
        },
      });
    },
    minimizeApp: () => minimizeApp(),
    getLaunchUrl: () => getLaunchUrl(),
  },
}));

/** 브리지는 플러그인을 **동적 import** 로 연다 — 모듈 해석은 마이크로태스크가 아니라 실제
 *  틱을 먹으므로(`await Promise.resolve()` 로는 절대 안 끝난다) 타이머로 비운다. */
async function settle(): Promise<void> {
  for (let i = 0; i < 3; i += 1) await new Promise((r) => setTimeout(r, 0));
}

function fire<T>(name: string, ev: T): void {
  const fn = listeners.get(name);
  if (!fn) throw new Error(`리스너가 등록되지 않았다: ${name}`);
  (fn as (e: T) => void)(ev);
}

describe('deepLinkPath — 딥링크 URL → 앱 내부 경로', () => {
  it('우리 공유 링크만 받고 해시(열쇠)를 살려 넘긴다', () => {
    expect(deepLinkPath('https://spin.atit.app/s/Ab3dEf9hIj#k3y-43')).toBe('/s/Ab3dEf9hIj#k3y-43');
    // 열쇠가 없는 링크(잘린 것)도 경로는 넘긴다 — 판정은 착지 시트가 한다.
    expect(deepLinkPath('https://spin.atit.app/s/Ab3dEf9hIj')).toBe('/s/Ab3dEf9hIj');
    // 메신저가 끝에 붙인 슬래시. 인텐트는 이미 앱에 왔으므로 여기서 떨구면 대문이 뜬다.
    expect(deepLinkPath('https://spin.atit.app/s/Ab3dEf9hIj/#k3y')).toBe('/s/Ab3dEf9hIj#k3y');
  });

  it('로케일 접두는 걷어낸다 — 앱의 라우터 basename 은 언제나 `/` 다', () => {
    expect(deepLinkPath('https://spin.atit.app/ja/s/Xy#k')).toBe('/s/Xy#k');
    expect(deepLinkPath('https://spin.atit.app/en/s/Xy')).toBe('/s/Xy');
  });

  it('우리 것이 아닌 URL 은 전부 null — 로그인 스킴은 authAndroid 몫이다', () => {
    expect(deepLinkPath('https://evil.example/s/Xy#k')).toBeNull(); // 남의 호스트
    expect(deepLinkPath('http://spin.atit.app/s/Xy')).toBeNull(); // 검증되지 않는 http
    expect(deepLinkPath('app.atit.spin:/oauth2redirect?code=abc&state=s')).toBeNull(); // 인가 코드
    expect(deepLinkPath('https://spin.atit.app/library')).toBeNull(); // 공유 착지가 아닌 화면
    expect(deepLinkPath('https://spin.atit.app/s/')).toBeNull(); // id 가 비었다
    expect(deepLinkPath('나는 URL 이 아니다')).toBeNull();
  });
});

describe('mountNativeBridge', () => {
  beforeEach(() => {
    listeners.clear();
    removed.length = 0;
    minimizeApp.mockClear();
    retained.clear();
    getLaunchUrl.mockReset();
    getLaunchUrl.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('뒤로가기: 히스토리가 있으면 되돌리고, 첫 화면에서는 앱을 홈으로 내린다', async () => {
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {});
    const dispose = mountNativeBridge(() => {});
    await settle();

    fire('backButton', { canGoBack: true });
    expect(back).toHaveBeenCalledTimes(1);
    expect(minimizeApp).not.toHaveBeenCalled();

    fire('backButton', { canGoBack: false });
    expect(back).toHaveBeenCalledTimes(1); // 늘지 않았다 = 히스토리를 건드리지 않았다
    expect(minimizeApp).toHaveBeenCalledTimes(1);

    dispose();
  });

  it('appUrlOpen 은 우리 링크일 때만 navigate 한다', async () => {
    const navigate = vi.fn();
    const dispose = mountNativeBridge(navigate);
    await settle();

    fire('appUrlOpen', { url: 'https://spin.atit.app/ja/s/Zz#key' });
    expect(navigate).toHaveBeenCalledWith('/s/Zz#key');

    navigate.mockClear();
    fire('appUrlOpen', { url: 'app.atit.spin:/oauth2redirect?code=abc' });
    expect(navigate).not.toHaveBeenCalled();

    dispose();
  });

  it('★ 찬 시작(앱이 꺼져 있었다)의 링크는 보관된 appUrlOpen 으로 오고 navigate 는 **정확히 한 번**', async () => {
    const cold = 'https://spin.atit.app/s/Cold1#key';
    retained.set('appUrlOpen', { url: cold });
    // 실물에서는 같은 URL 을 `getLaunchUrl()` 로도 물을 수 있다 — 물으면 **두 번** 가게 된다.
    getLaunchUrl.mockResolvedValue({ url: cold });
    const navigate = vi.fn();
    const dispose = mountNativeBridge(navigate);
    await settle();

    expect(navigate).toHaveBeenCalledWith('/s/Cold1#key');
    // 두 번 가면 히스토리가 [`/`, `/s/X`, `/s/X#key`] 세 칸이 돼, 착지 화면의 뒤로가기 한 번이
    // «아무 일도 안 난다» 가 되고 `useShareLanding` 이 지운 열쇠가 주소에 되살아난다(A-8·A-9).
    expect(navigate).toHaveBeenCalledTimes(1);
    dispose();
  });

  it('dispose 는 리스너를 전부 뗀다 — 언마운트 뒤 뒤로가기가 두 번 돌지 않는다', async () => {
    const dispose = mountNativeBridge(() => {});
    await settle();
    dispose();
    await settle();

    expect(removed).toEqual(expect.arrayContaining(['backButton', 'appUrlOpen']));
    expect(listeners.size).toBe(0);
  });
});
