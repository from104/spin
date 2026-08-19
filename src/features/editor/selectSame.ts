// "같은 것 전부 고르기" — 개체 메뉴가 내는 **덩어리 선택**(§6.10b).
//
// ── 왜 사각형으로 훑는 것보다 이쪽이 먼저인가 ──────────────────────────────────────────
// 코치가 실제로 하는 말은 *"우리 팀 넷 다 5m 올려"* 이지 *"이 넷을 사각형으로 훑자"* 가
// 아니다. 개체가 많아야 스무 개인 판에서는 정밀하게 훑는 재주보다 **덩어리를 이름으로 집는
// 길**이 이긴다. 일러스트레이터의 *Select > Same* 이 전술판으로 번역된 자리다.
//
// 그리고 이것은 **터치에서 유일하게 작동하는 다중 선택**이다: 긴 누름 → 메뉴 → 한 번 탭이면
// 끝나므로 정밀 조작이 0이다. 수식키가 필요한 길은 손가락에 아예 열리지 않는다.
import { isId } from '../../core/ids.ts';
import { translate } from '../../i18n/useT.ts';
import type { Locale } from '../../i18n/locale.ts';

export interface SameKindScene {
  /** **이 스텝에 판 위에 있는** 휠체어만. 트레이에 주차된 칩은 고를 대상이 아니다. */
  chairs: readonly { id: string; team: 'home' | 'away' }[];
  balls: readonly string[];
  cones: readonly string[];
  notes: readonly string[];
  arrows: readonly string[];
  shapes: readonly string[];
  /** 이 스텝에서 잠긴 개체. 덩어리 선택은 이것들을 **집지 않는다** — 아래 주석 참고. */
  locked: ReadonlySet<string>;
}

export interface SameKindGroup {
  /** 메뉴에 그대로 찍히는 글자. */
  label: string;
  ids: string[];
}

/** 짚은 개체와 **같은 덩어리**. 없거나 혼자뿐이면 `null` — 눌러도 아무 일 없는 항목을 메뉴에
 *  내느니 안 내는 편이 정직하다(ObjectMenu 의 '무시' 항목이 이미 그 규율을 쓴다).
 *
 *  ⚠️ 잠긴 개체는 **안 담는다.** 고무줄 사각형과 같은 규칙이고 근거도 같다: 못 움직이는 것이
 *  선택에 섞이면 뒤이은 드래그가 통째로 안 먹는데 그 이유가 화면 어디에도 안 적혀 있다.
 *  덩어리로 집는 길에서만 빼는 것이라 잠금을 푸는 길(개체를 직접 클릭)은 그대로 남는다. */
export function sameKindGroup(id: string, s: SameKindScene, locale: Locale): SameKindGroup | null {
  const group = groupOf(id, s, locale);
  if (!group) return null;
  const ids = group.ids.filter((x) => !s.locked.has(x));
  // 자기 하나만 남으면 '전부' 라고 부를 것이 없다. 짚은 개체가 잠겨 있어 스스로 빠진 경우도
  // 여기로 떨어진다 — 그때도 항목을 안 내는 것이 맞다.
  return ids.length > 1 ? { label: group.label, ids } : null;
}

function groupOf(id: string, s: SameKindScene, locale: Locale): SameKindGroup | null {
  if (isId(id, 'ch')) {
    const team = s.chairs.find((c) => c.id === id)?.team;
    if (!team) return null;
    // 팀 이름(drill.teams[].label)을 쓰지 않는다 — 팀 이름은 사용자가 고치는 값이라
    // *"블루 전부 고르기"* 처럼 길거나 빈 글자가 될 수 있다. '같은 팀' 은 언제나 참이다.
    return { label: translate(locale, 'editor.selectSame.sameTeam'), ids: s.chairs.filter((c) => c.team === team).map((c) => c.id) };
  }
  if (isId(id, 'bl')) return { label: translate(locale, 'editor.selectSame.balls'), ids: [...s.balls] };
  // 콘은 2색이지만 색으로 가르지 않는다 — 색은 진영 표시로도 쓰고 그냥 구분용으로도 써서
  // "같은 색" 이 무엇을 뜻하는지가 판마다 다르다. 종류로 묶으면 뜻이 하나다.
  if (isId(id, 'cn')) return { label: translate(locale, 'editor.selectSame.cones'), ids: [...s.cones] };
  if (isId(id, 'nt')) return { label: translate(locale, 'editor.selectSame.notes'), ids: [...s.notes] };
  if (isId(id, 'ar')) return { label: translate(locale, 'editor.selectSame.arrows'), ids: [...s.arrows] };
  if (isId(id, 'sh')) return { label: translate(locale, 'editor.selectSame.shapes'), ids: [...s.shapes] };
  return null;
}
