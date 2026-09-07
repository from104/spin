// 스텝 사이 **연결 방식** 하나를 두 개의 저장 키(`cut`·`seamless`)로부터 읽고 쓰는 단일 자리.
// 정본 docs/PLAN-STEP-LINK.md(2026-09-08 기현 지시: *"드릴 편집에서 스텝을 연결하는 옵션을
// '끊김, 딜레이 연결, 딜레이 없는 연결' 을 둬서 실질적인 애니메이션 수준의 원칙적으로 만들 수
// 있도록 구현해봐"*).
//
// ⚠️ 왜 유니언 필드 하나(`link?: 'cut'|'seamless'`)로 저장하지 않았나: `cut` 은 2026-08-17
// 부터 저장본에 들어 있어서 필드를 갈아치우면 그 전 저장본 전부에 마이그레이션이 필요하다
// (= 스키마 도장 상승, 규칙 장면 후처리도 함께 바뀐다). 그래서 **저장은 예외 키 두 개, 읽기는
// 여기 한 함수**로 나눴다 — 저장형이 셋을 표현하는 방식은 이 파일 밖에서 몰라도 된다.
//
// 교리는 `cut` 의 것을 그대로 물려받는다: **경계는 "다음 스텝" 이 진다**(model/drill.ts 사슬 절).
import type { DrillStep } from './drill.ts';

/** 스텝 i-1 → i 경계의 연결 방식. `delay` 가 기본(두 키가 다 없을 때). */
export type StepLink = 'delay' | 'seamless' | 'cut';

/** 저장 키 두 개 → 연결 방식 하나. **`cut` 이 이긴다** — validate.ts 가 둘 다 실린 문서를
 *  정화하지만, 정화를 지나지 않은 메모리 상태(리듀서 중간값·테스트 픽스처)에서도 읽기 규칙이
 *  한 가지여야 재생과 UI 가 갈리지 않는다. */
export function stepLink(step: Pick<DrillStep, 'cut' | 'seamless'>): StepLink {
  if (step.cut === true) return 'cut';
  if (step.seamless === true) return 'seamless';
  return 'delay';
}

/** 연결 방식 → `STEP_META` 패치. **`false` 는 저장값이 아니라 "키를 지워라" 는 명령이다**
 *  (store/editor/reducer.ts STEP_META — `cut: false` 를 그대로 저장하면 validate 가 다음
 *  로드 때 버리므로 메모리에도 안 남긴다). 늘 두 키를 함께 실어 보내는 이유: 셋 중 하나로
 *  **덮어쓰는** 조작이라, 안 실은 키가 옛 값으로 남으면 "끊김인데 seamless 도 켜져 있다" 가
 *  만들어진다. */
export function stepLinkPatch(link: StepLink): { cut?: boolean; seamless?: boolean } {
  return { cut: link === 'cut', seamless: link === 'seamless' };
}

/** 틈 버튼의 3상태 순환(PLAN-STEP-LINK 결정 6): 딜레이 연결 → 딜레이 없는 연결 → 끊김 → …
 *  순서는 "이어짐이 강해지는 쪽" 이 아니라 **자주 쓰는 것부터**다 — 기본에서 한 번 누르면
 *  애니메이션, 두 번 누르면 끊김. */
export function nextStepLink(link: StepLink): StepLink {
  return link === 'delay' ? 'seamless' : link === 'seamless' ? 'cut' : 'delay';
}
