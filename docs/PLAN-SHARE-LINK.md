# PLAN — 드릴 공유 링크: 짧은 URL + 종단 암호화 백엔드 (2026-09-07)

기현님 지시(2026-09-07, 원문): *"짧은 url 로 가려면 드릴 공유용 백엔드가 있어야하고 내가 개발자라도 업로드된 자료를
볼수 없게 공개키기반으로 암호화하고 url를 공유한 사람들만 열어볼 수 있게… 가능할까?"* → *"어짜피 1,2단계가 의미가 없다.
백엔드 만들고 후딱 구현하자. 도메인 독립적으로 (개발 서버 용이하게)"*

이 문서가 공유 링크의 **정본 계획서**다. `docs/PLAN-URL-SHARE.md`(같은 날 오전, 서버 없는 긴 링크 설계)는 **코덱·실측·
가져오기 사슬의 정본으로 남고**, 그 결정 2(프래그먼트에 코드 전체)·10(짧은 링크 서버 안 만듦)은 ⚠️ 2026-09-07 로 뒤집힌다 —
근거였던 "남의 서버에 내용이 넘어간다" 는 **내 서버 + 종단 암호화**로 사라졌다. 상위 정본 `AGENTS.md`, `ROADMAP.md` 「서버 없음
원칙은 단계적으로 풉니다」 표에 이 단계를 더한다(암호문만 보관하는 서버 — 내용은 여전히 운영자도 못 본다).

## 0. 한 줄 원칙

**열쇠는 링크에만 있고 서버에는 암호문만 있다.** 브라우저가 키를 만들어 AES-GCM 으로 잠근 뒤 암호문만 올리고, 링크는
`https://<앱 주소>/s/<id>#<키>` — `#` 뒤는 서버로 가지 않는다. 링크를 가진 사람만 열고, 운영자는 id·크기·시각만 안다.
공개키가 아니라 **대칭키**다: "링크 가진 사람 누구나" 는 링크 자체가 열쇠인 모델이고, 공개키는 받는 사람을 미리 아는
2.0 포털(계정)의 것이다.

## 1. 결정 (기본값 — 뒤집기 쉽게 근거와 함께)

| # | 결정 | 근거 |
|---|---|---|
| 1 | 평문 = `exportDrillFile` 봉투 JSON → `deflate-raw`(PLAN-URL-SHARE 결정 1·3 의 코덱: 첫 바이트 `0x01` = deflate-raw JSON) | 새 포맷 없음 = 마이그레이션·검증 사슬 공짜 |
| 2 | 암호 = WebCrypto **AES-GCM 256**, 키는 링크마다 무작위, `iv(12) ‖ 암호문` 을 올린다. 키는 base64url 43자로 프래그먼트에 | 표준·브라우저 내장·인증 태그로 변조 검출. PrivateBin·Bitwarden Send 와 같은 꼴 |
| 3 | 링크 `${location.origin}/s/${id}#${key}` — **도메인 독립**: 클라이언트는 `VITE_SHARE_API_BASE`(기본 `/api/share`, 같은 출처 상대 경로)만 안다. 개발은 Vite 프록시 `/api` → `localhost:8787`, 운영은 Apache `ProxyPass /api/share → 127.0.0.1:8787` | 앱은 어느 도메인에서도 자기 출처로 링크를 만들고 자기 출처의 API 를 부른다. 데스크톱(tauri://)만 빌드 시 절대 주소가 필요 — 이번 범위 밖, blockers 에 |
| 4 | 서버 = 저장소 안 `server/share/`(Node ≥22.18, 의존성 0, `node:http` + 파일 저장 `<id>.bin`+`<id>.json`). API: `POST /api/share`(octet-stream ≤64 KiB(⚠️ 2026-09-08 S3: 256 KiB) → 201 `{id, deleteToken, expiresAt}`), `GET /api/share/:id`(octet-stream, `no-store`), `DELETE /api/share/:id`(Bearer deleteToken), `GET /api/share/healthz` | 운영 호스트(Lightsail Bitnami, 메모리 945 MB)에 이미 mocil Node 가 3000 에 산다 — 프레임워크·DB 없이 수십 MB 로 |
| 5 | id = 10자 base62(무작위), deleteToken = 32바이트 base64url(서버는 sha256 만 보관) | id 추측 불가(62^10), 토큰 유출돼도 서버 파일로는 못 지운다 |
| 6 | 상한·만료: 본문 64 KiB(⚠️ 2026-09-08 S3 로 256 KiB — 세션이 드릴 N개를 싣는다), IP 당 POST 30/시·GET 600/시(메모리 토큰 버킷, `X-Forwarded-For` 는 `SHARE_TRUST_PROXY=1` 일 때만), TTL **마지막 열람 뒤 180일**(시간마다 청소) | 내용을 못 보니 신고·검열이 불가능 — 남용은 크기·속도로 막는다. 영구 보관은 쓰레기 |
| 7 | CORS 기본 `*`(GET·POST·DELETE, `SHARE_ALLOWED_ORIGINS` 로 좁힐 수 있음) | 암호문뿐이라 출처 제한이 지키는 것이 없다. 도메인 독립 요구 |
| 8 | 공유 시 **선수 실명(`ChairDef.name`)·팀 이름(`teams.*.label`)을 뺀다** | PLAN-URL-SHARE §8-1 권고. 받는 코치에게 뜻이 없고 명단은 보내는 팀의 것. 뒤집기: 공유 시트에 "이름 포함" 스위치 |
| 9 | 가져오기: `/s/:id` 는 `parsePath` 가 라이브러리 화면 + 공유 시트로 푼다(새 화면 없음). fetch → 복호 → inflate → `parseSpinFile` → `migrateDoc` → `validateDrill` **필수** → 미리보기(제목·스텝 수·썸네일) → [내 목록에 저장]. 같은 id 가 있으면 **새 id 사본**(원본 안 덮음) | PLAN-URL-SHARE 결정 4·6·7. 삭제 안전망 결 |
| 10 | 오류 문구 4종: 링크 없음/만료(404) · 열쇠가 맞지 않음(복호 실패, 링크가 잘린 경우) · 이 앱이 너무 오래됨(`too-new`) · 서버에 못 닿음 | 각각 사용자가 할 일이 다르다 |
| 11 | 만드는 자리 둘: [보드] 하단 [내보내기] 시트 4번째 [링크] · 라이브러리 카드 ⋯ [링크로 공유]. 결과 모달: 링크 · [복사] · "링크를 가진 사람만 열 수 있고 서버는 암호문만 보관, 180일 뒤 만료" 한 줄. deleteToken 은 `localStorage spin.shareLinks` 에 저장(회수 UI 는 후속) | 이미 있는 내보내기 입구(PLAN-2026-08 §6) |
| 12 | 서버 배포: `deploy/share/spin-share.service`(systemd, User=bitnami, `/opt/spin-share`) · `deploy/share/apache-share.conf`(ProxyPass 조각) · `scripts/deploy-share.sh`(rsync + 유닛 설치 + 재시작 + healthz). **실행은 기현님 승인 뒤** | 서버 설정 변경 |
| 13 | 개인정보처리방침 3언어에 "공유 링크" 조 추가: 서버는 암호문·크기·시각·IP 속도 제한 기록만, 내용은 운영자도 못 봄, 180일 만료, 삭제 요청 | 법 문서가 사실이어야 한다 |
| 14 | 한계를 문서에 적는다: 암호화하는 JS 를 서버가 내려주므로 배포본이 악의적이면 키를 빼돌릴 수 있다 — 소스 공개가 답 | 정직 |

## 2. 손대는 곳

**서버(S)** `server/share/{index.ts, app.ts(핸들러·순수), store.ts, ratelimit.ts, README.md}` + `server/share/app.test.ts` ·
`deploy/share/*` · `scripts/deploy-share.sh` · `package.json`(`share:dev`, `share:test`) · `vite.config.ts`(proxy `/api`).
**클라이언트 코어(K)** `src/share/{codec.ts(deflate·봉투·이름 제거), crypto.ts(AES-GCM·키 base64url), link.ts(만들기·파싱), api.ts(fetch, 오류 4종)}` + 테스트 ·
`src/app/routes.ts`(`/s/:id`) · `src/app/useAppHistory.ts`(NavTarget share).
**UI(U)** `src/features/library/{ShareLinkModal.tsx, ShareImportSheet.tsx}` · `ExportSheet.tsx`([링크]) · 라이브러리 카드 ⋯(`DrillCard.tsx` 의 케밥 —
옵셔널 `onShareLink` 하나) · `AppShell.tsx` 배선(`useShareLanding` + `goLibrary` 어댑터) · `src/i18n/{ko,en,ja}.ts` · `src/storage/shareLinks.ts`(신규,
`spin.shareLinks` 별도 키 — `prefs.ts` 는 머리말 주석 한 줄만 정정).
**문서(D)** `docs/PLAN-URL-SHARE.md` ⚠️ · `ROADMAP.md`(서버 없음 표 + 후보 항목) · `src/features/settings/legal/privacy.html` 3절 · `CHANGELOG` 3벌 · `README`(개발 서버: `npm run share:dev`).

## 3. 착수 순서

1. 서버(S) ∥ 2. 클라이언트 코어(K) ∥ 3. 문서(D) → 4. UI(U, K 의 API 위에) → 5. 검수: 관문 + 로컬 서버·Vite 프록시로 헤드리스
끝까지(만들기 → 새 프로필로 열기 → 저장) → 6. 서버 배포(승인 뒤) → 7. 실기.

## 4. 실기 확인(jsdom 이 못 재는 것)

- 카톡·문자에 붙인 링크가 잘리지 않고 열리는지(약 80자), 메신저 미리보기가 `#` 뒤를 보존하는지.
- 태블릿에서 [링크] → [복사] → 다른 기기로 열기 → 저장까지. 만료·잘린 링크 문구.
- 운영 서버 메모리(945 MB)에서 서비스가 안정적인지, Apache 재시작 뒤에도 프록시가 사는지.
- 규칙 장면 드릴(이름 없음)과 실명 드릴(이름 빠짐) 두 가지로 받는 쪽 화면.

## 5. 구현 결과·검수 (2026-09-07)

착수 순서 1~5 가 끝났다(S·K·U·D 병렬 → 검수). 6(배포)·7(실기)은 아래 §5.6·§5.5.

### 5.1 관문

- `npm run typecheck` 0 · `npm run lint` 경고 48(HEAD 와 같은 수, 새 것 0) · `npx vitest run` 298 파일 3837 케이스 통과(`server/share/app.test.ts` 22건이
  `test.include` 로 전체 스위트에 들어간다 — `npx vitest list` 로 확인).
- **헤드리스 끝까지**(Vite 5199 + `npm run share:dev` 8787, Chrome 152 CDP, 프로필 둘): 라이브러리 카드 ⋯ [링크로 공유] → 링크 `http://…/s/<10자>#<43자>`
  → 서버 data 에 `<id>.bin`(947 B)·`<id>.json` 뿐이고 `.bin` 에 `schemaVersion`·`payload`·`"spin"` 문자열 **0건** → 만든 쪽 `localStorage spin.shareLinks`
  에 토큰(43자) 한 줄 → 빈 프로필로 링크 열기 → 착지 직후 주소가 `/s/<id>`(열쇠 제거) → 미리보기(제목·1스텝·썸네일) → [내 목록에 저장] → 토스트 →
  카드 "제1조 — 필드 규격 (사본)" 등장(시드가 같은 id 로 있어 사본) → 주소 `/drills`, `history.length` 1(교체) → 뒤로가기가 `/s/:id` 로 안 돌아감.
  편집기 [내보내기] 시트 **세 번째** [링크로 공유] → 업로드 정확히 1회. 오류 문구 셋: 42자 열쇠 → "열쇠가 맞지 않습니다…" · 모르는 id → "링크가 없거나
  만료됐습니다…" · 서버 내림 → "서버에 닿지 못했습니다…". 스크린샷은 스크래치 `share-*.png`.

### 5.2 검수가 고친 것 — 단위 테스트가 전부 초록인데 실기 왕복에서 난 것

| # | 무엇 | 어디 | 어떻게 드러났나 |
|---|---|---|---|
| 1 | **`expiresAt` 계약 불일치(치명)** — 서버는 ISO 문자열, 클라이언트는 `typeof === 'number'` 요구. 업로드가 201 로 성공한 뒤 화면은 "서버에 못 닿음", 그 항목은 id·토큰을 아무도 못 받은 **고아** | `server/share/app.ts` → epoch ms 숫자(메타의 시각과 같은 단위) · README | 첫 헤드리스 왕복에서 즉시. S·K 테스트가 서로를 목으로 세워 둘 다 초록이었다 |
| 2 | **같은 id 동시 GET 이 500** — 메타 갱신의 임시 파일이 `<id>.json.tmp` 하나라 두 요청이 겹치면 뒤쪽 rename 이 ENOENT | `store.ts` `tmpNameFor`(pid·순번) | 개발 StrictMode 가 effect 를 두 번 돌려 GET 둘이 겹침. 운영에서는 두 사람이 같은 링크를 동시에 열면 같은 일 |
| 3 | **`X-Forwarded-For` 첫 주소(보안)** — Apache 는 클라이언트 XFF 를 버리지 않고 뒤에 덧붙이므로 첫 칸을 믿으면 헤더 한 줄로 속도 제한이 풀린다 | `app.ts` `clientIpOf`(마지막 주소, index.ts 에서 옮겨 테스트 가능하게) · README 표 | 코드 읽기 |
| 4 | **고아 `.bin`·`.tmp` 미청소** — 주석은 "sweep 이 치운다" 인데 sweep 은 `.json` 만 돌았다 | `store.ts` sweep, 1시간 유예 뒤 삭제 | 코드 읽기(#2 의 잔재 `.tmp` 도 이것이 치운다) |
| 5 | **받는 쪽 상한 없음** — `fetchCiphertext` 가 크기 무관 `arrayBuffer` | `api.ts` 64 KiB(→ 2026-09-08 S3 256 KiB) 스트림 상한 + Content-Length 선검사, 넘으면 `too-large` | 지시 5 항목 |
| 6 | **닫기가 push** — 착지 뒤 [닫기]·저장 후 브라우저 뒤로가기가 열쇠 없는 `/s/:id` 로 돌아가 정상 링크에 "열쇠가 맞지 않음" | `AppShell.tsx` `goLibrary` 어댑터: 공유 착지면 `back('drills')`(in-app 이력 없으면 교체) | 헤드리스 왕복 뒤 `history.back()` |
| 7 | 204 응답에 `Content-Length: 0`(RFC 9110 §8.6 위반) | `app.ts` | 실제 소켓 `curl -i` |
| 8 | 문서: 개인정보처리방침 제10조 "서버가 보관하는 것" 에 **삭제용 열쇠의 해시** 누락(3언어) · `prefs.ts` "localStorage 키 둘뿐" 낡은 주석 · README `SHARE_TRUST_PROXY` 설명 | 각 파일 | 대조 |

### 5.3 계획과 다른 것 — 그대로 둔 것과 이유

- 결정 11 "[내보내기] 시트 **4번째** [링크]" → 실제 **3번째**. 항목이 둘뿐이다(4번이던 [기기 이사 파일]은 2026-08-20 설정으로 이동). `ExportSheet.tsx` 주석.
- 결정 9 "같은 id 면 새 id 사본" → `commitDrillImports` 규칙대로 제목에 **"(사본)"** 이 붙는다. 시드 드릴은 id 가 기기마다 같아 규칙 장면을 링크로 받으면
  **항상** (사본)이 된다 — 바꾸려면 `storage/transfer.ts` 쪽 결정이라 여기서 안 건드렸다.
- 결정 10 — id 꼴이 틀린 링크(10자가 아님)는 서버 404 가 아니라 클라이언트 `invalid` 로 "열쇠가 맞지 않음" 문구다(처방이 같다: 링크 전체를 다시 받는다).
- 결정 11 회수 UI 후속 그대로 — `forgetShareLink` 도 일부러 없다(`shareLinks.ts` 끝 주석). 데스크톱(tauri://) origin 은 결정 3 대로 범위 밖.
- 결정 6 `SHARE_RATE_*` 0 = **제한 없음**(전부 거절 아님) — 환경변수를 비운 기기에서 조용히 죽는 것을 막는다(`ratelimit.ts`).

### 5.4 돌연변이 — 12/12 빨간불

지시의 다섯(①decrypt 태그 검증 우회 ②stripNames 끔 ③서버 크기 상한 제거 ④TTL 만료 판정 제거 ⑤사본 대신 덮어쓰기) + 검수가 새로 넣은 단언
일곱(⑥expiresAt 을 ISO 로 ⑦XFF 첫 주소 ⑧고아 청소 제거 ⑨tmp 이름 공유 ⑩받기 스트림 상한 제거 ⑪Content-Length 선검사 제거 ⑫goLibrary 의 착지 분기
제거). 한 군데씩 망가뜨려 좁힌 테스트를 돌리고 백업으로 원복(`cmp` 확인). ⑥⑦⑨⑫ 는 **원래 버그를 되살린 것**이라 새 단언이 그 버그를 실제로 잡는다는 증명이다.

### 5.5 남은 실기 (§4 에 더해)

- 태블릿 [복사] — 헤드리스는 클립보드를 거절해 "직접 선택해 복사하세요" 경로만 봤다. 실기에서 [복사] 한 번, 메신저 붙여넣기에서 `#` 뒤 보존.
- Apache 뒤에서 속도 제한이 **사람마다** 세는지(`SHARE_TRUST_PROXY=1`, XFF 마지막 주소). 전부 127.0.0.1 로 뭉치면 한 사람이 다른 사람을 막는다.
- 실명이 든 드릴을 보내 받는 쪽에 이름이 없고 팀 이름이 기본값인지(결정 8). 헤드리스는 규칙 장면(이름 없음)만 돌렸다.
- 개발 서버(StrictMode) 에서 `/s/<id>#<키>` 진입 시 `consumedRef` 가 두 번째 effect 를 막는지 — 헤드리스는 통과했다(정상 미리보기).
- 운영 호스트 메모리(`MemoryMax=128M`)·Apache 재시작 뒤 프록시·시간마다 청소 — `server/share/README.md` §6.

### 5.6 배포 순서 (커밋·푸시·배포는 전부 기현님 몫)

1. 커밋(한 기능 = 커밋 하나, 검증 한 줄 §5.1). 2. `bash scripts/deploy-share.sh --dry-run` 으로 전송 목록 확인. 3. **승인 뒤** `bash scripts/deploy-share.sh`
(원격 노드 ≥22.18 확인 → rsync → systemd 유닛 → Apache 조각). 4. vhost `<VirtualHost *:443>` 에 `Include ".../spin-share.conf"` 한 줄(스크립트는
안 고친다) → `apachectl -t` → `ctlscript.sh restart apache`. 5. `curl https://spin.atit.app/api/share/healthz` → `{"ok":true,"count":0}`. 6. 앱은 평소대로
`npm run deploy:aws`(개인정보처리방침 제10조가 같이 나간다 — 서버보다 먼저 나가면 방침이 아직 없는 기능을 말한다, 순서는 5 → 6). 7. §4·§5.5 실기.

## 6. 세션 공유 (2026-09-08 기현님 지시: "세션 공유도 가능하지? 확장의 문제니까" → "진행해")

`PLAN-URL-SHARE.md` 결정 11(세션은 안 연다)의 근거 *"드릴 N개를 물고 와서 QR 이 통째로 죽는다"* 는 긴 링크의 것이었고
백엔드가 생기며 죽었다 — ⚠️ 2026-09-08 로 뒤집는다.

| # | 결정 | 근거 |
|---|---|---|
| S1 | 평문 = `exportSessionFile(session, drills)` 봉투(0x01 코덱 그대로). 복호 뒤 사슬은 파일 가져오기의 `kind:'session'` 그대로(드릴 먼저 심고 세션의 참조를 결과로 잇는다) | 두 번째 사슬을 만들지 않는다 |
| S2 | 뺄 것: 세션의 `participantIds`(참가자 명단) + 드릴들의 실명·팀 이름(결정 8). 장소·메모는 남기고 공유 모달에 "장소·메모가 포함됩니다" 한 줄 | 명단은 보내는 팀의 것, 장소·메모는 코치가 쓴 내용 |
| S3 | 서버 상한 `SHARE_MAX_BYTES` 64 KiB → **256 KiB**(클라이언트 상한도 같이). 초과는 지금처럼 `too-large` "파일로 내보내기" 안내 | 10드릴 세션 20~30 KB, 20드릴을 넘기면 64 KiB 에 걸린다 |
| S4 | 만드는 자리: 세션 화면의 ⋯/내보내기 자리에 [링크로 공유]. 받는 쪽 미리보기: 세션 제목·구간 수·드릴 수(+드릴 제목 목록), 저장 뒤 "드릴 N개 + 세션 1개" 보고 | 파일 가져오기의 보고 형식 재사용 |
| S5 | 착지 URL 은 드릴과 같은 `/s/:id` — 종류는 봉투가 말한다(`spin: 'session'`). 세션 저장 뒤 목록은 세션 화면으로 | 링크 꼴을 둘로 안 만든다 |

### 6.1 구현 결과·검수 (2026-09-08)

S1~S5 를 C(코어·서버·배포 조각) ∥ U(화면·i18n) ∥ D(문서·개인정보처리방침) 로 병렬 랜딩하고, 검수가 마지막 관문에서 파일 소유
경계 때문에 남아 있던 배선을 마쳤다. 커밋·푸시·배포는 전부 기현님 몫(§5.6 순서 그대로, 아래 §6.1.5).

#### 6.1.1 관문

- `npm run typecheck` 0 · `npm run lint` 경고 48(HEAD 와 같은 수, 새 것 0) · `npx vitest run` 298 파일 3,850 케이스 통과.
- **헤드리스 끝까지**(Vite 5201 + `server/share` **8790** + `VITE_SHARE_API_BASE` 절대 주소 — 8787 은 검수 밖의 프로세스가 물고 있어
  포트를 옮겼고, 덕분에 교차 출처(CORS `*`) 경로까지 같이 돌았다 · Chrome 152 CDP · 프로필 둘 · 단언 **25/25**):
  세션 화면에서 드릴 2개(선수 실명 '홍길동'·팀 이름 '가치이룸FC'·참가자 2명·장소·메모가 든) 세션의 ⋯ [링크로 공유] → 링크
  `http://…/s/<10자>#<43자>`(드릴과 **같은 꼴**, S5) → 모달에 공통 고지 + "장소·메모가 포함됩니다. 참가자 명단은 빠집니다."(S2)
  → 만든 쪽 `spin.shareLinks` 에 `sessionId` 칸으로 토큰 한 줄 → 서버 data 에 `<id>.bin`(1,052 B)·`<id>.json` 뿐이고 `.bin` 에
  `participant`·`schemaVersion`·`payload`·`session`·`drills`·실명·장소·메모 문자열 **0건** → 다른 프로필(링크의 첫 드릴과 **같은 id**
  를 다른 내용으로 먼저 가진)로 열기 → 착지 주소 `/s/<id>`(열쇠 제거) → 시트 제목 [공유받은 세션]·"1구간 · 드릴 2개"·드릴 제목 2줄(S4)
  → [내 목록에 저장] → 토스트 "드릴 2개와 세션 1개를 저장했습니다." → 주소 `/sessions`(교체, `history.length` 2) → 받은 세션에
  `participantIds` **없음**, 장소·메모 **남음** → 첫 항목은 사본 id("E2E 슛 연습 (사본)", 실명 없음·팀 이름 기본값 '우리 팀'), 둘째는
  봉투 id 그대로, 먼저 갖고 있던 내 드릴은 안 덮임 → 세션 열기: 누락·'삭제된 드릴' 0 → 뒤로가기 `/sessions` → 한 번 더 `/drills`
  (열쇠 없는 `/s/:id` 로 되돌아가지 않음). 스크린샷은 스크래치 `share-session-{1-modal,2-preview,3-saved,4-open}.png`.

#### 6.1.2 검수가 고친 것 — 단위 테스트가 전부 초록이었는데 배선·계약에서 난 것

| # | 무엇 | 어디 | 어떻게 드러났나 |
|---|---|---|---|
| 1 | **받는 쪽 화면 배선이 없었다** — `LibraryScreen` 이 `onSavedSession` 을 안 넘겨 세션 링크는 저장은 되는데 시트가 안 닫히고 보고도 없었다(사람은 [저장]이 안 먹은 줄 알고 다시 누른다 → 사본 하나 더). U 의 blockers ① — 파일 소유 경계 | `LibraryScreen.tsx` `onSavedSession`: refresh → 토스트 `library.import.session.saved` → `goLibrary({ tab: 'sessions' })` → 본문 초점 | U 보고 + 새 LibraryScreen 케이스 + 헤드리스 |
| 2 | **세션 저장 뒤 이동이 push 가 될 자리** — 착지 분기가 «대상 없음» 에만 걸려 `goLibrary({ tab: 'sessions' })` 는 push 였다. §5.2 ⑥(뒤로가기가 열쇠 없는 `/s/:id` 로)이 세션 경로로 되살아난다. U 의 blockers ② | `AppShell.tsx` goLibrary 어댑터: 착지면 탭 목적지도 `back('sessions' \| 'drills')` | 새 wiring 케이스(`/sessions` + `REPLACE` 단언) |
| 3 | **세션 링크의 삭제 토큰이 안 남았다** — `ShareLinkRecord.drillId` 가 필수라 세션 링크만 만료 전에 못 지웠다. 장소·메모가 실리는 쪽이야말로 지울 권리가 먼저 필요한 쪽이다 | `storage/shareLinks.ts` `drillId?` + `sessionId?`(정확히 하나, 둘 다 없는 줄은 버린다) · `ShareLinkModal` 이 종류별 칸에 남긴다 | U 가 «지금의 한계» 로 못박아 둔 단언을 «남는다» 로 뒤집음 |
| 4 | **같은 세션 링크를 두 번 저장하면 덮어쓰기** — 파일 가져오기 규칙(세션 id 그대로 put)을 그대로 타면, 첫 저장 뒤 내가 넣은 참가자·메모가 두 번째 저장(보낸 쪽이 고쳐서 다시 보낸 링크)에 말없이 사라진다 — 드릴 갈래가 allCopy 로 막은 것과 같은 종류의 사고 | `ShareImportSheet.tsx`: **같은 id 가 이미 있을 때만** 새 id(처음 받는 세션은 보낸 쪽 id 그대로 = 파일 가져오기와 같은 결과) | 코드 읽기 + 새 케이스 ⑥ |
| 5 | **`ShareLinkModal` 옛 `drill` prop 정리** — U 는 «유일한 옛 호출자 LibraryScreen» 이라 호환 prop 을 남겼는데 호출자는 둘이었다(`features/export/ExportSheet.tsx`). 둘 다 `doc` 으로 옮기고 prop·useMemo 를 지웠다. ⚠️ 호출자는 문서를 **state/useMemo 로** 든다 — 렌더마다 새 객체면 모달의 effect 가 링크를 무한히 새로 만든다(props 주석) | `LibraryScreen`·`ExportSheet`·`ShareLinkModal` | typecheck 가 잡았다 |
| 6 | 머리말 낡은 숫자 «이 드릴이 64 KiB 를 넘는다» → 256 KiB | `ShareLinkModal.tsx` | 대조 |
| 7 | **상한 경계 테스트가 자기증명** — `SHARE_MAX_CIPHERTEXT_BYTES ± 1` 을 상수에서 파생해 상한을 64 KiB 로 되돌려도 초록이었다 | `src/share/api.test.ts` 결정값 `256 * 1024` 리터럴 | 돌연변이 ③ |

#### 6.1.3 S1~S5 대조 · 드릴 공유 회귀

| # | 결과 |
|---|---|
| S1 | ✅ 봉투 `exportSessionFile` 그대로(코덱 0x01). 저장 사슬 parseSpinFile → prepareSessionImport → commitDrills(전부 'copy') → commitSession(idMap 리맵). **드릴 하나라도 관문에서 떨어지면 세션 통째 거절**(codec `acceptSession` — 링크에는 파일의 세 숫자 보고가 없다) |
| S2 | ✅ codec 이 `participantIds`·`ChairDef.name`·`teams.*.label` 을 **키째** 지우고 장소·메모는 남긴다(헤드리스에서 실측). 모달 한 줄 `library.share.noteSession` 3언어. 개인정보처리방침 제10조 2항이 같은 사실을 말한다(D) |
| S3 | ✅ 256 KiB 가 **네 곳** 같이 움직였다: `api.ts` `SHARE_MAX_CIPHERTEXT_BYTES` · `server/share/index.ts` 기본 262144 · README 표 · `deploy/share/apache-share.conf` `LimitRequestBody 266240`. 계획 밖 판단 하나: 펴기 상한 1 MiB → **4 MiB**(`codec.ts` ⚠️ 2026-09-08 — 256 KiB 암호문이 4:1 만 돼도 1 MiB 라 폭탄 방어선이 정상 세션을 자른다; 폭탄 방어는 그대로) |
| S4 | ✅ 세션 케밥 [내보내기]·[링크로 공유]·[삭제](헤드리스 실측). 미리보기 제목·구간 수·드릴 수·드릴 제목 목록. 보고 "드릴 N개와 세션 1개를 저장했습니다"(N 은 실제로 심은 수) |
| S5 | ✅ `/s/:id` 하나, 종류는 봉투. 저장 뒤 세션 화면(교체) — 위 §6.1.2 #1·#2 |

드릴 공유 회귀 없음: 기존 share 테스트(codec·api·crypto·link·server app.test, ShareImportSheet 드릴 케이스 5, ShareLinkModal 드릴 케이스,
LibraryScreen·AppShell.wiring 착지 케이스)가 전부 초록이고, 헤드리스에서 드릴 경로 문구·동작은 무변경이다(착지 시트 제목은 봉투가 답하기
전까지 드릴 문구 — S5 의 대가, ShareImportSheet.tsx 주석).

#### 6.1.4 돌연변이 — 8/8 빨간불

한 군데씩 망가뜨리고 좁힌 테스트를 돌린 뒤 백업으로 원복(`cmp` 확인). ①~④ 는 지시의 넷, ⑤~⑧ 은 검수가 새로 넣은 단언.

| # | 망가뜨린 것 | 좁힌 테스트 | 결과 |
|---|---|---|---|
| ① | codec `stripSessionPayload` 가 `participantIds` 를 안 지움 | `src/share/codec.test.ts` | 빨강 1 |
| ② | 세션 드릴 참조 재배치 끔(`commitSession` 에 빈 idMap) — «세션이 내 드릴을 가리키는» 원래 사고를 되살린 것 | `ShareImportSheet.test.tsx` | 빨강 1 |
| ③ | 상한 되돌림(`SHARE_MAX_CIPHERTEXT_BYTES` 256 → 64 KiB) | `src/share/api.test.ts` | **처음엔 초록** — 경계 케이스가 상수에서 파생해 자기증명이었다. 결정값 `256 * 1024` 리터럴로 고친 뒤 빨강 1 |
| ④ | kind 분기 고정(`decodeSharePayload` 의 세션 분기 제거 = 옛 «드릴만» 교리) | codec · ShareImportSheet · LibraryScreen 테스트 | 빨강 7 |
| ⑤ | 착지 분기를 «대상 없음» 에만 걸리게 되돌림(세션 탭 이동이 push) — §5.2 ⑥ 버그의 세션판 | `AppShell.wiring.test.tsx` | 빨강 1 |
| ⑥ | 세션 id 사본 규칙 끔(같은 id 덮어쓰기) | `ShareImportSheet.test.tsx` ⑥ | 빨강 1 |
| ⑦ | 세션 링크의 삭제 토큰을 안 남김 | `ShareLinkModal.test.tsx` | 빨강 1 |
| ⑧ | 저장 뒤 목적지를 드릴 탭으로(`goLibrary()`) | `LibraryScreen.test.tsx` | 빨강 1 |

②·⑤ 는 **원래 버그를 되살린 것**이라 새 단언이 실제 회귀를 잡는다는 증명이고, ③ 은 돌연변이가 **검사표의 구멍**을 잡은
사례다 — 상한처럼 계획서가 값을 정한 경계는 상수에서 파생하지 않고 결정값을 적는다(서버 `app.test.ts` 의 262144/262145 와 같은 규율).

#### 6.1.5 남은 실기·배포 순서

- **배포 순서 의존**(C 의 blockers ③): `scripts/deploy-share.sh` → vhost `LimitRequestBody 266240`(`apachectl -t`) → 앱 `npm run deploy:aws`.
  앱이 먼저 나가면 세션 링크가 앱·서버는 통과해도 Apache 70000 에서 413 — 그 413 은 프록시 없는 개발 서버에서 재현되지 않는다.
- 실기(jsdom·헤드리스가 못 재는 것): ① 20~30드릴 세션의 실제 암호문 크기와 256 KiB 초과 시 "파일로 내보내기" 안내 ② 세션 케밥이
  3항목이 된 뒤 좁은 창·태블릿에서 메뉴가 카드 밖으로 잘리지 않는지 ③ 미리보기 드릴 목록(maxHeight 180px) 스크롤·긴 제목 말줄임
  ④ 공유 모달 고지 두 줄이 작은 창에서 겹치지 않는지 ⑤ [복사] + 메신저 붙여넣기에서 `#` 뒤 보존 ⑥ 토스트가 세션 화면의 헤더 제목
  "훈련 세션" 을 가린다(헤드리스 캡처 3·4 에서 보임 — 기존 토스트 위치이지 이번 변경이 아니다, 거슬리면 별건).
- 알려진 한계(결정 그대로): 회수 UI 없음(결정 11) — 토큰은 이제 두 종류 다 남는다. 편성이 가리키던 드릴이 지워진 세션은 그 항목을
  조용히 빼고 보낸다(`exportOneSession` 과 같은 규칙, 받는 쪽 '삭제됨').
- 검수 환경 메모: 8787 을 물고 있던 외부 `node server/share/index.ts`(검수의 프로세스가 아님)는 건드리지 않았다. 검수가 띄운
  서버·Vite·헤드리스 크롬은 전부 pid 로 종료했다.
