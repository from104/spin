// 조항 도해의 이름표만 모아 둔 곳(2026-08-21).
//
// 컴포넌트(`RuleFigure.tsx`)와 **일부러 갈라 놓았다**. 조항 데이터(`ruleContent.ts`)는 순수
// 데이터 모듈인데 도해 id 하나 때문에 `.tsx` 를 물면 데이터가 렌더 트리를 끌고 다닌다. 겸사
// react-refresh 도 파일 하나가 컴포넌트만 내보낼 때 제대로 돈다.
export type RuleFigureId =
  | 'court'
  | 'ball'
  | 'distance'
  // 2026-09-03 카드 1·2 도해 4장 — 조사 4·설계 4관점·심사 3렌즈+반박 워크플로우로 12 후보 중 채택.
  // 전부 코트·체어·사람 없는 도식(선·칸·시간축)이다. 설계 기록은 PLAN-RULES-9CARDS.md §11.
  | 'pf-quota'
  | 'lineage'
  | 'match-clock'
  | 'stuck-ball'
  // 2026-09-03 기현님 "카드당 3개는 적절함" — 상한을 3 으로 올리며 후보에서 상한 때문에만 밀렸던 둘을 넣었다.
  | 'goal-posts'
  | 'goal-height';

/** 도해 전량. `RuleFigure.tsx` 의 `Record<RuleFigureId, …>` 가 여기 없는 id 를 컴파일에서
 *  거른다 — 목록만 늘리고 그림을 안 그리는 사고가 안 난다. */
// 🪦 'equipment'(제4조 장비 도해)는 2026-09-03 에 지웠다 — 기현님이 조악하다고 판정. 체어 옆모습
// 글리프(PowerchairGlyph)는 공·거리 도해가 계속 쓰므로 남는다.
export const RULE_FIGURE_IDS: readonly RuleFigureId[] = [
  'court',
  'ball',
  'distance',
  'pf-quota',
  'lineage',
  'match-clock',
  'stuck-ball',
  'goal-posts',
  'goal-height',
];
