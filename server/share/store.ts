// 공유 링크 서버 — 파일 저장소
//
// 정본: `docs/PLAN-SHARE-LINK.md` 결정 4·5·6.
//
// ── 무엇을 보관하는가 ────────────────────────────────────────────────────────────────
// 항목 하나 = 파일 두 개.
//   <id>.bin   AES-GCM 암호문 그대로(`iv(12) ‖ 암호문`). **서버는 이 바이트의 뜻을 모른다.**
//   <id>.json  {createdAt, lastAccessAt, size, deleteHash}
//
// ⚠️ 이 파일에 평문·키·복호 코드가 들어가는 순간 이 기능의 한 줄 원칙(*"열쇠는 링크에만 있고
// 서버에는 암호문만 있다"*)이 무너진다. 여기는 바이트를 **읽지 않고** 나르기만 하는 자리다.
//
// ── 왜 DB 가 아니라 파일인가 ──────────────────────────────────────────────────────────
// 운영 호스트(Lightsail Bitnami, 메모리 945 MB)에 mocil Node 가 이미 상주한다. 항목은 최대
// 256 KiB 이고 수천 개를 넘길 이유가 없는 기능이라, DB 한 벌(프로세스·스키마·백업·마이그레이션)
// 을 들이는 값이 얻는 것보다 크다. 디렉터리 하나면 백업이 `rsync` 이고 삭제가 `rm` 이다.
//
// ── 디렉터리 탈출 ────────────────────────────────────────────────────────────────────
// id 는 `[0-9A-Za-z]{10}` 만 통과한다(app.ts 의 라우팅에서 한 번, 여기서 또 한 번). 그리고
// 만든 경로가 실제로 dataDir 안에 있는지 `resolve` 로 다시 본다 — 검사 두 벌이 겹치는 것은
// 낭비가 아니라, 훗날 라우팅이 바뀌어도 이 파일이 혼자 안전하게 남기 위한 값이다.

import { randomInt, randomBytes, createHash, timingSafeEqual } from 'node:crypto'
import { mkdir, readFile, writeFile, rename, unlink, readdir, stat } from 'node:fs/promises'
import { resolve, sep, join } from 'node:path'

/** id 알파벳 62자. 10자면 62^10 ≈ 8.4×10^17 — 무작위 추측이 통하지 않는다(결정 5). */
const ID_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
export const ID_LENGTH = 10
export const ID_RE = /^[0-9A-Za-z]{10}$/

/** 고아(.json 없는 .bin)·임시(.tmp) 파일을 치우기 전 유예. `put` 이 .bin 을 쓰고 .json 을 쓰는
 *  사이(수 ms)에 sweep 이 겹치면 방금 올린 항목을 지우게 된다 — 그 창을 한 시간으로 넉넉히 덮는다. */
const ORPHAN_GRACE_MS = 3_600_000

export interface ShareMeta {
  /** 만들어진 시각(epoch ms). 통계·감사용 — 만료 계산에는 안 쓴다. */
  createdAt: number
  /** ⚠️ 만료의 기준. TTL 은 **마지막 열람 뒤** 180일이다(결정 6). GET 마다 갱신된다. */
  lastAccessAt: number
  /** 암호문 바이트 수. `<id>.bin` 을 안 열고도 크기를 알기 위해 둔다. */
  size: number
  /** deleteToken 의 sha256(hex). ⚠️ 원문 토큰은 절대 보관하지 않는다(결정 5). */
  deleteHash: string
}

export interface StoredShare {
  bytes: Buffer
  meta: ShareMeta
}

export interface ShareStore {
  /** 암호문을 새 id 로 저장한다. 반환은 그 id. */
  put(bytes: Buffer, deleteHash: string, now: number): Promise<string>
  /** 읽고 **lastAccessAt 을 갱신**한다. 없거나 만료면 null(만료본은 그 자리에서 지운다). */
  get(id: string, now: number): Promise<StoredShare | null>
  /** 읽지 않고 메타만. DELETE 의 토큰 대조에 쓴다(만료면 null). */
  meta(id: string, now: number): Promise<ShareMeta | null>
  /** 지운다. 실제로 지웠으면 true. */
  remove(id: string): Promise<boolean>
  /** 만료본을 전부 지운다. 지운 개수를 낸다. */
  sweep(now: number): Promise<number>
  /** 지금 살아 있는 항목 수(healthz). 만료본도 아직 안 쓸었으면 센다. */
  count(): Promise<number>
}

/** deleteToken 원문 32바이트 base64url — 서버는 이 값을 **한 번만** 보고 잊는다. */
export function newDeleteToken(): string {
  return randomBytes(32).toString('base64url')
}

/** 토큰 → 보관용 해시. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

/**
 * 토큰 대조 — **길이·내용 모두 상수 시간**으로 본다.
 *
 * hex 문자열을 `===` 로 비교하면 앞자리부터 다른 지점에서 빠져나오는 시간 차이가 남는다.
 * 여기서 새는 정보는 크지 않지만(해시라 원문이 안 나온다) 상수 시간 비교는 값이 0 이므로
 * 굳이 약한 쪽을 고를 이유가 없다.
 */
export function tokenMatches(token: string, expectedHash: string): boolean {
  const got = Buffer.from(hashToken(token), 'hex')
  const want = Buffer.from(expectedHash, 'hex')
  if (got.length !== want.length || want.length === 0) return false
  return timingSafeEqual(got, want)
}

function newId(): string {
  let out = ''
  for (let i = 0; i < ID_LENGTH; i += 1) out += ID_ALPHABET[randomInt(ID_ALPHABET.length)]
  return out
}

/**
 * 파일 저장소를 연다.
 *
 * @param dataDir  항목 파일을 놓을 디렉터리(없으면 첫 쓰기에서 만든다).
 * @param ttlMs    마지막 열람 뒤 이 시간이 지나면 만료. 0 이하면 만료 없음.
 */
export function createStore(dataDir: string, ttlMs: number): ShareStore {
  const root = resolve(dataDir)

  /** id 를 파일 경로로. ⚠️ 형식 검사 + 경로가 root 안인지 확인 둘 다 통과해야 돌려준다. */
  function pathFor(id: string, ext: string): string {
    if (!ID_RE.test(id)) throw new Error('bad id')
    const p = resolve(join(root, id + ext))
    // `root` 자신도, 그 밖도 안 된다 — 반드시 root 아래여야 한다.
    if (!p.startsWith(root + sep)) throw new Error('path escape')
    return p
  }

  function expired(meta: ShareMeta, now: number): boolean {
    if (ttlMs <= 0) return false
    return meta.lastAccessAt + ttlMs <= now
  }

  async function readMeta(id: string): Promise<ShareMeta | null> {
    let raw: string
    try {
      raw = await readFile(pathFor(id, '.json'), 'utf8')
    } catch {
      return null
    }
    try {
      const parsed = JSON.parse(raw) as Partial<ShareMeta>
      if (
        typeof parsed.createdAt !== 'number' ||
        typeof parsed.lastAccessAt !== 'number' ||
        typeof parsed.size !== 'number' ||
        typeof parsed.deleteHash !== 'string'
      ) {
        return null
      }
      return { createdAt: parsed.createdAt, lastAccessAt: parsed.lastAccessAt, size: parsed.size, deleteHash: parsed.deleteHash }
    } catch {
      // 반쪽 쓰인 JSON. 항목이 없는 것과 같이 취급한다 — sweep 이 나중에 치운다.
      return null
    }
  }

  /** 임시 파일 이름. ⚠️ 호출마다 **다른** 이름이어야 한다(2026-09-07 검수). `dest + '.tmp'` 하나를
   *  같이 쓰면 같은 id 의 GET 둘이 겹쳤을 때(두 사람이 같은 링크를 동시에 열거나, 개발 모드
   *  StrictMode 가 effect 를 두 번 돌릴 때) 둘 다 그 파일에 쓰고 먼저 rename 한 쪽이 가져가
   *  뒤쪽 rename 이 ENOENT 로 죽는다 — 클라이언트에는 500, 화면에는 "서버에 못 닿음". 실기
   *  왕복에서 그대로 재현됐다. 접미사 `.tmp` 는 유지한다(sweep 이 그 꼴로 잔재를 치운다). */
  let tmpSeq = 0
  function tmpNameFor(dest: string): string {
    tmpSeq += 1
    return `${dest}.${process.pid}.${tmpSeq}.tmp`
  }

  async function writeMeta(id: string, meta: ShareMeta): Promise<void> {
    // tmp 에 쓰고 rename — 같은 디렉터리 안의 rename 은 원자적이라, 읽는 쪽이 반쪽 JSON 을
    // 보는 창이 없다.
    const dest = pathFor(id, '.json')
    const tmp = tmpNameFor(dest)
    await writeFile(tmp, JSON.stringify(meta), 'utf8')
    await rename(tmp, dest)
  }

  async function removeFiles(id: string): Promise<boolean> {
    let removed = false
    for (const ext of ['.bin', '.json']) {
      try {
        await unlink(pathFor(id, ext))
        removed = true
      } catch {
        // 이미 없다.
      }
    }
    return removed
  }

  return {
    async put(bytes, deleteHash, now) {
      await mkdir(root, { recursive: true })
      // 62^10 에서 충돌은 사실상 안 나지만, 나면 조용히 남의 항목을 덮어쓰는 최악의 사고다.
      // 값이 0 에 가까운 방어라 그냥 건다.
      let id = newId()
      for (let tries = 0; tries < 5; tries += 1) {
        if ((await readMeta(id)) === null) break
        id = newId()
      }
      const binTmp = tmpNameFor(pathFor(id, '.bin'))
      await writeFile(binTmp, bytes)
      await rename(binTmp, pathFor(id, '.bin'))
      // ⚠️ 메타를 **나중에** 쓴다 — 중간에 죽으면 메타 없는 .bin 만 남고, 그건 아무도 못 읽는
      //    쓰레기라 sweep 이 치운다. 반대 순서면 메타는 있는데 내용이 없는 항목이 생긴다.
      await writeMeta(id, { createdAt: now, lastAccessAt: now, size: bytes.length, deleteHash })
      return id
    },

    async get(id, now) {
      if (!ID_RE.test(id)) return null
      const meta = await readMeta(id)
      if (!meta) return null
      if (expired(meta, now)) {
        await removeFiles(id)
        return null
      }
      let bytes: Buffer
      try {
        bytes = await readFile(pathFor(id, '.bin'))
      } catch {
        // 메타만 남은 반쪽 항목. 없는 것으로 답하고 치운다.
        await removeFiles(id)
        return null
      }
      const next: ShareMeta = { ...meta, lastAccessAt: now }
      await writeMeta(id, next)
      return { bytes, meta: next }
    },

    async meta(id, now) {
      if (!ID_RE.test(id)) return null
      const meta = await readMeta(id)
      if (!meta) return null
      if (expired(meta, now)) {
        await removeFiles(id)
        return null
      }
      return meta
    },

    async remove(id) {
      if (!ID_RE.test(id)) return false
      return removeFiles(id)
    },

    async sweep(now) {
      let names: string[]
      try {
        names = await readdir(root)
      } catch {
        return 0
      }
      let dropped = 0
      const metaIds = new Set(names.filter((n) => n.endsWith('.json')).map((n) => n.slice(0, -'.json'.length)))
      for (const name of names) {
        if (name.endsWith('.json')) {
          const id = name.slice(0, -'.json'.length)
          if (!ID_RE.test(id)) continue
          const meta = await readMeta(id)
          // 메타가 안 읽히는 것(반쪽 파일)도 청소 대상이다.
          if (meta === null || expired(meta, now)) {
            await removeFiles(id)
            dropped += 1
          }
          continue
        }
        // ⚠️ 2026-09-07 검수: 머리말과 put 의 주석은 "메타 없는 .bin 은 sweep 이 치운다" 고 했지만
        //    실제로는 .json 만 돌아 고아 .bin 과 .tmp 가 영영 남았다(중간에 죽은 put 마다 하나씩).
        //    유예(ORPHAN_GRACE_MS)가 지난 것만 지운다 — 지금 쓰는 중인 항목을 삼키지 않게.
        const isOrphanBin = name.endsWith('.bin') && ID_RE.test(name.slice(0, -'.bin'.length)) && !metaIds.has(name.slice(0, -'.bin'.length))
        if (!isOrphanBin && !name.endsWith('.tmp')) continue
        const p = join(root, name) // readdir 산출물이라 root 바로 아래다
        try {
          const st = await stat(p)
          if (now - st.mtimeMs < ORPHAN_GRACE_MS) continue
          await unlink(p)
          dropped += 1
        } catch {
          // 그 사이 없어졌다.
        }
      }
      return dropped
    },

    async count() {
      try {
        const names = await readdir(root)
        return names.filter((n) => n.endsWith('.json') && ID_RE.test(n.slice(0, -'.json'.length))).length
      } catch {
        return 0
      }
    },
  }
}
