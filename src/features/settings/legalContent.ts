// 개인정보처리방침·서비스 약관 원문에서 **한 언어 절만** 잘라 내는 순수 함수들.
// 원문은 `legal/{privacy,terms}.html` 한 벌이고(문서는 한 벌, 계획서 §0), 앱 화면
// (`LegalDocView.tsx`)과 검색엔진용 프리렌더(`scripts/prerender.mjs`)가 **같은 함수**로
// 같은 조각을 얻는다.
//
// ⚠️ DOMParser 를 쓰지 않는 이유(계획서 결정 3): 프리렌더는 Node 에서 도는 빌드 스크립트라
// DOM 이 없다. 앱과 프리렌더가 같은 결과를 내려면 파싱이 **문자열 처리**여야 한다. 정규식으로
// HTML 을 다루는 것은 일반적으로 틀린 방법이지만, 여기서 먹는 입력은 이용자 입력이 아니라
// 저장소에 박힌 정적 파일 두 개뿐이고, 그 두 파일의 모양(절이 겹치지 않는다·`</section>` 이
// 절 안에 없다)은 원문 머리말이 계약으로 못박아 둔다. 원문 모양을 바꾸려거든 이 파일의
// 테스트(`legalContent.test.ts`)부터 보라.
//
// 하면 안 되는 것: 여기서 원문을 **정제**하려 들지 말 것(태그 화이트리스트·링크 재작성 등).
// 원문은 우리가 쓴 글이고, 손질은 화면 쪽(LegalDocView 의 링크 위임)이 런타임에 한다.
import privacyRaw from './legal/privacy.html?raw';
import termsRaw from './legal/terms.html?raw';

export type LegalDoc = 'privacy' | 'terms';

/** 문서 두 벌. 라우팅·프리렌더가 "전부 돌기" 용으로 쓴다. */
export const LEGAL_DOCS = ['privacy', 'terms'] as const;

/** 원문 전체(세 언어 절 + 머리말 주석). */
export function legalHtml(doc: LegalDoc): string {
  return doc === 'privacy' ? privacyRaw : termsRaw;
}

/** `<section id="<locale>" …> … </section>` 의 **안쪽**. 절이 없으면 null.
 *
 *  `stripH1` 이면 첫 `<h1>…</h1>` 을 지운다 — 앱 화면은 제목을 헤더가 이미 보여 주므로
 *  문서 안에 같은 제목이 두 번 서면 안 된다(프리렌더는 지우지 않는다: 그쪽은 제목이 필요하다). */
export function extractLegalSection(html: string, locale: string, opts: { stripH1?: boolean } = {}): string | null {
  if (!/^[a-z]{2}$/.test(locale)) return null;
  const re = new RegExp(`<section\\s+id="${locale}"[^>]*>([\\s\\S]*?)</section>`, 'i');
  const m = re.exec(html);
  if (!m) return null;
  const inner = opts.stripH1 ? m[1].replace(/<h1\b[^>]*>[\s\S]*?<\/h1>/i, '') : m[1];
  return inner.trim();
}

/** 절의 `<h1>` 텍스트(태그 없는 알맹이). 절이나 제목이 없으면 null. */
export function legalTitle(doc: LegalDoc, locale: string): string | null {
  const section = extractLegalSection(legalHtml(doc), locale);
  if (section === null) return null;
  const m = /<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(section);
  if (!m) return null;
  return m[1].replace(/<[^>]*>/g, '').trim() || null;
}
