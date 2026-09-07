// 규칙 화면 튜토리얼 3단계 — docs/PLAN-RULES-REDESIGN.md §6(2026-08-22 주제별 재설계),
// 실습형은 docs/PLAN-HELP-OVERHAUL.md 결정 11a(2026-09-08).
// 세 앵커 전부 카드 홈(RulesHome)에 있다 — 이 화면은 항상 홈으로 마운트되므로 첫 진입에서
// 3단계가 전부 살아남는다(useTutorial 의 빈 화면 가드). 상세 뷰에서 재시작하면 RulesScreen 이
// 먼저 홈으로 돌아온 뒤 재시도 루프로 start() 를 부른다(홈 앵커가 그려질 때까지 기다려야 하는
// 이유는 RulesScreen.tsx 의 RESTART_RETRY_MAX_FRAMES 주석 참고).
//
// ── 이 화면만 §2.2 표대로 안 늘어난 이유 (2026-09-08) ────────────────────────────────
// 계획서 §2.2 는 `rules-play`([장면 재생])를 넣어 4단계로 적었지만, 그 버튼은 **주제 상세**에만
// 있다(RuleSceneBlock). 엔진은 `start()` 하는 **그 순간** DOM 에 있는 대상만 골라 두므로
// (useTutorial 의 빈 화면 가드 — 결정 13 이 그 형식에 기대고 있다), 홈에서 시작하는 이 투어는
// `rules-play` 를 언제나 걸러 낸다: 넣어도 절대 안 뜨는 단계가 된다. 앵커 자체는 RuleSceneBlock
// 에 심어 두었으니(도움말·후속 작업용) 엔진이 "중간에 생기는 대상"을 다루게 되는 날 이 배열에
// 한 줄만 더하면 된다.
// 대신 §2.2 가 요구한 **실습형 하나**는 지켰다 — `rules-card` 를 마지막에 두고 ★ 로 만들었다:
// 카드를 누르면 주제가 열리고(홈이 사라지고) 그것이 곧 투어의 끝이다. 카드를 중간에 두고 ★ 를
// 걸면 그 클릭으로 홈이 언마운트되어 뒤 단계들의 대상이 함께 사라진다 — 오버레이는 대상을 못
// 재면 아무것도 안 그리므로 사용자에게는 투어가 소리 없이 증발한 것으로 보인다.
import type { TutorialStep } from '../../ui/tutorial/types.ts';

export const RULES_TUTORIAL_STEPS: TutorialStep[] = [
  { target: 'rules-home', titleKey: 'tutorial.rules.step1.title', bodyKey: 'tutorial.rules.step1.body' },
  { target: 'rules-appendix', titleKey: 'tutorial.rules.step3.title', bodyKey: 'tutorial.rules.step3.body' },
  // ★ 실습형이자 마지막 단계 — 누르면 주제가 열리며 투어가 끝난다. 여는 것은 되돌릴 수 있다.
  { target: 'rules-card', titleKey: 'tutorial.rules.step2.title', bodyKey: 'tutorial.rules.step2.body', advanceOnClick: true },
];
