// 데스크톱(Tauri) 구글 로그인 — 설치형 앱 흐름(RFC 8252): 외부 브라우저 + 루프백 + PKCE.
//
// ── 왜 웹과 다른 길인가 (2026-08-27 실측) ────────────────────────────────────────────
// 웹은 GIS(`accounts.google.com/gsi/client`)가 팝업을 띄워 접근 토큰을 준다. 데스크톱 웹뷰에서
// 그 길은 **두 겹으로 막혀 있다** — 콘솔이 둘을 한 줄에 보여줬다:
//   `Failed to open popup window on url: …&origin=tauri%3A%2F%2Flocalhost`
//   ① Tauri 웹뷰가 window.open 을 안 띄운다. 여기서 이미 끝난다.
//   ② 열렸어도 origin 이 `tauri://localhost` 다 — 구글 콘솔의 '승인된 JavaScript 원본' 은
//      http/https 만 받으므로 등록할 방법 자체가 없다.
// 그래서 데스크톱은 **기본 브라우저**에서 로그인시키고 `http://127.0.0.1:<포트>` 로 코드를
// 돌려받는다. 구글 콘솔의 '데스크톱 앱' 클라이언트는 그 리다이렉트를 별도 등록 없이 허용한다.
//
// ── 클라이언트가 웹과 **다르다** ─────────────────────────────────────────────────────
// 웹용 클라이언트로는 이 흐름을 못 쓴다(유형이 다르다). `SPIN_DESKTOP_GOOGLE_CLIENT_ID` ·
// `SPIN_DESKTOP_GOOGLE_CLIENT_SECRET` 을 따로 주입한다. 그 '시크릿' 은 이름과 달리 **비밀이
// 아니다** — 설치형 앱은 배포본을 뜯으면 누구나 읽을 수 있고, 구글도 그 전제로 설계했다
// (그래서 PKCE 가 있다: 코드를 가로채도 verifier 없이는 토큰으로 못 바꾼다). 그래도 저장소에는
// 안 넣는다 — `.env.local` 은 gitignore 다.
//
// ⚠️ 접두어를 `VITE_` 가 아니라 `SPIN_DESKTOP_` 으로 쓰는 이유(2026-09-05 감사, [치명 2]) —
// Vite 는 `VITE_*` 를 웹이든 데스크톱이든 구분 없이 번들에 인라인한다. `vite.config.ts` 의
// `envPrefix` 가 `SPIN_DESKTOP_` 을 **Tauri 빌드일 때만** 허용하므로, 이 이름을 쓰면 웹 빌드의
// `import.meta.env` 에는 이 값이 아예 존재하지 않는다(빈 문자열도 아니라 `undefined`).
//
// ── 웹과 다른 물건이 하나 생긴다: 갱신 토큰 ──────────────────────────────────────────
// 웹은 접근 토큰만 받고 구글 쪽 동의로 무음 갱신을 한다. 설치형은 **갱신 토큰**을 받는다 —
// 만료가 없는 열쇠라 두는 자리를 따로 정했다(src-tauri/src/secret_store.rs 머리말).
// prefs 에 넣지 않는 것이 핵심이다: 백업 파일이 prefs 를 통째로 싣기 때문에(transfer.ts),
// 넣는 순간 남의 기기로 새어 나간다. auth.ts 가 "토큰은 메모리만" 을 지킨 것과 같은 이유다.
import { StorageError, STORAGE_ERROR_MESSAGES } from '../storage/errors.ts';

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const REVOKE_ENDPOINT = 'https://oauth2.googleapis.com/revoke';

/** 만료 이만큼 전이면 미리 갱신한다 — auth.ts 와 같은 값이어야 두 경로의 체감이 같다. */
const EXPIRY_MARGIN_MS = 60_000;

/** 이 앱이 Tauri 웹뷰 안에서 도는가. 웹 배포본에서는 언제나 false 이고, 그래서 아래 코드는
 *  한 줄도 실행되지 않는다.
 *
 *  ⚠️ 옛 주석(2026-08-27 작성, 2026-09-05 감사에서 오류로 확인)은 여기서 "모듈 자체가 동적
 *  import 라 번들도 따로 떨어진다" 고 적었지만 틀렸다 — `auth.ts` 의 `import * as desktop from
 *  './authDesktop.ts'` 는 **정적** import 라 이 모듈은 웹 번들에도 통째로 들어간다. 안전한
 *  것은 이 파일이 아니라 `desktopClientSecret()` 이 읽는 값이다: `SPIN_DESKTOP_*` 는
 *  `vite.config.ts` 의 `envPrefix` 가 Tauri 빌드가 아니면 주입을 막으므로, 웹 번들에서는 이
 *  함수가 항상 빈 문자열을 돌려준다(코드는 실려도 시크릿 값은 안 실린다). */
export function isDesktop(): boolean {
  return typeof globalThis !== 'undefined' && '__TAURI_INTERNALS__' in globalThis;
}

export function desktopClientId(): string | undefined {
  const raw = (import.meta.env as Record<string, unknown>).SPIN_DESKTOP_GOOGLE_CLIENT_ID;
  const id = typeof raw === 'string' ? raw.trim() : '';
  return id.length > 0 ? id : undefined;
}

function desktopClientSecret(): string {
  const raw = (import.meta.env as Record<string, unknown>).SPIN_DESKTOP_GOOGLE_CLIENT_SECRET;
  return typeof raw === 'string' ? raw.trim() : '';
}

// ── Tauri 커맨드 (동적 import — 웹 번들에 안 들어간다) ────────────────────────────────

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke: call } = await import('@tauri-apps/api/core');
  return call<T>(cmd, args);
}

async function openInBrowser(url: string): Promise<void> {
  const { openUrl } = await import('@tauri-apps/plugin-opener');
  await openUrl(url);
}

// ── PKCE ─────────────────────────────────────────────────────────────────────────────

const b64url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** 32 바이트면 base64url 로 43 자 — RFC 7636 이 정한 하한이 그것이다. */
function randomToken(): string {
  return b64url(crypto.getRandomValues(new Uint8Array(32)));
}

async function challengeOf(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return b64url(new Uint8Array(digest));
}

// ── 토큰 ─────────────────────────────────────────────────────────────────────────────

let cached: { token: string; expiresAt: number } | null = null;

const authError = (detail: string): StorageError =>
  new StorageError('E_SYNC_AUTH', STORAGE_ERROR_MESSAGES.E_SYNC_AUTH(), { detail });

interface TokenBody {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  error?: string;
  error_description?: string;
}

/** 토큰 종점 호출. **본문을 그대로 오류에 싣지 않는다** — 실패 응답에도 토큰이 섞일 수 있다.
 *  구글이 주는 짧은 `error` 코드만 남긴다(invalid_grant 등). */
async function postToken(params: Record<string, string>): Promise<TokenBody> {
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
  if (!res.ok || body.error) throw authError(body.error ?? `HTTP ${res.status}`);
  return body;
}

function remember(body: TokenBody): string {
  if (!body.access_token) throw authError('접근 토큰이 없습니다');
  cached = { token: body.access_token, expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000 };
  return body.access_token;
}

// ── 공개 API — auth.ts 가 플랫폼을 보고 이쪽으로 넘긴다 ───────────────────────────────

export function isConfigured(): boolean {
  return desktopClientId() !== undefined && desktopClientSecret().length > 0;
}

/** [Google 계정 연결]. 브라우저를 열고, 루프백으로 코드를 받고, 토큰으로 바꾼다.
 *
 *  ⚠️ `oauth_start` 를 **먼저** 부른다 — 포트를 알아야 redirect_uri 를 만들 수 있고, 그 값이
 *  authorize URL 에 들어가야 하기 때문이다. 브라우저를 먼저 열면 돌아올 자리가 없다. */
export async function connectInteractive(): Promise<{ token: string; email?: string }> {
  const clientId = desktopClientId();
  if (!clientId) throw authError('데스크톱 client id 미설정');

  const verifier = randomToken();
  const state = randomToken();
  const port = await invoke<number>('oauth_start').catch((e) => {
    throw authError(`루프백을 열지 못함: ${String(e)}`);
  });
  const redirectUri = `http://127.0.0.1:${port}`;

  const url = `${AUTH_ENDPOINT}?${new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/drive.appdata',
    code_challenge: await challengeOf(verifier),
    code_challenge_method: 'S256',
    state,
    // 설치형 앱은 갱신 토큰을 받아야 다음 실행에서 다시 로그인시키지 않는다. 구글은
    // offline + consent 를 함께 줘야 갱신 토큰을 **다시** 내준다(두 번째 연결부터 빠뜨리면
    // access_token 만 오고, 앱은 재시작할 때마다 브라우저를 연다).
    access_type: 'offline',
    prompt: 'consent',
  }).toString()}`;

  try {
    await openInBrowser(url);
  } catch (e) {
    await invoke('oauth_cancel').catch(() => {});
    throw authError(`브라우저를 열지 못함: ${String(e)}`);
  }

  const query = await invoke<string>('oauth_wait').catch((e) => {
    throw authError(String(e));
  });
  const params = new URLSearchParams(query);
  // 구글이 오류를 리다이렉트로 돌려주는 경우(사용자가 [취소]를 누른 것이 대표적이다).
  const err = params.get('error');
  if (err) throw authError(err);
  // 로그인 CSRF 방어 — 내가 시작하지 않은 리다이렉트는 받지 않는다.
  if (params.get('state') !== state) throw authError('state 불일치');
  const code = params.get('code');
  if (!code) throw authError('코드가 없습니다');

  const body = await postToken({
    code,
    client_id: clientId,
    client_secret: desktopClientSecret(),
    code_verifier: verifier,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
  });
  const token = remember(body);
  // 갱신 토큰은 **있을 때만** 덮어쓴다. 구글이 안 줄 때가 있는데(이미 동의가 살아 있는 계정),
  // 그때 빈 값으로 덮으면 멀쩡히 쓰던 연결이 다음 실행에서 끊긴다.
  if (body.refresh_token) await invoke('secret_save', { value: body.refresh_token }).catch(() => {});

  let email: string | undefined;
  try {
    const res = await fetch('https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) email = ((await res.json()) as { user?: { emailAddress?: string } }).user?.emailAddress;
  } catch {
    /* 힌트일 뿐 — 웹 경로와 같은 규칙으로 삼킨다 */
  }
  return { token, ...(email ? { email } : {}) };
}

/** 엔진의 입구. 캐시가 살아 있으면 그대로, 아니면 갱신 토큰으로 조용히 새로 받는다. */
export async function getAccessToken(): Promise<string> {
  if (cached && cached.expiresAt - EXPIRY_MARGIN_MS > Date.now()) return cached.token;

  const clientId = desktopClientId();
  if (!clientId) throw authError('데스크톱 client id 미설정');
  const refresh = await invoke<string | null>('secret_load').catch(() => null);
  if (!refresh) throw authError('갱신 토큰 없음 — 다시 연결해야 합니다');

  try {
    return remember(
      await postToken({
        refresh_token: refresh,
        client_id: clientId,
        client_secret: desktopClientSecret(),
        grant_type: 'refresh_token',
      }),
    );
  } catch (e) {
    // 갱신 토큰이 죽었으면(사용자가 구글에서 권한을 뺐거나 만료) 들고 있어 봐야 매번 같은
    // 실패를 되풀이한다. 지워야 설정 화면이 '재연결' 로 정확히 안내한다.
    if (e instanceof StorageError && e.code === 'E_SYNC_AUTH') await invoke('secret_clear').catch(() => {});
    throw e;
  }
}

export function invalidateToken(): void {
  cached = null;
}

/** [연결 해제]. 구글 쪽 회수는 best-effort 지만 **로컬 갱신 토큰은 반드시 지운다** —
 *  회수가 실패했는데 열쇠까지 남으면 '해제했다' 는 말이 거짓이 된다. */
export async function revokeAccess(): Promise<void> {
  const token = cached?.token ?? (await invoke<string | null>('secret_load').catch(() => null));
  cached = null;
  await invoke('secret_clear').catch(() => {});
  if (!token) return;
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

/** 테스트 전용. */
export function resetDesktopAuthForTest(): void {
  cached = null;
}
