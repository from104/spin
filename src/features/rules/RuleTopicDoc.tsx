// 주제 상세 — 전폭 문서(docs/PLAN-RULES-REDESIGN.md §3 "주제 상세"). 마스터-디테일을 폐기하고
// blocks 를 순서대로 렌더한다: 산문 → 도해 → 장면 → 표/카드 목록/부록.
//
// 활성 장면(sceneId)은 **이 문서 하나가** 단일 출처로 쥔다 — 장면 블록·표 블록이 전부 이 상태를
// 공유해야 "포스터+단일 활성"(계획 §3)이 주제 전체에서 성립한다(표에서 하나 고르고 아래에서
// 다른 장면을 재생 중이면, 표를 다시 보이게 해도 그 장면은 계속 재생 상태를 유지하되 이 문서
// 안 유일한 "재생 중"이어야 한다는 뜻).
//
// 호출부가 `key={topic.key}` 를 줘야 한다 — 주제를 바꿀 때 이 컴포넌트 전체가 다시 마운트되며
// activeSceneId 등 내부 상태가 저절로 초기화된다(RestartTableBlock 의 선택 열도 함께 리셋).
import { useState } from 'react';
import type { RuleBlock, RuleTopic, RuleTopicKey } from './ruleTopics.ts';
import { MISCONDUCT_CARDS } from './ruleTopics.ts';
import { RULE_GROUP_LABELS, RULE_GROUP_ORDER, ruleContentFor } from './ruleContent.ts';
import { RuleFigure } from './RuleFigure.tsx';
import { RuleSceneBlock } from './RuleSceneBlock.tsx';
import { RestartTableBlock } from './RestartTableBlock.tsx';
import type { RuleSceneId } from './ruleScenes.ts';
import { Card } from '../../ui/Card.tsx';
import { Badge } from '../../ui/Badge.tsx';
import { useT } from '../../i18n/useT.ts';
import { useLocale } from '../../i18n/useLocale.ts';

function ProseBlock({ heading, body }: { heading?: string; body: readonly string[] }) {
  return (
    <div style={{ marginTop: 20, maxWidth: 760 }}>
      {heading && <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, marginBottom: 8 }}>{heading}</h3>}
      {body.map((p, i) => (
        <p key={i} style={{ fontSize: '0.9375rem', lineHeight: 1.65, color: 'var(--text)', textWrap: 'pretty', marginTop: i === 0 ? 0 : 10 }}>
          {p}
        </p>
      ))}
    </div>
  );
}

function MisconductCardList() {
  const cautions = MISCONDUCT_CARDS.filter((c) => c.kind === 'caution');
  const sendingOffs = MISCONDUCT_CARDS.filter((c) => c.kind === 'sendingOff');
  return (
    <div style={{ marginTop: 20, maxWidth: 760, display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div>
        <Badge tone="warning">경고(옐로카드) {cautions.length}종</Badge>
        <ul style={{ marginTop: 10, paddingLeft: '1.1em', listStyle: 'disc', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {cautions.map((c, i) => (
            <li key={i} style={{ fontSize: '0.875rem', lineHeight: 1.5, color: 'var(--text)' }}>
              {c.text}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <Badge tone="danger">퇴장(레드카드) {sendingOffs.length}종</Badge>
        <ul style={{ marginTop: 10, paddingLeft: '1.1em', listStyle: 'disc', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {sendingOffs.map((c, i) => (
            <li key={i} style={{ fontSize: '0.875rem', lineHeight: 1.5, color: 'var(--text)' }}>
              {c.text}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** 부록(공식 룰 북) — 18개조를 그룹별로 나눠 압축 요약한다. 그룹 자체(RuleLawGroup)는
 *  2026-08-21 사전식 화면 시절의 목록 그룹핑을 그대로 물려받은 것 — 주제별 재설계 후에도
 *  "번호로 훑어보는 참조표"에는 여전히 유용해서 여기로 옮겨 왔다(다른 소비처가 없어 유령
 *  export 가 될 뻔한 것을 여기서 되살렸다). */
function LawIndexBlock() {
  const locale = useLocale();
  const laws = ruleContentFor(locale);
  return (
    <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 24 }}>
      {RULE_GROUP_ORDER.map((group) => (
        <div key={group}>
          <h3 style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.02em', color: 'var(--faint-text)', marginBottom: 10 }}>
            {RULE_GROUP_LABELS[group]}
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {laws
              .filter((law) => law.group === group)
              .map((law) => (
                <div key={law.law} style={{ paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: 4 }}>{law.title}</div>
                  <p style={{ fontSize: '0.8125rem', lineHeight: 1.55, color: 'var(--muted)', textWrap: 'pretty' }}>{law.summary.join(' ')}</p>
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function renderBlock(block: RuleBlock, index: number, activeSceneId: RuleSceneId | null, onActivate: (id: RuleSceneId) => void) {
  switch (block.kind) {
    case 'prose':
      return <ProseBlock key={index} heading={block.heading} body={block.body} />;
    case 'figure':
      return (
        <div key={index} style={{ marginTop: 16 }}>
          <RuleFigure id={block.figureId} />
        </div>
      );
    case 'scene':
      return (
        <RuleSceneBlock key={block.sceneId} sceneId={block.sceneId} active={activeSceneId === block.sceneId} onActivate={() => onActivate(block.sceneId)} />
      );
    case 'restart-table':
      return <RestartTableBlock key={index} activeSceneId={activeSceneId} onActivateScene={onActivate} />;
    case 'card-list':
      return <MisconductCardList key={index} />;
    case 'law-index':
      return <LawIndexBlock key={index} />;
    default:
      return null;
  }
}

export interface RuleTopicDocProps {
  topic: RuleTopic;
  prevTopic: RuleTopic | null;
  nextTopic: RuleTopic | null;
  onBack: () => void;
  onSelectTopic: (key: RuleTopicKey) => void;
}

export function RuleTopicDoc({ topic, prevTopic, nextTopic, onBack, onSelectTopic }: RuleTopicDocProps) {
  const t = useT();
  const [activeSceneId, setActiveSceneId] = useState<RuleSceneId | null>(null);

  return (
    <div className="rules-doc-in" style={{ maxWidth: 760, margin: '0 auto' }}>
      <button
        type="button"
        onClick={onBack}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          minHeight: 44,
          marginLeft: -10,
          padding: '0 10px',
          color: 'var(--muted)',
          fontSize: '0.8125rem',
          fontWeight: 600,
        }}
      >
        ← {t('rules.backToHome')}
      </button>
      <h2 style={{ fontSize: '1.375rem', fontWeight: 700, marginTop: 8, textWrap: 'balance' }}>{topic.title}</h2>
      <p style={{ fontSize: '0.875rem', color: 'var(--muted)', marginTop: 4 }}>{topic.tagline}</p>

      {topic.blocks.map((block, i) => renderBlock(block, i, activeSceneId, setActiveSceneId))}

      {(prevTopic || nextTopic) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 40 }}>
          <div style={{ flex: 1 }}>
            {prevTopic && (
              <Card as="button" interactive onClick={() => onSelectTopic(prevTopic.key)} style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--faint-text)', letterSpacing: '0.03em' }}>
                  ← {t('rules.prevTopic')}
                </div>
                <div style={{ fontSize: '0.9375rem', fontWeight: 700, marginTop: 4 }}>{prevTopic.title}</div>
              </Card>
            )}
          </div>
          <div style={{ flex: 1 }}>
            {nextTopic && (
              <Card as="button" interactive onClick={() => onSelectTopic(nextTopic.key)} style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--faint-text)', letterSpacing: '0.03em' }}>
                  {t('rules.nextTopic')} →
                </div>
                <div style={{ fontSize: '0.9375rem', fontWeight: 700, marginTop: 4 }}>{nextTopic.title}</div>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
