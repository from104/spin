// 개인정보처리방침·서비스 약관을 **앱 안에서** 보여 주는 화면 조각(계획서 결정 1·2).
// 2026-09-06 이전에는 새 탭으로 정적 페이지를 열었다 — 데스크톱 웹뷰에는 새 탭이 없고,
// 웹에서도 앱을 떠나면 돌아올 길이 헤더가 아니라 브라우저 back 뿐이었다.
//
// 원문 절은 우리가 쓴 정적 HTML 이라 `dangerouslySetInnerHTML` 로 그대로 심는다(이용자 입력이
// 아니다 — legalContent.ts 머리말). 그 대가로 **안쪽 요소에는 React 가 없다**:
//   · 타이포그래피는 인라인 스타일을 못 받아 `.legal-doc` 클래스가 진다(appShell.css, 결정 6).
//   · 링크는 이벤트 위임 하나로 다룬다. 문서 안 `/privacy/`·`/terms/` 는 앱 화면 전환으로,
//     `#…` 은 이 문서 맨 위로(정적 페이지의 "↑ 맨 위로"가 앱에서는 라우팅을 흔들면 안 된다),
//     나머지 http(s) 는 새 탭으로 — target/rel 은 마운트 때 심어 가운데 클릭도 같이 산다.
// 하면 안 되는 것: 위·아래에 [← 설정으로] 를 넣지 말 것. 되돌아가기는 앱 헤더의 leading 슬롯
// 하나가 진다(결정 2) — 문서 안에 또 두면 같은 일을 하는 버튼이 세 개가 된다.
import { useEffect, useRef } from 'react';
import type { MouseEvent } from 'react';
import { extractLegalSection, legalHtml, legalTitle } from './legalContent.ts';
import type { LegalDoc } from './legalContent.ts';
import { useLocale } from '../../i18n/useLocale.ts';
import { useT } from '../../i18n/useT.ts';

function docFromHref(href: string): LegalDoc | null {
  const path = href.replace(/^https?:\/\/[^/]*/i, '').split(/[?#]/)[0];
  if (/^\/privacy\/?(index\.html)?$/i.test(path)) return 'privacy';
  if (/^\/terms\/?(index\.html)?$/i.test(path)) return 'terms';
  return null;
}

export function LegalDocView({ doc, onSwitch }: { doc: LegalDoc; onSwitch: (doc: LegalDoc) => void }) {
  const locale = useLocale();
  const t = useT();
  const rootRef = useRef<HTMLDivElement>(null);
  const html = extractLegalSection(legalHtml(doc), locale, { stripH1: true });

  // 문서를 열거나 언어를 바꾸면 스크롤을 맨 위로 — 내용이 통째로 갈리는데 스크롤이 앞 문서
  // 자리에 남는다. 포커스는 여기서 옮기지 **않는다**: AppShell 의 발표 이펙트가 `legalDoc` 을
  // 의존성에 두고 있어(announce.ts 6번째 인자) 문서 전환마다 `#main` 을 포커스하고 문서 이름을
  // 읽는다. 2026-09-06 헤드리스 실측에서 여기서 h2 를 포커스해도 그 이펙트가 뒤에 돌아 늘
  // main 이 이겼다 — 두 번 옮기면 코드만 남고 효과는 없다(RuleTopicDoc.tsx 는 `ruleTopic` 이
  // 그 의존성에 없어서 스스로 옮기는 것이고, 여기와 사정이 다르다).
  useEffect(() => {
    const scroller = rootRef.current?.closest('main');
    if (scroller) scroller.scrollTop = 0;
  }, [doc, locale]);

  // 바깥 링크는 새 탭으로. 원문 문자열에 target 을 박아 두면 정적 페이지에서도 새 탭이 되므로
  // (그쪽은 그럴 이유가 없다) 앱에서만 런타임에 심는다.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    for (const a of root.querySelectorAll<HTMLAnchorElement>('a[href]')) {
      const href = a.getAttribute('href') ?? '';
      if (!/^https?:/i.test(href) || docFromHref(href)) continue;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
    }
  }, [doc, locale, html]);

  if (html === null) {
    return (
      <div className="legal-doc" lang={locale}>
        <p>{t('settings.legal.loadError')}</p>
      </div>
    );
  }

  const onClick = (e: MouseEvent<HTMLDivElement>) => {
    const a = (e.target as HTMLElement | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
    if (!a) return;
    const href = a.getAttribute('href') ?? '';
    const target = docFromHref(href);
    if (target) {
      e.preventDefault();
      onSwitch(target);
      return;
    }
    if (href.startsWith('#')) {
      // 정적 페이지의 "↑ 맨 위로"·언어 앵커. 앱에서는 주소를 흔들지 않고 이 문서 위로만 올린다.
      e.preventDefault();
      const scroller = rootRef.current?.closest('main');
      if (scroller) scroller.scrollTop = 0;
    }
  };

  return (
    <div ref={rootRef} className="legal-doc" lang={locale} onClick={onClick}>
      {/* 헤더 제목은 span 이라 문서 구조(heading)는 여기가 진다 — 원문 <h1> 은 지우고 왔다. */}
      <h2 className="sr-only">
        {legalTitle(doc, locale) ?? ''}
      </h2>
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
