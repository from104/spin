// 지우면 무엇이 새는가 — 법 문서 절 자르기는 **정규식**이고(계획서 결정 3: 프리렌더에 DOM 이
// 없다), 정규식으로 HTML 을 자르는 코드가 조용히 어긋나면 이용자는 그걸 눈으로 못 잡는다:
//   · 탐욕 매치가 되면 한국어 화면에 영어·일본어 절까지 따라 붙는다(스크롤 세 배).
//   · 절 이름을 못 찾으면 화면이 통째로 빈다 — "법 문서가 안 열린다".
//   · stripH1 이 안 먹으면 헤더 제목과 본문 제목이 두 번 선다.
// 그래서 단언은 "원문에 이 문장이 있다" 가 아니라 **경계**를 본다: 내 절은 들어오고 옆 절은
// 안 들어온다. (원문을 고칠 때 이 테스트가 빨개지는 것은 정상 — 원문 머리말의 계약을 깼는지
// 먼저 보라.)
import { describe, it, expect } from 'vitest';
import { LEGAL_DOCS, extractLegalSection, legalHtml, legalTitle } from './legalContent.ts';

/** 각 문서·로케일의 절이 자기라고 말하는 표식 = 그 절의 <h1>. 다른 절에는 없는 문자열이다. */
const TITLES = {
  privacy: { ko: 'SPIN 개인정보처리방침', en: 'SPIN Privacy Policy', ja: 'SPIN プライバシーポリシー' },
  terms: { ko: 'SPIN 서비스 약관', en: 'SPIN Terms of Service', ja: 'SPIN 利用規約' },
} as const;

describe('extractLegalSection — 언어 절 하나만', () => {
  for (const doc of LEGAL_DOCS) {
    for (const locale of ['ko', 'en', 'ja'] as const) {
      it(`${doc}/${locale} — 자기 절만 나오고 옆 절은 안 딸려 온다`, () => {
        const html = extractLegalSection(legalHtml(doc), locale);
        expect(html).not.toBeNull();
        expect(html).toContain(TITLES[doc][locale]);
        for (const other of ['ko', 'en', 'ja'] as const) {
          if (other === locale) continue;
          expect(html).not.toContain(TITLES[doc][other]);
        }
        // 절 태그 자체는 안 들어온다 — 안쪽만 심어야 <div class="legal-doc"> 아래에 section 이
        // 중첩되지 않는다.
        expect(html).not.toContain('</section>');
        expect(html).not.toContain(`<section id="${locale}"`);
      });
    }

    it(`${doc} — stripH1 이 제목을 지운다(헤더가 이미 보여 준다)`, () => {
      const kept = extractLegalSection(legalHtml(doc), 'ko');
      const stripped = extractLegalSection(legalHtml(doc), 'ko', { stripH1: true });
      expect(kept).toContain('<h1');
      expect(stripped).not.toContain('<h1');
      // 제목만 빠진다 — 본문(첫 소제목)은 그대로 있어야 한다.
      expect(stripped).toContain('<h2');
      expect(stripped!.length).toBeLessThan(kept!.length);
    });

    it(`${doc} — 없는 로케일은 null(빈 문자열이 아니다: 화면이 안내를 띄워야 한다)`, () => {
      expect(extractLegalSection(legalHtml(doc), 'de')).toBeNull();
      // 로케일이 정규식·속성 경계를 넘지 못한다: 둘 다 `[a-z]{2}` 검사가 없으면 **한국어 절이
      // 돌아온다**('k.' 은 정규식 와일드카드로, 뒤엣것은 속성을 이어 붙여 진짜 절에 들어맞는다).
      expect(extractLegalSection(legalHtml(doc), 'k.')).toBeNull();
      expect(extractLegalSection(legalHtml(doc), 'ko" lang="ko')).toBeNull();
    });
  }
});

describe('legalTitle', () => {
  // ⚠️ 돌연변이 확인 결과 남긴 메모: legalTitle 의 태그 벗기기(`<[^>]*>` 제거)는 **지금 원문으로는
  // 빨개지지 않는다** — 여섯 절의 <h1> 이 전부 태그 없는 한 줄이라서다. 그 줄은 "제목 안에
  // <span> 이 생기면 헤더에 태그 글자가 뜬다" 를 막는 방어지 이 테스트가 지키는 성질이 아니다.
  it('절의 <h1> 텍스트를 돌려준다', () => {
    for (const doc of LEGAL_DOCS) {
      for (const locale of ['ko', 'en', 'ja'] as const) {
        expect(legalTitle(doc, locale)).toBe(TITLES[doc][locale]);
      }
    }
  });

  it('없는 로케일은 null', () => {
    expect(legalTitle('privacy', 'de')).toBeNull();
  });
});
