// 공유 링크 서버 — 부팅 (환경변수 · HTTP · 청소 타이머)
//
// 정본: `docs/PLAN-SHARE-LINK.md` 결정 4·6·12. 상위 정본 `AGENTS.md`.
//
// 실행:  node server/share/index.ts        (npm run share:dev)
// Node ≥22.18 이 `.ts` 를 **타입만 지우고** 그대로 돌린다 — 빌드 단계도, 의존성도 0 이다.
// ⚠️ 그래서 이 폴더의 코드는 **지울 수 있는 문법(erasable)** 만 쓴다: `enum`·`namespace`·
//    생성자 파라미터 프로퍼티 금지, 상대 import 는 `.ts` 확장자 명시. 앱 쪽 tsconfig 규율
//    (`erasableSyntaxOnly`)과 같은 제약이라 새 규칙이 아니다.
//
// ── 이 파일이 맡는 것 ────────────────────────────────────────────────────────────────
// ① 환경변수 읽기(아래 표가 정본) ② 소켓에서 본문을 **상한까지만** 모으기 ③ 속도 제한의 키가
// 될 IP 고르기 ④ 시간마다 만료본 청소. 나머지 판단은 전부 app.ts 에 있다.
//
// ── ③ IP 를 어디서 읽나 ──────────────────────────────────────────────────────────────
// ⚠️ `X-Forwarded-For` 는 **누구나 위조할 수 있는 헤더**다. 리버스 프록시 뒤가 아니면 그 값을
// 믿는 순간 속도 제한이 통째로 무력해진다(요청마다 다른 IP 를 적으면 끝). 그래서 기본값은
// `SHARE_TRUST_PROXY=0`(소켓 주소만 본다)이고, Apache 뒤에 놓는 배포에서만 1 로 켠다.
// 켰을 때도 **마지막** 주소를 쓴다(첫 주소는 클라이언트가 적어 보낸 것일 수 있다) — 규칙과
// 근거는 app.ts 의 `clientIpOf` 에.

import { createServer } from 'node:http'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { API_BASE, createApp, clientIpOf } from './app.ts'
import type { ShareHeaders } from './app.ts'

function envNum(name: string, fallback: number): number {
  const raw = process.env[name]
  if (raw === undefined || raw.trim() === '') return fallback
  const n = Number(raw)
  // 오타로 NaN 이 들어오면 조용히 0 으로 접히는 것이 가장 나쁘다(상한 0 = 전부 거절).
  if (!Number.isFinite(n)) {
    console.error(`[spin-share] ${name}='${raw}' 은 숫자가 아닙니다 — 기본값 ${fallback} 을 씁니다.`)
    return fallback
  }
  return n
}

const PORT = envNum('SHARE_PORT', 8787)
const HOST = process.env.SHARE_HOST ?? '127.0.0.1'
const DATA_DIR = process.env.SHARE_DATA_DIR ?? './data/share'
const MAX_BYTES = envNum('SHARE_MAX_BYTES', 65536)
const TTL_DAYS = envNum('SHARE_TTL_DAYS', 180)
const ALLOWED_ORIGINS = process.env.SHARE_ALLOWED_ORIGINS ?? '*'
const TRUST_PROXY = (process.env.SHARE_TRUST_PROXY ?? '0') === '1'
const RATE_POST = envNum('SHARE_RATE_POST', 30)
const RATE_GET = envNum('SHARE_RATE_GET', 600)
/** 청소 주기 — 결정 6 의 *"시간마다 청소"*. */
const SWEEP_MS = 3_600_000

const app = createApp({
  dataDir: DATA_DIR,
  maxBytes: MAX_BYTES,
  ttlDays: TTL_DAYS,
  allowedOrigins: ALLOWED_ORIGINS,
  ratePostPerHour: RATE_POST,
  rateGetPerHour: RATE_GET,
})

/**
 * 본문을 **상한 + 1 바이트까지만** 모은다.
 *
 * 넘치면 그 뒤 청크는 버리고 끝까지 흘려보낸다(연결을 그 자리에서 끊으면 클라이언트가 응답을
 * 못 읽고 "서버에 못 닿음" 으로 보인다 — 413 이라고 알려 주는 편이 낫다). 메모리는 상한+1 로
 * 묶이므로 큰 업로드로 서버를 밀어낼 수 없다.
 */
function readBody(req: IncomingMessage, limit: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    let overflow = false
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > limit + 1) {
        // 상한을 **넘겼다는 사실**만 남기면 된다 — app.ts 가 length > maxBytes 로 413 을 낸다.
        overflow = true
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      const body = Buffer.concat(chunks)
      resolve(overflow ? Buffer.alloc(limit + 1) : body)
    })
    req.on('error', reject)
  })
}

const server = createServer((req: IncomingMessage, res: ServerResponse) => {
  void (async () => {
    try {
      const body = req.method === 'POST' || req.method === 'PUT' ? await readBody(req, MAX_BYTES) : Buffer.alloc(0)
      const out = await app.handle({
        method: req.method ?? 'GET',
        path: (req.url ?? '/').split('?')[0] ?? '/',
        headers: req.headers as ShareHeaders,
        body,
        // 판별 규칙은 app.ts 의 clientIpOf 에 있다(테스트가 그쪽을 본다) — 여기는 소켓 주소만 넘긴다.
        ip: clientIpOf(req.headers as ShareHeaders, req.socket.remoteAddress, TRUST_PROXY),
      })
      res.writeHead(out.status, out.headers)
      res.end(out.body)
    } catch (err) {
      // ⚠️ 오류 본문에 스택을 싣지 않는다 — 경로·버전이 그대로 새는 자리다. 로그에만 남긴다.
      console.error('[spin-share] 처리 중 오류:', err)
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
      }
      res.end(JSON.stringify({ error: 'server-error' }))
    }
  })()
})

async function sweep(): Promise<void> {
  try {
    const dropped = await app.sweep()
    if (dropped > 0) console.log(`[spin-share] 청소: 만료 ${dropped}건 삭제`)
  } catch (err) {
    console.error('[spin-share] 청소 실패:', err)
  }
}

server.listen(PORT, HOST, () => {
  console.log(`[spin-share] http://${HOST}:${PORT}${API_BASE} · data=${DATA_DIR} · ` +
    `max=${MAX_BYTES}B · ttl=${TTL_DAYS}일 · post=${RATE_POST}/시 · get=${RATE_GET}/시 · trustProxy=${TRUST_PROXY}`)
  void sweep()
})

const timer = setInterval(() => void sweep(), SWEEP_MS)
// 타이머가 프로세스를 붙잡지 않게 한다 — 서버 소켓이 수명을 정한다.
timer.unref()

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    console.log(`[spin-share] ${sig} — 종료합니다.`)
    server.close(() => process.exit(0))
    // 열린 keep-alive 연결이 남아 close 가 안 끝나는 경우의 안전장치.
    setTimeout(() => process.exit(0), 3000).unref()
  })
}
