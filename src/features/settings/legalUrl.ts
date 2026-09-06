// 개인정보처리방침·서비스 약관 주소 — LegalLinks.tsx 에서 뗐다(컴포넌트 파일은 컴포넌트만 export,
// AGENTS.md §6 의 only-export-components 규율). 절대 URL 이어야 한다: 데스크톱은 `tauri://localhost`
// 라 상대 경로가 사이트로 안 간다. 호스트를 바꾸면 `src-tauri/capabilities/default.json` 의
// opener 허용 목록도 같이.
import type { Locale } from '../../i18n/locale.ts';

export const LEGAL_ORIGIN = 'https://spin.atit.app';
export type LegalDoc = 'privacy' | 'terms';

/** 한 파일에 세 언어 절이 있고 앵커가 로케일 이름이다(`public/<doc>/index.html`). */
export function legalUrl(doc: LegalDoc, locale: Locale): string {
  return `${LEGAL_ORIGIN}/${doc}/#${locale}`;
}
