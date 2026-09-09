# server/share — 드릴 공유 링크 백엔드

정본 계획서: [`docs/PLAN-SHARE-LINK.md`](../../docs/PLAN-SHARE-LINK.md) (결정 4·5·6·7·12).
코덱·가져오기 사슬의 정본은 [`docs/PLAN-URL-SHARE.md`](../../docs/PLAN-URL-SHARE.md).

## 0. 한 줄

**서버는 암호문만 보관한다.** 브라우저가 AES-GCM 으로 잠근 바이트를 그대로 받아 두었다가
그대로 돌려준다. 열쇠는 링크의 `#` 뒤에만 있고 서버로 오지 않는다 — 운영자도 내용을 못 본다.
그래서 이 코드에는 복호도, 평문도, JSON 파싱도 없다. **바이트를 세고 나르기만 한다.**

## 1. 돌리기

```bash
npm run share:dev      # node server/share/index.ts — 127.0.0.1:8787
npm run share:test     # vitest run server/share
```

의존성이 **0** 이다. Node ≥22.18 이 `.ts` 를 타입만 지우고 그대로 돌린다(빌드 단계 없음).

> ⚠️ 그래서 이 폴더는 **지울 수 있는 문법(erasable)** 만 쓴다 — `enum`·`namespace`·생성자
> 파라미터 프로퍼티 금지, 상대 import 는 `.ts` 확장자 명시. `npm run typecheck` 가
> `tsconfig.server.json`(`erasableSyntaxOnly`)으로 이것을 커밋 전에 잡는다.

개발에서 앱과 붙이려면 `npm run dev` 를 같이 띄운다 — Vite 가 `/api` 를
`http://localhost:8787` 로 넘긴다(`vite.config.ts` 의 `server.proxy`). 앱은 개발에서도
운영과 **똑같이** 상대 경로 `/api/share` 만 부른다.

## 2. API

기준 경로 `"/api/share"`. 모든 응답에 `Cache-Control: no-store`,
`X-Content-Type-Options: nosniff`, CORS 헤더가 붙는다. 오류는 예외 없이
`{"error":"<코드>"}` JSON 한 모양이다 — **클라이언트는 문구가 아니라 코드를 본다.**

| 메서드 | 경로 | 요청 | 성공 | 성공 본문 |
|---|---|---|---|---|
| `POST` | `/api/share` | `Content-Type: application/octet-stream`, 본문 = `iv(12) ‖ 암호문`, **1 ~ 262144 바이트** | `201` | `{"id":"<10자>","deleteToken":"<43자 base64url>","expiresAt":<epoch ms 숫자>}` |
| `GET` | `/api/share/:id` | 없음 | `200` | 올린 바이트 그대로 (`Content-Type: application/octet-stream`) |
| `DELETE` | `/api/share/:id` | `Authorization: Bearer <deleteToken>` | `204` | 없음 |
| `GET` | `/api/share/healthz` | 없음 | `200` | `{"ok":true,"count":<정수>}` |
| `OPTIONS` | 위 전부 | CORS 프리플라이트 | `204` | 없음 |

`:id` 는 **`[0-9A-Za-z]{10}`** 이다. 이 형식이 아닌 경로는 전부 `404`.

### 오류 코드

| 상태 | `error` | 언제 | 클라이언트가 할 일 |
|---|---|---|---|
| `400` | `empty` | POST 본문이 0 바이트 | 버그다 — 재시도하지 말 것 |
| `403` | `forbidden` | DELETE 의 `Authorization` 이 없거나 토큰이 안 맞음 | "이 링크를 지울 권한이 없습니다" |
| `404` | `not-found` | 없는 id · **만료된 id** · id 형식 밖 경로 · 모르는 경로 | "링크가 없거나 만료됐습니다"(결정 10 의 오류 문구 ①) |
| `405` | `method-not-allowed` | 아는 경로에 안 맞는 메서드 | 버그다 |
| `413` | `too-large` | POST 본문 > `SHARE_MAX_BYTES`(256 KiB) | "링크로 보내기엔 큽니다 — 파일로 내보내십시오" |
| `429` | `rate-limited` | 속도 제한. **`Retry-After: <초>`** 가 함께 온다 | 그 초만큼 기다린 뒤 재시도 |
| `500` | `server-error` | 예기치 못한 오류 | "서버에 못 닿음"과 같이 다룬다 |

⚠️ **`404` 는 «없음»과 «만료»를 가르지 않는다.** 가르면 "그 id 는 있었다"가 새고, 받는 쪽이
할 일도 어차피 같다(링크가 죽었다).

### 응답 헤더

| 헤더 | 값 | 어디에 |
|---|---|---|
| `Cache-Control` | `no-store` | 전부 |
| `X-Content-Type-Options` | `nosniff` | 전부 |
| `Access-Control-Allow-Origin` | `*` (기본) 또는 요청 출처 | 전부 (좁혔는데 목록 밖이면 **없음**) |
| `Vary` | `Origin` | `SHARE_ALLOWED_ORIGINS` 를 좁혔을 때만 |
| `Access-Control-Allow-Methods` | `GET, POST, DELETE, OPTIONS` | `OPTIONS` |
| `Access-Control-Allow-Headers` | `Authorization, Content-Type` | `OPTIONS` |
| `Access-Control-Max-Age` | `86400` | `OPTIONS` |
| `Retry-After` | 초(정수, 1 이상) | `429` |
| `Content-Type` | `application/octet-stream` | `GET /:id` |
| `Content-Type` | `application/json; charset=utf-8` | 그 밖의 본문 있는 응답 |

### 만료

TTL 은 **마지막 열람 뒤** `SHARE_TTL_DAYS`(기본 180)일이다 — `GET` 마다 뒤로 밀린다.
그래서 POST 가 주는 `expiresAt` 은 **바닥값**이다("적어도 이때까지는 산다"). 만료본은
읽으려는 순간과 시간마다 도는 청소가 각각 지운다.

### 예 (curl)

```bash
# 만들기
curl -sS -X POST http://127.0.0.1:8787/api/share \
     -H 'Content-Type: application/octet-stream' --data-binary @cipher.bin
# {"id":"Ab3xY9kQ2p","deleteToken":"…","expiresAt":1804291200000}

# 받기 (바이트 그대로)
curl -sS http://127.0.0.1:8787/api/share/Ab3xY9kQ2p -o back.bin

# 지우기
curl -sS -X DELETE http://127.0.0.1:8787/api/share/Ab3xY9kQ2p -H "Authorization: Bearer $TOKEN" -i
```

## 3. 환경변수

| 변수 | 기본 | 뜻 |
|---|---|---|
| `SHARE_PORT` | `8787` | 듣는 포트 |
| `SHARE_HOST` | `127.0.0.1` | 바인딩 주소. ⚠️ 운영에서 이걸 열면 `SHARE_TRUST_PROXY` 가 거짓말이 된다 |
| `SHARE_DATA_DIR` | `./data/share` | 항목 파일 자리 (`.gitignore` 됨) |
| `SHARE_MAX_BYTES` | `262144` | 본문 상한(256 KiB). 넘으면 `413`. ⚠️ 앱의 `SHARE_MAX_CIPHERTEXT_BYTES`·Apache `LimitRequestBody` 와 **같이** 움직인다 |
| `SHARE_TTL_DAYS` | `180` | 마지막 열람 뒤 이만큼 지나면 만료. `0` 이하 = 만료 없음 |
| `SHARE_ALLOWED_ORIGINS` | `*` | 쉼표로 나눈 출처 목록으로 좁힐 수 있다 |
| `SHARE_TRUST_PROXY` | `0` | `1` 이면 `X-Forwarded-For` 의 **마지막** IP 를 속도 제한 키로 쓴다(Apache 가 진짜 주소를 맨 뒤에 덧붙이므로 — `app.ts` `clientIpOf`) |
| `SHARE_RATE_POST` | `30` | IP 당 시간당 POST·DELETE 수. `0` 이하 = 제한 없음 |
| `SHARE_RATE_GET` | `600` | IP 당 시간당 GET 수. `0` 이하 = 제한 없음 |

⚠️ **`SHARE_TRUST_PROXY=1` 은 리버스 프록시 뒤에서만.** `X-Forwarded-For` 는 누구나 위조할 수
있는 헤더라, 직접 노출된 서버에서 켜면 속도 제한이 통째로 무력해진다(요청마다 다른 IP 를
적으면 끝).

## 4. 파일

| 파일 | 맡는 것 |
|---|---|
| `index.ts` | 부팅 — 환경변수, HTTP, 본문을 상한까지만 읽기, IP 고르기, 시간마다 청소 |
| `app.ts` | 판단 전부. `handle(req) → res` 는 소켓을 모른다 — 테스트가 http 없이 부른다 |
| `store.ts` | 파일 저장 (`<id>.bin` + `<id>.json`), id 발급, 토큰 해시, 만료·청소 |
| `ratelimit.ts` | IP 당 토큰 버킷 |
| `app.test.ts` | 계약 18건 — 왕복·상한·만료·토큰·속도·경로·CORS·healthz |

저장 모양: 항목 하나 = 파일 둘.

```
<id>.bin    AES-GCM 암호문 그대로 (iv 12바이트 + 본문)
<id>.json   {"createdAt":…, "lastAccessAt":…, "size":…, "deleteHash":"<sha256 hex>"}
```

`deleteToken` **원문은 어디에도 저장하지 않는다** — POST 응답으로 한 번 주고 잊는다(결정 5).
그래서 토큰을 잃으면 링크는 만료까지 산다. 클라이언트가 `localStorage` 에 들고 있는다(결정 11).

## 5. 배포

정본: `docs/PLAN-SHARE-LINK.md` 결정 12. **원격 시스템 설정을 바꾸므로 기현님 승인 뒤에만.**

```bash
bash scripts/deploy-share.sh --dry-run   # 무엇이 전송되는지만 본다
bash scripts/deploy-share.sh             # 전송 → 유닛 설치 → 재시작 → healthz
```

순서와 조각:

1. `rsync server/share/ → /opt/spin-share/` (`data/` 와 `*.test.ts` 는 제외 — 이용자 암호문을
   지우지 않으려고).
2. `deploy/share/spin-share.service` → `/etc/systemd/system/`, `daemon-reload` → `restart`.
3. `deploy/share/apache-share.conf` → `/opt/bitnami/apache2/conf/vhosts/spin-share.conf`.
   ⚠️ **vhost 는 자동으로 안 고친다** — `spin-vhost.conf` 의 `<VirtualHost *:443>` 안에
   `Include "…/spin-share.conf"` 한 줄을 사람이 넣는다. 그 파일은 옆 서비스와 한 Apache 를
   나눠 쓰므로 스크립트가 손대면 실수의 범위가 이 기능 밖으로 나간다.
4. 루프백과 공개 주소 양쪽으로 `healthz`.

되돌리기: `sudo systemctl stop spin-share && sudo systemctl disable spin-share`
(데이터는 `/opt/spin-share/data` 에 남는다).

## 6. 실기 확인 (테스트가 못 재는 것)

`app.test.ts` 는 `handle()` 을 직접 부른다 — 아래는 그 아래층이라 실기에서만 보인다.

- **스트림 상한**: 256 KiB 를 넘는 본문을 실제 소켓으로 보냈을 때 `413` 이 오고, 메모리가
  상한+1 로 묶이는지. Apache 앞단은 `LimitRequestBody 266240` 에서 먼저 끊는다.
- **IP 판별**: `SHARE_TRUST_PROXY=1` 로 Apache 뒤에 놓았을 때 속도 제한이 **진짜 클라이언트**
  IP 로 세는지(전부 `127.0.0.1` 로 뭉치면 한 사람이 다른 사람을 막는다).
- **재시작 견딤**: `sudo /opt/bitnami/ctlscript.sh restart apache` 뒤에도 프록시가 살아 있는지.
  `systemctl restart spin-share` 뒤 `retry=0` 덕에 503 이 안 남는지.
- **메모리**: 945 MB 호스트에서 `MemoryMax=128M` 안에 머무는지(`systemctl status spin-share`).
- **만료 청소**: 시간마다 도는 타이머가 실제로 파일을 지우는지(`ls /opt/spin-share/data | wc -l`).
