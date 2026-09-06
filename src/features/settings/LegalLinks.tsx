// 개인정보처리방침·서비스 약관 링크 (2026-09-06 기현 지시: 링크 자리는 "[설정] 동기화 절의 [연결]
// 아래" 와 "[데이터] 절 끝" 둘 — 헤더에는 두지 않는다. 법적 문서는 매 화면에 있을 이유가 없고,
// 이용자가 "내 데이터가 어디로 가나"를 묻는 순간에만 있으면 된다).
//
// 문서 자체는 앱 밖의 정적 페이지다(`public/privacy/index.html`·`public/terms/index.html`, 한 파일에
// 세 언어 절 #ko #en #ja). 라우터를 안 거치는 이유: 구글 동의 화면·검색엔진이 앱 없이 열 수 있어야
// 하고, 데스크톱 빌드에는 프리렌더가 없어 앱 안 경로로는 못 만든다.
//
// ⚠️ 데스크톱(Tauri 웹뷰)에서는 새 탭이 없다 — `target="_blank"` 는 조용히 아무 일도 안 한다.
// 그래서 데스크톱은 opener 플러그인으로 기본 브라우저에 연다(authDesktop.ts 의 로그인과 같은 길).
// 허용 목록은 `src-tauri/capabilities/default.json` 의 `opener:allow-open-url` — 호스트를 바꾸면 거기도.
import type { MouseEvent } from 'react';
import { useT } from '../../i18n/useT.ts';
import { useLocale } from '../../i18n/useLocale.ts';
import type { Locale } from '../../i18n/locale.ts';
import { isDesktop } from '../../sync/authDesktop.ts';
import { legalUrl } from './legalUrl.ts';
import type { LegalDoc } from './legalUrl.ts';

async function openExternal(url: string): Promise<void> {
  const { openUrl } = await import('@tauri-apps/plugin-opener');
  await openUrl(url);
}

function LegalAnchor({ doc, locale, label }: { doc: LegalDoc; locale: Locale; label: string }) {
  const href = legalUrl(doc, locale);
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (!isDesktop()) return; // 웹: 브라우저가 새 탭으로 연다
    e.preventDefault();
    void openExternal(href);
  };
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" onClick={onClick} style={{ color: 'var(--link, #6cf)' }}>
      {label}
    </a>
  );
}

/** "개인정보처리방침 · 서비스 약관" 한 줄. `only` 를 주면 그 하나만. */
export function LegalLinks({ only, prefix }: { only?: LegalDoc; prefix?: string }) {
  const t = useT();
  const locale = useLocale();
  const docs: readonly LegalDoc[] = only ? [only] : ['privacy', 'terms'];
  return (
    <p style={{ fontSize: '0.78125rem', color: 'var(--faint-text)', margin: '10px 0 0', lineHeight: 1.6 }}>
      {prefix && <>{prefix} </>}
      {docs.map((doc, i) => (
        <span key={doc}>
          {i > 0 && ' · '}
          <LegalAnchor doc={doc} locale={locale} label={t(doc === 'privacy' ? 'settings.legal.privacy' : 'settings.legal.terms')} />
        </span>
      ))}
    </p>
  );
}
