// 개인정보처리방침·서비스 약관 링크 (2026-09-06 기현 지시: 링크 자리는 "[설정] 동기화 절의 [연결]
// 아래" 와 "[데이터] 절 끝" 둘 — 헤더에는 두지 않는다. 법적 문서는 매 화면에 있을 이유가 없고,
// 이용자가 "내 데이터가 어디로 가나"를 묻는 순간에만 있으면 된다).
//
// 🪦 새 탭·데스크톱 opener 분기(2026-09-06 이전): 문서가 `public/` 의 정적 페이지라 앱을 떠나야
// 했고, 새 탭이 없는 데스크톱 웹뷰만 기본 브라우저로 열었다. 이제 문서는 앱 안 화면이라
// (`/settings/privacy`, 계획서 결정 1·7) 여는 일은 그냥 화면 전환이다 — 웹도 데스크톱도 같다.
//
// 그래서 `<a href>` 가 아니라 **링크 모양 버튼**이다: 주소는 app-shell 의 라우터가 짓고
// (`routes.ts` 의 pathFor), 이 컴포넌트는 화면 키도 주소 규칙도 몰라야 한다(§8 의존 방향).
import type { LegalDoc } from './legalContent.ts';
import { useT } from '../../i18n/useT.ts';

/** "개인정보처리방침 · 서비스 약관" 한 줄. `only` 를 주면 그 하나만. */
export function LegalLinks({ only, prefix, onOpen }: { only?: LegalDoc; prefix?: string; onOpen: (doc: LegalDoc) => void }) {
  const t = useT();
  const docs: readonly LegalDoc[] = only ? [only] : ['privacy', 'terms'];
  return (
    <p style={{ fontSize: '0.78125rem', color: 'var(--faint-text)', margin: '10px 0 0', lineHeight: 1.6 }}>
      {prefix && <>{prefix} </>}
      {docs.map((doc, i) => (
        <span key={doc}>
          {i > 0 && ' · '}
          <button
            type="button"
            onClick={() => onOpen(doc)}
            style={{
              background: 'none',
              border: 0,
              padding: 0,
              font: 'inherit',
              color: 'var(--accent-text)',
              textDecoration: 'underline',
              cursor: 'pointer',
            }}
          >
            {t(doc === 'privacy' ? 'settings.legal.privacy' : 'settings.legal.terms')}
          </button>
        </span>
      ))}
    </p>
  );
}
