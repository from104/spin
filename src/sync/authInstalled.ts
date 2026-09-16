// 설치형 앱 구글 로그인(RFC 8252)의 **공통 조각** — 데스크톱(Tauri)과 안드로이드(Capacitor)가
// 함께 쓴다. 두 셸이 다른 것은 «사용자를 어디로 보내고 코드를 어떻게 돌려받는가» 뿐이고
// (루프백 `http://127.0.0.1:<포트>` vs 커스텀 스킴 `app.atit.spin:/oauth2redirect`), PKCE·state·
// 토큰 종점·캐시 수명·회수는 한 글자도 다르지 않다. 서사와 함정 기록은 그대로 두 소비자의
// 머리말에 있다 — 여기 있는 것은 그 둘이 **똑같이** 해야 하는 일이다.
//
// 2026-09-17(`docs/PLAN-ANDROID.md` §3 2단계, 결정 5)에 `authDesktop.ts` 에서 뽑아냈다.
// 복제하지 않은 이유는 AGENTS §3 과 같다 — 한 벌 더 적으면 언젠가 한쪽만 고쳐지고, 그때 깨지는
// 것은 "안드로이드에서만 재시작할 때마다 로그인이 뜬다" 처럼 **실기에서야 보이는** 종류다.
// 셸 판정을 `platform/shell.ts` 한 벌로 모은 것(결정 4)과 같은 규율이다.
//
// ⚠️ **셸에 딸린 것을 여기 넣지 않는다.** `@tauri-apps/*` 든 `@capacitor/*` 든 import 하는 순간
// 이 모듈은 양쪽 번들에 상대 셸의 런타임을 끌고 들어간다(웹 번들에도). 이 파일이 아는 것은
// `fetch` · `crypto` · `StorageError` 뿐이고, 브라우저를 여는 일·코드를 받아 오는 일·갱신 토큰을
// 두는 자리는 전부 부르는 쪽의 몫이다.
import { StorageError, STORAGE_ERROR_MESSAGES } from '../storage/errors.ts';

export const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
export const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
export const REVOKE_ENDPOINT = 'https://oauth2.googleapis.com/revoke';

/** 요청하는 구글 권한 범위 — 앱 전용 숨김 폴더 하나뿐(법적 고지 페이지가 그렇게 약속한다).
 *  웹(GIS)과 설치형(PKCE)이 **같은 값**이어야 한 계정이 두 번 동의하지 않는다. */
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';

/** 만료 이만큼 전이면 미리 갱신한다 — 패스 도중 만료로 반쯤 실패하는 것보다 싸다.
 *  `auth.ts`(웹 경로)와 같은 값이어야 세 경로의 체감이 같다. */
export const EXPIRY_MARGIN_MS = 60_000;

export const authError = (detail: string): StorageError =>
  new StorageError('E_SYNC_AUTH', STORAGE_ERROR_MESSAGES.E_SYNC_AUTH(), { detail });

export interface TokenBody {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  error?: string;
  error_description?: string;
}

// ── PKCE ─────────────────────────────────────────────────────────────────────────────

const b64url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** 32 바이트면 base64url 로 43 자 — RFC 7636 이 정한 하한이 그것이다. verifier 와 state 가 같은
 *  질의 난수를 쓴다(둘 다 가로챈 사람이 못 맞춰야 뜻이 있다). */
export function randomToken(): string {
  return b64url(crypto.getRandomValues(new Uint8Array(32)));
}

async function challengeOf(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return b64url(new Uint8Array(digest));
}

/** authorize URL. 셸마다 다른 것은 `client_id` · `redirect_uri` 둘뿐이라 **나머지는 여기서
 *  고정한다** — 한쪽에만 `access_type` 을 빠뜨리면 그 셸만 재시작할 때마다 로그인이 뜨고,
 *  그 차이는 jsdom 이 아니라 실기에서야 보인다.
 *
 *  ⚠️ 설치형 앱은 갱신 토큰을 받아야 다음 실행에서 다시 로그인시키지 않는다. 구글은
 *  offline + consent 를 **함께** 줘야 갱신 토큰을 다시 내준다(두 번째 연결부터 빠뜨리면
 *  access_token 만 오고, 앱은 재시작할 때마다 브라우저를 연다). */
export async function authorizeUrl(a: {
  clientId: string;
  redirectUri: string;
  verifier: string;
  state: string;
}): Promise<string> {
  return `${AUTH_ENDPOINT}?${new URLSearchParams({
    client_id: a.clientId,
    redirect_uri: a.redirectUri,
    response_type: 'code',
    scope: DRIVE_SCOPE,
    code_challenge: await challengeOf(a.verifier),
    code_challenge_method: 'S256',
    state: a.state,
    access_type: 'offline',
    prompt: 'consent',
  }).toString()}`;
}

/** 돌아온 리다이렉트에서 인가 코드를 꺼낸다. 세 검사가 **순서대로** 있어야 한다:
 *  ① 구글이 오류를 리다이렉트로 돌려주는 경우(사용자가 [취소]를 누른 것이 대표적이다)
 *  ② state 대조 — 로그인 CSRF 방어. 내가 시작하지 않은 리다이렉트는 받지 않는다. 깨져도
 *     화면은 똑같이 '연결됨' 이 되므로 눈으로는 못 본다.
 *  ③ 코드 자체의 존재. */
export function codeFromRedirect(params: URLSearchParams, expectedState: string): string {
  const err = params.get('error');
  if (err) throw authError(err);
  if (params.get('state') !== expectedState) throw authError('state 불일치');
  const code = params.get('code');
  if (!code) throw authError('코드가 없습니다');
  return code;
}

// ── 토큰 ─────────────────────────────────────────────────────────────────────────────

/** 토큰 종점 호출. **본문을 그대로 오류에 싣지 않는다** — 실패 응답에도 토큰이 섞일 수 있다.
 *  구글이 주는 짧은 `error` 코드만 남긴다(invalid_grant 등).
 *
 *  ⚠️ 네트워크 실패는 `E_SYNC_NETWORK` 다. 인증 오류로 접으면 오프라인일 때 앱이 "재연결하라"
 *  고 말하고, 부르는 쪽이 멀쩡한 갱신 토큰을 지운다.
 *
 *  ⚠️ **일시 장애(5xx·429)도 인증 오류가 아니다.** 부르는 쪽(`getAccessToken`)은 «인증 오류면
 *  갱신 토큰이 죽은 것» 으로 읽고 열쇠를 지우는데, 죽은 토큰의 신호는 RFC 6749 §5.2 가 정한
 *  **본문의 오류 코드**(`invalid_grant`)이지 HTTP 상태가 아니다. 구글이 잠깐 503 을 주는 것을
 *  그쪽으로 접으면 사용자는 아무 잘못 없이 «다시 연결» 을 강요받고(실기 A-6 이 구글 장애 한
 *  번에 깨진다), 화면에는 원인이 안 보인다. 끊긴 네트워크와 같은 종류의 실패 — 기다리면
 *  낫는 것 — 이므로 같은 코드로 접는다. 이 판정이 여기 한 벌인 덕에 두 셸이 같이 낫는다. */
export async function postToken(params: Record<string, string>): Promise<TokenBody> {
  let res: Response;
  try {
    res = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params).toString(),
    });
  } catch (e) {
    throw new StorageError('E_SYNC_NETWORK', STORAGE_ERROR_MESSAGES.E_SYNC_NETWORK(), {
      detail: `토큰 종점에 닿지 못함: ${e instanceof Error ? e.message : '알 수 없음'}`,
    });
  }
  const body = (await res.json().catch(() => ({}))) as TokenBody;
  // 상태를 **먼저** 본다: 5xx·429 에 `error` 본문이 실려 오더라도 그것은 종점이 넘어진 것이지
  // 열쇠가 죽은 것이 아니다(429 는 아예 «잠시 뒤 다시» 라는 뜻이다).
  if (res.status >= 500 || res.status === 429) {
    throw new StorageError('E_SYNC_NETWORK', STORAGE_ERROR_MESSAGES.E_SYNC_NETWORK(), {
      detail: `토큰 종점 일시 장애: HTTP ${res.status}`,
    });
  }
  if (!res.ok || body.error) throw authError(body.error ?? `HTTP ${res.status}`);
  return body;
}

/** 접근 토큰 캐시. **모듈 전역이 아니라 만들어 쓰는 물건**인 이유: 셸마다 한 벌씩 따로 있어야
 *  `auth.ts` 가 양쪽을 무조건 비우는 지금 배선(어느 쪽이 사는지 따지지 않는다)이 성립한다. */
export interface TokenCache {
  /** 만료 여유를 뺀 «아직 쓸 수 있는» 토큰. 없거나 곧 죽으면 undefined. */
  live(): string | undefined;
  /** 만료와 무관하게 들고 있는 토큰 — [연결 해제] 가 회수할 대상을 찾을 때만 쓴다. */
  held(): string | undefined;
  remember(body: TokenBody): string;
  clear(): void;
}

export function createTokenCache(): TokenCache {
  let cached: { token: string; expiresAt: number } | null = null;
  return {
    live: () => (cached && cached.expiresAt - EXPIRY_MARGIN_MS > Date.now() ? cached.token : undefined),
    held: () => cached?.token,
    remember(body: TokenBody): string {
      if (!body.access_token) throw authError('접근 토큰이 없습니다');
      cached = { token: body.access_token, expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000 };
      return body.access_token;
    },
    clear(): void {
      cached = null;
    },
  };
}

/** 연결 뒤 설정 화면에 보여줄 계정 이메일. **힌트일 뿐이라 실패를 삼킨다** — about 호출이
 *  넘어져도 연결 자체는 성공으로 친다(웹 경로 `auth.ts` 와 같은 규칙). */
export async function emailHint(token: string): Promise<string | undefined> {
  try {
    const res = await fetch('https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return undefined;
    return ((await res.json()) as { user?: { emailAddress?: string } }).user?.emailAddress;
  } catch {
    return undefined;
  }
}

/** 구글 쪽 동의 회수 — **best-effort**. 오프라인이면 조용히 실패한다.
 *  로컬 열쇠를 지우는 일은 여기 섞지 않는다: 그쪽은 실패하면 안 되는 일이라 부르는 쪽이
 *  **먼저** 확실히 끝내야 한다(회수가 실패했는데 열쇠가 남으면 '해제했다' 가 거짓이 된다). */
export async function revokeRemote(token: string): Promise<void> {
  try {
    await fetch(REVOKE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token }).toString(),
    });
  } catch {
    /* best-effort — 오프라인이면 구글 쪽 동의는 남는다 */
  }
}
