// 개인정보처리방침·서비스 약관 주소 — 정적 페이지(`public/<doc>/index.html`, 한 파일에 세 언어 절
// #ko #en #ja). 구글 동의 화면·크롤러가 앱 없이 열어야 해서 앱 밖에 있다.
//
// ⚠️ 2026-09-06: 처음엔 `https://spin.atit.app/…` 절대 주소였다. 기현님 지적 *"배포 전에 개발서버에서
// 안 뜬다"* — 운영 주소는 배포 전엔 죽은 링크다. **같은 출처의 상대 경로**로 뒤집었다: Vite 개발
// 서버가 public/ 을 그대로 내고, Apache 도, 데스크톱 번들 자산도 같은 경로에 같은 파일이 있다.
// 모달로 감싸는 안은 기현님이 물렸다(*"어렵게 모달로 하지 말고"*).
export type LegalDoc = 'privacy' | 'terms';

/** 같은 출처 상대 경로 + 언어 앵커. 파일 이름까지 적는다 — Vite 개발 서버가 디렉터리 인덱스를
 *  안 낼 수 있고 Tauri 자산 프로토콜도 파일 이름으로 찾는다. */
export function legalPage(doc: LegalDoc, locale: string): string {
  return `/${doc}/index.html#${locale}`;
}
