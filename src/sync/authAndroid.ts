// 안드로이드(Capacitor) 구글 로그인 — 데스크톱과 **같은** 설치형 앱 흐름(RFC 8252)이지만
// 돌아오는 길이 다르다: 외부 브라우저 + 루프백이 아니라 **Custom Tabs + 커스텀 스킴**이다.
// 정본은 `docs/PLAN-ANDROID.md` §1 결정 5·6·7. 공통 조각(PKCE·state·토큰 종점·캐시·회수)은
// `authInstalled.ts` 에 있고, 이 파일은 «안드로이드만의 것» 만 안다.
//
// ── 왜 앱 웹뷰 안에서 로그인시키지 않는가 ────────────────────────────────────────────
// 구글이 임베디드 웹뷰의 로그인을 `disallowed_useragent` 로 **차단**한다(피싱 방지). 그래서
// 앱 화면 안에서 accounts.google.com 을 여는 길은 애초에 없다. `@capacitor/browser` 가 띄우는
// Custom Tab 은 크롬 본체가 그리는 창이라 그 검사를 통과하고, 사용자가 이미 기기에 로그인한
// 계정도 그대로 보인다(앱 웹뷰에는 쿠키가 없다).
//
// ── 클라이언트가 데스크톱과 **또** 다르다 ────────────────────────────────────────────
// 구글 콘솔의 '안드로이드' 유형 클라이언트는 **시크릿이 없다** — 칸 자체가 없고, redirect_uri 도
// 등록하지 않는다(패키지명 + 서명 SHA-1 이 그 자리를 대신한다). 그래서 토큰 교환 본문에
// `client_secret` 을 넣지 않는다. 넣으면 구글이 거부한다. 가로챈 코드를 막는 것은 PKCE 하나다.
// 값은 `SPIN_ANDROID_GOOGLE_CLIENT_ID` 로 주입한다 — 공개값이라 시크릿이 아니지만(결정 6),
// 접두어를 `VITE_` 로 쓰지 않는 이유는 `authDesktop.ts` 머리말과 같다: `vite.config.ts` 의
// `envPrefix` 가 `SPIN_ANDROID_BUILD` 일 때만 이 접두를 허용하므로 웹 번들에는 존재조차 않는다.
//
// ── 갱신 토큰을 두는 자리 ────────────────────────────────────────────────────────────
// `@capacitor/preferences`(앱 샌드박스 SharedPreferences)다. 데스크톱의 0600 파일과 같은 눈높이
// (암호화가 아니라 **프로세스 격리**)이고, 앱 `prefs`(IndexedDB)에 넣지 않는 이유는 웹·데스크톱과
// 같다: 백업 파일이 prefs 를 통째로 싣기 때문에(transfer.ts) 넣는 순간 남의 기기로 새어 나간다.
// ⚠️ SharedPreferences 는 그 자체가 구글 클라우드 백업·기기 이전에 실릴 수 있다 —
// `AndroidManifest.xml` 의 `allowBackup="false"` 와 `res/xml/data_extraction_rules.xml` 이 그것을
// 막는다(결정 7). **둘 중 하나라도 풀리면 이 열쇠가 백업을 타고 다른 기기로 간다.**
import type { PluginListenerHandle } from '@capacitor/core';

import { isCapacitorNative } from '../platform/shell.ts';
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

/** OAuth 복귀 스킴. **`AndroidManifest.xml` 의 `@string/custom_url_scheme`(= `app.atit.spin`,
 *  `src-android/app/build.gradle` 의 applicationId 와 같은 값) 와 한 글자도 달라선 안 된다** —
 *  어긋나면 구글은 성공 리다이렉트를 보내는데 안드로이드가 그것을 받을 앱을 못 찾아, 화면에는
 *  «페이지를 열 수 없음» 만 뜨고 앱은 영영 기다린다. 두 곳을 묶는 것이 이 주석이다(문자열
 *  리소스를 JS 에서 읽을 방법이 없다). */
const REDIRECT_SCHEME = 'app.atit.spin:';

/** 구글 콘솔에 등록하지 않는 값이지만 **authorize 와 token 두 요청에 똑같이** 실려야 한다
 *  (RFC 6749 §4.1.3 — 다르면 `redirect_uri_mismatch`). 슬래시가 하나인 것에 뜻이 있다:
 *  커스텀 스킴에는 호스트가 없다(`scheme:/path`). */
export const ANDROID_REDIRECT_URI = `${REDIRECT_SCHEME}/oauth2redirect`;

/** 갱신 토큰 열쇠 하나. `prefs.*` 와 접두를 나눠 둔 것은 «이건 백업에 실리면 안 되는 것» 이라는
 *  표시다 — `data_extraction_rules.xml` 이 sharedpref 를 통째로 빼므로 여기 다른 것을 더 넣으면
 *  그것도 같이 백업에서 빠진다. */
const REFRESH_KEY = 'spin.sync.refresh';

/** 이 셸 몫의 접근 토큰 캐시(데스크톱은 자기 것을 따로 만든다 — authInstalled.ts 머리말). */
const cache = createTokenCache();

export function isAndroid(): boolean {
  return isCapacitorNative();
}

export function androidClientId(): string | undefined {
  const raw = (import.meta.env as Record<string, unknown>).SPIN_ANDROID_GOOGLE_CLIENT_ID;
  const id = typeof raw === 'string' ? raw.trim() : '';
  return id.length > 0 ? id : undefined;
}

/** 데스크톱과 달리 **id 하나면 구성된 것**이다 — 안드로이드 클라이언트에는 시크릿이 없다. */
export function isConfigured(): boolean {
  return androidClientId() !== undefined;
}

// ── Capacitor 플러그인 (동적 import — 웹·데스크톱 번들에 안 들어간다) ─────────────────

async function openTab(url: string): Promise<void> {
  const { Browser } = await import('@capacitor/browser');
  await Browser.open({ url });
}

/** 돌아온 뒤 Custom Tab 을 닫는다. 안 닫으면 앱 위에 로그인 화면이 그대로 남아 사용자가
 *  «끝난 건가?» 를 스스로 판단해야 한다. 실패는 삼킨다 — 이미 닫힌 탭을 닫는 것은 오류가 아니다. */
async function closeTab(): Promise<void> {
  try {
    const { Browser } = await import('@capacitor/browser');
    await Browser.close();
  } catch {
    /* 이미 닫혔거나 닫을 수 없는 판 — 연결 성패와 무관하다 */
  }
}

async function preferences() {
  const { Preferences } = await import('@capacitor/preferences');
  return Preferences;
}

async function loadRefresh(): Promise<string | null> {
  try {
    return (await (await preferences()).get({ key: REFRESH_KEY })).value;
  } catch {
    return null;
  }
}

async function saveRefresh(value: string): Promise<void> {
  try {
    await (await preferences()).set({ key: REFRESH_KEY, value });
  } catch {
    /* 저장이 실패하면 다음 실행에서 다시 로그인할 뿐 — 이번 연결은 살아 있다 */
  }
}

async function clearRefresh(): Promise<void> {
  try {
    await (await preferences()).remove({ key: REFRESH_KEY });
  } catch {
    /* 지우기 실패는 되풀이해도 안전하다 */
  }
}

// ── 리다이렉트 수신 ──────────────────────────────────────────────────────────────────

interface ArmedRedirect {
  /** 커스텀 스킴으로 돌아온 질의. 사용자가 탭을 닫으면 **거절**된다. */
  readonly query: Promise<URLSearchParams>;
  /** 리스너를 걷어낸다. 안 걷으면 다음 연결 시도가 옛 리스너에 먼저 잡힌다. */
  disarm(): Promise<void>;
}

/** 리다이렉트를 받을 준비. 리스너 둘을 **탭을 열기 전에** 건다 — 이미 동의가 살아 있는 계정은
 *  Custom Tab 이 뜨자마자 돌아오므로, 열고 나서 걸면 그 복귀를 놓쳐 영영 기다린다. */
async function armRedirect(): Promise<ArmedRedirect> {
  const [{ App }, { Browser }] = await Promise.all([import('@capacitor/app'), import('@capacitor/browser')]);

  let settleQuery!: (q: URLSearchParams) => void;
  let failQuery!: (e: unknown) => void;
  const query = new Promise<URLSearchParams>((resolve, reject) => {
    settleQuery = resolve;
    failQuery = reject;
  });
  // 취소가 `Browser.open()` 을 기다리는 동안 올 수 있다. 그때 이 약속에 아직 아무도 안 붙어
  // 있으면 런타임이 «처리되지 않은 거절» 로 시끄럽게 군다(테스트 러너는 실패로 친다).
  // 빈 handler 를 하나 붙여 둬도 아래의 `await query` 는 그대로 거절을 받는다.
  void query.catch(() => {});

  const handles: PluginListenerHandle[] = [];
  const disarm = async (): Promise<void> => {
    for (const h of handles.splice(0)) await h.remove().catch(() => {});
  };

  handles.push(
    await App.addListener('appUrlOpen', (event) => {
      // ⚠️ 이 앱으로 오는 딥링크는 둘이다 — OAuth 복귀(커스텀 스킴)와 공유 링크
      //    (App Links, `https://spin.atit.app/s/…`, 결정 9). **스킴으로 가른다**: 경로까지
      //    비교하면 안드로이드가 URI 를 정규화했을 때 조용히 안 잡히고, 반대로 아무것이나
      //    받으면 로그인 중에 도착한 공유 링크가 로그인을 가로챈다.
      if (!event.url.startsWith(REDIRECT_SCHEME)) return;
      settleQuery(new URLSearchParams(new URL(event.url).search));
    }),
  );
  handles.push(
    await Browser.addListener('browserFinished', () => {
      // 복귀보다 이 이벤트가 먼저 왔다 = 사용자가 탭을 닫았다. 취소는 오류로 올려야 설정
      // 화면이 «연결됨» 으로 굳지 않는다(거절이 없으면 여기서 영영 멈춘다).
      failQuery(authError('로그인 창이 닫혔습니다'));
    }),
  );

  return { query, disarm };
}

// ── 공개 API — auth.ts 가 플랫폼을 보고 이쪽으로 넘긴다 ───────────────────────────────

/** [Google 계정 연결]. Custom Tab 을 열고, 커스텀 스킴으로 코드를 받고, 토큰으로 바꾼다. */
export async function connectInteractive(): Promise<{ token: string; email?: string }> {
  const clientId = androidClientId();
  if (!clientId) throw authError('안드로이드 client id 미설정');

  const verifier = randomToken();
  const state = randomToken();
  const url = await authorizeUrl({ clientId, redirectUri: ANDROID_REDIRECT_URI, verifier, state });

  const armed = await armRedirect();
  let params: URLSearchParams;
  try {
    await openTab(url);
    params = await armed.query;
  } catch (e) {
    await armed.disarm();
    // 취소·거절은 이미 StorageError 다 — 그것을 `String(e)` 로 다시 접으면 화면이 문구를
    // 못 만든다. 탭을 못 연 경우(플러그인 실패)만 새 오류로 감싼다.
    throw e instanceof StorageError ? e : authError(`로그인 창을 열지 못함: ${String(e)}`);
  }
  await armed.disarm();
  await closeTab();

  const code = codeFromRedirect(params, state);

  const body = await postToken({
    code,
    client_id: clientId,
    // ⚠️ `client_secret` 이 **없다** — 안드로이드 클라이언트에는 그런 것이 없다(머리말).
    code_verifier: verifier,
    grant_type: 'authorization_code',
    redirect_uri: ANDROID_REDIRECT_URI,
  });
  const token = cache.remember(body);
  // 갱신 토큰은 **있을 때만** 덮어쓴다 — 구글이 안 줄 때가 있는데(이미 동의가 살아 있는 계정),
  // 그때 빈 값으로 덮으면 멀쩡히 쓰던 연결이 다음 실행에서 끊긴다(데스크톱과 같은 함정).
  if (body.refresh_token) await saveRefresh(body.refresh_token);

  const email = await emailHint(token);
  return { token, ...(email ? { email } : {}) };
}

/** 엔진의 입구. 캐시가 살아 있으면 그대로, 아니면 갱신 토큰으로 조용히 새로 받는다. */
export async function getAccessToken(): Promise<string> {
  const live = cache.live();
  if (live) return live;

  const clientId = androidClientId();
  if (!clientId) throw authError('안드로이드 client id 미설정');
  const refresh = await loadRefresh();
  if (!refresh) throw authError('갱신 토큰 없음 — 다시 연결해야 합니다');

  try {
    return cache.remember(
      await postToken({
        refresh_token: refresh,
        client_id: clientId,
        grant_type: 'refresh_token',
      }),
    );
  } catch (e) {
    // 갱신 토큰이 죽었으면(사용자가 구글에서 권한을 뺐거나 만료) 들고 있어 봐야 매번 같은
    // 실패를 되풀이한다. 지워야 설정 화면이 '재연결' 로 정확히 안내한다. 네트워크 오류일
    // 때는 **지우지 않는다** — 오프라인은 토큰 탓이 아니다.
    // ⚠️ 이 한 줄은 `postToken` 의 오류 사상에 **전적으로** 기댄다: 거기서 일시 장애(5xx·429)를
    //    인증 오류로 접으면, 구글이 잠깐 넘어진 것만으로 여기가 멀쩡한 열쇠를 지운다. 그래서
    //    그 판정은 `authInstalled.ts` 한 곳에 있고 두 셸이 같은 답을 받는다(2026-09-17 검수).
    if (e instanceof StorageError && e.code === 'E_SYNC_AUTH') await clearRefresh();
    throw e;
  }
}

export function invalidateToken(): void {
  cache.clear();
}

/** [연결 해제]. 구글 쪽 회수는 best-effort 지만 **로컬 갱신 토큰은 반드시 지운다** —
 *  회수가 실패했는데 열쇠까지 남으면 '해제했다' 는 말이 거짓이 된다. */
export async function revokeAccess(): Promise<void> {
  const token = cache.held() ?? (await loadRefresh());
  cache.clear();
  await clearRefresh();
  if (!token) return;
  await revokeRemote(token);
}

/** 테스트 전용. */
export function resetAndroidAuthForTest(): void {
  cache.clear();
}
