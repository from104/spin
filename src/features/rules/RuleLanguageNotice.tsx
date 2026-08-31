// 규칙 콘텐츠가 없는 로케일에 뜨는 안내 — 기현님 지적(2026-08-31, *"규칙은 i18n가 안 되어있네?"*).
//
// 이 앱의 UI 사전은 ko/en/ja 셋이 다 채워져 있는데(각 860여 키) **규칙 콘텐츠만 ko 전용**이다
// (2026-08-21 결정, `ruleTopics.ts` 의 `RULE_CONTENT_LOCALES`). 그 비대칭이 `DEFAULT_LOCALE = 'en'`
// 과 겹치면 증상이 나온다 — 브라우저 언어가 ko/ja 가 아니면 영어로 떨어지는데, 그때 규칙 화면은
// **버튼만 영어이고 내용은 전부 한국어**가 된다. 읽는 사람은 이유를 알 길이 없어 고장으로 읽는다.
//
// 이 안내가 하는 일은 그 상태를 **의도된 것으로 만드는 것**이다: 왜 한국어인지 말하고,
// 그 사람에게 실제로 쓸모 있는 것(FIPFA 영어 원문)을 가리킨다.
//
// ⚠️ **번역해서 채우지 않은 이유**(다음에 이 파일을 보는 사람이 가장 먼저 물을 것):
//  ① 정본 `docs/RULES-FIPFA-2025.md` 자체가 **영어 원문의 한국어 요약본**이다. 영어로 옮기면
//     영어→한국어→영어 되번역이 되고, 그 결과물은 FIPFA 가 이미 영어로 펴낸 원문보다 나쁘다.
//  ② 규칙은 오역이 곧 잘못된 규칙이다. 이 저장소가 문장마다 정본 대조를 강제하는 이유가 그것이고
//     (그 대조로 2026-08-31 에 사실 오류 7건이 잡혔다), 그 안전망 없이 350문장을 두 언어로
//     내보내는 것은 같은 규율을 스스로 깨는 일이다.
// 전면 번역의 선행 조건은 `docs/PLAN-RULES-9CARDS.md` §9 에 적었다.
//
// ⚠️ URL 을 `<a>` 가 아니라 **평문**으로 둔다 — 카드 9([공식 룰 북])가 같은 주소를 평문으로 두는
// 것과 같은 이유다(PLAN-RULES-9CARDS §7 기본값 3: Tauri 데스크톱의 외부 링크 처리가 미검증이라
// 검증 못 한 코드를 배송하지 않는다). 선택·복사는 된다.
import { useT } from '../../i18n/useT.ts';
import { useLocale } from '../../i18n/useLocale.ts';
import { hasRuleContentFor } from './ruleTopics.ts';

/** 카드 9 의 산문과 **같은 주소**다. 두 곳이 갈리면 한쪽이 죽은 링크가 되므로 여기서 단일 출처로
 *  두고, `RuleLanguageNotice.test.tsx` 가 정본 문서의 주소와 대조한다. */
export const FIPFA_LAWS_PDF_URL = 'https://fipfa.org/wp-content/uploads/2025/06/FIPFA-Laws-of-the-Game-2025.pdf';

export function RuleLanguageNotice() {
  const t = useT();
  // 두 모드다. 콘텐츠 자체가 없으면(ja) 전체 안내, 콘텐츠는 있는데 장면 자막만 한국어면(en)
  // 그 한 줄만. 후자에 전체 안내를 띄우면 "여기 다 한국어" 라는 거짓말이 된다.
  const sceneOnly = hasRuleContentFor(useLocale());
  if (sceneOnly) {
    return (
      <aside data-testid="rule-language-notice" style={{ maxWidth: 760, margin: '0 auto 4px', padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 10 }}>
        <p style={{ fontSize: '0.8125rem', lineHeight: 1.6, color: 'var(--muted)', textWrap: 'pretty' }}>{t('rules.langNotice.scenesOnly')}</p>
      </aside>
    );
  }
  return (
    <aside
      data-testid="rule-language-notice"
      style={{
        maxWidth: 760,
        margin: '0 auto 4px',
        padding: '14px 16px',
        border: '1px solid var(--border-strong)',
        borderRadius: 10,
        background: 'var(--panel)',
      }}
    >
      <p style={{ fontSize: '0.9375rem', fontWeight: 700, lineHeight: 1.4 }}>{t('rules.langNotice.title')}</p>
      <p style={{ fontSize: '0.875rem', lineHeight: 1.6, color: 'var(--muted)', marginTop: 6, textWrap: 'pretty' }}>
        {t('rules.langNotice.body')}
      </p>
      <p style={{ fontSize: '0.8125rem', lineHeight: 1.6, color: 'var(--muted)', marginTop: 8 }}>
        {t('rules.langNotice.original')}{' '}
        {/* `overflowWrap` 이 없으면 긴 URL 이 좁은 창에서 가로 스크롤을 만든다(WCAG 1.4.10). */}
        <span style={{ color: 'var(--text)', overflowWrap: 'anywhere' }}>{FIPFA_LAWS_PDF_URL}</span>
      </p>
    </aside>
  );
}
