// 공유 링크 서버 — IP 당 속도 제한 (토큰 버킷)
//
// 정본: `docs/PLAN-SHARE-LINK.md` 결정 6 — *"IP 당 POST 30/시·GET 600/시(메모리 토큰 버킷,
// `X-Forwarded-For` 는 `SHARE_TRUST_PROXY=1` 일 때만)"*.
//
// ⚠️ 이 서버는 **내용을 볼 수 없다**(암호문만 받는다). 그래서 신고·검열·내용 기반 차단이라는
// 흔한 남용 대책이 원리적으로 불가능하고, 남는 손잡이는 **크기와 속도** 둘뿐이다. 이 파일이
// 그중 속도 쪽 전부다.
//
// 왜 창(window) 카운터가 아니라 토큰 버킷인가: 고정 창은 경계에서 두 배가 통과하고
// (59분에 30개 + 61분에 30개), 사용자가 "언제 다시 되나"를 알 수 없다. 버킷은 남은 토큰에서
// `Retry-After` 초를 **정확히** 계산해 줄 수 있다 — 429 를 받은 클라이언트가 추측으로
// 재시도하지 않게 하는 것이 이 선택의 값이다.
//
// 저장은 프로세스 메모리다. 재시작하면 리셋되고, 여러 프로세스로 늘리면 각자 센다 —
// 지금은 단일 프로세스(systemd 유닛 하나)라 맞는 값이고, 늘릴 때 다시 볼 자리다.

/** 버킷 하나 — `tokens` 는 소수다(부분 회복을 잃지 않으려고). */
interface Bucket {
  tokens: number
  /** 마지막으로 회복을 계산한 시각(ms). 이 값이 오래된 버킷은 sweep 이 버린다. */
  last: number
}

export interface RateVerdict {
  ok: boolean
  /** 거절일 때만 의미가 있다 — 다음 토큰이 차기까지 남은 **초**(1 이상). */
  retryAfter: number
}

export interface RateLimiter {
  /** 토큰 하나를 쓴다. 남았으면 `{ok:true}`, 없으면 `{ok:false, retryAfter}`. */
  take(key: string, now: number): RateVerdict
  /** 가득 찬(= 최근에 안 쓴) 버킷을 버려 메모리를 묶는다. 버린 개수를 낸다. */
  sweep(now: number): number
  /** 지금 들고 있는 키 수 — healthz·테스트용. */
  size(): number
}

const HOUR_MS = 3_600_000

/**
 * 시간당 `perHour` 번을 허용하는 토큰 버킷을 만든다.
 *
 * - 용량 = `perHour`(가득 찬 상태로 시작 — 처음 온 사람이 곧바로 30번을 쓸 수 있다).
 * - 회복 = 시간당 `perHour` 개(연속적, 밀리초 단위로 비례 회복).
 * - `perHour <= 0` 은 **제한 없음**으로 읽는다. 0 을 "전부 거절"로 읽으면 환경변수를 비워 둔
 *   기기에서 서버가 통째로 죽는데, 그 실수는 조용하고 되돌리기 어렵다.
 */
export function createRateLimiter(perHour: number): RateLimiter {
  const capacity = perHour
  const buckets = new Map<string, Bucket>()

  function refill(b: Bucket, now: number): void {
    // 시계가 뒤로 갈 수 있다(NTP 보정). 음수 경과는 0 으로 접는다 — 안 그러면 토큰이 줄어든다.
    const elapsed = Math.max(0, now - b.last)
    // ⚠️ 곱하기를 **먼저** 한다. `elapsed * (perHour / HOUR_MS)` 로 쓰면 나눗셈에서 잃은
    //    비트 때문에 "정확히 한 시간 뒤" 가 0.9999… 개로 떨어져, `Retry-After` 가 말한 만큼
    //    기다린 클라이언트가 429 를 한 번 더 받는다.
    b.tokens = Math.min(capacity, b.tokens + (elapsed * perHour) / HOUR_MS)
    b.last = now
  }

  return {
    take(key, now) {
      if (capacity <= 0) return { ok: true, retryAfter: 0 }
      let b = buckets.get(key)
      if (!b) {
        b = { tokens: capacity, last: now }
        buckets.set(key, b)
      }
      refill(b, now)
      if (b.tokens >= 1) {
        b.tokens -= 1
        return { ok: true, retryAfter: 0 }
      }
      // 남은 토큰이 1 이 되기까지 필요한 시간. 올림 + 최소 1 초 — 0 을 주면 클라이언트가
      // 즉시 재시도해 429 를 다시 받는다.
      const waitMs = ((1 - b.tokens) * HOUR_MS) / perHour
      return { ok: false, retryAfter: Math.max(1, Math.ceil(waitMs / 1000)) }
    },

    sweep(now) {
      let dropped = 0
      for (const [key, b] of buckets) {
        refill(b, now)
        // 가득 찼다 = 이 키는 지금 아무 제한도 걸고 있지 않다 = 기억할 이유가 없다.
        if (b.tokens >= capacity) {
          buckets.delete(key)
          dropped += 1
        }
      }
      return dropped
    },

    size() {
      return buckets.size
    },
  }
}
