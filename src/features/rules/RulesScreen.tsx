// 규칙 화면(2026-08-21 신설, docs/PLAN-RULES-SCREEN.md 정본) — §A/§B 구현.
//
// settings 와 같은 "app-shell 미의존" 화면이다: 헤더는 AppShell.useStaticHeaderConfig 가
// 정적으로 채우고, 이 컴포넌트는 nav prop 없이 스스로 완결된 <main> 을 그린다.
//
// 이번 커밋은 목록+텍스트 상세만 담는다 — 보드 애니메이션(PresentStage 조립)은 장면 데이터가
// 생기는 다음 커밋들(ruleScenes.ts)에서 이 파일을 다시 손댄다(계획 §C).
import { useState } from 'react';
import { RULE_GROUP_LABELS, RULE_GROUP_ORDER } from './ruleContent.ts';
import { ruleContentFor } from './ruleContent.ts';
import type { RuleLaw } from './ruleContent.ts';
import { useIsNarrow } from '../../ui/useIsNarrow.ts';
import { useLocale } from '../../i18n/useLocale.ts';

const LIST_WIDTH_PX = 320;

function RuleListRow({ law, active, onSelect }: { law: RuleLaw; active: boolean; onSelect: () => void }) {
  return (
    <li>
      <button
        type="button"
        aria-current={active ? 'true' : undefined}
        onClick={onSelect}
        style={{
          width: '100%',
          textAlign: 'left',
          padding: '10px 14px',
          borderRadius: 10,
          border: active ? '1.5px solid var(--accent)' : '1.5px solid transparent',
          background: active ? 'color-mix(in srgb, var(--accent) 16%, transparent)' : 'transparent',
          color: active ? 'var(--text)' : 'var(--muted)',
          fontSize: '0.875rem',
          fontWeight: active ? 600 : 500,
        }}
      >
        {law.title}
      </button>
    </li>
  );
}

function RuleDetail({ law, onBack }: { law: RuleLaw; onBack?: () => void }) {
  return (
    <div style={{ maxWidth: 640 }}>
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          style={{ marginBottom: 16, color: 'var(--muted)', fontSize: '0.8125rem', fontWeight: 600 }}
        >
          ← 목록으로
        </button>
      )}
      <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 16 }}>{law.title}</h2>
      <ul style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingLeft: '1.1em', listStyle: 'disc' }}>
        {law.summary.map((line, i) => (
          <li key={i} style={{ fontSize: '0.9375rem', lineHeight: 1.6, color: 'var(--text)' }}>
            {line}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RulesScreen() {
  const locale = useLocale();
  const narrow = useIsNarrow();
  const laws = ruleContentFor(locale);
  const [selectedLaw, setSelectedLaw] = useState(1);
  const [view, setView] = useState<'list' | 'detail'>('list');

  const current = laws.find((l) => l.law === selectedLaw) ?? laws[0];

  const select = (law: number) => {
    setSelectedLaw(law);
    if (narrow) setView('detail');
  };

  const showList = !narrow || view === 'list';
  const showDetail = !narrow || view === 'detail';

  return (
    <main id="main" tabIndex={-1} style={{ flex: 1, display: 'flex', overflow: 'hidden', outline: 'none', background: 'var(--bg)' }}>
      {showList && (
        <nav
          aria-label="규칙 조항 목록"
          style={{
            flex: narrow ? 1 : `0 0 ${LIST_WIDTH_PX}px`,
            overflowY: 'auto',
            borderRight: narrow ? 'none' : '1px solid var(--border)',
            padding: '18px 12px',
          }}
        >
          {RULE_GROUP_ORDER.map((group) => (
            <div key={group} style={{ marginBottom: 18 }}>
              <div
                style={{
                  padding: '0 14px 6px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  letterSpacing: '0.02em',
                  color: 'var(--faint-text)',
                }}
              >
                {RULE_GROUP_LABELS[group]}
              </div>
              <ul style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {laws
                  .filter((l) => l.group === group)
                  .map((law) => (
                    <RuleListRow key={law.law} law={law} active={law.law === selectedLaw} onSelect={() => select(law.law)} />
                  ))}
              </ul>
            </div>
          ))}
        </nav>
      )}
      {showDetail && current && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '26px 30px 46px' }}>
          <RuleDetail law={current} onBack={narrow ? () => setView('list') : undefined} />
        </div>
      )}
    </main>
  );
}
