// 규칙 화면(2026-08-21 신설, 2026-08-22 주제별 재설계 — docs/PLAN-RULES-REDESIGN.md 정본).
//
// settings 와 같은 "app-shell 미의존" 화면이다: 헤더는 AppShell.useStaticHeaderConfig 가
// 정적으로 채우고, 이 컴포넌트는 nav prop 없이 스스로 완결된 <main> 을 그린다.
//
// 마스터-디테일(좌측 18개조 목록+우측 상세)을 폐기하고 카드 홈(`RulesHome`) → 전폭 문서
// (`RuleTopicDoc`) 두 뷰로 재편했다 — 조항 순서는 "찾아보기"엔 맞지만 "익히기"엔 안 맞는다는
// 기현님 판정(2026-08-22)의 회귀 방지. 선택 상태는 지금은 이 화면 안 `useState` 뿐이다 —
// URL 딥링크 배선(`/rules/<topic>`)은 다음 커밋(AppShell.tsx 동반)에서 붙는다.
import { useCallback, useState } from 'react';
import { ruleTopicsFor } from './ruleTopics.ts';
import type { RuleTopicKey } from './ruleTopics.ts';
import { RulesHome } from './RulesHome.tsx';
import { RuleTopicDoc } from './RuleTopicDoc.tsx';
import { useLocale } from '../../i18n/useLocale.ts';
import { HelpCenter } from '../../ui/help/HelpCenter.tsx';
import { usePublishHelpShow } from '../../ui/help/HelpTriggerProvider.tsx';
import { useTutorial } from '../../ui/tutorial/useTutorial.ts';
import { TutorialOverlay } from '../../ui/tutorial/TutorialOverlay.tsx';
import { RULES_TUTORIAL_STEPS } from './tutorialSteps.ts';

/** 재시작 시 홈 앵커를 찾을 때까지 재시도할 상한 프레임 — `useTutorial.start()` 는 자동 시작과
 *  달리 재시도가 없는 1회성 querySelector 라서(useTutorial.ts:40-46), 상세 뷰에서 홈으로 막
 *  돌아온 직후(같은 틱)에 부르면 아직 그리지 않은 DOM 을 보고 조용히 실패한다. */
const RESTART_RETRY_MAX_FRAMES = 10;

export function RulesScreen() {
  const locale = useLocale();
  const topics = ruleTopicsFor(locale);
  const [selectedKey, setSelectedKey] = useState<RuleTopicKey | null>(null);

  // §0.5 Phase 5 — 레일 [도움말] 이 "지금 열려 있는 화면" 을 열려면 이 화면이 자기 HelpCenter 를
  // 여는 함수를 등록해야 한다(SettingsScreen.tsx·PresentRunner.tsx 와 같은 배선).
  const [helpOpen, setHelpOpen] = useState(false);
  const showHelp = useCallback(() => setHelpOpen(true), []);
  usePublishHelpShow(showHelp);

  // 3앵커(rules-home/rules-card/rules-appendix) 전부 홈 뷰에 있다 — 이 화면은 항상 홈으로
  // 마운트되므로 autoStart 는 고정 true 로 충분하다(tutorialSteps.ts 머리말).
  const tutorial = useTutorial('rules', RULES_TUTORIAL_STEPS, true);
  const restartTutorial = useCallback(() => {
    setSelectedKey(null);
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
  }, [tutorial]);

  const index = topics.findIndex((tp) => tp.key === selectedKey);
  const topic = index >= 0 ? topics[index] : undefined;

  return (
    <main id="main" tabIndex={-1} style={{ flex: 1, overflowY: 'auto', outline: 'none', background: 'var(--bg)' }}>
      {topic ? (
        <div style={{ padding: '26px 30px 46px' }}>
          <RuleTopicDoc
            key={topic.key}
            topic={topic}
            prevTopic={index > 0 ? (topics[index - 1] ?? null) : null}
            nextTopic={index < topics.length - 1 ? (topics[index + 1] ?? null) : null}
            onBack={() => setSelectedKey(null)}
            onSelectTopic={setSelectedKey}
          />
        </div>
      ) : (
        <RulesHome topics={topics} onOpen={setSelectedKey} />
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
