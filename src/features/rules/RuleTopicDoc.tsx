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
import { useEffect, useRef, useState } from 'react';
import type { RuleBlock, RuleTopic, RuleTopicKey } from './ruleTopics.ts';
import { misconductCardsFor } from './ruleTopics.ts';
import { RULE_GROUP_ORDER, ruleContentFor, ruleGroupLabelsFor } from './ruleContent.ts';
import { RuleFigure } from './RuleFigure.tsx';
import { RuleSceneBlock } from './RuleSceneBlock.tsx';
import { RestartTableBlock } from './RestartTableBlock.tsx';
import type { RuleSceneId } from './ruleScenes.ts';
import { Card } from '../../ui/Card.tsx';
import { Badge } from '../../ui/Badge.tsx';
import { useT } from '../../i18n/useT.ts';
import { useLocale } from '../../i18n/useLocale.ts';

/** 소제목은 **본문과 확실히 달라야 한다**(기현 지시 2026-08-31). 2026-08-31 이전에는 굵기만
 *  달랐다 — `fontSize` 가 본문과 똑같은 `0.9375rem` 이라, 카드 하나에 소제목이 6개까지 늘어난
 *  뒤로는 훑어서 원하는 절을 찾을 수가 없었다. 셋을 함께 준다:
 *   ① 크기 — 본문 15px 대 소제목 17px. 굵기 하나로는 스캔이 안 된다.
 *   ② 밑줄 하나 — 색이 아니라 **선**으로 가른다. 색만 쓰면 `forced-colors`(고대비 모드)에서
 *      치환돼 구분이 사라지지만 border 는 살아남는다(`contrast.css` 가 그 모드를 다룬다).
 *   ③ 위 여백 — 소제목이 있는 블록은 앞 블록에서 더 멀리 떨어뜨린다(20 → 32). 여백이
 *      "여기서 절이 바뀐다" 를 가장 먼저 말해 준다.
 *  ⚠️ 부록의 그룹 라벨(`LawIndexBlock`)은 같은 h3 이지만 **역할이 다르다**(작고 흐린 눈썹형
 *  라벨) — 여기와 통일하지 말 것. */
function ProseBlock({ heading, body }: { heading?: string; body: readonly string[] }) {
  return (
    <div style={{ marginTop: heading ? 32 : 20, maxWidth: 760 }}>
      {heading && (
        <h3
          style={{
            fontSize: '1.0625rem',
            fontWeight: 700,
            lineHeight: 1.35,
            marginBottom: 12,
            paddingBottom: 7,
            borderBottom: '1px solid var(--border-strong)',
            textWrap: 'balance',
          }}
        >
          {heading}
        </h3>
      )}
      {body.map((p, i) => (
        <p key={i} style={{ fontSize: '0.9375rem', lineHeight: 1.65, color: 'var(--text)', textWrap: 'pretty', marginTop: i === 0 ? 0 : 10 }}>
          {p}
        </p>
      ))}
    </div>
  );
}

function MisconductCardList() {
  const t = useT();
  const cards = misconductCardsFor(useLocale());
  const cautions = cards.filter((c) => c.kind === 'caution');
  const sendingOffs = cards.filter((c) => c.kind === 'sendingOff');
  return (
    <div style={{ marginTop: 20, maxWidth: 760, display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div>
        <Badge tone="warning">{t('rules.cards.cautions', { n: cautions.length })}</Badge>
        <ul style={{ marginTop: 10, paddingLeft: '1.1em', listStyle: 'disc', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {cautions.map((c, i) => (
            <li key={i} style={{ fontSize: '0.875rem', lineHeight: 1.5, color: 'var(--text)' }}>
              {c.text}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <Badge tone="danger">{t('rules.cards.sendingOffs', { n: sendingOffs.length })}</Badge>
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
  const groupLabels = ruleGroupLabelsFor(locale);
  return (
    <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 24 }}>
      {RULE_GROUP_ORDER.map((group) => (
        <div key={group}>
          <h3 style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.02em', color: 'var(--faint-text)', marginBottom: 10 }}>
            {groupLabels[group]}
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

/** 블록 하나를 그린다.
 *
 *  key 에 `topicKey` 와 `block.kind` 를 섞는 이유 — 지금 이 순간에는 **인덱스 키만 써도 무해하다**:
 *  호출부(RulesScreen.tsx)가 `key={current.key}` 로 이 문서를 주제마다 통째로 리마운트시켜서,
 *  "인덱스는 같은데 블록 종류가 다른 다음 주제" 가 앞 주제 블록의 상태를 승계할 경로 자체가 없다.
 *  그래도 바꾼다: 그 방어는 **호출부 사정**이고, 이 컴포넌트가 남의 리마운트에 기대고 있으면
 *  호출부가 언젠가 key 를 떼는 순간(예: 주제 전환 애니메이션을 위해 인스턴스를 유지하는 개편)
 *  조용히 상태가 새는 버그로 돌아온다. 자기 key 는 자기가 책임진다. */
function renderBlock(block: RuleBlock, index: number, topicKey: RuleTopicKey, activeSceneId: RuleSceneId | null, onActivate: (id: RuleSceneId) => void) {
  const key = `${topicKey}-${index}-${block.kind}`;
  switch (block.kind) {
    case 'prose':
      return <ProseBlock key={key} heading={block.heading} body={block.body} />;
    case 'figure':
      return (
        <div key={key} style={{ marginTop: 16 }}>
          <RuleFigure id={block.figureId} />
        </div>
      );
    case 'scene':
      // 장면만 sceneId 를 key 로 쓴다 — 같은 장면이 위치를 옮겨도 재생 상태를 이어가야 한다.
      return (
        <RuleSceneBlock key={block.sceneId} sceneId={block.sceneId} active={activeSceneId === block.sceneId} onActivate={() => onActivate(block.sceneId)} />
      );
    case 'restart-table':
      return <RestartTableBlock key={key} activeSceneId={activeSceneId} onActivateScene={onActivate} />;
    case 'card-list':
      return <MisconductCardList key={key} />;
    case 'law-index':
      return <LawIndexBlock key={key} />;
    case 'scene-slot':
      // 일부러 아무것도 안 그린다 — "준비 중"·"coming soon" 자리표시자를 사용자에게 배송하지
      // 않는 것이 요점이다(계획 §5.2). 자리는 화면이 아니라 blocks 배열의 인덱스와 `note`
      // 메모로 지킨다: 장면이 들어오면 이 블록을 kind:'scene' 으로 바꾸기만 하면 된다.
      // (`note` 는 소스에만 사는 필드다 — 이 case 가 아무것도 안 읽는 것이 정상이다.)
      return null;
    default: {
      // exhaustive 검사 — 예전의 `default: return null` 은 유니온에 kind 를 더하고 case 를
      // 빠뜨렸을 때 **조용히 안 그려졌다**. scene-slot 이 그 구멍을 막으면서 들어오는 첫 kind다.
      const _exhaustive: never = block;
      return _exhaustive;
    }
  }
}

export interface RuleTopicDocProps {
  topic: RuleTopic;
  prevTopic: RuleTopic | null;
  nextTopic: RuleTopic | null;
  onSelectTopic: (key: RuleTopicKey) => void;
}

export function RuleTopicDoc({ topic, prevTopic, nextTopic, onSelectTopic }: RuleTopicDocProps) {
  const t = useT();
  const [activeSceneId, setActiveSceneId] = useState<RuleSceneId | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // 주제가 열릴 때마다 제목으로 포커스를 옮기고 스크롤을 맨 위로 되돌린다(9CARDS §8-6b).
  //
  // AppShell 의 §7.6 포커스 이펙트는 여기서 **안 돈다** — 그 이펙트의 의존성은 화면 키와 무대
  // 대상뿐이고(AppShell.tsx), 주제 전환은 `/rules/<topic>` 안에서만 움직여 셋 다 그대로다.
  // 그래서 문서 맨 아래 [다음 주제] 를 누르면 새 주제가 **바닥에 스크롤된 채** 뜨고, 포커스는
  // 방금 사라진 카드 버튼에 남아 아무 데도 없는 상태가 된다. 카드가 8→9로 늘어 이 경로를
  // 밟는 횟수가 늘었다.
  //
  // 스크롤 대상은 window 가 아니라 상위 <main> 이다: appShell.css 가 `html, body, #root` 를
  // overflow:hidden 으로 못박아 페이지 자체는 절대 스크롤하지 않고, 이 화면의 스크롤은
  // RulesScreen.tsx 의 `<main id="main" style={{ overflowY:'auto' }}>` 이 혼자 진다.
  // id 대신 closest('main') 으로 찾는다 — 이 문서가 어느 화면에 얹히든 자기를 담은 스크롤
  // 컨테이너를 따라간다.
  //
  // 포커스 링: outline:none 을 걸지 않고 a11y.css 의 전역 `:focus-visible` 에 맡긴다. 프로그램
  // 포커스는 직전 입력이 키보드였을 때만 :focus-visible 에 걸리므로, 마우스로 카드를 누른
  // 사용자에게는 링이 안 뜨고 Enter 로 넘어온 키보드 사용자에게는 뜬다 — 원하는 그대로다.
  useEffect(() => {
    const h2 = headingRef.current;
    if (!h2) return;
    // preventScroll — 브라우저가 알아서 맞추는 위치가 아니라 "맨 위"를 우리가 정한다
    // (h2 는 sr-only 라 스크롤 기준이 될 수 없다 — 문서 첫 블록이 맨 위에 와야 한다).
    h2.focus({ preventScroll: true });
    const scroller = h2.closest('main');
    if (scroller) scroller.scrollTop = 0;
  }, [topic.key]);

  return (
    <div className="rules-doc-in" style={{ maxWidth: 760, margin: '0 auto' }}>
      {/* 2026-09-03 기현 지시 — 제목·부제·[← 목록으로]는 **앱 헤더**가 보여 준다(AppShell 의
          useStaticHeaderConfig 'rules'). 문서에는 스크린리더용 h2 만 남긴다: 헤더 제목은 span 이라
          문서 구조(heading)는 여기가 지고, 주제 전환 때 포커스가 앉는 자리도 여기다(아래 effect). */}
      <h2 ref={headingRef} tabIndex={-1} className="sr-only">
        {topic.title}
      </h2>

      {topic.blocks.map((block, i) => renderBlock(block, i, topic.key, activeSceneId, setActiveSceneId))}

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
