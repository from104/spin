// 개인정보처리방침·서비스 약관 링크 (2026-09-06 기현 지시: 링크 자리는 "[설정] 동기화 절의 [연결]
// 아래" 와 "[데이터] 절 끝" 둘 — 헤더에는 두지 않는다. 법적 문서는 매 화면에 있을 이유가 없고,
// 이용자가 "내 데이터가 어디로 가나"를 묻는 순간에만 있으면 된다).
//
// 같은 출처의 상대 링크를 새 탭으로 연다(주소 규칙은 legalUrl.ts). ⚠️ 데스크톱(Tauri 웹뷰)에는
// 새 탭이 없어 `target="_blank"` 가 조용히 죽고, 같은 창에서 열면 앱을 떠나 돌아올 길이 없다 —
// 그래서 데스크톱만 opener 플러그인으로 기본 브라우저에 운영 주소를 연다(허용 목록은
// `src-tauri/capabilities/default.json`). 데스크톱은 배포된 뒤에 쓰는 물건이라 죽은 링크 걱정이 없다.
import type { MouseEvent } from 'react';
import { useT } from '../../i18n/useT.ts';
import { useLocale } from '../../i18n/useLocale.ts';
import { isDesktop } from '../../sync/authDesktop.ts';
import { legalPage } from './legalUrl.ts';
import type { LegalDoc } from './legalUrl.ts';

const SITE = 'https://spin.atit.app';

async function openInBrowser(url: string): Promise<void> {
  const { openUrl } = await import('@tauri-apps/plugin-opener');
  await openUrl(url);
}

/** "개인정보처리방침 · 서비스 약관" 한 줄. `only` 를 주면 그 하나만. */
export function LegalLinks({ only, prefix }: { only?: LegalDoc; prefix?: string }) {
  const t = useT();
  const locale = useLocale();
  const docs: readonly LegalDoc[] = only ? [only] : ['privacy', 'terms'];
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (!isDesktop()) return;
    e.preventDefault();
    void openInBrowser(SITE + e.currentTarget.getAttribute('href'));
  };
  return (
    <p style={{ fontSize: '0.78125rem', color: 'var(--faint-text)', margin: '10px 0 0', lineHeight: 1.6 }}>
      {prefix && <>{prefix} </>}
      {docs.map((doc, i) => (
        <span key={doc}>
          {i > 0 && ' · '}
          <a href={legalPage(doc, locale)} target="_blank" rel="noopener noreferrer" onClick={onClick} style={{ color: 'var(--link, #6cf)' }}>
            {t(doc === 'privacy' ? 'settings.legal.privacy' : 'settings.legal.terms')}
          </a>
        </span>
      ))}
    </p>
  );
}
