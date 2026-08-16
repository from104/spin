// §6.10c 트레이 드롭 — **놓기 전에** 무슨 일이 날지 말한다.
//
// > 2026-08-16 기현 지시: *"객체 선택 후 트레이로 끌고가면 빠지거나 지울 수 있는데 시각적
// > 효과를 직관적으로 만들어줘. 적절한 소리도 나게해줘."*
//
// 그때까지 이 길에는 **드래그 중 신호가 하나도 없었다**. 트레이 위에 손이 있는지 아닌지가
// 화면에 안 나타나고, 손을 떼고 나서야 소리가 났다 — 즉 사용자는 "지금 놓으면 어떻게 되는가"
// 를 시도해 보고서야 알 수 있었다. 되돌릴 수 있다는 것과 결과를 예고한다는 것은 다른 문제다.
//
// 이 파일은 그 예고의 **내용**을 정한다(모양·색은 a11y.css, 소리는 cueSpec.ts). 판정을
// `removal.ts` 에서 그대로 빌려 오는 것이 핵심이다 — 개체 메뉴의 글자, 치운 뒤의 토스트,
// 그리고 이 예고가 **같은 술어**를 써야 "빼기라고 예고하고 삭제했습니다" 가 안 난다.
import { removalLabel, returnsToTray } from './removal.ts';

/** 트레이가 이번 짐을 어떻게 받는가. 색이 갈리는 축이자, 소리가 갈리는 축이다.
 *  `mixed` 는 실제로 생긴다 — 고무줄로 칩과 메모를 함께 잡을 수 있기 때문이다(§6.10b). */
export type TrayDropKind = 'take' | 'erase' | 'mixed';

export interface TrayDropIntent {
  kind: TrayDropKind;
  /** 트레이 위에 뜨는 글자. `removalLabel` 을 그대로 품어 메뉴·토스트와 말이 같다. */
  label: string;
}

/** 이 id 들을 지금 트레이에 놓으면 무엇이 되는가. 빈 명단이면 예고할 것이 없다(null).
 *
 *  `mixed` 를 `erase` 로 접지 않는 이유: 접으면 "3개 빼고 1개 삭제" 라는 사실이 색에서
 *  사라진다. 색은 가장 무거운 결과를 따르되(아래 CSS 가 그렇게 칠한다) **종류는 남긴다** —
 *  이 값을 읽는 곳이 늘어날 때 "섞였다" 를 다시 계산하지 않게 하기 위해서다. */
export function trayDropIntent(ids: readonly string[]): TrayDropIntent | null {
  if (ids.length === 0) return null;
  const back = ids.filter(returnsToTray).length;
  const kind: TrayDropKind = back === ids.length ? 'take' : back === 0 ? 'erase' : 'mixed';
  return { kind, label: removalLabel(ids) };
}

/** 예고를 켜고 끄는 **DOM 어댑터**. React 를 거치지 않는 이유는 `chip--held`·러버밴드와 같다
 *  (§6.1 규칙 1): 이 신호는 드래그 중에 바뀌고, 드래그 중에는 상태를 올려 리렌더를 돌릴 수 없다.
 *
 *  노드를 여기서 만들지 않고 **ToolRail 이 늘 렌더해 둔 것**(`[data-tray-hint]`)을 찾아 쓴다 —
 *  드래그 중에 노드를 붙였다 떼면 첫 프레임이 레이아웃에 걸리고, 트레이가 언마운트된 뒤
 *  떠도는 노드가 남을 여지도 생긴다. 트레이가 없는 화면(시연 등)에서는 조용히 아무것도 안 한다. */
export const trayDropHint = {
  arm(intent: TrayDropIntent | null): void {
    const tray = document.querySelector<HTMLElement>('[data-tray]');
    if (!tray) return;
    const hint = tray.querySelector<HTMLElement>('[data-tray-hint]');
    if (!intent) {
      tray.removeAttribute('data-drop');
      if (hint) hint.textContent = '';
      return;
    }
    tray.setAttribute('data-drop', intent.kind);
    // "놓으면" 은 **아직 안 났다**는 뜻이다. 라벨만 두면('삭제') 이미 지워졌다고 읽힌다.
    if (hint) hint.textContent = `놓으면 ${intent.label}`;
  },
};
