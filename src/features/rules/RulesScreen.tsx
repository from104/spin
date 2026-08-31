// 규칙 화면(2026-08-21 신설, 2026-08-22 주제별 재설계 — docs/PLAN-RULES-REDESIGN.md 정본).
//
// **app-shell 의존 화면이다** — 헤더는 AppShell.useStaticHeaderConfig 가 정적으로 채우지만,
// 딥링크(`/rules/<topic>`)가 이 화면의 선택 상태를 URL 에 실어야 해서 nav(HomeNav)/topic prop
// 을 받는다(board/drill·session 편집과 같은 계약 — AppShell.tsx "NavTarget ↔ 화면별 대상" 절).
// 선택 상태는 **로컬 state 가 아니라 topic prop 그 자체**다: 카드 클릭·뒤로가기·이전/다음 전부
// `nav.openRuleTopic()` 으로 URL 을 바꾸고, 그 URL 이 다음 렌더의 topic prop 으로 돌아온다 —
// 이중 장부(URL 과 state가 따로 노는 것)가 없어 새로고침·공유·브라우저 뒤로가기가 공짜다.
//
// 유효하지 않은 topic(옛 `/rules/law-N` 관용 매핑 실패, 오탈자 링크 등)은 조용히 카드 홈으로
// 떨어진다 — routes.ts 의 "모르는 경로는 board" 교리를 이 화면 안에서도 지킨다.
import { useCallback, useState } from 'react';
import { ruleTopicsFor, hasRuleContentFor, hasSceneTextFor, RULE_TOPIC_KEYS } from './ruleTopics.ts';
import type { RuleTopicKey } from './ruleTopics.ts';
import { RulesHome } from './RulesHome.tsx';
import { RuleTopicDoc } from './RuleTopicDoc.tsx';
import { RuleLanguageNotice } from './RuleLanguageNotice.tsx';
import { useLocale } from '../../i18n/useLocale.ts';
import type { HomeNav } from '../home/nav.ts';
import { HelpCenter } from '../../ui/help/HelpCenter.tsx';
import { usePublishHelpShow } from '../../ui/help/HelpTriggerProvider.tsx';
import { useTutorial } from '../../ui/tutorial/useTutorial.ts';
import { TutorialOverlay } from '../../ui/tutorial/TutorialOverlay.tsx';
import { RULES_TUTORIAL_STEPS } from './tutorialSteps.ts';

/** 재시작 시 홈 앵커를 찾을 때까지 재시도할 상한 프레임 — `useTutorial.start()` 는 자동 시작과
 *  달리 재시도가 없는 1회성 querySelector 라서(useTutorial.ts:40-46), 상세 뷰에서 홈으로 막
 *  돌아온 직후(같은 틱)에 부르면 아직 그리지 않은 DOM 을 보고 조용히 실패한다. */
const RESTART_RETRY_MAX_FRAMES = 10;

function isTopicKey(v: string | undefined): v is RuleTopicKey {
  return v !== undefined && (RULE_TOPIC_KEYS as readonly string[]).includes(v);
}

export function RulesScreen({ topic, nav }: { topic?: string; nav: HomeNav }) {
  const locale = useLocale();
  const topics = ruleTopicsFor(locale);
  // 콘텐츠는 ko 뿐이다(`RULE_CONTENT_LOCALES`). en/ja 로 들어온 사람에게 **왜** 한국어인지
  // 말해 주지 않으면 앱이 고장 난 것으로 읽힌다. 카드 홈과 주제 상세 **양쪽**에 띄운다 —
  // 딥링크(`/rules/<topic>`)로 상세에 곧장 들어오는 경로가 있어서 홈에만 두면 놓친다.
  const needsLangNotice = !hasRuleContentFor(locale) || !hasSceneTextFor(locale);
  const selectedKey = isTopicKey(topic) ? topic : null;

  // §0.5 Phase 5 — 레일 [도움말] 이 "지금 열려 있는 화면" 을 열려면 이 화면이 자기 HelpCenter 를
  // 여는 함수를 등록해야 한다(SettingsScreen.tsx·PresentRunner.tsx 와 같은 배선).
  const [helpOpen, setHelpOpen] = useState(false);
  const showHelp = useCallback(() => setHelpOpen(true), []);
  usePublishHelpShow(showHelp);

  // 3앵커(rules-home/rules-card/rules-appendix) 전부 홈 뷰에 있다 — 이 화면은 딥링크가 없는 한
  // 항상 홈으로 마운트되므로 autoStart 는 고정 true 로 충분하다(tutorialSteps.ts 머리말).
  const tutorial = useTutorial('rules', RULES_TUTORIAL_STEPS, true);
  const restartTutorial = useCallback(() => {
    nav.openRuleTopic(); // 홈으로 — URL 이 바뀌어야 카드 그리드(앵커 3개)가 다시 선다.
    let frame = 0;
    const tryStart = () => {
      frame += 1;
      const ready = document.querySelector('[data-tut="rules-home"]') !== null;
      if (ready || frame >= RESTART_RETRY_MAX_FRAMES) {
        tutorial.start();
        return;
      }
      requestAnimationFrame(tryStart);
    };
    requestAnimationFrame(tryStart);
  }, [nav, tutorial]);

  const index = topics.findIndex((tp) => tp.key === selectedKey);
  const current = index >= 0 ? topics[index] : undefined;

  return (
    <main id="main" tabIndex={-1} style={{ flex: 1, overflowY: 'auto', outline: 'none', background: 'var(--bg)' }}>
      {current ? (
        <div style={{ padding: '26px 30px 46px' }}>
          {needsLangNotice && <RuleLanguageNotice />}
          <RuleTopicDoc
            key={current.key}
            topic={current}
            prevTopic={index > 0 ? (topics[index - 1] ?? null) : null}
            nextTopic={index < topics.length - 1 ? (topics[index + 1] ?? null) : null}
            onBack={() => nav.openRuleTopic()}
            onSelectTopic={(key) => nav.openRuleTopic(key)}
          />
        </div>
      ) : (
        <>
          {needsLangNotice && (
            <div style={{ padding: '26px 30px 0' }}>
              <RuleLanguageNotice />
            </div>
          )}
          <RulesHome topics={topics} onOpen={(key) => nav.openRuleTopic(key)} />
        </>
      )}
      <HelpCenter open={helpOpen} onClose={() => setHelpOpen(false)} initialSection="rules" onRestartTutorial={restartTutorial} />
      {tutorial.step && (
        <TutorialOverlay
          step={tutorial.step}
          stepIndex={tutorial.stepIndex}
          totalSteps={tutorial.totalSteps}
          onNext={tutorial.next}
          onPrev={tutorial.prev}
          onSkip={tutorial.skip}
        />
      )}
    </main>
  );
}
