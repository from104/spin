// 규칙 화면 카드 홈 — docs/PLAN-RULES-REDESIGN.md §3 "카드 홈(/rules)".
//
// 18개조 사전 목록을 대체하는 최상위 탐색. 카드에 번호를 안 붙인다(설치된 frontend-design
// 스킬 지침: 8주제는 순서가 아니라 분류다) — 순서는 그리드 배열로만 말한다.
//
// 메타 배지(장면·도해 개수)는 `RuleTopic.blocks` 에서 **파생**한다 — 손으로 "장면 5" 를 적으면
// 장면을 추가할 때마다 카드와 실제 콘텐츠가 따로 논다.
import type { ComponentType } from 'react';
import type { RuleTopic, RuleTopicKey } from './ruleTopics.ts';
import { Card } from '../../ui/Card.tsx';
import { Pill } from '../../ui/Pill.tsx';
import { IconBoard, IconClear, IconGoalReset, IconListSteps, IconRules, IconSides, IconToolBall, IconToolPlayer } from '../../ui/icons.tsx';
import type { IconProps } from '../../ui/icons.tsx';

const TOPIC_ICONS: Record<RuleTopicKey, ComponentType<IconProps>> = {
  basics: IconBoard,
  restarts: IconListSteps,
  'out-of-play': IconSides,
  'goal-area': IconGoalReset,
  'two-on-one': IconToolPlayer,
  fouls: IconClear,
  contested: IconToolBall,
  rulebook: IconRules,
};

function topicMeta(topic: RuleTopic): string[] {
  const figures = topic.blocks.filter((b) => b.kind === 'figure').length;
  const scenes = topic.blocks.filter((b) => b.kind === 'scene').length;
  const badges: string[] = [];
  if (figures > 0) badges.push(`도해 ${figures}`);
  if (scenes > 0) badges.push(`장면 ${scenes}`);
  if (topic.blocks.some((b) => b.kind === 'restart-table')) badges.push('비교표');
  if (topic.blocks.some((b) => b.kind === 'card-list')) badges.push('카드 목록');
  if (topic.blocks.some((b) => b.kind === 'law-index')) badges.push('18개조 부록');
  return badges;
}

export interface RulesHomeProps {
  topics: readonly RuleTopic[];
  onOpen: (key: RuleTopicKey) => void;
}

export function RulesHome({ topics, onOpen }: RulesHomeProps) {
  return (
    <div
      data-tut="rules-home"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
        gap: 14,
        maxWidth: 1180,
        margin: '0 auto',
        padding: '26px 30px 46px',
      }}
    >
      {topics.map((topic, i) => {
        const Icon = TOPIC_ICONS[topic.key];
        return (
          <Card
            key={topic.key}
            as="button"
            interactive
            onClick={() => onOpen(topic.key)}
            aria-label={topic.title}
            data-tut={i === 0 ? 'rules-card' : topic.key === 'rulebook' ? 'rules-appendix' : undefined}
            className="rules-card-in"
            style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 128, animationDelay: `${i * 40}ms` }}
          >
            <span style={{ color: 'var(--accent-text)' }}>
              <Icon size={22} aria-hidden />
            </span>
            <div>
              <div style={{ fontSize: '1rem', fontWeight: 700, textWrap: 'balance' }}>{topic.title}</div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--muted)', marginTop: 2 }}>{topic.tagline}</div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 'auto' }}>
              {topicMeta(topic).map((label) => (
                <Pill key={label} tone="neutral">
                  {label}
                </Pill>
              ))}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
