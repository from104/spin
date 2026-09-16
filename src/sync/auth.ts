// 0.6 Drive 동기화 — Google Identity Services(GIS) 토큰 수명 관리. 이 모듈만 구글 로그인의
// 세부를 안다: drive.ts 는 "토큰 하나로 요청 하나", 엔진은 "getAccessToken() 이 주는 것".
//
// 원칙(계획서 §OAuth):
// - **GIS 스크립트는 지연 주입** — 동기화를 켠 사용자의 흐름에서만 <script> 가 붙는다.
//   끈 사용자는 구글 접속이 0회다("데이터는 여러분 컴에만" 공지와의 약속).
// - **토큰은 메모리만.** localStorage·IDB 어디에도 쓰지 않는다 — 백업 파일이 prefs 를 통째로
//   싣기 때문에(transfer.ts), 저장하는 순간 토큰이 백업을 타고 다른 기기·다른 사람에게 간다.
//   대신 구글 쪽 동의(grant)가 남아 있어 다음 세션은 prompt:'' 무음 갱신으로 이어진다.
// - 무음 갱신은 8초 타임아웃 — 콜백이 영영 안 오는 실패 모드(Safari ITP·팝업 차단)가 실재한다.
//   대화형(consent)은 타임아웃이 없다: 사용자가 계정 고르는 시간은 우리가 정할 수 없다.
// - client id 는 VITE_GOOGLE_CLIENT_ID 주입(하드코딩 0). 미설정 빌드는 설정 화면이 섹션을
//   비활성으로 보여준다(isSyncConfigured).
//
// ⚠️ 2026-08-27 — **데스크톱(Tauri)은 이 길을 못 쓴다.** GIS 는 웹뷰에서 팝업을 못 띄우고
// (`Failed to open popup window`), 띄웠어도 origin 이 `tauri://localhost` 라 구글 콘솔에
// 등록할 수 없다. 그래서 아래 공개 함수 넷은 **플랫폼을 보고 authDesktop.ts 로 넘긴다** —
// 외부 브라우저 + 루프백 + PKCE(설치형 앱 흐름). 갈라지는 곳을 이 파일 한 군데로 모은 것은
// 소비자(SyncSection·엔진)가 플랫폼을 몰라도 되게 하려는 것이다: 그쪽은 한 줄도 안 바뀐다.
//
// ⚠️ 2026-09-17 — 셸이 **셋**이 됐다(웹 · Tauri · Capacitor/안드로이드). 안드로이드도 웹뷰 안
// 구글 로그인이 막혀 있어(`disallowed_useragent`) 설치형 앱 흐름을 쓴다 — `authAndroid.ts`.
// 갈라지는 곳은 여전히 이 파일 하나이고, 어느 모듈로 갈지는 `platform/shell.ts` 의
// `nativeShell()` 한 벌이 정한다(PLAN-ANDROID 결정 4·5). 여기에 판정을 다시 적지 않는다.
import { nativeShell } from '../platform/shell.ts';
import { StorageError, STORAGE_ERROR_MESSAGES } from '../storage/errors.ts';
import * as android from './authAndroid.ts';
import * as desktop from './authDesktop.ts';
import { DRIVE_SCOPE } from './authInstalled.ts';

/** 요청하는 구글 권한 범위. 값의 정본은 `authInstalled.ts`(웹과 설치형이 **같은 범위**를
 *  요구해야 한 계정이 두 번 동의하지 않는다). 이름은 여기 남긴다 — 옛 소비자가 이 경로로 읽는다. */
export { DRIVE_SCOPE };

/** 무음 갱신 대기 상한. GIS 는 실패 시 콜백을 안 부르는 경우가 있어(iframe 침묵) 상한이 없으면
 *  엔진이 영영 멈춘다. */
const SILENT_TIMEOUT_MS = 8_000;
/** GIS 스크립트 로드 대기 상한 — 광고차단기가 accounts.google.com 을 막는 환경이 실재한다. */
const GIS_LOAD_TIMEOUT_MS = 10_000;
/** 만료 이만큼 전이면 미리 갱신한다 — 패스 도중 만료로 반쯤 실패하는 것보다 싸다. */
const EXPIRY_MARGIN_MS = 60_000;

// ── GIS 최소 타입(전역 선언 없이 이 모듈 안에서만) ─────────────────────────────────────

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
}
interface TokenClient {
  requestAccessToken(cfg?: { prompt?: '' | 'consent'; login_hint?: string }): void;
}
interface GisOauth2 {
  initTokenClient(cfg: {
    client_id: string;
    scope: string;
    callback: (r: TokenResponse) => void;
    error_callback?: (e: { type?: string; message?: string }) => void;
  }): TokenClient;
  revoke(token: string, done?: () => void): void;
}

function gisOauth2(): GisOauth2 | undefined {
  const w = globalThis as { google?: { accounts?: { oauth2?: GisOauth2 } } };
  return w.google?.accounts?.oauth2;
}

// ── 구성 ─────────────────────────────────────────────────────────────────────────────

export function syncClientId(): string | undefined {
  const raw = (import.meta.env as Record<string, unknown>).VITE_GOOGLE_CLIENT_ID;
  const id = typeof raw === 'string' ? raw.trim() : '';
  return id.length > 0 ? id : undefined;
}

/** 설치형 셸(데스크톱·안드로이드)의 로그인 모듈이 **공통으로** 가져야 하는 모양. 이름을 붙인
 *  이유는 컴파일러에게 시키기 위해서다 — 한쪽에 함수를 더하거나 시그니처를 바꾸고 다른 쪽을
 *  잊으면 여기서 빨간불이 난다(아래 `installedAuth()` 의 반환에 둘 다 대입된다). */
interface InstalledAuth {
  isConfigured(): boolean;
  connectInteractive(): Promise<{ token: string; email?: string }>;
  getAccessToken(): Promise<string>;
  invalidateToken(): void;
  revokeAccess(): Promise<void>;
}

/** 지금 실행이 쓸 설치형 로그인 모듈. 웹(브라우저 배포본·개발 서버)에서는 `null` 이고, 그때만
 *  아래 GIS 경로가 돈다. 셸이 늘면 `nativeShell()` 과 이 스위치 둘만 넓힌다. */
function installedAuth(): InstalledAuth | null {
  switch (nativeShell()) {
    case 'tauri':
      return desktop;
    case 'android':
      return android;
    default:
      return null;
  }
}

/** 이 배포에 동기화가 구성돼 있는가 — 설정 화면이 섹션 활성/비활성을 가르는 기준. */
export function isSyncConfigured(): boolean {
  const installed = installedAuth();
  return installed ? installed.isConfigured() : syncClientId() !== undefined;
}

// ── GIS 로드 ─────────────────────────────────────────────────────────────────────────

let gisLoading: Promise<void> | null = null;

function loadGis(): Promise<void> {
  if (gisOauth2()) return Promise.resolve();
  if (!gisLoading) {
    gisLoading = new Promise<void>((resolve, reject) => {
      const fail = (detail: string) => {
        gisLoading = null; // 다음 시도(재연결 버튼)가 다시 주입할 수 있어야 한다
        reject(new StorageError('E_SYNC_NETWORK', STORAGE_ERROR_MESSAGES.E_SYNC_NETWORK(), { detail }));
      };
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      const timer = setTimeout(() => fail('GIS 로드 시간 초과'), GIS_LOAD_TIMEOUT_MS);
      s.onload = () => {
        clearTimeout(timer);
        if (gisOauth2()) resolve();
        else fail('GIS 로드됐지만 oauth2 없음');
      };
      // 광고차단기·프록시가 accounts.google.com 을 막는 환경 — 네트워크 오류로 접어 안내한다.
      s.onerror = () => {
        clearTimeout(timer);
        fail('GIS 스크립트 차단(광고차단기 가능성)');
      };
      document.head.append(s);
    });
  }
  return gisLoading;
}

// ── 토큰 ─────────────────────────────────────────────────────────────────────────────

let cached: { token: string; expiresAt: number } | null = null;

function requestToken(prompt: '' | 'consent', loginHint?: string): Promise<string> {
  // 구성 검사가 GIS 로드보다 먼저다 — 미구성 배포에서 스크립트 주입(구글 접속)조차 하지 않는다.
  const clientId = syncClientId();
  if (!clientId) {
    return Promise.reject(new StorageError('E_SYNC_AUTH', STORAGE_ERROR_MESSAGES.E_SYNC_AUTH(), { detail: 'client id 미설정' }));
  }
  return loadGis().then(
    () =>
      new Promise<string>((resolve, reject) => {
        let settled = false;
        const settle = (fn: () => void) => {
          if (settled) return;
          settled = true;
          if (timer !== undefined) clearTimeout(timer);
          fn();
        };
        // 대화형은 무제한 — 사용자가 계정을 고르고 동의를 읽는 시간은 우리 몫이 아니다.
        const timer =
          prompt === ''
            ? setTimeout(
                () => settle(() => reject(new StorageError('E_SYNC_AUTH', STORAGE_ERROR_MESSAGES.E_SYNC_AUTH(), { detail: '무음 갱신 시간 초과' }))),
                SILENT_TIMEOUT_MS,
              )
            : undefined;
        const client = gisOauth2()!.initTokenClient({
          client_id: clientId,
          scope: DRIVE_SCOPE,
          callback: (r) => {
            settle(() => {
              if (!r.access_token || r.error) {
                reject(new StorageError('E_SYNC_AUTH', STORAGE_ERROR_MESSAGES.E_SYNC_AUTH(), { detail: r.error ?? '토큰 없음' }));
                return;
              }
              cached = { token: r.access_token, expiresAt: Date.now() + (r.expires_in ?? 3600) * 1000 };
              resolve(r.access_token);
            });
          },
          error_callback: (e) => {
            settle(() => reject(new StorageError('E_SYNC_AUTH', STORAGE_ERROR_MESSAGES.E_SYNC_AUTH(), { detail: e.type ?? e.message ?? 'GIS 오류' })));
          },
        });
        client.requestAccessToken({ prompt, ...(loginHint ? { login_hint: loginHint } : {}) });
      }),
  );
}

/** 엔진의 유일한 입구. 캐시가 살아 있으면 그대로, 아니면 무음 갱신 — 실패는 E_SYNC_AUTH 로
 *  올라가 엔진이 멈추고 설정에 '재연결' 칩이 뜬다(대화형 재시도는 사용자 제스처에서만). */
export function getAccessToken(loginHint?: string): Promise<string> {
  // 설치형은 갱신 토큰으로 조용히 새로 받는다 — 힌트가 필요 없다(계정이 토큰에 박혀 있다).
  const installed = installedAuth();
  if (installed) return installed.getAccessToken();
  if (cached && cached.expiresAt - EXPIRY_MARGIN_MS > Date.now()) return Promise.resolve(cached.token);
  return requestToken('', loginHint);
}

/** [Google 계정 연결] 버튼 전용 — 사용자 제스처 문맥에서만 부른다(팝업 차단 회피).
 *  이메일 힌트는 부가 정보다: about 호출이 실패해도 연결 자체는 성공으로 친다(힌트가 없으면
 *  무음 갱신에서 계정 선택이 뜰 수 있을 뿐, 데이터에는 아무 영향이 없다). */
export async function connectInteractive(): Promise<{ token: string; email?: string }> {
  const installed = installedAuth();
  if (installed) return installed.connectInteractive();
  const token = await requestToken('consent');
  let email: string | undefined;
  try {
    const res = await fetch('https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const body = (await res.json()) as { user?: { emailAddress?: string } };
      email = body.user?.emailAddress;
    }
  } catch {
    /* 힌트일 뿐 — 삼킨다 */
  }
  return { token, ...(email ? { email } : {}) };
}

/** 401 을 받은 호출자가 부른다 — 캐시를 버려 다음 getAccessToken 이 무음 갱신을 시도하게. */
export function invalidateToken(): void {
  // 모든 캐시를 다 버린다 — 한 프로세스에 셋 중 하나만 사는데, 어느 쪽인지 여기서 따질
  // 이유가 없다(다 버리는 것이 안전하고 싸다). 그래서 이 함수만 스위치를 타지 않는다.
  desktop.invalidateToken();
  android.invalidateToken();
  cached = null;
}

/** [연결 해제] — 구글 쪽 동의 회수는 best-effort(오프라인이면 조용히 실패), 메모리 토큰은
 *  확실히 버린다. 로컬 데이터·동기화 행·톰스톤은 **여기서 건드리지 않는다**(ROADMAP "연결
 *  끊어도 로컬 유지" — 해제는 prefs.sync.enabled 를 끄는 호출자의 몫과 합쳐 완성된다). */
export async function revokeAccess(): Promise<void> {
  const installed = installedAuth();
  if (installed) return installed.revokeAccess();
  const token = cached?.token;
  cached = null;
  if (!token) return;
  try {
    await loadGis();
    await new Promise<void>((resolve) => {
      gisOauth2()!.revoke(token, resolve);
      // revoke 콜백이 안 오는 구현 대비 — 회수는 best-effort 라 3초면 충분히 기다렸다.
      setTimeout(resolve, 3_000);
    });
  } catch {
    /* best-effort */
  }
}

/** 테스트 전용 — 모듈 상태 초기화. */
export function resetAuthForTest(): void {
  // invalidateToken 과 같은 이유로 셋을 다 비운다 — 테스트가 플랫폼을 흔들어 가며 돌기 때문에
  // «지금 어느 셸인가» 를 보고 비우면 직전 케이스가 남긴 캐시가 살아남는다.
  desktop.resetDesktopAuthForTest();
  android.resetAndroidAuthForTest();
  cached = null;
  gisLoading = null;
}
