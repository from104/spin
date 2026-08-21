// 조항 도해의 이름표만 모아 둔 곳(2026-08-21).
//
// 컴포넌트(`RuleFigure.tsx`)와 **일부러 갈라 놓았다**. 조항 데이터(`ruleContent.ts`)는 순수
// 데이터 모듈인데 도해 id 하나 때문에 `.tsx` 를 물면 데이터가 렌더 트리를 끌고 다닌다. 겸사
// react-refresh 도 파일 하나가 컴포넌트만 내보낼 때 제대로 돈다.
export type RuleFigureId = 'ball';

/** 도해 전량. `RuleFigure.tsx` 의 `Record<RuleFigureId, …>` 가 여기 없는 id 를 컴파일에서
 *  거른다 — 목록만 늘리고 그림을 안 그리는 사고가 안 난다. */
export const RULE_FIGURE_IDS: readonly RuleFigureId[] = ['ball'];
