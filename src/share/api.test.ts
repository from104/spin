// 서버 오류 사상의 회귀선. 지우면 새는 것: 상태 코드 하나가 엉뚱한 kind 로 접히면 화면 문구가
// 통째로 틀린다 — 404(만료된 링크)를 'network' 로 접으면 사용자는 있지도 않은 링크를 몇 번이고
// 다시 누르고, 429(속도 제한)를 'not-found' 로 접으면 멀쩡한 링크를 버린다. 이 표가 결정 10의
// 문구 4종이 서는 바닥이다.
//
// fetch 는 목이다 — 이 파일이 보는 것은 서버가 아니라 **상태 코드 → kind 의 사상**이다.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { uploadCiphertext, fetchCiphertext, deleteShared, shareApiBase, ShareError, SHARE_MAX_CIPHERTEXT_BYTES } from './api.ts';
import { shareNoticeFor } from './index.ts';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function stubFetch(reply: () => Response | Promise<Response> | never): void {
  vi.stubGlobal('fetch', vi.fn(async () => reply()));
}

async function kindOf(run: Promise<unknown>): Promise<string> {
  try {
    await run;
    return 'no-throw';
  } catch (e) {
    return e instanceof ShareError ? e.kind : `other:${String(e)}`;
  }
}

describe('api — 기준 주소', () => {
  it('기본은 같은 출처 상대 경로다 — 앱이 어느 도메인에 올라가도 자기 서버를 부른다', () => {
    expect(shareApiBase()).toBe('/api/share');
  });

  it('VITE_SHARE_API_BASE 가 있으면 그것을 쓰고 뒤 슬래시는 지운다', () => {
    vi.stubEnv('VITE_SHARE_API_BASE', 'https://spin.atit.app/api/share/');
    expect(shareApiBase()).toBe('https://spin.atit.app/api/share');
  });
});

describe('api — 상태 코드가 오류 종류로 사상된다', () => {
  const cases: Array<[number, string]> = [
    [404, 'not-found'],
    [413, 'too-large'],
    [429, 'rate-limited'],
    [403, 'bad-key'],
    [400, 'invalid'],
    [500, 'network'],
  ];
  it.each(cases)('GET %i → %s', async (status, kind) => {
    stubFetch(() => new Response(null, { status }));
    expect(await kindOf(fetchCiphertext('AbC0123xyZ'))).toBe(kind);
  });

  it('fetch 자체가 실패하면 network 다 — 서버가 낸 상태 코드와 가른다', async () => {
    stubFetch(() => {
      throw new TypeError('Failed to fetch');
    });
    expect(await kindOf(fetchCiphertext('AbC0123xyZ'))).toBe('network');
  });
});

describe('api — 올리기', () => {
  it('201 의 몸통 세 값을 그대로 돌려준다', async () => {
    stubFetch(() => new Response(JSON.stringify({ id: 'AbC0123xyZ', deleteToken: 'tok', expiresAt: 42 }), { status: 201 }));
    await expect(uploadCiphertext(new Uint8Array([1, 2, 3]))).resolves.toEqual({ id: 'AbC0123xyZ', deleteToken: 'tok', expiresAt: 42 });
  });

  it('201 인데 계약과 다른 몸통이면 network 다 — 프록시 오류 페이지를 id 로 삼지 않는다', async () => {
    stubFetch(() => new Response('<html>Bad Gateway</html>', { status: 201 }));
    expect(await kindOf(uploadCiphertext(new Uint8Array([1])))).toBe('network');
    stubFetch(() => new Response(JSON.stringify({ id: 'AbC0123xyZ' }), { status: 201 }));
    expect(await kindOf(uploadCiphertext(new Uint8Array([1])))).toBe('network');
  });

  it('상한(256 KiB)을 넘으면 서버를 부르지도 않는다 — 413 왕복을 아낀다. 경계는 통과한다', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    // ⚠️ 경계는 상수에서 파생하지 않고 **결정값(S3, 256 KiB)** 을 적는다 — 상수에서 파생하면
    //    상한을 64 KiB 로 되돌려도 초록이다(2026-09-08 검수 돌연변이 ③이 잡은 자기증명). 서버
    //    쪽 app.test 도 같은 이유로 262144/262145 리터럴이다.
    const LIMIT = 256 * 1024;
    expect(await kindOf(uploadCiphertext(new Uint8Array(LIMIT + 1)))).toBe('too-large');
    expect(fetchSpy).not.toHaveBeenCalled();

    // 정확히 상한인 본문은 **서버에 간다**(2026-09-08, 세션 링크로 상한이 256 KiB 가 되며 더한 단언).
    // 부등호를 하나 어긋나게 잡으면 서버가 받아 줄 문서를 앱이 미리 거절한다 — 그 쪽 실수는
    // 사용자에게 "링크로 보내기엔 큽니다" 로만 보여 영영 원인을 모른다.
    stubFetch(() => new Response(JSON.stringify({ id: 'AbC0123xyZ', deleteToken: 'tok', expiresAt: 1 }), { status: 201 }));
    expect((await uploadCiphertext(new Uint8Array(LIMIT))).id).toBe('AbC0123xyZ');
  });
});

describe('api — 받기 상한', () => {
  it('200 이라도 상한을 넘는 몸통은 복호 전에 too-large 로 끊는다 — 우리 서버가 아닌 200 일 수 있다', async () => {
    // 선언된 길이로 먼저, 없으면 청크를 세며. 어느 쪽이든 복호·펴기에 닿기 전이다.
    stubFetch(() => new Response(new Uint8Array(SHARE_MAX_CIPHERTEXT_BYTES + 1), { status: 200 }));
    expect(await kindOf(fetchCiphertext('AbC0123xyZ'))).toBe('too-large');
    stubFetch(() => new Response(null, { status: 200, headers: { 'content-length': String(SHARE_MAX_CIPHERTEXT_BYTES + 1) } }));
    expect(await kindOf(fetchCiphertext('AbC0123xyZ'))).toBe('too-large');
  });

  it('상한 안의 몸통은 바이트 그대로 돌아온다', async () => {
    stubFetch(() => new Response(new Uint8Array([9, 8, 7]), { status: 200 }));
    expect(Array.from(await fetchCiphertext('AbC0123xyZ'))).toEqual([9, 8, 7]);
  });
});

describe('api — 회수', () => {
  it('이미 없는 것(404)은 성공이다 — 회수의 목적은 서버에 없게 하는 것이다', async () => {
    stubFetch(() => new Response(null, { status: 404 }));
    await expect(deleteShared('AbC0123xyZ', 'tok')).resolves.toBeUndefined();
  });

  it('토큰이 틀리면(403) bad-key 다', async () => {
    stubFetch(() => new Response(null, { status: 403 }));
    expect(await kindOf(deleteShared('AbC0123xyZ', 'wrong'))).toBe('bad-key');
  });
});

// 표의 **완전성**(7종이 빠짐없이 4종 중 하나로 간다)은 `Record<ShareErrorKind, ShareNotice>`
// 가 컴파일로 지킨다 — 여기서 키를 세면 타입이 이미 하는 일을 베끼는 자기증명이 된다. 테스트가
// 볼 것은 표가 아니라 **표를 타지 않는 길**이다: 우리 오류가 아닌 예외가 무엇이 되는가.
describe('예외 → 화면 문구 (결정 10)', () => {
  it('모르는 예외는 network 다 — 우리 오류가 아니면 링크를 탓하지 않는다', () => {
    expect(shareNoticeFor(new Error('boom'))).toBe('network');
    expect(shareNoticeFor(new ShareError('too-new'))).toBe('too-new');
    expect(shareNoticeFor(new ShareError('invalid'))).toBe('bad-key');
  });
});
