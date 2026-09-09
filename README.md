<p align="center">
  <img src="public/logo.svg" alt="" width="96" height="96">
</p>

<h1 align="center">SPIN</h1>

<p align="center">
  <strong>파워체어 풋볼 훈련 도구</strong> — 전술판 · 드릴 편집기 · 훈련 세션 · 규칙 학습<br>
  <a href="https://spin.atit.app"><strong>spin.atit.app</strong></a> 에서 설치 없이 바로 씁니다.
</p>

<p align="center">
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-blue.svg"></a>
  <img alt="version 0.6.7" src="https://img.shields.io/badge/version-0.6.7-informational">
  <img alt="한국어 · English · 日本語" src="https://img.shields.io/badge/i18n-ko%20%C2%B7%20en%20%C2%B7%20ja-success">
  <a href="CONTRIBUTING.md"><img alt="contributions welcome" src="https://img.shields.io/badge/contributions-welcome-brightgreen"></a>
</p>

<p align="center"><a href="README.en.md">English</a></p>

---

## 파워체어 풋볼이란

전동휠체어를 탄 선수 4명이 한 팀을 이뤄 농구장 규격의 실내 코트에서 하는 축구입니다.
휠체어 앞에 붙인 **가드(풋가드)** 로 지름 33 cm 공을 밀고 칩니다. 국제 경기 규칙은
**FIPFA**(Fédération Internationale de Powerchair Football Association)의 *Laws of the Game*
이고, 이 앱은 2025년판을 기준으로 삼습니다.

이 종목의 전술은 **공 반경 3 m 안에 같은 팀이 둘 이상 들어가면 반칙**(2-on-1)이라는 규칙
위에 서 있습니다. 그래서 여기서 "좋은 자리" 는 축구의 그것과 다르고, 종이와 화이트보드로는
그 거리를 눈으로 확인할 수가 없습니다. **SPIN 은 그 거리를 판 위에 그려 줍니다.**

## 무엇을 하는가

- **전술판** — 코트 위에 휠체어와 공을 놓고 밀어 보는 판. 2-on-1 판정 링, 골 지역 인원,
  세트피스 5 m 제한이 실시간으로 판정되어 색으로 나옵니다.
- **드릴 편집기** — 스텝(장면) 단위로 움직임을 짜는 편집기. 화살표·자유 그리기·메모·표시
  순서까지 다룹니다.
- **훈련 세션** — 드릴을 순서대로 엮어 그날의 훈련을 만들고, 시간 배분과 메모를 붙입니다.
- **팀 · 명단** — 선수와 등번호를 관리하고 드릴의 자리에 배정합니다.
- **시연 모드** — 큰 화면에서 드릴을 재생합니다. 훈련장에서 선수에게 보여 주기 위한 화면입니다.
- **규칙** — FIPFA Laws 를 조항 순서가 아니라 **주제별 9개 카드**로 익힙니다. 산문·도해·
  움직이는 보드 장면·비교표가 한 카드 안에 들어 있습니다.
- **내보내기** — PNG · PDF(인쇄용 훈련 계획서) · MP4 영상 · 백업 파일.
- **구글 드라이브 동기화** — 이용자 본인 계정의 앱 전용 폴더로 기기 사이를 오갑니다.
- **공유 링크** — 드릴과 세션을 링크로 넘깁니다. **종단 암호화**라 열쇠는 URL 조각(`#`)에만
  있고 서버로 가지 않습니다 — 서버는 열지 못하는 암호문만 보관합니다.
- **데스크톱 앱** — 같은 코드로 리눅스 · 윈도우 · 맥 네이티브 앱을 냅니다(Tauri).
- **한국어 · English · 日本語**, 그리고 **키보드만으로 전부 조작 가능**합니다.

### 누구를 위한 앱인가

파워체어 풋볼 팀의 **감독과 코치**가 첫 사용자입니다. 훈련 계획을 짜고, 선수에게 보여 주고,
인쇄해 나눠 주는 데 필요한 것을 한 곳에 둡니다. **선수와 심판**에게는 규칙 화면이 따로
쓸모가 있습니다 — 조항을 읽는 대신 움직이는 장면으로 2-on-1 과 골 지역 반칙을 봅니다.
서버에 계정을 만들지 않아도 되고, 설치 없이 브라우저에서 바로 씁니다.

## 시작하기

**Node 22.18 이상**이 필요합니다(`package.json` 의 `engines`, CI 는 22 로 돕니다). 공유 링크 서버가 빌드 없이 `.ts` 를 바로 돌리기 때문입니다.

```bash
git clone https://github.com/from104/spin.git
cd spin
npm ci
npm run dev          # 개발 서버 (http://localhost:5173)
```

| 명령 | 하는 일 |
|---|---|
| `npm run dev` | 개발 서버 |
| `npm run build` | 타입체크 + 프로덕션 빌드 + 규칙 글 정적 프리렌더 |
| `npm run typecheck` | 타입 오류만 확인 |
| `npm run lint` | oxlint |
| `npx vitest run` | 전체 테스트 |
| `npm run test:rel <파일>` | 그 파일을 쓰는 테스트만 |
| `npm run tauri:dev` | 데스크톱 셸 + 개발 서버 |
| `npm run tauri:build` | 데스크톱 설치 패키지 |

### 환경변수

**아무것도 넣지 않아도 앱은 돕니다.** 값이 없으면 구글 드라이브 동기화만 꺼집니다.

키 이름은 [`.env.example`](.env.example) 에 있습니다 — `.env.local` 로 복사해 채우십시오.
**구글 OAuth 클라이언트는 각자 [Google Cloud Console](https://console.cloud.google.com/) 에서
직접 발급해야 합니다.** 이 저장소는 클라이언트를 제공하지 않습니다. 웹과 데스크톱은 유형이
달라 클라이언트도 따로 만들어야 합니다(웹 애플리케이션 / 데스크톱 앱). 배경은
[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) 에 있습니다.

배포 대상(호스트·계정·SSH 키)도 저장소에 없습니다 — [`.env.deploy.example`](.env.deploy.example)
참조.

## 프로젝트 구조

```
src/
├─ model/      데이터 모델·검증·규칙 판정 (court.ts = 좌표의 유일한 출처, rules.ts = 2-on-1/골 지역)
├─ physics/    matter.js 래퍼·4존 운동학·히트테스트
├─ render/     SVG 렌더 (CourtStage.tsx 가 무대, objects/ 가 개체별 그리기)
├─ store/      에디터 상태 (reducer)
├─ storage/    IndexedDB·파일 입출력
├─ features/   화면별 기능 (board · editor · library · sessions · present · rules · print · export · settings)
├─ ui/         공용 UI 부품
├─ core/       상수·키맵·id
├─ app/        셸·라우팅
└─ test/       교차 검증 테스트 (문서↔코드 대조 포함)

server/share/  공유 링크 백엔드 (종단 암호화된 덩어리만 보관)
src-tauri/     데스크톱 셸 (Rust)
```

읽는 순서를 하나만 고른다면 **`src/core/constants.ts` → `src/model/court.ts` →
`src/render/CourtStage.tsx`** 입니다. 숫자가 어디서 오고, 좌표가 어떻게 정의되고, 그 둘이
화면에서 어떻게 만나는지가 그 셋에 있습니다.

## 문서

| 문서 | 무엇이 있나 |
|---|---|
| [docs/OVERVIEW.md](docs/OVERVIEW.md) | **왜 이런 모양인가** — 종목 설명, 화면별 기능, 설계의 뼈대(좌표계·휠체어 운동학·접근성), 코드 지도 |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | **어떻게 돌리고 올리나** — 개발 명령, 검증 규율, 배포, 데스크톱(Tauri) 상세 |
| [AGENTS.md](AGENTS.md) | **기여 관행의 정본** — 코드·커밋·문서·테스트·i18n 규약 |
| [CONTRIBUTING.md](CONTRIBUTING.md) | 기여 절차 요약 (한국어 + English) |
| [docs/DESIGN.md](docs/DESIGN.md) | 구현 계약 — 좌표·판정·렌더의 세부 |
| [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md) | 요구사항 정본 |
| [ROADMAP.md](ROADMAP.md) · [CHANGELOG.md](CHANGELOG.md) | 계획과 변경 이력 (`.en` · `.ja` 판 있음) |
| [docs/RULES-FIPFA-2025.md](docs/RULES-FIPFA-2025.md) | 앱이 판정에 쓰는 **규칙 팩트 정본** — FIPFA *Laws of the Game* 2025년판의 요약이며, 원문은 [FIPFA](https://www.fipfa.org/) 가 펴냅니다 |

## 기여

**기여자는 언제든 환영합니다.** 코드, 번역, 규칙 고증, 버그 제보, 접근성 지적, 무엇이든
좋습니다. 이슈와 PR 은 **한국어 · English · 日本語** 아무 언어로나 여셔도 됩니다.

시작하기 전에 [CONTRIBUTING.md](CONTRIBUTING.md) 를 읽어 주십시오 — 브랜치 기준(`devel`),
커밋 관례, PR 전에 통과시켜야 하는 관문(`npm run typecheck` · `npm run lint` ·
`npx vitest run`)이 거기 있습니다. 작은 오타가 아니라면 **PR 보다 이슈가 먼저**입니다.

이 프로젝트는 [Contributor Covenant](CODE_OF_CONDUCT.md) 를 따릅니다.
취약점은 이슈가 아니라 [SECURITY.md](SECURITY.md) 의 절차로 알려 주십시오.

## 라이선스

[MIT](LICENSE) — Copyright (c) 2026 Seo Kihyun (from104).

`package.json` 의 `"private": true` 는 npm 에 게시하지 않는다는 뜻일 뿐입니다. 이 앱은
라이브러리가 아니라 웹앱이고, 코드는 위 MIT 조건으로 자유롭게 쓰실 수 있습니다.

규칙 문서([docs/RULES-FIPFA-2025.md](docs/RULES-FIPFA-2025.md) 와 앱의 규칙 화면)는 FIPFA
*Laws of the Game* 의 **요약이며 저작권은 FIPFA 에 있습니다.** 코드 라이선스와는 별개이니
그 부분을 다시 쓰실 때는 원 저작물의 조건을 확인하십시오.
