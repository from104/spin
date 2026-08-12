// §6.5 히트 반경 상한(blocker 수정). `HIT_PX/2 / pxPerUnit` 를 무제한 역환산하면 iPad 11"
// 에서 공의 히트 원이 지름 2.10 m 가 되어 휠체어(1.5 m)보다 커진다 — 레이어 순서상 공이
// 위라 볼 캐리어를 절대 잡을 수 없게 된다.
//
// 주의(계약서와 다른 점): §6.5 는 `HIT_PX/2 / pxPerUnit` 의 `HIT_PX` 를 `INTERACT_HIT_PX` 로
// 부르지만 §2.5(core/constants.ts)의 `INTERACT` 에는 그 필드가 **없었다** — §7.3 이 말하는
// "히트 44px, 큰 터치 타깃 설정 시 56px" 는 CSS 커스텀 프로퍼티 `--hit` 로만 구현되어 있고
// (ui-kit 소유, `Button.tsx` 등에서 `min-height:var(--hit)` 로 이미 쓰인다) core 상수가
// 아니었기 때문이다. 2단 히트(§4.3 P1-2)가 그 눈금을 코트 위에서도 쓰게 되면서
// `INTERACT.hitTargetCssPx` / `hitTargetLargeCssPx` 로 올라갔다 — 이제 여기서는 그것을
// 이름만 다시 붙여 준다(로컬 복제가 아니다).
//
// note 22: physics 쪽 복제본(`hitTest.ts`)과 함께 12.5 → 22. 이유는 그쪽 주석 참고.
// §4.3 P1-5 이후로는 `NOTE.ringRadiusPx`(선택 링 반지름)와도 **같은 값**이다 — 메모가 실제로
// 그려지는 쪽지 칩이 되면서, 상한이 링보다 작으면 링 안을 눌러도 안 잡히게 된다.
import { INTERACT } from '../core/constants.ts';

export const HIT_R_MAX_PX = { chair: 21.25, ball: 11.25, cone: 8.75, note: 22 } as const;

/** §7.3 기본 히트 타깃 44 CSS px. `body[data-touch="large"]` 설정에서는 56. */
export const DEFAULT_HIT_CSS_PX = INTERACT.hitTargetCssPx;

export const hitRadius = (
  kind: keyof typeof HIT_R_MAX_PX,
  pxPerUnit: number,
  hitCssPx: number = DEFAULT_HIT_CSS_PX,
): number => Math.min(hitCssPx / 2 / pxPerUnit, HIT_R_MAX_PX[kind]);
