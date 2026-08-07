// §6.5 히트 반경 상한(blocker 수정). `HIT_PX/2 / pxPerUnit` 를 무제한 역환산하면 iPad 11"
// 에서 공의 히트 원이 지름 2.10 m 가 되어 휠체어(1.5 m)보다 커진다 — 레이어 순서상 공이
// 위라 볼 캐리어를 절대 잡을 수 없게 된다.
//
// 주의(계약서와 다른 점): §6.5 는 `HIT_PX/2 / pxPerUnit` 의 `HIT_PX` 를 `INTERACT_HIT_PX` 로
// 부르지만 §2.5(core/constants.ts, 이미 Wave1 에서 완성·커밋됨)의 `INTERACT` 에는 그 필드가
// 없다 — §7.3 이 말하는 "히트 44px, 큰 터치 타깃 설정 시 56px" 는 CSS 커스텀 프로퍼티
// `--hit` 로 구현되어 있고(ui-kit 소유, `Button.tsx` 등에서 `min-height:var(--hit)` 로 이미
// 쓰인다) core 상수가 아니다. 여기서는 그 44px 기본값을 이 파일의 로컬 상수로 두고,
// "큰 터치 타깃" 설정을 반영해야 하는 호출부(store/screen-editor)가 세 번째 인자로
// 56 을 넘길 수 있게 열어 둔다.
export const HIT_R_MAX_PX = { chair: 21.25, ball: 11.25, cone: 8.75, note: 12.5 } as const;

/** §7.3 기본 히트 타깃 44 CSS px. `body[data-touch="large"]` 설정에서는 56. */
export const DEFAULT_HIT_CSS_PX = 44;

export const hitRadius = (
  kind: keyof typeof HIT_R_MAX_PX,
  pxPerUnit: number,
  hitCssPx: number = DEFAULT_HIT_CSS_PX,
): number => Math.min(hitCssPx / 2 / pxPerUnit, HIT_R_MAX_PX[kind]);
