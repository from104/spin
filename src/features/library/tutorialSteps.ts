// 드릴 목록 튜토리얼 5단계 — 정본은 docs/PLAN-HELP-OVERHAUL.md §2.2(2026-09-08 증설).
// 그 이전 정본이던 docs/PLAN-HELP-TUTORIAL.md §D 는 3단계였다.
// [새 드릴]은 AppShell 이 정적으로 꽂는 헤더 주 액션이라 드릴 편집과 같은
// data-tut="header-primary" 를 그대로 재사용한다.
//
// ⚠️ **키 번호는 순서가 아니라 이름이다.** 아래 배열은 step4 → step2 → step5 … 로 흐른다 —
// 사이에 단계를 끼우거나 순서를 바꿀 때 기존 키를 밀어 번호를 다시 매기지 않고, 새 단계에
// **다음 빈 번호**를 준다. 밀면 세 로케일의 본문이 통째로 한 칸씩 옮겨 앉아야 하고(그 작업은
// 조용히 어긋난다), 2026-08-30 에 같은 이유로 앵커 이름을 안 바꾼 선례가 editor 쪽에 있다.
//
// ── ★ 실습형을 마지막에 두는 이유 (2026-09-08 검수) ──────────────────────────────────
// [새 드릴] ★ 는 **모달 다이얼로그**를 연다. 투어를 계속 진행하면 오버레이가 그 위를 덮어
// `aria-modal="true"` 가 둘 동시에 서고(로더 계획 결정 30·31 이 게이트를 만든 바로 그 상태),
// 다이얼로그의 [취소]가 검은 덮개 밑에 깔려 누르면 투어만 끝나고 창은 열린 채 남으며, 다음
// 단계의 구멍이 열린 창 위에 뚫린다. **투어를 여는 동작으로 끝내면** 셋 다 성립하지 않는다 —
// 다이얼로그가 뜨는 것이 곧 투어의 끝이다. 규칙 화면(rules/tutorialSteps.ts)이 같은 이유로
// `rules-card` ★ 를 마지막에 두었다: 화면을 바꾸는 실습은 언제나 맨 뒤다.
import type { TutorialStep } from '../../ui/tutorial/types.ts';

export const LIBRARY_TUTORIAL_STEPS: TutorialStep[] = [
  { target: 'library-search', titleKey: 'tutorial.library.step4.title', bodyKey: 'tutorial.library.step4.body' },
  { target: 'library-card', titleKey: 'tutorial.library.step2.title', bodyKey: 'tutorial.library.step2.body' },
  { target: 'library-card-menu', titleKey: 'tutorial.library.step5.title', bodyKey: 'tutorial.library.step5.body' },
  { target: 'library-filters', titleKey: 'tutorial.library.step3.title', bodyKey: 'tutorial.library.step3.body' },
  // ★ 실습형이자 마지막 단계 — [새 드릴]을 누르면 다이얼로그가 뜨고 투어는 거기서 끝난다.
  // 다이얼로그는 [취소]로 닫히므로 되돌릴 수 있다(결정 12).
  { target: 'header-primary', titleKey: 'tutorial.library.step1.title', bodyKey: 'tutorial.library.step1.body', advanceOnClick: true },
];
