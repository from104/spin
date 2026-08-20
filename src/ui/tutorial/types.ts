// 튜토리얼(스포트라이트) 공용 타입 — docs/PLAN-HELP-TUTORIAL.md §C.
import type { DictKey } from '../../i18n/ko.ts';

/** 한 단계 — 화면 위 한 요소를 가리키며 설명한다. `target` 은 그 요소의 `data-tut` 속성값
 *  (getBoundingClientRect 로 잰다). 요소가 그 순간 DOM 에 없으면(빈 목록 등) 이 단계는
 *  건너뛴다 — useTutorial 의 계약. */
export interface TutorialStep {
  target: string;
  titleKey: DictKey;
  bodyKey: DictKey;
}
