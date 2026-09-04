// 데스크톱 로그인(설치형 앱 흐름)의 계약. 실기로는 **구글 콘솔 클라이언트가 있어야만** 밟을
// 수 있는 경로라, 여기서 잡지 못하면 잡을 자리가 사실상 없다.
//
// 특히 두 가지는 눈으로 못 본다:
//   · `state` 대조 — 깨져도 화면은 똑같이 '연결됨' 이 된다. 로그인 CSRF 가 그 틈으로 들어온다.
//   · 갱신 토큰을 **덮어쓰지 않는 조건** — 두 번째 연결에서 구글이 갱신 토큰을 안 줄 때가
//     있는데, 그때 빈 값으로 덮으면 다음 실행에서 조용히 재로그인이 뜬다.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const invoke = vi.fn();
const openUrl = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({ invoke: (...a: unknown[]) => invoke(...a) }));
vi.mock('@tauri-apps/plugin-opener', () => ({ openUrl: (...a: unknown[]) => openUrl(...a) }));

import { connectInteractive, getAccessToken, isConfigured, isDesktop, resetDesktopAuthForTest, revokeAccess } from './authDesktop.ts';
import { StorageError } from '../storage/errors.ts';

/** 브라우저로 나간 authorize URL — 테스트가 code_challenge·state 를 여기서 되읽는다. */
const sentUrl = (): URL => new URL(String(openUrl.mock.calls.at(-1)?.[0]));

function asDesktop(on: boolean): void {
  if (on) (globalThis as Record<string, unknown>).__TAURI_INTERNALS__ = {};
  else delete (globalThis as Record<string, unknown>).__TAURI_INTERNALS__;
}

/** 루프백이 돌려주는 쿼리를 **URL 을 본 뒤에** 만들어야 한다 — state 는 매번 새로 난다. */
function loopbackReturns(make: (url: URL) => string): void {
  invoke.mockImplementation((cmd: string) => {
    if (cmd === 'oauth_start') return Promise.resolve(41234);
    if (cmd === 'oauth_wait') return Promise.resolve(make(sentUrl()));
    return Promise.resolve(null);
  });
}

const okToken = (body: Record<string, unknown>) =>
  vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve(body) });

beforeEach(() => {
  resetDesktopAuthForTest();
  invoke.mockReset();
  openUrl.mockReset();
  openUrl.mockResolvedValue(undefined);
  asDesktop(true);
  vi.stubEnv('SPIN_DESKTOP_GOOGLE_CLIENT_ID', 'desktop-id');
  vi.stubEnv('SPIN_DESKTOP_GOOGLE_CLIENT_SECRET', 'desktop-secret');
});

afterEach(() => {
  asDesktop(false);
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('데스크톱 감지와 구성', () => {
  it('__TAURI_INTERNALS__ 가 있어야 데스크톱이다 — 웹 배포본은 언제나 false', () => {
    expect(isDesktop()).toBe(true);
    asDesktop(false);
    expect(isDesktop()).toBe(false);
  });

  it('id 와 secret 이 **둘 다** 있어야 구성된 것이다', () => {
    expect(isConfigured()).toBe(true);
    vi.stubEnv('SPIN_DESKTOP_GOOGLE_CLIENT_SECRET', '');
    expect(isConfigured()).toBe(false);
    vi.stubEnv('SPIN_DESKTOP_GOOGLE_CLIENT_SECRET', 'desktop-secret');
    vi.stubEnv('SPIN_DESKTOP_GOOGLE_CLIENT_ID', '  ');
    expect(isConfigured()).toBe(false);
  });
});

describe('connectInteractive — 외부 브라우저 + 루프백', () => {
  it('★ 루프백을 **먼저** 열고, 그 포트로 redirect_uri 를 만든다', async () => {
    loopbackReturns((u) => `code=abc&state=${u.searchParams.get('state')}`);
    vi.stubGlobal('fetch', okToken({ access_token: 'A', expires_in: 3600 }));

    await connectInteractive();

    // 순서가 뒤집히면 브라우저가 열려도 돌아올 자리가 없다.
    expect(invoke.mock.calls[0]?.[0]).toBe('oauth_start');
    const url = sentUrl();
    expect(url.searchParams.get('redirect_uri')).toBe('http://127.0.0.1:41234');
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
  });

  it('★ PKCE S256 이다 — challenge 는 verifier 의 SHA-256 이고 평문이 아니다', async () => {
    let verifier = '';
    loopbackReturns((u) => `code=abc&state=${u.searchParams.get('state')}`);
    vi.stubGlobal(
      'fetch',
      // ⚠️ fetch 는 두 번 불린다 — 토큰 교환, 그다음 이메일 힌트(about). URL 로 갈라 읽지
      //    않으면 두 번째가 verifier 를 빈 값으로 덮어 이 테스트가 **빈 문자열의 해시**를
      //    비교하게 된다(그러면 코드가 틀려도 통과할 수 있다).
      vi.fn().mockImplementation((url: string, init?: { body: string }) => {
        if (url.startsWith('https://oauth2.googleapis.com/token')) {
          verifier = new URLSearchParams(init!.body).get('code_verifier') ?? '';
        }
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ access_token: 'A', expires_in: 3600 }) });
      }),
    );

    await connectInteractive();

    const url = sentUrl();
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    const challenge = url.searchParams.get('code_challenge')!;
    expect(challenge).not.toBe(verifier); // plain 으로 새면 가로챈 코드가 그대로 토큰이 된다
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
    const expected = btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    expect(challenge).toBe(expected);
  });

  it('★ 갱신 토큰을 받으려면 offline + consent 를 함께 보낸다', async () => {
    loopbackReturns((u) => `code=abc&state=${u.searchParams.get('state')}`);
    vi.stubGlobal('fetch', okToken({ access_token: 'A', expires_in: 3600 }));
    await connectInteractive();
    expect(sentUrl().searchParams.get('access_type')).toBe('offline');
    expect(sentUrl().searchParams.get('prompt')).toBe('consent');
  });

  it('★ state 가 다르면 거부한다 — 내가 시작하지 않은 리다이렉트다', async () => {
    loopbackReturns(() => 'code=abc&state=남의값');
    vi.stubGlobal('fetch', okToken({ access_token: 'A', expires_in: 3600 }));
    await expect(connectInteractive()).rejects.toMatchObject({ code: 'E_SYNC_AUTH' });
  });

  it('구글이 error 를 돌려주면(사용자 취소 등) 그 코드를 싣고 실패한다', async () => {
    loopbackReturns(() => 'error=access_denied');
    await expect(connectInteractive()).rejects.toMatchObject({ code: 'E_SYNC_AUTH' });
  });

  it('★ 갱신 토큰은 **있을 때만** 저장한다 — 없을 때 덮으면 멀쩡한 연결이 끊긴다', async () => {
    loopbackReturns((u) => `code=abc&state=${u.searchParams.get('state')}`);
    vi.stubGlobal('fetch', okToken({ access_token: 'A', expires_in: 3600, refresh_token: 'R' }));
    await connectInteractive();
    expect(invoke).toHaveBeenCalledWith('secret_save', { value: 'R' });

    invoke.mockClear();
    resetDesktopAuthForTest();
    loopbackReturns((u) => `code=abc&state=${u.searchParams.get('state')}`);
    vi.stubGlobal('fetch', okToken({ access_token: 'A2', expires_in: 3600 })); // 갱신 토큰 없음
    await connectInteractive();
    expect(invoke.mock.calls.map((c) => c[0])).not.toContain('secret_save');
  });

  it('브라우저를 못 열면 루프백을 걷어낸다 — 안 걷으면 리스너가 남는다', async () => {
    invoke.mockImplementation((cmd: string) => (cmd === 'oauth_start' ? Promise.resolve(41234) : Promise.resolve(null)));
    openUrl.mockRejectedValue(new Error('no opener'));
    await expect(connectInteractive()).rejects.toMatchObject({ code: 'E_SYNC_AUTH' });
    expect(invoke.mock.calls.map((c) => c[0])).toContain('oauth_cancel');
  });
});

describe('getAccessToken — 갱신 토큰으로 무음 갱신', () => {
  it('저장된 갱신 토큰이 없으면 재연결을 요구한다', async () => {
    invoke.mockResolvedValue(null);
    await expect(getAccessToken()).rejects.toMatchObject({ code: 'E_SYNC_AUTH' });
  });

  it('갱신 토큰으로 새 접근 토큰을 받고, 두 번째 호출은 캐시로 답한다', async () => {
    invoke.mockImplementation((cmd: string) => Promise.resolve(cmd === 'secret_load' ? 'R' : null));
    const fetchMock = okToken({ access_token: 'A', expires_in: 3600 });
    vi.stubGlobal('fetch', fetchMock);

    expect(await getAccessToken()).toBe('A');
    expect(await getAccessToken()).toBe('A');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(new URLSearchParams(fetchMock.mock.calls[0]![1].body).get('grant_type')).toBe('refresh_token');
  });

  it('★ 갱신 토큰이 죽었으면 지운다 — 안 지우면 같은 실패를 영원히 되풀이한다', async () => {
    invoke.mockImplementation((cmd: string) => Promise.resolve(cmd === 'secret_load' ? 'R' : null));
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 400, json: () => Promise.resolve({ error: 'invalid_grant' }) }),
    );
    await expect(getAccessToken()).rejects.toMatchObject({ code: 'E_SYNC_AUTH' });
    expect(invoke.mock.calls.map((c) => c[0])).toContain('secret_clear');
  });

  it('네트워크가 끊기면 인증 오류가 아니라 네트워크 오류다 — 재연결을 시키면 안 된다', async () => {
    invoke.mockImplementation((cmd: string) => Promise.resolve(cmd === 'secret_load' ? 'R' : null));
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    await expect(getAccessToken()).rejects.toMatchObject({ code: 'E_SYNC_NETWORK' });
    // 오프라인은 토큰 탓이 아니다 — 지우면 연결이 사라진다.
    expect(invoke.mock.calls.map((c) => c[0])).not.toContain('secret_clear');
  });
});

describe('revokeAccess — [연결 해제]', () => {
  it('★ 구글 회수가 실패해도 로컬 갱신 토큰은 지운다', async () => {
    invoke.mockImplementation((cmd: string) => Promise.resolve(cmd === 'secret_load' ? 'R' : null));
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    await revokeAccess();
    expect(invoke.mock.calls.map((c) => c[0])).toContain('secret_clear');
  });

  it('연결한 적이 없으면 조용히 끝난다', async () => {
    invoke.mockResolvedValue(null);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(revokeAccess()).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('오류 형태', () => {
  it('모든 실패가 StorageError 다 — 화면이 문구를 만들 수 있어야 한다', async () => {
    invoke.mockResolvedValue(null);
    await expect(getAccessToken()).rejects.toBeInstanceOf(StorageError);
  });
});
