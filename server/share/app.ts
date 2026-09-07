// 공유 링크 서버 — 순수 핸들러 (HTTP 없이 부를 수 있다)
//
// 정본: `docs/PLAN-SHARE-LINK.md` 결정 4·5·6·7. 상위 정본 `AGENTS.md`.
//
// ── 왜 index.ts 와 갈랐나 ────────────────────────────────────────────────────────────
// `handle(req) → res` 는 소켓·스트림·포트를 모른다. 그래서 `app.test.ts` 가 서버를 띄우지 않고
// 요청 객체를 손으로 만들어 부른다 — 포트 충돌도, 비동기 종료 경쟁도, 남는 프로세스도 없다.
// 그 대신 **본문을 다 받은 뒤에만** 부를 수 있다는 제약이 생기는데, 상한이 64 KiB 라 그것이
// 문제가 되지 않는다(index.ts 가 그 상한까지만 읽고 끊는다).
//
// ── 이 서버가 볼 수 없는 것 ──────────────────────────────────────────────────────────
// 본문은 AES-GCM 암호문이다. 서버는 **바이트를 세고 나를 뿐** 뜻을 모른다. 그래서 내용 기반
// 남용 대책(신고·검열)이 원리적으로 불가능하고, 손잡이는 크기(64 KiB)·속도(토큰 버킷)·
// 만료(마지막 열람 뒤 180일) 셋뿐이다. 이 세 개를 약하게 만드는 변경은 대체 수단이 없다.
//
// ── 응답 규약 ────────────────────────────────────────────────────────────────────────
// 모든 응답에 `Cache-Control: no-store` 와 `X-Content-Type-Options: nosniff` 가 붙는다.
// no-store 는 미관이 아니다 — 중간 캐시가 암호문을 들고 있으면 만료·삭제가 거짓말이 된다.
// 오류는 예외 없이 `{"error":"…"}` JSON 한 모양이다(클라이언트가 문구가 아니라 코드를 본다).

import { createRateLimiter } from './ratelimit.ts'
import type { RateLimiter } from './ratelimit.ts'
import { createStore, hashToken, newDeleteToken, tokenMatches, ID_RE } from './store.ts'
import type { ShareStore } from './store.ts'

/** API 의 뿌리. 운영은 Apache 가 이 접두어로 프록시하고, 개발은 Vite 가 `/api` 를 넘긴다. */
export const API_BASE = '/api/share'

export interface ShareConfig {
  dataDir: string
  /** 본문 상한(바이트). 넘으면 413. */
  maxBytes: number
  /** 마지막 열람 뒤 이만큼 지나면 만료. */
  ttlDays: number
  /** `'*'` 이거나 쉼표로 나눈 출처 목록. */
  allowedOrigins: string
  ratePostPerHour: number
  rateGetPerHour: number
  /** 시계 주입 — TTL·속도 제한을 테스트가 결정적으로 재기 위한 구멍. 기본 `Date.now`. */
  now?: () => number
}

/** 헤더 값은 node 의 `IncomingMessage.headers` 모양을 그대로 받는다. */
export type ShareHeaders = Record<string, string | string[] | undefined>

export interface ShareRequest {
  method: string
  /** 쿼리를 뺀 경로. 붙어 와도 이 안에서 자른다. */
  path: string
  headers: ShareHeaders
  body: Buffer
  /** 속도 제한의 키. index.ts 가 `SHARE_TRUST_PROXY` 에 따라 정한다. */
  ip: string
}

export interface ShareResponse {
  status: number
  headers: Record<string, string>
  body: Buffer
}

export interface ShareApp {
  handle(req: ShareRequest): Promise<ShareResponse>
  /** 만료본 청소 + 속도 버킷 정리. index.ts 의 타이머가 부른다. 지운 항목 수를 낸다. */
  sweep(): Promise<number>
  store: ShareStore
}

const DAY_MS = 86_400_000

function headerOf(headers: ShareHeaders, name: string): string | undefined {
  const v = headers[name] ?? headers[name.toLowerCase()]
  if (Array.isArray(v)) return v[0]
  return v
}

/**
 * CORS 헤더.
 *
 * 기본이 `*` 인 이유(결정 7): 올라가는 것이 암호문뿐이라 출처 제한이 **지키는 것이 없다**.
 * 그리고 이 기능은 도메인 독립이 요구사항이다(개발 서버·데스크톱·앞으로 생길 주소). 좁히고
 * 싶으면 `SHARE_ALLOWED_ORIGINS` 에 목록을 준다 — 그때는 `Vary: Origin` 을 붙여 캐시가
 * 한 출처의 답을 다른 출처에 주지 않게 한다.
 */
function corsHeaders(allowed: string, origin: string | undefined): Record<string, string> {
  if (allowed.trim() === '*') return { 'Access-Control-Allow-Origin': '*' }
  const list = allowed.split(',').map((s) => s.trim()).filter(Boolean)
  const h: Record<string, string> = { Vary: 'Origin' }
  if (origin && list.includes(origin)) h['Access-Control-Allow-Origin'] = origin
  return h
}

/**
 * 속도 제한의 키가 될 IP. index.ts 가 소켓마다 부른다.
 *
 * ⚠️ 프록시를 믿을 때 `X-Forwarded-For` 의 **마지막** 주소를 쓴다, 첫 주소가 아니다(2026-09-07
 *    검수에서 고쳤다). Apache mod_proxy 는 클라이언트가 보낸 X-Forwarded-For 를 버리지 않고
 *    그 뒤에 자기가 본 주소를 **덧붙인다**(`a, b, <진짜>`). 첫 칸을 믿으면 요청마다 다른 값을
 *    적어 보내는 것만으로 속도 제한이 통째로 풀린다. 우리 앞단은 한 단(Apache 하나)이라 맨 뒤가
 *    그 프록시가 본 주소다 — 단이 늘면 여기서 그 수만큼 앞으로 세야 한다.
 */
export function clientIpOf(headers: ShareHeaders, socketAddress: string | undefined, trustProxy: boolean): string {
  if (trustProxy) {
    const xff = headerOf(headers, 'x-forwarded-for')
    const last = xff?.split(',').map((s) => s.trim()).filter(Boolean).pop()
    if (last) return last
  }
  return socketAddress ?? 'unknown'
}

export function createApp(config: ShareConfig): ShareApp {
  const clock = config.now ?? Date.now
  const ttlMs = config.ttlDays * DAY_MS
  const store = createStore(config.dataDir, ttlMs)
  const postLimit: RateLimiter = createRateLimiter(config.ratePostPerHour)
  const getLimit: RateLimiter = createRateLimiter(config.rateGetPerHour)

  function base(req: ShareRequest): Record<string, string> {
    return {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...corsHeaders(config.allowedOrigins, headerOf(req.headers, 'origin')),
    }
  }

  function json(req: ShareRequest, status: number, value: unknown, extra?: Record<string, string>): ShareResponse {
    const body = Buffer.from(JSON.stringify(value), 'utf8')
    return {
      status,
      headers: {
        ...base(req),
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': String(body.length),
        ...extra,
      },
      body,
    }
  }

  function fail(req: ShareRequest, status: number, error: string, extra?: Record<string, string>): ShareResponse {
    return json(req, status, { error }, extra)
  }

  function preflight(req: ShareRequest): ShareResponse {
    return {
      status: 204,
      headers: {
        ...base(req),
        // Authorization 이 목록에 없으면 DELETE 프리플라이트가 브라우저에서 막힌다 —
        // 삭제가 통째로 죽는데 서버 로그에는 아무 흔적이 없는 종류의 고장이다.
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        'Access-Control-Max-Age': '86400',
        // Content-Length 를 안 붙인다 — RFC 9110 §8.6: 204 에는 보내면 안 된다(node 는 붙이면
        // 그대로 내보낸다). 2026-09-07 검수에서 실제 소켓 응답에 `Content-Length: 0` 이 찍혀 뺐다.
      },
      body: Buffer.alloc(0),
    }
  }

  async function create(req: ShareRequest): Promise<ShareResponse> {
    const now = clock()
    const rate = postLimit.take(req.ip, now)
    if (!rate.ok) return fail(req, 429, 'rate-limited', { 'Retry-After': String(rate.retryAfter) })
    if (req.body.length === 0) return fail(req, 400, 'empty')
    if (req.body.length > config.maxBytes) return fail(req, 413, 'too-large')

    const token = newDeleteToken()
    const id = await store.put(req.body, hashToken(token), now)
    // ⚠️ expiresAt 은 **바닥값**이다. TTL 은 마지막 열람 기준이라 누가 열 때마다 뒤로 밀린다.
    //    클라이언트에게 "적어도 이때까지는 산다" 로 읽히게 이름과 문서를 맞춰 둔다.
    // ⚠️ 2026-09-07 검수: ISO 8601 문자열이었다가 **epoch ms 숫자**로 바꿨다. 클라이언트
    //    (src/share/api.ts `uploadCiphertext`)가 `typeof expiresAt === 'number'` 를 요구하는데
    //    서버가 문자열을 주니, 업로드는 201 로 성공해 놓고 화면은 "서버에 못 닿음" 을 띄웠다 —
    //    그 항목은 id·토큰을 아무도 못 받아 만료까지 지울 수 없는 고아가 됐다. 양쪽 단위
    //    테스트가 각자 상대를 목으로 세워 둘 다 초록이었고, 실기 왕복에서야 드러났다. 이 앱의
    //    시각은 전부 epoch ms(메타의 createdAt·lastAccessAt 도 같다)라 서버 쪽을 맞췄다.
    const expiresAt = now + ttlMs
    return json(req, 201, { id, deleteToken: token, expiresAt })
  }

  async function read(req: ShareRequest, id: string): Promise<ShareResponse> {
    const now = clock()
    const rate = getLimit.take(req.ip, now)
    if (!rate.ok) return fail(req, 429, 'rate-limited', { 'Retry-After': String(rate.retryAfter) })

    const found = await store.get(id, now)
    // ⚠️ 없는 것과 만료된 것을 **같은 404** 로 답한다. 가르면 "그 id 는 있었다" 가 새고,
    //    받는 쪽이 할 일도 어차피 같다(링크가 죽었다).
    if (!found) return fail(req, 404, 'not-found')
    return {
      status: 200,
      headers: {
        ...base(req),
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(found.bytes.length),
      },
      body: found.bytes,
    }
  }

  async function destroy(req: ShareRequest, id: string): Promise<ShareResponse> {
    const now = clock()
    // 삭제도 쓰기다 — POST 버킷을 같이 쓴다. 별도 버킷을 두면 그쪽이 무제한 탐색 창구가 된다.
    const rate = postLimit.take(req.ip, now)
    if (!rate.ok) return fail(req, 429, 'rate-limited', { 'Retry-After': String(rate.retryAfter) })

    const meta = await store.meta(id, now)
    if (!meta) return fail(req, 404, 'not-found')

    const auth = headerOf(req.headers, 'authorization') ?? ''
    const token = auth.startsWith('Bearer ') ? auth.slice('Bearer '.length).trim() : ''
    if (!token || !tokenMatches(token, meta.deleteHash)) return fail(req, 403, 'forbidden')

    await store.remove(id)
    return { status: 204, headers: base(req), body: Buffer.alloc(0) }
  }

  return {
    store,

    async sweep() {
      const now = clock()
      postLimit.sweep(now)
      getLimit.sweep(now)
      return store.sweep(now)
    },

    async handle(req) {
      const path = req.path.split('?')[0] ?? ''
      const method = req.method.toUpperCase()

      if (path === API_BASE) {
        if (method === 'OPTIONS') return preflight(req)
        if (method === 'POST') return create(req)
        return fail(req, 405, 'method-not-allowed')
      }

      if (path === `${API_BASE}/healthz`) {
        if (method === 'OPTIONS') return preflight(req)
        if (method === 'GET') return json(req, 200, { ok: true, count: await store.count() })
        return fail(req, 405, 'method-not-allowed')
      }

      if (path.startsWith(`${API_BASE}/`)) {
        const id = path.slice(API_BASE.length + 1)
        // ⚠️ 형식이 아닌 것은 **전부 404** 다. `..`·`%2e%2e`·슬래시가 낀 것도 여기서 끝난다 —
        //    store 에 닿기 전에 잘리므로 디렉터리 탈출 시도가 파일 계층을 아예 못 본다.
        if (!ID_RE.test(id)) return fail(req, 404, 'not-found')
        if (method === 'OPTIONS') return preflight(req)
        if (method === 'GET') return read(req, id)
        if (method === 'DELETE') return destroy(req, id)
        return fail(req, 405, 'method-not-allowed')
      }

      return fail(req, 404, 'not-found')
    },
  }
}
