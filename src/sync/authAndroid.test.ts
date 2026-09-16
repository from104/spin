// 안드로이드 로그인(Custom Tabs + 커스텀 스킴)의 계약. 실기로는 **구글 콘솔의 안드로이드
// 클라이언트와 서명된 APK 가 있어야만** 밟을 수 있는 경로라(PLAN-ANDROID §4 A-6·A-7), 여기서
// 잡지 못하면 잡을 자리가 사실상 없다. `authDesktop.test.ts` 가 본보기이고, **거기서 이미 보는
// 것(PKCE 해시 계산·갱신 토큰 수명)은 다시 보지 않는다** — 공통 조각은 authInstalled.ts 한 벌이다.
//
// 여기서만 보는 다섯:
//   · 토큰 교환 본문에 `client_secret` 이 **없다** — 안드로이드 클라이언트에는 시크릿이 없고,
//     데스크톱 코드를 베껴 오면 있던 자리라 조용히 따라오기 쉽다. 있으면 구글이 거부한다.
//   · `isConfigured()` 가 id 하나로 참 — 데스크톱의 "id + secret" 을 따라오면 안드로이드에서는
//     동기화 섹션이 **영영 비활성**으로 그려진다(화면은 오류 하나 없이 멀쩡하다).
//   · 남의 딥링크(App Links 공유 링크)가 로그인을 가로채지 않는다 — 둘 다 `appUrlOpen` 으로 온다.
//   · 사용자가 탭을 닫으면(`browserFinished`) 취소로 끝난다 — 거절이 없으면 영영 기다린다.
//   · 연결이 끝나면(성공이든 취소든) **네이티브 리스너가 남지 않는다.** 2026-09-17 검수 전까지
//     이것은 코드 읽기로만 보장됐다 — `disarm()` 을 지워도 전부 초록이었다. 아래 등록부가
//     이벤트 이름을 키로 한 Map 이라 누수된 리스너를 다음 `addListener` 가 덮어써 버리기
//     때문이다. 크기 단언(`size` 합이 0)이 그 구멍을 막는다.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const browserOpen = vi.fn();
const browserClose = vi.fn();
const prefsGet = vi.fn();
const prefsSet = vi.fn();
const prefsRemove = vi.fn();

/** 네이티브 리스너 등록부. 실물처럼 **remove() 하면 사라져야** 한다 — 남으면 다음 연결 시도가
 *  옛 리스너에 먼저 잡히는 버그를 이 스텁이 못 본다. */
const appListeners = new Map<string, (event: { url: string }) => void>();
const browserListeners = new Map<string, () => void>();

const handleFor = (bag: Map<string, unknown>, name: string) => ({
  remove: () => {
    bag.delete(name);
    return Promise.resolve();
  },
});

vi.mock('@capacitor/app', () => ({
  App: {
    addListener: (name: string, fn: (event: { url: string }) => void) => {
      appListeners.set(name, fn);
      return Promise.resolve(handleFor(appListeners, name));
    },
  },
}));
vi.mock('@capacitor/browser', () => ({
  Browser: {
    open: (...a: unknown[]) => browserOpen(...a),
    close: (...a: unknown[]) => browserClose(...a),
    addListener: (name: string, fn: () => void) => {
      browserListeners.set(name, fn);
      return Promise.resolve(handleFor(browserListeners, name));
    },
  },
}));
vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: (...a: unknown[]) => prefsGet(...a),
    set: (...a: unknown[]) => prefsSet(...a),
    remove: (...a: unknown[]) => prefsRemove(...a),
  },
}));

import {
  ANDROID_REDIRECT_URI,
  connectInteractive,
  getAccessToken,
  isAndroid,
  isConfigured,
  resetAndroidAuthForTest,
  revokeAccess,
} from './authAndroid.ts';
import { StorageError } from '../storage/errors.ts';

/** Custom Tab 으로 나간 authorize URL — 테스트가 state 를 여기서 되읽는다. */
const sentUrl = (): URL => new URL((browserOpen.mock.calls.at(-1)![0] as { url: string }).url);

/** 커스텀 스킴 복귀. state 는 매번 새로 나므로 **열린 URL 을 본 뒤에** 만들어야 한다. */
const back = (u: URL, code = 'abc'): string =>
  `${ANDROID_REDIRECT_URI}?code=${code}&state=${u.searchParams.get('state')}`;

/** 탭이 열린 **뒤에** 오는 일들. 문자열이면 `appUrlOpen`, `null` 이면 «사용자가 탭을 닫았다»
 *  (`browserFinished`). 여러 개를 주면 온 순서대로 울린다. */
function tabReturns(...replies: ((url: URL) => string | null)[]): void {
  browserOpen.mockImplementation((opts: { url: string }) => {
    const opened = new URL(opts.url);
    // 네이티브도 탭이 뜬 **다음에** 이벤트를 준다 — open() 안에서 동기로 부르면 실물과 다르다.
    queueMicrotask(() => {
      for (const reply of replies) {
        const url = reply(opened);
        if (url === null) browserListeners.get('browserFinished')?.();
        else appListeners.get('appUrlOpen')?.({ url });
      }
    });
    return Promise.resolve();
  });
}

const okToken = (body: Record<string, unknown>) =>
  vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve(body) });

/** 토큰 종점으로 나간 본문(이메일 힌트용 about 호출과 섞이지 않게 URL 로 가른다). */
const tokenBody = (fetchMock: ReturnType<typeof vi.fn>): URLSearchParams => {
  const call = fetchMock.mock.calls.find((c) => String(c[0]).startsWith('https://oauth2.googleapis.com/token'));
  return new URLSearchParams((call![1] as { body: string }).body);
};

beforeEach(() => {
  resetAndroidAuthForTest();
  for (const m of [browserOpen, browserClose, prefsGet, prefsSet, prefsRemove]) m.mockReset();
  appListeners.clear();
  browserListeners.clear();
  browserOpen.mockResolvedValue(undefined);
  browserClose.mockResolvedValue(undefined);
  prefsGet.mockResolvedValue({ value: null });
  prefsSet.mockResolvedValue(undefined);
  prefsRemove.mockResolvedValue(undefined);
  vi.stubEnv('SPIN_ANDROID_GOOGLE_CLIENT_ID', 'android-id');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('셸 판정과 구성', () => {
  it('Capacitor 전역이 있어도 isNativePlatform() 이 참이라야 안드로이드다', () => {
    expect(isAndroid()).toBe(false);
    // 웹에서 Capacitor 가 로드된 경우 — 전역은 생기지만 네이티브가 아니다.
    vi.stubGlobal('Capacitor', { isNativePlatform: () => false });
    expect(isAndroid()).toBe(false);
    vi.stubGlobal('Capacitor', { isNativePlatform: () => true });
    expect(isAndroid()).toBe(true);
  });

  it('★ client id **하나**로 구성된 것이다 — 시크릿을 요구하면 섹션이 영영 비활성이 된다', () => {
    expect(isConfigured()).toBe(true);
    vi.stubEnv('SPIN_ANDROID_GOOGLE_CLIENT_ID', '  ');
    expect(isConfigured()).toBe(false);
  });
});

describe('connectInteractive — Custom Tab + 커스텀 스킴', () => {
  it('★ authorize URL 이 커스텀 스킴으로 돌아오게 만들어져 있다(PKCE S256 · offline + consent)', async () => {
    tabReturns((u) => back(u));
    vi.stubGlobal('fetch', okToken({ access_token: 'A', expires_in: 3600 }));

    await connectInteractive();

    const url = sentUrl();
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url.searchParams.get('client_id')).toBe('android-id');
    // 매니페스트의 intent-filter 와 어긋나면 구글은 성공을 보내는데 앱이 못 받는다.
    expect(url.searchParams.get('redirect_uri')).toBe('app.atit.spin:/oauth2redirect');
    expect(url.searchParams.get('scope')).toBe('https://www.googleapis.com/auth/drive.appdata');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('code_challenge')).toBeTruthy();
    expect(url.searchParams.get('access_type')).toBe('offline');
    expect(url.searchParams.get('prompt')).toBe('consent');
  });

  it('★ 토큰 교환에 client_secret 이 **없다** — 안드로이드 클라이언트에는 시크릿이 없다', async () => {
    tabReturns((u) => back(u, 'code-9'));
    const fetchMock = okToken({ access_token: 'A', expires_in: 3600 });
    vi.stubGlobal('fetch', fetchMock);

    expect(await connectInteractive()).toMatchObject({ token: 'A' });

    const body = tokenBody(fetchMock);
    expect(body.has('client_secret')).toBe(false);
    expect(body.get('code')).toBe('code-9');
    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.get('redirect_uri')).toBe('app.atit.spin:/oauth2redirect');
    expect(body.get('code_verifier')).toBeTruthy();
    // 돌아왔으면 로그인 창을 닫는다 — 안 닫으면 앱 위에 남아 «끝난 건가?» 가 된다.
    expect(browserClose).toHaveBeenCalled();
    // ★ 연결이 끝나면 네이티브 리스너가 **남지 않는다**(스텁의 remove() 가 등록부에서 지운다).
    //    새면 다음 연결 시도의 복귀를 옛 리스너가 먼저 잡아, 지금 기다리는 약속은 영영 안 풀린다.
    expect(appListeners.size + browserListeners.size).toBe(0);
  });

  it('★ 갱신 토큰은 **있을 때만** 저장한다(키 spin.sync.refresh) — 없을 때 덮으면 연결이 끊긴다', async () => {
    tabReturns((u) => back(u));
    vi.stubGlobal('fetch', okToken({ access_token: 'A', expires_in: 3600, refresh_token: 'R' }));
    await connectInteractive();
    expect(prefsSet).toHaveBeenCalledWith({ key: 'spin.sync.refresh', value: 'R' });

    prefsSet.mockClear();
    resetAndroidAuthForTest();
    tabReturns((u) => back(u));
    vi.stubGlobal('fetch', okToken({ access_token: 'A2', expires_in: 3600 })); // 갱신 토큰 없음
    await connectInteractive();
    expect(prefsSet).not.toHaveBeenCalled();
  });

  it('★ state 가 다르면 거부한다 — 코드를 토큰으로 바꾸지도 않는다', async () => {
    tabReturns(() => `${ANDROID_REDIRECT_URI}?code=abc&state=남의값`);
    const fetchMock = okToken({ access_token: 'A', expires_in: 3600 });
    vi.stubGlobal('fetch', fetchMock);

    await expect(connectInteractive()).rejects.toMatchObject({ code: 'E_SYNC_AUTH' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('★ 사용자가 탭을 닫으면(browserFinished) 취소로 끝난다 — 거절이 없으면 영영 기다린다', async () => {
    tabReturns(() => null);
    const fetchMock = okToken({ access_token: 'A', expires_in: 3600 });
    vi.stubGlobal('fetch', fetchMock);

    await expect(connectInteractive()).rejects.toBeInstanceOf(StorageError);
    expect(fetchMock).not.toHaveBeenCalled();
    // 실패한 길에서도 걷어낸다 — 취소는 사용자가 곧 다시 누르는 상황이라 여기서 새면
    // **두 번째 시도가 첫 번째의 리스너에 잡힌다.**
    expect(appListeners.size + browserListeners.size).toBe(0);
  });

  it('★ 공유 링크 딥링크(App Links)는 로그인을 가로채지 않는다 — 둘 다 appUrlOpen 으로 온다', async () => {
    tabReturns(
      () => 'https://spin.atit.app/s/abc#k=열쇠', // 로그인 도중 도착한 공유 링크
      (u) => back(u, 'code-real'),
    );
    const fetchMock = okToken({ access_token: 'A', expires_in: 3600 });
    vi.stubGlobal('fetch', fetchMock);

    expect(await connectInteractive()).toMatchObject({ token: 'A' });
    expect(tokenBody(fetchMock).get('code')).toBe('code-real');
  });
});

describe('getAccessToken — 갱신 토큰으로 무음 갱신', () => {
  it('저장된 갱신 토큰이 없으면 재연결을 요구한다', async () => {
    await expect(getAccessToken()).rejects.toMatchObject({ code: 'E_SYNC_AUTH' });
  });

  it('★ 갱신도 시크릿 없이 한다. 두 번째 호출은 캐시로 답한다', async () => {
    prefsGet.mockResolvedValue({ value: 'R' });
    const fetchMock = okToken({ access_token: 'A', expires_in: 3600 });
    vi.stubGlobal('fetch', fetchMock);

    expect(await getAccessToken()).toBe('A');
    expect(await getAccessToken()).toBe('A');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = tokenBody(fetchMock);
    expect(body.get('grant_type')).toBe('refresh_token');
    expect(body.has('client_secret')).toBe(false);
  });

  it('★ 갱신 토큰이 **죽었을 때만**(invalid_grant) 지운다 — 오프라인·일시 장애면 지킨다', async () => {
    prefsGet.mockResolvedValue({ value: 'R' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 400, json: () => Promise.resolve({ error: 'invalid_grant' }) }));
    await expect(getAccessToken()).rejects.toMatchObject({ code: 'E_SYNC_AUTH' });
    expect(prefsRemove).toHaveBeenCalledWith({ key: 'spin.sync.refresh' });

    prefsRemove.mockClear();
    resetAndroidAuthForTest();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    await expect(getAccessToken()).rejects.toMatchObject({ code: 'E_SYNC_NETWORK' });
    // 오프라인은 토큰 탓이 아니다 — 지우면 멀쩡한 연결이 사라진다.
    expect(prefsRemove).not.toHaveBeenCalled();

    prefsRemove.mockClear();
    resetAndroidAuthForTest();
    // 구글이 잠깐 넘어진 경우(5xx·429). 본문에 `error` 조차 없다 — 열쇠가 죽었다는 신호가
    // 아무 데도 없는데 지우면, 사용자는 구글 장애 한 번에 «다시 연결» 을 강요받는다(실기 A-6).
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503, json: () => Promise.resolve({}) }));
    await expect(getAccessToken()).rejects.toMatchObject({ code: 'E_SYNC_NETWORK' });
    expect(prefsRemove).not.toHaveBeenCalled();
  });
});

describe('revokeAccess — [연결 해제]', () => {
  it('★ 구글 회수가 실패해도 로컬 갱신 토큰은 지운다', async () => {
    prefsGet.mockResolvedValue({ value: 'R' });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    await expect(revokeAccess()).resolves.toBeUndefined();
    expect(prefsRemove).toHaveBeenCalledWith({ key: 'spin.sync.refresh' });
  });
});
