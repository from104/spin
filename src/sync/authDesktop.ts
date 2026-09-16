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
//
// ⚠️ 2026-09-17(PLAN-ANDROID §3 2단계) — 안드로이드가 **같은 흐름**을 쓰게 되면서 PKCE·state·
// 토큰 종점·캐시·회수는 `authInstalled.ts` 로 나갔다. 여기 남은 것은 **데스크톱만의 것**이다:
// 루프백 포트를 여는 Tauri 커맨드, 기본 브라우저 열기, 시크릿이 있는 클라이언트, 갱신 토큰을
// 두는 자리(러스트 secret_store). 위 서사는 그대로 이 파일의 것이라 지우지 않는다.
import { isTauriWebview } from '../platform/shell.ts';
import { StorageError } from '../storage/errors.ts';
import {
  authError,
  authorizeUrl,
  codeFromRedirect,
  createTokenCache,
  emailHint,
  postToken,
  randomToken,
  revokeRemote,
} from './authInstalled.ts';

/** 이 앱이 Tauri 웹뷰 안에서 도는가. 웹 배포본에서는 언제나 false 이고, 그래서 아래 코드는
 *  한 줄도 실행되지 않는다.
 *
 *  ⚠️ 옛 주석(2026-08-27 작성, 2026-09-05 감사에서 오류로 확인)은 여기서 "모듈 자체가 동적
 *  import 라 번들도 따로 떨어진다" 고 적었지만 틀렸다 — `auth.ts` 의 `import * as desktop from
 *  './authDesktop.ts'` 는 **정적** import 라 이 모듈은 웹 번들에도 통째로 들어간다. 안전한
 *  것은 이 파일이 아니라 `desktopClientSecret()` 이 읽는 값이다: `SPIN_DESKTOP_*` 는
 *  `vite.config.ts` 의 `envPrefix` 가 Tauri 빌드가 아니면 주입을 막으므로, 웹 번들에서는 이
 *  함수가 항상 빈 문자열을 돌려준다(코드는 실려도 시크릿 값은 안 실린다).
 *
 *  ⚠️ 2026-09-17 — 판정 자체는 `platform/shell.ts` 로 나갔고 여기 남은 것은 **이름**뿐이다.
 *  같은 날 검수 뒤 정정: `auth.ts` 는 이제 `nativeShell()` 만 보고 이 함수를 부르지 않는다 — 남은
 *  호출자는 `authDesktop.test.ts` 뿐이다. 그 테스트의 계약(전역 유무로 판정)은 shell.ts 의 것이니
 *  케이스를 그쪽으로 옮기면 이 함수는 지워도 된다(AGENTS §9). 셸이 둘이 되면서 판정을 한 벌 더
 *  두면 안 되는 이유는 그쪽 머리말에 있다(결정 4). */
export function isDesktop(): boolean {
  return isTauriWebview();
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

// ── 토큰 ─────────────────────────────────────────────────────────────────────────────

/** 이 셸 몫의 접근 토큰 캐시(안드로이드는 자기 것을 따로 만든다 — authInstalled.ts 머리말). */
const cache = createTokenCache();

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

  const url = await authorizeUrl({ clientId, redirectUri, verifier, state });

  try {
    await openInBrowser(url);
  } catch (e) {
    await invoke('oauth_cancel').catch(() => {});
    throw authError(`브라우저를 열지 못함: ${String(e)}`);
  }

  const query = await invoke<string>('oauth_wait').catch((e) => {
    throw authError(String(e));
  });
  const code = codeFromRedirect(new URLSearchParams(query), state);

  const body = await postToken({
    code,
    client_id: clientId,
    client_secret: desktopClientSecret(),
    code_verifier: verifier,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
  });
  const token = cache.remember(body);
  // 갱신 토큰은 **있을 때만** 덮어쓴다. 구글이 안 줄 때가 있는데(이미 동의가 살아 있는 계정),
  // 그때 빈 값으로 덮으면 멀쩡히 쓰던 연결이 다음 실행에서 끊긴다.
  if (body.refresh_token) await invoke('secret_save', { value: body.refresh_token }).catch(() => {});

  const email = await emailHint(token);
  return { token, ...(email ? { email } : {}) };
}

/** 엔진의 입구. 캐시가 살아 있으면 그대로, 아니면 갱신 토큰으로 조용히 새로 받는다. */
export async function getAccessToken(): Promise<string> {
  const live = cache.live();
  if (live) return live;

  const clientId = desktopClientId();
  if (!clientId) throw authError('데스크톱 client id 미설정');
  const refresh = await invoke<string | null>('secret_load').catch(() => null);
  if (!refresh) throw authError('갱신 토큰 없음 — 다시 연결해야 합니다');

  try {
    return cache.remember(
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
  cache.clear();
}

/** [연결 해제]. 구글 쪽 회수는 best-effort 지만 **로컬 갱신 토큰은 반드시 지운다** —
 *  회수가 실패했는데 열쇠까지 남으면 '해제했다' 는 말이 거짓이 된다. */
export async function revokeAccess(): Promise<void> {
  const token = cache.held() ?? (await invoke<string | null>('secret_load').catch(() => null));
  cache.clear();
  await invoke('secret_clear').catch(() => {});
  if (!token) return;
  await revokeRemote(token);
}

/** 테스트 전용. */
export function resetDesktopAuthForTest(): void {
  cache.clear();
}
