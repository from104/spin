// 공유 링크 서버와 말하는 자리 (PLAN-SHARE-LINK 결정 3·4·10). **이 파일이 오류 어휘의 정본이다** —
// codec·crypto·link 가 여기 `ShareError` 를 던지고, UI(공유 시트·가져오기 시트)는 `kind` 하나만
// 보고 문구를 고른다. 서버 계약(경로·상태 코드)도 여기서만 안다: 다른 파일은 fetch 를 부르지 않는다.
//
// **주소는 빌드 시점이 아니라 부를 때 읽는다**(`shareApiBase()` 가 함수인 이유). 모듈 최상위에서
// `import.meta.env` 를 굳혀 두면 테스트가 `vi.stubEnv` 로 갈아도 이미 굳은 값이 남고, 데스크톱
// 빌드처럼 기준 주소가 다른 대상이 생겼을 때 갈아 끼울 자리가 없다.
//
// ⚠️ 서버는 **암호문만** 본다(결정 2). 이 파일에 평문·키가 들어오면 안 된다 — 잠그고 푸는 것은
// crypto.ts 의 일이고, 여기는 바이트 뭉치를 나르기만 한다.
//
// ── 서버 계약 (PLAN-SHARE-LINK 결정 4) ─────────────────────────────────
//   POST   <base>        content-type: application/octet-stream, 본문 = 암호문 (≤ 64 KiB)
//                        → 201 { id, deleteToken, expiresAt }
//   GET    <base>/:id    → 200 application/octet-stream (암호문), no-store
//   DELETE <base>/:id    Authorization: Bearer <deleteToken> → 204
//   상태 코드: 404 없음/만료 · 413 본문 초과 · 429 속도 제한 · 403 토큰 불일치
//
// ── ShareError 종류표 (7종) ────────────────────────────────────────────
//   'not-found'    404. 링크가 없거나 만료됐다.
//   'bad-key'      복호 실패(AES-GCM 태그 불일치 = 링크의 `#` 뒤가 잘렸거나 다른 키) · DELETE 403.
//   'too-new'      봉투/문서 스키마가 이 앱보다 새롭다(E_SCHEMA_TOO_NEW · migrate 'too-new').
//   'network'      fetch 자체가 실패했거나 서버가 알 수 없는 상태를 냈다.
//   'too-large'    413(올리기) · 펴는 중 1 MiB 초과(압축 폭탄, 결정 5).
//   'rate-limited' 429. 잠시 뒤 다시.
//   'invalid'      링크 꼴이 아니거나, 펴 보니 SPIN 드릴 봉투가 아니거나, 검증에서 떨어졌다.
// 화면에 보일 문구 4종으로의 사상은 `index.ts` 의 `SHARE_NOTICE_BY_KIND` 가 쥔다(결정 10).

export type ShareErrorKind =
  | 'not-found'
  | 'bad-key'
  | 'too-new'
  | 'network'
  | 'too-large'
  | 'rate-limited'
  | 'invalid';

/** ⚠️ `.message` 는 사람에게 보여줄 문구가 **아니다**(영어 식별자다). 화면 문구는 `kind` 를
 *  i18n 키로 옮겨 만든다 — StorageError 가 한국어를 굳혀 두고 i18n/storageError.ts 로 되번역해야
 *  했던 그 우회를 여기서는 처음부터 만들지 않는다. */
export class ShareError extends Error {
  readonly kind: ShareErrorKind;
  /** 서버가 준 상태 코드(있으면). 진단용이고 화면 분기에는 쓰지 않는다 — 분기는 kind 다. */
  readonly status?: number;
  constructor(kind: ShareErrorKind, options?: { cause?: unknown; status?: number }) {
    super(`share:${kind}`, options);
    this.name = 'ShareError';
    this.kind = kind;
    this.status = options?.status;
  }
}

/** ⚠️ 바이트 뭉치는 **`Uint8Array<ArrayBuffer>`** 로 못박는다. 맨 `Uint8Array` 는 TS 5.7 부터
 *  `Uint8Array<ArrayBufferLike>` 를 뜻하고, 그 안에 SharedArrayBuffer 가능성이 섞여 있어
 *  `fetch` 의 BodyInit 과 WebCrypto 의 BufferSource 어디에도 못 들어간다 — 공유 사슬 전체가
 *  이 한 타입을 손에서 손으로 넘기므로 별칭을 여기 하나 두고 codec·crypto 가 같이 쓴다. */
export type ShareBytes = Uint8Array<ArrayBuffer>;

export function isShareError(e: unknown): e is ShareError {
  return e instanceof ShareError;
}

/** 서버 본문 상한(결정 4·6). 클라이언트가 먼저 걸러 413 왕복을 아낀다. */
export const SHARE_MAX_CIPHERTEXT_BYTES = 64 * 1024;

/** 기준 주소. 기본은 **같은 출처 상대 경로**라 앱이 어느 도메인에 올라가도 자기 서버를 부른다
 *  (결정 3 도메인 독립). 뒤 슬래시는 붙어 있어도 지운다 — `${base}/${id}` 가 `//` 를 만들면
 *  Apache 프록시가 경로를 다르게 셈한다. */
export function shareApiBase(): string {
  const raw = import.meta.env.VITE_SHARE_API_BASE;
  const base = typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : '/api/share';
  return base.replace(/\/+$/, '');
}

export interface ShareUploadResult {
  /** base62 10자(결정 5). */
  id: string;
  /** base64url 32바이트. 서버는 sha256 만 갖는다 — 잃으면 회수할 길이 없다. */
  deleteToken: string;
  /** epoch ms. 마지막 열람 뒤 180일(결정 6)이라 열 때마다 뒤로 밀린다. */
  expiresAt: number;
}

/** fetch 자체가 못 뜬 경우와 서버가 낸 상태 코드를 가른다 — 전자만 'network' 다. */
async function call(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (e) {
    throw new ShareError('network', { cause: e });
  }
}

function errorForStatus(status: number): ShareError {
  if (status === 404) return new ShareError('not-found', { status });
  if (status === 413) return new ShareError('too-large', { status });
  if (status === 429) return new ShareError('rate-limited', { status });
  if (status === 403) return new ShareError('bad-key', { status });
  if (status === 400) return new ShareError('invalid', { status });
  return new ShareError('network', { status });
}

export async function uploadCiphertext(bytes: ShareBytes): Promise<ShareUploadResult> {
  // 서버가 413 을 내기 전에 여기서 끊는다 — 64 KiB 를 넘는 드릴은 링크로 나갈 수 없다는
  // 사실을 왕복 없이 즉시 알려야 공유 시트가 다른 길(파일 내보내기)을 권할 수 있다.
  if (bytes.byteLength > SHARE_MAX_CIPHERTEXT_BYTES) throw new ShareError('too-large');
  const res = await call(shareApiBase(), {
    method: 'POST',
    headers: { 'content-type': 'application/octet-stream' },
    body: bytes,
  });
  if (!res.ok) throw errorForStatus(res.status);
  let json: unknown;
  try {
    json = await res.json();
  } catch (e) {
    throw new ShareError('network', { cause: e, status: res.status });
  }
  if (
    typeof json !== 'object' ||
    json === null ||
    typeof (json as ShareUploadResult).id !== 'string' ||
    typeof (json as ShareUploadResult).deleteToken !== 'string' ||
    typeof (json as ShareUploadResult).expiresAt !== 'number'
  ) {
    // 201 인데 몸통이 계약과 다르다 = 우리 서버가 아닌 무언가(프록시 오류 페이지)가 답했다.
    throw new ShareError('network', { status: res.status });
  }
  const { id, deleteToken, expiresAt } = json as ShareUploadResult;
  return { id, deleteToken, expiresAt };
}

export async function fetchCiphertext(id: string): Promise<ShareBytes> {
  const res = await call(`${shareApiBase()}/${encodeURIComponent(id)}`, {
    method: 'GET',
    headers: { accept: 'application/octet-stream' },
    // 만료가 갱신되는 자원이라 중간 캐시가 답을 재사용하면 안 된다(서버도 no-store 를 준다).
    cache: 'no-store',
  });
  if (!res.ok) throw errorForStatus(res.status);
  // ⚠️ 받는 쪽도 상한을 건다(2026-09-07 검수). 우리 서버는 64 KiB 넘는 항목을 만들지 않지만, 이
  //    200 응답이 우리 서버의 것이라는 보장이 없다(캡티브 포털·잘못 붙은 프록시가 HTML 을 얹는다).
  //    복호·펴기 **전에** 세어 넘으면 끊는다 — codec 의 펴기 상한(1 MiB)은 그 뒤의 일이라 여기를
  //    못 지킨다. 선언된 길이가 있으면 읽기 전에, 없으면 청크마다 센다.
  const declared = Number(res.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > SHARE_MAX_CIPHERTEXT_BYTES) throw new ShareError('too-large', { status: res.status });
  try {
    return await readCapped(res, SHARE_MAX_CIPHERTEXT_BYTES);
  } catch (e) {
    if (e instanceof ShareError) throw e;
    throw new ShareError('network', { cause: e, status: res.status });
  }
}

/** 몸통을 `max` 바이트까지만 읽는다. 넘으면 스트림을 취소하고 'too-large'. */
async function readCapped(res: Response, max: number): Promise<ShareBytes> {
  const body = res.body;
  if (!body) {
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength > max) throw new ShareError('too-large', { status: res.status });
    return buf;
  }
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel();
      throw new ShareError('too-large', { status: res.status });
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.byteLength;
  }
  return out;
}

/** 회수. 토큰이 틀리면 403 → 'bad-key' 다(서버 파일을 남의 링크로 못 지운다는 결정 5의 이면). */
export async function deleteShared(id: string, deleteToken: string): Promise<void> {
  const res = await call(`${shareApiBase()}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${deleteToken}` },
  });
  // 이미 없는 것(404)은 성공으로 친다 — 회수의 목적은 "서버에 없게 하는 것" 이고, 만료로
  // 먼저 사라진 링크에 오류를 띄우면 사용자는 지워지지 않았다고 오해한다.
  if (res.status === 404) return;
  if (!res.ok) throw errorForStatus(res.status);
}
