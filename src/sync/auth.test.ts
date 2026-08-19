// 0.6 커밋 4 — auth.ts. GIS 는 window.google 스텁으로 통째 대체한다. 여기서 못박는 것:
// ① 캐시 수명(만료 60s 전 갱신·유효하면 재요청 없음) ② 무음 갱신 8s 타임아웃(콜백이 영영
// 안 오는 실패 모드) ③ consent/silent 의 prompt 구분과 login_hint 전달 ④ revoke 가 캐시를
// 버려 다음 호출이 재요청하게 됨 ⑤ client id 미설정의 명시적 실패.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { connectInteractive, getAccessToken, invalidateToken, isSyncConfigured, resetAuthForTest, revokeAccess } from './auth.ts';

interface StubRequest {
  prompt?: '' | 'consent';
  login_hint?: string;
}

/** initTokenClient 호출을 기록하고, respond() 로 콜백을 원하는 때에 울리는 GIS 스텁. */
function stubGis() {
  const requests: StubRequest[] = [];
  let lastCallback: ((r: { access_token?: string; expires_in?: number; error?: string }) => void) | undefined;
  const revoked: string[] = [];
  const oauth2 = {
    initTokenClient(cfg: { callback: (r: { access_token?: string; expires_in?: number; error?: string }) => void }) {
      lastCallback = cfg.callback;
      return {
        requestAccessToken(req?: StubRequest) {
          requests.push(req ?? {});
        },
      };
    },
    revoke(token: string, done?: () => void) {
      revoked.push(token);
      done?.();
    },
  };
  vi.stubGlobal('google', { accounts: { oauth2 } });
  return {
    requests,
    revoked,
    /** requestToken 은 loadGis().then(...) 마이크로태스크 뒤에야 initTokenClient 를 부른다 —
     *  콜백이 등록될 시간을 먼저 준다(fake timers 에서도 마이크로태스크는 정상 진행된다). */
    async respond(r: { access_token?: string; expires_in?: number; error?: string }) {
      await Promise.resolve();
      await Promise.resolve();
      lastCallback?.(r);
    },
  };
}

beforeEach(() => {
  vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'cid-test');
  resetAuthForTest();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe('구성', () => {
  it('VITE_GOOGLE_CLIENT_ID 가 비면 isSyncConfigured=false 이고 토큰 요청은 명시적으로 실패한다', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', '  ');
    expect(isSyncConfigured()).toBe(false);
    stubGis();
    await expect(getAccessToken()).rejects.toMatchObject({ code: 'E_SYNC_AUTH', detail: 'client id 미설정' });
  });
});

describe('토큰 캐시와 무음 갱신', () => {
  it('첫 호출은 prompt:"" 무음 요청, 성공하면 만료 전까지 재요청 없이 캐시를 준다', async () => {
    const gis = stubGis();
    const p = getAccessToken('coach@example.com');
    await gis.respond({ access_token: 'tok-1', expires_in: 3600 });
    expect(await p).toBe('tok-1');
    expect(gis.requests).toEqual([{ prompt: '', login_hint: 'coach@example.com' }]);
    expect(await getAccessToken()).toBe('tok-1'); // 캐시 — 추가 요청 없음
    expect(gis.requests).toHaveLength(1);
  });

  it('만료 60초 전이면 미리 갱신한다', async () => {
    vi.useFakeTimers();
    const gis = stubGis();
    const p = getAccessToken();
    await gis.respond({ access_token: 'tok-1', expires_in: 100 }); // 100s 짜리
    await p;
    vi.advanceTimersByTime(50_000); // 남은 50s < 60s 여유 → 갱신 대상
    const p2 = getAccessToken();
    await gis.respond({ access_token: 'tok-2', expires_in: 3600 });
    expect(await p2).toBe('tok-2');
    expect(gis.requests).toHaveLength(2);
  });

  it('무음 갱신 콜백이 영영 안 오면 8초에 E_SYNC_AUTH — 엔진이 재연결 칩으로 안내한다', async () => {
    vi.useFakeTimers();
    stubGis();
    const p = getAccessToken();
    const guard = expect(p).rejects.toMatchObject({ code: 'E_SYNC_AUTH', detail: '무음 갱신 시간 초과' });
    await vi.advanceTimersByTimeAsync(8_000);
    await guard;
  });

  it('GIS 가 error 를 돌려주면 E_SYNC_AUTH 에 사유가 실린다', async () => {
    const gis = stubGis();
    const p = getAccessToken();
    await gis.respond({ error: 'interaction_required' });
    await expect(p).rejects.toMatchObject({ code: 'E_SYNC_AUTH', detail: 'interaction_required' });
  });

  it('invalidateToken 뒤에는 캐시가 있어도 다시 요청한다(401 복구 경로)', async () => {
    const gis = stubGis();
    const p = getAccessToken();
    await gis.respond({ access_token: 'tok-1', expires_in: 3600 });
    await p;
    invalidateToken();
    const p2 = getAccessToken();
    await gis.respond({ access_token: 'tok-2', expires_in: 3600 });
    expect(await p2).toBe('tok-2');
    expect(gis.requests).toHaveLength(2);
  });
});

describe('connectInteractive — [Google 계정 연결] 버튼', () => {
  it('prompt:"consent" 로 요청하고 about 에서 이메일 힌트를 얻는다', async () => {
    const gis = stubGis();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ user: { emailAddress: 'coach@example.com' } }), { status: 200 })),
    );
    const p = connectInteractive();
    await gis.respond({ access_token: 'tok-c', expires_in: 3600 });
    expect(await p).toEqual({ token: 'tok-c', email: 'coach@example.com' });
    expect(gis.requests).toEqual([{ prompt: 'consent' }]);
  });

  it('about 이 실패해도 연결은 성공이다 — 이메일은 힌트일 뿐', async () => {
    const gis = stubGis();
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('offline'))));
    const p = connectInteractive();
    await gis.respond({ access_token: 'tok-c', expires_in: 3600 });
    expect(await p).toEqual({ token: 'tok-c' });
  });
});

describe('revokeAccess — [연결 해제]', () => {
  it('구글 쪽 동의를 회수하고 캐시를 버린다 — 다음 호출은 재요청', async () => {
    const gis = stubGis();
    const p = getAccessToken();
    await gis.respond({ access_token: 'tok-1', expires_in: 3600 });
    await p;
    await revokeAccess();
    expect(gis.revoked).toEqual(['tok-1']);
    const p2 = getAccessToken();
    await gis.respond({ access_token: 'tok-2', expires_in: 3600 });
    expect(await p2).toBe('tok-2');
  });

  it('토큰이 없으면 아무것도 안 한다', async () => {
    const gis = stubGis();
    await revokeAccess();
    expect(gis.revoked).toEqual([]);
  });
});
