# PLAN — 개인정보처리방침·서비스 약관을 앱 안 화면으로 (2026-09-06)

> 기현 지시(2026-09-06): *"오른쪽 메뉴바, 헤더, 헤더 왼쪽에 '← 설정으로' 등 설정 하위 url 로 가고
> 앱 틀은 해치지 않게 하자"* — 그 전의 두 안(운영 절대 주소 새 탭 → 모달 → 같은 출처 상대 링크)은
> 같은 날 차례로 물렸다. 이 문서가 정본이고, 상위 정본은 `AGENTS.md`·`docs/DESIGN.md`.

## 0. 한 줄 원칙

문서는 **한 벌**(HTML 원문 하나)이고, 앱 화면과 검색엔진용 정적 페이지가 같은 원문에서 나온다.

## 1. 결정

| # | 결정 | 근거 |
|---|---|---|
| 1 | 앱 안 URL 은 `/settings/privacy` · `/settings/terms`. 새 `Screen` 키를 만들지 않고 `settings` 화면 + `NavTarget { kind:'legal', doc }` (규칙 화면의 `{kind:'rule', topic}` 선례) | 레일·헤더·도움말 등록을 그대로 물려받는다. 새 화면 키는 `screens.ts` 표 넷·REQUIREMENTS 까지 번진다 |
| 2 | 헤더: 제목 = 문서 이름, 왼쪽 `leading` = "← 설정으로"(`HeaderConfig.leading`, 규칙 카드의 [← 목록으로] 와 같은 슬롯) → `/settings` | 되돌아가기는 브라우저 back 이 아니라 "제자리로 되접기"(`AppShell.tsx` rules 분기와 동일) |
| 3 | 원문은 `src/features/settings/legal/{privacy,terms}.html` 로 옮긴다(`public/` 에서 이동). 한 파일에 `<section id="ko\|en\|ja" lang>` 세 절. 앱은 `?raw` 로 읽어 **정규식**으로 언어 절을 잘라 `dangerouslySetInnerHTML` | SSR 프리렌더 빌드에는 DOMParser 가 없다 — 같은 순수 함수를 앱과 프리렌더가 공유하려면 문자열 처리여야 한다. 원문은 저장소의 정적 파일이지 이용자 입력이 아니다 |
| 4 | 검색엔진·구글 동의 화면용 공개 URL 은 **그대로 `/privacy/` · `/terms/`**(+`/en/`·`/ja/`). 프리렌더 목록에 넣고, `parsePath` 가 `/privacy`·`/terms` 를 `settings+legal` 로 **한 방향 흡수**(옛 `law-N` 딥링크와 같은 꼴) | `robots.txt` 가 `/settings` 를 통째로 막는다. 콘솔에 이미 준 주소를 바꾸지 않는다. 착지하면 앱이 같은 문서를 앱 틀 안에서 이어 보여 준다 |
| 5 | 프리렌더 `data-seo-page="legal"`, 로더 면제 판정에 `legal` 추가 | 약관을 보러 온 사람은 "이미 읽고 있는 글" — 규칙 글과 같은 사유(0.6.3 결정 13) |
| 6 | 원문 HTML 의 안쪽 요소는 인라인 스타일을 못 받으므로 `.legal-doc` 타이포그래피만 `src/styles/appShell.css` 에 둔다 — 인라인 기본 규율(AGENTS §1.4)의 **명시적 예외** | 요소 하나하나가 React 가 아니라 원문 문자열이다 |
| 7 | 데스크톱 전용 "기본 브라우저로 열기" 분기와 opener 허용 목록의 `spin.atit.app` 항목은 지운다 | 앱 안 화면이라 데스크톱도 그냥 된다 |
| 8 | 링크 자리는 그대로(설정 [데이터] 절 끝 · [Google Drive 동기화] [연결] 아래). 헤더·프리렌더 홈에는 안 둔다 | 2026-09-06 앞선 결정 |

## 2. 손대는 곳

- 라우팅·틀: `src/app/useAppHistory.ts`(NavTarget) · `src/app/routes.ts`(pathFor/parsePath + 흡수) · `src/features/home/nav.ts`(`openLegal`) · `src/app/AppShell.tsx`(`legalDocFromNav`·어댑터·헤더 config·renderScreen) · `src/app/announce.ts`
- 화면·내용: `src/features/settings/legal/{privacy,terms}.html` · `legalContent.ts`(절 추출 순수 함수 + 문서별 제목) · `LegalDocView.tsx` · `SettingsScreen.tsx`(`nav`·`legalDoc` prop) · `SyncSection.tsx` · `LegalLinks.tsx` · `src/styles/appShell.css`(`.legal-doc`) · i18n 3파일(`settings.legal.back`)
- 프리렌더: `src/seo/prerenderData.ts` · `scripts/prerender.mjs`(seoPage `legal`) · `src/app/loader/prerenderLanding.ts` · `index.html`(`.seo-prerender ol/.meta`)
- 지움: `public/privacy/` · `public/terms/` · `src/features/settings/legalUrl.ts` · capabilities 의 `spin.atit.app`
- 테스트: `src/app/useAppHistory.test.ts`(왕복 2건 + 흡수 2건) · HomeNav 목 5파일 · `legalContent.test.ts`(절 추출·h1 제거·없는 로케일 null — 돌연변이로 확인)
- 문서: CHANGELOG ×3 의 오늘 항목 수정, 이 계획서 §4

## 3. 착수 순서

병렬 셋(파일 집합이 서로 다르다) → 검증 하나가 전체를 묶는다.

A. 화면·내용 · B. 라우팅·틀 · C. 프리렌더·SEO·정리 → D. typecheck·lint·전체 테스트·빌드·헤드리스 착지 확인.

계약(A·B 가 서로 기대는 시그니처):
- `SettingsScreen({ nav, legalDoc }: { nav: HomeNav; legalDoc?: LegalDoc })`
- `HomeNav.openLegal(doc?: LegalDoc): void` — 인자 없으면 `/settings`
- `LegalDoc = 'privacy' | 'terms'` 는 `src/features/settings/legalContent.ts` 가 export
- `NavTarget` 에 `{ kind: 'legal'; doc: LegalDoc }`

## 4. 실기 확인(jsdom 이 못 재는 것)

- 좁은 창: 헤더에 [3항목 세그먼트] + [← 설정으로] + 제목이 한 줄에 서는가.
- 데스크톱 앱: [설정] → 링크 → 문서가 앱 안에 뜨고 되돌아오는가(브라우저가 뜨면 안 된다).
- `https://spin.atit.app/privacy/` 직접 착지: 로더 없이 문서 → JS 뜬 뒤 같은 문서가 앱 틀 안에.
- 문서 안 바깥 링크(구글 권한 페이지 등)가 새 탭으로 열리는가(데스크톱은 기본 브라우저 — opener 허용 목록에 없는 호스트는 안 열린다. 필요하면 그때 추가).

### 검수 결과 (D, 2026-09-06)

셋을 한 트리에서 묶어 잰 것. `npm run typecheck` 0 · `npm run lint` 새 경고 0(남은 것은 전부 옛
`only-export-components`·hooks 경고) · `npx vitest run` 284파일 3670케이스 전부 초록
(`EditorWorkspace.playback.test.tsx` 발 unhandled `window is not defined` 1건은 전체 부하에서만 나고
단독 회차엔 없다 — useAutosave 의 teardown 경쟁, 이 작업과 무관) · `npm run build` 39장.

빌드 산출물: `dist/{,en/,ja/}{privacy,terms}/index.html` 6장 전부 `data-seo-page="legal"` 과 그 언어의
`<h1>`(SPIN 개인정보처리방침 / Privacy Policy / プライバシーポリシー …). `dist/sitemap.xml` 에 6 URL.
`public/privacy`·`public/terms` 없음. dist 에 `legalUrl` 문자열 없음.

헤드리스(dist 를 `http.server` 로, Chrome 152 headless + CDP, 문서 시작부터 `.spin-loader` 를
MutationObserver+16ms 폴링으로 감시):

| 착지·조작 | 결과 |
|---|---|
| `/privacy/` 착지 3초 | 로더 **0회**(같은 감시기가 `/` 착지에서는 boot 로더를 잡았으니 감시기는 산 것), 헤더 "설정으로 개인정보처리방침", 레일 `nav[aria-label="주요 메뉴"]`, 문서 h2·ol 있음, `lang=ko` |
| `/` → 레일 [설정] → [데이터] 절 "개인정보처리방침" 버튼 | `location.pathname === '/settings/privacy'`, 헤더 제목 = 문서 이름, 레일 로더는 `/settings` 전환에만 1회(설계대로) 뜨고 문서 전환에는 안 뜬다 |
| 헤더 [설정으로] | `/settings`, 헤더 "설정 언어·화면·데이터 등 이 기기의 설정" |
| `/en/terms/` 착지 3초 | 로더 0회, 헤더 "Settings Terms of Service", 영어 절, `lang=en` |

검수 중 고친 것:
- `LegalDocView.tsx` — 마운트 때 sr-only h2 를 포커스하던 줄을 지웠다. 실측에서 `activeElement` 는
  늘 `main` 이었다: B 가 AppShell 발표 이펙트 의존성에 `legalDoc` 을 넣어서 문서 전환마다 `#main`
  포커스 + 문서 이름 발표가 뒤에 돌아 이긴다. A 의 주석("여기서는 안 돈다")은 그 전제로 쓴 것이라
  거짓이 됐다. 스크롤 맨 위 복귀와 sr-only 제목(heading 구조)은 남겼다.
- `legal/{privacy,terms}.html` 머리말 — `<script>`·`<style>`·이벤트 속성 금지를 계약으로 적었다
  (C 의 의문 1: 프리렌더가 이스케이프 없이 심는다).

A·B·C 가 남긴 의문의 처리:
- privacy `<footer>` 소실(A-1) — 세 절 모두 본문에 연락처 mailto 가 있다(ko 4·en 4·ja 4곳). 프리렌더에
  footer 를 되살릴 이유 없음.
- 발표문은 `settings.legal.*` 재사용(B-1) — 그대로 둔다. `ruleTopic` 이 발표 방아쇠에 없는 구멍(B-2)은
  이 작업 밖, 별건.
- 문서 안 바깥 링크(A-3·C-3) — 데스크톱 opener 목록에서 `spin.atit.app` 이 빠져 이제 안 열린다.
  웹에서는 새 탭. 실기 판정 뒤 필요하면 `developers.google.com`·`myaccount.google.com` 만 넣는다.
- `.top`(↑ 맨 위로) 링크(A-2)·`<p class="top">` 서식(C-2) — 원문 손질은 기현님 판단, 안 건드림.

남은 실기 항목(§4 그대로): 좁은 창 헤더 한 줄 · 데스크톱 앱 왕복(브라우저가 뜨면 안 된다) ·
운영 `spin.atit.app/privacy/` 착지(호스팅의 SPA 폴백으로 `/settings/privacy` 새로고침도 살아야 한다 —
`http.server` 는 그 경로를 404 내므로 여기서는 못 쟀다) · 문서 안 바깥 링크 · 법 문서 헤더에 부제가
없어 높이가 다른 화면과 어긋나 보이는지(B-3).

## 5. 구현 메모 — 프리렌더·SEO·정리 (2026-09-06)

### 5.1 새로 굽는 6장

`prerenderPages()` 가 3언어 × 문서 2벌을 더 낸다(11 → 13장/언어, 전체 33 → **39장**).
주소는 규칙 페이지와 같은 `pageUrl()` 을 타므로 **항상 슬래시로 끝난다**(DirectorySlash 301 이
canonical 을 갈아치우는 것을 막는 그 규칙).

| # | URL | `<html lang>` | 제목 출처 |
|---|---|---|---|
| 1 | `/privacy/` | ko | `privacy.html` `#ko` 절의 `<h1>` — "SPIN 개인정보처리방침" |
| 2 | `/en/privacy/` | en | `#en` — "SPIN Privacy Policy" |
| 3 | `/ja/privacy/` | ja | `#ja` — "SPIN プライバシーポリシー" |
| 4 | `/terms/` | ko | `terms.html` `#ko` — "SPIN 서비스 약관" |
| 5 | `/en/terms/` | en | `#en` — "SPIN Terms of Service" |
| 6 | `/ja/terms/` | ja | `#ja` — "SPIN 利用規約" |

- 제목은 `legalTitle(doc, locale)` 이 원문 `<h1>` 에서 뽑는다 — 제목을 `prerenderData.ts` 에
  한 벌 더 적으면 원문을 고친 날 **검색 결과에만** 옛 제목이 남는다. 절이나 `<h1>` 이 없으면
  `throw` 해서 빌드를 세운다(제목 없는 페이지가 조용히 배포되면 틀의 기본 제목이 실린다).
- 규칙 페이지의 `· SPIN` 꼬리는 안 붙인다. h1 이 이미 제품 이름을 품고 있다.
- 설명 한 줄만 `LEGAL` 상수(`SITE` 옆)에 3언어로 새로 쓴다 — 원문은 본문부터 시작해서
  요약문에 해당하는 문장이 없다. 화면에 안 뜨는 글이라 i18n 사전에는 넣지 않는다(`SITE` 와 같은 사유).
- 본문은 `extractLegalSection(legalHtml(doc), locale, { stripH1: false })` 를 **이스케이프 없이**
  넣는다. 규칙 페이지는 데이터에서 태그를 만들어 붙이므로 `esc()` 가 필요했지만, 여기 들어가는
  것은 우리가 쓴 정적 HTML 그 자체다.
- JSON-LD 는 `WebPage`(+`isPartOf: WebSite`). `Article` 이 아니다 — 읽을거리가 아니라 문서다.
- `alternates` 는 `alternatesFor('/privacy')` 재사용 → 세 언어 + `x-default`(뿌리). 사이트맵의
  `xhtml:link` 도 같은 목록에서 나오므로, 구글이 세 언어판을 중복이 아니라 번역으로 읽는다.

### 5.2 robots.txt 를 안 고친 근거

`public/robots.txt` 는 `Allow: /` 아래 `Disallow: /drills · /sessions · /present · /settings`
(+`/en/`·`/ja/` 판)만 막는다. 막는 이유는 "그 화면은 이 기기의 IndexedDB 를 읽어 그리므로
크롤러에게는 언제나 빈 화면" 이다.

- 새 주소 `/privacy/`·`/terms/`(+언어 접두)는 그 네 접두사 어디에도 안 걸린다 → **이미 허용**.
  줄을 더할 것이 없다.
- 앱 안 주소 `/settings/privacy` 는 `Disallow: /settings` 에 걸려 **이미 차단**이다. 이게 결정 4
  (공개 주소를 `/settings` 아래로 옮기지 않는다)의 실질적 근거다 — 옮겼으면 색인이 통째로 사라진다.
- 즉 robots 규칙은 한 줄도 안 바뀌고, 두 문서는 공개 주소로만 색인되고 앱 안 사본은 안 색인된다.
  같은 내용이 두 주소에 있지만 한쪽이 차단이라 중복 판정 문제도 없다.

### 5.3 로더 면제와 종류 표식

- `scripts/prerender.mjs` 의 `seoPage` 판정: `/\/rules\//` → `rules`, `/\/(privacy|terms)\//` →
  `legal`, 나머지 `home`. 주소가 항상 슬래시로 끝나므로 `/privacy/`·`/ja/terms/` 가 걸리고
  홈(`/`·`/en/`)은 안 걸린다 — 10가지 주소로 `node -e` 확인.
- `prerenderLanding.ts` 는 `rules` **또는** `legal` 이면 로더를 면제한다(결정 5). 홈은 여전히
  면제하지 않는다 — 0.6.3 로더가 배포본에서 한 번도 안 뜬 원인이 그 구멍이었다.
- `index.html` 의 첫 페인트 감춤은 `[data-seo-page='home']` 만 겨냥하므로 법적 문서는 그대로
  보인다. 그 블록에 `ol`·`li`·`.meta` 최소 서식을 더했다(원문 안쪽 요소는 인라인 스타일을 못
  받는다 — 결정 6). `.meta` 는 새 hex 를 들이지 않으려고 색 대신 크기·불투명도로 낮춘다.

### 5.4 정리

- `src-tauri/capabilities/default.json` 의 opener 허용에서 `https://spin.atit.app/*` 제거
  (결정 7 — 문서를 앱 안에서 보므로 기본 브라우저를 열 일이 없다). `accounts.google.com/*` 는
  구글 로그인 때문에 남는다. `rg -n 'spin.atit.app' src-tauri/` 결과 남은 참조는
  `tauri.conf.json` 의 `homepage` 뿐 — 패키지 메타데이터라 opener 와 무관하다.
- 문서 안 바깥 링크(`spin.atit.app` 등)는 데스크톱에서 이제 안 열린다. 실기에서 필요하다고
  판명되면 그때 허용 목록에 다시 넣는다(§4 마지막 항목).
- CHANGELOG ×3 의 오늘 「추가됨」 줄을 "[설정] 안에서 읽는다(검색엔진용 주소 /privacy/·/terms/)"
  취지로 고쳤다. 앞선 안(새 탭으로 여는 별도 페이지)을 설명하던 문장이라 그대로 두면 거짓말이 된다.
