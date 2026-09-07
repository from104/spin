// §7.5f 가드 함수 2종. Space/Enter 는 브라우저가 활성화 키로 쓰므로 별도 가드가 필요하다.
// 방향키·문자키는 isEditableTarget 만, Space/Enter 는 isInteractiveTarget 도 검사한다.
// 안 그러면 트랜스포트 '재생' 버튼에 포커스한 채 Space 를 누르면 네이티브 클릭 + 전역 핸들러가
// 이중 발화해 아무 일도 일어나지 않고, 시연에서는 스텝이 2칸 건너뛴다.
// 우선순위: 개체 포커스 > 인터랙티브 요소 포커스(네이티브 위임) > 전역.
export const isEditableTarget = (t: EventTarget | null): boolean =>
  t instanceof HTMLElement &&
  (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);

/** IME 조합 중에 온 keydown 인가 — **조합을 끝내거나 취소하는 키를 UI 가 가로채면 안 된다.**
 *
 *  왜 셋을 다 보나. 같은 사실을 브라우저마다 다른 자리로 실어 보내기 때문이다.
 *   · `isComposing` — 표준 신호. 다만 `compositionstart` **앞의** 첫 keydown 에는 아직 서지 않는다.
 *   · `keyCode === 229` — 그 첫 keydown 을 잡는 레거시 신호. 명세에서 폐지 예정인 필드지만
 *     구형 IME 경로(일부 Windows·안드로이드 조합기)에서는 이것만 온다.
 *   · `key === 'Process'` — 입력기가 그 키를 자기가 처리했다고 알리는 값. 일부 조합기는
 *     `isComposing` 없이 이 값만 싣는다.
 *  하나만 보면 그 하나를 안 싣는 조합기에서 조합 취소 Esc 가 모달을 통째로 닫거나, 낱말을
 *  확정하는 Enter 가 입력칸을 커밋·blur 시킨다 — 첫 낱말마다 편집이 끝나는 증상이 된다.
 *
 *  ⚠️ 판정 자리는 **여기 하나**다. 같은 가드를 손으로 여러 벌 두면 새로 생기는 자리가 빠진다
 *  (2026-09-08 조사: 여섯 벌 가운데 셋이 빠져 있었다 — `docs/PLAN-HELP-OVERHAUL.md` F3).
 *  React 합성 이벤트에는 `isComposing` 이 없으므로 **`e.nativeEvent` 를 넘긴다.** */
export const isImeKeyEvent = (e: { isComposing?: boolean; keyCode?: number; key?: string }): boolean =>
  e.isComposing === true || e.keyCode === 229 || e.key === 'Process';

export const isInteractiveTarget = (t: EventTarget | null): boolean =>
  t instanceof HTMLElement &&
  t.closest(
    'button, a[href], select, textarea, input, summary, [role="button"], [role="radio"], [role="tab"], [contenteditable="true"]',
  ) !== null;
