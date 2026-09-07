// 공유 링크 서버 — 핸들러 계약
//
// 정본: `docs/PLAN-SHARE-LINK.md` 결정 4·5·6·7. 규율은 `AGENTS.md` 「테스트 작성 규칙」.
//
// ⚠️ 여기 남은 단언은 전부 **지우면 실기에서 새는 것**만이다. 이 서버는 내용을 못 보는 대신
// 크기·속도·만료·토큰 넷으로만 자기를 지키는데, 그 넷은 화면에 아무 흔적을 남기지 않는다 —
// 무너져도 앱은 초록불로 잘 돌고, 몇 달 뒤 디스크나 청구서로 알게 된다. 그래서 이 파일이
// 그 넷의 유일한 감시자다.
//
// http 를 안 태운다(`createApp().handle()` 을 직접 부른다) — 포트 충돌도, 남는 프로세스도,
// 소켓 종료 경쟁도 없다. 대신 index.ts 의 스트림 상한·IP 판별은 여기서 안 잡히므로
// `server/share/README.md` 의 실기 항목에 남겨 뒀다.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm, readdir, writeFile, readFile, utimes } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createApp, API_BASE, clientIpOf } from './app.ts'
import type { ShareApp, ShareRequest, ShareResponse } from './app.ts'

const DAY_MS = 86_400_000

/** 임시 뿌리. ⚠️ 데이터 디렉터리는 **그 아래 한 칸**이다 — 위 칸에 파일을 심어 두고
 *  `../` 로 읽히는지 보기 위한 배치다(아래 「경로 검증」). */
let root = ''
let dir = ''
let clock = 0
let app: ShareApp

function makeApp(over: Partial<Parameters<typeof createApp>[0]> = {}): ShareApp {
  return createApp({
    dataDir: dir,
    maxBytes: 65536,
    ttlDays: 180,
    allowedOrigins: '*',
    ratePostPerHour: 30,
    rateGetPerHour: 600,
    now: () => clock,
    ...over,
  })
}

function req(over: Partial<ShareRequest> & Pick<ShareRequest, 'method' | 'path'>): ShareRequest {
  return { headers: {}, body: Buffer.alloc(0), ip: '10.0.0.1', ...over }
}

function bodyJson(res: ShareResponse): Record<string, unknown> {
  return JSON.parse(res.body.toString('utf8')) as Record<string, unknown>
}

async function post(bytes: Buffer, ip = '10.0.0.1'): Promise<ShareResponse> {
  return app.handle(req({ method: 'POST', path: API_BASE, body: bytes, ip }))
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'spin-share-'))
  dir = join(root, 'store')
  clock = Date.UTC(2026, 8, 7, 12, 0, 0)
  app = makeApp()
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

describe('POST → GET 왕복', () => {
  it('올린 바이트가 한 바이트도 안 변해 돌아온다', async () => {
    // 암호문이다 — 0x00·0xFF·비 UTF-8 바이트가 섞여도 텍스트로 굴절되면 안 된다.
    const secret = Buffer.from([0, 1, 2, 255, 254, 0x0d, 0x0a, 0x80, 0x7f])
    const created = await post(secret)
    expect(created.status).toBe(201)

    const id = String(bodyJson(created).id)
    expect(id).toMatch(/^[0-9A-Za-z]{10}$/)
    // ⚠️ expiresAt 은 **epoch ms 숫자**다(2026-09-07 검수). ISO 문자열이던 때 클라이언트
    //    (src/share/api.ts)가 201 을 받고도 계약 밖 몸통으로 보아 "서버에 못 닿음" 을 띄웠고,
    //    그 업로드는 id·토큰을 아무도 못 받은 고아가 됐다. 양쪽 단위 테스트는 서로를 목으로
    //    세워 둘 다 초록이었다 — 이 단언이 그 틈을 서버 쪽에서 막는다.
    expect(bodyJson(created).expiresAt).toBe(clock + 180 * DAY_MS)

    const got = await app.handle(req({ method: 'GET', path: `${API_BASE}/${id}` }))
    expect(got.status).toBe(200)
    expect(got.headers['Content-Type']).toBe('application/octet-stream')
    expect(Buffer.compare(got.body, secret)).toBe(0)
  })

  it('같은 id 를 동시에 열어도 둘 다 200 이다 — 메타 갱신의 임시 파일이 겹치면 한쪽이 500 으로 죽는다', async () => {
    // 2026-09-07 검수 실기 왕복에서 재현: 개발 모드 StrictMode 가 effect 를 두 번 돌려 GET 이
    // 둘 겹쳤고, 같은 `<id>.json.tmp` 를 나눠 쓴 rename 이 ENOENT 로 죽어 화면이 "서버에 못 닿음"
    // 을 띄웠다. 운영에서는 두 사람이 같은 링크를 동시에 열면 같은 일이 난다.
    const id = String(bodyJson(await post(Buffer.from('shared'))).id)
    const both = await Promise.all([
      app.handle(req({ method: 'GET', path: `${API_BASE}/${id}` })),
      app.handle(req({ method: 'GET', path: `${API_BASE}/${id}` })),
    ])
    expect(both.map((r) => r.status)).toEqual([200, 200])
    expect((await readdir(dir)).filter((n) => n.endsWith('.tmp'))).toEqual([])
  })

  it('캐시 금지·nosniff 가 모든 응답에 붙는다', async () => {
    // 중간 캐시가 암호문을 들고 있으면 삭제·만료가 거짓말이 된다.
    const created = await post(Buffer.from('x'))
    const id = String(bodyJson(created).id)
    for (const res of [created, await app.handle(req({ method: 'GET', path: `${API_BASE}/${id}` }))]) {
      expect(res.headers['Cache-Control']).toBe('no-store')
      expect(res.headers['X-Content-Type-Options']).toBe('nosniff')
    }
  })

  it('GET 이 lastAccessAt 을 밀어 만료를 미룬다', async () => {
    const created = await post(Buffer.from('x'))
    const id = String(bodyJson(created).id)

    // 179일 뒤에 한 번 열고,
    clock += 179 * DAY_MS
    expect((await app.handle(req({ method: 'GET', path: `${API_BASE}/${id}` }))).status).toBe(200)
    // 다시 179일 뒤 — 만든 지 358일이지만 마지막 열람 뒤로는 179일이라 아직 산다.
    clock += 179 * DAY_MS
    expect((await app.handle(req({ method: 'GET', path: `${API_BASE}/${id}` }))).status).toBe(200)
  })
})

describe('상한과 만료', () => {
  it('64 KiB 를 넘으면 413 이고 아무것도 저장하지 않는다', async () => {
    const res = await post(Buffer.alloc(65537, 7))
    expect(res.status).toBe(413)
    expect(bodyJson(res).error).toBe('too-large')
    expect(await app.store.count()).toBe(0)

    // 경계는 통과해야 한다 — 상한을 한 바이트 어긋나게 잡는 실수를 잡는다.
    expect((await post(Buffer.alloc(65536, 7))).status).toBe(201)
  })

  it('모르는 id 는 404 not-found', async () => {
    const res = await app.handle(req({ method: 'GET', path: `${API_BASE}/AAAAAAAAAA` }))
    expect(res.status).toBe(404)
    expect(bodyJson(res).error).toBe('not-found')
  })

  it('TTL 이 지나면 404 이고 파일까지 사라진다', async () => {
    const created = await post(Buffer.from('drill'))
    const id = String(bodyJson(created).id)
    expect((await readdir(dir)).length).toBe(2) // .bin + .json

    clock += 180 * DAY_MS
    const res = await app.handle(req({ method: 'GET', path: `${API_BASE}/${id}` }))
    expect(res.status).toBe(404)
    // ⚠️ 404 만 주고 파일을 남기면 디스크가 영영 는다 — 내용을 못 보는 서버라 사람이
    //    들여다보고 지울 수도 없다. 만료는 반드시 **삭제**여야 한다.
    expect(await readdir(dir)).toEqual([])
  })

  it('sweep 이 만료본만 골라 지운다', async () => {
    const old = String(bodyJson(await post(Buffer.from('old'))).id)
    clock += 180 * DAY_MS
    const fresh = String(bodyJson(await post(Buffer.from('fresh'))).id)

    expect(await app.sweep()).toBe(1)
    expect((await app.handle(req({ method: 'GET', path: `${API_BASE}/${old}` }))).status).toBe(404)
    expect((await app.handle(req({ method: 'GET', path: `${API_BASE}/${fresh}` }))).status).toBe(200)
  })
})

describe('청소 — 고아 파일', () => {
  it('메타 없는 .bin 과 .tmp 는 유예(1시간)가 지난 것만 sweep 이 치운다', async () => {
    // put 이 .bin 과 .json 사이에서 죽으면 고아 .bin 이 남는다. 옛 sweep 은 .json 만 돌아 그것을
    // 영영 못 봤다(2026-09-07 검수). 반대로 **지금 쓰는 중인** .bin 을 삼키면 방금 올린 링크가 죽는다.
    await post(Buffer.from('live'))
    const oldBin = join(dir, 'zzzzzzzzz1.bin')
    const oldTmp = join(dir, 'zzzzzzzzz2.json.tmp')
    const freshBin = join(dir, 'zzzzzzzzz3.bin')
    await writeFile(oldBin, 'x')
    await writeFile(oldTmp, 'x')
    await writeFile(freshBin, 'x')
    const twoHoursAgo = (clock - 2 * 3_600_000) / 1000
    await utimes(oldBin, twoHoursAgo, twoHoursAgo)
    await utimes(oldTmp, twoHoursAgo, twoHoursAgo)
    await utimes(freshBin, clock / 1000, clock / 1000)

    expect(await app.sweep()).toBe(2)
    const left = await readdir(dir)
    expect(left).not.toContain('zzzzzzzzz1.bin')
    expect(left).not.toContain('zzzzzzzzz2.json.tmp')
    expect(left).toContain('zzzzzzzzz3.bin')
    expect(left.length).toBe(3) // 정상 항목 .bin+.json + 유예 중인 고아
  })
})

describe('속도 제한 키 — IP 판별', () => {
  it('프록시를 믿을 때는 X-Forwarded-For 의 마지막 주소다 — 앞쪽은 클라이언트가 적어 보낸 것일 수 있다', () => {
    // Apache 는 클라이언트의 X-Forwarded-For 를 버리지 않고 뒤에 진짜 주소를 덧붙인다. 첫 칸을
    // 믿으면 요청마다 다른 값을 적는 것만으로 속도 제한이 풀린다(2026-09-07 검수).
    expect(clientIpOf({ 'x-forwarded-for': '1.1.1.1, 203.0.113.9' }, '127.0.0.1', true)).toBe('203.0.113.9')
    expect(clientIpOf({ 'x-forwarded-for': '203.0.113.9' }, '127.0.0.1', true)).toBe('203.0.113.9')
  })

  it('프록시를 안 믿으면 헤더를 무시하고 소켓 주소다', () => {
    expect(clientIpOf({ 'x-forwarded-for': '1.1.1.1' }, '198.51.100.7', false)).toBe('198.51.100.7')
  })
})

describe('삭제 토큰', () => {
  it('틀린 토큰은 403 이고 항목이 살아 있다', async () => {
    const created = await post(Buffer.from('drill'))
    const id = String(bodyJson(created).id)

    const res = await app.handle(req({
      method: 'DELETE',
      path: `${API_BASE}/${id}`,
      headers: { authorization: 'Bearer not-the-token' },
    }))
    expect(res.status).toBe(403)
    expect(bodyJson(res).error).toBe('forbidden')
    expect((await app.handle(req({ method: 'GET', path: `${API_BASE}/${id}` }))).status).toBe(200)
  })

  it('Authorization 이 아예 없으면 403', async () => {
    const id = String(bodyJson(await post(Buffer.from('drill'))).id)
    expect((await app.handle(req({ method: 'DELETE', path: `${API_BASE}/${id}` }))).status).toBe(403)
  })

  it('맞는 토큰은 204 이고 그 뒤 GET 은 404', async () => {
    const created = await post(Buffer.from('drill'))
    const id = String(bodyJson(created).id)
    const token = String(bodyJson(created).deleteToken)

    const res = await app.handle(req({
      method: 'DELETE',
      path: `${API_BASE}/${id}`,
      headers: { authorization: `Bearer ${token}` },
    }))
    expect(res.status).toBe(204)
    expect(res.body.length).toBe(0)
    expect((await app.handle(req({ method: 'GET', path: `${API_BASE}/${id}` }))).status).toBe(404)
  })

  it('토큰 원문은 디스크에 남지 않는다', async () => {
    // 서버가 원문을 들고 있으면 "토큰 유출돼도 서버 파일로는 못 지운다"(결정 5)가 거짓이 된다.
    const created = await post(Buffer.from('drill'))
    const token = String(bodyJson(created).deleteToken)
    const names = await readdir(dir)
    for (const name of names) {
      expect(await readFile(join(dir, name), 'utf8')).not.toContain(token)
    }
  })
})

describe('속도 제한', () => {
  it('POST 가 시간당 한도를 넘으면 429 + Retry-After', async () => {
    app = makeApp({ ratePostPerHour: 3 })
    for (let i = 0; i < 3; i += 1) expect((await post(Buffer.from(`b${i}`))).status).toBe(201)

    const res = await post(Buffer.from('over'))
    expect(res.status).toBe(429)
    expect(bodyJson(res).error).toBe('rate-limited')
    expect(Number(res.headers['Retry-After'])).toBeGreaterThan(0)
    // 거절은 저장으로 이어지면 안 된다.
    expect(await app.store.count()).toBe(3)
  })

  it('IP 마다 따로 센다', async () => {
    app = makeApp({ ratePostPerHour: 1 })
    expect((await post(Buffer.from('a'), '10.0.0.1')).status).toBe(201)
    expect((await post(Buffer.from('b'), '10.0.0.1')).status).toBe(429)
    expect((await post(Buffer.from('c'), '10.0.0.2')).status).toBe(201)
  })

  it('시간이 지나면 토큰이 회복된다', async () => {
    app = makeApp({ ratePostPerHour: 2 })
    await post(Buffer.from('a'))
    await post(Buffer.from('b'))
    expect((await post(Buffer.from('c'))).status).toBe(429)
    clock += 1_800_000 // 30분 = 2/시 에서 토큰 1개
    expect((await post(Buffer.from('c'))).status).toBe(201)
  })
})

describe('경로 검증', () => {
  it('데이터 디렉터리 밖의 파일을 `../` 로 못 읽는다', async () => {
    // ⚠️ 이 단언에 이빨을 주려고 **실제로 읽힐 수 있는 항목**을 데이터 디렉터리 한 칸 위에
    //    심는다. id 검사와 경로 확인이 둘 다 사라지면 이 GET 은 200 에 아래 바이트를 준다 —
    //    그때가 서버 파일이 통째로 열리는 순간이다. 형식만 틀린 id(길이·문자)는 저장 계층이
    //    어차피 `.json` 을 붙여 찾기 때문에 없는 파일로 끝나 여기서 따로 세지 않는다.
    await writeFile(join(root, 'evil.bin'), Buffer.from('SERVER-SECRET'))
    await writeFile(join(root, 'evil.json'), JSON.stringify({
      createdAt: clock, lastAccessAt: clock, size: 13, deleteHash: 'ff',
    }))

    const res = await app.handle(req({ method: 'GET', path: `${API_BASE}/../evil` }))
    expect(res.status).toBe(404)
    expect(res.body.toString('utf8')).not.toContain('SERVER-SECRET')

    // 지우기 쪽도 같은 문이다 — 남의 파일을 지울 수 있으면 읽는 것보다 나쁘다.
    await app.handle(req({
      method: 'DELETE',
      path: `${API_BASE}/../evil`,
      headers: { authorization: 'Bearer whatever' },
    }))
    expect(await readFile(join(root, 'evil.bin'), 'utf8')).toBe('SERVER-SECRET')
  })
})

describe('CORS', () => {
  it('OPTIONS 프리플라이트가 Authorization 과 DELETE 를 허용한다', async () => {
    // 하나라도 빠지면 브라우저가 DELETE 를 아예 안 보낸다 — 서버 로그에 흔적이 없는 고장이다.
    const res = await app.handle(req({
      method: 'OPTIONS',
      path: `${API_BASE}/AAAAAAAAAA`,
      headers: { origin: 'https://spin.atit.app', 'access-control-request-method': 'DELETE' },
    }))
    expect(res.status).toBe(204)
    expect(res.headers['Access-Control-Allow-Origin']).toBe('*')
    expect(res.headers['Access-Control-Allow-Methods']).toContain('DELETE')
    expect(res.headers['Access-Control-Allow-Headers']).toContain('Authorization')
  })

  it('출처를 좁히면 목록 밖에는 허용 헤더를 안 준다', async () => {
    app = makeApp({ allowedOrigins: 'https://spin.atit.app' })
    const ok = await app.handle(req({ method: 'OPTIONS', path: API_BASE, headers: { origin: 'https://spin.atit.app' } }))
    expect(ok.headers['Access-Control-Allow-Origin']).toBe('https://spin.atit.app')
    expect(ok.headers['Vary']).toBe('Origin')

    const no = await app.handle(req({ method: 'OPTIONS', path: API_BASE, headers: { origin: 'https://evil.example' } }))
    expect(no.headers['Access-Control-Allow-Origin']).toBeUndefined()
  })
})

describe('healthz', () => {
  it('항목 수를 센다', async () => {
    const before = await app.handle(req({ method: 'GET', path: `${API_BASE}/healthz` }))
    expect(before.status).toBe(200)
    expect(bodyJson(before)).toEqual({ ok: true, count: 0 })

    await post(Buffer.from('a'))
    await post(Buffer.from('b'))
    expect(bodyJson(await app.handle(req({ method: 'GET', path: `${API_BASE}/healthz` })))).toEqual({ ok: true, count: 2 })
  })
})
