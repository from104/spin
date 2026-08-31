// 규칙 화면 카드 홈 — 정본은 **docs/PLAN-RULES-9CARDS.md**(2026-08-31 9카드 개편).
// 그 이전 정본이던 docs/PLAN-RULES-REDESIGN.md §3 "카드 홈(/rules)" 은 히스토리로만 남는다.
//
// 18개조 사전 목록을 대체하는 최상위 탐색. 카드에 번호를 안 붙인다(설치된 frontend-design
// 스킬 지침: 주제는 순서가 아니라 분류다) — 순서는 그리드 배열로만 말한다.
// (개편 전에는 8주제였다 — 개수를 주석에 적어 두면 늘 때마다 거짓이 된다.)
//
// 메타 배지(장면·도해 개수)는 `RuleTopic.blocks` 에서 **파생**한다 — 손으로 "장면 5" 를 적으면
// 장면을 추가할 때마다 카드와 실제 콘텐츠가 따로 논다.
import type { ComponentType } from 'react';
import type { RuleTopic, RuleTopicKey } from './ruleTopics.ts';
import { Card } from '../../ui/Card.tsx';
import { Pill } from '../../ui/Pill.tsx';
import { IconBoard, IconClear, IconGoalReset, IconInfo, IconListSteps, IconRuleZone, IconRules, IconSides, IconToolPlayer } from '../../ui/icons.tsx';
import type { IconProps } from '../../ui/icons.tsx';

// 아이콘은 주제마다 겹치지 않아야 한다 — 카드 홈은 아이콘 하나로 주제를 되찾는 자리다.
const TOPIC_ICONS: Record<RuleTopicKey, ComponentType<IconProps>> = {
  // "이 종목이 뭔가" — ⓘ 는 이 앱에서 **여기서 처음 쓰인다**(2026-08-31 확인: `IconInfo` 의
  // 호출자는 이 줄 하나뿐). [드릴 정보] 버튼은 ⓘ 를 쓰지 않는다 — 2026-08-28(310f9eb)에
  // `IconDrillInfoEdit`(연필) / `IconDrillInfoRead`(눈) 한 벌로 갈렸다. 즉 관례를 물려받는 게
  // 아니라 관례가 없어서 고른 것이고, 그래서 겹칠 아이콘도 없다.
  intro: IconInfo,
  purpose: IconGoalReset, // "골을 넣는다" — 골대 프레임 + 안으로 향하는 화살표, 뜻이 그림에 그대로 있다
  basics: IconBoard,
  restarts: IconListSteps,
  'out-of-play': IconSides,
  'goal-area': IconRuleZone, // 골라인 + 그 앞 사각 구역 = 골에어리어 도식 그 자체. IconGoalReset 을 purpose 에 넘기고 받았다
  'two-on-one': IconToolPlayer,
  fouls: IconClear,
  rulebook: IconRules,
};

/** 카드 홈 격자 — 네 값이 **함께** "3×3" 을 만든다(기현 지시 2026-08-31).
 *
 *  ⚠️ **열이 실제로 나눠 갖는 것은 `GRID_CONTENT_PX` 이지 `style.maxWidth` 가 아니다.**
 *  `tokens.css:3` 이 전역 `box-sizing: border-box` 라 max-width 안에 좌우 패딩이 들어간다.
 *  2026-08-31 첫 시도가 정확히 여기서 틀렸다 — max-width 를 800 으로 두고 3열을 기대했는데
 *  열이 받은 폭은 800 − 30×2 = 740 이라 **2열**이 떴다. 그래서 상한을 직접 적지 않고
 *  `콘텐츠 폭 + 패딩` 으로 **계산해서** 준다. 패딩을 고치는 사람이 상한을 잊을 수 없다.
 *
 *  열 수 = floor((content + gap) / (min + gap)) — `auto-fit` 의 정의다.
 *  지금 값으로 (800+14)/(240+14) = 3.20 → **3열**, 카드 한 장 (800−28)/3 ≈ 257px.
 *  하나만 움직여도 조용히 달라진다: content 를 1002 위로 올리면 4열, `CARD_MIN_PX` 를 267 위로
 *  올리면 2열이 된다. 컴파일도 렌더도 안 깨지므로 `RulesHome.test.tsx` 가 그 산술을 지킨다. */
export const CARD_MIN_PX = 240;
export const GRID_GAP_PX = 14;
/** 열이 실제로 나눠 갖는 폭. */
export const GRID_CONTENT_PX = 800;
export const GRID_PAD_X_PX = 30;
/** `style.maxWidth` 에 들어갈 값 — border-box 라 패딩을 더해야 콘텐츠가 위 폭을 받는다. */
export const GRID_MAX_PX = GRID_CONTENT_PX + GRID_PAD_X_PX * 2;

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
        // 9장을 **3×3** 으로 세운다(기현 지시 2026-08-31). 열 수를 `repeat(3, 1fr)` 로 못박지
        // 않는 이유: 그러면 좁은 창에서 카드가 100px 까지 눌린다. 대신 **컨테이너를 GRID_MAX_PX
        // 로 묶고** `auto-fit` 에 맡긴다 — 4열이 되려면 4×240 + 3×14 = 1002px 이 필요한데 상한이
        // 800 이라 넓은 창에서는 **항상 3열**이고, 창이 좁아지면 2열 → 1열로 저절로 접힌다.
        // §5.1("기기 분기 boolean 은 useIsNarrow·useIsPortrait 둘뿐")을 지키려고 새 문턱을 안 만든다.
        gridTemplateColumns: `repeat(auto-fit, minmax(min(${CARD_MIN_PX}px, 100%), 1fr))`,
        gap: GRID_GAP_PX,
        // 기현 지시 "카드 폭을 2/3 으로". 옛 상한 1180 에서 3열이면 카드가 384px 인데, 그 폭에는
        // 제목 한 줄 + 태그라인 한 줄 + 배지밖에 안 들어가 여백만 커진다. 384 × 2/3 ≈ 256 이 목표고
        // 지금 값이 257px 이다. ⚠️ 여기 들어가는 것은 콘텐츠 폭이 아니라 **패딩까지 더한 상한**이다.
        maxWidth: GRID_MAX_PX,
        margin: '0 auto',
        padding: `26px ${GRID_PAD_X_PX}px 46px`,
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
            // 튜토리얼 앵커는 `ruleTopics.ts` 의 데이터가 정한다 — 여기서 위치나 key 로 계산하지
            // 않는다. 2026-08-31 이전에는 `i === 0 ? 'rules-card' : ...` 삼항이었고, 9카드 개편이
            // 첫 카드를 basics → intro 로 바꾸면서 튜토리얼 2단계가 실제로 어긋났다: 그 단계 본문
            // (`tutorial.rules.step2.body`, ko·en·ja 모두)은 배지를 설명하는데 intro 에는 배지가
            // 하나도 없다(`topicMeta()` 가 빈 배열). 이 앵커를 지키는 테스트가 0건이라 CI 는
            // 아무 말도 하지 않았다. → 근거를 코드 위치가 아니라 주제 데이터에 둔다.
            data-tut={topic.tutorialAnchor}
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
