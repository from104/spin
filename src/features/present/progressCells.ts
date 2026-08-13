// ★ 6.6 — 시연 진행 막대의 칸 상태. React 도 DOM 도 없는 순수 모듈이다.
//
// 왜 PresentRunner.tsx 안이 아니라 여기인가 — 두 가지다.
//  ① 이 재편이 겪은 헛통과 3형태("성질이 prop 뒤에 숨는다"): 진행 상태를 JSX 안 삼항으로만
//     적어 두면 진행 줄이 **둘**(세션 드릴 줄 · 스텝 줄)인데 한 줄만 고쳐도 아무 테스트가
//     빨개지지 않는다. 값의 규칙을 순수 함수로 빼면 단언이 거기 닿고, 두 줄이 같은 함수를
//     부르는지는 마크업 열거로 따로 확인한다(styles/contrast.test.tsx ④).
//  ② PresentRunner.tsx 는 컴포넌트 모듈이라 컴포넌트 아닌 것을 export 하면 oxlint
//     `react(only-export-components)` 경고가 는다(실측: 31 → 32). 파일 하나로 0 이 된다.
export type ProgressCellState = 'done' | 'current' | 'todo';

/** 칸 `index` 가 현재 위치 `current` 에 대해 지나갔는지/현재인지/남았는지.
 *  이 값이 그대로 `data-progress` 속성이 되고, styles/contrast.css ④ 가 그 이름을 부른다 —
 *  ⚠️ 값 문자열을 바꾸면 CSS 쪽도 같이 바꿔야 한다(짝은 contrast.test.tsx 가 잡는다). */
export function progressCellState(index: number, current: number): ProgressCellState {
  return index < current ? 'done' : index === current ? 'current' : 'todo';
}
