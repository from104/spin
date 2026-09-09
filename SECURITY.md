# 보안 정책 · Security Policy

## 취약점 제보

**공개 이슈로 올리지 마십시오.** 다음 두 경로 중 하나를 써 주십시오.

1. **GitHub Private vulnerability reporting** — 이 저장소의 **Security** 탭에서
   *Report a vulnerability* 를 누르십시오. 가장 빠르고 확실한 경로입니다.
2. 그 경로를 쓸 수 없으면 **저장소 소유자 GitHub 프로필의 연락처**로 알려 주십시오.

제보에는 재현 절차, 영향 범위, 가능하다면 개념 증명을 담아 주십시오. 확인 회신은 보통
며칠 안에 드립니다. 수정이 나갈 때까지 공개를 미뤄 주시면 고맙겠습니다.

## 무엇이 이 범위인가

SPIN 은 서버에 사용자 데이터를 두지 않는 정적 앱입니다. 드릴·세션·명단은 브라우저의
IndexedDB 에 있고, 구글 드라이브 동기화는 이용자 본인 계정의 앱 전용 폴더를 씁니다.

특히 관심 있는 신고:

- **공유 링크의 암호화**(`server/share`, `src/share`). 공유 드릴은 브라우저에서 암호화되고
  열쇠는 URL 조각(`#`)에만 있어 서버로 가지 않습니다. 이 성질이 깨지는 경로가 있다면
  알려 주십시오.
- **OAuth 흐름**(`src/sync/auth.ts`, `src/sync/authDesktop.ts`, `src-tauri/src/oauth.rs`).
  데스크톱 갱신 토큰은 앱 데이터 폴더에 0600 파일로 둡니다(`src-tauri/src/secret_store.rs`).
- **내보낸 백업 파일에 섞이면 안 되는 값** — 토큰이 백업에 실려 남의 기기로 새는 경로.
- 데스크톱 셸의 CSP 나 파일 접근 권한(`src-tauri/tauri.conf.json`).

범위 밖: 저장소에 없는 제3자 배포본, 이용자가 스스로 발급해 넣은 OAuth 클라이언트의
설정 실수, 그리고 설치형 앱의 `client_secret` 이 배포본에서 읽힌다는 사실 자체(설치형
OAuth 는 그 전제로 설계되어 있고, 그래서 PKCE 를 씁니다).

---

## Reporting a vulnerability (English)

Please **do not open a public issue.** Use GitHub's *Report a vulnerability* button on this
repository's **Security** tab. If that is not available to you, reach the maintainer through
the contact details on their GitHub profile.

Include reproduction steps, impact, and a proof of concept if you have one. Expect an
acknowledgement within a few days, and please hold off on public disclosure until a fix ships.

SPIN is a static app that keeps user data in the browser (IndexedDB) and, optionally, in the
user's own Google Drive app folder. Reports about the end-to-end encryption of share links,
the OAuth flows, desktop token storage, or the desktop shell's CSP are especially welcome.
